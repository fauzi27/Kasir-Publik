const CACHE_NAME = 'iszi-react-v2.0'; 

// Hanya simpan file inti yang pasti ada di folder public/
const STATIC_ASSETS = [
  '/', 
  '/index.html',
  '/manifest.json'
];

// 1. INSTALL
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('✅ Menyimpan Aset Utama ISZI React...');
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

// 2. ACTIVATE
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

// 3. FETCH (JARING RAKSASA UNTUK VITE BUNDLER)
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 🛑 Abaikan request Firebase / API agar data kasir selalu real-time
  if (url.hostname.includes('firestore.googleapis.com') || 
      url.hostname.includes('identitytoolkit') || 
      url.hostname.includes('google') ||
      url.hostname.includes('cloudinary')) {
      return; 
  }

  event.respondWith(
    caches.match(event.request).then((cachedResp) => {
      // Jika ada di memori offline, gunakan itu
      if (cachedResp) return cachedResp;

      // Jika tidak, ambil dari internet lalu simpan
      return fetch(event.request).then((networkResp) => {
        // Jangan simpan error
        if (!networkResp || networkResp.status !== 200 || networkResp.type !== 'basic') {
          return networkResp;
        }

        const responseToCache = networkResp.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return networkResp;
      }).catch(() => {
        // JIKA OFFLINE: Arahkan semua navigasi rute kembali ke index.html agar React tidak nge-blank
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      });
    })
  );
});
