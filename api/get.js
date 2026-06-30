import { neon } from '@neondatabase/serverless';

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
        const sql = neon(process.env.DATABASE_URL);
        
        // جلب جميع البيانات من جدول products
        const products = await sql`
            SELECT * FROM products 
            ORDER BY created_at DESC;
        `;

        return response.status(200).json({ 
            success: true, 
            data: products 
        });

    } catch (error) {
        console.error('DATABASE ERROR:', error);
        return response.status(500).json({ 
            success: false, 
            error: 'فشل في جلب البيانات: ' + error.message 
        });
    }
}
