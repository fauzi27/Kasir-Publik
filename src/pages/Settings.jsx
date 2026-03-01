import { useState, useEffect } from 'react';
import { db, secondaryAuth } from '../firebase';
import { doc, updateDoc, setDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import Swal from 'sweetalert2';

// Daftar fitur yang bisa diatur hak aksesnya
const ACCESS_LIST = [
  { id: 'cashier', name: 'Mesin Kasir', icon: 'fa-cash-register', color: 'text-blue-500' },
  { id: 'calculator', name: 'Kalkulator', icon: 'fa-calculator', color: 'text-teal-500' },
  { id: 'report', name: 'Laporan', icon: 'fa-file-invoice', color: 'text-purple-500' },
  { id: 'stock', name: 'Stok Barang', icon: 'fa-boxes', color: 'text-indigo-500' },
  { id: 'table', name: 'Tabel Rekap', icon: 'fa-table', color: 'text-emerald-500' },
  { id: 'admin', name: 'Kelola Menu', icon: 'fa-utensils', color: 'text-orange-500' },
  { id: 'settings', name: 'Pengaturan', icon: 'fa-cog', color: 'text-gray-500' },
  { id: 'studio', name: 'Studio Tema', icon: 'fa-palette', color: 'text-pink-500' }
];

// Akses bawaan (Default) saat bikin karyawan baru
const DEFAULT_ACCESS = {
  cashier: true, calculator: true, report: false, stock: false, 
  table: false, admin: false, settings: false, studio: false
};

export default function Settings({ businessData, currentUser, onNavigate }) {
  // === STATE EDIT PROFIL ===
  const [editName, setEditName] = useState(businessData?.shopName || businessData?.name || '');
  const [editAddress, setEditAddress] = useState(businessData?.shopAddress || businessData?.address || '');

  // === STATE TAMBAH & KELOLA KARYAWAN ===
  const [empName, setEmpName] = useState('');
  const [empId, setEmpId] = useState('');
  const [empPass, setEmpPass] = useState('');
  const [empAccess, setEmpAccess] = useState(DEFAULT_ACCESS);
  const [employees, setEmployees] = useState([]);

  const isOwner = businessData?.role !== 'kasir';

  // === AMBIL DAFTAR KARYAWAN MILIK OWNER ===
  useEffect(() => {
    if (!isOwner || !currentUser?.uid) return;

    const q = query(collection(db, "users"), where("ownerId", "==", currentUser.uid));
    const unsub = onSnapshot(q, (snapshot) => {
      setEmployees(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => unsub();
  }, [currentUser?.uid, isOwner]);

  // === FUNGSI UPDATE PROFIL ===
  const handleUpdateProfile = async () => {
    if (!editName || !editAddress) return Swal.fire('Error', 'Nama dan Alamat tidak boleh kosong', 'error');
    
    Swal.fire({ title: 'Menyimpan...', didOpen: () => Swal.showLoading() });
    try {
      const userRef = doc(db, "users", currentUser.uid);
      await updateDoc(userRef, {
        name: editName,
        address: editAddress,
        shopName: editName,
        shopAddress: editAddress
      });
      Swal.fire('Sukses', 'Profil Usaha Berhasil Diperbarui', 'success');
    } catch (error) {
      Swal.fire('Error', 'Gagal memperbarui profil: ' + error.message, 'error');
    }
  };

  // === FUNGSI TOGGLE AKSES (UNTUK FORM TAMBAH) ===
  const toggleNewEmpAccess = (accessId) => {
    setEmpAccess(prev => ({ ...prev, [accessId]: !prev[accessId] }));
  };

  // === FUNGSI TAMBAH KARYAWAN ===
  const handleAddEmployee = async () => {
    if (!empName || !empId || !empPass) {
      return Swal.fire('Error', 'Semua data karyawan wajib diisi', 'error');
    }
    if (empPass.length < 6) return Swal.fire('Error', 'Password minimal 6 karakter', 'error');

    let email = empId.trim().toLowerCase();
    if (!email.includes('@')) email = `${email}@sahabatusahamu.com`;

    Swal.fire({ title: 'Membuat Akun Karyawan...', didOpen: () => Swal.showLoading() });
    try {
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, empPass);
      const newEmpUser = userCredential.user;

      await setDoc(doc(db, "users", newEmpUser.uid), {
        name: empName,
        email: email,
        role: 'kasir', // Semua bawahan di-cap kasir, tapi dikontrol oleh accessRights
        accessRights: empAccess, 
        ownerId: currentUser.uid,
        joinedAt: Date.now()
      });

      setEmpName(''); setEmpId(''); setEmpPass(''); setEmpAccess(DEFAULT_ACCESS);
      Swal.fire('Sukses', `Karyawan ${empName} berhasil dibuat dengan hak akses kustom!`, 'success');
      secondaryAuth.signOut();
    } catch (error) {
      let msg = error.message;
      if (error.code === 'auth/email-already-in-use') msg = 'ID / Email ini sudah dipakai orang lain.';
      Swal.fire('Gagal', msg, 'error');
    }
  };

  // === FUNGSI UPDATE AKSES KARYAWAN EXISTING ===
  const handleUpdateExistingAccess = async (empId, accessId, currentValue, currentAccessRights) => {
    try {
      // Jika sebelumnya tidak punya accessRights, kita buatkan objek barunya
      const updatedRights = currentAccessRights ? { ...currentAccessRights } : { ...DEFAULT_ACCESS };
      updatedRights[accessId] = !currentValue;

      await updateDoc(doc(db, "users", empId), {
        accessRights: updatedRights
      });
    } catch (error) {
      Swal.fire('Error', 'Gagal mengubah hak akses', 'error');
    }
  };

  // === RENDER TAMPILAN ===
  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-100 transition-colors duration-300">
      
      {/* HEADER */}
      <div className="bg-white dark:bg-gray-800 p-4 shadow-sm z-10 flex items-center justify-between flex-none border-b border-gray-200 dark:border-gray-700 transition-colors">
        <div className="flex items-center gap-3">
          <button onClick={() => onNavigate('lobby')} className="text-gray-600 dark:text-gray-300 active:scale-90 transition p-2 hover:text-gray-900 dark:hover:text-white">
            <i className="fas fa-arrow-left text-xl"></i>
          </button>
          <h2 className="font-bold text-lg">Pengaturan</h2>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-20 hide-scrollbar">
        
        {/* KARTU EDIT PROFIL */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 mb-4 transition-colors">
          <h3 className="font-bold text-gray-700 dark:text-gray-200 mb-3 text-sm flex items-center gap-2">
            <i className="fas fa-store text-blue-500"></i> Edit Profil Usaha
          </h3>
          <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Nama Usaha (ex: ISZI)" className="w-full p-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg focus:border-blue-500 outline-none mb-3 bg-gray-50 dark:bg-gray-900 dark:text-white transition-colors" />
          <input type="text" value={editAddress} onChange={(e) => setEditAddress(e.target.value)} placeholder="Alamat Usaha (ex: Nusadua Bali)" className="w-full p-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg focus:border-blue-500 outline-none bg-gray-50 dark:bg-gray-900 dark:text-white mb-4 transition-colors" />
          <button onClick={handleUpdateProfile} className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-bold text-sm hover:bg-blue-700 active:scale-95 transition shadow-sm">
            <i className="fas fa-save mr-1"></i> Simpan Perubahan
          </button>
        </div>
        
        {/* KARTU TAMBAH KARYAWAN (HANYA UNTUK OWNER) */}
        {isOwner && (
          <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 mb-4 transition-colors">
            <h3 className="font-bold text-gray-700 dark:text-gray-200 mb-3 text-sm flex items-center gap-2">
              <i className="fas fa-user-plus text-green-500"></i> Buat Akun Karyawan
            </h3>
            <input type="text" value={empName} onChange={(e) => setEmpName(e.target.value)} placeholder="Nama Karyawan (ex: Budi)" className="w-full p-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg focus:border-green-500 outline-none mb-3 bg-gray-50 dark:bg-gray-900 dark:text-white transition-colors" />
            <input type="text" value={empId} onChange={(e) => setEmpId(e.target.value)} placeholder="User ID (Login)" className="w-full p-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg focus:border-green-500 outline-none mb-3 bg-gray-50 dark:bg-gray-900 dark:text-white transition-colors" />
            <input type="password" value={empPass} onChange={(e) => setEmpPass(e.target.value)} placeholder="Password (Min 6 Karakter)" className="w-full p-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg focus:border-green-500 outline-none mb-4 bg-gray-50 dark:bg-gray-900 dark:text-white transition-colors" />
            
            {/* PANEL SAKLAR HAK AKSES */}
            <div className="mb-5 bg-gray-50 dark:bg-gray-900 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
              <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wider">Atur Hak Akses</p>
              <div className="grid grid-cols-2 gap-2">
                {ACCESS_LIST.map(item => (
                  <label key={item.id} className="flex items-center gap-2 p-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 cursor-pointer shadow-sm active:scale-95 transition">
                    <input 
                      type="checkbox" 
                      checked={empAccess[item.id] || false}
                      onChange={() => toggleNewEmpAccess(item.id)}
                      className="w-4 h-4 text-green-600 rounded focus:ring-green-500 accent-green-500"
                    />
                    <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-1.5 truncate">
                      <i className={`fas ${item.icon} ${item.color} w-3 text-center`}></i> {item.name}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <button onClick={handleAddEmployee} className="w-full bg-green-600 text-white py-2.5 rounded-lg font-bold text-sm hover:bg-green-700 active:scale-95 transition shadow-sm">
              <i className="fas fa-check-circle mr-1"></i> Simpan Karyawan
            </button>
          </div>
        )}

        {/* DAFTAR KARYAWAN & EDIT AKSES (HANYA UNTUK OWNER) */}
        {isOwner && employees.length > 0 && (
          <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 mb-4 transition-colors">
            <h3 className="font-bold text-gray-700 dark:text-gray-200 mb-4 text-sm flex items-center gap-2">
              <i className="fas fa-users-cog text-indigo-500"></i> Kelola Akses Karyawan
            </h3>
            
            <div className="space-y-4">
              {employees.map(emp => {
                const rights = emp.accessRights || DEFAULT_ACCESS;
                return (
                  <div key={emp.id} className="p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl">
                    <div className="flex justify-between items-center mb-3">
                      <div>
                        <p className="font-bold text-sm text-gray-800 dark:text-gray-100">{emp.name}</p>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400">{emp.email}</p>
                      </div>
                      <span className="bg-indigo-100 text-indigo-700 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase">Karyawan</span>
                    </div>
                    
                    {/* Toggles Khusus Karyawan Ini */}
                    <div className="flex flex-wrap gap-2">
                      {ACCESS_LIST.map(item => {
                        const hasAccess = rights[item.id] || false;
                        return (
                          <button 
                            key={item.id}
                            onClick={() => handleUpdateExistingAccess(emp.id, item.id, hasAccess, emp.accessRights)}
                            className={`px-2 py-1.5 rounded-md text-[10px] font-bold border transition-colors flex items-center gap-1.5 ${
                              hasAccess 
                                ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800' 
                                : 'bg-white text-gray-400 border-gray-200 dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'
                            }`}
                          >
                            <i className={`fas ${hasAccess ? 'fa-check-circle' : 'fa-times'} ${hasAccess ? 'text-green-500' : ''}`}></i> 
                            {item.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* KARTU STUDIO TEMA */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 mb-4 transition-colors">
          <h3 className="font-bold text-gray-700 dark:text-gray-200 mb-2 text-sm flex items-center gap-2">
            <i className="fas fa-paint-roller text-purple-500"></i> Desain Aplikasi (Theme)
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Sesuaikan warna tombol dan latar belakang khusus untuk kasir warung Anda.</p>
          <button 
            onClick={() => onNavigate('studio')} 
            className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-2.5 rounded-lg font-bold text-sm shadow-md hover:opacity-90 active:scale-95 transition flex items-center justify-center gap-2"
          >
            <i className="fas fa-palette"></i> Buka Studio Tampilan
          </button>
        </div>

      </div>
    </div>
  );
}
