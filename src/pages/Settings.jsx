import { useState } from 'react';
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
  HelpCircle,
  Download,
  FileText,
  FileSpreadsheet
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
    showNotification,
    downloadReport
  } = useApp();
  const navigate = useNavigate();
  const [showFormatModal, setShowFormatModal] = useState(false);

  const handleNotificationToggle = async () => {
    if (!notificationsEnabled) {
      // محاولة طلب إذن الإشعارات من متصفح الأندرويد/النظام
      const granted = await requestNotificationPermission();
      if (granted) {
        setNotificationsEnabled(true);
        showNotification(t('enableNotifications'), 'success');
      } else {
        showNotification(language === 'ar' ? 'تم رفض إذن الإشعارات' : 
                         language === 'fr' ? 'Autorisation refusée' : 'Permission denied', 'error');
      }
    } else {
      setNotificationsEnabled(false);
      showNotification(language === 'ar' ? 'تم إيقاف الإشعارات' : 'Notifications disabled', 'info');
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-8" dir={language === 'ar' ? 'rtl' : 'ltr'}>
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
                <p className="font-bold text-gray-900 dark:text-white">{lang.name}</p>
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

          <button onClick={handleNotificationToggle} className="w-full px-5 py-4 flex items-center gap-4 border-b border-gray-100 dark:border-gray-700">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${notificationsEnabled ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-gray-100 dark:bg-gray-700'}`}>
              <Bell className={`w-6 h-6 ${notificationsEnabled ? 'text-emerald-500' : 'text-gray-400'}`} />
            </div>
            <div className="flex-1 text-start">
              <p className="font-bold text-gray-900 dark:text-white">{t('enableNotifications')}</p>
            </div>
            <div className={`w-14 h-8 rounded-full transition-colors ${notificationsEnabled ? 'bg-emerald-500' : 'bg-gray-300'} relative`}>
              <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-transform ${notificationsEnabled ? 'translate-x-7' : 'translate-x-1'}`} />
            </div>
          </button>
        </div>

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="w-full p-4 bg-red-100 text-red-600 rounded-2xl font-bold hover:bg-red-200 transition"
        >
          {t('logout')}
        </button>
      </div>
    </div>
  );
}
