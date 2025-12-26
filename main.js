// --- 1. VERİ VE AYARLAR (DATABASE) ---
const defaultData = {
    // Ürünlere "currency" alanı eklendi. Fiyatlar o para biriminden girilecek.
    // "relatedIds": Bu ürünle ilişkili diğer ürünlerin ID'leri.
    products: [
        { id: 1, name: "GPSMAP 1223xsv", brand: "Garmin", category: "elektronik", basePrice: 2000, currency: "USD", img: "https://images.unsplash.com/photo-1557804506-669a67965ba0?w=500", desc: "Profesyonel chartplotter ve sonar.", relatedIds: [3, 4] },
        { id: 2, name: "150N Otomatik Can Yeleği", brand: "Lalizas", category: "guvenlik", basePrice: 100, currency: "EUR", img: "https://images.unsplash.com/photo-1616769911429-1a986eb0712d?w=500", desc: "ISO onaylı otomatik şişme yelek.", relatedIds: [5] },
        { id: 3, name: "NMEA 2000 Başlangıç Kiti", brand: "Garmin", category: "elektronik", basePrice: 80, currency: "USD", img: "https://placehold.co/400x300?text=NMEA+Kit", desc: "Ağ kurulum kiti.", relatedIds: [1] },
        { id: 4, name: "Radar Anteni 18HD", brand: "Garmin", category: "elektronik", basePrice: 1500, currency: "USD", img: "https://placehold.co/400x300?text=Radar", desc: "Yüksek çözünürlüklü radar.", relatedIds: [1] },
        { id: 5, name: "Yangın Tüpü 2kg", brand: "Lalizas", category: "guvenlik", basePrice: 1500, currency: "TRY", img: "https://placehold.co/400x300?text=Yangin+Tupu", desc: "Tekne tipi yangın söndürücü.", relatedIds: [2] }
    ],
    slides: [
        { id: 1, title: "Yeni Sezon <br> Tekne Elektroniği", img: "https://images.unsplash.com/photo-1566403487332-95b77c5e2366?w=1600", link: "products" }
    ],
    cart: []
};

// Veriyi Çek veya Oluştur
let db = JSON.parse(localStorage.getItem('marinDB')) || defaultData;
let activeCurrency = "TRY"; // Varsayılan görüntüleme kuru
let exchangeRates = { TRY: 1, USD: 1, EUR: 1 }; // Başlangıç (Fetch ile güncellenecek)

function saveDB() {
    localStorage.setItem('marinDB', JSON.stringify(db));
    // Sadece gerekli yerleri güncellemek daha performanslı olur ama basitlik için:
    if(!document.getElementById('admin-app').classList.contains('hide')) {
        renderAdminProducts();
    } else {
        router(currentPage); 
    }
}

// --- 2. KUR YÖNETİMİ (TCMB SİMÜLASYONU) ---
async function fetchRates() {
    // NOT: Tarayıcı üzerinden doğrudan TCMB'ye (tcmb.gov.tr) istek atmak CORS hatası verir.
    // Gerçek projede backend sunucunuz TCMB'den çeker, frontend backend'den alır.
    // Burada "Simülasyon" yapıyoruz ama mantık birebir aynıdır.
    
    // Simüle edilmiş güncel kurlar (Gerçek hayatta burası API'den gelir)
    const mockApiData = {
        USD: 35.42, // Güncel Dolar Satış
        EUR: 37.15  // Güncel Euro Satış
    };

    // Yükleniyor efekti
    document.getElementById('exchange-rates-info').innerText = "Kurlar güncelleniyor...";

    setTimeout(() => {
        exchangeRates.TRY = 1;
        exchangeRates.USD = mockApiData.USD;
        exchangeRates.EUR = mockApiData.EUR;
        
        document.getElementById('exchange-rates-info').innerText = 
            `$${exchangeRates.USD} - €${exchangeRates.EUR} (TCMB)`;
        
        // Fiyatları güncelle
        router(currentPage); 
    }, 800);
}

function changeCurrency(currency) {
    activeCurrency = currency;
    // Sepeti veya sayfayı yenile
    router(currentPage);
}

// Fiyat Hesaplayıcı Fonksiyon
function formatPrice(amount, baseCurrency) {
    // 1. Önce ürünü TRY'ye çevir
    let priceInTry = 0;
    if (baseCurrency === "TRY") priceInTry = amount;
    else if (baseCurrency === "USD") priceInTry = amount * exchangeRates.USD;
    else if (baseCurrency === "EUR") priceInTry = amount * exchangeRates.EUR;

    // 2. Sonra TRY'den Hedef Kura çevir
    let finalPrice = 0;
    let symbol = "";

    if (activeCurrency === "TRY") {
        finalPrice = priceInTry;
        symbol = "₺";
    } else if (activeCurrency === "USD") {
        finalPrice = priceInTry / exchangeRates.USD;
        symbol = "$";
    } else if (activeCurrency === "EUR") {
        finalPrice = priceInTry / exchangeRates.EUR;
        symbol = "€";
    }

    // Para formatı (Binlik ayracı vs.)
    return new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(finalPrice) + " " + symbol;
}

// --- 3. SAYFA YÖNETİMİ (ROUTER) ---
let currentPage = 'home';
const mainContent = document.getElementById('main-content');

function router(page, param = null) {
    currentPage = page;
    window.scrollTo(0,0);
    mainContent.innerHTML = ""; // Temizle

    if(page === 'home') renderHome();
    else if(page === 'products') renderProducts(param); // param filtre olabilir
    else if(page === 'detail') renderDetail(param); // param ürün ID'si
    else if(page === 'cart') renderCart();
    
    updateCartCount();
}

// --- 4. SAYFA RENDER FONKSİYONLARI ---

function renderHome() {
    // Slider
    let sliderHtml = '';
    if(db.slides.length > 0) {
        const s = db.slides[0]; // Basitlik için ilk slide
        sliderHtml = `
            <div class="relative w-full h-[450px] overflow-hidden group mb-10 rounded-xl shadow-2xl cursor-pointer" onclick="router('${s.link}')">
                <img src="${s.img}" class="w-full h-full object-cover brightness-75 transition duration-700 hover:scale-105">
                <div class="absolute inset-0 flex flex-col justify-center items-center text-center text-white p-4">
                    <h2 class="text-4xl md:text-5xl font-bold mb-4 drop-shadow-lg">${s.title}</h2>
                    <button class="mt-4 px-6 py-3 bg-marine-accent rounded font-bold hover:bg-orange-600 transition">İncele</button>
                </div>
            </div>
        `;
    }

    // Vitrin Ürünleri (İlk 4)
    const featuredHtml = db.products.slice(0, 4).map(p => createProductCard(p)).join('');

    mainContent.innerHTML = `
        ${sliderHtml}
        <section class="mb-12">
            <h2 class="text-2xl font-bold text-marine-dark mb-6 border-l-4 border-marine-accent pl-4">Popüler Ürünler</h2>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                ${featuredHtml}
            </div>
        </section>
        
        <section class="bg-marine-blue text-white rounded-lg p-8 text-center mb-12 shadow-lg">
            <h3 class="text-2xl font-bold mb-2">Sezon Hazırlıkları Başladı mı?</h3>
            <p class="mb-6">Tekneniz için gereken tüm bakım malzemeleri burada.</p>
            <button onclick="router('products')" class="bg-white text-marine-blue px-6 py-2 rounded font-bold hover:bg-gray-100">Alışverişe Başla</button>
        </section>
    `;
}

function renderProducts() {
    const listHtml = db.products.map(p => createProductCard(p)).join('');
    mainContent.innerHTML = `
        <h2 class="text-2xl font-bold text-marine-dark mb-6">Tüm Ürünler</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            ${listHtml}
        </div>
    `;
}

function renderDetail(id) {
    const p = db.products.find(x => x.id == id);
    if(!p) return;

    // Fiyat Hesabı
    const displayPrice = formatPrice(p.basePrice, p.currency);

    // İlişkili Ürünleri Bul
    let relatedHtml = '';
    if(p.relatedIds && p.relatedIds.length > 0) {
        const relatedProds = db.products.filter(item => p.relatedIds.includes(item.id));
        if(relatedProds.length > 0) {
            relatedHtml = `
                <div class="mt-16 border-t pt-8">
                    <h3 class="text-xl font-bold text-marine-dark mb-6">Bunu Alanlar Bunları da Aldı</h3>
                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        ${relatedProds.map(rp => createProductCard(rp)).join('')}
                    </div>
                </div>
            `;
        }
    }

    mainContent.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-lg">
            <div class="flex flex-col md:flex-row gap-8">
                <div class="w-full md:w-1/2">
                    <img src="${p.img}" class="w-full h-96 object-contain border rounded-lg bg-white">
                </div>
                <div class="w-full md:w-1/2">
                    <div class="text-sm text-gray-500 mb-2 uppercase tracking-wide">${p.brand}</div>
                    <h1 class="text-3xl font-bold text-marine-dark mb-4">${p.name}</h1>
                    <div class="text-3xl font-bold text-marine-accent mb-6">${displayPrice} <span class="text-xs text-gray-400 font-normal">(KDV Dahil)</span></div>
                    <p class="text-gray-700 leading-relaxed mb-8">${p.desc}</p>
                    
                    <button onclick="addToCart(${p.id})" class="w-full bg-marine-dark text-white py-4 rounded-lg hover:bg-marine-blue transition font-bold text-lg shadow-lg transform active:scale-95">
                        <i class="fa-solid fa-cart-shopping mr-2"></i> Sepete Ekle
                    </button>
                    
                    <div class="mt-6 flex gap-4 text-sm text-gray-500">
                        <div class="flex items-center"><i class="fa-solid fa-truck mr-2"></i> Aynı Gün Kargo</div>
                        <div class="flex items-center"><i class="fa-solid fa-shield-halved mr-2"></i> 2 Yıl Garanti</div>
                    </div>
                </div>
            </div>
            ${relatedHtml}
        </div>
    `;
}

function renderCart() {
    if(db.cart.length === 0) {
        mainContent.innerHTML = `<div class="text-center py-20 text-gray-500"><i class="fa-solid fa-basket-shopping text-6xl mb-4"></i><p>Sepetiniz boş.</p></div>`;
        return;
    }

    let totalTry = 0;
    const itemsHtml = db.cart.map((item, idx) => {
        // Sepet toplamını hesaplarken o anki kurdan TRY'ye çevirip toplayalım
        // Sonra toplamı gösterilen kura çeviririz.
        let itemPriceTry = 0;
        if(item.currency === "TRY") itemPriceTry = item.basePrice;
        else if(item.currency === "USD") itemPriceTry = item.basePrice * exchangeRates.USD;
        else if(item.currency === "EUR") itemPriceTry = item.basePrice * exchangeRates.EUR;
        
        totalTry += itemPriceTry;

        return `
            <div class="flex justify-between items-center border-b py-4">
                <div class="flex items-center gap-4">
                    <img src="${item.img}" class="w-16 h-16 object-cover rounded border">
                    <div>
                        <div class="font-bold">${item.name}</div>
                        <div class="text-sm text-gray-500">${formatPrice(item.basePrice, item.currency)}</div>
                    </div>
                </div>
                <button onclick="removeFromCart(${idx})" class="text-red-500 hover:text-red-700"><i class="fa-solid fa-trash-can"></i></button>
            </div>
        `;
    }).join('');

    // Toplamı gösterilecek kura çevir
    let displayTotal = 0;
    let symbol = "";
    if(activeCurrency === "TRY") { displayTotal = totalTry; symbol = "₺"; }
    else if(activeCurrency === "USD") { displayTotal = totalTry / exchangeRates.USD; symbol = "$"; }
    else if(activeCurrency === "EUR") { displayTotal = totalTry / exchangeRates.EUR; symbol = "€"; }

    const formattedTotal = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2 }).format(displayTotal) + " " + symbol;

    mainContent.innerHTML = `
        <h2 class="text-2xl font-bold mb-6">Alışveriş Sepeti</h2>
        <div class="bg-white p-6 rounded shadow-lg">
            ${itemsHtml}
            <div class="mt-6 flex justify-end items-center gap-6 border-t pt-6">
                <div class="text-xl">Toplam: <span class="font-bold text-marine-accent text-2xl">${formattedTotal}</span></div>
                <button class="bg-green-600 text-white px-8 py-3 rounded font-bold hover:bg-green-700 shadow">Ödemeye Geç</button>
            </div>
        </div>
    `;
}

// Helper: Ürün Kartı HTML'i
function createProductCard(p) {
    const priceStr = formatPrice(p.basePrice, p.currency);
    return `
        <div class="product-card bg-white border border-gray-100 rounded-xl overflow-hidden transition duration-300 flex flex-col group">
            <div class="h-56 overflow-hidden relative cursor-pointer p-4" onclick="router('detail', ${p.id})">
                <img src="${p.img}" class="w-full h-full object-contain transform group-hover:scale-110 transition duration-500">
            </div>
            <div class="p-4 flex-grow flex flex-col border-t border-gray-100">
                <div class="text-xs text-gray-400 font-semibold uppercase mb-1">${p.brand}</div>
                <h3 class="font-bold text-gray-800 text-sm mb-2 line-clamp-2 cursor-pointer hover:text-marine-blue" onclick="router('detail', ${p.id})">${p.name}</h3>
                
                <div class="mt-auto flex justify-between items-end">
                    <div>
                        <span class="block text-lg font-bold text-marine-dark">${priceStr}</span>
                    </div>
                    <button onclick="addToCart(${p.id})" class="bg-marine-light text-marine-dark w-10 h-10 rounded-full hover:bg-marine-accent hover:text-white transition flex items-center justify-center">
                        <i class="fa-solid fa-plus"></i>
                    </button>
                </div>
            </div>
        </div>
    `;
}

function addToCart(id) {
    const p = db.products.find(x => x.id == id);
    db.cart.push(p);
    saveDB();
    updateCartCount();
    toastr.success(`${p.name} sepete eklendi.`);
}

function removeFromCart(index) {
    db.cart.splice(index, 1);
    saveDB();
}

function updateCartCount() {
    document.getElementById('cart-count').innerText = db.cart.length;
}

// --- 5. ADMIN PANELI ---
function toggleAdminPanel() {
    const panel = document.getElementById('admin-app');
    if(panel.classList.contains('hide')) {
        const pwd = prompt("Admin Şifresi (Demo: admin)");
        if(pwd === "admin") {
            panel.classList.remove('hide');
            adminRouter('products');
        } else {
            toastr.error("Hatalı şifre");
        }
    } else {
        panel.classList.add('hide');
        router(currentPage); // Siteyi yenile
    }
}

function adminRouter(page) {
    const content = document.getElementById('admin-content');
    if(page === 'products') renderAdminProducts();
    // Slider vs. buraya eklenebilir
}

function renderAdminProducts() {
    const content = document.getElementById('admin-content');
    const rows = db.products.map(p => `
        <tr class="border-b">
            <td class="p-2"><img src="${p.img}" class="w-10 h-10 object-contain"></td>
            <td class="p-2">${p.name}</td>
            <td class="p-2">${p.basePrice} ${p.currency}</td>
            <td class="p-2">
                <button onclick="deleteProduct(${p.id})" class="text-red-600 hover:text-red-800"><i class="fa-solid fa-trash"></i></button>
            </td>
        </tr>
    `).join('');

    content.innerHTML = `
        <h2 class="text-2xl font-bold mb-6 text-gray-800">Ürün Yönetimi</h2>
        
        <div class="bg-white p-4 rounded shadow mb-6 grid grid-cols-2 md:grid-cols-4 gap-4">
            <input id="adm-name" placeholder="Ürün Adı" class="border p-2 rounded">
            <input id="adm-price" placeholder="Fiyat" class="border p-2 rounded">
            <select id="adm-curr" class="border p-2 rounded">
                <option value="TRY">TRY</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
            </select>
            <button onclick="addProductFromAdmin()" class="bg-green-600 text-white rounded font-bold">Ekle</button>
        </div>

        <div class="bg-white shadow rounded overflow-hidden">
            <table class="w-full text-left">
                <thead class="bg-gray-200 font-bold text-gray-700">
                    <tr>
                        <th class="p-3">Görsel</th>
                        <th class="p-3">Ad</th>
                        <th class="p-3">Baz Fiyat</th>
                        <th class="p-3">İşlem</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    `;
}

function addProductFromAdmin() {
    const name = document.getElementById('adm-name').value;
    const price = parseFloat(document.getElementById('adm-price').value);
    const curr = document.getElementById('adm-curr').value;

    if(name && price) {
        const newId = Date.now();
        db.products.push({
            id: newId,
            name: name,
            brand: "Eklenen",
            category: "elektronik",
            basePrice: price,
            currency: curr,
            img: "https://placehold.co/300x300?text=Yeni+Urun",
            desc: "Admin panelinden eklendi."
        });
        saveDB();
    }
}

function deleteProduct(id) {
    if(confirm('Silmek istiyor musunuz?')) {
        db.products = db.products.filter(p => p.id !== id);
        saveDB();
    }
}

// --- BAŞLANGIÇ ---
document.addEventListener('DOMContentLoaded', () => {
    fetchRates(); // Kurları çek (Simülasyon)
    router('home');
});
