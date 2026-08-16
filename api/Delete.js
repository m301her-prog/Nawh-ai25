import pg from 'pg';

/**
 * دالة تشخيصية لمعرفة السبب الدقيق لخطأ 404 عند فشل عملية الحذف
 */
async function diagnoseNotFoundReason(client, targetSchema, targetId, targetName) {
    const diagnostics = {
        schemaExists: false,
        tableExists: false,
        foundInOtherSchemas: [],
        totalRecordsInTable: 0,
        sampleRecords: [],
        possibleReason: ''
    };

    try {
        // 1. التحقق من وجود السكيمّا
        const schemaCheck = await client.query(
            `SELECT schema_name FROM information_schema.schemata WHERE schema_name = $1`,
            [targetSchema]
        );
        diagnostics.schemaExists = schemaCheck.rows.length > 0;

        // 2. التحقق من وجود جدول debts داخل السكيمّا
        const tableCheck = await client.query(
            `SELECT table_name FROM information_schema.tables WHERE table_schema = $1 AND table_name = 'debts'`,
            [targetSchema]
        );
        diagnostics.tableExists = tableCheck.rows.length > 0;

        if (!diagnostics.tableExists) {
            diagnostics.possibleReason = `الجدول debts غير موجود في السكيمّا (${targetSchema}).`;
            return diagnostics;
        }

        // 3. حساب عدد السجلات الكلي في الجدول المذكور
        const countRes = await client.query(`SELECT COUNT(*) FROM "${targetSchema}".debts`);
        diagnostics.totalRecordsInTable = parseInt(countRes.rows[0].count, 10);

        if (diagnostics.totalRecordsInTable === 0) {
            diagnostics.possibleReason = `الجدول debts في السكيمّا (${targetSchema}) فارغ تماماً لا يحتوي على أي بيانات.`;
        } else {
            // جلب عينة من أول 5 عناصر في الجدول لمعاينة الـ ID والأسماء المخزنة
            const sampleRes = await client.query(
                `SELECT id, person_name FROM "${targetSchema}".debts LIMIT 5`
            );
            diagnostics.sampleRecords = sampleRes.rows;
            diagnostics.possibleReason = `العنصر غير موجود في السكيمّا (${targetSchema}). يرجى التأكد من الـ ID أو الاسم المُرسل ومقارنته بالعينة المخزنة.`;
        }

        // 4. البحث عن العنصر في باقي السكيمات المتاحة لتحديد إذا تم حفظه في مكان آخر بالخطأ
        let searchQueryOther = '';
        let searchParamsOther = [];

        if (targetId) {
            searchQueryOther = `
                SELECT table_schema, id, person_name 
                FROM information_schema.tables t
                JOIN public.debts d ON true -- fallback check
                WHERE t.table_name = 'debts'
            `; // استعلام عام للبحث عبر السكيمات
            
            // بحث سريع في السكيمات الشائعة (مثل public)
            const otherCheck = await client.query(
                `SELECT 'public' as schema_name FROM public.debts WHERE id = $1 OR id LIKE $2 LIMIT 1`,
                [targetId, `%${targetId}%`]
            ).catch(() => ({ rows: [] }));

            if (otherCheck.rows.length > 0) {
                diagnostics.foundInOtherSchemas.push('public');
                diagnostics.possibleReason = `العنصر موجود في السكيمّا (public) وليس في السكيمّا المستهدفة (${targetSchema}). ينبغي مراجعة تحديد السكيمّا (companyName/userId).`;
            }
        }

    } catch (err) {
        diagnostics.diagnosticError = err.message;
    }

    return diagnostics;
}

export default async function handler(request, response) {
    // 1. إعدادات CORS
    response.setHeader('Access-Control-Allow-Credentials', true);
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
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

        // 3. تحليل البيانات القادمة من الفرونت
        const body = typeof request.body === 'string' ? JSON.parse(request.body || '{}') : (request.body || {});
        const queryParams = request.query || {};
        const d = body.debtData || body.debt || body.updates || body.data || body;

        // استخراج الـ ID والاسم بأكبر قدر من المرونة
        const targetId = String(body.id || body.debtId || d.id || queryParams.id || '').trim();
        const targetName = String(body.personName || body.person_name || body.name || d.personName || d.person_name || queryParams.personName || '').trim();

        if (!targetId && !targetName) {
            return response.status(400).json({
                success: false,
                error: 'يرجى إرسال id أو personName المُراد حذفه.'
            });
        }

        // 4. تحديد السكيمّا المستهدفة
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

        // 5. ضبط السكيمّا
        await client.query(`CREATE SCHEMA IF NOT EXISTS "${targetSchema}"`);
        await client.query(`SET search_path TO "${targetSchema}", public`);

        // 6. تنفيذ الحذف بنظام البحث المزدوج والمرن
        let deleteQuery = '';
        let queryParamsArr = [];

        if (targetId) {
            deleteQuery = `DELETE FROM debts WHERE id = $1 OR id LIKE $2 RETURNING *;`;
            queryParamsArr = [targetId, `%${targetId}%`];
        } else {
            deleteQuery = `DELETE FROM debts WHERE LOWER(TRIM(person_name)) = LOWER(TRIM($1)) RETURNING *;`;
            queryParamsArr = [targetName];
        }

        const result = await client.query(deleteQuery, queryParamsArr);

        // إذا فشل الحذف (404) ننتقل لتشغيل دالة التشخيص
        if (result.rowCount === 0) {
            const diagnostics = await diagnoseNotFoundReason(client, targetSchema, targetId, targetName);

            return response.status(404).json({
                success: false,
                message: `لم يتم العثور على العنصر بـ (${targetId || targetName}) للحذف في السكيمّا (${targetSchema}).`,
                debugInfo: {
                    searchedFor: { id: targetId, personName: targetName },
                    targetSchema,
                    reason: diagnostics.possibleReason,
                    diagnostics
                }
            });
        }

        return response.status(200).json({
            success: true,
            message: 'تم الحذف بنجاح من قاعدة البيانات',
            deletedCount: result.rowCount,
            deletedRows: result.rows
        });

    } catch (error) {
        console.error('DATABASE ERROR ON DELETE:', error);
        return response.status(500).json({
            success: false,
            error: 'حدث خطأ أثناء الحذف: ' + error.message
        });
    } finally {
        await client.end().catch(err => console.error('Error closing client:', err));
    }
}
