import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
    // إعدادات الـ CORS الكاملة والمتوافقة مع اتصالات الهواتف
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    try {
        const sql = neon(process.env.DATABASE_URL);
        const { action, userId, data } = req.body; 

        // التحقق من وجود معرف المستخدم للعمليات الديناميكية، عدا العمليات العامة إن وُجدت
        if (!userId && action !== 'add_user') {
            return res.status(400).json({ success: false, error: 'معرف المستخدم userId مطلوب لإكمال العملية' });
        }

        // تنظيف معرف المستخدم من علامات الطرح ليتوافق مع أسماء الجداول في كود الخدمة (user_usr_xxx)
        const sanitizedUserId = userId ? userId.replace(/-/g, '_') : '';

        switch (action) {
            // 1. إضافة دين جديد للمستخدم الحالي في جدوله الديناميكي المخصص للديون
            case 'add_debt': {
                const tableName = `user_${sanitizedUserId}_debts`;
                
                // استخدام الـ Tagged Template Literals الخاصة بـ Neon مع صياغة اسم الجدول بحذر
                await sql(`
                    INSERT INTO ${tableName} (id, type, person_name, phone, amount, currency, due_date, notes, status, paid_amount) 
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                `, [
                    data.id, data.type, data.personName, data.phone || '', 
                    data.amount, data.currency || 'DZD', data.dueDate, 
                    data.notes || '', data.status || 'pending', data.paidAmount || 0
                ]);
                
                return res.status(200).json({ success: true });
            }

            // 2. تعديل بيانات أو حالة دين معين (مثال: تغيير الحالة إلى مدفوع أو تعديل مبلغ مسدد)
            case 'update_debt': {
                const tableName = `user_${sanitizedUserId}_debts`;
                
                await sql(`
                    UPDATE ${tableName} 
                    SET type = $1, person_name = $2, phone = $3, amount = $4, currency = $5, 
                        due_date = $6, notes = $7, status = $8, paid_amount = $9, updated_at = CURRENT_TIMESTAMP
                    WHERE id = $10
                `, [
                    data.type, data.personName, data.phone || '', data.amount, data.currency || 'DZD',
                    data.dueDate, data.notes || '', data.status, data.paidAmount, data.id
                ]);

                return res.status(200).json({ success: true });
            }

            // 3. حذف دين معين نهائياً من سجلات هذا العميل
            case 'delete_debt': {
                const tableName = `user_${sanitizedUserId}_debts`;
                
                await sql(`
                    DELETE FROM ${tableName} WHERE id = $1
                `, [data.id]);

                return res.status(200).json({ success: true });
            }

            // 4. تسجيل نشاط جديد للعميل في جدول الأنشطة التابع له
            case 'log_activity': {
                const tableName = `user_${sanitizedUserId}_activities`;
                const detailsString = typeof data.details === 'object' ? JSON.stringify(data.details) : data.details;

                await sql(`
                    INSERT INTO ${tableName} (id, action, details) 
                    VALUES ($1, $2, $3)
                `, [data.id, data.action, detailsString]);

                return res.status(200).json({ success: true });
            }

            // 5. إضافة مستخدم جديد إلى جدول المستخدمين العام (app_users) إن لزم الأمر من الواجهة مباشرة
            case 'add_user': {
                await sql(`
                    INSERT INTO app_users (id, name, email, password, phone, is_admin, active, created_at)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                `, [
                    data.id, data.name, data.email, data.password, 
                    data.phone || '', data.isAdmin || false, data.active !== false, data.createdAt || new Date().toISOString()
                ]);

                return res.status(200).json({ success: true });
            }

            default:
                return res.status(400).json({ success: false, error: 'الحدث المرسل (Action) غير مدعوم في الخدمة الحالية' });
        }
    } catch (error) {
        console.error('Database Operation Error:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
}
