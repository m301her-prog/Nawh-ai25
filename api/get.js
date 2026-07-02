import pg from 'pg';

export default async function handler(request, response) {
    // 1. إعدادات CORS الكاملة والمطابقة لكود الحفظ لتسهيل اتصال الهاتف والـ WebView
    response.setHeader('Access-Control-Allow-Credentials', true);
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    response.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, x-tenant-schema'
    );

    if (request.method === 'OPTIONS') return response.status(200).end();
    
    if (request.method !== 'GET') {
        return response.status(405).json({ success: false, error: 'Method Not Allowed' });
    }

    // 2. ضبط الاتصال بـ Postgres (Neon) بنفس الطريقة الآمنة
    const baseConnectionString = process.env.DATABASE_URL;
    const separator = baseConnectionString.includes('?') ? '&' : '?';
    const finalConnectionString = `${baseConnectionString}${separator}sslmode=verify-full`;

    const client = new pg.Client({
        connectionString: finalConnectionString,
        ssl: { 
            rejectUnauthorized: false 
        }
    });

    // استقبال اسم السكيمّا من الهيدر (يُرسل تلقائياً من الـ Context بالفرونت اند ليمثل الشركة)
    const targetSchema = request.headers['x-tenant-schema'];

    try {
        await client.connect();
        
        // 3. عزل مسار البيانات وتفعيل السكيمّا الخاصة بالعميل/الشركة تلقائياً في جلب البيانات
        if (targetSchema) {
            const cleanSchema = targetSchema.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
            await client.query(`SET search_path TO "${cleanSchema}", public`);
        }

        // 4. استعلام جلب الديون من جدول debts الموحد
        // تم إلغاء شرط الـ user_id والاعتماد على عزل السكيمّا للشركة بالكامل بناءً على كود الحفظ
        const debtsQuery = 'SELECT * FROM debts ORDER BY id DESC';
        const result = await client.query(debtsQuery);

        // 5. تحويل مسميات الأعمدة الـ Snake Case إلى Camel Case لتتوافق بدقة مع الـ Frontend وكود الحفظ
        const formattedDebts = result.rows.map(row => ({
            id: row.id,
            type: row.type,                  // 'owed_to_me' أو 'i_owe'
            personName: row.person_name,
            phone: row.phone,
            amount: parseFloat(row.amount) || 0,
            currency: row.currency || 'DZD',
            dueDate: row.due_date,
            notes: row.notes,
            status: row.status,              // 'pending' أو 'paid' أو 'partially_paid'
            isScheduled: row.is_scheduled || false,
            scheduleType: row.schedule_type,
            installmentsCount: row.installments_count || 0,
            firstPaymentDate: row.first_payment_date
        }));

        // إرجاع النتيجة بالصيغة الصحيحة المتوافقة مع كائن الـ Context
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
