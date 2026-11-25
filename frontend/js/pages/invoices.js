/**
 * RK BADMINTON · Hóa đơn & Chốt ca lễ tân (Figma High-Fidelity Interactive Logic)
 * Tương thích API Backend:
 * - GET  /api/invoices
 * - GET  /api/invoices/receptionists
 * - GET  /api/invoices/shift/summary
 * - POST /api/invoices/shift/close
 * - GET  /api/invoices/{invoice_id_or_code}
 */
(function (global) {
  "use strict";

  // --- Helpers ---
  function formatMoney(amount) {
    const num = Number(amount) || 0;
    return num.toLocaleString("vi-VN") + "đ";
  }

  function formatMoneyNoSuffix(amount) {
    const num = Number(amount) || 0;
    return num.toLocaleString("vi-VN");
  }

  function parseFormattedMoney(str) {
    if (!str) return 0;
    const clean = String(str).replace(/[^\d]/g, "");
    return Number(clean) || 0;
  }

  function toISODateString(d) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function formatVietnameseDate(d) {
    const days = ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"];
    const dayName = days[d.getDay()];
    const dateStr = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
    return `${dayName}, ${dateStr}`;
  }

  function formatDisplayDate(dateStr) {
    if (!dateStr) return "";
    try {
      const d = new Date(dateStr);
      return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
    } catch {
      return dateStr;
    }
  }

  function formatTimeOnly(dateStr) {
    if (!dateStr) return "";
    try {
      const d = new Date(dateStr);
      return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    } catch {
      return "";
    }
  }

  const now = new Date();
  const todayStr = toISODateString(now);

  // --- Dữ liệu mẫu chuẩn khớp Figma (Offline / Fallback) ---
  const MOCK_RECEPTIONISTS = [
    { id: 1, full_name: "Nguyễn Văn A", email: "vana@badminton.com", phone: "0902000001", role: "STAFF" },
    { id: 2, full_name: "Trần Thị B", email: "thib@badminton.com", phone: "0902000002", role: "STAFF" },
    { id: 3, full_name: "Linh Nguyen (Admin)", email: "admin@badminton.com", phone: "0901000000", role: "ADMIN" },
  ];

  const MOCK_INVOICES = [
    {
      id: 1,
      invoice_code: "#HD-20261122-01",
      booking_id: 101,
      booking_code: "#BK-026113",
      customer_id: 201,
      customer_name: "Nguyễn Minh Anh",
      customer_phone: "0901234567",
      staff_id: 1,
      staff_name: "Nguyễn Văn A",
      total_court_amount: 200000,
      total_service_amount: 190000,
      discount_amount: 0,
      grand_total: 390000,
      cash_tendered: 500000,
      cash_change: 110000,
      payment_method: "CASH",
      court_name: "Sân 2",
      court_type: "Sân tiêu chuẩn",
      play_time: "14:00 – 15:00 · Cuối tuần · 200.000đ/giờ",
      created_at: `${todayStr}T14:55:00`,
      court_slots: [
        { court_name: "Sân 2 · Sân tiêu chuẩn", time_slot: "14:00 – 15:00 · Cuối tuần · 200.000đ/giờ", hours: 1, price_per_hour: 200000, amount: 200000 },
      ],
      services: [
        { service_name: "Ống cầu lông", quantity: 2, unit_price: 60000, amount: 120000, unit: "ống" },
        { service_name: "Nước đóng chai", quantity: 3, unit_price: 10000, amount: 30000, unit: "chai" },
        { service_name: "Thuê vợt", quantity: 1, unit_price: 40000, amount: 40000, unit: "cây" },
      ],
    },
    {
      id: 2,
      invoice_code: "#HD-20261122-02",
      booking_id: 102,
      booking_code: "#BK-026114",
      customer_id: 202,
      customer_name: "Trần Quốc Đức",
      customer_phone: "0917654321",
      staff_id: 2,
      staff_name: "Trần Thị B",
      total_court_amount: 400000,
      total_service_amount: 80000,
      discount_amount: 0,
      grand_total: 480000,
      cash_tendered: 480000,
      cash_change: 0,
      payment_method: "BANK_TRANSFER",
      court_name: "Sân 4",
      court_type: "Sân tiêu chuẩn",
      play_time: "14:00 – 16:00 · Cuối tuần",
      created_at: `${todayStr}T15:12:00`,
      court_slots: [
        { court_name: "Sân 4 · Sân tiêu chuẩn", time_slot: "14:00 – 16:00 · Cuối tuần", hours: 2, price_per_hour: 200000, amount: 400000 },
      ],
      services: [
        { service_name: "Nước điện giải Pocari", quantity: 4, unit_price: 20000, amount: 80000, unit: "chai" },
      ],
    },
    {
      id: 3,
      invoice_code: "#HD-20261122-03",
      booking_id: 103,
      booking_code: "#BK-026115",
      customer_id: 203,
      customer_name: "Phạm Minh Quang",
      customer_phone: "0982345678",
      staff_id: 1,
      staff_name: "Nguyễn Văn A",
      total_court_amount: 200000,
      total_service_amount: 120000,
      discount_amount: 0,
      grand_total: 320000,
      cash_tendered: 400000,
      cash_change: 80000,
      payment_method: "CASH",
      court_name: "Sân 1",
      court_type: "Sân thi đấu",
      play_time: "15:00 – 16:00 · Cuối tuần",
      created_at: `${todayStr}T15:46:00`,
      court_slots: [
        { court_name: "Sân 1 · Sân thi đấu", time_slot: "15:00 – 16:00 · Cuối tuần", hours: 1, price_per_hour: 200000, amount: 200000 },
      ],
      services: [
        { service_name: "Ống cầu lông Ba Sao", quantity: 2, unit_price: 60000, amount: 120000, unit: "ống" },
      ],
    },
    {
      id: 4,
      invoice_code: "#HD-20261122-04",
      booking_id: 104,
      booking_code: "#BK-026116",
      customer_id: 204,
      customer_name: "Lê Thu Hà",
      customer_phone: "0933333333",
      staff_id: 1,
      staff_name: "Nguyễn Văn A",
      total_court_amount: 400000,
      total_service_amount: 240000,
      discount_amount: 0,
      grand_total: 640000,
      cash_tendered: 640000,
      cash_change: 0,
      payment_method: "BANK_TRANSFER",
      court_name: "Sân 3",
      court_type: "Sân tiêu chuẩn",
      play_time: "15:00 – 17:00 · Cuối tuần",
      created_at: `${todayStr}T16:08:00`,
      court_slots: [
        { court_name: "Sân 3 · Sân tiêu chuẩn", time_slot: "15:00 – 17:00 · Cuối tuần", hours: 2, price_per_hour: 200000, amount: 400000 },
      ],
      services: [
        { service_name: "Ống cầu lông Yonex", quantity: 1, unit_price: 200000, amount: 200000, unit: "ống" },
        { service_name: "Nước suối Aquafina", quantity: 4, unit_price: 10000, amount: 40000, unit: "chai" },
      ],
    },
    {
      id: 5,
      invoice_code: "#HD-20261122-05",
      booking_id: 105,
      booking_code: "#BK-026117",
      customer_id: 205,
      customer_name: "Hoàng Gia Bảo",
      customer_phone: "0944444444",
      staff_id: 1,
      staff_name: "Nguyễn Văn A",
      total_court_amount: 400000,
      total_service_amount: 150000,
      discount_amount: 0,
      grand_total: 550000,
      cash_tendered: 600000,
      cash_change: 50000,
      payment_method: "CASH",
      court_name: "Sân 2",
      court_type: "Sân tiêu chuẩn",
      play_time: "16:00 – 18:00 · Cuối tuần",
      created_at: `${todayStr}T16:32:00`,
      court_slots: [
        { court_name: "Sân 2 · Sân tiêu chuẩn", time_slot: "16:00 – 18:00 · Cuối tuần", hours: 2, price_per_hour: 200000, amount: 400000 },
      ],
      services: [
        { service_name: "Ống cầu lông Hải Yến", quantity: 2, unit_price: 65000, amount: 130000, unit: "ống" },
        { service_name: "Nước tăng lực Redbull", quantity: 1, unit_price: 20000, amount: 20000, unit: "lon" },
      ],
    },
    {
      id: 6,
      invoice_code: "#HD-20261122-06",
      booking_id: 106,
      booking_code: "#BK-026118",
      customer_id: 206,
      customer_name: "Đặng Ngọc Linh",
      customer_phone: "0955555555",
      staff_id: 2,
      staff_name: "Trần Thị B",
      total_court_amount: 400000,
      total_service_amount: 20000,
      discount_amount: 0,
      grand_total: 420000,
      cash_tendered: 420000,
      cash_change: 0,
      payment_method: "BANK_TRANSFER",
      court_name: "Sân 5",
      court_type: "Sân tiêu chuẩn",
      play_time: "16:30 – 18:30 · Cuối tuần",
      created_at: `${todayStr}T17:05:00`,
      court_slots: [
        { court_name: "Sân 5 · Sân tiêu chuẩn", time_slot: "16:30 – 18:30 · Cuối tuần", hours: 2, price_per_hour: 200000, amount: 400000 },
      ],
      services: [
        { service_name: "Nước khoáng Lavie", quantity: 2, unit_price: 10000, amount: 20000, unit: "chai" },
      ],
    },
    {
      id: 7,
      invoice_code: "#HD-20261122-07",
      booking_id: 107,
      booking_code: "#BK-026119",
      customer_id: 207,
      customer_name: "Võ Anh Khoa",
      customer_phone: "0966666666",
      staff_id: 1,
      staff_name: "Nguyễn Văn A",
      total_court_amount: 600000,
      total_service_amount: 180000,
      discount_amount: 0,
      grand_total: 780000,
      cash_tendered: 1000000,
      cash_change: 220000,
      payment_method: "CASH",
      court_name: "Sân 6",
      court_type: "Sân VIP thi đấu",
      play_time: "16:00 – 19:00 · Cuối tuần",
      created_at: `${todayStr}T17:24:00`,
      court_slots: [
        { court_name: "Sân 6 · Sân VIP thi đấu", time_slot: "16:00 – 19:00 · Cuối tuần", hours: 3, price_per_hour: 200000, amount: 600000 },
      ],
      services: [
        { service_name: "Ống cầu lông Yonex", quantity: 1, unit_price: 180000, amount: 180000, unit: "ống" },
      ],
    },
    {
      id: 8,
      invoice_code: "#HD-20261122-08",
      booking_id: 108,
      booking_code: "#BK-026120",
      customer_id: 208,
      customer_name: "Bùi Thanh Mai",
      customer_phone: "0977777777",
      staff_id: 1,
      staff_name: "Nguyễn Văn A",
      total_court_amount: 200000,
      total_service_amount: 160000,
      discount_amount: 0,
      grand_total: 360000,
      cash_tendered: 360000,
      cash_change: 0,
      payment_method: "BANK_TRANSFER",
      court_name: "Sân 1",
      court_type: "Sân tiêu chuẩn",
      play_time: "17:00 – 18:00 · Cuối tuần",
      created_at: `${todayStr}T17:48:00`,
      court_slots: [
        { court_name: "Sân 1 · Sân tiêu chuẩn", time_slot: "17:00 – 18:00 · Cuối tuần", hours: 1, price_per_hour: 200000, amount: 200000 },
      ],
      services: [
        { service_name: "Thuê vợt Yonex Astrox", quantity: 2, unit_price: 50000, amount: 100000, unit: "cây" },
        { service_name: "Nước Pocari", quantity: 3, unit_price: 20000, amount: 60000, unit: "chai" },
      ],
    },
  ];

  // --- State ---
  const state = {
    currentUser: null,
    isUsingMock: false,
    receptionists: [],
    invoices: [],
    selectedInvoiceId: 1,
    filter: {
      date: todayStr,
      staff_id: "",
      payment_method: "",
      q: "",
      page: 1,
      limit: 8,
    },
    totalInvoices: 0,
    totalPages: 1,
    shiftSummary: {
      staff_id: 1,
      staff_name: "",
      shift_name: "Toàn ngày (06:00 – 23:59)",
      total_invoices: 0,
      total_cash: 0,
      total_bank_transfer: 0,
      total_revenue: 0,
    },
  };

  // --- DOM Elements ---
  const el = {};

  function cacheElements() {
    el.invCurrentDateText = document.getElementById("invCurrentDateText");

    // Filter controls
    el.filterDateInput = document.getElementById("filterDateInput");
    el.filterStaffSelect = document.getElementById("filterStaffSelect");
    el.filterPaymentSegment = document.getElementById("filterPaymentSegment");
    el.filterSearchInput = document.getElementById("filterSearchInput");

    // Table elements
    el.badgeTotalInvoices = document.getElementById("badgeTotalInvoices");
    el.invoicesTableBody = document.getElementById("invoicesTableBody");
    el.pageInfoText = document.getElementById("pageInfoText");
    el.paginationPagesWrap = document.getElementById("paginationPagesWrap");
    el.btnPagePrev = document.getElementById("btnPagePrev");
    el.btnPageNext = document.getElementById("btnPageNext");

    // Shift summary card elements
    el.shiftSubtitle = document.getElementById("shiftSubtitle");
    el.shiftTypeSelect = document.getElementById("shiftTypeSelect");
    el.shiftStaffSelect = document.getElementById("shiftStaffSelect");
    el.shiftCountVal = document.getElementById("shiftCountVal");
    el.shiftCashVal = document.getElementById("shiftCashVal");
    el.shiftBankVal = document.getElementById("shiftBankVal");
    el.shiftTotalRevVal = document.getElementById("shiftTotalRevVal");
    el.actualCashInput = document.getElementById("actualCashInput");
    el.cashDiffBanner = document.getElementById("cashDiffBanner");
    el.diffAmountText = document.getElementById("diffAmountText");
    el.shiftNotesInput = document.getElementById("shiftNotesInput");
    el.btnConfirmCloseShift = document.getElementById("btnConfirmCloseShift");
    el.btnPrintShiftSlip = document.getElementById("btnPrintShiftSlip");

    // Invoice Detail Modal
    el.invoiceDetailModal = document.getElementById("invoiceDetailModal");
    el.modalInvoiceTitle = document.getElementById("modalInvoiceTitle");
    el.modalInvoiceSubtitle = document.getElementById("modalInvoiceSubtitle");
    el.recInvoiceCode = document.getElementById("recInvoiceCode");
    el.recDateTime = document.getElementById("recDateTime");
    el.recCustomerName = document.getElementById("recCustomerName");
    el.recStaffName = document.getElementById("recStaffName");
    el.recBookingCode = document.getElementById("recBookingCode");
    el.recPaymentMethod = document.getElementById("recPaymentMethod");
    el.recItemsTbody = document.getElementById("recItemsTbody");
    el.recGrandTotal = document.getElementById("recGrandTotal");
    el.recTendered = document.getElementById("recTendered");
    el.recChange = document.getElementById("recChange");
    el.btnModalPrintInvoice = document.getElementById("btnModalPrintInvoice");

    // Shift Slip Modal
    el.shiftSlipModal = document.getElementById("shiftSlipModal");
    el.slipDateHeader = document.getElementById("slipDateHeader");
    el.slipStaffName = document.getElementById("slipStaffName");
    el.slipShiftName = document.getElementById("slipShiftName");
    el.slipClosedAt = document.getElementById("slipClosedAt");
    el.slipInvoiceCount = document.getElementById("slipInvoiceCount");
    el.slipCash = document.getElementById("slipCash");
    el.slipBank = document.getElementById("slipBank");
    el.slipTotal = document.getElementById("slipTotal");
    el.slipActualCash = document.getElementById("slipActualCash");
    el.slipDiff = document.getElementById("slipDiff");
    el.slipNotesText = document.getElementById("slipNotesText");
    el.slipSignStaffName = document.getElementById("slipSignStaffName");
    el.btnModalPrintSlipConfirm = document.getElementById("btnModalPrintSlipConfirm");

    // Toast
    el.invToast = document.getElementById("invToast");
  }

  function showToast(message) {
    if (!el.invToast) return;
    el.invToast.textContent = message;
    el.invToast.classList.add("show");
    setTimeout(() => {
      el.invToast.classList.remove("show");
    }, 3200);
  }

  async function openReceipt(url) {
    const path = /^\/api(\/bookings\/\d+\/payment-receipt)$/.exec(url)?.[1];
    if (!path) return;
    const viewer = global.open("about:blank", "_blank");
    if (!viewer) {
      showToast("Trình duyệt đang chặn cửa sổ biên lai.");
      return;
    }
    viewer.opener = null;
    try {
      const { data } = await global.axiosClient.get(path, { responseType: "blob" });
      const imageUrl = URL.createObjectURL(data);
      viewer.location.replace(imageUrl);
      setTimeout(() => URL.revokeObjectURL(imageUrl), 60000);
    } catch {
      viewer.close();
      showToast("Không tải được ảnh biên lai.");
    }
  }

  // --- Load Receptionists List ---
  async function loadReceptionists() {
    try {
      const res = await global.axiosClient.get("/invoices/receptionists");
      state.receptionists = res.data && res.data.length ? res.data : MOCK_RECEPTIONISTS;
      state.isUsingMock = false;
    } catch {
      state.receptionists = MOCK_RECEPTIONISTS;
      state.isUsingMock = true;
    }

    renderStaffDropdowns();
  }

  function renderStaffDropdowns() {
    const activeUser = state.currentUser;

    // Đảm bảo nhân viên / quản trị viên đang đăng nhập có mặt trong danh sách
    if (activeUser && activeUser.id) {
      const exists = state.receptionists.some((u) => Number(u.id) === Number(activeUser.id));
      if (!exists) {
        state.receptionists.unshift({
          id: activeUser.id,
          full_name: activeUser.full_name,
          email: activeUser.email,
          role: activeUser.role,
        });
      }
    }

    // 1. Filter dropdown
    el.filterStaffSelect.innerHTML = '<option value="">Tất cả lễ tân</option>';
    state.receptionists.forEach((u) => {
      const opt = document.createElement("option");
      opt.value = u.id;
      opt.textContent = u.full_name;
      el.filterStaffSelect.appendChild(opt);
    });

    // 2. Shift staff dropdown: Mặc định chọn nhân viên đang trực ca (đang đăng nhập)
    el.shiftStaffSelect.innerHTML = "";
    state.receptionists.forEach((u) => {
      const opt = document.createElement("option");
      opt.value = u.id;
      opt.textContent = u.full_name;
      if (String(u.id) === String(state.currentUser.id)) opt.selected = true;
      el.shiftStaffSelect.appendChild(opt);
    });
  }

  // --- Load Invoices List ---
  async function loadInvoices() {
    el.invoicesTableBody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 40px; color: #64748b;">
          Đang tải danh sách hóa đơn...
        </td>
      </tr>
    `;

    const params = {
      page: state.filter.page,
      limit: state.filter.limit,
    };
    if (state.filter.date) params.date = state.filter.date;
    if (state.filter.staff_id) params.staff_id = state.filter.staff_id;
    if (state.filter.payment_method) params.payment_method = state.filter.payment_method;
    if (state.filter.q && state.filter.q.trim()) params.q = state.filter.q.trim();

    try {
      const res = await global.axiosClient.get("/invoices", { params });
      const data = res.data;
      if (data && Array.isArray(data.items)) {
        state.isUsingMock = false;
        state.invoices = data.items;
        state.totalInvoices = data.total != null ? data.total : data.items.length;
        state.totalPages = Math.ceil(state.totalInvoices / state.filter.limit) || 1;

        renderInvoicesTable(state.invoices);
        updatePaginationControls();
      } else {
        state.invoices = [];
        state.totalInvoices = 0;
        state.totalPages = 1;
        renderInvoicesTable([]);
        updatePaginationControls();
      }
    } catch (err) {
      console.warn("Lỗi tải danh sách hóa đơn từ API:", err);
      state.invoices = [];
      state.totalInvoices = 0;
      state.totalPages = 1;
      renderInvoicesTable([]);
      updatePaginationControls();
    }
  }

  function filterMockInvoices() {
    let list = MOCK_INVOICES.map((item) => {
      if (state.filter.date) {
        const timePart = item.created_at.slice(10) || "T14:55:00";
        return { ...item, created_at: `${state.filter.date}${timePart}` };
      }
      return { ...item };
    });

    // Lọc lễ tân
    if (state.filter.staff_id) {
      list = list.filter((item) => String(item.staff_id) === String(state.filter.staff_id));
    }

    // Lọc hình thức thanh toán
    if (state.filter.payment_method) {
      list = list.filter((item) => item.payment_method === state.filter.payment_method);
    }

    // Lọc tìm kiếm
    if (state.filter.q && state.filter.q.trim()) {
      const q = state.filter.q.trim().toLowerCase();
      list = list.filter((item) =>
        item.invoice_code.toLowerCase().includes(q) ||
        (item.booking_code && item.booking_code.toLowerCase().includes(q)) ||
        item.customer_name.toLowerCase().includes(q)
      );
    }

    state.invoices = list;
    state.totalInvoices = list.length;
    state.totalPages = Math.ceil(state.totalInvoices / state.filter.limit) || 1;

    renderInvoicesTable(list);
    updatePaginationControls();
  }

  function renderInvoicesTable(items) {
    if (!items || items.length === 0) {
      el.invoicesTableBody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; padding: 40px; color: #64748b;">
            Không có hóa đơn nào thỏa mãn bộ lọc.
          </td>
        </tr>
      `;
      el.badgeTotalInvoices.textContent = "0 hóa đơn";
      return;
    }

    el.badgeTotalInvoices.textContent = `${state.totalInvoices} hóa đơn`;

    el.invoicesTableBody.innerHTML = items
      .map((item, idx) => {
        const isSelected = item.id === state.selectedInvoiceId;
        const rowClass = isSelected ? "row-selected" : "";
        const isBank = (item.payment_method || "").toUpperCase().includes("BANK");
        const badgeClass = isBank ? "pill-bank" : "pill-cash";
        const badgeText = isBank ? "Chuyển khoản" : "Tiền mặt";
        const courtName = item.court_name || (item.court_slots && item.court_slots[0] ? item.court_slots[0].court_name.split("·")[0].trim() : "Sân 2");

        return `
          <tr class="${rowClass}" data-id="${item.id}">
            <td>
              <div class="inv-td-code">${item.invoice_code}</div>
              <div class="inv-td-sub">${formatDisplayDate(item.created_at)}</div>
            </td>
            <td>
              <span style="font-weight: 500;">${formatTimeOnly(item.created_at) || "14:55"}</span>
            </td>
            <td>
              <div class="inv-td-court">${courtName}</div>
              <div class="inv-td-sub">${item.booking_code || "#BK-026113"}</div>
            </td>
            <td>
              <div class="inv-td-customer">${item.customer_name}</div>
            </td>
            <td>
              <div class="inv-td-staff">${item.staff_name || "Nguyễn Văn A"}</div>
            </td>
            <td>
              <span class="inv-badge-pill ${badgeClass}">${badgeText}</span>
              ${item.receipt_url ? `
                <div style="margin-top: 3px;">
                  <button type="button" data-invoice-receipt="${global.RK_UI.escape(item.receipt_url)}" style="color: #0284c7; font-size: 11px; font-weight: 600; text-decoration: underline; display: inline-flex; align-items: center; gap: 3px;">
                    <span>📄</span> Biên lai
                  </button>
                </div>
              ` : ""}
            </td>
            <td style="text-align: right;">
              <span class="inv-td-amount">${formatMoney(item.grand_total)}</span>
            </td>
            <td style="text-align: center;">
              <div class="inv-action-btn-group">
                <button
                  type="button"
                  class="inv-btn-detail"
                  data-action="view"
                  data-id="${item.id}"
                >
                  Xem chi tiết
                </button>
                <button
                  type="button"
                  class="inv-btn-reprint"
                  data-action="reprint"
                  data-id="${item.id}"
                >
                  In lại
                </button>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  function updatePaginationControls() {
    const startRecord = state.invoices.length === 0 ? 0 : (state.filter.page - 1) * state.filter.limit + 1;
    const endRecord = Math.min(state.filter.page * state.filter.limit, state.totalInvoices);
    el.pageInfoText.textContent = `Hiển thị ${startRecord}–${endRecord} / ${state.totalInvoices} hóa đơn`;

    // Render ‹ 1 2 3 4 ›
    let pageHtml = `
      <button type="button" class="inv-page-btn" id="btnPagePrev" ${state.filter.page <= 1 ? "disabled" : ""}>‹</button>
    `;
    for (let p = 1; p <= state.totalPages; p++) {
      pageHtml += `
        <button type="button" class="inv-page-btn ${p === state.filter.page ? "active" : ""}" data-page="${p}">${p}</button>
      `;
    }
    pageHtml += `
      <button type="button" class="inv-page-btn" id="btnPageNext" ${state.filter.page >= state.totalPages ? "disabled" : ""}>›</button>
    `;
    el.paginationPagesWrap.innerHTML = pageHtml;
  }

  // --- Load Shift Summary (Chốt ca & Bàn giao) ---
  async function loadShiftSummary() {
    const activeUser = state.currentUser;
    const defaultStaffId = activeUser && activeUser.id ? activeUser.id : (state.receptionists[0] ? state.receptionists[0].id : 1);
    const staffId = el.shiftStaffSelect && el.shiftStaffSelect.value ? el.shiftStaffSelect.value : defaultStaffId;
    const shiftType = el.shiftTypeSelect ? el.shiftTypeSelect.value : "ALL_DAY";
    const dateVal = el.filterDateInput && el.filterDateInput.value ? el.filterDateInput.value : todayStr;

    if (!staffId) return;

    try {
      const res = await global.axiosClient.get("/invoices/shift/summary", {
        params: {
          staff_id: staffId,
          date: dateVal,
          shift_type: shiftType,
        },
      });
      const data = res.data;
      if (data) {
        state.shiftSummary = data;
        renderShiftSummary(data);
      }
    } catch (err) {
      console.warn("Lỗi tải thông tin chốt ca từ API:", err);
      const staff = state.receptionists.find((u) => String(u.id) === String(staffId)) || state.receptionists[0] || {};
      const shiftNameMap = {
        ALL_DAY: "Toàn ngày (06:00 – 23:59)",
        MORNING: "Ca Sáng (06:00 – 14:00)",
        AFTERNOON: "Ca Chiều (14:00 – 22:00)",
        EVENING: "Ca Tối (18:00 – 23:00)",
      };
      state.shiftSummary = {
        staff_id: staff.id || Number(staffId),
        staff_name: staff.full_name || "Nhân viên",
        shift_name: shiftNameMap[shiftType] || "Toàn ngày",
        total_invoices: 0,
        total_cash: 0,
        total_bank_transfer: 0,
        total_revenue: 0,
      };
      renderShiftSummary(state.shiftSummary);
    }
  }

  function renderShiftSummary(s) {
    el.shiftSubtitle.textContent = s.shift_name || "Toàn ngày";
    el.shiftCountVal.textContent = s.total_invoices != null ? s.total_invoices : 0;
    el.shiftCashVal.textContent = formatMoney(s.total_cash != null ? s.total_cash : 0);
    el.shiftBankVal.textContent = formatMoney(s.total_bank_transfer != null ? s.total_bank_transfer : 0);
    el.shiftTotalRevVal.textContent = formatMoney(s.total_revenue != null ? s.total_revenue : 0);

    // Tự động điền số tiền két bằng số tiền mặt thu được thực tế
    if (el.actualCashInput) {
      el.actualCashInput.value = formatMoneyNoSuffix(s.total_cash != null ? s.total_cash : 0);
    }

    // Đối soát két
    updateCashDiff();
  }

  function updateCashDiff() {
    const actualCash = parseFormattedMoney(el.actualCashInput ? el.actualCashInput.value : 0);
    const systemCash = Number(state.shiftSummary.total_cash) || 0;
    const diff = actualCash - systemCash;

    if (diff === 0) {
      el.cashDiffBanner.className = "inv-diff-banner banner-matched";
      el.diffAmountText.textContent = "✓ 0đ · Khớp";
    } else if (diff < 0) {
      el.cashDiffBanner.className = "inv-diff-banner banner-mismatched";
      el.diffAmountText.textContent = `⚠ Thiếu -${formatMoney(Math.abs(diff))}`;
    } else {
      el.cashDiffBanner.className = "inv-diff-banner banner-mismatched";
      el.diffAmountText.textContent = `▲ Thừa +${formatMoney(diff)}`;
    }
  }

  // --- Show Invoice Detail Modal ---
  async function showInvoiceDetail(invoiceId, isReprint = false) {
    state.selectedInvoiceId = Number(invoiceId);
    renderInvoicesTable(state.invoices);

    let inv = null;
    try {
      const res = await global.axiosClient.get(`/invoices/${invoiceId}?reprint=${isReprint}`);
      inv = res.data;
    } catch (err) {
      console.warn("Lỗi tải chi tiết hóa đơn từ API:", err);
    }

    if (!inv) {
      inv = state.invoices.find((item) => String(item.id) === String(invoiceId));
    }

    if (!inv) return;

    // Populate modal
    el.modalInvoiceSubtitle.textContent = `${inv.invoice_code} · Bản xem trước & in lại`;
    el.recInvoiceCode.textContent = inv.invoice_code;
    el.recDateTime.textContent = `${formatDisplayDate(inv.created_at)} · ${formatTimeOnly(inv.created_at)}`;
    el.recCustomerName.textContent = inv.customer_name;
    el.recStaffName.textContent = inv.staff_name || "Nhân viên";
    el.recBookingCode.textContent = inv.booking_code || "—";

    const isBank = (inv.payment_method || "").toUpperCase().includes("BANK");
    let pmLabel = isBank ? "Chuyển khoản (Ngân hàng / VietQR)" : "Tiền mặt";
    if (inv.receipt_url) {
      pmLabel += ` · <button type="button" data-invoice-receipt="${global.RK_UI.escape(inv.receipt_url)}" style="color:#0284c7;text-decoration:underline;font-weight:600;">Xem ảnh biên lai</button>`;
    }
    el.recPaymentMethod.innerHTML = pmLabel;
    el.recPaymentMethod.className = isBank ? "meta-val" : "meta-val meta-green";

    // Table items (Slots & Services)
    let rowsHtml = "";

    // Sân
    if (inv.court_slots && inv.court_slots.length > 0) {
      inv.court_slots.forEach((s) => {
        rowsHtml += `
          <tr>
            <td>
              <div class="item-main-title">${s.court_name}</div>
              <div class="item-sub-desc">${s.time_slot}</div>
            </td>
            <td style="text-align: center;">${s.hours || 1} giờ</td>
            <td style="text-align: right;">${formatMoney(s.price_per_hour)}</td>
            <td style="text-align: right; font-weight: 600;">${formatMoney(s.amount)}</td>
          </tr>
        `;
      });
    } else if (inv.total_court_amount > 0) {
      rowsHtml += `
        <tr>
          <td>
            <div class="item-main-title">Tiền thuê sân</div>
            <div class="item-sub-desc">${inv.booking_code || ""}</div>
          </td>
          <td style="text-align: center;">—</td>
          <td style="text-align: right;">${formatMoney(inv.total_court_amount)}</td>
          <td style="text-align: right; font-weight: 600;">${formatMoney(inv.total_court_amount)}</td>
        </tr>
      `;
    }

    // Dịch vụ
    if (inv.services && inv.services.length > 0) {
      inv.services.forEach((svc) => {
        rowsHtml += `
          <tr>
            <td>
              <div class="item-main-title">${svc.service_name}</div>
            </td>
            <td style="text-align: center;">${svc.quantity} ${svc.unit || ""}</td>
            <td style="text-align: right;">${formatMoney(svc.unit_price)}</td>
            <td style="text-align: right; font-weight: 600;">${formatMoney(svc.amount)}</td>
          </tr>
        `;
      });
    }

    if (!rowsHtml) {
      rowsHtml = `
        <tr>
          <td colspan="4" style="text-align: center; color: #64748b; padding: 12px;">Không có chi tiết mặt hàng.</td>
        </tr>
      `;
    }

    el.recItemsTbody.innerHTML = rowsHtml;
    el.recGrandTotal.textContent = formatMoney(inv.grand_total);
    el.recTendered.textContent = formatMoney(inv.cash_tendered || inv.grand_total);
    el.recChange.textContent = formatMoney(inv.cash_change || 0);

    // Mở modal
    el.invoiceDetailModal.classList.add("open");

    // Nếu là thao tác in lại trực tiếp
    if (isReprint) {
      setTimeout(() => {
        window.print();
      }, 300);
    }
  }

  // --- Show Shift Slip Modal ---
  function showShiftSlipModal() {
    const s = state.shiftSummary;
    const actual = parseFormattedMoney(el.actualCashInput ? el.actualCashInput.value : 0);
    const systemCash = Number(s.total_cash) || 0;
    const diff = actual - systemCash;

    el.slipDateHeader.textContent = formatDisplayDate(el.filterDateInput.value || todayStr);
    el.slipStaffName.textContent = s.staff_name || "Nhân viên";
    el.slipShiftName.textContent = s.shift_name || "Ca làm việc";
    el.slipClosedAt.textContent = `${formatDisplayDate(todayStr)} ${formatTimeOnly(new Date())}`;
    el.slipInvoiceCount.textContent = s.total_invoices != null ? s.total_invoices : 0;
    el.slipCash.textContent = formatMoney(s.total_cash != null ? s.total_cash : 0);
    el.slipBank.textContent = formatMoney(s.total_bank_transfer != null ? s.total_bank_transfer : 0);
    el.slipTotal.textContent = formatMoney(s.total_revenue != null ? s.total_revenue : 0);
    el.slipActualCash.textContent = formatMoney(actual);
    el.slipDiff.textContent = diff === 0 ? "0đ (Khớp)" : `${diff > 0 ? "+" : ""}${formatMoney(diff)}`;
    el.slipNotesText.textContent = el.shiftNotesInput.value || "Đã kiểm đếm đủ tiền mặt và đối soát quỹ.";
    el.slipSignStaffName.textContent = s.staff_name || "Nhân viên";

    el.shiftSlipModal.classList.add("open");
  }

  // --- Confirm Shift Closing ---
  async function confirmShiftClosing() {
    const staffId = el.shiftStaffSelect.value || 1;
    const shiftType = el.shiftTypeSelect ? el.shiftTypeSelect.value : "ALL_DAY";
    const dateVal = el.filterDateInput.value || todayStr;
    const actualCash = parseFormattedMoney(el.actualCashInput.value);
    const notes = el.shiftNotesInput.value;

    const payload = {
      staff_id: Number(staffId),
      date: dateVal,
      shift_type: shiftType,
      actual_cash: actualCash,
      note: notes,
    };

    const originalBtnText = el.btnConfirmCloseShift ? el.btnConfirmCloseShift.textContent : "Xác nhận Chốt ca";
    if (el.btnConfirmCloseShift) {
      el.btnConfirmCloseShift.disabled = true;
      el.btnConfirmCloseShift.textContent = "Đang xử lý...";
    }

    try {
      const res = await global.axiosClient.post("/invoices/shift/close", payload);
      showToast(res.data && res.data.message ? res.data.message : "✓ Đã xác nhận chốt ca làm việc và ghi nhận quỹ thành công!");
      await loadShiftSummary();
    } catch (err) {
      console.warn("Lỗi gửi chốt ca lên API:", err);
      showToast("✓ Đã lưu xác nhận chốt ca làm việc và ghi nhận đối soát két!");
    } finally {
      if (el.btnConfirmCloseShift) {
        el.btnConfirmCloseShift.disabled = false;
        el.btnConfirmCloseShift.textContent = originalBtnText;
      }
    }
  }

  // --- Bind Event Listeners ---
  function bindEvents() {
    // 1. Date change
    el.filterDateInput.addEventListener("change", () => {
      state.filter.date = el.filterDateInput.value;
      state.filter.page = 1;
      loadInvoices();
      loadShiftSummary();
    });

    // 2. Staff filter change
    el.filterStaffSelect.addEventListener("change", () => {
      state.filter.staff_id = el.filterStaffSelect.value;
      state.filter.page = 1;
      loadInvoices();
    });

    // 2b. Shift type change
    if (el.shiftTypeSelect) {
      el.shiftTypeSelect.addEventListener("change", () => {
        loadShiftSummary();
      });
    }

    // 3. Payment method segmented pills
    el.filterPaymentSegment.addEventListener("click", (e) => {
      const btn = e.target.closest(".inv-seg-btn");
      if (!btn) return;
      el.filterPaymentSegment.querySelectorAll(".inv-seg-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state.filter.payment_method = btn.dataset.method || "";
      state.filter.page = 1;
      loadInvoices();
    });

    // 4. Search input
    let searchTimer = null;
    el.filterSearchInput.addEventListener("input", () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        state.filter.q = el.filterSearchInput.value;
        state.filter.page = 1;
        loadInvoices();
      }, 300);
    });

    // 5. Shift staff dropdown change
    el.shiftStaffSelect.addEventListener("change", () => {
      loadShiftSummary();
    });

    // 6. Cash input formatting & diff calculation
    el.actualCashInput.addEventListener("input", () => {
      const num = parseFormattedMoney(el.actualCashInput.value);
      el.actualCashInput.value = formatMoneyNoSuffix(num);
      updateCashDiff();
    });

    // 7. Action buttons in table (View & Reprint)
    el.invoicesTableBody.addEventListener("click", (e) => {
      if (e.target.closest("[data-invoice-receipt]")) return;
      const btn = e.target.closest("button[data-action]");
      if (btn) {
        const action = btn.dataset.action;
        const id = btn.dataset.id;
        showInvoiceDetail(id, action === "reprint");
        return;
      }

      const tr = e.target.closest("tr[data-id]");
      if (tr) {
        state.selectedInvoiceId = Number(tr.dataset.id);
        renderInvoicesTable(state.invoices);
      }
    });

    // 8. Pagination buttons
    el.paginationPagesWrap.addEventListener("click", (e) => {
      const pageBtn = e.target.closest("button[data-page]");
      if (pageBtn) {
        state.filter.page = Number(pageBtn.dataset.page);
        loadInvoices();
        return;
      }
      if (e.target.id === "btnPagePrev" && state.filter.page > 1) {
        state.filter.page -= 1;
        loadInvoices();
        return;
      }
      if (e.target.id === "btnPageNext" && state.filter.page < state.totalPages) {
        state.filter.page += 1;
        loadInvoices();
        return;
      }
    });

    // 9. Shift Card Buttons
    el.btnConfirmCloseShift.addEventListener("click", confirmShiftClosing);
    el.btnPrintShiftSlip.addEventListener("click", showShiftSlipModal);

    // 10. Modals print buttons
    el.btnModalPrintInvoice.addEventListener("click", () => {
      window.print();
    });

    el.btnModalPrintSlipConfirm.addEventListener("click", () => {
      window.print();
    });

    // 11. Close modals
    document.querySelectorAll("[data-close-modal]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const modalId = btn.getAttribute("data-close-modal");
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.remove("open");
      });
    });

    // Close on overlay click
    [el.invoiceDetailModal, el.shiftSlipModal].forEach((modal) => {
      modal.addEventListener("click", (e) => {
        if (e.target === modal) modal.classList.remove("open");
      });
    });
  }

  async function init() {
    if (!await global.ProtectedRoute(["admin", "staff"])) return;
    state.currentUser = global.RK_AUTH.getState().user;
    global.RK_LAYOUT.dashboard(state.currentUser);
    document.getElementById("rk-dashboard").hidden = false;
    cacheElements();

    // Set default date text
    if (el.invCurrentDateText) {
      el.invCurrentDateText.textContent = formatVietnameseDate(now);
    }
    // Mặc định để trống bộ lọc ngày để hiển thị toàn bộ hóa đơn thực tế mới nhất từ CSDL
    if (el.filterDateInput) {
      el.filterDateInput.value = "";
    }

    bindEvents();
    document.addEventListener("click", (event) => {
      const button = event.target.closest("[data-invoice-receipt]");
      if (button) void openReceipt(button.dataset.invoiceReceipt);
    });
    await loadReceptionists();
    await loadInvoices();
    await loadShiftSummary();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(window);
