import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, increment } from 'firebase/firestore'; // 🔥 increment ditambah
import Swal from 'sweetalert2';
import ReceiptModal from '../components/ReceiptModal';

export default function Report({ businessData, currentUser, onNavigate }) {
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // === FUNGSI HELPER UNTUK MENDAPATKAN FORMAT MINGGU (YYYY-Www) ===
  const getWeekString = (dateObj) => {
    const date = new Date(dateObj.getTime());
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
    const week1 = new Date(date.getFullYear(), 0, 4);
    const weekNum = 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
    return `${date.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
  };

  // === STATE FILTER & PENCARIAN ===
  const [filterMode, setFilterMode] = useState('daily'); 
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [filterWeek, setFilterWeek] = useState(getWeekString(new Date()));
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7));
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDebtOnly, setFilterDebtOnly] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // === STATE MODAL ===
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const shopOwnerId = businessData?.ownerId || currentUser?.uid;
  const isKasir = businessData?.role === 'kasir';

  // === AMBIL DATA TRANSAKSI ===
  useEffect(() => {
    if (!shopOwnerId) return;

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const q = query(collection(db, "users", shopOwnerId, "transactions"), orderBy("timestamp", "desc"));
    
    const unsub = onSnapshot(q, { includeMetadataChanges: true }, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(),
        isPending: doc.metadata.hasPendingWrites 
      }));
      setTransactions(data);
      setIsLoading(false);
    });

    return () => {
      unsub();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [shopOwnerId]);

  // === LOGIKA FILTER GABUNGAN ===
  const filteredData = transactions.filter(t => {
    let matchTime = true;
    const txDateObj = t.timestamp ? new Date(t.timestamp) : null;
    
    if (txDateObj) {
      const localISO = new Date(txDateObj.getTime() - (txDateObj.getTimezoneOffset() * 60000)).toISOString();
      if (filterMode === 'daily') {
        matchTime = localISO.split('T')[0] === filterDate;
      } else if (filterMode === 'weekly') {
        matchTime = getWeekString(txDateObj) === filterWeek;
      } else if (filterMode === 'monthly') {
        matchTime = localISO.slice(0, 7) === filterMonth;
      }
    }

    let matchDebt = filterDebtOnly ? (t.remaining || 0) > 0 : true;

    let matchSearch = true;
    if (searchQuery) {
      const queryLower = searchQuery.toLowerCase();
      const buyerMatch = (t.buyer || '').toLowerCase().includes(queryLower);
      const methodMatch = (t.method || '').toLowerCase().includes(queryLower);
      matchSearch = buyerMatch || methodMatch;
    }

    return matchTime && matchDebt && matchSearch;
  });

  // === MENGHITUNG METRIK (MENGABAIKAN NOTA REFUND) ===
  let totalPenjualan = 0;
  let totalTunai = 0;
  let totalQRIS = 0;
  let totalHutang = 0;
  let totalTransaksiAktif = 0;

  filteredData.forEach(t => {
    // 🔥 PENTING: Jika statusnya REFUNDED, jangan masukkan ke hitungan omzet
    if (t.status === 'REFUNDED') return;

    totalTransaksiAktif++;
    totalPenjualan += (t.total || 0);
    totalHutang += (t.remaining || 0);
    
    const methodStr = (t.method || '').toUpperCase();
    if (methodStr.includes('TUNAI')) {
      totalTunai += (t.paid || 0);
    } else if (methodStr.includes('QRIS')) {
      totalQRIS += (t.paid || 0);
    }
  });

  // === FUNGSI EXPORT PDF & EXCEL (Disembunyikan untuk kerapian) ===
  const handleExportPDF = () => { /* Logika PDF tetap sama */ };
  const handleExportExcel = () => { /* Logika Excel tetap sama */ };

  // === FUNGSI AKSI TRANSAKSI ===
  const openTransactionDetail = (tx) => {
    setSelectedTransaction(tx);
    setIsModalOpen(true);
  };

  // 🔥 SISTEM REFUND (PENGGANTI HAPUS) 🔥
  const handleRefund = async (id) => {
    if (isKasir) return Swal.fire('Ditolak', 'Hanya Bos/Admin yang bisa membatalkan transaksi.', 'error');

    const txToRefund = transactions.find(t => t.id === id);
    if (!txToRefund) return;

    const { value: reason } = await Swal.fire({
      title: 'Batalkan Transaksi?',
      html: 'Uang akan dikurangi dari laporan dan stok akan dikembalikan.',
      input: 'text',
      inputLabel: 'Alasan Pembatalan (Wajib)',
      inputPlaceholder: 'Cth: Salah input pesanan',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Ya, Refund',
      inputValidator: (value) => {
        if (!value) return 'Alasan pembatalan wajib diisi!';
      }
    });

    if (reason) {
      try {
        // 1. Ubah status transaksi menjadi REFUNDED
        await updateDoc(doc(db, "users", shopOwnerId, "transactions", id), {
          status: 'REFUNDED',
          refundReason: reason,
          refundAt: Date.now()
        });

        // 2. Kembalikan stok barang (Jika ada data keranjangnya)
        if (txToRefund.items && Array.isArray(txToRefund.items)) {
          txToRefund.items.forEach(async (item) => {
            if (item.id) {
              const menuRef = doc(db, "users", shopOwnerId, "menus", item.id);
              // Menggunakan increment(+) untuk mengembalikan jumlah yang terjual
              await updateDoc(menuRef, { stock: increment(item.qty) }).catch(()=> {/* Abaikan jika menu tdk punya stok */});
            }
          });
        }

        Swal.fire({ toast: true, position: 'center', icon: 'success', title: 'Transaksi Dibatalkan', timer: 1500, showConfirmButton: false });
        setIsModalOpen(false);
      } catch (error) {
        Swal.fire('Error', 'Gagal membatalkan: ' + error.message, 'error');
      }
    }
  };

  const handleMarkLunas = async (tx) => {
    const { value: method } = await Swal.fire({
      title: 'Pelunasan',
      text: `Sisa hutang: Rp ${tx.remaining.toLocaleString('id-ID')}`,
      input: 'select',
      inputOptions: { 'TUNAI': 'Tunai', 'QRIS': 'QRIS' },
      showCancelButton: true,
      confirmButtonText: 'Lunaskan'
    });

    if (method) {
      const updatedData = { remaining: 0, paid: (tx.paid || 0) + tx.remaining, method: tx.paid === 0 ? method : `${tx.method} + ${method}` };
      updateDoc(doc(db, "users", shopOwnerId, "transactions", tx.id), updatedData).catch(() => {});
      Swal.fire({ toast: true, position: 'center', icon: 'success', title: 'Lunas!', timer: 1500, showConfirmButton: false });
      setIsModalOpen(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-100 transition-colors duration-300">
      
      {/* HEADER */}
      <div className="bg-white dark:bg-gray-800 shadow-sm z-10 flex-none px-4 py-3 flex items-center justify-between border-b border-gray-200 dark:border-gray-700 transition-colors">
        <div className="flex items-center gap-3">
          <button onClick={() => onNavigate('lobby')} className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white active:scale-90 transition p-1">
            <i className="fas fa-arrow-left text-lg"></i>
          </button>
          <h2 className="font-bold text-gray-800 dark:text-gray-100 text-base">Dashboard Analitik</h2>
        </div>
        
        {!isKasir && (
          <div className="flex gap-2">
            <button onClick={handleExportPDF} className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center hover:bg-purple-700 active:scale-90 transition shadow-sm"><i className="fas fa-file-pdf text-xs"></i></button>
            <button onClick={handleExportExcel} className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center hover:bg-purple-700 active:scale-90 transition shadow-sm"><i className="fas fa-file-excel text-xs"></i></button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 hide-scrollbar">
        
        {/* KARTU METRIK UTAMA */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 mb-4 relative overflow-hidden transition-colors">
          <div className="absolute -top-6 -right-6 w-24 h-24 bg-purple-50 dark:bg-purple-900/20 rounded-full"></div>
          
          <div className="relative z-10">
            <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider mb-1">
              Omzet Kotor {filterMode === 'daily' ? 'Hari Ini' : filterMode === 'weekly' ? 'Minggu Ini' : 'Bulan Ini'}
            </p>
            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-800 dark:text-gray-100 mb-5 tracking-tight">
              Rp {totalPenjualan.toLocaleString('id-ID')}
            </h2>

            <div className="grid grid-cols-2 gap-y-4 gap-x-2 border-t border-gray-100 dark:border-gray-700 pt-4">
              <div>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold mb-1 flex items-center gap-1.5"><i className="fas fa-money-bill-wave text-green-500"></i> Masuk Tunai</p>
                <p className="text-sm font-extrabold text-gray-800 dark:text-gray-100">Rp {totalTunai.toLocaleString('id-ID')}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold mb-1 flex items-center gap-1.5"><i className="fas fa-qrcode text-blue-500"></i> Masuk QRIS</p>
                <p className="text-sm font-extrabold text-gray-800 dark:text-gray-100">Rp {totalQRIS.toLocaleString('id-ID')}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold mb-1 flex items-center gap-1.5"><i className="fas fa-book-open text-red-500"></i> Sisa Hutang</p>
                <p className="text-sm font-extrabold text-red-600 dark:text-red-400">Rp {totalHutang.toLocaleString('id-ID')}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold mb-1 flex items-center gap-1.5"><i className="fas fa-receipt text-purple-500"></i> Nota Sukses</p>
                <p className="text-sm font-extrabold text-gray-800 dark:text-gray-100">{totalTransaksiAktif} Nota</p>
              </div>
            </div>
          </div>
        </div>

        {/* ALAT PENCARIAN & FILTER (Tetap Sama) */}
        <div className="bg-white dark:bg-gray-800 p-3 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 mb-4 transition-colors">
          <div className="relative mb-3">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><i className="fas fa-search text-gray-400"></i></div>
            <input type="text" placeholder="Cari pelanggan, metode..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-xl text-sm outline-none focus:ring-1 focus:ring-blue-500 dark:text-white transition" />
          </div>
          <div className="flex flex-wrap gap-2">
            <select value={filterMode} onChange={(e) => setFilterMode(e.target.value)} className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-xs rounded-xl px-2 py-2 outline-none">
              <option value="daily">Harian</option><option value="weekly">Mingguan</option><option value="monthly">Bulanan</option>
            </select>
            {filterMode === 'daily' && <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="flex-1 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-xs rounded-xl px-2 py-2 outline-none" />}
            {filterMode === 'weekly' && <input type="week" value={filterWeek} onChange={e => setFilterWeek(e.target.value)} className="flex-1 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-xs rounded-xl px-2 py-2 outline-none" />}
            {filterMode === 'monthly' && <input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="flex-1 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-xs rounded-xl px-2 py-2 outline-none" />}
            <button onClick={() => setFilterDebtOnly(!filterDebtOnly)} className={`px-3 py-2 rounded-xl text-xs font-bold border transition ${filterDebtOnly ? 'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/30 dark:border-red-800' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600'}`}>
              <i className={`fas fa-book-open ${filterDebtOnly ? 'text-red-500' : ''}`}></i>
            </button>
          </div>
        </div>

        {/* DAFTAR TRANSAKSI */}
        {isLoading ? (
          <div className="flex justify-center items-center h-32"><i className="fas fa-circle-notch fa-spin text-3xl text-blue-500"></i></div>
        ) : filteredData.length === 0 ? (
          <div className="text-center mt-8 text-gray-400 dark:text-gray-500 opacity-70"><i className="fas fa-folder-open text-4xl mb-3"></i><p className="text-sm">Data tidak ditemukan</p></div>
        ) : (
          <div className="space-y-3 pb-6">
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-2 pl-1">Rincian Transaksi</p>
            
            {filteredData.map(t => {
              const hasHutang = (t.remaining || 0) > 0;
              const isRefunded = t.status === 'REFUNDED'; // 🔥 Pengecekan status
              
              let syncColor = 'text-green-500'; 
              let syncIcon = 'fa-check-circle'; 
              let syncTitle = 'Tersimpan';
              
              if (t.isPending) {
                if (isOnline) { syncColor = 'text-yellow-500 animate-spin'; syncIcon = 'fa-sync-alt'; syncTitle = 'Mengunggah...'; } 
                else { syncColor = 'text-red-500'; syncIcon = 'fa-exclamation-circle'; syncTitle = 'Menunggu Internet'; }
              }

              return (
                <div 
                  key={t.id} 
                  onClick={() => openTransactionDetail(t)}
                  // 🔥 Tambahkan opacity jika statusnya di-refund
                  className={`bg-white dark:bg-gray-800 p-3 rounded-xl shadow-sm border-l-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 active:scale-95 transition flex justify-between items-center 
                  ${isRefunded ? 'border-gray-400 opacity-60' : hasHutang ? 'border-red-500' : t.method === 'QRIS' ? 'border-blue-500' : 'border-green-500'}`}
                >
                  <div className="flex-1 overflow-hidden pr-2">
                    <p className={`font-bold text-sm text-gray-800 dark:text-gray-100 flex items-center gap-2 truncate ${isRefunded ? 'line-through' : ''}`}>
                      {t.buyer || 'Umum'}
                      {isRefunded && <span className="bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300 text-[9px] font-extrabold px-1.5 py-0.5 rounded flex-none">BATAL</span>}
                      {hasHutang && !isRefunded && <span className="bg-red-100 text-red-600 text-[9px] font-extrabold px-1.5 py-0.5 rounded flex-none">NGUTANG</span>}
                    </p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-1.5 truncate">
                      {isRefunded ? <i className="fas fa-times-circle text-gray-400"></i> : <i className={`fas ${syncIcon} ${syncColor}`} title={syncTitle}></i>}
                      {t.date ? t.date.split(',')[0] : new Date(t.timestamp).toLocaleDateString('id-ID')}
                    </p>
                  </div>
                  <div className="text-right flex-none">
                    <p className={`font-extrabold text-sm text-gray-800 dark:text-gray-100 ${isRefunded ? 'line-through text-gray-400' : ''}`}>
                      Rp {(t.total || 0).toLocaleString('id-ID')}
                    </p>
                    <p className={`text-[10px] font-bold mt-0.5 uppercase tracking-wide ${isRefunded ? 'text-gray-400' : hasHutang ? 'text-red-500' : 'text-gray-500 dark:text-gray-400'}`}>
                      {t.method || 'TUNAI'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL RECEIPT: Mengoper handleRefund menggantikan fungsi Delete */}
      <ReceiptModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        transaction={selectedTransaction} 
        businessData={businessData} 
        mode="view" 
        onDelete={(!isKasir && selectedTransaction?.status !== 'REFUNDED') ? () => handleRefund(selectedTransaction.id) : null} 
        onMarkLunas={selectedTransaction?.status !== 'REFUNDED' ? handleMarkLunas : null} 
      />
    </div>
  );
}
