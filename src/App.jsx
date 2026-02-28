import { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

// === IMPORT SEMUA HALAMAN ===
import Auth from './pages/Auth';
import Lobby from './pages/Lobby';
import Cashier from './pages/Cashier';
import Admin from './pages/Admin';
import Stock from './pages/Stock';
import Report from './pages/Report';
import Settings from './pages/Settings';
import Table from './pages/Table';
import Calculator from './pages/Calculator';

function App() {
  // === STATE GLOBAL ===
  const [currentUser, setCurrentUser] = useState(null);
  const [businessData, setBusinessData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentView, setCurrentView] = useState('lobby'); 

  // === AUTH LISTENER (VERSI ANTI-MACET SAAT OFFLINE) ===
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
        setCurrentView('lobby'); // Reset view saat logout
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
    <div className="App min-h-screen bg-gray-900 text-white font-sans overflow-x-hidden">
      {currentUser ? (
        // RENDER HALAMAN SESUAI STATE 'currentView'
        <>
          {currentView === 'lobby' && (
            <Lobby 
              businessData={businessData} 
              onNavigate={setCurrentView} 
            />
          )}
          
          {currentView === 'cashier' && (
            <Cashier 
              businessData={businessData} 
              currentUser={currentUser} 
              onNavigate={setCurrentView} 
            />
          )}

          {currentView === 'admin' && (
            <Admin 
              businessData={businessData} 
              currentUser={currentUser} 
              onNavigate={setCurrentView} 
            />
          )}

          {currentView === 'stock' && (
            <Stock 
              businessData={businessData} 
              currentUser={currentUser} 
              onNavigate={setCurrentView} 
            />
          )}

          {currentView === 'report' && (
            <Report 
              businessData={businessData} 
              currentUser={currentUser} 
              onNavigate={setCurrentView} 
            />
          )}

          {currentView === 'settings' && (
            <Settings 
              businessData={businessData} 
              currentUser={currentUser} 
              onNavigate={setCurrentView} 
            />
          )}

          {currentView === 'table' && (
            <Table 
              businessData={businessData} 
              currentUser={currentUser} 
              onNavigate={setCurrentView} 
            />
          )}

          {currentView === 'calculator' && (
            <Calculator 
              onNavigate={setCurrentView} 
            />
          )}
        </>
      ) : (
        // JIKA BELUM LOGIN, TAMPILKAN HALAMAN AUTH
        <Auth />
      )}
    </div>
  );
}

export default App;
