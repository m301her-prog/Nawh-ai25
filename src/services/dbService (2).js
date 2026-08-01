// dbService.js — Data-access layer for Shatir Store ERP.
// Integrated with Neon DB Direct Query & Vercel External API Endpoints.

import { 
  hasNeon, 
  query, 
  rpc, 
  restSelect, 
  restInsert, 
  restUpdate,
  invoicesApi,
  productsApi,
  hasFallback
} from './neonClient';
import { storage } from './storage';

// ---------- INVENTORY ----------

export async function fetchInventory() {
  let products;
  try {
    if (hasNeon) {
      products = await query('SELECT * FROM products ORDER BY name');
    } else if (hasFallback) {
      products = await restSelect('products', { select: '*', order: { col: 'name', desc: 'false' } });
    } else if (productsApi?.getAll) {
      // الاتصال بالرابط الخارجي (https://shater5.vercel.app/api/productsController)
      products = await productsApi.getAll();
    } else {
      products = await loadCachedInventory();
    }
  } catch (err) {
    console.warn('Error fetching inventory from DB/API, using cached data:', err);
    products = await loadCachedInventory();
  }

  products = (products || []).map(normalizeProduct);
  await storage.cacheProducts(products);
  return products;
}

export async function loadCachedInventory() {
  return (await storage.loadCachedProducts()) || [];
}

export async function createProduct(p) {
  const row = {
    sku: p.sku,
    name: p.name,
    quantity: Number(p.quantity) || 0,
    cost_price: Number(p.cost_price) || 0,
    selling_price: Number(p.selling_price) || 0,
    category: p.category || 'عام',
    low_stock_threshold: Number(p.low_stock_threshold) || 5,
  };

  let created;
  if (hasNeon) {
    const rows = await query(
      `INSERT INTO products (sku, name, quantity, cost_price, selling_price, category, low_stock_threshold)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [row.sku, row.name, row.quantity, row.cost_price, row.selling_price, row.category, row.low_stock_threshold]
    );
    created = rows[0];
  } else if (hasFallback) {
    const res = await restInsert('products', row);
    created = res[0];
  } else {
    created = await productsApi.save(row);
  }

  return normalizeProduct(created);
}

export async function updateProduct(id, patch) {
  const clean = {
    name: patch.name,
    sku: patch.sku,
    category: patch.category,
    quantity: Number(patch.quantity),
    cost_price: Number(patch.cost_price),
    selling_price: Number(patch.selling_price),
    low_stock_threshold: Number(patch.low_stock_threshold),
  };

  let updated;
  if (hasNeon) {
    const rows = await query(
      `UPDATE products SET name=$2, sku=$3, category=$4, quantity=$5, cost_price=$6, selling_price=$7, low_stock_threshold=$8
       WHERE id=$1 RETURNING *`,
      [id, clean.name, clean.sku, clean.category, clean.quantity, clean.cost_price, clean.selling_price, clean.low_stock_threshold]
    );
    updated = rows[0];
  } else if (hasFallback) {
    const res = await restUpdate('products', [{ col: 'id', op: 'eq', val: id }], clean);
    updated = res[0];
  } else {
    updated = await productsApi.save({ id, ...clean });
  }

  return normalizeProduct(updated);
}

// ---------- INVOICES ----------

export async function fetchInvoices() {
  let rows;
  try {
    if (hasNeon) {
      rows = await query('SELECT * FROM invoices ORDER BY created_at DESC');
    } else if (hasFallback) {
      rows = await restSelect('invoices', { select: '*', order: { col: 'created_at', desc: 'true' } });
    } else if (invoicesApi?.getAll) {
      // الاتصال بالرابط الخارجي (https://shater5.vercel.app/api/invoicesController)
      rows = await invoicesApi.getAll();
    } else {
      rows = await loadCachedInvoices();
    }
  } catch (err) {
    console.warn('Error fetching invoices from DB/API, using cached data:', err);
    rows = await loadCachedInvoices();
  }

  rows = (rows || []).map(normalizeInvoice);
  await storage.cacheInvoices(rows);
  return rows;
}

export async function loadCachedInvoices() {
  return (await storage.loadCachedInvoices()) || [];
}

// 🛠️ دالة fetchInvoiceItems المحدثة لمنع تعطل التطبيق
export async function fetchInvoiceItems(invoiceId) {
  let rows = [];
  try {
    if (hasNeon) {
      rows = await query(
        `SELECT ii.*, p.name AS product_name, p.sku AS product_sku
         FROM invoice_items ii
         LEFT JOIN products p ON p.id = ii.product_id
         WHERE ii.invoice_id = $1`,
        [invoiceId]
      );
    } else if (hasFallback) {
      rows = await restSelect('invoice_items', {
        select: '*, products(name,sku)',
        filters: [{ col: 'invoice_id', op: 'eq', val: invoiceId }],
      });
    } else if (invoicesApi?.getItems) {
      rows = await invoicesApi.getItems(invoiceId);
    } else {
      console.warn(`No database fallback available for invoice ${invoiceId}, checking cached invoices.`);
      const cachedInvoices = await storage.loadCachedInvoices();
      const targetInv = (cachedInvoices || []).find((inv) => inv.id === invoiceId);
      rows = targetInv?.items || [];
    }
  } catch (err) {
    console.warn(`Failed to fetch items for invoice ${invoiceId}, falling back to local cache:`, err);
    try {
      const cachedInvoices = await storage.loadCachedInvoices();
      const targetInv = (cachedInvoices || []).find((inv) => inv.id === invoiceId);
      rows = targetInv?.items || [];
    } catch (e) {
      rows = [];
    }
  }

  return (rows || []).map(normalizeInvoiceItem);
}

export async function processPurchaseInvoice(data) {
  return processInvoice('PURCHASE', data);
}

export async function processSalesInvoice(data) {
  return processInvoice('SALE', data);
}

async function processInvoice(type, data) {
  const items = data.items.map((it) => ({
    product_id: it.product_id,
    quantity: Number(it.quantity),
    unit_price: Number(it.unit_price),
    subtotal: Number(it.subtotal || (it.quantity * it.unit_price)),
  }));

  const total = Number(data.total_amount) || items.reduce((s, i) => s + i.subtotal, 0);
  const partyName = data.customer_name || data.party_name || 'عميل نقدي';
  const paidAmount = Number(data.paid_amount) || 0;
  const previousBalance = Number(data.previous_balance) || 0;

  let invoice;
  if (hasNeon) {
    const rows = await query(
      `INSERT INTO invoices (type, total_amount, created_by, party_name, paid_amount, previous_balance)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [type, total, data.created_by || null, partyName, paidAmount, previousBalance]
    );
    invoice = rows[0];

    for (const it of items) {
      await query(
        `INSERT INTO invoice_items (invoice_id, product_id, quantity, unit_price)
         VALUES ($1, $2, $3, $4)`,
        [invoice.id, it.product_id, it.quantity, it.unit_price]
      );
    }
  } else if (hasFallback) {
    const res = await rpc('create_invoice_with_items', {
      p_type: type,
      p_total_amount: total,
      p_created_by: data.created_by || null,
      p_items: items,
      p_party_name: partyName,
      p_paid_amount: paidAmount,
      p_previous_balance: previousBalance,
    });
    invoice = Array.isArray(res) ? res[0] : res;
  } else {
    // إرسال البيانات إلى Vercel External API Endpoint
    invoice = await invoicesApi.create({
      type,
      total_amount: total,
      party_name: partyName,
      paid_amount: paidAmount,
      previous_balance: previousBalance,
      items,
      created_by: data.created_by || null,
    });
  }

  const normalized = normalizeInvoice(invoice);
  if (normalized) {
    normalized.items = items;
  }
  return normalized;
}

// ---------- USERS ----------

export async function fetchUsers() {
  let rows;
  try {
    if (hasNeon) {
      rows = await query('SELECT id, full_name, email, role, created_at FROM users ORDER BY created_at DESC');
    } else if (hasFallback) {
      rows = await restSelect('users', {
        select: 'id,full_name,email,role,created_at',
        order: { col: 'created_at', desc: 'true' },
      });
    } else {
      rows = [];
    }
  } catch (err) {
    console.warn('Error fetching users:', err);
    rows = [];
  }
  return (rows || []).map(normalizeUser);
}

export async function toggleUserStatus(userId, status) {
  if (hasNeon) {
    const rows = await query('UPDATE users SET is_active = $2 WHERE id = $1 RETURNING *', [userId, status]);
    return normalizeUser(rows[0]);
  }
  const res = await restUpdate('users', [{ col: 'id', op: 'eq', val: userId }], { is_active: status });
  return normalizeUser(res[0]);
}

// ---------- STATS (admin dashboard) ----------

export async function fetchStats() {
  try {
    if (hasNeon) {
      const [sales] = await query(`SELECT COALESCE(SUM(total_amount),0) AS v FROM invoices WHERE type IN ('SALE', 'بيع')`);
      const [purchases] = await query(`SELECT COALESCE(SUM(total_amount),0) AS v FROM invoices WHERE type IN ('PURCHASE', 'شراء')`);
      const [inv] = await query(`SELECT COALESCE(SUM(quantity * cost_price),0) AS v FROM products`);
      const [low] = await query(`SELECT COUNT(*) AS v FROM products WHERE quantity <= low_stock_threshold`);
      const [count] = await query(`SELECT COUNT(*) AS v FROM products`);

      return {
        totalRevenue: Number(sales?.v || 0),
        totalPurchases: Number(purchases?.v || 0),
        inventoryValue: Number(inv?.v || 0),
        lowStock: Number(low?.v || 0),
        productCount: Number(count?.v || 0),
      };
    }
  } catch (err) {
    console.warn('Error fetching stats from Neon, computing locally:', err);
  }

  // Fallback: fetch rows and compute in JS
  const [products, invoices] = await Promise.all([fetchInventory(), fetchInvoices()]);
  return {
    totalRevenue: invoices.filter((i) => i.type === 'SALE' || i.type === 'بيع').reduce((s, i) => s + (i.total_amount || 0), 0),
    totalPurchases: invoices.filter((i) => i.type === 'PURCHASE' || i.type === 'شراء').reduce((s, i) => s + (i.total_amount || 0), 0),
    inventoryValue: products.reduce((s, p) => s + ((p.quantity || 0) * (p.cost_price || 0)), 0),
    lowStock: products.filter((p) => p.quantity <= (p.low_stock_threshold ?? 5)).length,
    productCount: products.length,
  };
}

// ---------- NORMALIZERS ----------

function normalizeProduct(p) {
  if (!p) return null;
  return {
    id: p.id,
    sku: p.sku,
    name: p.name,
    quantity: Number(p.quantity),
    cost_price: Number(p.cost_price),
    selling_price: Number(p.selling_price),
    category: p.category,
    low_stock_threshold: Number(p.low_stock_threshold ?? 5),
    updated_at: p.updated_at,
  };
}

function normalizeInvoice(i) {
  if (!i) return null;
  return {
    id: i.id,
    invoice_number: i.invoice_number,
    type: i.type,
    total_amount: Number(i.total_amount),
    created_by: i.created_by,
    created_at: i.created_at,
    customer_name: i.party_name || i.customer_name || 'عميل نقدي',
    paid_amount: Number(i.paid_amount) || 0,
    remaining_amount: Number(i.remaining_amount) || 0,
    previous_balance: Number(i.previous_balance) || 0,
    items: i.items || [],
  };
}

function normalizeInvoiceItem(it) {
  if (!it) return null;
  const productName = it.product_name || it.products?.name || it.product?.name || '—';
  const productSku = it.product_sku || it.products?.sku || it.product?.sku || '';
  return {
    id: it.id,
    invoice_id: it.invoice_id,
    product_id: it.product_id,
    quantity: Number(it.quantity),
    unit_price: Number(it.unit_price),
    subtotal: Number(it.subtotal || (it.quantity * it.unit_price)),
    product_name: productName,
    product_sku: productSku,
  };
}

function normalizeUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    full_name: u.full_name,
    email: u.email,
    role: u.role,
    is_active: u.is_active ?? true,
    created_at: u.created_at,
  };
}
