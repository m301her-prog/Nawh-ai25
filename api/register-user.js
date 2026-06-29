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

  // التحقق من وجود البيانات الأساسية المطلوبة للتسجيل (جعلنا id اختياري لتفادي أخطاء الفرونت إند)
  if (!name || !email || !password) {
    return res.status(400).json({ 
      success: false, 
      error: 'البيانات الأساسية (الاسم، البريد الإلكتروني، كلمة المرور) مطلوبة بالكامل.' 
    });
  }

  try {
    // 3. الاتصال بقاعدة بيانات Neon عن طريق الرابط الممرر مباشرة
    const sql = neon(DATABASE_URL);

    // توليد معرف فريد تلقائي في حال لم يرسله الفرونت إند
    const finalId = id || `usr_${Math.random().toString(36).substr(2, 9)}`;

    // 4. تنفيذ استعلام الـ INSERT لإدخال وحفظ بيانات العميل في جدول app_users
    await sql(`
      INSERT INTO app_users (id, name, email, password, phone, is_admin, active, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
    `, [
      finalId,                     // معرف المستخدم الفريد
      name,                        // اسم المستخدم
      email.toLowerCase().trim(),  // البريد الإلكتروني
      password,                    // كلمة المرور
      phone || '',                 // رقم الهاتف (اختياري)
      isAdmin || false,            // هل هو مسؤول (اختياري)
      true                         // الحساب نشط تلقائياً
    ]);

    // إرجاع استجابة بنجاح العملية
    return res.status(200).json({ 
      success: true, 
      message: 'تم حفظ بيانات تسجيل دخول العميل بنجاح في قاعدة البيانات.',
      userId: finalId
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
