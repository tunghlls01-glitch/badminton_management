(function (global) {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const timeZone = "Asia/Ho_Chi_Minh";
  const dayKey = new Intl.DateTimeFormat("sv-SE", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  });
  const dayLabel = new Intl.DateTimeFormat("vi-VN", { timeZone, dateStyle: "full" });
  const statusLabels = {
    Pending: "Chờ xác nhận",
    Confirmed: "Chờ nhận sân",
    CHECKED_IN: "Đã nhận sân",
    Completed: "Hoàn thành",
    Cancelled: "Đã hủy",
    Expired: "Hết hạn",
    NO_SHOW: "Không đến",
  };

  function render(bookings, day) {
    $("staff-total").textContent = bookings.length;
    $("staff-confirmed").textContent = bookings.filter((row) => row.status === "Confirmed").length;
    $("staff-checked-in").textContent = bookings.filter((row) => row.status === "CHECKED_IN").length;
    $("staff-completed").textContent = bookings.filter((row) => row.status === "Completed").length;

    const rows = bookings.flatMap((booking) => {
      const slots = booking.slots?.filter((slot) => slot.status === "Active" && slot.start_at.startsWith(day)) || [];
      return slots.length ? slots.map((slot) => ({
        booking,
        start: slot.start_at.slice(11, 16),
        end: slot.end_at.slice(11, 16),
        court: slot.court_name || booking.court_name,
      })) : [{
        booking, start: booking.start_time?.slice(0, 5),
        end: booking.end_time?.slice(0, 5), court: booking.court_name,
      }];
    }).sort((a, b) => (a.start || "").localeCompare(b.start || ""));

    $("staff-booking-rows").replaceChildren(...rows.map(({ booking, start, end, court }) => {
      const row = document.createElement("tr");
      const time = start && end ? start + "–" + end : start;
      for (const value of [time, court, booking.booking_code, booking.user_name, statusLabels[booking.status]]) {
        const cell = document.createElement("td");
        cell.textContent = value || "—";
        row.append(cell);
      }
      return row;
    }));
    $("staff-booking-table").hidden = !rows.length;
    $("staff-booking-status").textContent = rows.length ? "" : "Hôm nay chưa có lượt đặt sân.";
  }

  async function load() {
    const today = new Date();
    const day = dayKey.format(today);
    $("staff-overview-date").textContent = dayLabel.format(today);
    const status = $("staff-booking-status");
    const retry = $("staff-booking-retry");
    retry.hidden = true;
    status.textContent = "Đang tải lượt đặt…";
    try {
      const { data } = await global.axiosClient.get("/reception/bookings", { params: { booking_date: day } });
      render(data, day);
    } catch {
      status.textContent = "Không tải được lịch đặt hôm nay.";
      retry.hidden = false;
    }
  }

  function mount() {
    const section = $("staff-overview");
    if (!section.hidden) return;
    $("rk-dashboard").classList.add("ov-shell");
    $("rk-dashboard-workspace").hidden = true;
    section.hidden = false;
    for (const tile of section.querySelectorAll("[data-staff-icon]")) {
      tile.innerHTML = global.RK_UI.icon(tile.dataset.staffIcon);
    }
    $("staff-booking-retry").addEventListener("click", load);
    void load();
  }

  global.RK_STAFF_OVERVIEW = { mount };
})(window);
