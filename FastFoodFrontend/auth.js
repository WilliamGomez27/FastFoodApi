(function () {
  const AUTH_TOKEN_KEY = 'ff_token';
  const AUTH_USER_KEY = 'ff_user';
  const AUTH_EXPIRES_KEY = 'ff_token_expires_at';
  const DEFAULT_SESSION_MINUTES = 60;

  function saveSession(token, user, expiresInMinutes = DEFAULT_SESSION_MINUTES) {
    if (!token) return false;

    const expiresAt = Date.now() + Number(expiresInMinutes) * 60 * 1000;

    sessionStorage.setItem(AUTH_TOKEN_KEY, token);
    sessionStorage.setItem(AUTH_EXPIRES_KEY, String(expiresAt));

    if (user) {
      sessionStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    }

    return true;
  }

  function getToken() {
    return sessionStorage.getItem(AUTH_TOKEN_KEY);
  }

  function getUser() {
    const raw = sessionStorage.getItem(AUTH_USER_KEY);
    if (!raw) return null;

    try {
      return JSON.parse(raw);
    } catch (error) {
      return null;
    }
  }

  function isSessionValid() {
    const token = getToken();
    const expiresAt = Number(sessionStorage.getItem(AUTH_EXPIRES_KEY) || 0);

    if (!token || !expiresAt) return false;
    return Date.now() < expiresAt;
  }

  function clearSession() {
    sessionStorage.removeItem(AUTH_TOKEN_KEY);
    sessionStorage.removeItem(AUTH_USER_KEY);
    sessionStorage.removeItem(AUTH_EXPIRES_KEY);
  }

  window.FastFoodAuth = {
    saveSession,
    getToken,
    getUser,
    isSessionValid,
    clearSession
  };
})();