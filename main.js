// --- 1. VERİTABANI BAŞLANGIÇ ---
const defaultData = {
    products: [
        { id: 1, name: "GPSMAP 1223xsv Chartplotter", brand: "Garmin", category: "Elektronik", basePrice: 2800, currency: "USD", stock: 5, img: "https://images.unsplash.com/photo-1557804506-669a67965ba0?w=500", desc: "12 inç ekran, yan tarama sonar desteği.", relatedIds: [3] },
        { id: 2, name: "Sigma Otomatik Can Yeleği 170N", brand: "Lalizas", category: "Güvenlik", basePrice: 120, currency: "EUR", stock: 20, img: "https://images.unsplash.com/photo-1616769911429-1a986eb0712d?w=500", desc: "ISO onaylı.", relatedIds: [] },
        { id: 3, name: "GMR 18 HD+ Radar", brand: "Garmin", category: "Elektronik", basePrice: 1650, currency: "USD", stock: 2, img: "https://placehold.co/400x300?text=Radar", desc: "Kubbe radar.", relatedIds: [1] },
        { id: 4, name: "Balık Bulucu 5CV", brand: "Lowrance", category: "Elektronik", basePrice: 400, currency: "USD", stock: 0, img: "https://placehold.co/400x300?text=Fishfinder", desc: "Stokta yok örneği.", relatedIds: [] }
    ],
    brands: [
        { name: "Garmin", img: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Garmin_Logo.svg/2560px-Garmin_Logo.svg.png" },
        { name: "Lalizas", img: "https://www.lalizas.com/images/logo.png" },
        { name: "Raymarine", img: "https://seeklogo.com/images/R/Raymarine-logo-7B29B124E9-seeklogo.com.png" },
        { name: "Lowrance", img: "https://upload.wikimedia.org/wikipedia/commons/2/23/Lowrance_Electronics_logo.png" },
        { name: "Simrad", img: "https://1000logos.net/wp-content/uploads/2021/05/Simrad-logo.png" }
    ],
    campaigns: [], // { brand: "Garmin", percent: 10 }
    cart: [],
    slides: [
        { id: 1, title: "Denizlerdeki Gözünüz", img: "https://images.unsplash.com/photo-1566403487332-95b77c5e2366?w=1600" }
    ]
};

let db = JSON.parse(localStorage.getItem('marinDB')) || defaultData;
let activeCurrency = "TRY";
// Başlangıç değerleri (TCMB çekilemezse kullanılır)
let exchangeRates = { TRY: 1, USD: 35.50, EUR: 37.20 }; 
let activeCategory = 'all';

// Kaydetme Fonksiyonu
function saveDB() {
    localStorage.setItem('marinDB', JSON.stringify(db));
    initBrandSlider(); // Markalar değişirse slider yenilensin
    updateCartCount();
}

// --- 2. GÜÇLENDİRİLMİŞ TCMB VERİ ÇEKME ---
async function fetchTCMB() {
    const infoEl = document.getElementById('exchange-rates-info');
    infoEl.innerHTML = '<i class="fa-solid fa-sync fa-spin"></i> TCMB Bağlanıyor...';

    try {
        // Yöntem 1: allorigins ile XML içeriğini JSON string olarak al
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent('https://www.tcmb.gov.tr/kurlar/today.xml')}`;
        
        const response = await fetch(proxyUrl);
        if(!response.ok) throw new Error("Proxy hatası");
        
        const data = await response.json();
        const xmlText = data.contents; // XML string burada

        if(!xmlText || xmlText.length < 50) throw new Error("Boş veri");

        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, "text/xml");
        const currencies = xmlDoc.getElementsByTagName("Currency");

        let foundUsd = false, foundEur = false;
        
        for (let i = 0; i < currencies.length; i++) {
            const code = currencies[i].getAttribute("Kod");
            // ForexSelling = Döviz Satış
            const rate = parseFloat(currencies[i].getElementsByTagName("ForexSelling")[0]?.textContent);
            
            if (code === "USD" && rate) { exchangeRates.USD = rate; foundUsd = true; }
            if (code === "EUR" && rate) { exchangeRates.EUR = rate; foundEur = true; }
        }

        if(foundUsd && foundEur) {
            infoEl.innerHTML = `<span class="text-green-400 font-bold"><i class="fa-solid fa-check"></i> TCMB:</span> $:${exchangeRates.USD} €:${exchangeRates.EUR}`;
            toastr.success("TCMB Kurları Güncellendi");
        } else {
            throw new Error("XML Parse edilemedi");
        }

    } catch (error) {
        console.warn("TCMB Hatası, yedek kurlar devrede:", error);
        infoEl.innerHTML = `<span class="text-orange-400" title="Sunucu yanıt vermedi, sistem kuru devrede"><i class="fa-solid fa-wifi"></i> Manuel:</span> $:${exchangeRates.USD} €:${exchangeRates.EUR}`;
    }
    
    // Sayfayı yenile ki yeni kurlar yansısın
    if(currentPage === 'home' || currentPage === 'products') router(currentPage);
}

// --- 3. FİYAT VE STOK MANTIĞI ---

// Kampanya İndirimi Hesapla
function getDiscountedPrice(product) {
    const campaign = db.campaigns.find(c => c.brand === product.brand);
    if (campaign) {
        return {
            hasDiscount: true,
            percent: campaign.percent,
            finalBasePrice: product.basePrice * ((100 - campaign.percent) / 100)
        };
    }
    return { hasDiscount: false, finalBasePrice: product.basePrice };
}

// Görüntüleme Fiyatı Formatı
function formatPriceDisplay(basePrice, currency) {
    let priceInTry = 0;
    if (currency === "TRY") priceInTry = basePrice;
    else if (currency === "USD") priceInTry = basePrice * exchangeRates.USD;
    else if (currency === "EUR") priceInTry = basePrice * exchangeRates.EUR;

    let finalVal = 0;
    let symbol = "";
    if (activeCurrency === "TRY") { finalVal = priceInTry; symbol = "₺"; }
    else if (activeCurrency === "USD") { finalVal = priceInTry / exchangeRates.USD; symbol = "$"; }
    else if (activeCurrency === "EUR") { finalVal = priceInTry / exchangeRates.EUR; symbol = "€"; }

    return new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(finalVal) + " " + symbol;
}

function changeCurrency(curr) {
    activeCurrency = curr;
    router(currentPage);
}

// --- 4. NAVİGASYON ---
let currentPage = 'home';
const mainContent = document.getElementById('main-content');

function router(page, param = null) {
    currentPage = page;
    window.scrollTo(0,0);
    
    if(page === 'home') renderHome();
    else if(page === 'products') renderProducts(param);
    else if(page === 'detail') renderDetail(param);
    else if(page === 'cart') renderCart();
    
    updateCartCount();
}

// --- 5. SAYFA RENDER ---

function renderHome() {
    const s = db.slides[0];
    const featured = db.products.slice(0, 4).map(p => createProductCard(p)).join('');
    
    mainContent.innerHTML = `
        <!-- Slider -->
        <div class="relative w-full h-[450px] overflow-hidden rounded-2xl shadow-2xl mb-12 group">
            <img src="${s.img}" class="w-full h-full object-cover transition duration-1000 group-hover:scale-105 brightness-75">
            <div class="absolute inset-0 flex flex-col justify-center items-start p-10 md:p-20 text-white bg-gradient-to-r from-black/60 to-transparent">
                <h2 class="text-5xl font-bold mb-4 drop-shadow-lg">${s.title}</h2>
                <button onclick="router('products')" class="px-8 py-3 bg-marine-accent rounded font-bold hover:bg-white hover:text-marine-accent transition">ALIŞVERİŞE BAŞLA</button>
            </div>
        </div>
        
        <!-- Vitrin -->
        <h2 class="text-2xl font-bold text-marine-dark mb-6 border-l-4 border-marine-accent pl-4">Öne Çıkanlar</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            ${featured}
        </div>
    `;
    initBrandSlider();
}

function renderProducts(category = 'all') {
    activeCategory = category;
    
    // Sidebar Kategoriler
    const cats = ['all', 'Elektronik', 'Güvenlik', 'Aksesuar', 'Giyim'];
    let filtered = db.products;
    if(category !== 'all') filtered = db.products.filter(p => p.category === category);

    const sidebar = `
        <div class="bg-white p-5 rounded-lg shadow border border-gray-100 sticky top-4">
            <h3 class="font-bold border-b pb-2 mb-3">Kategoriler</h3>
            <ul class="space-y-2">
                ${cats.map(c => `
                    <li onclick="router('products', '${c}')" class="cursor-pointer hover:text-marine-accent ${activeCategory===c ? 'font-bold text-marine-accent' : ''}">
                        ${c === 'all' ? 'Tüm Ürünler' : c}
                    </li>
                `).join('')}
            </ul>
        </div>
    `;

    mainContent.innerHTML = `
        <div class="flex flex-col md:flex-row gap-8">
            <aside class="w-full md:w-1/4">${sidebar}</aside>
            <section class="w-full md:w-3/4">
                <h2 class="text-2xl font-bold mb-4 capitalize">${category === 'all' ? 'Tüm Ürünler' : category}</h2>
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    ${filtered.length ? filtered.map(p => createProductCard(p)).join('') : '<p class="text-gray-500">Ürün bulunamadı.</p>'}
                </div>
            </section>
        </div>
    `;
}

function createProductCard(p) {
    // Kampanya Kontrol
    const discountInfo = getDiscountedPrice(p);
    let priceHtml = "";
    
    if(discountInfo.hasDiscount) {
        priceHtml = `
            <div class="flex flex-col items-start">
                <span class="old-price">${formatPriceDisplay(p.basePrice, p.currency)}</span>
                <span class="font-bold text-xl text-marine-accent">${formatPriceDisplay(discountInfo.finalBasePrice, p.currency)}</span>
            </div>
            <div class="discount-badge">-${discountInfo.percent}%</div>
        `;
    } else {
        priceHtml = `<span class="font-bold text-xl text-marine-dark">${formatPriceDisplay(p.basePrice, p.currency)}</span>`;
    }

    // Stok Kontrol
    let stockBadge = "";
    let btnDisabled = "";
    if(p.stock <= 0) {
        stockBadge = `<span class="stock-badge stock-out">TÜKENDİ</span>`;
        btnDisabled = "opacity-50 cursor-not-allowed";
    } else if(p.stock < 5) {
        stockBadge = `<span class="stock-badge stock-low">SON ${p.stock}</span>`;
    } else {
        stockBadge = `<span class="stock-badge stock-ok">STOKTA</span>`;
    }

    const clickAction = p.stock > 0 ? `addToCart(${p.id})` : "toastr.error('Stokta yok')";

    return `
        <div class="product-card bg-white rounded-xl overflow-hidden flex flex-col h-full group">
            ${stockBadge}
            ${priceHtml.includes('discount-badge') ? priceHtml.split('<div class="discount-badge">')[1] ? '<div class="discount-badge">-' + discountInfo.percent + '%</div>' : '' : ''}
            
            <div class="h-56 p-4 relative cursor-pointer flex items-center justify-center" onclick="router('detail', ${p.id})">
                <img src="${p.img}" class="max-w-full max-h-full object-contain group-hover:scale-105 transition">
            </div>
            <div class="p-4 flex-grow flex flex-col border-t border-gray-100">
                <div class="text-xs text-gray-400 font-bold uppercase mb-1">${p.brand}</div>
                <h3 class="font-bold text-marine-dark mb-2 cursor-pointer hover:text-marine-accent line-clamp-2" onclick="router('detail', ${p.id})">${p.name}</h3>
                
                <div class="mt-auto flex justify-between items-end">
                    ${priceHtml.replace('<div class="discount-badge">-' + discountInfo.percent + '%</div>', '')} 
                    <button onclick="${clickAction}" class="w-10 h-10 bg-marine-dark text-white rounded-full flex items-center justify-center hover:bg-marine-accent transition shadow ${btnDisabled}">
                        <i class="fa-solid fa-cart-plus"></i>
                    </button>
                </div>
            </div>
        </div>
    `;
}

function renderDetail(id) {
    const p = db.products.find(x => x.id == id);
    if(!p) return;
    
    const disc = getDiscountedPrice(p);
    const finalPriceStr = formatPriceDisplay(disc.hasDiscount ? disc.finalBasePrice : p.basePrice, p.currency);
    
    let btnHtml = "";
    if(p.stock > 0) {
        btnHtml = `<button onclick="addToCart(${p.id})" class="flex-1 bg-marine-dark text-white py-4 rounded-xl font-bold hover:bg-marine-accent transition">SEPETE EKLE</button>`;
    } else {
        btnHtml = `<button disabled class="flex-1 bg-gray-400 text-white py-4 rounded-xl font-bold cursor-not-allowed">STOKTA YOK</button>`;
    }

    mainContent.innerHTML = `
        <div class="bg-white rounded-xl shadow-xl p-6 md:p-10 flex flex-col md:flex-row gap-10">
            <div class="w-full md:w-1/2 flex items-center justify-center border rounded-lg p-4 relative">
                ${disc.hasDiscount ? `<div class="absolute top-4 right-4 bg-marine-accent text-white font-bold p-2 rounded-full w-12 h-12 flex items-center justify-center">-${disc.percent}%</div>` : ''}
                <img src="${p.img}" class="max-w-full max-h-[400px] object-contain">
            </div>
            <div class="w-full md:w-1/2">
                <div class="text-marine-accent font-bold uppercase tracking-widest mb-2">${p.brand}</div>
                <h1 class="text-3xl font-bold text-marine-dark mb-4">${p.name}</h1>
                
                <div class="mb-6">
                    ${disc.hasDiscount ? `<span class="text-gray-400 line-through text-lg mr-2">${formatPriceDisplay(p.basePrice, p.currency)}</span>` : ''}
                    <span class="text-4xl font-bold text-gray-800">${finalPriceStr}</span>
                </div>
                
                <div class="bg-gray-50 p-4 rounded mb-6 text-sm text-gray-600">
                    <p class="mb-2"><i class="fa-solid fa-box mr-2"></i> Stok Durumu: <strong>${p.stock > 0 ? p.stock + ' Adet' : 'Tükendi'}</strong></p>
                    <p><i class="fa-solid fa-truck mr-2"></i> Kargo: <strong>Ücretsiz</strong></p>
                </div>
                
                <p class="text-gray-600 mb-8">${p.desc}</p>
                <div class="flex gap-4">${btnHtml}</div>
            </div>
        </div>
    `;
}

function renderCart() {
    if(db.cart.length === 0) {
        mainContent.innerHTML = `<div class="text-center py-20 bg-white rounded shadow">Sepetiniz Boş <br> <button onclick="router('products')" class="mt-4 text-marine-accent font-bold">Alışverişe Dön</button></div>`;
        return;
    }

    let totalVal = 0;
    const items = db.cart.map((item, i) => {
        // Sepetteki anlık fiyatı hesapla (Kur ve indirim o an geçerli olur)
        const disc = getDiscountedPrice(item);
        const base = disc.hasDiscount ? disc.finalBasePrice : item.basePrice;
        
        let priceInTry = 0;
        if(item.currency === "TRY") priceInTry = base;
        else if(item.currency === "USD") priceInTry = base * exchangeRates.USD;
        else if(item.currency === "EUR") priceInTry = base * exchangeRates.EUR;
        
        totalVal += priceInTry;

        return `
            <div class="flex justify-between items-center border-b py-4">
                <div class="flex items-center gap-4">
                    <img src="${item.img}" class="w-16 h-16 object-contain border p-1 rounded">
                    <div>
                        <div class="font-bold">${item.name}</div>
                        <div class="text-xs text-gray-500">${item.brand}</div>
                    </div>
                </div>
                <div class="flex items-center gap-4">
                    <div class="font-bold">${formatPriceDisplay(base, item.currency)}</div>
                    <button onclick="removeFromCart(${i})" class="text-red-500"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
        `;
    }).join('');

    // Toplamı gösterim kuruna çevir
    let finalTotal = 0, symbol = "";
    if (activeCurrency === "TRY") { finalTotal = totalVal; symbol = "₺"; }
    else if (activeCurrency === "USD") { finalTotal = totalVal / exchangeRates.USD; symbol = "$"; }
    else if (activeCurrency === "EUR") { finalTotal = totalVal / exchangeRates.EUR; symbol = "€"; }

    mainContent.innerHTML = `
        <h2 class="text-2xl font-bold mb-6">Sepetim</h2>
        <div class="flex flex-col md:flex-row gap-8">
            <div class="w-full md:w-2/3 bg-white p-6 rounded shadow">${items}</div>
            <div class="w-full md:w-1/3 bg-white p-6 rounded shadow h-fit">
                <h3 class="font-bold text-lg mb-4">Özet</h3>
                <div class="flex justify-between text-xl font-bold border-t pt-4">
                    <span>Toplam</span>
                    <span>${new Intl.NumberFormat('tr-TR', {maximumFractionDigits:2}).format(finalTotal)} ${symbol}</span>
                </div>
                <button class="w-full bg-marine-accent text-white py-3 rounded mt-6 font-bold">Ödemeye Geç</button>
            </div>
        </div>
    `;
}

// --- 6. CART İŞLEMLERİ ---
function addToCart(id) {
    const p = db.products.find(x => x.id == id);
    if(p.stock > 0) {
        db.cart.push(p);
        p.stock--; // Stok düş
        saveDB();
        toastr.success("Sepete Eklendi");
        // Eğer detay sayfasındaysak ekranı yenile ki stok düşsün
        if(currentPage === 'detail') renderDetail(id);
    } else {
        toastr.error("Stok Yetersiz");
    }
}
function removeFromCart(idx) {
    const p = db.cart[idx];
    // Stoğu geri iade et
    const original = db.products.find(x => x.id == p.id);
    if(original) original.stock++;
    
    db.cart.splice(idx, 1);
    saveDB();
    renderCart();
}
function updateCartCount() { document.getElementById('cart-count').innerText = db.cart.length; }

// --- 7. ADMIN YÖNETİMİ ---
function toggleAdminPanel() {
    const panel = document.getElementById('admin-app');
    if(panel.classList.contains('hide')) {
        const pass = prompt("Yönetici Şifresi (Demo: admin)");
        if(pass === "admin") {
            panel.classList.remove('hide');
            renderAdminProducts();
            renderAdminBrands();
            renderAdminCampaigns();
        } else {
            toastr.error("Hatalı Şifre");
        }
    } else {
        panel.classList.add('hide');
        router(currentPage); // Siteye geri dön ve yenile
    }
}

function switchAdminTab(tabName) {
    document.querySelectorAll('.admin-tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.admin-tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById('tab-'+tabName).classList.add('active');
    // Tab butonunu aktif yapma mantığı burada basitleştirildi
    event.target.classList.add('active');
}

// Admin: Ürünler
function renderAdminProducts() {
    const list = document.getElementById('admin-product-list');
    list.innerHTML = db.products.map(p => `
        <tr class="border-b border-gray-700 hover:bg-gray-700">
            <td class="p-3"><img src="${p.img}" class="w-8 h-8 object-contain bg-white rounded"></td>
            <td class="p-3 font-semibold">${p.name}</td>
            <td class="p-3 text-gray-400">${p.brand}</td>
            <td class="p-3">${p.basePrice} ${p.currency}</td>
            <td class="p-3 ${p.stock < 5 ? 'text-red-400' : 'text-green-400'}">${p.stock}</td>
            <td class="p-3 text-right"><button onclick="deleteProduct(${p.id})" class="text-red-500 hover:text-red-400"><i class="fa-solid fa-trash"></i></button></td>
        </tr>
    `).join('');
    
    // Select Brand Doldur
    const brandSelect = document.getElementById('prod-brand');
    brandSelect.innerHTML = db.brands.map(b => `<option value="${b.name}">${b.name}</option>`).join('');
}

function showProductForm() { document.getElementById('product-form').classList.remove('hide'); }
function closeProductForm() { document.getElementById('product-form').classList.add('hide'); }

function saveProduct() {
    const name = document.getElementById('prod-name').value;
    const brand = document.getElementById('prod-brand').value;
    const price = parseFloat(document.getElementById('prod-price').value);
    const curr = document.getElementById('prod-curr').value;
    const stock = parseInt(document.getElementById('prod-stock').value);
    const cat = document.getElementById('prod-cat').value;
    const img = document.getElementById('prod-img').value;
    const desc = document.getElementById('prod-desc').value;

    if(name && price && stock >= 0) {
        db.products.push({ id: Date.now(), name, brand, basePrice: price, currency: curr, stock, category: cat, img: img || 'https://placehold.co/300', desc, relatedIds: [] });
        saveDB();
        closeProductForm();
        renderAdminProducts();
        toastr.success("Ürün Eklendi");
    } else {
        toastr.error("Lütfen alanları doldurun");
    }
}
function deleteProduct(id) { if(confirm("Silmek istiyor musun?")) { db.products = db.products.filter(p => p.id !== id); saveDB(); renderAdminProducts(); } }

// Admin: Markalar
function renderAdminBrands() {
    const list = document.getElementById('admin-brand-list');
    list.innerHTML = db.brands.map((b, i) => `
        <li class="flex justify-between items-center bg-gray-700 p-3 rounded">
            <div class="flex items-center gap-3">
                <img src="${b.img}" class="w-8 h-8 object-contain bg-white rounded">
                <span>${b.name}</span>
            </div>
            <button onclick="deleteBrand(${i})" class="text-red-400 hover:text-red-300">Sil</button>
        </li>
    `).join('');
    
    // Kampanya marka select doldur
    document.getElementById('camp-brand').innerHTML = db.brands.map(b => `<option value="${b.name}">${b.name}</option>`).join('');
}

function addBrand() {
    const name = document.getElementById('brand-name-input').value;
    const img = document.getElementById('brand-img-input').value;
    if(name && img) {
        db.brands.push({ name, img });
        saveDB();
        renderAdminBrands();
        toastr.success("Marka Eklendi");
    }
}
function deleteBrand(i) { db.brands.splice(i, 1); saveDB(); renderAdminBrands(); }

// Admin: Kampanyalar
function renderAdminCampaigns() {
    const cont = document.getElementById('active-campaigns');
    if(db.campaigns.length === 0) { cont.innerHTML = "<p class='text-gray-500 col-span-3'>Aktif kampanya yok.</p>"; return; }
    
    cont.innerHTML = db.campaigns.map((c, i) => `
        <div class="bg-gray-700 p-4 rounded border border-gray-600 flex justify-between items-center">
            <div>
                <div class="font-bold text-marine-accent">${c.brand}</div>
                <div class="text-sm">İndirim: <span class="text-white font-bold">%${c.percent}</span></div>
            </div>
            <button onclick="deleteCampaign(${i})" class="text-red-400 text-sm border border-red-400 px-2 py-1 rounded hover:bg-red-400 hover:text-white transition">Bitir</button>
        </div>
    `).join('');
}

function addCampaign() {
    const brand = document.getElementById('camp-brand').value;
    const percent = parseInt(document.getElementById('camp-percent').value);
    if(brand && percent > 0) {
        // Varsa güncelle yoksa ekle
        const exist = db.campaigns.findIndex(c => c.brand === brand);
        if(exist > -1) db.campaigns[exist].percent = percent;
        else db.campaigns.push({ brand, percent });
        
        saveDB();
        renderAdminCampaigns();
        toastr.success(`${brand} için kampanya aktif!`);
    }
}
function deleteCampaign(i) { db.campaigns.splice(i, 1); saveDB(); renderAdminCampaigns(); }

// Marka Slider Init
function initBrandSlider() {
    const track = document.getElementById('brand-track');
    if(!track) return;
    const items = [...db.brands, ...db.brands].map(b => `
        <div class="brand-item" title="${b.name}"><img src="${b.img}"></div>
    `).join('');
    track.innerHTML = items;
}

// Arama
function headerSearch(val) {
    const res = document.getElementById('search-results');
    if(val.length < 2) { res.classList.add('hidden'); return; }
    
    const matches = db.products.filter(p => p.name.toLowerCase().includes(val.toLowerCase()));
    if(matches.length > 0) {
        res.innerHTML = matches.map(p => `
            <div class="p-2 hover:bg-gray-100 flex gap-2 cursor-pointer border-b" onclick="router('detail', ${p.id}); document.getElementById('search-results').classList.add('hidden')">
                <img src="${p.img}" class="w-8 h-8 object-contain">
                <div class="text-xs font-bold">${p.name}</div>
            </div>
        `).join('');
        res.classList.remove('hidden');
    } else {
        res.innerHTML = "<div class='p-2 text-xs text-gray-500'>Sonuç yok</div>";
        res.classList.remove('hidden');
    }
}

// BAŞLAT
document.addEventListener('DOMContentLoaded', () => {
    fetchTCMB();
    router('home');
});
