(function (global) {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const money = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" });
  const vnClock = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
  const statusLabels = {
    Pending: "Chờ xác nhận", Confirmed: "Đã xác nhận", CHECKED_IN: "Đang chơi",
    Completed: "Hoàn thành", Cancelled: "Đã hủy", Expired: "Hết hạn", NO_SHOW: "Không đến",
  };
  const slotLabels = { free: "Trống", booked: "Đã đặt", hold: "Đang giữ chỗ", locked: "Đã khóa" };
  const node = (tag, content, className) => {
    const el = document.createElement(tag);
    if (content != null) el.textContent = content;
    if (className) el.className = className;
    return el;
  };
  const shortDate = (day) => day.slice(8, 10) + "/" + day.slice(5, 7);
  function link(path, params) {
    const url = new URL(path, global.location.href);
    for (const [key, value] of Object.entries(params)) if (value != null) url.searchParams.set(key, value);
    return url.href;
  }
  const manage = (params) => link("admin/manage_booking.html", params);
  let mounted = false;
  let data;
  let selection;
  let request;
  let searchRequest;
  let headerSearch;
  let submittedTerm = "";

  function icons(root) {
    for (const el of root.querySelectorAll("[data-ov-icon]")) {
      const name = el.dataset.ovIcon;
      const paths = {
        search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
        warning: '<path d="m10 4-8 14a1 1 0 0 0 1 2h18a1 1 0 0 0 1-2L14 4a2.3 2.3 0 0 0-4 0Z"/><path d="M12 9v4m0 3h.01"/>',
        bell: '<path d="M18 8a6 6 0 1 0-12 0c0 7-3 8-3 9h18c0-1-3-2-3-9m-8 12a2 2 0 0 0 4 0"/>',
      };
      el.innerHTML = paths[name]
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">' + paths[name] + '</svg>'
        : global.RK_UI.icon(name);
    }
  }

  function updateActions() {
    const day = $("ov-day").value;
    const args = { action: "new", day, source: "overview" };
    if (selection) {
      args.court_id = selection.court.id;
      args.start = selection.court.cells[selection.first].start;
      args.end = selection.court.cells[selection.last + 1]?.start || data.close;
    }
    $("ov-create").href = $("ov-quick-create").href = manage(args);
    $("ov-full-grid").href = link("timeline_grid.html", { day });
    $("ov-bookings-link").href = manage({ day });
    $("ov-selection").hidden = !selection;
    if (selection) $("ov-selection").textContent = selection.court.name + " · " + args.start + "–" + args.end + " · Chưa giữ chỗ";
    for (const button of $("ov-grid").querySelectorAll("button[data-index]")) {
      const index = Number(button.dataset.index);
      const selected = Boolean(selection && Number(button.dataset.court) === selection.court.id
        && index >= selection.first && index <= selection.last);
      button.setAttribute("aria-pressed", String(selected));
      button.textContent = selected ? "✓" : "";
    }
  }

  function choose(court, index) {
    const live = vnClock.format(new Date()).replace(" ", "T");
    const selectable = (cell) => cell.state === "free" && data.date + "T" + cell.start > live;
    if (!selectable(court.cells[index])) {
      void load();
      return;
    }
    if (!selection || selection.court.id !== court.id) {
      selection = { court, anchor: index, first: index, last: index };
    } else if (index === selection.anchor) {
      selection = null;
    } else {
      const first = Math.min(selection.anchor, index);
      const last = Math.max(selection.anchor, index);
      if (!court.cells.slice(first, last + 1).every(selectable)) {
        $("ov-selection").textContent = "Chọn hai mốc có các ô trống liên tiếp trên cùng sân.";
        return;
      }
      Object.assign(selection, { first, last });
    }
    updateActions();
  }

  function grid() {
    const table = $("ov-grid");
    table.replaceChildren();
    $("ov-grid-empty").hidden = data.courts.length > 0;
    $("ov-grid-empty").textContent = "Chưa có sân trong hệ thống.";
    if (!data.courts.length) return;
    const header = table.createTHead().insertRow();
    header.append(node("th", "SÂN / GIỜ"));
    for (const cell of data.courts[0].cells) header.append(node("th", cell.start));
    const body = table.createTBody();
    for (const court of data.courts) {
      const row = body.insertRow();
      const label = node("th", court.name);
      label.scope = "row";
      row.append(label);
      court.cells.forEach((cell, index) => {
        const td = row.insertCell();
        td.className = "is-" + cell.state;
        const description = court.name + " · " + cell.start + " · " + (cell.reason || slotLabels[cell.state]);
        td.title = description;
        if (cell.state === "free" || (cell.state === "booked" && cell.booking_id)) {
          const control = node(cell.state === "free" ? "button" : "a");
          control.setAttribute("aria-label", description);
          if (cell.state === "free") {
            control.type = "button";
            control.dataset.index = index;
            control.dataset.court = court.id;
            control.setAttribute("aria-pressed", "false");
            control.onclick = () => choose(court, index);
          } else {
            control.href = manage({ booking_id: cell.booking_id, day: data.date });
            if (index === 0 || court.cells[index - 1].booking_id !== cell.booking_id) control.textContent = "Đặt";
          }
          td.append(control);
        } else {
          const previous = court.cells[index - 1];
          if (cell.state === "hold" && previous?.booking_id !== cell.booking_id) td.textContent = "Giữ";
          if (cell.state === "locked" && (previous?.state !== "locked" || previous.reason !== cell.reason)) td.textContent = "Khóa";
          td.setAttribute("aria-label", description);
        }
      });
    }
  }

  function bookings(rows, searching = false) {
    const body = $("ov-booking-rows");
    body.replaceChildren();
    $("ov-bookings-empty").hidden = rows.length > 0;
    $("ov-bookings-empty").textContent = searching ? "Không tìm thấy lượt đặt." : "Chưa có lượt đặt trong ngày này.";
    for (const item of rows) {
      const row = body.insertRow();
      const a = node("a", item.code);
      a.href = manage({ booking_id: item.id });
      row.insertCell().append(a);
      row.insertCell().textContent = item.customer;
      const slots = row.insertCell();
      for (const slot of item.slots) {
        const date = searching ? shortDate(slot.start.slice(0, 10)) + " · " : "";
        slots.append(node("div", slot.court + " · " + date + slot.start.slice(11, 16) + "–" + slot.end.slice(11, 16)));
      }
      row.insertCell().textContent = money.format(item.total);
      row.insertCell().append(node("span", statusLabels[item.status] || item.status, "ov-badge status-" + item.status));
    }
  }

  function graph(series) {
    const chart = $("ov-chart");
    chart.replaceChildren();
    const amounts = series.map((item) => Number(item.amount));
    const hasRevenue = amounts.some((amount) => amount > 0);
    const rawStep = Math.max(...amounts, 1) / 4;
    const magnitude = 10 ** Math.floor(Math.log10(rawStep));
    const step = Math.max(1, Math.ceil(rawStep / magnitude) * magnitude);
    const ceiling = step * 4;
    const marks = node("div", null, "ov-chart-axis");
    const bars = node("div", null, "ov-chart-bars");
    const labels = node("div", null, "ov-chart-labels");
    for (let index = 4; index >= 0; index--) {
      marks.append(node("span", hasRevenue || index === 0 ? money.format(index * step) : ""));
    }
    series.forEach((item, index) => {
      const label = shortDate(item.date);
      const bar = node("div", null, "ov-chart-bar");
      bar.style.height = (amounts[index] / ceiling * 100) + "%";
      bar.title = label + " · " + money.format(item.amount);
      bars.append(bar);
      labels.append(node("span", label));
    });
    chart.setAttribute("aria-label", series.map((item) => shortDate(item.date) + ": " + money.format(item.amount)).join("; "));
    chart.append(marks, bars, labels);
    $("ov-chart-empty").hidden = true;
  }

  function feedback(message, retry) {
    $("ov-feedback").hidden = !message;
    $("ov-feedback-text").textContent = message;
    $("ov-retry").hidden = !retry;
  }

  function errorMessage(error) {
    const status = error.response?.status;
    if (status === 401) return "Phiên đăng nhập đã hết hạn.";
    if (status === 403) return "Tài khoản không có quyền xem tổng quan.";
    if (!status) return "Chưa kết nối được máy chủ. Vui lòng thử lại.";
    return "Không tải được dữ liệu tổng quan. Vui lòng thử lại.";
  }

  function showOverview(result) {
    data = result;
    const suffix = result.date === result.today ? "hôm nay" : "ngày " + shortDate(result.date);
    $("ov-revenue-title").textContent = "Doanh thu " + suffix;
    $("ov-count-title").textContent = "Lượt đặt " + suffix;
    $("ov-grid-title").textContent = "Lịch sân " + suffix;
    $("ov-revenue").textContent = money.format(result.revenue.at(-1).amount);
    $("ov-booked-value").textContent = money.format(result.booked_court_value);
    $("ov-count").textContent = result.booking_count;
    $("ov-confirmed").textContent = result.confirmed_count + " đã xác nhận";
    $("ov-using").textContent = result.courts_in_use + "/" + result.courts.length;
    $("ov-free").textContent = result.courts_free + " sân trống hiện tại";
    $("ov-tasks").textContent = result.pending_count + result.checkin_count;
    $("ov-task-note").textContent = result.pending_count + " chờ xác nhận · " + result.checkin_count + " có thể check-in";
    $("ov-pending").textContent = result.pending_count + " đơn chờ xác nhận";
    $("ov-checkin").textContent = result.checkin_count + " lượt có thể check-in";
    const pending = $("ov-pending-link");
    pending.hidden = !result.next_pending_id;
    pending.href = manage({ day: result.date, status: "pending", booking_id: result.next_pending_id });
    const checkin = $("ov-checkin-link");
    checkin.hidden = !result.next_checkin_id;
    checkin.href = link("reception.html", { day: result.date, booking_id: result.next_checkin_id });
    grid();
    if (!submittedTerm) bookings(result.recent);
    graph(result.revenue);
    updateActions();
  }

  async function load() {
    request?.abort();
    selection = null;
    data = null;
    const controller = new AbortController();
    request = controller;
    const day = $("ov-day").value;
    if (!day) return;
    updateActions();
    for (const id of ["ov-revenue", "ov-booked-value", "ov-count", "ov-confirmed", "ov-using", "ov-free", "ov-tasks", "ov-task-note"]) $(id).textContent = "—";
    $("ov-pending").textContent = "— đơn chờ xác nhận";
    $("ov-checkin").textContent = "— lượt có thể check-in";
    $("ov-pending-link").hidden = $("ov-checkin-link").hidden = true;
    $("ov-grid").replaceChildren();
    $("ov-chart").replaceChildren();
    const loading = ["ov-grid-empty", "ov-chart-empty"];
    if (!submittedTerm) {
      $("ov-booking-rows").replaceChildren();
      loading.push("ov-bookings-empty");
    }
    for (const id of loading) {
      $(id).hidden = false;
      $(id).textContent = "Đang tải dữ liệu…";
    }
    feedback("", false);
    try {
      const response = await global.axiosClient.get("/admin/overview", { params: { day }, signal: controller.signal });
      if (!controller.signal.aborted) {
        showOverview(response.data);
        const url = new URL(global.location.href);
        if (url.searchParams.has("conflict")) {
          feedback("Khung giờ vừa chọn không còn trống. Lịch sân đã được cập nhật.", false);
          url.searchParams.delete("conflict");
          global.history.replaceState(null, "", url);
        }
      }
    } catch (error) {
      if (controller.signal.aborted) return;
      for (const id of loading) $(id).textContent = "Chưa tải được dữ liệu.";
      feedback(errorMessage(error), error.response?.status !== 401 && error.response?.status !== 403);
    }
  }

  async function findBookings(event) {
    event.preventDefault();
    searchRequest?.abort();
    const controller = new AbortController();
    searchRequest = controller;
    const term = headerSearch.querySelector("input").value.trim();
    submittedTerm = term;
    $("ov-clear-search").hidden = !term;
    $("ov-bookings-title").textContent = term ? "Kết quả tìm kiếm" : "Lượt đặt gần đây";
    if (!term) {
      if (data) bookings(data.recent);
      else void load();
      return;
    }
    $("ov-bookings").scrollIntoView({ block: "nearest" });
    $("ov-booking-rows").replaceChildren();
    $("ov-bookings-empty").hidden = false;
    $("ov-bookings-empty").textContent = "Đang tìm lượt đặt…";
    try {
      const { data: rows } = await global.axiosClient.get("/admin/overview/search", {
        params: { q: term }, signal: controller.signal,
      });
      if (!controller.signal.aborted) bookings(rows, true);
    } catch (error) {
      if (!controller.signal.aborted) $("ov-bookings-empty").textContent = errorMessage(error);
    }
  }

  async function unread() {
    try {
      const { data: result } = await global.axiosClient.get("/notifications/unread-count");
      const a = document.querySelector(".ov-notifications");
      const badge = a.querySelector(".ov-unread");
      a.hidden = false;
      badge.hidden = !result.unread_count;
      badge.textContent = result.unread_count;
      a.setAttribute("aria-label", "Thông báo · " + result.unread_count + " chưa đọc");
    } catch (_) {
      // Notifications are independent of the dashboard data.
    }
  }

  async function showNotifications(button, panel) {
    panel.hidden = !panel.hidden;
    button.setAttribute("aria-expanded", String(!panel.hidden));
    if (panel.hidden) return;
    panel.textContent = "Đang tải thông báo…";
    try {
      const { data: items } = await global.axiosClient.get("/notifications");
      panel.replaceChildren();
      if (!items.length) panel.textContent = "Bạn chưa có thông báo.";
      for (const item of items.slice(0, 5)) {
        const entry = node("article");
        entry.append(node("strong", item.title), node("p", item.message));
        if (!item.is_read) {
          const read = node("button", "Đánh dấu đã đọc", "ov-button ov-outline");
          read.type = "button";
          read.onclick = async () => {
            read.disabled = true;
            try {
              await global.axiosClient.post("/notifications/" + item.id + "/read");
              read.remove();
              void unread();
            } catch (_) {
              read.textContent = "Thử lại";
              read.disabled = false;
            }
          };
          entry.append(read);
        }
        panel.append(entry);
      }
    } catch (error) {
      panel.textContent = errorMessage(error);
    }
  }

  function mount() {
    if (mounted) return;
    mounted = true;
    const root = $("admin-overview");
    const header = $("rk-dashboard-header");
    const headerContent = $("ov-header-template").content.cloneNode(true);
    icons(headerContent);
    header.insertBefore(headerContent, header.lastElementChild);
    headerSearch = header.querySelector(".ov-header-search");
    const notificationButton = header.querySelector(".ov-notifications");
    const notificationPanel = header.querySelector(".ov-notification-panel");
    notificationButton.onclick = () => showNotifications(notificationButton, notificationPanel);
    header.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || notificationPanel.hidden) return;
      notificationPanel.hidden = true;
      notificationButton.setAttribute("aria-expanded", "false");
      notificationButton.focus();
    });
    $("rk-dashboard").classList.add("ov-shell");
    $("rk-dashboard-workspace").hidden = true;
    root.hidden = false;
    icons(root);
    const today = vnClock.format(new Date()).slice(0, 10);
    const day = $("ov-day");
    day.value = new URLSearchParams(global.location.search).get("day") || today;
    if (!day.value) day.value = today;
    day.onchange = () => {
      if (!day.value) day.value = today;
      void load();
    };
    $("ov-retry").onclick = load;
    headerSearch.onsubmit = findBookings;
    headerSearch.querySelector("input").addEventListener("search", () => {
      if (!headerSearch.querySelector("input").value.trim()) headerSearch.requestSubmit();
    });
    $("ov-clear-search").onclick = () => {
      headerSearch.reset();
      headerSearch.requestSubmit();
    };
    global.addEventListener("pageshow", (event) => { if (event.persisted) void load(); });
    void load();
    void unread();
  }

  global.RK_ADMIN_OVERVIEW = { mount };
})(window);
