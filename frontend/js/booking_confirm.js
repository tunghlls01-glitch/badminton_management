/**
 * ============================================================================
 * RK BADMINTON — BOOKING CONFIRMATION PAGE LOGIC (WITH QR & RECEIPT UPLOAD)
 * ============================================================================
 */

let confirmTimerInterval = null;
let uploadedReceiptFile = null;

function formatCurrencyVND(amount) {
  return amount.toLocaleString('vi-VN') + 'đ';
}

function redirectToGrid() {
  sessionStorage.removeItem('rk_hold_session');
  window.location.href = './timeline_grid.html';
}

function initConfirmPage() {
  const rawSession = sessionStorage.getItem('rk_hold_session');
  if (!rawSession) {
    alert('Không tìm thấy phiên giữ chỗ hợp lệ. Vui lòng chọn lại sân!');
    redirectToGrid();
    return;
  }

  const holdSession = JSON.parse(rawSession);
  const expireTime = new Date(holdSession.holdUntil).getTime();

  // Kiểm tra ngay lúc mở trang xem thời gian giữ chỗ đã hết chưa
  if (expireTime <= Date.now()) {
    sessionStorage.removeItem('rk_hold_session');
    document.getElementById('confirmExpiredModal').classList.add('open');
    return;
  }

  // Render thông tin ngày & danh sách khung giờ đang giữ
  document.getElementById('confirmDate').textContent =
    `${holdSession.date.fullLabel} (${holdSession.date.shortLabel})`;

  document.getElementById('confirmSlotList').innerHTML = holdSession.grouped
    .map(
      (g) => `
      <div class="summary-row">
        <span><strong>${g.courtName}</strong> (${g.startTime} – ${g.endTime})</span>
        <strong>${formatCurrencyVND(g.totalPrice)}</strong>
      </div>
    `
    )
    .join('');

  const formattedTotal = formatCurrencyVND(holdSession.totalPrice);
  document.getElementById('confirmTotalPrice').textContent = formattedTotal;

  // Cập nhật số tiền & mã nội dung chuyển khoản bên khung QR
  document.getElementById('qrTransferAmount').textContent = formattedTotal;
  const shortHoldCode = String(holdSession.holdId || 'RK2026').slice(-6);
  document.getElementById('qrTransferNote').textContent = `RK DATSAN ${shortHoldCode}`;

  // Tiếp tục chạy đồng hồ đếm ngược 10 phút
  const countdownEl = document.getElementById('confirmCountdown');

  function updateCountdown() {
    const remainingMs = expireTime - Date.now();
    if (remainingMs <= 0) {
      clearInterval(confirmTimerInterval);
      countdownEl.textContent = '00:00';
      sessionStorage.removeItem('rk_hold_session');
      document.getElementById('confirmExpiredModal').classList.add('open');
      return;
    }

    const totalSec = Math.floor(remainingMs / 1000);
    const minutes = String(Math.floor(totalSec / 60)).padStart(2, '0');
    const seconds = String(totalSec % 60).padStart(2, '0');
    countdownEl.textContent = `${minutes}:${seconds}`;
    countdownEl.classList.toggle('urgent', totalSec <= 60);
  }

  updateCountdown();
  confirmTimerInterval = setInterval(updateCountdown, 1000);

  // Xử lý ẩn/hiện khối QR khi đổi phương thức thanh toán
  const paymentSelect = document.getElementById('paymentMethod');
  const bankTransferSection = document.getElementById('bankTransferSection');

  paymentSelect.addEventListener('change', () => {
    const isBanking = paymentSelect.value === 'banking';
    bankTransferSection.classList.toggle('hidden', !isBanking);
  });

  // Xử lý chọn ảnh & xem trước ảnh minh chứng chuyển khoản
  const receiptInput = document.getElementById('receiptImageInput');
  const uploadPlaceholder = document.getElementById('uploadPlaceholder');
  const uploadPreviewBox = document.getElementById('uploadPreviewBox');
  const receiptPreviewImg = document.getElementById('receiptPreviewImg');
  const receiptFileName = document.getElementById('receiptFileName');
  const btnRemoveReceipt = document.getElementById('btnRemoveReceipt');

  receiptInput.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Vui lòng chỉ chọn tệp hình ảnh (PNG, JPG, JPEG)!');
      receiptInput.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('Dung lượng ảnh tối đa 5MB. Vui lòng chọn ảnh nhẹ hơn!');
      receiptInput.value = '';
      return;
    }

    uploadedReceiptFile = file;
    receiptFileName.textContent = file.name;

    const reader = new FileReader();
    reader.onload = (ev) => {
      receiptPreviewImg.src = ev.target.result;
      uploadPlaceholder.classList.add('hidden');
      uploadPreviewBox.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
  });

  // Xóa ảnh đã chọn
  btnRemoveReceipt.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    uploadedReceiptFile = null;
    receiptInput.value = '';
    receiptPreviewImg.src = '';
    uploadPreviewBox.classList.add('hidden');
    uploadPlaceholder.classList.remove('hidden');
  });

  // Quay lại lưới (vẫn bảo toàn phiên giữ chỗ nếu chưa hết giờ)
  document.getElementById('btnBackToGrid').addEventListener('click', () => {
    window.location.href = './timeline_grid.html';
  });

  // Quay lại lưới từ modal hết giờ
  document.getElementById('btnReturnToGrid').addEventListener('click', redirectToGrid);

  // Submit hoàn tất đặt sân
  document.getElementById('confirmBookingForm').addEventListener('submit', (e) => {
    e.preventDefault();

    if (new Date(holdSession.holdUntil).getTime() <= Date.now()) {
      document.getElementById('confirmExpiredModal').classList.add('open');
      return;
    }

    const paymentMethod = paymentSelect.value;
    if (paymentMethod === 'banking' && !uploadedReceiptFile) {
      alert('Vui lòng tải lên ảnh minh chứng đã chuyển khoản trước khi hoàn tất!');
      return;
    }

    const bookingPayload = {
      hold_id: holdSession.holdId,
      customer_name: document.getElementById('customerName').value.trim(),
      customer_phone: document.getElementById('customerPhone').value.trim(),
      payment_method: paymentMethod,
      receipt_file_name: uploadedReceiptFile ? uploadedReceiptFile.name : null,
      note: document.getElementById('bookingNote').value.trim(),
      date: holdSession.date.dateStr,
      slots: holdSession.slots,
      total_price: holdSession.totalPrice
    };

    // TODO: Khi nối API thật, dùng FormData để gửi kèm uploadedReceiptFile tới FastAPI
    console.log('[RK Badminton - Payload chốt đơn]:', bookingPayload);

    clearInterval(confirmTimerInterval);
    sessionStorage.removeItem('rk_hold_session');
    alert('Đặt sân thành công! Lịch đặt và minh chứng thanh toán của bạn đã được ghi nhận.');
    window.location.href = './court_booking_schedule.html';
  });
}

document.addEventListener('DOMContentLoaded', initConfirmPage);