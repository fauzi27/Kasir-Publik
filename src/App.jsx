import { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth'; 
import { doc, getDoc, onSnapshot } from 'firebase/firestore'; 
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

const SUPER_ADMIN_EMAIL = "zii20fe@gmail.com"; 

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [businessData, setBusinessData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentView, setCurrentView] = useState('lobby'); 
  
  // 🔥 STATE BARU: MATA DEWA (IMPERSONATION)
  const [impersonatedUid, setImpersonatedUid] = useState(null);

  const isOwner = businessData?.role !== 'kasir' && businessData?.role !== 'ghost';
  const isSuperAdmin = currentUser?.email === SUPER_ADMIN_EMAIL; 
  
  // 🔥 Cek Akses: Jika Admin menyamar, perlakukan dia sebagai pengguna normal
  const hasAccess = (view) => {
    if (isSuperAdmin && !impersonatedUid) return view === 'superadmin'; 
    if (view === 'superadmin' && !isSuperAdmin) return false; 
    
    if (view === 'lobby') return true; 
    if (isOwner) return true; 
    
    return businessData?.accessRights?.[view] === true;
  };

  useEffect(() => {
    if (localStorage.getItem('darkMode') === 'true') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

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

  // 🔥 Navigasi Paksa: Arahkan Admin ke Command Center (Kecuali sedang menyamar)
  useEffect(() => {
    if (isSuperAdmin && !impersonatedUid && currentView !== 'superadmin') {
       window.history.replaceState({ view: 'superadmin' }, '', '#superadmin');
       setCurrentView('superadmin');
    } else if (!isSuperAdmin && currentView === 'superadmin') {
       window.history.replaceState({ view: 'lobby' }, '', '#lobby');
       setCurrentView('lobby');
    }

    const handlePopState = (event) => {
      if (Swal.isVisible()) Swal.close();
      let nextView = event.state?.view || ((isSuperAdmin && !impersonatedUid) ? 'superadmin' : 'lobby');
      setCurrentView(nextView);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isSuperAdmin, currentView, impersonatedUid]); 

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (!user) {
         setBusinessData(null);
         setImpersonatedUid(null); // Bersihkan topeng saat logout
         setCurrentView('lobby'); 
         setIsLoading(false);
      }
    });
    return () => unsubscribeAuth(); 
  }, []);

  // === 🔥 RADAR DATA (DIPERBARUI UNTUK MATA DEWA) ===
  useEffect(() => {
    if (!currentUser) return;

    // Jika Admin dan TIDAK SEDANG MENYAMAR, tampilkan data dummy Command Center
    if (isSuperAdmin && !impersonatedUid) {
       setBusinessData({ role: 'superadmin', name: 'CEO ISZI', shopName: 'ISZI Command Center' });
       if (currentView !== 'superadmin') setCurrentView('superadmin'); 
       setIsLoading(false);
       return; 
    }

    // Jika admin menyamar, target pencarian data diubah menjadi UID Klien
    const targetUid = impersonatedUid || currentUser.uid;

    const unsubDoc = onSnapshot(doc(db, "users", targetUid), async (docSnap) => {
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

        // Jangan simpan ke cache lokal jika sedang mode menyamar (agar aman)
        if (!impersonatedUid) {
          localStorage.setItem('cached_user_profile', JSON.stringify(dataUsaha));
        }
        setBusinessData(dataUsaha);
      } else {
        setBusinessData({ role: 'ghost' });
      }
      setIsLoading(false);
    }, (error) => {
       console.warn("Membaca dari cache offline:", error);
       if (!impersonatedUid) {
         const cached = localStorage.getItem('cached_user_profile');
         if (cached) setBusinessData(JSON.parse(cached));
       }
       setIsLoading(false);
    });

    return () => unsubDoc();
  }, [currentUser, impersonatedUid, isSuperAdmin]); // Memicu ulang jika status topeng berubah

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-white transition-colors duration-300">
        <i className="fas fa-circle-notch fa-spin text-4xl text-blue-500 mb-3"></i>
        <span className="text-sm font-bold">Menyiapkan ISZI...</span>
      </div>
    );
  }

  if (businessData?.role === 'ghost') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-white p-6 text-center transition-colors duration-300">
        <div className="bg-red-50 p-6 rounded-full mb-6 border-4 border-red-100 shadow-inner">
          <i className="fas fa-user-slash text-6xl text-red-600"></i>
        </div>
        <h2 className="text-3xl font-black mb-3 text-red-600">Akun Tidak Ditemukan</h2>
        <button onClick={() => { setImpersonatedUid(null); signOut(auth); }} className="bg-gray-800 text-white px-8 py-3.5 rounded-xl font-bold transition active:scale-95 shadow-lg flex items-center gap-2">
          <i className="fas fa-sign-out-alt"></i> Keluar
        </button>
      </div>
    );
  }

  if (businessData?.isSuspended && !isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-white p-6 text-center transition-colors duration-300">
        <div className="bg-red-50 p-6 rounded-full mb-6 border-4 border-red-100 shadow-inner">
          <i className="fas fa-lock text-6xl text-red-600"></i>
        </div>
        <h2 className="text-3xl font-black mb-3 text-red-600">Akses Ditangguhkan</h2>
        <button onClick={() => signOut(auth)} className="bg-gray-800 text-white px-8 py-3.5 rounded-xl font-bold transition active:scale-95 shadow-lg flex items-center gap-2">
          <i className="fas fa-sign-out-alt"></i> Keluar
        </button>
      </div>
    );
  }

  if (currentUser && !hasAccess(currentView)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-white p-6 text-center transition-colors duration-300">
        <i className="fas fa-shield-alt text-6xl text-red-500 mb-4"></i>
        <h2 className="text-2xl font-bold mb-2">Area Terlarang</h2>
        <button onClick={() => handleNavigate(isSuperAdmin && !impersonatedUid ? 'superadmin' : 'lobby')} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold transition active:scale-95 shadow-lg">
          Kembali
        </button>
      </div>
    );
  }

  // 🔥 MAGIC TRICK: "Effective User"
  // Kalau admin sedang menyamar, kita mengirimkan data palsu (UID klien) ke seluruh anak aplikasi!
  const effectiveUser = impersonatedUid && currentUser 
    ? { ...currentUser, uid: impersonatedUid } 
    : currentUser;

  return (
    <div className="App flex flex-col min-h-screen bg-gray-50 text-gray-800 dark:bg-gray-900 dark:text-gray-100 font-sans overflow-x-hidden transition-colors duration-300">
      
      {/* 🔥 SPANDUK PERINGATAN MATA DEWA 🔥 */}
      {impersonatedUid && (
        <div className="bg-red-600 text-white px-4 py-2 flex justify-between items-center text-[10px] md:text-xs font-bold z-[100] shadow-md border-b border-red-800 flex-none sticky top-0">
          <span className="flex items-center gap-2 animate-pulse">
            <i className="fas fa-user-secret text-base"></i>
            <span className="hidden sm:inline">MATA DEWA: Sedang menyamar sebagai</span>
            <span className="sm:hidden">MENYAMAR:</span>
            <span className="bg-red-800/50 px-2 py-0.5 rounded ml-1">{businessData?.shopName || 'Klien'}</span>
          </span>
          <button
            onClick={() => {
              setImpersonatedUid(null);
              handleNavigate('superadmin');
            }}
            className="bg-black/30 hover:bg-black/50 px-3 py-1.5 rounded-lg transition border border-red-500/30 flex items-center gap-1.5"
          >
            <i className="fas fa-times"></i> <span className="hidden sm:inline">Kembali ke Admin</span>
          </button>
        </div>
      )}

      {/* RENDER HALAMAN SEPERTI BIASA (TAPI MENGGUNAKAN EFFECTIVE USER) */}
      <div className="flex-1 overflow-y-auto">
        {currentUser ? (
          <>
            {currentView === 'lobby' && <Lobby businessData={businessData} onNavigate={handleNavigate} />}
            {currentView === 'cashier' && <Cashier businessData={businessData} currentUser={effectiveUser} onNavigate={handleNavigate} />}
            {currentView === 'report' && <Report businessData={businessData} currentUser={effectiveUser} onNavigate={handleNavigate} />}
            {currentView === 'calculator' && <Calculator onNavigate={handleNavigate} />}
            
            {currentView === 'admin' && <Admin businessData={businessData} currentUser={effectiveUser} onNavigate={handleNavigate} />}
            {currentView === 'stock' && <Stock businessData={businessData} currentUser={effectiveUser} onNavigate={handleNavigate} />}
            {currentView === 'settings' && <Settings businessData={businessData} currentUser={effectiveUser} onNavigate={handleNavigate} />}
            {currentView === 'table' && <Table businessData={businessData} currentUser={effectiveUser} onNavigate={handleNavigate} />}
            {currentView === 'studio' && <Studio businessData={businessData} currentUser={effectiveUser} onNavigate={handleNavigate} />}
            
            {/* SuperAdmin dikirimkan fungsi untuk memicu fitur menyamar */}
            {currentView === 'superadmin' && <SuperAdmin currentUser={currentUser} onImpersonate={setImpersonatedUid} />}
          </>
        ) : (
          <Auth />
        )}
      </div>
    </div>
  );
}

export default App;
