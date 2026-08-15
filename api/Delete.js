import pg from 'pg';

export default async function handler(req, res) {
    // 1. إعدادات CORS الكاملة
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, x-tenant-schema'
    );

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    // 2. ضبط الاتصال بـ Postgres (Neon)
    const baseConnectionString = process.env.DATABASE_URL;
    const separator = baseConnectionString.includes('?') ? '&' : '?';
    const finalConnectionString = `${baseConnectionString}${separator}sslmode=verify-full`;

    const client = new pg.Client({
        connectionString: finalConnectionString,
        ssl: { rejectUnauthorized: false }
    });

    // 3. استقبال البيانات والـ المعرفات المرنة
    const { id, debtId, companyName, company_name } = req.body;
    let targetSchema = req.headers['x-tenant-schema'];

    // التقاط الـ ID المطلوب حسابه أو حذفه بشكل مرن
    const finalId = id || debtId || req.body.data?.id || req.body.debt?.id;
    
    // التقاط اسم الشركة لتحديد السكيمّا
    const finalCompanyName = companyName || company_name || req.body.data?.companyName || req.body.data?.company_name;

    // التحقق من وجود المعرّف (ID)
    if (!finalId) {
        return res.status(400).json({ 
            success: false, 
            error: 'المعرف id مطلوب لتنفيذ عملية الحذف.' 
        });
    }

    // تحديد السكيمّا المستهدفة بناءً على اسم الشركة
    if (!targetSchema || targetSchema.trim() === '') {
        if (finalCompanyName) {
            targetSchema = `schema_${finalCompanyName.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase()}`;
        } else {
            return res.status(400).json({ 
                success: false, 
                error: 'اسم الشركة مطلوب لتحديد السكيمّا المستهدفة لحذف البيانات.' 
            });
        }
    }

    try {
        await client.connect();
        
        // 4. ضبط السكيمّا المستهدفة
        const cleanSchema = targetSchema.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
        await client.query(`SET search_path TO "${cleanSchema}"`);
        
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
            rowCount: result.rowCount 
        });

    } catch (error) {
        console.error(`[DATABASE ERROR ON DELETE]:`, error);
        return res.status(500).json({ success: false, error: error.message });
    } finally {
        await client.end().catch(err => console.error('Error closing client:', err));
    }
}
