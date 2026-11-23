/**
 * ============================================================================
 * RK BADMINTON — BOOKING MATRIX LOGIC + 10-MINUTE HOLD COUNTDOWN
 * ============================================================================
 */

// Backend mở cửa 06:00–23:00 và trả dữ liệu theo giờ; giao diện hiển thị mỗi 30 phút.
const API_ROOT =
  (typeof CONFIG !== "undefined" && CONFIG.API_BASE_URL) ||
  "http://127.0.0.1:8000/api";

function getAccessToken() {
  return localStorage.getItem("access_token") || sessionStorage.getItem("access_token");
}

function getLoggedInUser() {
  const raw = localStorage.getItem("user") || sessionStorage.getItem("user");
  try { return raw ? JSON.parse(raw) : null; } catch { return null; }
}

async function requireAuthenticatedUser() {
  const loginUrl = "./login.html";
  try {
    const user = await window.RK_CUSTOMER_ACCOUNT.load();
    if (!user) {
      window.location.replace(loginUrl);
      return null;
    }
    return user;
  } catch (error) {
    if ([401, 403].includes(error.status)) {
      const reason = error.status === 403 ? "locked" : "session-expired";
      window.location.replace(`${loginUrl}?reason=${reason}`);
      return null;
    }
    throw error;
  }
}

async function apiRequest(path, options = {}) {
  const token = getAccessToken();
  if (!token) throw new Error("Vui lòng đăng nhập trước khi đặt sân.");
  const response = await fetch(`${API_ROOT}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(data?.detail || `Lỗi API ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

/**
 * Tạo danh sách khung giờ 30 phút từ 06:00 đến 23:00
 */
function generateTimeSlots() {
  const slots = [];
  let totalMinutes = 6 * 60;
  const endMinutes = 23 * 60;
  let index = 0;

  while (totalMinutes < endMinutes) {
    const startH = Math.floor(totalMinutes / 60);
    const startM = totalMinutes % 60;
    const nextTotal = totalMinutes + 30;
    const endH = Math.floor(nextTotal / 60);
    const endM = nextTotal % 60;

    const formatTime = (h, m) => `${h}:${m === 0 ? '00' : m}`;
    slots.push({
      index,
      startTime: formatTime(startH, startM),
      endTime: formatTime(endH, endM),
      isHourMark: startM === 0
    });

    totalMinutes = nextTotal;
    index++;
  }
  return slots;
}

const TIME_SLOTS = generateTimeSlots();

function buildAvailableDates(count = 8) {
  const names = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];
  const result = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < count; i++) {
    const day = new Date(today);
    day.setDate(today.getDate() + i);
    const yyyy = day.getFullYear();
    const mm = String(day.getMonth() + 1).padStart(2, "0");
    const dd = String(day.getDate()).padStart(2, "0");
    const dateStr = `${yyyy}-${mm}-${dd}`;
    const dateLabel = day.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
    const longDate = day.toLocaleDateString("vi-VN", { day: "2-digit", month: "long" }).toUpperCase();
    result.push({
      dateStr,
      dayLabel: names[day.getDay()],
      dayNum: dd,
      fullLabel: `${names[day.getDay()].toUpperCase()}, ${longDate}`,
      shortLabel: dateLabel,
      badge: i === 0 ? "Hôm nay" : (day.getDay() === 0 || day.getDay() === 6 ? "Cuối tuần" : "Còn trống"),
    });
  }
  return result;
}

const AVAILABLE_DATES = buildAvailableDates();
const overviewDay = new URLSearchParams(window.location.search).get("day");
if (/^\d{4}-\d{2}-\d{2}$/.test(overviewDay || "") &&
    !AVAILABLE_DATES.some((item) => item.dateStr === overviewDay)) {
  const day = new Date(overviewDay + "T12:00:00");
  if (!Number.isNaN(day.getTime())) AVAILABLE_DATES.push({
    dateStr: overviewDay,
    dayLabel: day.toLocaleDateString("vi-VN", { weekday: "long" }),
    dayNum: overviewDay.slice(8, 10),
    fullLabel: day.toLocaleDateString("vi-VN", { dateStyle: "full" }).toUpperCase(),
    shortLabel: day.toLocaleDateString("vi-VN"),
    badge: "",
  });
}

const GRID_REFRESH_MS = 15_000;

// 2. STATE QUẢN LÝ ỨNG DỤNG
const appState = {
  currentDate: AVAILABLE_DATES.find((item) => item.dateStr === overviewDay) || AVAILABLE_DATES[0],
  gridData: [],
  selectedSlots: new Map(),
  holdSession: null,
  holdTimer: null,
  isSubmittingHold: false,
  autoRefreshTimer: null,
  autoRefreshInFlight: false,
  refreshQueued: false,
  gridRequestId: 0,
};

async function fetchSlotsGrid(dateStr) {
  const result = await apiRequest(`/v1/slots/grid?date=${encodeURIComponent(dateStr)}`);
  const statusMap = { FREE: "available", BOOKED: "booked", HOLD: "booked", LOCKED: "locked" };
  const now = Date.now();

  return result.courts.map((court) => {
    const slots = [];
    court.slots.forEach((item) => {
      // Chuỗi datetime từ API không có múi giờ; giữ nguyên giờ địa phương.
      const start = new Date(item.start_at);
      for (let part = 0; part < 2; part++) {
        const slotStart = new Date(start.getTime() + part * 30 * 60 * 1000);
        const slotEnd = new Date(slotStart.getTime() + 30 * 60 * 1000);
        const timeLabel = (value) => `${value.getHours()}:${String(value.getMinutes()).padStart(2, "0")}`;
        let status = statusMap[item.status] || "locked";
        if (slotStart.getTime() <= now) status = "locked";
        slots.push({
          id: `${court.court_id}_${slotStart.getTime()}`,
          courtId: String(court.court_id),
          courtName: court.court_name,
          slotIndex: slots.length,
          startTime: timeLabel(slotStart),
          endTime: timeLabel(slotEnd),
          startAt: slotStart,
          endAt: slotEnd,
          status,
          price: Number(item.price) / 2,
        });
      }
    });
    return { courtId: String(court.court_id), courtName: court.court_name, slots };
  });
}

// 4. HÀM XỬ LÝ NGHIỆP VỤ
function formatCurrencyVND(amount) {
  return amount.toLocaleString('vi-VN') + 'đ';
}

function groupConsecutiveSlots() {
  const items = Array.from(appState.selectedSlots.values());
  if (items.length === 0) return [];

  items.sort((a, b) => {
    const courtNumA = Number(a.courtId);
    const courtNumB = Number(b.courtId);
    if (courtNumA !== courtNumB) return courtNumA - courtNumB;
    return a.slotIndex - b.slotIndex;
  });

  const groups = [];
  let currentGroup = null;

  for (const slot of items) {
    if (
      currentGroup &&
      currentGroup.courtId === slot.courtId &&
      slot.slotIndex === currentGroup.lastSlotIndex + 1
    ) {
      currentGroup.endTime = slot.endTime;
      currentGroup.lastSlotIndex = slot.slotIndex;
      currentGroup.slotCount += 1;
      currentGroup.totalPrice += slot.price;
    } else {
      currentGroup = {
        courtId: slot.courtId,
        courtName: slot.courtName,
        startTime: slot.startTime,
        endTime: slot.endTime,
        lastSlotIndex: slot.slotIndex,
        slotCount: 1,
        totalPrice: slot.price
      };
      groups.push(currentGroup);
    }
  }

  return groups;
}

// 5. RENDER GIAO DIỆN
function renderDateCards() {
  const container = document.getElementById('dateCardsContainer');
  container.innerHTML = AVAILABLE_DATES.map((d) => {
    const isActive = d.dateStr === appState.currentDate.dateStr;
    return `
      <button
        type="button"
        class="date-card ${isActive ? 'active' : ''}"
        data-date="${d.dateStr}"
        aria-pressed="${isActive}"
      >
        <span class="date-card-day">${d.dayLabel}</span>
        <span class="date-card-num">${d.dayNum}</span>
        <span class="date-card-badge">${d.badge}</span>
      </button>
    `;
  }).join('');

  container.querySelectorAll('.date-card').forEach((card) => {
    card.addEventListener('click', async () => {
      if (appState.holdSession) {
        showAppNotice("Bạn đang giữ chỗ. Hãy xác nhận tiếp hoặc hủy giữ trước khi đổi ngày.", { type: "warning" });
        return;
      }
      const selectedDateStr = card.dataset.date;
      if (selectedDateStr === appState.currentDate.dateStr) return;

      const found = AVAILABLE_DATES.find((item) => item.dateStr === selectedDateStr);
      if (found) {
        appState.currentDate = found;
        appState.selectedSlots.clear();
        resetAutoRefresh();
        renderDateCards();
        await loadAndRenderGrid();
        updateSummaryBar();
      }
    });
  });
}

function renderGridHeader() {
  const thead = document.getElementById('bookingTableHead');
  const timeHeadersHtml = TIME_SLOTS.map((slot) => `
    <th class="time-header-cell ${slot.isHourMark ? 'hour-mark' : ''}" title="${slot.startTime} - ${slot.endTime}">
      ${slot.startTime}
    </th>
  `).join('');

  thead.innerHTML = `
    <tr>
      <th class="corner-cell" rowspan="2">
        <span class="corner-label">Sân / Giờ</span>
      </th>
      <th class="date-banner-cell" colspan="${TIME_SLOTS.length}">
        ${appState.currentDate.fullLabel}
      </th>
    </tr>
    <tr>
      ${timeHeadersHtml}
    </tr>
  `;
}

function renderGridBody() {
  const tbody = document.getElementById('bookingTableBody');
  const selectedCourtIds = new Set(
    Array.from(appState.selectedSlots.values()).map((s) => s.courtId)
  );
  const isHolding = Boolean(appState.holdSession);

  const rowsHtml = appState.gridData.map((courtRow) => {
    const hasSelection = selectedCourtIds.has(courtRow.courtId);
    const cells = [];
    let i = 0;

    while (i < courtRow.slots.length) {
      const slot = courtRow.slots[i];

      const isOwnHeldSlot = isHolding && appState.selectedSlots.has(slot.id);
      if (slot.status === 'available' || isOwnHeldSlot) {
        const isSelected = appState.selectedSlots.has(slot.id);
        const stateClass = isSelected ? (isHolding ? 'holding' : 'selected') : 'available';
        cells.push(`
          <td class="slot-cell">
            <button
              type="button"
              class="slot-btn ${stateClass}"
              data-slot-id="${slot.id}"
              data-court-id="${slot.courtId}"
              data-slot-index="${slot.slotIndex}"
              aria-label="${slot.courtName} lúc ${slot.startTime} đến ${slot.endTime}"
              title="${slot.courtName} • ${slot.startTime} - ${slot.endTime} (${formatCurrencyVND(slot.price)})"
            >
              ${isSelected ? '✓' : ''}
            </button>
          </td>
        `);
        i++;
      } else {
        let span = 1;
        while (
          i + span < courtRow.slots.length &&
          courtRow.slots[i + span].status === slot.status
        ) {
          span++;
        }

        const statusLabels = {
          locked: 'Khoá',
          booked: 'Đã đặt',
          event: 'Sự kiện'
        };

        const endMergedTime = courtRow.slots[i + span - 1].endTime;
        const isSuggestible = slot.status === 'booked';
        cells.push(`
          <td class="merged-slot-cell" colspan="${span}">
            <div
              class="merged-block ${slot.status}${isSuggestible ? ' suggestible' : ''}"
              ${isSuggestible ? `role="button" tabindex="0" data-slot-id="${slot.id}" data-court-id="${slot.courtId}" data-slot-index="${slot.slotIndex}"` : ''}
              title="${courtRow.courtName} • ${slot.startTime} - ${endMergedTime} (${statusLabels[slot.status]})"
              ${isSuggestible ? `aria-label="${courtRow.courtName} lúc ${slot.startTime} đến ${endMergedTime} đã hết chỗ. Xem giờ gợi ý."` : ''}
            >
              ${statusLabels[slot.status]}
            </div>
          </td>
        `);
        i += span;
      }
    }

    return `
      <tr data-court-row="${courtRow.courtId}" class="${hasSelection ? 'has-selection' : ''}">
        <th class="court-cell" scope="row">
          <span>${courtRow.courtName}</span>
          <span class="court-selected-dot" title="Đang chọn ô trên sân này"></span>
        </th>
        ${cells.join('')}
      </tr>
    `;
  }).join('');

  tbody.innerHTML = rowsHtml;
}

function updateSummaryBar() {
  const totalSlots = appState.selectedSlots.size;
  const badgeEl = document.getElementById('slotCountBadge');
  const titleEl = document.getElementById('summaryTitle');
  const detailsEl = document.getElementById('summaryDetails');
  const metaEl = document.getElementById('summaryMeta');
  const totalAmountEl = document.getElementById('totalAmountDisplay');
  const btnClearAll = document.getElementById('btnClearAll');
  const btnProceed = document.getElementById('btnProceed');

  if (totalSlots === 0) {
    badgeEl.textContent = '00';
    badgeEl.classList.add('empty');
    titleEl.textContent = 'Chưa chọn khung giờ nào';
    detailsEl.textContent = 'Vui lòng chạm vào các ô trống màu trắng trên lưới để bắt đầu đặt sân';
    metaEl.textContent = "Giá được lấy từ bảng giá backend";
    totalAmountEl.textContent = '0đ';
    btnClearAll.disabled = true;
    btnProceed.disabled = true;
    return;
  }

  const grouped = groupConsecutiveSlots();
  const totalMinutes = totalSlots * 30;
  const totalPrice = Array.from(appState.selectedSlots.values()).reduce(
    (sum, item) => sum + item.price,
    0
  );

  const groupStrings = grouped.map(
    (g) => `${g.courtName} • ${g.startTime} – ${g.endTime}`
  );

  badgeEl.textContent = String(totalSlots).padStart(2, '0');
  badgeEl.classList.remove('empty');
  titleEl.textContent = appState.holdSession
    ? `Đang giữ ${totalSlots} khung giờ`
    : `Đã chọn ${totalSlots} khung giờ`;
  detailsEl.textContent = `${groupStrings.join('  |  ')} (${appState.currentDate.shortLabel})`;
  detailsEl.title = `${groupStrings.join(', ')} — Ngày ${appState.currentDate.shortLabel}`;
  metaEl.textContent = `Tổng thời lượng: ${totalMinutes} phút (${(totalMinutes / 60).toFixed(1).replace('.0', '')} giờ) • Giá lấy từ backend`;
  totalAmountEl.textContent = formatCurrencyVND(totalPrice);

  btnClearAll.disabled = Boolean(appState.holdSession);
  btnProceed.disabled = Boolean(appState.holdSession);
}

// 6. SỰ KIỆN TƯƠNG TÁC
function handleSlotClick(event) {
  if (appState.holdSession) return;

  const bookedBlock = event.target.closest('.merged-block.booked.suggestible');
  if (bookedBlock) {
    const courtId = bookedBlock.dataset.courtId;
    let slotIndex = Number(bookedBlock.dataset.slotIndex);
    if (Number.isFinite(event.clientX) && event.clientX > 0) {
      const bounds = bookedBlock.getBoundingClientRect();
      const span = Number(bookedBlock.parentElement?.colSpan) || 1;
      if (bounds.width > 0) {
        const offset = Math.min(Math.max(event.clientX - bounds.left, 0), bounds.width - 1);
        slotIndex += Math.floor((offset / bounds.width) * span);
      }
    }
    const court = appState.gridData.find((item) => item.courtId === courtId);
    const slot = court?.slots[slotIndex] || findGridSlot(bookedBlock.dataset.slotId);
    if (slot) showSlotSuggestions(slot);
    return;
  }

  const btn = event.target.closest('.slot-btn');
  if (!btn) return;

  const slotId = btn.dataset.slotId;
  const courtId = btn.dataset.courtId;
  const slotIndex = parseInt(btn.dataset.slotIndex, 10);

  if (appState.selectedSlots.has(slotId)) {
    appState.selectedSlots.delete(slotId);
    btn.classList.remove('selected');
    btn.classList.add('available');
    btn.innerHTML = '';
  } else {
    const courtObj = appState.gridData.find((c) => c.courtId === courtId);
    const slotObj = courtObj.slots[slotIndex];
    appState.selectedSlots.set(slotId, slotObj);

    btn.classList.remove('available');
    btn.classList.add('selected');
    btn.innerHTML = '✓';
  }

  const rowEl = document.querySelector(`tr[data-court-row="${courtId}"]`);
  if (rowEl) {
    const courtStillHasSelection = Array.from(appState.selectedSlots.values()).some(
      (s) => s.courtId === courtId
    );
    rowEl.classList.toggle('has-selection', courtStillHasSelection);
  }

  updateSummaryBar();
}

function findGridSlot(slotId) {
  for (const court of appState.gridData) {
    const slot = court.slots.find((item) => item.id === slotId);
    if (slot) return slot;
  }
  return null;
}

function findSuggestedSlots(referenceSlot, excludedSlotId = referenceSlot?.id) {
  if (!referenceSlot) return [];
  const candidates = appState.gridData.flatMap((court) => court.slots)
    .filter((slot) =>
      slot.id !== excludedSlotId &&
      slot.status === 'available' &&
      !appState.selectedSlots.has(slot.id) &&
      slot.startAt.toDateString() === referenceSlot.startAt.toDateString()
    )
    .map((slot) => {
      const sameTime = slot.startAt.getTime() === referenceSlot.startAt.getTime();
      const sameCourt = slot.courtId === referenceSlot.courtId;
      return {
        slot,
        priority: sameTime && !sameCourt ? 0 : 1,
        distance: Math.abs(slot.startAt.getTime() - referenceSlot.startAt.getTime()),
        courtOrder: Number(slot.courtId),
      };
    })
    .sort((a, b) =>
      a.priority - b.priority ||
      a.distance - b.distance ||
      Number(a.slot.courtId !== referenceSlot.courtId) - Number(b.slot.courtId !== referenceSlot.courtId) ||
      a.courtOrder - b.courtOrder
    );
  return candidates.slice(0, 5).map(({ slot }) => slot);
}

function showSlotSuggestions(referenceSlot, options = {}) {
  const modal = document.getElementById('slotSuggestionModal');
  const title = document.getElementById('slotSuggestionTitle');
  const description = document.getElementById('slotSuggestionDescription');
  const list = document.getElementById('slotSuggestionList');
  if (!modal || !title || !description || !list) return;

  const suggestions = findSuggestedSlots(referenceSlot, options.excludedSlotId);
  title.textContent = 'Khung giờ vừa hết chỗ';
  description.textContent = `${referenceSlot.startTime} tại ${referenceSlot.courtName} không còn khả dụng. ${suggestions.length ? 'Gợi ý khung giờ trống gần nhất trong ngày:' : 'Hiện chưa có khung giờ trống gần đó trong ngày này.'}`;
  list.replaceChildren();

  for (const slot of suggestions) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'slot-suggestion-card';
    button.dataset.suggestSlotId = slot.id;

    const info = document.createElement('span');
    info.className = 'slot-suggestion-info';
    const court = document.createElement('strong');
    court.textContent = slot.courtName;
    const time = document.createElement('span');
    time.textContent = `${slot.startTime} – ${slot.endTime}`;
    info.append(court, time);

    const price = document.createElement('strong');
    price.className = 'slot-suggestion-price';
    price.textContent = formatCurrencyVND(slot.price);
    button.append(info, price);
    list.append(button);
  }

  modal.classList.add('open');
}

function closeSlotSuggestions() {
  document.getElementById('slotSuggestionModal')?.classList.remove('open');
}

function chooseSuggestedSlot(slotId) {
  const slot = findGridSlot(slotId);
  if (!slot || slot.status !== 'available') {
    closeSlotSuggestions();
    showAppNotice('Khung giờ gợi ý vừa thay đổi. Lưới đang được cập nhật.', { type: 'info' });
    void loadAndRenderGrid({ preserveSelection: true, silent: true });
    return;
  }

  const replacedSelection = appState.selectedSlots.size > 0;
  appState.selectedSlots.clear();
  appState.selectedSlots.set(slot.id, slot);
  closeSlotSuggestions();
  renderGridBody();
  updateSummaryBar();
  if (replacedSelection) {
    showAppNotice('Đã chuyển lựa chọn sang khung giờ gợi ý.', { type: 'info' });
  }

  requestAnimationFrame(() => {
    const target = document.querySelector(`.slot-btn[data-slot-id="${CSS.escape(slot.id)}"]`);
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    target.focus({ preventScroll: true });
    target.classList.add('suggestion-highlight');
    window.setTimeout(() => target.classList.remove('suggestion-highlight'), 2200);
  });
}

function clearAllSelections() {
  if (appState.holdSession) return;

  appState.selectedSlots.clear();
  document.querySelectorAll('.slot-btn.selected').forEach((btn) => {
    btn.classList.remove('selected');
    btn.classList.add('available');
    btn.innerHTML = '';
  });
  document.querySelectorAll('tr.has-selection').forEach((row) => {
    row.classList.remove('has-selection');
  });
  updateSummaryBar();
}

function openConfirmModal() {
  const grouped = groupConsecutiveSlots();
  if (grouped.length === 0) return;

  const modal = document.getElementById('confirmModal');
  const modalDateText = document.getElementById('modalDateText');
  const modalList = document.getElementById('modalBookingList');
  const modalTotal = document.getElementById('modalTotalPrice');

  modalDateText.textContent = `${appState.currentDate.fullLabel} (${appState.currentDate.shortLabel})`;

  let grandTotal = 0;
  modalList.innerHTML = grouped.map((g) => {
    grandTotal += g.totalPrice;
    return `
      <li class="modal-summary-item">
        <span><strong>${g.courtName}</strong> • ${g.startTime} – ${g.endTime} (${g.slotCount * 30} phút)</span>
        <strong class="modal-item-price">${formatCurrencyVND(g.totalPrice)}</strong>
      </li>
    `;
  }).join('');

  modalTotal.textContent = formatCurrencyVND(grandTotal);
  modal.classList.add('open');
}

function closeConfirmModal() {
  document.getElementById('confirmModal').classList.remove('open');
}

function formatLocalDateTime(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
}

function setHoldCountdownVisible(visible) {
  const countdownBox = document.getElementById("holdCountdownBox");
  if (!countdownBox) return;
  countdownBox.hidden = !visible;
  countdownBox.classList.toggle("hidden", !visible);
}

function startHoldCountdown(holdSession) {
  if (appState.holdTimer) clearInterval(appState.holdTimer);
  appState.holdSession = holdSession;
  sessionStorage.setItem("rk_hold_session", JSON.stringify(holdSession));
  setHoldCountdownVisible(true);
  document.getElementById("btnGoBookingConfirm").hidden = false;
  document.getElementById("btnProceed").hidden = true;
  document.getElementById("gridCard")?.classList.add("is-locked");
  renderGridBody();
  updateSummaryBar();

  const tick = () => {
    const remaining = new Date(holdSession.holdUntil).getTime() - Date.now();
    if (remaining <= 0) {
      void apiRequest("/v1/slots/release", {
        method: "POST",
        body: JSON.stringify({ booking_id: holdSession.holdId, user_id: holdSession.userId }),
      }).catch(() => {});
      clearInterval(appState.holdTimer);
      appState.holdTimer = null;
      appState.holdSession = null;
      sessionStorage.removeItem("rk_hold_session");
      appState.selectedSlots.clear();
      setHoldCountdownVisible(false);
      document.getElementById("btnGoBookingConfirm").hidden = true;
      document.getElementById("btnProceed").hidden = false;
      document.getElementById("gridCard")?.classList.remove("is-locked");
      document.getElementById("holdExpiredModal")?.classList.add("open");
      void loadAndRenderGrid()
        .then(updateSummaryBar)
        .catch((error) => showAppNotice(error.message, { type: "error" }));
      return;
    }
    const seconds = Math.floor(remaining / 1000);
    document.getElementById("countdownDisplay").textContent =
      `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  };
  tick();
  appState.holdTimer = setInterval(tick, 1000);
}

function restoreHoldSession() {
  let saved;
  try { saved = JSON.parse(sessionStorage.getItem("rk_hold_session") || "null"); }
  catch { saved = null; }
  if (!saved?.holdId) return;

  if (new Date(saved.holdUntil).getTime() <= Date.now()) {
    sessionStorage.removeItem("rk_hold_session");
    void apiRequest("/v1/slots/release", {
      method: "POST",
      body: JSON.stringify({ booking_id: saved.holdId, user_id: saved.userId }),
    }).catch(() => {});
    showAppNotice("Phiên giữ chỗ đã hết hạn. Hãy chọn lại khung giờ.", { type: "warning" });
    return;
  }

  const date = AVAILABLE_DATES.find((item) => item.dateStr === saved.date?.dateStr);
  if (!date) return;
  saved.date = date;
  saved.slots = (saved.slots || []).map((slot) => ({
    ...slot,
    startAt: new Date(slot.startAt),
    endAt: new Date(slot.endAt),
  }));
  appState.currentDate = date;
  appState.holdSession = saved;
  appState.selectedSlots = new Map(saved.slots.map((slot) => [slot.id, slot]));
  startHoldCountdown(saved);
}

async function cancelCurrentHold() {
  const hold = appState.holdSession;
  if (!hold) return true;
  try {
    await apiRequest("/v1/slots/release", {
      method: "POST",
      body: JSON.stringify({ booking_id: hold.holdId, user_id: hold.userId }),
    });
  } catch (error) {
    showAppNotice(error.message, { type: "error" });
    return false;
  }

  try {
    if (appState.holdTimer) clearInterval(appState.holdTimer);
    appState.holdTimer = null;
    appState.holdSession = null;
    appState.selectedSlots.clear();
    sessionStorage.removeItem("rk_hold_session");
    setHoldCountdownVisible(false);
    document.getElementById("btnGoBookingConfirm").hidden = true;
    document.getElementById("btnProceed").hidden = false;
    document.getElementById("gridCard")?.classList.remove("is-locked");
    document.getElementById("cancelHoldModal")?.classList.remove("open");
    showAppNotice("Đã hủy giữ chỗ và mở lại các khung giờ.", { type: "success" });
    await loadAndRenderGrid();
  } catch (error) {
    showAppNotice(error.message, { type: "error" });
  }
  updateSummaryBar();
  return true;
}

async function loadAndRenderGrid({ preserveSelection = false, silent = false } = {}) {
  const requestId = ++appState.gridRequestId;
  const requestedDate = appState.currentDate.dateStr;
  let freshGrid;
  try {
    freshGrid = await fetchSlotsGrid(requestedDate);
  } catch (error) {
    if (silent) return false;
    throw error;
  }
  if (requestId !== appState.gridRequestId || requestedDate !== appState.currentDate.dateStr) return false;
  if (!freshGrid.length) {
    if (silent) return false;
    throw new Error("Database chưa có sân nào. Hãy kiểm tra backend và dữ liệu courts.");
  }

  let lostSelection = null;
  if (preserveSelection && !appState.holdSession) {
    const freshById = new Map(freshGrid.flatMap((court) => court.slots).map((slot) => [slot.id, slot]));
    for (const [slotId, oldSlot] of appState.selectedSlots) {
      const currentSlot = freshById.get(slotId);
      if (currentSlot?.status === 'available') {
        appState.selectedSlots.set(slotId, currentSlot);
      } else {
        appState.selectedSlots.delete(slotId);
        if (!lostSelection && currentSlot?.status === 'booked') lostSelection = currentSlot;
      }
    }
  }

  appState.gridData = freshGrid;
  renderGridHeader();
  renderGridBody();
  updateSummaryBar();

  if (lostSelection) {
    showAppNotice(`${lostSelection.courtName} lúc ${lostSelection.startTime} vừa có người giữ hoặc đặt. Ô đó đã được bỏ chọn.`, { type: 'warning' });
    showSlotSuggestions(lostSelection);
  }
  return true;
}

function stopAutoRefresh() {
  if (appState.autoRefreshTimer) {
    clearInterval(appState.autoRefreshTimer);
    appState.autoRefreshTimer = null;
  }
}

function startAutoRefresh() {
  stopAutoRefresh();
  if (document.visibilityState !== 'visible') return;
  appState.autoRefreshTimer = window.setInterval(async () => {
    if (document.visibilityState !== 'visible' || appState.autoRefreshInFlight) return;
    appState.autoRefreshInFlight = true;
    try {
      await loadAndRenderGrid({ preserveSelection: true, silent: true });
    } finally {
      finishAutoRefresh();
    }
  }, GRID_REFRESH_MS);
}

async function refreshGridImmediately() {
  if (appState.autoRefreshInFlight) {
    appState.refreshQueued = true;
    return;
  }
  appState.autoRefreshInFlight = true;
  try {
    await loadAndRenderGrid({ preserveSelection: true, silent: true });
  } finally {
    finishAutoRefresh();
  }
}

function finishAutoRefresh() {
  appState.autoRefreshInFlight = false;
  if (appState.refreshQueued && document.visibilityState === 'visible') {
    appState.refreshQueued = false;
    void refreshGridImmediately();
  }
}

function resetAutoRefresh() {
  stopAutoRefresh();
  if (document.visibilityState === 'visible') startAutoRefresh();
}

// 8. KHỞI TẠO ỨNG DỤNG
async function initApp() {
  let authenticatedUser;
  try {
    authenticatedUser = await requireAuthenticatedUser();
  } catch (error) {
    showAppNotice(error.message, { type: "error" });
    return;
  }
  if (!authenticatedUser) {
    return;
  }
  const flashNotice = sessionStorage.getItem("rk_grid_notice");
  if (flashNotice) {
    sessionStorage.removeItem("rk_grid_notice");
    showAppNotice(flashNotice, { type: "info" });
  }
  restoreHoldSession();
  renderDateCards();
  try {
    await loadAndRenderGrid();
  } catch (error) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = TIME_SLOTS.length + 1;
    cell.textContent = error.message;
    row.appendChild(cell);
    document.getElementById("bookingTableBody").replaceChildren(row);
    showAppNotice(error.message, { type: "error" });
  }
  updateSummaryBar();

  const scrollContainer = document.getElementById('gridScrollContainer');
  if (scrollContainer) {
    scrollContainer.scrollLeft = 12 * 58;
  }

  document.getElementById('bookingTableBody').addEventListener('click', handleSlotClick);
  document.getElementById('bookingTableBody').addEventListener('keydown', (event) => {
    if ((event.key === 'Enter' || event.key === ' ') && event.target.closest('.merged-block.booked.suggestible')) {
      event.preventDefault();
      handleSlotClick(event);
    }
  });
  document.getElementById('slotSuggestionList')?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-suggest-slot-id]');
    if (button) chooseSuggestedSlot(button.dataset.suggestSlotId);
  });
  document.getElementById('btnCloseSlotSuggestions')?.addEventListener('click', closeSlotSuggestions);
  document.getElementById('slotSuggestionModal')?.addEventListener('click', (event) => {
    if (event.target.id === 'slotSuggestionModal') closeSlotSuggestions();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      stopAutoRefresh();
      appState.refreshQueued = false;
      return;
    }
    void refreshGridImmediately();
    startAutoRefresh();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeSlotSuggestions();
  });
  document.getElementById('btnClearAll').addEventListener('click', clearAllSelections);
  document.getElementById('btnProceed').addEventListener('click', openConfirmModal);

  document.getElementById('btnPricingInfo').addEventListener('click', (e) => {
    e.preventDefault();
    showAppNotice('Giá từng khung giờ được lấy từ bảng giá hiện tại trong hệ thống.', { type: "info" });
  });

  document.getElementById('btnCloseModal').addEventListener('click', closeConfirmModal);
  document.getElementById('btnCancelModal').addEventListener('click', closeConfirmModal);
  document.getElementById('confirmModal').addEventListener('click', (e) => {
    if (e.target.id === 'confirmModal') closeConfirmModal();
  });

  document.getElementById('btnConfirmSubmit').addEventListener('click', async (event) => {
    if (appState.isSubmittingHold || appState.selectedSlots.size === 0) return;
    const groups = groupConsecutiveSlots();
    if (groups.length !== 1) {
      showAppNotice("Hãy chọn các khung giờ liền nhau trên cùng một sân để tiếp tục.", { type: "warning" });
      return;
    }
    const user = getLoggedInUser();
    if (!user?.id) {
      showAppNotice("Không đọc được thông tin tài khoản. Vui lòng đăng nhập lại.", { type: "error" });
      return;
    }

    const slots = Array.from(appState.selectedSlots.values()).sort(
      (a, b) => a.startAt - b.startAt
    );
    const button = event.currentTarget;
    appState.isSubmittingHold = true;
    button.disabled = true;
    try {
      const result = await apiRequest("/v1/slots/hold", {
        method: "POST",
        body: JSON.stringify({
          court_id: Number(slots[0].courtId),
          user_id: user.id,
          slots: slots.map((slot) => ({
            start_at: formatLocalDateTime(slot.startAt),
            end_at: formatLocalDateTime(slot.endAt),
          })),
        }),
      });

      const holdSession = {
        holdId: result.booking_id,
        holdUntil: result.hold_expires_at,
        userId: user.id,
        date: appState.currentDate,
        slots,
        grouped: groups,
        totalPrice: slots.reduce((sum, slot) => sum + slot.price, 0),
      };
      closeConfirmModal();
      startHoldCountdown(holdSession);
    } catch (error) {
      const lostSlot = slots[0];
      await loadAndRenderGrid({ silent: true });

      const conflict = error.status === 409 || /conflict|unavailable|not available|đã được|đã có người|không còn|hết chỗ|giữ chỗ|đang bị khóa|đã bắt đầu|đã qua/i.test(error.message);
      if (conflict && lostSlot) {
        appState.selectedSlots.clear();
        renderGridBody();
        updateSummaryBar();
        showAppNotice(error.message || 'Khung giờ vừa được người khác giữ hoặc đặt.', { type: 'warning' });
        showSlotSuggestions(lostSlot, { excludedSlotId: lostSlot.id });
      } else {
        showAppNotice(error.message, { type: "error" });
      }
    } finally {
      appState.isSubmittingHold = false;
      button.disabled = false;
    }
  });

  document.getElementById("btnGoBookingConfirm").addEventListener("click", () => {
    if (!appState.holdSession) return;
    const holdId = encodeURIComponent(appState.holdSession.holdId);
    window.location.href = `./booking_confirm.html?hold_id=${holdId}`;
  });

  document.getElementById("btnCancelHold").addEventListener("click", () => {
    document.getElementById("cancelHoldModal")?.classList.add("open");
  });

  document.getElementById("btnKeepHold")?.addEventListener("click", () => {
    document.getElementById("cancelHoldModal")?.classList.remove("open");
  });

  document.getElementById("btnConfirmCancelHold")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    const wasCancelled = await cancelCurrentHold();
    button.disabled = false;
    if (!wasCancelled) return;
  });

  document.getElementById("btnReloadGrid")?.addEventListener("click", async () => {
    document.getElementById("holdExpiredModal")?.classList.remove("open");
    try {
      await loadAndRenderGrid();
      updateSummaryBar();
      showAppNotice("Lưới sân đã được cập nhật.", { type: "success" });
    } catch (error) {
      showAppNotice(error.message, { type: "error" });
    }
  });

  document.getElementById('btnNextDays').addEventListener('click', async () => {
    if (appState.holdSession) {
      showAppNotice("Bạn đang giữ chỗ. Hãy xác nhận tiếp hoặc hủy giữ trước khi đổi ngày.", { type: "warning" });
      return;
    }
    const currentIndex = AVAILABLE_DATES.findIndex(
      (d) => d.dateStr === appState.currentDate.dateStr
    );
    const nextIndex = (currentIndex + 1) % AVAILABLE_DATES.length;
    appState.currentDate = AVAILABLE_DATES[nextIndex];
    appState.selectedSlots.clear();
    resetAutoRefresh();
    renderDateCards();
    await loadAndRenderGrid();
    updateSummaryBar();
  });

  startAutoRefresh();
}

document.addEventListener('DOMContentLoaded', initApp);
