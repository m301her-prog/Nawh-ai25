import { useEffect } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Users,
  Mail,
  Calendar,
  Shield,
  UserCheck,
  UserX,
  Trash2,
  Briefcase,
  DollarSign
} from 'lucide-react';

/**
 * Admin Dashboard Page
 * For admin users only - manage all registered users with company support
 */
export default function Admin() {
  const {
    t,
    user,
    isAdmin,
    users,
    fetchUsers,
    toggleUserStatus,
    deleteUser,
    loading,
    showNotification,
    language
  } = useApp();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAdmin) {
      navigate('/');
      return;
    }
    fetchUsers();
  }, [isAdmin, navigate, fetchUsers]);

  if (!isAdmin) {
    return null;
  }

  // فحص دقيق وشامل لحساب الحسابات النشطة
  const activeUsers = users.filter(u => u.active === true || u.active === 'true' || u.active === 1).length;

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const locale = language === 'ar' ? 'ar-DZ' : language === 'fr' ? 'fr-FR' : 'en-US';
    return new Date(dateString).toLocaleDateString(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // إرسال التحديث الصريح والآمن للباك إند
  const handleToggleStatus = async (userId, currentStatus) => {
    try {
      // تحويل القيمة القادمة لـ Boolean معاكس وصريح لارسالها للمحرك والباك إند
      const isCurrentlyActive = currentStatus === true || currentStatus === 'true' || currentStatus === 1;
      const nextStatus = !isCurrentlyActive; // عكس الحالة تماماً

      await toggleUserStatus(userId, nextStatus);
      
      showNotification(
        nextStatus
          ? (language === 'ar' ? 'تم تفعيل الحساب بنجاح' : language === 'fr' ? 'Utilisateur activé' : 'User activated')
          : (language === 'ar' ? 'تم تعطيل الحساب بنجاح' : language === 'fr' ? 'Utilisateur désactivé' : 'User deactivated'),
        'success'
      );
    } catch (error) {
      showNotification(error.message, 'error');
    }
  };

  const handleDeleteUser = async (userId, userName) => {
    const confirmed = window.confirm(
      language === 'ar' ? `هل أنت متأكد من حذف ${userName}؟`
      : language === 'fr' ? `Supprimer ${userName} ?`
      : `Delete ${userName}?`
    );

    if (confirmed) {
      try {
        await deleteUser(userId);
        showNotification(
          language === 'ar' ? 'تم حذف المستخدم بنجاح'
          : language === 'fr' ? 'Utilisateur supprimé'
          : 'User deleted',
          'success'
        );
      } catch (error) {
        showNotification(error.message, 'error');
      }
    }
  };

  const adminStats = {
    totalUsers: users.length,
    activeUsers,
    totalDebts: users.reduce((sum, u) => {
      const userDebts = JSON.parse(localStorage.getItem(`user_${u.id}_debts`) || '[]');
      return sum + userDebts.length;
    }, 0)
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-8" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <header className="bg-gradient-to-r from-purple-600 to-indigo-700 text-white p-4 sticky top-0 z-10 shadow-lg">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => navigate('/')}
            className="p-2 rounded-xl hover:bg-white/20 transition"
          >
            <ArrowLeft className="w-5 h-5 transform flip-h" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">{t('admin')}</h1>
            <p className="text-purple-200 text-sm">{user?.email}</p>
          </div>
          <div className="p-2 rounded-xl bg-white/20">
            <Shield className="w-5 h-5" />
          </div>
        </div>
      </header>

      {/* Statistics Cards */}
      <div className="px-4 -mt-2">
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-lg border-l-4 border-purple-500">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-5 h-5 text-purple-500" />
              <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">{t('totalUsers')}</span>
            </div>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{adminStats.totalUsers}</p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-lg border-l-4 border-emerald-500">
            <div className="flex items-center gap-2 mb-2">
              <UserCheck className="w-5 h-5 text-emerald-500" />
              <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">{t('activeUsers')}</span>
            </div>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{adminStats.activeUsers}</p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-lg border-l-4 border-blue-500 col-span-2">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-5 h-5 text-blue-500" />
              <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">{t('totalDebts')}</span>
            </div>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{adminStats.totalDebts}</p>
          </div>
        </div>
      </div>

      {/* Users List */}
      <div className="px-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <h2 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-500" />
              {t('users')}
            </h2>
            <button
              onClick={() => fetchUsers()}
              className="text-sm text-purple-500 hover:underline font-bold"
            >
              {language === 'ar' ? 'تحديث البيانات 🔄' : language === 'fr' ? 'Actualiser' : 'Refresh'}
            </button>
          </div>

          {users.length > 0 ? (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {users.map(u => {
                const isUserActive = u.active === true || u.active === 'true' || u.active === 1;

                return (
                  <div
                    key={u.id}
                    className="p-5 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      
                      {/* Left: User & Company Identity */}
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        {/* Avatar */}
                        <div className={`w-14 h-14 rounded-full flex items-center justify-center font-bold text-white text-lg flex-shrink-0 ${
                          isUserActive
                            ? 'bg-gradient-to-br from-purple-400 to-indigo-500'
                            : 'bg-gray-400'
                        }`}>
                          {(u.company_name?.[0] || u.name?.[0] || 'C').toUpperCase()}
                        </div>

                        {/* Details */}
                        <div className="flex-1 min-w-0">
                          {/* اسم الشركة بشكل بارز جداً وبخط عريض */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base font-extrabold text-indigo-600 dark:text-indigo-400 truncate flex items-center gap-1">
                              <Briefcase className="w-4 h-4 text-gray-400" />
                              {u.company_name || (language === 'ar' ? 'شركة غير مسماة' : 'No Company')}
                            </h3>
                            
                            {isUserActive ? (
                              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                {language === 'ar' ? 'نشط' : 'Active'}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                                {language === 'ar' ? 'معطل' : 'Disabled'}
                              </span>
                            )}
                            
                            {u.is_admin && (
                              <span className="px-2 py-0.5 rounded text-xs font-bold bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
                                Admin
                              </span>
                            )}
                          </div>

                          {/* اسم صاحب الحساب */}
                          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mt-0.5">
                            👤 {u.name || 'User'}
                          </p>

                          {/* البريد الإلكتروني */}
                          <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mt-1">
                            <Mail className="w-3.5 h-3.5" />
                            <span className="truncate">{u.email}</span>
                          </div>
