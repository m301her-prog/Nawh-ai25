import express from 'express';
import cors from 'cors';
import pg from 'pg';

const app = express();
const PORT = process.env.PORT || 3000;

// 1. الإعدادات العامة للمشروع والـ CORS
app.use(express.json());
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-tenant-schema', 'tenant', 'user-id', 'x-action-secret']
}));

// 2. الاتصال بقاعدة البيانات Neon PostgreSQL
const baseConnectionString = process.env.DATABASE_URL;
if (!baseConnectionString) {
    console.error('CRITICAL: DATABASE_URL غير معرف في بيئة التشغيل');
}

const getPgClient = () => {
    const separator = baseConnectionString?.includes('?') ? '&' : '?';
    const connectionString = `${baseConnectionString}${separator}sslmode=verify-full`;
    
    return new pg.Client({
        connectionString,
        ssl: { rejectUnauthorized: false }
    });
};

// 3. دالة معالجة أسماء السكيمّا
function normalizeSchemaName(inputName) {
    if (!inputName) return '';
    let name = String(inputName).trim();
    if (name.startsWith('schema_')) {
        name = name.replace(/^schema_/, '');
    }
    name = name.replace(/[\s\W]+/g, '_').toLowerCase();
    name = name.replace(/^_+|_+$/g, '');
    return name ? `schema_${name}` : '';
}

// ------------------------------------------------------------------
// API 1: مسار خاص ومستقل للأكشن (حذف السكيمّات التي مر عليها 48 ساعة)
// ------------------------------------------------------------------
app.post('/api/cron/cleanup-expired-schemas', async (req, res) => {
    // حماية المسار بواسطة كلمة سر (Secret Key) لتسريب الطلبات العشوائية
    const actionSecret = req.headers['x-action-secret'] || req.body.secret;
    const EXPECTED_SECRET = process.env.CRON_SECRET || 'MY_SECURE_CRON_SECRET_123';

    if (actionSecret !== EXPECTED_SECRET) {
        return res.status(403).json({ success: false, error: 'غير مصرح بالوصول لهذا المسار.' });
    }

    const maxAgeHours = Number(req.body.maxAgeHours) || 48;
    const client = getPgClient();

    try {
        await client.connect();

        // جلب السكيمّات المسجلة قبل أكثر من 48 ساعة
        const expiredUsersRes = await client.query(`
            SELECT id, company_name, created_at 
            FROM public.app_users 
            WHERE created_at <= NOW() - INTERVAL '${maxAgeHours} hours'
        `);

        const deletedSchemas = [];

        for (const user of expiredUsersRes.rows) {
            const targetSchema = normalizeSchemaName(user.company_name);

            if (targetSchema && targetSchema !== 'public') {
                // إسقاط السكيمّا بالكامل مع جميع الجداول التابعة لها
                await client.query(`DROP SCHEMA IF EXISTS "${targetSchema}" CASCADE;`);
                deletedSchemas.push(targetSchema);
            }

            // حذف الحساب من السجل الرئيسي
            await client.query(`DELETE FROM public.app_users WHERE id = $1;`, [user.id]);
        }

        return res.status(200).json({
            success: true,
            message: `تم تنظيف الخادم وحذف السكيمّات المنتهية (${maxAgeHours} ساعة).`,
            deletedCount: deletedSchemas.length,
            deletedSchemas
        });

    } catch (error) {
        console.error('Error in Cleanup API:', error);
        return res.status(500).json({ success: false, error: error.message });
    } finally {
        await client.end().catch(() => {});
    }
});

// ------------------------------------------------------------------
// API 2: مسار عمليات حذف الديون الفردية (خاص بالتطبيق / الفرونت إند)
// ------------------------------------------------------------------
app.post('/api/Delete', async (req, res) => {
    const client = getPgClient();

    try {
        await client.connect();

        const body = req.body || {};
        const queryParams = req.query || {};
        const d = body.debtData || body.debt || body.updates || body.data || body;

        const targetId = String(body.id || body.debtId || d.id || queryParams.id || '').trim();
        const targetName = String(body.personName || body.person_name || body.name || d.personName || d.person_name || queryParams.personName || '').trim();

        // 1. مسح جميع الديون نهائياً (DELETE_ALL)
        if (body.action === 'DELETE_ALL') {
            const rawSchema = req.headers['x-tenant-schema'] || body.companyName || body.company_name;
            const targetSchema = normalizeSchemaName(rawSchema) || 'public';

            await client.query(`CREATE SCHEMA IF NOT EXISTS "${targetSchema}"`);
            const deleteResult = await client.query(`TRUNCATE TABLE "${targetSchema}".debts;`);

            return res.status(200).json({
                success: true,
                message: `تم مسح جميع سجلات الديون من السكيمّا (${targetSchema}) بنجاح.`
            });
        }

        if (!targetId && !targetName) {
            return res.status(400).json({ success: false, error: 'يرجى إرسال id أو personName المُراد حذفه.' });
        }

        // 2. تحديد السكيمّا المستهدفة
        const rawSchema = req.headers['x-tenant-schema'] || req.headers['tenant'] || body.schemaName || body.companyName;
        const userId = body.userId || d.userId || queryParams.userId || req.headers['user-id'];

        let targetSchema = normalizeSchemaName(rawSchema);

        if (!targetSchema && userId && userId !== 'guest') {
            const userRes = await client.query('SELECT company_name FROM public.app_users WHERE id::text = $1 LIMIT 1', [String(userId)]).catch(() => ({ rows: [] }));
            if (userRes.rows.length > 0 && userRes.rows[0].company_name) {
                targetSchema = normalizeSchemaName(userRes.rows[0].company_name);
            }
        }

        if (!targetSchema) targetSchema = 'public';

        await client.query(`CREATE SCHEMA IF NOT EXISTS "${targetSchema}"`);

        // 3. حذف العنصر المحدد
        let deleteQuery = '';
        let queryParamsArr = [];

        if (targetId) {
            deleteQuery = `DELETE FROM "${targetSchema}".debts WHERE id::text = $1 OR id::text LIKE $2 RETURNING *;`;
            queryParamsArr = [targetId, `%${targetId}%`];
        } else {
            deleteQuery = `DELETE FROM "${targetSchema}".debts WHERE LOWER(TRIM(person_name)) = LOWER(TRIM($1)) RETURNING *;`;
            queryParamsArr = [targetName];
        }

        const result = await client.query(deleteQuery, queryParamsArr);

        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: 'لم يتم العثور على الدين المطلوب حذفه.' });
        }

        return res.status(200).json({
            success: true,
            message: 'تم الحذف بنجاح من قاعدة البيانات',
            deletedCount: result.rowCount,
            deletedRows: result.rows
        });

    } catch (error) {
        console.error('Error in Delete API:', error);
        return res.status(500).json({ success: false, error: error.message });
    } finally {
        await client.end().catch(() => {});
    }
});

// بدء السيرفر
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
