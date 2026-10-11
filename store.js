'use strict';
window.ZavoStore = (() => {
const categories = [
  { id: 'furniture', name: 'Mebel', icon: 'sofa', description: 'Shinamlik siz tanlagan uslubda' },
  { id: 'carpets', name: 'Gilamlar', icon: 'rug', description: 'Uyingizga iliqlik va fayz' },
  { id: 'appliances', name: 'Maishiy texnika', icon: 'washer', description: 'Kundalik ishlar osonroq' },
  { id: 'tvs', name: 'Televizorlar', icon: 'tv', description: 'Katta ekran. Katta taassurot.' },
  { id: 'phones', name: 'Smartfonlar', icon: 'phone', description: 'Imkoniyatlar qo‘lingizda' },
  { id: 'bicycles', name: 'Velosipedlar', icon: 'bike', description: 'Yangi manzillar sari' },
  { id: 'electronics', name: 'Elektronika', icon: 'headphones', description: 'Hayotingizga mos texnologiya' }
];
const photo = (id, width = 600) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=80`;
const seedProducts = [
  { id: 1, name: 'Luna — yumshoq ikki kishilik divan', category: 'furniture', price: 4800000, oldPrice: 6000000, image: photo('photo-1555041469-a586c61ea9bc'), alt: 'Yashil rangli yumshoq divan', badge: '−20%' },
  { id: 2, name: 'AirWash — avtomatik kir yuvish mashinasi', category: 'appliances', price: 4200000, oldPrice: 0, image: photo('photo-1626806787461-102c1bfaaea1'), alt: 'Oq rangli kir yuvish mashinasi', badge: 'Tavsiya' },
  { id: 3, name: 'Nova — 128 GB smartfon', category: 'phones', price: 3600000, oldPrice: 4000000, image: photo('photo-1511707171634-5f897ff02aa9'), alt: 'Zamonaviy smartfon', badge: '−10%' },
  { id: 4, name: 'Vision — 55 dyuymli Smart TV', category: 'tvs', price: 6400000, oldPrice: 0, image: photo('photo-1593359677879-a4bb92f829d1'), alt: 'Keng ekranli televizor', badge: 'Yangi' },
  { id: 5, name: 'Heritage — naqshli gilam, 200 × 300 sm', category: 'carpets', price: 1600000, oldPrice: 2000000, image: photo('photo-1600166898405-da9535204843'), alt: 'Interyer uchun naqshli gilam', badge: '−20%' },
  { id: 6, name: 'Urban — shahar velosipedi', category: 'bicycles', price: 2800000, oldPrice: 0, image: photo('photo-1485965120184-e220f721d03e'), alt: 'Shahar uchun velosiped', badge: 'Tavsiya' },
  { id: 7, name: 'Sound — simsiz quloqchin', category: 'electronics', price: 720000, oldPrice: 900000, image: photo('photo-1546435770-a3e426bf472b'), alt: 'Yumshoq yostiqchali zamonaviy quloqchin', badge: '−20%' },
  { id: 8, name: 'Forma — yumshoq dizayner kreslosi', category: 'furniture', price: 2400000, oldPrice: 0, image: photo('photo-1567538096630-e0c55bd6374c'), alt: 'Zamonaviy yumshoq kreslo', badge: 'Yangi' },
  { id: 9, name: 'Samsung — 43″ Smart TV', category: 'tvs', price: 3840000, oldPrice: 4800000, badge: '−20%', specs: ['Ekran: 43 dyuym', 'Smart TV funksiyasi', 'HDMI va USB ulanishlari'] },
  { id: 10, name: 'LG — 55″ 4K Smart TV', category: 'tvs', price: 7200000, oldPrice: 8000000, badge: '−10%', specs: ['Ekran: 55 dyuym', '4K tasvir formati', 'Smart TV funksiyasi'] },
  { id: 11, name: 'Samsung Galaxy A35 — 128 GB', category: 'phones', price: 3600000, oldPrice: 4000000, badge: '−10%', specs: ['Xotira: 128 GB', 'Android smartfon', 'Sensorli ekran'] },
  { id: 12, name: 'Apple iPhone 13 — 128 GB', category: 'phones', price: 6600000, oldPrice: 0, badge: 'Tavsiya', specs: ['Xotira: 128 GB', 'iOS smartfon', '6,1 dyuymli ekran'] },
  { id: 13, name: 'Artel — 7 kg kir yuvish mashinasi', category: 'appliances', price: 3360000, oldPrice: 4200000, badge: '−20%', specs: ['Sig‘im: 7 kg', 'Avtomatik yuvish', 'Old tomondan yuklash'] },
  { id: 14, name: 'Samsung — ikki kamerali muzlatkich', category: 'appliances', price: 5760000, oldPrice: 6400000, badge: '−10%', specs: ['Ikki kamerali tuzilma', 'Alohida muzlatish bo‘limi', 'Oq rangli korpus'] },
  { id: 15, name: 'Comfort — burchakli divan', category: 'furniture', price: 7200000, oldPrice: 9000000, badge: '−20%', specs: ['Burchakli shakl', 'Yumshoq mato qoplamasi', 'Rang: och kulrang'] },
  { id: 16, name: 'Nord — 4 kishilik ovqatlanish to‘plami', category: 'furniture', price: 4800000, oldPrice: 0, badge: 'Yangi', specs: ['1 ta stol va 4 ta stul', 'Yog‘och uslubidagi pardoz', 'Uy va oshxona uchun'] },
  { id: 17, name: 'Buxoro — naqshli gilam, 200 × 300 sm', category: 'carpets', price: 1920000, oldPrice: 2400000, badge: '−20%', specs: ['O‘lcham: 200 × 300 sm', 'Klassik naqsh', 'Rang: bej va jigarrang'] },
  { id: 18, name: 'Modern — yumshoq gilam, 160 × 230 sm', category: 'carpets', price: 1320000, oldPrice: 0, badge: 'Yangi', specs: ['O‘lcham: 160 × 230 sm', 'Minimal geometrik naqsh', 'Rang: kulrang'] },
  { id: 19, name: 'Trek — 26″ tog‘ velosipedi', category: 'bicycles', price: 4320000, oldPrice: 4800000, badge: '−10%', specs: ['G‘ildirak: 26 dyuym', 'Tog‘ yo‘llari uchun', 'Sport uslubidagi rama'] },
  { id: 20, name: 'City Ride — 28″ shahar velosipedi', category: 'bicycles', price: 3240000, oldPrice: 3600000, badge: '−10%', specs: ['G‘ildirak: 28 dyuym', 'Shaharda kundalik foydalanish', 'Qulay o‘rindiq'] }
];

// Illustrations deliberately represent placeholders, not exact branded models.
function productPlaceholder(product) {
  const drawings = {
    tvs: '<rect x="110" y="85" width="380" height="240" rx="14" fill="#0d1420"/><rect x="123" y="98" width="354" height="213" rx="6" fill="url(#screen)"/><path d="M270 325v30h60v-30M225 365h150" stroke="#283447" stroke-width="12" stroke-linecap="round"/>',
    phones: '<rect x="215" y="55" width="170" height="310" rx="26" fill="#172233"/><rect x="224" y="65" width="152" height="288" rx="20" fill="url(#screen)"/><rect x="273" y="72" width="54" height="9" rx="5" fill="#0d1420"/><path d="M277 342h46" stroke="#fff" stroke-width="4" stroke-linecap="round"/>',
    appliances: product.id === 14 ? '<rect x="190" y="50" width="220" height="320" rx="15" fill="#fdfefe" stroke="#a1abb2" stroke-width="3"/><path d="M190 163h220M383 100v32M383 200v80" stroke="#97a4a7" stroke-width="5" stroke-linecap="round"/>' : '<rect x="170" y="75" width="260" height="285" rx="18" fill="#fafcfc" stroke="#a1abb2" stroke-width="3"/><path d="M170 135h260" stroke="#c5cece" stroke-width="3"/><circle cx="300" cy="235" r="81" fill="#d6dfdf"/><circle cx="300" cy="235" r="65" fill="url(#screen)"/><circle cx="205" cy="105" r="12" fill="#acbfb4"/><rect x="337" y="94" width="65" height="23" rx="5" fill="#293d49"/>',
    furniture: product.id === 16 ? '<path d="M175 210v120M425 210v120" stroke="#9a7959" stroke-width="15"/><rect x="120" y="175" width="360" height="35" rx="9" fill="#b99c78"/><path d="M150 285v70M245 285v70M355 285v70M450 285v70" stroke="#806648" stroke-width="9"/><rect x="132" y="250" width="130" height="35" rx="9" fill="#b9c8ae"/><rect x="338" y="250" width="130" height="35" rx="9" fill="#b9c8ae"/>' : '<rect x="128" y="130" width="344" height="125" rx="35" fill="#a5b89a"/><rect x="105" y="220" width="390" height="110" rx="28" fill="#93a68a"/><rect x="92" y="188" width="62" height="140" rx="22" fill="#bcccb2"/><rect x="446" y="188" width="62" height="140" rx="22" fill="#bcccb2"/><path d="M168 250h264M300 145v100" stroke="#7d9373" stroke-width="4"/><path d="M140 330v26M460 330v26" stroke="#725c45" stroke-width="12"/>',
    carpets: '<path d="M167 66h266l-40 299H127z" fill="#bfaa8b" stroke="#a58a69" stroke-width="4"/><path d="M186 90h223l-32 249H150z" fill="#e2d5ba" stroke="#8d7863" stroke-width="3"/><path d="m283 123 71 84-91 90-68-90 88-84Z" fill="#a0b098"/><path d="m280 151 43 55-56 56-39-55 52-56Z" fill="#ebe4d4"/><path d="M140 372v14m22-14v14m22-14v14m22-14v14m22-14v14m22-14v14m22-14v14m22-14v14m22-14v14m22-14v14m22-14v14" stroke="#b4a082" stroke-width="4"/>',
    bicycles: '<circle cx="155" cy="285" r="77" fill="none" stroke="#24303e" stroke-width="11"/><circle cx="445" cy="285" r="77" fill="none" stroke="#24303e" stroke-width="11"/><path d="m155 285 92-143 90 143H155m92-143h145l53 143M247 142l-14-33M210 109h50M392 142l-15-43h38" fill="none" stroke="#7d9870" stroke-width="11" stroke-linejoin="round" stroke-linecap="round"/>',
    electronics: '<path d="M198 235v-47a102 102 0 0 1 204 0v47" fill="none" stroke="#172436" stroke-width="24"/><rect x="168" y="210" width="80" height="120" rx="27" fill="#a3b69a"/><rect x="352" y="210" width="80" height="120" rx="27" fill="#a3b69a"/><rect x="218" y="217" width="25" height="105" rx="12" fill="#233446"/><rect x="357" y="217" width="25" height="105" rx="12" fill="#233446"/>'
  };
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="500" viewBox="0 0 600 500"><defs><linearGradient id="screen" x2="1" y2="1"><stop stop-color="#8cae98"/><stop offset=".55" stop-color="#47637b"/><stop offset="1" stop-color="#1d2c42"/></linearGradient><radialGradient id="bg"><stop stop-color="#ffffff"/><stop offset="1" stop-color="#eaf0e6"/></radialGradient></defs><rect width="600" height="500" fill="url(#bg)"/><ellipse cx="300" cy="383" rx="185" ry="17" fill="#0d14200c"/>${drawings[product.category] || drawings.electronics}<text x="300" y="447" text-anchor="middle" font-family="Arial,sans-serif" font-size="14" letter-spacing="4" fill="#778575">ZAVO.UZB</text><text x="300" y="475" text-anchor="middle" font-family="Arial,sans-serif" font-size="11" fill="#778575">NAMUNAVIY TASVIR</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
categories.forEach(category => { category.image = seedProducts.find(product => product.category === category.id).image; });
seedProducts.forEach(product => {
  product.available = ![18, 20].includes(product.id);
  product.stock = product.available ? 10 : 0;
  product.cashPrice = product.oldPrice || product.price;
  product.discountPrice = product.oldPrice ? product.price : 0;
  product.description = product.name;
  product.installment = true;
  if (product.oldPrice > product.price) product.badge = `−${Math.round((1 - product.price / product.oldPrice) * 100)}%`;
  product.image = productPlaceholder(product);
  product.alt = `${product.name} — namunaviy tasvir`;
  product.specs ||= [categories.find(category => category.id === product.category).name, 'Uy va kundalik hayot uchun', 'ZAVO.UZB namunaviy katalogi'];
});
const money = value => new Intl.NumberFormat('uz-UZ').format(value).replace(/\u00a0/g, ' ');
// Pricing configuration is used only in calculations, never in rendered content.
const installmentRates = Object.freeze({ 3: 0.1545, 6: 0.30, 9: 0.40, 12: 0.45 });
const installmentPeriods = Object.keys(installmentRates).map(Number);
function calculateInstallment(cashPrice, months) {
  if (!Number.isSafeInteger(cashPrice) || cashPrice <= 0 || !installmentPeriods.includes(months)) {
    throw new RangeError('Narx yoki to‘lov muddati noto‘g‘ri.');
  }
  const totalPrice = Math.round(cashPrice * (1 + installmentRates[months]));
  if (!Number.isSafeInteger(totalPrice)) throw new RangeError('Hisoblanadigan narx juda katta.');
  const monthlyPayment = Math.round(totalPrice / months);
  return {
    cashPrice,
    months,
    totalPrice,
    monthlyPayment,
    lastPayment: totalPrice - monthlyPayment * (months - 1)
  };
}

return window.createZavoStore({categories,seedProducts,productPlaceholder,money,calculateInstallment,installmentPeriods});
})();
