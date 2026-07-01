import pg from 'pg';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // إنشاء اتصال منفصل ومؤقت يناسب بيئة الـ Serverless
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } // تفعيل الـ SSL المطلوب من نيون بأمان
  });

  try {
    const { name, email, password, phone } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'يرجى ملء جميع الحقول الأساسية (الاسم، البريد، كلمة المرور)' });
    }

    const cleanEmail = email.toLowerCase().trim();

    // فتح الاتصال بقاعدة البيانات
    await client.connect();

    // 1. التحقق من عدم تكرار الحساب باستخدام Parameterized Query لـ pg
    const checkUserQuery = 'SELECT id FROM users WHERE LOWER(email) = $1 LIMIT 1';
    const checkResult = await client.query(checkUserQuery, [cleanEmail]);

    if (checkResult.rows.length > 0) {
      return res.status(400).json({ error: 'هذا البريد الإلكتروني مسجل بالفعل' });
    }

    // 2. توليد معرف فريد وإعداد البيانات الأساسية
    const userId = 'usr_' + Math.random().toString(36).substring(2, 11);
    const isAdmin = cleanEmail === 'admin@debts.dz';
    const createdAt = new Date().toISOString();

    // 3. إدخال بيانات المستخدم في جدول users
    const insertQuery = `
      INSERT INTO users (id, name, email, password, phone, "isAdmin", active, "createdAt")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `;
    
    await client.query(insertQuery, [
      userId, 
      name, 
      cleanEmail, 
      password, 
      phone || '', 
      isAdmin, 
      true, 
      createdAt
    ]);

    // 4. إرجاع النتيجة للواجهة الأمامية بنجاح
    return res.status(200).json({
      message: 'تم إنشاء الحساب بنجاح عبر الـ API',
      userId: userId
    });

  } catch (error) {
    console.error('Registration API Error:', error);
    return res.status(500).json({ error: 'حدث خطأ في الخادم أثناء إنشاء الحساب، يرجى المحاولة لاحقاً' });
  } finally {
    // إغلاق الاتصال دائماً لعدم استهلاك مسبح الاتصالات (Connection Pool) في نيون
    await client.end().catch(err => console.error('Error closing client:', err));
  }
}
