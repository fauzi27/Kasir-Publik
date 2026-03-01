import { useState } from 'react';
import { auth, db } from '../firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import Swal from 'sweetalert2';

export default function Auth() {
  // === STATE UNTUK PINDAH HALAMAN & MATA PASSWORD ===
  const [isLogin, setIsLogin] = useState(true);
  const [showPass, setShowPass] = useState(false);

  // === STATE UNTUK FORM INPUT ===
  const [inputId, setInputId] = useState('');
  const [password, setPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [address, setAddress] = useState('');

  // === FUNGSI LOGIN ===
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!inputId || !password) return Swal.fire('Error', 'Isi ID/Email dan password', 'error');

    // 🔥 Trik Virtual Email khas ISZI
    let email = inputId.trim().toLowerCase();
    if (!email.includes('@')) {
      email = `${email}@sahabatusahamu.com`;
    }

    Swal.fire({ title: 'Masuk...', didOpen: () => Swal.showLoading() });
    try {
      await signInWithEmailAndPassword(auth, email, password);
      Swal.close();
      // Perhatikan: Kita tidak pindah halaman di sini. 
      // Saat berhasil, 'App.jsx' otomatis mendeteksi perubahan user dan memindahkan ke Lobby!
    } catch (error) {
      handleAuthError(error);
    }
  };

  // === FUNGSI REGISTER ===
  const handleRegister = async (e) => {
    e.preventDefault();
    if (!inputId || !password || !businessName) return Swal.fire('Error', 'Data usaha dan login wajib diisi', 'error');

    let email = inputId.trim().toLowerCase();
    if (!email.includes('@')) {
      email = `${email}@sahabatusahamu.com`;
    }

    Swal.fire({ title: 'Mendaftar...', didOpen: () => Swal.showLoading() });
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // 🔥 PERBAIKAN: Simpan profil usaha sebagai BOS MUTLAK (Tanpa ownerId)
      await setDoc(doc(db, "users", user.uid), {
        name: businessName, // Nama operator utama
        shopName: businessName, // Nama toko resmi
        address: address, // Alamat operator
        shopAddress: address, // Alamat toko resmi
        email: email,
        role: 'owner', // Stempel mutlak sebagai Bos
        joinedAt: Date.now()
      });
      Swal.fire('Berhasil', 'Akun dibuat! Selamat datang.', 'success');
    } catch (error) {
      handleAuthError(error);
    }
  };

  // === PENANGANAN ERROR ===
  const handleAuthError = (error) => {
    let msg = error.message;
    if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') msg = 'Password salah / Akun tidak ditemukan.';
    if (error.code === 'auth/user-not-found') msg = 'Email/ID tidak terdaftar.';
    if (error.code === 'auth/email-already-in-use') msg = 'Email/ID sudah digunakan.';
    if (error.code === 'auth/weak-password') msg = 'Password terlalu lemah (min 6 karakter).';
    Swal.fire('Gagal', msg, 'error');
  };

  // === TAMPILAN UI ===
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center w-full max-w-sm mx-auto">
      <img src="/asset/logokasir.png" alt="ISZI Logo" className="w-24 h-24 mb-6 drop-shadow-lg" />
      
      <div className="bg-gray-800 p-6 rounded-2xl shadow-xl w-full border border-gray-700">
        <h2 className="text-xl font-bold text-white mb-6">
          {isLogin ? 'Masuk ke ISZI' : 'Daftar Toko Baru'}
        </h2>

        <form onSubmit={isLogin ? handleLogin : handleRegister} className="flex flex-col gap-4 text-left">
          
          {/* Form Ekstra untuk Register */}
          {!isLogin && (
            <>
              <div>
                <label className="text-xs text-gray-400 font-bold ml-1">Nama Usaha / Toko</label>
                <input 
                  type="text" 
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl bg-gray-900 text-white border border-gray-600 focus:border-blue-500 outline-none" 
                  placeholder="Cth: Warung Miekopies" 
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 font-bold ml-1">Alamat Singkat</label>
                <input 
                  type="text" 
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full mt-1 p-3 rounded-xl bg-gray-900 text-white border border-gray-600 focus:border-blue-500 outline-none" 
                  placeholder="Cth: Nusadua, Bali" 
                />
              </div>
            </>
          )}

          {/* Form ID/Email (Dipakai Login & Register) */}
          <div>
            <label className="text-xs text-gray-400 font-bold ml-1">ID Kasir / Email</label>
            <input 
              type="text" 
              value={inputId}
              onChange={(e) => setInputId(e.target.value)}
              className="w-full mt-1 p-3 rounded-xl bg-gray-900 text-white border border-gray-600 focus:border-blue-500 outline-none" 
              placeholder={isLogin ? "Masukkan ID Kasir atau Email" : "Buat ID Kasir (Tanpa spasi)"} 
            />
          </div>

          {/* Form Password */}
          <div className="relative">
            <label className="text-xs text-gray-400 font-bold ml-1">Password</label>
            <input 
              type={showPass ? "text" : "password"} 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full mt-1 p-3 rounded-xl bg-gray-900 text-white border border-gray-600 focus:border-blue-500 outline-none pr-12" 
              placeholder="Minimal 6 karakter" 
            />
            <button 
              type="button" 
              onClick={() => setShowPass(!showPass)}
              className="absolute right-3 top-9 text-gray-400 hover:text-white"
            >
              <i className={`fas ${showPass ? 'fa-eye-slash' : 'fa-eye'}`}></i>
            </button>
          </div>

          <button 
            type="submit" 
            className="w-full mt-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl transition active:scale-95"
          >
            {isLogin ? 'Masuk' : 'Daftar Sekarang'}
          </button>
        </form>

        <p className="mt-6 text-sm text-gray-400">
          {isLogin ? "Belum punya akun?" : "Sudah punya akun?"}{' '}
          <button 
            onClick={() => setIsLogin(!isLogin)} 
            className="text-blue-400 font-bold hover:underline"
          >
            {isLogin ? 'Daftar Gratis' : 'Masuk di sini'}
          </button>
        </p>
      </div>
    </div>
  );
}
