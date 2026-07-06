import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AppProvider } from './context/AppContext.jsx';
import './index.css';
import { PushNotifications } from '@capacitor/push-notifications';

// مكون بسيط لطلب الإذن عند تحميل التطبيق باستخدام Capacitor
const NotificationInitializer = () => {
  useEffect(() => {
    const requestCapacitorNotifications = async () => {
      try {
        let permStatus = await PushNotifications.checkPermissions();
        
        if (permStatus.receive === 'prompt') {
          permStatus = await PushNotifications.requestPermissions();
        }

        console.log('Capacitor Notification permission status:', permStatus.receive);
        
        if (permStatus.receive === 'granted') {
          // تسجيل التطبيق لاستقبال الإشعارات من Firebase/APNS
          await PushNotifications.register();
        }
      } catch (error) {
        console.error('Error initializing Capacitor Push Notifications:', error);
      }
    };

    requestCapacitorNotifications();
  }, []);
  
  return null;
};

// Initialize app
const root = createRoot(document.getElementById('root'));

root.render(
  <StrictMode>
    <BrowserRouter>
      <AppProvider>
        <NotificationInitializer />
        <App />
      </AppProvider>
    </BrowserRouter>
  </StrictMode>
);
