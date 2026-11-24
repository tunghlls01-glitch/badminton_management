/**
 * RK BADMINTON · Reception Check-in & Counter Checkout
 * Interactive frontend logic connected directly to Backend Database & User Data.
 */
(function () {
  "use strict";

  // --- Initial Fallback Mock Bookings (used only when backend is completely offline) ---
  const FALLBACK_MOCK_BOOKINGS = [
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
      status: "CHECKED_IN",
      checked_in_at: "14:02",
      services: [
        { name: "Ống cầu lông", qty: 2, unit_price: 60000, amount: 120000 },
        { name: "Nước đóng chai", qty: 3, unit_price: 10000, amount: 30000 },
        { name: "Thuê vợt", qty: 1, unit_price: 40000, amount: 40000 },
      ],
      discount_amount: 0,
      discount_reason: "",
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
        { name: "Nước đóng chai", qty: 2, unit_price: 10000, amount: 20000 },
      ],
      discount_amount: 0,
      discount_reason: "",
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
      discount_reason: "",
    },
  ];

  // Date helper (local YYYY-MM-DD)
  function getLocalDateISO(d = new Date()) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function formatDisplayDate(dateStr) {
    if (!dateStr) return "";
    try {
      const parts = dateStr.split("-");
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
    } catch {}
    return dateStr;
  }

  function formatTime(d = new Date()) {
    const h = String(d.getHours()).padStart(2, "0");
    const m = String(d.getMinutes()).padStart(2, "0");
    return `${h}:${m}`;
  }

  // Application State
  const state = {
    bookings: [],
    selectedId: null,
    selectedDate: getLocalDateISO(),
    activeFilter: "all", // "all", "upcoming", "checkedin"
    searchQuery: "",
    paymentMethod: "CASH", // "CASH" | "BANK_TRANSFER"
    cashReceived: 0,
    isReceiptOpen: false,
    isLoading: false,
    currentUser: null,
  };

  // DOM Elements
  const el = {};

  function cacheDOMElements() {
    el.receptionUserName = document.getElementById("receptionUserName");
    el.receptionUserRole = document.getElementById("receptionUserRole");
    el.receptionUserAvatar = document.getElementById("receptionUserAvatar");

    el.receptionDateInput = document.getElementById("receptionDateInput");
    el.btnTodayQuick = document.getElementById("btnTodayQuick");
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
    el.discountInput = document.getElementById("discountInput");
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
    }, 3500);
  }

  // --- 1. User & Authentication Setup ---
  function renderUserInfo() {
    let user = null;
    try {
      if (window.RK_AUTH && typeof window.RK_AUTH.getState === "function") {
        const auth = window.RK_AUTH.getState();
        if (auth && auth.user) user = auth.user;
      }
      if (!user && window.authStorage && typeof window.authStorage.getUser === "function") {
        user = window.authStorage.getUser();
      }
    } catch (e) {
      console.warn("Could not read auth user:", e);
    }

    if (!user) {
      user = {
        full_name: "Lễ tân quầy",
        role: "staff",
        email: "letan@badminton.com",
      };
    }
    state.currentUser = user;

    if (el.receptionUserName) {
      el.receptionUserName.textContent = user.full_name || "Lễ tân";
    }
    if (el.receptionUserRole) {
      el.receptionUserRole.textContent =
        user.role === "admin" ? "Quản trị viên" : "Lễ tân · Quầy thu ngân";
    }
    if (el.receptionUserAvatar) {
      if (user.avatar) {
        el.receptionUserAvatar.innerHTML = `<img src="${user.avatar}" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
      } else {
        const initial = user.full_name ? user.full_name.trim().charAt(0).toUpperCase() : "LT";
        el.receptionUserAvatar.textContent = initial;
      }
    }
  }

  // --- 2. Database Mapping: Backend BookingOut -> UI Booking Model ---
  function mapBookingFromAPI(b) {
    const firstSlot = b.slots && b.slots[0] ? b.slots[0] : null;
    const totalMinutes = (b.slots || []).reduce(
      (sum, s) => sum + (Number(s.duration_minutes) || 60),
      0
    );
    const hours = totalMinutes > 0 ? totalMinutes / 60 : 1;
    const rate = firstSlot ? Number(firstSlot.price_per_hour) : 180000;

    let timeSlot = "14:00–15:00";
    if (b.start_time && b.end_time) {
      timeSlot = `${b.start_time}–${b.end_time}`;
    } else if (firstSlot && firstSlot.start_at && firstSlot.end_at) {
      const s = String(firstSlot.start_at).slice(11, 16);
      const e = String(firstSlot.end_at).slice(11, 16);
      timeSlot = `${s}–${e}`;
    }

    const courtName = b.court_name || (firstSlot ? firstSlot.court_name : "Sân 1");
    const isVip = courtName && courtName.toLowerCase().includes("vip");

    return {
      id: b.id,
      booking_code: b.booking_code,
      user_id: b.user_id,
      customer_name: b.user_name || "Khách hàng #" + (b.user_id || b.id),
      customer_phone: b.user_phone || "---",
      court_name: courtName,
      court_type: isVip ? "Sân thi đấu VIP" : "Sân tiêu chuẩn",
      time_slot: timeSlot,
      hours: hours,
      court_hourly_rate: rate,
      court_fee: Number(b.total_price) || rate * hours,
      status: b.status, // "Confirmed", "CHECKED_IN", "Completed", "Pending", "Cancelled", "NO_SHOW"
      checked_in_at: b.status === "CHECKED_IN" ? b.start_time || "Đã nhận sân" : null,
      services: [],
      discount_amount: 0,
      discount_reason: "",
      invoice_code: null,
    };
  }

  // --- 3. Load Services for Selected Booking ---
  async function loadServicesForBooking(bookingId) {
    const booking = state.bookings.find((b) => b.id === bookingId);
    if (!booking || !window.axiosClient) return;

    try {
      const res = await window.axiosClient.get(`/service-orders/booking/${bookingId}/summary`);
      if (res.data) {
        const summary = res.data;
        const services = [];
        (summary.orders || []).forEach((order) => {
          (order.items || []).forEach((item) => {
            services.push({
              name: item.service_name || "Dịch vụ",
              qty: item.quantity || 1,
              unit_price: Number(item.unit_price) || 0,
              amount: Number(item.total_price) || (item.quantity * item.unit_price) || 0,
            });
          });
        });
        booking.services = services;
        if (booking.id === state.selectedId) {
          renderCheckoutPanel();
        }
      }
    } catch (err) {
      // 404 or no orders is normal when no services ordered
      booking.services = [];
      if (booking.id === state.selectedId) {
        renderCheckoutPanel();
      }
    }
  }

  // --- 4. Load Bookings from Database API ---
  async function loadBookingsFromAPI(dateStr = null, searchParams = {}) {
    const targetDate = dateStr || state.selectedDate;
    state.isLoading = true;

    if (el.bookingsList) {
      el.bookingsList.innerHTML = `
        <div style="text-align:center;padding:36px 16px;color:var(--rk-text-muted);font-size:13px;">
          <div style="display:inline-block;width:24px;height:24px;border:3px solid #e2e8f0;border-top-color:#ba0000;border-radius:50%;animation:rkSpin 0.8s linear infinite;margin-bottom:8px;"></div>
          <div>Đang tải danh sách đặt sân từ cơ sở dữ liệu...</div>
        </div>
      `;
    }

    if (!window.axiosClient) {
      state.isLoading = false;
      state.bookings = [...FALLBACK_MOCK_BOOKINGS];
      state.selectedId = state.bookings[0].id;
      renderBookingsList();
      renderCheckoutPanel();
      return;
    }

    try {
      const params = {
        booking_date: targetDate,
        ...searchParams,
      };

      const res = await window.axiosClient.get("/reception/bookings", { params });

      if (res.data && Array.isArray(res.data)) {
        state.bookings = res.data.map(mapBookingFromAPI);

        if (state.bookings.length > 0) {
          if (!state.bookings.some((b) => b.id === state.selectedId)) {
            state.selectedId = state.bookings[0].id;
          }
        } else {
          state.selectedId = null;
        }

        renderBookingsList();
        renderCheckoutPanel();

        if (state.selectedId) {
          await loadServicesForBooking(state.selectedId);
        }
      }
    } catch (err) {
      console.warn("[Reception] Lỗi tải dữ liệu từ API:", err);
      showToast("⚠️ Không thể kết nối cơ sở dữ liệu. Đang hiển thị bản dữ liệu xem trước.");
      state.bookings = [...FALLBACK_MOCK_BOOKINGS];
      state.selectedId = state.bookings[0].id;
      renderBookingsList();
      renderCheckoutPanel();
    } finally {
      state.isLoading = false;
    }
  }

  // --- 5. Selected Booking & Totals ---
  function getSelectedBooking() {
    if (!state.selectedId) return null;
    return state.bookings.find((b) => b.id === state.selectedId) || null;
  }

  function calculateTotals(booking) {
    if (!booking) return { courtTotal: 0, servicesTotal: 0, grandTotal: 0, discount: 0 };
    const courtTotal = Number(booking.court_fee || 0);
    const servicesTotal = (booking.services || []).reduce(
      (sum, s) => sum + Number(s.amount || s.unit_price * s.qty || 0),
      0
    );
    const discount = Number(booking.discount_amount || 0);
    const grandTotal = Math.max(0, courtTotal + servicesTotal - discount);
    return { courtTotal, servicesTotal, grandTotal, discount };
  }

  // --- 6. Render Bookings List ---
  function renderBookingsList() {
    if (!el.bookingsList) return;

    // Filter by tab
    let filtered = state.bookings.filter((b) => {
      if (state.activeFilter === "upcoming") {
        return b.status === "Confirmed" || b.status === "Pending";
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
    const upcomingCount = state.bookings.filter(
      (b) => b.status === "Confirmed" || b.status === "Pending"
    ).length;
    const checkedinCount = state.bookings.filter((b) => b.status === "CHECKED_IN").length;

    el.filterTabs.forEach((tab) => {
      const filter = tab.dataset.filter;
      if (filter === "all") tab.textContent = `Tất cả  (${totalCount})`;
      if (filter === "upcoming") tab.textContent = `Sắp tới  (${upcomingCount})`;
      if (filter === "checkedin") tab.textContent = `Đã nhận sân  (${checkedinCount})`;
      tab.classList.toggle("active", filter === state.activeFilter);
    });

    if (el.bookingsCountLabel) {
      const isToday = state.selectedDate === getLocalDateISO();
      const prefix = isToday ? "Hôm nay" : `Ngày ${formatDisplayDate(state.selectedDate)}`;
      el.bookingsCountLabel.textContent = `${prefix} · ${totalCount} lượt đặt sân`;
    }

    if (filtered.length === 0) {
      const msg =
        totalCount === 0
          ? `Chưa có lượt đặt sân nào cho ngày ${formatDisplayDate(state.selectedDate)}.`
          : "Không tìm thấy lượt đặt sân nào phù hợp với bộ lọc.";
      el.bookingsList.innerHTML = `
        <div style="text-align:center;padding:36px 16px;color:var(--rk-text-muted);font-size:13px;">
          <div style="font-size:24px;margin-bottom:8px;">📋</div>
          <div>${msg}</div>
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
          actionBtn = `<button type="button" class="booking-action-btn btn-checkout" data-action="checkout" data-id="${b.id}">Thanh toán</button>`;
        } else if (b.status === "Completed") {
          statusBadge = `<span class="booking-status-tag status-tag-completed">Đã hoàn thành</span>`;
          actionBtn = `<button type="button" class="booking-action-btn btn-view-invoice" data-action="preview" data-id="${b.id}">Xem hóa đơn</button>`;
        } else if (b.status === "NO_SHOW") {
          statusBadge = `<span class="booking-status-tag" style="background:#fee2e2;color:#991b1b;">Vắng mặt</span>`;
          actionBtn = `<button type="button" class="booking-action-btn" data-action="preview" data-id="${b.id}" style="background:#f1f5f9;color:#64748b;">Chi tiết</button>`;
        } else {
          statusBadge = `<span class="booking-status-tag status-tag-confirmed">Đã xác nhận</span>`;
          actionBtn = `<button type="button" class="booking-action-btn btn-checkin" data-action="checkin" data-id="${b.id}">Nhận sân</button>`;
        }

        return `
          <div class="booking-item ${isSelected ? "selected" : ""}" data-booking-id="${b.id}">
            <div class="booking-item-header">
              <div class="booking-time-court">
                <span class="time-pill">${b.time_slot}</span>
                <span class="court-badge">${b.court_name}</span>
              </div>
              ${statusBadge}
            </div>
            <div class="booking-item-body">
              <div>
                <div class="booking-customer-name">${b.customer_name}</div>
                <div class="booking-customer-phone">${b.customer_phone} · <small style="color:#64748b;">${b.booking_code}</small></div>
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

  // --- 7. Render Checkout Panel ---
  function renderCheckoutPanel() {
    const booking = getSelectedBooking();

    if (!booking) {
      if (el.checkoutStatus) {
        el.checkoutStatus.className = "checkout-status-badge pending";
        el.checkoutStatus.textContent = "● Chưa chọn sân";
      }
      if (el.checkoutBookingCode) el.checkoutBookingCode.textContent = "---";
      if (el.checkoutCustName) el.checkoutCustName.textContent = "---";
      if (el.checkoutCustPhone) el.checkoutCustPhone.textContent = "---";
      if (el.checkoutCourtName) el.checkoutCourtName.textContent = "---";
      if (el.checkoutCheckinTime) el.checkoutCheckinTime.textContent = "---";
      if (el.courtFeeDesc) el.courtFeeDesc.textContent = "Chưa có lượt đặt sân được chọn";
      if (el.courtFeeFormula) el.courtFeeFormula.textContent = "0 giờ × 0";
      if (el.courtFeePrice) el.courtFeePrice.textContent = "0";
      if (el.servicesTableBody) {
        el.servicesTableBody.innerHTML = `
          <div style="padding:16px;color:var(--rk-text-muted);font-size:12px;font-style:italic;text-align:center;">
            Vui lòng chọn một lượt đặt sân ở danh sách bên trái.
          </div>
        `;
      }
      if (el.servicesSubtotal) el.servicesSubtotal.textContent = "0";
      if (el.discountInput) el.discountInput.value = "";
      if (el.grandTotal) el.grandTotal.textContent = "0";
      if (el.btnConfirmPayment) el.btnConfirmPayment.disabled = true;
      if (el.btnPrintPreview) el.btnPrintPreview.disabled = true;
      return;
    }

    if (el.btnConfirmPayment) el.btnConfirmPayment.disabled = false;
    if (el.btnPrintPreview) el.btnPrintPreview.disabled = false;

    const totals = calculateTotals(booking);

    // Status badge
    if (booking.status === "Completed") {
      el.checkoutStatus.className = "checkout-status-badge completed";
      el.checkoutStatus.innerHTML = "● Đã thanh toán";
      if (el.btnConfirmPayment) {
        el.btnConfirmPayment.textContent = "Đã thanh toán (Xem / In lại)";
      }
    } else if (booking.status === "CHECKED_IN") {
      el.checkoutStatus.className = "checkout-status-badge active";
      el.checkoutStatus.style.backgroundColor = "#dcfce7";
      el.checkoutStatus.style.color = "#15803d";
      el.checkoutStatus.innerHTML = "● Đang chơi · Chờ thanh toán";
      if (el.btnConfirmPayment) {
        el.btnConfirmPayment.textContent = "Thanh toán & in hóa đơn";
      }
    } else {
      el.checkoutStatus.className = "checkout-status-badge pending";
      el.checkoutStatus.innerHTML = "● Chờ nhận sân & thanh toán";
      if (el.btnConfirmPayment) {
        el.btnConfirmPayment.textContent = "Thanh toán & in hóa đơn";
      }
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

    // Discount input
    if (el.discountInput) {
      el.discountInput.value = booking.discount_amount > 0 ? formatMoney(booking.discount_amount) : "";
    }

    el.grandTotal.textContent = formatMoney(totals.grandTotal);

    // Cash calculator update
    renderCashCalculator(totals.grandTotal);
  }

  // --- 8. Render Cash Calculator ---
  function renderCashCalculator(grandTotal) {
    if (state.cashReceived === 0 || state.cashReceived < grandTotal) {
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

  // --- 9. Thermal Receipt Drawer ---
  function renderThermalReceipt() {
    const booking = getSelectedBooking();
    if (!booking) return;

    const totals = calculateTotals(booking);
    const now = new Date();
    const dateStr = `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;
    const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    el.receiptBookingCode.textContent = booking.invoice_code || booking.booking_code;
    el.receiptDate.textContent = dateStr;
    el.receiptTime.textContent = timeStr;
    el.receiptCustomer.textContent = booking.customer_name;
    el.receiptCourt.textContent = booking.court_name;
    el.receiptCheckin.textContent = booking.checked_in_at || "14:02";

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

    if (totals.discount > 0) {
      itemsHtml += `
        <div class="receipt-item-group" style="color:#b91c1c;">
          <div class="receipt-item-name">Chiết khấu / Giảm giá</div>
          <div class="receipt-item-calc">
            <span>-</span>
            <span>-${formatMoney(totals.discount)}</span>
          </div>
        </div>
      `;
    }

    el.receiptItemsList.innerHTML = itemsHtml;
    el.receiptTotal.textContent = formatMoney(totals.grandTotal);
    el.receiptTender.textContent = formatMoney(state.cashReceived);

    const change = Math.max(0, state.cashReceived - totals.grandTotal);
    el.receiptChange.textContent = formatMoney(change);

    if (booking.status === "Completed") {
      el.receiptPaymentStatus.textContent = `Hóa đơn đã được thanh toán (${state.paymentMethod === "BANK_TRANSFER" ? "Chuyển khoản VietQR" : "Tiền mặt"}).`;
    } else {
      el.receiptPaymentStatus.textContent = "Thanh toán chưa được xác nhận.";
    }
  }

  function openReceiptDrawer() {
    renderThermalReceipt();
    state.isReceiptOpen = true;
    el.modalOverlay.classList.add("open");
  }

  function closeReceiptDrawer() {
    state.isReceiptOpen = false;
    el.modalOverlay.classList.remove("open");
  }

  // --- 10. Check-in Action (POST /api/reception/bookings/{id}/check-in) ---
  async function handleCheckIn(bookingId) {
    const booking = state.bookings.find((b) => b.id === bookingId);
    if (!booking) return;

    if (window.axiosClient) {
      try {
        const res = await window.axiosClient.post(`/reception/bookings/${bookingId}/check-in`);
        if (res.data) {
          booking.status = res.data.status || "CHECKED_IN";
        } else {
          booking.status = "CHECKED_IN";
        }
        booking.checked_in_at = formatTime();
        state.selectedId = bookingId;
        renderBookingsList();
        renderCheckoutPanel();
        showToast(`✓ Đã nhận sân thành công cho ${booking.customer_name}!`);
        await loadServicesForBooking(bookingId);
      } catch (err) {
        const msg = err.response?.data?.detail || err.message || "Không thể nhận sân";
        showToast(`⚠️ Lỗi nhận sân: ${msg}`);
      }
    } else {
      booking.status = "CHECKED_IN";
      booking.checked_in_at = formatTime();
      state.selectedId = bookingId;
      renderBookingsList();
      renderCheckoutPanel();
      showToast(`✓ Đã nhận sân thành công cho ${booking.customer_name}!`);
    }
  }

  // --- 11. Checkout Action (POST /api/reception/bookings/{id}/checkout) ---
  async function handleConfirmPaymentAndPrint() {
    const booking = getSelectedBooking();
    if (!booking) return;

    if (booking.status === "Completed") {
      showToast("Booking này đã được thanh toán hoàn thành.");
      openReceiptDrawer();
      return;
    }

    const totals = calculateTotals(booking);

    if (window.axiosClient) {
      try {
        const payload = {
          payment_method: state.paymentMethod, // "CASH" | "BANK_TRANSFER"
          discount_amount: Number(booking.discount_amount) || 0,
          discount_reason:
            booking.discount_reason ||
            (booking.discount_amount > 0 ? "Chiết khấu lễ tân tại quầy" : null),
        };

        const res = await window.axiosClient.post(
          `/reception/bookings/${booking.id}/checkout`,
          payload
        );

        if (res.data) {
          booking.status = "Completed";
          if (res.data.invoice_code) {
            booking.invoice_code = res.data.invoice_code;
          }
        }
      } catch (err) {
        const msg = err.response?.data?.detail || err.message || "Thanh toán thất bại";
        showToast(`✕ Lỗi thanh toán: ${msg}`);
        return;
      }
    } else {
      booking.status = "Completed";
    }

    renderBookingsList();
    renderCheckoutPanel();
    renderThermalReceipt();
    showToast(`✓ Đã ghi nhận thanh toán ${formatMoney(totals.grandTotal)} VND!`);

    openReceiptDrawer();
    setTimeout(() => {
      window.print();
    }, 450);
  }

  // --- 12. Event Listeners ---
  function initEventListeners() {
    // Date filter change
    if (el.receptionDateInput) {
      el.receptionDateInput.value = state.selectedDate;
      el.receptionDateInput.addEventListener("change", (e) => {
        state.selectedDate = e.target.value || getLocalDateISO();
        loadBookingsFromAPI();
      });
    }

    // Quick today button
    if (el.btnTodayQuick) {
      el.btnTodayQuick.addEventListener("click", () => {
        state.selectedDate = getLocalDateISO();
        if (el.receptionDateInput) el.receptionDateInput.value = state.selectedDate;
        loadBookingsFromAPI();
      });
    }

    // Search input (Real-time filter + Enter key to query API)
    el.searchInput.addEventListener("input", (e) => {
      state.searchQuery = e.target.value;
      renderBookingsList();
    });

    el.searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const q = state.searchQuery.trim();
        loadBookingsFromAPI(state.selectedDate, {
          booking_code: q,
          phone: q,
        });
      }
    });

    // Filter tabs
    el.filterTabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        state.activeFilter = tab.dataset.filter;
        renderBookingsList();
      });
    });

    // Bookings list click delegation
    el.bookingsList.addEventListener("click", async (e) => {
      const actionBtn = e.target.closest("[data-action]");
      if (actionBtn) {
        e.stopPropagation();
        const action = actionBtn.dataset.action;
        const id = Number(actionBtn.dataset.id);
        if (action === "checkin") {
          await handleCheckIn(id);
        } else if (action === "checkout") {
          state.selectedId = id;
          renderBookingsList();
          renderCheckoutPanel();
          await loadServicesForBooking(id);
        } else if (action === "preview") {
          state.selectedId = id;
          renderBookingsList();
          renderCheckoutPanel();
          await loadServicesForBooking(id);
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
        await loadServicesForBooking(id);
      }
    });

    // Discount input
    if (el.discountInput) {
      el.discountInput.addEventListener("input", (e) => {
        const booking = getSelectedBooking();
        if (!booking) return;
        const val = parseMoney(e.target.value);
        booking.discount_amount = val;
        booking.discount_reason = val > 0 ? "Chiết khấu lễ tân tại quầy" : "";
        const totals = calculateTotals(booking);
        el.grandTotal.textContent = formatMoney(totals.grandTotal);
        renderCashCalculator(totals.grandTotal);
      });
      el.discountInput.addEventListener("blur", (e) => {
        const booking = getSelectedBooking();
        if (booking && booking.discount_amount > 0) {
          e.target.value = formatMoney(booking.discount_amount);
        }
      });
    }

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

    // Logout button handler
    document.addEventListener("click", (e) => {
      const btn = e.target.closest('[data-rk-action="logout"]');
      if (btn) {
        if (window.RK_AUTH && typeof window.RK_AUTH.logout === "function") {
          window.RK_AUTH.logout();
        }
        if (window.RK_NAV && typeof window.RK_NAV.go === "function") {
          window.RK_NAV.go(
            window.RK_CONFIG ? window.RK_CONFIG.loginURL : "login.html",
            true
          );
        } else {
          window.location.href = "login.html";
        }
      }
    });
  }

  // --- 13. Initialization ---
  document.addEventListener("DOMContentLoaded", async () => {
    cacheDOMElements();
    renderUserInfo();
    initEventListeners();
    await loadBookingsFromAPI();
  });
})();
