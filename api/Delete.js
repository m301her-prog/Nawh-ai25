import pg from 'pg';

export default async function handler(request, response) {
    // 1. إعدادات CORS الكاملة
    response.setHeader('Access-Control-Allow-Credentials', true);
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'POST,DELETE,OPTIONS');
    response.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, x-tenant-schema, tenant, user-id'
    );

    if (request.method === 'OPTIONS') return response.status(200).end();

    if (request.method !== 'POST' && request.method !== 'DELETE') {
        return response.status(405).json({ success: false, error: 'Method Not Allowed' });
    }

    // 2. الاتصال بـ Neon Postgres
    const baseConnectionString = process.env.DATABASE_URL;
    if (!baseConnectionString) {
        return response.status(500).json({ success: false, error: 'DATABASE_URL غير معرف' });
    }

    const separator = baseConnectionString.includes('?') ? '&' : '?';
    const finalConnectionString = `${baseConnectionString}${separator}sslmode=verify-full`;

    const client = new pg.Client({
        connectionString: finalConnectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        // 3. قراءة البيانات المرسلة بجميع الطرق الممكنة (Body, Query, Headers)
        const body = typeof request.body === 'string' ? JSON.parse(request.body || '{}') : (request.body || {});
        const queryParams = request.query || {};
        const d = body.debtData || body.debt || body.updates || body.data || body;

        // استخراج ID واسم الشخص للحذف
        const rawId = body.id || body.debtId || d.id || queryParams.id;
        const finalId = rawId ? String(rawId).trim() : null;

        const rawName = body.personName || body.person_name || body.name || d.personName || d.person_name || queryParams.personName;
        const finalName = rawName ? String(rawName).trim() : null;

        // استخراج معطيات السكيمّا والمستخدم
        const rawSchema = 
            request.headers['x-tenant-schema'] || 
            request.headers['tenant'] ||
            body.schemaName || 
            body.companyName || 
            body.company_name ||
            d.companyName ||
            d.company_name ||
            queryParams.companyName ||
            queryParams.schemaName;

        const userId = body.userId || d.userId || queryParams.userId || request.headers['user-id'];

        let targetSchema = '';

        if (rawSchema) {
            let cleanName = String(rawSchema).replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
            if (cleanName.startsWith('schema_')) {
                cleanName = cleanName.replace('schema_', '');
            }
            targetSchema = `schema_${cleanName}`;
        } else if (userId) {
            const userRes = await client.query('SELECT company_name FROM public.app_users WHERE id = $1 LIMIT 1', [userId]);
            if (userRes.rows.length > 0 && userRes.rows[0].company_name) {
                let cleanCompany = userRes.rows[0].company_name.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
                if (cleanCompany.startsWith('schema_')) cleanCompany = cleanCompany.replace('schema_', '');
                targetSchema = `schema_${cleanCompany}`;
            }
        }

        if (!targetSchema) {
            targetSchema = 'public';
        }

        // 4. إنشاء السكيمّا والجدول إن لم يكونا موجودين لمنع خطأ 42P01 نهائياً
        await client.query(`CREATE SCHEMA IF NOT EXISTS "${targetSchema}"`);
        await client.query(`SET search_path TO "${targetSchema}", public`);

        await client.query(`
            CREATE TABLE IF NOT EXISTS debts (
                id TEXT PRIMARY KEY,
                type TEXT NOT NULL,
                person_name TEXT NOT NULL,
                phone TEXT,
                amount NUMERIC NOT NULL,
                currency TEXT,
                due_date DATE,
                notes TEXT,
                status TEXT,
                is_scheduled BOOLEAN,
                schedule_type TEXT,
                installments_count INT,
                first_payment_date DATE
            );
        `);

        // 5. تنفيذ الحذف إما بـ ID أو بـ person_name
        let deleteQuery = '';
        let queryParamsArr = [];

        if (finalId) {
            deleteQuery = 'DELETE FROM debts WHERE id::text = $1::text RETURNING *;';
            queryParamsArr = [finalId];
        } else if (finalName) {
            deleteQuery = 'DELETE FROM debts WHERE LOWER(TRIM(person_name)) = LOWER(TRIM($1)) RETURNING *;';
            queryParamsArr = [finalName];
        } else {
            return response.status(400).json({
                success: false,
                error: 'يجب توفير معرف id أو اسم الشخص (personName) للحذف.'
            });
        }

        const result = await client.query(deleteQuery, queryParamsArr);

        if (result.rowCount === 0) {
            return response.status(404).json({
                success: false,
                message: `لم يتم العثور على أي عنصر مطابق لـ (${finalId || finalName}) في السكيمّا (${targetSchema}).`,
                schemaUsed: targetSchema
            });
        }

        return response.status(200).json({
            success: true,
            message: 'تم الحذف بنجاح',
            deletedCount: result.rowCount,
            deletedRows: result.rows,
            schemaUsed: targetSchema
        });

    } catch (error) {
        console.error('DATABASE ERROR ON DELETE:', error);
        return response.status(500).json({
            success: false,
            error: 'فشل في تنفيذ الحذف: ' + error.message
        });
    } finally {
        await client.end().catch(err => console.error('Error closing client:', err));
    }
}
