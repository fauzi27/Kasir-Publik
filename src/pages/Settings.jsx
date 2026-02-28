import { useState } from 'react';
import { db, secondaryAuth } from '../firebase';
import { doc, updateDoc, setDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import Swal from 'sweetalert2';

export default function Settings({ businessData, currentUser, onNavigate }) {
  // === STATE EDIT PROFIL ===
  const [editName, setEditName] = useState(businessData?.shopName || businessData?.name || '');
  const [editAddress, setEditAddress] = useState(businessData?.shopAddress || businessData?.address || '');

  // === STATE TAMBAH KARYAWAN ===
  const [empName, setEmpName] = useState('');
  const [empId, setEmpId] = useState('');
  const [empPass, setEmpPass] = useState('');
  const [empRole, setEmpRole] = useState('kasir');

  // === FUNGSI UPDATE PROFIL ===
  const handleUpdateProfile = async () => {
    if (!editName || !editAddress) return Swal.fire('Error', 'Nama dan Alamat tidak boleh kosong', 'error');
    
    Swal.fire({ title: 'Menyimpan...', didOpen: () => Swal.showLoading() });
    try {
      const userRef = doc(db, "users", currentUser.uid);
      await updateDoc(userRef, {
        name: editName,
        address: editAddress
      });
      Swal.fire('Sukses', 'Profil Usaha Berhasil Diperbarui', 'success');
    } catch (error) {
      Swal.fire('Error', 'Gagal memperbarui profil: ' + error.message, 'error');
    }
  };

  // === FUNGSI TAMBAH KARYAWAN (PAKAI AKUN BAYANGAN) ===
  const handleAddEmployee = async () => {
    if (!empName || !empId || !empPass) {
      return Swal.fire('Error', 'Semua data karyawan wajib diisi', 'error');
    }
    if (empPass.length < 6) {
      return Swal.fire('Error', 'Password minimal 6 karakter', 'error');
    }

    // Trik Email Virtual ISZI
    let email = empId.trim().toLowerCase();
    if (!email.includes('@')) {
      email = `${email}@sahabatusahamu.com`;
    }

    Swal.fire({ title: 'Membuat Akun Karyawan...', didOpen: () => Swal.showLoading() });
    try {
      // Menggunakan secondaryAuth agar Bosku (Owner) tidak ter-logout
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, empPass);
      const newEmpUser = userCredential.user;

      // Simpan data karyawan ke Firestore, kaitkan dengan Owner
      await setDoc(doc(db, "users", newEmpUser.uid), {
        name: empName,
        email: email,
        role: empRole,
        ownerId: currentUser.uid, // Ini kunci agar kasir terhubung ke toko Bosku
        joinedAt: Date.now()
      });

      // Reset Form
      setEmpName(''); setEmpId(''); setEmpPass(''); setEmpRole('kasir');
      Swal.fire('Sukses', `Akun karyawan ${empName} berhasil dibuat!`, 'success');

      // Logout dari akun bayangan agar aman
      secondaryAuth.signOut();
    } catch (error) {
      let msg = error.message;
      if (error.code === 'auth/email-already-in-use') msg = 'ID / Email ini sudah dipakai orang lain.';
      Swal.fire('Gagal', msg, 'error');
    }
  };

  // === RENDER TAMPILAN ===
  return (
    <div className="flex flex-col h-screen bg-gray-100 text-gray-800">
      
      {/* HEADER */}
      <div className="bg-white p-4 shadow-sm z-10 flex items-center justify-between flex-none">
        <div className="flex items-center gap-3">
          <button onClick={() => onNavigate('lobby')} className="text-gray-600 active:scale-90 transition p-2">
            <i className="fas fa-arrow-left text-xl"></i>
          </button>
          <h2 className="font-bold text-lg">Pengaturan</h2>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-20">
        
        {/* KARTU EDIT PROFIL */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 mb-4">
          <h3 className="font-bold text-gray-700 mb-3 text-sm flex items-center gap-2">
            <i className="fas fa-store text-blue-500"></i> Edit Profil Usaha
          </h3>
          <input 
            type="text" 
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            placeholder="Nama Usaha (ex: ISZI)" 
            className="w-full p-2.5 text-sm border rounded-lg focus:border-blue-500 outline-none mb-3 bg-gray-50" 
          />
          <input 
            type="text" 
            value={editAddress}
            onChange={(e) => setEditAddress(e.target.value)}
            placeholder="Alamat Usaha (ex: Nusadua Bali)" 
            className="w-full p-2.5 text-sm border rounded-lg focus:border-blue-500 outline-none bg-gray-50 mb-4" 
          />
          <button onClick={handleUpdateProfile} className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-bold text-sm hover:bg-blue-700 active:scale-95 transition shadow-sm">
            <i className="fas fa-save mr-1"></i> Simpan Perubahan
          </button>
        </div>
        
        {/* KARTU TAMBAH KARYAWAN */}
        {businessData?.role !== 'kasir' && ( // Kasir tidak boleh tambah karyawan
          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 mb-4">
            <h3 className="font-bold text-gray-700 mb-3 text-sm flex items-center gap-2">
              <i className="fas fa-users text-green-500"></i> Tambah Karyawan
            </h3>
            <input 
              type="text" 
              value={empName}
              onChange={(e) => setEmpName(e.target.value)}
              placeholder="Nama Karyawan (ex: Budi)" 
              className="w-full p-2.5 text-sm border rounded-lg focus:border-green-500 outline-none mb-3 bg-gray-50" 
            />
            <input 
              type="text" 
              value={empId}
              onChange={(e) => setEmpId(e.target.value)}
              placeholder="User ID Karyawan (Tanpa Spasi)" 
              className="w-full p-2.5 text-sm border rounded-lg focus:border-green-500 outline-none mb-3 bg-gray-50" 
            />
            <input 
              type="password" 
              value={empPass}
              onChange={(e) => setEmpPass(e.target.value)}
              placeholder="Password Karyawan (Min 6 Karakter)" 
              className="w-full p-2.5 text-sm border rounded-lg focus:border-green-500 outline-none mb-3 bg-gray-50" 
            />
            
            <select 
              value={empRole}
              onChange={(e) => setEmpRole(e.target.value)}
              className="w-full p-2.5 text-sm border rounded-lg outline-none mb-4 bg-gray-50 font-semibold text-gray-700"
            >
              <option value="kasir">Akses: Kasir (Hanya bisa jualan)</option>
              <option value="admin">Akses: Admin (Bisa edit menu & laporan)</option>
            </select>
            
            <button onClick={handleAddEmployee} className="w-full bg-green-600 text-white py-2.5 rounded-lg font-bold text-sm hover:bg-green-700 active:scale-95 transition shadow-sm">
              <i className="fas fa-user-plus mr-1"></i> Buat Akun Karyawan
            </button>
          </div>
        )}

        {/* KARTU STUDIO TEMA (MOCKUP SEMENTARA) */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 mb-4">
          <h3 className="font-bold text-gray-700 mb-2 text-sm flex items-center gap-2">
            <i className="fas fa-paint-roller text-purple-500"></i> Desain Aplikasi (Theme)
          </h3>
          <p className="text-xs text-gray-500 mb-4">Fitur Studio Tampilan React sedang dalam tahap pengembangan akhir. Tema default ISZI Dark Mode digunakan saat ini.</p>
          <button 
            onClick={() => Swal.fire('Info', 'Studio Tampilan akan segera rilis di React!', 'info')} 
            className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-2.5 rounded-lg font-bold text-sm shadow-md hover:opacity-90 active:scale-95 transition flex items-center justify-center gap-2"
          >
            <i className="fas fa-palette"></i> Buka Studio Tampilan
          </button>
        </div>

      </div>
    </div>
  );
}
