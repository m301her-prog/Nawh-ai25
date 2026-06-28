import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { translations } from '../i18n/translations.jsx';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

const AppContext = createContext(null);

export function AppProvider({ children }) {
  // Auth state
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // UI state
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : false;
  });
  const [language, setLanguage] = useState(() => {
    const saved = localStorage.getItem('language');
    return saved || 'dz';
  });
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);

  // Settings
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    const saved = localStorage.getItem('notificationsEnabled');
    return saved ? JSON.parse(saved) : true;
  });
  const [whatsappEnabled, setWhatsappEnabled] = useState(() => {
    const saved = localStorage.getItem('whatsappEnabled');
    return saved ? JSON.parse(saved) : true;
  });

  // Data state
  const [debts, setDebts] = useState(() => {
    const saved = localStorage.getItem('debts');
    return saved ? JSON.parse(saved) : [];
  });
  const [users, setUsers] = useState(() => {
    const saved = localStorage.getItem('users');
    return saved ? JSON.parse(saved) : [];
  });

  // Translation helper
  const t = useCallback((key) => {
    return translations[language]?.[key] || key;
  }, [language]);

  // Android capture event trigger
  const triggerCaptureEvent = useCallback((eventType, data) => {
    // This triggers Android WebView capture
    if (window.AndroidCapture) {
      window.AndroidCapture.onEvent(eventType, JSON.stringify(data));
    }
    // Dispatch custom event for any listeners
    window.dispatchEvent(new CustomEvent('appCapture', {
      detail: { type: eventType, data, timestamp: new Date().toISOString() }
    }));
    // Store in local capture log
    const captureLog = JSON.parse(localStorage.getItem('captureLog') || '[]');
    captureLog.push({ type: eventType, data, timestamp: new Date().toISOString() });
    localStorage.setItem('captureLog', JSON.stringify(captureLog.slice(-100)));
  }, []);

  // Persistence effect
  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  useEffect(() => {
    localStorage.setItem('language', language);
    document.documentElement.lang = language === 'dz' || language === 'ar' ? 'ar' : language;
    document.documentElement.dir = language === 'dz' || language === 'ar' ? 'rtl' : 'ltr';
  }, [language]);

  useEffect(() => {
    localStorage.setItem('debts', JSON.stringify(debts));
    localStorage.setItem('users', JSON.stringify(users));
  }, [debts, users]);

  useEffect(() => {
    localStorage.setItem('notificationsEnabled', JSON.stringify(notificationsEnabled));
  }, [notificationsEnabled]);

  useEffect(() => {
    localStorage.setItem('whatsappEnabled', JSON.stringify(whatsappEnabled));
  }, [whatsappEnabled]);

  // Auth functions
  const login = async (email, password) => {
    setLoading(true);
    try {
      if (supabase) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setUser(data.user);
        setIsAuthenticated(true);
        setIsAdmin(email === 'admin@debts.dz');
      } else {
        // Fallback for demo/local mode
        const storedUsers = JSON.parse(localStorage.getItem('registeredUsers') || '[]');
        const foundUser = storedUsers.find(u => u.email === email && u.password === password);
        if (foundUser) {
          setUser(foundUser);
          setIsAuthenticated(true);
          setIsAdmin(email === 'admin@debts.dz');
        } else {
          throw new Error('Invalid credentials');
        }
      }
      showNotification(t('loginSuccess'), 'success');
      triggerCaptureEvent('USER_LOGIN', { email });
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
      if (supabase) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name, phone } }
        });
        if (error) throw error;
        setUser(data.user);
        setIsAuthenticated(true);
      } else {
        const storedUsers = JSON.parse(localStorage.getItem('registeredUsers') || '[]');
        if (storedUsers.find(u => u.email === email)) {
          throw new Error('Email already registered');
        }
        const newUser = {
          id: Date.now().toString(),
          name,
          email,
          password,
          phone,
          createdAt: new Date().toISOString(),
          active: true
        };
        storedUsers.push(newUser);
        localStorage.setItem('registeredUsers', JSON.stringify(storedUsers));
        setUser(newUser);
        setIsAuthenticated(true);
      }
      showNotification(t('registerSuccess'), 'success');
      triggerCaptureEvent('USER_REGISTER', { email, name });
    } catch (error) {
      showNotification(error.message, 'error');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    setUser(null);
    setIsAuthenticated(false);
    setIsAdmin(false);
    showNotification(t('logoutSuccess'), 'success');
    triggerCaptureEvent('USER_LOGOUT', {});
  };

  // Debt functions
  const addDebt = async (debtData) => {
    setLoading(true);
    try {
      const newDebt = {
        id: Date.now().toString(),
        ...debtData,
        status: 'pending',
        createdAt: new Date().toISOString(),
        paidAmount: 0,
        userId: user?.id
      };

      if (supabase) {
        const { data, error } = await supabase
          .from('debts')
          .insert([newDebt])
          .select();
        if (error) throw error;
        setDebts(prev => [...prev, data[0]]);
      } else {
        setDebts(prev => [...prev, newDebt]);
      }
      showNotification(t('debtAdded'), 'success');
      triggerCaptureEvent('DEBT_ADDED', newDebt);
      return newDebt;
    } catch (error) {
      showNotification(error.message, 'error');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const updateDebt = async (id, updates) => {
    setLoading(true);
    try {
      if (supabase) {
        const { data, error } = await supabase
          .from('debts')
          .update(updates)
          .eq('id', id)
          .select();
        if (error) throw error;
        setDebts(prev => prev.map(d => d.id === id ? data[0] : d));
      } else {
        setDebts(prev => prev.map(d => d.id === id ? { ...d, ...updates } : d));
      }
      showNotification(t('debtUpdated'), 'success');
      triggerCaptureEvent('DEBT_UPDATED', { id, updates });
    } catch (error) {
      showNotification(error.message, 'error');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const deleteDebt = async (id) => {
    setLoading(true);
    try {
      if (supabase) {
        const { error } = await supabase.from('debts').delete().eq('id', id);
        if (error) throw error;
      }
      setDebts(prev => prev.filter(d => d.id !== id));
      showNotification(t('debtDeleted'), 'success');
      triggerCaptureEvent('DEBT_DELETED', { id });
    } catch (error) {
      showNotification(error.message, 'error');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Admin functions
  const fetchUsers = async () => {
    if (!supabase) {
      const storedUsers = JSON.parse(localStorage.getItem('registeredUsers') || '[]');
      setUsers(storedUsers.map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        createdAt: u.createdAt,
        active: u.active ?? true
      })));
      return;
    }
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, email, phone, created_at, active');
      if (error) throw error;
      setUsers(data);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const toggleUserStatus = async (userId, active) => {
    if (supabase) {
      const { error } = await supabase
        .from('profiles')
        .update({ active })
        .eq('id', userId);
      if (error) throw error;
    }
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, active } : u));
    triggerCaptureEvent('USER_STATUS_CHANGED', { userId, active });
  };

  const deleteUser = async (userId) => {
    if (supabase) {
      const { error } = await supabase.from('profiles').delete().eq('id', userId);
      if (error) throw error;
    }
    setUsers(prev => prev.filter(u => u.id !== userId));
    triggerCaptureEvent('USER_DELETED', { userId });
  };

  // Notification helper
  const showNotification = (message, type = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // Calculate statistics
  const statistics = {
    totalOwedToMe: debts
      .filter(d => d.type === 'owed_to_me' && d.status !== 'paid')
      .reduce((sum, d) => sum + d.amount, 0),
    totalIOwe: debts
      .filter(d => d.type === 'i_owe' && d.status !== 'paid')
      .reduce((sum, d) => sum + d.amount, 0),
    paidDebtsCount: debts.filter(d => d.status === 'paid').length,
    pendingDebtsCount: debts.filter(d => d.status === 'pending').length,
    overdueDebts: debts.filter(d => {
      if (d.status === 'paid') return false;
      const dueDate = new Date(d.dueDate);
      return dueDate < new Date();
    }),
    paidRatio: debts.length > 0
      ? Math.round((debts.filter(d => d.status === 'paid').length / debts.length) * 100)
      : 0
  };

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
    triggerCaptureEvent('WHATSAPP_OPENED', { phone, message });
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
    addDebt,
    updateDebt,
    deleteDebt,
    fetchUsers,
    toggleUserStatus,
    deleteUser,
    statistics,

    // WhatsApp
    openWhatsApp,

    // Android capture
    triggerCaptureEvent
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

export { supabase };
