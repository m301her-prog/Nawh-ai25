import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AppProvider } from './context/AppContext.jsx';
import './index.css';

// مكون بسيط لطلب الإذن عند تحميل التطبيق
const NotificationInitializer = () => {
  useEffect(() => {
    if ('Notification' in window) {
      Notification.requestPermission().then((permission) => {
        console.log('Notification permission:', permission);
      });
    }
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
