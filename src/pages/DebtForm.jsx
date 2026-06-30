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
  AlertCircle,
  Info,
  Clock,
  RefreshCw
} from 'lucide-react';
import { currencies } from '../i18n/translations.jsx';

/**
 * Debt Form Page
 * Handles both adding and editing debts
 * Uses neonService for all data operations with Android capture triggers
 */
export default function DebtForm() {
  const { t, addDebt, updateDebt, deleteDebt, debts, showNotification, loading, language } = useApp();
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
    status: 'pending',
    // حقول الجدولة الجديدة المضافة للبنية التحتية للفرونت إند والباك إند
    isScheduled: false,
    scheduleType: 'custom_days', // custom_days, weekly, monthly
    scheduleInterval: '30' // القيمة الافتراضية للتكرار (مثلا كل 30 يوم)
  });

  const [errors, setErrors] = useState({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Load existing debt data for editing
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
        status: existingDebt.status,
        isScheduled: existingDebt.isScheduled || false,
        scheduleType: existingDebt.scheduleType || 'custom_days',
        scheduleInterval: (existingDebt.scheduleInterval || '30').toString()
      });
    }
  }, [existingDebt]);

  // Validation
  const validate = () => {
    const newErrors = {};

    if (!formData.personName.trim()) {
      newErrors.personName = language === 'ar' ? 'الاسم مطلوب' :
                             language === 'fr' ? 'Le nom est requis' : 'Name is required';
    }

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      newErrors.amount = language === 'ar' ? 'المبلغ غير صالح' :
                          language === 'fr' ? 'Montant invalide' : 'Invalid amount';
    }

    if (!formData.dueDate) {
      newErrors.dueDate = language === 'ar' ? 'التاريخ مطلوب' :
                           language === 'fr' ? 'Date requise' : 'Date is required';
    }

    if (formData.isScheduled && (!formData.scheduleInterval || parseInt(formData.scheduleInterval) <= 0)) {
      newErrors.scheduleInterval = language === 'ar' ? 'الرجاء تحديد فترة تكرار صالحة' : 'Invalid interval';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validate()) return;

    try {
      const debtData = {
        ...formData,
        amount: parseFloat(formData.amount),
        // نضمن إرسال قيم الجدولة بصيغتها الصحيحة للباك إند
        isScheduled: formData.isScheduled,
        scheduleType: formData.isScheduled ? formData.scheduleType : 'custom_days',
        scheduleInterval: formData.isScheduled ? parseInt(formData.scheduleInterval) : 0
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

  // Handle delete
  const handleDelete = async () => {
    try {
      await deleteDebt(id);
      navigate('/debts');
    } catch (error) {
      showNotification(error.message, 'error');
    }
  };

  // Handle input change
  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-8">
      {/* Header */}
      <header className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white p-4 sticky top-0 z-10 shadow-lg">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="p-2 rounded-xl hover:bg-white/20 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold flex-1">
            {isEditing ? t('editDebt') : t('addDebt')}
          </h1>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="p-4 space-y-4">
        {/* Debt Type Toggle */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-lg">
          <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-4">
            {t('debtType')}
          </label>
          <div className="grid grid-cols-2 gap-3">
            {/* Owed to Me Button */}
            <button
              type="button"
              onClick={() => handleChange('type', 'owed_to_me')}
              className={`p-5 rounded-xl border-2 transition-all flex flex-col items-center gap-3 ${
                formData.type === 'owed_to_me'
                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 shadow-lg'
                  : 'border-gray-200 dark:border-gray-700 hover:border-emerald-300'
              }`}
            >
              <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${
                formData.type === 'owed_to_me'
                  ? 'bg-emerald-100 dark:bg-emerald-800/30'
                  : 'bg-gray-100 dark:bg-gray-700'
              }`}>
                <TrendingUp className={`w-7 h-7 ${
                  formData.type === 'owed_to_me' ? 'text-emerald-500' : 'text-gray-400'
                }`} />
              </div>
              <span className={`font-bold text-sm ${
                formData.type === 'owed_to_me'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-gray-600 dark:text-gray-400'
              }`}>
                {language === 'ar' ? 'المستحق لي' : t('owedToMe')}
              </span>
            </button>

            {/* I Owe Button */}
            <button
              type="button"
              onClick={() => handleChange('type', 'i_owe')}
              className={`p-5 rounded-xl border-2 transition-all flex flex-col items-center gap-3 ${
                formData.type === 'i_owe'
                  ? 'border-red-500 bg-red-50 dark:bg-red-900/20 shadow-lg'
                  : 'border-gray-200 dark:border-gray-700 hover:border-red-300'
              }`}
            >
              <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${
                formData.type === 'i_owe'
                  ? 'bg-red-100 dark:bg-red-800/30'
                  : 'bg-gray-100 dark:bg-gray-700'
              }`}>
                <TrendingDown className={`w-7 h-7 ${
                  formData.type === 'i_owe' ? 'text-red-500' : 'text-gray-400'
                }`} />
              </div>
              <span className={`font-bold text-sm ${
                formData.type === 'i_owe'
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-gray-600 dark:text-gray-400'
              }`}>
                {language === 'ar' ? 'المتوجب عليّ' : t('iOwe')}
              </span>
            </button>
          </div>
        </div>

        {/* Person Name */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-lg">
          <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
            <User className="w-4 h-4" />
            {t('personName')}
            <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.personName}
            onChange={(e) => handleChange('personName', e.target.value)}
            className={`w-full px-4 py-3.5 rounded-xl border-2 ${
              errors.personName
                ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700'
            } text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition placeholder-gray-400`}
            placeholder={language === 'ar' ? 'اسم الشخص' : language === 'fr' ? 'Nom de la personne' : 'Person name'}
          />
          {errors.personName && (
            <p className="mt-2 text-sm text-red-500 font-medium">{errors.personName}</p>
          )}
        </div>

        {/* Phone */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-lg">
          <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
            <Phone className="w-4 h-4" />
            {t('phone')}
            <span className="text-xs text-gray-400 font-normal">({language === 'ar' ? 'اختياري - للواتساب' : language === 'fr' ? 'optionnel' : 'optional'})</span>
          </label>
          <input
            type="tel"
            value={formData.phone}
            onChange={(e) => handleChange('phone', e.target.value)}
            className="w-full px-4 py-3.5 rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition placeholder-gray-400"
            placeholder={language === 'ar' ? 'مثال: +213555123456' : '+213...'}
            dir="ltr"
          />
        </div>

        {/* Amount & Currency */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-lg">
          <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            {t('amount')}
            <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-3">
            <input
              type="number"
              value={formData.amount}
              onChange={(e) => handleChange('amount', e.target.value)}
              className={`flex-1 px-4 py-3.5 rounded-xl border-2 ${
                errors.amount
                  ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                  : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700'
              } text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition placeholder-gray-400`}
              placeholder="0"
              min="0"
              step="0.01"
              inputMode="decimal"
            />
            <select
              value={formData.currency}
              onChange={(e) => handleChange('currency', e.target.value)}
              className="px-4 py-3.5 rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition font-medium"
            >
              {currencies.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          {errors.amount && (
            <p className="mt-2 text-sm text-red-500 font-medium">{errors.amount}</p>
          )}
        </div>

        {/* Due Date */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-lg">
          <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            {t('dueDate')}
            <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={formData.dueDate}
            onChange={(e) => handleChange('dueDate', e.target.value)}
            className={`w-full px-4 py-3.5 rounded-xl border-2 ${
              errors.dueDate
                ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700'
            } text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition`}
          />
          {errors.dueDate && (
            <p className="mt-2 text-sm text-red-500 font-medium">{errors.dueDate}</p>
          )}
        </div>

        {/* الميزة الجديدة: قسم جدولة وتكرار الديون الاحترافي */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-emerald-500" />
              {language === 'ar' ? 'تكرار أو جدولة هذا الدين' : 'Schedule / Repeat Debt'}
            </label>
            <input 
              type="checkbox" 
              checked={formData.isScheduled} 
              onChange={(e) => handleChange('isScheduled', e.target.checked)}
              className="w-5 h-5 text-emerald-500 rounded focus:ring-emerald-500 accent-emerald-500"
            />
          </div>

          {formData.isScheduled && (
            <div className="grid grid-cols-1 gap-4 pt-3 border-t border-gray-100 dark:border-gray-700 transition-all">
              {/* اختيار نمط ونوع التكرار */}
              <div>
                <label className="block text-xs text-gray-400 dark:text-gray-400 mb-1">
                  {language === 'ar' ? 'نمط الجدولة' : 'Schedule Pattern'}
                </label>
                <select
                  value={formData.scheduleType}
                  onChange={(e) => handleChange('scheduleType', e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 transition font-medium"
                >
                  <option value="custom_days">{language === 'ar' ? 'كل عدد معين من الأيام' : 'Every custom days'}</option>
                  <option value="weekly">{language === 'ar' ? 'تكرار أسبوعي' : 'Weekly Repeat'}</option>
                  <option value="monthly">{language === 'ar' ? 'تكرار شهري' : 'Monthly Repeat'}</option>
                </select>
              </div>

              {/* تحديد الفترات بناءً على النمط */}
              <div>
                <label className="block text-xs text-gray-400 dark:text-gray-400 mb-1">
                  {formData.scheduleType === 'custom_days' && (language === 'ar' ? 'يتكرر كل كم يوم؟' : 'Repeat every X days')}
                  {formData.scheduleType === 'weekly' && (language === 'ar' ? 'يتكرر كل كم أسبوع؟' : 'Repeat every X weeks')}
                  {formData.scheduleType === 'monthly' && (language === 'ar' ? 'يتكرر كل كم شهر؟' : 'Repeat every X months')}
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="1"
                    value={formData.scheduleInterval}
                    onChange={(e) => handleChange('scheduleInterval', e.target.value)}
                    className={`w-full px-4 py-3 rounded-xl border-2 ${
                      errors.scheduleInterval ? 'border-red-500' : 'border-gray-200 dark:border-gray-600'
                    } bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 transition`}
                    placeholder="30"
                  />
                  <span className="text-sm font-bold text-gray-500 whitespace-nowrap">
                    {formData.scheduleType === 'custom_days' && (language === 'ar' ? 'يوم' : 'Days')}
                    {formData.scheduleType === 'weekly' && (language === 'ar' ? 'أسبوع' : 'Weeks')}
                    {formData.scheduleType === 'monthly' && (language === 'ar' ? 'شهر' : 'Months')}
                  </span>
                </div>
                {errors.scheduleInterval && (
                  <p className="mt-1 text-xs text-red-500 font-medium">{errors.scheduleInterval}</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Status - Only for editing */}
        {isEditing && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-lg">
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
              <Info className="w-4 h-4" />
              {t('status')}
            </label>
            <select
              value={formData.status}
              onChange={(e) => handleChange('status', e.target.value)}
              className="w-full px-4 py-3.5 rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition font-medium"
            >
              <option value="pending">{t('pending')}</option>
              <option value="paid">{t('paid')}</option>
              <option value="partially_paid">{t('partiallyPaid')}</option>
            </select>
          </div>
        )}

        {/* Notes */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-lg">
          <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4" />
            {t('notes')}
            <span className="text-xs text-gray-400 font-normal">({language === 'ar' ? 'اختياري' : language === 'fr' ? 'optionnel' : 'optional'})</span>
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => handleChange('notes', e.target.value)}
            className="w-full px-4 py-3.5 rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition resize-none placeholder-gray-400"
            rows={4}
            placeholder={language === 'ar' ? 'أي ملاحظات إضافية...' : language === 'fr' ? 'Remarques...' : 'Any notes...'}
          />
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold text-lg shadow-lg hover:shadow-xl focus:ring-4 focus:ring-emerald-300 dark:focus:ring-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-3"
        >
          {loading ? (
            <>
              <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" />
              {t('savingData')}
            </>
          ) : (
            <>
              <Save className="w-6 h-6" />
              {t('save')}
            </>
          )}
        </button>

        {/* Delete Button - Only for editing */}
        {isEditing && (
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full py-4 rounded-2xl border-2 border-red-500 text-red-500 font-bold hover:bg-red-50 dark:hover:bg-red-900/20 transition flex items-center justify-center gap-3"
          >
            <Trash2 className="w-5 h-5" />
            {t('delete')}
          </button>
        )}
      </form>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <AlertCircle className="w-7 h-7 text-red-500" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-gray-900 dark:text-white">{t('delete')}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('confirmDelete')}</p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-3.5 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold hover:bg-gray-200 dark:hover:bg-gray-600 transition"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="flex-1 py-3.5 rounded-xl bg-red-500 text-white font-bold hover:bg-red-600 transition"
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
