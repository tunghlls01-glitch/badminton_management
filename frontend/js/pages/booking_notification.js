const venues = {
  phutho: { name: "Sân cầu lông Phú Thọ", address: "219 Lý Thường Kiệt, Quận 11", price: 120000 },
  riverside: { name: "Pickleball Riverside", address: "28 Nguyễn Hữu Cảnh, Bình Thạnh", price: 180000 },
  tanphu: { name: "Sân cầu lông Tân Phú", address: "15 Tân Sơn Nhì, Tân Phú", price: 100000 }
};

const sampleBooking = {
  id: "261111003",
  court: "03",
  venue: "phutho",
  date: "2026-11-11",
  start: "18:00",
  duration: 2,
  status: "confirmed"
};
const queryId = new URLSearchParams(window.location.search).get("booking");
let bookings = [];

try {
  const saved = JSON.parse(localStorage.getItem("san-nha-bookings") || "[]");
  if (Array.isArray(saved)) {
    bookings = saved.filter(item =>
      item && venues[item.venue] &&
      /^\d{4}-\d{2}-\d{2}$/.test(item.date) &&
      /^\d{2}:\d{2}$/.test(item.start) &&
      Number(item.duration) > 0
    );
  }
} catch (error) {
  console.error("Không thể đọc lịch đặt sân đã lưu.", error);
}

const booking =
  bookings.find(item => String(item.id) === queryId) ||
  bookings.slice().reverse().find(item => item.status !== "done" && item.status !== "cancelled") ||
  bookings[bookings.length - 1] ||
  sampleBooking;
const venue = venues[booking.venue] || venues.phutho;
const duration = Number(booking.duration) || 1;
const reference = booking.booking_code || ("SN-" + String(booking.id).padStart(8, "0"));
const startMinutes = Number(booking.start.slice(0, 2)) * 60 + Number(booking.start.slice(3, 5));
const endMinutes = startMinutes + duration * 60;
const endTime = `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`;
const date = new Date(`${booking.date}T12:00:00`);
const dateLabel = date.toLocaleDateString("vi-VN", {
  weekday: "long",
  day: "2-digit",
  month: "2-digit",
  year: "numeric"
});
const durationLabel = `${String(duration).replace(".", ",")} giờ`;
const amount = new Intl.NumberFormat("vi-VN").format(venue.price * duration) + "đ";
const courtLabel = `${venue.name} · Sân ${booking.court}`;
const toast = document.getElementById("toast");
const dialog = document.getElementById("booking-dialog");
let toastTimer;

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 3500);
}

function setText(id, value) {
  document.getElementById(id).textContent = value;
}

setText("reference-code", reference);
setText("confirmation-court", `Sân ${booking.court}`);
setText("confirmation-venue", `${venue.name} · ${venue.address}`);
setText("confirmation-status", booking.status === "pending" ? "Chờ xác nhận" : "Đã xác nhận");
setText("confirmation-date", dateLabel);
setText("confirmation-time", `${booking.start} – ${endTime}`);
setText("confirmation-duration", `Thời lượng: ${durationLabel}`);
setText("confirmation-price-per-hour", new Intl.NumberFormat("vi-VN").format(venue.price) + "đ");
setText("confirmation-price-duration", durationLabel);
setText("confirmation-total", amount);
setText("dialog-reference", reference);
setText("dialog-court", courtLabel);
setText("dialog-venue", venue.address);
setText("dialog-date", date.toLocaleDateString("vi-VN"));
setText("dialog-time", `${booking.start} – ${endTime}`);
setText("dialog-total", `${amount} · Chưa thanh toán`);

document.getElementById("copy-reference").addEventListener("click", async () => {
  try {
    if (!navigator.clipboard || !window.isSecureContext) {
      throw new Error("Clipboard unavailable");
    }
    await navigator.clipboard.writeText(reference);
    showToast("Đã sao chép mã đặt sân.");
  } catch {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(document.getElementById("reference-code"));
    selection.removeAllRanges();
    selection.addRange(range);
    showToast("Đã chọn mã đặt sân. Nhấn Ctrl+C hoặc giữ để sao chép.");
  }
});

document.getElementById("view-booking").addEventListener("click", () => {
  window.location.href = `court_booking_schedule.html?booking=${encodeURIComponent(booking.id)}`;
});

document.getElementById("book-another").addEventListener("click", () => {
  window.location.href = "booking.html";
});

document.getElementById("close-dialog").addEventListener("click", () => dialog.close());
dialog.addEventListener("click", event => {
  if (event.target !== dialog) return;
  const rect = dialog.getBoundingClientRect();
  if (
    event.clientX < rect.left || event.clientX > rect.right ||
    event.clientY < rect.top || event.clientY > rect.bottom
  ) dialog.close();
});

document.getElementById("print-booking").addEventListener("click", () => {
  dialog.close();
  window.print();
});

function escapeCalendarText(text) {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

function toCalendarUtc(date, time) {
  const localDate = new Date(`${date}T${time}:00+07:00`);
  return localDate.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

document.getElementById("add-calendar").addEventListener("click", () => {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const calendarStart = toCalendarUtc(booking.date, booking.start);
  const endDate = new Date(new Date(`${booking.date}T${booking.start}:00+07:00`).getTime() + duration * 60 * 60 * 1000);
  const calendarEnd = endDate.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const content = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//San Nha//Booking Confirmation//VI",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${reference}@sannha.example`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${calendarStart}`,
    `DTEND:${calendarEnd}`,
    `SUMMARY:${escapeCalendarText("Chơi cầu lông - " + courtLabel)}`,
    `LOCATION:${escapeCalendarText(venue.address)}`,
    `DESCRIPTION:${escapeCalendarText(
      "Mã đặt sân: " + reference +
      "\nVui lòng có mặt trước 15 phút. Thanh toán " + amount + " tại sân."
    )}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT30M",
    "ACTION:DISPLAY",
    "DESCRIPTION:Chuẩn bị đến sân cầu lông",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
    ""
  ].join("\r\n");

  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${reference}.ics`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  showToast("Đã tải file lịch. Mở file .ics để thêm vào ứng dụng lịch.");
});
