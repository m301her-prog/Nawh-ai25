/**
 * Neon PostgreSQL Service for Debts Manager
 * Handles all database operations with dynamic per-user tables
 * Includes Android Capture event triggers for WebView integration
 * Optimized with CapacitorHttp for native cross-platform compatibility
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
    // تشكيل الرابط للاتصال بـ Neon HTTP API
    // نقوم باستبدال بروتوكول postgres:// بـ https:// إذا كان موجوداً للتعامل مع النفق الذكي
    let httpUrl = connString;
    if (httpUrl.startsWith('postgres://')) {
      httpUrl = httpUrl.replace('postgres://', 'https://');
    } else if (httpUrl.startsWith('postgresql://')) {
      httpUrl = httpUrl.replace('postgresql://', 'https://');
    }
    
    // إذا كان الرابط لا يحتوي على مسار الاستعلام الافتراضي لنظام الـ HTTP في نيوم، نقوم بإضافته
    if (!httpUrl.includes('/v1/sql') && !httpUrl.includes('/sql')) {
      // تنظيف الرابط وإضافة مسار الـ SQL API الخاص بـ Neon
      const urlObj = new URL(httpUrl);
      httpUrl = `https://${urlObj.host}/v1/sql`;
    }

    // لتحديد مسار الاتصال المناسب بناءً على طبيعة الاستعلام المرسل
    const isInsertOrUpdate = query.trim().toUpperCase().startsWith('INSERT') || query.trim().toUpperCase().startsWith('UPDATE') || query.trim().toUpperCase().startsWith('CREATE');
    const targetUrl = isInsertOrUpdate ? 'https://nawh-ai25.vercel.app/save' : 'https://nawh-ai25.vercel.app/get';

    const options = {
      url: targetUrl,
      headers: { 
        'Content-Type': 'application/json',
        // في بعض إعدادات Neon HTTP API يتم تمرير الاتصال في الهيدر إذا لم يكن مدمجاً بالرابط
        'Authorization': `Bearer ${connString.split('@')[0].split(':').pop()}` 
      },
      data: {
        query: query,
        params: params,
        neonUrl: httpUrl
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
    // Keep last 100 events
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
export const registerUserAndCreateTables = async (name, email, password, phone, incomingUserId = null) => {
  const users = loadFromLocalStorage('registeredUsers', []);

  // Check if email exists
  if (users.find(u => u.email === email)) {
    throw new Error('البريد الإلكتروني مستعمل / Email déjà utilisé / Email already registered');
  }

  // استخدام الـ userId القادم من السيرفر كأولوية لضمان تطابق البيانات
  const userId = incomingUserId || generateUserId();
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

  // Save user
  users.push(newUser);
  saveToLocalStorage('registeredUsers', users);

  // Initialize empty tables for user
  const userDebtsKey = `user_${userId}_debts`;
  const userActivitiesKey = `user_${userId}_activities`;

  saveToLocalStorage(userDebtsKey, []);
  saveToLocalStorage(userActivitiesKey, []);

  // If Neon is configured, create actual SQL tables
  if (isNeonConfigured()) {
    try {
      // Create user's debts table
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
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create user's activities table
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
      // Continue with localStorage fallback
    }
  }

  // Log activity
  logUserActivity(userId, 'USER_REGISTERED', { name, email, phone });

  // Trigger Android Capture
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
    throw new Error('المعلومات خاطئة / Identifiants incorrects / Invalid credentials');
  }

  // Update last login
  const updatedUsers = users.map(u =>
    u.id === user.id
      ? { ...u, lastLogin: new Date().toISOString() }
      : u
  );
  saveToLocalStorage('registeredUsers', updatedUsers);

  // Log activity
  logUserActivity(user.id, 'USER_LOGIN', { email });

  // Trigger Android Capture
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

  // Sort by creation date (newest first)
  return debts.sort((a, b) =>
    new Date(b.createdAt) - new Date(a.createdAt)
  );
};

/**
 * Add new debt for user
 */
export const addDebt = async (userId, debtData) => {
  const userDebtsKey = `user_${userId}_debts`;
  const debts = loadFromLocalStorage(userDebtsKey, []);

  const newDebt = {
    id: 'debt_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5),
    type: debtData.type, // 'owed_to_me' or 'i_owe'
    personName: debtData.personName,
    phone: debtData.phone || '',
    amount: parseFloat(debtData.amount),
    currency: debtData.currency || 'DZD',
    dueDate: debtData.dueDate,
    notes: debtData.notes || '',
    status: 'pending',
    paidAmount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  debts.push(newDebt);
  saveToLocalStorage(userDebtsKey, debts);

  // Log activity
  logUserActivity(userId, 'DEBT_ADDED', {
    debtId: newDebt.id,
    personName: newDebt.personName,
    amount: newDebt.amount
  });

  // Trigger Android Capture
  triggerAndroidCapture('DEBT_ADDED', {
    userId,
    debt: newDebt
  });

  // If Neon is configured, sync to cloud
  if (isNeonConfigured()) {
    try {
      const tableName = `user_${userId.replace(/-/g, '_')}_debts`;
      await executeQuery(`
        INSERT INTO ${tableName} (id, type, person_name, phone, amount, currency, due_date, notes, status, paid_amount)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        newDebt.id, newDebt.type, newDebt.personName, newDebt.phone,
        newDebt.amount, newDebt.currency, newDebt.dueDate,
        newDebt.notes, newDebt.status, newDebt.paidAmount
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
    throw new Error('الديون مش كاينة / Dette introuvable / Debt not found');
  }

  const updatedDebt = {
    ...debts[debtIndex],
    ...updates,
    updatedAt: new Date().toISOString()
  };

  debts[debtIndex] = updatedDebt;
  saveToLocalStorage(userDebtsKey, debts);

  // Log activity
  logUserActivity(userId, 'DEBT_UPDATED', {
    debtId,
    updates: Object.keys(updates).join(', ')
  });

  // Trigger Android Capture
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

  // Log activity
  logUserActivity(userId, 'DEBT_DELETED', { debtId });

  // Trigger Android Capture
  triggerAndroidCapture('DEBT_DELETED', {
    userId,
    debtId
  });
};

/**
 * ============================================
 * ACTIVITY LOGGING
 * ============================================
 */

/**
 * Log user activity
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
  // Keep last 100 activities
  saveToLocalStorage(userActivitiesKey, activities.slice(0, 100));

  return newActivity;
};

/**
 * Get user activities
 */
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

/**
 * Get admin statistics
 */
export const getAdminStats = () => {
  const users = loadFromLocalStorage('registeredUsers', []);

  let totalDebts = 0;
  let totalOwed = 0;
  let totalIgnoring = 0;

  users.forEach(user => {
    const userDebts = fetchDebts(user.id);
    totalDebts += userDebts.length;
    userDebts.forEach(debt => {
      if (debt.status !== 'paid') {
        if (debt.type === 'owed_to_me') {
          totalOwed += debt.amount;
        } else {
          totalIgnoring += debt.amount;
        }
      }
    });
  });

  return {
    totalUsers: users.length,
    activeUsers: users.filter(u => u.active).length,
    totalDebts,
    totalOwed,
    totalOwing: totalIgnoring
  };
};

/**
 * Get all users (admin only)
 */
export const getAllUsers = () => {
  const users = loadFromLocalStorage('registeredUsers', []);
  return users.map(u => {
    const { password: _, ...userWithoutPassword } = u;
    return userWithoutPassword;
  });
};

/**
 * Toggle user status (admin only)
 */
export const toggleUserStatus = (userId, active) => {
  const users = loadFromLocalStorage('registeredUsers', []);
  const updatedUsers = users.map(u =>
    u.id === userId ? { ...u, active } : u
  );
  saveToLocalStorage('registeredUsers', updatedUsers);

  triggerAndroidCapture('USER_STATUS_CHANGED', { userId, active });
};

/**
 * Delete user (admin only)
 */
export const deleteUser = (userId) => {
  const users = loadFromLocalStorage('registeredUsers', []);
  const filtered = users.filter(u => u.id !== userId);
  saveToLocalStorage('registeredUsers', filtered);

  // Also delete user's data
  localStorage.removeItem(`user_${userId}_debts`);
  localStorage.removeItem(`user_${userId}_activities`);

  triggerAndroidCapture('USER_DELETED', { userId });
};

/**
 * ============================================
 * STATISTICS CALCULATION
 * ============================================
 */

/**
 * Calculate user statistics
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

  return {
    totalOwedToMe,
    totalIOwe,
    paidDebtsCount: paidDebts,
    pendingDebtsCount: pendingDebts,
    overdueDebts,
    paidRatio,
    totalDebts: debts.length
  };
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
  calculateStatistics
};

export default neonService;
