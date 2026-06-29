import pg from 'pg';
const { Pool } = pg;

// إنشاء اتصال الـ Pool خارج الدالة لإعادة استخدامه وتسريع الطلبات (Connection Pooling)
let pool;

if (!pool && process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false // مطلوب لتأمين الاتصال بقواعد البيانات السحابية مثل Neon
    }
  });
}

export default async function handler(req, res) {
  // 1. إعدادات الـ CORS لتأمين اتصال التطبيقات والـ Mobile بالـ API
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // التعامل مع طلبات التحقق المسبق (Preflight OPTIONS)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // التأكد من أن الطلب القادم هو POST فقط
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  // 2. استقبال البيانات المرسلة من واجهة التطبيق
  const { id, name, email, password, phone, isAdmin } = req.body;

  // التحقق من وجود البيانات الأساسية المطلوبة للتسجيل
  if (!name || !email || !password) {
    return res.status(400).json({ 
      success: false, 
      error: 'البيانات الأساسية (الاسم، البريد الإلكتروني، كلمة المرور) مطلوبة بالكامل.' 
    });
  }

  // التأكد من تهيئة الـ pool بنجاح ووجود الرابط
  if (!pool) {
    return res.status(500).json({
      success: false,
      error: 'خطأ في السيرفر: لم يتم تعريف المتغير DATABASE_URL في إعدادات Vercel.'
    });
  }

  try {
    // توليد معرف فريد تلقائي في حال لم يرسله الفرونت إند
    const finalId = id || `usr_${Math.random().toString(36).substr(2, 9)}`;

    // 3. تنفيذ استعلام الـ INSERT وحفظ البيانات في جدول app_users باستخدام مكتبة pg
    const queryText = `
      INSERT INTO app_users (id, name, email, password, phone, is_admin, active, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
    `;
    
    const queryValues = [
      finalId,
      name,
      email.toLowerCase().trim(),
      password,
      phone || '',
      isAdmin || false,
      true
    ];

    await pool.query(queryText, queryValues);

    // إرجاع استجابة بنجاح العملية
    return res.status(200).json({ 
      success: true, 
      message: 'تم حفظ بيانات تسجيل دخول العميل بنجاح في قاعدة البيانات.',
      userId: finalId
    });

  } catch (error) {
    console.error('Registration Database Error:', error);
    
    // معالجة خطأ تكرار البريد الإلكتروني (Unique Constraint) بشكل مخصص (رمز الخطأ 23505 في PostgreSQL)
    if (error.code === '23505' || (error.message && error.message.includes('unique constraint'))) {
      return res.status(400).json({ 
        success: false, 
        error: 'البريد الإلكتروني مستخدم بالفعل ومسجل مسبقاً.' 
      });
    }

    return res.status(500).json({ 
      success: false, 
      error: 'حدث خطأ في الخادم أثناء حفظ البيانات: ' + error.message 
    });
  }
}
