(function (global) {
  "use strict";

  const byId = (id) => document.getElementById(id);
  const state = {
    courts: [],
    slotsByKey: new Map(),
    activeSlot: null,
    toastTimer: null,
  };

  const refs = {
    dashboard: byId("rk-dashboard"),
    authState: byId("rk-dashboard-state"),
    date: byId("scheduleDate"),
    grid: byId("scheduleGrid"),
    gridContainer: byId("gridContainer"),
    loading: byId("gridLoading"),
    error: byId("gridError"),
    errorMessage: byId("gridErrorMessage"),
    infoDialog: byId("bookingInfoDialog"),
    infoStatus: byId("bookingInfoStatus"),
    infoContent: byId("bookingInfoContent"),
    walkInDialog: byId("walkInDialog"),
    walkInForm: byId("walkInForm"),
    selectedSummary: byId("selectedSlotSummary"),
    toast: byId("slotToast"),
  };

  const timeSlots = Array.from({ length: 34 }, (_, index) => {
    const minutes = 6 * 60 + index * 30;
    const hour = String(Math.floor(minutes / 60)).padStart(2, "0");
    const minute = String(minutes % 60).padStart(2, "0");
    return `${hour}:${minute}`;
  });

  const courts = [
    { id: "court-1", name: "Sân số 1", type: "Sân tiêu chuẩn" },
    { id: "court-2", name: "Sân số 2", type: "Sân tiêu chuẩn" },
    { id: "court-3", name: "Sân số 3", type: "Sân tiêu chuẩn" },
    { id: "court-4", name: "Sân số 4", type: "Sân VIP" },
    { id: "court-5", name: "Sân số 5", type: "Sân VIP" },
    { id: "court-6", name: "Sân số 6", type: "Đang bảo trì" },
  ];

  const demoBookings = {
    "court-1_18:00": { code: "BK-DEMO-2041", name: "Nguyễn Minh Anh", phone: "090 123 4567", status: "Đã xác nhận" },
    "court-2_19:00": { code: "BK-DEMO-2042", name: "Trần Quốc Bảo", phone: "091 765 4321", status: "Đã xác nhận" },
    "court-3_17:30": { code: "BK-DEMO-2043", name: "Lê Thu Hà", phone: "098 234 5678", status: "Đã xác nhận" },
    "court-4_20:00": { code: "BK-DEMO-2044", name: "Phạm Đức Long", phone: "093 456 7890", status: "Đã xác nhận" },
    "court-5_18:30": { code: "BK-DEMO-2045", name: "Vũ Hoàng Nam", phone: "096 678 9012", status: "Đã xác nhận" },
  };

  const demoHolds = {
    "court-2_17:00": { code: "HOLD-DEMO-17", name: "Khách đang giữ chỗ", phone: "—", status: "Đang giữ chỗ" },
    "court-3_19:30": { code: "HOLD-DEMO-28", name: "Khách đang giữ chỗ", phone: "—", status: "Đang giữ chỗ" },
  };

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[character]);
  }

  function formatDate(dateValue, options = { weekday: "long", day: "numeric", month: "long", year: "numeric" }) {
    const [year, month, day] = dateValue.split("-").map(Number);
    return new Date(year, month - 1, day).toLocaleDateString("vi-VN", options);
  }

  function todayValue() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }

  function slotDateTime(dateValue, timeValue) {
    const [year, month, day] = dateValue.split("-").map(Number);
    const [hour, minute] = timeValue.split(":").map(Number);
    return new Date(year, month - 1, day, hour, minute);
  }

  function formatMoney(amount) {
    return `${Number(amount).toLocaleString("vi-VN")}đ`;
  }

  function getSlotStatus(court, time, dateValue) {
    const key = `${court.id}_${time}`;
    const isToday = dateValue === todayValue();
    if (court.id === "court-6") return "locked";
    if (demoBookings[key]) return "booked";
    if (demoHolds[key]) return "held";
    const endAt = slotDateTime(dateValue, time).getTime() + 30 * 60 * 1000;
    if (isToday && endAt <= Date.now()) return "locked";
    return "available";
  }

  function buildDemoGrid(dateValue) {
    state.slotsByKey.clear();
    state.courts = courts.map((court) => ({ ...court, slots: timeSlots.map((time) => {
      const key = `${court.id}_${time}`;
      const status = getSlotStatus(court, time, dateValue);
      const price = court.type === "Sân VIP" ? 100000 : 80000;
      const slot = {
        key,
        courtId: court.id,
        courtName: court.name,
        courtType: court.type,
        date: dateValue,
        time,
        endTime: (() => {
          const [hour, minute] = time.split(":").map(Number);
          const total = hour * 60 + minute + 30;
          return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
        })(),
        status,
        price,
        booking: demoBookings[key] || demoHolds[key] || null,
      };
      state.slotsByKey.set(key, slot);
      return slot;
    }) }));
  }

  function renderGrid() {
    const dateValue = refs.date.value;
    const dateLabel = formatDate(dateValue);
    const head = `<thead><tr><th class="slot-corner slot-date-heading" scope="col">SÂN / GIỜ</th><th class="slot-date-heading" colspan="${timeSlots.length}" scope="colgroup">${escapeHtml(dateLabel)}</th></tr><tr><th class="slot-corner" scope="col">Tên sân</th>${timeSlots.map((time) => `<th class="slot-time-heading" scope="col">${time}</th>`).join("")}</tr></thead>`;
    const body = state.courts.map((court) => `<tr><th scope="row"><span class="slot-court-name">${escapeHtml(court.name)}</span><span class="slot-court-type">${escapeHtml(court.type)}</span></th>${court.slots.map((slot) => renderSlotCell(slot)).join("")}</tr>`).join("");
    refs.grid.innerHTML = `${head}<tbody>${body}</tbody>`;

    const values = Array.from(state.slotsByKey.values());
    const available = values.filter((slot) => slot.status === "available").length;
    const busy = values.filter((slot) => slot.status === "booked" || slot.status === "held").length;
    byId("summaryDate").textContent = formatDate(dateValue, { day: "2-digit", month: "2-digit", year: "numeric" });
    byId("summaryCourts").textContent = String(state.courts.length);
    byId("summaryAvailable").textContent = String(available);
    byId("summaryBusy").textContent = String(busy);
  }

  function renderSlotCell(slot) {
    const labels = { available: "Trống", booked: "Đã đặt", held: "Đang giữ", locked: "Khóa" };
    const label = labels[slot.status];
    const isOpenable = slot.status !== "locked";
    const classNames = ["schedule-slot", `is-${slot.status}`];
    if (slot.isCreatedDemo) classNames.push("is-demo-created");
    let content = "<span class=\"sr-only\">Trống</span>";
    if (slot.status === "booked") content = `<span>${slot.isCreatedDemo ? "Đặt mẫu" : "Đã đặt"}</span>`;
    if (slot.status === "held") content = "<span>Đang giữ</span>";
    if (slot.status === "locked") content = "<span>Khóa</span>";
    const disabled = isOpenable ? "" : "disabled";
    return `<td class="slot-cell"><button type="button" class="${classNames.join(" ")}" data-slot-key="${escapeHtml(slot.key)}" aria-label="${escapeHtml(`${slot.courtName}, ${slot.time} đến ${slot.endTime}, ${label}`)}" title="${escapeHtml(`${slot.courtName} · ${slot.time}–${slot.endTime} · ${label}`)}" ${disabled}>${content}</button></td>`;
  }

  function showGridState(name) {
    refs.loading.hidden = name !== "loading";
    refs.error.hidden = name !== "error";
    refs.gridContainer.hidden = name !== "ready";
  }

  async function loadGrid() {
    showGridState("loading");
    try {
      await new Promise((resolve) => global.setTimeout(resolve, 220));
      if (!refs.date.value) throw new Error("Vui lòng chọn ngày để xem lịch sân.");
      buildDemoGrid(refs.date.value);
      renderGrid();
      showGridState("ready");
    } catch (error) {
      refs.errorMessage.textContent = error.message || "Có lỗi trong lúc tải lưới sân.";
      showGridState("error");
    }
  }

  function showToast(message) {
    refs.toast.textContent = message;
    refs.toast.classList.add("is-visible");
    global.clearTimeout(state.toastTimer);
    state.toastTimer = global.setTimeout(() => refs.toast.classList.remove("is-visible"), 3600);
  }

  function openBookingInfo(slot) {
    const booking = slot.booking || {};
    const isHeld = slot.status === "held";
    refs.infoStatus.textContent = isHeld ? "PHIÊN ĐANG GIỮ CHỖ" : "THÔNG TIN LƯỢT ĐẶT";
    refs.infoContent.innerHTML = `<div class="slot-detail-list">
      <div class="slot-detail-row"><span>Mã lượt</span><strong>${escapeHtml(booking.code || "—")}</strong></div>
      <div class="slot-detail-row"><span>Khách hàng</span><strong>${escapeHtml(booking.name || "—")}</strong></div>
      <div class="slot-detail-row"><span>Số điện thoại</span><strong>${escapeHtml(booking.phone || "—")}</strong></div>
      <div class="slot-detail-row"><span>Sân</span><strong>${escapeHtml(slot.courtName)} · ${escapeHtml(slot.courtType)}</strong></div>
      <div class="slot-detail-row"><span>Ngày</span><strong>${escapeHtml(formatDate(slot.date))}</strong></div>
      <div class="slot-detail-row"><span>Khung giờ</span><strong>${escapeHtml(slot.time)}–${escapeHtml(slot.endTime)}</strong></div>
      <div class="slot-detail-row"><span>Tiền sân / 30 phút</span><strong>${formatMoney(slot.price)}</strong></div>
      <div class="slot-detail-row"><span>Trạng thái</span><strong><span class="slot-detail-status ${isHeld ? "held" : ""}">${escapeHtml(booking.status || "Đã xác nhận")}</span></strong></div>
    </div>`;
    refs.infoDialog.showModal();
  }

  function openWalkInForm(slot) {
    state.activeSlot = slot;
    refs.walkInForm.reset();
    refs.selectedSummary.textContent = `${slot.courtName} · ${formatDate(slot.date, { day: "2-digit", month: "2-digit", year: "numeric" })} · ${slot.time}–${slot.endTime} · ${formatMoney(slot.price)}`;
    refs.walkInDialog.showModal();
    refs.walkInForm.elements.customerName.focus();
  }

  function handleGridClick(event) {
    const button = event.target.closest("button[data-slot-key]");
    if (!button || button.disabled) return;
    const slot = state.slotsByKey.get(button.dataset.slotKey);
    if (!slot) return;
    if (slot.status === "available") openWalkInForm(slot);
    else if (slot.status === "booked" || slot.status === "held") openBookingInfo(slot);
  }

  function handleWalkInSubmit(event) {
    event.preventDefault();
    if (!state.activeSlot) return;
    const formData = new FormData(refs.walkInForm);
    const key = state.activeSlot.key;
    const slot = state.slotsByKey.get(key);
    if (!slot || slot.status !== "available") {
      refs.walkInDialog.close();
      showToast("Ô này vừa không còn trống. Hãy chọn ô khác.");
      return;
    }

    const created = {
      ...slot,
      status: "booked",
      isCreatedDemo: true,
      booking: {
        code: `BK-DEMO-${String(Date.now()).slice(-5)}`,
        name: String(formData.get("customerName")).trim(),
        phone: String(formData.get("customerPhone")).trim(),
        status: "Đặt hộ (minh họa)",
        note: String(formData.get("note") || "").trim(),
      },
    };
    state.slotsByKey.set(key, created);
    const court = state.courts.find((item) => item.id === created.courtId);
    const slotIndex = court?.slots.findIndex((item) => item.key === key) ?? -1;
    if (court && slotIndex >= 0) court.slots[slotIndex] = created;
    renderGrid();
    refs.walkInDialog.close();
    state.activeSlot = null;
    showToast("Đã cập nhật lưới minh họa. Booking chưa được lưu vào hệ thống.");
  }

  function closeDialogFromButton(event) {
    const button = event.target.closest("[data-close-dialog]");
    if (!button) return;
    byId(button.dataset.closeDialog)?.close();
  }

  async function boot() {
    const allowed = await global.ProtectedRoute(["admin", "staff"]);
    if (!allowed) {
      const auth = global.RK_AUTH.getState();
      if (!auth.redirected && auth.status === "error") {
        refs.authState.textContent = `Không kiểm tra được phiên đăng nhập: ${auth.error}`;
      }
      return;
    }
    const user = global.RK_AUTH.getState().user;
    if (!user) return;

    global.RK_LAYOUT.dashboard(user);
    refs.authState.hidden = true;
    refs.dashboard.hidden = false;
    refs.date.min = todayValue();
    refs.date.value = todayValue();

    refs.date.addEventListener("change", () => void loadGrid());
    byId("refreshGrid").addEventListener("click", () => void loadGrid());
    byId("retryGrid").addEventListener("click", () => void loadGrid());
    refs.grid.addEventListener("click", handleGridClick);
    refs.walkInForm.addEventListener("submit", handleWalkInSubmit);
    document.addEventListener("click", closeDialogFromButton);
    document.querySelectorAll(".slot-dialog").forEach((dialog) => {
      dialog.addEventListener("click", (event) => {
        if (event.target === dialog) dialog.close();
      });
    });
    void loadGrid();
  }

  void boot();
})(window);
