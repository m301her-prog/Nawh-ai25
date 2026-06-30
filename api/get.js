import pg from 'pg';
const { Pool } = pg;

// إنشاء اتصال موحد يضمن عدم تكرار فتح الروابط في السيرفرلس
let pool;
if (!pool) {
    pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false // مطلوب للاتصال الآمن بـ Neon
        }
    });
}

export default async function handler(request, response) {
    // إعدادات CORS
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (request.method === 'OPTIONS') return response.status(200).end();
    
    // التأكد من أن الطلب من نوع GET
    if (request.method !== 'GET') {
        return response.status(405).json({ success: false, error: 'Method Not Allowed' });
    }

    try {
        // تنفيذ الاستعلام عبر مكتبة pg
        const queryText = `
            SELECT * FROM products 
            ORDER BY created_at DESC;
        `;
        const result = await pool.query(queryText);

        // البيانات في مكتبة pg تعود دائماً داخل مصفوفة rows
        return response.status(200).json({ 
            success: true, 
            data: result.rows 
        });

    } catch (error) {
        console.error('DATABASE ERROR:', error);
        return response.status(500).json({ 
            success: false, 
            error: 'فشل في جلب البيانات: ' + error.message 
        });
    }
}
