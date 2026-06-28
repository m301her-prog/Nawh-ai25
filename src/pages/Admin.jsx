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
  DollarSign
} from 'lucide-react';

export default function Admin() {
  const {
    t,
    user,
    isAdmin,
    users,
    fetchUsers,
    toggleUserStatus,
    deleteUser,
    debts,
    statistics,
    loading,
    showNotification
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
  const totalDebts = debts.length;

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const handleToggleStatus = async (userId, currentStatus) => {
    try {
      await toggleUserStatus(userId, !currentStatus);
      showNotification(currentStatus ? 'User deactivated' : 'User activated', 'success');
    } catch (error) {
      showNotification(error.message, 'error');
    }
  };

  const handleDeleteUser = async (userId) => {
    if (window.confirm(t('confirmDelete'))) {
      try {
        await deleteUser(userId);
        showNotification('User deleted', 'success');
      } catch (error) {
        showNotification(error.message, 'error');
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-8">
      {/* Header */}
      <header className="bg-gradient-to-r from-purple-600 to-indigo-700 text-white p-4 sticky top-0 z-10">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => navigate('/')}
            className="p-2 rounded-lg hover:bg-white/20 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">{t('admin')}</h1>
            <p className="text-purple-200 text-sm">{user?.email}</p>
          </div>
          <div className="p-2 rounded-lg bg-white/20">
            <Shield className="w-5 h-5" />
          </div>
        </div>
      </header>

      <div className="p-4 space-y-4">
        {/* Statistics Overview */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border-l-4 border-purple-500">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-5 h-5 text-purple-500" />
              <span className="text-xs text-gray-500 dark:text-gray-400">{t('totalUsers')}</span>
            </div>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{users.length}</p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border-l-4 border-emerald-500">
            <div className="flex items-center gap-2 mb-2">
              <UserCheck className="w-5 h-5 text-emerald-500" />
              <span className="text-xs text-gray-500 dark:text-gray-400">{t('activeUsers')}</span>
            </div>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{activeUsers}</p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border-l-4 border-blue-500">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-5 h-5 text-blue-500" />
              <span className="text-xs text-gray-500 dark:text-gray-400">{t('debts')}</span>
            </div>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{totalDebts}</p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border-l-4 border-orange-500">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-5 h-5 text-orange-500" />
              <span className="text-xs text-gray-500 dark:text-gray-400">{t('paidDebts')}</span>
            </div>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{statistics.paidRatio}%</p>
          </div>
        </div>

        {/* Users List */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
            <h2 className="font-semibold text-gray-900 dark:text-white">
              {t('users')}
            </h2>
          </div>

          {users.length > 0 ? (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {users.map(u => (
                <div
                  key={u.id}
                  className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition"
                >
                  <div className="flex items-center gap-4">
                    {/* Avatar */}
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-white ${
                      u.active
                        ? 'bg-gradient-to-br from-purple-400 to-indigo-500'
                        : 'bg-gray-400'
                    }`}>
                      {(u.name?.[0] || u.email?.[0] || 'U').toUpperCase()}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900 dark:text-white truncate">
                          {u.name || 'Unknown'}
                        </p>
                        {u.active && (
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                        <Mail className="w-3.5 h-3.5" />
                        <span className="truncate">{u.email}</span>
                      </div>
                      {u.createdAt && (
                        <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                          <Calendar className="w-3 h-3" />
                          {formatDate(u.createdAt)}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleToggleStatus(u.id, u.active)}
                        disabled={loading}
                        className={`p-2 rounded-lg transition ${
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

                      <button
                        onClick={() => handleDeleteUser(u.id)}
                        disabled={loading}
                        className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 hover:bg-red-200 dark:hover:bg-red-900/50 transition"
                        title={t('deleteUser')}
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center">
              <Users className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400">{t('noUsers')}</p>
            </div>
          )}
        </div>

        {/* Footer Info */}
        <div className="text-center text-sm text-gray-400 dark:text-gray-500">
          <p>Admin Panel v1.0.0</p>
        </div>
      </div>
    </div>
  );
}
