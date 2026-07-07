import { useEffect, useState } from 'react';
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
  DollarSign,
  Search,
  Building2
} from 'lucide-react';

/**
 * Admin Dashboard Page
 * For admin users only - manage all registered users/companies
 * Uses neonService for user management operations
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
  const [searchTerm, setSearchTerm] = useState('');

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

  // فحص دقيق للحالة النشطة للمستخدم
  const checkIsActive = (u) => u.active === true || u.active === 'true' || u.active === 1 || u.status === 'active';

  const activeUsers = users.filter(u => checkIsActive(u)).length;

  const formatDate = (dateString) => {
    const locale = language === 'ar' ? 'ar-DZ' : language === 'fr' ? 'fr-FR' : 'en-US';
    return new Date(dateString).toLocaleDateString(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // التعامل مع التفعيل والتعطيل وإرسال البيانات الصحيحة للباك إند
  const handleToggleStatus = async (userId, currentStatus) => {
    try {
      const isCurrentlyActive = currentStatus === true || currentStatus === 'true' || currentStatus === 1;
      const nextStatus = !isCurrentlyActive; 

      // نرسل المعاكس الصريح، ويمكنك تعديل الباراميترز هنا بناءً على متطلبات الباك إند لديك
      // بعض الباك إند يتطلب إرسال كائن مثل: { active: nextStatus } أو القيمة مباشرة
      await toggleUserStatus(userId, nextStatus);
      
      showNotification(
        nextStatus
          ? (language === 'ar' ? 'تم تفعيل الحساب بنجاح' : language === 'fr' ? 'Utilisateur activé' : 'User activated')
          : (language === 'ar' ? 'تم تعطيل الحساب بنجاح' : language === 'fr' ? 'Utilisateur désactivé' : 'User deactivated'),
        'success'
      );
    } catch (error) {
      showNotification(error.message || 'حدث خطأ أثناء تحديث الحالة', 'error');
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
          language === 'ar' ? 'تم حذف المستخدم'
          : language === 'fr' ? 'Utilisateur supprimé'
          : 'User deleted',
          'success'
        );
      } catch (error) {
        showNotification(error.message, 'error');
      }
    }
  };

  // تصفية المستخدمين بناءً على اسم الشركة، اسم المستخدم أو البريد الإلكتروني
  const filteredUsers = users.filter(u => {
    const searchLower = searchTerm.toLowerCase();
    return (
      (u.companyName && u.companyName.toLowerCase().includes(searchLower)) ||
      (u.name && u.name.toLowerCase().includes(searchLower)) ||
      (u.email && u.email.toLowerCase().includes(searchLower))
    );
  });

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
        <div className="flex items-center gap-3 mb-2">
          <button
            onClick={() => navigate('/')}
            className="p-2 rounded-xl hover:bg-white/20 transition"
          >
            <ArrowLeft className={`w-5 h-5 ${language === 'ar' ? 'rotate-180' : ''}`} />
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
      <div className="px-4 mt-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border-l-4 border-purple-500">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-5 h-5 text-purple-500" />
              <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">{t('totalUsers')}</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{adminStats.totalUsers}</p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border-l-4 border-emerald-500">
            <div className="flex items-center gap-2 mb-2">
              <UserCheck className="w-5 h-5 text-emerald-500" />
              <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">{t('activeUsers')}</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{adminStats.activeUsers}</p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border-l-4 border-blue-500 col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-5 h-5 text-blue-500" />
              <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">{t('totalDebts')}</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{adminStats.totalDebts}</p>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="px-4 mb-4">
        <div className="relative">
          <Search className={`absolute top-3 w-5 h-5 text-gray-400 ${language === 'ar' ? 'right-3' : 'left-3'}`} />
          <input
            type="text"
            placeholder={language === 'ar' ? 'ابحث باسم الشركة، العميل أو البريد...' : 'Rechercher par entreprise, nom أو e-mail...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none transition ${language === 'ar' ? 'pr-10' : 'pl-10'}`}
          />
        </div>
      </div>

      {/* Users & Companies List */}
      <div className="px-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden border border-gray-100 dark:border-gray-700">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <h2 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Building2 className="w-5 h-5 text-purple-500" />
              {language === 'ar' ? 'الحسابات والشركات المسجلة' : 'Comptes & Entreprises'}
            </h2>
            <button
              onClick={() => fetchUsers()}
              className="text-sm text-purple-500 hover:underline font-medium"
            >
              {language === 'ar' ? 'تحديث' : language === 'fr' ? 'Actualiser' : 'Refresh'}
            </button>
          </div>

          {filteredUsers.length > 0 ? (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {filteredUsers.map(u => {
                const isUserActive = checkIsActive(u);
                const isProtectedAdmin = u.isAdmin || u.email === 'admin@debts.dz';

                return (
                  <div
                    key={u.id}
                    className="p-5 hover:bg-gray-50 dark:hover:bg-gray-750 transition"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      
                      {/* Left: Info & Branding */}
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        {/* Avatar / Logo Container */}
                        <div className={`w-14 h-14 rounded-xl flex items-center justify-center font-bold text-white text-lg shadow-sm shrink-0 ${
                          isUserActive
                            ? 'bg-gradient-to-br from-purple-500 to-indigo-600'
                            : 'bg-gray-400 dark:bg-gray-600'
                        }`}>
                          {((u.companyName?.[0] || u.name?.[0] || u.email?.[0] || 'C')).toUpperCase()}
                        </div>

                        {/* Text Details */}
                        <div className="flex-1 min-w-0">
                          {/* Company / Store Name (Very Prominent) */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-extrabold text-base text-gray-900 dark:text-white truncate">
                              {u.companyName || u.name || 'شركة غير مسمى'}
                            </h3>
                            
                            {isProtectedAdmin && (
                              <span className="px-2 py-0.5 rounded text-xs font-bold bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400">
                                مدير النظام
                              </span>
                            )}
                            
                            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                              isUserActive 
                                ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400' 
                                : 'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400'
                            }`}>
                              {isUserActive 
                                ? (language === 'ar' ? 'نشط' : 'Actif') 
                                : (language === 'ar' ? 'معطل' : 'Inactif')}
                            </span>
                          </div>

                          {/* Owner Name & Email */}
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 font-medium">
                            {language === 'ar' ? 'المدير:' : 'Admin:'} {u.name || 'لا يوجد'}
                          </p>
                          
                          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mt-1">
                            <Mail className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{u.email}</span>
                          </div>

                          {u.createdAt && (
                            <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500 mt-1">
                              <Calendar className="w-3 h-3" />
                              <span>{language === 'ar' ? 'تاريخ التسجيل:' : 'Inscrit le :'} {formatDate(u.createdAt)}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right: Modern Fast Controls */}
                      <div className="flex items-center gap-4 self-end sm:self-center shrink-0">
                        
                        {/* Easy Toggle Switch Button */}
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400 font-medium hidden md:inline">
                            {isUserActive 
                              ? (language === 'ar' ? 'تعطيل السريع' : 'Désactiver') 
                              : (language === 'ar' ? 'تفعيل السريع' : 'Activer')}
                          </span>
                          
                          <button
                            type="button"
                            disabled={loading || isProtectedAdmin}
                            onClick={() => handleToggleStatus(u.id, u.active)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-40 disabled:cursor-not-allowed ${
                              isUserActive ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                isUserActive 
                                  ? (language === 'ar' ? '-translate-x-6' : 'translate-x-6') 
                                  : (language === 'ar' ? '-translate-x-1' : 'translate-x-1')
                              }`}
                            />
                          </button>
                        </div>

                        {/* Delete Button */}
                        {!isProtectedAdmin && (
                          <button
                            onClick={() => handleDeleteUser(u.id, u.companyName || u.name || 'User')}
                            disabled={loading}
                            className="p-2 rounded-xl bg-gray-100 text-gray-600 hover:bg-red-100 hover:text-red-600 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-red-900/30 dark:hover:text-red-400 transition disabled:opacity-50"
                            title={t('deleteUser')}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-12 text-center">
              <Users className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400 font-medium">
                {language === 'ar' ? 'لم يتم العثور على أي حسابات تطابق البحث' : t('noUsers')}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-sm text-gray-400 dark:text-gray-500 mt-6">
        <p>Admin Panel v1.1.0</p>
        <p className="mt-1">
          {language === 'ar' ? 'إدارة نظام دفاتر الديون' : language === 'fr' ? 'Gestion des dettes' : 'Debts Manager Admin'}
        </p>
      </div>
    </div>
  );
}
