import { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, getDocs, doc, updateDoc, query, where, getCountFromServer } from 'firebase/firestore'; // 🔥 TAMBAHAN query, where, getCount
import { signOut } from 'firebase/auth';
import Swal from 'sweetalert2';

export default function SuperAdmin({ currentUser, onImpersonate }) {
  const [owners, setOwners] = useState([]);
  const [totalStaff, setTotalStaff] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // === AMBIL SEMUA DATA KLIEN & HITUNG KUOTA REAL-TIME ===
  const fetchAllData = async () => {
    setIsLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, "users"));
      let ownerList = [];
      let staffMap = {}; 
      let staffCount = 0;

      // 1. Kelompokkan data Bos dan Karyawan
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.ownerId) {
          staffCount++;
          staffMap[data.ownerId] = (staffMap[data.ownerId] || 0) + 1;
        } else {
          ownerList.push({ id: doc.id, ...data });
        }
      });

      // 🔥 2. HITUNG PENGGUNAAN KUOTA BULAN INI UNTUK TIAP BOS
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      // Kita gunakan Promise.all agar pencarian data serentak dan cepat
      const enrichedOwnerList = await Promise.all(ownerList.map(async (owner) => {
        let currentUsage = 0;
        
        // Hanya hitung jika dia bukan UNLIMITED (maxTransactions > 0) untuk hemat bandwidth
        if (owner.maxTransactions > 0) {
          try {
            const q = query(
              collection(db, "users", owner.id, "transactions"),
              where("timestamp", ">=", startOfMonth.getTime())
            );
            const snap = await getCountFromServer(q);
            currentUsage = snap.data().count;
          } catch (err) {
            console.error("Gagal hitung kuota untuk", owner.name, err);
          }
        }

        return {
          ...owner,
          staffCount: staffMap[owner.id] || 0,
          currentUsage: currentUsage // <--- Simpan hasil hitungan ke data Bos
        };
      }));

      // Urutkan klien terbaru di atas
      enrichedOwnerList.sort((a, b) => (b.joinedAt || 0) - (a.joinedAt || 0));
      
      setOwners(enrichedOwnerList);
      setTotalStaff(staffCount);
    } catch (error) {
      console.error("Gagal menarik data:", error);
      Swal.fire('Error', 'Gagal memuat data klien. Pastikan Firebase Rules sudah diatur.', 'error');
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // === FUNGSI SUSPEND KLIEN ===
  const handleToggleSuspend = async (owner) => {
    const isCurrentlySuspended = owner.isSuspended || false;
    const actionText = isCurrentlySuspended ? 'Aktifkan Kembali' : 'Blokir (Suspend)';
    const confirmColor = isCurrentlySuspended ? '#10b981' : '#ef4444';

    Swal.fire({
      title: `${actionText} Toko Ini?`,
      text: `Toko: ${owner.shopName || owner.name}`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: confirmColor,
      cancelButtonColor: '#374151',
      confirmButtonText: `Ya, ${actionText}`
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await updateDoc(doc(db, "users", owner.id), { isSuspended: !isCurrentlySuspended });
          Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Status Diperbarui', timer: 1500, showConfirmButton: false });
          fetchAllData(); 
        } catch (error) {
          Swal.fire('Error', 'Gagal mengupdate status: ' + error.message, 'error');
        }
      }
    });
  };

  // === FUNGSI EDIT LIMIT TRANSAKSI ===
  const handleEditLimit = async (owner) => {
    const currentLimit = owner.maxTransactions || 0; 

    const { value: newLimit } = await Swal.fire({
      title: 'Atur Kuota Transaksi',
      html: `Masukkan batas maksimal nota per bulan untuk <b>${owner.shopName || owner.name}</b>.<br><span class="text-xs text-gray-400">(Isi 0 untuk UNLIMITED)</span>`,
      input: 'number',
      inputValue: currentLimit,
      showCancelButton: true,
      confirmButtonColor: '#3b82f6',
      cancelButtonColor: '#374151',
      confirmButtonText: 'Simpan Limit',
      inputValidator: (value) => {
        if (value < 0) return 'Limit tidak boleh kurang dari 0!';
      }
    });

    if (newLimit !== undefined) {
      try {
        await updateDoc(doc(db, "users", owner.id), { maxTransactions: parseInt(newLimit) });
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Limit Disimpan', timer: 1500, showConfirmButton: false });
        fetchAllData();
      } catch (error) {
        Swal.fire('Error', 'Gagal menyimpan limit: ' + error.message, 'error');
      }
    }
  };

  // === FUNGSI LOGOUT ===
  const handleLogout = () => {
    Swal.fire({
      title: 'Tutup Command Center?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Ya, Logout'
    }).then((result) => {
      if (result.isConfirmed) { signOut(auth); }
    });
  };

  const filteredOwners = owners.filter(owner => {
    const searchLower = searchTerm.toLowerCase();
    const shopName = (owner.shopName || owner.name || '').toLowerCase();
    const email = (owner.email || '').toLowerCase();
    return shopName.includes(searchLower) || email.includes(searchLower);
  });

  const activeCount = owners.filter(o => !o.isSuspended).length;
  const suspendedCount = owners.filter(o => o.isSuspended).length;

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-200 font-sans overflow-hidden">
      
      {/* HEADER NAVIGASI */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex justify-between items-center shadow-md z-10 flex-none">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
            <i className="fas fa-satellite-dish text-xl"></i>
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-white tracking-tight">ISZI <span className="text-blue-500">Command Center</span></h1>
            <p className="text-[11px] text-slate-400 font-mono">Super Admin Access: {currentUser?.email}</p>
          </div>
        </div>
        <button onClick={handleLogout} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2 border border-slate-700">
          <i className="fas fa-sign-out-alt"></i> Keluar
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        
        {/* 4 KARTU METRIK UTAMA */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/10 rounded-bl-full flex items-start justify-end p-3"><i className="fas fa-store text-blue-500 text-lg"></i></div>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Total Toko</p>
            <h2 className="text-4xl font-black text-white">{owners.length}</h2>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-purple-500/10 rounded-bl-full flex items-start justify-end p-3"><i className="fas fa-users text-purple-500 text-lg"></i></div>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Total Karyawan</p>
            <h2 className="text-4xl font-black text-white">{totalStaff}</h2>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-orange-500/10 rounded-bl-full flex items-start justify-end p-3"><i className="fas fa-chart-pie text-orange-500 text-lg"></i></div>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Status Klien</p>
            <div className="flex items-center gap-4 mt-1">
              <div><span className="text-2xl font-black text-emerald-400">{activeCount}</span> <span className="text-[10px] text-slate-500">Aktif</span></div>
              <div><span className="text-2xl font-black text-red-400">{suspendedCount}</span> <span className="text-[10px] text-slate-500">Blokir</span></div>
            </div>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Status Server</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="relative flex h-4 w-4"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500"></span></span>
                <span className="text-emerald-400 font-bold text-sm tracking-widest">ONLINE</span>
              </div>
            </div>
            <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/3/37/Firebase_Logo.svg/1200px-Firebase_Logo.svg.png" alt="Firebase" className="h-10 opacity-80" />
          </div>
        </div>

        {/* TABEL DAFTAR KLIEN & PENCARIAN */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <div className="px-6 py-5 border-b border-slate-800 flex flex-col md:flex-row md:justify-between md:items-center gap-4 bg-slate-900/50">
            <h3 className="font-bold text-white text-lg flex items-center gap-2">
              <i className="fas fa-list-ul text-blue-500"></i> Direktori Pelanggan
            </h3>
            <div className="flex items-center gap-2">
              <div className="relative">
                <i className="fas fa-search absolute left-3 top-2.5 text-slate-500 text-sm"></i>
                <input type="text" placeholder="Cari toko atau email..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="bg-slate-950 border border-slate-700 text-white text-sm rounded-lg pl-9 pr-4 py-2 focus:outline-none focus:border-blue-500 w-full md:w-64 transition-colors" />
              </div>
              <button onClick={fetchAllData} className="w-9 h-9 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition border border-slate-700" title="Refresh Data">
                <i className={`fas fa-sync-alt ${isLoading ? 'fa-spin' : ''}`}></i>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-950/50 text-slate-400 text-xs uppercase tracking-wider">
                  <th className="p-4 font-semibold border-b border-slate-800">Nama Toko & Karyawan</th>
                  <th className="p-4 font-semibold border-b border-slate-800">Email Utama</th>
                  <th className="p-4 font-semibold border-b border-slate-800">Status & Kuota</th>
                  <th className="p-4 font-semibold border-b border-slate-800 text-center">Aksi (God Mode)</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-slate-800/50">
                {isLoading ? (
                  <tr><td colSpan="4" className="p-8 text-center text-slate-500"><i className="fas fa-circle-notch fa-spin text-2xl text-blue-500 mb-2 block"></i> Memuat data klien...</td></tr>
                ) : filteredOwners.length === 0 ? (
                  <tr><td colSpan="4" className="p-8 text-center text-slate-500 font-mono">{searchTerm ? 'Pencarian tidak ditemukan.' : 'Belum ada klien yang terdaftar.'}</td></tr>
                ) : (
                  filteredOwners.map((owner) => {
                    // 🔥 LOGIKA VISUAL UNTUK KUOTA LIMIT
                    const isLimitEnabled = owner.maxTransactions > 0;
                    const isLimitReached = isLimitEnabled && owner.currentUsage >= owner.maxTransactions;
                    const limitText = isLimitEnabled ? `Terpakai: ${owner.currentUsage} / ${owner.maxTransactions}` : 'UNLIMITED';
                    
                    // Warna badge berubah jadi merah kalau kuota habis
                    const limitBadgeClass = isLimitReached 
                      ? 'bg-red-900/40 text-red-400 border-red-800/50' 
                      : 'bg-slate-950 text-slate-400 border-slate-800';

                    return (
                      <tr key={owner.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="p-4">
                          <p className="font-bold text-white text-base">{owner.shopName || owner.name}</p>
                          <div className="flex flex-wrap items-center gap-2 mt-1.5">
                            <p className="text-[10px] text-slate-400 font-mono uppercase">ID: {owner.id.slice(0, 8)}...</p>
                            <span className={`text-[10px] px-2 py-0.5 rounded-md border flex items-center gap-1 font-bold ${owner.staffCount > 0 ? 'bg-purple-900/30 text-purple-400 border-purple-800/50' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                              <i className="fas fa-user-tie"></i> {owner.staffCount} Kasir
                            </span>
                          </div>
                        </td>
                        <td className="p-4 text-slate-300">{owner.email}</td>
                        <td className="p-4">
                          <div className="flex flex-col items-start gap-1.5">
                            {owner.isSuspended ? (
                              <span className="bg-red-500/10 text-red-500 border border-red-500/20 px-2.5 py-1 rounded-full text-[10px] font-extrabold tracking-widest uppercase">🔴 Suspended</span>
                            ) : (
                              <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-full text-[10px] font-extrabold tracking-widest uppercase">🟢 Active</span>
                            )}
                            
                            {/* 🔥 BADGE KUOTA YANG SUDAH REAL-TIME */}
                            <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md border ${limitBadgeClass}`}>
                              {limitText}
                            </span>
                          </div>
                        </td>
                        <td className="p-4 flex justify-center gap-2">
                          {onImpersonate && (
                            <button onClick={() => onImpersonate(owner.id)} className="w-9 h-9 rounded-xl bg-purple-900/30 text-purple-400 border border-purple-800/50 hover:bg-purple-800/50 hover:text-white flex items-center justify-center transition shadow-sm" title="Masuk sebagai Klien (Mata Dewa)">
                              <i className="fas fa-user-secret"></i>
                            </button>
                          )}
                          <button onClick={() => handleToggleSuspend(owner)} className={`w-9 h-9 rounded-xl flex items-center justify-center transition shadow-sm border ${owner.isSuspended ? 'bg-emerald-900/30 text-emerald-400 border-emerald-800/50 hover:bg-emerald-800/50' : 'bg-red-900/30 text-red-400 border-red-800/50 hover:bg-red-800/50'}`} title={owner.isSuspended ? "Aktifkan Akun" : "Blokir Akun"}>
                            <i className={`fas ${owner.isSuspended ? 'fa-play' : 'fa-ban'}`}></i>
                          </button>
                          <button onClick={() => handleEditLimit(owner)} className="w-9 h-9 rounded-xl bg-blue-900/30 text-blue-400 border border-blue-800/50 hover:bg-blue-800/50 hover:text-white flex items-center justify-center transition shadow-sm" title="Atur Kuota Transaksi">
                            <i className="fas fa-sliders-h"></i>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
