import pg from 'pg';

export default async function handler(req, res) {
  // 1. حماية الـ Endpoint بحيث يتم تشغيله حصرياً عبر الـ GitHub Action باستخدام Secret Key
  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${process.env.CRON_SECRET_KEY}`) {
    return res.status(401).json({ error: 'Unauthorized - غير مسموح بالوصول' });
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
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
    await client.connect();

    // 2. جلب جميع المستخدمين النشطين من الجدول الرئيسي لمعرفة معرفاتهم (لإنشاء أسماء السكيمات بدقة)
    const usersResult = await client.query(`
      SELECT id, name, company_name, phone 
      FROM public.app_users 
      WHERE active = TRUE
    `);

    const users = usersResult.rows;
    let totalNotificationsSent = 0;

    // 3. المرور على كل مستخدم والدخول حصرياً للـ Schema الخاصة بشركته (tenant_usr_xxxx)
    for (const user of users) {
      const targetSchema = `tenant_${user.id}`;

      try {
        // التحقق أولاً من وجود جدول debts داخل هذه السكيما تفادياً لأي أخطاء
        const tableCheck = await client.query(`
          SELECT TO_REGCLASS($1)
        `, [`${targetSchema}.debts`]);

        if (!tableCheck.rows[0].to_regclass) {
          continue; // تخطي المستخدم إذا لم يكن لديه جدول ديون بعد
        }

        // 4. استعلام لجلب الديون التي موعد استحقاقها خلال 48 ساعة القادمة والحالة pending
        const debtsQuery = `
          SELECT id, person_name, amount, currency, phone, due_date 
          FROM "${targetSchema}".debts 
          WHERE status = 'pending' 
          AND due_date IS NOT NULL 
          AND due_date >= CURRENT_DATE 
          AND due_date <= CURRENT_DATE + INTERVAL '2 days'
        `;

        const dueDebts = await client.query(debtsQuery);

        // 5. إرسال رسائل التنبيه لكل دين اقترب موعده
        for (const debt of dueDebts.rows) {
          // استخدام رقم هاتف العميل المسجل في جدول الديون، أو رقم هاتف صاحب الشركة كبديل
          const recipientPhone = debt.phone || user.phone;

          if (recipientPhone) {
            await sendWhatsAppNotification({
              phone: recipientPhone,
              customerName: debt.person_name,
              amount: debt.amount,
              currency: debt.currency || 'DZD',
              dueDate: debt.due_date,
              companyName: user.company_name
            });

            totalNotificationsSent++;
          }
        }

      } catch (schemaError) {
        console.error(`Error processing schema ${targetSchema}:`, schemaError.message);
        // استمرار العمل لباقي الشركات حتى لو حدث خطأ في سكيما تخص شركة معينّة
      }
    }

    return res.status(200).json({
      success: true,
      message: `تم فحص جميع سكيمات الشركات بنجاح، وإرسال ${totalNotificationsSent} تنبيه.`
    });

  } catch (error) {
    console.error('Cron Due Check Error:', error);
    return res.status(500).json({ error: 'حدث خطأ أثناء فحص تواريخ الاستحقاق' });
  } finally {
    await client.end().catch(err => console.error('Error closing client:', err));
  }
}

// دالة مسؤولة عن ربط الـ API الخاص بخدمة الواتساب
async function sendWhatsAppNotification({ phone, customerName, amount, currency, dueDate, companyName }) {
  const messageText = `مرحباً ${customerName}، تذكير من شركة (${companyName}) بأن موعد تسديد الدين بقيمة ${amount} ${currency} مستحق خلال 48 ساعة (بتاريخ: ${dueDate}). نرجو السداد في وقته.`;

  console.log(`[WhatsApp Sending] To: ${phone} | Message: ${messageText}`);

  /* 
    ضع هنا كود الـ fetch الفعلي الخاص بخدمة الواتساب (مثل UltraMsg, Twilio, Evolution API):
    
    await fetch('https://api.your-whatsapp-provider.com/send', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        'Authorization': `Bearer ${process.env.WA_API_KEY}` 
      },
      body: JSON.stringify({ phone, message: messageText })
    });
  */
}
