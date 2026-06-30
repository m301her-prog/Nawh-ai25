import pg from 'pg';
const { Pool } = pg;

let pool;

if (!pool && process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });
}

export default async function handler(req, res) {
  // إعدادات الـ CORS الكاملة
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'البريد الإلكتروني وكلمة المرور مطلوبان.' });
  }

  if (!pool) {
    return res.status(500).json({ success: false, error: 'لم يتم تعريف المتغير DATABASE_URL.' });
  }

  try {
    const cleanEmail = email.toLowerCase().trim();
    const cleanPassword = password.toString();

    // استعلام جلب الحساب القديم ومطابقته
    const queryText = `
      SELECT id, name, email, phone, is_admin, active 
      FROM app_users 
      WHERE LOWER(email) = $1 AND password = $2 
      LIMIT 1
    `;
    
    const result = await pool.query(queryText, [cleanEmail, cleanPassword]);

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, error: 'المعلومات خاطئة أو الحساب غير موجود.' });
    }

    const user = result.rows[0];

    return res.status(200).json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone || '',
        isAdmin: user.is_admin === true || user.is_admin === 'true' || user.email === 'admin@debts.dz',
        active: user.active
      }
    });

  } catch (error) {
    console.error('Login Database Error:', error);
    return res.status(500).json({ success: false, error: 'حدث خطأ في السيرفر: ' + error.message });
  }
}
