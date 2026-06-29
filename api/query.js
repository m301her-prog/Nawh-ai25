import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  // تفعيل الـ CORS للسماح للهاتف والمنصات بالاتصال
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  // التعامل مع طلبات الـ OPTIONS (Preflight)
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { query, params } = req.body;

  if (!query) {
    return res.status(400).json({ error: 'Missing SQL query' });
  }

  try {
    // الاتصال بـ Neon باستخدام المتغير السري المتوفر في سيرفر Vercel
    const sql = neon(process.env.DATABASE_URL);
    
    let result;
    
    // التحقق مما إذا كانت هناك بارامترات مرافقة للاستعلام (مثل بيانات إنشاء الحساب)
    if (params && params.length > 0) {
      // تفكيك ونشر المصفوفة كقيم منفصلة لتقبلها مكتبة Neon Serverless وتطابق رموز $1, $2
      result = await sql(query, ...params);
    } else {
      // تنفيذ الاستعلامات المباشرة مثل CREATE TABLE التي لا تحتوي على بارامترات
      result = await sql(query);
    }
    
    return res.status(200).json(result);
  } catch (error) {
    console.error('Database query implementation error:', error);
    return res.status(500).json({ error: error.message });
  }
}
