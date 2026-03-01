import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot, doc, deleteDoc, updateDoc } from 'firebase/firestore';
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
  const [filterMode, setFilterMode] = useState('daily'); // 'daily', 'weekly', 'monthly'
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

  // === MENGHITUNG 4 METRIK UTAMA V1 ===
  let totalPenjualan = 0;
  let totalTunai = 0;
  let totalQRIS = 0;
  let totalHutang = 0;

  filteredData.forEach(t => {
    totalPenjualan += (t.total || 0);
    totalHutang += (t.remaining || 0);
    
    const methodStr = (t.method || '').toUpperCase();
    if (methodStr.includes('TUNAI')) {
      totalTunai += (t.paid || 0);
    } else if (methodStr.includes('QRIS')) {
      totalQRIS += (t.paid || 0);
    }
  });

  // === FUNGSI EXPORT NATIVE PDF (Print to PDF) ===
  const handleExportPDF = () => {
    if (filteredData.length === 0) return Swal.fire('Kosong', 'Tidak ada data untuk diekspor', 'info');

    const printWindow = window.open('', '_blank');
    const shopName = businessData?.shopName || 'ISZI POS';
    
    let timeLabel = filterDate;
    if (filterMode === 'weekly') timeLabel = `Minggu ${filterWeek}`;
    if (filterMode === 'monthly') timeLabel = `Bulan ${filterMonth}`;

    let html = `
      <html>
      <head>
        <title>Laporan_${timeLabel}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
          h2 { text-align: center; margin-bottom: 5px; }
          p.subtitle { text-align: center; margin-top: 0; color: #666; margin-bottom: 30px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 12px; }
          th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
          th { background-color: #f4f4f4; font-weight: bold; }
          .summary-box { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 15px; }
          .card { border: 1px solid #ddd; padding: 15px; width: 22%; border-radius: 8px; background: #fafafa; }
          .card h4 { margin: 0 0 10px 0; font-size: 12px; color: #666; }
          .card h3 { margin: 0; font-size: 18px; color: #111; }
        </style>
      </head>
      <body>
        <h2>LAPORAN PENJUALAN - ${shopName.toUpperCase()}</h2>
        <p class="subtitle">Periode: ${timeLabel.toUpperCase()}</p>
        
        <div class="summary-box">
          <div class="card"><h4>TOTAL PENJUALAN</h4><h3>Rp ${totalPenjualan.toLocaleString('id-ID')}</h3></div>
          <div class="card"><h4>TOTAL TUNAI</h4><h3>Rp ${totalTunai.toLocaleString('id-ID')}</h3></div>
          <div class="card"><h4>TOTAL QRIS</h4><h3>Rp ${totalQRIS.toLocaleString('id-ID')}</h3></div>
          <div class="card"><h4>TOTAL PIUTANG</h4><h3>Rp ${totalHutang.toLocaleString('id-ID')}</h3></div>
        </div>

        <h3 style="margin-top:40px; font-size:14px;">Detail Transaksi</h3>
        <table>
          <tr>
            <th>Waktu</th>
            <th>Pelanggan</th>
            <th>Metode</th>
            <th>Total Tagihan</th>
            <th>Dibayar</th>
            <th>Hutang</th>
          </tr>
          ${filteredData.map(t => `
            <tr>
              <td>${t.date || new Date(t.timestamp).toLocaleString('id-ID')}</td>
              <td>${t.buyer || 'Umum'}</td>
              <td>${t.method || '-'}</td>
              <td>Rp ${(t.total || 0).toLocaleString('id-ID')}</td>
              <td>Rp ${(t.paid || 0).toLocaleString('id-ID')}</td>
              <td style="color:${(t.remaining || 0) > 0 ? 'red' : 'black'}">Rp ${(t.remaining || 0).toLocaleString('id-ID')}</td>
            </tr>
          `).join('')}
        </table>
        
        <script>
          window.onload = function() { window.print(); window.close(); }
        </script>
      </body>
      </html>
    `;
    
    printWindow.document.write(html);
    printWindow.document.close();
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
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Ya, Hapus'
    }).then((result) => {
      if (result.isConfirmed) {
        deleteDoc(doc(db, "users", shopOwnerId, "transactions", id)).catch(() => {});
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
          <h2 className="font-bold text-gray-700 dark:text-gray-200 text-base">Laporan Penjualan</h2>
        </div>
        
        {/* TOMBOL EXPORT PDF */}
        {!isKasir && (
          <button onClick={handleExportPDF} className="text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 active:scale-95 border border-red-200 dark:border-red-800 transition">
            <i className="fas fa-file-pdf text-sm"></i> <span className="hidden sm:inline">Export PDF</span>
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 hide-scrollbar">
        
        {/* KARTU 4 METRIK V1 */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-white dark:bg-gray-800 border border-blue-100 dark:border-gray-700 rounded-2xl p-3 shadow-sm flex flex-col justify-center border-l-4 border-l-blue-500">
            <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase mb-0.5">Total Penjualan</p>
            <h3 className="text-sm md:text-base font-extrabold text-blue-600 dark:text-blue-400">Rp {totalPenjualan.toLocaleString('id-ID')}</h3>
          </div>
          <div className="bg-white dark:bg-gray-800 border border-green-100 dark:border-gray-700 rounded-2xl p-3 shadow-sm flex flex-col justify-center border-l-4 border-l-green-500">
            <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase mb-0.5">Tunai</p>
            <h3 className="text-sm md:text-base font-extrabold text-green-600 dark:text-green-400">Rp {totalTunai.toLocaleString('id-ID')}</h3>
          </div>
          <div className="bg-white dark:bg-gray-800 border border-indigo-100 dark:border-gray-700 rounded-2xl p-3 shadow-sm flex flex-col justify-center border-l-4 border-l-indigo-500">
            <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase mb-0.5">QRIS</p>
            <h3 className="text-sm md:text-base font-extrabold text-indigo-600 dark:text-indigo-400">Rp {totalQRIS.toLocaleString('id-ID')}</h3>
          </div>
          <div className="bg-white dark:bg-gray-800 border border-red-100 dark:border-gray-700 rounded-2xl p-3 shadow-sm flex flex-col justify-center border-l-4 border-l-red-500">
            <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase mb-0.5">Piutang</p>
            <h3 className="text-sm md:text-base font-extrabold text-red-600 dark:text-red-400">Rp {totalHutang.toLocaleString('id-ID')}</h3>
          </div>
        </div>

        {/* ALAT PENCARIAN & FILTER */}
        <div className="bg-white dark:bg-gray-800 p-3 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 mb-4 transition-colors">
          
          <div className="relative mb-3">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <i className="fas fa-search text-gray-400"></i>
            </div>
            <input 
              type="text" 
              placeholder="Cari pelanggan, metode..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-xl text-sm outline-none focus:ring-1 focus:ring-blue-500 dark:text-white transition"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <select 
              value={filterMode} 
              onChange={(e) => setFilterMode(e.target.value)}
              className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-xs rounded-xl px-2 py-2 outline-none"
            >
              <option value="daily">Harian</option>
              <option value="weekly">Mingguan</option>
              <option value="monthly">Bulanan</option>
            </select>

            {filterMode === 'daily' && (
              <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="flex-1 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-xs rounded-xl px-2 py-2 outline-none" />
            )}
            {filterMode === 'weekly' && (
              <input type="week" value={filterWeek} onChange={e => setFilterWeek(e.target.value)} className="flex-1 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-xs rounded-xl px-2 py-2 outline-none" />
            )}
            {filterMode === 'monthly' && (
              <input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="flex-1 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-xs rounded-xl px-2 py-2 outline-none" />
            )}

            <button 
              onClick={() => setFilterDebtOnly(!filterDebtOnly)}
              className={`px-3 py-2 rounded-xl text-xs font-bold border transition ${filterDebtOnly ? 'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/30 dark:border-red-800' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600'}`}
            >
              <i className={`fas fa-book-open ${filterDebtOnly ? 'text-red-500' : ''}`}></i>
            </button>
          </div>
        </div>

        {/* DAFTAR TRANSAKSI (Dengan Lampu) */}
        {isLoading ? (
          <div className="flex justify-center items-center h-32">
            <i className="fas fa-circle-notch fa-spin text-3xl text-blue-500"></i>
          </div>
        ) : filteredData.length === 0 ? (
          <div className="text-center mt-8 text-gray-400 dark:text-gray-500 opacity-70">
            <i className="fas fa-folder-open text-4xl mb-3"></i>
            <p className="text-sm">Data tidak ditemukan</p>
          </div>
        ) : (
          <div className="space-y-3 pb-6">
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-2 pl-1">Total {filteredData.length} transaksi</p>
            
            {filteredData.map(t => {
              const hasHutang = (t.remaining || 0) > 0;
              let syncColor = 'text-green-500'; 
              let syncIcon = 'fa-check-circle'; 
              let syncTitle = 'Tersimpan';

              if (t.isPending) {
                if (isOnline) {
                  syncColor = 'text-yellow-500 animate-spin'; syncIcon = 'fa-sync-alt'; syncTitle = 'Mengunggah...';
                } else {
                  syncColor = 'text-red-500'; syncIcon = 'fa-exclamation-circle'; syncTitle = 'Menunggu Internet';
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
                      {t.buyer || 'Umum'}
                      {hasHutang && <span className="bg-red-100 text-red-600 text-[9px] font-extrabold px-1.5 py-0.5 rounded flex-none">NGUTANG</span>}
                    </p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-1.5 truncate">
                      <i className={`fas ${syncIcon} ${syncColor}`} title={syncTitle}></i>
                      {t.date ? t.date.split(',')[0] : new Date(t.timestamp).toLocaleDateString('id-ID')}
                    </p>
                  </div>
                  <div className="text-right flex-none">
                    <p className="font-extrabold text-sm text-gray-800 dark:text-gray-100">Rp {(t.total || 0).toLocaleString('id-ID')}</p>
                    <p className={`text-[10px] font-bold mt-0.5 uppercase tracking-wide ${hasHutang ? 'text-red-500' : 'text-gray-500 dark:text-gray-400'}`}>
                      {t.method || 'TUNAI'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ReceiptModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} transaction={selectedTransaction} businessData={businessData} mode="view" onDelete={!isKasir ? handleDelete : null} onMarkLunas={handleMarkLunas} />
    </div>
  );
}
