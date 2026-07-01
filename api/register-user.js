import pg from 'pg';

export default async function handler(req, res) {
  // 1. تفعيل إعدادات CORS الكاملة
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

  // 2. استقبال بيانات العميل واسم السكيمّا المطلوبة له
  const { name, email, password, phone, schemaName } = req.body;
  const targetSchema = schemaName || req.headers['x-tenant-schema'];

  if (!targetSchema) {
    return res.status(400).json({ error: 'اسم السكيمّا (x-tenant-schema) مطلوب لإنشاء البيئة المخصصة للعميل' });
  }

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'يرجى ملء جميع الحقول الأساسية (الاسم، البريد، كلمة المرور)' });
  }

  const cleanEmail = email.toLowerCase().trim();

  // 3. إعداد الاتصال الآمن مع Neon
  const baseConnectionString = process.env.DATABASE_URL;
  const separator = baseConnectionString.includes('?') ? '&' : '?';
  const finalConnectionString = `${baseConnectionString}${separator}sslmode=verify-full`;

  const client = new pg.Client({
    connectionString: finalConnectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    // 4. تنظيف اسم السكيمّا لمنع الـ SQL Injection
    const cleanSchema = targetSchema.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
    
    // أ) إنشاء السكيمّا المخصصة للعميل إذا لم تكن موجودة
    await client.query(`CREATE SCHEMA IF NOT EXISTS ${cleanSchema}`);
    
    // ب) تحويل مسار العمل الحالي إلى هذه السكيمّا
    await client.query(`SET search_path TO ${cleanSchema}`);

    // ج) السحر هنا: إنشاء الجداول تلقائياً داخل السكيمّا الجديدة إذا لم تكن موجودة
    // جدول المستخدمين (users)
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(150) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        phone VARCHAR(20),
        is_admin BOOLEAN DEFAULT FALSE,
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // جدول الديون (debts) الموضح في الصورة الخاصة بك (يمكنك تعديل أعمدته حسب رغبتك لاحقاً)
    await client.query(`
      CREATE TABLE IF NOT EXISTS debts (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(50) REFERENCES users(id) ON DELETE CASCADE,
        amount NUMERIC(10, 2) NOT NULL,
        description TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 5. التحقق من تكرار البريد الإلكتروني داخل السكيمّا الجديدة (خطوة وقائية)
    const checkUserQuery = 'SELECT id FROM users WHERE LOWER(email) = $1 LIMIT 1';
    const checkResult = await client.query(checkUserQuery, [cleanEmail]);

    if (checkResult.rows.length > 0) {
      return res.status(400).json({ error: 'هذا البريد الإلكتروني مسجل بالفعل في هذا الحساب' });
    }

    // 6. تجهيز بيانات المستخدم الأول (الذي غالباً ما يكون الأدمن للسكيمّا)
    const userId = 'usr_' + Math.random().toString(36).substring(2, 11);
    const isAdmin = cleanEmail === 'admin@debts.dz' || true; // جعلته True افتراضياً لأنه منشئ السكيمّا الأول
    const createdAt = new Date().toISOString();

    // 7. إدخال البيانات في جدول users الذي تم إنشاؤه للتأو
    const insertQuery = `
      INSERT INTO users (id, name, email, password, phone, is_admin, active, created_at)
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

    // نجاح العملية بالكامل
    return res.status(200).json({
      success: true,
      message: 'تم إنشاء السكيمّا وبناء الجداول وحفظ حساب العميل بنجاح',
      userId: userId,
      schema: cleanSchema
    });

  } catch (error) {
    console.error('Registration & Schema Creation Error:', error);
    return res.status(500).json({ error: 'حدث خطأ أثناء تهيئة حساب العميل: ' + error.message });
  } finally {
    // إغلاق الاتصال بأمان
    await client.end().catch(err => console.error('Error closing client:', err));
  }
}
