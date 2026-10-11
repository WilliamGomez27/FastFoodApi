const BASE_URL = window.FastFoodConfig?.apiBaseUrl;

const loginForm = document.getElementById('login-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginError = document.getElementById('login-error');
const btnText = document.getElementById('btn-text');
const btnSpinner = document.getElementById('btn-spinner');
const togglePwBtn = document.getElementById('toggle-password');

// Si ya hay sesión activa, redirigir al dashboard
if (localStorage.getItem('ff_token')) {
  window.location.href = 'dashboard.html';
}

if (!BASE_URL) {
  loginError.textContent = 'No se configuró la URL de la API. Revisa api-base-url.';
  loginForm.querySelector('button[type="submit"]').disabled = true;
} else {
  // Detectar si el backend tiene autenticación desactivada en modo dev
  fetch(`${BASE_URL}/health`)
    .then(r => r.json())
    .then(data => {
      if (data?.authDisabled) {
        const banner = document.createElement('div');
        banner.style.cssText = 'background:#fef3c7;color:#92400e;padding:10px;border-radius:6px;margin-bottom:15px;font-size:0.85rem;text-align:center;border:1px solid #fde68a;';
        banner.innerHTML = '⚠️ <strong>Modo desarrollo:</strong> Autenticación desactivada en la API.<br><button type="button" id="btn-dev-bypass" style="margin-top:6px;padding:6px 12px;cursor:pointer;background:#d97706;color:#fff;border:none;border-radius:4px;font-weight:bold;">⚡ Entrar directo al Dashboard</button>';
        loginForm.prepend(banner);
        document.getElementById('btn-dev-bypass')?.addEventListener('click', () => {
          localStorage.setItem('ff_token', 'dev-bypass-token');
          localStorage.setItem('ff_user', JSON.stringify({ name: 'Dev Admin', role: 'admin' }));
          window.location.href = 'dashboard.html';
        });
      }
    })
    .catch(() => {});
}

// Mostrar/ocultar contraseña
togglePwBtn.addEventListener('click', () => {
  const isPassword = passwordInput.type === 'password';
  passwordInput.type = isPassword ? 'text' : 'password';
  togglePwBtn.textContent = isPassword ? '🙈' : '👁️';
});

// Manejar envío del formulario
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.textContent = '';

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    loginError.textContent = 'Por favor, completa todos los campos.';
    return;
  }

  // Estado de carga
  btnText.textContent = 'Verificando...';
  btnSpinner.classList.remove('hidden');
  loginForm.querySelector('button[type="submit"]').disabled = true;

  try {
    const response = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json().catch(() => null);

    if (response.ok && data?.token) {
      localStorage.setItem('ff_token', data.token);
      localStorage.setItem('ff_user', JSON.stringify(data.user));
      window.location.href = 'dashboard.html';
    } else {
      loginError.textContent = data?.message || `No se pudo iniciar sesión (HTTP ${response.status}).`;
    }
  } catch (error) {
    loginError.textContent = 'No se pudo conectar con el servidor. ¿Está el backend encendido?';
  } finally {
    btnText.textContent = 'Iniciar Sesión';
    btnSpinner.classList.add('hidden');
    loginForm.querySelector('button[type="submit"]').disabled = false;
  }
});
