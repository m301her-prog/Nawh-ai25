import pg from 'pg';

export default async function handler(req, res) {
    // 1. إعدادات CORS الكاملة للسماح بتوصيل التطبيق والهاتف بدون حظر
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, x-tenant-schema'
    );

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    // 2. إعداد الاتصال بمكتبة pg وحل مشكلة تحذير الـ SSL
    const baseConnectionString = process.env.DATABASE_URL;
    const separator = baseConnectionString.includes('?') ? '&' : '?';
    const finalConnectionString = `${baseConnectionString}${separator}sslmode=verify-full`;

    const client = new pg.Client({
        connectionString: finalConnectionString,
        ssl: { rejectUnauthorized: false }
    });

    // 3. استقبال الاستعلام والبارامترات + اسم السكيمّا الخاصة بالعميل
    // نتيح قراءة السكيمّا إما من الـ body أو من الهيدر x-tenant-schema لضمان المرونة
    const { query, params, schemaName } = req.body;
    const targetSchema = schemaName || req.headers['x-tenant-schema'];

    if (!query) {
        return res.status(400).json({ success: false, error: 'الاستعلام (query) مطلوب' });
    }

    try {
        await client.connect();
        
        // 4. تطبيق نظام الـ Multi-tenancy وعزل البيانات عبر السكيمّا
        if (targetSchema) {
            // تنظيف اسم السكيمّا لضمان الحماية من الـ SQL Injection (حروف وأرقام وأندرسكور فقط)
            const cleanSchema = targetSchema.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
            
            // أ) إنشاء السكيمّا إذا لم تكن موجودة مسبقاً لهذا العميل
            await client.query(`CREATE SCHEMA IF NOT EXISTS ${cleanSchema}`);
            
            // ب) تحويل مسار الاستعلامات القادمة لتعمل بداخل هذه السكيمّا تحديداً
            await client.query(`SET search_path TO ${cleanSchema}`);
        }
        
        // 5. تنفيذ الاستعلام المرسل من الواجهة (الآن سيتوجه تلقائياً للجداول داخل السكيمّا المحددة)
        const result = await client.query(query, params || []);
        
        return res.status(200).json({
            success: true,
            rows: result.rows,
            rowCount: result.rowCount
        });

    } catch (error) {
        console.error('DATABASE ERROR ON SAVE PROXY WITH SCHEMA:', error);
        return res.status(500).json({ success: false, error: error.message });
    } finally {
        // إغلاق الاتصال بأمان
        await client.end().catch(err => console.error('Error closing client:', err));
    }
}
