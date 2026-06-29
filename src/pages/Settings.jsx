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
  User,
  Shield,
  Info,
  HelpCircle
} from 'lucide-react';

/**
 * Settings Page
 * Dark mode, language switching, notifications control, account settings
 */
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
        showNotification(language === 'ar' ? 'ما قدرناش نفعّلو الإشعارات' :
                        language === 'fr' ? 'Autorisation refusée' : 'Permission denied', 'error');
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
    { code: 'ar', name: language === 'ar' ? 'العربية' : 'Arabic', flag: '🇸🇦', subtitle: language === 'ar' ? 'مرحباً بك!' : 'Marhaba!' },
    { code: 'fr', name: t('french'), flag: '🇫🇷', subtitle: 'Bonjour!' },
    { code: 'en', name: t('english'), flag: '🇬🇧', subtitle: 'Hello!' }
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-8">
      {/* Header */}
      <header className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white p-4 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="p-2 rounded-xl hover:bg-white/20 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold">{t('settings')}</h1>
        </div>
      </header>

      <div className="p-4 space-y-4">
        {/* Profile Section */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
              {(user?.name?.[0] || user?.email?.[0] || 'U').toUpperCase()}
            </div>
            <div className="flex-1">
              <h2 className="font-bold text-gray-900 dark:text-white text-lg">
                {user?.name || 'User'}
              </h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                {user?.email}
              </p>
            </div>
            <div className="p-2 rounded-xl bg-gray-100 dark:bg-gray-700">
              <User className="w-5 h-5 text-gray-500" />
            </div>
          </div>
        </div>

        {/* Appearance Section */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
            <h3 className="font-bold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">
              {t('appearance')}
            </h3>
          </div>

          {/* Dark Mode Toggle */}
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="w-full px-5 py-4 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition"
          >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              darkMode ? 'bg-gray-700' : 'bg-yellow-100'
            }`}>
              {darkMode ? (
                <Moon className="w-6 h-6 text-yellow-400" />
              ) : (
                <Sun className="w-6 h-6 text-yellow-600" />
              )}
            </div>
            <div className="flex-1 text-start">
              <p className="font-bold text-gray-900 dark:text-white">
                {darkMode ? t('darkMode') : t('lightMode')}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {darkMode
                  ? (language === 'ar' ? 'الوضع الداكن' : language === 'fr' ? 'Mode nuit' : 'Night mode')
                  : (language === 'ar' ? 'الوضع الفاتح' : language === 'fr' ? 'Mode jour' : 'Day mode')}
              </p>
            </div>
            <div className={`w-14 h-8 rounded-full transition-colors ${
              darkMode ? 'bg-emerald-500' : 'bg-gray-300'
            } relative`}>
              <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                darkMode ? 'translate-x-7' : 'translate-x-1'
              }`} />
            </div>
          </button>
        </div>

        {/* Language Section */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
            <h3 className="font-bold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider flex items-center gap-2">
              <Globe className="w-4 h-4" />
              {t('language')}
            </h3>
          </div>

          {languages.map((lang, index) => (
            <button
              key={lang.code}
              onClick={() => setLanguage(lang.code)}
              className={`w-full px-5 py-4 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition ${
                index !== languages.length - 1 ? 'border-b border-gray-100 dark:border-gray-700' : ''
              }`}
            >
              <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-2xl">
                {lang.flag}
              </div>
              <div className="flex-1 text-start">
                <p className="font-bold text-gray-900 dark:text-white">
                  {lang.name}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {lang.subtitle}
                </p>
              </div>
              {language === lang.code && (
                <div className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Notifications Section */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
            <h3 className="font-bold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">
              {t('notifications')}
            </h3>
          </div>

          {/* Push Notifications */}
          <div className="px-5 py-4 flex items-center gap-4 border-b border-gray-100 dark:border-gray-700">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              notificationsEnabled ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-gray-100 dark:bg-gray-700'
            }`}>
              <Bell className={`w-6 h-6 ${
                notificationsEnabled ? 'text-emerald-500' : 'text-gray-400'
              }`} />
            </div>
            <div className="flex-1">
              <p className="font-bold text-gray-900 dark:text-white">
                {t('enableNotifications')}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {notificationsEnabled
                  ? (language === 'ar' ? 'مفعّل' : language === 'fr' ? 'Activé' : 'Enabled')
                  : (language === 'ar' ? 'معطّل' : language === 'fr' ? 'Désactivé' : 'Disabled')}
              </p>
            </div>
            <button
              onClick={handleNotificationToggle}
              className={`w-14 h-8 rounded-full transition-colors ${
                notificationsEnabled ? 'bg-emerald-500' : 'bg-gray-300'
              } relative`}
            >
              <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                notificationsEnabled ? 'translate-x-7' : 'translate-x-1'
              }`} />
            </button>
          </div>

          {/* WhatsApp Reminder */}
          <div className="px-5 py-4 flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              whatsappEnabled ? 'bg-green-100 dark:bg-green-900/30' : 'bg-gray-100 dark:bg-gray-700'
            }`}>
              <MessageCircle className={`w-6 h-6 ${
                whatsappEnabled ? 'text-green-500' : 'text-gray-400'
              }`} />
            </div>
            <div className="flex-1">
              <p className="font-bold text-gray-900 dark:text-white">
                {t('enableWhatsapp')}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {whatsappEnabled
                  ? (language === 'ar' ? 'مفعّل' : language === 'fr' ? 'Activé' : 'Enabled')
                  : (language === 'ar' ? 'معطّل' : language === 'fr' ? 'Désactivé' : 'Disabled')}
              </p>
            </div>
            <button
              onClick={() => setWhatsappEnabled(!whatsappEnabled)}
              className={`w-14 h-8 rounded-full transition-colors ${
                whatsappEnabled ? 'bg-emerald-500' : 'bg-gray-300'
              } relative`}
            >
              <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                whatsappEnabled ? 'translate-x-7' : 'translate-x-1'
              }`} />
            </button>
          </div>
        </div>

        {/* App Info Section */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
            <h3 className="font-bold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">
              {language === 'ar' ? 'التطبيق' : language === 'fr' ? 'Application' : 'Application'}
            </h3>
          </div>

          {/* App Version */}
          <div className="px-5 py-4 flex items-center gap-4 border-b border-gray-100 dark:border-gray-700">
            <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Smartphone className="w-6 h-6 text-blue-500" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-gray-900 dark:text-white">Debts Manager</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">v1.0.0</p>
            </div>
          </div>

          {/* Help */}
          <button className="w-full px-5 py-4 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition">
            <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <HelpCircle className="w-6 h-6 text-purple-500" />
            </div>
            <div className="flex-1 text-start">
              <p className="font-bold text-gray-900 dark:text-white">{t('contactSupport')}</p>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Logout Button */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden">
          <button
            onClick={handleLogout}
            className="w-full px-5 py-4 flex items-center gap-4 hover:bg-red-50 dark:hover:bg-red-900/20 transition text-red-500"
          >
            <div className="w-12 h-12 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <LogOut className="w-6 h-6" />
            </div>
            <div className="flex-1 text-start">
              <p className="font-bold text-lg">
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
          className="w-full py-4 rounded-2xl border-2 border-red-500 text-red-500 font-bold hover:bg-red-50 dark:hover:bg-red-900/20 transition flex items-center justify-center gap-3"
        >
          <Trash className="w-5 h-5" />
          {t('clearData')}
        </button>
      </div>
    </div>
  );
}
