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
  TrendingUp,
  Activity,
  DollarSign,
  AlertCircle
} from 'lucide-react';

/**
 * Admin Dashboard Page
 * For admin users only - manage all registered users
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
    statistics,
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

  const activeUsers = users.filter(u => u.active).length;

  const formatDate = (dateString) => {
    const locale = language === 'ar' ? 'ar-DZ' : language === 'fr' ? 'fr-FR' : 'en-US';
    return new Date(dateString).toLocaleDateString(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const handleToggleStatus = async (userId, currentStatus) => {
    try {
      await toggleUserStatus(userId, !currentStatus);
      showNotification(
        currentStatus
          ? (language === 'ar' ? 'تم تعطيل المستخدم' : language === 'fr' ? 'Utilisateur désactivé' : 'User deactivated')
          : (language === 'ar' ? 'تم تفعيل المستخدم' : language === 'fr' ? 'Utilisateur activé' : 'User activated'),
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

  const adminStats = {
    totalUsers: users.length,
    activeUsers,
    totalDebts: users.reduce((sum, u) => {
      const userDebts = JSON.parse(localStorage.getItem(`user_${u.id}_debts`) || '[]');
      return sum + userDebts.length;
    }, 0)
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-8">
      {/* Header */}
      <header className="bg-gradient-to-r from-purple-600 to-indigo-700 text-white p-4 sticky top-0 z-10 shadow-lg">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => navigate('/')}
            className="p-2 rounded-xl hover:bg-white/20 transition"
          >
            <ArrowLeft className="w-5 h-5" />
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
              className="text-sm text-purple-500 hover:underline"
            >
              {language === 'ar' ? 'حدث' : language === 'fr' ? 'Actualiser' : 'Refresh'}
            </button>
          </div>

          {users.length > 0 ? (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {users.map(u => (
                <div
                  key={u.id}
                  className="p-5 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition"
                >
                  <div className="flex items-center gap-4">
                    {/* Avatar */}
                    <div className={`w-14 h-14 rounded-full flex items-center justify-center font-bold text-white text-lg ${
                      u.active
                        ? 'bg-gradient-to-br from-purple-400 to-indigo-500'
                        : 'bg-gray-400'
                    }`}>
                      {(u.name?.[0] || u.email?.[0] || 'U').toUpperCase()}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-gray-900 dark:text-white truncate">
                          {u.name || 'User'}
                        </p>
                        {u.active && (
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                        )}
                        {u.isAdmin && (
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
                            Admin
                          </span>
                        )}
                        {!u.active && (
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-500">
                            {language === 'ar' ? 'معطل' : language === 'fr' ? 'Inactif' : 'Inactive'}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mt-1">
                        <Mail className="w-3.5 h-3.5" />
                        <span className="truncate">{u.email}</span>
                      </div>

                      {u.createdAt && (
                        <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500 mt-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(u.createdAt)}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleStatus(u.id, u.active)}
                        disabled={loading || u.isAdmin}
                        className={`p-2.5 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed ${
                          u.active
                            ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 hover:bg-yellow-200 dark:hover:bg-yellow-900/50'
                            : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 hover:bg-emerald-200 dark:hover:bg-emerald-900/50'
                        }`}
                        title={u.active ? t('deactivate') : t('activate')}
                      >
                        {u.active ? (
                          <UserX className="w-5 h-5" />
                        ) : (
                          <UserCheck className="w-5 h-5" />
                        )}
                      </button>

                      {!u.isAdmin && (
                        <button
                          onClick={() => handleDeleteUser(u.id, u.name || 'User')}
                          disabled={loading}
                          className="p-2.5 rounded-xl bg-red-100 dark:bg-red-900/30 text-red-600 hover:bg-red-200 dark:hover:bg-red-900/50 transition disabled:opacity-50"
                          title={t('deleteUser')}
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center">
              <Users className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400 font-medium">{t('noUsers')}</p>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-sm text-gray-400 dark:text-gray-500 mt-6">
        <p>Admin Panel v1.0.0</p>
        <p className="mt-1">
          {language === 'ar' ? 'إدارة مدير الديون' : language === 'fr' ? 'Gestion des dettes' : 'Debts Manager Admin'}
        </p>
      </div>
    </div>
  );
}
