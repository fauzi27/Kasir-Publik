import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import Swal from 'sweetalert2';

export default function Report({ businessData, currentUser, onNavigate }) {
  // === STATE DATA ===
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // === STATE FILTER ===
  const [dateFilter, setDateFilter] = useState('today'); // today, yesterday, 7days, month, custom
  const [customDate, setCustomDate] = useState('');
  
  const shopOwnerId = businessData?.ownerId || currentUser?.uid;

  // === MENGAMBIL DATA TRANSAKSI (REAL-TIME) ===
  useEffect(() => {
    if (!shopOwnerId) return;

    // Mengambil transaksi dan mengurutkannya dari yang terbaru
    const q = query(collection(db, "users", shopOwnerId, "transactions"), orderBy("timestamp", "desc"));
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTransactions(data);
      setIsLoading(false);
    });

    return () => unsub();
  }, [shopOwnerId]);

  // === LOGIKA FILTER TANGGAL ===
  const getFilteredTransactions = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterday = today - (24 * 60 * 60 * 1000);
    const sevenDaysAgo = today - (7 * 24 * 60 * 60 * 1000);
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    return transactions.filter(t => {
      const tTime = t.timestamp || 0;
      if (dateFilter === 'today') return tTime >= today;
      if (dateFilter === 'yesterday') return tTime >= yesterday && tTime < today;
      if (dateFilter === '7days') return tTime >= sevenDaysAgo;
      if (dateFilter === 'month') return tTime >= firstDayOfMonth;
      if (dateFilter === 'custom' && customDate) {
        const selected = new Date(customDate).getTime();
        const nextDay = selected + (24 * 60 * 60 * 1000);
        return tTime >= selected && tTime < nextDay;
      }
      return true;
    });
  };

  const filteredData = getFilteredTransactions();

  // === KALKULASI OTOMATIS (SINKRON DENGAN RUMUS V1) ===
  const totalOmzet = filteredData.reduce((sum, t) => sum + (t.total || 0), 0);
  
  // 🔥 PERBAIKAN: Hitung Tunai Murni (Total kurangi hutang jika ada)
  const totalTunai = filteredData.reduce((sum, t) => {
    if (t.method === 'TUNAI') {
      const tunaiMurni = (t.total || 0) - (t.remaining || 0);
      return sum + (tunaiMurni > 0 ? tunaiMurni : 0);
    }
    return sum;
  }, 0);

  // 🔥 PERBAIKAN: Gunakan key t.method dan t.remaining
  const totalQRIS = filteredData.reduce((sum, t) => sum + (t.method === 'QRIS' ? (t.total || 0) : 0), 0);
  const totalHutang = filteredData.reduce((sum, t) => sum + (t.remaining || (t.method === 'HUTANG' ? (t.total || 0) : 0)), 0);
  
  const totalTransaksi = filteredData.length;

  // === MOCKUP EXPORT (Bisa diaktifkan nanti) ===
  const handleExport = (type) => {
    Swal.fire('Info', `Fitur Export ${type} sedang dipersiapkan untuk React!`, 'info');
  };

  // === RENDER TAMPILAN ===
  return (
    <div className="flex flex-col h-screen bg-gray-50 text-gray-800">
      
      {/* HEADER LAPORAN */}
      <div className="bg-purple-800 text-white p-4 shadow-md flex-none z-10 rounded-b-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button onClick={() => onNavigate('lobby')} className="active:scale-90 transition p-1">
              <i className="fas fa-arrow-left text-xl"></i>
            </button>
            <h2 className="font-bold text-lg">Dashboard Analitik</h2>
          </div>
          <div className="flex gap-2">
            <button onClick={() => handleExport('PDF')} className="w-8 h-8 bg-purple-700 rounded-full flex items-center justify-center hover:bg-purple-600 transition"><i className="fas fa-file-pdf text-xs"></i></button>
            <button onClick={() => handleExport('Excel')} className="w-8 h-8 bg-purple-700 rounded-full flex items-center justify-center hover:bg-purple-600 transition"><i className="fas fa-file-excel text-xs"></i></button>
          </div>
        </div>
        
        {/* FILTER TANGGAL */}
        <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar">
          <button onClick={() => setDateFilter('today')} className={`px-4 py-1.5 rounded-full text-xs font-bold border transition whitespace-nowrap shadow-sm ${dateFilter === 'today' ? 'border-purple-400 bg-white text-purple-800' : 'border-purple-400 bg-purple-700 text-purple-100'}`}>Hari Ini</button>
          <button onClick={() => setDateFilter('yesterday')} className={`px-4 py-1.5 rounded-full text-xs font-bold border transition whitespace-nowrap ${dateFilter === 'yesterday' ? 'border-purple-400 bg-white text-purple-800' : 'border-purple-400 bg-purple-700 text-purple-100'}`}>Kemarin</button>
          <button onClick={() => setDateFilter('7days')} className={`px-4 py-1.5 rounded-full text-xs font-bold border transition whitespace-nowrap ${dateFilter === '7days' ? 'border-purple-400 bg-white text-purple-800' : 'border-purple-400 bg-purple-700 text-purple-100'}`}>7 Hari Terakhir</button>
          <button onClick={() => setDateFilter('month')} className={`px-4 py-1.5 rounded-full text-xs font-bold border transition whitespace-nowrap ${dateFilter === 'month' ? 'border-purple-400 bg-white text-purple-800' : 'border-purple-400 bg-purple-700 text-purple-100'}`}>Bulan Ini</button>
          <div className="relative flex-none">
            <input type="date" value={customDate} onChange={(e) => { setCustomDate(e.target.value); setDateFilter('custom'); }} className="absolute opacity-0 w-full h-full cursor-pointer" />
            <button className={`px-4 py-1.5 rounded-full text-xs font-bold border transition whitespace-nowrap flex items-center gap-1 ${dateFilter === 'custom' ? 'border-purple-400 bg-white text-purple-800' : 'border-purple-400 bg-purple-700 text-purple-100'}`}>
              <i className="fas fa-calendar-alt"></i> Pilih Tgl
            </button>
          </div>
        </div>
      </div>

      {/* KONTEN LAPORAN */}
      <div className="flex-1 overflow-y-auto p-4 pb-24">
        
        {/* KARTU OMZET UTAMA */}
        <div className="bg-white rounded-2xl shadow-lg p-5 mb-6 border border-gray-100 relative overflow-hidden">
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-gradient-to-br from-purple-100 to-blue-50 rounded-full opacity-50"></div>
          
          <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">Total Omzet Kotor</p>
          <h3 className="text-3xl font-extrabold text-gray-800 mb-4">Rp {totalOmzet.toLocaleString('id-ID')}</h3>
          
          <div className="grid grid-cols-2 gap-4 border-t border-gray-100 pt-4">
            <div>
              <p className="text-[10px] text-gray-400 font-semibold mb-1"><i className="fas fa-money-bill-wave text-green-500 mr-1"></i> Masuk Tunai</p>
              <p className="font-bold text-sm text-gray-700">Rp {totalTunai.toLocaleString('id-ID')}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 font-semibold mb-1"><i className="fas fa-qrcode text-blue-500 mr-1"></i> Masuk QRIS</p>
              <p className="font-bold text-sm text-gray-700">Rp {totalQRIS.toLocaleString('id-ID')}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 font-semibold mb-1"><i className="fas fa-book-open text-red-500 mr-1"></i> Sisa Hutang</p>
              <p className="font-bold text-sm text-red-600">Rp {totalHutang.toLocaleString('id-ID')}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 font-semibold mb-1"><i className="fas fa-receipt text-purple-500 mr-1"></i> Jml Transaksi</p>
              <p className="font-bold text-sm text-gray-700">{totalTransaksi} Nota</p>
            </div>
          </div>
        </div>

        {/* DAFTAR TRANSAKSI */}
        <h3 className="font-bold text-gray-800 text-sm mb-3">Rincian Transaksi</h3>
        <div className="space-y-3">
          {isLoading ? (
             <div className="text-center mt-10 text-gray-400 text-xs"><i className="fas fa-circle-notch fa-spin"></i> Memuat Data...</div>
          ) : filteredData.length === 0 ? (
             <div className="text-center mt-6 text-gray-400 text-xs italic">Tidak ada transaksi di periode ini.</div>
          ) : (
            filteredData.map(t => (
              <div key={t.id} className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center">
                <div>
                  {/* 🔥 PERBAIKAN: Gunakan t.buyer dan t.date agar sinkron dengan v1 */}
                  <p className="font-bold text-sm text-gray-800">{t.buyer || 'Pelanggan Umum'}</p>
                  <p className="text-[10px] text-gray-500">{t.date || new Date(t.timestamp).toLocaleString('id-ID')}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-sm text-blue-700">Rp {(t.total || 0).toLocaleString('id-ID')}</p>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${t.method === 'TUNAI' ? 'bg-green-100 text-green-700' : t.method === 'QRIS' ? 'bg-purple-100 text-purple-700' : 'bg-red-100 text-red-700'}`}>
                    {t.method || 'TUNAI'}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
}
