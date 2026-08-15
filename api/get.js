import pg from 'pg';

export default async function handler(request, response) {
    // 1. إعدادات CORS
    response.setHeader('Access-Control-Allow-Credentials', true);
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    response.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, x-tenant-schema'
    );

    if (request.method === 'OPTIONS') return response.status(200).end();

    if (request.method !== 'GET' && request.method !== 'POST') {
        return response.status(405).json({ success: false, error: 'Method Not Allowed' });
    }

    // 2. ضبط الاتصال بقاعدة البيانات
    const baseConnectionString = process.env.DATABASE_URL;
    if (!baseConnectionString) {
        return response.status(500).json({ success: false, error: 'DATABASE_URL غير معرف' });
    }

    const separator = baseConnectionString.includes('?') ? '&' : '?';
    const finalConnectionString = `${baseConnectionString}${separator}sslmode=verify-full`;

    const client = new pg.Client({
        connectionString: finalConnectionString,
        ssl: { rejectUnauthorized: false }
    });

    // 3. استخراج اسم السكيمّا وضبط البادئة schema_
    const body = typeof request.body === 'string' ? JSON.parse(request.body || '{}') : (request.body || {});
    
    // القراءة من الهيدر أو البودي
    let rawSchema = request.headers['x-tenant-schema'] || body.schemaName || body.companyName || body.company_name;

    if (!rawSchema) {
        return response.status(400).json({ success: false, error: 'لم يتم توفير اسم السكيمّا أو اسم الشركة' });
    }

    // تنظيف اسم السكيمّا والتأكد من وجود البادئة schema_
    let cleanName = rawSchema.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
    
    // إزالة كلمة schema_ إن كانت ممررة مسبقاً لمنع التكرار
    if (cleanName.startsWith('schema_')) {
        cleanName = cleanName.replace('schema_', '');
    }
    
    // اسم السكيمّا النهائي المطابق للصورة (schema_xxx)
    const targetSchema = `schema_${cleanName}`;

    try {
        await client.connect();

        // 4. توجيه الاستعلام إلى السكيمّا الصحيحة للشركة
        await client.query(`SET search_path TO "${targetSchema}", public`);

        // 5. استعلام جلب الديون
        const debtsQuery = 'SELECT * FROM debts ORDER BY id DESC';
        const result = await client.query(debtsQuery);

        // 6. تحويل البيانات إلى CamelCase للفرونت إند
        const formattedDebts = result.rows.map(row => ({
            id: row.id,
            type: row.type,
            personName: row.person_name,
            phone: row.phone,
            amount: parseFloat(row.amount) || 0,
            currency: row.currency || 'DZD',
            dueDate: row.due_date,
            notes: row.notes,
            status: row.status,
            isScheduled: row.is_scheduled || false,
            scheduleType: row.schedule_type,
            installmentsCount: row.installments_count || 0,
            firstPaymentDate: row.first_payment_date
        }));

        return response.status(200).json({
            success: true,
            debts: formattedDebts
        });

    } catch (error) {
        console.error('DATABASE ERROR ON GET:', error);

        // إذا كانت السكيمّا أو الجدول غير موجودين بعد
        if (error.code === '42P01' || error.code === '3F000') {
            return response.status(200).json({
                success: true,
                debts: [],
                message: `السكيمّا ${targetSchema} أو جدول الديون غير موجود بعد`
            });
        }

        return response.status(500).json({
            success: false,
            error: 'فشل في جلب البيانات: ' + error.message
        });
    } finally {
        await client.end().catch(err => console.error('Error closing client:', err));
    }
}
