import pg from 'pg';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { 
      rejectUnauthorized: false,
      sslmode: 'verify-full' 
    }
  });

  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'يرجى إدخال البريد الإلكتروني وكلمة المرور' });
    }

    const cleanEmail = email.toLowerCase().trim();

    await client.connect();

    // جلب العمود باسمه الصحيح من نيون "is_admin"
    const loginQuery = 'SELECT id, name, email, password, phone, is_admin, active FROM app_users WHERE LOWER(email) = $1 LIMIT 1';
    const result = await client.query(loginQuery, [cleanEmail]);

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' });
    }

    const dbUser = result.rows[0];

    if (dbUser.password !== password) {
      return res.status(400).json({ error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' });
    }

    // إرجاع الخصائص بالأسماء التي يتوقعها كود الـ Frontend لديك (تصفية الحساب وتحويلها لـ isAdmin)
    return res.status(200).json({
      message: 'تم تسجيل الدخول بنجاح',
      user: {
        id: dbUser.id,
        name: dbUser.name,
        email: dbUser.email,
        phone: dbUser.phone || '',
        isAdmin: dbUser.is_admin === true || dbUser.is_admin === 'true',
        active: dbUser.active === true || dbUser.active === 'true'
      }
    });

  } catch (error) {
    console.error('Login API Error:', error);
    return res.status(500).json({ error: 'حدث خطأ داخلي في الخادم، يرجى المحاولة لاحقاً' });
  } finally {
    await client.end().catch(err => console.error('Error closing client:', err));
  }
}
