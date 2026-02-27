import Auth from './pages/Auth';
import Lobby from './pages/Lobby';
import { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

function App() {
  // === STATE GLOBAL ===
  const [currentUser, setCurrentUser] = useState(null);
  const [businessData, setBusinessData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

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
        // JIKA SUDAH LOGIN (Nanti ini diganti dengan komponen <Lobby />)
        <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center">
          <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 w-full max-w-md">
            <h1 className="text-2xl font-bold text-green-400 mb-1">
              {businessData?.shopName || businessData?.name || 'ISZI Kasir'}
            </h1>
            <p className="text-xs text-gray-400 mb-6">
              {businessData?.shopAddress || businessData?.address || 'Alamat Toko'}
            </p>
            
            <div className="bg-green-900/30 text-green-400 p-3 rounded-lg mb-6 border border-green-800/50">
              <i className="fas fa-check-circle mr-2"></i>
              React & Firebase Terhubung Sempurna!
            </div>

            <button 
              onClick={() => signOut(auth)} 
              className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl transition active:scale-95"
            >
              Logout Sementara
            </button>
          </div>
        </div>
      ) : (
        <Auth />
      )}
    </div>
  );
}

export default App;
