import pg from 'pg';

export default async function handler(req, res) {
    // 1. إعدادات CORS الكاملة لمنع حظر الطلبات من التطبيق أو المتصفح
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    // 2. إعداد الاتصال بمكتبة pg وحل مشكلة تحذير الـ SSL
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
        // تفكيك البيانات حسب ما يرسله الـ Context تماماً
        const { userId, action, debt, debtId, updates } = req.body;

        if (!userId) {
            return res.status(400).json({ success: false, error: 'معرف المستخدم userId مطلوب' });
        }

        await client.connect();

        // اسم جدول الديون الافتراضي بأحرف صغيرة: app_debts
        switch (action) {
            case 'ADD':
                const insertQuery = `
                    INSERT INTO app_debts (id, user_id, title, amount, type, person_name, person_phone, due_date, status, notes, created_at)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                `;
                await client.query(insertQuery, [
                    debt.id,
                    userId,
                    debt.title,
                    debt.amount,
                    debt.type, // 'owed_to_me' أو 'i_owe'
                    debt.personName,
                    debt.personPhone || '',
                    debt.dueDate || null,
                    debt.status || 'pending',
                    debt.notes || '',
                    debt.createdAt || new Date().toISOString()
                ]);
                return res.status(200).json({ success: true, message: 'تم حفظ الدين بنجاح بسيرفر نيون' });

            case 'UPDATE':
                if (!debtId || !updates) {
                    return res.status(400).json({ success: false, error: 'بيانات التحديث debtId أو updates ناقصة' });
                }
                
                // تحويل قيم الحالة للتوافق مع قاعدة البيانات
                const queryStatus = updates.status; 
                
                const updateQuery = `
                    UPDATE app_debts 
                    SET status = $1
                    WHERE id = $2 AND user_id = $3
                `;
                await client.query(updateQuery, [queryStatus, debtId, userId]);
                return res.status(200).json({ success: true, message: 'تم تحديث حالة الدين بنجاح' });

            case 'DELETE':
                if (!debtId) {
                    return res.status(400).json({ success: false, error: 'معرف الدين debtId مطلوب للحذف' });
                }
                const deleteQuery = 'DELETE FROM app_debts WHERE id = $1 AND user_id = $2';
                await client.query(deleteQuery, [debtId, userId]);
                return res.status(200).json({ success: true, message: 'تم حذف الدين من السيرفر بنجاح' });

            default:
                return res.status(400).json({ success: false, error: `العملية (${action}) غير مدعومة لمنصة الديون` });
        }

    } catch (error) {
        console.error('DATABASE ERROR ON SAVE:', error);
        return res.status(500).json({ success: false, error: 'فشل حفظ البيانات: ' + error.message });
    } finally {
        // إغلاق الاتصال بأمان دائماً
        await client.end().catch(err => console.error('Error closing client:', err));
    }
}
