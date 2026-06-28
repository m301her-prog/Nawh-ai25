import { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  TrendingDown,
  Search,
  Filter,
  Plus,
  ChevronDown,
  CheckCircle,
  Clock,
  AlertTriangle,
  MessageCircle,
  Phone,
  DollarSign,
  ArrowLeft
} from 'lucide-react';

export default function DebtList() {
  const { t, debts, language, openWhatsApp, darkMode } = useApp();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  const filteredDebts = useMemo(() => {
    return debts.filter(debt => {
      if (filterType !== 'all' && debt.type !== filterType) return false;
      if (filterStatus !== 'all' && debt.status !== filterStatus) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          debt.personName.toLowerCase().includes(query) ||
          debt.notes?.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [debts, filterType, filterStatus, searchQuery]);

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
      { month: 'short', day: 'numeric', year: 'numeric' }
    );
  };

  const getStatusIcon = (debt) => {
    if (debt.status === 'paid') return <CheckCircle className="w-4 h-4 text-emerald-500" />;
    const dueDate = new Date(debt.dueDate);
    if (dueDate < new Date()) return <AlertTriangle className="w-4 h-4 text-red-500" />;
    return <Clock className="w-4 h-4 text-yellow-500" />;
  };

  const getStatusColor = (debt) => {
    if (debt.status === 'paid') return 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400';
    const dueDate = new Date(debt.dueDate);
    if (dueDate < new Date()) return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400';
    return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400';
  };

  const handleWhatsApp = (e, debt) => {
    e.stopPropagation();
    const message = t('paymentReminder') + '\n\n' +
      t('personName') + ': ' + debt.personName + '\n' +
      t('amount') + ': ' + formatCurrency(debt.amount, debt.currency) + '\n' +
      t('dueDate') + ': ' + formatDate(debt.dueDate) +
      (debt.notes ? '\n\n' + debt.notes : '');
    openWhatsApp(debt.phone || '', message);
  };

  const totalOwedToMe = debts
    .filter(d => d.type === 'owed_to_me' && d.status !== 'paid')
    .reduce((sum, d) => sum + d.amount, 0);

  const totalIOwe = debts
    .filter(d => d.type === 'i_owe' && d.status !== 'paid')
    .reduce((sum, d) => sum + d.amount, 0);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20">
      {/* Header */}
      <header className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white p-4 sticky top-0 z-10">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => navigate('/')}
            className="p-2 rounded-lg hover:bg-white/20 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold">{t('debts')}</h1>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-300" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('personName') + '...'}
            className="w-full pl-10 pr-12 py-2.5 rounded-xl bg-white/20 text-white placeholder-emerald-200 border border-white/30 focus:bg-white/30 focus:border-white transition"
          />
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg hover:bg-white/20 transition"
          >
            <Filter className="w-4 h-4" />
          </button>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="mt-3 flex gap-2 flex-wrap">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-white/20 text-white border border-white/30 text-sm"
            >
              <option value="all">{t('debtType')}</option>
              <option value="owed_to_me">{t('owedToMe')}</option>
              <option value="i_owe">{t('iOwe')}</option>
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-white/20 text-white border border-white/30 text-sm"
            >
              <option value="all">{t('debtType')}</option>
              <option value="pending">{t('pending')}</option>
              <option value="paid">{t('paid')}</option>
            </select>
          </div>
        )}
      </header>

      {/* Summary Cards */}
      <div className="px-4 -mt-2 mb-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm border-l-4 border-emerald-500">
            <p className="text-xs text-gray-500 dark:text-gray-400">{t('owedToMe')}</p>
            <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
              {formatCurrency(totalOwedToMe, 'DZD')}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm border-l-4 border-red-500">
            <p className="text-xs text-gray-500 dark:text-gray-400">{t('iOwe')}</p>
            <p className="text-lg font-bold text-red-600 dark:text-red-400">
              {formatCurrency(totalIOwe, 'DZD')}
            </p>
          </div>
        </div>
      </div>

      {/* Debt List */}
      {filteredDebts.length > 0 ? (
        <div className="px-4 space-y-3">
          {filteredDebts.map(debt => (
            <div
              key={debt.id}
              onClick={() => navigate(`/debts/${debt.id}`)}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden cursor-pointer hover:shadow-md transition"
            >
              <div className="p-4">
                <div className="flex items-start gap-3">
                  {/* Type Icon */}
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

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                          {debt.personName}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {formatDate(debt.dueDate)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={`text-lg font-bold ${
                          debt.type === 'owed_to_me' ? 'text-emerald-500' : 'text-red-500'
                        }`}>
                          {formatCurrency(debt.amount, debt.currency)}
                        </p>
                      </div>
                    </div>

                    {/* Status & Actions */}
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-1 rounded-full flex items-center gap-1 ${getStatusColor(debt)}`}>
                          {getStatusIcon(debt)}
                          {debt.status === 'paid' ? t('paid') : t('pending')}
                        </span>
                      </div>

                      {/* Quick Actions */}
                      <div className="flex items-center gap-1">
                        {debt.phone && (
                          <button
                            onClick={(e) => handleWhatsApp(e, debt)}
                            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-green-500 transition"
                            title="WhatsApp"
                          >
                            <MessageCircle className="w-5 h-5" />
                          </button>
                        )}
                        {debt.phone && (
                          <a
                            href={`tel:${debt.phone}`}
                            onClick={(e) => e.stopPropagation()}
                            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-blue-500 transition"
                            title="Call"
                          >
                            <Phone className="w-5 h-5" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                {debt.notes && (
                  <p className="mt-3 text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                    {debt.notes}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="px-4 py-12 text-center">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            <DollarSign className="w-10 h-10 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {t('noDebts')}
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            {filterType !== 'all' || filterStatus !== 'all' ? 'No debts match filter' : t('addDebt')}
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

      {/* FAB */}
      <button
        onClick={() => navigate('/debts/add')}
        className="fixed bottom-20 right-4 w-14 h-14 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg flex items-center justify-center hover:scale-110 transition-transform"
      >
        <Plus className="w-6 h-6" />
      </button>
    </div>
  );
}
