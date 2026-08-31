const BASE_URL = window.FastFoodConfig?.apiBaseUrl;

// ─── AUTENTICACIÓN ────────────────────────────────────────────────────────────

const token = localStorage.getItem('ff_token');
const user  = JSON.parse(localStorage.getItem('ff_user') || 'null');

// Si no hay token, redirigir al login
if (!token) {
  window.location.href = 'login.html';
}

// Mostrar info del usuario en sidebar
if (user) {
  document.getElementById('user-name-display').textContent = user.name || 'Manager';
  document.getElementById('user-role-display').textContent = user.role  || 'admin';
}

// Cerrar sesión
document.getElementById('logout-btn').addEventListener('click', () => {
  localStorage.removeItem('ff_token');
  localStorage.removeItem('ff_user');
  window.location.href = 'login.html';
});

async function getErrorMessage(response, fallback) {
  const data = await response.clone().json().catch(() => null);
  return data?.message || `${fallback} (HTTP ${response.status}).`;
}

// Helper para llamadas autenticadas al API
async function apiFetch(endpoint, options = {}) {
  if (!BASE_URL) {
    throw new Error('No se configuró la URL de la API. Revisa api-base-url.');
  }

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...(options.headers || {})
    }
  });
  if (res.status === 401) {
    localStorage.removeItem('ff_token');
    localStorage.removeItem('ff_user');
    window.location.href = 'login.html';
    throw new Error('La sesión expiró o no es válida.');
  }
  return res;
}

// ─── NAVEGACIÓN ───────────────────────────────────────────────────────────────

const navBtns    = document.querySelectorAll('.nav-btn');
const sections   = document.querySelectorAll('.dash-section');

navBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    navBtns.forEach(b => b.classList.remove('active'));
    sections.forEach(s => s.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`section-${btn.dataset.section}`).classList.add('active');
  });
});

// ─── TOAST ────────────────────────────────────────────────────────────────────

const toast = document.getElementById('toast');
let toastTimer;

function showToast(message, type = 'success') {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.className = `toast toast-${type}`;
  toastTimer = setTimeout(() => { toast.className = 'toast hidden'; }, 3500);
}

// ─── PRODUCTOS ────────────────────────────────────────────────────────────────

let allProducts   = [];
let allCategories = [];

const productsTbody       = document.getElementById('products-tbody');
const productSearch       = document.getElementById('product-search');
const categoryFilter      = document.getElementById('category-filter');
const productModalOverlay = document.getElementById('product-modal-overlay');
const productForm         = document.getElementById('product-form');
const productFormError    = document.getElementById('product-form-error');

// Cargar y renderizar productos
async function loadProducts() {
  try {
    const res = await apiFetch('/products');
    if (!res.ok) throw new Error(await getErrorMessage(res, 'No se pudieron cargar los productos'));
    allProducts = await res.json();
    renderProductsTable(allProducts);
    updateProductStats(allProducts);
  } catch (error) {
    productsTbody.innerHTML = '<tr><td colspan="5" class="loading-row"></td></tr>';
    productsTbody.querySelector('td').textContent = error.message;
  }
}

function updateProductStats(products) {
  document.getElementById('stat-total-products').textContent = products.length;
  document.getElementById('stat-available-products').textContent = products.filter(p => p.is_available).length;
  const avg = products.length
    ? (products.reduce((s, p) => s + parseFloat(p.price), 0) / products.length).toFixed(2)
    : '0.00';
  document.getElementById('stat-avg-price').textContent = `$${avg}`;
}

function renderProductsTable(products) {
  if (products.length === 0) {
    productsTbody.innerHTML = '<tr><td colspan="5" class="loading-row">No hay productos. ¡Crea el primero!</td></tr>';
    return;
  }
  productsTbody.innerHTML = products.map(p => `
    <tr>
      <td>
        <div class="product-name-cell">
          ${p.image_url
            ? `<img src="${p.image_url}" alt="${p.name}" class="product-thumb" onerror="this.style.display='none'">`
            : `<span class="product-placeholder-icon">🍔</span>`}
          <div>
            <div style="font-weight:600">${p.name}</div>
            <div style="font-size:0.8rem;color:var(--text-secondary)">${p.description || ''}</div>
          </div>
        </div>
      </td>
      <td>${p.category_name || '<span style="color:var(--text-secondary)">Sin categoría</span>'}</td>
      <td><strong>$${parseFloat(p.price).toFixed(2)}</strong></td>
      <td>
        <span class="badge ${p.is_available ? 'badge-available' : 'badge-unavailable'}">
          ${p.is_available ? '✔ Disponible' : '✖ No disponible'}
        </span>
      </td>
      <td>
        <div class="action-btns">
          <button class="icon-btn" title="Editar" onclick="openEditProduct(${p.id})">✏️</button>
          <button class="icon-btn delete-btn" title="Eliminar" onclick="deleteProduct(${p.id}, '${p.name.replace(/'/g,"\\'")}')">🗑️</button>
        </div>
      </td>
    </tr>
  `).join('');
}

// Búsqueda y filtro en tiempo real
function filterProducts() {
  const query    = productSearch.value.toLowerCase();
  const catId    = categoryFilter.value;
  const filtered = allProducts.filter(p => {
    const matchName = p.name.toLowerCase().includes(query) || (p.description || '').toLowerCase().includes(query);
    const matchCat  = catId ? String(p.category_id) === catId : true;
    return matchName && matchCat;
  });
  renderProductsTable(filtered);
}

productSearch.addEventListener('input', filterProducts);
categoryFilter.addEventListener('change', filterProducts);

// ─── MODAL DE PRODUCTO ────────────────────────────────────────────────────────

function openProductModal(product = null) {
  document.getElementById('modal-title').textContent = product ? 'Editar Producto' : 'Nuevo Producto';
  document.getElementById('product-id').value          = product?.id          || '';
  document.getElementById('product-name').value        = product?.name        || '';
  document.getElementById('product-price').value       = product?.price       || '';
  document.getElementById('product-description').value = product?.description || '';
  document.getElementById('product-category').value    = product?.category_id || '';
  document.getElementById('product-image').value       = product?.image_url   || '';
  document.getElementById('product-available').checked = product ? Boolean(product.is_available) : true;
  productFormError.textContent = '';

  // Poblar select de categorías
  const catSelect = document.getElementById('product-category');
  catSelect.innerHTML = '<option value="">Sin categoría</option>' +
    allCategories.map(c => `<option value="${c.id}" ${product?.category_id === c.id ? 'selected' : ''}>${c.name}</option>`).join('');

  productModalOverlay.classList.remove('hidden');
}

function closeProductModal() {
  productModalOverlay.classList.add('hidden');
  productForm.reset();
}

document.getElementById('add-product-btn').addEventListener('click', () => openProductModal());
document.getElementById('modal-close-btn').addEventListener('click', closeProductModal);
document.getElementById('cancel-product-btn').addEventListener('click', closeProductModal);
productModalOverlay.addEventListener('click', (e) => { if (e.target === productModalOverlay) closeProductModal(); });

// Editar producto (llamado desde la tabla)
window.openEditProduct = async (id) => {
  const product = allProducts.find(p => p.id === id);
  if (product) openProductModal(product);
};

// Eliminar producto
window.deleteProduct = async (id, name) => {
  if (!confirm(`¿Eliminar "${name}"? Esta acción no se puede deshacer.`)) return;
  try {
    const res = await apiFetch(`/products/${id}`, { method: 'DELETE' });
    if (res.ok) {
      showToast(`"${name}" eliminado correctamente.`);
      await loadProducts();
    } else {
      showToast(await getErrorMessage(res, 'Error al eliminar el producto'), 'error');
    }
  } catch {
    showToast('Error de conexión.', 'error');
  }
};

// Guardar (crear o editar)
productForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  productFormError.textContent = '';

  const id    = document.getElementById('product-id').value;
  const name  = document.getElementById('product-name').value.trim();
  const price = parseFloat(document.getElementById('product-price').value);

  if (!name || isNaN(price)) {
    productFormError.textContent = 'Nombre y precio son obligatorios.';
    return;
  }

  const body = {
    name,
    price,
    description:  document.getElementById('product-description').value.trim(),
    category_id:  document.getElementById('product-category').value || null,
    image_url:    document.getElementById('product-image').value.trim() || null,
    is_available: document.getElementById('product-available').checked
  };

  const saveBtn = document.getElementById('save-product-btn');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Guardando...';

  try {
    const res = await apiFetch(id ? `/products/${id}` : '/products', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(body)
    });

    if (res.ok) {
      showToast(id ? 'Producto actualizado.' : 'Producto creado correctamente.');
      closeProductModal();
      await loadProducts();
    } else {
      productFormError.textContent = await getErrorMessage(res, 'Error al guardar el producto');
    }
  } catch {
    productFormError.textContent = 'Error de conexión.';
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Guardar Producto';
  }
});

// ─── CATEGORÍAS ───────────────────────────────────────────────────────────────

const categoriesGrid        = document.getElementById('categories-grid');
const categoryModalOverlay  = document.getElementById('category-modal-overlay');
const categoryForm          = document.getElementById('category-form');
const categoryFormError     = document.getElementById('category-form-error');

async function loadCategories() {
  try {
    const res    = await apiFetch('/categories');
    if (!res.ok) throw new Error(await getErrorMessage(res, 'No se pudieron cargar las categorías'));
    allCategories = await res.json();
    renderCategoriesGrid(allCategories);
    // Actualizar select del filtro de tabla
    categoryFilter.innerHTML = '<option value="">Todas las categorías</option>' +
      allCategories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  } catch (error) {
    categoriesGrid.innerHTML = '<div class="loading-row"></div>';
    categoriesGrid.firstElementChild.textContent = error.message;
  }
}

function renderCategoriesGrid(cats) {
  if (cats.length === 0) {
    categoriesGrid.innerHTML = '<div class="loading-row">No hay categorías. ¡Crea la primera!</div>';
    return;
  }
  categoriesGrid.innerHTML = cats.map(c => `
    <div class="category-card glass-card">
      <div class="category-info">
        <h4>${c.name}</h4>
        <p>${c.description || 'Sin descripción'}</p>
      </div>
      <button class="icon-btn delete-btn" title="Eliminar" onclick="deleteCategory(${c.id}, '${c.name.replace(/'/g,"\\'")}')">🗑️</button>
    </div>
  `).join('');
}

// Modal categoría
function openCategoryModal() {
  categoryForm.reset();
  categoryFormError.textContent = '';
  categoryModalOverlay.classList.remove('hidden');
}
function closeCategoryModal() {
  categoryModalOverlay.classList.add('hidden');
}

document.getElementById('add-category-btn').addEventListener('click', openCategoryModal);
document.getElementById('cat-modal-close-btn').addEventListener('click', closeCategoryModal);
document.getElementById('cancel-category-btn').addEventListener('click', closeCategoryModal);
categoryModalOverlay.addEventListener('click', (e) => { if (e.target === categoryModalOverlay) closeCategoryModal(); });

// Guardar categoría
categoryForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  categoryFormError.textContent = '';

  const name = document.getElementById('cat-name').value.trim();
  if (!name) { categoryFormError.textContent = 'El nombre es obligatorio.'; return; }

  try {
    const res = await apiFetch('/categories', {
      method: 'POST',
      body: JSON.stringify({ name, description: document.getElementById('cat-description').value.trim() })
    });
    if (res.ok) {
      showToast('Categoría creada correctamente.');
      closeCategoryModal();
      await loadCategories();
    } else {
      categoryFormError.textContent = await getErrorMessage(res, 'Error al guardar la categoría');
    }
  } catch {
    categoryFormError.textContent = 'Error de conexión.';
  }
});

// Eliminar categoría
window.deleteCategory = async (id, name) => {
  if (!confirm(`¿Eliminar la categoría "${name}"?`)) return;
  try {
    const res = await apiFetch(`/categories/${id}`, { method: 'DELETE' });
    if (res.ok) {
      showToast(`Categoría "${name}" eliminada.`);
      await loadCategories();
    } else {
      showToast(await getErrorMessage(res, 'Error al eliminar la categoría'), 'error');
    }
  } catch {
    showToast('Error de conexión.', 'error');
  }
};

// ─── INICIALIZACIÓN ───────────────────────────────────────────────────────────
(async () => {
  await loadCategories();
  await loadProducts();
})();
