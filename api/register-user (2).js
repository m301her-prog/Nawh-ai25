import pg from 'pg';

export default async function handler(req, res) {
  // التحقق من نوع الطلب
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // إعداد نص الاتصال بقاعدة البيانات مع تفعيل SSL لـ Neon
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
    // استخراج المدخلات من واجهة المستخدم (بما فيها اسم الشركة)
    const { name, companyName, email, password, phone } = req.body;

    // التحقق من وجود الحقول الأساسية المطلوبة بالتسجيل
    if (!name || !companyName || !email || !password) {
      return res.status(400).json({ 
        error: 'يرجى ملء جميع الحقول الأساسية (الاسم، اسم الشركة، البريد، كلمة المرور)' 
      });
    }

    const cleanEmail = email.toLowerCase().trim();

    // الاتصال بقاعدة البيانات
    await client.connect();

    // 1. التأكد التلقائي من تواجد الجدول وهيكليته الصحيحة داخل قاعدة البيانات
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS app_users (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        company_name VARCHAR(150) NOT NULL,
        email VARCHAR(150) UNIQUE NOT NULL,
        password VARCHAR(100) NOT NULL,
        phone VARCHAR(50),
        is_admin BOOLEAN DEFAULT FALSE,
        active BOOLEAN DEFAULT TRUE,
        created_at VARCHAR(50) NOT NULL
      );
    `;
    await client.query(createTableQuery);

    // 2. التحقق مما إذا كان البريد الإلكتروني مسجلاً مسبقاً
    const checkUserQuery = 'select id from app_users where lower(email) = $1 limit 1';
    const checkResult = await client.query(checkUserQuery, [cleanEmail]);

    if (checkResult.rows.length > 0) {
      return res.status(400).json({ error: 'هذا البريد الإلكتروني مسجل بالفعل' });
    }

    // 3. تجهيز بيانات الحساب الجديد
    const userId = 'usr_' + Math.random().toString(36).substring(2, 11);
    const isAdmin = cleanEmail === 'admin@debts.dz';
    const createdAt = new Date().toISOString();

    // 4. استعلام إدخال الحساب الجديد شاملاً عمود اسم الشركة (company_name)
    const insertQuery = `
      insert into app_users (id, name, company_name, email, password, phone, is_admin, active, created_at)
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `;
    
    await client.query(insertQuery, [
      userId, 
      name, 
      companyName, // القيمة الجديدة القادمة من الواجهة
      cleanEmail, 
      password, 
      phone || '', 
      isAdmin, 
      true, 
      createdAt
    ]);

    // إرجاع استجابة النجاح
    return res.status(200).json({
      message: 'تم إنشاء الحساب بنجاح عبر الـ API',
      userId: userId
    });

  } catch (error) {
    console.error('Registration API Error:', error);
    return res.status(500).json({ error: 'حدث خطأ في الخادم أثناء إنشاء الحساب، يرجى المحاولة لاحقاً' });
  } finally {
    // إغلاق الاتصال بأمان
    await client.end().catch(err => console.error('Error closing client:', err));
  }
}
