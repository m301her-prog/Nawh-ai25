import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
    // إعدادات الـ CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    try {
        const sql = neon(process.env.DATABASE_URL);
        const { action, data } = req.body; // نفترض أن البيانات تأتي داخل كائن باسم data

        switch (action) {
            case 'add_product':
                await sql`INSERT INTO products (name, barcode, purchase_price, sale_price, stock_quantity) 
                          VALUES (${data.name}, ${data.barcode}, ${data.purchase_price}, ${data.sale_price}, ${data.stock_quantity})`;
                return res.status(200).json({ success: true });

            case 'add_supplier':
                await sql`INSERT INTO suppliers (name, phone) VALUES (${data.name}, ${data.phone})`;
                return res.status(200).json({ success: true });

            case 'add_expense':
                await sql`INSERT INTO expenses (description, amount, expense_date) 
                          VALUES (${data.description}, ${data.amount}, ${data.expense_date})`;
                return res.status(200).json({ success: true });

            case 'add_sale':
                // إضافة رأس الفاتورة ثم تفاصيلها
                const saleResult = await sql`INSERT INTO sales_invoices (total_price, payment_method) 
                                           VALUES (${data.total_price}, ${data.payment_method}) RETURNING id;`;
                const invoiceId = saleResult[0].id;
                
                // إدراج تفاصيل المبيعات (بفرض أن data.items مصفوفة)
                for (const item of data.items) {
                    await sql`INSERT INTO sale_items (invoice_id, product_id, quantity, price) 
                              VALUES (${invoiceId}, ${item.product_id}, ${item.quantity}, ${item.price})`;
                }
                return res.status(200).json({ success: true, invoice_id: invoiceId });

            case 'add_purchase':
                // إضافة فاتورة مشتريات وتفاصيلها
                const purchaseResult = await sql`INSERT INTO purchase_invoices (supplier_id, total_amount) 
                                               VALUES (${data.supplier_id}, ${data.total_amount}) RETURNING id;`;
                const purInvoiceId = purchaseResult[0].id;

                for (const item of data.items) {
                    await sql`INSERT INTO purchase_items (invoice_id, product_id, quantity, price) 
                              VALUES (${purInvoiceId}, ${item.product_id}, ${item.quantity}, ${item.price})`;
                }
                return res.status(200).json({ success: true, invoice_id: purInvoiceId });

            default:
                return res.status(400).json({ success: false, error: 'Action غير معروف' });
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, error: error.message });
    }
}
