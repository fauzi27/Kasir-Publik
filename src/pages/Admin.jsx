import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, addDoc, deleteDoc, doc, setDoc } from 'firebase/firestore';
import Swal from 'sweetalert2';

export default function Admin({ businessData, currentUser, onNavigate }) {
  // === STATE DATA FIREBASE ===
  const [menus, setMenus] = useState([]);
  const [categories, setCategories] = useState([]);
  
  // === STATE FILTER & SORTING ===
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState('default'); 

  // === STATE FORM TAMBAH MENU BARU ===
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newStock, setNewStock] = useState('100');
  const [newImageFile, setNewImageFile] = useState(null);
  const [previewImg, setPreviewImg] = useState(null);

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

  // === UPLOAD CLOUDINARY ===
  const uploadToCloudinary = async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", "menu_warung");
    try {
      const response = await fetch("https://api.cloudinary.com/v1_1/dsutaioqw/image/upload", {
        method: "POST",
        body: formData
      });
      const data = await response.json();
      return data.secure_url;
    } catch (error) {
      console.error("Cloudinary error:", error);
      throw new Error("Gagal mengunggah foto");
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setNewImageFile(file);
      setPreviewImg(URL.createObjectURL(file));
    }
  };

  // === FUNGSI TAMBAH MENU ===
  const handleAddMenu = async () => {
    if (!newName || !newPrice) return Swal.fire('Error', 'Nama dan harga wajib diisi', 'error');

    // 🔥 Perbaikan Kategori: Pastikan huruf kecil agar seragam
    let cat = activeCategory === 'all' ? 'makanan' : activeCategory.toLowerCase();
    let icon = 'fa-utensils';
    let color = 'bg-white';
    if(cat.includes('minum')) { icon = 'fa-glass-water'; color = 'bg-blue-50'; }
    if(cat.includes('camil')) { icon = 'fa-bread-slice'; color = 'bg-yellow-50'; }

    Swal.fire({title: 'Menyimpan Menu...', didOpen: () => Swal.showLoading()});
    try {
      let imageUrl = "";
      if (newImageFile) {
        imageUrl = await uploadToCloudinary(newImageFile);
      }

      await addDoc(collection(db, "users", shopOwnerId, "menus"), {
        name: newName,
        price: parseInt(newPrice),
        category: cat,
        icon: icon,
        color: color,
        stock: parseInt(newStock) || 0,
        favorite: false,
        image: imageUrl
      });

      setNewName(''); setNewPrice(''); setNewStock('100');
      setNewImageFile(null); setPreviewImg(null);
      Swal.fire({icon: 'success', title: 'Tersimpan', timer: 1000, showConfirmButton: false});
    } catch (e) {
      Swal.fire('Error', e.message, 'error');
    }
  };

  // === FUNGSI HAPUS & FAVORIT ===
  const handleDeleteMenu = async (id) => {
    if (window.confirm('Hapus menu ini permanen?')) {
      await deleteDoc(doc(db, "users", shopOwnerId, "menus", id));
      Swal.fire({icon: 'success', title: 'Terhapus', timer: 1000, showConfirmButton: false});
    }
  };

  const toggleFavorite = async (item) => {
    await setDoc(doc(db, "users", shopOwnerId, "menus", item.id), { favorite: !item.favorite }, { merge: true });
  };

  // 🔥 BARU: FUNGSI EDIT MENU (SWEETALERT POPUP)
  const handleEditMenu = async (item) => {
    // Siapkan opsi dropdown kategori
    let catOptions = `<option value="makanan">makanan</option>
                      <option value="minuman">minuman</option>
                      <option value="camilan">camilan</option>`;
                      
    categories.forEach(c => {
        const catName = c.name.toLowerCase();
        if(!['makanan', 'minuman', 'camilan'].includes(catName)) {
            catOptions += `<option value="${catName}">${c.name}</option>`;
        }
    });

    catOptions = catOptions.replace(`value="${item.category}"`, `value="${item.category}" selected`);

    const imgThumb = item.image ? item.image.replace('/upload/', '/upload/w_150,h_150,c_fill,q_auto,f_auto/') : '';
    const currentImageHtml = imgThumb ? `<img src="${imgThumb}" class="h-16 w-16 object-cover mx-auto mb-2 rounded shadow-sm border border-gray-300">` : '';

    const { value: formValues } = await Swal.fire({
        title: 'Edit Item',
        html: `
            ${currentImageHtml}
            <div class="text-left mb-1 mt-2 text-xs font-bold text-gray-700">Ganti Foto (Kosongkan jika tidak diganti)</div>
            <input type="file" id="edit-image" accept="image/*" class="w-full text-xs p-1 mb-2 border rounded bg-gray-50 cursor-pointer">
            
            <div class="text-left mb-1 mt-2 text-xs font-bold text-gray-700">Nama Menu</div>
            <input id="edit-name" class="swal2-input !m-0 !w-full" placeholder="Nama Menu" value="${item.name}">
            
            <div class="text-left mb-1 mt-3 text-xs font-bold text-gray-700">Harga (Rp)</div>
            <input id="edit-price" type="number" class="swal2-input !m-0 !w-full" placeholder="Harga" value="${item.price}">
            
            <div class="text-left mb-1 mt-3 text-xs font-bold text-gray-700">Stok Menu</div>
            <input id="edit-stock" type="number" class="swal2-input !m-0 !w-full" placeholder="Stok" value="${item.stock || 0}">
            
            <div class="text-left mb-1 mt-3 text-xs font-bold text-gray-700">Kategori</div>
            <select id="edit-category" class="swal2-input !m-0 !w-full h-[54px]">${catOptions}</select>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Simpan',
        cancelButtonText: 'Batal',
        preConfirm: () => {
            return {
                name: document.getElementById('edit-name').value,
                price: parseInt(document.getElementById('edit-price').value),
                stock: parseInt(document.getElementById('edit-stock').value),
                category: document.getElementById('edit-category').value.toLowerCase(),
                imageFile: document.getElementById('edit-image').files[0] 
            }
        }
    });

    if (formValues) {
        if (!formValues.name || isNaN(formValues.price)) {
            return Swal.fire('Error', 'Nama dan Harga harus diisi dengan angka yang valid!', 'error');
        }

        let newIcon = item.icon || 'fa-utensils';
        let newColor = item.color || 'bg-white';
        if(formValues.category.includes('minum')) { newIcon = 'fa-glass-water'; newColor = 'bg-blue-50'; }
        else if(formValues.category.includes('camil')) { newIcon = 'fa-bread-slice'; newColor = 'bg-yellow-50'; }
        else { newIcon = 'fa-utensils'; newColor = 'bg-white'; }

        Swal.fire({title: 'Menyimpan...', didOpen: () => Swal.showLoading()});
        try {
            let updateData = {
                name: formValues.name,
                price: formValues.price,
                stock: formValues.stock,
                category: formValues.category,
                icon: newIcon,
                color: newColor
            };

            if (formValues.imageFile) {
                const newImageUrl = await uploadToCloudinary(formValues.imageFile);
                updateData.image = newImageUrl;
            }

            await setDoc(doc(db, "users", shopOwnerId, "menus", item.id), updateData, { merge: true });
            Swal.fire({icon: 'success', title: 'Berhasil Diupdate', timer: 1200, showConfirmButton: false});
        } catch (e) {
            Swal.fire('Error', 'Gagal update: ' + e.message, 'error');
        }
    }
  };


  // === FUNGSI KATEGORI (TAMBAH & HAPUS) ===
  const addCategoryPrompt = async () => {
    const { value: catName } = await Swal.fire({ title: 'Tambah Kategori', input: 'text', showCancelButton: true });
    if (catName) {
      await addDoc(collection(db, "users", shopOwnerId, "categories"), { name: catName, id: catName.toLowerCase() });
      Swal.fire({icon: 'success', title: 'Kategori ditambahkan', timer: 1000, showConfirmButton: false});
    }
  };

  // 🔥 BARU: FUNGSI HAPUS KATEGORI
  const deleteCategoryModal = () => {
    if (categories.length === 0) return Swal.fire('Info', 'Tidak ada kategori untuk dihapus.', 'info');

    let listHtml = '<div class="flex flex-col gap-2 max-h-60 overflow-y-auto mt-2 text-left">';
    categories.forEach(cat => {
        // Karena SweetAlert menggunakan string HTML murni, kita panggil fungsi global sementara
        window.executeDeleteCat = async (uid, name) => {
            const res = await Swal.fire({
                title: 'Yakin hapus?', text: `Kategori "${name}"?`, icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33'
            });
            if (res.isConfirmed) {
                await deleteDoc(doc(db, "users", shopOwnerId, "categories", uid));
                if (activeCategory === name.toLowerCase()) setActiveCategory('all');
                Swal.fire({icon: 'success', title: 'Terhapus', timer: 1000, showConfirmButton: false});
            }
        };
        listHtml += `
            <div class="flex justify-between items-center bg-gray-50 p-2 rounded border border-gray-200">
                <span class="text-sm font-semibold text-gray-700">${cat.name}</span>
                <button onclick="window.executeDeleteCat('${cat.uid}', '${cat.name}')" class="bg-red-500 text-white w-8 h-8 rounded flex items-center justify-center hover:bg-red-600 active:scale-95 transition">
                    Hapus
                </button>
            </div>
        `;
    });
    listHtml += '</div>';

    Swal.fire({ title: 'Hapus Kategori', html: listHtml, showConfirmButton: false, showCloseButton: true });
  };


  // === FILTER & SORTING ARRAY ===
  const toggleSort = () => {
    if(sortMode === 'default') setSortMode('name_asc');
    else if(sortMode === 'name_asc') setSortMode('price_high');
    else if(sortMode === 'price_high') setSortMode('price_low');
    else setSortMode('default');
  };

  let filteredMenus = menus.filter(m => {
    const matchSearch = m.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchCat = activeCategory === 'all' || (m.category || '').toLowerCase() === activeCategory;
    return matchSearch && matchCat;
  });

  let favorites = filteredMenus.filter(m => m.favorite);
  let others = filteredMenus.filter(m => !m.favorite);

  if(sortMode === 'name_asc') {
    favorites.sort((a,b) => a.name.localeCompare(b.name));
    others.sort((a,b) => a.name.localeCompare(b.name));
  } else if(sortMode === 'price_high') {
    favorites.sort((a,b) => b.price - a.price);
    others.sort((a,b) => b.price - a.price);
  } else if(sortMode === 'price_low') {
    favorites.sort((a,b) => a.price - b.price);
    others.sort((a,b) => a.price - b.price);
  }
  
  const displayMenus = [...favorites, ...others];

  // === RENDER TAMPILAN ===
  return (
    <div className="flex flex-col h-screen bg-gray-100 text-gray-800">
      
      {/* HEADER */}
      <div className="bg-white p-4 shadow-sm z-10 flex-none flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => onNavigate('lobby')} className="text-gray-600 active:scale-90 transition p-2">
            <i className="fas fa-arrow-left text-xl"></i>
          </button>
          <h2 className="font-bold text-lg">Kelola Menu</h2>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggleSort} className="text-gray-600 text-xs font-bold border border-gray-200 bg-gray-50 px-2 py-1 rounded flex items-center gap-1">
            <i className="fas fa-sort"></i> 
            <span>{sortMode === 'default' ? 'Default' : sortMode === 'name_asc' ? 'A-Z' : sortMode === 'price_high' ? 'Termahal' : 'Termurah'}</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-20">
        
        {/* FORM TAMBAH MENU */}
        <div className="bg-white p-4 rounded-xl shadow mb-4">
          <h3 className="font-bold text-gray-700 mb-3 text-sm">Tambah / Edit Menu</h3>
          
          {/* TAB KATEGORI ADMIN */}
          <div className="flex gap-2 items-center w-full mb-3">
            <div className="flex gap-1 border-r border-gray-300 pr-2 flex-none">
              <button onClick={addCategoryPrompt} className="px-3 py-1.5 rounded-full text-xs font-bold bg-green-100 text-green-600 border border-green-200 hover:bg-green-200 active:scale-95" title="Tambah Kategori"><i className="fas fa-plus"></i></button>
              {/* 🔥 Tombol Hapus Kategori Diaktifkan */}
              <button onClick={deleteCategoryModal} className="px-3 py-1.5 rounded-full text-xs font-bold bg-red-100 text-red-600 border border-red-200 hover:bg-red-200 active:scale-95" title="Hapus Kategori"><i className="fas fa-times"></i></button>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 flex-1 hide-scrollbar">
              <button onClick={() => setActiveCategory('all')} className={`px-4 py-1.5 rounded-full text-xs font-semibold border whitespace-nowrap ${activeCategory === 'all' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600'}`}>Semua</button>
              {categories.map(cat => (
                <button key={cat.uid} onClick={() => setActiveCategory(cat.name.toLowerCase())} className={`px-4 py-1.5 rounded-full text-xs font-semibold border whitespace-nowrap ${activeCategory === cat.name.toLowerCase() ? 'bg-blue-600 text-white' : 'bg-white text-gray-600'}`}>
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nama Menu (ex: Mie Setan)" className="w-full p-2 text-sm border rounded focus:border-blue-500 outline-none" />
            <div className="flex gap-2">
              <input type="number" value={newPrice} onChange={e => setNewPrice(e.target.value)} placeholder="Harga" className="w-1/2 p-2 text-sm border rounded outline-none" />
              <input type="number" value={newStock} onChange={e => setNewStock(e.target.value)} placeholder="Stok Awal" className="w-1/2 p-2 text-sm border rounded outline-none" />
            </div>
            
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-3 text-center bg-gray-50 relative hover:bg-gray-100 transition">
              <input type="file" accept="image/*" onChange={handleImageChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
              <div className="flex flex-col items-center pointer-events-none">
                {previewImg ? (
                  <img src={previewImg} alt="Preview" className="h-16 w-auto rounded shadow-sm object-cover" />
                ) : (
                  <>
                    <i className="fas fa-cloud-upload-alt text-2xl text-blue-400 mb-1"></i>
                    <span className="text-xs text-gray-500 font-bold">Tap untuk Upload Foto Menu</span>
                  </>
                )}
              </div>
            </div>
            
            <button onClick={handleAddMenu} className="w-full bg-blue-600 text-white py-2 rounded font-bold text-sm hover:bg-blue-700 active:scale-95 transition">
              <i className="fas fa-save mr-1"></i> Simpan ke Cloud
            </button>
          </div>
        </div>

        {/* LIST MENU ADMIN */}
        <h3 className="font-bold text-gray-600 text-xs mb-2 px-1">Daftar Menu (Filter: {activeCategory === 'all' ? 'Semua' : activeCategory})</h3>
        <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Cari nama menu..." className="w-full p-2 rounded text-gray-800 text-sm border border-gray-200 outline-none mb-3 focus:border-blue-400" />
        
        <div className="space-y-2">
          {displayMenus.map(item => (
            <div key={item.id} className="bg-white border rounded p-3 flex justify-between items-center shadow-sm">
              <div className="flex items-center gap-3">
                {item.image ? (
                  <img src={item.image.replace('/upload/', '/upload/w_100,h_100,c_fill,q_auto,f_auto/')} alt={item.name} className="w-10 h-10 object-cover rounded-lg shadow-sm border border-gray-200 flex-none" />
                ) : (
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center text-gray-500 bg-gray-100 flex-none">
                    <i className={`fas ${item.icon || 'fa-utensils'}`}></i>
                  </div>
                )}
                <div>
                  <div className="font-bold text-sm text-gray-800">{item.name}</div>
                  <div className="text-xs text-blue-600 font-bold">Rp {(item.price || 0).toLocaleString('id-ID')}</div>
                  <div className="text-xs text-gray-500">{item.category} • Stok: {item.stock || 0}</div>
                </div>
              </div>
              
              <div className="flex gap-2">
                <button onClick={() => toggleFavorite(item)} className={`text-xl ${item.favorite ? 'text-red-500' : 'text-gray-300'} active:scale-90 transition`}>
                  {item.favorite ? '❤️' : '♡'}
                </button>
                {/* 🔥 Tombol Edit Diaktifkan */}
                <button onClick={() => handleEditMenu(item)} className="text-blue-500 px-3 py-2 bg-blue-50 rounded-lg hover:bg-blue-100 transition active:scale-95">
                  <i className="fas fa-edit"></i>
                </button>
                <button onClick={() => handleDeleteMenu(item.id)} className="text-red-500 px-3 py-2 bg-red-50 rounded-lg hover:bg-red-100 transition active:scale-95">
                  <i className="fas fa-trash"></i>
                </button>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
