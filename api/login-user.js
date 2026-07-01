import { neon } from '@neondatabase/serverless';

// تهيئة اتصال قاعدة بيانات نيون باستخدام متغير البيئة السري
const sql = neon(process.env.DATABASE_URL);

// هذا هو التصدير (export default) الذي تبحث عنه منصة Vercel ويسبب توقف السيرفر لديك
export default async function handler(req, res) {
  // منع أي طلبات غير بوست لحماية الرابط
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'يرجى إدخال البريد الإلكتروني وكلمة المرور' });
    }

    const cleanEmail = email.toLowerCase().trim();

    // جلب بيانات المستخدم للتأكد من صحتها
    const users = await sql`
      SELECT id, name, email, password, phone, "isAdmin", active 
      FROM users 
      WHERE LOWER(email) = ${cleanEmail} 
      LIMIT 1
    `;

    if (users.length === 0) {
      return res.status(400).json({ error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' });
    }

    const dbUser = users[0];

    // مطابقة كلمة المرور المرسلة مع المحفوظة في نيون
    if (dbUser.password !== password) {
      return res.status(400).json({ error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' });
    }

    // إرجاع النتيجة للواجهة بشكل متوافق 100% مع دالة login المكتوبة عندك
    return res.status(200).json({
      message: 'تم تسجيل الدخول بنجاح',
      user: {
        id: dbUser.id,
        name: dbUser.name,
        email: dbUser.email,
        phone: dbUser.phone || '',
        isAdmin: dbUser.isAdmin === true || dbUser.isAdmin === 'true',
        active: dbUser.active === true || dbUser.active === 'true'
      }
    });

  } catch (error) {
    console.error('Login API Error:', error);
    return res.status(500).json({ error: 'حدث خطأ داخلي في الخادم، يرجى المحاولة لاحقاً' });
  }
}
