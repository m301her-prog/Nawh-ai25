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

  // Load debts when user changes
  useEffect(() => {
    if (user && user.id) {
      const userDebts = fetchDebts(user.id);
      setDebts(userDebts);
    } else {
      setDebts([]);
    }
  }, [user]);

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
      const authenticatedUser = await authUser(email, password);
      setUser(authenticatedUser);
      setIsAuthenticated(true);
      setIsAdmin(authenticatedUser.isAdmin || email === 'admin@debts.dz');
      saveToLocalStorage('currentUser', authenticatedUser);
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
      // الخطوة 1: حفظ الحساب أولاً في جدول نيون الموحد عبر رابط الـ API الخاص بك
      const response = await fetch('https://nawh-ai25.vercel.app/api/register-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, email, password, phone }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'فشلت عملية إنشاء الحساب عبر الـ API');
      }

      // الخطوة 2: بعد نجاح الـ API، نمرر المعرف الراجع لخدمة السيرفر لتهيئة جداول تخزين التطبيق
      const newUser = await registerUserAndCreateTables(name, email, password, phone, data.userId);
      
      setUser(newUser);
      setIsAuthenticated(true);
      setIsAdmin(newUser.isAdmin || false);
      saveToLocalStorage('currentUser', newUser);
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
      await logoutUser(user.id);
    }
    setUser(null);
    setIsAuthenticated(false);
    setIsAdmin(false);
    setDebts([]);
    saveToLocalStorage('currentUser', null);
    showNotification(t('logoutSuccess'), 'success');
  };

  // Debt functions using neon service
  const handleAddDebt = async (debtData) => {
    setLoading(true);
    try {
      const newDebt = await addDebt(user.id, debtData);
      setDebts(prev => [newDebt, ...prev]);
      showNotification(t('debtAdded'), 'success');
      return newDebt;
    } catch (error) {
      showNotification(error.message, 'error');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateDebt = async (id, updates) => {
    setLoading(true);
    try {
      const updatedDebt = await updateDebtStatus(user.id, id, updates);
      setDebts(prev => prev.map(d => d.id === id ? updatedDebt : d));
      showNotification(t('debtUpdated'), 'success');
    } catch (error) {
      showNotification(error.message, 'error');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDebt = async (id) => {
    setLoading(true);
    try {
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
      const userDebts = fetchDebts(user.id);
      setDebts(userDebts);
    }
  }, [user]);

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
