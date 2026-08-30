const BASE_URL = 'http://localhost:3000/api';
let devToken = null;

// DOM Elements
const healthBtn = document.getElementById('health-btn');
const healthResult = document.getElementById('health-result');
const healthIndicator = document.getElementById('health-indicator');

const authBtn = document.getElementById('auth-btn');
const authResult = document.getElementById('auth-result');

const protectedBtn = document.getElementById('protected-btn');
const protectedResult = document.getElementById('protected-result');

// 1. Health Check
healthBtn.addEventListener('click', async () => {
    healthResult.textContent = 'Comprobando...';
    healthResult.className = 'result-box';
    healthIndicator.className = 'status-indicator';
    
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
    }
});

// 2. Generate Dev Token
authBtn.addEventListener('click', async () => {
    authResult.textContent = 'Generando token...';
    
    try {
        const response = await fetch(`${BASE_URL}/auth/dev-token`, {
            method: 'POST'
        });
        const data = await response.json();
        
        if (response.ok && data.token) {
            devToken = data.token;
            authResult.textContent = `${devToken.substring(0, 25)}...\n(Token guardado en memoria)`;
        } else {
            authResult.textContent = 'Error al generar el token.';
        }
    } catch (error) {
        authResult.textContent = `Error: ${error.message}`;
    }
});

// 3. Test Protected Route
protectedBtn.addEventListener('click', async () => {
    protectedResult.className = 'result-box';
    
    if (!devToken) {
        protectedResult.textContent = 'Error: Primero debes generar un Dev Token en la tarjeta anterior.';
        protectedResult.classList.add('error-text');
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
    }
});
