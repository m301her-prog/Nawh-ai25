import { useEffect } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  TrendingDown,
  Plus,
  Users,
  Settings,
  Bell,
  Calendar,
  ArrowRight,
  DollarSign,
  Clock,
  CheckCircle,
  AlertTriangle,
  ChevronLeft,
  Activity,
  Wallet,
  MessageCircle
} from 'lucide-react';

/**
 * Home Dashboard Page
 * Displays debt statistics, recent activity, and quick actions
 * Uses neonService for all data operations
 */
export default function Home() {
  const {
    t,
    user,
    isAdmin,
    debts,
    statistics,
    language,
    setLanguage,
    darkMode,
    setDarkMode,
    sendNotification,
    notificationsEnabled,
    openWhatsApp
  } = useApp();
  const navigate = useNavigate();

  // Check for due/overdue debts and send notifications
  useEffect(() => {
    if (!notificationsEnabled) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    debts.forEach(debt => {
      if (debt.status === 'paid') return;

      const dueDate = new Date(debt.dueDate);
      dueDate.setHours(0, 0, 0, 0);

      const diffDays = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));

      if (diffDays === 0) {
        sendNotification(t('paymentReminder'), `${t('dueToday')}: ${debt.personName} - ${formatCurrency(debt.amount, debt.currency)}`);
      } else if (diffDays === 1) {
        sendNotification(t('paymentReminder'), `${t('dueTomorrow')}: ${debt.personName} - ${formatCurrency(debt.amount, debt.currency)}`);
      } else if (diffDays < 0) {
        sendNotification(t('overdueNotice'), `${debt.personName} - ${formatCurrency(debt.amount, debt.currency)}`);
      }
    });
  }, [debts, t, notificationsEnabled, sendNotification]);

  // Get recent debts (last 5 added)
  const recentDebts = debts
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5);

  // Get upcoming debts (sorted by due date, excluding paid)
  const upcomingDebts = debts
    .filter(d => d.status !== 'paid')
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
    .slice(0, 5);

  const formatCurrency = (amount, currency) => {
    const locale = language === 'ar' ? 'ar-DZ' : language === 'fr' ? 'fr-FR' : 'en-US';
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency || 'DZD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateString) => {
    const locale = language === 'ar' ? 'ar-DZ' : language === 'fr' ? 'fr-FR' : 'en-US';
    return new Date(dateString).toLocaleDateString(locale, {
      month: 'short',
      day: 'numeric'
    });
  };

  const getDebtTypeIcon = (type) => {
    return type === 'owed_to_me' ? (
      <TrendingUp className="w-5 h-5 text-emerald-500" />
    ) : (
      <TrendingDown className="w-5 h-5 text-red-500" />
    );
  };

  const getStatusColor = (debt) => {
    if (debt.status === 'paid') return 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400';
    const dueDate = new Date(debt.dueDate);
    if (dueDate < new Date()) return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400';
    return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400';
  };

  const handleWhatsAppReminder = (debt) => {
    const message = `${t('whatsappGreeting')}\n\n${t('whatsappBody')}\n${t('personName')}: ${debt.personName}\n${t('amount')}: ${formatCurrency(debt.amount, debt.currency)}\n${t('dueDate')}: ${formatDate(debt.dueDate)}\n\n${t('whatsappClosing')}`;
    openWhatsApp(debt.phone || '', message);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-24">
      {/* Header */}
      <header className="bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-white p-6 pb-20">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-emerald-100 text-sm">{t('welcome')}</p>
            <h1 className="text-2xl font-bold">
              {user?.name || user?.email?.split('@')[0]}
            </h1>
            <p className="text-emerald-100 text-sm mt-1">
              {language === 'ar' ? 'كيف حالك اليوم؟' : ''}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Language Switcher */}
            <div className="flex bg-white/20 rounded-xl p-1 backdrop-blur-sm">
              {['dz', 'fr', 'en'].map(lang => (
                <button
                  key={lang}
                  onClick={() => setLanguage(lang)}
                  className={`px-3 py-1.5 text-xs rounded-lg font-medium transition ${
                    language === lang
                      ? 'bg-white text-emerald-600 shadow'
                      : 'text-white hover:bg-white/10'
                  }`}
                >
                  {lang === 'dz' ? 'DZ' : lang === 'fr' ? 'FR' : 'EN'}
                </button>
              ))}
            </div>

            {/* Dark Mode Toggle */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2.5 rounded-xl bg-white/20 hover:bg-white/30 transition"
              title={darkMode ? t('lightMode') : t('darkMode')}
            >
              {darkMode ? (
                <div className="w-5 h-5 rounded-full bg-yellow-400" />
              ) : (
                <div className="w-5 h-5 rounded-full bg-gray-800 border-2 border-gray-600" />
              )}
            </button>
          </div>
        </div>

        {/* Quick Stats Row */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4" />
            <span>{statistics.totalDebts} {t('debts')}</span>
          </div>
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4" />
            <span>{statistics.paidRatio}% {t('paid')}</span>
          </div>
        </div>
      </header>

      {/* Stats Cards - Overlapping Header */}
      <div className="px-4 -mt-14 mb-6">
        <div className="grid grid-cols-2 gap-3">
          {/* Owed to Me Card */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-xl border-l-4 border-emerald-500 hover:scale-[1.02] transition-transform">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-emerald-500" />
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">{t('owedToMe')}</span>
            </div>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {formatCurrency(statistics.totalOwedToMe, 'DZD')}
            </p>
          </div>

          {/* I Owe Card */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-xl border-l-4 border-red-500 hover:scale-[1.02] transition-transform">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <TrendingDown className="w-5 h-5 text-red-500" />
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">{t('iOwe')}</span>
            </div>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">
              {formatCurrency(statistics.totalIOwe, 'DZD')}
            </p>
          </div>

          {/* Payment Progress Card */}
          <div className="col-span-2 bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-500" />
                <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">{t('statistics')}</span>
              </div>
              <span className="text-2xl font-bold text-gray-900 dark:text-white">{statistics.paidRatio}%</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
              <div
                className="bg-gradient-to-r from-emerald-400 to-teal-500 h-3 rounded-full transition-all duration-500"
                style={{ width: `${statistics.paidRatio}%` }}
              />
            </div>
            <div className="flex justify-between mt-3 text-sm">
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                {t('paidDebts')}: {statistics.paidDebtsCount}
              </span>
              <span className="text-yellow-600 dark:text-yellow-400 font-medium">
                {t('pendingDebts')}: {statistics.pendingDebtsCount}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="px-4 mb-6">
        <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wider">
          {t('quickActions')}
        </h2>
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {/* Add Debt Button */}
          <button
            onClick={() => navigate('/debts/add')}
            className="flex-shrink-0 flex flex-col items-center justify-center w-24 h-28 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl shadow-lg hover:shadow-xl transition-all group"
          >
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center mb-2 group-hover:scale-110 transition">
              <Plus className="w-6 h-6 text-white" />
            </div>
            <span className="text-white text-xs font-medium">{t('addDebt')}</span>
          </button>

          {/* View Debts Button */}
          <button
            onClick={() => navigate('/debts')}
            className="flex-shrink-0 flex flex-col items-center justify-center w-24 h-28 bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-xl border border-gray-200 dark:border-gray-700 transition-all group"
          >
            <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-2 group-hover:scale-110 transition">
              <DollarSign className="w-6 h-6 text-blue-500" />
            </div>
            <span className="text-gray-700 dark:text-gray-300 text-xs font-medium">{t('debts')}</span>
          </button>

          {/* People Button */}
          <button
            onClick={() => navigate('/debts')}
            className="flex-shrink-0 flex flex-col items-center justify-center w-24 h-28 bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-xl border border-gray-200 dark:border-gray-700 transition-all group"
          >
            <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mb-2 group-hover:scale-110 transition">
              <Users className="w-6 h-6 text-purple-500" />
            </div>
            <span className="text-gray-700 dark:text-gray-300 text-xs font-medium">{t('people')}</span>
          </button>

          {/* Settings Button */}
          <button
            onClick={() => navigate('/settings')}
            className="flex-shrink-0 flex flex-col items-center justify-center w-24 h-28 bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-xl border border-gray-200 dark:border-gray-700 transition-all group"
          >
            <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-2 group-hover:scale-110 transition">
              <Settings className="w-6 h-6 text-gray-500" />
            </div>
            <span className="text-gray-700 dark:text-gray-300 text-xs font-medium">{t('settings')}</span>
          </button>

          {/* Admin Dashboard - Admins Only */}
          {isAdmin && (
            <button
              onClick={() => navigate('/admin')}
              className="flex-shrink-0 flex flex-col items-center justify-center w-24 h-28 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl shadow-lg hover:shadow-xl transition-all group"
            >
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center mb-2 group-hover:scale-110 transition">
                <Bell className="w-6 h-6 text-white" />
              </div>
              <span className="text-white text-xs font-medium">{t('admin')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Upcoming Payments Section */}
      {upcomingDebts.length > 0 && (
        <div className="px-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="flex items-center gap-2 text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              <Calendar className="w-4 h-4" />
              {language === 'ar' ? 'المواعيد القريبة' : language === 'fr' ? 'Échéances proches' : 'Upcoming'}
            </h2>
            <button
              onClick={() => navigate('/debts')}
              className="text-emerald-500 dark:text-emerald-400 text-sm font-medium flex items-center gap-1 hover:underline"
            >
              {t('debts')}
              <ChevronLeft className="w-4 h-4 rotate-180" />
            </button>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden">
            {upcomingDebts.map((debt, index) => {
              const dueDate = new Date(debt.dueDate);
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const isOverdue = dueDate < today;
              const daysUntil = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));

              return (
                <div
                  key={debt.id}
                  onClick={() => navigate(`/debts/${debt.id}`)}
                  className={`flex items-center gap-4 p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition ${
                    index !== upcomingDebts.length - 1 ? 'border-b border-gray-100 dark:border-gray-700' : ''
                  }`}
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    isOverdue
                      ? 'bg-red-100 dark:bg-red-900/30'
                      : 'bg-yellow-100 dark:bg-yellow-900/30'
                  }`}>
                    {isOverdue ? (
                      <AlertTriangle className="w-6 h-6 text-red-500" />
                    ) : (
                      <Clock className="w-6 h-6 text-yellow-500" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-white truncate">
                      {debt.personName}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {formatDate(debt.dueDate)}
                      {isOverdue && (
                        <span className="text-red-500 ml-2">
                          ({Math.abs(daysUntil)} {language === 'ar' ? 'يوم متأخر' : language === 'fr' ? 'jours de retard' : 'days overdue'})
                        </span>
                      )}
                      {!isOverdue && daysUntil === 0 && (
                        <span className="text-yellow-600 ml-2">({t('dueToday')})</span>
                      )}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className={`font-bold ${debt.type === 'owed_to_me' ? 'text-emerald-500' : 'text-red-500'}`}>
                      {formatCurrency(debt.amount, debt.currency)}
                    </p>
                    {getDebtTypeIcon(debt.type)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Activity Section */}
      {recentDebts.length > 0 && (
        <div className="px-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="flex items-center gap-2 text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              <Activity className="w-4 h-4" />
              {t('recentActivity')}
            </h2>
            <button
              onClick={() => navigate('/debts')}
              className="text-emerald-500 dark:text-emerald-400 text-sm font-medium hover:underline"
            >
              {t('debts')}
            </button>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden">
            {recentDebts.map((debt, index) => (
              <div
                key={debt.id}
                onClick={() => navigate(`/debts/${debt.id}`)}
                className={`flex items-center gap-4 p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition ${
                  index !== recentDebts.length - 1 ? 'border-b border-gray-100 dark:border-gray-700' : ''
                }`}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  debt.type === 'owed_to_me'
                    ? 'bg-emerald-100 dark:bg-emerald-900/30'
                    : 'bg-red-100 dark:bg-red-900/30'
                }`}>
                  {debt.type === 'owed_to_me' ? (
                    <TrendingUp className="w-6 h-6 text-emerald-500" />
                  ) : (
                    <TrendingDown className="w-6 h-6 text-red-500" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 dark:text-white truncate">
                    {debt.personName}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {formatDate(debt.createdAt)}
                  </p>
                </div>

                <div className="text-right">
                  <p className={`font-bold ${debt.type === 'owed_to_me' ? 'text-emerald-500' : 'text-red-500'}`}>
                    {formatCurrency(debt.amount, debt.currency)}
                  </p>
                  <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(debt)}`}>
                    {debt.status === 'paid' ? t('paid') : t('pending')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {debts.length === 0 && (
        <div className="px-4 py-16 text-center">
          <div className="w-32 h-32 mx-auto mb-6 rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/30 flex items-center justify-center">
            <CheckCircle className="w-16 h-16 text-emerald-400" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
            {t('noDebts')}
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-sm mx-auto">
            {language === 'ar' ? 'لا توجد ديون حالياً. أضف ديناً جديداً للبدء' :
             language === 'fr' ? 'Bravo ! Ajoutez une dette pour commencer' :
             'Clean slate! Add a debt to get started'}
          </p>
          <button
            onClick={() => navigate('/debts/add')}
            className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-2xl font-bold shadow-lg hover:shadow-xl hover:scale-105 transition-all"
          >
            <Plus className="w-6 h-6" />
            {t('addDebt')}
          </button>
        </div>
      )}

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-4 py-2 shadow-lg">
        <div className="flex items-center justify-around max-w-md mx-auto">
          <button
            onClick={() => navigate('/')}
            className="flex flex-col items-center py-2 text-emerald-500"
          >
            <DollarSign className="w-6 h-6" />
            <span className="text-xs mt-1 font-medium">{t('home')}</span>
          </button>

          <button
            onClick={() => navigate('/debts')}
            className="flex flex-col items-center py-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition"
          >
            <Bell className="w-6 h-6" />
            <span className="text-xs mt-1">{t('debts')}</span>
          </button>

          {/* Center FAB */}
          <button
            onClick={() => navigate('/debts/add')}
            className="relative -mt-8"
          >
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-xl hover:scale-110 transition-transform">
              <Plus className="w-8 h-8 text-white" />
            </div>
          </button>

          <button
            onClick={() => navigate('/debts')}
            className="flex flex-col items-center py-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition"
          >
            <Users className="w-6 h-6" />
            <span className="text-xs mt-1">{t('people')}</span>
          </button>

          <button
            onClick={() => navigate('/settings')}
            className="flex flex-col items-center py-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition"
          >
            <Settings className="w-6 h-6" />
            <span className="text-xs mt-1">{t('settings')}</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
