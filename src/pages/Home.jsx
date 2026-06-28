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
  AlertTriangle
} from 'lucide-react';

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
    notificationsEnabled
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
        sendNotification(t('paymentReminder'), `${t('dueToday')}: ${debt.personName} - ${debt.amount} ${debt.currency}`);
      } else if (diffDays === 1) {
        sendNotification(t('paymentReminder'), `${t('dueTomorrow')}: ${debt.personName} - ${debt.amount} ${debt.currency}`);
      } else if (diffDays < 0) {
        sendNotification(t('overdueNotice'), `${debt.personName} - ${debt.amount} ${debt.currency}`);
      }
    });
  }, [debts, t, notificationsEnabled, sendNotification]);

  const recentDebts = debts
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5);

  const upcomingDebts = debts
    .filter(d => d.status !== 'paid')
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
    .slice(0, 5);

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

  const formatCurrency = (amount, currency) => {
    return new Intl.NumberFormat(language === 'dz' ? 'ar-DZ' : language === 'fr' ? 'fr-FR' : 'en-US', {
      style: 'currency',
      currency: currency || 'DZD',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString(
      language === 'dz' ? 'ar-DZ' : language === 'fr' ? 'fr-FR' : 'en-US',
      { month: 'short', day: 'numeric' }
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20">
      {/* Header */}
      <header className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white p-6 pb-16">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold">{t('home')}</h1>
            <p className="text-emerald-100 text-sm">
              {user?.name || user?.email?.split('@')[0]}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Language Switcher */}
            <div className="flex bg-white/20 rounded-lg p-0.5">
              {['dz', 'fr', 'en'].map(lang => (
                <button
                  key={lang}
                  onClick={() => setLanguage(lang)}
                  className={`px-2 py-1 text-xs rounded-md transition ${
                    language === lang
                      ? 'bg-white text-emerald-600 font-medium'
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
              className="p-2 rounded-lg hover:bg-white/20 transition"
              title={darkMode ? t('lightMode') : t('darkMode')}
            >
              {darkMode ? (
                <div className="w-5 h-5 rounded-full bg-yellow-300 border-2 border-yellow-500" />
              ) : (
                <div className="w-5 h-5 rounded-full bg-gray-800 border-2 border-gray-600" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Stats Cards */}
      <div className="px-4 -mt-10 mb-6">
        <div className="grid grid-cols-2 gap-3">
          {/* Owed to me */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-lg border-l-4 border-emerald-500">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-emerald-500" />
              <span className="text-xs text-gray-500 dark:text-gray-400">{t('owedToMe')}</span>
            </div>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {formatCurrency(statistics.totalOwedToMe, 'DZD')}
            </p>
          </div>

          {/* I Owe */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-lg border-l-4 border-red-500">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="w-5 h-5 text-red-500" />
              <span className="text-xs text-gray-500 dark:text-gray-400">{t('iOwe')}</span>
            </div>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">
              {formatCurrency(statistics.totalIOwe, 'DZD')}
            </p>
          </div>

          {/* Paid Ratio */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-lg col-span-2">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-600 dark:text-gray-400">{t('statistics')}</span>
              <span className="text-lg font-bold text-gray-900 dark:text-white">{statistics.paidRatio}%</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
              <div
                className="bg-gradient-to-r from-emerald-500 to-teal-500 h-3 rounded-full transition-all duration-500"
                style={{ width: `${statistics.paidRatio}%` }}
              />
            </div>
            <div className="flex justify-between mt-2 text-xs text-gray-500 dark:text-gray-400">
              <span>{t('paidDebts')}: {statistics.paidDebtsCount}</span>
              <span>{t('pendingDebts')}: {statistics.pendingDebtsCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="px-4 mb-6">
        <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">{t('recentActivity')}</h2>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {/* Add Debt */}
          <button
            onClick={() => navigate('/debts/add')}
            className="flex-shrink-0 flex flex-col items-center justify-center w-20 h-24 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-md hover:shadow-lg transition group"
          >
            <Plus className="w-6 h-6 text-white group-hover:scale-110 transition" />
            <span className="text-white text-xs mt-1.5 font-medium">{t('addDebt')}</span>
          </button>

          {/* View Debts */}
          <button
            onClick={() => navigate('/debts')}
            className="flex-shrink-0 flex flex-col items-center justify-center w-20 h-24 bg-white dark:bg-gray-800 rounded-xl shadow-md hover:shadow-lg transition border border-gray-200 dark:border-gray-700"
          >
            <DollarSign className="w-6 h-6 text-emerald-500" />
            <span className="text-gray-700 dark:text-gray-300 text-xs mt-1.5 font-medium">{t('debts')}</span>
          </button>

          {/* People */}
          <button
            onClick={() => navigate('/debts')}
            className="flex-shrink-0 flex flex-col items-center justify-center w-20 h-24 bg-white dark:bg-gray-800 rounded-xl shadow-md hover:shadow-lg transition border border-gray-200 dark:border-gray-700"
          >
            <Users className="w-6 h-6 text-blue-500" />
            <span className="text-gray-700 dark:text-gray-300 text-xs mt-1.5 font-medium">{t('users')}</span>
          </button>

          {/* Settings */}
          <button
            onClick={() => navigate('/settings')}
            className="flex-shrink-0 flex flex-col items-center justify-center w-20 h-24 bg-white dark:bg-gray-800 rounded-xl shadow-md hover:shadow-lg transition border border-gray-200 dark:border-gray-700"
          >
            <Settings className="w-6 h-6 text-gray-500" />
            <span className="text-gray-700 dark:text-gray-300 text-xs mt-1.5 font-medium">{t('settings')}</span>
          </button>

          {/* Admin Dashboard */}
          {isAdmin && (
            <button
              onClick={() => navigate('/admin')}
              className="flex-shrink-0 flex flex-col items-center justify-center w-20 h-24 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl shadow-md hover:shadow-lg transition group"
            >
              <Bell className="w-6 h-6 text-white" />
              <span className="text-white text-xs mt-1.5 font-medium">{t('admin')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Upcoming Payments */}
      {upcomingDebts.length > 0 && (
        <div className="px-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              {t('dueDate')}
            </h2>
            <button
              onClick={() => navigate('/debts')}
              className="text-emerald-500 text-sm font-medium flex items-center gap-1"
            >
              {t('debts')}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm divide-y divide-gray-100 dark:divide-gray-700">
            {upcomingDebts.map(debt => {
              const dueDate = new Date(debt.dueDate);
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const isOverdue = dueDate < today;

              return (
                <div
                  key={debt.id}
                  onClick={() => navigate(`/debts/${debt.id}`)}
                  className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition"
                >
                  {isOverdue ? (
                    <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
                  ) : (
                    <Clock className="w-5 h-5 text-yellow-500 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white truncate">
                      {debt.personName}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {formatDate(debt.dueDate)}
                      {isOverdue && ` - ${t('overdue')}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold ${debt.type === 'owed_to_me' ? 'text-emerald-500' : 'text-red-500'}`}>
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

      {/* Recent Activity */}
      {recentDebts.length > 0 && (
        <div className="px-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('recentActivity')}</h2>
            <button
              onClick={() => navigate('/debts')}
              className="text-emerald-500 text-sm font-medium"
            >
              {t('debts')}
            </button>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm divide-y divide-gray-100 dark:divide-gray-700">
            {recentDebts.map(debt => (
              <div
                key={debt.id}
                onClick={() => navigate(`/debts/${debt.id}`)}
                className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition"
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  debt.type === 'owed_to_me'
                    ? 'bg-emerald-100 dark:bg-emerald-900/30'
                    : 'bg-red-100 dark:bg-red-900/30'
                }`}>
                  {debt.type === 'owed_to_me' ? (
                    <TrendingUp className="w-5 h-5 text-emerald-500" />
                  ) : (
                    <TrendingDown className="w-5 h-5 text-red-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 dark:text-white truncate">
                    {debt.personName}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {formatDate(debt.createdAt)}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`font-semibold ${debt.type === 'owed_to_me' ? 'text-emerald-500' : 'text-red-500'}`}>
                    {formatCurrency(debt.amount, debt.currency)}
                  </p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(debt)}`}>
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
        <div className="px-4 py-12 text-center">
          <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            <CheckCircle className="w-12 h-12 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {t('noDebts')}
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            {t('addDebt')}
          </p>
          <button
            onClick={() => navigate('/debts/add')}
            className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition"
          >
            <Plus className="w-5 h-5" />
            {t('addDebt')}
          </button>
        </div>
      )}

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-6 py-2">
        <div className="flex items-center justify-around">
          <button
            onClick={() => navigate('/')}
            className="flex flex-col items-center py-1 text-emerald-500"
          >
            <DollarSign className="w-6 h-6" />
            <span className="text-xs mt-1">{t('home')}</span>
          </button>
          <button
            onClick={() => navigate('/debts')}
            className="flex flex-col items-center py-1 text-gray-500 dark:text-gray-400"
          >
            <Bell className="w-6 h-6" />
            <span className="text-xs mt-1">{t('debts')}</span>
          </button>
          <button
            onClick={() => navigate('/debts/add')}
            className="flex flex-col items-center py-1 -mt-6"
          >
            <div className="w-14 h-14 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
              <Plus className="w-7 h-7 text-white" />
            </div>
          </button>
          <button
            onClick={() => navigate('/debts')}
            className="flex flex-col items-center py-1 text-gray-500 dark:text-gray-400"
          >
            <Users className="w-6 h-6" />
            <span className="text-xs mt-1">{t('users')}</span>
          </button>
          <button
            onClick={() => navigate('/settings')}
            className="flex flex-col items-center py-1 text-gray-500 dark:text-gray-400"
          >
            <Settings className="w-6 h-6" />
            <span className="text-xs mt-1">{t('settings')}</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
