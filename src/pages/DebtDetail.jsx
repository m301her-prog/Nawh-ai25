import { useApp } from '../context/AppContext.jsx';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Calendar,
  Phone,
  MessageCircle,
  Edit,
  CheckCircle,
  Clock,
  AlertTriangle,
  FileText,
  DollarSign
} from 'lucide-react';

export default function DebtDetail() {
  const { t, debts, updateDebt, language, openWhatsApp, showNotification } = useApp();
  const navigate = useNavigate();
  const { id } = useParams();

  const debt = debts.find(d => d.id === id);

  if (!debt) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 dark:text-gray-400">{t('noDebts')}</p>
          <button
            onClick={() => navigate('/debts')}
            className="mt-4 px-4 py-2 bg-emerald-500 text-white rounded-lg"
          >
            {t('debts')}
          </button>
        </div>
      </div>
    );
  }

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
      { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
    );
  };

  const dueDate = new Date(debt.dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isOverdue = dueDate < today && debt.status !== 'paid';
  const daysUntilDue = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));

  const handleWhatsApp = () => {
    const message = t('paymentReminder') + '\n\n' +
      t('personName') + ': ' + debt.personName + '\n' +
      t('amount') + ': ' + formatCurrency(debt.amount, debt.currency) + '\n' +
      t('dueDate') + ': ' + formatDate(debt.dueDate) +
      (debt.notes ? '\n\n' + debt.notes : '');
    openWhatsApp(debt.phone || '', message);
  };

  const markAsPaid = async () => {
    try {
      await updateDebt(debt.id, { status: 'paid' });
      showNotification(t('debtUpdated'), 'success');
    } catch (error) {
      showNotification(error.message, 'error');
    }
  };

  const getStatusIcon = () => {
    if (debt.status === 'paid') return <CheckCircle className="w-6 h-6 text-emerald-500" />;
    if (isOverdue) return <AlertTriangle className="w-6 h-6 text-red-500" />;
    return <Clock className="w-6 h-6 text-yellow-500" />;
  };

  const getStatusColor = () => {
    if (debt.status === 'paid') return 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400';
    if (isOverdue) return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400';
    return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400';
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-24">
      {/* Header */}
      <header className={`p-4 text-white ${
        debt.type === 'owed_to_me'
          ? 'bg-gradient-to-r from-emerald-500 to-teal-600'
          : 'bg-gradient-to-r from-red-500 to-rose-600'
      }`}>
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg hover:bg-white/20 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold flex-1">{debt.personName}</h1>
          <button
            onClick={() => navigate(`/debts/${id}/edit`)}
            className="p-2 rounded-lg hover:bg-white/20 transition"
          >
            <Edit className="w-5 h-5" />
          </button>
        </div>

        {/* Amount */}
        <div className="text-center py-6">
          <p className="text-white/80 text-sm mb-1">
            {debt.type === 'owed_to_me' ? t('owedToMe') : t('iOwe')}
          </p>
          <p className="text-4xl font-bold">
            {formatCurrency(debt.amount, debt.currency)}
          </p>
          <div className={`inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-full text-sm font-medium ${getStatusColor()}`}>
            {getStatusIcon()}
            {debt.status === 'paid' ? t('paid') : isOverdue ? t('overdue') : t('pending')}
          </div>
        </div>
      </header>

      <div className="p-4 space-y-4">
        {/* Type Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-3">
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
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('debtType')}</p>
              <p className="font-semibold text-gray-900 dark:text-white">
                {debt.type === 'owed_to_me' ? t('owedToMe') : t('iOwe')}
              </p>
            </div>
          </div>
        </div>

        {/* Due Date */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              isOverdue ? 'bg-red-100 dark:bg-red-900/30' : 'bg-blue-100 dark:bg-blue-900/30'
            }`}>
              <Calendar className={`w-6 h-6 ${isOverdue ? 'text-red-500' : 'text-blue-500'}`} />
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('dueDate')}</p>
              <p className="font-semibold text-gray-900 dark:text-white">
                {formatDate(debt.dueDate)}
              </p>
            </div>
            {debt.status !== 'paid' && (
              <div className={`text-right ${
                isOverdue ? 'text-red-500' : 'text-yellow-600 dark:text-yellow-400'
              }`}>
                <p className="text-lg font-bold">
                  {isOverdue ? Math.abs(daysUntilDue) : daysUntilDue}
                </p>
                <p className="text-xs">
                  {isOverdue ? (language === 'dz' ? 'يوم متأخر' : language === 'fr' ? 'jours de retard' : 'days overdue') : (language === 'dz' ? 'يوم متبقي' : language === 'fr' ? 'jours restants' : 'days left')}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Phone */}
        {debt.phone && (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <Phone className="w-6 h-6 text-purple-500" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('phone')}</p>
                <p className="font-semibold text-gray-900 dark:text-white" dir="ltr">
                  {debt.phone}
                </p>
              </div>
              <a
                href={`tel:${debt.phone}`}
                className="p-3 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-500 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition"
              >
                <Phone className="w-5 h-5" />
              </a>
            </div>
          </div>
        )}

        {/* Notes */}
        {debt.notes && (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                <FileText className="w-6 h-6 text-gray-500" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{t('notes')}</p>
                <p className="text-gray-900 dark:text-white whitespace-pre-wrap">
                  {debt.notes}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Created Info */}
        <div className="text-center text-sm text-gray-400 dark:text-gray-500 pt-2">
          {t('recentActivity')}: {formatDate(debt.createdAt)}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4">
        <div className="flex gap-3">
          {debt.status !== 'paid' && (
            <button
              onClick={markAsPaid}
              className="flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold shadow-lg hover:from-emerald-600 hover:to-teal-700 transition flex items-center justify-center gap-2"
            >
              <CheckCircle className="w-5 h-5" />
              {t('paid')}
            </button>
          )}
          {debt.phone && (
            <button
              onClick={handleWhatsApp}
              className="py-3 px-6 rounded-xl bg-green-500 text-white font-semibold shadow-lg hover:bg-green-600 transition flex items-center justify-center gap-2"
            >
              <MessageCircle className="w-5 h-5" />
              WhatsApp
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
