import { neon } from '@neondatabase/serverless';

export default async function handler(request, response) {
    // إعدادات الـ CORS الكاملة لتوافق الهواتف والمتصفحات
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (request.method === 'OPTIONS') return response.status(200).end();
    
    // التأكد من أن الطلب من نوع GET
    if (request.method !== 'GET') {
        return response.status(405).json({ success: false, error: 'Method Not Allowed' });
    }

    // استخراج معرّف المستخدم ونوع البيانات المطلوب جلبها من الرابط (Query URL)
    const { userId, type } = request.query;

    if (!userId) {
        return response.status(400).json({ success: false, error: 'معرف المستخدم userId مطلوب لجلب البيانات الخاصة به' });
    }

    try {
        // استخدام المتغير الجديد DATABASE_URL الممرر من البيئة مباشرة
        const sql = neon(DATABASE_URL);
        
        // تنظيف معرف المستخدم من علامات الطرح ليتطابق مع أسماء الجداول الديناميكية (user_usr_xxx)
        const sanitizedUserId = userId.replace(/-/g, '_');
        
        let queryResult = [];

        // تحديد الجدول المستهدف بناءً على المعامل الممرر (الافتراضي هو جلب الديون debts)
        if (type === 'activities') {
            const tableName = `user_${sanitizedUserId}_activities`;
            queryResult = await sql(`
                SELECT * FROM ${tableName} 
                ORDER BY created_at DESC;
            `);
        } else {
            // جلب الديون وتعديل أسماء الأعمدة لتطابق الهيكل في واجهة التطبيق وكود الخدمة (CamelCase)
            const tableName = `user_${sanitizedUserId}_debts`;
            const rawDebts = await sql(`
                SELECT id, type, person_name, phone, amount, currency, due_date, notes, status, paid_amount, created_at, updated_at
                FROM ${tableName} 
                ORDER BY created_at DESC;
            `);

            // تحويل مسميات الأعمدة القادمة من PostgreSQL (snake_case) لتطابق مسميات الواجهة وتطبيقك (camelCase)
            queryResult = rawDebts.map(debt => ({
                id: debt.id,
                type: debt.type,
                personName: debt.person_name,
                phone: debt.phone,
                amount: parseFloat(debt.amount),
                currency: debt.currency,
                dueDate: debt.due_date,
                notes: debt.notes,
                status: debt.status,
                paidAmount: parseFloat(debt.paid_amount),
                createdAt: debt.created_at,
                updatedAt: debt.updated_at
            }));
        }

        return response.status(200).json({ 
            success: true, 
            data: queryResult 
        });

    } catch (error) {
        console.error('DATABASE ERROR:', error);
        return response.status(500).json({ 
            success: false, 
            error: 'فشل في جلب البيانات من الجدول الديناميكي: ' + error.message 
        });
    }
}
