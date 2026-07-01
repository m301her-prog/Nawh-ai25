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

  // Data state
  const [debts, setDebts] = useState([]);
  const [users, setUsers] = useState([]);

  // دالة جلب البيانات السحابية مع كاشف أخطاء مدمج
  const syncDebtsFromServer = useCallback(async (userId) => {
    if (!userId) return;
    console.log("🔄 جاري محاولة جلب البيانات للسيد:", userId);
    try {
      const response = await fetch(`https://nawh-ai25.vercel.app/get?userId=${userId}`);
      console.log("📡 استجابة جلب البيانات من السيرفر:", response.status);
      if (response.ok) {
        const data = await response.json();
        if (data && data.debts) {
          setDebts(data.debts);
          saveToLocalStorage(`user_${userId}_debts`, data.debts);
          return;
        }
      }
    } catch (err) {
      console.error("❌ خطأ صريح في دالة get السحابية:", err);
    }
    // احتياطي محلي
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

  const register = async (name, email, password, phone) => {
    setLoading(true);
    try {
      const response = await fetch('https://nawh-ai25.vercel.app/api/register-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, email, password, phone }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'فشلت عملية إنشاء الحساب عبر الـ API');
      }

      const targetUserId = data.userId || data.id || (data.rows && data.rows[0]?.id) || 'usr_' + Date.now().toString(36);

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

  // كاشف الإضافة الصارم
  const handleAddDebt = async (debtData) => {
    setLoading(true);
    console.log("🚀 بدء عملية إضافة دين جديدة سحابياً ومحلياً...");
    try {
      const newDebt = await addDebt(user.id, debtData);
      
      console.log("📡 جاري ضرب رابط الحفظ السحابي /save...");
      const cloudResponse = await fetch('https://nawh-ai25.vercel.app/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, action: 'ADD', debt: newDebt }),
      });

      console.log("📡 نتيجة استجابة رابط الحفظ:", cloudResponse.status);
      
      if (!cloudResponse.ok) {
        const errData = await cloudResponse.json().catch(() => ({}));
        throw new Error(errData.error || `خطأ سيرفر بكود: ${cloudResponse.status}`);
      }

      setDebts(prev => [newDebt, ...prev]);
      showNotification(t('debtAdded'), 'success');
      return newDebt;
    } catch (error) {
      console.error("❌ انهيار كامل في كود الإضافة:", error);
      showNotification("فشل السيرفر: " + error.message, 'error');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // كاشف التحديث الصارم
  const handleUpdateDebt = async (id, updates) => {
    setLoading(true);
    console.log("🚀 بدء تحديث دين برقم:", id);
    try {
      console.log("📡 جاري إرسال التحديث للسيرفر السحابي...");
      const cloudResponse = await fetch('https://nawh-ai25.vercel.app/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, action: 'UPDATE', debtId: id, updates }),
      });

      console.log("📡 نتيجة استجابة رابط التحديث:", cloudResponse.status);

      if (!cloudResponse.ok) {
        const errData = await cloudResponse.json().catch(() => ({}));
        throw new Error(errData.error || `خطأ سيرفر بكود: ${cloudResponse.status}`);
      }

      const updatedDebt = await updateDebtStatus(user.id, id, updates);
      setDebts(prev => prev.map(d => d.id === id ? updatedDebt : d));
      showNotification(t('debtUpdated'), 'success');
    } catch (error) {
      console.error("❌ انهيار كامل في كود التحديث:", error);
      showNotification("فشل تحديث السيرفر: " + error.message, 'error');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // كاشف الحذف الصارم
  const handleDeleteDebt = async (id) => {
    setLoading(true);
    console.log("🚀 بدء حذف دين برقم:", id);
    try {
      console.log("📡 جاري إرسال طلب الحذف للسيرفر السحابي...");
      const cloudResponse = await fetch('https://nawh-ai25.vercel.app/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, action: 'DELETE', debtId: id }),
      });

      console.log("📡 نتيجة استجابة رابط الحذف:", cloudResponse.status);

      if (!cloudResponse.ok) {
        const errData = await cloudResponse.json().catch(() => ({}));
        throw new Error(errData.error || `خطأ سيرفر بكود: ${cloudResponse.status}`);
      }

      await deleteDebt(user.id, id);
      setDebts(prev => prev.filter(d => d.id !== id));
      showNotification(t('debtDeleted'), 'success');
    } catch (error) {
      console.error("❌ انهيار كامل في كود الحذف:", error);
      showNotification("فشل حذف السيرفر: " + error.message, 'error');
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
    user,
    isAuthenticated,
    isAdmin,
    login,
    register,
    logout,
    darkMode,
    setDarkMode,
    language,
    setLanguage,
    loading,
    notification,
    showNotification,
    t,
    notificationsEnabled,
    setNotificationsEnabled,
    whatsappEnabled,
    setWhatsappEnabled,
    requestNotificationPermission,
    sendNotification,
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
    openWhatsApp,
    triggerAndroidCapture,
    downloadReport,
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
