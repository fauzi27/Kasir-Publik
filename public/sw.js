const CACHE_NAME = 'iszi-react-v2.2'; // Naikkan versinya

const STATIC_ASSETS = [
  '/', 
  '/index.html',
  '/manifest.json'
];

// 1. INSTALL: Langsung paksa aktif (Skip Waiting)
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('✅ Mengunduh Aset Terbaru...');
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

// 2. ACTIVATE: Langsung ambil alih halaman dan hapus memori lama
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.map((key) => { 
        if (key !== CACHE_NAME) return caches.delete(key); 
      })
    ))
  );
  self.clients.claim();
});

// 3. FETCH: STRATEGI PINTAR (ANTI BLANK PUTIH)
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 🛑 Abaikan request Firebase / Database API
  if (url.hostname.includes('firestore.googleapis.com') || 
      url.hostname.includes('identitytoolkit') || 
      url.hostname.includes('google') ||
      url.hostname.includes('cloudinary')) {
      return; 
  }

  // 🟢 STRATEGI NETWORK-FIRST UNTUK HTML (Selalu ambil UI terbaru dari Vercel)
  if (event.request.mode === 'navigate' || event.request.headers.get('accept').includes('text/html')) {
    event.respondWith(
      fetch(event.request).then((networkResp) => {
        // Jika sukses ambil dari internet, simpan ke memori sebagai cadangan
        const clone = networkResp.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return networkResp;
      }).catch(() => {
        // Jika tidak ada internet (offline), baru pakai cadangan dari memori
        return caches.match('/index.html');
      })
    );
    return;
  }

  // 🔵 STRATEGI CACHE-FIRST UNTUK ASET LAIN (Gambar, JS, CSS agar loading ngebut)
  event.respondWith(
    caches.match(event.request).then((cachedResp) => {
      if (cachedResp) return cachedResp; // Langsung pakai dari memori jika ada

      return fetch(event.request).then((networkResp) => {
        if (!networkResp || networkResp.status !== 200 || networkResp.type !== 'basic') {
          return networkResp;
        }
        const clone = networkResp.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return networkResp;
      }).catch(() => {});
    })
  );
});
