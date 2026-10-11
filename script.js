'use strict';
(async () => {
if(ZavoBackend.recoveryRedirectPending)return;
let connectionError='';
try { await ZavoStore.init(); } catch(error) { connectionError=error.message; }


// Add verified store details here before publishing.
const STORE = {
  phone: '',
  address: '',
  telegram: '',
  instagram: ''
};
const { categories, money, calculateInstallment, installmentPeriods } = ZavoStore;
let products = ZavoStore.getProducts();
const escapeHTML = ZavoStore.escapeHTML;
const icon = name => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const getProduct = id => products.find(product => product.id === Number(id));
let checkoutSubmitting=false;
const readStorage = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
};
const storedFavorites = readStorage('zavo-favorites', []);
const favorites = new Set(Array.isArray(storedFavorites) ? storedFavorites.filter(id => getProduct(id)).map(Number) : []);
const storedCart = readStorage('zavo-cart', []);
function normalizeCart(items) {
  const quantities = new Map();
  for (const item of Array.isArray(items) ? items : []) {
    const product = item && getProduct(item.id);
    if (!product?.available || !Number.isSafeInteger(item.quantity) || item.quantity <= 0) continue;
    quantities.set(product.id, Math.min(99, product.stock, (quantities.get(product.id) || 0) + Math.min(item.quantity, 99)));
  }
  return [...quantities].map(([id, quantity]) => ({ id, quantity }));
}
let cart = normalizeCart(storedCart);
let restorePreferences = !ZavoStore.isConnected() && ZavoBackend.configured();
const state = { category: 'all', query: '', sort: 'featured', favoritesOnly: false, discountsOnly: false, minPrice: null, maxPrice: null, stockOnly: false };
const grid = document.querySelector('#product-grid');
const searchInput = document.querySelector('#search-input');
const cartDialog = document.querySelector('#cart-dialog');
const detailsDialog = document.querySelector('#details-dialog');
let detailsProductId = null;
let detailsInstallmentPeriod = 12;
const toast = document.querySelector('#toast');
let toastTimeout;
function notify(message) {
  clearTimeout(toastTimeout);
  const host = detailsDialog.open ? detailsDialog : cartDialog.open ? cartDialog : document.body;
  if (toast.parentElement !== host) host.append(toast);
  if (detailsDialog.open) {
    document.querySelector('#details-feedback').textContent = message;
    document.querySelector('#details-feedback').hidden = false;
  }
  if (cartDialog.open) {
    const feedback = document.querySelector('#cart-feedback');
    feedback.textContent = message;
    feedback.hidden = false;
  }
  toast.textContent = message;
  toast.classList.add('visible');
  toastTimeout = setTimeout(() => toast.classList.remove('visible'), 3400);
}
function save() {
  if (!ZavoStore.isConnected() && ZavoBackend.configured()) return;
  try {
    localStorage.setItem('zavo-cart', JSON.stringify(cart));
    localStorage.setItem('zavo-favorites', JSON.stringify([...favorites]));
  } catch { /* The shop still works when browser storage is unavailable. */ }
}
function normalize(value) { return value.toLocaleLowerCase('uz-UZ').replace(/[‘’ʻʼ`]/g, "'"); }
function productCard(product, index) {
  const category = categories.find(item => item.id === product.category);
  return `<article class="product-card" style="animation-delay:${Math.min(index * 45, 270)}ms">
    <div class="product-image"><span class="product-badge ${product.oldPrice ? 'sale' : ''}">${escapeHTML(product.badge)}</span>
    <button class="favorite-toggle" data-favorite="${product.id}" aria-label="${escapeHTML(product.name)} — ${favorites.has(product.id) ? 'saralanganlardan olib tashlash' : 'saralanganlarga qo‘shish'}" aria-pressed="${favorites.has(product.id)}">${icon('heart')}</button>
    <img src="${escapeHTML(product.image)}" alt="${escapeHTML(product.alt)}" loading="lazy" width="600" height="500"></div>
    <div class="product-info"><span class="product-category">${escapeHTML(category.name)}</span><h3>${escapeHTML(product.name)}</h3><span class="availability ${product.available ? 'in-stock' : 'out-of-stock'}"><span aria-hidden="true"></span>${product.available ? 'Sotuvda' : 'Tugadi'}</span>
    <div class="product-price-block"><span class="product-old">${product.oldPrice ? `${money(product.oldPrice)} so‘m` : '&nbsp;'}</span>
    <span class="price-caption">Naqd narx</span><strong class="product-price">${money(product.price)} <small>so‘m</small></strong>
    ${product.installment ? `<div class="product-monthly" title="12 oyga bo‘lib to‘lash; yakuniy shartlar kelishiladi"><strong>${money(calculateInstallment(product.price, 12).monthlyPayment)} so‘m</strong><span>/ oy · 12 oy*</span></div>` : `<div class="product-monthly">Faqat naqd to‘lov</div>`}</div>
    <button class="buy-button" data-buy="${product.id}" aria-label="${escapeHTML(product.name)} — ${product.available ? 'savatga qo‘shish' : 'Tugadi'}" ${product.available ? '' : 'disabled'}>${icon('bag')}${product.available ? 'Sotib olish' : 'Tugadi'}</button><button class="details-button" data-details="${product.id}" aria-label="${escapeHTML(product.name)} — batafsil ma’lumot" aria-haspopup="dialog">Batafsil ${icon('arrow')}</button></div></article>`;
}
function showDetails(id) {
  const product = getProduct(id);
  if (!product) return;
  detailsProductId = product.id;
  detailsInstallmentPeriod = 12;
  closeMenu();
  const image = document.querySelector('#details-image');
  image.src = product.image;
  image.alt = product.alt;
  renderDetailImages(product);
  document.querySelector('#details-title').textContent = product.name;
  document.querySelector('#details-category').textContent = categories.find(category => category.id === product.category).name;
  document.querySelector('#details-price').textContent = `${money(product.price)} so‘m`;
  document.querySelector(".product-calculator").hidden = !product.installment;
  document.querySelector("#details-note").textContent = product.description || "Mahsulot ma’lumotlari do‘kon bilan tasdiqlanadi.";
  updateDetailsInstallment(false);
  const oldPrice = document.querySelector('#details-old-price');
  oldPrice.textContent = product.oldPrice ? `${money(product.oldPrice)} so‘m` : '';
  oldPrice.hidden = !product.oldPrice;
  const discount = document.querySelector('#details-discount');
  discount.textContent = product.oldPrice ? `−${Math.round((1 - product.price / product.oldPrice) * 100)}%` : '';
  discount.hidden = !product.oldPrice;
  document.querySelector('#details-specs').replaceChildren(...product.specs.map(spec => {
    const item = document.createElement('li');
    item.textContent = spec;
    return item;
  }));
  document.querySelector('#details-buy').dataset.buy = String(product.id);
  document.querySelector('#details-buy').disabled = !product.available;
  document.querySelector('#details-buy-label').textContent = product.available ? 'Sotib olish' : 'Tugadi';
  const availability = document.querySelector('#details-availability');
  availability.textContent = product.available ? 'Sotuvda — savatga qo‘shishingiz mumkin' : 'Tugadi';
  availability.className = `availability ${product.available ? 'in-stock' : 'out-of-stock'}`;
  document.querySelector('#details-buy').setAttribute('aria-label', `${product.name} — savatga qo‘shish`);
  document.querySelector('#details-feedback').hidden = true;
  if (!detailsDialog.open) detailsDialog.showModal();
  document.body.style.overflow = 'hidden';
}
function updateDetailsInstallment(animate = true) {
  const product = getProduct(detailsProductId);
  if (!product) return;
  const plan = calculateInstallment(product.price, detailsInstallmentPeriod);
  document.querySelector('#details-monthly').textContent = `${money(plan.monthlyPayment)} so‘m`;
  document.querySelector('#details-calculator-cash').textContent = `${money(plan.cashPrice)} so‘m`;
  document.querySelector('#details-installment-total').textContent = `${money(plan.totalPrice)} so‘m`;
  document.querySelector('#details-selected-period').textContent = `${plan.months} oy`;
  const rounding = document.querySelector('#details-rounding-note');
  rounding.hidden = plan.lastPayment === plan.monthlyPayment;
  rounding.textContent = `Yaxlitlash tufayli oxirgi oy to‘lovi ${money(plan.lastPayment)} so‘m bo‘ladi. Jami to‘lov o‘zgarmaydi.`;
  document.querySelectorAll('input[name="details-period"]').forEach(input => {
    input.checked = Number(input.value) === plan.months;
  });
  const result = document.querySelector('#details-calculator-results');
  if (animate && typeof result.animate === 'function' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    result.getAnimations().forEach(animation => animation.cancel());
    result.animate([{ opacity: .45, transform: 'translateY(4px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 220, easing: 'ease-out' });
  }
}
document.querySelectorAll('input[name="details-period"]').forEach(input => {
  input.addEventListener('change', () => {
    const period = Number(input.value);
    if (!input.checked || !installmentPeriods.includes(period)) return;
    detailsInstallmentPeriod = period;
    updateDetailsInstallment();
  });
});
function renderProducts() {
  let list = products.filter(product => {
    const categoryName = categories.find(item => item.id === product.category).name;
    return (state.category === 'all' || product.category === state.category)
      && (!state.favoritesOnly || favorites.has(product.id))
      && (!state.discountsOnly || product.oldPrice > product.price)
      && (state.minPrice === null || product.price >= state.minPrice)
      && (state.maxPrice === null || product.price <= state.maxPrice)
      && (!state.stockOnly || product.available)
      && normalize(`${product.name} ${categoryName}`).includes(normalize(state.query));
  });
  if (state.sort === 'low') list.sort((a, b) => a.price - b.price);
  if (state.sort === 'high') list.sort((a, b) => b.price - a.price);
  grid.innerHTML = list.map(productCard).join('');
  document.querySelector('#empty-state').hidden = list.length > 0;
  const priceSummary = state.minPrice !== null || state.maxPrice !== null ? ` · ${money(state.minPrice ?? 0)} so‘mdan${state.maxPrice !== null ? ` ${money(state.maxPrice)} so‘mgacha` : ''}` : '';
  document.querySelector('#catalog-status').textContent = `${list.length} ta mahsulot${state.favoritesOnly ? ' · Saralanganlar' : ''}${state.discountsOnly ? ' · Chegirmali takliflar' : ''}${state.category !== 'all' ? ` · ${categories.find(item => item.id === state.category).name}` : ''}${priceSummary}${state.stockOnly ? ' · Faqat mavjud mahsulotlar' : ''}`;
  document.querySelector('#empty-title').textContent = state.favoritesOnly ? 'Saralangan mahsulot topilmadi' : 'Mahsulot topilmadi';
  document.querySelector('#empty-description').textContent = state.favoritesOnly && favorites.size === 0 ? 'Yoqtirgan mahsulotingizdagi yurak belgisini bosing — u shu yerda saqlanadi.' : 'Qidiruvni o‘zgartiring yoki kategoriya va narx filtrlarini tozalang.';
  document.querySelector('#clear-filters').hidden = !(state.category !== 'all' || state.query || state.minPrice !== null || state.maxPrice !== null || state.stockOnly || state.discountsOnly || state.favoritesOnly || state.sort !== 'featured');
  document.querySelectorAll('[data-filter]').forEach(button => {
    const active = button.dataset.filter === state.category;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  document.querySelector('#favorites-button').setAttribute('aria-pressed', String(state.favoritesOnly));
  document.querySelector('#favorites-button').setAttribute('aria-label', `Saralangan mahsulotlar — ${favorites.size} ta`);
  document.querySelector('#wishlist-count').textContent = favorites.size;
  document.querySelector('#wishlist-count').hidden = favorites.size === 0;
}
function renderCart() {
  updateCheckout();
  const previousCopy = document.querySelector('#order-copy-text');
  if (previousCopy) previousCopy.remove();
  document.querySelector('#cart-feedback').hidden = true;
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  document.querySelector('#cart-count').textContent = count;
  document.querySelectorAll('.cart-trigger').forEach(button => button.setAttribute('aria-label', `Savatni ochish — ${count} ta mahsulot`));
  document.querySelector('#cart-summary').hidden = cart.length === 0;
  document.querySelector('#cart-total').textContent = `${money(cart.reduce((sum, item) => sum + getProduct(item.id).price * item.quantity, 0))} so‘m`;
  document.querySelector('#cart-items').innerHTML = cart.length ? cart.map(item => {
    const product = getProduct(item.id);
    return `<div class="cart-item"><img src="${escapeHTML(product.image)}" alt="${escapeHTML(product.alt)}" width="73" height="85"><div class="cart-item-info"><h3>${escapeHTML(product.name)}</h3><span class="cart-item-price">${money(product.price)} so‘m</span><div class="quantity-controls"><button data-quantity="${item.id}" data-change="-1" aria-label="${escapeHTML(product.name)} sonini kamaytirish">−</button><span>${item.quantity}</span><button data-quantity="${item.id}" data-change="1" aria-label="${escapeHTML(product.name)} sonini oshirish" ${item.quantity >= Math.min(99, product.stock) ? 'disabled' : ''}>+</button><button class="remove-item" data-remove="${item.id}">O‘chirish</button></div></div></div>`;
  }).join('') : `<div class="cart-empty">${icon('bag')}<h3>Savatingiz hozircha bo‘sh</h3><p>O‘zingizga yoqqan mahsulotni tanlang.<br>Tanlovlaringiz shu yerda saqlanadi.</p><button class="button button-dark" data-continue-shopping>Xaridni boshlash ${icon('arrow')}</button></div>`;
}
function chooseCategory(category, resetQuery = false) {
  if (category !== 'all' && !categories.some(item => item.id === category)) return;
  state.category = category;
  state.favoritesOnly = false;
  state.discountsOnly = false;
  if (resetQuery) { state.query = ''; searchInput.value = ''; }
  renderProducts();
}
function scrollToCatalog() { document.querySelector('#catalog').scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }); }
function closeMenu() {
  document.querySelector('#main-nav').classList.remove('open');
  document.querySelector('#menu-button').setAttribute('aria-expanded', 'false');
  document.querySelector('#menu-button').setAttribute('aria-label', 'Menyuni ochish');
}

document.querySelector('#filter-tabs').innerHTML = [{ id: 'all', name: 'Barchasi' }, ...categories].map(category => `<button class="filter-tab" data-filter="${category.id}" aria-pressed="false">${escapeHTML(category.name)}</button>`).join('');
document.querySelector('#category-grid').innerHTML = categories.map(category => {
  return `<button class="category-button" data-filter="${category.id}" aria-pressed="false"><img class="category-image" src="${escapeHTML(category.image)}" alt="" loading="lazy" width="600" height="400"><span class="category-content"><span class="category-icon">${icon(category.icon)}</span><span class="category-name">${escapeHTML(category.name)}</span><span class="category-description">${escapeHTML(category.description)}</span></span><span class="category-arrow">${icon('arrow')}</span></button>`;
}).join('');
document.addEventListener('click', event => {
  if (checkoutSubmitting && event.target.closest('[data-buy], [data-quantity], [data-remove]')) { notify('Buyurtma yuborilmoqda. Bir oz kuting.'); return; }
  const filter = event.target.closest('[data-filter]');
  if (filter) {
    const categoryCard = filter.classList.contains('category-button');
    chooseCategory(filter.dataset.filter, categoryCard);
    if (categoryCard) scrollToCatalog();
  }
  const link = event.target.closest('[data-filter-link]');
  if (link) chooseCategory(link.dataset.filterLink, true);
  if (event.target.closest('[data-continue-shopping]')) { cartDialog.close(); scrollToCatalog(); }
  const details = event.target.closest('[data-details]');
  if (details) showDetails(details.dataset.details);
  const favorite = event.target.closest('[data-favorite]');
  if (favorite) {
    const id = Number(favorite.dataset.favorite);
    if (!getProduct(id)) return;
    if (favorites.has(id)) favorites.delete(id); else favorites.add(id);
    save();
    if (state.favoritesOnly) {
      renderProducts();
      document.querySelector('#favorites-button').focus();
    }
    else {
      favorite.setAttribute('aria-pressed', String(favorites.has(id)));
      favorite.setAttribute('aria-label', `${getProduct(id).name} — ${favorites.has(id) ? 'saralanganlardan olib tashlash' : 'saralanganlarga qo‘shish'}`);
      document.querySelector('#favorites-button').setAttribute('aria-label', `Saralangan mahsulotlar — ${favorites.size} ta`);
      document.querySelector('#wishlist-count').textContent = favorites.size;
      document.querySelector('#wishlist-count').hidden = favorites.size === 0;
    }
    notify(favorites.has(id) ? 'Saralanganlarga qo‘shildi' : 'Saralanganlardan olib tashlandi');
  }
  const buy = event.target.closest('[data-buy]');
  if (buy) {
    const id = Number(buy.dataset.buy);
    const product = getProduct(id);
    if (!product) return;
    if (!product.available) { notify('Bu mahsulot hozircha mavjud emas. Boshqa mahsulot tanlang.'); return; }
    const existing = cart.find(item => item.id === id);
    if (existing && existing.quantity >= Math.min(99, product.stock)) { notify('Ombordagi mavjud miqdorga yetdingiz.'); return; }
    if (existing) existing.quantity++; else cart.push({ id, quantity: 1 });
    save(); renderCart(); notify('Mahsulot savatga qo‘shildi');
  }
  if (event.target.closest('.cart-trigger') && !cartDialog.open) {
    if (detailsDialog.open) detailsDialog.close();
    closeMenu();
    document.querySelector('#cart-feedback').hidden = true;
    cartDialog.showModal();
    window.ZavoCustomer?.prefill?.();
    ensureCaptcha().catch(error=>notify(error.message));
    document.body.style.overflow = 'hidden';
  }
  const quantity = event.target.closest('[data-quantity]');
  if (quantity) {
    const id = Number(quantity.dataset.quantity);
    const item = cart.find(entry => entry.id === id);
    if (!item) return;
    const change = Number(quantity.dataset.change);
    if (![1, -1].includes(change)) return;
    item.quantity = Math.min(99, getProduct(id).stock, item.quantity + change);
    cart = cart.filter(entry => entry.quantity > 0);
    save(); renderCart();
    const replacement = document.querySelector(`[data-quantity="${id}"][data-change="${quantity.dataset.change}"]`);
    if (replacement) replacement.focus();
    else document.querySelector('#cart-close').focus();
  }
  const remove = event.target.closest('[data-remove]');
  if (remove) { cart = cart.filter(item => item.id !== Number(remove.dataset.remove)); save(); renderCart(); document.querySelector('#cart-close').focus(); }
});
document.querySelector('#search-form').addEventListener('submit', event => { event.preventDefault(); closeMenu(); scrollToCatalog(); });
searchInput.addEventListener('input', () => {
  state.query = searchInput.value.trim();
  renderProducts();
});
document.querySelector('#sort-select').addEventListener('change', event => { state.sort = event.target.value; renderProducts(); });
document.querySelector('#favorites-button').addEventListener('click', () => {
  state.favoritesOnly = !state.favoritesOnly;
  state.discountsOnly = false;
  state.category = 'all';
  state.query = '';
  searchInput.value = '';
  renderProducts(); scrollToCatalog();
});
document.querySelector('#discount-button').addEventListener('click', () => {
  resetCatalog(); state.discountsOnly = true; renderProducts(); scrollToCatalog();
});
function resetCatalog() {
  Object.assign(state, { category: 'all', query: '', sort: 'featured', favoritesOnly: false, discountsOnly: false, minPrice: null, maxPrice: null, stockOnly: false });
  searchInput.value = '';
  document.querySelector('#sort-select').value = 'featured';
  document.querySelector('#price-form').reset();
  document.querySelector('#available-only').checked = false;
  clearPriceError();
  renderProducts();
}
function clearPriceError() {
  document.querySelector('#price-error').hidden = true;
  document.querySelectorAll('#price-form input').forEach(input => input.removeAttribute('aria-invalid'));
}
function parsePrice(input) {
  if (input.validity?.badInput) return NaN;
  if (!input.value.trim()) return null;
  const value = Number(input.value);
  return Number.isSafeInteger(value) && value >= 0 ? value : NaN;
}
document.querySelector('#price-form').addEventListener('submit', event => {
  event.preventDefault();
  const minInput = document.querySelector('#min-price');
  const maxInput = document.querySelector('#max-price');
  const min = parsePrice(minInput);
  const max = parsePrice(maxInput);
  clearPriceError();
  if (Number.isNaN(min) || Number.isNaN(max) || (min !== null && max !== null && min > max)) {
    const error = document.querySelector('#price-error');
    error.textContent = Number.isNaN(min) || Number.isNaN(max) ? 'Narxni manfiy bo‘lmagan butun son sifatida kiriting.' : 'Eng kam narx eng ko‘p narxdan katta bo‘lmasligi kerak.';
    error.hidden = false;
    const invalid = Number.isNaN(max) ? maxInput : minInput;
    invalid.setAttribute('aria-invalid', 'true');
    invalid.focus();
    return;
  }
  state.minPrice = min;
  state.maxPrice = max;
  renderProducts();
});
document.querySelector('#available-only').addEventListener('change', event => { state.stockOnly = event.target.checked; renderProducts(); });
document.querySelector('#reset-filters').addEventListener('click', resetCatalog);
document.querySelector('#clear-filters').addEventListener('click', resetCatalog);
document.querySelector('#menu-button').addEventListener('click', () => {
  const open = document.querySelector('#main-nav').classList.toggle('open');
  document.querySelector('#menu-button').setAttribute('aria-expanded', String(open));
  document.querySelector('#menu-button').setAttribute('aria-label', open ? 'Menyuni yopish' : 'Menyuni ochish');
});
document.querySelector('#main-nav').addEventListener('click', event => { if (event.target.closest('a')) closeMenu(); });
document.addEventListener('click', event => {
  if (!event.target.closest('.site-header')) closeMenu();
});
window.matchMedia('(min-width: 701px)').addEventListener('change', closeMenu);
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && document.querySelector('#main-nav').classList.contains('open')) {
    closeMenu();
    document.querySelector('#menu-button').focus();
  }
  if (event.key === '/' && !event.ctrlKey && !event.metaKey && !cartDialog.open && !detailsDialog.open && !event.target.closest('input, textarea, select, [contenteditable]')) { event.preventDefault(); searchInput.focus(); }
});
document.querySelector('#cart-close').addEventListener('click', () => cartDialog.close());
cartDialog.addEventListener('close', () => { document.body.style.overflow = ''; if (toast.parentElement === cartDialog) document.body.append(toast); });
cartDialog.addEventListener('click', event => {
  if (event.target === cartDialog) {
    const bounds = cartDialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) cartDialog.close();
  }
});
document.querySelector('#cart-contact').addEventListener('click', () => cartDialog.close());
document.querySelector('#details-close').addEventListener('click', () => detailsDialog.close());
detailsDialog.addEventListener('close', () => {
  if (!cartDialog.open) document.body.style.overflow = '';
  if (toast.parentElement === detailsDialog) document.body.append(toast);
});
detailsDialog.addEventListener('click', event => {
  if (event.target !== detailsDialog) return;
  const bounds = detailsDialog.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) detailsDialog.close();
});
document.querySelector('#copy-order').addEventListener('click', async () => {
  if (!cart.length) return;
  const total = cart.reduce((sum, item) => sum + getProduct(item.id).price * item.quantity, 0);
  const message = `ZAVO.UZB — buyurtma so‘rovi\n\n${cart.map(item => `${getProduct(item.id).name} × ${item.quantity} — ${money(getProduct(item.id).price * item.quantity)} so‘m`).join('\n')}\n\nJami: ${money(total)} so‘m\nNarxlar namunaviy. Yakuniy narx va mavjudlikni tasdiqlashingizni so‘rayman.`;
  try { await navigator.clipboard.writeText(message); notify('Buyurtma ma’lumotlari nusxalandi'); }
  catch {
    const area = document.querySelector('#order-copy-text') || document.createElement('textarea');
    area.id = 'order-copy-text';
    area.value = message; area.setAttribute('aria-label', 'Nusxalash uchun buyurtma matni');
    if (!area.isConnected) document.querySelector('#cart-summary').append(area);
    area.focus(); area.select();
    notify('Matnni Ctrl+C orqali nusxalang.');
  }
});
if (STORE.phone) document.querySelector('#contact-phone').textContent = STORE.phone;
if (STORE.address) document.querySelector('#contact-address').textContent = STORE.address;
const phoneNumber = STORE.phone.replace(/[\s().-]/g, '');
document.querySelectorAll('[data-phone-link]').forEach(link => {
  if (/^\+?\d{9,15}$/.test(phoneNumber)) link.href = `tel:${phoneNumber}`;
  else link.addEventListener('click', event => {
    event.preventDefault();
    closeMenu();
    notify('Telefon raqami hali qo‘shilmagan. Tez orada e’lon qilinadi.');
  });
});
let configuredSocials = 0;
for (const name of ['telegram', 'instagram']) {
  let valid = false;
  let destination = '';
  try {
    const url = new URL(STORE[name]);
    valid = url.protocol === 'https:' && (name === 'telegram' ? ['t.me', 'telegram.me'].includes(url.hostname) : ['instagram.com', 'www.instagram.com'].includes(url.hostname));
    if (valid) { destination = url.href; configuredSocials++; }
  } catch { /* Keep the contact section as the destination until configured. */ }
  document.querySelectorAll(`[data-social="${name}"]`).forEach(link => {
    if (valid) { link.href = destination; link.target = '_blank'; link.rel = 'noopener noreferrer'; }
    else link.addEventListener('click', event => { event.preventDefault(); notify('Rasmiy havola hali qo‘shilmagan. Tez orada e’lon qilinadi.'); });
  });
}
document.querySelector('#social-note').hidden = configuredSocials === 2;

// A failed remote image gets a local, branded fallback rather than a broken icon.
function handleImageError(event) {
  const image = event.target;
  if (!(image instanceof HTMLImageElement) || image.dataset.fallback) return;
  image.dataset.fallback = 'true';
  const fallback = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="500" viewBox="0 0 600 500"><rect width="600" height="500" fill="#e8ece5"/><circle cx="300" cy="205" r="90" fill="#d4decb"/><path d="M255 185h90v75h-90zM278 185v-15a22 22 0 0 1 44 0v15" fill="none" stroke="#6b805a" stroke-width="5"/><text x="300" y="355" text-anchor="middle" font-family="Arial,sans-serif" font-size="27" font-weight="700" fill="#0d1420">ZAVO.UZB</text><text x="300" y="388" text-anchor="middle" font-family="Arial,sans-serif" font-size="14" fill="#66735c">Mahsulot rasmi yuklanmadi</text></svg>`;
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(fallback)}`;
}
document.addEventListener('error', handleImageError, true);
document.querySelectorAll('img').forEach(image => {
  if (image.complete && image.naturalWidth === 0) handleImageError({ target: image });
});

const header = document.querySelector('.site-header');
function updateHeader() { header.classList.toggle('scrolled', window.scrollY > 12); }
window.addEventListener('scroll', updateHeader, { passive: true });
updateHeader();
if ('ResizeObserver' in window) {
  new ResizeObserver(() => {
    document.documentElement.style.setProperty('--header-height', `${Math.ceil(header.getBoundingClientRect().height)}px`);
  }).observe(header);
}
document.querySelector('#year').textContent = new Date().getFullYear();
const installmentSelect = document.querySelector('#installment-product');
installmentSelect.innerHTML = products.map(product => `<option value="${product.id}" ${product.id === 3 ? 'selected' : ''}>${escapeHTML(product.name)}</option>`).join('');
if (!getProduct(installmentSelect.value)) installmentSelect.value = String(products[0]?.id || '');
let installmentTerm = 12;
function updateInstallment() {
  const product = getProduct(installmentSelect.value);
  document.querySelector('.installment-terms').hidden = !product?.installment;
  document.querySelector('.page-installment-summary').hidden = !product?.installment;
  document.querySelector('#installment-monthly-block').hidden = !product?.installment;
  if (!product) { document.querySelector('#installment-total').textContent = '—'; document.querySelector('#installment-note').textContent = 'Katalog hozircha bo‘sh.'; return; }
  document.querySelector('#installment-note').textContent = product.installment ? 'Yakuniy to‘lov shartlari do‘kon bilan kelishiladi.' : 'Bu mahsulot uchun faqat naqd to‘lov mavjud.';
  const plan = calculateInstallment(product.price, installmentTerm);
  document.querySelector('#installment-total').textContent = `${money(product.price)} so‘m`;
  document.querySelector('#installment-monthly').textContent = money(plan.monthlyPayment);
  document.querySelector('#installment-term-label').textContent = `Oyiga to‘lov · ${installmentTerm} oy`;
  document.querySelector('#installment-plan-total').textContent = `${money(plan.totalPrice)} so‘m`;
  document.querySelector('#installment-selected-period').textContent = `${installmentTerm} oy`;
  document.querySelectorAll('[data-term]').forEach(button => {
    const active = Number(button.dataset.term) === installmentTerm;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}
installmentSelect.addEventListener('change', updateInstallment);
document.querySelectorAll('[data-term]').forEach(button => button.addEventListener('click', () => {
  const period = Number(button.dataset.term);
  if (!installmentPeriods.includes(period)) return;
  installmentTerm = period;
  updateInstallment();
}));
updateInstallment();
renderProducts(); renderCart();
if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); } });
  }, { threshold: 0.08 });
  document.querySelectorAll('.section, .about-layout').forEach(section => { section.classList.add('reveal'); observer.observe(section); });
}

function updateCheckout() {
  const ready=ZavoStore.isConnected() && !!ZavoBackend.config.turnstileSiteKey;
  document.querySelector('#checkout-submit').disabled=!ready || checkoutSubmitting || cart.length===0;
  document.querySelector('#checkout-service-note').hidden=ready;
  const payment=document.querySelector('#checkout-payment');
  const eligible=cart.length>0&&cart.every(item=>getProduct(item.id)?.installment);
  payment.querySelector('option[value="installment"]').disabled=!eligible;
  if(!eligible)payment.value='cash';
  const monthly=payment.value==='installment';
  document.querySelector('#checkout-period-label').hidden=!monthly;
  const total=cart.reduce((sum,item)=>sum+(getProduct(item.id)?.price||0)*item.quantity,0);
  const result=document.querySelector('#checkout-plan');
  if(!total){result.textContent='';return;}
  const plan=monthly?calculateInstallment(total,Number(document.querySelector('#checkout-months').value)):null;
  result.textContent=plan?`Oyiga to‘lov: ${money(plan.monthlyPayment)} so‘m / oy · Jami to‘lov: ${money(plan.totalPrice)} so‘m`:`Naqd narx: ${money(total)} so‘m`;
}
let refreshPromise, captchaPromise, captchaWidget;
async function refreshSharedProducts(){
 if(refreshPromise)return refreshPromise;
 refreshPromise=(async()=>{
  try{await ZavoStore.refresh(false);products=ZavoStore.getProducts();if(restorePreferences&&ZavoStore.isConnected()){const cachedCart=readStorage('zavo-cart',[]),cachedFavorites=readStorage('zavo-favorites',[]);cart=normalizeCart(cachedCart);if(Array.isArray(cachedFavorites))for(const id of cachedFavorites)if(getProduct(id))favorites.add(Number(id));restorePreferences=false;}if(state.category!=='all'&&!categories.some(c=>c.id===state.category))state.category='all';
   cart=normalizeCart(cart);for(const id of favorites)if(!getProduct(id))favorites.delete(id);
   renderCategories();save();renderProducts();renderCart();const selected=installmentSelect.value;installmentSelect.innerHTML=products.map(p=>`<option value="${p.id}">${escapeHTML(p.name)}</option>`).join('');installmentSelect.value=getProduct(selected)?selected:String(products[0]?.id||'');updateInstallment();renderBanners();updateConnection();
   if(detailsDialog.open){if(getProduct(detailsProductId))showDetails(detailsProductId);else detailsDialog.close();}
  }catch{updateConnection('Katalogni yangilab bo‘lmadi. Internet aloqasini tekshiring.');updateCheckout();}
 })();try{await refreshPromise;}finally{refreshPromise=null;}
}
function renderCategories(){
 document.querySelector('#filter-tabs').innerHTML=[{id:'all',name:'Barchasi'},...categories].map(c=>`<button class="filter-tab" data-filter="${escapeHTML(c.id)}" aria-pressed="false">${escapeHTML(c.name)}</button>`).join('');
 document.querySelector('#category-grid').innerHTML=categories.map(c=>`<button class="category-button" data-filter="${escapeHTML(c.id)}" aria-pressed="false">${c.image?`<img class="category-image" src="${escapeHTML(c.image)}" alt="" loading="lazy" width="600" height="400">`:''}<span class="category-content"><span class="category-icon">${icon(c.icon)}</span><span class="category-name">${escapeHTML(c.name)}</span><span class="category-description">${escapeHTML(c.description)}</span></span><span class="category-arrow">${icon('arrow')}</span></button>`).join('');
}
function updateConnection(error=''){
 const node=document.querySelector('#store-connection');node.hidden=ZavoStore.isConnected()&&!error;
 node.textContent=error||(ZavoBackend.configured()?'Katalogni yuklab bo‘lmadi. Keyinroq qayta urinib ko‘ring.':'Onlayn buyurtma hozircha mavjud emas. Mahsulotlar namuna sifatida ko‘rsatilgan.');
}
function renderDetailImages(product){
 const host=document.querySelector('#details-thumbnails');host.hidden=(product.images?.length||0)<2;
 host.replaceChildren(...(product.images||[]).map((image,index)=>{const button=document.createElement('button');button.type='button';button.setAttribute('aria-label',`${index+1}-rasmni ko‘rish`);button.setAttribute('aria-pressed',String(index===0));const img=document.createElement('img');img.src=image.url;img.alt='';button.append(img);button.addEventListener('click',()=>{document.querySelector('#details-image').src=image.url;host.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));});return button;}));
}
async function ensureCaptcha(){
 if(!ZavoStore.isConnected()||!ZavoBackend.config.turnstileSiteKey)return;
 if(captchaWidget!==undefined)return;
 if(captchaPromise)return captchaPromise;
 captchaPromise=(async()=>{
  if(!window.turnstile)await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=true;script.onload=resolve;script.onerror=()=>reject(new Error('Xavfsizlik tekshiruvi yuklanmadi. Internet aloqasini tekshiring.'));document.head.append(script);});
  captchaWidget=window.turnstile.render('#checkout-captcha',{sitekey:ZavoBackend.config.turnstileSiteKey,action:'checkout',theme:'dark',language:'auto','error-callback':()=>{document.querySelector('#checkout-error').textContent='Xavfsizlik tekshiruvini qayta bajaring.';document.querySelector('#checkout-error').hidden=false;}});
 })();try{await captchaPromise;}finally{captchaPromise=null;}
}
const heroDefault={title:document.querySelector('#hero-title').innerHTML,subtitle:document.querySelector('.hero-copy>p').innerHTML,image:document.querySelector('.hero-visual>img').src,alt:document.querySelector('.hero-visual>img').alt,button:document.querySelector('.hero-actions>.button').innerHTML,link:document.querySelector('.hero-actions>.button').getAttribute('href')};
let bannerIndex=0,bannerSignature='';
function renderBanners(){
 const list=ZavoStore.getBanners();const signature=JSON.stringify(list);if(signature!==bannerSignature){bannerIndex=0;bannerSignature=signature;}
 const b=list[bannerIndex%Math.max(1,list.length)],title=document.querySelector('#hero-title'),subtitle=document.querySelector('.hero-copy>p'),image=document.querySelector('.hero-visual>img'),button=document.querySelector('.hero-actions>.button');
 document.querySelector('#banner-controls').hidden=list.length<2;
 if(!b){title.innerHTML=heroDefault.title;subtitle.innerHTML=heroDefault.subtitle;image.src=heroDefault.image;image.alt=heroDefault.alt;button.innerHTML=heroDefault.button;button.setAttribute('href',heroDefault.link);button.hidden=false;return;}
 title.textContent=b.title;subtitle.textContent=b.subtitle;image.src=b.image_url||heroDefault.image;image.alt=b.title;button.textContent=b.button_text;button.setAttribute('href',b.link);button.hidden=!b.button_text;document.querySelector('#banner-counter').textContent=`${bannerIndex+1} / ${list.length}`;
}
document.querySelector('#banner-prev').addEventListener('click',()=>{const length=ZavoStore.getBanners().length;bannerIndex=(bannerIndex-1+length)%Math.max(1,length);renderBanners();});document.querySelector('#banner-next').addEventListener('click',()=>{bannerIndex=(bannerIndex+1)%Math.max(1,ZavoStore.getBanners().length);renderBanners();});
window.addEventListener('storage',event=>{if(event.key==='zavo-catalog-migration-refresh')refreshSharedProducts();});
window.addEventListener('focus',refreshSharedProducts);ZavoStore.subscribe(refreshSharedProducts);setInterval(()=>{if(!document.hidden&&ZavoBackend.configured())refreshSharedProducts();},60000);
document.querySelector('#checkout-payment').addEventListener('change',updateCheckout);document.querySelector('#checkout-months').addEventListener('change',updateCheckout);
document.querySelector('#checkout-form').addEventListener('submit',async event=>{
 event.preventDefault();if(checkoutSubmitting)return;const form=event.currentTarget,error=document.querySelector('#checkout-error'),submit=document.querySelector('#checkout-submit');error.hidden=true;
 if(!cart.length){error.textContent='Avval savatga mahsulot qo‘shing.';error.hidden=false;return;}
 // Keep the request and its retry fingerprint identical during background catalog refreshes.
 const orderItems=cart.map(item=>({...item}));
 checkoutSubmitting=true;submit.disabled=true;const previousLabel=submit.textContent;submit.textContent='Yuborilmoqda…';
 try{
  const data=Object.fromEntries(new FormData(form));await ensureCaptcha();const captcha=captchaWidget!==undefined?window.turnstile.getResponse(captchaWidget):'';if(!captcha)throw new Error('Xavfsizlik tekshiruvi hali bajarilmadi. Birozdan so‘ng qayta urinib ko‘ring.');
  const fingerprint=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify({data,cart:orderItems}))))).map(n=>n.toString(16).padStart(2,'0')).join('');let request;try{request=JSON.parse(sessionStorage.getItem('zavo-checkout-request'));}catch{}
  if(!request||request.fingerprint!==fingerprint){request={fingerprint,token:crypto.randomUUID()};try{sessionStorage.setItem('zavo-checkout-request',JSON.stringify(request));}catch{}}
  const order=await ZavoStore.createOrder(data,orderItems,data.payment,Number(data.months),captcha,request.token);cart=[];save();renderCart();form.reset();window.ZavoCustomer?.prefill?.();try{sessionStorage.removeItem('zavo-checkout-request');}catch{}
  notify(`Buyurtmangiz qabul qilindi: ${order.id.slice(0,8).toUpperCase()}. Do‘kon siz bilan bog‘lanadi.`);
 }catch(err){error.textContent=err.message||'Buyurtma yuborilmadi. Qayta urinib ko‘ring.';error.hidden=false;}
 finally{checkoutSubmitting=false;submit.textContent=previousLabel;if(captchaWidget!==undefined)window.turnstile.reset(captchaWidget);updateCheckout();}
});
updateConnection(connectionError);renderBanners();
if(location.hash==='#favorites'){state.favoritesOnly=true;renderProducts();scrollToCatalog();}
})().catch(()=>{const node=document.querySelector('#store-connection');node.hidden=false;node.textContent='Sahifani yuklab bo‘lmadi. Sahifani yangilang.';});
