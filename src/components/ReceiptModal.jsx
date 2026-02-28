import { useState, useRef } from 'react';
import html2canvas from 'html2canvas';
import Swal from 'sweetalert2';

export default function ReceiptModal({ 
  isOpen, 
  onClose, 
  transaction, 
  businessData, 
  mode = 'payment', // 'payment' (kasir baru) atau 'view' (lihat riwayat)
  onProcessPayment,
  onDelete
}) {
  const [buyerWA, setBuyerWA] = useState('');
  const receiptRef = useRef(null);

  if (!isOpen || !transaction) return null;

  const items = transaction.items || [];
  const total = transaction.total || 0;
  
  // Baca 'date' bawaan v1, jika tidak ada gunakan timestamp
  const dateStr = transaction.date || (transaction.timestamp 
    ? new Date(transaction.timestamp).toLocaleString('id-ID') 
    : new Date().toLocaleString('id-ID'));

  // 🔥 PERBAIKAN 1: Logika Nama & Alamat Toko yang lebih kuat
  const shopName = businessData?.shopName || businessData?.name || 'ISZI POS';
  const shopAddress = businessData?.shopAddress || businessData?.address || 'Alamat Belum Diatur';

  // Ambil data nominal jika sudah diproses
  const paid = transaction.paid || 0;
  const change = transaction.change || 0;
  const remaining = transaction.remaining || 0;

  // === FUNGSI SIMPAN GAMBAR STRUK ===
  const saveReceiptImage = async () => {
    if (!receiptRef.current) return;
    
    Swal.fire({ title: 'Menyimpan Struk...', didOpen: () => Swal.showLoading() });
    try {
      const canvas = await html2canvas(receiptRef.current, { scale: 2, backgroundColor: '#ffffff' });
      const imgData = canvas.toDataURL('image/jpeg', 0.9);
      
      const link = document.createElement('a');
      link.download = `Nota_${shopName}_${Date.now()}.jpg`;
      link.href = imgData;
      link.click();
      
      Swal.close();
    } catch (error) {
      Swal.fire('Error', 'Gagal menyimpan gambar', 'error');
    }
  };

  // === FUNGSI KIRIM WA ===
  const sendToWA = () => {
    if (!buyerWA) return Swal.fire('Oops', 'Masukkan nomor WA pelanggan dulu', 'warning');
    
    let phone = buyerWA.replace(/\D/g, ''); 
    if (phone.startsWith('0')) phone = '62' + phone.slice(1); 

    let text = `*NOTA PEMBELIAN - ${shopName.toUpperCase()}*\n`;
    text += `📅 ${dateStr}\n`;
    text += `👤 Pelanggan: ${transaction.buyer || 'Umum'}\n`;
    text += `--------------------------------\n`;
    
    items.forEach(i => {
      text += `${i.name}\n${i.qty} x Rp ${i.price.toLocaleString('id-ID')} = Rp ${(i.qty * i.price).toLocaleString('id-ID')}\n`;
    });
    
    text += `--------------------------------\n`;
    text += `*TOTAL : Rp ${total.toLocaleString('id-ID')}*\n`;
    if (transaction.method) text += `METODE : ${transaction.method}\n`;
    
    // Tambahan detail bayar untuk WA
    if (transaction.method === 'TUNAI' && paid > 0) {
      text += `Bayar  : Rp ${paid.toLocaleString('id-ID')}\n`;
      text += `Kembali: Rp ${change.toLocaleString('id-ID')}\n`;
    }
    if (remaining > 0) {
      text += `Dibayar: Rp ${paid.toLocaleString('id-ID')}\n`;
      text += `*Sisa Hutang: Rp ${remaining.toLocaleString('id-ID')}*\n`;
    }

    text += `--------------------------------\n`;
    text += `Terima kasih atas kunjungannya! 🙏`;

    const encodedText = encodeURIComponent(text);
    window.open(`https://wa.me/${phone}?text=${encodedText}`, '_blank');
  };

  // === RENDER TAMPILAN ===
  return (
    <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* HEADER MODAL */}
        <div className="bg-gray-100 p-3 flex justify-between items-center border-b flex-none">
          <h3 className="font-bold text-gray-700">
            <i className="fas fa-receipt mr-2 text-blue-500"></i>
            {mode === 'payment' ? 'Pilih Pembayaran' : 'Detail Transaksi'}
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-red-500 p-2 active:scale-90 transition">
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>

        {/* KERTAS STRUK (Area yang akan difoto) */}
        <div className="p-6 overflow-y-auto bg-white flex-1 relative hide-scrollbar">
          <div ref={receiptRef} className="font-mono text-sm text-gray-800 bg-white p-4 border border-gray-200 shadow-sm rounded">
            <div className="text-center mb-4 border-b-2 border-dashed border-gray-400 pb-4">
              <h2 className="font-extrabold text-lg">{shopName}</h2>
              <p className="text-[10px] text-gray-500">{shopAddress}</p>
            </div>
            
            <div className="text-[10px] mb-4 border-b border-dashed border-gray-300 pb-2">
              <div className="flex justify-between"><span>Tgl:</span> <span>{dateStr}</span></div>
              <div className="flex justify-between"><span>Plg:</span> <span className="font-bold">{transaction.buyer || 'Umum'}</span></div>
              <div className="flex justify-between"><span>Kasir:</span> <span>{transaction.operatorName || 'Admin'}</span></div>
            </div>

            <div className="mb-4">
              {items.map((item, idx) => (
                <div key={idx} className="mb-2">
                  <div className="font-bold text-xs">{item.name}</div>
                  <div className="flex justify-between text-[11px]">
                    <span>{item.qty} x {item.price.toLocaleString('id-ID')}</span>
                    <span>{(item.qty * item.price).toLocaleString('id-ID')}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t-2 border-dashed border-gray-400 pt-2 text-right">
              <div className="flex justify-between font-bold text-sm">
                <span>TOTAL:</span>
                <span>Rp {total.toLocaleString('id-ID')}</span>
              </div>
              
              {/* 🔥 PERBAIKAN 2: Render Nominal Kembalian & Hutang */}
              {transaction.method && (
                <div className="flex justify-between font-bold text-[10px] mt-1 text-gray-500">
                  <span>METODE:</span>
                  <span>{transaction.method}</span>
                </div>
              )}
              
              {transaction.method === 'TUNAI' && paid > 0 && remaining === 0 && (
                <div className="mt-2 pt-2 border-t border-dashed border-gray-200">
                  <div className="flex justify-between text-xs">
                    <span>Bayar:</span>
                    <span>Rp {paid.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between text-xs font-bold mt-0.5">
                    <span>Kembali:</span>
                    <span>Rp {change.toLocaleString('id-ID')}</span>
                  </div>
                </div>
              )}

              {remaining > 0 && (
                <div className="mt-2 pt-2 border-t border-dashed border-gray-200">
                  <div className="flex justify-between text-xs">
                    <span>Dibayar:</span>
                    <span>Rp {paid.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between text-xs font-bold text-red-600 mt-0.5">
                    <span>Sisa Hutang:</span>
                    <span>Rp {remaining.toLocaleString('id-ID')}</span>
                  </div>
                </div>
              )}
            </div>
            
            <div className="text-center mt-6 text-[9px] text-gray-400 italic">
              * Terima Kasih *<br/>Aplikasi Kasir ISZI
            </div>
          </div>
        </div>
        
        {/* FOOTER AKSI (Berubah tergantung Mode) */}
        {mode === 'payment' ? (
          <div className="p-4 bg-gray-50 border-t grid grid-cols-3 gap-3 flex-none pb-safe">
            <button onClick={() => onProcessPayment('TUNAI')} className="bg-green-100 border border-green-500 text-green-700 py-3 rounded-lg font-bold hover:bg-green-200 flex flex-col items-center active:scale-95 transition">
              <span>TUNAI</span> <span className="text-[10px] font-normal">Cash</span>
            </button>
            <button onClick={() => onProcessPayment('HUTANG')} className="bg-red-100 border border-red-500 text-red-700 py-3 rounded-lg font-bold hover:bg-red-200 flex flex-col items-center active:scale-95 transition">
              <span>HUTANG</span> <span className="text-[10px] font-normal">Bon/Credit</span>
            </button>
            <button onClick={() => onProcessPayment('QRIS')} className="bg-purple-100 border border-purple-500 text-purple-700 py-3 rounded-lg font-bold hover:bg-purple-200 flex flex-col items-center active:scale-95 transition">
              <span>QRIS</span> <span className="text-[10px] font-normal">Scan/Digital</span>
            </button>
          </div>
        ) : (
          <div className="p-4 bg-gray-50 border-t flex flex-col gap-2 flex-none pb-safe">
            <input 
              type="tel" 
              value={buyerWA} 
              onChange={(e) => setBuyerWA(e.target.value)} 
              placeholder="No. WA Pelanggan (Cth: 0812...)" 
              className="w-full p-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-green-500 mb-1"
            />
            <div className="grid grid-cols-2 gap-2">
              <button onClick={sendToWA} className="bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 flex items-center justify-center gap-2 shadow-sm active:scale-95 transition text-sm">
                <i className="fab fa-whatsapp text-lg"></i> Kirim WA
              </button>
              <button onClick={saveReceiptImage} className="bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 flex items-center justify-center gap-2 shadow-sm active:scale-95 transition text-sm">
                <i className="fas fa-download"></i> Simpan
              </button>
            </div>
            {/* Tombol Hapus Transaksi (Hanya Admin) */}
            {onDelete && (
              <button onClick={() => onDelete(transaction.id)} className="w-full mt-1 bg-red-50 text-red-600 border border-red-200 py-2 rounded-lg font-bold hover:bg-red-100 flex items-center justify-center gap-2 active:scale-95 transition text-sm">
                <i className="fas fa-trash-alt"></i> Hapus Transaksi
              </button>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
