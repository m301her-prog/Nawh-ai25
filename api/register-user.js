import { neon } from '@neondatabase/serverless';

// تهيئة اتصال قاعدة بيانات نيون باستخدام متغير البيئة السري
const sql = neon(process.env.DATABASE_URL);

export default async function handler(req, res) {
  // السماح بطلبات POST فقط لإنشاء الحساب
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { name, email, password, phone } = req.body;

    // 1. التحقق من وجود الحقول الأساسية المطلوبة
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'يرجى ملء جميع الحقول الأساسية (الاسم، البريد، كلمة المرور)' });
    }

    const cleanEmail = email.toLowerCase().trim();

    // 2. التحقق مما إذا كان البريد الإلكتروني مسجلاً مسبقاً في قاعدة البيانات
    const existingUsers = await sql`
      SELECT id FROM users WHERE LOWER(email) = ${cleanEmail} LIMIT 1
    `;

    if (existingUsers.length > 0) {
      return res.status(400).json({ error: 'هذا البريد الإلكتروني مسجل بالفعل' });
    }

    // 3. توليد معرف فريد للمستخدم في حال عدم إرساله من الواجهة
    const userId = 'usr_' + Math.random().toString(36).substring(2, 11);

    // 4. إدراج المستخدم الجديد في جدول الحسابات الموحد مع تفعيل الحساب تلقائياً (active = true)
    // وتحديد ما إذا كان المسؤول بناءً على البريد الإلكتروني المخصص للإدارة
    const isAdmin = cleanEmail === 'admin@debts.dz';
    const createdAt = new Date().toISOString();

    await sql`
      INSERT INTO users (id, name, email, password, phone, "isAdmin", active, "createdAt")
      VALUES (${userId}, ${name}, ${cleanEmail}, ${password}, ${phone || ''}, ${isAdmin}, true, ${createdAt})
    `;

    // 5. إرجاع استجابة النجاح بالمعرف الفريد لكي تستقبله الواجهة الأمامية بسلاسة
    return res.status(200).json({
      message: 'تم إنشاء الحساب بنجاح عبر الـ API',
      userId: userId
    });

  } catch (error) {
    console.error('Registration API Error:', error);
    return res.status(500).json({ error: 'حدث خطأ في الخادم أثناء إنشاء الحساب، يرجى المحاولة لاحقاً' });
  }
}
