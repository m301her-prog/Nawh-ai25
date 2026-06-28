import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Save,
  Calendar,
  User,
  DollarSign,
  FileText,
  Phone,
  Trash2,
  AlertCircle
} from 'lucide-react';
import { currencies } from '../i18n/translations.jsx';

export default function DebtForm() {
  const { t, addDebt, updateDebt, deleteDebt, debts, showNotification, loading } = useApp();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;

  const existingDebt = isEditing ? debts.find(d => d.id === id) : null;

  const [formData, setFormData] = useState({
    type: 'owed_to_me',
    personName: '',
    phone: '',
    amount: '',
    currency: 'DZD',
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    notes: '',
    status: 'pending'
  });

  const [errors, setErrors] = useState({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (existingDebt) {
      setFormData({
        type: existingDebt.type,
        personName: existingDebt.personName,
        phone: existingDebt.phone || '',
        amount: existingDebt.amount.toString(),
        currency: existingDebt.currency || 'DZD',
        dueDate: existingDebt.dueDate.split('T')[0],
        notes: existingDebt.notes || '',
        status: existingDebt.status
      });
    }
  }, [existingDebt]);

  const validate = () => {
    const newErrors = {};

    if (!formData.personName.trim()) {
      newErrors.personName = t('personName') + ' required';
    }

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      newErrors.amount = t('amount') + ' invalid';
    }

    if (!formData.dueDate) {
      newErrors.dueDate = t('dueDate') + ' required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validate()) return;

    try {
      const debtData = {
        ...formData,
        amount: parseFloat(formData.amount)
      };

      if (isEditing) {
        await updateDebt(id, debtData);
      } else {
        await addDebt(debtData);
      }

      navigate(-1);
    } catch (error) {
      showNotification(error.message, 'error');
    }
  };

  const handleDelete = async () => {
    try {
      await deleteDebt(id);
      navigate('/debts');
    } catch (error) {
      showNotification(error.message, 'error');
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white p-4 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg hover:bg-white/20 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold">
            {isEditing ? t('editDebt') : t('addDebt')}
          </h1>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="p-4 space-y-6">
        {/* Debt Type Toggle */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            {t('debtType')}
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleChange('type', 'owed_to_me')}
              className={`p-4 rounded-xl border-2 transition flex flex-col items-center gap-2 ${
                formData.type === 'owed_to_me'
                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                  : 'border-gray-200 dark:border-gray-700'
              }`}
            >
              <TrendingUp className={`w-8 h-8 ${
                formData.type === 'owed_to_me' ? 'text-emerald-500' : 'text-gray-400'
              }`} />
              <span className={`font-medium ${
                formData.type === 'owed_to_me'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-gray-600 dark:text-gray-400'
              }`}>
                {t('owedToMe')}
              </span>
            </button>
            <button
              type="button"
              onClick={() => handleChange('type', 'i_owe')}
              className={`p-4 rounded-xl border-2 transition flex flex-col items-center gap-2 ${
                formData.type === 'i_owe'
                  ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                  : 'border-gray-200 dark:border-gray-700'
              }`}
            >
              <TrendingDown className={`w-8 h-8 ${
                formData.type === 'i_owe' ? 'text-red-500' : 'text-gray-400'
              }`} />
              <span className={`font-medium ${
                formData.type === 'i_owe'
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-gray-600 dark:text-gray-400'
              }`}>
                {t('iOwe')}
              </span>
            </button>
          </div>
        </div>

        {/* Person Name */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <User className="inline w-4 h-4 mr-2" />
            {t('personName')}
          </label>
          <input
            type="text"
            value={formData.personName}
            onChange={(e) => handleChange('personName', e.target.value)}
            className={`w-full px-4 py-3 rounded-xl border ${
              errors.personName
                ? 'border-red-500'
                : 'border-gray-300 dark:border-gray-600'
            } bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition`}
            placeholder={t('personName')}
          />
          {errors.personName && (
            <p className="mt-1 text-sm text-red-500">{errors.personName}</p>
          )}
        </div>

        {/* Phone */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <Phone className="inline w-4 h-4 mr-2" />
            {t('phone')}
          </label>
          <input
            type="tel"
            value={formData.phone}
            onChange={(e) => handleChange('phone', e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
            placeholder="+213..."
          />
        </div>

        {/* Amount & Currency */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <DollarSign className="inline w-4 h-4 mr-2" />
            {t('amount')}
          </label>
          <div className="flex gap-3">
            <input
              type="number"
              value={formData.amount}
              onChange={(e) => handleChange('amount', e.target.value)}
              className={`flex-1 px-4 py-3 rounded-xl border ${
                errors.amount
                  ? 'border-red-500'
                  : 'border-gray-300 dark:border-gray-600'
              } bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition`}
              placeholder="0"
              min="0"
              step="0.01"
            />
            <select
              value={formData.currency}
              onChange={(e) => handleChange('currency', e.target.value)}
              className="px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
            >
              {currencies.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          {errors.amount && (
            <p className="mt-1 text-sm text-red-500">{errors.amount}</p>
          )}
        </div>

        {/* Due Date */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <Calendar className="inline w-4 h-4 mr-2" />
            {t('dueDate')}
          </label>
          <input
            type="date"
            value={formData.dueDate}
            onChange={(e) => handleChange('dueDate', e.target.value)}
            className={`w-full px-4 py-3 rounded-xl border ${
              errors.dueDate
                ? 'border-red-500'
                : 'border-gray-300 dark:border-gray-600'
            } bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition`}
          />
          {errors.dueDate && (
            <p className="mt-1 text-sm text-red-500">{errors.dueDate}</p>
          )}
        </div>

        {/* Status - Only for editing */}
        {isEditing && (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('debtType')}
            </label>
            <select
              value={formData.status}
              onChange={(e) => handleChange('status', e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
            >
              <option value="pending">{t('pending')}</option>
              <option value="paid">{t('paid')}</option>
              <option value="partially_paid">{t('partiallyPaid')}</option>
            </select>
          </div>
        )}

        {/* Notes */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <FileText className="inline w-4 h-4 mr-2" />
            {t('notes')}
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => handleChange('notes', e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition resize-none"
            rows={3}
            placeholder={t('notes') + '...'}
          />
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-4 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold shadow-lg hover:from-emerald-600 hover:to-teal-700 focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <Save className="w-5 h-5" />
              {t('save')}
            </>
          )}
        </button>

        {/* Delete Button - Only for editing */}
        {isEditing && (
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full py-4 px-4 rounded-xl border-2 border-red-500 text-red-500 font-semibold hover:bg-red-50 dark:hover:bg-red-900/20 transition flex items-center justify-center gap-2"
          >
            <Trash2 className="w-5 h-5" />
            {t('delete')}
          </button>
        )}
      </form>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-sm w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-red-500" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white">{t('delete')}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('confirmDelete')}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-3 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 py-3 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600 transition"
              >
                {t('delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
