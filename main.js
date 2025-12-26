// --- 1. VERİTABANI VE KONFİGÜRASYON ---
const defaultData = {
    products: [
        { id: 1, name: "GPSMAP 1223xsv Chartplotter", brand: "Garmin", category: "Elektronik", basePrice: 2800, currency: "USD", img: "https://images.unsplash.com/photo-1557804506-669a67965ba0?w=500", desc: "12 inç ekran, yan tarama sonar desteği.", relatedIds: [3, 4] },
        { id: 2, name: "Sigma Otomatik Can Yeleği 170N", brand: "Lalizas", category: "Güvenlik", basePrice: 120, currency: "EUR", img: "https://images.unsplash.com/photo-1616769911429-1a986eb0712d?w=500", desc: "ISO 12402-3 onaylı, otomatik şişme mekanizmalı.", relatedIds: [5] },
        { id: 3, name: "GMR 18 HD+ Radar", brand: "Garmin", category: "Elektronik", basePrice: 1650, currency: "USD", img: "https://placehold.co/400x300?text=Radar", desc: "4kW yüksek çözünürlüklü kubbe radar.", relatedIds: [1] },
        { id: 4, name: "NMEA 2000 Başlangıç Kiti", brand: "Garmin", category: "Aksesuar", basePrice: 85, currency: "USD", img: "https://placehold.co/400x300?text=Kablo+Seti", desc: "Tekne ağ kurulumu için temel kablo seti.", relatedIds: [1] },
        { id: 5, name: "2kg Kuru Kimyevi Yangın Tüpü", brand: "Lalizas", category: "Güvenlik", basePrice: 1200, currency: "TRY", img: "https://placehold.co/400x300?text=Yangin+Tupu", desc: "Tekne içi kullanım için uygun braketli tüp.", relatedIds: [2] },
        { id: 6, name: "Deep Blue Sualtı Aydınlatma", brand: "OceanLED", category: "Aydınlatma", basePrice: 450, currency: "USD", img: "https://placehold.co/400x300?text=Sualti+Isik", desc: "Mavi led su altı aydınlatma.", relatedIds: [] }
    ],
    slides: [
        { id: 1, title: "Denizlerdeki Gözünüz: <br>Yeni Nesil Radarlar", img: "https://images.unsplash.com/photo-1566403487332-95b77c5e2366?w=1600", link: "products" },
        { id: 2, title: "Güvenlikten Ödün Vermeyin", img: "https://images.unsplash.com/photo-1544280145-9856a9089851?w=1600", link: "products" }
    ],
    cart: [],
    // Marka Logoları (Slider İçin)
    brands: [
        "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Garmin_Logo.svg/2560px-Garmin_Logo.svg.png",
        "https://seeklogo.com/images/R/Raymarine-logo-7B29B124E9-seeklogo.com.png",
        "https://1000logos.net/wp-content/uploads/2021/05/Simrad-logo.png",
        "https://upload.wikimedia.org/wikipedia/commons/2/23/Lowrance_Electronics_logo.png",
        "https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/Furuno_Logo.svg/1200px-Furuno_Logo.svg.png",
        "https://www.lalizas.com/images/logo.png"
    ]
};

// Veritabanı Başlatma
let db = JSON.parse(localStorage.getItem('marinDB')) || defaultData;
let activeCurrency = "TRY";
let exchangeRates = { TRY: 1, USD: 35.5, EUR: 37.2 }; // Varsayılan (Fallback)
let activeCategory = 'all';

function saveDB() {
    localStorage.setItem('marinDB', JSON.stringify(db));
    // O an neredeysek orayı yenile
    if(!document.getElementById('admin-app').classList.contains('hide')) renderAdminProducts();
    else if(currentPage === 'cart') renderCart();
    // Diğer sayfalar için router çağrılabilir ama sonsuz döngüden kaçınmalı
    updateCartCount();
}

// --- 2. TCMB VERİ ÇEKME (XML PARSING) ---
async function fetchTCMB() {
    const infoSpan = document.getElementById('exchange-rates-info');
    infoSpan.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> TCMB Bağlanıyor...';

    try {
        // 'raw' parametresi ile XML string'i olduğu gibi alıyoruz.
        // allorigins.win güvenilir bir proxy'dir.
        const response = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent('https://www.tcmb.gov.tr/kurlar/today.xml')}`);
        
        if (!response.ok) throw new Error("Ağ hatası");
        
        const xmlText = await response.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, "text/xml");

        // USD ve EUR 'ForexSelling' (Efektif Satış değil, Döviz Satış kullanılır genelde ticarette)
        // XML içinde Currency Kod="USD" olanı bulacağız.
        const currencies = xmlDoc.getElementsByTagName("Currency");
        
        let foundUsd = false;
        let foundEur = false;

        for (let i = 0; i < currencies.length; i++) {
            const code = currencies[i].getAttribute("Kod");
            
            // BanknoteSelling (Efektif) veya ForexSelling (Döviz)
            const rateStr = currencies[i].getElementsByTagName("ForexSelling")[0]?.textContent;
            
            if (code === "USD" && rateStr) {
                exchangeRates.USD = parseFloat(rateStr);
                foundUsd = true;
            }
            if (code === "EUR" && rateStr) {
                exchangeRates.EUR = parseFloat(rateStr);
                foundEur = true;
            }
        }

        if(foundUsd && foundEur) {
            infoSpan.innerHTML = `<span class="text-green-400 font-bold"><i class="fa-solid fa-check-circle"></i> TCMB</span> $:${exchangeRates.USD} €:${exchangeRates.EUR}`;
            toastr.info("Güncel kurlar TCMB'den çekildi.");
        } else {
            throw new Error("XML parse edilemedi");
        }

        // Fiyatları güncelle
        router(currentPage);

    } catch (error) {
        console.error("Kur Hatası:", error);
        infoSpan.innerHTML = `<span class="text-red-400" title="Sunucu erişilemedi, manuel kur"><i class="fa-solid fa-triangle-exclamation"></i> Çevrimdışı</span> $:${exchangeRates.USD} €:${exchangeRates.EUR}`;
        // Hata olsa bile sayfa çalışmaya devam etmeli
        router(currentPage); 
    }
}

// Para Birimi Çevirici
function changeCurrency(newCurr) {
    activeCurrency = newCurr;
    router(currentPage);
}

function formatPrice(amount, baseCurrency) {
    let priceInTry = 0;
    // 1. Her şeyi TRY'ye çevir
    if (baseCurrency === "TRY") priceInTry = amount;
    else if (baseCurrency === "USD") priceInTry = amount * exchangeRates.USD;
    else if (baseCurrency === "EUR") priceInTry = amount * exchangeRates.EUR;

    // 2. İstenen kura çevir
    let finalPrice = 0;
    let symbol = "";

    if (activeCurrency === "TRY") { finalPrice = priceInTry; symbol = "₺"; }
    else if (activeCurrency === "USD") { finalPrice = priceInTry / exchangeRates.USD; symbol = "$"; }
    else if (activeCurrency === "EUR") { finalPrice = priceInTry / exchangeRates.EUR; symbol = "€"; }

    return new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(finalPrice) + " " + symbol;
}

// --- 3. NAVİGASYON (ROUTER) ---
let currentPage = 'home';
const mainContent = document.getElementById('main-content');

function router(page, param = null) {
    currentPage = page;
    window.scrollTo(0,0);
    
    // Breadcrumb (Basit)
    // Buraya eklenebilir ama HTML içinde statik tutmak daha temiz şu an için.

    if(page === 'home') renderHome();
    else if(page === 'products') renderProductsPage(param);
    else if(page === 'detail') renderDetail(param);
    else if(page === 'cart') renderCart();
    
    updateCartCount();
}

// --- 4. SAYFA OLUŞTURUCULAR ---

function renderHome() {
    // Slider (Basitçe ilki)
    let sliderHtml = '';
    if(db.slides.length > 0) {
        const s = db.slides[0];
        sliderHtml = `
            <div class="relative w-full h-[400px] md:h-[500px] overflow-hidden rounded-2xl shadow-2xl cursor-pointer mb-12 group" onclick="router('products')">
                <img src="${s.img}" class="w-full h-full object-cover transition duration-1000 group-hover:scale-105 brightness-75">
                <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end items-start p-8 md:p-16">
                    <h2 class="text-4xl md:text-6xl font-bold text-white mb-4 leading-tight drop-shadow-lg">${s.title}</h2>
                    <button class="px-8 py-3 bg-marine-accent text-white font-bold rounded-lg hover:bg-white hover:text-marine-accent transition shadow-lg">İNCELE</button>
                </div>
            </div>
        `;
    }

    // Vitrin
    const featured = db.products.slice(0, 4).map(p => createProductCard(p)).join('');

    mainContent.innerHTML = `
        ${sliderHtml}
        
        <div class="flex items-center justify-between mb-6">
            <h2 class="text-2xl font-bold text-marine-dark border-l-4 border-marine-accent pl-4">Popüler Ürünler</h2>
            <a href="javascript:void(0)" onclick="router('products')" class="text-marine-blue hover:text-marine-accent font-semibold text-sm">Tümünü Gör <i class="fa-solid fa-arrow-right ml-1"></i></a>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            ${featured}
        </div>

        <!-- Bilgi Banner -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 text-center text-white">
            <div class="bg-marine-blue p-6 rounded-lg shadow hover:bg-marine-dark transition">
                <i class="fa-solid fa-truck-fast text-4xl mb-3"></i>
                <h4 class="font-bold text-lg">Hızlı Kargo</h4>
                <p class="text-sm opacity-80">Saat 15:00'e kadar verilen siparişler aynı gün kargoda.</p>
            </div>
            <div class="bg-marine-accent p-6 rounded-lg shadow hover:bg-orange-600 transition">
                <i class="fa-solid fa-headset text-4xl mb-3"></i>
                <h4 class="font-bold text-lg">Teknik Destek</h4>
                <p class="text-sm opacity-80">Uzman ekibimizden ürün seçimi konusunda destek alın.</p>
            </div>
            <div class="bg-marine-blue p-6 rounded-lg shadow hover:bg-marine-dark transition">
                <i class="fa-solid fa-shield-halved text-4xl mb-3"></i>
                <h4 class="font-bold text-lg">Güvenli Ödeme</h4>
                <p class="text-sm opacity-80">256-bit SSL sertifikası ile korunan güvenli ödeme.</p>
            </div>
        </div>
    `;
    
    initBrandSlider();
}

function renderProductsPage(category = 'all') {
    activeCategory = category;
    const categories = ['all', ...new Set(db.products.map(p => p.category))];

    // Sidebar
    const sidebarHtml = `
        <div class="bg-white p-6 rounded-xl shadow-lg border border-gray-100 sticky top-6">
            <h3 class="font-bold text-lg mb-4 text-marine-dark border-b pb-2">Kategoriler</h3>
            <ul class="space-y-2">
                ${categories.map(c => `
                    <li>
                        <button onclick="router('products', '${c}')" 
                           class="cat-link w-full text-left py-2 text-gray-600 hover:text-marine-accent transition flex justify-between items-center ${activeCategory === c ? 'active' : ''}">
                           <span class="capitalize">${c === 'all' ? 'Tüm Ürünler' : c}</span>
                           <i class="fa-solid fa-chevron-right text-xs opacity-50"></i>
                        </button>
                    </li>
                `).join('')}
            </ul>
        </div>
    `;

    let filtered = db.products;
    if(category !== 'all') filtered = db.products.filter(p => p.category === category);

    const listHtml = filtered.length > 0 
        ? filtered.map(p => createProductCard(p)).join('') 
        : '<div class="col-span-full text-center py-10 text-gray-500 bg-white rounded shadow">Bu kategoride ürün bulunamadı.</div>';

    mainContent.innerHTML = `
        <div class="flex flex-col md:flex-row gap-8 pt-6">
            <aside class="w-full md:w-1/4 min-w-[250px]">
                ${sidebarHtml}
            </aside>
            <section class="w-full md:w-3/4">
                <div class="flex justify-between items-center mb-6">
                    <h2 class="text-3xl font-bold text-marine-dark capitalize">${category === 'all' ? 'Mağaza' : category}</h2>
                    <span class="text-gray-500 text-sm">${filtered.length} ürün listelendi</span>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    ${listHtml}
                </div>
            </section>
        </div>
    `;
}

function renderDetail(id) {
    const p = db.products.find(x => x.id == id);
    if(!p) return;
    const priceStr = formatPrice(p.basePrice, p.currency);

    // İlişkili Ürünler
    let relatedHtml = '';
    if(p.relatedIds && p.relatedIds.length > 0) {
        const related = db.products.filter(item => p.relatedIds.includes(item.id));
        if(related.length > 0) {
            relatedHtml = `
                <div class="mt-16 border-t pt-8">
                    <h3 class="text-xl font-bold text-marine-dark mb-6">Bunu Alanlar Bunları da İnceledi</h3>
                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-6">
                        ${related.map(r => createProductCard(r)).join('')}
                    </div>
                </div>
            `;
        }
    }

    mainContent.innerHTML = `
        <div class="bg-white rounded-2xl shadow-xl overflow-hidden mt-6">
            <!-- Breadcrumb -->
            <div class="bg-gray-50 px-6 py-3 text-sm text-gray-500 border-b">
                <span onclick="router('home')" class="cursor-pointer hover:text-marine-blue">Ana Sayfa</span> <i class="fa-solid fa-chevron-right text-xs mx-2"></i>
                <span onclick="router('products')" class="cursor-pointer hover:text-marine-blue">Mağaza</span> <i class="fa-solid fa-chevron-right text-xs mx-2"></i>
                <span class="font-bold text-marine-dark">${p.name}</span>
            </div>

            <div class="p-6 md:p-10 flex flex-col md:flex-row gap-10">
                <!-- Sol: Resim -->
                <div class="w-full md:w-1/2 bg-white flex items-center justify-center p-4 border rounded-xl">
                    <img src="${p.img}" class="max-w-full max-h-[400px] object-contain hover:scale-110 transition duration-500">
                </div>
                
                <!-- Sağ: Bilgi -->
                <div class="w-full md:w-1/2 flex flex-col">
                    <span class="text-marine-accent font-bold tracking-widest uppercase text-sm mb-2">${p.brand}</span>
                    <h1 class="text-3xl md:text-4xl font-bold text-marine-dark mb-4 leading-tight">${p.name}</h1>
                    
                    <div class="flex items-end gap-3 mb-6">
                        <span class="text-4xl font-bold text-gray-800">${priceStr}</span>
                        <span class="text-sm text-gray-400 mb-2">KDV Dahil</span>
                    </div>

                    <div class="prose text-gray-600 mb-8">
                        <p>${p.desc}</p>
                    </div>

                    <div class="flex gap-4 mt-auto">
                        <button onclick="addToCart(${p.id})" class="flex-1 bg-marine-dark text-white py-4 rounded-xl hover:bg-marine-blue transition font-bold text-lg shadow-lg flex items-center justify-center gap-2">
                            <i class="fa-solid fa-cart-shopping"></i> Sepete Ekle
                        </button>
                        <a href="https://wa.me/905555555555?text=Merhaba, ${p.name} hakkında bilgi almak istiyorum." target="_blank" class="w-16 bg-green-500 text-white rounded-xl flex items-center justify-center text-2xl hover:bg-green-600 transition shadow-lg">
                            <i class="fa-brands fa-whatsapp"></i>
                        </a>
                    </div>

                    <div class="mt-6 flex flex-col gap-2 text-sm text-gray-500 bg-gray-50 p-4 rounded-lg">
                        <div class="flex items-center"><i class="fa-solid fa-check text-green-500 w-6"></i> Stokta Var</div>
                        <div class="flex items-center"><i class="fa-solid fa-truck text-marine-blue w-6"></i> Ücretsiz Kargo (5000₺ üzeri)</div>
                        <div class="flex items-center"><i class="fa-solid fa-shield text-marine-blue w-6"></i> Orijinal Ürün Garantisi</div>
                    </div>
                </div>
            </div>
            
            <!-- Detay Altı -->
            <div class="p-6">
                ${relatedHtml}
            </div>
        </div>
    `;
}

function createProductCard(p) {
    return `
        <div class="product-card bg-white rounded-xl overflow-hidden flex flex-col h-full relative group">
            <div class="absolute top-3 right-3 z-10 opacity-0 group-hover:opacity-100 transition">
                <button class="w-8 h-8 bg-white rounded-full shadow text-gray-400 hover:text-red-500 flex items-center justify-center"><i class="fa-regular fa-heart"></i></button>
            </div>
            <div class="h-56 p-6 relative cursor-pointer flex items-center justify-center bg-white" onclick="router('detail', ${p.id})">
                <img src="${p.img}" class="max-w-full max-h-full object-contain transform group-hover:scale-110 transition duration-500">
            </div>
            <div class="p-5 flex-grow flex flex-col border-t border-gray-100">
                <div class="text-xs text-marine-accent font-bold uppercase mb-1 tracking-wider">${p.brand}</div>
                <h3 class="font-bold text-marine-dark text-base mb-2 leading-snug cursor-pointer hover:text-marine-blue transition" onclick="router('detail', ${p.id})">${p.name}</h3>
                
                <div class="mt-auto flex justify-between items-center pt-2">
                    <span class="font-bold text-xl text-gray-800">${formatPrice(p.basePrice, p.currency)}</span>
                    <button onclick="addToCart(${p.id})" class="w-10 h-10 bg-marine-dark text-white rounded-full flex items-center justify-center hover:bg-marine-accent transition shadow-md transform active:scale-90">
                        <i class="fa-solid fa-plus"></i>
                    </button>
                </div>
            </div>
        </div>
    `;
}

function renderCart() {
    if(db.cart.length === 0) {
        mainContent.innerHTML = `
            <div class="text-center py-20 bg-white rounded-xl shadow-lg">
                <div class="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6 text-gray-400">
                    <i class="fa-solid fa-cart-arrow-down text-4xl"></i>
                </div>
                <h2 class="text-2xl font-bold text-gray-800 mb-2">Sepetiniz Boş</h2>
                <p class="text-gray-500 mb-8">Henüz sepetinize ürün eklemediniz.</p>
                <button onclick="router('products')" class="bg-marine-accent text-white px-8 py-3 rounded-lg font-bold hover:bg-orange-600 transition">Alışverişe Başla</button>
            </div>
        `;
        return;
    }

    let totalTry = 0;
    const itemsHtml = db.cart.map((item, idx) => {
        let priceTry = 0;
        if(item.currency === "TRY") priceTry = item.basePrice;
        else if(item.currency === "USD") priceTry = item.basePrice * exchangeRates.USD;
        else if(item.currency === "EUR") priceTry = item.basePrice * exchangeRates.EUR;
        totalTry += priceTry;

        return `
            <div class="flex flex-col sm:flex-row items-center justify-between border-b border-gray-100 py-4 gap-4">
                <div class="flex items-center gap-4 w-full sm:w-auto">
                    <img src="${item.img}" class="w-20 h-20 object-contain border rounded-lg bg-white p-1">
                    <div>
                        <div class="font-bold text-marine-dark">${item.name}</div>
                        <div class="text-sm text-gray-500">${item.brand}</div>
                    </div>
                </div>
                <div class="flex items-center justify-between w-full sm:w-auto gap-8">
                    <div class="font-bold text-lg">${formatPrice(item.basePrice, item.currency)}</div>
                    <button onclick="removeFromCart(${idx})" class="w-8 h-8 rounded-full bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition flex items-center justify-center"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
        `;
    }).join('');

    let displayTotal = 0;
    let symbol = "";
    if(activeCurrency === "TRY") { displayTotal = totalTry; symbol = "₺"; }
    else if(activeCurrency === "USD") { displayTotal = totalTry / exchangeRates.USD; symbol = "$"; }
    else if(activeCurrency === "EUR") { displayTotal = totalTry / exchangeRates.EUR; symbol = "€"; }

    const formattedTotal = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2 }).format(displayTotal) + " " + symbol;

    mainContent.innerHTML = `
        <h2 class="text-2xl font-bold text-marine-dark mb-6">Alışveriş Sepeti (${db.cart.length})</h2>
        <div class="flex flex-col lg:flex-row gap-8">
            <div class="w-full lg:w-2/3 bg-white p-6 rounded-xl shadow-lg h-fit">
                ${itemsHtml}
            </div>
            <div class="w-full lg:w-1/3">
                <div class="bg-white p-6 rounded-xl shadow-lg sticky top-6">
                    <h3 class="text-lg font-bold border-b pb-4 mb-4">Sipariş Özeti</h3>
                    <div class="flex justify-between mb-2 text-gray-600"><span>Ara Toplam</span> <span>${formattedTotal}</span></div>
                    <div class="flex justify-between mb-4 text-gray-600"><span>Kargo</span> <span class="text-green-500">Ücretsiz</span></div>
                    <div class="flex justify-between text-xl font-bold text-marine-dark border-t pt-4 mb-6">
                        <span>Toplam</span>
                        <span>${formattedTotal}</span>
                    </div>
                    <button onclick="alert('Ödeme entegrasyonu bu demoda mevcut değil.')" class="w-full bg-marine-accent text-white py-4 rounded-lg font-bold hover:bg-orange-600 transition shadow-lg">Sepeti Onayla</button>
                    <div class="mt-4 flex justify-center gap-2 text-gray-400 text-2xl">
                        <i class="fa-brands fa-cc-visa"></i>
                        <i class="fa-brands fa-cc-mastercard"></i>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Yardımcılar
function addToCart(id) {
    const p = db.products.find(x => x.id == id);
    db.cart.push(p);
    saveDB();
    updateCartCount();
    toastr.success(`${p.name} sepete eklendi`, 'Başarılı');
}

function removeFromCart(i){ 
    db.cart.splice(i,1); 
    saveDB(); 
    renderCart(); 
}

function updateCartCount(){ 
    document.getElementById('cart-count').innerText = db.cart.length; 
}

// Marka Slider Init
function initBrandSlider() {
    const track = document.getElementById('brand-track');
    if(!track) return;
    // Logoları 2 kere tekrarlıyoruz ki sonsuz döngü pürüzsüz olsun
    const content = [...db.brands, ...db.brands].map(img => `
        <div class="brand-item"><img src="${img}" class="w-full h-auto"></div>
    `).join('');
    track.innerHTML = content;
}

// Header Arama
function headerSearch(val) {
    const resDiv = document.getElementById('search-results');
    if(val.length < 2) { resDiv.classList.add('hidden'); return; }
    
    const matches = db.products.filter(p => p.name.toLowerCase().includes(val.toLowerCase()));
    if(matches.length > 0) {
        resDiv.innerHTML = matches.map(p => `
            <div class="p-3 border-b hover:bg-gray-100 cursor-pointer flex gap-3 items-center" onclick="router('detail', ${p.id}); document.getElementById('search-results').classList.add('hidden');">
                <img src="${p.img}" class="w-10 h-10 object-contain">
                <div class="text-sm font-bold text-gray-700">${p.name}</div>
            </div>
        `).join('');
        resDiv.classList.remove('hidden');
    } else {
        resDiv.innerHTML = '<div class="p-3 text-sm text-gray-500">Ürün bulunamadı.</div>';
        resDiv.classList.remove('hidden');
    }
}

// Admin Panel Toggle
function toggleAdminPanel() {
    const panel = document.getElementById('admin-app');
    panel.classList.toggle('hide');
    if(!panel.classList.contains('hide')) adminRouter('products');
}

// Admin Router & Render (Basit Tutuldu)
function adminRouter(page) {
    const content = document.getElementById('admin-content');
    if(page === 'products') {
        const rows = db.products.map(p => `
            <tr class="bg-white border-b">
                <td class="p-3"><img src="${p.img}" class="w-10 h-10 object-contain"></td>
                <td class="p-3">${p.name}</td>
                <td class="p-3">${p.basePrice} ${p.currency}</td>
                <td class="p-3"><button onclick="deleteProduct(${p.id})" class="text-red-500 hover:text-red-700"><i class="fa-solid fa-trash"></i></button></td>
            </tr>
        `).join('');
        
        content.innerHTML = `
            <h2 class="text-2xl font-bold mb-4">Ürün Listesi</h2>
            <div class="bg-white p-4 rounded mb-4 shadow">
                <h3 class="font-bold mb-2">Hızlı Ürün Ekle</h3>
                <div class="grid grid-cols-2 gap-2">
                    <input id="adm-name" placeholder="Ad" class="border p-2 rounded">
                    <input id="adm-price" placeholder="Fiyat" class="border p-2 rounded">
                    <select id="adm-curr" class="border p-2 rounded"><option>TRY</option><option>USD</option><option>EUR</option></select>
                    <button onclick="adminAdd()" class="bg-marine-blue text-white rounded">Ekle</button>
                </div>
            </div>
            <table class="w-full text-left rounded shadow overflow-hidden">
                <thead class="bg-gray-200"><tr><th class="p-3">Resim</th><th class="p-3">Ad</th><th class="p-3">Fiyat</th><th class="p-3">İşlem</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
        `;
    }
}

function adminAdd() {
    const name = document.getElementById('adm-name').value;
    const price = document.getElementById('adm-price').value;
    const curr = document.getElementById('adm-curr').value;
    if(name && price) {
        db.products.push({ id: Date.now(), name, basePrice: price, currency: curr, img: 'https://placehold.co/300', brand: 'Yeni', category: 'Genel', desc: '...' });
        saveDB();
        adminRouter('products');
    }
}
function deleteProduct(id) {
    if(confirm('Silinsin mi?')) { db.products = db.products.filter(p => p.id !== id); saveDB(); adminRouter('products'); }
}

// Başlat
document.addEventListener('DOMContentLoaded', () => {
    fetchTCMB();
    router('home');
});
