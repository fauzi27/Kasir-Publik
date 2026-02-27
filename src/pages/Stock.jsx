import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import Swal from 'sweetalert2';

export default function Stock({ businessData, currentUser, onNavigate }) {
  // === STATE DATA ===
  const [menus, setMenus] = useState([]);
  const [categories, setCategories] = useState([]);
  
  // === STATE FILTER & SORTING ===
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [sortMode, setSortMode] = useState('default'); // default, stock_low, stock_high

  const shopOwnerId = businessData?.ownerId || currentUser?.uid;

  // === MENGAMBIL DATA (REAL-TIME) ===
  useEffect(() => {
    if (!shopOwnerId) return;

    const unsubCat = onSnapshot(collection(db, "users", shopOwnerId, "categories"), (snapshot) => {
      setCategories(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() })));
    });

    const unsubMenu = onSnapshot(collection(db, "users", shopOwnerId, "menus"), (snapshot) => {
      setMenus(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => { unsubCat(); unsubMenu(); };
  }, [shopOwnerId]);

  // === FUNGSI UPDATE STOK KE FIREBASE ===
  const handleUpdateStock = async (id, currentStock, change) => {
    const newStock = (currentStock || 0) + change;
    if (newStock < 0) return; // Stok tidak boleh minus

    try {
      const menuRef = doc(db, "users", shopOwnerId, "menus", id);
      await updateDoc(menuRef, { stock: newStock });
    } catch (error) {
      Swal.fire('Error', 'Gagal update stok: ' + error.message, 'error');
    }
  };

  const handleManualInputStock = async (id, currentStock) => {
    const { value: newStockStr } = await Swal.fire({
      title: 'Edit Stok Manual',
      input: 'number',
      inputValue: currentStock || 0,
      showCancelButton: true,
      inputValidator: (value) => {
        if (!value || value < 0) return 'Stok tidak valid!';
      }
    });

    if (newStockStr) {
      try {
        const menuRef = doc(db, "users", shopOwnerId, "menus", id);
        await updateDoc(menuRef, { stock: parseInt(newStockStr) });
      } catch (error) {
        Swal.fire('Error', 'Gagal update stok', 'error');
      }
    }
  };

  // === FILTER & SORTING ARRAY ===
  const toggleSort = () => {
    if(sortMode === 'default') setSortMode('stock_low');
    else if(sortMode === 'stock_low') setSortMode('stock_high');
    else setSortMode('default');
  };

  let filteredMenus = menus.filter(m => {
    const matchSearch = m.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchCat = activeCategory === 'all' || (m.category || '').toLowerCase() === activeCategory;
    return matchSearch && matchCat;
  });

  if (sortMode === 'stock_low') {
    filteredMenus.sort((a,b) => (a.stock || 0) - (b.stock || 0)); // Stok paling sedikit di atas
  } else if (sortMode === 'stock_high') {
    filteredMenus.sort((a,b) => (b.stock || 0) - (a.stock || 0)); // Stok paling banyak di atas
  }

  // === RENDER TAMPILAN ===
  return (
    <div className="flex flex-col h-screen bg-gray-100 text-gray-800">
      
      {/* HEADER STOK */}
      <div className="bg-indigo-700 text-white p-4 shadow-sm z-10 flex-none">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <button onClick={() => onNavigate('lobby')} className="text-white active:scale-90 transition p-1">
              <i className="fas fa-arrow-left text-xl"></i>
            </button>
            <h2 className="font-bold text-lg">Manajemen Stok</h2>
          </div>
          <button onClick={toggleSort} className="text-gray-600 text-xs font-bold border border-gray-200 bg-gray-50 px-2 py-1 rounded flex items-center gap-1">
            <i className="fas fa-sort"></i> 
            <span>{sortMode === 'default' ? 'Default' : sortMode === 'stock_low' ? 'Stok Menipis' : 'Stok Banyak'}</span>
          </button>
        </div>
        
        <input 
          type="text" 
          placeholder="Cari nama menu..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full p-2 rounded text-gray-800 text-sm outline-none mb-3 focus:ring-2 focus:ring-indigo-300" 
        />
        
        {/* TAB KATEGORI */}
        <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
          <button 
            onClick={() => setActiveCategory('all')} 
            className={`px-4 py-1.5 rounded-full text-xs font-semibold border whitespace-nowrap transition ${activeCategory === 'all' ? 'bg-white text-indigo-700' : 'bg-indigo-600 text-indigo-100 border-indigo-500'}`}
          >
            Semua
          </button>
          {categories.map(cat => (
            <button 
              key={cat.uid}
              onClick={() => setActiveCategory(cat.name.toLowerCase())} 
              className={`px-4 py-1.5 rounded-full text-xs font-semibold border whitespace-nowrap transition ${activeCategory === cat.name.toLowerCase() ? 'bg-white text-indigo-700' : 'bg-indigo-600 text-indigo-100 border-indigo-500'}`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* LIST STOK MENU */}
      <div className="flex-1 overflow-y-auto p-4 pb-20">
        <div className="space-y-2">
          {filteredMenus.map(item => (
            <div key={item.id} className="bg-white border rounded-xl p-3 flex justify-between items-center shadow-sm">
              <div className="flex items-center gap-3 flex-1">
                {item.image ? (
                  <img src={item.image.replace('/upload/', '/upload/w_100,h_100,c_fill,q_auto,f_auto/')} alt={item.name} className="w-10 h-10 object-cover rounded-lg shadow-sm border border-gray-200 flex-none" />
                ) : (
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center text-gray-500 bg-gray-100 flex-none">
                    <i className={`fas ${item.icon || 'fa-utensils'}`}></i>
                  </div>
                )}
                <div>
                  <div className="font-bold text-sm text-gray-800">{item.name}</div>
                  <div className={`text-xs font-bold ${item.stock < 5 ? 'text-red-500' : 'text-green-600'}`}>
                    Sisa Stok: {item.stock || 0}
                  </div>
                </div>
              </div>
              
              {/* TOMBOL EDIT STOK CEPAT */}
              <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg border border-gray-200 flex-none">
                <button 
                  onClick={() => handleUpdateStock(item.id, item.stock, -1)} 
                  className="w-8 h-8 flex items-center justify-center bg-white text-red-500 font-bold rounded shadow-sm active:bg-gray-200 transition"
                >
                  -
                </button>
                <div 
                  onClick={() => handleManualInputStock(item.id, item.stock)}
                  className="w-10 text-center font-bold text-sm cursor-pointer hover:bg-gray-200 rounded py-1"
                >
                  {item.stock || 0}
                </div>
                <button 
                  onClick={() => handleUpdateStock(item.id, item.stock, 1)} 
                  className="w-8 h-8 flex items-center justify-center bg-white text-blue-500 font-bold rounded shadow-sm active:bg-gray-200 transition"
                >
                  +
                </button>
              </div>
            </div>
          ))}
          {filteredMenus.length === 0 && (
             <p className="text-center text-gray-400 mt-10 text-xs">Tidak ada data stok menu.</p>
          )}
        </div>
      </div>
    </div>
  );
}
