import pg from 'pg';

export default async function handler(req, res) {
    // 1. إعدادات CORS الكاملة لتسهيل اتصال الهاتف والـ WebView
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
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

    // 3. استقبال الـ Action والبيانات والسكيمّا من الهيدر
    const { action, id, debtData } = req.body;
    const targetSchema = req.headers['x-tenant-schema']; // يُرسل تلقائياً من الـ Context بالفرونت اند ليمثل الشركة

    // 🔥 الحماية الذكية: إذا لم يجد كائن debtData، سيعتبر أن req.body هو كائن البيانات مباشرة
    const d = debtData || req.body || {}; 

    try {
        await client.connect();
        
        // 4. عزل مسار البيانات وتفعيل السكيمّا الخاصة بالعميل/الشركة تلقائياً
        if (targetSchema) {
            const cleanSchema = targetSchema.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
            await client.query(`CREATE SCHEMA IF NOT EXISTS ${cleanSchema}`);
            await client.query(`SET search_path TO ${cleanSchema}, public`);
            
            // إنشاء جدول الديون داخل هذه السكيمّا تلقائياً إن لم يكن موجوداً، لضمان عدم حدوث خطأ
            await client.query(`
                CREATE TABLE IF NOT EXISTS debts (
                    id TEXT PRIMARY KEY,
                    type TEXT NOT NULL,
                    person_name TEXT NOT NULL,
                    phone TEXT,
                    amount NUMERIC NOT NULL,
                    currency TEXT,
                    due_date DATE,
                    notes TEXT,
                    status TEXT,
                    is_scheduled BOOLEAN,
                    schedule_type TEXT,
                    installments_count INT,
                    first_payment_date DATE
                );
            `);
        }

        let query = '';
        let params = [];

        // 5. ترجمة الـ Action القادم من الواجهة إلى استعلام SQL حقيقي
        if (action === 'ADD' || action === 'INSERT') {
            query = `
                INSERT INTO debts (
                    id, type, person_name, phone, amount, currency, due_date, 
                    notes, status, is_scheduled, schedule_type, installments_count, first_payment_date
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                RETURNING *;
            `;
            params = [
                id || d.id || `debt_${Date.now()}`, 
                d.type || 'owed_to_me', 
                d.personName || d.person_name || 'غير محدد', 
                d.phone || null, 
                parseFloat(d.amount) || 0, 
                d.currency || 'DZD', 
                d.dueDate || d.due_date || null,
                d.notes || null, 
                d.status || 'pending', 
                d.isScheduled || d.is_scheduled || false, 
                d.scheduleType || d.schedule_type || null, 
                parseInt(d.installmentsCount) || 0, 
                d.firstPaymentDate || d.first_payment_date || null
            ];

        } else if (action === 'UPDATE') {
            const targetId = id || d.id;
            if (!targetId) {
                return res.status(400).json({ success: false, error: 'المعرف id مطلوب لإجراء التعديل' });
            }

            query = `
                UPDATE debts SET 
                    type = $2, person_name = $3, phone = $4, amount = $5, currency = $6, due_date = $7, 
                    notes = $8, status = $9, is_scheduled = $10, schedule_type = $11, installments_count = $12, first_payment_date = $13
                WHERE id = $1
                RETURNING *;
            `;
            params = [
                targetId, 
                d.type, 
                d.personName || d.person_name, 
                d.phone || null, 
                parseFloat(d.amount) || 0, 
                d.currency || 'DZD', 
                d.dueDate || d.due_date || null,
                d.notes || null, 
                d.status, 
                d.isScheduled || d.is_scheduled || false, 
                d.scheduleType || d.schedule_type || null, 
                parseInt(d.installmentsCount) || 0, 
                d.firstPaymentDate || d.first_payment_date || null
            ];

        } else if (action === 'DELETE') {
            const targetId = id || d.id;
            if (!targetId) {
                return res.status(400).json({ success: false, error: 'المعرف id مطلوب لإجراء الحذف' });
            }
            query = `DELETE FROM debts WHERE id = $1 RETURNING *;`;
            params = [targetId];
        } else {
            return res.status(400).json({ success: false, error: 'العملية المطلوبة غير مدعومة' });
        }

        // 6. تنفيذ الاستعلام المترجم
        const result = await client.query(query, params);
        
        return res.status(200).json({
            success: true,
            rows: result.rows,
            rowCount: result.rowCount
        });

    } catch (error) {
        console.error(`[DATABASE ERROR ON ${action}]:`, error);
        return res.status(500).json({ success: false, error: error.message });
    } finally {
        await client.end().catch(err => console.error('Error closing client:', err));
    }
}
