import pg from 'pg';

export default async function handler(req, res) {
  // 1. تفعيل إعدادات CORS الكاملة للموبايل والفرونت اند
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, x-tenant-schema'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // 2. استقبال بيانات تسجيل الدخول واسم السكيمّا
  const { email, password, schemaName } = req.body;
  const targetSchema = schemaName || req.headers['x-tenant-schema'];

  if (!targetSchema) {
    return res.status(400).json({ error: 'اسم السكيمّا (x-tenant-schema) مطلوب لتحديد حساب العميل' });
  }

  if (!email || !password) {
    return res.status(400).json({ error: 'يرجى إدخال البريد الإلكتروني وكلمة المرور' });
  }

  const cleanEmail = email.toLowerCase().trim();

  // 3. إعداد الاتصال الآمن والمصحح مع Neon لتجنب مشاكل الـ SSL
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
    await client.connect();

    // 4. تنظيف اسم السكيمّا وتوجيه البحث (search_path) إليها فوراً
    const cleanSchema = targetSchema.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
    await client.query(`SET search_path TO ${cleanSchema}`);

    // 5. البحث عن المستخدم داخل جدول users في السكيمّا المحددة
    const loginQuery = 'SELECT id, name, email, password, phone, is_admin, active FROM users WHERE LOWER(email) = $1 LIMIT 1';
    const result = await client.query(loginQuery, [cleanEmail]);

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' });
    }

    const dbUser = result.rows[0];

    // التحقق من كلمة المرور
    if (dbUser.password !== password) {
      return res.status(400).json({ error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' });
    }

    // 6. إرجاع البيانات بالصيغة المتوافقة مع الفرونت اند لديك
    return res.status(200).json({
      success: true,
      message: 'تم تسجيل الدخول بنجاح',
      schema: cleanSchema,
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
    // إغلاق الاتصال بأمان
    await client.end().catch(err => console.error('Error closing client:', err));
  }
}
