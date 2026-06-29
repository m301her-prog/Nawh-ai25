import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AppProvider } from './context/AppContext.jsx';
import { LocalNotifications } from '@capacitor/local-notifications';
import './index.css';

// دالة لطلب إذن الإشعارات من نظام الأندرويد عند إقلاع التطبيق
const requestNotificationPermission = async () => {
  try {
    const permission = await LocalNotifications.checkPermissions();
    if (permission.display !== 'granted') {
      await LocalNotifications.requestPermissions();
    }
  } catch (error) {
    console.error('حدث خطأ أثناء طلب إذن الإشعارات المباشرة:', error);
  }
};

// تشغيل طلب الإذن فوراً
requestNotificationPermission();

// Initialize app
const root = createRoot(document.getElementById('root'));

root.render(
  <StrictMode>
    <BrowserRouter>
      <AppProvider>
        <App />
      </AppProvider>
    </BrowserRouter>
  </StrictMode>
);
