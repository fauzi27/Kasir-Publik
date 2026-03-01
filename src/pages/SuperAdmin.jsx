import { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
// [TAMBAHAN IMPORT]: writeBatch, deleteDoc, setDoc untuk 3 Fitur Baru
import { collection, getDocs, doc, updateDoc, query, where, getCountFromServer, writeBatch, deleteDoc, setDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import Swal from 'sweetalert2';

export default function SuperAdmin({ currentUser, onImpersonate }) {
  const [owners, setOwners] = useState([]);
  const [totalStaff, setTotalStaff] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // [FITUR BARU]: State untuk Metrik Beban Firestore
  const [globalTx, setGlobalTx] = useState(0);

  // === AMBIL SEMUA DATA & KELOMPOKKAN DETAIL KARYAWAN ===
  const fetchAllData = async () => {
    setIsLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, "users"));
      let ownerList = [];
      let staffMap = {}; 
      let staffCount = 0;

      // 1. Kelompokkan data Bos dan pisahkan data Karyawan
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.ownerId) {
          staffCount++;
          // Simpan seluruh data karyawan ke dalam array milik bosnya
          if (!staffMap[data.ownerId]) staffMap[data.ownerId] = [];
          staffMap[data.ownerId].push({ id: doc.id, ...data });
        } else {
          ownerList.push({ id: doc.id, ...data });
        }
      });

      // 2. Hitung penggunaan kuota bulan ini
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      let totalTxSistem = 0; // [FITUR BARU]: Variabel penghitung beban global

      const enrichedOwnerList = await Promise.all(ownerList.map(async (owner) => {
        let currentUsage = 0;
        
        try {
          const q = query(collection(db, "users", owner.id, "transactions"), where("timestamp", ">=", startOfMonth.getTime()));
          const snap = await getCountFromServer(q);
          currentUsage = snap.data().count;
          totalTxSistem += currentUsage; // [FITUR BARU]: Tambahkan ke beban global
        } catch (err) { console.error("Gagal hitung kuota", err); }

        return {
          ...owner,
          staffList: staffMap[owner.id] || [], // Array detail kasir
          staffCount: (staffMap[owner.id] || []).length,
          currentUsage: currentUsage
        };
      }));

      // Urutkan klien terbaru di atas
      enrichedOwnerList.sort((a, b) => (b.joinedAt || 0) - (a.joinedAt || 0));
      
      setOwners(enrichedOwnerList);
      setTotalStaff(staffCount);
      setGlobalTx(totalTxSistem); // [FITUR BARU]: Set State Metrik
    } catch (error) {
      Swal.fire('Error', 'Gagal memuat data klien: ' + error.message, 'error');
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // === 🔥 FUNGSI MELIHAT DETAIL KARYAWAN ===
  const handleViewStaff = (owner) => {
    if (!owner.staffList || owner.staffList.length === 0) {
      return Swal.fire({ icon: 'info', title: 'Belum Ada Kasir', text: 'Toko ini belum menambahkan karyawan.', confirmButtonColor: '#3b82f6' });
    }

    let htmlContent = '<div class="text-left space-y-3 mt-4">';
    owner.staffList.forEach((staff) => {
      htmlContent += `
        <div class="bg-slate-800 p-3 rounded-xl border border-slate-700 shadow-sm">
          <p class="font-bold text-white text-sm">${staff.name || 'Tanpa Nama'}</p>
          <p class="text-slate-400 text-xs mt-1"><i class="fas fa-envelope text-blue-400"></i> ${staff.email}</p>
          <p class="text-slate-500 text-[10px] mt-1.5 font-mono bg-slate-900 px-2 py-1 rounded inline-block">ID: ${staff.id}</p>
        </div>
      `;
    });
    htmlContent += '</div>';

    Swal.fire({
      title: `<span class="text-lg">Karyawan: ${owner.shopName || owner.name}</span>`,
      html: htmlContent,
      background: '#0f172a',
      color: '#f8fafc',
      showCloseButton: true,
      confirmButtonText: 'Tutup',
      confirmButtonColor: '#3b82f6'
    });
  };

  // === FUNGSI SUSPEND KLIEN ===
  const handleToggleSuspend = async (owner) => {
    const isSuspended = owner.isSuspended || false;
    const actionText = isSuspended ? 'Aktifkan Kembali' : 'Blokir (Suspend)';
    
    Swal.fire({
      title: `${actionText}?`,
      text: `Toko: ${owner.shopName || owner.name}`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: isSuspended ? '#10b981' : '#ef4444',
      cancelButtonColor: '#374151',
      confirmButtonText: `Ya, ${actionText}`
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await updateDoc(doc(db, "users", owner.id), { isSuspended: !isSuspended });
          Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Status Diperbarui', timer: 1500, showConfirmButton: false });
          fetchAllData(); 
        } catch (error) { Swal.fire('Error', error.message, 'error'); }
      }
    });
  };

  // === 🔥 FUNGSI MULTI-LIMIT (Transaksi, Menu, Foto) ===
  const handleEditLimit = async (owner) => {
    const { value: formValues } = await Swal.fire({
      title: 'Atur Multi-Limit SaaS',
      html: `
        <div class="text-left mb-4 mt-2">
          <label class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Maks. Transaksi / Bulan</label>
          <input id="swal-limit-tx" type="number" class="w-full p-2.5 bg-slate-800 border border-slate-600 text-white rounded-lg mt-1 text-sm outline-none focus:border-blue-500" value="${owner.maxTransactions || 0}">
        </div>
        <div class="text-left mb-4">
          <label class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Maks. Menu Tersimpan</label>
          <input id="swal-limit-menu" type="number" class="w-full p-2.5 bg-slate-800 border border-slate-600 text-white rounded-lg mt-1 text-sm outline-none focus:border-blue-500" value="${owner.maxMenus || 0}">
        </div>
        <div class="text-left mb-2">
          <label class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Maks. Upload Foto</label>
          <input id="swal-limit-photo" type="number" class="w-full p-2.5 bg-slate-800 border border-slate-600 text-white rounded-lg mt-1 text-sm outline-none focus:border-blue-500" value="${owner.maxImages || 0}">
        </div>
        <p class="text-[10px] text-slate-500 text-left mt-2"><i class="fas fa-info-circle"></i> Isi angka <b>0</b> untuk memberikan akses Unlimited.</p>
      `,
      background: '#0f172a',
      color: '#fff',
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonColor: '#3b82f6',
      cancelButtonColor: '#374151',
      confirmButtonText: 'Simpan Aturan',
      preConfirm: () => {
        return {
          maxTransactions: parseInt(document.getElementById('swal-limit-tx').value) || 0,
          maxMenus: parseInt(document.getElementById('swal-limit-menu').value) || 0,
          maxImages: parseInt(document.getElementById('swal-limit-photo').value) || 0
        }
      }
    });

    if (formValues) {
      Swal.fire({ title: 'Menyimpan...', didOpen: () => Swal.showLoading() });
      try {
        await updateDoc(doc(db, "users", owner.id), {
          maxTransactions: formValues.maxTransactions,
          maxMenus: formValues.maxMenus,
          maxImages: formValues.maxImages
        });
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Limit Disimpan', timer: 1500, showConfirmButton: false });
        fetchAllData();
      } catch (error) { Swal.fire('Error', error.message, 'error'); }
    }
  };

  // === [FITUR BARU]: BROADCAST PENGUMUMAN ===
  const handleBroadcast = async () => {
    const { value: text } = await Swal.fire({
      title: 'Kirim Pengumuman Global',
      input: 'textarea',
      inputPlaceholder: 'Ketik pesan untuk semua pengguna ISZI (Maintenance, Promo, dll)...',
      background: '#0f172a', color: '#fff',
      showCancelButton: true, confirmButtonText: 'Kirim Broadcast', confirmButtonColor: '#3b82f6', cancelButtonColor: '#374151'
    });
    
    if (text) {
      try {
        await setDoc(doc(db, "system", "broadcast"), { message: text, timestamp: Date.now(), active: true });
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Broadcast Aktif!', timer: 1500, showConfirmButton: false });
      } catch (error) { Swal.fire('Error', error.message, 'error'); }
    }
  };

  // === [FITUR BARU]: SET MASA AKTIF (EXPIRED DATE) ===
  const handleSetExpiry = async (owner) => {
    const { value: dateStr } = await Swal.fire({
      title: 'Atur Masa Aktif',
      html: `
        <div class="text-left mt-2">
          <label class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Tanggal Kadaluarsa</label>
          <input type="date" id="swal-expiry" class="w-full p-2.5 bg-slate-800 border border-slate-600 text-white rounded-lg mt-1 outline-none focus:border-blue-500" value="${owner.expiredAt ? new Date(owner.expiredAt).toISOString().split('T')[0] : ''}">
        </div>
        <p class="text-[10px] text-slate-500 text-left mt-2"><i class="fas fa-info-circle"></i> Kosongkan tanggal untuk akses seumur hidup (Lifetime).</p>
      `,
      background: '#0f172a', color: '#fff',
      showCancelButton: true, confirmButtonText: 'Simpan', confirmButtonColor: '#3b82f6', cancelButtonColor: '#374151',
      preConfirm: () => document.getElementById('swal-expiry').value
    });

    if (dateStr !== undefined) {
      try {
        const expiredTimestamp = dateStr ? new Date(dateStr).getTime() : null;
        await updateDoc(doc(db, "users", owner.id), { expiredAt: expiredTimestamp });
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Masa Aktif Disimpan', timer: 1500, showConfirmButton: false });
        fetchAllData();
      } catch (error) { Swal.fire('Error', error.message, 'error'); }
    }
  };

  // === [FITUR BARU]: HAPUS KLIEN PERMANEN ===
  const handleDeleteClient = async (owner) => {
    Swal.fire({
      title: 'HAPUS PERMANEN?',
      text: `Toko "${owner.shopName || owner.name}" beserta ${owner.staffCount} akun kasirnya akan dibumihanguskan. Aksi ini tidak dapat dibatalkan!`,
      icon: 'warning',
      showCancelButton: true, confirmButtonColor: '#ef4444', cancelButtonColor: '#374151', confirmButtonText: 'YA, BUMIHANGUSKAN!'
    }).then(async (result) => {
      if (result.isConfirmed) {
        Swal.fire({ title: 'Menghapus...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        try {
          const batch = writeBatch(db);
          batch.delete(doc(db, "users", owner.id)); // Hapus Akun Bos
          owner.staffList.forEach(staff => {
            batch.delete(doc(db, "users", staff.id)); // Hapus Akun Kasir-kasirnya
          });
          await batch.commit();
          Swal.fire('Terhapus!', 'Klien dan jaringannya berhasil dihapus.', 'success');
          fetchAllData();
        } catch (error) { Swal.fire('Error', error.message, 'error'); }
      }
    });
  };

  // === FUNGSI LOGOUT ===
  const handleLogout = () => {
    Swal.fire({
      title: 'Keluar dari ISZI?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Ya, Logout'
    }).then((result) => {
      if (result.isConfirmed) signOut(auth);
    });
  };

  // MESIN PENCARIAN
  const filteredOwners = owners.filter(owner => {
    const search = searchTerm.toLowerCase();
    return (owner.shopName || owner.name || '').toLowerCase().includes(search) || 
           (owner.email || '').toLowerCase().includes(search);
  });

  const activeCount = owners.filter(o => !o.isSuspended && (!o.expiredAt || o.expiredAt > Date.now())).length;
  const suspendedCount = owners.length - activeCount;

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
            <p className="text-[11px] text-slate-400 font-mono">God Mode: {currentUser?.email}</p>
          </div>
        </div>
        <button onClick={handleLogout} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2 border border-slate-700">
          <i className="fas fa-sign-out-alt"></i> Keluar
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        
        {/* KARTU METRIK [DIUBAH MENJADI 5 KOLOM] */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
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
          
          {/* [FITUR BARU] KARTU METRIK BEBAN DATABASE */}
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-red-500/10 rounded-bl-full flex items-start justify-end p-3"><i className="fas fa-database text-red-500 text-lg"></i></div>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Beban Database</p>
            <h2 className="text-3xl font-black text-white">{globalTx} <span className="text-sm font-normal text-slate-500">Docs</span></h2>
            <p className="text-[9px] text-slate-500 mt-1 uppercase">Estimasi Transaksi Aktif</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-orange-500/10 rounded-bl-full flex items-start justify-end p-3"><i className="fas fa-chart-pie text-orange-500 text-lg"></i></div>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Status Klien</p>
            <div className="flex items-center gap-4 mt-1">
              <div><span className="text-2xl font-black text-emerald-400">{activeCount}</span> <span className="text-[10px] text-slate-500">Aktif</span></div>
              <div><span className="text-2xl font-black text-red-400">{suspendedCount}</span> <span className="text-[10px] text-slate-500">Blokir</span></div>
            </div>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-sm flex flex-col justify-center items-center text-center">
             <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2">Server Status</p>
             <div className="flex items-center gap-2 mb-2">
                <span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span></span>
                <span className="text-emerald-400 font-bold text-sm tracking-widest">ONLINE</span>
             </div>
             <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/3/37/Firebase_Logo.svg/1200px-Firebase_Logo.svg.png" alt="Firebase" className="h-6 opacity-60" />
          </div>
        </div>

        {/* TABEL DIREKTORI */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <div className="px-6 py-5 border-b border-slate-800 flex flex-col md:flex-row md:justify-between md:items-center gap-4 bg-slate-900/50">
            <h3 className="font-bold text-white text-lg flex items-center gap-2">
              <i className="fas fa-list-ul text-blue-500"></i> Direktori Pelanggan
            </h3>
            <div className="flex items-center gap-2">
              <div className="relative">
                <i className="fas fa-search absolute left-3 top-2.5 text-slate-500 text-sm"></i>
                <input type="text" placeholder="Cari nama atau email..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="bg-slate-950 border border-slate-700 text-white text-sm rounded-lg pl-9 pr-4 py-2 focus:outline-none focus:border-blue-500 w-full md:w-64 transition-colors" />
              </div>
              
              {/* [FITUR BARU]: TOMBOL BROADCAST */}
              <button onClick={handleBroadcast} className="w-10 h-10 rounded-lg bg-indigo-900/30 text-indigo-400 hover:bg-indigo-800/50 hover:text-white flex items-center justify-center transition border border-indigo-800/50" title="Kirim Pengumuman Broadcast">
                <i className="fas fa-bullhorn"></i>
              </button>

              <button onClick={fetchAllData} className="w-10 h-10 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition border border-slate-700" title="Refresh Data">
                <i className={`fas fa-sync-alt ${isLoading ? 'fa-spin' : ''}`}></i>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-slate-950/50 text-slate-400 text-xs uppercase tracking-wider">
                  <th className="p-4 font-semibold border-b border-slate-800">Profil Usaha</th>
                  <th className="p-4 font-semibold border-b border-slate-800">Email Utama</th>
                  <th className="p-4 font-semibold border-b border-slate-800">Status & Pemakaian Limit</th>
                  <th className="p-4 font-semibold border-b border-slate-800 text-center w-64">Aksi (God Mode)</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-slate-800/50">
                {isLoading ? (
                  <tr><td colSpan="4" className="p-8 text-center text-slate-500"><i className="fas fa-circle-notch fa-spin text-2xl text-blue-500 mb-2 block"></i> Memuat direktori...</td></tr>
                ) : filteredOwners.length === 0 ? (
                  <tr><td colSpan="4" className="p-8 text-center text-slate-500 font-mono">Belum ada klien yang terdaftar.</td></tr>
                ) : (
                  filteredOwners.map((owner) => {
                    const isExpired = owner.expiredAt && owner.expiredAt < Date.now();
                    
                    return (
                    <tr key={owner.id} className="hover:bg-slate-800/30 transition-colors">
                      
                      {/* KOLOM PROFIL & KARYAWAN */}
                      <td className="p-4">
                        <p className="font-bold text-white text-base">{owner.shopName || owner.name}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-1.5 cursor-pointer" onClick={() => handleViewStaff(owner)} title="Klik untuk lihat karyawan">
                          <p className="text-[10px] text-slate-400 font-mono uppercase bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700 hover:bg-slate-700 transition">ID: {owner.id.slice(0, 8)}</p>
                          <span className={`text-[10px] px-2 py-0.5 rounded-md border flex items-center gap-1 font-bold transition hover:opacity-80 ${owner.staffCount > 0 ? 'bg-purple-900/30 text-purple-400 border-purple-800/50' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                            <i className="fas fa-user-tie"></i> {owner.staffCount} Kasir
                          </span>
                        </div>
                      </td>

                      <td className="p-4 text-slate-300 font-mono text-xs">{owner.email}</td>
                      
                      {/* KOLOM LIMIT & EXPIRED */}
                      <td className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          {isExpired ? (
                            <span className="bg-red-500/10 text-red-500 border border-red-500/20 px-2 py-0.5 rounded-full text-[9px] font-extrabold tracking-widest uppercase">🔴 Expired</span>
                          ) : owner.isSuspended ? (
                            <span className="bg-red-500/10 text-red-500 border border-red-500/20 px-2 py-0.5 rounded-full text-[9px] font-extrabold tracking-widest uppercase">🔴 Suspended</span>
                          ) : (
                            <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full text-[9px] font-extrabold tracking-widest uppercase">🟢 Active</span>
                          )}
                        </div>
                        <div className="flex flex-col gap-1.5">
                          {/* Limit Transaksi */}
                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded border flex items-center gap-2 max-w-max ${(owner.maxTransactions > 0 && owner.currentUsage >= owner.maxTransactions) ? 'bg-red-900/40 text-red-400 border-red-800/50' : 'bg-slate-950 text-slate-400 border-slate-800'}`}>
                            <i className="fas fa-receipt w-3 text-center"></i> Nota: {owner.maxTransactions > 0 ? `${owner.currentUsage} / ${owner.maxTransactions}` : '∞ (Unlimited)'}
                          </span>
                          {/* Limit Menu & Foto */}
                          <div className="flex gap-2">
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded border bg-slate-950 text-slate-400 border-slate-800 flex items-center gap-2 max-w-max">
                              <i className="fas fa-hamburger w-3 text-center"></i> Menu: {owner.maxMenus > 0 ? `Max ${owner.maxMenus}` : '∞'}
                            </span>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded border bg-slate-950 text-slate-400 border-slate-800 flex items-center gap-2 max-w-max">
                              <i className="fas fa-image w-3 text-center"></i> Foto: {owner.maxImages > 0 ? `Max ${owner.maxImages}` : '∞'}
                            </span>
                          </div>
                          {/* [FITUR BARU]: Info Expired Date */}
                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded border flex items-center gap-2 max-w-max ${isExpired ? 'bg-red-900/40 text-red-400 border-red-800/50' : 'bg-slate-950 text-slate-400 border-slate-800'}`}>
                            <i className="fas fa-calendar-alt w-3 text-center"></i> Masa Aktif: {owner.expiredAt ? new Date(owner.expiredAt).toLocaleDateString('id-ID') : 'Lifetime'}
                          </span>
                        </div>
                      </td>

                      {/* KOLOM AKSI (DITAMBAH EXPIRY & DELETE) */}
                      <td className="p-4 flex flex-wrap justify-center gap-2">
                        {onImpersonate && (
                          <button onClick={() => onImpersonate(owner.id)} className="w-8 h-8 rounded-lg bg-purple-900/30 text-purple-400 border border-purple-800/50 hover:bg-purple-800/50 hover:text-white flex items-center justify-center transition shadow-sm" title="Mata Dewa (Masuk Toko)">
                            <i className="fas fa-user-secret"></i>
                          </button>
                        )}
                        <button onClick={() => handleEditLimit(owner)} className="w-8 h-8 rounded-lg bg-blue-900/30 text-blue-400 border border-blue-800/50 hover:bg-blue-800/50 hover:text-white flex items-center justify-center transition shadow-sm" title="Atur Kuota Limit">
                          <i className="fas fa-sliders-h"></i>
                        </button>
                        {/* [FITUR BARU]: Tombol Atur Masa Aktif */}
                        <button onClick={() => handleSetExpiry(owner)} className="w-8 h-8 rounded-lg bg-yellow-900/30 text-yellow-500 border border-yellow-800/50 hover:bg-yellow-800/50 hover:text-white flex items-center justify-center transition shadow-sm" title="Atur Masa Aktif / Expired Date">
                          <i className="fas fa-calendar-check"></i>
                        </button>
                        <button onClick={() => handleToggleSuspend(owner)} className={`w-8 h-8 rounded-lg flex items-center justify-center transition shadow-sm border ${owner.isSuspended ? 'bg-emerald-900/30 text-emerald-400 border-emerald-800/50 hover:bg-emerald-800/50 hover:text-white' : 'bg-orange-900/30 text-orange-400 border-orange-800/50 hover:bg-orange-800/50 hover:text-white'}`} title={owner.isSuspended ? "Aktifkan Akun" : "Blokir Akun"}>
                          <i className={`fas ${owner.isSuspended ? 'fa-play' : 'fa-ban'}`}></i>
                        </button>
                        {/* [FITUR BARU]: Tombol Hapus Permanen */}
                        <button onClick={() => handleDeleteClient(owner)} className="w-8 h-8 rounded-lg bg-red-900/30 text-red-500 border border-red-800/50 hover:bg-red-800/50 hover:text-white flex items-center justify-center transition shadow-sm" title="Hapus Klien Permanen">
                          <i className="fas fa-trash-alt"></i>
                        </button>
                      </td>
                    </tr>
                  )
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
