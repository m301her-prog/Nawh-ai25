import { Routes, Route, Navigate } from 'react-router-dom';
import { useApp } from './context/AppContext.jsx';
import Auth from './pages/Auth.jsx';
import Home from './pages/Home.jsx';
import DebtList from './pages/DebtList.jsx';
import DebtForm from './pages/DebtForm.jsx';
import DebtDetail from './pages/DebtDetail.jsx';
import Settings from './pages/Settings.jsx';
import Admin from './pages/Admin.jsx';
import Notification from './components/Notification.jsx';

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useApp();

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  return children;
}

function AdminRoute({ children }) {
  const { isAuthenticated, isAdmin } = useApp();

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function AuthRoute({ children }) {
  const { isAuthenticated } = useApp();

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return children;
}

export default function App() {
  const { darkMode } = useApp();

  return (
    <div className={`min-h-screen ${darkMode ? 'dark' : ''}`}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
        <Notification />

        <Routes>
          {/* Auth Routes */}
          <Route
            path="/auth"
            element={
              <AuthRoute>
                <Auth />
              </AuthRoute>
            }
          />

          {/* Protected Routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            }
          />

          <Route
            path="/debts"
            element={
              <ProtectedRoute>
                <DebtList />
              </ProtectedRoute>
            }
          />

          <Route
            path="/debts/add"
            element={
              <ProtectedRoute>
                <DebtForm />
              </ProtectedRoute>
            }
          />

          <Route
            path="/debts/:id"
            element={
              <ProtectedRoute>
                <DebtDetail />
              </ProtectedRoute>
            }
          />

          <Route
            path="/debts/:id/edit"
            element={
              <ProtectedRoute>
                <DebtForm />
              </ProtectedRoute>
            }
          />

          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            }
          />

          {/* Admin Route */}
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <Admin />
              </AdminRoute>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
}
