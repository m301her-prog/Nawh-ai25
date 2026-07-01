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
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // استقبال الاستعلام، البارامترات، واسم السكيمّا الخاصة بالحساب
  // نتيح إرسال اسم السكيمّا إما في الـ Headers أو بداخل الـ body لراحة الواجهة الأمامية
  const { query, params, schemaName } = req.body;
  const targetSchema = schemaName || req.headers['x-tenant-schema'];

  if (!query) {
    return res.status(400).json({ error: 'الاستعلام query مطلوب' });
  }

  // 2. إعداد الاتصال الآمن مع Neon لتجنب مشاكل الـ SSL في تطبيقات الهاتف
  const baseConnectionString = process.env.DATABASE_URL;
  const separator = baseConnectionString.includes('?') ? '&' : '?';
  const finalConnectionString = `${baseConnectionString}${separator}sslmode=verify-full`;

  const client = new pg.Client({
    connectionString: finalConnectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    // 3. السحر هنا: إذا تم إرسال اسم سكيمّا، نقوم بإنشائها والتحويل إليها فوراً
    if (targetSchema) {
      // تنظيف اسم السكيمّا لمنع الـ SQL Injection وحصرها في الحروف والأرقام فقط
      const cleanSchema = targetSchema.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
      
      // أ) إنشاء السكيمّا لو كانت جديدة تماماً للحساب الجديد
      await client.query(`CREATE SCHEMA IF NOT EXISTS ${cleanSchema}`);
      
      // ب) توجيه كل الاستعلامات التالية لتنفذ داخل هذه السكيمّا فقط
      await client.query(`SET search_path TO ${cleanSchema}`);
    }

    // 4. تنفيذ الاستعلام المرسل من الفرونت اند (والذي سيعمل الآن داخل السكيمّا المحددة)
    const result = await client.query(query, params || []);
    
    return res.status(200).json({
      success: true,
      rows: result.rows,
      rowCount: result.rowCount
    });

  } catch (error) {
    console.error('Database Proxy Error:', error);
    return res.status(500).json({ error: error.message });
  } finally {
    // إغلاق الاتصال بأمان
    await client.end().catch(err => console.error('Error closing client:', err));
  }
}
