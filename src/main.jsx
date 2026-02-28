import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './css/style.css' // Memanggil Tailwind dan CSS kustom kita

// === 1. CEK CACHE DARK MODE GLOBAL ===
// Memastikan mode gelap tetap aktif meskipun HP di-refresh
if (localStorage.getItem('darkMode') === 'true') {
  document.documentElement.classList.add('dark');
}

// === 2. RENDER APLIKASI REACT ===
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// === 3. REGISTRASI SERVICE WORKER (PWA OFFLINE) ===
// Membuat aplikasi bisa diinstal & dibuka tanpa kuota internet
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((registration) => {
      console.log('ServiceWorker PWA Sukses:', registration.scope);
    }).catch((error) => {
      console.log('ServiceWorker gagal:', error);
    });
  });
}
