import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, doc, writeBatch, setDoc, deleteDoc, getCountFromServer, query, where } from 'firebase/firestore'; 
import Swal from 'sweetalert2';
import ReceiptModal from '../components/ReceiptModal';

export default function Cashier({ businessData, currentUser, onNavigate }) {
  // === STATE DATA ===
  const [menus, setMenus] = useState([]);
  const [categories, setCategories] = useState([]);
  
  // === STATE BILL GANTUNG (ACTIVE ORDERS) ===
  const [activeOrders, setActiveOrders] = useState([]);
  const [isHoldListOpen, setIsHoldListOpen] = useState(false);
  const [currentHoldId, setCurrentHoldId] = useState(null); 

  // === STATE UI & KERANJANG ===
  const [cart, setCart] = useState(() => {
    try {
      const savedCart = localStorage.getItem('iszi_saved_cart');
      return savedCart ? JSON.parse(savedCart) : [];
    } catch (e) {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('iszi_saved_cart', JSON.stringify(cart));
  }, [cart]);

  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [buyerName, setBuyerName] = useState('');

  // === STATE MODAL STRUK ===
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('payment'); 
  const [currentTransaction, setCurrentTransaction] = useState(null);

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

    const unsubOrders = onSnapshot(collection(db, "users", shopOwnerId, "active_orders"), (snapshot) => {
      setActiveOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
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

    return () => { unsubCat(); unsubMenu(); unsubOrders(); };
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
          setCurrentHoldId(null); 
        }
      });
    }
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

  // === FUNGSI TAHAN BILL (HOLD CART) ===
  const handleHoldCart = async () => {
    if (cart.length === 0) return Swal.fire('Kosong', 'Pilih menu terlebih dahulu', 'warning');
    
    let nameToSave = buyerName;
    if (!nameToSave) {
      const { value: inputName } = await Swal.fire({
        title: 'Simpan Pesanan',
        input: 'text',
        inputLabel: 'Masukkan Nama/Nomor Meja',
        inputPlaceholder: 'Contoh: Meja 4 / Budi',
        showCancelButton: true,
        confirmButtonText: 'Simpan'
      });
      if (!inputName) return; 
      nameToSave = inputName;
    }

    Swal.fire({ title: 'Menyimpan...', didOpen: () => Swal.showLoading() });
    try {
      const holdRef = currentHoldId ? doc(db, "users", shopOwnerId, "active_orders", currentHoldId) : doc(collection(db, "users", shopOwnerId, "active_orders"));
      
      await setDoc(holdRef, {
        items: cart,
        total: cartTotal,
        buyer: nameToSave,
        timestamp: Date.now(),
        operatorName: businessData?.operatorName || 'Kasir',
      });

      Swal.fire({ toast: true, position: 'center', icon: 'success', title: 'Meja Disimpan!', timer: 1500, showConfirmButton: false });
      setCart([]);
      setBuyerName('');
      setCurrentHoldId(null);
    } catch (error) {
      Swal.fire('Error', 'Gagal menyimpan: ' + error.message, 'error');
    }
  };

  const resumeOrder = (order) => {
    if (cart.length > 0) {
      Swal.fire({
        title: 'Timpa Keranjang?',
        text: 'Pesanan yang sedang diketik akan diganti dengan data meja ini.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Ya, Lanjutkan'
      }).then((result) => {
        if (result.isConfirmed) {
          setCart(order.items);
          setBuyerName(order.buyer);
          setCurrentHoldId(order.id);
          setIsHoldListOpen(false);
        }
      });
    } else {
      setCart(order.items);
      setBuyerName(order.buyer);
      setCurrentHoldId(order.id);
      setIsHoldListOpen(false);
    }
  };

  const deleteHoldOrder = (id, e) => {
    e.stopPropagation();
    Swal.fire({
      title: 'Hapus Pesanan Meja?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, Batal Pesan'
    }).then(async (result) => {
      if (result.isConfirmed) {
        await deleteDoc(doc(db, "users", shopOwnerId, "active_orders", id));
      }
    });
  };

  // === 🔥 LOGIKA PEMBAYARAN (DENGAN CEK ARGO LIMIT) 🔥 ===
  const handleCheckoutClick = async () => {
    if (cart.length === 0) return Swal.fire('Kosong', 'Pilih menu terlebih dahulu', 'warning');
    
    // 1. CEK KUOTA (SISTEM ARGO METERAN)
    const limit = businessData?.maxTransactions || 0;
    
    if (limit > 0) {
      Swal.fire({ title: 'Cek Kuota...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      try {
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const q = query(
          collection(db, "users", shopOwnerId, "transactions"),
          where("timestamp", ">=", startOfMonth.getTime())
        );
        const snapshot = await getCountFromServer(q);
        const currentUsage = snapshot.data().count;

        Swal.close();

        if (currentUsage >= limit) {
          return Swal.fire({
            icon: 'error',
            title: 'Kuota Habis!',
            html: `Toko ini telah mencapai batas <b>${limit} transaksi</b> bulan ini.<br><br>Silakan hubungi Admin ISZI untuk menambah kuota layanan.`,
            confirmButtonColor: '#d33'
          });
        }
      } catch (error) {
        Swal.fire('Error', 'Gagal mengecek kuota server: ' + error.message, 'error');
        return;
      }
    }

    // 2. LANJUTKAN KE PEMBAYARAN JIKA AMAN
    const tempTx = {
      items: cart,
      total: cartTotal,
      buyer: buyerName || 'Pelanggan Umum',
      timestamp: Date.now(),
      date: new Date().toLocaleString('id-ID'), 
      operatorName: businessData?.operatorName || 'Kasir', 
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
        status: 'SUCCESS',
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
      
      if (currentHoldId) {
        const holdRef = doc(db, "users", shopOwnerId, "active_orders", currentHoldId);
        batch.delete(holdRef);
      }
      
      batch.commit().catch(err => console.log("Tersimpan offline, menunggu koneksi...", err)); 
      
      let successMsg = finalMethod === 'TUNAI' ? `Kembalian: Rp ${changeAmount.toLocaleString('id-ID')}` : 'Berhasil Disimpan';
      Swal.fire({ icon: 'success', title: 'Transaksi Sukses', text: successMsg, timer: 1800, showConfirmButton: false });
      
      setCurrentTransaction(finalTx);
      setModalMode('view');
      setCart([]);
      setBuyerName('');
      setCurrentHoldId(null); 

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

  // === RENDER TAMPILAN (UPGRADED: RESPONSIVE SPLIT-SCREEN) ===
  return (
    // 🔥 PERUBAHAN UTAMA: Wrapper diubah menjadi 'md:flex-row' untuk layar belah di Tablet/PC
    <div className="flex flex-col md:flex-row h-screen bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-100 relative transition-colors duration-300 overflow-hidden">
      
      {/* ========================================= */}
      {/* BAGIAN KIRI: PANEL MENU (Lebar di Tablet) */}
      {/* ========================================= */}
      <div className="flex flex-col flex-1 min-w-0 h-[60%] md:h-full">
        
        {/* HEADER KASIR KIRI */}
        <div className="bg-white dark:bg-gray-800 shadow-sm z-10 flex-none w-full border-b border-gray-200 dark:border-gray-700 transition-colors duration-300">
          <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700">
            <button onClick={() => onNavigate('lobby')} className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white active:scale-90 transition p-2">
              <i className="fas fa-arrow-left text-lg"></i>
            </button>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-gray-700 dark:text-gray-200 text-sm md:text-base">Mulai Jualan</h2>
            </div>
            
            <div className="flex items-center gap-2">
              <button onClick={() => setIsHoldListOpen(true)} className="relative text-orange-600 dark:text-orange-400 text-xs font-bold border border-orange-200 dark:border-orange-700 bg-orange-50 dark:bg-orange-900/30 px-2 py-1.5 rounded active:scale-95 transition flex items-center gap-1 shadow-sm">
                <i className="fas fa-clock"></i> <span className="hidden md:inline">Gantung</span>
                {activeOrders.length > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] w-4 h-4 flex items-center justify-center rounded-full font-bold shadow-md">
                    {activeOrders.length}
                  </span>
                )}
              </button>
              <button onClick={() => onNavigate('calculator')} className="text-teal-600 dark:text-teal-400 text-xs font-bold border border-teal-200 dark:border-teal-700 bg-teal-50 dark:bg-teal-900/30 px-2 py-1.5 rounded active:scale-95 transition flex items-center gap-1 shadow-sm">
                <i className="fas fa-calculator"></i> <span className="hidden md:inline">Manual</span>
              </button>
            </div>
          </div>
          
          {/* TAB KATEGORI */}
          <div className="flex gap-2 p-2 overflow-x-auto whitespace-nowrap bg-gray-100 dark:bg-gray-900 hide-scrollbar border-b border-gray-200 dark:border-gray-700 transition-colors duration-300">
            <button onClick={() => setActiveCategory('all')} className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition shadow-sm ${activeCategory === 'all' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600'}`}>Semua</button>
            {categories.map(cat => (
              <button key={cat.uid} onClick={() => setActiveCategory(cat.name.toLowerCase())} className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition shadow-sm ${activeCategory === cat.name.toLowerCase() ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600'}`}>
                {cat.name}
              </button>
            ))}
          </div>
          <div className="p-2 bg-white dark:bg-gray-800 transition-colors duration-300">
            <input type="text" placeholder="Cari nama menu..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full p-2.5 rounded-lg text-sm outline-none bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-white placeholder-gray-400 focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition" />
          </div>
        </div>

        {/* GRID MENU KIRI */}
        <div className="flex-1 overflow-y-auto p-3 pb-10 bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
          {filteredMenus.length === 0 ? (
            <div className="text-center mt-10 text-gray-400 dark:text-gray-500 flex flex-col items-center">
              <i className="fas fa-search text-3xl mb-2 opacity-30"></i>
              <p className="text-sm">Menu tidak ditemukan</p>
            </div>
          ) : (
            // 🔥 PERUBAHAN GRID: Menyesuaikan dengan sisa lebar layar yang ada di Tablet/PC
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
              {filteredMenus.map(item => (
                <div key={item.id} onClick={() => addToCart(item)} className={`p-2 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col items-center justify-between cursor-pointer min-h-[140px] text-center transition hover:shadow-md active:scale-95 ${item.color || 'bg-white'} dark:!bg-gray-800`}>
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
      </div>

      {/* ======================================================= */}
      {/* BAGIAN KANAN: PANEL KERANJANG (Menetap di Kanan Tablet) */}
      {/* ======================================================= */}
      {/* 🔥 PERUBAHAN KERANJANG: Tinggi 40% di HP, tapi Tinggi Penuh (h-full) & Lebar Tetap di Tablet/PC */}
      <div className="flex-none flex flex-col w-full md:w-[340px] lg:w-[400px] h-[40%] md:h-full bg-white dark:bg-gray-800 border-t md:border-t-0 md:border-l border-gray-200 dark:border-gray-700 rounded-t-3xl md:rounded-none shadow-[0_-10px_40px_rgba(0,0,0,0.1)] md:shadow-[-5px_0_20px_rgba(0,0,0,0.05)] z-20 transition-all duration-300">
        
        {/* HEADER KERANJANG */}
        <div className="p-3 border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 flex items-center gap-2 flex-none rounded-t-3xl md:rounded-none transition-colors duration-300">
          <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-500 dark:text-blue-400 flex items-center justify-center flex-none">
            <i className="fas fa-user"></i>
          </div>
          <input type="text" placeholder="Nama / Meja..." value={buyerName} onChange={e => setBuyerName(e.target.value)} className="flex-1 bg-transparent outline-none text-sm font-bold text-gray-700 dark:text-gray-200 placeholder-gray-400 h-8 min-w-0" />
          <button onClick={clearCart} className="text-xs text-red-500 dark:text-red-400 font-bold px-3 py-1.5 bg-red-50 dark:bg-red-900/20 rounded-lg hover:bg-red-100 border border-red-100 dark:border-red-900/30 active:scale-95 transition flex items-center gap-1 flex-none">
            <i className="fas fa-trash-alt"></i> <span className="hidden sm:inline">Reset</span>
          </button>
        </div>
        
        {/* LIST ITEM KERANJANG */}
        <div className="flex-1 overflow-y-auto p-3 bg-gray-50/50 dark:bg-gray-900/50 transition-colors duration-300">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500 opacity-60">
              <i className="fas fa-shopping-basket text-4xl mb-2"></i>
              <p className="text-xs font-medium">Keranjang masih kosong</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.id} className="flex justify-between items-center mb-2 bg-white dark:bg-gray-700 p-3 rounded-xl shadow-sm border border-gray-100 dark:border-gray-600 transition-colors">
                <div className="flex-1 pr-2 min-w-0">
                  <div className="font-bold text-xs text-gray-800 dark:text-gray-100 truncate">{item.name}</div>
                  <div className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">{item.qty} x {item.price.toLocaleString('id-ID')}</div>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <span className="font-bold text-sm text-gray-800 dark:text-gray-100 whitespace-nowrap">Rp {(item.price * item.qty).toLocaleString('id-ID')}</span>
                  <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 p-0.5 transition-colors">
                    <button onClick={() => updateQty(item.id, -1)} className="w-7 h-7 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:text-red-500 rounded-md text-sm font-bold transition shadow-sm">-</button>
                    <span className="w-5 text-center text-xs font-bold text-gray-700 dark:text-gray-200">{item.qty}</span>
                    <button onClick={() => updateQty(item.id, 1)} className="w-7 h-7 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:text-blue-500 rounded-md text-sm font-bold transition shadow-sm">+</button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* FOOTER CHECKOUT */}
        <div className="p-4 bg-gray-900 dark:bg-black text-white flex flex-col md:flex-col lg:flex-row justify-between lg:items-center gap-3 flex-none pb-safe transition-colors duration-300"> 
          {/* Tampilan Total Tagihan (Lebih Fleksibel) */}
          <div className="flex justify-between md:justify-start lg:flex-col items-end md:items-start lg:items-start w-full lg:w-auto">
            <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider mb-0.5">Total Tagihan</p>
            <p className="text-2xl font-extrabold text-yellow-400 tracking-tight">Rp {cartTotal.toLocaleString('id-ID')}</p>
          </div>
          
          <div className="flex gap-2 w-full lg:w-auto lg:flex-1">
            <button onClick={handleHoldCart} className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-3.5 rounded-xl font-bold shadow-[0_4px_15px_rgba(249,115,22,0.4)] transition transform active:scale-95 flex items-center justify-center" title="Simpan Meja">
              <i className="fas fa-save"></i>
            </button>
            <button onClick={handleCheckoutClick} className="flex-1 bg-green-500 hover:bg-green-600 text-white py-3.5 rounded-xl font-bold shadow-[0_4px_15px_rgba(34,197,94,0.4)] transition transform active:scale-95 flex items-center justify-center gap-2 text-base">
              Bayar <i className="fas fa-chevron-right text-xs"></i>
            </button>
          </div>
        </div>
      </div>

      {/* ======================= */}
      {/* MODAL & OVERLAYS BAWAH  */}
      {/* ======================= */}
      <ReceiptModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        transaction={currentTransaction}
        businessData={businessData}
        mode={modalMode}
        onProcessPayment={processPayment}
      />
      
      {/* MODAL DAFTAR BILL GANTUNG */}
      {isHoldListOpen && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm transition-opacity">
          <div className="bg-white dark:bg-gray-800 w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden animate-slide-up sm:animate-zoom-in flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900">
              <h3 className="font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2"><i className="fas fa-clock text-orange-500"></i> Daftar Meja / Antrian</h3>
              <button onClick={() => setIsHoldListOpen(false)} className="w-8 h-8 flex items-center justify-center bg-gray-200 dark:bg-gray-700 text-gray-600 rounded-full hover:bg-gray-300 transition"><i className="fas fa-times"></i></button>
            </div>
            
            <div className="p-3 overflow-y-auto flex-1 bg-gray-50/50 dark:bg-gray-900/50">
              {activeOrders.length === 0 ? (
                 <div className="text-center py-10 text-gray-400"><i className="fas fa-receipt text-4xl mb-3 opacity-50"></i><p className="text-sm">Tidak ada meja yang ditahan.</p></div>
              ) : (
                <div className="space-y-2">
                  {activeOrders.map(order => (
                    <div key={order.id} onClick={() => resumeOrder(order)} className="bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex justify-between items-center cursor-pointer hover:border-orange-400 transition group">
                      <div>
                        <p className="font-bold text-sm text-gray-800 dark:text-gray-100">{order.buyer}</p>
                        <p className="text-[10px] text-gray-500 mt-0.5"><i className="fas fa-utensils"></i> {order.items.reduce((sum, i) => sum + i.qty, 0)} Item | Oleh: {order.operatorName}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="font-extrabold text-orange-600 text-sm">Rp {order.total.toLocaleString('id-ID')}</p>
                        <button onClick={(e) => deleteHoldOrder(order.id, e)} className="w-8 h-8 rounded-full bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition shadow-sm flex items-center justify-center"><i className="fas fa-trash-alt text-xs"></i></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
