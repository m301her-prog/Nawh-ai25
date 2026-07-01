import pg from 'pg';

export default async function handler(req, res) {
  // 1. إعدادات CORS الكاملة لضمان عملها مع الفرونت اند والموبايل
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

  // 2. استقبال بيانات التسجيل بالإضافة لاسم السكيمّا الخاصة بالعميل
  const { name, email, password, phone, schemaName } = req.body;
  
  // استخراج اسم السكيمّا من الـ body أو من الـ Headers (x-tenant-schema)
  const targetSchema = schemaName || req.headers['x-tenant-schema'];

  if (!targetSchema) {
    return res.status(400).json({ error: 'اسم السكيمّا (x-tenant-schema) مطلوب لتحديد مكان حفظ البيانات' });
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
    ssl: { 
      rejectUnauthorized: false 
    }
  });

  try {
    await client.connect();

    // 4. تنظيف اسم السكيمّا وتوجيه الاتصال إليها فوراً
    const cleanSchema = targetSchema.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
    
    // التأكد من وجود السكيمّا (خطوة أمان إضافية) ثم التحويل إليها
    await client.query(`CREATE SCHEMA IF NOT EXISTS ${cleanSchema}`);
    await client.query(`SET search_path TO ${cleanSchema}`);

    // 5. الآن الاستعلامات ستنفذ تلقائياً داخل جدول users الخاص بهذه السكيمّا فقط!
    const checkUserQuery = 'SELECT id FROM users WHERE LOWER(email) = $1 LIMIT 1';
    const checkResult = await client.query(checkUserQuery, [cleanEmail]);

    if (checkResult.rows.length > 0) {
      return res.status(400).json({ error: 'هذا البريد الإلكتروني مسجل بالفعل في هذا الحساب' });
    }

    const userId = 'usr_' + Math.random().toString(36).substring(2, 11);
    const isAdmin = cleanEmail === 'admin@debts.dz';
    const createdAt = new Date().toISOString();

    // يتم الحفظ مباشرة في جدول users لأن الـ search_path موجه للسكيمّا الصحيحة
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

    return res.status(200).json({
      success: true,
      message: 'تم إنشاء الحساب بنجاح داخل السكيمّا المحددة',
      userId: userId,
      schema: cleanSchema
    });

  } catch (error) {
    console.error('Registration API Error:', error);
    return res.status(500).json({ error: 'حدث خطأ في الخادم أثناء إنشاء الحساب: ' + error.message });
  } finally {
    // إغلاق الاتصال بأمان
    await client.end().catch(err => console.error('Error closing client:', err));
  }
}
