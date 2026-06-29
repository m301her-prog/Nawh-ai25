import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  // 1. إعدادات الـ CORS لتأمين اتصال الهواتف الذكية والتطبيقات بالـ API
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
  if (!id || !name || !email || !password) {
    return res.status(400).json({ 
      success: false, 
      error: 'البيانات الأساسية (المعرف، الاسم، البريد الإلكتروني، كلمة المرور) مطلوبة بالكامل.' 
    });
  }

  try {
    // 3. الاتصال بقاعدة بيانات Neon عن طريق الرابط السري المخزن في سيرفر Vercel
    const sql = neon(process.env.DATABASE_URL);

    // 4. تنفيذ استعلام الـ INSERT لإدخال وحفظ بيانات العميل في جدول app_users
    await sql(`
      INSERT INTO app_users (id, name, email, password, phone, is_admin, active, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
    `, [
      id,                          // معرف المستخدم الفريد (usr_xxx)
      name,                        // اسم المستخدم
      email.toLowerCase().trim(),  // البريد الإلكتروني (تنظيفه وتحويله لأحرف صغيرة)
      password,                    // كلمة المرور (المشفرة القادمة من الفرونت إند)
      phone || '',                 // رقم الهاتف (اختياري)
      isAdmin || false,            // هل هو مسؤول (اختياري - الافتراضي false)
      true                         // الحساب نشط تلقائياً عند الإنشاء
    ]);

    // إرجاع استجابة بنجاح العملية
    return res.status(200).json({ 
      success: true, 
      message: 'تم حفظ بيانات تسجيل دخول العميل بنجاح في قاعدة البيانات.' 
    });

  } catch (error) {
    console.error('Registration Database Error:', error);
    
    // معالجة خطأ تكرار البريد الإلكتروني (Unique Constraint) بشكل مخصص
    if (error.message && error.message.includes('unique constraint')) {
      return res.status(400).json({ 
        success: false, 
        error: 'البريد الإلكتروني مستخدم بالفعل مسجلاً مسبقاً.' 
      });
    }

    return res.status(500).json({ 
      success: false, 
      error: 'حدث خطأ في الخادم أثناء حفظ البيانات: ' + error.message 
    });
  }
}
