(function (global) {
  "use strict";

  const byId = (id) => document.getElementById(id);
  const state = {
    courts: [],
    slotsByKey: new Map(),
    selectedSlots: new Map(),
    activeSlots: [],
    toastTimer: null,
    requestId: 0,
    infoRequestId: 0,
    hasLoaded: false,
    loadedDate: null,
    bookingCache: new Map(),
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
    selectionPanel: byId("slotSelectionPanel"),
    selectionTitle: byId("slotSelectionTitle"),
    selectionDetail: byId("slotSelectionDetail"),
    selectionPrice: byId("slotSelectionPrice"),
    clearSelection: byId("clearSlotSelection"),
    proceedWalkIn: byId("proceedWalkIn"),
    toast: byId("slotToast"),
  };

  const timeSlots = Array.from({ length: 34 }, (_, index) => {
    const minutes = 6 * 60 + index * 30;
    const hour = String(Math.floor(minutes / 60)).padStart(2, "0");
    const minute = String(minutes % 60).padStart(2, "0");
    return `${hour}:${minute}`;
  });

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

  function buildGridFromApi(payload) {
    const previousSelection = [...state.selectedSlots.keys()];
    state.slotsByKey.clear();
    state.bookingCache.clear();
    const dateValue = payload.date || refs.date.value;
    const statusMap = { FREE: "available", BOOKED: "booked", HOLD: "held", LOCKED: "locked" };

    state.courts = (payload.courts || []).map((court) => {
      const name = court.court_name || `Sân ${court.court_id}`;
      const courtType = /vip/i.test(name) ? "Sân VIP" : "Sân tiêu chuẩn";
      const slots = (court.slots || []).map((item) => {
        const time = String(item.start_at).slice(11, 16);
        const endTime = String(item.end_at).slice(11, 16);
        const key = `${court.court_id}_${time}`;
        let status = statusMap[String(item.status).toUpperCase()] || "locked";
        if (status === "available" && dateValue === todayValue()) {
          const endAt = slotDateTime(dateValue, time).getTime() + 30 * 60 * 1000;
          if (endAt <= Date.now()) status = "locked";
        }
        const slot = {
          key,
          courtId: Number(court.court_id),
          courtName: name,
          courtType: status === "locked" && item.lock_reason ? item.lock_reason : courtType,
          date: dateValue,
          time,
          endTime,
          slotIndex: timeSlots.indexOf(time),
          status,
          price: Number(item.price || 0),
          bookingId: item.booking_id || null,
          holdExpiresAt: item.hold_expires_at || null,
          lockReason: item.lock_reason || null,
        };
        state.slotsByKey.set(key, slot);
        return slot;
      });
      return { id: Number(court.court_id), name, type: courtType, slots };
    });

    state.selectedSlots.clear();
    let unavailableSelectionCount = 0;
    const availableSelection = [];
    previousSelection.forEach((key) => {
      const slot = state.slotsByKey.get(key);
      if (slot?.status === "available") availableSelection.push(slot);
      else unavailableSelectionCount += 1;
    });
    availableSelection.sort((left, right) => left.slotIndex - right.slotIndex);
    const selectionIsContinuous = availableSelection.every((slot, index) => (
      slot.courtId === availableSelection[0]?.courtId
      && (index === 0 || slot.slotIndex === availableSelection[index - 1].slotIndex + 1)
    ));
    if (selectionIsContinuous) {
      availableSelection.forEach((slot) => state.selectedSlots.set(slot.key, slot));
    } else {
      unavailableSelectionCount += availableSelection.length;
    }
    if (unavailableSelectionCount) {
      showToast(selectionIsContinuous
        ? `${unavailableSelectionCount} ô vừa không còn trống và đã được bỏ chọn.`
        : "Các ô đã chọn không còn liền nhau; lựa chọn đã được xóa.");
    }
  }

  function renderGrid() {
    const dateValue = refs.date.value;
    const dateLabel = formatDate(dateValue);
    const selected = getSelectedSlots();
    const head = `<thead><tr><th class="slot-corner slot-date-heading" scope="col">SÂN / GIỜ</th><th class="slot-date-heading" colspan="${timeSlots.length}" scope="colgroup">${escapeHtml(dateLabel)}</th></tr><tr><th class="slot-corner" scope="col">Tên sân</th>${timeSlots.map((time) => renderTimeHeading(time, selected)).join("")}</tr></thead>`;
    const body = state.courts.map((court) => `<tr><th scope="row"><span class="slot-court-name">${escapeHtml(court.name)}</span><span class="slot-court-type">${escapeHtml(court.type)}</span></th>${court.slots.map((slot) => renderSlotCell(slot)).join("")}</tr>`).join("");
    refs.grid.innerHTML = `${head}<tbody>${body}</tbody>`;

    const values = Array.from(state.slotsByKey.values());
    const available = values.filter((slot) => slot.status === "available").length;
    const busy = values.filter((slot) => slot.status === "booked" || slot.status === "held").length;
    byId("summaryDate").textContent = formatDate(dateValue, { day: "2-digit", month: "2-digit", year: "numeric" });
    byId("summaryCourts").textContent = String(state.courts.length);
    byId("summaryAvailable").textContent = String(available);
    byId("summaryBusy").textContent = String(busy);
    updateSelectionPanel();
  }

  function renderTimeHeading(time, selected) {
    const first = selected[0];
    const last = selected[selected.length - 1];
    const isSelected = selected.some((slot) => slot.time === time);
    const isStart = first?.time === time;
    const isEnd = last?.endTime === time;
    const endOfDayMarker = last?.endTime === "23:00" && time === last.time;
    const classes = ["slot-time-heading"];
    if (isSelected) classes.push("range-selected");
    if (isStart) classes.push("range-boundary-start");
    if (isEnd || endOfDayMarker) classes.push("range-boundary-end");
    const marker = isStart && isEnd ? "Từ / đến" : isStart ? "Từ" : isEnd ? "Đến" : "";
    const ariaLabel = endOfDayMarker
      ? `${time}, ${isStart ? "bắt đầu và kết thúc" : "kết thúc"} khoảng đã chọn lúc 23:00`
      : marker
        ? `${time}, ${marker.toLowerCase()} của khoảng đã chọn`
        : time;
    const visibleMarker = endOfDayMarker
      ? (isStart ? `Từ · Đến ${last.endTime}` : `Đến ${last.endTime}`)
      : marker;
    return `<th class="${classes.join(" ")}" scope="col" aria-label="${escapeHtml(ariaLabel)}"><span>${time}</span>${visibleMarker ? `<small>${escapeHtml(visibleMarker)}</small>` : ""}</th>`;
  }

  function renderSlotCell(slot) {
    const labels = { available: "Trống", booked: "Đã đặt", held: "Đang giữ", locked: "Khóa" };
    const isSelected = state.selectedSlots.has(slot.key);
    const label = isSelected ? "Đang chọn" : labels[slot.status];
    const isOpenable = slot.status !== "locked";
    const classNames = ["schedule-slot", `is-${slot.status}`];
    if (isSelected) classNames.push("is-selected");
    let content = "<span class=\"sr-only\">Trống</span>";
    if (isSelected) content = "<span aria-hidden=\"true\">✓</span>";
    if (slot.status === "booked") content = "<span>Đã đặt</span>";
    if (slot.status === "held") content = "<span>Đang giữ</span>";
    if (slot.status === "locked") content = "<span>Khóa</span>";
    const disabled = isOpenable ? "" : "disabled";
    return `<td class="slot-cell"><button type="button" class="${classNames.join(" ")}" data-slot-key="${escapeHtml(slot.key)}" aria-label="${escapeHtml(`${slot.courtName}, ${slot.time} đến ${slot.endTime}, ${label}`)}" title="${escapeHtml(`${slot.courtName} · ${slot.time}–${slot.endTime} · ${label}`)}" ${disabled}>${content}</button></td>`;
  }

  function getSelectedSlots() {
    return [...state.selectedSlots.values()].sort((left, right) => left.slotIndex - right.slotIndex);
  }

  function durationLabel(minutes) {
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    if (!hours) return `${remainder} phút`;
    if (!remainder) return `${hours} giờ`;
    return `${hours} giờ ${remainder} phút`;
  }

  function updateSelectionPanel() {
    if (!refs.selectionPanel) return;
    const selected = getSelectedSlots();
    refs.selectionPanel.hidden = selected.length === 0;
    if (!selected.length) return;

    const first = selected[0];
    const last = selected[selected.length - 1];
    const total = selected.reduce((sum, slot) => sum + slot.price, 0);
    refs.selectionTitle.textContent = `${first.courtName} · ${first.time}–${last.endTime}`;
    refs.selectionDetail.textContent = `${formatDate(first.date, { day: "2-digit", month: "2-digit", year: "numeric" })} · ${selected.length} ô liên tiếp · ${durationLabel(selected.length * 30)}`;
    refs.selectionPrice.textContent = formatMoney(total);
  }

  function changeSelection(slot) {
    const selected = getSelectedSlots();
    const selectedSlot = state.selectedSlots.get(slot.key);

    if (selectedSlot) {
      if (selected.length === 1) state.selectedSlots.delete(slot.key);
      else if (slot.slotIndex === selected[0].slotIndex || slot.slotIndex === selected[selected.length - 1].slotIndex) {
        state.selectedSlots.delete(slot.key);
      } else {
        showToast("Chỉ có thể bỏ ô ở đầu hoặc cuối để giữ giờ đặt liên tiếp.");
        return;
      }
      renderGrid();
      return;
    }

    if (slot.status !== "available") return;
    if (slot.slotIndex < 0) {
      showToast("Không xác định được vị trí khung giờ này.");
      return;
    }
    if (!selected.length) {
      state.selectedSlots.set(slot.key, slot);
      renderGrid();
      return;
    }

    const first = selected[0];
    const last = selected[selected.length - 1];
    if (slot.courtId !== first.courtId) {
      showToast("Một lượt đặt hộ chỉ gồm các khung giờ trên cùng một sân.");
      return;
    }
    if (slot.slotIndex !== first.slotIndex - 1 && slot.slotIndex !== last.slotIndex + 1) {
      showToast("Hãy chọn ô liền kề trước hoặc sau khung giờ đang chọn.");
      return;
    }

    state.selectedSlots.set(slot.key, slot);
    renderGrid();
  }

  function showGridState(name) {
    refs.loading.hidden = name !== "loading";
    refs.error.hidden = name !== "error";
    refs.gridContainer.hidden = name !== "ready";
  }

  async function loadGrid() {
    if (!refs.date.value) {
      refs.errorMessage.textContent = "Vui lòng chọn ngày để xem lịch sân.";
      showGridState("error");
      return;
    }
    const requestId = ++state.requestId;
    if (!state.hasLoaded || state.loadedDate !== refs.date.value) showGridState("loading");
    try {
      const response = await global.axiosClient.get("/v1/slots/grid", {
        params: { date: refs.date.value, slot_minutes: 30 },
      });
      if (requestId !== state.requestId) return;
      buildGridFromApi(response.data);
      renderGrid();
      state.hasLoaded = true;
      state.loadedDate = response.data.date || refs.date.value;
      showGridState("ready");
    } catch (error) {
      if (requestId !== state.requestId) return;
      const message = error.response?.data?.detail || error.message || "Có lỗi trong lúc tải lưới sân.";
      if (state.hasLoaded && state.loadedDate === refs.date.value) showToast(`Không thể làm mới lưới: ${message}`);
      else {
        refs.errorMessage.textContent = message;
        showGridState("error");
      }
    }
  }

  function showToast(message) {
    refs.toast.textContent = message;
    refs.toast.classList.add("is-visible");
    global.clearTimeout(state.toastTimer);
    state.toastTimer = global.setTimeout(() => refs.toast.classList.remove("is-visible"), 3600);
  }

  function bookingStatusLabel(status) {
    return ({
      Pending: "Chờ xác nhận",
      Confirmed: "Đã xác nhận",
      CHECKED_IN: "Đã nhận sân",
      NO_SHOW: "Không đến",
      Completed: "Đã hoàn tất",
      Cancelled: "Đã hủy",
      Expired: "Đã hết hạn",
    })[status] || status || "Không rõ";
  }

  async function openBookingInfo(slot) {
    if (!slot.bookingId) {
      showToast("Không tìm thấy mã booking của khung giờ này.");
      return;
    }
    const requestId = ++state.infoRequestId;
    const isHeld = slot.status === "held";
    refs.infoStatus.textContent = isHeld ? "PHIÊN ĐANG GIỮ CHỖ" : "THÔNG TIN LƯỢT ĐẶT";
    refs.infoContent.innerHTML = '<p class="slot-info-loading">Đang tải thông tin khách hàng…</p>';
    refs.infoDialog.showModal();

    try {
      let booking = state.bookingCache.get(slot.bookingId);
      if (!booking) {
        const response = await global.axiosClient.get(`/bookings/${slot.bookingId}/reception`);
        booking = response.data;
        state.bookingCache.set(slot.bookingId, booking);
      }
      if (requestId !== state.infoRequestId || !refs.infoDialog.open) return;
      const ranges = (booking.slots || [])
        .filter((item) => String(item.status).toLowerCase() === "active")
        .map((item) => {
          const startAt = String(item.start_at || "");
          const endAt = String(item.end_at || "");
          return `${escapeHtml(item.court_name || slot.courtName)} · ${escapeHtml(formatDate(startAt.slice(0, 10)))} · ${escapeHtml(startAt.slice(11, 16))}–${escapeHtml(endAt.slice(11, 16))}`;
        });
      const status = bookingStatusLabel(booking.status);
      const expires = slot.holdExpiresAt
        ? `<div class="slot-detail-row"><span>Hạn giữ chỗ</span><strong>${escapeHtml(new Date(slot.holdExpiresAt).toLocaleString("vi-VN"))}</strong></div>`
        : "";
      const discountRow = Number(booking.discount_amount) > 0
        ? `<div class="slot-detail-row"><span>Tiền sân gốc</span><strong>${formatMoney(booking.subtotal_price || booking.total_price)}</strong></div>
           <div class="slot-detail-row"><span>Ưu đãi${booking.discount_code ? ` (${escapeHtml(booking.discount_code)})` : ""}</span><strong>-${formatMoney(booking.discount_amount)}</strong></div>`
        : "";
      refs.infoContent.innerHTML = `<div class="slot-detail-list">
        <div class="slot-detail-row"><span>Mã lượt</span><strong>${escapeHtml(booking.booking_code || "—")}</strong></div>
        <div class="slot-detail-row"><span>Người đặt</span><strong>${escapeHtml(booking.user_name || "Khách vãng lai")}</strong></div>
        <div class="slot-detail-row"><span>Số điện thoại</span><strong>${escapeHtml(booking.user_phone || "—")}</strong></div>
        <div class="slot-detail-row"><span>Sân và giờ</span><strong>${ranges.length ? ranges.join("<br>") : `${escapeHtml(slot.courtName)} · ${escapeHtml(slot.time)}–${escapeHtml(slot.endTime)}`}</strong></div>
        ${discountRow}
        <div class="slot-detail-row"><span>Tổng tiền</span><strong>${formatMoney(booking.total_price)}</strong></div>
        <div class="slot-detail-row"><span>Trạng thái</span><strong><span class="slot-detail-status ${isHeld ? "held" : ""}">${escapeHtml(status)}</span></strong></div>
        ${booking.payment_status ? `<div class="slot-detail-row"><span>Thanh toán</span><strong>${escapeHtml(booking.payment_status)}</strong></div>` : ""}
        ${expires}
        ${booking.note ? `<div class="slot-detail-row"><span>Ghi chú</span><strong>${escapeHtml(booking.note)}</strong></div>` : ""}
      </div>`;
    } catch (error) {
      if (requestId !== state.infoRequestId || !refs.infoDialog.open) return;
      const message = error.response?.data?.detail || error.message || "Không tải được thông tin booking.";
      refs.infoContent.innerHTML = `<p class="slot-info-error">${escapeHtml(message)}</p>`;
    }
  }

  function openWalkInForm() {
    const selected = getSelectedSlots();
    if (!selected.length) {
      showToast("Hãy chọn các ô trống liền nhau trên cùng một sân trước.");
      return;
    }
    state.activeSlots = selected;
    refs.walkInForm.reset();
    const first = selected[0];
    const last = selected[selected.length - 1];
    const total = selected.reduce((sum, slot) => sum + slot.price, 0);
    refs.selectedSummary.textContent = `${first.courtName} · ${formatDate(first.date, { day: "2-digit", month: "2-digit", year: "numeric" })} · ${first.time}–${last.endTime} (${durationLabel(selected.length * 30)}) · ${formatMoney(total)}`;
    refs.walkInDialog.showModal();
    refs.walkInForm.elements.customerName.focus();
  }

  function handleGridClick(event) {
    const button = event.target.closest("button[data-slot-key]");
    if (!button || button.disabled) return;
    const slot = state.slotsByKey.get(button.dataset.slotKey);
    if (!slot) return;
    if (slot.status === "available") changeSelection(slot);
    else if (slot.status === "booked" || slot.status === "held") void openBookingInfo(slot);
  }

  async function handleWalkInSubmit(event) {
    event.preventDefault();
    if (!state.activeSlots.length || refs.walkInForm.dataset.submitting === "true") return;
    const formData = new FormData(refs.walkInForm);
    const selected = state.activeSlots;
    const currentSlots = selected.map((slot) => state.slotsByKey.get(slot.key));
    if (currentSlots.some((slot) => !slot || slot.status !== "available")) {
      refs.walkInDialog.close();
      state.activeSlots = [];
      showToast("Một hoặc nhiều ô vừa không còn trống. Lưới sẽ được tải lại.");
      void loadGrid();
      return;
    }
    const slots = currentSlots.sort((left, right) => left.slotIndex - right.slotIndex);
    const first = slots[0];
    const last = slots[slots.length - 1];
    if (slots.some((slot, index) => slot.courtId !== first.courtId || (index > 0 && slot.slotIndex !== slots[index - 1].slotIndex + 1))) {
      refs.walkInDialog.close();
      state.activeSlots = [];
      showToast("Các ô được chọn phải liền nhau trên cùng một sân.");
      return;
    }
    const submitButton = refs.walkInForm.querySelector('[type="submit"]');
    const originalLabel = submitButton.textContent;
    refs.walkInForm.dataset.submitting = "true";
    submitButton.disabled = true;
    submitButton.textContent = "Đang lưu…";
    try {
      const response = await global.axiosClient.post("/bookings/walk-in", {
        court_id: Number(first.courtId),
        booking_date: first.date,
        start_time: `${first.time}:00`,
        end_time: `${last.endTime}:00`,
        customer_name: String(formData.get("customerName")).trim(),
        customer_phone: String(formData.get("customerPhone")).trim(),
        booking_channel: "Counter",
        note: String(formData.get("note") || "").trim() || null,
      });
      refs.walkInDialog.close();
      state.activeSlots = [];
      state.selectedSlots.clear();
      showToast(`Đã lưu booking ${response.data.booking_code}.`);
      await loadGrid();
    } catch (error) {
      const message = error.response?.data?.detail || error.message || "Không thể lưu lượt đặt hộ.";
      if (error.response?.status === 409) {
        refs.walkInDialog.close();
        state.activeSlots = [];
        showToast("Khung giờ vừa được người khác đặt. Lưới đã được cập nhật.");
        await loadGrid();
      } else {
        showToast(message);
      }
    } finally {
      refs.walkInForm.dataset.submitting = "false";
      submitButton.disabled = false;
      submitButton.textContent = originalLabel;
    }
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

    refs.date.addEventListener("change", () => {
      state.selectedSlots.clear();
      state.activeSlots = [];
      updateSelectionPanel();
      void loadGrid();
    });
    byId("refreshGrid").addEventListener("click", () => void loadGrid());
    byId("retryGrid").addEventListener("click", () => void loadGrid());
    refs.clearSelection.addEventListener("click", () => {
      state.selectedSlots.clear();
      renderGrid();
    });
    refs.proceedWalkIn.addEventListener("click", openWalkInForm);
    refs.grid.addEventListener("click", handleGridClick);
    refs.walkInForm.addEventListener("submit", handleWalkInSubmit);
    document.addEventListener("click", closeDialogFromButton);
    document.querySelectorAll(".slot-dialog").forEach((dialog) => {
      dialog.addEventListener("click", (event) => {
        if (event.target === dialog) {
          if (dialog === refs.infoDialog) state.infoRequestId += 1;
          dialog.close();
        }
      });
    });
    void loadGrid();
  }

  void boot();
})(window);
