import React from 'react';
import Swal from 'sweetalert2';
import html2canvas from 'html2canvas';

export default function ReceiptModal({ 
  isOpen, 
  onClose, 
  transaction, 
  businessData, 
  mode, 
  onProcessPayment, 
  onDelete, // <--- Ini sekarang berfungsi sebagai onRefund
  onMarkLunas 
}) {
  if (!isOpen || !transaction) return null;

  const shopName = businessData?.shopName || businessData?.name || 'ISZI POS';
  const shopAddress = businessData?.shopAddress || businessData?.address || 'Nusadua Bali';
  
  // 🔥 Cek apakah ini struk yang sudah di-refund
  const isRefunded = transaction.status === 'REFUNDED';

  // === 1. GENERATE INVOICE ID ===
  const txTime = transaction.timestamp ? new Date(transaction.timestamp) : new Date();
  const dd = String(txTime.getDate()).padStart(2, '0');
  const mm = String(txTime.getMonth() + 1).padStart(2, '0');
  const yy = String(txTime.getFullYear()).slice(-2);
  const hh = String(txTime.getHours()).padStart(2, '0');
  const mins = String(txTime.getMinutes()).padStart(2, '0');
  const invoiceId = `INV-${dd}${mm}${yy}${hh}${mins}`;

  // === 2. HITUNG TOTAL ITEM ===
  const totalItemQty = transaction?.items?.reduce((sum, item) => sum + (item.qty || 1), 0) || 0;

  // === 3. FUNGSI BAGIKAN KE WHATSAPP ===
  const handleShareWA = async () => {
    const { value: waNumber } = await Swal.fire({
      title: 'Kirim Struk WA',
      input: 'text',
      inputLabel: 'Masukkan nomor WA (Awali dengan 62 atau 08)',
      inputPlaceholder: 'Contoh: 081234567890',
      showCancelButton: true,
      confirmButtonText: 'Kirim',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#22c55e'
    });

    if (!waNumber) return; 

    let cleanNumber = waNumber.replace(/\D/g, '');
    if (cleanNumber.startsWith('0')) cleanNumber = '62' + cleanNumber.substring(1);

    let text = `*STRUK PEMBELIAN - ${shopName.toUpperCase()}*\n`;
    text += `No: ${invoiceId}\n`;
    text += `Tgl: ${txTime.toLocaleString('id-ID')}\n`;
    text += `--------------------------------\n`;
    
    transaction.items?.forEach(i => {
      text += `${i.name}\n${i.qty} x Rp ${(i.price || 0).toLocaleString('id-ID')} = Rp ${((i.price || 0) * (i.qty || 0)).toLocaleString('id-ID')}\n`;
    });
    
    text += `--------------------------------\n`;
    text += `Total Item  : ${totalItemQty} Pcs\n`;
    text += `Total Harga : *Rp ${(transaction.total || 0).toLocaleString('id-ID')}*\n`;
    
    if (isRefunded) {
      text += `Status      : *❌ DIBATALKAN/REFUND*\n`;
      text += `Alasan      : ${transaction.refundReason}\n`;
    } else {
      text += `Status      : *${transaction.method || 'LUNAS'}*\n`;
      if ((transaction.remaining || 0) > 0) {
        text += `Sisa Hutang : Rp ${(transaction.remaining || 0).toLocaleString('id-ID')}\n`;
      }
    }
    text += `\nTerima kasih telah berbelanja!`;

    window.open(`https://wa.me/${cleanNumber}?text=${encodeURIComponent(text)}`, '_blank');
  };

  // === 4. FUNGSI SIMPAN STRUK MENJADI GAMBAR ===
  const handleDownloadReceipt = async () => {
    const receiptElement = document.getElementById('receipt-paper');
    if (!receiptElement) return;

    Swal.fire({ title: 'Menyimpan Struk...', didOpen: () => Swal.showLoading() });
    try {
      const canvas = await html2canvas(receiptElement, { scale: 2 });
      const image = canvas.toDataURL("image/png");
      const link = document.createElement('a');
      link.href = image;
      link.download = `Struk_${invoiceId}.png`;
      link.click();
      
      Swal.close();
      Swal.fire({ icon: 'success', title: 'Tersimpan', timer: 1200, showConfirmButton: false });
    } catch (error) {
      Swal.fire('Error', 'Gagal menyimpan struk: ' + error.message, 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in transition-colors duration-300">
      
      {/* KOTAK MODAL */}
      <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl w-full max-w-sm flex flex-col overflow-hidden shadow-2xl transition-colors duration-300 max-h-[95vh]">
        
        {/* HEADER MODAL */}
        <div className="bg-white dark:bg-gray-900 px-4 py-3 flex justify-between items-center border-b border-gray-200 dark:border-gray-700 flex-none transition-colors duration-300">
          <h3 className="font-bold text-gray-800 dark:text-gray-100">
            {mode === 'payment' ? 'Pilih Pembayaran' : 'Detail Transaksi'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-red-500 transition w-8 h-8 flex items-center justify-center rounded-full bg-gray-50 dark:bg-gray-800">
            <i className="fas fa-times"></i>
          </button>
        </div>

        {/* AREA KERTAS STRUK */}
        <div className="flex-1 overflow-y-auto p-4 bg-gray-200 dark:bg-gray-800 transition-colors duration-300 hide-scrollbar flex flex-col items-center">
          
          {/* 🔥 EFEK KERTAS PRINTER THERMAL (Shadow tebal & Border putus-putus bawah) */}
          <div id="receipt-paper" className={`bg-white text-gray-800 p-6 shadow-md relative overflow-hidden font-mono text-sm w-full max-w-[320px] border-b-[6px] border-dotted border-gray-300 ${isRefunded ? 'opacity-90' : ''}`}>
            
            {/* 🔥 STEMPEL REFUND RAKSASA */}
            {isRefunded && (
              <div className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center overflow-hidden">
                <div className="border-4 border-red-500 text-red-500 font-black text-3xl uppercase tracking-widest px-4 py-2 rounded-lg -rotate-[35deg] opacity-40">
                  DIBATALKAN
                </div>
              </div>
            )}

            {/* WATERMARK STEMPEL TOKO (Halus) */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-[0.02] z-0 overflow-hidden">
              <div className="-rotate-45 flex flex-col gap-5 w-[200%] items-center justify-center">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="flex gap-5 text-xs font-black uppercase whitespace-nowrap tracking-widest text-black">
                    {Array.from({ length: 8 }).map((_, j) => <span key={j}>{shopName}</span>)}
                  </div>
                ))}
              </div>
            </div>

            {/* KONTEN STRUK */}
            <div className="relative z-10">
              {/* Kop Surat */}
              <div className="text-center mb-5">
                <h2 className="font-extrabold text-2xl tracking-tight uppercase text-black">{shopName}</h2>
                <p className="text-[10px] text-gray-500 mt-1 leading-relaxed max-w-[200px] mx-auto">{shopAddress}</p>
              </div>

              {/* Info Transaksi */}
              <div className="border-t-2 border-b-2 border-dashed border-gray-300 py-2 mb-4 text-[10px] flex justify-between text-gray-600">
                <div>
                  <p>{txTime.toLocaleString('id-ID')}</p>
                  <p className="mt-0.5 font-bold text-gray-800">{invoiceId}</p>
                </div>
                <div className="text-right">
                  <p>Kasir: <span className="font-bold text-gray-800">{transaction.operatorName || 'Admin'}</span></p>
                  <p className="mt-0.5 uppercase">{transaction.buyer || 'Umum'}</p>
                </div>
              </div>

              {/* Daftar Item */}
              <div className="mb-4 min-h-[80px]">
                {transaction.items?.map((item, idx) => (
                  <div key={idx} className="mb-2.5 text-[11px]">
                    <p className="font-bold text-black">{item.name}</p>
                    <div className="flex justify-between text-gray-600 mt-0.5">
                      <span>{item.qty} x {parseInt(item.price || 0).toLocaleString('id-ID')}</span>
                      <span className="font-bold text-black">{(parseInt(item.price || 0) * parseInt(item.qty || 0)).toLocaleString('id-ID')}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* TOTAL HARGA */}
              <div className="border-t-2 border-dashed border-gray-300 pt-2 text-[11px]">
                <div className="flex justify-between text-gray-600 mb-1">
                  <span>Total Item:</span>
                  <span className="font-bold text-black">{totalItemQty} Pcs</span>
                </div>
                <div className="flex justify-between items-end my-2 bg-gray-50 p-1.5 rounded">
                  <span className="font-bold text-sm text-black">TOTAL</span>
                  <span className="font-extrabold text-xl tracking-tight text-black">Rp {(transaction.total || 0).toLocaleString('id-ID')}</span>
                </div>
              </div>

              {/* Detail Pembayaran (Rata Kanan Presisi) */}
              {mode === 'view' && (
                <div className="border-t-2 border-dashed border-gray-300 pt-3 mt-1 text-[11px]">
                  
                  {isRefunded ? (
                    // Tampilan Khusus Jika Struk Dibatalkan
                    <div className="bg-red-50 border border-red-200 p-2 rounded text-red-600">
                      <p className="font-bold uppercase text-[10px] mb-1">Alasan Pembatalan:</p>
                      <p className="text-xs">{transaction.refundReason || 'Dibatalkan oleh Admin'}</p>
                      {transaction.refundAt && (
                        <p className="text-[9px] mt-1 opacity-70">Waktu Batal: {new Date(transaction.refundAt).toLocaleString('id-ID')}</p>
                      )}
                    </div>
                  ) : (
                    // Tampilan Normal Lunas/Hutang
                    <>
                      <div className="flex justify-between mb-1.5">
                        <span className="text-gray-600">Metode:</span>
                        <span className="font-bold text-black uppercase">{transaction.method || 'TUNAI'}</span>
                      </div>
                      
                      {transaction.method !== 'HUTANG' && (
                        <>
                          <div className="flex justify-between mb-1.5 text-gray-600">
                            <span>Dibayar:</span>
                            <span className="font-bold text-black">{(transaction.paid || 0).toLocaleString('id-ID')}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Kembali:</span>
                            <span className="font-bold text-black">{(transaction.change || 0).toLocaleString('id-ID')}</span>
                          </div>
                        </>
                      )}

                      {transaction.remaining > 0 && (
                        <div className="flex justify-between mt-2 text-red-600 font-bold bg-red-50 border border-red-100 p-2 rounded">
                          <span>Sisa Hutang:</span>
                          <span>Rp {(transaction.remaining || 0).toLocaleString('id-ID')}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Footer Struk */}
              <div className="text-center mt-6 pt-3 border-t border-gray-200">
                <i className="fas fa-barcode text-3xl text-gray-800 mb-1 opacity-80"></i>
                <p className="text-[9px] text-gray-500 italic mt-1">Terima kasih atas kunjungan Anda</p>
              </div>
            </div>
          </div>
        </div>

        {/* FOOTER ACTION BUTTONS */}
        <div className="bg-white dark:bg-gray-900 p-4 border-t border-gray-200 dark:border-gray-700 flex-none transition-colors duration-300">
          
          {mode === 'payment' ? (
            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => onProcessPayment('TUNAI')} className="bg-green-500 hover:bg-green-600 text-white py-3.5 rounded-xl font-bold shadow-sm active:scale-95 transition flex flex-col items-center justify-center gap-1">
                <i className="fas fa-money-bill-wave text-lg"></i> <span className="text-[10px] uppercase tracking-wide">Tunai</span>
              </button>
              <button onClick={() => onProcessPayment('QRIS')} className="bg-blue-500 hover:bg-blue-600 text-white py-3.5 rounded-xl font-bold shadow-sm active:scale-95 transition flex flex-col items-center justify-center gap-1">
                <i className="fas fa-qrcode text-lg"></i> <span className="text-[10px] uppercase tracking-wide">QRIS</span>
              </button>
              <button onClick={() => onProcessPayment('HUTANG')} className="bg-red-500 hover:bg-red-600 text-white py-3.5 rounded-xl font-bold shadow-sm active:scale-95 transition flex flex-col items-center justify-center gap-1">
                <i className="fas fa-book-open text-lg"></i> <span className="text-[10px] uppercase tracking-wide">Hutang</span>
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-2">
                <button onClick={handleDownloadReceipt} className="bg-gray-800 hover:bg-gray-900 dark:bg-gray-700 dark:hover:bg-gray-600 text-white py-3 rounded-xl font-bold text-xs shadow-sm active:scale-95 transition flex items-center justify-center gap-2">
                  <i className="fas fa-download text-base"></i> Simpan
                </button>
                <button onClick={handleShareWA} className="bg-green-500 hover:bg-green-600 text-white py-3 rounded-xl font-bold text-xs shadow-sm active:scale-95 transition flex items-center justify-center gap-2">
                  <i className="fab fa-whatsapp text-base text-xl"></i> Kirim WA
                </button>
              </div>
              
              {!isRefunded && transaction.remaining > 0 && onMarkLunas && (
                <button onClick={() => onMarkLunas(transaction)} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold text-xs shadow-sm active:scale-95 transition flex items-center justify-center gap-2 mt-1">
                  <i className="fas fa-check-circle text-base"></i> Konfirmasi Pelunasan
                </button>
              )}
              
              {/* 🔥 TOMBOL REFUND DENGAN DESAIN BARU */}
              {onDelete && !isRefunded && (
                <button 
                  onClick={() => onDelete(transaction.id)}
                  className="w-full bg-transparent text-red-500 dark:text-red-400 border-2 border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-900/20 py-2.5 rounded-xl font-bold text-xs shadow-sm active:scale-95 transition flex items-center justify-center gap-2 mt-1"
                >
                  <i className="fas fa-ban"></i> Batalkan Transaksi (Refund)
                </button>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
