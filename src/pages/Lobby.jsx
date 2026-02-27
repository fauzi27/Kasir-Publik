import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import Swal from 'sweetalert2';

export default function Lobby({ businessData, onNavigate }) {
  // === FUNGSI LOGOUT ===
  const handleLogout = () => {
    Swal.fire({
      title: 'Keluar?',
      text: "Anda harus login lagi nanti",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, Keluar'
    }).then((result) => {
      if (result.isConfirmed) {
        signOut(auth);
      }
    });
  };

  // === FUNGSI DARK MODE ===
  const handleDarkMode = () => {
    document.body.classList.toggle('dark');
    const isDark = document.body.classList.contains('dark');
    localStorage.setItem('darkMode', isDark);
  };

  // === FUNGSI BACKUP (Mockup sementara) ===
  const handleBackup = () => {
    Swal.fire('Info', 'Fitur Backup CSV sedang dipindahkan ke React!', 'info');
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 text-white text-center w-full max-w-3xl mx-auto">
      {/* HEADER LOBI */}
      <div className="mb-6 flex-none">
        <h1 className="text-3xl font-extrabold text-yellow-400 mb-1">
          {businessData?.shopName || businessData?.name || 'ISZI'}
        </h1>
        <p className="text-gray-400 text-sm">
          {businessData?.shopAddress || businessData?.address || 'Nusadua Bali'}
        </p>
      </div>

      {/* GRID TOMBOL MENU */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full max-w-sm md:max-w-3xl flex-none">
        {/* Tombol Kasir */}
        <button 
          onClick={() => onNavigate('cashier')} 
          className="col-span-2 md:col-span-4 bg-blue-600 hover:opacity-90 p-4 rounded-xl shadow-lg flex items-center gap-3 transition transform active:scale-95 text-left text-white"
        >
          <div className="bg-black bg-opacity-20 p-3 rounded-full w-10 h-10 flex items-center justify-center">
            <i className="fas fa-cash-register text-lg"></i>
          </div>
          <div>
            <h3 className="font-bold text-base">Mulai Jualan</h3>
            <p className="text-[10px] text-gray-200">Buka Kasir Menu</p>
          </div>
        </button>

        {/* Tombol Stok */}
        <button 
          onClick={() => onNavigate('stock')} 
          className="bg-indigo-600 hover:opacity-90 p-4 rounded-xl shadow-lg flex flex-col items-center gap-2 transition transform active:scale-95 text-center justify-center text-white"
        >
          <i className="fas fa-boxes text-2xl mb-1"></i>
          <h3 className="font-bold text-sm">Stok</h3>
        </button>

        {/* Tombol Laporan */}
        <button 
          onClick={() => onNavigate('report')} 
          className="bg-purple-600 hover:opacity-90 p-4 rounded-xl shadow-lg flex flex-col items-center gap-2 transition transform active:scale-95 text-center justify-center text-white"
        >
          <i className="fas fa-file-invoice text-2xl mb-1"></i>
          <h3 className="font-bold text-sm">Laporan</h3>
        </button>
       
        {/* Tombol Tabel */}
        <button 
          onClick={() => onNavigate('table')} 
          className="bg-emerald-600 hover:opacity-90 p-4 rounded-xl shadow-lg flex flex-col items-center gap-2 transition transform active:scale-95 text-center justify-center text-white"
        >
          <i className="fas fa-table text-2xl mb-1"></i>
          <h3 className="font-bold text-xs">Tabel Rekap</h3>
        </button>

        {/* Tombol Manual */}
        <button 
          onClick={() => onNavigate('calculator')} 
          className="bg-teal-600 hover:opacity-90 p-4 rounded-xl shadow-lg flex flex-col items-center gap-2 transition transform active:scale-95 text-center justify-center text-white"
        >
          <i className="fas fa-calculator text-2xl mb-1"></i>
          <h3 className="font-bold text-xs">Manual</h3>
        </button>

        {/* Tombol Admin */}
        <button 
          onClick={() => onNavigate('admin')} 
          className="bg-orange-600 hover:opacity-90 p-4 rounded-xl shadow-lg flex flex-col items-center gap-2 transition transform active:scale-95 text-center justify-center text-white"
        >
          <i className="fas fa-utensils text-2xl mb-1"></i>
          <h3 className="font-bold text-xs">Kelola Menu</h3>
        </button>

        {/* Tombol Setting */}
        <button 
          onClick={() => onNavigate('settings')} 
          className="bg-gray-600 hover:opacity-90 p-4 rounded-xl shadow-lg flex flex-col items-center gap-2 transition transform active:scale-95 text-center justify-center text-white"
        >
          <i className="fas fa-cog text-2xl mb-1"></i>
          <h3 className="font-bold text-xs">Setting</h3>
        </button>
      </div>
      
      {/* FOOTER */}
      <p className="mt-8 text-xs text-gray-600 flex-none">ISZI v1.0 React (For more fitur contact us 081559557553)</p>

      <div className="flex gap-2 justify-center mt-2">
        <button onClick={handleDarkMode} className="text-xs bg-gray-600 text-white px-3 py-1.5 rounded font-semibold active:scale-95 transition">Dark Mode</button>
        <button onClick={handleBackup} className="text-xs bg-green-600 text-white px-3 py-1.5 rounded font-semibold active:scale-95 transition">Backup CSV</button>
        <button onClick={handleLogout} className="text-xs bg-red-600 text-white px-3 py-1.5 rounded font-semibold active:scale-95 transition">Logout</button>
      </div>
    </div>
  );
}
