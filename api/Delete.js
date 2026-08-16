import pg from 'pg';

export default async function handler(req, res) {
    // 1. إعدادات CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, x-tenant-schema, tenant, user-id'
    );

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    // 2. الاتصال بـ Neon Postgres
    const baseConnectionString = process.env.DATABASE_URL;
    if (!baseConnectionString) {
        return res.status(500).json({ success: false, error: 'DATABASE_URL غير معرف' });
    }

    const separator = baseConnectionString.includes('?') ? '&' : '?';
    const finalConnectionString = `${baseConnectionString}${separator}sslmode=verify-full`;

    const client = new pg.Client({
        connectionString: finalConnectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        // 3. التقاط الـ ID والبيانات بجميع الصيغ الممكنة
        const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
        const queryParams = req.query || {};

        // استخراج الـ ID والتأكد من تحويله لنص لمطابقة نوع الحقل في Postgres
        const rawId = body.id || body.debtId || body.data?.id || body.debt?.id || queryParams.id;
        const finalId = rawId ? String(rawId).trim() : null;

        if (!finalId) {
            return res.status(400).json({ 
                success: false, 
                error: 'المعرف id مطلوب لتنفيذ عملية الحذف.' 
            });
        }

        // 4. تحديد السكيمّا المستهدفة
        const rawSchema = 
            req.headers['x-tenant-schema'] || 
            req.headers['tenant'] ||
            body.schemaName || 
            body.companyName || 
            body.company_name ||
            body.data?.companyName ||
            queryParams.companyName;

        const userId = body.userId || queryParams.userId || req.headers['user-id'];

        let targetSchema = '';

        if (rawSchema) {
            let cleanName = String(rawSchema).replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
            if (cleanName.startsWith('schema_')) cleanName = cleanName.replace('schema_', '');
            targetSchema = `schema_${cleanName}`;
        } else if (userId) {
            const userRes = await client.query('SELECT company_name FROM public.app_users WHERE id = $1 LIMIT 1', [userId]);
            if (userRes.rows.length > 0 && userRes.rows[0].company_name) {
                let cleanCompany = userRes.rows[0].company_name.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
                if (cleanCompany.startsWith('schema_')) cleanCompany = cleanCompany.replace('schema_', '');
                targetSchema = `schema_${cleanCompany}`;
            }
        }

        if (!targetSchema) targetSchema = 'public';

        // 5. ضبط السكيمّا وتنفيذ استعلام الحذف الشامل (مع تحويل الـ ID لنص)
        await client.query(`SET search_path TO "${targetSchema}", public`);
        
        const deleteQuery = `DELETE FROM debts WHERE id::text = $1::text RETURNING *;`;
        const result = await client.query(deleteQuery, [finalId]);

        if (result.rowCount === 0) {
            return res.status(404).json({ 
                success: false, 
                message: `لم يتم العثور على العنصر رقم (${finalId}) في السكيمّا (${targetSchema})، قد يكون محذوفاً بالفعل.` 
            });
        }

        return res.status(200).json({ 
            success: true, 
            message: 'تم الحذف بنجاح', 
            deletedRow: result.rows[0]
        });

    } catch (error) {
        console.error(`[DATABASE ERROR ON DELETE]:`, error);

        if (error.code === '42P01' || error.code === '3F000') {
            return res.status(404).json({
                success: false,
                message: 'جدول الديون غير موجود في هذه السكيمّا.'
            });
        }

        return res.status(500).json({ success: false, error: 'فشل في تنفيذ الحذف: ' + error.message });
    } finally {
        await client.end().catch(err => console.error('Error closing client:', err));
    }
}
