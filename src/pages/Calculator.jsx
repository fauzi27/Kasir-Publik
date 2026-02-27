import { useState } from 'react';
import Swal from 'sweetalert2';

export default function Calculator({ onNavigate }) {
  // === STATE KALKULATOR ===
  const [display, setDisplay] = useState('0');
  const [manualItems, setManualItems] = useState([]);

  // === FUNGSI TOMBOL KALKULATOR ===
  const appendCalc = (val) => {
    setDisplay(prev => {
      if (prev === '0') return val;
      // Batasi panjang digit agar tidak error
      if (prev.length > 10) return prev; 
      return prev + val;
    });
  };

  const clearCalc = () => setDisplay('0');

  const backspaceCalc = () => {
    setDisplay(prev => {
      if (prev.length <= 1) return '0';
      return prev.slice(0, -1);
    });
  };

  // === FUNGSI TAMBAH KE LIST ===
  const addToManualList = () => {
    const price = parseInt(display);
    if (price > 0) {
      const newItem = {
        id: 'manual_' + Date.now(),
        name: 'Item Manual',
        price: price,
        qty: 1
      };
      setManualItems([...manualItems, newItem]);
      setDisplay('0'); // Reset layar setelah ditambah
    }
  };

  const removeManualItem = (id) => {
    setManualItems(manualItems.filter(item => item.id !== id));
  };

  // === FUNGSI SELESAI (MASUK KERANJANG) ===
  const finishManualSession = () => {
    if (manualItems.length === 0) return;
    
    // Karena State Cart ada di Cashier.jsx, untuk sementara kita simpan ke LocalStorage
    // Nanti saat digabung, Cashier.jsx bisa membaca data ini
    const existingCart = JSON.parse(localStorage.getItem('temp_manual_cart') || '[]');
    const newCart = [...existingCart, ...manualItems];
    localStorage.setItem('temp_manual_cart', JSON.stringify(newCart));

    Swal.fire({
      icon: 'success',
      title: 'Masuk Keranjang!',
      text: `${manualItems.length} item manual ditambahkan.`,
      timer: 1500,
      showConfirmButton: false
    }).then(() => {
      onNavigate('cashier'); // Otomatis pindah ke halaman Kasir
    });
  };

  // Kalkulasi Total
  const grandTotal = manualItems.reduce((sum, item) => sum + item.price, 0);

  // === RENDER TAMPILAN ===
  return (
    <div className="flex flex-col h-screen bg-gray-100 text-gray-800">
      
      {/* HEADER */}
      <div className="bg-white p-4 shadow-sm flex items-center gap-3 flex-none z-10">
        <button onClick={() => onNavigate('lobby')} className="text-gray-600 hover:text-gray-900 active:scale-90 transition p-1">
          <i className="fas fa-times text-xl"></i>
        </button>
        <h2 className="font-bold text-lg">Kasir Manual</h2>
      </div>

      <div className="flex-1 flex flex-col p-4 w-full overflow-hidden max-w-md mx-auto">
        
        {/* LIST ITEM MANUAL */}
        <div className="flex-1 overflow-y-auto mb-3 border border-gray-200 bg-white rounded-xl p-3 shadow-sm hide-scrollbar">
          {manualItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400">
              <i className="fas fa-receipt text-3xl mb-2 opacity-30"></i>
              <p className="text-xs">Belum ada item manual</p>
            </div>
          ) : (
            manualItems.map((item, index) => (
              <div key={item.id} className="flex justify-between items-center p-2 border-b border-gray-100 last:border-0">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-gray-400 w-4">{index + 1}.</span>
                  <div>
                    <p className="font-bold text-sm text-gray-700">{item.name}</p>
                    <p className="text-xs text-blue-600 font-bold">Rp {item.price.toLocaleString('id-ID')}</p>
                  </div>
                </div>
                <button 
                  onClick={() => removeManualItem(item.id)}
                  className="w-8 h-8 flex items-center justify-center text-red-400 hover:text-red-600 active:scale-90 transition bg-red-50 rounded-lg"
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>
            ))
          )}
        </div>

        {/* AREA KALKULATOR BAWAH */}
        <div className="flex-none flex flex-col gap-3">
          
          {/* LAYAR DISPLAY */}
          <div className="bg-white p-4 rounded-xl shadow-sm text-right border border-gray-200 relative overflow-hidden">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 font-bold text-xl">Rp</div>
            <p className="text-[10px] text-gray-400 absolute right-4 top-2">Input Harga Baru</p>
            <div className="text-4xl font-extrabold text-gray-800 tracking-tight mt-3">
              {parseInt(display).toLocaleString('id-ID')}
            </div>
          </div>
          
          {/* TOMBOL NUMPAD */}
          <div className="grid grid-cols-4 gap-2 h-[45vh] min-h-[250px] max-h-[350px]">
            {/* Baris 1 */}
            <button onClick={() => appendCalc('7')} className="bg-white rounded-xl shadow-sm border border-gray-100 font-bold text-2xl text-gray-700 active:bg-gray-200 transition">7</button>
            <button onClick={() => appendCalc('8')} className="bg-white rounded-xl shadow-sm border border-gray-100 font-bold text-2xl text-gray-700 active:bg-gray-200 transition">8</button>
            <button onClick={() => appendCalc('9')} className="bg-white rounded-xl shadow-sm border border-gray-100 font-bold text-2xl text-gray-700 active:bg-gray-200 transition">9</button>
            <button onClick={clearCalc} className="bg-red-50 rounded-xl shadow-sm border border-red-100 font-bold text-2xl text-red-500 active:bg-red-100 transition">C</button>
            
            {/* Baris 2 */}
            <button onClick={() => appendCalc('4')} className="bg-white rounded-xl shadow-sm border border-gray-100 font-bold text-2xl text-gray-700 active:bg-gray-200 transition">4</button>
            <button onClick={() => appendCalc('5')} className="bg-white rounded-xl shadow-sm border border-gray-100 font-bold text-2xl text-gray-700 active:bg-gray-200 transition">5</button>
            <button onClick={() => appendCalc('6')} className="bg-white rounded-xl shadow-sm border border-gray-100 font-bold text-2xl text-gray-700 active:bg-gray-200 transition">6</button>
            <button onClick={backspaceCalc} className="bg-orange-50 rounded-xl shadow-sm border border-orange-100 font-bold text-xl text-orange-500 active:bg-orange-100 transition flex items-center justify-center">
              <i className="fas fa-backspace"></i>
            </button>
            
            {/* Baris 3 & 4 (Digabung dengan ADD) */}
            <button onClick={() => appendCalc('1')} className="bg-white rounded-xl shadow-sm border border-gray-100 font-bold text-2xl text-gray-700 active:bg-gray-200 transition">1</button>
            <button onClick={() => appendCalc('2')} className="bg-white rounded-xl shadow-sm border border-gray-100 font-bold text-2xl text-gray-700 active:bg-gray-200 transition">2</button>
            <button onClick={() => appendCalc('3')} className="bg-white rounded-xl shadow-sm border border-gray-100 font-bold text-2xl text-gray-700 active:bg-gray-200 transition">3</button>
            <button onClick={addToManualList} className="row-span-2 bg-blue-100 text-blue-600 border border-blue-200 rounded-xl shadow-sm active:bg-blue-200 transition flex flex-col items-center justify-center gap-1">
              <i className="fas fa-plus text-2xl"></i> <span className="text-[10px] font-bold">ADD</span>
            </button>

            <button onClick={() => appendCalc('0')} className="col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 font-bold text-2xl text-gray-700 active:bg-gray-200 transition">0</button>
            <button onClick={() => appendCalc('00')} className="bg-white rounded-xl shadow-sm border border-gray-100 font-bold text-xl text-gray-700 active:bg-gray-200 transition">00</button>
          </div>
        </div>
      </div>

      {/* FOOTER: MASUK KERANJANG */}
      {manualItems.length > 0 && (
        <div className="p-4 bg-white border-t flex-none pb-safe animate-fade-in-up">
          <button 
            onClick={finishManualSession} 
            className="w-full bg-green-600 hover:bg-green-700 text-white py-3.5 rounded-xl font-bold shadow-lg flex justify-between px-6 items-center active:scale-95 transition"
          >
            <span>Masuk Keranjang</span> 
            <span className="text-lg">Rp {grandTotal.toLocaleString('id-ID')}</span>
          </button>
        </div>
      )}
    </div>
  );
}
