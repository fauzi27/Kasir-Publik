import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import Swal from 'sweetalert2';

export default function Cashier({ businessData, currentUser, onNavigate }) {
  // === STATE DATA ===
  const [menus, setMenus] = useState([]);
  const [categories, setCategories] = useState([]);
  
  // === STATE UI & KERANJANG ===
  const [cart, setCart] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  // Menentukan ID Pemilik Toko (Untuk Kasir & Admin)
  const shopOwnerId = businessData?.ownerId || currentUser?.uid;

  // === MENGAMBIL DATA DARI FIREBASE (REAL-TIME) ===
  useEffect(() => {
    if (!shopOwnerId) return;

    // Tarik Kategori
    const catCol = collection(db, "users", shopOwnerId, "categories");
    const unsubCat = onSnapshot(catCol, (snapshot) => {
      setCategories(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() })));
    });

    // Tarik Menu
    const menuCol = collection(db, "users", shopOwnerId, "menus");
    const unsubMenu = onSnapshot(menuCol, (snapshot) => {
      setMenus(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Bersihkan memori jika halaman ditutup
    return () => {
      unsubCat();
      unsubMenu();
    };
  }, [shopOwnerId]);

  // === LOGIKA KERANJANG ===
  const addToCart = (item) => {
    if (item.stock !== undefined && item.stock <= 0) {
      Swal.fire({toast: true, position: 'center', icon: 'warning', title: 'Stok Habis!', timer: 800, showConfirmButton: false});
    }

    setCart(prevCart => {
      const existing = prevCart.find(c => c.id === item.id);
      if (existing) {
        return prevCart.map(c => c.id === item.id ? { ...c, qty: c.qty + 1 } : c);
      }
      return [...prevCart, { id: item.id, name: item.name, price: parseInt(item.price), qty: 1 }];
    });
  };

  const updateQty = (id, change) => {
    setCart(prevCart => {
      return prevCart.map(c => {
        if (c.id === id) return { ...c, qty: c.qty + change };
        return c;
      }).filter(c => c.qty > 0); // Otomatis hapus jika qty 0
    });
  };

  const clearCart = () => {
    if (cart.length > 0) {
      if (window.confirm("Hapus semua pesanan?")) setCart([]);
    }
  };

  // === FILTER MENU ===
  const filteredMenus = menus.filter(m => {
    const matchSearch = m.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchCat = activeCategory === 'all' || (m.category || '').toLowerCase() === activeCategory;
    return matchSearch && matchCat;
  });

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

  // === RENDER TAMPILAN ===
  return (
    <div className="flex flex-col h-screen bg-gray-50 text-gray-800">
      
      {/* HEADER KASIR */}
      <div className="bg-white shadow-sm z-10 flex-none w-full">
        <div className="flex items-center justify-between px-4 py-2 border-b">
          <button onClick={() => onNavigate('lobby')} className="text-gray-600 hover:text-gray-900 active:scale-90 transition p-2">
            <i className="fas fa-arrow-left text-lg"></i>
          </button>
          <h2 className="font-bold text-gray-700">Mulai Jualan</h2>
          <div className="w-8"></div> {/* Spacer */}
        </div>
        
        {/* TAB KATEGORI */}
        <div className="flex gap-2 p-2 overflow-x-auto whitespace-nowrap bg-gray-100 hide-scrollbar">
          <button 
            onClick={() => setActiveCategory('all')} 
            className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition ${activeCategory === 'all' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300'}`}
          >
            Semua
          </button>
          {categories.map(cat => (
            <button 
              key={cat.uid}
              onClick={() => setActiveCategory(cat.name.toLowerCase())} 
              className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition ${activeCategory === cat.name.toLowerCase() ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300'}`}
            >
              {cat.name}
            </button>
          ))}
        </div>
        <input 
          type="text" 
          placeholder="Cari nama menu..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-[calc(100%-1rem)] p-2 rounded text-sm outline-none mb-2 mx-2 bg-gray-100 border border-gray-200 focus:border-blue-400"
        />
      </div>

      {/* GRID MENU */}
      <div className="flex-1 overflow-y-auto p-2 pb-10">
        {filteredMenus.length === 0 ? (
          <p className="text-center text-gray-400 mt-10 text-xs">Menu tidak ditemukan</p>
        ) : (
          <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
            {filteredMenus.map(item => (
              <div 
                key={item.id} 
                onClick={() => addToCart(item)}
                className={`p-2 rounded-lg shadow-sm border border-gray-100 flex flex-col items-center justify-between cursor-pointer min-h-[130px] text-center transition active:scale-95 ${item.color || 'bg-white'}`}
              >
                {item.image ? (
                  <img src={item.image.replace('/upload/', '/upload/w_150,h_150,c_fill,q_auto,f_auto/')} alt={item.name} className="w-11 h-11 object-cover rounded-full shadow-sm mb-1 flex-none border border-gray-200" />
                ) : (
                  <div className="w-11 h-11 flex items-center justify-center mb-1 flex-none">
                    <i className={`fas ${item.icon || 'fa-utensils'} text-2xl text-gray-700 opacity-70`}></i>
                  </div>
                )}
                <div className="flex-1 flex flex-col justify-center w-full my-0.5">
                  <h4 className="font-bold text-[10px] leading-snug text-gray-800 break-words">{item.name}</h4>
                </div>
                <div className="w-full flex-none mt-auto pt-1 border-t border-gray-50 border-dashed">
                  <p className="text-[11px] text-blue-700 font-extrabold">Rp {(item.price || 0).toLocaleString('id-ID')}</p>
                  {item.stock !== undefined && (
                    <span className={`text-[9px] block mt-0.5 ${item.stock < 5 ? 'text-red-500 font-bold' : 'text-gray-400'}`}>Stok: {item.stock}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* AREA KERANJANG (CART) BAWAH */}
      <div className="bg-white border-t rounded-t-2xl shadow-[0_-5px_20px_rgba(0,0,0,0.1)] z-20 flex-none h-[35%] flex flex-col w-full">
        <div className="p-2 border-b bg-gray-50 flex items-center gap-2 flex-none">
          <i className="fas fa-user-circle text-gray-400 text-lg"></i>
          <input type="text" placeholder="Nama Pelanggan..." className="flex-1 bg-transparent outline-none text-sm font-bold text-gray-700 h-8" />
          <button onClick={clearCart} className="text-xs text-red-500 font-bold px-3 py-1 bg-red-50 rounded border border-red-200 active:scale-95 transition">
            <i className="fas fa-trash-alt mr-1"></i> Reset
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-3">
          {cart.length === 0 ? (
            <p className="text-center text-gray-400 text-xs mt-4 italic">Belum ada pesanan</p>
          ) : (
            cart.map(item => (
              <div key={item.id} className="flex justify-between items-center mb-2 bg-white p-2 rounded shadow-sm border border-gray-100">
                <div>
                  <div className="font-bold text-xs text-gray-800">{item.name}</div>
                  <div className="text-[10px] text-gray-500">{item.qty} x {item.price.toLocaleString('id-ID')}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs text-gray-700">Rp {(item.price * item.qty).toLocaleString('id-ID')}</span>
                  <div className="flex items-center bg-gray-100 rounded">
                    <button onClick={() => updateQty(item.id, -1)} className="w-8 h-8 text-red-500 text-sm font-bold active:bg-gray-200">-</button>
                    <button onClick={() => updateQty(item.id, 1)} className="w-8 h-8 text-blue-500 text-sm font-bold active:bg-gray-200">+</button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-3 bg-gray-800 text-white flex justify-between items-center flex-none pb-safe"> 
          <div>
            <p className="text-[10px] text-gray-400">Total Tagihan</p>
            <p className="text-lg font-bold text-yellow-400">Rp {cartTotal.toLocaleString('id-ID')}</p>
          </div>
          <button className="bg-green-500 hover:bg-green-600 text-white px-5 py-2 rounded-lg font-bold shadow-lg transition transform active:scale-95 flex items-center gap-2 text-sm">
            Bayar <i className="fas fa-chevron-right text-[10px]"></i>
          </button>
        </div>
      </div>
    </div>
  );
}
