import pg from 'pg';

export default async function handler(req, res) {
    // 1. إعدادات CORS الكاملة
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, x-tenant-schema, tenant, user-id'
    );

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method Not Allowed' });

    // 2. ضبط الاتصال بـ Postgres (Neon)
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

        // 3. استقبال البيانات والـ المعرفات المرنة
        const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
        const queryParams = req.query || {};

        // التقاط الـ ID المطلوب حسابه أو حذفه بشكل مرن
        const finalId = body.id || body.debtId || body.data?.id || body.debt?.id || queryParams.id;

        // التحقق من وجود المعرّف (ID)
        if (!finalId) {
            return res.status(400).json({ 
                success: false, 
                error: 'المعرف id مطلوب لتنفيذ عملية الحذف.' 
            });
        }

        // قراءة السكيمّا بمرونة عالية مثل كود الجلب
        const rawSchema = 
            req.headers['x-tenant-schema'] || 
            req.headers['tenant'] ||
            body.schemaName || 
            body.companyName || 
            body.company_name ||
            body.data?.companyName ||
            body.data?.company_name ||
            queryParams.companyName;

        const userId = body.userId || queryParams.userId || req.headers['user-id'];

        let targetSchema = '';

        // أ) إذا تم تحديد اسم السكيمّا أو الشركة مباشرة
        if (rawSchema) {
            let cleanName = String(rawSchema).replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
            if (cleanName.startsWith('schema_')) {
                cleanName = cleanName.replace('schema_', '');
            }
            targetSchema = `schema_${cleanName}`;
        } 
        // ب) إذا أُرسل userId، نجلب اسم الشركة والسكيمّا الخاصة به تلقائياً من الداتا بيز
        else if (userId) {
            const userRes = await client.query('SELECT company_name FROM public.app_users WHERE id = $1 LIMIT 1', [userId]);
            if (userRes.rows.length > 0 && userRes.rows[0].company_name) {
                let cleanCompany = userRes.rows[0].company_name.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
                if (cleanCompany.startsWith('schema_')) cleanCompany = cleanCompany.replace('schema_', '');
                targetSchema = `schema_${cleanCompany}`;
            }
        }

        // ج) الافتراضي تجنباً لأخطاء 400
        if (!targetSchema) {
            targetSchema = 'public';
        }

        // 4. ضبط السكيمّا المستهدفة
        await client.query(`SET search_path TO "${targetSchema}", public`);
        
        // 5. تنفيذ استعلام الحذف
        const query = `DELETE FROM debts WHERE id = $1 RETURNING *;`;
        const result = await client.query(query, [finalId]);

        // التحقق مما إذا كان السجل موجوداً وتم حذفه فعلياً
        if (result.rowCount === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'لم يتم العثور على العنصر المراد حذفه أو تم حذفه سابقاً.' 
            });
        }

        return res.status(200).json({ 
            success: true, 
            message: 'تم الحذف بنجاح', 
            deletedRow: result.rows[0], 
            rowCount: result.rowCount,
            schemaUsed: targetSchema
        });

    } catch (error) {
        console.error(`[DATABASE ERROR ON DELETE]:`, error);

        // معالجة حالة عدم وجود السكيمّا أو الجدول
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
