const BASE_URL = window.FastFoodConfig?.apiBaseUrl;

// ─── AUTENTICACIÓN ────────────────────────────────────────────────────────────
const token = localStorage.getItem('ff_token');
const user  = JSON.parse(localStorage.getItem('ff_user') || 'null');

if (!token) window.location.href = 'login.html';

if (user) {
  document.getElementById('user-name-display').textContent = user.name || 'Manager';
  document.getElementById('user-role-display').textContent = user.role || 'employee';
  // Ocultar sección de usuarios si no es admin
  if (user.role !== 'admin') {
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
  }
}

document.getElementById('logout-btn').addEventListener('click', () => {
  localStorage.removeItem('ff_token');
  localStorage.removeItem('ff_user');
  window.location.href = 'login.html';
});

// ─── API HELPER ───────────────────────────────────────────────────────────────
async function apiFetch(endpoint, options = {}) {
  if (!BASE_URL) throw new Error('No se configuró la URL de la API.');
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
    throw new Error('Sesión expirada.');
  }
  return res;
}

async function getErrorMessage(response, fallback) {
  const data = await response.clone().json().catch(() => null);
  return data?.message || `${fallback} (HTTP ${response.status}).`;
}

// ─── TOAST ────────────────────────────────────────────────────────────────────
const toast = document.getElementById('toast');
let toastTimer;
function showToast(message, type = 'success') {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.className = `toast toast-${type}`;
  toastTimer = setTimeout(() => { toast.className = 'toast hidden'; }, 3500);
}

// ─── NAVEGACIÓN ───────────────────────────────────────────────────────────────
const navBtns  = document.querySelectorAll('.nav-btn');
const sections = document.querySelectorAll('.dash-section');

navBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    navBtns.forEach(b => b.classList.remove('active'));
    sections.forEach(s => s.classList.remove('active'));
    btn.classList.add('active');
    const sec = document.getElementById(`section-${btn.dataset.section}`);
    if (sec) sec.classList.add('active');
    // Cargar datos al cambiar de sección
    const loaders = {
      inventory: loadInventory,
      purchases: loadPurchases,
      sales:     loadSales,
      users:     loadUsers,
    };
    loaders[btn.dataset.section]?.();
  });
});

// ─── MODAL HELPERS ────────────────────────────────────────────────────────────
function openModal(id)  { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

// ─── PRODUCTOS ────────────────────────────────────────────────────────────────
let allProducts   = [];
let allCategories = [];

const productsTbody    = document.getElementById('products-tbody');
const productSearch    = document.getElementById('product-search');
const categoryFilter   = document.getElementById('category-filter');

async function loadProducts() {
  try {
    const res = await apiFetch('/products');
    if (!res.ok) throw new Error(await getErrorMessage(res, 'Error cargando productos'));
    allProducts = await res.json();
    renderProductsTable(allProducts);
    updateProductStats(allProducts);
  } catch (error) {
    productsTbody.innerHTML = `<tr><td colspan="5" class="loading-row">${error.message}</td></tr>`;
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
  if (!products.length) {
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
            <div style="font-size:.8rem;color:var(--text-secondary)">${p.description || ''}</div>
          </div>
        </div>
      </td>
      <td>${p.category_name || '<span style="color:var(--text-secondary)">Sin categoría</span>'}</td>
      <td><strong>$${parseFloat(p.price).toFixed(2)}</strong></td>
      <td><span class="badge ${p.is_available ? 'badge-available' : 'badge-unavailable'}">${p.is_available ? '✔ Disponible' : '✖ No disponible'}</span></td>
      <td>
        <div class="action-btns">
          <button class="icon-btn" onclick="openEditProduct(${p.id})">✏️</button>
          <button class="icon-btn delete-btn" onclick="deleteProduct(${p.id}, '${p.name.replace(/'/g,"\\'")}')">🗑️</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function filterProducts() {
  const q = productSearch.value.toLowerCase();
  const c = categoryFilter.value;
  renderProductsTable(allProducts.filter(p =>
    (p.name.toLowerCase().includes(q) || (p.description||'').toLowerCase().includes(q)) &&
    (c ? String(p.category_id) === c : true)
  ));
}
productSearch.addEventListener('input', filterProducts);
categoryFilter.addEventListener('change', filterProducts);

// Modal producto
function openProductModal(product = null) {
  document.getElementById('modal-title').textContent = product ? 'Editar Producto' : 'Nuevo Producto';
  document.getElementById('product-id').value          = product?.id          || '';
  document.getElementById('product-name').value        = product?.name        || '';
  document.getElementById('product-price').value       = product?.price       || '';
  document.getElementById('product-description').value = product?.description || '';
  document.getElementById('product-image').value       = product?.image_url   || '';
  document.getElementById('product-available').checked = product ? Boolean(product.is_available) : true;
  document.getElementById('product-form-error').textContent = '';
  const sel = document.getElementById('product-category');
  sel.innerHTML = '<option value="">Sin categoría</option>' +
    allCategories.map(c => `<option value="${c.id}" ${product?.category_id === c.id ? 'selected' : ''}>${c.name}</option>`).join('');
  openModal('product-modal-overlay');
}

document.getElementById('add-product-btn').addEventListener('click', () => openProductModal());
document.getElementById('modal-close-btn').addEventListener('click', () => closeModal('product-modal-overlay'));
document.getElementById('cancel-product-btn').addEventListener('click', () => closeModal('product-modal-overlay'));
document.getElementById('product-modal-overlay').addEventListener('click', e => { if (e.target.id === 'product-modal-overlay') closeModal('product-modal-overlay'); });

window.openEditProduct = (id) => {
  const p = allProducts.find(p => p.id === id);
  if (p) openProductModal(p);
};

window.deleteProduct = async (id, name) => {
  if (!confirm(`¿Eliminar "${name}"?`)) return;
  try {
    const res = await apiFetch(`/products/${id}`, { method: 'DELETE' });
    res.ok ? showToast(`"${name}" eliminado.`) : showToast(await getErrorMessage(res, 'Error al eliminar'), 'error');
    if (res.ok) await loadProducts();
  } catch { showToast('Error de conexión.', 'error'); }
};

document.getElementById('product-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errEl = document.getElementById('product-form-error');
  errEl.textContent = '';
  const id    = document.getElementById('product-id').value;
  const name  = document.getElementById('product-name').value.trim();
  const price = parseFloat(document.getElementById('product-price').value);
  if (!name || isNaN(price)) { errEl.textContent = 'Nombre y precio son obligatorios.'; return; }
  const body = {
    name, price,
    description:  document.getElementById('product-description').value.trim(),
    category_id:  document.getElementById('product-category').value || null,
    image_url:    document.getElementById('product-image').value.trim() || null,
    is_available: document.getElementById('product-available').checked
  };
  const btn = document.getElementById('save-product-btn');
  btn.disabled = true; btn.textContent = 'Guardando...';
  try {
    const res = await apiFetch(id ? `/products/${id}` : '/products', { method: id ? 'PUT' : 'POST', body: JSON.stringify(body) });
    if (res.ok) {
      showToast(id ? 'Producto actualizado.' : 'Producto creado.');
      closeModal('product-modal-overlay');
      await loadProducts();
    } else { errEl.textContent = await getErrorMessage(res, 'Error al guardar'); }
  } catch { errEl.textContent = 'Error de conexión.'; }
  finally { btn.disabled = false; btn.textContent = 'Guardar Producto'; }
});

// ─── CATEGORÍAS ───────────────────────────────────────────────────────────────
const categoriesGrid = document.getElementById('categories-grid');

async function loadCategories() {
  try {
    const res = await apiFetch('/categories');
    if (!res.ok) throw new Error(await getErrorMessage(res, 'Error cargando categorías'));
    allCategories = await res.json();
    renderCategoriesGrid(allCategories);
    categoryFilter.innerHTML = '<option value="">Todas las categorías</option>' +
      allCategories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  } catch (error) {
    categoriesGrid.innerHTML = `<div class="loading-row">${error.message}</div>`;
  }
}

function renderCategoriesGrid(cats) {
  if (!cats.length) { categoriesGrid.innerHTML = '<div class="loading-row">No hay categorías.</div>'; return; }
  categoriesGrid.innerHTML = cats.map(c => `
    <div class="category-card glass-card">
      <div class="category-info"><h4>${c.name}</h4><p>${c.description || 'Sin descripción'}</p></div>
      <button class="icon-btn delete-btn" onclick="deleteCategory(${c.id}, '${c.name.replace(/'/g,"\\'")}')">🗑️</button>
    </div>
  `).join('');
}

document.getElementById('add-category-btn').addEventListener('click', () => openModal('category-modal-overlay'));
document.getElementById('cat-modal-close-btn').addEventListener('click', () => closeModal('category-modal-overlay'));
document.getElementById('cancel-category-btn').addEventListener('click', () => closeModal('category-modal-overlay'));
document.getElementById('category-modal-overlay').addEventListener('click', e => { if (e.target.id === 'category-modal-overlay') closeModal('category-modal-overlay'); });

document.getElementById('category-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errEl = document.getElementById('category-form-error');
  const name = document.getElementById('cat-name').value.trim();
  if (!name) { errEl.textContent = 'El nombre es obligatorio.'; return; }
  try {
    const res = await apiFetch('/categories', { method: 'POST', body: JSON.stringify({ name, description: document.getElementById('cat-description').value.trim() }) });
    if (res.ok) { showToast('Categoría creada.'); closeModal('category-modal-overlay'); await loadCategories(); }
    else { errEl.textContent = await getErrorMessage(res, 'Error al guardar'); }
  } catch { errEl.textContent = 'Error de conexión.'; }
});

window.deleteCategory = async (id, name) => {
  if (!confirm(`¿Eliminar la categoría "${name}"?`)) return;
  try {
    const res = await apiFetch(`/categories/${id}`, { method: 'DELETE' });
    res.ok ? showToast(`Categoría "${name}" eliminada.`) : showToast(await getErrorMessage(res, 'Error'), 'error');
    if (res.ok) await loadCategories();
  } catch { showToast('Error de conexión.', 'error'); }
};

// ─── INVENTARIO ───────────────────────────────────────────────────────────────
let allInventory = [];
const inventoryTbody = document.getElementById('inventory-tbody');
const inventorySearch = document.getElementById('inventory-search');
const stockFilter = document.getElementById('stock-filter');

async function loadInventory() {
  try {
    const res = await apiFetch('/inventario');
    if (!res.ok) throw new Error(await getErrorMessage(res, 'Error cargando inventario'));
    allInventory = await res.json();
    renderInventory(allInventory);
    updateInventoryStats(allInventory);
  } catch (error) {
    inventoryTbody.innerHTML = `<tr><td colspan="6" class="loading-row">${error.message}</td></tr>`;
  }
}

function updateInventoryStats(items) {
  const low  = items.filter(i => i.stock_actual > 0 && i.stock_actual <= i.stock_minimo);
  const out  = items.filter(i => i.stock_actual === 0);
  document.getElementById('stat-total-items').textContent   = items.length;
  document.getElementById('stat-low-stock').textContent     = low.length;
  document.getElementById('stat-out-stock').textContent     = out.length;
}

function renderInventory(items) {
  if (!items.length) { inventoryTbody.innerHTML = '<tr><td colspan="6" class="loading-row">No hay productos en inventario.</td></tr>'; return; }
  inventoryTbody.innerHTML = items.map(i => {
    const isOut  = i.stock_actual === 0;
    const isLow  = i.stock_actual > 0 && i.stock_actual <= i.stock_minimo;
    const badge  = isOut  ? '<span class="badge badge-unavailable">🚫 Sin stock</span>'
                 : isLow  ? '<span class="badge" style="background:rgba(245,158,11,.15);color:#f59e0b;border:1px solid rgba(245,158,11,.3)">⚠️ Stock bajo</span>'
                 : '<span class="badge badge-available">✔ OK</span>';
    return `
      <tr style="${isOut ? 'opacity:.6' : ''}">
        <td><strong>${i.nombre}</strong></td>
        <td style="font-size:1.1rem;font-weight:700;color:${isOut ? 'var(--error-color)' : isLow ? '#f59e0b' : 'var(--success-color)'}">${i.stock_actual}</td>
        <td>${i.stock_minimo}</td>
        <td>${i.unidades_paj ?? i.unidades_paq ?? '–'}</td>
        <td>$${parseFloat(i.precio_venta).toFixed(2)}</td>
        <td>${badge}</td>
      </tr>
    `;
  }).join('');
}

function filterInventory() {
  const q = inventorySearch.value.toLowerCase();
  const f = stockFilter.value;
  const filtered = allInventory.filter(i => {
    const matchName = i.nombre.toLowerCase().includes(q);
    const isOut = i.stock_actual === 0;
    const isLow = i.stock_actual > 0 && i.stock_actual <= i.stock_minimo;
    const matchFilter = f === '' || (f === 'out' && isOut) || (f === 'low' && isLow) || (f === 'ok' && !isOut && !isLow);
    return matchName && matchFilter;
  });
  renderInventory(filtered);
}
inventorySearch.addEventListener('input', filterInventory);
stockFilter.addEventListener('change', filterInventory);

// ─── COMPRAS ──────────────────────────────────────────────────────────────────
let allPurchases = [];
const purchasesTbody = document.getElementById('purchases-tbody');

async function loadPurchases() {
  try {
    const res = await apiFetch('/compras');
    if (!res.ok) throw new Error(await getErrorMessage(res, 'Error cargando compras'));
    allPurchases = await res.json();
    renderPurchases(allPurchases);
    updatePurchaseStats(allPurchases);
  } catch (error) {
    purchasesTbody.innerHTML = `<tr><td colspan="5" class="loading-row">${error.message}</td></tr>`;
  }
}

function updatePurchaseStats(purchases) {
  const today = new Date().toDateString();
  const todayPurchases = purchases.filter(p => new Date(p.fecha_compra).toDateString() === today);
  const total = purchases.reduce((s, p) => s + parseFloat(p.precio_compra_total || 0), 0);
  document.getElementById('stat-total-purchases').textContent  = purchases.length;
  document.getElementById('stat-purchases-today').textContent  = todayPurchases.length;
  document.getElementById('stat-purchases-total').textContent  = `$${total.toFixed(2)}`;
}

function renderPurchases(purchases) {
  if (!purchases.length) { purchasesTbody.innerHTML = '<tr><td colspan="5" class="loading-row">No hay compras registradas.</td></tr>'; return; }
  purchasesTbody.innerHTML = purchases.map(p => `
    <tr>
      <td>#${p.id_compra}</td>
      <td><strong>${p.nombre_producto || `Producto #${p.id_producto}`}</strong></td>
      <td>${p.cantidad_comprada}</td>
      <td><strong>$${parseFloat(p.precio_compra_total).toFixed(2)}</strong></td>
      <td>${new Date(p.fecha_compra).toLocaleString('es-CO')}</td>
    </tr>
  `).join('');
}

// Modal compras
document.getElementById('add-purchase-btn').addEventListener('click', () => {
  document.getElementById('purchase-form').reset();
  document.getElementById('purchase-form-error').textContent = '';
  const sel = document.getElementById('purchase-product');
  sel.innerHTML = '<option value="">Selecciona un producto...</option>' +
    allInventory.map(i => `<option value="${i.id_producto}">${i.nombre}</option>`).join('');
  openModal('purchase-modal-overlay');
});
document.getElementById('purchase-modal-close-btn').addEventListener('click', () => closeModal('purchase-modal-overlay'));
document.getElementById('cancel-purchase-btn').addEventListener('click', () => closeModal('purchase-modal-overlay'));
document.getElementById('purchase-modal-overlay').addEventListener('click', e => { if (e.target.id === 'purchase-modal-overlay') closeModal('purchase-modal-overlay'); });

document.getElementById('purchase-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errEl = document.getElementById('purchase-form-error');
  errEl.textContent = '';
  const id_producto         = document.getElementById('purchase-product').value;
  const cantidad_comprada   = parseInt(document.getElementById('purchase-qty').value);
  const precio_compra_total = parseFloat(document.getElementById('purchase-price').value);
  if (!id_producto || !cantidad_comprada || isNaN(precio_compra_total)) {
    errEl.textContent = 'Todos los campos son obligatorios.'; return;
  }
  try {
    const res = await apiFetch('/compras', { method: 'POST', body: JSON.stringify({ id_producto, cantidad_comprada, precio_compra_total }) });
    if (res.ok) {
      showToast('Compra registrada. Stock actualizado.');
      closeModal('purchase-modal-overlay');
      await Promise.all([loadPurchases(), loadInventory()]);
    } else { errEl.textContent = await getErrorMessage(res, 'Error al registrar'); }
  } catch { errEl.textContent = 'Error de conexión.'; }
});

// ─── VENTAS ───────────────────────────────────────────────────────────────────
let allSales = [];
let allProductosVenta = [];
const salesTbody = document.getElementById('sales-tbody');

async function loadSales() {
  try {
    const res = await apiFetch('/ventas');
    if (!res.ok) throw new Error(await getErrorMessage(res, 'Error cargando ventas'));
    allSales = await res.json();
    renderSales(allSales);
    updateSalesStats(allSales);
  } catch (error) {
    salesTbody.innerHTML = `<tr><td colspan="4" class="loading-row">${error.message}</td></tr>`;
  }
}

function updateSalesStats(sales) {
  const today = new Date().toDateString();
  const todaySales = sales.filter(s => new Date(s.fecha_hora).toDateString() === today);
  const revenueToday = todaySales.reduce((s, v) => s + parseFloat(v.total_venta || 0), 0);
  const totalHistorico = sales.reduce((s, v) => s + parseFloat(v.total_venta || 0), 0);
  document.getElementById('stat-sales-today').textContent   = todaySales.length;
  document.getElementById('stat-revenue-today').textContent = `$${revenueToday.toFixed(2)}`;
  document.getElementById('stat-sales-total').textContent   = `$${totalHistorico.toFixed(2)}`;
}

function renderSales(sales) {
  if (!sales.length) { salesTbody.innerHTML = '<tr><td colspan="4" class="loading-row">No hay ventas registradas.</td></tr>'; return; }
  salesTbody.innerHTML = sales.map(s => `
    <tr>
      <td>#${s.id_venta}</td>
      <td><strong style="color:var(--success-color)">$${parseFloat(s.total_venta).toFixed(2)}</strong></td>
      <td>${new Date(s.fecha_hora).toLocaleString('es-CO')}</td>
      <td><button class="icon-btn" onclick="viewSaleDetail(${s.id_venta})">👁️</button></td>
    </tr>
  `).join('');
}

window.viewSaleDetail = async (id) => {
  try {
    const res = await apiFetch(`/ventas/${id}`);
    if (!res.ok) return showToast('No se pudo cargar el detalle.', 'error');
    const data = await res.json();
    const items = data.detalle?.map(d => `• ${d.nombre || 'Producto'} x${d.cantidad} = $${parseFloat(d.subtotal).toFixed(2)}`).join('\n') || 'Sin detalle';
    alert(`Venta #${id}\nTotal: $${parseFloat(data.total_venta).toFixed(2)}\n\n${items}`);
  } catch { showToast('Error de conexión.', 'error'); }
};

// Modal ventas
let saleItemCount = 1;

function calcSaleTotal() {
  let total = 0;
  document.querySelectorAll('.sale-item').forEach(item => {
    const qty   = parseFloat(item.querySelector('.sale-qty-input').value) || 0;
    const price = parseFloat(item.querySelector('.sale-price-input').value) || 0;
    total += qty * price;
  });
  document.getElementById('sale-total-display').textContent = `$${total.toFixed(2)}`;
}

function buildSaleProductOptions() {
  return allProductosVenta.map(p => `<option value="${p.id_producto_venta}" data-price="${p.precio_venta}">${p.nombre} - $${parseFloat(p.precio_venta).toFixed(2)}</option>`).join('');
}

function addSaleItemRow() {
  const container = document.getElementById('sale-items-container');
  const div = document.createElement('div');
  div.className = 'sale-item form-row';
  div.dataset.index = saleItemCount++;
  div.innerHTML = `
    <div class="form-group"><label>Producto *</label><select class="sale-product-select" required><option value="">Selecciona...</option>${buildSaleProductOptions()}</select></div>
    <div class="form-group"><label>Cantidad *</label><input type="number" class="sale-qty-input" min="1" value="1" required></div>
    <div class="form-group" style="flex-direction:row;align-items:flex-end;gap:.5rem">
      <div style="flex:1"><label>Precio Unit.</label><input type="number" class="sale-price-input" min="0" step="0.01" placeholder="0.00" readonly></div>
      <button type="button" class="icon-btn delete-btn" style="margin-bottom:.1rem" onclick="this.closest('.sale-item').remove();calcSaleTotal()">🗑️</button>
    </div>
  `;
  container.appendChild(div);
  bindSaleItemEvents(div);
}

function bindSaleItemEvents(row) {
  row.querySelector('.sale-product-select').addEventListener('change', function() {
    const opt = this.options[this.selectedIndex];
    row.querySelector('.sale-price-input').value = opt.dataset.price || '';
    calcSaleTotal();
  });
  row.querySelector('.sale-qty-input').addEventListener('input', calcSaleTotal);
}

document.getElementById('add-sale-btn').addEventListener('click', async () => {
  // Cargar productos de venta
  try {
    const res = await apiFetch('/productos-venta');
    if (res.ok) {
      allProductosVenta = await res.json();
    }
  } catch {}
  // Resetear modal
  document.getElementById('sale-form').reset();
  document.getElementById('sale-form-error').textContent = '';
  document.getElementById('sale-total-display').textContent = '$0.00';
  saleItemCount = 1;
  const container = document.getElementById('sale-items-container');
  container.innerHTML = `
    <div class="sale-item form-row" data-index="0">
      <div class="form-group"><label>Producto *</label><select class="sale-product-select" required><option value="">Selecciona...</option>${buildSaleProductOptions()}</select></div>
      <div class="form-group"><label>Cantidad *</label><input type="number" class="sale-qty-input" min="1" value="1" required></div>
      <div class="form-group"><label>Precio Unit.</label><input type="number" class="sale-price-input" min="0" step="0.01" placeholder="0.00" readonly></div>
    </div>
  `;
  bindSaleItemEvents(container.querySelector('.sale-item'));
  openModal('sale-modal-overlay');
});

document.getElementById('add-sale-item-btn').addEventListener('click', addSaleItemRow);
document.getElementById('sale-modal-close-btn').addEventListener('click', () => closeModal('sale-modal-overlay'));
document.getElementById('cancel-sale-btn').addEventListener('click', () => closeModal('sale-modal-overlay'));
document.getElementById('sale-modal-overlay').addEventListener('click', e => { if (e.target.id === 'sale-modal-overlay') closeModal('sale-modal-overlay'); });

document.getElementById('sale-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errEl = document.getElementById('sale-form-error');
  errEl.textContent = '';
  const items = [];
  let valid = true;
  document.querySelectorAll('.sale-item').forEach(row => {
    const id_producto_venta = row.querySelector('.sale-product-select').value;
    const cantidad          = parseInt(row.querySelector('.sale-qty-input').value);
    const precio_unitario   = parseFloat(row.querySelector('.sale-price-input').value);
    if (!id_producto_venta || !cantidad || isNaN(precio_unitario)) { valid = false; return; }
    items.push({ id_producto_venta, cantidad, precio_unitario, subtotal: cantidad * precio_unitario });
  });
  if (!valid || !items.length) { errEl.textContent = 'Completa todos los productos correctamente.'; return; }
  const total_venta = items.reduce((s, i) => s + i.subtotal, 0);
  try {
    const res = await apiFetch('/ventas', { method: 'POST', body: JSON.stringify({ total_venta, items }) });
    if (res.ok) {
      showToast('Venta registrada correctamente.');
      closeModal('sale-modal-overlay');
      await loadSales();
    } else { errEl.textContent = await getErrorMessage(res, 'Error al registrar la venta'); }
  } catch { errEl.textContent = 'Error de conexión.'; }
});

// ─── USUARIOS ─────────────────────────────────────────────────────────────────
let allUsers = [];
const usersTbody = document.getElementById('users-tbody');

async function loadUsers() {
  if (user?.role !== 'admin') return;
  try {
    const res = await apiFetch('/users');
    if (!res.ok) throw new Error(await getErrorMessage(res, 'Error cargando usuarios'));
    allUsers = await res.json();
    renderUsers(allUsers);
  } catch (error) {
    usersTbody.innerHTML = `<tr><td colspan="9" class="loading-row">${error.message}</td></tr>`;
  }
}

function permBadge(val) {
  return val ? '<span class="badge badge-available">✔</span>' : '<span class="badge badge-unavailable">✖</span>';
}

function renderUsers(users) {
  if (!users.length) { usersTbody.innerHTML = '<tr><td colspan="9" class="loading-row">No hay usuarios.</td></tr>'; return; }
  usersTbody.innerHTML = users.map(u => `
    <tr>
      <td><strong>${u.name}</strong></td>
      <td style="font-size:.85rem;color:var(--text-secondary)">${u.email}</td>
      <td><span class="badge ${u.role === 'admin' ? 'badge-available' : ''}" style="${u.role !== 'admin' ? 'background:rgba(139,92,246,.15);color:#8b5cf6;border:1px solid rgba(139,92,246,.3)' : ''}">${u.role}</span></td>
      <td>${u.role === 'admin' ? '–' : permBadge(u.puede_ventas)}</td>
      <td>${u.role === 'admin' ? '–' : permBadge(u.puede_inventario)}</td>
      <td>${u.role === 'admin' ? '–' : permBadge(u.puede_compras)}</td>
      <td>${u.role === 'admin' ? '–' : permBadge(u.puede_clientes)}</td>
      <td>${u.role === 'admin' ? '–' : permBadge(u.puede_reportes)}</td>
      <td>
        <div class="action-btns">
          ${u.role !== 'admin' ? `<button class="icon-btn" onclick="openEditUser(${u.id})">✏️</button>` : ''}
          ${u.id !== (user?.id || 0) ? `<button class="icon-btn delete-btn" onclick="deleteUser(${u.id}, '${u.name.replace(/'/g,"\\'")}')">🗑️</button>` : ''}
        </div>
      </td>
    </tr>
  `).join('');
}

// Modal usuario
document.getElementById('add-user-btn').addEventListener('click', () => {
  document.getElementById('user-modal-title').textContent = 'Nuevo Empleado';
  document.getElementById('user-form').reset();
  document.getElementById('user-id').value = '';
  document.getElementById('user-form-error').textContent = '';
  document.getElementById('user-password-group').style.display = '';
  openModal('user-modal-overlay');
});
document.getElementById('user-modal-close-btn').addEventListener('click', () => closeModal('user-modal-overlay'));
document.getElementById('cancel-user-btn').addEventListener('click', () => closeModal('user-modal-overlay'));
document.getElementById('user-modal-overlay').addEventListener('click', e => { if (e.target.id === 'user-modal-overlay') closeModal('user-modal-overlay'); });

window.openEditUser = (id) => {
  const u = allUsers.find(u => u.id === id);
  if (!u) return;
  document.getElementById('user-modal-title').textContent = `Editar permisos — ${u.name}`;
  document.getElementById('user-id').value = u.id;
  document.getElementById('user-name').value  = u.name;
  document.getElementById('user-email').value = u.email;
  document.getElementById('user-password-group').style.display = 'none';
  document.getElementById('perm-ventas').checked     = Boolean(u.puede_ventas);
  document.getElementById('perm-inventario').checked = Boolean(u.puede_inventario);
  document.getElementById('perm-compras').checked    = Boolean(u.puede_compras);
  document.getElementById('perm-clientes').checked   = Boolean(u.puede_clientes);
  document.getElementById('perm-reportes').checked   = Boolean(u.puede_reportes);
  document.getElementById('user-form-error').textContent = '';
  openModal('user-modal-overlay');
};

window.deleteUser = async (id, name) => {
  if (!confirm(`¿Eliminar al usuario "${name}"?`)) return;
  try {
    const res = await apiFetch(`/users/${id}`, { method: 'DELETE' });
    res.ok ? showToast(`"${name}" eliminado.`) : showToast(await getErrorMessage(res, 'Error'), 'error');
    if (res.ok) await loadUsers();
  } catch { showToast('Error de conexión.', 'error'); }
};

document.getElementById('user-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errEl = document.getElementById('user-form-error');
  errEl.textContent = '';
  const id       = document.getElementById('user-id').value;
  const name     = document.getElementById('user-name').value.trim();
  const email    = document.getElementById('user-email').value.trim();
  const password = document.getElementById('user-password').value;
  const permisos = {
    puede_ventas:     document.getElementById('perm-ventas').checked     ? 1 : 0,
    puede_inventario: document.getElementById('perm-inventario').checked ? 1 : 0,
    puede_compras:    document.getElementById('perm-compras').checked    ? 1 : 0,
    puede_clientes:   document.getElementById('perm-clientes').checked   ? 1 : 0,
    puede_reportes:   document.getElementById('perm-reportes').checked   ? 1 : 0,
  };
  const btn = document.getElementById('save-user-btn');
  btn.disabled = true; btn.textContent = 'Guardando...';
  try {
    let res;
    if (id) {
      // Editar = solo actualizar permisos
      res = await apiFetch(`/permisos/${id}`, { method: 'PUT', body: JSON.stringify(permisos) });
    } else {
      if (!name || !email || !password) { errEl.textContent = 'Nombre, email y contraseña son obligatorios.'; return; }
      res = await apiFetch('/users', { method: 'POST', body: JSON.stringify({ name, email, password, role: 'employee', permisos }) });
    }
    if (res.ok) {
      showToast(id ? 'Permisos actualizados.' : 'Empleado creado correctamente.');
      closeModal('user-modal-overlay');
      await loadUsers();
    } else { errEl.textContent = await getErrorMessage(res, 'Error al guardar'); }
  } catch { errEl.textContent = 'Error de conexión.'; }
  finally { btn.disabled = false; btn.textContent = 'Guardar'; }
});

// ─── INICIALIZACIÓN ───────────────────────────────────────────────────────────
(async () => {
  await loadCategories();
  await loadProducts();
})();
