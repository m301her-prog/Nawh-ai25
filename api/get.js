import pg from 'pg';

export default async function handler(request, response) {
    // 1. إعدادات CORS الكاملة لمنع حظر الطلبات من الأندرويد أو المتصفح
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (request.method === 'OPTIONS') return response.status(200).end();
    
    if (request.method !== 'GET') {
        return response.status(405).json({ success: false, error: 'Method Not Allowed' });
    }

    // 2. إعداد الاتصال باستخدام مكتبة pg الموحدة مع حل تحذير الـ SSL
    const baseConnectionString = process.env.DATABASE_URL;
    const separator = baseConnectionString.includes('?') ? '&' : '?';
    const finalConnectionString = `${baseConnectionString}${separator}sslmode=verify-full`;

    const client = new pg.Client({
        connectionString: finalConnectionString,
        ssl: { 
            rejectUnauthorized: false 
        }
    });

    try {
        // جلب الـ userId المرسل من الواجهة الأمامية (Query Parameter)
        const { userId } = request.query;

        if (!userId) {
            return response.status(400).json({ success: false, error: 'معرف المستخدم (userId) مطلوب' });
        }

        await client.connect();
        
        // 3. استعلام جلب الديون الخاصة بالمستخدم من الجدول الصحيح (استبدل app_debts باسم جدول الديون لديك إذا كان مختلفاً)
        // افترضنا هنا أن اسم الجدول app_debts وبأحرف صغيرة تماماً
        const debtsQuery = 'SELECT * FROM app_debts WHERE user_id = $1 ORDER BY created_at DESC';
        const result = await client.query(debtsQuery, [userId]);

        // تحويل مسميات الأعمدة الـ Snake Case إلى Camel Case لتتوافق مع ما تتوقعه الواجهة الأمامية (الـ Frontend)
        const formattedDebts = result.rows.map(row => ({
            id: row.id,
            userId: row.user_id,
            title: row.title,
            amount: parseFloat(row.amount),
            type: row.type, // 'owed_to_me' أو 'i_owe'
            personName: row.person_name,
            personPhone: row.person_phone,
            dueDate: row.due_date,
            status: row.status, // 'pending' أو 'paid'
            createdAt: row.created_at,
            notes: row.notes
        }));

        // إرجاع النتيجة بالصيغة التي ينتظرها كود الـ Context (data.debts)
        return response.status(200).json({ 
            success: true, 
            debts: formattedDebts 
        });

    } catch (error) {
        console.error('DATABASE ERROR ON GET:', error);
        return response.status(500).json({ 
            success: false, 
            error: 'فشل في جلب البيانات: ' + error.message 
        });
    } finally {
        // إغلاق الاتصال بأمان دائماً
        await client.end().catch(err => console.error('Error closing client:', err));
    }
}
