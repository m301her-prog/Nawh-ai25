import pg from 'pg';
const { Pool } = pg;

// إنشاء اتصال موحد يضمن إعادة الاستخدام وسرعة الاستجابة في بيئة السيرفرلس
let pool;
if (!pool) {
    pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false // خطوة إجبارية للاتصال الآمن بـ Neon
        }
    });
}

export default async function handler(req, res) {
    // إعدادات الـ CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    try {
        const { action, data } = req.body; // البيانات تأتي داخل كائن باسم data

        switch (action) {
            case 'add_product': {
                const query = `
                    INSERT INTO products (name, barcode, purchase_price, sale_price, stock_quantity) 
                    VALUES ($1, $2, $3, $4, $5)
                `;
                const values = [data.name, data.barcode, data.purchase_price, data.sale_price, data.stock_quantity];
                await pool.query(query, values);
                return res.status(200).json({ success: true });
            }

            case 'add_supplier': {
                const query = `INSERT INTO suppliers (name, phone) VALUES ($1, $2)`;
                const values = [data.name, data.phone];
                await pool.query(query, values);
                return res.status(200).json({ success: true });
            }

            case 'add_expense': {
                const query = `INSERT INTO expenses (description, amount, expense_date) VALUES ($1, $2, $3)`;
                const values = [data.description, data.amount, data.expense_date];
                await pool.query(query, values);
                return res.status(200).json({ success: true });
            }

            case 'add_sale': {
                // إضافة رأس الفاتورة
                const saleQuery = `
                    INSERT INTO sales_invoices (total_price, payment_method) 
                    VALUES ($1, $2) RETURNING id
                `;
                const saleValues = [data.total_price, data.payment_method];
                const saleResult = await pool.query(saleQuery, saleValues);
                
                // في pg نحصل على السجل المرتجع من rows[0]
                const invoiceId = saleResult.rows[0].id;
                
                // إدراج تفاصيل المبيعات (بفرض أن data.items مصفوفة)
                if (data.items && Array.isArray(data.items)) {
                    const itemQuery = `
                        INSERT INTO sale_items (invoice_id, product_id, quantity, price) 
                        VALUES ($1, $2, $3, $4)
                    `;
                    for (const item of data.items) {
                        await pool.query(itemQuery, [invoiceId, item.product_id, item.quantity, item.price]);
                    }
                }
                return res.status(200).json({ success: true, invoice_id: invoiceId });
            }

            case 'add_purchase': {
                // إضافة فاتورة مشتريات
                const purchaseQuery = `
                    INSERT INTO purchase_invoices (supplier_id, total_amount) 
                    VALUES ($1, $2) RETURNING id
                `;
                const purchaseValues = [data.supplier_id, data.total_amount];
                const purchaseResult = await pool.query(purchaseQuery, purchaseValues);
                
                const purInvoiceId = purchaseResult.rows[0].id;

                // إدراج تفاصيل المشتريات
                if (data.items && Array.isArray(data.items)) {
                    const itemQuery = `
                        INSERT INTO purchase_items (invoice_id, product_id, quantity, price) 
                        VALUES ($1, $2, $3, $4)
                    `;
                    for (const item of data.items) {
                        await pool.query(itemQuery, [purInvoiceId, item.product_id, item.quantity, item.price]);
                    }
                }
                return res.status(200).json({ success: true, invoice_id: purInvoiceId });
            }

            default:
                return res.status(400).json({ success: false, error: 'Action غير معروف' });
        }
    } catch (error) {
        console.error('DATABASE ERROR:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
}
