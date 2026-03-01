import { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth'; 
import { doc, getDoc, onSnapshot } from 'firebase/firestore'; // 🔥 TAMBAH onSnapshot
import Swal from 'sweetalert2'; 

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
import Studio from './pages/Studio'; 
import SuperAdmin from './pages/SuperAdmin'; 

// 🔥 EMAIL SAKTI UNTUK MASUK KE GOD MODE
const SUPER_ADMIN_EMAIL = "zii20fe@gmail.com"; 

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [businessData, setBusinessData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentView, setCurrentView] = useState('lobby'); 

  // === 🔥 CEK HAK AKSES ===
  // Jika role-nya bukan 'kasir' dan bukan 'ghost' (akun dihapus), berarti dia Bos
  const isOwner = businessData?.role !== 'kasir' && businessData?.role !== 'ghost';
  const isSuperAdmin = currentUser?.email === SUPER_ADMIN_EMAIL; 
  
  const hasAccess = (view) => {
    if (isSuperAdmin) return true; 
    if (view === 'superadmin' && !isSuperAdmin) return false; 
    
    if (view === 'lobby') return true; 
    if (isOwner) return true; 
    
    return businessData?.accessRights?.[view] === true;
  };

  // === 🔥 MESIN DARK MODE GLOBAL ===
  useEffect(() => {
    if (localStorage.getItem('darkMode') === 'true') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  // === 🔥 SISTEM NAVIGASI ===
  const handleNavigate = (view) => {
    if (!hasAccess(view)) {
      Swal.fire('Akses Ditolak', 'Anda tidak memiliki izin untuk mengakses fitur ini.', 'error');
      return;
    }
    if (currentView !== view) {
      window.history.pushState({ view: view }, '', '#' + view);
      setCurrentView(view);
    }
  };

  useEffect(() => {
    if (isSuperAdmin && currentView === 'lobby') {
       window.history.replaceState({ view: 'superadmin' }, '', '#superadmin');
       setCurrentView('superadmin');
    } else if (!isSuperAdmin) {
       window.history.replaceState({ view: 'lobby' }, '', '#lobby');
    }

    const handlePopState = (event) => {
      if (Swal.isVisible()) Swal.close();
      let nextView = event.state?.view || (isSuperAdmin ? 'superadmin' : 'lobby');
      setCurrentView(nextView);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isSuperAdmin]); 

  // === 🔥 AUTH LISTENER UTAMA ===
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (!user) {
         setBusinessData(null);
         setCurrentView('lobby'); 
         setIsLoading(false);
      }
    });
    return () => unsubscribeAuth(); 
  }, []);

  // === 🔥 RADAR REAL-TIME (MENCEGAH AKUN HANTU) ===
  useEffect(() => {
    if (!currentUser) return;

    if (currentUser.email === SUPER_ADMIN_EMAIL) {
       setBusinessData({ role: 'superadmin', name: 'CEO ISZI', shopName: 'ISZI Command Center' });
       setCurrentView('superadmin'); 
       setIsLoading(false);
       return; 
    }

    // Menggunakan onSnapshot agar terus memantau database secara Live!
    const unsubDoc = onSnapshot(doc(db, "users", currentUser.uid), async (docSnap) => {
      if (docSnap.exists()) {
        let dataUsaha = docSnap.data();
        
        const fallbackName = currentUser.displayName || currentUser.email?.split('@')[0] || 'Admin';
        dataUsaha.operatorName = dataUsaha.name || fallbackName;

        if (dataUsaha.role === 'kasir' && dataUsaha.ownerId) {
          const ownerSnap = await getDoc(doc(db, "users", dataUsaha.ownerId));
          if (ownerSnap.exists()) {
            const ownerData = ownerSnap.data();
            dataUsaha.shopName = ownerData.shopName || ownerData.name || "ISZI POS";
            dataUsaha.shopAddress = ownerData.shopAddress || ownerData.address || "Nusadua Bali";
            if (ownerData.themeData) dataUsaha.themeData = ownerData.themeData; 
            dataUsaha.isSuspended = ownerData.isSuspended; 
          }
        } else {
          dataUsaha.shopName = dataUsaha.shopName || dataUsaha.name || "ISZI POS";
          dataUsaha.shopAddress = dataUsaha.shopAddress || dataUsaha.address || "Nusadua Bali";
        }

        localStorage.setItem('cached_user_profile', JSON.stringify(dataUsaha));
        setBusinessData(dataUsaha);
      } else {
        // 🔥 JIKA DOKUMEN TIDAK DITEMUKAN (DIHAPUS BOS), JADIKAN AKUN HANTU!
        setBusinessData({ role: 'ghost' });
      }
      setIsLoading(false);
    }, (error) => {
       console.warn("Membaca dari cache offline:", error);
       const cached = localStorage.getItem('cached_user_profile');
       if (cached) {
          setBusinessData(JSON.parse(cached));
       }
       setIsLoading(false);
    });

    return () => unsubDoc();
  }, [currentUser]);

  // === RENDER LOADING ===
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-white transition-colors duration-300">
        <i className="fas fa-circle-notch fa-spin text-4xl text-blue-500 mb-3"></i>
        <span className="text-sm font-bold">Menyiapkan ISZI...</span>
      </div>
    );
  }

  // === 🔥 LAYAR BLOKIR UNTUK AKUN DIHAPUS (GHOST) 🔥 ===
  if (businessData?.role === 'ghost') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-white p-6 text-center transition-colors duration-300">
        <div className="bg-red-50 dark:bg-red-900/20 p-6 rounded-full mb-6 border-4 border-red-100 dark:border-red-900/50 shadow-inner">
          <i className="fas fa-user-slash text-6xl text-red-600 dark:text-red-500"></i>
        </div>
        <h2 className="text-3xl font-black mb-3 text-red-600 dark:text-red-400">Akun Tidak Ditemukan</h2>
        <p className="text-gray-600 dark:text-gray-400 text-sm mb-8 max-w-sm leading-relaxed">
          Akun karyawan ini telah dihapus oleh Pemilik Toko atau tidak lagi terdaftar dalam sistem.
        </p>
        <button 
          onClick={() => signOut(auth)} 
          className="bg-gray-800 dark:bg-gray-700 hover:bg-gray-900 dark:hover:bg-gray-600 text-white px-8 py-3.5 rounded-xl font-bold transition active:scale-95 shadow-lg flex items-center gap-2"
        >
          <i className="fas fa-sign-out-alt"></i> Keluar
        </button>
      </div>
    );
  }

  // === LAYAR SUSPEND (Masa Langganan Habis) ===
  if (businessData?.isSuspended && !isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-white p-6 text-center transition-colors duration-300">
        <div className="bg-red-50 dark:bg-red-900/20 p-6 rounded-full mb-6 border-4 border-red-100 dark:border-red-900/50 shadow-inner">
          <i className="fas fa-lock text-6xl text-red-600 dark:text-red-500"></i>
        </div>
        <h2 className="text-3xl font-black mb-3 text-red-600 dark:text-red-400">Akses Ditangguhkan</h2>
        <p className="text-gray-600 dark:text-gray-400 text-sm mb-8 max-w-sm leading-relaxed">
          Masa berlangganan aplikasi untuk toko <span className="font-bold text-gray-800 dark:text-white">{businessData.shopName}</span> telah habis atau akses sedang diblokir oleh Admin. Silakan hubungi layanan pelanggan ISZI.
        </p>
        <button 
          onClick={() => signOut(auth)} 
          className="bg-gray-800 dark:bg-gray-700 hover:bg-gray-900 dark:hover:bg-gray-600 text-white px-8 py-3.5 rounded-xl font-bold transition active:scale-95 shadow-lg flex items-center gap-2"
        >
          <i className="fas fa-sign-out-alt"></i> Keluar / Ganti Akun
        </button>
      </div>
    );
  }

  // === LAYAR AREA TERLARANG ===
  if (currentUser && !hasAccess(currentView)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-white p-6 text-center transition-colors duration-300">
        <i className="fas fa-shield-alt text-6xl text-red-500 mb-4"></i>
        <h2 className="text-2xl font-bold mb-2">Area Terlarang</h2>
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">Anda tidak memiliki izin dari Owner untuk mengakses halaman ini.</p>
        <button onClick={() => handleNavigate(isSuperAdmin ? 'superadmin' : 'lobby')} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold transition active:scale-95 shadow-lg">
          Kembali ke Lobi
        </button>
      </div>
    );
  }

  // === TAMPILAN APLIKASI UTAMA ===
  return (
    <div className="App min-h-screen bg-gray-50 text-gray-800 dark:bg-gray-900 dark:text-gray-100 font-sans overflow-x-hidden transition-colors duration-300">
      {currentUser ? (
        <>
          {currentView === 'lobby' && <Lobby businessData={businessData} onNavigate={handleNavigate} />}
          {currentView === 'cashier' && <Cashier businessData={businessData} currentUser={currentUser} onNavigate={handleNavigate} />}
          {currentView === 'report' && <Report businessData={businessData} currentUser={currentUser} onNavigate={handleNavigate} />}
          {currentView === 'calculator' && <Calculator onNavigate={handleNavigate} />}
          
          {currentView === 'admin' && <Admin businessData={businessData} currentUser={currentUser} onNavigate={handleNavigate} />}
          {currentView === 'stock' && <Stock businessData={businessData} currentUser={currentUser} onNavigate={handleNavigate} />}
          {currentView === 'settings' && <Settings businessData={businessData} currentUser={currentUser} onNavigate={handleNavigate} />}
          {currentView === 'table' && <Table businessData={businessData} currentUser={currentUser} onNavigate={handleNavigate} />}
          {currentView === 'studio' && <Studio businessData={businessData} currentUser={currentUser} onNavigate={handleNavigate} />}
          
          {/* 🔥 HALAMAN RAHASIA SUPER ADMIN 🔥 */}
          {currentView === 'superadmin' && <SuperAdmin currentUser={currentUser} />}
        </>
      ) : (
        <Auth />
      )}
    </div>
  );
}

export default App;
