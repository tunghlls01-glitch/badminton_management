const storageKey = "san-nha-bookings";

// ── Đọc thông tin user đang đăng nhập từ session ──────────────────────────
function getLoggedInUser() {
  try {
    const raw = localStorage.getItem('user') || sessionStorage.getItem('user');
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return null;
}
function getUserInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
function getRoleLabel(role) {
  if (!role) return 'Thành viên Sân Nhà';
  if (role === 'admin') return 'Quản trị viên';
  if (role === 'staff') return 'Nhân viên';
  return 'Thành viên Sân Nhà';
}
function applyUserUI() {
  const u = getLoggedInUser();
  const name = u?.full_name || 'Chưa đăng nhập';
  const initials = getUserInitials(u?.full_name);
  const role = getRoleLabel(u?.role);
  const el = document.getElementById('scheduleName');
  const av = document.getElementById('scheduleAvatar');
  const rl = document.getElementById('scheduleRole');
  if (el) el.textContent = name;
  if (av) av.textContent = initials;
  if (rl) rl.textContent = role;
}

let dbCourts = [];
let selectedCourtFilter = "all";

const initial = [];

function loadBookings() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (Array.isArray(saved)) {
      return saved.filter(b => b && (b.court_id || b.booking_code));
    }
  } catch (error) {
    console.error("Không thể đọc lịch đặt sân đã lưu.", error);
  }
  return [];
}

let bookings = loadBookings();

const getCourtName = b => {
  if (b.court_name) return b.court_name;
  const found = dbCourts.find(c => Number(c.id) === Number(b.court_id || b.court));
  if (found) return found.name || found.court_name || `Sân ${found.id}`;
  return `Sân ${b.court || b.court_id || 1}`;
};

const baseDate = new Date(2026, 10, 9);
let weekOffset = 0;
let filter = "upcoming";
let toastTimer;

const $ = selector => document.querySelector(selector);
const time = value => {
  if (typeof value === "string") return value;
  return `${String(Math.floor(value)).padStart(2, "0")}:${value % 1 ? "30" : "00"}`;
};
const endTime = booking => {
  const startMinutes = Number(booking.start.slice(0, 2)) * 60 + Number(booking.start.slice(3, 5));
  const endMinutes = startMinutes + Number(booking.duration) * 60;
  return `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`;
};
const parseDate = value => new Date(value + "T12:00:00");
const iso = date =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const weekday = date =>
  ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"][date.getDay()];
const isUpcoming = booking => {
  const currentDate = iso(new Date());
  return booking.status !== "done" && booking.status !== "cancelled" &&
    (booking.date > currentDate || (booking.date === currentDate && booking.start >= new Date().toTimeString().slice(0, 5)));
};
const dateInput = $("#booking-form [name='date']");
const today = new Date();
const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
if (dateInput) {
  dateInput.min = todayIso;
  dateInput.value = todayIso;
}

function toast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("#toast").classList.remove("show"), 3500);
}

function getNextBooking() {
  const upcoming = bookings
    .filter(isUpcoming)
    .sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
  return upcoming.length ? upcoming[0] : null;
}

const requestedBookingId = new URLSearchParams(window.location.search).get("booking");
const focusedBooking = bookings.find(booking => String(booking.id) === requestedBookingId) || getNextBooking();
if (focusedBooking) {
  const focusedDate = parseDate(focusedBooking.date);
  const dayDifference = Math.round(
    (Date.UTC(focusedDate.getFullYear(), focusedDate.getMonth(), focusedDate.getDate()) -
     Date.UTC(2026, 10, 9)) / 86400000
  );
  weekOffset = Math.floor(dayDifference / 7);
}

function updateNextBookingCard() {
  const validCourtIds = new Set(dbCourts.map(c => Number(c.id)));
  const next = bookings
    .filter(b => (validCourtIds.size === 0 || !b.court_id || validCourtIds.has(Number(b.court_id))) && isUpcoming(b))
    .sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start))[0];
  const nextSection = $(".next-booking");
  if (!nextSection) return;

  if (!next) {
    nextSection.innerHTML = `
      <span class="next-label">Lượt đặt tiếp theo</span>
      <h2>Chưa có lượt đặt</h2>
      <p>Sân thể thao Sân Nhà · Chưa có lượt đặt sắp tới</p>
      <div class="next-info">
        <div><small>NGÀY CHƠI</small><strong>--/--</strong></div>
        <div><small>KHUNG GIỜ</small><strong>--:--</strong></div>
      </div>
      <button class="button" data-book>Đặt sân ngay <span aria-hidden="true">+</span></button>
    `;
    return;
  }

  const courtTitle = getCourtName(next);
  const dateObj = parseDate(next.date);
  const dayStr = `${weekday(dateObj)}, ${String(dateObj.getDate()).padStart(2, "0")}/${String(dateObj.getMonth() + 1).padStart(2, "0")}`;
  const timeStr = `${time(next.start)} – ${endTime(next)}`;

  nextSection.innerHTML = `
    <span class="next-label">Lượt đặt tiếp theo</span>
    <h2>${courtTitle}</h2>
    <p>Sân thể thao Sân Nhà</p>
    <div class="next-info">
      <div><small>NGÀY CHƠI</small><strong>${dayStr}</strong></div>
      <div><small>KHUNG GIỜ</small><strong>${timeStr}</strong></div>
    </div>
    <button class="button" data-detail="${next.id}">Xem chi tiết lượt đặt <span aria-hidden="true">→</span></button>
  `;
}

function renderCalendar() {
  const start = new Date(baseDate);
  start.setDate(start.getDate() + weekOffset * 7);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);

  $("#date-range").textContent =
    `${start.getDate()}/${start.getMonth() + 1} – ${end.getDate()}/${end.getMonth() + 1}/${end.getFullYear()}`;
  $("#calendar-month").textContent =
    `Tháng ${end.getMonth() + 1}, ${end.getFullYear()}`;
  $("#summary-week-range").textContent =
    `${String(start.getDate()).padStart(2, "0")} – ${String(end.getDate()).padStart(2, "0")} tháng ${end.getMonth() + 1}, ${end.getFullYear()}`;

  let header = "<div></div>";
  let body = '<div class="times">' +
    ["06:00", "08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00", "22:00"]
      .map(value => `<span>${value}</span>`).join("") + "</div>";

  // Lọc chỉ những sân có trong database
  const validCourtIds = new Set(dbCourts.map(c => Number(c.id)));

  for (let index = 0; index < 7; index++) {
    const date = new Date(start);
    date.setDate(date.getDate() + index);
    const current = iso(date) === iso(new Date());

    header += `<div class="day ${current ? "current" : ""}">
      ${index === 6 ? "CN" : "THỨ " + (index + 2)}
      <strong>${String(date.getDate()).padStart(2, "0")}</strong>
    </div>`;

    body += `<div class="column ${current ? "current" : ""}">`;

    const dayBookings = bookings.filter(b => {
      if (b.date !== iso(date) || b.status === "cancelled") return false;
      const cId = Number(b.court_id || b.court);
      // Chỉ hiển thị sân có trong database
      if (validCourtIds.size > 0 && !validCourtIds.has(cId)) return false;
      // Nếu có chọn lọc 1 sân cụ thể
      if (selectedCourtFilter !== "all" && Number(selectedCourtFilter) !== cId) return false;
      return true;
    });

    dayBookings.forEach(booking => {
      const startMinutes = Number(booking.start.slice(0, 2)) * 60 + Number(booking.start.slice(3, 5) || 0);
      const top = Math.max(0, Math.min(95, (startMinutes - 360) / 960 * 100));
      const height = Math.min(
        Math.max(booking.duration / 16 * 100, 14),
        100 - top
      );
      const nextBooking = getNextBooking();
      const className = booking.status === "done" ? "done" :
        (nextBooking && booking.id === nextBooking.id) ? "next" : "";

      const courtTitle = getCourtName(booking);

      body += `<button class="event ${className}"
        style="top:${top}%;height:${height}%"
        data-detail="${booking.id}"
        aria-label="${courtTitle}, ${time(booking.start)} đến ${endTime(booking)}">
        ${time(booking.start)} – ${endTime(booking)}
        <b>${courtTitle}</b>
      </button>`;
    });
    body += "</div>";
  }

  $("#calendar-header").innerHTML = header;
  $("#calendar-body").innerHTML = body;
}

function renderList() {
  const validCourtIds = new Set(dbCourts.map(c => Number(c.id)));
  const rows = bookings
    .filter(b => {
      if (validCourtIds.size > 0 && b.court_id && !validCourtIds.has(Number(b.court_id))) return false;
      return filter === "upcoming" ? isUpcoming(b) :
        filter === "done" ? b.status === "done" :
        b.status === "cancelled";
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));

  $("#booking-list").innerHTML = rows.length ? rows.map(booking => {
    const date = parseDate(booking.date);
    const courtTitle = getCourtName(booking);
    return `<article class="booking-row">
      <div class="date-box">
        <small>THÁNG ${date.getMonth() + 1}</small>
        <strong>${date.getDate()}</strong>
      </div>
      <div>
        <div class="booking-name">${courtTitle}</div>
        <div class="booking-place">Sân thể thao Sân Nhà</div>
      </div>
      <div class="time-info">
          ${time(booking.start)} – ${endTime(booking)}
        <small>${weekday(date)} · ${String(booking.duration).replace(".", ",")} giờ chơi</small>
      </div>
        <span class="status">${booking.status === "done" ? "Đã hoàn thành" : booking.status === "cancelled" ? "Đã hủy" : booking.status === "pending" ? "Chờ xác nhận" : "Đã xác nhận"}</span>
      <button class="detail-button" data-detail="${booking.id}">Chi tiết →</button>
    </article>`;
  }).join("") : '<div class="empty">Bạn chưa có lượt đặt nào trong mục này.</div>';

  $("#upcoming-count").textContent =
    String(bookings.filter(b => (validCourtIds.size === 0 || !b.court_id || validCourtIds.has(Number(b.court_id))) && isUpcoming(b)).length).padStart(2, "0");

  $("#booking-total").textContent =
    String(bookings.filter(b => validCourtIds.size === 0 || !b.court_id || validCourtIds.has(Number(b.court_id))).length).padStart(2, "0") + " lượt đặt";

  const start = new Date(baseDate);
  start.setDate(start.getDate() + weekOffset * 7);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const hours = bookings
    .filter(booking => booking.date >= iso(start) && booking.date <= iso(end) && booking.status !== "cancelled" && (validCourtIds.size === 0 || !booking.court_id || validCourtIds.has(Number(booking.court_id))))
    .reduce((total, booking) => total + booking.duration, 0);

  $("#total-hours").innerHTML = String(hours).replace(".", ",") + " <small>giờ</small>";
}

function showDetail(id) {
  const booking = bookings.find(item => item.id === Number(id));
  if (!booking) return;
  const date = parseDate(booking.date);
  const courtTitle = getCourtName(booking);

  $("#detail-content").innerHTML = `
    <div class="detail-line"><span>Mã lượt đặt</span><strong>${booking.booking_code || ('SN-' + String(booking.id).padStart(8, "0"))}</strong></div>
    <div class="detail-line"><span>Sân</span><strong>${courtTitle}</strong></div>
    <div class="detail-line"><span>Địa điểm</span><strong>Sân thể thao Sân Nhà</strong></div>
    <div class="detail-line"><span>Ngày chơi</span><strong>${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}</strong></div>
    <div class="detail-line"><span>Khung giờ</span><strong>${time(booking.start)} – ${endTime(booking)}</strong></div>
    <div class="detail-line"><span>Trạng thái</span><strong>${booking.status === "done" ? "Đã hoàn thành" : booking.status === "cancelled" ? "Đã hủy" : booking.status === "pending" ? "Chờ xác nhận" : "Đã xác nhận"}</strong></div>
    <p class="subtitle">Vui lòng có mặt trước giờ chơi 15 phút.</p>`;

  $("#detail-modal").showModal();
}

document.addEventListener("click", event => {
  if (event.target.closest("[data-book]")) {
    event.preventDefault();
    window.location.href = "./timeline_grid.html";
    return;
  }

  const detail = event.target.closest("[data-detail]");
  if (detail) showDetail(detail.dataset.detail);

  const close = event.target.closest("[data-close]");
  if (close) close.closest("dialog").close();

  const tab = event.target.closest("[data-filter]");
  if (tab) {
    filter = tab.dataset.filter;
    document.querySelectorAll(".tab").forEach(button => {
      const active = button === tab;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    renderList();
  }
});

$("#previous-week").onclick = () => { weekOffset--; renderCalendar(); };
$("#next-week").onclick = () => { weekOffset++; renderCalendar(); };
$("#today").onclick = () => { weekOffset = 0; renderCalendar(); };
$("#support-link").onclick = event => {
  event.preventDefault();
  toast("Đây là giao diện demo. Hãy cấu hình thông tin hỗ trợ của bạn.");
};

$("#booking-form").onsubmit = async event => {
  event.preventDefault();
  const data = new FormData(event.target);
  const court = data.get("court");
  const date = data.get("date");
  const start = data.get("start");
  const duration = Number(data.get("duration"));
  const startMinutes = Number(start.split(":")[0]) * 60 + Number(start.split(":")[1]);

  if (startMinutes + duration * 60 > 22 * 60) {
    toast("Sân đóng cửa lúc 22:00. Vui lòng chọn giờ sớm hơn.");
    return;
  }

  const endMinutes = startMinutes + duration * 60;
  const endStr = `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}:00`;
  const startStr = `${start}:00`;

  const courtSelect = event.target.querySelector("[name='court']");
  const selectedCourtOpt = courtSelect ? courtSelect.selectedOptions[0] : null;
  const courtId = selectedCourtOpt && selectedCourtOpt.dataset.id ? Number(selectedCourtOpt.dataset.id) : (Number(court) || 1);

  let backendBookingId = null;
  let backendBookingCode = null;

  if (typeof api !== "undefined") {
    try {
      const _currentUser = getLoggedInUser();
      const payload = {
        court_id: courtId,
        booking_date: date,
        start_time: startStr,
        end_time: endStr,
        customer_name: _currentUser?.full_name || '',
        customer_phone: _currentUser?.phone || '',
        booking_channel: "Counter",
        note: `Đặt tại Sân cầu lông Phú Thọ (Sân ${court})`
      };
      const res = await api.post("/bookings", payload);
      backendBookingId = res.id;
      backendBookingCode = res.booking_code;
    } catch (apiErr) {
      console.error("Lỗi khi lưu vào Database MySQL:", apiErr);
      toast(apiErr.message || "Lỗi khi lưu vào cơ sở dữ liệu!");
      return;
    }
  }

  const booking = {
    id: backendBookingId || Date.now(),
    booking_code: backendBookingCode,
    venue: "phutho",
    court,
    date,
    start,
    duration,
    status: "confirmed"
  };
  bookings.push(booking);

  try {
    localStorage.setItem(storageKey, JSON.stringify(bookings));
  } catch (error) {
    bookings.pop();
    console.error("Không thể lưu lượt đặt sân.", error);
    toast("Không thể lưu lượt đặt vào trình duyệt. Vui lòng kiểm tra dung lượng hoặc quyền lưu trữ.");
    return;
  }

  window.location.href = `booking_notification.html?booking=${encodeURIComponent(booking.id)}`;
};

document.querySelectorAll("dialog").forEach(dialog => {
  dialog.addEventListener("click", event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (
      event.clientX < rect.left || event.clientX > rect.right ||
      event.clientY < rect.top || event.clientY > rect.bottom
    ) dialog.close();
  });
});

// Đồng bộ danh sách booking từ backend MySQL về giao diện
async function fetchBookingsFromBackend() {
  if (typeof api === "undefined") return;
  try {
    const list = await api.get("/bookings");
    if (Array.isArray(list) && list.length > 0) {
      const apiBookings = [];
      list.forEach(item => {
        if (item.slots && item.slots.length > 0) {
          item.slots.forEach(slot => {
            const startDt = new Date(slot.start_at);
            const endDt = new Date(slot.end_at);
            const dateStr = slot.start_at.slice(0, 10);
            const startStr = slot.start_at.slice(11, 16);
            let duration = (endDt - startDt) / 3600000;
            if (isNaN(duration) || duration <= 0) duration = (slot.duration_minutes || 120) / 60;
            const courtNum = (slot.court_name ? slot.court_name.replace(/\D/g, "") : "") || String(slot.court_id || 1).padStart(2, "0");

            apiBookings.push({
              id: item.id,
              slot_id: slot.id,
              booking_code: item.booking_code,
              court_id: slot.court_id,
              court_name: slot.court_name,
              court: courtNum.padStart(2, "0"),
              date: dateStr,
              start: startStr,
              duration: duration,
              status: item.status ? item.status.toLowerCase() : "confirmed",
              total_price: slot.amount || (item.total_price / item.slots.length),
              customer_name: item.user_name,
              customer_phone: item.user_phone
            });
          });
        } else {
          const startStr = item.start_time ? item.start_time.slice(0, 5) : "18:00";
          let duration = 2;
          if (item.start_time && item.end_time) {
            const sMin = Number(item.start_time.slice(0, 2)) * 60 + Number(item.start_time.slice(3, 5));
            const eMin = Number(item.end_time.slice(0, 2)) * 60 + Number(item.end_time.slice(3, 5));
            if (eMin > sMin) duration = (eMin - sMin) / 60;
          }
          const courtNum = item.court_name ? item.court_name.replace(/\D/g, "") || String(item.court_id || 1).padStart(2, "0") : String(item.court_id || 1).padStart(2, "0");

          apiBookings.push({
            id: item.id,
            booking_code: item.booking_code,
            court_id: item.court_id,
            court_name: item.court_name,
            court: courtNum.padStart(2, "0"),
            date: item.booking_date || iso(new Date()),
            start: startStr,
            duration: duration,
            status: item.status ? item.status.toLowerCase() : "confirmed",
            total_price: item.total_price,
            customer_name: item.user_name,
            customer_phone: item.user_phone
          });
        }
      });

      bookings = apiBookings;
      try { localStorage.setItem(storageKey, JSON.stringify(bookings)); } catch (_) {}
      renderCalendar();
      renderList();
      updateNextBookingCard();
    }
  } catch (err) {
    console.warn("Chưa tải được bookings từ server trong schedule:", err);
  }
}

// Nạp danh sách sân từ backend vào form đặt sân & thanh lọc
async function loadCourtsFromBackend() {
  if (typeof api === "undefined") return;
  try {
    const list = await api.get("/courts");
    if (!Array.isArray(list) || list.length === 0) return;
    dbCourts = list;

    // 1. Dropdown form đặt sân
    const courtSelect = $("#booking-form [name='court']");
    if (courtSelect) {
      courtSelect.innerHTML = dbCourts.map(c => {
        const title = c.name || c.court_name || `Sân ${c.id}`;
        const isActive = c.status === "Active" || c.status === "HOẠT ĐỘNG";
        return `<option value="${c.id}" data-id="${c.id}" ${isActive ? "" : "disabled"}>${title}${isActive ? "" : " (Bảo trì)"}</option>`;
      }).join("");
    }

    // 2. Render các nút lọc sân trên đầu bảng lịch tuần
    renderScheduleCourtFilterTabs();

    // 3. Render lại lịch tuần chỉ với các sân trong database
    renderCalendar();
    renderList();
    updateNextBookingCard();
  } catch (err) {
    console.warn("Chưa tải được danh sách sân từ backend:", err);
  }
}

function renderScheduleCourtFilterTabs() {
  const container = $("#scheduleCourtFilterBar");
  if (!container) return;

  let html = `<button type="button" class="court-filter-btn ${selectedCourtFilter === 'all' ? 'active' : ''}" data-court="all">Tất cả sân (${dbCourts.length})</button>`;
  dbCourts.forEach(c => {
    const isAct = selectedCourtFilter === String(c.id);
    const title = c.name || c.court_name || `Sân ${c.id}`;
    html += `<button type="button" class="court-filter-btn ${isAct ? 'active' : ''}" data-court="${c.id}">${title}</button>`;
  });
  container.innerHTML = html;

  container.querySelectorAll(".court-filter-btn").forEach(btn => {
    btn.onclick = () => {
      selectedCourtFilter = btn.dataset.court;
      container.querySelectorAll(".court-filter-btn").forEach(b => b.classList.toggle("active", b === btn));
      renderCalendar();
    };
  });
}

renderCalendar();
renderList();
updateNextBookingCard();
fetchBookingsFromBackend();
loadCourtsFromBackend();
applyUserUI();
