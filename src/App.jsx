import { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore'; 
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
import SuperAdmin from './pages/SuperAdmin'; // 🔥 IMPORT HALAMAN SUPER ADMIN

// 🔥 EMAIL SAKTI UNTUK MASUK KE GOD MODE (Ganti dengan email aslimu)
const SUPER_ADMIN_EMAIL = "fauzi27story@gmail.com"; 

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [businessData, setBusinessData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentView, setCurrentView] = useState('lobby'); 

  // === 🔥 CEK HAK AKSES (RBAC & SUPER ADMIN) ===
  const isOwner = businessData?.role !== 'kasir';
  const isSuperAdmin = currentUser?.email === SUPER_ADMIN_EMAIL; // Deteksi akun CEO
  
  // Fungsi Satpam Pintar: Mengecek izin sebelum membuka halaman
  const hasAccess = (view) => {
    if (isSuperAdmin) return true; // Bos Besar bebas akses ke mana saja
    if (view === 'superadmin' && !isSuperAdmin) return false; // Klien biasa dilarang ke panel Super Admin
    
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

  // === 🔥 SISTEM NAVIGASI & KEAMANAN ROUTE ===
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
    // Jika Super Admin login, arahkan langsung ke superadmin (bypass lobby)
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
  }, [isSuperAdmin]); // Memicu ulang jika status Super Admin berubah (saat login)

  // === 🔥 AUTH LISTENER & LOGIKA DATA ===
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        
        // Pengecekan Khusus Super Admin
        if (user.email === SUPER_ADMIN_EMAIL) {
           setBusinessData({ role: 'superadmin', name: 'CEO ISZI', shopName: 'ISZI Command Center' });
           setCurrentView('superadmin'); // Paksa masuk ke God Mode
           setIsLoading(false);
           return; 
        }

        let dataUsaha = {};
        try {
          if (navigator.onLine) {
            const docRef = doc(db, "users", user.uid);
            const docSnap = await getDoc(docRef);
            
            if (docSnap.exists()) {
              dataUsaha = docSnap.data();
              
              const fallbackName = user.displayName || user.email?.split('@')[0] || 'Admin';
              dataUsaha.operatorName = dataUsaha.name || fallbackName;

              if (dataUsaha.role === 'kasir' && dataUsaha.ownerId) {
                const ownerSnap = await getDoc(doc(db, "users", dataUsaha.ownerId));
                if (ownerSnap.exists()) {
                  const ownerData = ownerSnap.data();
                  dataUsaha.shopName = ownerData.shopName || ownerData.name || "ISZI POS";
                  dataUsaha.shopAddress = ownerData.shopAddress || ownerData.address || "Nusadua Bali";
                  if (ownerData.themeData) dataUsaha.themeData = ownerData.themeData; 
                }
              } else {
                dataUsaha.shopName = dataUsaha.shopName || dataUsaha.name || "ISZI POS";
                dataUsaha.shopAddress = dataUsaha.shopAddress || dataUsaha.address || "Nusadua Bali";
              }

              localStorage.setItem('cached_user_profile', JSON.stringify(dataUsaha));
            }
          } else {
            const cached = localStorage.getItem('cached_user_profile');
            if (cached) dataUsaha = JSON.parse(cached);
          }
        } catch (e) {
          const cached = localStorage.getItem('cached_user_profile');
          if (cached) dataUsaha = JSON.parse(cached);
        }

        setBusinessData(dataUsaha);
      } else {
        setCurrentUser(null);
        setBusinessData(null);
        setCurrentView('lobby'); 
      }
      setIsLoading(false);
    });

    return () => unsubscribe(); 
  }, []);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-white transition-colors duration-300">
        <i className="fas fa-circle-notch fa-spin text-4xl text-blue-500 mb-3"></i>
        <span className="text-sm font-bold">Menyiapkan ISZI...</span>
      </div>
    );
  }

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
