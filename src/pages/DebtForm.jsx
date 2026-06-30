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
  Repeat
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
    isScheduled: false,
    scheduleType: 'monthly',
    installmentsCount: '',
    firstPaymentDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    scheduleData: null
  });

  const [errors, setErrors] = useState({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showScheduleCard, setShowScheduleCard] = useState(false);

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
        scheduleType: existingDebt.scheduleType || 'monthly',
        installmentsCount: existingDebt.installmentsCount?.toString() || '',
        firstPaymentDate: existingDebt.firstPaymentDate
          ? existingDebt.firstPaymentDate.split('T')[0]
          : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        scheduleData: existingDebt.scheduleData || null
      });
      setShowScheduleCard(existingDebt.isScheduled || false);
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
        isScheduled: showScheduleCard,
        scheduleType: showScheduleCard ? formData.scheduleType : null,
        installmentsCount: showScheduleCard ? parseInt(formData.installmentsCount) || 0 : 0,
        firstPaymentDate: showScheduleCard ? formData.firstPaymentDate : null
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

        {/* Scheduling/Installment Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden">
          {/* Toggle Switch Header */}
          <button
            type="button"
            onClick={() => setShowScheduleCard(!showScheduleCard)}
            className="w-full px-5 py-4 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition border-b border-gray-100 dark:border-gray-700"
          >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              showScheduleCard ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-gray-100 dark:bg-gray-700'
            }`}>
              <Repeat className={`w-6 h-6 ${showScheduleCard ? 'text-blue-500' : 'text-gray-400'}`} />
            </div>
            <div className="flex-1 text-start">
              <p className="font-bold text-gray-900 dark:text-white">
                {language === 'ar' ? 'جدولة الدين والتقسيط' : language === 'fr' ? 'Planification et versements' : 'Debt Scheduling & Installments'}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {showScheduleCard
                  ? (language === 'ar' ? 'مفعّل - اضغط للتعطيل' : language === 'fr' ? 'Activé' : 'Enabled')
                  : (language === 'ar' ? 'اختياري - اضغط للتفعيل' : language === 'fr' ? 'Optionnel - Appuyez pour activer' : 'Optional - Tap to enable')}
              </p>
            </div>
            <div className={`w-14 h-8 rounded-full transition-colors ${
              showScheduleCard ? 'bg-blue-500' : 'bg-gray-300'
            } relative flex-shrink-0`}>
              <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                showScheduleCard ? 'translate-x-7' : 'translate-x-1'
              }`} />
            </div>
          </button>

          {/* Schedule Fields (shown when toggle is on) */}
          {showScheduleCard && (
            <div className="p-5 space-y-4 animate-in slide-in-from-top-2 duration-200">
              {/* Schedule Type */}
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  {language === 'ar' ? 'نوع الجدولة / التكرار' : language === 'fr' ? 'Type de planification' : 'Schedule Type'}
                  <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { value: 'daily', labelAr: 'يومي', labelFr: 'Quotidien', labelEn: 'Daily' },
                    { value: 'weekly', labelAr: 'أسبوعي', labelFr: 'Hebdo', labelEn: 'Weekly' },
                    { value: 'monthly', labelAr: 'شهري', labelFr: 'Mensuel', labelEn: 'Monthly' },
                    { value: 'specific', labelAr: 'تاريخ محدد', labelFr: 'Date fixe', labelEn: 'Specific' }
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleChange('scheduleType', option.value)}
                      className={`py-3 px-2 rounded-xl border-2 transition-all text-center text-sm font-medium ${
                        formData.scheduleType === option.value
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                          : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-blue-300'
                      }`}
                    >
                      {language === 'ar' ? option.labelAr : language === 'fr' ? option.labelFr : option.labelEn}
                    </button>
                  ))}
                </div>
              </div>

              {/* Installments Count */}
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">
                  {language === 'ar' ? 'عدد الدفعات' : language === 'fr' ? 'Nombre de versements' : 'Number of Installments'}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={formData.installmentsCount}
                  onChange={(e) => handleChange('installmentsCount', e.target.value)}
                  className="w-full px-4 py-3.5 rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition placeholder-gray-400"
                  placeholder={language === 'ar' ? 'مثال: 12' : language === 'fr' ? 'Ex: 12' : 'e.g., 12'}
                  min="1"
                  max="99"
                />
                {formData.amount && formData.installmentsCount && (
                  <p className="mt-2 text-sm text-blue-600 dark:text-blue-400 font-medium">
                    {language === 'ar'
                      ? `قيمة القسط: ${(parseFloat(formData.amount) / (parseInt(formData.installmentsCount) || 1)).toFixed(2)} ${formData.currency}`
                      : language === 'fr'
                      ? `Montant par versement: ${(parseFloat(formData.amount) / (parseInt(formData.installmentsCount) || 1)).toFixed(2)} ${formData.currency}`
                      : `Installment amount: ${(parseFloat(formData.amount) / (parseInt(formData.installmentsCount) || 1)).toFixed(2)} ${formData.currency}`}
                  </p>
                )}
              </div>

              {/* First Payment Date */}
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  {language === 'ar' ? 'تاريخ الدفعة الأولى' : language === 'fr' ? 'Date du premier versement' : 'First Payment Date'}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.firstPaymentDate}
                  onChange={(e) => handleChange('firstPaymentDate', e.target.value)}
                  className="w-full px-4 py-3.5 rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>

              {/* Info Note */}
              <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  {language === 'ar'
                    ? 'سيتم إنشاء جدول دفعات تلقائي بناءً على الإعدادات أعلاه، ويمكنك تتبع الدفعات المدفوعة والمتبقية من تفاصيل الدين.'
                    : language === 'fr'
                    ? 'Un calendrier de paiement sera automatiquement créé. Vous pourrez suivre les versements payés et restants.'
                    : 'A payment schedule will be automatically created. You can track paid and remaining installments from debt details.'}
                </p>
              </div>
            </div>
          )}
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
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-3.5 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold hover:bg-gray-200 dark:hover:bg-gray-600 transition"
              >
                {t('cancel')}
              </button>
              <button
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
