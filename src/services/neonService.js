/**
 * Neon PostgreSQL Service for Debts Manager
 * Handles all database operations with dynamic per-user tables
 * Includes Android Capture event triggers for WebView integration
 * Optimized with CapacitorHttp for native cross-platform compatibility
 * Updated: Support for debt scheduling and installments
 */

import { CapacitorHttp } from '@capacitor/core';

// Neon database connection string - set in .env as VITE_NEON_DATABASE_URL
const getConnectionString = () => {
  return import.meta.env.VITE_NEON_DATABASE_URL || '';
};

// Check if Neon is configured
export const isNeonConfigured = () => {
  const url = getConnectionString();
  return url && url.includes('neon.tech');
};

/**
 * Execute SQL query via CapacitorHttp with retry logic and fallback to localStorage
 */
const executeQuery = async (query, params = []) => {
  const connString = getConnectionString();

  if (!connString || !connString.includes('neon.tech')) {
    console.warn('Neon not configured, using localStorage fallback');
    return null;
  }

  try {
    let httpUrl = connString;
    if (httpUrl.startsWith('postgres://')) {
      httpUrl = httpUrl.replace('postgres://', 'https://');
    } else if (httpUrl.startsWith('postgresql://')) {
      httpUrl = httpUrl.replace('postgresql://', 'https://');
    }

    if (!httpUrl.includes('/v1/sql') && !httpUrl.includes('/sql')) {
      const urlObj = new URL(httpUrl);
      httpUrl = `https://${urlObj.host}/v1/sql`;
    }

    const options = {
      url: httpUrl,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${connString.split('@')[0].split(':').pop()}`
      },
      data: {
        query: query,
        params: params
      }
    };

    const response = await CapacitorHttp.post(options);

    if (response.status >= 200 && response.status < 300) {
      return response.data;
    } else {
      throw new Error(`Neon HTTP error! status: ${response.status}`);
    }
  } catch (error) {
    console.error('Neon query error via CapacitorHttp:', error);
    throw error;
  }
};

/**
 * Android Capture Event Trigger
 * Sends events to Android WebView when available
 * Also saves to localStorage for offline sync
 */
export const triggerAndroidCapture = (eventType, data) => {
  const eventData = {
    type: eventType,
    data: data,
    timestamp: new Date().toISOString(),
    synced: false
  };

  // Save to localStorage for Android Capture access
  saveCaptureEvent(eventData);

  // Check for Android interface and send capture signal
  if (window.AndroidInterface && typeof window.AndroidInterface.captureEvent === 'function') {
    try {
      window.AndroidInterface.captureEvent(JSON.stringify(eventData));
      console.log('Android Capture event sent:', eventType);
    } catch (error) {
      console.error('Android Interface error:', error);
    }
  }

  // Alternative Android interface names
  if (window.AndroidCapture && typeof window.AndroidCapture.onEvent === 'function') {
    try {
      window.AndroidCapture.onEvent(eventType, JSON.stringify(data));
    } catch (error) {
      console.error('AndroidCapture error:', error);
    }
  }

  // Dispatch custom event for any listeners
  window.dispatchEvent(new CustomEvent('appCapture', {
    detail: eventData
  }));
};

/**
 * Save capture event to localStorage
 */
const saveCaptureEvent = (eventData) => {
  try {
    const captureLog = JSON.parse(localStorage.getItem('captureLog') || '[]');
    captureLog.push(eventData);
    const trimmed = captureLog.slice(-100);
    localStorage.setItem('captureLog', JSON.stringify(trimmed));
  } catch (error) {
    console.error('Failed to save capture event:', error);
  }
};

/**
 * Save data to localStorage (primary storage for this implementation)
 */
export const saveToLocalStorage = (key, data) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    triggerAndroidCapture('DATA_SAVED', { key, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('LocalStorage save error:', error);
  }
};

/**
 * Load data from localStorage
 */
export const loadFromLocalStorage = (key, defaultValue = null) => {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : defaultValue;
  } catch (error) {
    console.error('LocalStorage load error:', error);
    return defaultValue;
  }
};

/**
 * Generate unique user ID
 */
const generateUserId = () => {
  return 'usr_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
};

/**
 * Generate unique debt ID
 */
const generateDebtId = () => {
  return 'debt_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5);
};

/**
 * Hash password (simple implementation - in production use bcrypt on server)
 */
const hashPassword = (password) => {
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(16);
};

/**
 * ============================================
 * USER AUTHENTICATION FUNCTIONS
 * ============================================
 */

/**
 * Register new user and create dedicated tables
 * Creates: user_{userId}_debts, user_{userId}_activities tables
 */
export const registerUserAndCreateTables = async (name, email, password, phone) => {
  const users = loadFromLocalStorage('registeredUsers', []);

  if (users.find(u => u.email === email)) {
    throw new Error('البريد الإلكتروني مسجل مسبقاً / Email déjà utilisé / Email already registered');
  }

  const userId = generateUserId();
  const hashedPassword = hashPassword(password);
  const isAdmin = email === 'admin@debts.dz';

  const newUser = {
    id: userId,
    name,
    email,
    password: hashedPassword,
    phone: phone || '',
    active: true,
    isAdmin,
    createdAt: new Date().toISOString()
  };

  users.push(newUser);
  saveToLocalStorage('registeredUsers', users);

  const userDebtsKey = `user_${userId}_debts`;
  const userActivitiesKey = `user_${userId}_activities`;

  saveToLocalStorage(userDebtsKey, []);
  saveToLocalStorage(userActivitiesKey, []);

  if (isNeonConfigured()) {
    try {
      await executeQuery(`
        CREATE TABLE IF NOT EXISTS user_${userId.replace(/-/g, '_')}_debts (
          id VARCHAR(50) PRIMARY KEY,
          type VARCHAR(20) NOT NULL,
          person_name TEXT NOT NULL,
          phone TEXT,
          amount DECIMAL(12,2) NOT NULL,
          currency VARCHAR(10) DEFAULT 'DZD',
          due_date DATE NOT NULL,
          notes TEXT,
          status VARCHAR(20) DEFAULT 'pending',
          paid_amount DECIMAL(12,2) DEFAULT 0,
          is_scheduled BOOLEAN DEFAULT FALSE,
          schedule_type VARCHAR(20),
          installments_count INTEGER DEFAULT 0,
          installments_paid INTEGER DEFAULT 0,
          first_payment_date DATE,
          schedule_data JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await executeQuery(`
        CREATE TABLE IF NOT EXISTS user_${userId.replace(/-/g, '_')}_activities (
          id VARCHAR(50) PRIMARY KEY,
          action VARCHAR(50) NOT NULL,
          details TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      console.log('Neon tables created for user:', userId);
    } catch (error) {
      console.error('Failed to create Neon tables:', error);
    }
  }

  logUserActivity(userId, 'USER_REGISTERED', { name, email, phone });

  triggerAndroidCapture('USER_REGISTERED', {
    userId,
    name,
    email,
    timestamp: newUser.createdAt
  });

  const { password: _, ...userWithoutPassword } = newUser;
  return userWithoutPassword;
};

/**
 * Authenticate user
 */
export const authUser = async (email, password) => {
  const users = loadFromLocalStorage('registeredUsers', []);
  const hashedPassword = hashPassword(password);

  const user = users.find(u =>
    u.email === email && u.password === hashedPassword && u.active
  );

  if (!user) {
    throw new Error('بيانات الدخول غير صحيحة / Identifiants incorrects / Invalid credentials');
  }

  const updatedUsers = users.map(u =>
    u.id === user.id
      ? { ...u, lastLogin: new Date().toISOString() }
      : u
  );
  saveToLocalStorage('registeredUsers', updatedUsers);

  logUserActivity(user.id, 'USER_LOGIN', { email });

  triggerAndroidCapture('USER_LOGIN', {
    userId: user.id,
    email: user.email,
    timestamp: new Date().toISOString()
  });

  const { password: _, ...userWithoutPassword } = user;
  return userWithoutPassword;
};

/**
 * Logout user
 */
export const logoutUser = async (userId) => {
  logUserActivity(userId, 'USER_LOGOUT', {});
  triggerAndroidCapture('USER_LOGOUT', { userId });
};

/**
 * Get user by ID
 */
export const getUserById = (userId) => {
  const users = loadFromLocalStorage('registeredUsers', []);
  const user = users.find(u => u.id === userId);
  if (user) {
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }
  return null;
};

/**
 * ============================================
 * DEBT MANAGEMENT FUNCTIONS
 * ============================================
 */

/**
 * Fetch all debts for a specific user
 */
export const fetchDebts = (userId) => {
  const userDebtsKey = `user_${userId}_debts`;
  const debts = loadFromLocalStorage(userDebtsKey, []);

  return debts.sort((a, b) =>
    new Date(b.createdAt) - new Date(a.createdAt)
  );
};

/**
 * Add new debt for user with scheduling support
 */
export const addDebt = async (userId, debtData) => {
  const userDebtsKey = `user_${userId}_debts`;
  const debts = loadFromLocalStorage(userDebtsKey, []);

  const newDebt = {
    id: generateDebtId(),
    type: debtData.type,
    personName: debtData.personName,
    phone: debtData.phone || '',
    amount: parseFloat(debtData.amount),
    currency: debtData.currency || 'DZD',
    dueDate: debtData.dueDate,
    notes: debtData.notes || '',
    status: 'pending',
    paidAmount: 0,
    isScheduled: debtData.isScheduled || false,
    scheduleType: debtData.scheduleType || null,
    installmentsCount: debtData.installmentsCount || 0,
    installmentsPaid: 0,
    firstPaymentDate: debtData.firstPaymentDate || null,
    scheduleData: debtData.scheduleData || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  debts.push(newDebt);
  saveToLocalStorage(userDebtsKey, debts);

  logUserActivity(userId, 'DEBT_ADDED', {
    debtId: newDebt.id,
    personName: newDebt.personName,
    amount: newDebt.amount,
    isScheduled: newDebt.isScheduled
  });

  triggerAndroidCapture('DEBT_ADDED', {
    userId,
    debt: newDebt
  });

  if (isNeonConfigured()) {
    try {
      const tableName = `user_${userId.replace(/-/g, '_')}_debts`;
      await executeQuery(`
        INSERT INTO ${tableName} (id, type, person_name, phone, amount, currency, due_date, notes, status, paid_amount, is_scheduled, schedule_type, installments_count, installments_paid, first_payment_date, schedule_data)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      `, [
        newDebt.id, newDebt.type, newDebt.personName, newDebt.phone,
        newDebt.amount, newDebt.currency, newDebt.dueDate,
        newDebt.notes, newDebt.status, newDebt.paidAmount,
        newDebt.isScheduled, newDebt.scheduleType, newDebt.installmentsCount,
        newDebt.installmentsPaid, newDebt.firstPaymentDate,
        JSON.stringify(newDebt.scheduleData)
      ]);
    } catch (error) {
      console.error('Failed to sync debt to Neon:', error);
    }
  }

  return newDebt;
};

/**
 * Update debt status
 */
export const updateDebtStatus = async (userId, debtId, updates) => {
  const userDebtsKey = `user_${userId}_debts`;
  const debts = loadFromLocalStorage(userDebtsKey, []);

  const debtIndex = debts.findIndex(d => d.id === debtId);
  if (debtIndex === -1) {
    throw new Error('الدين غير موجود / Dette introuvable / Debt not found');
  }

  const updatedDebt = {
    ...debts[debtIndex],
    ...updates,
    updatedAt: new Date().toISOString()
  };

  debts[debtIndex] = updatedDebt;
  saveToLocalStorage(userDebtsKey, debts);

  logUserActivity(userId, 'DEBT_UPDATED', {
    debtId,
    updates: Object.keys(updates).join(', ')
  });

  triggerAndroidCapture('DEBT_UPDATED', {
    userId,
    debtId,
    updates: updatedDebt
  });

  return updatedDebt;
};

/**
 * Delete debt
 */
export const deleteDebt = async (userId, debtId) => {
  const userDebtsKey = `user_${userId}_debts`;
  const debts = loadFromLocalStorage(userDebtsKey, []);

  const filteredDebts = debts.filter(d => d.id !== debtId);
  saveToLocalStorage(userDebtsKey, filteredDebts);

  logUserActivity(userId, 'DEBT_DELETED', { debtId });

  triggerAndroidCapture('DEBT_DELETED', {
    userId,
    debtId
  });
};

/**
 * ============================================
 * REPORTS AND EXPORT FUNCTIONS
 * ============================================
 */

/**
 * Generate debt report as formatted string
 */
export const generateDebtReport = (userId, language = 'ar') => {
  const debts = fetchDebts(userId);
  const stats = calculateStatistics(userId);
  const user = getUserById(userId);

  const formatDate = (dateString) => {
    const locale = language === 'ar' ? 'ar-DZ' : language === 'fr' ? 'fr-FR' : 'en-US';
    return new Date(dateString).toLocaleDateString(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount) => {
    const locale = language === 'ar' ? 'ar-DZ' : language === 'fr' ? 'fr-FR' : 'en-US';
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'DZD',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const headers = {
    ar: {
      title: 'تقرير الديون',
      date: 'تاريخ التقرير',
      user: 'المستخدم',
      totalOwed: 'إجمالي المستحق لي',
      totalOwe: 'إجمالي المتوجب عليّ',
      paid: 'مدفوعة',
      pending: 'معلقة',
      overdue: 'متأخرة',
      person: 'الشخص',
      amount: 'المبلغ',
      dueDate: 'تاريخ الاستحقاق',
      status: 'الحالة',
      type: 'النوع',
      owedToMe: 'لي',
      iOwe: 'عليّ',
      scheduled: 'مجدول',
      notScheduled: 'غير مجدول'
    },
    fr: {
      title: 'Rapport des dettes',
      date: 'Date du rapport',
      user: 'Utilisateur',
      totalOwed: 'Total à recevoir',
      totalOwe: 'Total à payer',
      paid: 'Payées',
      pending: 'En attente',
      overdue: 'En retard',
      person: 'Personne',
      amount: 'Montant',
      dueDate: "Date d'échéance",
      status: 'Statut',
      type: 'Type',
      owedToMe: 'À recevoir',
      iOwe: 'À payer',
      scheduled: 'Programmé',
      notScheduled: 'Non programmé'
    },
    en: {
      title: 'Debts Report',
      date: 'Report Date',
      user: 'User',
      totalOwed: 'Total Owed to Me',
      totalOwe: 'Total I Owe',
      paid: 'Paid',
      pending: 'Pending',
      overdue: 'Overdue',
      person: 'Person',
      amount: 'Amount',
      dueDate: 'Due Date',
      status: 'Status',
      type: 'Type',
      owedToMe: 'Owed to Me',
      iOwe: 'I Owe',
      scheduled: 'Scheduled',
      notScheduled: 'Not Scheduled'
    }
  };

  const h = headers[language] || headers.ar;

  let report = `═══════════════════════════════════════════════════════════════\n`;
  report += `                        ${h.title}\n`;
  report += `═══════════════════════════════════════════════════════════════\n\n`;
  report += `${h.date}: ${formatDate(new Date().toISOString())}\n`;
  report += `${h.user}: ${user?.name || user?.email || 'Unknown'}\n\n`;
  report += `───────────────────────────────────────────────────────────────\n`;
  report += `                         ${language === 'ar' ? 'الملخص' : language === 'fr' ? 'Résumé' : 'Summary'}\n`;
  report += `───────────────────────────────────────────────────────────────\n`;
  report += `${h.totalOwed}: ${formatCurrency(stats.totalOwedToMe)}\n`;
  report += `${h.totalOwe}: ${formatCurrency(stats.totalIOwe)}\n`;
  report += `${h.paid}: ${stats.paidDebtsCount}\n`;
  report += `${h.pending}: ${stats.pendingDebtsCount}\n`;
  report += `${h.overdue}: ${stats.overdueDebts.length}\n\n`;

  if (debts.length > 0) {
    report += `═══════════════════════════════════════════════════════════════\n`;
    report += `                     ${language === 'ar' ? 'تفاصيل الديون' : language === 'fr' ? 'Détails des dettes' : 'Debt Details'}\n`;
    report += `═══════════════════════════════════════════════════════════════\n\n`;

    debts.forEach((debt, index) => {
      report += `───────────────────────────────────────────────────────────────\n`;
      report += `${index + 1}. ${debt.personName}\n`;
      report += `───────────────────────────────────────────────────────────────\n`;
      report += `   ${h.type}: ${debt.type === 'owed_to_me' ? h.owedToMe : h.iOwe}\n`;
      report += `   ${h.amount}: ${formatCurrency(debt.amount)} (${debt.currency})\n`;
      report += `   ${h.dueDate}: ${formatDate(debt.dueDate)}\n`;
      report += `   ${h.status}: ${debt.status === 'paid' ? h.paid : debt.status === 'pending' ? h.pending : h.overdue}\n`;
      if (debt.isScheduled) {
        report += `   ${h.scheduled}: ${h.yes || 'نعم'} (${debt.installmentsCount} ${language === 'ar' ? 'دفعات' : language === 'fr' ? 'versements' : 'installments'})\n`;
      }
      if (debt.notes) {
        report += `   ${language === 'ar' ? 'ملاحظات' : language === 'fr' ? 'Notes' : 'Notes'}: ${debt.notes}\n`;
      }
      report += `\n`;
    });
  }

  report += `═══════════════════════════════════════════════════════════════\n`;
  report += `              Debts Manager - ${new Date().getFullYear()}\n`;
  report += `═══════════════════════════════════════════════════════════════\n`;

  return report;
};

/**
 * Export debts as CSV
 */
export const exportDebtsAsCSV = (userId) => {
  const debts = fetchDebts(userId);

  const headers = ['Person Name', 'Type', 'Amount', 'Currency', 'Due Date', 'Status', 'Phone', 'Notes', 'Is Scheduled', 'Installments', 'Created At'];
  const rows = debts.map(d => [
    `"${d.personName}"`,
    d.type,
    d.amount,
    d.currency,
    d.dueDate,
    d.status,
    `"${d.phone || ''}"`,
    `"${(d.notes || '').replace(/"/g, '""')}"`,
    d.isScheduled ? 'Yes' : 'No',
    d.installmentsCount || 0,
    d.createdAt
  ]);

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
};

/**
 * Download report as file
 */
export const downloadReport = (userId, language = 'ar', format = 'txt') => {
  let content, filename, mimeType;

  if (format === 'csv') {
    content = exportDebtsAsCSV(userId);
    filename = `debts_report_${new Date().toISOString().split('T')[0]}.csv`;
    mimeType = 'text/csv';
  } else {
    content = generateDebtReport(userId, language);
    filename = `debts_report_${new Date().toISOString().split('T')[0]}.txt`;
    mimeType = 'text/plain';
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  triggerAndroidCapture('REPORT_DOWNLOADED', {
    userId,
    format,
    filename
  });

  return { filename, size: blob.size };
};

/**
 * ============================================
 * ACTIVITY LOGGING
 * ============================================
 */

export const logUserActivity = (userId, action, details) => {
  const userActivitiesKey = `user_${userId}_activities`;
  const activities = loadFromLocalStorage(userActivitiesKey, []);

  const newActivity = {
    id: 'act_' + Date.now().toString(36),
    action,
    details,
    createdAt: new Date().toISOString()
  };

  activities.unshift(newActivity);
  saveToLocalStorage(userActivitiesKey, activities.slice(0, 100));

  return newActivity;
};

export const getUserActivities = (userId, limit = 20) => {
  const userActivitiesKey = `user_${userId}_activities`;
  const activities = loadFromLocalStorage(userActivitiesKey, []);
  return activities.slice(0, limit);
};

/**
 * ============================================
 * ADMIN FUNCTIONS
 * ============================================
 */

export const getAdminStats = () => {
  const users = loadFromLocalStorage('registeredUsers', []);

  let totalDebts = 0;
  let totalOwed = 0;
  let totalOwing = 0;

  users.forEach(user => {
    const userDebts = fetchDebts(user.id);
    totalDebts += userDebts.length;
    userDebts.forEach(debt => {
      if (debt.status !== 'paid') {
        if (debt.type === 'owed_to_me') {
          totalOwed += debt.amount;
        } else {
          totalOwing += debt.amount;
        }
      }
    });
  });

  return {
    totalUsers: users.length,
    activeUsers: users.filter(u => u.active).length,
    totalDebts,
    totalOwed,
    totalOwing
  };
};

export const getAllUsers = () => {
  const users = loadFromLocalStorage('registeredUsers', []);
  return users.map(u => {
    const { password: _, ...userWithoutPassword } = u;
    return userWithoutPassword;
  });
};

export const toggleUserStatus = (userId, active) => {
  const users = loadFromLocalStorage('registeredUsers', []);
  const updatedUsers = users.map(u =>
    u.id === userId ? { ...u, active } : u
  );
  saveToLocalStorage('registeredUsers', updatedUsers);

  triggerAndroidCapture('USER_STATUS_CHANGED', { userId, active });
};

export const deleteUser = (userId) => {
  const users = loadFromLocalStorage('registeredUsers', []);
  const filtered = users.filter(u => u.id !== userId);
  saveToLocalStorage('registeredUsers', filtered);

  localStorage.removeItem(`user_${userId}_debts`);
  localStorage.removeItem(`user_${userId}_activities`);

  triggerAndroidCapture('USER_DELETED', { userId });
};

/**
 * ============================================
 * STATISTICS CALCULATION
 * ============================================
 */

export const calculateStatistics = (userId) => {
  const debts = fetchDebts(userId);

  const totalOwedToMe = debts
    .filter(d => d.type === 'owed_to_me' && d.status !== 'paid')
    .reduce((sum, d) => sum + d.amount, 0);

  const totalIOwe = debts
    .filter(d => d.type === 'i_owe' && d.status !== 'paid')
    .reduce((sum, d) => sum + d.amount, 0);

  const paidDebts = debts.filter(d => d.status === 'paid').length;
  const pendingDebts = debts.filter(d => d.status === 'pending').length;

  const overdueDebts = debts.filter(d => {
    if (d.status === 'paid') return false;
    const dueDate = new Date(d.dueDate);
    return dueDate < new Date();
  });

  const paidRatio = debts.length > 0
    ? Math.round((paidDebts / debts.length) * 100)
    : 0;

  const scheduledDebts = debts.filter(d => d.isScheduled);
  const totalScheduledAmount = scheduledDebts.reduce((sum, d) => sum + d.amount, 0);

  const monthlyStats = calculateMonthlyStatistics(debts);

  return {
    totalOwedToMe,
    totalIOwe,
    paidDebtsCount: paidDebts,
    pendingDebtsCount: pendingDebts,
    overdueDebts,
    overdueCount: overdueDebts.length,
    paidRatio,
    totalDebts: debts.length,
    scheduledDebtsCount: scheduledDebts.length,
    totalScheduledAmount,
    monthlyStats
  };
};

/**
 * Calculate monthly statistics for charts
 */
const calculateMonthlyStatistics = (debts) => {
  const months = [];
  const now = new Date();

  for (let i = 5; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

    const monthDebts = debts.filter(d => {
      const created = new Date(d.createdAt);
      return created >= date && created <= monthEnd;
    });

    const monthPaid = monthDebts.filter(d => d.status === 'paid').length;
    const monthTotal = monthDebts.length;

    months.push({
      month: date.toLocaleDateString('en', { month: 'short' }),
      year: date.getFullYear(),
      added: monthTotal,
      paid: monthPaid,
      total: monthDebts.reduce((sum, d) => sum + d.amount, 0)
    });
  }

  return months;
};

// Export service object
const neonService = {
  isNeonConfigured,
  triggerAndroidCapture,
  saveToLocalStorage,
  loadFromLocalStorage,
  registerUserAndCreateTables,
  authUser,
  logoutUser,
  getUserById,
  fetchDebts,
  addDebt,
  updateDebtStatus,
  deleteDebt,
  logUserActivity,
  getUserActivities,
  getAdminStats,
  getAllUsers,
  toggleUserStatus,
  deleteUser,
  calculateStatistics,
  generateDebtReport,
  exportDebtsAsCSV,
  downloadReport
};

export default neonService;
