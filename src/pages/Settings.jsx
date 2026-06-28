import { useApp } from '../context/AppContext.jsx';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Sun,
  Moon,
  Globe,
  Bell,
  MessageCircle,
  LogOut,
  ChevronRight,
  Smartphone,
  Trash,
  User
} from 'lucide-react';

export default function Settings() {
  const {
    t,
    user,
    darkMode,
    setDarkMode,
    language,
    setLanguage,
    notificationsEnabled,
    setNotificationsEnabled,
    whatsappEnabled,
    setWhatsappEnabled,
    logout,
    requestNotificationPermission,
    showNotification
  } = useApp();
  const navigate = useNavigate();

  const handleNotificationToggle = async () => {
    if (!notificationsEnabled) {
      const granted = await requestNotificationPermission();
      if (granted) {
        setNotificationsEnabled(true);
        showNotification(t('enableNotifications'), 'success');
      } else {
        showNotification('Permission denied', 'error');
      }
    } else {
      setNotificationsEnabled(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const languages = [
    { code: 'dz', name: t('algerian'), flag: '🇩🇿' },
    { code: 'fr', name: t('french'), flag: '🇫🇷' },
    { code: 'en', name: t('english'), flag: '🇬🇧' }
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-8">
      {/* Header */}
      <header className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white p-4 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="p-2 rounded-lg hover:bg-white/20 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold">{t('settings')}</h1>
        </div>
      </header>

      <div className="p-4 space-y-4">
        {/* Profile Section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-xl font-bold">
              {(user?.name || user?.email?.[0] || 'U').toUpperCase()}
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-gray-900 dark:text-white text-lg">
                {user?.name || 'User'}
              </h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                {user?.email}
              </p>
            </div>
            <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700">
              <User className="w-5 h-5 text-gray-500" />
            </div>
          </div>
        </div>

        {/* Appearance */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm divide-y divide-gray-100 dark:divide-gray-700">
          <div className="px-4 py-3">
            <h3 className="font-medium text-gray-500 dark:text-gray-400 text-sm">
              {t('appearance')}
            </h3>
          </div>

          {/* Dark Mode Toggle */}
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="w-full px-4 py-4 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition"
          >
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              darkMode ? 'bg-gray-700' : 'bg-yellow-100'
            }`}>
              {darkMode ? (
                <Moon className="w-5 h-5 text-yellow-400" />
              ) : (
                <Sun className="w-5 h-5 text-yellow-600" />
              )}
            </div>
            <div className="flex-1 text-start">
              <p className="font-medium text-gray-900 dark:text-white">
                {darkMode ? t('darkMode') : t('lightMode')}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {darkMode ? t('lightMode') : t('darkMode')}
              </p>
            </div>
            <div className={`w-12 h-7 rounded-full transition-colors ${
              darkMode ? 'bg-emerald-500' : 'bg-gray-300'
            } relative`}>
              <div className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                darkMode ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </div>
          </button>
        </div>

        {/* Language */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm divide-y divide-gray-100 dark:divide-gray-700">
          <div className="px-4 py-3">
            <h3 className="font-medium text-gray-500 dark:text-gray-400 text-sm">
              {t('language')}
            </h3>
          </div>

          {languages.map(lang => (
            <button
              key={lang.code}
              onClick={() => setLanguage(lang.code)}
              className="w-full px-4 py-4 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition"
            >
              <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-xl">
                {lang.flag}
              </div>
              <div className="flex-1 text-start">
                <p className="font-medium text-gray-900 dark:text-white">
                  {lang.name}
                </p>
              </div>
              {language === lang.code && (
                <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Notifications */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm divide-y divide-gray-100 dark:divide-gray-700">
          <div className="px-4 py-3">
            <h3 className="font-medium text-gray-500 dark:text-gray-400 text-sm">
              {t('notifications')}
            </h3>
          </div>

          {/* Push Notifications */}
          <button
            onClick={handleNotificationToggle}
            className="w-full px-4 py-4 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition"
          >
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              notificationsEnabled ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-gray-100 dark:bg-gray-700'
            }`}>
              <Bell className={`w-5 h-5 ${
                notificationsEnabled ? 'text-emerald-500' : 'text-gray-400'
              }`} />
            </div>
            <div className="flex-1 text-start">
              <p className="font-medium text-gray-900 dark:text-white">
                {t('enableNotifications')}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {notificationsEnabled ? 'Enabled' : 'Disabled'}
              </p>
            </div>
            <div className={`w-12 h-7 rounded-full transition-colors ${
              notificationsEnabled ? 'bg-emerald-500' : 'bg-gray-300'
            } relative`}>
              <div className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                notificationsEnabled ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </div>
          </button>

          {/* WhatsApp Reminder */}
          <button
            onClick={() => setWhatsappEnabled(!whatsappEnabled)}
            className="w-full px-4 py-4 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition"
          >
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              whatsappEnabled ? 'bg-green-100 dark:bg-green-900/30' : 'bg-gray-100 dark:bg-gray-700'
            }`}>
              <MessageCircle className={`w-5 h-5 ${
                whatsappEnabled ? 'text-green-500' : 'text-gray-400'
              }`} />
            </div>
            <div className="flex-1 text-start">
              <p className="font-medium text-gray-900 dark:text-white">
                {t('enableWhatsapp')}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {whatsappEnabled ? 'Enabled' : 'Disabled'}
              </p>
            </div>
            <div className={`w-12 h-7 rounded-full transition-colors ${
              whatsappEnabled ? 'bg-emerald-500' : 'bg-gray-300'
            } relative`}>
              <div className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                whatsappEnabled ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </div>
          </button>
        </div>

        {/* Account */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm divide-y divide-gray-100 dark:divide-gray-700">
          <div className="px-4 py-3">
            <h3 className="font-medium text-gray-500 dark:text-gray-400 text-sm">
              {t('name')}
            </h3>
          </div>

          {/* App Info */}
          <div className="px-4 py-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Smartphone className="w-5 h-5 text-blue-500" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-gray-900 dark:text-white">Debts Manager</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">v1.0.0</p>
            </div>
          </div>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="w-full px-4 py-4 flex items-center gap-4 hover:bg-red-50 dark:hover:bg-red-900/20 transition text-red-500"
          >
            <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <LogOut className="w-5 h-5" />
            </div>
            <div className="flex-1 text-start">
              <p className="font-medium">
                {t('logout')}
              </p>
            </div>
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Clear Data */}
        <button
          onClick={() => {
            if (window.confirm(t('confirmDelete'))) {
              localStorage.clear();
              window.location.reload();
            }
          }}
          className="w-full py-4 rounded-xl border-2 border-red-500 text-red-500 font-medium hover:bg-red-50 dark:hover:bg-red-900/20 transition flex items-center justify-center gap-2"
        >
          <Trash className="w-5 h-5" />
          Clear All Data
        </button>
      </div>
    </div>
  );
}
