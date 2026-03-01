import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import Swal from 'sweetalert2';
import ReceiptModal from '../components/ReceiptModal';

export default function Report({ businessData, currentUser, onNavigate }) {
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // State Filter
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [filterDebtOnly, setFilterDebtOnly] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // State Modal Struk
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const shopOwnerId = businessData?.ownerId || currentUser?.uid;
  const isKasir = businessData?.role === 'kasir';

  // === MENGAMBIL DATA TRANSAKSI (DENGAN METADATA OFFLINE) ===
  useEffect(() => {
    if (!shopOwnerId) return;

    // Listener untuk status internet HP (memicu render ulang icon lampu)
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const q = query(collection(db, "users", shopOwnerId, "transactions"), orderBy("timestamp", "desc"));
    
    // 🔥 includeMetadataChanges agar kita tahu mana data yang masih nyangkut di memori HP
    const unsub = onSnapshot(q, { includeMetadataChanges: true }, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(),
        isPending: doc.metadata.hasPendingWrites // TRUE jika belum terupload ke server
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

  // === LOGIKA FILTER TANGGAL & HUTANG ===
  const filteredData = transactions.filter(t => {
    let matchDate = true;
    if (filterDate) {
      const txDateObj = t.timestamp ? new Date(t.timestamp) : null;
      if (txDateObj) {
        // Ambil YYYY-MM-DD sesuai zona waktu lokal (WITA/WIB)
        const localDate = new Date(txDateObj.getTime() - (txDateObj.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
        matchDate = localDate === filterDate;
      }
    }
    let matchDebt = filterDebtOnly ? (t.remaining || 0) > 0 : true;
    return matchDate && matchDebt;
  });

  // === HITUNG TOTAL HARI INI ===
  const totalOmzet = filteredData.reduce((sum, t) => sum + (t.paid || 0), 0);
  const totalHutang = filteredData.reduce((sum, t) => sum + (t.remaining || 0), 0);

  // === FUNGSI MODAL & AKSI TRANSAKSI ===
  const openTransactionDetail = (tx) => {
    setSelectedTransaction(tx);
    setIsModalOpen(true);
  };

  const handleDelete = (id) => {
    if (isKasir) return Swal.fire('Ditolak', 'Hanya Admin yang bisa menghapus transaksi.', 'error');

    Swal.fire({
      title: 'Hapus Transaksi?',
      text: "Data tidak bisa dikembalikan!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Ya, Hapus'
    }).then((result) => {
      if (result.isConfirmed) {
        // Mode Tembak-Lupa (Fire-and-forget) agar bisa hapus saat offline
        deleteDoc(doc(db, "users", shopOwnerId, "transactions", id))
          .catch(err => console.log("Hapus tertunda (Offline)", err));
          
        Swal.fire({ toast: true, position: 'center', icon: 'success', title: 'Dihapus', timer: 1000, showConfirmButton: false });
        setIsModalOpen(false);
      }
    });
  };

  const handleMarkLunas = async (tx) => {
    const { value: method } = await Swal.fire({
      title: 'Pelunasan Hutang',
      text: `Sisa hutang: Rp ${tx.remaining.toLocaleString('id-ID')}`,
      input: 'select',
      inputOptions: { 'TUNAI': 'Bayar Tunai', 'QRIS': 'Bayar QRIS' },
      inputPlaceholder: 'Pilih metode pembayaran',
      showCancelButton: true,
      confirmButtonText: 'Lunaskan'
    });

    if (method) {
      const updatedData = {
        remaining: 0,
        paid: (tx.paid || 0) + tx.remaining,
        method: tx.paid === 0 ? method : `${tx.method} + ${method}`
      };

      // Mode Tembak-Lupa (Fire-and-forget)
      updateDoc(doc(db, "users", shopOwnerId, "transactions", tx.id), updatedData)
        .catch(err => console.log("Pelunasan tertunda (Offline)", err));

      Swal.fire({ toast: true, position: 'center', icon: 'success', title: 'Hutang Lunas!', timer: 1500, showConfirmButton: false });
      setIsModalOpen(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-100 transition-colors duration-300">
      
      {/* HEADER LAPORAN */}
      <div className="bg-white dark:bg-gray-800 shadow-sm z-10 flex-none px-4 py-3 flex items-center gap-3 border-b border-gray-200 dark:border-gray-700 transition-colors duration-300">
        <button onClick={() => onNavigate('lobby')} className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white active:scale-90 transition p-1">
          <i className="fas fa-arrow-left text-lg"></i>
        </button>
        <h2 className="font-bold text-gray-700 dark:text-gray-200 text-base">Laporan Penjualan</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 hide-scrollbar">
        
        {/* KARTU RINGKASAN OMZET */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-4 text-white shadow-md flex flex-col justify-center">
            <p className="text-[10px] uppercase tracking-wider font-semibold opacity-80 mb-1">Pemasukan</p>
            <h3 className="text-lg md:text-xl font-extrabold truncate">Rp {totalOmzet.toLocaleString('id-ID')}</h3>
          </div>
          <div className="bg-gradient-to-br from-red-500 to-rose-600 rounded-2xl p-4 text-white shadow-md flex flex-col justify-center">
            <p className="text-[10px] uppercase tracking-wider font-semibold opacity-80 mb-1">Piutang / Bon</p>
            <h3 className="text-lg md:text-xl font-extrabold truncate">Rp {totalHutang.toLocaleString('id-ID')}</h3>
          </div>
        </div>

        {/* ALAT FILTER */}
        <div className="flex gap-2 mb-4">
          <input 
            type="date" 
            value={filterDate} 
            onChange={e => setFilterDate(e.target.value)}
            className="flex-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 text-sm rounded-xl px-3 py-2 outline-none focus:border-blue-500 shadow-sm transition-colors duration-300"
          />
          <button 
            onClick={() => setFilterDebtOnly(!filterDebtOnly)}
            className={`px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-colors border ${filterDebtOnly ? 'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/30 dark:border-red-800' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
          >
            <i className={`fas fa-book-open mr-1 ${filterDebtOnly ? 'text-red-500' : ''}`}></i> Hutang
          </button>
        </div>

        {/* DAFTAR TRANSAKSI */}
        {isLoading ? (
          <div className="flex justify-center items-center h-40">
            <i className="fas fa-circle-notch fa-spin text-3xl text-blue-500"></i>
          </div>
        ) : filteredData.length === 0 ? (
          <div className="text-center mt-10 text-gray-400 dark:text-gray-500 flex flex-col items-center opacity-70">
            <i className="fas fa-receipt text-4xl mb-3"></i>
            <p className="text-sm">Tidak ada transaksi di tanggal ini</p>
          </div>
        ) : (
          <div className="space-y-3 pb-6">
            {filteredData.map(t => {
              const hasHutang = (t.remaining || 0) > 0;
              
              // 🔥 LOGIKA LAMPU INDIKATOR SINKRONISASI
              let syncColor = 'text-green-500'; 
              let syncIcon = 'fa-check-circle'; 
              let syncTitle = 'Tersimpan di Server';

              if (t.isPending) {
                if (isOnline) {
                  syncColor = 'text-yellow-500 animate-spin'; 
                  syncIcon = 'fa-sync-alt'; 
                  syncTitle = 'Sedang Mengunggah...';
                } else {
                  syncColor = 'text-red-500'; 
                  syncIcon = 'fa-exclamation-circle'; 
                  syncTitle = 'Menunggu Koneksi Internet';
                }
              }

              return (
                <div 
                  key={t.id} 
                  onClick={() => openTransactionDetail(t)}
                  className={`bg-white dark:bg-gray-800 p-3 rounded-xl shadow-sm border-l-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 active:scale-95 transition flex justify-between items-center ${hasHutang ? 'border-red-500' : t.method === 'QRIS' ? 'border-blue-500' : 'border-green-500'}`}
                >
                  <div>
                    <p className="font-bold text-sm text-gray-800 dark:text-gray-100 flex items-center gap-2">
                      {t.buyer || 'Pelanggan Umum'}
                      {hasHutang && <span className="bg-red-100 text-red-600 text-[9px] font-extrabold px-1.5 py-0.5 rounded">NGUTANG</span>}
                    </p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-1.5">
                      <i className={`fas ${syncIcon} ${syncColor}`} title={syncTitle}></i>
                      {t.date ? t.date.split(',')[0] : new Date(t.timestamp).toLocaleDateString('id-ID')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-extrabold text-sm text-gray-800 dark:text-gray-100">Rp {(t.total || 0).toLocaleString('id-ID')}</p>
                    <p className={`text-[10px] font-semibold mt-0.5 uppercase ${hasHutang ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}>
                      {t.method || 'TUNAI'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL STRUK (DIPANGGIL DARI KOMPONEN EXTERNAL) */}
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
