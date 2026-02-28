import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import Swal from 'sweetalert2';

export default function Table({ businessData, currentUser, onNavigate }) {
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const shopOwnerId = businessData?.ownerId || currentUser?.uid;

  // === MENGAMBIL DATA (REAL-TIME) ===
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

  // === FUNGSI EXPORT KE EXCEL (ASLI) ===
  const handleExportExcel = () => {
    if (transactions.length === 0) {
      return Swal.fire('Kosong', 'Tidak ada data untuk diekspor', 'info');
    }

    Swal.fire({ title: 'Menyiapkan Excel...', didOpen: () => Swal.showLoading() });

    try {
      // 1. Siapkan data mentah menjadi format baris Excel (SINKRON DENGAN V1)
      const excelData = transactions.map((t, index) => {
        const itemsText = t.items ? t.items.map(i => `${i.name} (${i.qty}x)`).join(', ') : 'Item Manual';
        const tgl = t.date || new Date(t.timestamp).toLocaleString('id-ID');
        
        return {
          "No": index + 1,
          "Tanggal": tgl,
          "Pelanggan": t.buyer || 'Pelanggan Umum', // 🔥 PERBAIKAN: Gunakan t.buyer
          "Item Dibeli": itemsText,
          "Total (Rp)": t.total || 0,
          "Sisa Hutang (Rp)": t.remaining || 0, // 🔥 TAMBAHAN: Kolom Hutang
          "Status Pembayaran": t.method || 'TUNAI', // 🔥 PERBAIKAN: Gunakan t.method
          "Kasir": t.operatorName || 'Admin' // 🔥 PERBAIKAN: Gunakan t.operatorName
        };
      });

      // 2. Buat Worksheet dan Workbook
      const worksheet = XLSX.utils.json_to_sheet(excelData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Riwayat Transaksi");

      // 3. Download File
      XLSX.writeFile(workbook, `Buku_Besar_${businessData?.shopName || 'ISZI'}_${new Date().toLocaleDateString('id-ID').replace(/\//g, '-')}.xlsx`);
      
      Swal.close();
    } catch (error) {
      Swal.fire('Error', 'Gagal membuat file Excel: ' + error.message, 'error');
    }
  };

  // === RENDER TAMPILAN ===
  return (
    <div className="flex flex-col h-screen bg-gray-50 text-gray-800">
      
      {/* HEADER TABEL */}
      <div className="bg-emerald-700 text-white p-4 shadow-md flex-none z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => onNavigate('lobby')} className="active:scale-90 transition p-1">
              <i className="fas fa-arrow-left text-xl"></i>
            </button>
            <h2 className="font-bold text-lg">Buku Besar Transaksi</h2>
          </div>
          <button 
            onClick={handleExportExcel} 
            className="bg-emerald-800 hover:bg-emerald-900 px-4 py-2 rounded-lg text-xs font-bold shadow flex items-center gap-2 active:scale-95 transition"
          >
            <i className="fas fa-file-excel"></i> Export Excel
          </button>
        </div>
      </div>

      {/* AREA TABEL */}
      <div className="flex-1 overflow-auto p-4 pb-24">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto hide-scrollbar">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-gray-100 text-gray-600 text-xs uppercase tracking-wider border-b border-gray-200">
                  <th className="p-3 font-bold w-12 text-center">No</th>
                  <th className="p-3 font-bold w-40">Tanggal</th>
                  <th className="p-3 font-bold w-40">Pelanggan</th>
                  <th className="p-3 font-bold">Item Dibeli</th>
                  <th className="p-3 font-bold w-32 text-right">Total</th>
                  <th className="p-3 font-bold w-32 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoading ? (
                  <tr>
                    <td colSpan="6" className="p-10 text-center text-gray-400 text-sm">
                      <i className="fas fa-circle-notch fa-spin mr-2"></i> Memuat data transaksi...
                    </td>
                  </tr>
                ) : transactions.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="p-10 text-center text-gray-400 text-sm italic">
                      Belum ada riwayat transaksi.
                    </td>
                  </tr>
                ) : (
                  transactions.map((t, index) => {
                    const hasHutang = (t.remaining || 0) > 0;
                    const tgl = t.date ? t.date.split(', ') : new Date(t.timestamp).toLocaleString('id-ID').split(', ');

                    return (
                      <tr key={t.id} className="hover:bg-emerald-50/50 transition duration-150">
                        <td className="p-3 text-sm text-center text-gray-500">{index + 1}</td>
                        <td className="p-3 text-xs text-gray-600">
                          <div className="font-bold text-gray-800">{tgl[0]}</div>
                          <div className="text-[10px]">{tgl[1] || ''}</div>
                        </td>
                        {/* 🔥 PERBAIKAN: Gunakan t.buyer */}
                        <td className="p-3 text-xs font-bold text-gray-800 uppercase">{t.buyer || 'Pelanggan Umum'}</td>
                        <td className="p-3">
                          {t.items && t.items.length > 0 ? (
                            t.items.map((i, idx) => (
                              <div key={idx} className="text-[11px] mb-0.5">
                                • {i.name} <span className="font-bold text-blue-600">(x{i.qty})</span>
                              </div>
                            ))
                          ) : (
                            <span className="italic text-gray-400 text-xs">Item Manual</span>
                          )}
                        </td>
                        <td className="p-3 text-xs font-extrabold text-gray-800 text-right whitespace-nowrap">
                          Rp {(t.total || 0).toLocaleString('id-ID')}
                        </td>
                        <td className="p-3 text-center whitespace-nowrap">
                          {/* 🔥 PERBAIKAN: Logika lunas / sisa hutang sesuai V1 */}
                          {hasHutang ? (
                             <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-[10px] font-bold block w-full">
                               HUTANG Rp {t.remaining.toLocaleString('id-ID')}
                             </span>
                          ) : (
                             <span className={`px-2 py-1 rounded text-[10px] font-bold block w-full ${t.method === 'QRIS' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>
                               {t.method === 'QRIS' ? 'LUNAS (QRIS)' : 'LUNAS (TUNAI)'}
                             </span>
                          )}
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
