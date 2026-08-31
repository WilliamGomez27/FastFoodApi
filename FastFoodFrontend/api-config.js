(() => {
  const configuredBaseUrl = document
    .querySelector('meta[name="api-base-url"]')
    ?.getAttribute('content')
    ?.trim();

  const localHosts = new Set(['localhost', '127.0.0.1']);
  const isLocal = localHosts.has(window.location.hostname);
  const localBaseUrl = `${window.location.protocol}//${window.location.hostname}:3000/api`;
  const apiBaseUrl = configuredBaseUrl || (isLocal ? localBaseUrl : '');

  if (!apiBaseUrl) {
    console.error(
      'Falta configurar la URL de la API. Define api-base-url en el HTML antes de desplegar el frontend.'
    );
  }

  window.FastFoodConfig = Object.freeze({ apiBaseUrl });
})();
