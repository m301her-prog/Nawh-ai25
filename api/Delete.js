import pg from 'pg';

// إدارة الاتصالات باستخدام Pool لمنع تمدد وإغلاق الاتصالات بشكل مفرط
const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: true }
});

export default async function handler(req, res) {
    // 1. إعدادات CORS
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, x-tenant-schema, tenant'
    );

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    // 2. تحليل جسم الطلب والمعاملات
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const queryParams = req.query || {};
    const d = body.debtData || body.debt || body.updates || body.data || body;

    // 3. استخراج المعرف (ID)
    const rawId = body.id || body.debtId || d.id || queryParams.id;
    const finalId = rawId ? String(rawId).trim() : null;

    if (!finalId) {
        return res.status(400).json({ 
            success: false, 
            error: 'المعرف id مطلوب لتنفيذ عملية الحذف.' 
        });
    }

    // 4. استخراج اسم الشركة وتحديد السكيمّا بطريقة مطابقة لكود الحفظ
    let targetSchema = req.headers['x-tenant-schema'] || req.headers['tenant'];
    const finalCompanyName = body.companyName || body.company_name || d.companyName || d.company_name || queryParams.companyName;

    if (!targetSchema || !targetSchema.trim()) {
        if (finalCompanyName) {
            targetSchema = `schema_${finalCompanyName.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase()}`;
        } else {
            return res.status(400).json({ 
                success: false, 
                error: 'اسم الشركة مطلوب لتحديد السكيمّا المستهدفة للحذف.' 
            });
        }
    }

    const cleanSchema = targetSchema.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();

    // 5. سحب اتصال من الـ Pool والتنفيذ
    const client = await pool.connect();

    try {
        // ضبط المسار للسكيمّا المحددة
        await client.query(`SET search_path TO "${cleanSchema}"`);

        // تنفيذ عملية الحذف
        const deleteQuery = `DELETE FROM debts WHERE id::text = $1::text RETURNING *;`;
        const result = await client.query(deleteQuery, [finalId]);

        if (result.rowCount === 0) {
            return res.status(404).json({ 
                success: false, 
                message: `لم يتم العثور على العنصر رقم (${finalId}) في السكيمّا (${cleanSchema})، قد يكون محذوفاً بالفعل.` 
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
        // إرجاع الاتصال للـ Pool
        client.release();
    }
}
