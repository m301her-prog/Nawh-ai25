import pg from 'pg';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const baseConnectionString = process.env.DATABASE_URL;
  if (!baseConnectionString) {
    return res.status(500).json({ error: 'DATABASE_URL غير معرف في متغيرات البيئة' });
  }

  const separator = baseConnectionString.includes('?') ? '&' : '?';
  const finalConnectionString = `${baseConnectionString}${separator}sslmode=verify-full`;

  const client = new pg.Client({
    connectionString: finalConnectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    
    const name = body.name;
    const companyName = body.companyName || body.company_name;
    const email = body.email;
    const password = body.password;
    const phone = body.phone;

    if (!name || !companyName || !email || !password) {
      return res.status(400).json({ 
        error: 'يرجى ملء جميع الحقول الأساسية (الاسم، اسم الشركة، البريد، كلمة المرور)' 
      });
    }

    const cleanEmail = email.toLowerCase().trim();

    await client.connect();

    // بداية المعاملة (Transaction) لضمان تنفيذ كل الخطوات
    await client.query('BEGIN');

    // 1. إنشاء جدول الحسابات الرئيسي إن لم يكن موجوداً
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.app_users (
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
    `);

    // 2. التحقق من تكرار البريد
    const checkResult = await client.query(
      'SELECT id FROM public.app_users WHERE LOWER(email) = $1 LIMIT 1', 
      [cleanEmail]
    );
    if (checkResult.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'هذا البريد الإلكتروني مسجل بالفعل' });
    }

    const userId = 'usr_' + Math.random().toString(36).substring(2, 11);

    // =========================================================
    // التعديل الرئيسي: تحديد صلاحية الأدمن وفقاً للبيانات الخاصة بك
    // =========================================================
    const isAdmin = cleanEmail === 'nawh@nawh.com' || name.trim() === 'admin301';

    // إذا كان الحساب الأدمن ولم يتم إرسال رقم هاتف من الواجهة، يتم اعتماد رقم الواتساب الافتراضي بمفتاح مصر
    const finalPhone = phone || (isAdmin ? '201091288031' : '');

    const createdAt = new Date().toISOString();

    // 3. إنشاء اسم Schema فريد للشركة
    const schemaName = `tenant_${userId}`;

    // 4. إنشاء الـ Schema الخاصة بالشركة
    await client.query(`CREATE SCHEMA IF NOT EXISTS ${schemaName}`);

    // 5. إدراج الحساب الجديد في الجدول الرئيسي
    const insertQuery = `
      INSERT INTO public.app_users (id, name, company_name, email, password, phone, is_admin, active, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `;
    
    await client.query(insertQuery, [
      userId, 
      name, 
      companyName, 
      cleanEmail, 
      password, 
      finalPhone, 
      isAdmin, 
      true, 
      createdAt
    ]);

    // تأكيد وتنفيذ العمليات
    await client.query('COMMIT');

    return res.status(200).json({
      message: 'تم إنشاء الحساب والـ Schema الخاصة به بنجاح',
      userId: userId,
      schemaName: schemaName,
      isAdmin: isAdmin
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Registration API Error:', error);
    return res.status(500).json({ error: 'حدث خطأ أثناء إنشاء الحساب والـ Schema' });
  } finally {
    await client.end().catch(err => console.error('Error closing client:', err));
  }
}
