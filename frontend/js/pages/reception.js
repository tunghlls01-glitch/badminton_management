/* global axios, axiosClient */
/**
 * RK BADMINTON · Reception Check-in & Counter Checkout
 * Interactive frontend logic matching Figma specification.
 */
(function () {
  "use strict";
  const entry = new URLSearchParams(window.location.search);
  const fromOverview = entry.get("source") === "overview";
  let checkinPending = false;

  // --- Initial Mock Bookings matching Figma Design ---
  const INITIAL_BOOKINGS = [
    {
      id: 1,
      booking_code: "#BK-20261113",
      customer_name: "Minh Anh Nguyen",
      customer_phone: "090 123 4567",
      court_name: "Sân 2",
      court_type: "Sân tiêu chuẩn",
      time_slot: "14:00–15:00",
      hours: 1,
      court_hourly_rate: 180000,
      court_fee: 180000,
      status: "CHECKED_IN", // CHECKED_IN, Confirmed, Completed
      checked_in_at: "14:02",
      services: [
        { name: "Ống cầu lông", qty: 2, unit_price: 60000, amount: 120000 },
        { name: "Nước đóng chai", qty: 3, unit_price: 10000, amount: 30000 },
        { name: "Thuê vợt", qty: 1, unit_price: 40000, amount: 40000 }
      ],
      discount_amount: 0,
      discount_reason: ""
    },
    {
      id: 2,
      booking_code: "#BK-20261114",
      customer_name: "Duc Tran",
      customer_phone: "091 765 4321",
      court_name: "Sân 4",
      court_type: "Sân tiêu chuẩn",
      time_slot: "14:00–15:00",
      hours: 1,
      court_hourly_rate: 180000,
      court_fee: 180000,
      status: "CHECKED_IN",
      checked_in_at: "14:05",
      services: [
        { name: "Nước đóng chai", qty: 2, unit_price: 10000, amount: 20000 }
      ],
      discount_amount: 0,
      discount_reason: ""
    },
    {
      id: 3,
      booking_code: "#BK-20261115",
      customer_name: "Quang Pham",
      customer_phone: "098 234 5678",
      court_name: "Sân 1",
      court_type: "Sân thi đấu VIP",
      time_slot: "15:00–16:00",
      hours: 1,
      court_hourly_rate: 200000,
      court_fee: 200000,
      status: "Confirmed",
      checked_in_at: null,
      services: [],
      discount_amount: 0,
      discount_reason: ""
    },
    {
      id: 4,
      booking_code: "#BK-20261116",
      customer_name: "Thu Ha Le",
      customer_phone: "093 456 7890",
      court_name: "Sân 3",
      court_type: "Sân tiêu chuẩn",
      time_slot: "15:00–16:00",
      hours: 1,
      court_hourly_rate: 180000,
      court_fee: 180000,
      status: "Confirmed",
      checked_in_at: null,
      services: [],
      discount_amount: 0,
      discount_reason: ""
    },
    {
      id: 5,
      booking_code: "#BK-20261117",
      customer_name: "Bao Hoang",
      customer_phone: "096 678 9012",
      court_name: "Sân 2",
      court_type: "Sân tiêu chuẩn",
      time_slot: "16:00–17:00",
      hours: 1,
      court_hourly_rate: 180000,
      court_fee: 180000,
      status: "Confirmed",
      checked_in_at: null,
      services: [],
      discount_amount: 0,
      discount_reason: ""
    }
  ];

  // Application State
  const state = {
    bookings: fromOverview ? [] : [...INITIAL_BOOKINGS],
    selectedId: fromOverview ? Number(entry.get("booking_id")) : 1,
    activeFilter: "all", // "all", "upcoming", "checkedin"
    searchQuery: "",
    paymentMethod: "CASH", // "CASH" | "BANK_TRANSFER"
    cashReceived: 500000,
    isReceiptOpen: false,
    apiBaseURL: (window.RK_CONFIG && window.RK_CONFIG.apiURL) || "http://localhost:8000/api"
  };

  // DOM Elements
  const el = {};

  function cacheDOMElements() {
    el.searchInput = document.getElementById("searchInput");
    el.filterTabs = document.querySelectorAll("[data-filter]");
    el.bookingsList = document.getElementById("bookingsList");
    el.bookingsCountLabel = document.getElementById("bookingsCountLabel");
    
    // Checkout elements
    el.checkoutStatus = document.getElementById("checkoutStatus");
    el.checkoutBookingCode = document.getElementById("checkoutBookingCode");
    el.checkoutCustName = document.getElementById("checkoutCustName");
    el.checkoutCustPhone = document.getElementById("checkoutCustPhone");
    el.checkoutCourtName = document.getElementById("checkoutCourtName");
    el.checkoutCheckinTime = document.getElementById("checkoutCheckinTime");
    el.courtFeeDesc = document.getElementById("courtFeeDesc");
    el.courtFeeFormula = document.getElementById("courtFeeFormula");
    el.courtFeePrice = document.getElementById("courtFeePrice");
    el.servicesTableBody = document.getElementById("servicesTableBody");
    el.servicesSubtotal = document.getElementById("servicesSubtotal");
    el.racketRentalAlertBox = document.getElementById("racketRentalAlertBox");
    el.grandTotal = document.getElementById("grandTotal");
    el.cashInput = document.getElementById("cashInput");
    el.changeDue = document.getElementById("changeDue");
    el.paymentMethodCash = document.getElementById("paymentMethodCash");
    el.paymentMethodBank = document.getElementById("paymentMethodBank");
    el.cashCalculatorBox = document.getElementById("cashCalculatorBox");
    el.bankTransferBox = document.getElementById("bankTransferBox");
    
    // Action buttons
    el.btnQuick200k = document.getElementById("btnQuick200k");
    el.btnQuick500k = document.getElementById("btnQuick500k");
    el.btnQuickExact = document.getElementById("btnQuickExact");
    el.btnPrintPreview = document.getElementById("btnPrintPreview");
    el.btnConfirmPayment = document.getElementById("btnConfirmPayment");
    
    // Thermal Receipt Drawer elements
    el.modalOverlay = document.getElementById("modalOverlay");
    el.btnCloseReceipt = document.getElementById("btnCloseReceipt");
    el.btnBackCheckout = document.getElementById("btnBackCheckout");
    el.btnPrintReceipt = document.getElementById("btnPrintReceipt");
    el.receiptBookingCode = document.getElementById("receiptBookingCode");
    el.receiptDate = document.getElementById("receiptDate");
    el.receiptTime = document.getElementById("receiptTime");
    el.receiptCustomer = document.getElementById("receiptCustomer");
    el.receiptCourt = document.getElementById("receiptCourt");
    el.receiptCheckin = document.getElementById("receiptCheckin");
    el.receiptItemsList = document.getElementById("receiptItemsList");
    el.receiptTotal = document.getElementById("receiptTotal");
    el.receiptTender = document.getElementById("receiptTender");
    el.receiptChange = document.getElementById("receiptChange");
    el.receiptPaymentStatus = document.getElementById("receiptPaymentStatus");
    
    // Toast
    el.toast = document.getElementById("rkToast");
    el.toastText = document.getElementById("rkToastText");
  }

  // --- Formatting Helpers ---
  function formatMoney(amount) {
    if (isNaN(amount) || amount === null || amount === undefined) return "0";
    return Number(amount).toLocaleString("vi-VN");
  }

  function parseMoney(str) {
    if (typeof str === "number") return str;
    return Number(String(str).replace(/[^\d]/g, "")) || 0;
  }

  function showToast(message) {
    if (!el.toast) return;
    el.toastText.textContent = message;
    el.toast.classList.add("show");
    setTimeout(() => {
      el.toast.classList.remove("show");
    }, 3200);
  }

  // --- Get Selected Booking ---
  function getSelectedBooking() {
    return state.bookings.find((b) => b.id === state.selectedId) || state.bookings[0];
  }

  // --- Totals Calculation ---
  function calculateTotals(booking) {
    if (!booking) return { courtTotal: 0, servicesTotal: 0, grandTotal: 0 };
    const courtTotal = Number(booking.court_fee || 0);
    const servicesTotal = (booking.services || []).reduce(
      (sum, s) => sum + Number(s.amount || s.unit_price * s.qty || 0),
      0
    );
    const discount = Number(booking.discount_amount || 0);
    const grandTotal = Math.max(0, courtTotal + servicesTotal - discount);
    return { courtTotal, servicesTotal, grandTotal, discount };
  }

  // --- Render Bookings List ---
  function renderBookingsList() {
    if (!el.bookingsList) return;

    // Filter by tab
    let filtered = state.bookings.filter((b) => {
      if (state.activeFilter === "upcoming") {
        return b.status === "Confirmed";
      }
      if (state.activeFilter === "checkedin") {
        return b.status === "CHECKED_IN";
      }
      return true;
    });

    // Filter by search query
    if (state.searchQuery.trim()) {
      const q = state.searchQuery.trim().toLowerCase();
      filtered = filtered.filter(
        (b) =>
          b.customer_name.toLowerCase().includes(q) ||
          b.customer_phone.includes(q) ||
          b.booking_code.toLowerCase().includes(q) ||
          b.court_name.toLowerCase().includes(q)
      );
    }

    // Update filter counts
    const totalCount = state.bookings.length;
    const upcomingCount = state.bookings.filter((b) => b.status === "Confirmed").length;
    const checkedinCount = state.bookings.filter((b) => b.status === "CHECKED_IN").length;

    el.filterTabs.forEach((tab) => {
      const filter = tab.dataset.filter;
      if (filter === "all") tab.textContent = `Tất cả  (${totalCount})`;
      if (filter === "upcoming") tab.textContent = `Sắp tới  (${upcomingCount})`;
      if (filter === "checkedin") tab.textContent = `Đã nhận sân  (${checkedinCount})`;
      tab.classList.toggle("active", filter === state.activeFilter);
    });

    if (el.bookingsCountLabel) {
      el.bookingsCountLabel.textContent = `Hôm nay · ${totalCount} lượt đặt sân`;
    }

    if (filtered.length === 0) {
      el.bookingsList.innerHTML = `
        <div style="text-align:center;padding:32px 16px;color:var(--rk-text-muted);font-size:13px;">
          Không tìm thấy lượt đặt sân nào phù hợp.
        </div>
      `;
      return;
    }

    el.bookingsList.innerHTML = filtered
      .map((b) => {
        const isSelected = b.id === state.selectedId;
        let statusBadge = "";
        let actionBtn = "";

        if (b.status === "CHECKED_IN") {
          statusBadge = `<span class="booking-status-tag status-tag-checkedin">Đã nhận sân</span>`;
          if (!fromOverview) actionBtn = `<button type="button" class="booking-action-btn btn-checkout" data-action="checkout" data-id="${b.id}">Thanh toán</button>`;
        } else if (b.status === "Completed") {
          statusBadge = `<span class="booking-status-tag status-tag-completed">Đã hoàn thành</span>`;
          if (!fromOverview) actionBtn = `<button type="button" class="booking-action-btn btn-view-invoice" data-action="preview" data-id="${b.id}">Xem hóa đơn</button>`;
        } else {
          statusBadge = `<span class="booking-status-tag status-tag-confirmed">Đã xác nhận</span>`;
          actionBtn = `<button type="button" class="booking-action-btn btn-checkin" data-action="checkin" data-id="${b.id}">Nhận sân</button>`;
        }

        return `
          <div class="booking-item ${isSelected ? "selected" : ""}" data-booking-id="${b.id}">
            <div class="booking-item-header">
              <div class="booking-time-court">
                <span class="time-pill">${window.RK_UI.escape(b.time_slot)}</span>
                <span class="court-badge">${window.RK_UI.escape(b.court_name)}</span>
              </div>
              ${statusBadge}
            </div>
            <div class="booking-item-body">
              <div>
                <div class="booking-customer-name">${window.RK_UI.escape(b.customer_name)}</div>
                <div class="booking-customer-phone">${window.RK_UI.escape(b.customer_phone)}</div>
              </div>
              <div>
                ${actionBtn}
              </div>
            </div>
          </div>
        `;
      })
      .join("");
  }

  // --- Render Checkout Panel ---
  function renderCheckoutPanel() {
    if (fromOverview) return;
    const booking = getSelectedBooking();
    if (!booking) return;

    const totals = calculateTotals(booking);

    // Status badge
    if (booking.status === "Completed") {
      el.checkoutStatus.className = "checkout-status-badge completed";
      el.checkoutStatus.innerHTML = "● Đã thanh toán";
    } else {
      el.checkoutStatus.className = "checkout-status-badge pending";
      el.checkoutStatus.innerHTML = "● Chờ thanh toán";
    }

    el.checkoutBookingCode.textContent = booking.booking_code;
    el.checkoutCustName.textContent = booking.customer_name;
    el.checkoutCustPhone.textContent = booking.customer_phone;
    el.checkoutCourtName.textContent = booking.court_name;
    el.checkoutCheckinTime.textContent = booking.checked_in_at
      ? `Đã nhận sân lúc ${booking.checked_in_at}`
      : "Chưa nhận sân";

    // Court fee
    el.courtFeeDesc.textContent = `${booking.court_name} · ${booking.court_type || "Sân tiêu chuẩn"}`;
    el.courtFeeFormula.textContent = `${booking.time_slot}  ·  ${booking.hours || 1} giờ × ${formatMoney(booking.court_hourly_rate || booking.court_fee)}`;
    el.courtFeePrice.textContent = formatMoney(totals.courtTotal);

    // Services table
    if (!booking.services || booking.services.length === 0) {
      el.servicesTableBody.innerHTML = `
        <div style="padding:12px 14px;color:var(--rk-text-muted);font-size:12px;font-style:italic;">
          Chưa sử dụng dịch vụ hoặc nước uống đi kèm.
        </div>
      `;
    } else {
      el.servicesTableBody.innerHTML = booking.services
        .map(
          (s) => `
          <div class="services-table-row">
            <span class="service-col-name">${s.name}</span>
            <span class="service-col-qty">${s.qty}</span>
            <span class="service-col-unit">${formatMoney(s.unit_price)}</span>
            <span class="service-col-amount">${formatMoney(s.amount)}</span>
          </div>
        `
        )
        .join("");
    }

    el.servicesSubtotal.textContent = formatMoney(totals.servicesTotal);
    el.grandTotal.textContent = formatMoney(totals.grandTotal);

    // T3D2CB1: Kiểm tra và hiển thị cảnh báo vợt thuê chưa hoàn trả
    updateRacketRentalWarning(booking);

    // Cash received & change due calculation
    renderCashCalculator(totals.grandTotal);
  }

  // --- T3D2CB1: Cảnh báo & Thu hồi vợt thuê theo Booking ---
  async function updateRacketRentalWarning(booking) {
    if (!el.racketRentalAlertBox) return;

    let hasUnreturned = false;
    let unreturnedCount = 0;
    let rentalDetails = [];

    // 1. Thử gọi API Backend
    try {
      const http = window.axios || window.axiosClient;
      if (http) {
        const token = localStorage.getItem("token") || (window.authStorage && window.authStorage.getToken());
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await http.get(`http://127.0.0.1:8000/api/racket-rentals/warning/${booking.id}`, { headers });
        if (res && res.data) {
          hasUnreturned = res.data.has_unreturned_rackets;
          unreturnedCount = res.data.unreturned_count;
          rentalDetails = res.data.rentals || [];
        }
      }
    } catch (err) {
      // 2. Fallback nếu chạy mock hoặc backend chưa có data: quét danh sách services
      const rentalItem = (booking.services || []).find((s) => {
        const n = (s.name || "").toLowerCase();
        return n.includes("thuê vợt") || n.includes("vợt");
      });
      if (rentalItem && !booking.rackets_returned) {
        hasUnreturned = true;
        unreturnedCount = rentalItem.qty || 1;
        rentalDetails = [{ service_name: rentalItem.name, quantity: unreturnedCount, status: "RENTING" }];
      }
    }

    // Ghi nhận trạng thái vào booking object để phục vụ nút xác nhận thanh toán
    booking._hasUnreturnedRackets = hasUnreturned;
    booking._unreturnedCount = unreturnedCount;

    if (hasUnreturned && !booking.rackets_returned) {
      el.racketRentalAlertBox.style.display = "block";
      el.racketRentalAlertBox.innerHTML = `
        <div class="rental-warning-card">
          <div class="rental-warning-header">
            <span style="font-size:16px;">⚠️</span>
            <span>CẢNH BÁO: VỢT THUÊ CHƯA HOÀN TRẢ!</span>
          </div>
          <div class="rental-warning-body">
            Booking này hiện đang mượn <strong>${unreturnedCount} cây vợt</strong> chưa hoàn trả vào kho.
          </div>
          <div class="rental-warning-actions">
            <span style="font-size:11.5px; color:#b45309; font-weight:500;">
              Vui lòng kiểm tra &amp; thu hồi vợt trước khi thanh toán
            </span>
            <button type="button" class="btn-return-racket-quick" id="btnQuickReturnRackets" data-booking-id="${booking.id}">
              <span>✓</span>
              <span>Xác nhận đã thu hồi vợt</span>
            </button>
          </div>
        </div>
      `;

      // Gắn sự kiện cho nút Xác nhận thu hồi vợt
      const btnReturn = document.getElementById("btnQuickReturnRackets");
      if (btnReturn) {
        btnReturn.addEventListener("click", () => executeReturnAllRackets(booking));
      }
    } else if (booking.rackets_returned) {
      el.racketRentalAlertBox.style.display = "block";
      el.racketRentalAlertBox.innerHTML = `
        <div class="rental-returned-card">
          <div class="rental-returned-text">
            <span>✅</span>
            <span>Đã thu hồi đủ ${unreturnedCount || 1} cây vợt &amp; hoàn kho thành công.</span>
          </div>
          <span style="font-size:11px; color:#047857; font-weight:600; background:#d1fae5; padding:3px 8px; border-radius:12px;">
            Sẵn sàng thanh toán
          </span>
        </div>
      `;
    } else {
      el.racketRentalAlertBox.style.display = "none";
      el.racketRentalAlertBox.innerHTML = "";
    }
  }

  // Thực thi thu hồi toàn bộ vợt của booking
  async function executeReturnAllRackets(booking) {
    try {
      const http = window.axios || window.axiosClient;
      if (http) {
        const token = localStorage.getItem("token") || (window.authStorage && window.authStorage.getToken());
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        await http.post(
          `http://127.0.0.1:8000/api/racket-rentals/return-all/${booking.id}`,
          { note: "Thu hồi trực tiếp tại quầy thanh toán" },
          { headers }
        );
      }
    } catch (err) {
      console.warn("Backend return-all warning:", err);
    }

    booking.rackets_returned = true;
    booking._hasUnreturnedRackets = false;
    showToast(`✓ Đã xác nhận thu hồi vợt cho booking ${booking.booking_code}! Tồn kho đã hoàn lại.`);
    updateRacketRentalWarning(booking);
  }

  // --- Render Cash Calculator ---
  function renderCashCalculator(grandTotal) {
    if (state.cashReceived === 0) {
      state.cashReceived = grandTotal;
    }

    el.cashInput.value = formatMoney(state.cashReceived);

    const change = state.cashReceived - grandTotal;
    if (change >= 0) {
      el.changeDue.className = "change-due-amount";
      el.changeDue.textContent = `${formatMoney(change)} VND`;
    } else {
      el.changeDue.className = "change-due-amount negative";
      el.changeDue.textContent = `Thiếu ${formatMoney(Math.abs(change))} VND`;
    }

    // Highlight preset buttons if exact match
    el.btnQuick200k.classList.toggle("active", state.cashReceived === 200000);
    el.btnQuick500k.classList.toggle("active", state.cashReceived === 500000);
    el.btnQuickExact.classList.toggle("active", state.cashReceived === grandTotal);
  }

  // --- Render Thermal Receipt Drawer ---
  function renderThermalReceipt() {
    const booking = getSelectedBooking();
    if (!booking) return;

    const totals = calculateTotals(booking);
    const now = new Date();
    const dateStr = `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;
    const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    el.receiptBookingCode.textContent = booking.booking_code;
    el.receiptDate.textContent = dateStr;
    el.receiptTime.textContent = timeStr;
    el.receiptCustomer.textContent = booking.customer_name;
    el.receiptCourt.textContent = booking.court_name;
    el.receiptCheckin.textContent = booking.checked_in_at || "14:02";

    // Build receipt item groups
    let itemsHtml = `
      <div class="receipt-item-group">
        <div class="receipt-item-name">${booking.court_name} · ${booking.time_slot}</div>
        <div class="receipt-item-calc">
          <span>${booking.hours || 1} giờ × ${formatMoney(booking.court_hourly_rate || booking.court_fee)}</span>
          <span>${formatMoney(totals.courtTotal)}</span>
        </div>
      </div>
    `;

    (booking.services || []).forEach((s) => {
      itemsHtml += `
        <div class="receipt-item-group">
          <div class="receipt-item-name">${s.name}</div>
          <div class="receipt-item-calc">
            <span>${s.qty} × ${formatMoney(s.unit_price)}</span>
            <span>${formatMoney(s.amount)}</span>
          </div>
        </div>
      `;
    });

    el.receiptItemsList.innerHTML = itemsHtml;
    el.receiptTotal.textContent = formatMoney(totals.grandTotal);
    el.receiptTender.textContent = formatMoney(state.cashReceived);

    const change = Math.max(0, state.cashReceived - totals.grandTotal);
    el.receiptChange.textContent = formatMoney(change);

    if (booking.status === "Completed") {
      el.receiptPaymentStatus.textContent = "Hóa đơn đã được thanh toán thành công.";
    } else {
      el.receiptPaymentStatus.textContent = "Thanh toán chưa được xác nhận.";
    }
  }

  // --- Check-in Action ---
  async function handleCheckIn(bookingId) {
    const booking = state.bookings.find((b) => b.id === bookingId);
    if (!booking) return;
    if (fromOverview) {
      if (checkinPending) return;
      checkinPending = true;
      try {
        const { data } = await window.axiosClient.post(`/reception/bookings/${bookingId}/check-in`);
        booking.status = data.status;
        state.selectedId = bookingId;
        renderBookingsList();
        showToast("Đã nhận sân cho " + booking.customer_name + ".");
      } catch (error) {
        showToast(error.response?.data?.detail || "Không thể nhận sân. Vui lòng thử lại.");
      } finally {
        checkinPending = false;
      }
      return;
    }

    const now = new Date();
    const timeNow = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    booking.status = "CHECKED_IN";
    booking.checked_in_at = timeNow;

    state.selectedId = bookingId;
    renderBookingsList();
    renderCheckoutPanel();
    showToast(`✓ Đã nhận sân thành công cho ${booking.customer_name}!`);
  }

  // --- Confirm Payment Action ---
  function handleConfirmPaymentAndPrint() {
    const booking = getSelectedBooking();
    if (!booking) return;

    // T3D2CB1: Cảnh báo nếu chưa trả vợt lúc thanh toán
    if (booking._hasUnreturnedRackets && !booking.rackets_returned) {
      const count = booking._unreturnedCount || 1;
      const confirmMsg = `⚠️ CẢNH BÁO VỢT CHƯA TRẢ:\n\nBooking này hiện vẫn còn ${count} cây vợt chưa hoàn trả vào kho!\n\nBấm [OK] để xác nhận đã thu hồi đủ vợt và tiếp tục thanh toán.\nBấm [Cancel] để dừng thanh toán và đi kiểm tra lại.`;
      if (!window.confirm(confirmMsg)) {
        showToast("⚠️ Vui lòng thu hồi vợt trước khi thanh toán!");
        return;
      }
      executeReturnAllRackets(booking);
    }

    const totals = calculateTotals(booking);

    booking.status = "Completed";
    renderBookingsList();
    renderCheckoutPanel();
    renderThermalReceipt();

    showToast(`✓ Đã ghi nhận thanh toán ${formatMoney(totals.grandTotal)} VND!`);

    // Open receipt drawer and trigger print
    openReceiptDrawer();
    setTimeout(() => {
      window.print();
    }, 450);
  }

  // --- Drawer Open / Close ---
  function openReceiptDrawer() {
    renderThermalReceipt();
    state.isReceiptOpen = true;
    el.modalOverlay.classList.add("open");
  }

  function closeReceiptDrawer() {
    state.isReceiptOpen = false;
    el.modalOverlay.classList.remove("open");
  }

  // --- Event Bindings ---
  function initEventListeners() {
    // Search input
    el.searchInput.addEventListener("input", (e) => {
      state.searchQuery = e.target.value;
      renderBookingsList();
    });

    // Filter tabs
    el.filterTabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        state.activeFilter = tab.dataset.filter;
        renderBookingsList();
      });
    });

    // Bookings list click delegation
    el.bookingsList.addEventListener("click", (e) => {
      const actionBtn = e.target.closest("[data-action]");
      if (actionBtn) {
        e.stopPropagation();
        const action = actionBtn.dataset.action;
        const id = Number(actionBtn.dataset.id);
        if (action === "checkin") {
          handleCheckIn(id);
        } else if (action === "checkout") {
          state.selectedId = id;
          renderBookingsList();
          renderCheckoutPanel();
        } else if (action === "preview") {
          state.selectedId = id;
          renderBookingsList();
          renderCheckoutPanel();
          openReceiptDrawer();
        }
        return;
      }

      const item = e.target.closest(".booking-item");
      if (item) {
        const id = Number(item.dataset.bookingId);
        state.selectedId = id;
        renderBookingsList();
        renderCheckoutPanel();
      }
    });

    // Payment method selector
    el.paymentMethodCash.addEventListener("click", () => {
      state.paymentMethod = "CASH";
      el.paymentMethodCash.classList.add("active");
      el.paymentMethodBank.classList.remove("active");
      el.cashCalculatorBox.style.display = "block";
      if (el.bankTransferBox) el.bankTransferBox.style.display = "none";
    });

    el.paymentMethodBank.addEventListener("click", () => {
      state.paymentMethod = "BANK_TRANSFER";
      el.paymentMethodBank.classList.add("active");
      el.paymentMethodCash.classList.remove("active");
      el.cashCalculatorBox.style.display = "none";
      if (el.bankTransferBox) el.bankTransferBox.style.display = "block";
    });

    // Quick cash buttons
    el.btnQuick200k.addEventListener("click", () => {
      state.cashReceived = 200000;
      const b = getSelectedBooking();
      renderCashCalculator(calculateTotals(b).grandTotal);
    });

    el.btnQuick500k.addEventListener("click", () => {
      state.cashReceived = 500000;
      const b = getSelectedBooking();
      renderCashCalculator(calculateTotals(b).grandTotal);
    });

    el.btnQuickExact.addEventListener("click", () => {
      const b = getSelectedBooking();
      state.cashReceived = calculateTotals(b).grandTotal;
      renderCashCalculator(state.cashReceived);
    });

    // Cash input manual typing
    el.cashInput.addEventListener("input", (e) => {
      const val = parseMoney(e.target.value);
      state.cashReceived = val;
      const b = getSelectedBooking();
      const totals = calculateTotals(b);
      const change = val - totals.grandTotal;

      if (change >= 0) {
        el.changeDue.className = "change-due-amount";
        el.changeDue.textContent = `${formatMoney(change)} VND`;
      } else {
        el.changeDue.className = "change-due-amount negative";
        el.changeDue.textContent = `Thiếu ${formatMoney(Math.abs(change))} VND`;
      }

      el.btnQuick200k.classList.toggle("active", val === 200000);
      el.btnQuick500k.classList.toggle("active", val === 500000);
      el.btnQuickExact.classList.toggle("active", val === totals.grandTotal);
    });

    el.cashInput.addEventListener("blur", (e) => {
      e.target.value = formatMoney(state.cashReceived);
    });

    // Preview button
    el.btnPrintPreview.addEventListener("click", () => {
      openReceiptDrawer();
    });

    // Confirm Payment & Print
    el.btnConfirmPayment.addEventListener("click", () => {
      handleConfirmPaymentAndPrint();
    });

    // Modal close actions
    el.btnCloseReceipt.addEventListener("click", closeReceiptDrawer);
    el.btnBackCheckout.addEventListener("click", closeReceiptDrawer);
    el.modalOverlay.addEventListener("click", (e) => {
      if (e.target === el.modalOverlay) {
        closeReceiptDrawer();
      }
    });

    // Print Receipt button in drawer
    el.btnPrintReceipt.addEventListener("click", () => {
      window.print();
    });

    // Escape key closes modal
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && state.isReceiptOpen) {
        closeReceiptDrawer();
      }
    });
  }

  // --- Initialization ---
  async function loadOverviewCheckin() {
    if (!await window.ProtectedRoute(["admin", "staff"])) return;
    const day = entry.get("day") || new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short",
    }).format(new Date());
    try {
      const { data } = await window.axiosClient.get("/reception/bookings", { params: { booking_date: day } });
      state.bookings = data.filter((row) => ["Confirmed", "CHECKED_IN"].includes(row.status)).map((row) => ({
        id: row.id, booking_code: row.booking_code, status: row.status,
        customer_name: row.user_name || "Khách vãng lai", customer_phone: row.user_phone || "",
        court_name: row.court_name || row.slots?.[0]?.court_name || "—",
        time_slot: (row.start_time || "").slice(0, 5) + "–" + (row.end_time || "").slice(0, 5),
      }));
      const selected = state.bookings.find((row) => row.id === state.selectedId);
      if (selected) {
        state.searchQuery = selected.booking_code;
        el.searchInput.value = state.searchQuery;
      }
      renderBookingsList();
      el.bookingsCountLabel.textContent = day.split("-").reverse().join("/") + " · " + state.bookings.length + " lượt đặt sân";
    } catch (_) {
      el.bookingsList.textContent = "Không tải được lượt đặt. Tải lại trang để thử lại.";
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    cacheDOMElements();
    initEventListeners();
    if (fromOverview) {
      const checkout = el.checkoutStatus.closest("section");
      checkout.hidden = true;
      checkout.parentElement.style.gridTemplateColumns = "minmax(0, 1fr)";
      document.querySelector(".reception-content h1").textContent = "Check-in tại quầy";
      el.bookingsList.textContent = "Đang tải lượt đặt…";
      void loadOverviewCheckin();
      return;
    }
    renderBookingsList();
    renderCheckoutPanel();
  });
})();
