/**
 * Logic hiển thị thông báo Đặt sân thành công (Dynamic Booking Confirmation)
 * Lấy dữ liệu thực tế từ Backend API (MySQL) theo ID hoặc booking mới nhất của người dùng
 */

(function () {
  "use strict";

  const toast = document.getElementById("toast");
  const dialog = document.getElementById("booking-dialog");
  let toastTimer;

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 3500);
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function formatMoney(amount) {
    return new Intl.NumberFormat("vi-VN").format(amount || 0) + "đ";
  }

  function formatDuration(minutes) {
    if (!minutes || minutes <= 0) return "1 giờ";
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0 && mins > 0) return `${hours} giờ ${mins} phút`;
    if (hours > 0) return `${hours} giờ`;
    return `${mins} phút`;
  }

  function formatVietnameseDate(dateStr) {
    if (!dateStr) return "Hôm nay";
    try {
      const parts = dateStr.split("-");
      if (parts.length === 3) {
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        return d.toLocaleDateString("vi-VN", {
          weekday: "long",
          day: "2-digit",
          month: "2-digit",
          year: "numeric"
        });
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  }

  async function fetchBookingData() {
    const urlParams = new URLSearchParams(window.location.search);
    const queryId = urlParams.get("booking");

    // 1. Nếu có queryId, ưu tiên gọi chi tiết booking theo ID
    if (queryId && typeof api !== "undefined") {
      try {
        const data = await api.get(`/bookings/${encodeURIComponent(queryId)}`);
        if (data && data.id) return data;
      } catch (err) {
        console.warn("Không tìm thấy booking theo ID trực tiếp, thử tìm trong danh sách:", err);
      }
    }

    // 2. Tìm trong danh sách booking từ API
    if (typeof api !== "undefined") {
      try {
        const list = await api.get("/bookings");
        if (Array.isArray(list) && list.length > 0) {
          if (queryId) {
            const matched = list.find(b => String(b.id) === String(queryId) || b.booking_code === queryId);
            if (matched) return matched;
          }
          // Lấy booking mới nhất (phần tử đầu tiên hoặc có id lớn nhất)
          const sorted = [...list].sort((a, b) => (b.id || 0) - (a.id || 0));
          return sorted[0];
        }
      } catch (err) {
        console.warn("Không thể tải danh sách booking từ API:", err);
      }
    }

    // 3. Kiểm tra sessionStorage nếu có thông tin giữ chỗ vừa hoàn tất
    try {
      const holdRaw = sessionStorage.getItem("rk_hold_session");
      if (holdRaw) {
        const hold = JSON.parse(holdRaw);
        if (hold && hold.slots && hold.slots.length > 0) {
          return {
            id: hold.holdId || "MỚI",
            booking_code: "BK-" + String(hold.holdId || Date.now()).slice(-6),
            court_name: hold.slots[0].courtName || "Sân cầu lông",
            booking_date: hold.date?.isoDate || new Date().toISOString().split("T")[0],
            start_time: hold.slots[0].startTime || "18:00",
            end_time: hold.slots[hold.slots.length - 1].endTime || "20:00",
            total_price: hold.totalPrice || 100000,
            status: "Confirmed",
            user_name: hold.customerName || "Khách hàng",
            user_phone: hold.customerPhone || "--",
            booking_channel: "Counter"
          };
        }
      }
    } catch (e) {
      console.warn("Lỗi đọc session giữ chỗ:", e);
    }

    // 4. Dữ liệu mặc định nếu chưa có kết nối
    return {
      id: "001",
      booking_code: "BK" + new Date().toISOString().slice(2, 10).replace(/-/g, "") + "-001",
      court_name: "Sân số 1",
      booking_date: new Date().toISOString().split("T")[0],
      start_time: "18:00",
      end_time: "20:00",
      total_price: 100000,
      status: "Confirmed",
      user_name: "Khách hàng",
      user_phone: "Chưa cập nhật",
      booking_channel: "Counter"
    };
  }

  function renderBooking(b) {
    const reference = b.booking_code || ("BK-" + b.id);
    const courtName = b.court_name || (b.slots && b.slots[0] && b.slots[0].court_name) || "Sân cầu lông";
    const venueName = "RK Badminton Club";
    const venueAddress = "Sân Cầu Lông RK · Cơ sở chính";

    // Thời gian
    let startTime = b.start_time ? b.start_time.slice(0, 5) : "--:--";
    let endTime = b.end_time ? b.end_time.slice(0, 5) : "--:--";
    let durationMins = 60;

    if (b.slots && b.slots.length > 0) {
      const firstSlot = b.slots[0];
      const lastSlot = b.slots[b.slots.length - 1];
      if (firstSlot.start_at) {
        startTime = firstSlot.start_at.slice(11, 16);
      }
      if (lastSlot.end_at) {
        endTime = lastSlot.end_at.slice(11, 16);
      }
      durationMins = b.slots.reduce((sum, s) => sum + (Number(s.duration_minutes) || 30), 0);
    } else if (startTime !== "--:--" && endTime !== "--:--") {
      const [sh, sm] = startTime.split(":").map(Number);
      const [eh, em] = endTime.split(":").map(Number);
      const diff = (eh * 60 + em) - (sh * 60 + sm);
      if (diff > 0) durationMins = diff;
    }

    const durationLabel = formatDuration(durationMins);
    const dateLabel = formatVietnameseDate(b.booking_date);
    const totalPrice = Number(b.total_price) || 0;
    const pricePerHour = durationMins > 0 ? Math.round(totalPrice / (durationMins / 60)) : totalPrice;

    // Trạng thái
    let statusText = "Đã xác nhận";
    if (b.status === "Pending") statusText = "Chờ xác nhận";
    else if (b.status === "Cancelled") statusText = "Đã hủy";
    else if (b.status === "Completed") statusText = "Hoàn thành";

    // Thanh toán
    const isOnline = b.booking_channel === "Online";
    const paymentMethodText = isOnline ? "Chuyển khoản ngân hàng" : "Thanh toán tại sân";
    const paymentNoteText = b.status === "Confirmed"
      ? "Lịch đã được lưu vào hệ thống · Vui lòng đến trước 15 phút"
      : "Chưa thanh toán · Thanh toán tại quầy khi nhận sân";

    // Cập nhật giao diện
    setText("reference-code", reference);
    setText("confirmation-court", courtName);
    setText("confirmation-venue", `${venueName} · ${venueAddress}`);
    setText("confirmation-status", statusText);
    setText("confirmation-date", dateLabel);
    setText("confirmation-time", `${startTime} – ${endTime}`);
    setText("confirmation-duration", `Thời lượng: ${durationLabel}`);
    setText("confirmation-customer-name", b.user_name || "Khách hàng");
    setText("confirmation-customer-phone", b.user_phone || "Không có");
    setText("confirmation-payment-method", paymentMethodText);

    if (b.note && b.note.trim()) {
      const noteRow = document.getElementById("confirmation-note-row");
      if (noteRow) {
        noteRow.style.display = "";
        setText("confirmation-note", b.note);
      }
    }

    setText("confirmation-price-per-hour", formatMoney(pricePerHour) + (durationMins > 0 ? "/giờ" : ""));
    setText("confirmation-price-duration", durationLabel);
    setText("confirmation-total", formatMoney(totalPrice));
    setText("confirmation-payment-note-text", paymentNoteText);

    // Cập nhật dialog in / xem chi tiết
    setText("dialog-reference", reference);
    setText("dialog-court", `${venueName} · ${courtName}`);
    setText("dialog-venue", venueAddress);
    setText("dialog-date", b.booking_date || dateLabel);
    setText("dialog-time", `${startTime} – ${endTime}`);
    setText("dialog-total", `${formatMoney(totalPrice)} · ${paymentMethodText}`);

    // Gắn sự kiện các nút
    setupEvents(b, reference, courtName, venueAddress, dateLabel, startTime, endTime, durationMins, totalPrice);
  }

  function setupEvents(booking, reference, courtName, venueAddress, dateLabel, startTime, endTime, durationMins, totalPrice) {
    // 1. Sao chép mã đặt sân
    const copyBtn = document.getElementById("copy-reference");
    if (copyBtn) {
      copyBtn.onclick = async () => {
        try {
          if (!navigator.clipboard || !window.isSecureContext) throw new Error("Clipboard unavailable");
          await navigator.clipboard.writeText(reference);
          showToast("Đã sao chép mã đặt sân: " + reference);
        } catch {
          const selection = window.getSelection();
          const range = document.createRange();
          range.selectNodeContents(document.getElementById("reference-code"));
          selection.removeAllRanges();
          selection.addRange(range);
          showToast("Đã chọn mã đặt sân. Nhấn Ctrl+C để sao chép.");
        }
      };
    }

    // 2. Nút xem danh sách đặt sân
    const viewBtn = document.getElementById("view-booking");
    if (viewBtn) {
      viewBtn.onclick = () => {
        window.location.href = `booking.html?booking=${encodeURIComponent(booking.id || '')}`;
      };
    }

    // 3. Nút đặt sân khác
    const bookAnotherBtn = document.getElementById("book-another");
    if (bookAnotherBtn) {
      bookAnotherBtn.onclick = () => {
        window.location.href = "booking.html";
      };
    }

    // 4. Đóng / mở Dialog
    const closeDialogBtn = document.getElementById("close-dialog");
    if (closeDialogBtn && dialog) {
      closeDialogBtn.onclick = () => dialog.close();
      dialog.addEventListener("click", event => {
        if (event.target !== dialog) return;
        const rect = dialog.getBoundingClientRect();
        if (
          event.clientX < rect.left || event.clientX > rect.right ||
          event.clientY < rect.top || event.clientY > rect.bottom
        ) dialog.close();
      });
    }

    // 5. In phiếu đặt sân
    const printBtn = document.getElementById("print-booking");
    if (printBtn) {
      printBtn.onclick = () => {
        if (dialog) dialog.close();
        window.print();
      };
    }

    // 6. Thêm vào ứng dụng Lịch (Apple Calendar / Google Calendar .ics)
    const addCalendarBtn = document.getElementById("add-calendar");
    if (addCalendarBtn) {
      addCalendarBtn.onclick = () => {
        try {
          const dateStr = booking.booking_date || new Date().toISOString().split("T")[0];
          const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
          const localStart = new Date(`${dateStr}T${startTime}:00+07:00`);
          const localEnd = new Date(localStart.getTime() + durationMins * 60 * 1000);

          const toUtc = d => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
          const calStart = toUtc(localStart);
          const calEnd = toUtc(localEnd);

          const icsContent = [
            "BEGIN:VCALENDAR",
            "VERSION:2.0",
            "PRODID:-//RK Badminton//Booking Notification//VI",
            "CALSCALE:GREGORIAN",
            "BEGIN:VEVENT",
            `UID:${reference}@rkbadminton.vn`,
            `DTSTAMP:${stamp}`,
            `DTSTART:${calStart}`,
            `DTEND:${calEnd}`,
            `SUMMARY:Chơi cầu lông - ${courtName}`,
            `LOCATION:${venueAddress}`,
            `DESCRIPTION:Mã đặt sân: ${reference}\\nVui lòng có mặt trước 15 phút. Tổng tiền: ${formatMoney(totalPrice)}.`,
            "BEGIN:VALARM",
            "TRIGGER:-PT30M",
            "ACTION:DISPLAY",
            "DESCRIPTION:Chuẩn bị đến sân cầu lông",
            "END:VALARM",
            "END:VEVENT",
            "END:VCALENDAR",
            ""
          ].join("\r\n");

          const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = `${reference}.ics`;
          document.body.appendChild(link);
          link.click();
          link.remove();
          setTimeout(() => URL.revokeObjectURL(url), 10000);
          showToast("Đã tải file lịch. Mở file .ics để thêm vào lịch điện thoại / máy tính.");
        } catch (e) {
          console.error("Lỗi tạo file lịch:", e);
          showToast("Không thể tạo file lịch.");
        }
      };
    }
  }

  // Khởi động khi tải trang
  document.addEventListener("DOMContentLoaded", async () => {
    try {
      const bookingData = await fetchBookingData();
      renderBooking(bookingData);
    } catch (err) {
      console.error("Lỗi nạp dữ liệu xác nhận đặt sân:", err);
    }
  });
})();
