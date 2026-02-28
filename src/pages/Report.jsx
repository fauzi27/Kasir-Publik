import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import Swal from 'sweetalert2';
import ReceiptModal from '../components/ReceiptModal';

// === IMPORT LIBRARY EXPORT ===
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';

export default function Report({ businessData, currentUser, onNavigate }) {
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [dateFilter, setDateFilter] = useState('today'); 
  const [customDate, setCustomDate] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('ALL'); 

  const [selectedTx, setSelectedTx] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const shopOwnerId = businessData?.ownerId || currentUser?.uid;
  
  // 🔥 CEK ROLE: Apakah yang login ini Kasir?
  const isKasir = businessData?.role === 'kasir';

  useEffect(() => {
    if (!shopOwnerId) return;
    const q = query(collection(db, "users", shopOwnerId, "transactions"), orderBy("timestamp", "desc"));
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTransactions(data);
      setIsLoading(false);
    });
    return () => unsub();
  }, [shopOwnerId]);

  const getFilteredTransactions = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterday = today - (24 * 60 * 60 * 1000);
    const sevenDaysAgo = today - (7 * 24 * 60 * 60 * 1000);
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    let filtered = transactions.filter(t => {
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

    if (paymentFilter === 'HUTANG') {
      filtered = filtered.filter(t => (t.remaining || 0) > 0);
    }
    return filtered;
  };

  const filteredData = getFilteredTransactions();

  // === KALKULASI DASBOR ===
  const totalOmzet = filteredData.reduce((sum, t) => sum + (t.total || 0), 0);
  const totalTunai = filteredData.reduce((sum, t) => {
    if (t.method === 'TUNAI') {
      const tunaiMurni = (t.total || 0) - (t.remaining || 0);
      return sum + (tunaiMurni > 0 ? tunaiMurni : 0);
    }
    return sum;
  }, 0);
  const totalQRIS = filteredData.reduce((sum, t) => sum + (t.method === 'QRIS' ? (t.total || 0) : 0), 0);
  const totalHutang = filteredData.reduce((sum, t) => sum + (t.remaining || (t.method === 'HUTANG' ? (t.total || 0) : 0)), 0);
  const totalTransaksi = filteredData.length;

  const handleDeleteTransaction = async (txId) => {
    Swal.fire({
      title: 'Hapus Transaksi?',
      text: "Data ini akan dihapus permanen dari laporan!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Ya, Hapus!',
      cancelButtonText: 'Batal'
    }).then(async (result) => {
      if (result.isConfirmed) {
        Swal.fire({ title: 'Menghapus...', didOpen: () => Swal.showLoading() });
        try {
           deleteDoc(doc(db, "users", shopOwnerId, "transactions", txId));
          setIsModalOpen(false);
          Swal.fire({ icon: 'success', title: 'Terhapus!', timer: 1200, showConfirmButton: false });
        } catch (error) {
          Swal.fire('Error', 'Gagal menghapus: ' + error.message, 'error');
        }
      }
    });
  };

  const handleMarkLunas = async (tx) => {
    Swal.fire({
      title: 'Pelanggan Bayar Lunas?',
      text: `Sisa hutang Rp ${(tx.remaining || 0).toLocaleString('id-ID')} akan dilunasi dan masuk ke Kas Tunai.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#10b981', 
      cancelButtonColor: '#d33',
      confirmButtonText: 'Ya, Lunas!',
      cancelButtonText: 'Batal'
    }).then(async (result) => {
      if (result.isConfirmed) {
        Swal.fire({ title: 'Memproses...', didOpen: () => Swal.showLoading() });
        try {
          const txRef = doc(db, "users", shopOwnerId, "transactions", tx.id);
           updateDoc(txRef, {
            remaining: 0,
            paid: tx.total,
            method: 'TUNAI' 
          });
          setIsModalOpen(false);
          Swal.fire({ icon: 'success', title: 'Hutang Lunas!', timer: 1500, showConfirmButton: false });
        } catch (error) {
          Swal.fire('Error', 'Gagal melunasi: ' + error.message, 'error');
        }
      }
    });
  };

  // FUNGSI EXPORT PDF 
  const exportToPDF = () => {
    if (filteredData.length === 0) return Swal.fire('Kosong', 'Tidak ada data untuk diekspor', 'warning');

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const shopName = businessData?.shopName || businessData?.name || "ISZI POS";
    const shopAddress = businessData?.shopAddress || businessData?.address || "Alamat Toko";

    doc.setFontSize(14);
    doc.text(shopName, 105, 10, { align: 'center' });
    doc.setFontSize(10);
    doc.text(shopAddress, 105, 17, { align: 'center' });
    
    let filterLabel = "Semua Waktu";
    if (dateFilter === 'today') filterLabel = "Hari Ini";
    if (dateFilter === 'yesterday') filterLabel = "Kemarin";
    if (dateFilter === '7days') filterLabel = "7 Hari Terakhir";
    if (dateFilter === 'month') filterLabel = "Bulan Ini";
    if (dateFilter === 'custom') filterLabel = customDate;

    doc.text("Laporan Penjualan - " + filterLabel, 105, 24, { align: 'center' });
    doc.text("Dicetak pada: " + new Date().toLocaleString('id-ID'), 105, 31, { align: 'center' });

    let yPos = 40;
    let grandTotal = 0;
    let isHutangFilter = paymentFilter === 'HUTANG';

    filteredData.forEach((trx, index) => {
      const calcTotal = isHutangFilter ? (trx.remaining || 0) : trx.total;
      grandTotal += calcTotal;
      const tgl = trx.date || new Date(trx.timestamp).toLocaleString('id-ID');

      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(`Transaksi #${index + 1}: ${tgl} - ${trx.buyer || 'Umum'}`, 10, yPos);
      yPos += 7;
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Metode: ${trx.method || '-'} | Total: Rp ${calcTotal.toLocaleString('id-ID')}`, 10, yPos);
      
      if ((trx.remaining || 0) > 0) {
        doc.text(`Dibayar: Rp ${(trx.paid || 0).toLocaleString('id-ID')} | Sisa Hutang: Rp ${(trx.remaining || 0).toLocaleString('id-ID')}`, 10, yPos + 5);
        if (isHutangFilter) {
          doc.text(`(Total Belanja Asli: Rp ${(trx.total || 0).toLocaleString('id-ID')})`, 10, yPos + 10);
          yPos += 5;
        }
      } else if (trx.method === 'TUNAI') {
        doc.text(`Dibayar: Rp ${(trx.paid || 0).toLocaleString('id-ID')} | Kembalian: Rp ${(trx.change || 0).toLocaleString('id-ID')}`, 10, yPos + 5);
      }
      yPos += 15;

      if (trx.items && trx.items.length > 0) {
        const itemData = trx.items.map(item => [
          item.name,
          item.qty,
          `Rp ${(item.price || 0).toLocaleString('id-ID')}`,
          `Rp ${((item.price || 0) * (item.qty || 0)).toLocaleString('id-ID')}`
        ]);
        doc.autoTable({
          head: [['Nama Item', 'Qty', 'Harga', 'Subtotal']],
          body: itemData,
          startY: yPos,
          margin: { left: 10, right: 10 },
          theme: 'grid',
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [100, 100, 100] },
          columnStyles: { 0: { cellWidth: 80 }, 1: { cellWidth: 20 }, 2: { cellWidth: 40 }, 3: { cellWidth: 40 } }
        });
        yPos = doc.lastAutoTable.finalY + 10;
      } else {
        doc.text("Tidak ada item detail.", 10, yPos);
        yPos += 10;
      }

      yPos += 5;
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }
    });

    doc.addPage();
    yPos = 20;
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Ringkasan", 10, yPos);
    yPos += 10;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Total Transaksi: ${filteredData.length}`, 10, yPos);
    yPos += 7;
    doc.text(`${isHutangFilter ? "Total Sisa Hutang" : "Omzet Keseluruhan"}: Rp ${grandTotal.toLocaleString('id-ID')}`, 10, yPos);

    doc.save(`Laporan_Penjualan_${filterLabel.replace(/\s+/g, '_')}.pdf`);
  };

  // FUNGSI EXPORT EXCEL 
  const exportToExcel = () => {
    if (filteredData.length === 0) return Swal.fire('Kosong', 'Tidak ada data', 'warning');
    
    const wb = XLSX.utils.book_new();
    const trxData = [['Tanggal', 'Pelanggan', 'Metode', 'Total/Sisa', 'Item Count']];
    
    filteredData.forEach(trx => {
      const calcValue = (paymentFilter === 'HUTANG') ? (trx.remaining || 0) : (trx.total || 0);
      const tgl = trx.date || new Date(trx.timestamp).toLocaleString('id-ID');
      trxData.push([tgl, trx.buyer || 'Umum', trx.method || '-', calcValue, trx.items ? trx.items.length : 0]);
    });
    
    const wsTrx = XLSX.utils.aoa_to_sheet(trxData);
    XLSX.utils.book_append_sheet(wb, wsTrx, 'Transaksi');
    
    const sumOmzet = filteredData.reduce((sum, trx) => sum + ((paymentFilter === 'HUTANG') ? (trx.remaining || 0) : (trx.total || 0)), 0);
    const avgTrx = filteredData.length > 0 ? sumOmzet / filteredData.length : 0;
    
    const sumData = [
      ['Label', 'Nilai'],
      ['Total Omzet/Sisa', sumOmzet],
      ['Rata-rata Transaksi', avgTrx.toFixed(0)],
      ['Jumlah Transaksi', filteredData.length]
    ];
    
    const wsSum = XLSX.utils.aoa_to_sheet(sumData);
    XLSX.utils.book_append_sheet(wb, wsSum, 'Ringkasan');
    
    XLSX.writeFile(wb, `Laporan_Penjualan_${new Date().getTime()}.xlsx`);
  };

  const openTransactionDetail = (tx) => {
    setSelectedTx(tx);
    setIsModalOpen(true);
  };

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
            <button onClick={exportToPDF} className="w-8 h-8 bg-purple-700 rounded-full flex items-center justify-center hover:bg-purple-600 transition shadow-sm"><i className="fas fa-file-pdf text-xs"></i></button>
            <button onClick={exportToExcel} className="w-8 h-8 bg-purple-700 rounded-full flex items-center justify-center hover:bg-purple-600 transition shadow-sm"><i className="fas fa-file-excel text-xs"></i></button>
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
          
          <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">
            {paymentFilter === 'HUTANG' ? 'Total Sisa Hutang' : 'Total Omzet Kotor'}
          </p>
          <h3 className={`text-3xl font-extrabold mb-4 ${paymentFilter === 'HUTANG' ? 'text-red-600' : 'text-gray-800'}`}>
            Rp {paymentFilter === 'HUTANG' ? totalHutang.toLocaleString('id-ID') : totalOmzet.toLocaleString('id-ID')}
          </h3>
          
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

        {/* HEADER DAFTAR TRANSAKSI + FILTER HUTANG */}
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-gray-800 text-sm">Rincian Transaksi</h3>
          <div className="bg-gray-200 rounded-lg p-1 flex gap-1 shadow-inner">
            <button 
              onClick={() => setPaymentFilter('ALL')} 
              className={`px-3 py-1 text-xs font-bold rounded-md transition ${paymentFilter === 'ALL' ? 'bg-white text-purple-700 shadow' : 'text-gray-500'}`}
            >
              Semua
            </button>
            <button 
              onClick={() => setPaymentFilter('HUTANG')} 
              className={`px-3 py-1 text-xs font-bold rounded-md transition flex items-center gap-1 ${paymentFilter === 'HUTANG' ? 'bg-red-500 text-white shadow' : 'text-gray-500'}`}
            >
              <i className="fas fa-exclamation-circle text-[10px]"></i> Hutang
            </button>
          </div>
        </div>

        {/* DAFTAR TRANSAKSI */}
        <div className="space-y-3">
          {isLoading ? (
             <div className="text-center mt-10 text-gray-400 text-xs"><i className="fas fa-circle-notch fa-spin"></i> Memuat Data...</div>
          ) : filteredData.length === 0 ? (
             <div className="text-center mt-6 text-gray-400 text-xs italic">
               {paymentFilter === 'HUTANG' ? 'Alhamdulillah, tidak ada yang ngutang di periode ini.' : 'Tidak ada transaksi di periode ini.'}
             </div>
          ) : (
            filteredData.map(t => {
              const hasHutang = (t.remaining || 0) > 0;
              return (
                <div 
                  key={t.id} 
                  onClick={() => openTransactionDetail(t)}
                  className={`bg-white p-3 rounded-xl shadow-sm border-l-4 cursor-pointer hover:bg-gray-50 active:scale-95 transition flex justify-between items-center ${hasHutang ? 'border-red-500' : t.method === 'QRIS' ? 'border-blue-500' : 'border-green-500'}`}
                >
                  <div>
                    <p className="font-bold text-sm text-gray-800 flex items-center gap-2">
                      {t.buyer || 'Pelanggan Umum'}
                      {hasHutang && <span className="bg-red-100 text-red-600 text-[9px] font-extrabold px-1.5 py-0.5 rounded">NGUTANG</span>}
                    </p>
                    <p className="text-[10px] text-gray-500 mt-0.5">{t.date || new Date(t.timestamp).toLocaleString('id-ID')}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-sm text-gray-800">Rp {(t.total || 0).toLocaleString('id-ID')}</p>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${hasHutang ? 'bg-red-100 text-red-700' : t.method === 'QRIS' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>
                      {hasHutang ? `Sisa: ${(t.remaining || 0).toLocaleString('id-ID')}` : (t.method || 'TUNAI')}
                    </span>
                  </div>
                </div>
              )
            })
          )}
        </div>

      </div>

      {/* MODAL STRUK DENGAN PROTEKSI HAPUS UNTUK KASIR */}
      <ReceiptModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        transaction={selectedTx}
        businessData={businessData}
        mode="view"
        // 🔥 HANYA ADMIN YANG BISA HAPUS TRANSAKSI
        onDelete={!isKasir ? handleDeleteTransaction : null} 
        // Kasir tetap bisa melunasi hutang
        onMarkLunas={handleMarkLunas} 
      />
      
    </div>
  );
}
