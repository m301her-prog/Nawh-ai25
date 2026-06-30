const login = async (email, password) => {
  setLoading(true);
  try {
    // استدعاء الـ API السحابي مباشرة بدلاً من استعلام السيرفيس المحلي
    const response = await fetch('https://nawh-ai25.vercel.app/api/login-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'فشلت عملية تسجيل الدخول عبر الـ API');
    }

    const serverUser = data.user;

    if (serverUser.active === false || serverUser.active === 'false') {
      throw new Error(language === 'ar' ? 'تم غلق هذا الحساب مؤقتاً، يرجى التواصل مع الإدارة' : 'Account suspended');
    }

    const authenticatedUser = {
      id: serverUser.id,
      name: serverUser.name,
      email: serverUser.email,
      phone: serverUser.phone,
      isAdmin: serverUser.isAdmin,
      createdAt: new Date().toISOString()
    };

    // إعادة زرع الحساب محلياً بكامل بياناته ليتعامل مع بقية أجزاء الأندرويد
    const localUsers = loadFromLocalStorage('registeredUsers', []);
    const existingUserIndex = localUsers.findIndex(u => u.email.toLowerCase() === email.toLowerCase().trim());
    
    if (existingUserIndex === -1) {
      localUsers.push({ ...authenticatedUser, password: password });
    } else {
      localUsers[existingUserIndex] = { ...localUsers[existingUserIndex], ...authenticatedUser, password: password };
    }
    saveToLocalStorage('registeredUsers', localUsers);

    // تهيئة الجداول المحلية لضمان عمل كود الديون
    saveToLocalStorage(`user_${authenticatedUser.id}_debts`, loadFromLocalStorage(`user_${authenticatedUser.id}_debts`, []));
    saveToLocalStorage(`user_${authenticatedUser.id}_activities`, loadFromLocalStorage(`user_${authenticatedUser.id}_activities`, []));

    setUser(authenticatedUser);
    setIsAuthenticated(true);
    setIsAdmin(authenticatedUser.isAdmin);
    saveToLocalStorage('currentUser', authenticatedUser);
    showNotification(t('loginSuccess'), 'success');
  } catch (error) {
    showNotification(error.message, 'error');
    throw error;
  } finally {
    setLoading(false);
  }
};
