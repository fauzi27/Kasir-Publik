import Auth from './pages/Auth';
import Lobby from './pages/Lobby';
import Cashier from './pages/Cashier';
import Admin from './pages/Admin';
import Stock from './pages/Stock';
import Report from './pages/Report';

import { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

function App() {
  // === STATE GLOBAL ===
  const [currentUser, setCurrentUser] = useState(null);
  const [businessData, setBusinessData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentView, setCurrentView] = useState('lobby'); // 'lobby', 'cashier', 'admin', dll

  // === AUTH LISTENER (VERSI ANTI-MACET SAAT OFFLINE BOSs) ===
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        let dataUsaha = {};

        try {
          if (navigator.onLine) {
            // A. ONLINE: Ambil data segar dari Server
            const docRef = doc(db, "users", user.uid);
            const docSnap = await getDoc(docRef);
            
            if (docSnap.exists()) {
              dataUsaha = docSnap.data();
              // Cek Owner jika user adalah kasir
              if (dataUsaha.role === 'kasir' && dataUsaha.ownerId) {
                const ownerSnap = await getDoc(doc(db, "users", dataUsaha.ownerId));
                if (ownerSnap.exists()) {
                  const ownerData = ownerSnap.data();
                  dataUsaha.shopName = ownerData.name;
                  dataUsaha.shopAddress = ownerData.address;
                }
              }
              // Simpan salinan ke memori HP untuk jaga-jaga kalau offline nanti
              localStorage.setItem('cached_user_profile', JSON.stringify(dataUsaha));
            }
          } else {
            // B. OFFLINE: Ambil dari saku (LocalStorage)
            const cached = localStorage.getItem('cached_user_profile');
            if (cached) {
              dataUsaha = JSON.parse(cached);
              console.log("Offline Mode: Menggunakan profil tersimpan.");
            }
          }
        } catch (e) {
          console.error("Gagal load profil:", e);
          const cached = localStorage.getItem('cached_user_profile');
          if (cached) dataUsaha = JSON.parse(cached);
        }

        setBusinessData(dataUsaha);
      } else {
        // BELUM LOGIN / LOGOUT
        setCurrentUser(null);
        setBusinessData(null);
      }
      
      // Matikan layar loading setelah proses cek selesai
      setIsLoading(false);
    });

    return () => unsubscribe(); // Bersihkan memori saat komponen ditutup
  }, []);

  // === RENDER LAYAR LOADING ===
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white">
        <i className="fas fa-circle-notch fa-spin text-4xl text-blue-500 mb-3"></i>
        <span className="text-sm font-bold text-gray-300">Menyiapkan ISZI...</span>
      </div>
    );
  }

  // === RENDER UTAMA ===
  return (
    <div className="App min-h-screen bg-gray-900 text-white">
      {currentUser ? (
        // RENDER HALAMAN SESUAI STATE 'currentView'
        <>
          {currentView === 'lobby' && (
            <Lobby 
              businessData={businessData} 
              onNavigate={(view) => setCurrentView(view)} 
            />
          )}
          
          {currentView === 'cashier' && (
            <Cashier 
              businessData={businessData} 
              currentUser={currentUser} 
              onNavigate={(view) => setCurrentView(view)} 
            />
          )}

          {currentView === 'admin' && (
            <Admin 
              businessData={businessData} 
              currentUser={currentUser} 
              onNavigate={(view) => setCurrentView(view)} 
            />
          )}

          {currentView === 'stock' && (
            <Stock 
              businessData={businessData} 
              currentUser={currentUser} 
              onNavigate={(view) => setCurrentView(view)} 
            />
          )}

          {currentView === 'report' && (
            <Report 
              businessData={businessData} 
              currentUser={currentUser} 
              onNavigate={(view) => setCurrentView(view)} 
            />
          )}

          {/* Fallback untuk halaman yang belum dibuat (Setting, Table, Calc) */}
          {['settings', 'table', 'calculator'].includes(currentView) && (
            <div className="flex flex-col items-center justify-center min-h-screen text-center p-6 bg-gray-900 text-white">
              <i className="fas fa-tools text-5xl text-yellow-500 mb-4"></i>
              <h2 className="text-xl font-bold mb-2">Segera Hadir!</h2>
              <p className="text-gray-400 text-sm mb-6">Halaman {currentView} sedang dalam proses pemindahan ke React.</p>
              <button 
                onClick={() => setCurrentView('lobby')} 
                className="px-6 py-2 bg-blue-600 rounded-full font-bold shadow-lg hover:bg-blue-700 transition active:scale-95"
              >
                Kembali ke Lobi
              </button>
            </div>
          )}
        </>
      ) : (
        <Auth />
      )}
    </div>
  );
}

export default App;
