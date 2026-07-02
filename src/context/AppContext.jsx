import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import neonService, {
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
  getAdminStats,
  getAllUsers,
  toggleUserStatus,
  deleteUser,
  calculateStatistics,
  downloadReport,
  isNeonConfigured
} from '../services/neonService.js';
import { translations } from '../i18n/translations.jsx';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  // Auth state
  const [user, setUser] = useState(() => {
    const saved = loadFromLocalStorage('currentUser', null);
    return saved;
  });
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    const saved = loadFromLocalStorage('currentUser', null);
    return !!saved;
  });
  const [isAdmin, setIsAdmin] = useState(() => {
    const saved = loadFromLocalStorage('currentUser', null);
    return saved?.isAdmin || saved?.email === 'admin@debts.dz';
  });

  // UI state
  const [darkMode, setDarkMode] = useState(() => {
    return loadFromLocalStorage('darkMode', false);
  });
  const [language, setLanguage] = useState(() => {
    return loadFromLocalStorage('language', 'ar');
  });
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);

  // Settings
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    return loadFromLocalStorage('notificationsEnabled', true);
  });
  const [whatsappEnabled, setWhatsappEnabled] = useState(() => {
    return loadFromLocalStorage('whatsappEnabled', true);
  });

  // Data state - will be loaded from user-specific storage
  const [debts, setDebts] = useState([]);
  const [users, setUsers] = useState([]);

  // دالة موحدة سحابية لجلب البيانات فوراً (تم تعديل المسار لـ /api/get)
  const syncDebtsFromServer = useCallback(async (userId) => {
    if (!userId) return;
    try {
      const response = await fetch(`https://nawh-ai25.vercel.app/api/get?userId=${userId}`);
      if (response.ok) {
        const data = await response.json();
        const serverDebts = data.debts || data.rows || [];
        
        // معالجة البيانات القادمة من الباك إند لتوحيد مسميات الحقول
        const normalizedDebts = serverDebts.map(d => ({
          ...d,
          personName: d.personName || d.person_name || d.name || '',
          person_name: d.personName || d.person_name || d.name || '',
          dueDate: d.dueDate || d.due_date || d.date || '',
          due_date: d.dueDate || d.due_date || d.date || '',
          isScheduled: d.isScheduled !== undefined ? d.isScheduled : d.is_scheduled,
          is_scheduled: d.isScheduled !== undefined ? d.isScheduled : d.is_scheduled,
          scheduleType: d.scheduleType || d.schedule_type || null,
          schedule_type: d.scheduleType || d.schedule_type || null,
          installmentsCount: d.installmentsCount !== undefined ? d.installmentsCount : d.installments_count,
          installments_count: d.installmentsCount !== undefined ? d.installmentsCount : d.installments_count,
          firstPaymentDate: d.firstPaymentDate || d.first_payment_date || null,
          first_payment_date: d.firstPaymentDate || d.first_payment_date || null,
        }));

        setDebts(normalizedDebts);
        saveToLocalStorage(`user_${userId}_debts`, normalizedDebts);
        return;
      }
    } catch (err) {
      console.error("خطأ أثناء جلب الديون من السيرفر السحابي:", err);
    }
    const userDebts = fetchDebts(userId);
    setDebts(userDebts);
  }, []);

  // Load debts when user changes
  useEffect(() => {
    if (user && user.id) {
      syncDebtsFromServer(user.id);
    } else {
      setDebts([]);
    }
  }, [user, syncDebtsFromServer]);

  // Translation helper
  const t = useCallback((key) => {
    return translations[language]?.[key] || key;
  }, [language]);

  // Persistence effects
  useEffect(() => {
    saveToLocalStorage('darkMode', darkMode);
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  useEffect(() => {
    saveToLocalStorage('language', language);
    document.documentElement.lang = language === 'ar' ? 'ar' : language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
  }, [language]);

  useEffect(() => {
    saveToLocalStorage('notificationsEnabled', notificationsEnabled);
  }, [notificationsEnabled]);

  useEffect(() => {
    saveToLocalStorage('whatsappEnabled', whatsappEnabled);
  }, [whatsappEnabled]);

  // Auth functions
  const login = async (email, password) => {
    setLoading(true);
    try {
      const response = await fetch('https://nawh-ai25.vercel.app/api/login-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'فشلت عملية تسجيل الدخول عبر الـ API');
      }

      const serverUser = data.user;

      if (serverUser.active === false || serverUser.active === 'false') {
        throw new Error(language === 'ar' ? 'تم غلق هذا الحساب مؤقتاً، يرجى التواصل مع الإدارة' : 'Account suspended');
      }

      const authenticatedUser = {
        id: serverUser.id,
        name: serverUser.name,
        email: serverUser.email,
        phone: serverUser.phone || '',
        isAdmin: serverUser.isAdmin,
        createdAt: new Date().toISOString()
      };

      const localUsers = loadFromLocalStorage('registeredUsers', []);
      const existingUserIndex = localUsers.findIndex(u => u.email.toLowerCase() === email.toLowerCase().trim());
      
      if (existingUserIndex === -1) {
        localUsers.push({ ...authenticatedUser, password: password });
      } else {
        localUsers[existingUserIndex] = { ...localUsers[existingUserIndex], ...authenticatedUser, password: password };
      }
      saveToLocalStorage('registeredUsers', localUsers);

      saveToLocalStorage(`user_${authenticatedUser.id}_debts`, loadFromLocalStorage(`user_${authenticatedUser.id}_debts`, []));
      saveToLocalStorage(`user_${authenticatedUser.id}_activities`, loadFromLocalStorage(`user_${authenticatedUser.id}_activities`, []));

      setUser(authenticatedUser);
      setIsAuthenticated(true);
      setIsAdmin(authenticatedUser.isAdmin || email === 'admin@debts.dz');
      saveToLocalStorage('currentUser', authenticatedUser);

      triggerAndroidCapture('USER_LOGGED_IN', { userId: authenticatedUser.id, email: authenticatedUser.email });

      showNotification(t('loginSuccess'), 'success');
    } catch (error) {
      showNotification(error.message, 'error');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const register = async (name, email, password, phone, companyName) => {
    setLoading(true);
    try {
      const response = await fetch('https://nawh-ai25.vercel.app/api/register-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, email, password, phone, companyName }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'فشلت عملية إنشاء الحساب عبر الـ API');
      }

      const targetUserId = data.userId || data.id || (data.rows && data.rows[0]?.id) || 'usr_' + Date.now().toString(36);

      // هنا دالة السكيمّا: تم تغيير البناء ليعتمد على اسم الشركة القادم من الواجهة بشكل آمن ونظيف
      const cleanCompanyName = (companyName || 'company').replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
      const schemaName = `schema_${cleanCompanyName}`;

      // استدعاء رابط تهيئة وإنشاء السكيمّا مع تمرير المتغيرات بالشكل الصحيح للـ Proxy
      try {
        await fetch('https://nawh-ai25.vercel.app/api/query', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            schemaName: schemaName, // تمرير اسم السكيمّا هنا ليفهمه متغير schemaName بالباك اند
            query: `CREATE TABLE IF NOT EXISTS debts (
              id VARCHAR(50) PRIMARY KEY,
              name VARCHAR(100) NOT NULL,
              amount NUMERIC NOT NULL,
              type VARCHAR(10) NOT NULL,
              date VARCHAR(50) NOT NULL,
              details TEXT,
              status VARCHAR(20) DEFAULT 'pending'
            );` // استعلام آمن لإنشاء جدول الديون مباشرة داخل سكيمّا الشركة الجديدة
          }),
        });
      } catch (schemaErr) {
        console.error("فشل إنشاء السكيمّا السحابية تلقائياً:", schemaErr);
      }

      const newUser = await registerUserAndCreateTables(name, email, password, phone, targetUserId);
      
      setUser(newUser);
      setIsAuthenticated(true);
      setIsAdmin(newUser.isAdmin || false);
      saveToLocalStorage('currentUser', newUser);

      triggerAndroidCapture('USER_REGISTERED', { userId: newUser.id, email: newUser.email });

      showNotification(t('registerSuccess'), 'success');
    } catch (error) {
      showNotification(error.message, 'error');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    if (user) {
      triggerAndroidCapture('USER_LOGGED_OUT', { userId: user.id });
      await logoutUser(user.id);
    }
    setUser(null);
    setIsAuthenticated(false);
    setIsAdmin(false);
    setDebts([]);
    saveToLocalStorage('currentUser', null);
    showNotification(t('logoutSuccess'), 'success');
  };

  // تعديل الإضافة: تم ضبط المسار لـ /api/save مع حماية البيانات محلياً وسحابياً بالتزامن
  const handleAddDebt = async (debtData) => {
    setLoading(true);
    try {
      const newDebt = await addDebt(user.id, debtData);
      
      // تنظيم الكائن لضمان إرسال الحقول بالصيغتين المتوقعتين للباك إند
      const payloadDebt = {
        ...newDebt,
        person_name: newDebt.personName || newDebt.person_name,
        due_date: newDebt.dueDate || newDebt.due_date,
        is_scheduled: newDebt.isScheduled !== undefined ? newDebt.isScheduled : newDebt.is_scheduled,
        schedule_type: newDebt.scheduleType || newDebt.schedule_type,
        installments_count: newDebt.installmentsCount !== undefined ? newDebt.installmentsCount : newDebt.installments_count,
        first_payment_date: newDebt.firstPaymentDate || newDebt.first_payment_date
      };

      // إجبار إرسال الـ Fetch والانتظار الصارم قبل تفعيل التحديث المحلي
      await fetch('https://nawh-ai25.vercel.app/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, action: 'ADD', debt: payloadDebt }),
      });

      setDebts(prev => [payloadDebt, ...prev]);
      showNotification(t('debtAdded'), 'success');
      return payloadDebt;
    } catch (error) {
      showNotification(error.message, 'error');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // تعديل التحديث: تم ضبط المسار لـ /api/save مع دمج الحقول المزدوجة
  const handleUpdateDebt = async (id, updates) => {
    setLoading(true);
    try {
      // إعداد حقول التحديث لتتوافق مع الباك إند
      const formattedUpdates = {
        ...updates,
        person_name: updates.personName || updates.person_name,
        due_date: updates.dueDate || updates.due_date,
        is_scheduled: updates.isScheduled !== undefined ? updates.isScheduled : updates.is_scheduled,
        schedule_type: updates.scheduleType || updates.schedule_type,
        installments_count: updates.installmentsCount !== undefined ? updates.installmentsCount : updates.installments_count,
        first_payment_date: updates.firstPaymentDate || updates.first_payment_date
      };

      // تنفيذ الـ Fetch أولاً لضمان تحرك الرابط السحابي
      await fetch('https://nawh-ai25.vercel.app/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, action: 'UPDATE', debtId: id, updates: formattedUpdates }),
      });

      const updatedDebt = await updateDebtStatus(user.id, id, updates);
      
      // دمج الحقول محلياً لتحديث الـ state بشكل نظيف
      const normalizedUpdatedDebt = {
        ...updatedDebt,
        ...formattedUpdates
      };

      setDebts(prev => prev.map(d => d.id === id ? normalizedUpdatedDebt : d));
      showNotification(t('debtUpdated'), 'success');
    } catch (error) {
      showNotification(error.message, 'error');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // تعديل الحذف: تم ضبط المسار لـ /api/save
  const handleDeleteDebt = async (id) => {
    setLoading(true);
    try {
      // إرسال طلب الحذف السحابي أولاً والانتظار
      await fetch('https://nawh-ai25.vercel.app/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, action: 'DELETE', debtId: id }),
      });

      await deleteDebt(user.id, id);
      setDebts(prev => prev.filter(d => d.id !== id));
      showNotification(t('debtDeleted'), 'success');
    } catch (error) {
      showNotification(error.message, 'error');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Admin functions
  const handleFetchUsers = async () => {
    const allUsers = getAllUsers();
    setUsers(allUsers);
  };

  const handleToggleUserStatus = async (userId, active) => {
    toggleUserStatus(userId, active);
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, active } : u));
    triggerAndroidCapture('USER_STATUS_CHANGED', { userId, active });
  };

  const handleDeleteUser = async (userId) => {
    deleteUser(userId);
    setUsers(prev => prev.filter(u => u.id !== userId));
  };

  // Notification helper
  const showNotification = (message, type = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // Calculate statistics
  const statistics = user ? calculateStatistics(user.id) : {
    totalOwedToMe: 0,
    totalIOwe: 0,
    paidDebtsCount: 0,
    pendingDebtsCount: 0,
    overdueDebts: [],
    paidRatio: 0
  };

  // Refresh debts
  const refreshDebts = useCallback(() => {
    if (user && user.id) {
      syncDebtsFromServer(user.id);
    }
  }, [user, syncDebtsFromServer]);

  // Request notification permission
  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return false;
  };

  // Send local notification
  const sendNotification = (title, body) => {
    if (notificationsEnabled && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/vite.svg' });
    }
  };

  // WhatsApp helper
  const openWhatsApp = (phone, message) => {
    const cleanPhone = phone.replace(/\D/g, '');
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
    triggerAndroidCapture('WHATSAPP_OPENED', { phone, message });
  };

  const value = {
    // Auth
    user,
    isAuthenticated,
    isAdmin,
    login,
    register,
    logout,

    // UI
    darkMode,
    setDarkMode,
    language,
    setLanguage,
    loading,
    notification,
    showNotification,
    t,

    // Settings
    notificationsEnabled,
    setNotificationsEnabled,
    whatsappEnabled,
    setWhatsappEnabled,
    requestNotificationPermission,
    sendNotification,

    // Data
    debts,
    users,
    addDebt: handleAddDebt,
    updateDebt: handleUpdateDebt,
    deleteDebt: handleDeleteDebt,
    fetchUsers: handleFetchUsers,
    toggleUserStatus: handleToggleUserStatus,
    deleteUser: handleDeleteUser,
    statistics,
    refreshDebts,

    // WhatsApp
    openWhatsApp,

    // Android capture
    triggerAndroidCapture,

    // Reports
    downloadReport,

    // Neon service status
    isNeonConfigured: isNeonConfigured()
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}

export default AppContext;
