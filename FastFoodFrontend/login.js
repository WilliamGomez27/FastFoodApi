const BASE_URL = 'http://localhost:3000/api';

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

    const data = await response.json();

    if (response.ok && data.token) {
      localStorage.setItem('ff_token', data.token);
      localStorage.setItem('ff_user', JSON.stringify(data.user));
      window.location.href = 'dashboard.html';
    } else {
      loginError.textContent = data.message || 'Credenciales inválidas.';
    }
  } catch (error) {
    loginError.textContent = 'No se pudo conectar con el servidor. ¿Está el backend encendido?';
  } finally {
    btnText.textContent = 'Iniciar Sesión';
    btnSpinner.classList.add('hidden');
    loginForm.querySelector('button[type="submit"]').disabled = false;
  }
});
