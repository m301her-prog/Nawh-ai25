import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  // تفعيل الـ CORS للسماح للهاتف بالاتصال
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // التعامل مع طلبات الـ OPTIONS (Preflight) التي يرسلها المتصفح/الهاتف تلقائياً
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { query, params } = req.body;

  try {
    // الاتصال بـ Neon باستخدام المتغير السري في السيرفر
    const sql = neon(process.env.DATABASE_URL);
    const result = await sql(query, params || []);
    
    return res.status(200).json(result);
  } catch (error) {
    console.error('Database error:', error);
    return res.status(500).json({ error: error.message });
  }
}
