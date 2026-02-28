import { useState } from 'react';
import { db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';
import Swal from 'sweetalert2';

export default function Studio({ businessData, currentUser, onNavigate }) {
  // Ambil tema saat ini dari database atau gunakan object kosong
  const existingTheme = businessData?.themeData || {};
  
  // State untuk menyimpan tema yang sedang diedit sebelum di-save
  const [currentTheme, setCurrentTheme] = useState(existingTheme);
  
  // State untuk mengontrol Modal Editor
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null); 

  // State untuk Form di dalam Modal
  const [formColor, setFormColor] = useState('');
  const [formText, setFormText] = useState('');
  const [formIcon, setFormIcon] = useState('');
  const [formHex, setFormHex] = useState('');

  // === DATA PREVIEW HELPER ===
  const getTheme = (id, defaultColor, defaultText, defaultIcon) => {
    return currentTheme[id] || { color: defaultColor, text: defaultText, icon: defaultIcon, customHex: '' };
  };

  // Definisi semua elemen yang bisa diedit
  const themeBg = getTheme('lobby_bg', 'bg-gray-900', '', '');
  const themeTitle = getTheme('lobby_title', 'text-yellow-400', '', '');
  
  const cashierTheme = getTheme('btn_cashier', 'bg-blue-600', 'Mulai Jualan', 'fa-cash-register');
  const stockTheme = getTheme('btn_stock', 'bg-indigo-600', 'Stok', 'fa-boxes');
  const reportTheme = getTheme('btn_report', 'bg-purple-600', 'Laporan', 'fa-file-invoice');
  const tableTheme = getTheme('btn_table', 'bg-emerald-600', 'Tabel Rekap', 'fa-table');
  const calcTheme = getTheme('btn_calc', 'bg-teal-600', 'Manual', 'fa-calculator');
  const adminTheme = getTheme('btn_admin', 'bg-orange-600', 'Kelola Menu', 'fa-utensils');
  const settingTheme = getTheme('btn_setting', 'bg-gray-600', 'Setting', 'fa-cog');

  // === BUKA MODAL EDIT ===
  const openEditor = (targetId, type) => {
    let defaultColor = '';
    // Tentukan warna default jika belum ada di state untuk formColor fallback
    if (targetId === 'lobby_bg') defaultColor = 'bg-gray-900';
    if (targetId === 'lobby_title') defaultColor = 'text-yellow-400';
    if (targetId === 'btn_cashier') defaultColor = 'bg-blue-600';
    if (targetId === 'btn_stock') defaultColor = 'bg-indigo-600';
    if (targetId === 'btn_report') defaultColor = 'bg-purple-600';
    if (targetId === 'btn_table') defaultColor = 'bg-emerald-600';
    if (targetId === 'btn_calc') defaultColor = 'bg-teal-600';
    if (targetId === 'btn_admin') defaultColor = 'bg-orange-600';
    if (targetId === 'btn_setting') defaultColor = 'bg-gray-600';

    const currentData = currentTheme[targetId] || {};
    
    setEditTarget({ id: targetId, type });
    setFormColor(currentData.color || defaultColor);
    setFormText(currentData.text !== undefined ? currentData.text : getTheme(targetId, '', '', '').text);
    setFormIcon(currentData.icon || getTheme(targetId, '', '', '').icon);
    setFormHex(currentData.customHex || '');
    setModalOpen(true);
  };

  // === TERAPKAN PREVIEW LOKAL ===
  const handleApplyPreview = () => {
    setCurrentTheme(prev => ({
      ...prev,
      [editTarget.id]: {
        type: editTarget.type,
        color: formHex ? '' : formColor, 
        customHex: formHex,
        text: formText,
        icon: formIcon
      }
    }));
    setModalOpen(false);
  };

  // === SIMPAN KE FIREBASE ===
  const handleSaveToFirebase = async () => {
    Swal.fire({ title: 'Menyimpan Tema...', didOpen: () => Swal.showLoading() });
    try {
      await setDoc(doc(db, "users", currentUser.uid), { 
        themeData: currentTheme 
      }, { merge: true });
      
      businessData.themeData = currentTheme; 
      localStorage.setItem('cached_user_profile', JSON.stringify(businessData));

      Swal.fire('Sukses', 'Tema berhasil diterapkan ke semua HP Kasir!', 'success');
    } catch (error) {
      Swal.fire('Error', error.message, 'error');
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* HEADER */}
      <div className="bg-indigo-800 text-white p-4 shadow-md flex-none z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => onNavigate('settings')} className="active:scale-90 transition p-1">
            <i className="fas fa-arrow-left text-xl"></i>
          </button>
          <div>
            <h2 className="font-bold text-lg">Studio Tampilan</h2>
            <p className="text-[10px] text-indigo-200">Klik komponen di bawah untuk mengedit warnanya</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 flex flex-col items-center">
        {/* AREA PREVIEW LOBI */}
        <div 
          className={`w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden border-4 border-gray-800 relative h-[75vh] flex flex-col ${themeBg.customHex ? '' : themeBg.color}`}
          style={themeBg.customHex ? { backgroundColor: themeBg.customHex } : {}}
        >
          <div className="p-6 text-center mt-2 flex-none">
            <div className="flex justify-center gap-2 mb-3">
              <button onClick={() => openEditor('lobby_bg', 'bg')} className="text-[10px] bg-gray-700 text-white px-3 py-1.5 rounded-full border border-gray-600 active:scale-95 transition">
                <i className="fas fa-fill-drip mr-1"></i>Edit Latar
              </button>
              <button onClick={() => openEditor('lobby_title', 'title')} className="text-[10px] bg-gray-700 text-white px-3 py-1.5 rounded-full border border-gray-600 active:scale-95 transition">
                <i className="fas fa-font mr-1"></i>Edit Judul
              </button>
            </div>
            <h1 
              className={`text-2xl font-extrabold mb-1 ${themeTitle.customHex ? '' : themeTitle.color}`}
              style={themeTitle.customHex ? { color: themeTitle.customHex } : {}}
            >
              PREVIEW LOBI
            </h1>
          </div>

          <div className="grid grid-cols-2 gap-3 p-4 w-full flex-1 overflow-y-auto pb-10 hide-scrollbar">
            
            <button 
              onClick={() => openEditor('btn_cashier', 'button')}
              className={`col-span-2 p-4 rounded-xl shadow-lg flex items-center gap-3 active:scale-95 transition ${cashierTheme.customHex ? '' : cashierTheme.color}`}
              style={cashierTheme.customHex ? { backgroundColor: cashierTheme.customHex } : {}}
            >
              <div className="bg-black bg-opacity-20 p-3 rounded-full w-10 h-10 flex items-center justify-center text-white">
                <i className={`fas ${cashierTheme.icon}`}></i>
              </div>
              <div className="text-left text-white"><h3 className="font-bold text-sm">{cashierTheme.text}</h3></div>
            </button>

            <button 
              onClick={() => openEditor('btn_stock', 'button')}
              className={`p-4 rounded-xl shadow-lg flex flex-col items-center gap-2 active:scale-95 transition text-white ${stockTheme.customHex ? '' : stockTheme.color}`}
              style={stockTheme.customHex ? { backgroundColor: stockTheme.customHex } : {}}
            >
              <i className={`fas ${stockTheme.icon} text-xl`}></i>
              <h3 className="font-bold text-[10px]">{stockTheme.text}</h3>
            </button>

             <button 
              onClick={() => openEditor('btn_report', 'button')}
              className={`p-4 rounded-xl shadow-lg flex flex-col items-center gap-2 active:scale-95 transition text-white ${reportTheme.customHex ? '' : reportTheme.color}`}
              style={reportTheme.customHex ? { backgroundColor: reportTheme.customHex } : {}}
            >
              <i className={`fas ${reportTheme.icon} text-xl`}></i>
              <h3 className="font-bold text-[10px]">{reportTheme.text}</h3>
            </button>

             <button 
              onClick={() => openEditor('btn_table', 'button')}
              className={`p-4 rounded-xl shadow-lg flex flex-col items-center gap-2 active:scale-95 transition text-white ${tableTheme.customHex ? '' : tableTheme.color}`}
              style={tableTheme.customHex ? { backgroundColor: tableTheme.customHex } : {}}
            >
              <i className={`fas ${tableTheme.icon} text-xl`}></i>
              <h3 className="font-bold text-[10px]">{tableTheme.text}</h3>
            </button>

            <button 
              onClick={() => openEditor('btn_calc', 'button')}
              className={`p-4 rounded-xl shadow-lg flex flex-col items-center gap-2 active:scale-95 transition text-white ${calcTheme.customHex ? '' : calcTheme.color}`}
              style={calcTheme.customHex ? { backgroundColor: calcTheme.customHex } : {}}
            >
              <i className={`fas ${calcTheme.icon} text-xl`}></i>
              <h3 className="font-bold text-[10px]">{calcTheme.text}</h3>
            </button>

            <button 
              onClick={() => openEditor('btn_admin', 'button')}
              className={`p-4 rounded-xl shadow-lg flex flex-col items-center gap-2 active:scale-95 transition text-white ${adminTheme.customHex ? '' : adminTheme.color}`}
              style={adminTheme.customHex ? { backgroundColor: adminTheme.customHex } : {}}
            >
              <i className={`fas ${adminTheme.icon} text-xl`}></i>
              <h3 className="font-bold text-[10px]">{adminTheme.text}</h3>
            </button>

            <button 
              onClick={() => openEditor('btn_setting', 'button')}
              className={`p-4 rounded-xl shadow-lg flex flex-col items-center gap-2 active:scale-95 transition text-white ${settingTheme.customHex ? '' : settingTheme.color}`}
              style={settingTheme.customHex ? { backgroundColor: settingTheme.customHex } : {}}
            >
              <i className={`fas ${settingTheme.icon} text-xl`}></i>
              <h3 className="font-bold text-[10px]">{settingTheme.text}</h3>
            </button>

          </div>
        </div>
        
        <button onClick={handleSaveToFirebase} className="mt-6 bg-green-600 text-white w-full max-w-sm py-3 rounded-xl font-bold shadow-lg active:scale-95 transition">
          <i className="fas fa-cloud-upload-alt mr-1"></i> Terapkan Tema ke Semua HP
        </button>
      </div>

      {/* MODAL EDITOR SEDERHANA */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-80 z-[110] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-5 space-y-4">
            <h3 className="font-bold text-gray-800 mb-2 border-b pb-2"><i className="fas fa-paint-brush mr-2 text-indigo-600"></i>Edit Elemen</h3>
            
            {editTarget?.type === 'button' && (
              <>
                <div>
                  <label className="text-xs font-bold text-gray-500">Teks Tombol</label>
                  <input type="text" value={formText} onChange={e => setFormText(e.target.value)} className="w-full p-2 border rounded-lg text-sm outline-none mt-1" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500">Icon (FontAwesome)</label>
                  <input type="text" value={formIcon} onChange={e => setFormIcon(e.target.value)} placeholder="fa-boxes" className="w-full p-2 border rounded-lg text-sm outline-none mt-1" />
                  <p className="text-[10px] text-gray-400 mt-1">Gunakan format <b>fa-nama-icon</b></p>
                </div>
              </>
            )}

            <div>
              <label className="text-xs font-bold text-gray-500">Pilih Warna Bebas (Hex)</label>
              <div className="flex gap-2 mt-1 items-center">
                <input type="color" value={formHex || '#cccccc'} onChange={e => setFormHex(e.target.value)} className="w-12 h-10 p-0 border-0 rounded cursor-pointer shadow-sm" />
                <button onClick={() => setFormHex('')} className="bg-gray-200 text-xs px-3 py-2 rounded font-bold text-gray-600 active:scale-95">Reset Warna</button>
              </div>
              <p className="text-[10px] text-gray-400 mt-1">Jika di-reset, akan kembali ke warna bawaan sistem.</p>
            </div>

            <div className="flex gap-2 pt-2 border-t mt-4">
              <button onClick={() => setModalOpen(false)} className="flex-1 bg-gray-300 py-2.5 rounded-xl font-bold text-gray-700 active:scale-95 transition">Batal</button>
              <button onClick={handleApplyPreview} className="flex-1 bg-indigo-600 text-white py-2.5 rounded-xl font-bold active:scale-95 transition">Simpan Preview</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
