import pg from 'pg';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

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
    const { name, email, password, phone } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'يرجى ملء جميع الحقول الأساسية (الاسم، البريد، كلمة المرور)' });
    }

    const cleanEmail = email.toLowerCase().trim();

    await client.connect();

    // الاستعلام بأحرف صغيرة
    const checkUserQuery = 'select id from app_users where lower(email) = $1 limit 1';
    const checkResult = await client.query(checkUserQuery, [cleanEmail]);

    if (checkResult.rows.length > 0) {
      return res.status(400).json({ error: 'هذا البريد الإلكتروني مسجل بالفعل' });
    }

    const userId = 'usr_' + Math.random().toString(36).substring(2, 11);
    const isAdmin = cleanEmail === 'admin@debts.dz';
    const createdAt = new Date().toISOString();

    // جميع أسماء الأعمدة هنا مكتوبة بأحرف صغيرة تماماً (lowercase)
    const insertQuery = `
      insert into app_users (id, name, email, password, phone, is_admin, active, created_at)
      values ($1, $2, $3, $4, $5, $6, $7, $8)
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
      message: 'تم إنشاء الحساب بنجاح عبر الـ API',
      userId: userId
    });

  } catch (error) {
    console.error('Registration API Error:', error);
    return res.status(500).json({ error: 'حدث خطأ في الخادم أثناء إنشاء الحساب، يرجى المحاولة لاحقاً' });
  } finally {
    await client.end().catch(err => console.error('Error closing client:', err));
  }
}
