import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, doc, writeBatch } from 'firebase/firestore';
import Swal from 'sweetalert2';
import ReceiptModal from '../components/ReceiptModal';

export default function Cashier({ businessData, currentUser, onNavigate }) {
  // === STATE DATA ===
  const [menus, setMenus] = useState([]);
  const [categories, setCategories] = useState([]);
  
  // === STATE UI & KERANJANG ===
  // 1. Ambil data keranjang dari memori (jika kasir habis dari kalkulator/refresh)
  const [cart, setCart] = useState(() => {
    try {
      const savedCart = localStorage.getItem('iszi_saved_cart');
      return savedCart ? JSON.parse(savedCart) : [];
    } catch (e) {
      return [];
    }
  });

  // 2. Simpan otomatis ke memori setiap kali kasir nambah/kurang menu
  useEffect(() => {
    localStorage.setItem('iszi_saved_cart', JSON.stringify(cart));
  }, [cart]);

  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [buyerName, setBuyerName] = useState('');

  // === STATE MODAL STRUK ===
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('payment'); // 'payment' atau 'view'
  const [currentTransaction, setCurrentTransaction] = useState(null);

  // Menentukan ID Pemilik Toko
  const shopOwnerId = businessData?.ownerId || currentUser?.uid;

  // === MENGAMBIL DATA & CEK KALKULATOR MANUAL ===
  useEffect(() => {
    if (!shopOwnerId) return;

    const unsubCat = onSnapshot(collection(db, "users", shopOwnerId, "categories"), (snapshot) => {
      setCategories(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() })));
    });

    const unsubMenu = onSnapshot(collection(db, "users", shopOwnerId, "menus"), (snapshot) => {
      setMenus(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const tempManual = localStorage.getItem('temp_manual_cart');
    if (tempManual) {
      try {
        const parsed = JSON.parse(tempManual);
        if (parsed.length > 0) {
          setCart(prev => [...prev, ...parsed]);
        }
      } catch(e) { console.error("Gagal membaca keranjang manual"); }
      localStorage.removeItem('temp_manual_cart'); 
    }

    return () => { unsubCat(); unsubMenu(); };
  }, [shopOwnerId]);

  // === LOGIKA KERANJANG ===
  const addToCart = (item) => {
    if (item.stock !== undefined && item.stock <= 0) {
      Swal.fire({toast: true, position: 'center', icon: 'warning', title: 'Stok Habis!', timer: 800, showConfirmButton: false});
      return; 
    }

    setCart(prevCart => {
      const existing = prevCart.find(c => c.id === item.id);
      if (existing) {
        if (item.stock !== undefined && existing.qty >= item.stock) {
          Swal.fire({toast: true, position: 'center', icon: 'error', title: 'Melebihi sisa stok!', timer: 1000, showConfirmButton: false});
          return prevCart;
        }
        return prevCart.map(c => c.id === item.id ? { ...c, qty: c.qty + 1 } : c);
      }
      return [...prevCart, { id: item.id, name: item.name, price: parseInt(item.price), qty: 1 }];
    });
  };

  const updateQty = (id, change) => {
    setCart(prevCart => {
      return prevCart.map(c => {
        if (c.id === id) {
          const menuData = menus.find(m => m.id === id);
          const newQty = c.qty + change;
          if (change > 0 && menuData?.stock !== undefined && newQty > menuData.stock) {
            Swal.fire({toast: true, position: 'center', icon: 'error', title: 'Melebihi sisa stok!', timer: 1000, showConfirmButton: false});
            return c;
          }
          return { ...c, qty: newQty };
        }
        return c;
      }).filter(c => c.qty > 0);
    });
  };

  const clearCart = () => {
    if (cart.length > 0) {
      Swal.fire({
        title: 'Reset Pesanan?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Ya, Reset'
      }).then((result) => {
        if (result.isConfirmed) {
          setCart([]);
          setBuyerName('');
        }
      });
    }
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

  // === LOGIKA PEMBAYARAN (CHECKOUT) ===
  const handleCheckoutClick = () => {
    if (cart.length === 0) return Swal.fire('Kosong', 'Pilih menu terlebih dahulu', 'warning');
    
    const tempTx = {
      items: cart,
      total: cartTotal,
      buyer: buyerName || 'Pelanggan Umum',
      timestamp: Date.now(),
      date: new Date().toLocaleString('id-ID'), 
      operatorName: currentUser?.email?.split('@')[0] || 'Kasir', 
      paid: 0,
      change: 0,
      remaining: 0,
      method: null 
    };

    setCurrentTransaction(tempTx);
    setModalMode('payment'); 
    setIsModalOpen(true);
  };

  const processPayment = async (method) => {
    let paidAmount = 0;
    let changeAmount = 0;
    let remainingAmount = 0;
    let finalMethod = method;

    if (method === 'TUNAI') {
      const result = await Swal.fire({
        title: `Total: Rp ${cartTotal.toLocaleString('id-ID')}`,
        input: 'number',
        inputLabel: 'Masukkan Jumlah Uang Diterima (atau klik Uang Pas)',
        showCancelButton: true,
        confirmButtonText: 'Proses',
        showDenyButton: true,
        denyButtonText: 'Uang Pas',
      });

      if (result.isDismissed) return; 

      if (result.isDenied) {
        paidAmount = cartTotal; 
      } else if (result.isConfirmed) {
        if (!result.value) return Swal.fire('Error', 'Harus diisi!', 'error');
        paidAmount = parseInt(result.value);
      }

      if (paidAmount > cartTotal) {
        changeAmount = paidAmount - cartTotal;
      } else if (paidAmount < cartTotal) {
        finalMethod = 'HUTANG';
        remainingAmount = cartTotal - paidAmount;
        await Swal.fire('Info', `Uang kurang! Otomatis dicatat sebagai Hutang dengan sisa Rp ${remainingAmount.toLocaleString('id-ID')}`, 'info');
      }
    } else if (method === 'QRIS') {
      paidAmount = cartTotal;
    } else if (method === 'HUTANG') {
      remainingAmount = cartTotal;
    }

    Swal.fire({ title: 'Memproses...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    
    try {
      const batch = writeBatch(db); 
      const txRef = doc(collection(db, "users", shopOwnerId, "transactions"));
      
      const finalTx = { 
        ...currentTransaction, 
        method: finalMethod,
        paid: paidAmount,
        change: changeAmount,
        remaining: remainingAmount,
        id: txRef.id 
      };

      batch.set(txRef, finalTx);
      
      cart.forEach(item => {
        if (!item.id.toString().startsWith('manual_')) {
          const menuData = menus.find(m => m.id === item.id);
          if (menuData && menuData.stock !== undefined) {
            const menuRef = doc(db, "users", shopOwnerId, "menus", item.id);
            const newStock = Math.max(0, menuData.stock - item.qty); 
            batch.update(menuRef, { stock: newStock });
          }
        }
      });
      
      batch.commit(); 
      
      let successMsg = finalMethod === 'TUNAI' ? `Kembalian: Rp ${changeAmount.toLocaleString('id-ID')}` : 'Berhasil Disimpan';
      Swal.fire({ icon: 'success', title: 'Transaksi Sukses', text: successMsg, timer: 1800, showConfirmButton: false });
      
      setCurrentTransaction(finalTx);
      setModalMode('view');
      setCart([]);
      setBuyerName('');

    } catch (error) {
      Swal.fire('Error', 'Gagal memproses pembayaran: ' + error.message, 'error');
    }
  };

  // === FILTER MENU ===
  const filteredMenus = menus.filter(m => {
    const matchSearch = m.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchCat = activeCategory === 'all' || (m.category || '').toLowerCase() === activeCategory;
    return matchSearch && matchCat;
  });

  // === RENDER TAMPILAN ===
  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-100 relative transition-colors duration-300">
      
      {/* HEADER KASIR */}
      <div className="bg-white dark:bg-gray-800 shadow-sm z-10 flex-none w-full border-b border-gray-200 dark:border-gray-700 transition-colors duration-300">
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700">
          <button onClick={() => onNavigate('lobby')} className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white active:scale-90 transition p-2">
            <i className="fas fa-arrow-left text-lg"></i>
          </button>
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-gray-700 dark:text-gray-200 text-sm md:text-base">Mulai Jualan</h2>
          </div>
          <button onClick={() => onNavigate('calculator')} className="text-teal-600 dark:text-teal-400 text-xs font-bold border border-teal-200 dark:border-teal-700 bg-teal-50 dark:bg-teal-900/30 px-2 py-1.5 rounded active:scale-95 transition flex items-center gap-1">
            <i className="fas fa-calculator"></i> <span className="hidden md:inline">Manual</span>
          </button>
        </div>
        
        {/* TAB KATEGORI */}
        <div className="flex gap-2 p-2 overflow-x-auto whitespace-nowrap bg-gray-100 dark:bg-gray-900 hide-scrollbar border-b border-gray-200 dark:border-gray-700 transition-colors duration-300">
          <button 
            onClick={() => setActiveCategory('all')} 
            className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition shadow-sm ${activeCategory === 'all' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600'}`}
          >
            Semua
          </button>
          {categories.map(cat => (
            <button 
              key={cat.uid}
              onClick={() => setActiveCategory(cat.name.toLowerCase())} 
              className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition shadow-sm ${activeCategory === cat.name.toLowerCase() ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600'}`}
            >
              {cat.name}
            </button>
          ))}
        </div>
        <div className="p-2 bg-white dark:bg-gray-800 transition-colors duration-300">
          <input 
            type="text" 
            placeholder="Cari nama menu..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full p-2.5 rounded-lg text-sm outline-none bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-gray-400 focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition"
          />
        </div>
      </div>

      {/* GRID MENU */}
      <div className="flex-1 overflow-y-auto p-3 pb-10 bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
        {filteredMenus.length === 0 ? (
          <div className="text-center mt-10 text-gray-400 dark:text-gray-500 flex flex-col items-center">
            <i className="fas fa-search text-3xl mb-2 opacity-30"></i>
            <p className="text-sm">Menu tidak ditemukan</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-3">
            {filteredMenus.map(item => (
              <div 
                key={item.id} 
                onClick={() => addToCart(item)}
                // Menimpa warna background bawaan menu saat dark mode aktif menjadi bg-gray-800
                className={`p-2 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col items-center justify-between cursor-pointer min-h-[140px] text-center transition hover:shadow-md active:scale-95 ${item.color || 'bg-white'} dark:!bg-gray-800`}
              >
                {item.image ? (
                  <img src={item.image.replace('/upload/', '/upload/w_150,h_150,c_fill,q_auto,f_auto/')} alt={item.name} className="w-14 h-14 object-cover rounded-full shadow-sm mb-2 flex-none border-2 border-white dark:border-gray-700" />
                ) : (
                  <div className="w-14 h-14 flex items-center justify-center mb-2 flex-none bg-gray-50 dark:bg-gray-700 rounded-full border-2 border-white dark:border-gray-600 shadow-sm transition-colors">
                    <i className={`fas ${item.icon || 'fa-utensils'} text-2xl text-gray-400 dark:text-gray-500`}></i>
                  </div>
                )}
                <div className="flex-1 flex flex-col justify-center w-full my-0.5 px-1">
                  <h4 className="font-bold text-[11px] leading-tight text-gray-800 dark:text-gray-100 break-words line-clamp-2">{item.name}</h4>
                </div>
                <div className="w-full flex-none mt-auto pt-1.5 border-t border-gray-200/60 dark:border-gray-600/60 border-dashed">
                  <p className="text-xs text-blue-700 dark:text-blue-400 font-extrabold">Rp {(item.price || 0).toLocaleString('id-ID')}</p>
                  {item.stock !== undefined && (
                    <span className={`text-[9px] block mt-0.5 font-semibold ${item.stock <= 5 ? 'text-red-500 dark:text-red-400' : 'text-gray-400 dark:text-gray-500'}`}>Sisa: {item.stock}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* AREA KERANJANG (CART) BAWAH */}
      <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.1)] z-20 flex-none h-[40%] flex flex-col w-full transition-colors duration-300">
        <div className="p-3 border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 flex items-center gap-2 flex-none rounded-t-3xl transition-colors duration-300">
          <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-500 dark:text-blue-400 flex items-center justify-center flex-none">
            <i className="fas fa-user"></i>
          </div>
          <input 
            type="text" 
            placeholder="Nama Pelanggan (Opsional)..." 
            value={buyerName}
            onChange={e => setBuyerName(e.target.value)}
            className="flex-1 bg-transparent outline-none text-sm font-bold text-gray-700 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 h-8" 
          />
          <button onClick={clearCart} className="text-xs text-red-500 dark:text-red-400 font-bold px-3 py-1.5 bg-red-50 dark:bg-red-900/20 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 border border-red-100 dark:border-red-800/30 active:scale-95 transition flex items-center gap-1">
            <i className="fas fa-trash-alt"></i> <span className="hidden sm:inline">Reset</span>
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-3 bg-gray-50/50 dark:bg-gray-900/50 transition-colors duration-300">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500 opacity-60">
              <i className="fas fa-shopping-basket text-4xl mb-2"></i>
              <p className="text-xs font-medium">Keranjang masih kosong</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.id} className="flex justify-between items-center mb-2 bg-white dark:bg-gray-700 p-3 rounded-xl shadow-sm border border-gray-100 dark:border-gray-600 transition-colors">
                <div className="flex-1 pr-2">
                  <div className="font-bold text-xs text-gray-800 dark:text-gray-100 truncate">{item.name}</div>
                  <div className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">{item.qty} x {item.price.toLocaleString('id-ID')}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-sm text-gray-800 dark:text-gray-100 w-20 text-right">Rp {(item.price * item.qty).toLocaleString('id-ID')}</span>
                  <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 p-0.5 transition-colors">
                    <button onClick={() => updateQty(item.id, -1)} className="w-8 h-8 text-gray-600 dark:text-gray-300 hover:text-red-500 dark:hover:text-red-400 hover:bg-white dark:hover:bg-gray-600 rounded-md text-sm font-bold transition shadow-sm">-</button>
                    <span className="w-6 text-center text-xs font-bold text-gray-700 dark:text-gray-200">{item.qty}</span>
                    <button onClick={() => updateQty(item.id, 1)} className="w-8 h-8 text-gray-600 dark:text-gray-300 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-white dark:hover:bg-gray-600 rounded-md text-sm font-bold transition shadow-sm">+</button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-4 bg-gray-900 dark:bg-black text-white flex justify-between items-center flex-none pb-safe transition-colors duration-300"> 
          <div>
            <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider mb-0.5">Total Tagihan</p>
            <p className="text-2xl font-extrabold text-yellow-400 tracking-tight">Rp {cartTotal.toLocaleString('id-ID')}</p>
          </div>
          <button 
            onClick={handleCheckoutClick}
            className="bg-green-500 hover:bg-green-600 text-white px-8 py-3.5 rounded-xl font-bold shadow-[0_4px_15px_rgba(34,197,94,0.4)] transition transform active:scale-95 flex items-center gap-2 text-base"
          >
            Bayar <i className="fas fa-chevron-right text-xs"></i>
          </button>
        </div>
      </div>

      <ReceiptModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        transaction={currentTransaction}
        businessData={businessData}
        mode={modalMode}
        onProcessPayment={processPayment}
      />
      
    </div>
  );
}
