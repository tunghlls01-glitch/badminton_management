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

  function groupBookingSlots(slots) {
    const ordered = [...slots].sort((a, b) =>
      Number(a.court_id) - Number(b.court_id) || String(a.start_at).localeCompare(String(b.start_at))
    );
    const groups = [];

    for (const slot of ordered) {
      const startTime = String(slot.start_at || "").slice(11, 16);
      const endTime = String(slot.end_at || "").slice(11, 16);
      const duration = Number(slot.duration_minutes) || 30;
      const amount = Number(slot.amount) || 0;
      const previous = groups[groups.length - 1];

      if (previous && String(previous.courtId) === String(slot.court_id) && previous.endTime === startTime) {
        previous.endTime = endTime;
        previous.durationMinutes += duration;
        previous.amount += amount;
      } else {
        groups.push({
          courtId: slot.court_id,
          courtName: slot.court_name || `Sân ${slot.court_id}`,
          startTime,
          endTime,
          durationMinutes: duration,
          amount,
        });
      }
    }

    return groups;
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

    try {
      const cached = JSON.parse(sessionStorage.getItem("rk_booking_success") || "null");
      if (cached && (!queryId || String(cached.id) === String(queryId) || cached.booking_code === queryId)) {
        return cached;
      }
    } catch (err) {
      console.warn("Không thể khôi phục thông tin booking vừa gửi:", err);
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
    const venueName = "RK Badminton Club";
    const venueAddress = "Sân Cầu Lông RK · Cơ sở chính";
    const slots = Array.isArray(b.slots) ? b.slots : [];
    const groups = groupBookingSlots(slots);
    const fallbackStart = String(b.start_time || "--:--").slice(0, 5);
    const fallbackEnd = String(b.end_time || "--:--").slice(0, 5);
    if (!groups.length) {
      groups.push({
        courtId: b.court_id,
        courtName: b.court_name || "Sân cầu lông",
        startTime: fallbackStart,
        endTime: fallbackEnd,
        durationMinutes: 60,
        amount: Number(b.total_price) || 0,
      });
    }

    const courtNames = [...new Set(groups.map((group) => group.courtName))];
    const courtName = courtNames.length === 1 ? courtNames[0] : `${courtNames.length} sân đã chọn`;
    const timeRanges = [...new Set(groups.map((group) => `${group.startTime} – ${group.endTime}`))];
    const startTime = timeRanges.length === 1 ? timeRanges[0] : `${groups.length} khung giờ đã chọn`;
    const durationMins = slots.length
      ? slots.reduce((sum, slot) => sum + (Number(slot.duration_minutes) || 30), 0)
      : groups[0].durationMinutes;
    const durationLabel = formatDuration(durationMins);
    const dateLabel = formatVietnameseDate(b.booking_date);
    const totalPrice = Number(b.total_price) || 0;
    const slotCount = slots.length || groups.length;

    // Trạng thái
    let statusText = "Đã xác nhận";
    if (b.status === "Pending") statusText = "Chờ xác nhận";
    else if (b.status === "Cancelled") statusText = "Đã hủy";
    else if (b.status === "Completed") statusText = "Hoàn thành";

    // Thanh toán
    const isOnline = b.payment_method === "BANK_TRANSFER" || b.booking_channel === "Online";
    const paymentMethodText = isOnline ? "Chuyển khoản ngân hàng" : "Thanh toán tại sân";
    let paymentNoteText = "Đặt sân đang chờ lễ tân xác nhận.";
    if (b.payment_status === "SUCCESS") {
      paymentNoteText = "Thanh toán đã được xác nhận.";
    } else if (b.payment_status === "PENDING" && isOnline) {
      paymentNoteText = "Đã gửi ảnh chuyển khoản · Chờ lễ tân kiểm tra và xác nhận.";
    } else if (b.status === "Pending") {
      paymentNoteText = "Chờ lễ tân xác nhận · Thanh toán tại sân khi đến chơi.";
    } else if (b.status === "Confirmed") {
      paymentNoteText = "Lịch đã được lưu vào hệ thống · Vui lòng đến trước 15 phút.";
    }

    const title = document.getElementById("confirmation-title");
    if (title) title.textContent = b.status === "Pending" ? "Đặt sân thành công!" : "Thông tin đặt sân";
    setText(
      "confirmation-message",
      b.status === "Pending"
        ? "Yêu cầu đặt sân đã được gửi. Lễ tân sẽ kiểm tra thông tin và xác nhận lịch của bạn."
        : "Thông tin lịch đặt sân của bạn đã được cập nhật."
    );

    // Cập nhật giao diện
    setText("reference-code", reference);
    setText("confirmation-court", courtName);
    setText("confirmation-venue", `${venueName} · ${venueAddress}`);
    setText("confirmation-status", statusText);
    setText("confirmation-date", dateLabel);
    setText("confirmation-time", startTime);
    setText("confirmation-duration", `Thời lượng: ${durationLabel}`);
    setText("confirmation-customer-name", b.user_name || "Khách hàng");
    setText("confirmation-customer-phone", b.user_phone || "Không có");
    setText("confirmation-payment-method", paymentMethodText);

    const slotList = document.getElementById("confirmation-slot-list");
    if (slotList) {
      slotList.replaceChildren();
      if (groups.length > 1) {
        for (const group of groups) {
          const row = document.createElement("li");
          row.className = "confirmation-slot-row";
          const description = document.createElement("span");
          description.textContent = `${group.courtName} · ${group.startTime} – ${group.endTime}`;
          const amount = document.createElement("strong");
          amount.textContent = formatMoney(group.amount);
          row.append(description, amount);
          slotList.appendChild(row);
        }
        slotList.hidden = false;
      } else {
        slotList.hidden = true;
      }
    }

    if (b.note && b.note.trim()) {
      const noteRow = document.getElementById("confirmation-note-row");
      if (noteRow) {
        noteRow.style.display = "";
        setText("confirmation-note", b.note);
      }
    }

    setText("confirmation-slot-count", String(slotCount));
    setText("confirmation-price-duration", durationLabel);
    const discountAmount = Number(b.discount_amount) || 0;
    const subtotalPrice = Number(b.subtotal_price || totalPrice) || 0;
    const subtotalRow = document.getElementById("confirmation-subtotal-row");
    const discountRow = document.getElementById("confirmation-discount-row");
    if (discountAmount > 0) {
      if (subtotalRow) {
        subtotalRow.style.display = "";
        setText("confirmation-subtotal", formatMoney(subtotalPrice));
      }
      if (discountRow) {
        discountRow.style.display = "";
        const codePart = b.discount_code ? ` (${b.discount_code}${b.discount_percent ? ` -${Number(b.discount_percent)}%` : ""})` : "";
        setText("confirmation-discount-label", `Ưu đãi${codePart}`);
        setText("confirmation-discount", `-${formatMoney(discountAmount)}`);
      }
    } else {
      if (subtotalRow) subtotalRow.style.display = "none";
      if (discountRow) discountRow.style.display = "none";
    }
    setText("confirmation-total", formatMoney(totalPrice));
    setText("confirmation-payment-note-text", paymentNoteText);

    // Cập nhật dialog in / xem chi tiết
    setText("dialog-reference", reference);
    setText("dialog-court", `${venueName} · ${courtNames.join(", ")}`);
    setText("dialog-venue", venueAddress);
    setText("dialog-date", b.booking_date || dateLabel);
    setText("dialog-time", timeRanges.join(", "));
    setText("dialog-total", `${formatMoney(totalPrice)} · ${paymentMethodText}`);

    // Gắn sự kiện các nút
    setupEvents(b, reference, venueAddress, groups);
  }

  function setupEvents(booking, reference, venueAddress, groups) {
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
          const dateStr = String(booking.booking_date || new Date().toISOString()).slice(0, 10);
          const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
          const toUtc = d => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
          const events = groups.map((group, index) => {
            const localStart = new Date(`${dateStr}T${group.startTime}:00+07:00`);
            const localEnd = new Date(`${dateStr}T${group.endTime}:00+07:00`);
            return [
              "BEGIN:VEVENT",
              `UID:${reference}-${index + 1}@rkbadminton.vn`,
              `DTSTAMP:${stamp}`,
              `DTSTART:${toUtc(localStart)}`,
              `DTEND:${toUtc(localEnd)}`,
              `SUMMARY:Chơi cầu lông - ${group.courtName}`,
              `LOCATION:${venueAddress}`,
              `DESCRIPTION:Mã đặt sân: ${reference}\\n${group.courtName} · ${group.startTime} – ${group.endTime}\\nTổng tiền: ${formatMoney(group.amount)}.`,
              "BEGIN:VALARM",
              "TRIGGER:-PT30M",
              "ACTION:DISPLAY",
              "DESCRIPTION:Chuẩn bị đến sân cầu lông",
              "END:VALARM",
              "END:VEVENT",
            ].join("\r\n");
          });

          const icsContent = [
            "BEGIN:VCALENDAR",
            "VERSION:2.0",
            "PRODID:-//RK Badminton//Booking Notification//VI",
            "CALSCALE:GREGORIAN",
            ...events,
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
