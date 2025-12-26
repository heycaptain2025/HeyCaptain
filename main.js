// --- 1. VERİTABANI ---
const defaultData = {
    products: [
        { id: 1, name: "GPSMAP 1223xsv Chartplotter", brand: "Garmin", category: "Elektronik", basePrice: 2800, currency: "USD", stock: 5, img: "https://images.unsplash.com/photo-1557804506-669a67965ba0?w=500", desc: "12 inç ekran.", relatedIds: [3] },
        { id: 2, name: "Sigma Otomatik Can Yeleği", brand: "Lalizas", category: "Güvenlik", basePrice: 120, currency: "EUR", stock: 20, img: "https://images.unsplash.com/photo-1616769911429-1a986eb0712d?w=500", desc: "ISO 12402-3 onaylı.", relatedIds: [] }
    ],
    brands: [
        { name: "Garmin", img: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Garmin_Logo.svg/2560px-Garmin_Logo.svg.png" },
        { name: "Lalizas", img: "https://www.lalizas.com/images/logo.png" }
    ],
    campaigns: [],
    cart: [],
    // CHAT DATASI
    messages: [
        { from: 'admin', text: 'Merhaba! Size nasıl yardımcı olabilirim?', time: new Date().toLocaleTimeString(), read: false }
    ]
};

let db = JSON.parse(localStorage.getItem('marinDB')) || defaultData;
let activeCurrency = "TRY";
let exchangeRates = { TRY: 1, USD: 35.5, EUR: 37.2 }; 
let tempUploadedImage = ""; // Dosya yükleme geçici değişkeni

function saveDB() {
    localStorage.setItem('marinDB', JSON.stringify(db));
    updateCartCount();
    // Chat varsa güncelle
    if(document.getElementById('chat-box').style.display === 'flex') renderChat();
    // Admin açıksa güncelle
    if(!document.getElementById('admin-app').classList.contains('hide')) {
        renderAdminProducts();
        renderAdminChat();
    }
}

// --- 2. DOSYA YÜKLEME (Base64) ---
function handleFileSelect(evt) {
    const file = evt.target.files[0];
    if (file) {
        // Boyut kontrolü (örn 500KB)
        if (file.size > 500000) {
            alert("Dosya boyutu çok yüksek! Lütfen 500KB altı resim yükleyin. (Demo Sınırlaması)");
            return;
        }
        
        const reader = new FileReader();
        reader.onload = function(e) {
            tempUploadedImage = e.target.result; // Base64 string
            // Önizleme
            const preview = document.getElementById('file-preview');
            preview.classList.remove('hide');
            preview.querySelector('img').src = tempUploadedImage;
            toastr.info("Görsel seçildi");
        };
        reader.readAsDataURL(file);
    }
}

// --- 3. TCMB KUR ---
async function fetchTCMB() {
    const info = document.getElementById('exchange-rates-info');
    try {
        const res = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent('https://www.tcmb.gov.tr/kurlar/today.xml')}`);
        if(!res.ok) throw new Error("Network");
        const txt = await res.text();
        const parser = new DOMParser();
        const xml = parser.parseFromString(txt, "text/xml");
        
        let usd = 0, eur = 0;
        const currencies = xml.getElementsByTagName("Currency");
        for(let i=0; i<currencies.length; i++) {
            const code = currencies[i].getAttribute("Kod");
            const rate = parseFloat(currencies[i].getElementsByTagName("ForexSelling")[0]?.textContent);
            if(code==="USD") usd = rate;
            if(code==="EUR") eur = rate;
        }

        if(usd && eur) {
            exchangeRates.USD = usd;
            exchangeRates.EUR = eur;
            info.innerHTML = `<span class="text-green-400 font-bold">TCMB Aktif</span> $:${usd} €:${eur}`;
            router(currentPage);
        }
    } catch(e) {
        info.innerHTML = `<span class="text-orange-400">Kur: Manuel</span> $:${exchangeRates.USD} €:${exchangeRates.EUR}`;
    }
}

function formatPriceDisplay(basePrice, currency) {
    let priceInTry = 0;
    if (currency === "TRY") priceInTry = basePrice;
    else if (currency === "USD") priceInTry = basePrice * exchangeRates.USD;
    else if (currency === "EUR") priceInTry = basePrice * exchangeRates.EUR;

    let finalVal = 0, symbol = "";
    if (activeCurrency === "TRY") { finalVal = priceInTry; symbol = "₺"; }
    else if (activeCurrency === "USD") { finalVal = priceInTry / exchangeRates.USD; symbol = "$"; }
    else if (activeCurrency === "EUR") { finalVal = priceInTry / exchangeRates.EUR; symbol = "€"; }

    return new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2 }).format(finalVal) + " " + symbol;
}

function changeCurrency(v) { activeCurrency = v; router(currentPage); }

// --- 4. NAVİGASYON ---
let currentPage = 'home';
const mainContent = document.getElementById('main-content');

function router(page, param=null) {
    currentPage = page;
    window.scrollTo(0,0);
    if(page==='home') renderHome();
    else if(page==='products') renderProducts(param);
    else if(page==='detail') renderDetail(param);
    else if(page==='cart') renderCart();
    
    updateCartCount();
    initBrandSlider();
}

// --- 5. RENDER FONKSİYONLARI ---
function renderHome() {
    mainContent.innerHTML = `
        <div class="bg-gray-800 text-white rounded-2xl p-12 mb-8 text-center bg-[url('https://images.unsplash.com/photo-1566403487332-95b77c5e2366?w=1600')] bg-cover bg-center bg-no-repeat relative overflow-hidden group">
            <div class="absolute inset-0 bg-black/50"></div>
            <div class="relative z-10">
                <h2 class="text-4xl md:text-5xl font-bold mb-4">Denizcilikte Güvenli Liman</h2>
                <p class="mb-8 text-lg">Binlerce ürün arasından dilediğini seç, teklif iste.</p>
                <button onclick="router('products')" class="bg-marine-accent px-8 py-3 rounded font-bold hover:bg-white hover:text-marine-accent transition">ÜRÜNLERİ İNCELE</button>
            </div>
        </div>
        <h2 class="text-2xl font-bold text-marine-dark mb-6">Öne Çıkanlar</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            ${db.products.slice(0,4).map(p => createProductCard(p)).join('')}
        </div>
    `;
}

function renderProducts(cat='all') {
    const list = cat==='all' ? db.products : db.products.filter(p=>p.category===cat);
    // Kategori Sidebar
    const cats = ['all','Elektronik','Güvenlik','Aksesuar','Giyim'];
    const sidebar = cats.map(c=> `<li onclick="router('products','${c}')" class="cursor-pointer py-1 hover:text-marine-accent ${cat===c?'font-bold text-marine-accent':''}">${c==='all'?'Tümü':c}</li>`).join('');

    mainContent.innerHTML = `
        <div class="flex flex-col md:flex-row gap-8">
            <div class="w-full md:w-1/4 bg-white p-4 rounded shadow h-fit">
                <h3 class="font-bold border-b mb-2 pb-2">Kategoriler</h3><ul>${sidebar}</ul>
            </div>
            <div class="w-full md:w-3/4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                ${list.length ? list.map(p=>createProductCard(p)).join('') : 'Ürün bulunamadı.'}
            </div>
        </div>
    `;
}

function createProductCard(p) {
    const price = formatPriceDisplay(p.basePrice, p.currency);
    const stockMsg = p.stock > 0 ? (p.stock < 5 ? `<span class="stock-badge stock-low">SON ${p.stock}</span>` : '') : `<span class="stock-badge stock-out">TÜKENDİ</span>`;
    const btn = p.stock > 0 ? `addToCart(${p.id})` : "toastr.error('Stok yok')";
    
    return `
        <div class="product-card rounded-xl overflow-hidden flex flex-col h-full group">
            ${stockMsg}
            <div class="h-48 p-4 flex items-center justify-center cursor-pointer" onclick="router('detail',${p.id})">
                <img src="${p.img}" class="max-w-full max-h-full object-contain group-hover:scale-105 transition">
            </div>
            <div class="p-4 border-t flex-grow flex flex-col">
                <div class="text-xs text-gray-400 font-bold uppercase">${p.brand}</div>
                <div class="font-bold text-marine-dark mb-2 cursor-pointer line-clamp-2" onclick="router('detail',${p.id})">${p.name}</div>
                <div class="mt-auto flex justify-between items-center">
                    <span class="font-bold text-lg">${price}</span>
                    <button onclick="${btn}" class="w-8 h-8 rounded-full bg-marine-dark text-white hover:bg-marine-accent flex items-center justify-center"><i class="fa-solid fa-plus"></i></button>
                </div>
            </div>
        </div>
    `;
}

function renderDetail(id) {
    const p = db.products.find(x=>x.id==id);
    if(!p) return;
    const price = formatPriceDisplay(p.basePrice, p.currency);
    const btn = p.stock > 0 ? `<button onclick="addToCart(${p.id})" class="bg-marine-dark text-white px-6 py-3 rounded font-bold hover:bg-marine-accent w-full">LİSTEYE EKLE</button>` : `<button disabled class="bg-gray-400 text-white px-6 py-3 rounded w-full cursor-not-allowed">STOKTA YOK</button>`;

    mainContent.innerHTML = `
        <div class="bg-white rounded-xl shadow p-6 flex flex-col md:flex-row gap-8">
            <div class="w-full md:w-1/2 flex justify-center border rounded p-4"><img src="${p.img}" class="max-h-[400px] object-contain"></div>
            <div class="w-full md:w-1/2">
                <div class="text-marine-accent font-bold tracking-widest text-sm">${p.brand}</div>
                <h1 class="text-3xl font-bold mb-4">${p.name}</h1>
                <div class="text-3xl font-bold mb-6">${price}</div>
                <p class="text-gray-600 mb-6">${p.desc}</p>
                <div class="bg-gray-50 p-4 rounded text-sm mb-6">Stok: <b>${p.stock}</b> | Kargo: <b>Alıcı Öder</b></div>
                ${btn}
            </div>
        </div>
    `;
}

function renderCart() {
    if(!db.cart.length) { mainContent.innerHTML = `<div class="text-center py-20 bg-white rounded shadow">Listeniz boş. <br><button onclick="router('products')" class="text-marine-accent font-bold mt-2">Ürünlere Git</button></div>`; return; }
    
    const items = db.cart.map((item,i) => `
        <div class="flex justify-between items-center border-b py-3">
            <div class="flex items-center gap-3"><img src="${item.img}" class="w-12 h-12 object-contain border rounded">
                <div><div class="font-bold text-sm">${item.name}</div><div class="text-xs text-gray-500">${item.brand}</div></div>
            </div>
            <div class="flex items-center gap-4"><span class="font-bold">${formatPriceDisplay(item.basePrice, item.currency)}</span><button onclick="removeFromCart(${i})" class="text-red-500"><i class="fa-solid fa-trash"></i></button></div>
        </div>
    `).join('');

    mainContent.innerHTML = `
        <h2 class="text-2xl font-bold mb-4">Teklif Listem</h2>
        <div class="flex flex-col md:flex-row gap-8">
            <div class="w-full md:w-2/3 bg-white p-6 rounded shadow">${items}</div>
            <div class="w-full md:w-1/3 bg-white p-6 rounded shadow h-fit sticky top-4">
                <h3 class="font-bold mb-4 border-b pb-2">İşlem</h3>
                <p class="text-sm text-gray-500 mb-4">Listesinizdeki ürünler için fiyat teklifi veya sipariş talebi oluşturun.</p>
                <button onclick="openOrderModal()" class="w-full bg-marine-accent text-white py-3 rounded font-bold hover:bg-orange-600">TEKLİF İSTE</button>
            </div>
        </div>
    `;
}

// --- 6. İŞLEMLER ---
function addToCart(id) {
    const p = db.products.find(x=>x.id==id);
    if(p.stock>0) { db.cart.push(p); p.stock--; saveDB(); toastr.success("Eklendi"); }
    else toastr.error("Stok Yetersiz");
}
function removeFromCart(i) {
    const p = db.cart[i];
    const orig = db.products.find(x=>x.id==p.id);
    if(orig) orig.stock++;
    db.cart.splice(i,1); saveDB(); renderCart();
}
function updateCartCount(){ document.getElementById('cart-count').innerText=db.cart.length; }

// SİPARİŞ / TEKLİF MAİLİ
function openOrderModal() { document.getElementById('order-modal').classList.remove('hidden'); }
function closeOrderModal() { document.getElementById('order-modal').classList.add('hidden'); }

function sendOrderEmail() {
    const name = document.getElementById('ord-name').value;
    const phone = document.getElementById('ord-phone').value;
    const company = document.getElementById('ord-company').value;
    const note = document.getElementById('ord-note').value;

    if(!name || !phone) { alert("Ad ve Telefon zorunludur."); return; }

    let body = `SAYIN YETKİLİ,\n\nAşağıdaki ürünler için fiyat teklifi/sipariş talep ediyorum.\n\nMÜŞTERİ BİLGİLERİ:\nAd Soyad: ${name}\nTelefon: ${phone}\nFirma: ${company}\nNot: ${note}\n\nÜRÜNLER:\n`;
    
    db.cart.forEach(item => {
        body += `- ${item.name} (${item.brand}) [Kod: ${item.id}]\n`;
    });

    body += `\n\nTeşekkürler.`;

    const subject = `Sipariş Talebi - ${name}`;
    window.location.href = `mailto:siparis@marinekipman.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    
    // Temizle
    db.cart = [];
    saveDB();
    closeOrderModal();
    router('home');
    toastr.success("Mail uygulamanız açılıyor...");
}

// --- 7. CHAT SİSTEMİ ---
function toggleChat() {
    const box = document.getElementById('chat-box');
    box.classList.toggle('open');
    if(box.classList.contains('open')) {
        renderChat();
        // Otomatik karşılama (daha önce mesaj yoksa)
        if(db.messages.length === 0) {
            db.messages.push({ from:'admin', text:'Merhaba! Size nasıl yardımcı olabilirim?', time: new Date().toLocaleTimeString(), read: false });
            saveDB();
        }
    }
}

function renderChat() {
    const body = document.getElementById('chat-body');
    body.innerHTML = db.messages.map(m => `
        <div class="msg ${m.from}">
            ${m.text}
            <span class="msg-time">${m.time}</span>
        </div>
    `).join('');
    body.scrollTop = body.scrollHeight;
}

function handleChatKey(e) { if(e.key === 'Enter') sendUserMessage(); }

function sendUserMessage() {
    const input = document.getElementById('chat-input');
    const txt = input.value.trim();
    if(txt) {
        db.messages.push({ from:'user', text:txt, time: new Date().toLocaleTimeString(), read: false });
        input.value = "";
        saveDB();
        
        // Simüle edilmiş admin bildirimi
        const count = db.messages.filter(m => m.from==='user' && !m.read).length;
        document.getElementById('adm-msg-count').innerText = count;
    }
}

// --- 8. ADMIN ---
function toggleAdminPanel() {
    const p = document.getElementById('admin-app');
    if(p.classList.contains('hide')) {
        if(prompt("Şifre: admin")==="admin") {
            p.classList.remove('hide');
            renderAdminProducts(); renderAdminChat();
        }
    } else { p.classList.add('hide'); router(currentPage); }
}

function switchAdminTab(t) {
    document.querySelectorAll('.admin-tab-content').forEach(e=>e.classList.add('hide'));
    document.getElementById('tab-'+t).classList.remove('hide');
    if(t==='products') renderAdminProducts();
    if(t==='messages') renderAdminChat();
}

function renderAdminProducts() {
    const list = document.getElementById('admin-product-list');
    list.innerHTML = db.products.map(p => `
        <tr class="border-b border-gray-700">
            <td class="p-2"><img src="${p.img}" class="w-8 h-8 object-contain bg-white rounded"></td>
            <td class="p-2">${p.name}</td>
            <td class="p-2">${p.basePrice} ${p.currency}</td>
            <td class="p-2">${p.stock}</td>
            <td class="p-2 text-right"><button onclick="delProd(${p.id})" class="text-red-500"><i class="fa-solid fa-trash"></i></button></td>
        </tr>
    `).join('');
    // Select doldur
    document.getElementById('prod-brand').innerHTML = db.brands.map(b=>`<option>${b.name}</option>`).join('');
}

function showProductForm() { document.getElementById('product-form').classList.remove('hide'); }
function closeProductForm() { document.getElementById('product-form').classList.add('hide'); tempUploadedImage=""; document.getElementById('file-preview').classList.add('hide'); }

function saveProduct() {
    const name = document.getElementById('prod-name').value;
    const brand = document.getElementById('prod-brand').value;
    const price = document.getElementById('prod-price').value;
    const curr = document.getElementById('prod-curr').value;
    const stock = document.getElementById('prod-stock').value;
    const cat = document.getElementById('prod-cat').value;
    const desc = document.getElementById('prod-desc').value;
    // Resim: Yüklenen varsa onu, yoksa url inputunu, yoksa placeholder
    const urlInput = document.getElementById('prod-img').value;
    const img = tempUploadedImage || urlInput || 'https://placehold.co/300';

    if(name && price) {
        db.products.push({ id:Date.now(), name, brand, basePrice: parseFloat(price), currency: curr, stock: parseInt(stock), category: cat, img, desc, relatedIds:[] });
        saveDB();
        closeProductForm();
        toastr.success("Kaydedildi");
    }
}
function delProd(id) { if(confirm("Sil?")) { db.products=db.products.filter(p=>p.id!==id); saveDB(); renderAdminProducts(); } }

// ADMIN CHAT
function renderAdminChat() {
    const body = document.getElementById('admin-chat-body');
    body.innerHTML = db.messages.map(m => `
        <div class="p-2 rounded max-w-[80%] ${m.from==='admin'?'bg-marine-blue text-white self-end ml-auto':'bg-gray-700 text-white self-start'}">
            <div class="text-xs opacity-50 mb-1">${m.from==='admin'?'Siz':'Ziyaretçi'} - ${m.time}</div>
            ${m.text}
        </div>
    `).join('');
    body.scrollTop = body.scrollHeight;
    
    // Mesajları okundu say
    db.messages.forEach(m => m.read = true);
    document.getElementById('adm-msg-count').innerText = "0";
    saveDB(); // Okundu bilgisini kaydet
}

function sendAdminMessage() {
    const inp = document.getElementById('admin-chat-input');
    const txt = inp.value.trim();
    if(txt) {
        db.messages.push({ from:'admin', text:txt, time: new Date().toLocaleTimeString(), read: true });
        inp.value="";
        saveDB();
        renderAdminChat();
        toastr.success("Mesaj gönderildi");
    }
}

function initBrandSlider() {
    const t = document.getElementById('brand-track');
    if(!t) return;
    t.innerHTML = [...db.brands, ...db.brands].map(b => `<div class="brand-item"><img src="${b.img}"></div>`).join('');
}

// Arama
function headerSearch(v) {
    const r = document.getElementById('search-results');
    if(v.length<2) { r.classList.add('hidden'); return; }
    const m = db.products.filter(p=>p.name.toLowerCase().includes(v.toLowerCase()));
    r.innerHTML = m.length ? m.map(p=>`<div class="p-2 hover:bg-gray-100 cursor-pointer flex gap-2 border-b" onclick="router('detail',${p.id}); document.getElementById('search-results').classList.add('hidden')"><img src="${p.img}" class="w-8 h-8 object-contain"><div class="text-xs font-bold">${p.name}</div></div>`).join('') : '<div class="p-2 text-xs">Yok</div>';
    r.classList.remove('hidden');
}

document.addEventListener('DOMContentLoaded', () => { fetchTCMB(); router('home'); });
