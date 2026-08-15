import pg from 'pg';

export default async function handler(request, response) {
    // 1. إعدادات CORS الكاملة والمطابقة لكود الحفظ لتسهيل اتصال الهاتف والـ WebView
    response.setHeader('Access-Control-Allow-Credentials', true);
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    response.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, x-tenant-schema'
    );

    if (request.method === 'OPTIONS') return response.status(200).end();
    
    // دعم GET و POST لمنع حدوث تعارض حسب طريقة الاستدعاء من Capacitor/Fetch
    if (request.method !== 'GET' && request.method !== 'POST') {
        return response.status(405).json({ success: false, error: 'Method Not Allowed' });
    }

    // 2. ضبط الاتصال بـ Postgres (Neon)
    const baseConnectionString = process.env.DATABASE_URL;
    if (!baseConnectionString) {
        return response.status(500).json({ success: false, error: 'DATABASE_URL غير معرف' });
    }

    const separator = baseConnectionString.includes('?') ? '&' : '?';
    const finalConnectionString = `${baseConnectionString}${separator}sslmode=verify-full`;

    const client = new pg.Client({
        connectionString: finalConnectionString,
        ssl: { 
            rejectUnauthorized: false 
        }
    });

    // استقبال اسم السكيمّا من الهيدر أو من الـ Body في حال طلبات POST
    const body = typeof request.body === 'string' ? JSON.parse(request.body || '{}') : (request.body || {});
    const targetSchema = request.headers['x-tenant-schema'] || body.schemaName || (body.userId ? `tenant_${body.userId}` : null);

    try {
        await client.connect();
        
        // 3. عزل مسار البيانات وتفعيل السكيمّا الخاصة بالشركة تلقائياً
        if (targetSchema) {
            const cleanSchema = targetSchema.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
            await client.query(`SET search_path TO "${cleanSchema}", public`);
        }

        // 4. استعلام جلب الديون من جدول debts
        const debtsQuery = 'SELECT * FROM debts ORDER BY id DESC';
        const result = await client.query(debtsQuery);

        // 5. تحويل مسميات الأعمدة الـ Snake Case إلى Camel Case لتتوافق بدقة مع الـ Frontend
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

        // إرجاع النتيجة بالصيغة الصحيحة
        return response.status(200).json({ 
            success: true, 
            debts: formattedDebts 
        });

    } catch (error) {
        console.error('DATABASE ERROR ON GET:', error);

        // معالجة خطأ عدم وجود الجدول أو السكيمّا (42P01 / 3F000) وإرجاع مصفوفة فارغة بدون انهيار التطبيق
        if (error.code === '42P01' || error.code === '3F000') {
            return response.status(200).json({
                success: true,
                debts: [],
                message: 'No records found for this tenant yet'
            });
        }

        return response.status(500).json({ 
            success: false, 
            error: 'فشل في جلب البيانات: ' + error.message 
        });
    } finally {
        // إغلاق الاتصال بأمان دائماً
        await client.end().catch(err => console.error('Error closing client:', err));
    }
}
