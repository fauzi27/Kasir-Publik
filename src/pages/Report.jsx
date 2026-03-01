import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import Swal from 'sweetalert2';
import ReceiptModal from '../components/ReceiptModal';

export default function Report({ businessData, currentUser, onNavigate }) {
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // === STATE FILTER & PENCARIAN BARU ===
  const [filterMode, setFilterMode] = useState('daily'); // 'daily' atau 'monthly'
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7)); // Format YYYY-MM
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDebtOnly, setFilterDebtOnly] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // === STATE MODAL ===
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const shopOwnerId = businessData?.ownerId || currentUser?.uid;
  const isKasir = businessData?.role === 'kasir';

  // === AMBIL DATA TRANSAKSI (REALTIME & OFFLINE AWARE) ===
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

  // === LOGIKA FILTER GABUNGAN (WAKTU, HUTANG, PENCARIAN) ===
  const filteredData = transactions.filter(t => {
    // 1. Filter Waktu (Harian vs Bulanan)
    let matchTime = true;
    const txDateObj = t.timestamp ? new Date(t.timestamp) : null;
    
    if (txDateObj) {
      const localISO = new Date(txDateObj.getTime() - (txDateObj.getTimezoneOffset() * 60000)).toISOString();
      if (filterMode === 'daily') {
        matchTime = localISO.split('T')[0] === filterDate;
      } else if (filterMode === 'monthly') {
        matchTime = localISO.slice(0, 7) === filterMonth;
      }
    }

    // 2. Filter Hutang
    let matchDebt = filterDebtOnly ? (t.remaining || 0) > 0 : true;

    // 3. Filter Pencarian (Nama Pembeli / Invoice ID / Metode)
    let matchSearch = true;
    if (searchQuery) {
      const queryLower = searchQuery.toLowerCase();
      const buyerMatch = (t.buyer || '').toLowerCase().includes(queryLower);
      const methodMatch = (t.method || '').toLowerCase().includes(queryLower);
      // Generate ID palsu untuk pencarian jika diperlukan (atau gunakan property ID jika ada)
      const idMatch = t.id.toLowerCase().includes(queryLower);
      matchSearch = buyerMatch || methodMatch || idMatch;
    }

    return matchTime && matchDebt && matchSearch;
  });

  // === HITUNG TOTAL OMZET & HUTANG DARI DATA TERFILTER ===
  const totalOmzet = filteredData.reduce((sum, t) => sum + (t.paid || 0), 0);
  const totalHutang = filteredData.reduce((sum, t) => sum + (t.remaining || 0), 0);

  // === FUNGSI EXPORT CSV ===
  const handleExportCSV = () => {
    if (filteredData.length === 0) return Swal.fire('Kosong', 'Tidak ada data untuk diekspor', 'info');

    let csvContent = "Tanggal,Pelanggan,Metode,Total Belanja,Dibayar,Sisa Hutang,Status\n";
    
    filteredData.forEach(t => {
      const tgl = t.date ? t.date.replace(/,/g, '') : new Date(t.timestamp).toLocaleString('id-ID').replace(/,/g, '');
      const buyer = t.buyer || 'Umum';
      const method = t.method || '-';
      const total = t.total || 0;
      const paid = t.paid || 0;
      const debt = t.remaining || 0;
      const status = debt > 0 ? 'HUTANG' : 'LUNAS';
      
      csvContent += `${tgl},${buyer},${method},${total},${paid},${debt},${status}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    const fileName = filterMode === 'daily' ? `Laporan_${filterDate}` : `Laporan_Bulan_${filterMonth}`;
    link.setAttribute('download', `${fileName}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // === FUNGSI AKSI TRANSAKSI ===
  const openTransactionDetail = (tx) => {
    setSelectedTransaction(tx);
    setIsModalOpen(true);
  };

  const handleDelete = (id) => {
    if (isKasir) return Swal.fire('Ditolak', 'Hanya Admin yang bisa menghapus transaksi.', 'error');

    Swal.fire({
      title: 'Hapus Transaksi?',
      text: "Data akan dihapus permanen!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Ya, Hapus'
    }).then((result) => {
      if (result.isConfirmed) {
        deleteDoc(doc(db, "users", shopOwnerId, "transactions", id))
          .catch(err => console.log("Hapus tertunda", err));
        Swal.fire({ toast: true, position: 'center', icon: 'success', title: 'Dihapus', timer: 1000, showConfirmButton: false });
        setIsModalOpen(false);
      }
    });
  };

  const handleMarkLunas = async (tx) => {
    const { value: method } = await Swal.fire({
      title: 'Pelunasan',
      text: `Sisa hutang: Rp ${tx.remaining.toLocaleString('id-ID')}`,
      input: 'select',
      inputOptions: { 'TUNAI': 'Tunai', 'QRIS': 'QRIS' },
      inputPlaceholder: 'Pilih metode',
      showCancelButton: true,
      confirmButtonText: 'Lunaskan'
    });

    if (method) {
      const updatedData = {
        remaining: 0,
        paid: (tx.paid || 0) + tx.remaining,
        method: tx.paid === 0 ? method : `${tx.method} + ${method}`
      };

      updateDoc(doc(db, "users", shopOwnerId, "transactions", tx.id), updatedData)
        .catch(err => console.log("Pelunasan tertunda", err));

      Swal.fire({ toast: true, position: 'center', icon: 'success', title: 'Lunas!', timer: 1500, showConfirmButton: false });
      setIsModalOpen(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-100 transition-colors duration-300">
      
      {/* HEADER */}
      <div className="bg-white dark:bg-gray-800 shadow-sm z-10 flex-none px-4 py-3 flex items-center justify-between border-b border-gray-200 dark:border-gray-700 transition-colors duration-300">
        <div className="flex items-center gap-3">
          <button onClick={() => onNavigate('lobby')} className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white active:scale-90 transition p-1">
            <i className="fas fa-arrow-left text-lg"></i>
          </button>
          <h2 className="font-bold text-gray-700 dark:text-gray-200 text-base">Buku Besar</h2>
        </div>
        
        {/* TOMBOL EXPORT CSV */}
        {!isKasir && (
          <button onClick={handleExportCSV} className="text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 active:scale-95 border border-green-200 dark:border-green-800 transition">
            <i className="fas fa-file-csv text-sm"></i> <span className="hidden sm:inline">Export</span>
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 hide-scrollbar">
        
        {/* KARTU OMZET */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-4 text-white shadow-md flex flex-col justify-center">
            <p className="text-[10px] uppercase tracking-wider font-semibold opacity-80 mb-1">Total Pemasukan</p>
            <h3 className="text-lg md:text-xl font-extrabold truncate">Rp {totalOmzet.toLocaleString('id-ID')}</h3>
          </div>
          <div className="bg-gradient-to-br from-red-500 to-rose-600 rounded-2xl p-4 text-white shadow-md flex flex-col justify-center">
            <p className="text-[10px] uppercase tracking-wider font-semibold opacity-80 mb-1">Total Piutang</p>
            <h3 className="text-lg md:text-xl font-extrabold truncate">Rp {totalHutang.toLocaleString('id-ID')}</h3>
          </div>
        </div>

        {/* ALAT PENCARIAN & FILTER KONTROL */}
        <div className="bg-white dark:bg-gray-800 p-3 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 mb-4 transition-colors">
          
          {/* Kotak Pencarian */}
          <div className="relative mb-3">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <i className="fas fa-search text-gray-400"></i>
            </div>
            <input 
              type="text" 
              placeholder="Cari pelanggan, kasir, nota..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-xl text-sm outline-none focus:ring-1 focus:ring-blue-500 dark:text-white transition"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-red-500">
                <i className="fas fa-times-circle"></i>
              </button>
            )}
          </div>

          {/* Baris Filter Waktu & Hutang */}
          <div className="flex flex-wrap gap-2">
            <select 
              value={filterMode} 
              onChange={(e) => setFilterMode(e.target.value)}
              className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-xs rounded-xl px-2 py-2 outline-none"
            >
              <option value="daily">Harian</option>
              <option value="monthly">Bulanan</option>
            </select>

            {filterMode === 'daily' ? (
              <input 
                type="date" 
                value={filterDate} 
                onChange={e => setFilterDate(e.target.value)}
                className="flex-1 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-xs rounded-xl px-2 py-2 outline-none"
              />
            ) : (
              <input 
                type="month" 
                value={filterMonth} 
                onChange={e => setFilterMonth(e.target.value)}
                className="flex-1 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-xs rounded-xl px-2 py-2 outline-none"
              />
            )}

            <button 
              onClick={() => setFilterDebtOnly(!filterDebtOnly)}
              className={`px-3 py-2 rounded-xl text-xs font-bold border transition ${filterDebtOnly ? 'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/30 dark:border-red-800' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600'}`}
            >
              <i className={`fas fa-book-open ${filterDebtOnly ? 'text-red-500' : ''}`}></i>
            </button>
          </div>
        </div>

        {/* DAFTAR TRANSAKSI (Dengan Lampu Indikator) */}
        {isLoading ? (
          <div className="flex justify-center items-center h-32">
            <i className="fas fa-circle-notch fa-spin text-3xl text-blue-500"></i>
          </div>
        ) : filteredData.length === 0 ? (
          <div className="text-center mt-8 text-gray-400 dark:text-gray-500 flex flex-col items-center opacity-70">
            <i className="fas fa-folder-open text-4xl mb-3"></i>
            <p className="text-sm">Data tidak ditemukan</p>
            <p className="text-xs mt-1">Coba ubah tanggal atau kata kunci pencarian</p>
          </div>
        ) : (
          <div className="space-y-3 pb-6">
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-2 pl-1">Menampilkan {filteredData.length} transaksi</p>
            
            {filteredData.map(t => {
              const hasHutang = (t.remaining || 0) > 0;
              
              let syncColor = 'text-green-500'; 
              let syncIcon = 'fa-check-circle'; 
              let syncTitle = 'Tersimpan';

              if (t.isPending) {
                if (isOnline) {
                  syncColor = 'text-yellow-500 animate-spin'; 
                  syncIcon = 'fa-sync-alt'; 
                  syncTitle = 'Mengunggah...';
                } else {
                  syncColor = 'text-red-500'; 
                  syncIcon = 'fa-exclamation-circle'; 
                  syncTitle = 'Menunggu Internet';
                }
              }

              return (
                <div 
                  key={t.id} 
                  onClick={() => openTransactionDetail(t)}
                  className={`bg-white dark:bg-gray-800 p-3 rounded-xl shadow-sm border-l-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 active:scale-95 transition flex justify-between items-center ${hasHutang ? 'border-red-500' : t.method === 'QRIS' ? 'border-blue-500' : 'border-green-500'}`}
                >
                  <div className="flex-1 overflow-hidden pr-2">
                    <p className="font-bold text-sm text-gray-800 dark:text-gray-100 flex items-center gap-2 truncate">
                      {t.buyer || 'Pelanggan Umum'}
                      {hasHutang && <span className="bg-red-100 text-red-600 text-[9px] font-extrabold px-1.5 py-0.5 rounded flex-none">NGUTANG</span>}
                    </p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-1.5 truncate">
                      <i className={`fas ${syncIcon} ${syncColor}`} title={syncTitle}></i>
                      {t.date ? t.date.split(',')[0] : new Date(t.timestamp).toLocaleDateString('id-ID')}
                      <span className="opacity-50">|</span>
                      <span>{t.operatorName || 'Admin'}</span>
                    </p>
                  </div>
                  <div className="text-right flex-none">
                    <p className="font-extrabold text-sm text-gray-800 dark:text-gray-100">Rp {(t.total || 0).toLocaleString('id-ID')}</p>
                    <p className={`text-[10px] font-bold mt-0.5 uppercase tracking-wide ${hasHutang ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}>
                      {t.method || 'TUNAI'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ReceiptModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        transaction={selectedTransaction}
        businessData={businessData}
        mode="view"
        onDelete={!isKasir ? handleDelete : null} 
        onMarkLunas={handleMarkLunas}
      />
      
    </div>
  );
}
