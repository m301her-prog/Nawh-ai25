import pg from 'pg';

export default async function handler(req, res) {
    // إعدادات CORS الكاملة
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    // إعداد الاتصال بمكتبة pg وحل مشكلة تحذير الـ SSL
    const baseConnectionString = process.env.DATABASE_URL;
    const separator = baseConnectionString.includes('?') ? '&' : '?';
    const finalConnectionString = `${baseConnectionString}${separator}sslmode=verify-full`;

    const client = new pg.Client({
        connectionString: finalConnectionString,
        ssl: { rejectUnauthorized: false }
    });

    // استقبال الاستعلام البارامترات القادمة من الواجهة مباشرة
    const { query, params } = req.body;

    if (!query) {
        return res.status(400).json({ success: false, error: 'الاستعلام (query) مطلوب' });
    }

    try {
        await client.connect();
        
        // تنفيذ الاستعلام المرسل من الواجهة أياً كان اسم الجدول
        const result = await client.query(query, params || []);
        
        return res.status(200).json({
            success: true,
            rows: result.rows,
            rowCount: result.rowCount
        });

    } catch (error) {
        console.error('DATABASE ERROR ON SAVE PROXY:', error);
        return res.status(500).json({ success: false, error: error.message });
    } finally {
        await client.end().catch(err => console.error('Error closing client:', err));
    }
}
