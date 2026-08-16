import pg from 'pg';

// استخدام Pool بدلاً من Client لإعادة استخدام الاتصالات
const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: true } // يفضل تفعيل التحقق الأمني الكامل مع Neon
});

export default async function handler(req, res) {
    // 1. إعدادات CORS
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, x-tenant-schema'
    );

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    // 2. استقبال البيانات
    const { action, id, debtId, debtData, debt, updates, companyName, company_name } = req.body;
    let targetSchema = req.headers['x-tenant-schema'];

    const d = debtData || debt || updates || req.body.data || req.body || {}; 
    const finalId = id || debtId || d.id;
    const finalCompanyName = companyName || company_name || d.companyName || d.company_name;

    // 3. تحديد وتطهير السكيمّا
    if (!targetSchema || !targetSchema.trim()) {
        if (finalCompanyName) {
            targetSchema = `schema_${finalCompanyName.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase()}`;
        } else {
            return res.status(400).json({ 
                success: false, 
                error: 'اسم الشركة مطلوب لتحديد السكيمّا المستهدفة.' 
            });
        }
    }

    const cleanSchema = targetSchema.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
    
    // سحب عميل من الـ Pool
    const client = await pool.connect();

    try {
        // 4. ضبط السكيمّا وإنشاء الجدول
        await client.query(`CREATE SCHEMA IF NOT EXISTS "${cleanSchema}"`);
        await client.query(`SET search_path TO "${cleanSchema}"`);
        
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

        let query = '';
        let params = [];

        if (action === 'ADD' || action === 'INSERT' || action === 'UPDATE') {
            const activeId = finalId || `debt_${Date.now()}`;
            const type = d.type || 'owed_to_me';
            const personName = d.personName || d.person_name || 'غير محدد';
            const phone = d.phone || d.personPhone || d.person_phone || null;
            const amount = parseFloat(d.amount) || 0;
            const currency = d.currency || 'DZD';
            const notes = d.notes || null;
            const status = d.status || 'pending';
            const isScheduled = d.isScheduled !== undefined ? Boolean(d.isScheduled) : Boolean(d.is_scheduled);
            const scheduleType = d.scheduleType || d.schedule_type || null;
            const installmentsCount = parseInt(d.installmentsCount || d.installments_count, 10) || 0;

            const cleanDate = (dateVal) => {
                if (!dateVal) return null;
                const d = new Date(dateVal);
                return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
            };

            const dueDate = cleanDate(d.dueDate || d.due_date);
            const firstPaymentDate = cleanDate(d.firstPaymentDate || d.first_payment_date);

            if (action === 'ADD' || action === 'INSERT') {
                query = `
                    INSERT INTO debts (
                        id, type, person_name, phone, amount, currency, due_date, 
                        notes, status, is_scheduled, schedule_type, installments_count, first_payment_date
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                    RETURNING *;
                `;
            } else {
                query = `
                    UPDATE debts SET 
                        type = $2, person_name = $3, phone = $4, amount = $5, currency = $6, due_date = $7, 
                        notes = $8, status = $9, is_scheduled = $10, schedule_type = $11, installments_count = $12, first_payment_date = $13
                    WHERE id = $1
                    RETURNING *;
                `;
            }
            params = [activeId, type, personName, phone, amount, currency, dueDate, notes, status, isScheduled, scheduleType, installmentsCount, firstPaymentDate];

        } else if (action === 'DELETE') {
            if (!finalId) return res.status(400).json({ success: false, error: 'المعرف id مطلوب' });
            query = `DELETE FROM debts WHERE id = $1 RETURNING *;`;
            params = [finalId];
        } else {
            return res.status(400).json({ success: false, error: 'العملية غير مدعومة' });
        }

        const result = await client.query(query, params);
        return res.status(200).json({ success: true, rows: result.rows, rowCount: result.rowCount });

    } catch (error) {
        console.error(`[DATABASE ERROR ON ${action}]:`, error);
        return res.status(500).json({ success: false, error: error.message });
    } finally {
        // إعادة العميل للـ Pool بدلاً من إغلاقه
        client.release();
    }
}
