/**
 * admin_booking.js / booking_admin.js
 * Quản lý trạng thái sân & tạo đơn đặt sân cầu lông
 */

let courtsList = [];

// DOM Elements
const courtGrid = document.getElementById("court-grid");
const filterDateInput = document.getElementById("filter-date");
const btnRefresh = document.getElementById("btn-refresh");

// Modal Đặt sân mới
const modalBooking = document.getElementById("modal-booking");
const btnOpenCreateModal = document.getElementById("btn-open-create-modal");
const btnCloseModal = document.getElementById("btn-close-modal");
const btnCancelCreate = document.getElementById("btn-cancel-create");
const formCreateBooking = document.getElementById("form-create-booking");
const selectCourt = document.getElementById("booking-court");
const inputDate = document.getElementById("booking-date");
const inputStart = document.getElementById("booking-start");
const inputEnd = document.getElementById("booking-end");
const selectStatus = document.getElementById("booking-status");
const inputCustomerName = document.getElementById("booking-customer-name");
const inputCustomerPhone = document.getElementById("booking-customer-phone");
const previewPrice = document.getElementById("preview-price");

// Modal Chi tiết
const modalDetail = document.getElementById("modal-detail");
const btnCloseDetail = document.getElementById("btn-close-detail");
const detailContent = document.getElementById("detail-content");
const detailActions = document.getElementById("detail-actions");

// Lấy ngày hôm nay định dạng YYYY-MM-DD
function getTodayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Tính tiền dự kiến dựa vào sân và khung giờ
function updateEstimatedPrice() {
  const courtId = parseInt(selectCourt.value, 10);
  const court = courtsList.find((c) => c.id === courtId);
  const pricePerHour = court ? court.price_per_hour : 50000;

  const startVal = inputStart.value;
  const endVal = inputEnd.value;
  if (!startVal || !endVal) {
    previewPrice.textContent = "0 ₫";
    return 0;
  }

  const [h1, m1] = startVal.split(":").map(Number);
  const [h2, m2] = endVal.split(":").map(Number);
  const duration = (h2 * 60 + m2 - (h1 * 60 + m1)) / 60;

  if (duration <= 0) {
    previewPrice.textContent = "Giờ kết thúc phải sau giờ bắt đầu!";
    previewPrice.style.fontSize = "13px";
    return 0;
  }

  previewPrice.style.fontSize = "18px";
  const total = Math.round(duration * pricePerHour);
  previewPrice.textContent = formatMoney(total);
  return total;
}

// Đổ danh sách sân vào <select> của form đặt sân
function populateCourtSelect() {
  selectCourt.innerHTML = "";
  courtsList.forEach((court) => {
    const opt = document.createElement("option");
    opt.value = court.id;
    opt.textContent = `${court.name} (${formatMoney(court.price_per_hour)}/h)${court.is_vip ? " [VIP]" : ""}`;
    selectCourt.appendChild(opt);
  });
}

// Tải danh sách sân và trạng thái từ Database qua API
async function loadCourts() {
  try {
    courtGrid.innerHTML = `<p style="color: #666; font-style: italic;">Đang tải danh sách sân...</p>`;
    const targetDate = filterDateInput.value || getTodayString();
    courtsList = await api.get("/courts", { target_date: targetDate });

    populateCourtSelect();
    renderCourtGrid(courtsList);
  } catch (error) {
    console.error("Lỗi khi load danh sách sân:", error);
    courtGrid.innerHTML = `
      <div style="grid-column: 1/-1; padding: 20px; background: #fee2e2; border-radius: 6px; color: #991b1b;">
        <strong>Không thể kết nối đến máy chủ:</strong> ${error.message}<br>
        <small>Hãy chắc chắn bạn đã chạy backend: <code>uvicorn app.main:app --reload</code></small>
      </div>`;
    showToast(error.message, "error");
  }
}

// Render các thẻ sân lên giao diện
function renderCourtGrid(courts) {
  courtGrid.innerHTML = "";

  courts.forEach((court) => {
    const card = document.createElement("div");
    card.className = "court-card";

    let statusClass = "empty";
    let statusText = "Trống";
    let actionBtnText = "Check-in";
    let actionBtnClass = "btn btn-success";
    let actionType = "checkin-empty";

    if (court.current_state === "playing") {
      statusClass = "playing";
      statusText = "Đang chơi";
      actionBtnText = "Thanh toán & Check-out";
      actionBtnClass = "btn";
      actionType = "checkout";
    } else if (court.current_state === "booked") {
      statusClass = "booked";
      statusText = "Đã đặt trước";
      actionBtnText = "Xem chi tiết";
      actionBtnClass = "btn btn-warning";
      actionType = "view-detail";
    }

    const subNoteHtml = court.state_note
      ? `<p style="font-size: 13px; color: #666;">${escapeHtml(court.state_note)}</p>`
      : `<p style="font-size: 13px; color: #888;">Giá: ${formatMoney(court.price_per_hour)}/giờ</p>`;

    card.innerHTML = `
      <h3>${escapeHtml(court.name)}</h3>
      <p class="status ${statusClass}">${statusText}</p>
      ${subNoteHtml}
      <button class="${actionBtnClass}" data-court-id="${court.id}" data-action="${actionType}" data-booking-id="${court.active_booking_id || ""}">
        ${actionBtnText}
      </button>
    `;

    courtGrid.appendChild(card);
  });
}

// Mở Modal đặt sân mới
function openCreateModal(preselectedCourtId = null) {
  const today = getTodayString();
  inputDate.value = filterDateInput.value || today;

  if (preselectedCourtId) {
    selectCourt.value = preselectedCourtId;
  }

  const now = new Date();
  const currentHour = String(now.getHours()).padStart(2, "0");
  const nextHour = String(Math.min(23, now.getHours() + 1)).padStart(2, "0");
  inputStart.value = `${currentHour}:00`;
  inputEnd.value = `${nextHour}:30`;

  updateEstimatedPrice();
  modalBooking.classList.add("active");
}

function closeCreateModal() {
  modalBooking.classList.remove("active");
  formCreateBooking.reset();
}

// Mở Modal xem chi tiết đơn đặt sân
async function openDetailModal(bookingId) {
  if (!bookingId) return;
  try {
    const booking = await api.get(`/bookings/${bookingId}`);

    document.getElementById("detail-title").textContent = `Chi tiết đặt ${booking.court_name || "Sân"}`;
    detailContent.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 10px; font-size: 15px;">
        <div><strong>Mã đơn (Code):</strong> <code style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px; color: var(--primary-red); font-weight: bold;">${escapeHtml(booking.booking_code)}</code></div>
        <div><strong>Khách hàng:</strong> ${escapeHtml(booking.user_name || "Khách vãng lai")}</div>
        <div><strong>Số điện thoại:</strong> ${escapeHtml(booking.user_phone || "Chưa có")}</div>
        <div><strong>Ngày chơi:</strong> ${booking.booking_date}</div>
        <div><strong>Thời gian:</strong> ${booking.start_time} - ${booking.end_time}</div>
        <div><strong>Tổng tiền:</strong> <span style="color: var(--primary-red); font-weight: bold;">${formatMoney(booking.total_price)}</span></div>
        <div><strong>Trạng thái:</strong> <span class="status ${booking.status === 'Confirmed' ? 'playing' : 'booked'}">${booking.status}</span></div>
      </div>
    `;

    detailActions.innerHTML = "";
    if (booking.status === "Pending") {
      const btnConfirm = document.createElement("button");
      btnConfirm.className = "btn btn-success";
      btnConfirm.textContent = "Check-in (Vào sân)";
      btnConfirm.onclick = () => handleStatusChange(booking.id, "Confirmed", "Đã check-in vào sân!");
      detailActions.appendChild(btnConfirm);
    }

    if (booking.status === "Confirmed") {
      const btnCheckout = document.createElement("button");
      btnCheckout.className = "btn";
      btnCheckout.textContent = "Thanh toán xong & Trả sân";
      btnCheckout.onclick = () => handleCheckout(booking.id);
      detailActions.appendChild(btnCheckout);
    }

    if (booking.status !== "Cancelled" && booking.status !== "Completed") {
      const btnCancel = document.createElement("button");
      btnCancel.className = "btn-secondary";
      btnCancel.textContent = "Hủy đơn đặt";
      btnCancel.onclick = () => handleCancelBooking(booking.id);
      detailActions.appendChild(btnCancel);
    }

    modalDetail.classList.add("active");
  } catch (error) {
    showToast("Không tìm thấy thông tin chi tiết: " + error.message, "error");
  }
}

function closeDetailModal() {
  modalDetail.classList.remove("active");
}

// Xử lý đổi trạng thái (Check-in)
async function handleStatusChange(bookingId, newStatus, successMsg) {
  try {
    await api.patch(`/bookings/${bookingId}/status?status=${newStatus}`);
    showToast(successMsg, "success");
    closeDetailModal();
    loadCourts();
  } catch (err) {
    showToast("Lỗi khi cập nhật trạng thái: " + err.message, "error");
  }
}

// Xử lý Check-out (Thanh toán & Trả sân)
async function handleCheckout(bookingId) {
  if (!confirm("Xác nhận khách đã thanh toán và trả sân?")) return;
  try {
    await api.patch(`/bookings/${bookingId}/status?status=Completed`);
    showToast("Thanh toán và trả sân thành công!", "success");
    closeDetailModal();
    loadCourts();
  } catch (err) {
    showToast("Lỗi check-out: " + err.message, "error");
  }
}

// Xử lý HỦY LỊCH ĐẶT SÂN: Kiểm tra tồn tại, hiện chính sách và báo % hoàn tiền
async function handleCancelBooking(bookingId) {
  try {
    // 1. Kiểm tra lịch đặt có tồn tại không và lấy trước thông tin chính sách hoàn tiền
    const preview = await api.get(`/bookings/${bookingId}/cancel-preview`);

    // 2. Hiện rõ thông báo chính sách hoàn tiền và số % tiền dự kiến hoàn
    const startStr = preview.earliest_start ? formatDateTime(preview.earliest_start) : "Chưa xác định";
    const confirmMessage =
      `${preview.policy_message}\n\n` +
      `--------------------------------------------------\n` +
      `⏰ Giờ bắt đầu chơi: ${startStr}\n` +
      `⏳ Thời gian còn lại: ${preview.hours_before} giờ\n` +
      `💰 Tổng tiền đơn đặt: ${formatMoney(preview.total_price)}\n` +
      `💵 BẠN SẼ ĐƯỢC HOÀN: ${preview.refund_percent}% (${formatMoney(preview.refund_amount)})\n` +
      `--------------------------------------------------\n\n` +
      `Bạn có đồng ý hủy lịch đặt này không?`;

    const userConfirmed = confirm(confirmMessage);
    if (!userConfirmed) return;

    // 3. Tiến hành hủy trên hệ thống backend
    const result = await api.post(`/bookings/${bookingId}/cancel`);

    // 4. Thông báo lại trên màn hình sẽ được hoàn bao nhiêu %
    alert(
      `🔔 THÔNG BÁO KẾT QUẢ HỦY & HOÀN TIỀN:\n\n` +
      `• Mã đơn: ${result.booking_code}\n` +
      `• Tỷ lệ được hoàn: ${result.refund_percent}%\n` +
      `• Số tiền được hoàn lại: ${formatMoney(result.refund_amount)}\n\n` +
      `✅ ${result.message}`
    );

    showToast(
      `Đã hủy thành công! Được hoàn ${result.refund_percent}% (${formatMoney(result.refund_amount)})`,
      "success"
    );

    closeDetailModal();
    loadCourts();
  } catch (err) {
    alert("❌ Lỗi khi hủy lịch đặt: " + err.message);
    showToast("Lỗi khi hủy: " + err.message, "error");
  }
}

// Sự kiện bấm nút trên từng thẻ sân (Check-in, Check-out, Xem chi tiết)
courtGrid.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;

  const action = btn.dataset.action;
  const courtId = parseInt(btn.dataset.courtId, 10);
  const bookingId = btn.dataset.bookingId;

  if (action === "checkin-empty") {
    openCreateModal(courtId);
    selectStatus.value = "Confirmed";
  } else if (action === "checkout") {
    openDetailModal(bookingId);
  } else if (action === "view-detail") {
    openDetailModal(bookingId);
  }
});

// Sự kiện gửi Form tạo đặt sân mới
formCreateBooking.addEventListener("submit", async (e) => {
  e.preventDefault();

  const courtId = parseInt(selectCourt.value, 10);
  const bookingDate = inputDate.value;
  const startTime = inputStart.value + ":00";
  const endTime = inputEnd.value + ":00";
  const customerName = inputCustomerName.value.trim();
  const customerPhone = inputCustomerPhone.value.trim();
  const status = selectStatus.value;
  const totalPrice = updateEstimatedPrice();

  if (totalPrice <= 0) {
    alert("Giờ kết thúc phải sau giờ bắt đầu!");
    return;
  }

  const payload = {
    court_id: courtId,
    booking_date: bookingDate,
    start_time: startTime,
    end_time: endTime,
    total_price: totalPrice,
    status: status,
    customer_name: customerName,
    customer_phone: customerPhone,
    booking_channel: "Counter",
  };

  try {
    const submitBtn = document.getElementById("btn-submit-booking");
    submitBtn.disabled = true;
    submitBtn.textContent = "Đang lưu...";

    const result = await api.post("/bookings", payload);

    showToast(`Đặt sân thành công! Mã đơn: ${result.booking_code}`, "success");
    closeCreateModal();
    loadCourts();
  } catch (error) {
    console.error("Lỗi tạo booking:", error);
    showToast("Lỗi đặt sân: " + error.message, "error");
  } finally {
    const submitBtn = document.getElementById("btn-submit-booking");
    submitBtn.disabled = false;
    submitBtn.textContent = "Lưu đơn đặt sân";
  }
});

// Lắng nghe thay đổi giờ/sân để tính tiền
selectCourt.addEventListener("change", updateEstimatedPrice);
inputStart.addEventListener("input", updateEstimatedPrice);
inputEnd.addEventListener("input", updateEstimatedPrice);

// Sự kiện Modal buttons
btnOpenCreateModal.addEventListener("click", () => openCreateModal());
btnCloseModal.addEventListener("click", closeCreateModal);
btnCancelCreate.addEventListener("click", closeCreateModal);
btnCloseDetail.addEventListener("click", closeDetailModal);

// Đóng modal khi bấm ra ngoài vùng tối
window.addEventListener("click", (e) => {
  if (e.target === modalBooking) closeCreateModal();
  if (e.target === modalDetail) closeDetailModal();
});

// Thay đổi ngày xem trạng thái
filterDateInput.addEventListener("change", loadCourts);
btnRefresh.addEventListener("click", loadCourts);

// Khởi chạy khi load trang
document.addEventListener("DOMContentLoaded", () => {
  filterDateInput.value = getTodayString();
  loadCourts();
});
