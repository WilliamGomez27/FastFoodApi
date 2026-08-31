const BASE_URL = window.FastFoodConfig?.apiBaseUrl;

// Recupera el token si ya existía (sobrevive al recargar)
let devToken = sessionStorage.getItem('devToken') || null;

// DOM Elements
const healthBtn = document.getElementById('health-btn');
const healthResult = document.getElementById('health-result');
const healthIndicator = document.getElementById('health-indicator');

const authBtn = document.getElementById('auth-btn');
const authResult = document.getElementById('auth-result');

const protectedBtn = document.getElementById('protected-btn');
const protectedResult = document.getElementById('protected-result');

if (!BASE_URL) {
    const message = 'No se configuró la URL de la API. Revisa api-base-url.';
    [healthBtn, authBtn, protectedBtn].forEach((button) => { button.disabled = true; });
    healthResult.textContent = message;
    healthResult.classList.add('error-text');
}

// 1. Health Check
healthBtn.addEventListener('click', async () => {
    healthResult.textContent = 'Comprobando...';
    healthResult.className = 'result-box';
    healthIndicator.className = 'status-indicator';
    healthBtn.disabled = true;

    try {
        const response = await fetch(`${BASE_URL}/health`);
        const data = await response.json();

        healthResult.textContent = JSON.stringify(data, null, 2);

        if (response.ok) {
            healthResult.classList.add('success-text');
            healthIndicator.classList.add('online');
        } else {
            healthResult.classList.add('error-text');
            healthIndicator.classList.add('error');
        }
    } catch (error) {
        healthResult.textContent = `Error de conexión:\n${error.message}\n\n¿Está el backend encendido?`;
        healthResult.classList.add('error-text');
        healthIndicator.classList.add('error');
    } finally {
        healthBtn.disabled = false;
    }
});

// 2. Generate Dev Token
authBtn.addEventListener('click', async () => {
    authResult.textContent = 'Generando token...';
    authBtn.disabled = true;

    try {
        const response = await fetch(`${BASE_URL}/auth/dev-token`, {
            method: 'POST'
        });
        const data = await response.json();

        if (response.ok && data?.token) {
            devToken = data.token;
            sessionStorage.setItem('devToken', devToken);
            authResult.textContent = 'Token generado y guardado correctamente.';
        } else {
            authResult.textContent = 'Error al generar el token.';
        }
    } catch (error) {
        authResult.textContent = `Error: ${error.message}`;
    } finally {
        authBtn.disabled = false;
    }
});

// 3. Test Protected Route
protectedBtn.addEventListener('click', async () => {
    protectedResult.className = 'result-box';
    protectedBtn.disabled = true;

    if (!devToken) {
        protectedResult.textContent = 'Error: Primero debes generar un Dev Token en la tarjeta anterior.';
        protectedResult.classList.add('error-text');
        protectedBtn.disabled = false;
        return;
    }

    protectedResult.textContent = 'Accediendo...';

    try {
        const response = await fetch(`${BASE_URL}/protected`, {
            headers: {
                'Authorization': `Bearer ${devToken}`
            }
        });
        const data = await response.json();

        protectedResult.textContent = JSON.stringify(data, null, 2);

        if (response.ok) {
            protectedResult.classList.add('success-text');
        } else {
            protectedResult.classList.add('error-text');
        }
    } catch (error) {
        protectedResult.textContent = `Error: ${error.message}`;
        protectedResult.classList.add('error-text');
    } finally {
        protectedBtn.disabled = false;
    }
});
