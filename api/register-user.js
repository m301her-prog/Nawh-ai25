import pg from 'pg';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // 1. حل تحذير الـ SSL: دمج إعداد sslmode مباشرة في رابط الاتصال لمنع ظهور الـ Warning
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
    const { name, email, password, phone } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'يرجى ملء جميع الحقول الأساسية (الاسم، البريد، كلمة المرور)' });
    }

    const cleanEmail = email.toLowerCase().trim();

    await client.connect();

    // التحقق من التكرار داخل الجدول الصحيح app_users
    const checkUserQuery = 'SELECT id FROM app_users WHERE LOWER(email) = $1 LIMIT 1';
    const checkResult = await client.query(checkUserQuery, [cleanEmail]);

    if (checkResult.rows.length > 0) {
      return res.status(400).json({ error: 'هذا البريد الإلكتروني مسجل بالفعل' });
    }

    const userId = 'usr_' + Math.random().toString(36).substring(2, 11);
    const isAdmin = cleanEmail === 'admin@debts.dz';
    const createdAt = new Date().toISOString();

    // 2. حل خطأ العمود: تعديل "isAdmin" إلى الاسم المطابق لقاعدتك is_admin
    const insertQuery = `
      INSERT INTO app_users (id, name, email, password, phone, is_admin, active, "createdAt")
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

    return res.status(200).json({
      message: 'تم إنشاء الحساب بنجاح عبر الـ API',
      userId: userId
    });

  } catch (error) {
    console.error('Registration API Error:', error);
    return res.status(500).json({ error: 'حدث خطأ في الخادم أثناء إنشاء الحساب، يرجى المحاولة لاحقاً' });
  } finally {
    // إغلاق الاتصال دائماً بأمان
    await client.end().catch(err => console.error('Error closing client:', err));
  }
}
