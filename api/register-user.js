// api/update-user-status.js
import pg from 'pg';

export default async function handler(req, res) {
  // التحقق من نوع الطلب
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // إعداد نص الاتصال بقاعدة البيانات مع تفعيل SSL لـ Neon تماماً مثل كود التسجيل
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
    // استخراج المعطيات من واجهة المستخدم
    const { userId, active } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId هو حقل مطلوب' });
    }

    // تحويل القيمة القادمة لـ Boolean صريح متوافق مع عمود الـ BOOLEAN بالجدول
    const isTrueActive = active === true || active === 'true' || active === 1 || active === '1';

    // الاتصال بقاعدة البيانات
    await client.connect();

    // استعلام التحديث الموجه للجدول الصحيح app_users
    const updateQuery = `
      UPDATE app_users 
      SET active = $1 
      WHERE id = $2
      RETURNING id, name, email, active;
    `;
    
    const result = await client.query(updateQuery, [isTrueActive, userId]);

    // إذا لم يتم العثور على الحساب
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'المستخدم غير موجود في قاعدة البيانات' });
    }

    // إرجاع استجابة النجاح
    return res.status(200).json({
      success: true,
      message: 'تم تحديث حالة الحساب بنجاح داخل قاعدة البيانات',
      user: result.rows[0]
    });

  } catch (error) {
    console.error('Update Status API Error:', error);
    return res.status(500).json({ error: 'حدث خطأ في السيرفر أثناء تحديث الحالة' });
  } finally {
    // إغلاق الاتصال بأمان
    await client.end().catch(err => console.error('Error closing client:', err));
  }
}
