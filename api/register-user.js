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
    // الاتصال بقاعدة البيانات
    await client.connect();

    // 🛡️ [تحصين قراءة المدخلات]: التأكد من تحويل النص إلى كائن JSON في حال لم يقم الفريمورك بتحويله تلقائياً
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        console.error('Failed to parse body string:', e);
      }
    }

    // التحقق من أن الـ body موجود وليس فارغاً
    if (!body) {
      return res.status(400).json({ error: 'طلب فارغ، لم يتم إرسال أي بيانات' });
    }

    // ----------------------------------------------------------------------
    // [قسم تحديث الحالة]: إذا كان الطلب يحتوي على userId، يتم معالجته هنا فوراً وينتهي الطلب
    // ----------------------------------------------------------------------
    if (body.userId !== undefined && body.active !== undefined) {
      const { userId, active } = body;
      
      // تحويل القيمة القادمة لـ Boolean صريح متوافق مع عمود الـ BOOLEAN بالجدول
      const isTrueActive = active === true || active === 'true' || active === 1 || active === '1';

      const updateQuery = `
        UPDATE app_users 
        SET active = $1 
        WHERE id = $2
        RETURNING id, name, email, active;
      `;
      
      const result = await client.query(updateQuery, [isTrueActive, userId]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'المستخدم غير موجود في قاعدة البيانات' });
      }

      return res.status(200).json({
        success: true,
        message: 'تم تحديث حالة الحساب بنجاح داخل قاعدة البيانات',
        user: result.rows[0]
      });
    }
    // ----------------------------------------------------------------------

    // [قسم إنشاء الحساب]: الكود الخاص بك كما هو مع تكييفه مع كائن body المحصن
    const { name, companyName, email, password, phone } = body;

    // 👈 تم نقل التحقق إلى هنا ليعمل فقط في حالة طلب إنشاء الحساب وليس تحديث الحالة
    if (!name || !companyName || !email || !password) {
      return res.status(400).json({ 
        error: 'يرجى ملء جميع الحقول الأساسية (الاسم، اسم الشركة، البريد، كلمة المرور)' 
      });
    }

    const cleanEmail = email.toLowerCase().trim();

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
    const newUserId = 'usr_' + Math.random().toString(36).substring(2, 11);
    const isAdmin = cleanEmail === 'admin@debts.dz';
    const createdAt = new Date().toISOString();

    // 4. استعلام إدخال الحساب الجديد شاملاً عمود اسم الشركة (company_name)
    const insertQuery = `
      insert into app_users (id, name, company_name, email, password, phone, is_admin, active, created_at)
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `;
    
    await client.query(insertQuery, [
      newUserId, 
      name, 
      companyName, 
      cleanEmail, 
      password, 
      phone || '', 
      isAdmin, 
      true, 
      createdAt
    ]);

    return res.status(200).json({
      message: 'تم إنشاء الحساب بنجاح عبر الـ API',
      userId: newUserId
    });

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'حدث خطأ في الخادم، يرجى المحاولة لاحقاً' });
  } finally {
    // إغلاق الاتصال بأمان
    await client.end().catch(err => console.error('Error closing client:', err));
  }
}
