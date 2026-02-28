import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import Swal from 'sweetalert2';

export default function Lobby({ businessData, onNavigate }) {
  // === DETEKSI ROLE ===
  // Jika role-nya 'kasir', maka isKasir bernilai true
  const isKasir = businessData?.role === 'kasir';

  // === AMBIL DATA TEMA DARI FIREBASE ===
  const themeData = businessData?.themeData || {};

  const getTheme = (id, defaultColor, defaultText, defaultIcon) => {
    return themeData[id] || { color: defaultColor, text: defaultText, icon: defaultIcon, customHex: '' };
  };

  const themeBg = getTheme('lobby_bg', 'bg-gray-900', '', '');
  const themeTitle = getTheme('lobby_title', 'text-yellow-400', '', '');
  
  const cashierTheme = getTheme('btn_cashier', 'bg-blue-600', 'Mulai Jualan', 'fa-cash-register');
  const stockTheme = getTheme('btn_stock', 'bg-indigo-600', 'Stok', 'fa-boxes');
  const reportTheme = getTheme('btn_report', 'bg-purple-600', 'Laporan', 'fa-file-invoice');
  const tableTheme = getTheme('btn_table', 'bg-emerald-600', 'Tabel Rekap', 'fa-table');
  const calcTheme = getTheme('btn_calc', 'bg-teal-600', 'Manual', 'fa-calculator');
  const adminTheme = getTheme('btn_admin', 'bg-orange-600', 'Kelola Menu', 'fa-utensils');
  const settingTheme = getTheme('btn_setting', 'bg-gray-600', 'Setting', 'fa-cog');

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

  const handleDarkMode = () => {
    document.body.classList.toggle('dark');
    localStorage.setItem('darkMode', document.body.classList.contains('dark'));
  };

  const handleBackup = () => {
    Swal.fire('Info', 'Fitur Backup CSV sedang dipindahkan ke React!', 'info');
  };

  return (
    <div 
      className={`flex flex-col items-center justify-center min-h-screen p-6 text-center w-full ${themeBg.customHex ? '' : themeBg.color}`}
      style={themeBg.customHex ? { backgroundColor: themeBg.customHex } : {}}
    >
      <div className="w-full max-w-3xl mx-auto flex flex-col items-center">
        
        {/* HEADER LOBI */}
        <div className="mb-6 flex-none">
          <h1 
            className={`text-3xl font-extrabold mb-1 ${themeTitle.customHex ? '' : themeTitle.color}`}
            style={themeTitle.customHex ? { color: themeTitle.customHex } : {}}
          >
            {businessData?.shopName || businessData?.name || 'ISZI'}
          </h1>
          <p className="text-gray-400 text-sm">
            {businessData?.shopAddress || businessData?.address || 'Nusadua Bali'}
          </p>
          {isKasir && (
            <span className="inline-block mt-2 bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-1 rounded-full">
              Mode Kasir
            </span>
          )}
        </div>

        {/* GRID TOMBOL MENU */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full max-w-sm md:max-w-3xl flex-none">
          
          {/* 1. Tombol Kasir (Bisa diakses Semua) */}
          <button 
            onClick={() => onNavigate('cashier')} 
            className={`col-span-2 md:col-span-4 hover:opacity-90 p-4 rounded-xl shadow-lg flex items-center gap-3 transition transform active:scale-95 text-left text-white ${cashierTheme.customHex ? '' : cashierTheme.color}`}
            style={cashierTheme.customHex ? { backgroundColor: cashierTheme.customHex } : {}}
          >
            <div className="bg-black bg-opacity-20 p-3 rounded-full w-10 h-10 flex items-center justify-center">
              <i className={`fas ${cashierTheme.icon} text-lg`}></i>
            </div>
            <div>
              <h3 className="font-bold text-base">{cashierTheme.text}</h3>
              <p className="text-[10px] text-gray-200">Buka Kasir Menu</p>
            </div>
          </button>

          {/* 2. Tombol Laporan (Bisa diakses Semua) */}
          <button 
            onClick={() => onNavigate('report')} 
            className={`hover:opacity-90 p-4 rounded-xl shadow-lg flex flex-col items-center gap-2 transition transform active:scale-95 text-center justify-center text-white ${reportTheme.customHex ? '' : reportTheme.color}`}
            style={reportTheme.customHex ? { backgroundColor: reportTheme.customHex } : {}}
          >
            <i className={`fas ${reportTheme.icon} text-2xl mb-1`}></i>
            <h3 className="font-bold text-sm">{reportTheme.text}</h3>
          </button>

          {/* 3. Tombol Manual (Bisa diakses Semua) */}
          <button 
            onClick={() => onNavigate('calculator')} 
            className={`hover:opacity-90 p-4 rounded-xl shadow-lg flex flex-col items-center gap-2 transition transform active:scale-95 text-center justify-center text-white ${calcTheme.customHex ? '' : calcTheme.color}`}
            style={calcTheme.customHex ? { backgroundColor: calcTheme.customHex } : {}}
          >
            <i className={`fas ${calcTheme.icon} text-2xl mb-1`}></i>
            <h3 className="font-bold text-xs">{calcTheme.text}</h3>
          </button>

          {/* 🔥 AREA TERLARANG UNTUK KASIR 🔥 */}
          {!isKasir && (
            <>
              {/* Tombol Stok */}
              <button 
                onClick={() => onNavigate('stock')} 
                className={`hover:opacity-90 p-4 rounded-xl shadow-lg flex flex-col items-center gap-2 transition transform active:scale-95 text-center justify-center text-white ${stockTheme.customHex ? '' : stockTheme.color}`}
                style={stockTheme.customHex ? { backgroundColor: stockTheme.customHex } : {}}
              >
                <i className={`fas ${stockTheme.icon} text-2xl mb-1`}></i>
                <h3 className="font-bold text-sm">{stockTheme.text}</h3>
              </button>

              {/* Tombol Tabel */}
              <button 
                onClick={() => onNavigate('table')} 
                className={`hover:opacity-90 p-4 rounded-xl shadow-lg flex flex-col items-center gap-2 transition transform active:scale-95 text-center justify-center text-white ${tableTheme.customHex ? '' : tableTheme.color}`}
                style={tableTheme.customHex ? { backgroundColor: tableTheme.customHex } : {}}
              >
                <i className={`fas ${tableTheme.icon} text-2xl mb-1`}></i>
                <h3 className="font-bold text-xs">{tableTheme.text}</h3>
              </button>

              {/* Tombol Admin */}
              <button 
                onClick={() => onNavigate('admin')} 
                className={`hover:opacity-90 p-4 rounded-xl shadow-lg flex flex-col items-center gap-2 transition transform active:scale-95 text-center justify-center text-white ${adminTheme.customHex ? '' : adminTheme.color}`}
                style={adminTheme.customHex ? { backgroundColor: adminTheme.customHex } : {}}
              >
                <i className={`fas ${adminTheme.icon} text-2xl mb-1`}></i>
                <h3 className="font-bold text-xs">{adminTheme.text}</h3>
              </button>

              {/* Tombol Setting */}
              <button 
                onClick={() => onNavigate('settings')} 
                className={`hover:opacity-90 p-4 rounded-xl shadow-lg flex flex-col items-center gap-2 transition transform active:scale-95 text-center justify-center text-white ${settingTheme.customHex ? '' : settingTheme.color}`}
                style={settingTheme.customHex ? { backgroundColor: settingTheme.customHex } : {}}
              >
                <i className={`fas ${settingTheme.icon} text-2xl mb-1`}></i>
                <h3 className="font-bold text-xs">{settingTheme.text}</h3>
              </button>
            </>
          )}

        </div>
        
        {/* FOOTER */}
        <p className="mt-8 text-xs text-gray-500 flex-none">ISZI v1.0 React (For more fitur contact us 081559557553)</p>

        <div className="flex gap-2 justify-center mt-2">
          <button onClick={handleDarkMode} className="text-xs bg-gray-700 text-gray-200 px-3 py-1.5 rounded font-semibold active:scale-95 transition">Dark Mode</button>
          {!isKasir && <button onClick={handleBackup} className="text-xs bg-green-700 text-gray-100 px-3 py-1.5 rounded font-semibold active:scale-95 transition">Backup CSV</button>}
          <button onClick={handleLogout} className="text-xs bg-red-700 text-gray-100 px-3 py-1.5 rounded font-semibold active:scale-95 transition">Logout</button>
        </div>
      </div>
    </div>
  );
}
