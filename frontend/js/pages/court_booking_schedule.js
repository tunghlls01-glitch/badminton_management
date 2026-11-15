const storageKey = "san-nha-bookings";
const venues = {
  phutho: { name: "Sân cầu lông Phú Thọ", address: "219 Lý Thường Kiệt, Quận 11" },
  riverside: { name: "Pickleball Riverside", address: "28 Nguyễn Hữu Cảnh, Bình Thạnh" },
  tanphu: { name: "Sân cầu lông Tân Phú", address: "15 Tân Sơn Nhì, Tân Phú" }
};
const initial = [
  { id: 1, venue: "phutho", court: "03", date: "2026-11-10", start: "18:00", duration: 2, status: "confirmed" },
  { id: 2, venue: "riverside", court: "02", date: "2026-11-12", start: "16:00", duration: 2, status: "pending" },
  { id: 3, venue: "tanphu", court: "01", date: "2026-11-14", start: "18:00", duration: 2, status: "confirmed" },
  { id: 4, venue: "phutho", court: "02", date: "2026-11-09", start: "14:00", duration: 2, status: "done" }
];

function isValidBooking(booking) {
  return booking && venues[booking.venue] &&
    /^\d{4}-\d{2}-\d{2}$/.test(booking.date) &&
    /^\d{2}:\d{2}$/.test(booking.start) &&
    Number(booking.duration) > 0 &&
    ["confirmed", "pending", "done", "cancelled"].includes(booking.status);
}

function loadBookings() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (Array.isArray(saved) && saved.every(isValidBooking)) return saved;
  } catch (error) {
    console.error("Không thể đọc lịch đặt sân đã lưu.", error);
  }
  return initial;
}

const bookings = loadBookings();

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
dateInput.min = todayIso;
dateInput.value = todayIso;

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
  const next = getNextBooking();
  const nextSection = $(".next-booking");
  if (!nextSection) return;

  if (!next) {
    nextSection.innerHTML = `
      <span class="next-label">Lượt đặt tiếp theo</span>
      <h2>Chưa có lượt đặt</h2>
      <p>Sân Nhà · Chưa có lượt đặt sắp tới</p>
      <div class="next-info">
        <div><small>NGÀY CHƠI</small><strong>--/--</strong></div>
        <div><small>KHUNG GIỜ</small><strong>--:--</strong></div>
      </div>
      <button class="button" data-book>Đặt sân ngay <span aria-hidden="true">+</span></button>
    `;
    return;
  }

  const dateObj = parseDate(next.date);
  const dayStr = `${weekday(dateObj)}, ${String(dateObj.getDate()).padStart(2, "0")}/${String(dateObj.getMonth() + 1).padStart(2, "0")}`;
  const timeStr = `${time(next.start)} – ${endTime(next)}`;

  nextSection.innerHTML = `
    <span class="next-label">Lượt đặt tiếp theo</span>
    <h2>${venues[next.venue].name} · Sân ${next.court}</h2>
    <p>${venues[next.venue].address}</p>
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
    ["06:00", "08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00"]
      .map(value => `<span>${value}</span>`).join("") + "</div>";

  for (let index = 0; index < 7; index++) {
    const date = new Date(start);
    date.setDate(date.getDate() + index);
    const current = iso(date) === "2026-11-11";

    header += `<div class="day ${current ? "current" : ""}">
      ${index === 6 ? "CN" : "THỨ " + (index + 2)}
      <strong>${String(date.getDate()).padStart(2, "0")}</strong>
    </div>`;

    body += `<div class="column ${current ? "current" : ""}">`;
    bookings.filter(booking => booking.date === iso(date)).forEach(booking => {
      const startMinutes = Number(booking.start.slice(0, 2)) * 60 + Number(booking.start.slice(3, 5));
      const top = (startMinutes - 360) / 960 * 100;
      const height = Math.min(
        Math.max(booking.duration / 16 * 100, 14),
        100 - top
      );
      const nextBooking = getNextBooking();
      const className = booking.status === "done" ? "done" :
        (nextBooking && booking.id === nextBooking.id) ? "next" : "";

      body += `<button class="event ${className}"
        style="top:${top}%;height:${height}%"
        data-detail="${booking.id}"
        aria-label="Sân ${booking.court}, ${time(booking.start)} đến ${endTime(booking)}">
        ${time(booking.start)} – ${endTime(booking)}
        <b>Sân ${booking.court}</b>
      </button>`;
    });
    body += "</div>";
  }

  $("#calendar-header").innerHTML = header;
  $("#calendar-body").innerHTML = body;
}

function renderList() {
  const rows = bookings
    .filter(booking =>
      filter === "upcoming" ? isUpcoming(booking) :
      filter === "done" ? booking.status === "done" :
      booking.status === "cancelled"
    )
    .sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));

  $("#booking-list").innerHTML = rows.length ? rows.map(booking => {
    const date = parseDate(booking.date);
    return `<article class="booking-row">
      <div class="date-box">
        <small>THÁNG ${date.getMonth() + 1}</small>
        <strong>${date.getDate()}</strong>
      </div>
      <div>
        <div class="booking-name">${venues[booking.venue].name} · Sân ${booking.court}</div>
        <div class="booking-place">${venues[booking.venue].address}</div>
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
    String(bookings.filter(isUpcoming).length).padStart(2, "0");

  $("#booking-total").textContent =
    String(bookings.length).padStart(2, "0") + " lượt đặt";

  const start = new Date(baseDate);
  start.setDate(start.getDate() + weekOffset * 7);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const hours = bookings
    .filter(booking => booking.date >= iso(start) && booking.date <= iso(end) && booking.status !== "cancelled")
    .reduce((total, booking) => total + booking.duration, 0);

  $("#total-hours").innerHTML = String(hours).replace(".", ",") + " <small>giờ</small>";
}

function showDetail(id) {
  const booking = bookings.find(item => item.id === Number(id));
  if (!booking) return;
  const date = parseDate(booking.date);

  $("#detail-content").innerHTML = `
    <div class="detail-line"><span>Mã lượt đặt</span><strong>SN-${String(booking.id).padStart(8, "0")}</strong></div>
    <div class="detail-line"><span>Sân</span><strong>${venues[booking.venue].name} · Sân ${booking.court}</strong></div>
    <div class="detail-line"><span>Địa chỉ</span><strong>${venues[booking.venue].address}</strong></div>
    <div class="detail-line"><span>Ngày chơi</span><strong>${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}</strong></div>
    <div class="detail-line"><span>Khung giờ</span><strong>${time(booking.start)} – ${endTime(booking)}</strong></div>
    <div class="detail-line"><span>Trạng thái</span><strong>${booking.status === "done" ? "Đã hoàn thành" : booking.status === "cancelled" ? "Đã hủy" : booking.status === "pending" ? "Chờ xác nhận" : "Đã xác nhận"}</strong></div>
    <p class="subtitle">Vui lòng có mặt trước giờ chơi 15 phút.</p>`;

  $("#detail-modal").showModal();
}

document.addEventListener("click", event => {
  if (event.target.closest("[data-book]")) {
    event.preventDefault();
    $("#booking-modal").showModal();
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
  const courtId = Number(court) || 1;

  let backendBookingId = null;
  let backendBookingCode = null;

  if (typeof api !== "undefined") {
    try {
      const payload = {
        court_id: courtId,
        booking_date: date,
        start_time: startStr,
        end_time: endStr,
        customer_name: "Minh Anh",
        customer_phone: "0912345678",
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

renderCalendar();
renderList();
updateNextBookingCard();