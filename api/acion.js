import pg from 'pg';

export default async function handler(request, response) {
    // 1. إعدادات CORS الكاملة
    response.setHeader('Access-Control-Allow-Credentials', true);
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    response.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, x-tenant-schema, tenant, user-id'
    );

    if (request.method === 'OPTIONS') return response.status(200).end();

    if (request.method !== 'GET' && request.method !== 'POST') {
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

        const rawSchema = 
            request.headers['x-tenant-schema'] || 
            request.headers['tenant'] ||
            body.schemaName || 
            body.companyName || 
            body.company_name ||
            queryParams.companyName ||
            queryParams.schemaName;

        const userId = body.userId || queryParams.userId || request.headers['user-id'];

        let targetSchema = '';

        // تحديد السكيمّا إذا أُرسلت صراحة
        if (rawSchema) {
            let cleanName = String(rawSchema).replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
            if (cleanName.startsWith('schema_')) {
                cleanName = cleanName.replace('schema_', '');
            }
            targetSchema = `schema_${cleanName}`;
        } 
        // تحديد السكيمّا عبر userId
        else if (userId) {
            const userRes = await client.query('SELECT company_name FROM public.app_users WHERE id = $1 LIMIT 1', [userId]);
            if (userRes.rows.length > 0 && userRes.rows[0].company_name) {
                let cleanCompany = userRes.rows[0].company_name.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
                if (cleanCompany.startsWith('schema_')) cleanCompany = cleanCompany.replace('schema_', '');
                targetSchema = `schema_${cleanCompany}`;
            }
        }

        // =========================================================
        // الحالة الأولى: طلب لشركة واحدة محددة (استخدام التطبيق المباشر)
        // =========================================================
        if (targetSchema) {
            await client.query(`SET search_path TO "${targetSchema}", public`);
            const result = await client.query('SELECT * FROM debts ORDER BY id DESC');

            const formattedDebts = result.rows.map(row => ({
                id: row.id,
                type: row.type,
                personName: row.person_name,
                phone: row.phone,
                amount: parseFloat(row.amount) || 0,
                currency: row.currency || 'DZD',
                dueDate: row.due_date,
                notes: row.notes,
                status: row.status,
                isScheduled: row.is_scheduled || false,
                scheduleType: row.schedule_type,
                installmentsCount: row.installments_count || 0,
                firstPaymentDate: row.first_payment_date
            }));

            return response.status(200).json({
                success: true,
                debts: formattedDebts,
                schemaUsed: targetSchema
            });
        }

        // =========================================================
        // الحالة الثانية: لم تُحدد شركة (طلب الأكشن / النسخ الاحتياطي الشامل)
        // جلب البيانات من كافة الشركات المسجلة في السكيمات وجدول المستخدمين
        // =========================================================
        
        // 1. جلب كافة السكيمات المعرفة في الداتا بيز
        const schemasRes = await client.query(`
            SELECT schema_name 
            FROM information_schema.schemata 
            WHERE schema_name LIKE 'schema_%'
        `);
        
        const schemasSet = new Set(schemasRes.rows.map(r => r.schema_name));

        // 2. جلب أسماء الشركات من جدول app_users لضمان عدم تفويت أي شركة
        try {
            const usersRes = await client.query('SELECT DISTINCT company_name FROM public.app_users WHERE company_name IS NOT NULL');
            usersRes.rows.forEach(u => {
                let clean = u.company_name.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
                if (clean.startsWith('schema_')) clean = clean.replace('schema_', '');
                if (clean) schemasSet.add(`schema_${clean}`);
            });
        } catch (e) {
            console.log('ملاحظة: لم يتم جلب app_users أو أنه غير موجود');
        }

        const allSchemas = Array.from(schemasSet);
        if (allSchemas.length === 0) {
            allSchemas.push('public');
        }

        let allDebtsCombined = [];

        // 3. الدوران على كافة السكيمات واستخراج الديون منها
        for (const schemaName of allSchemas) {
            try {
                await client.query(`SET search_path TO "${schemaName}", public`);
                const result = await client.query('SELECT * FROM debts ORDER BY id DESC');

                const schemaDebts = result.rows.map(row => ({
                    id: row.id,
                    type: row.type,
                    personName: row.person_name,
                    phone: row.phone,
                    amount: parseFloat(row.amount) || 0,
                    currency: row.currency || 'DZD',
                    dueDate: row.due_date,
                    notes: row.notes,
                    status: row.status,
                    isScheduled: row.is_scheduled || false,
                    scheduleType: row.schedule_type,
                    installmentsCount: row.installments_count || 0,
                    firstPaymentDate: row.first_payment_date,
                    // إضافة اسم الشركة المصدر لكل دين لتسهيل تصنيف الملفات
                    companySchema: schemaName,
                    companyName: schemaName.replace('schema_', '')
                }));

                allDebtsCombined = allDebtsCombined.concat(schemaDebts);
            } catch (err) {
                // تجنب التوقف عند السكيمات التي لا تحتوي جدول debts
                continue;
            }
        }

        return response.status(200).json({
            success: true,
            debts: allDebtsCombined,
            schemaUsed: 'ALL_SCHEMAS',
            totalRecords: allDebtsCombined.length
        });

    } catch (error) {
        console.error('DATABASE ERROR ON GET:', error);

        if (error.code === '42P01' || error.code === '3F000') {
            return response.status(200).json({
                success: true,
                debts: [],
                message: 'لا توجد بيانات مسجلة في هذه السكيمّا بعد'
            });
        }

        return response.status(500).json({
            success: false,
            error: 'فشل في جلب البيانات: ' + error.message
        });
    } finally {
        await client.end().catch(err => console.error('Error closing client:', err));
    }
}
