/**
 * ============================================================================
 * RK BADMINTON — BOOKING MATRIX LOGIC + 10-MINUTE HOLD COUNTDOWN
 * ============================================================================
 */

// 1. CẤU HÌNH HẰNG SỐ & KHUNG GIỜ (5:30 -> 24:00 = 37 MỐC 30 PHÚT)
const DEFAULT_SLOT_PRICE = 60000;
const HOLD_DURATION_MS = 10 * 60 * 1000; // 10 phút (đổi thành 10 * 1000 để test nhanh popup hết giờ)

const COURTS = Array.from({ length: 10 }, (_, idx) => ({
  id: `court_${idx + 1}`,
  name: `C.Lông ${idx + 1}`
}));

function generateTimeSlots() {
  const slots = [];
  let totalMinutes = 5 * 60 + 30;
  const endMinutes = 24 * 60;
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

const AVAILABLE_DATES = [
  { dateStr: '2026-11-16', dayLabel: 'Thứ 2', dayNum: '16', fullLabel: 'THỨ HAI, 16 THÁNG 11', shortLabel: '16/11/2026', badge: 'Hôm nay' },
  { dateStr: '2026-11-17', dayLabel: 'Thứ 3', dayNum: '17', fullLabel: 'THỨ BA, 17 THÁNG 11', shortLabel: '17/11/2026', badge: 'Còn trống' },
  { dateStr: '2026-11-18', dayLabel: 'Thứ 4', dayNum: '18', fullLabel: 'THỨ TƯ, 18 THÁNG 11', shortLabel: '18/11/2026', badge: 'Còn trống' },
  { dateStr: '2026-11-19', dayLabel: 'Thứ 5', dayNum: '19', fullLabel: 'THỨ NĂM, 19 THÁNG 11', shortLabel: '19/11/2026', badge: 'Còn trống' },
  { dateStr: '2026-11-20', dayLabel: 'Thứ 6', dayNum: '20', fullLabel: 'THỨ SÁU, 20 THÁNG 11', shortLabel: '20/11/2026', badge: 'Hot' },
  { dateStr: '2026-11-21', dayLabel: 'Thứ 7', dayNum: '21', fullLabel: 'THỨ BẢY, 21 THÁNG 11', shortLabel: '21/11/2026', badge: 'Cuối tuần' },
  { dateStr: '2026-11-22', dayLabel: 'CN',    dayNum: '22', fullLabel: 'CHỦ NHẬT, 22 THÁNG 11', shortLabel: '22/11/2026', badge: 'Cuối tuần' },
  { dateStr: '2026-11-23', dayLabel: 'Thứ 2', dayNum: '23', fullLabel: 'THỨ HAI, 23 THÁNG 11', shortLabel: '23/11/2026', badge: 'Còn trống' }
];

// 2. STATE QUẢN LÝ ỨNG DỤNG
const appState = {
  currentDate: AVAILABLE_DATES[0],
  gridData: [],
  selectedSlots: new Map(),
  holdSession: null,        // { holdId, holdUntil, slots, grouped, totalPrice, date }
  holdTimerInterval: null
};

// 3. MOCK DATA & TẦNG DỊCH VỤ API
function buildMockGridData(dateStr) {
  const daySeed = parseInt(dateStr.split('-')[2], 10) || 16;

  return COURTS.map((court, cIdx) => {
    const slots = TIME_SLOTS.map((tSlot) => {
      let status = 'available';
      const price = DEFAULT_SLOT_PRICE;

      if (tSlot.index >= 0 && tSlot.index <= 13) {
        status = 'locked';
      }

      if (court.id === 'court_8' && (tSlot.index === 15 || tSlot.index === 16)) {
        status = 'event';
      }

      const isEveningPeak = tSlot.index >= 21 && tSlot.index <= 30;
      if (isEveningPeak) {
        if (
          (cIdx % 2 === 0 && tSlot.index >= 22 && tSlot.index <= 26) ||
          (cIdx % 3 === 1 && tSlot.index >= 25 && tSlot.index <= 29) ||
          ((cIdx + daySeed) % 4 === 0 && tSlot.index >= 21 && tSlot.index <= 24)
        ) {
          status = 'booked';
        }
      }

      return {
        id: `${court.id}_${tSlot.index}`,
        courtId: court.id,
        courtName: court.name,
        slotIndex: tSlot.index,
        startTime: tSlot.startTime,
        endTime: tSlot.endTime,
        status,
        price
      };
    });

    return {
      courtId: court.id,
      courtName: court.name,
      slots
    };
  });
}

async function fetchSlotsGrid(dateStr) {
  // TODO: Thay bằng fetch(`/api/v1/slots/grid?date=${dateStr}`)
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(buildMockGridData(dateStr));
    }, 40);
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
    const courtNumA = parseInt(a.courtId.replace('court_', ''), 10);
    const courtNumB = parseInt(b.courtId.replace('court_', ''), 10);
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
        alert('Bạn đang giữ chỗ. Vui lòng tiếp tục xác nhận hoặc bấm "Hủy giữ" trước khi đổi ngày.');
        return;
      }

      const selectedDateStr = card.dataset.date;
      if (selectedDateStr === appState.currentDate.dateStr) return;

      const found = AVAILABLE_DATES.find((item) => item.dateStr === selectedDateStr);
      if (found) {
        appState.currentDate = found;
        appState.selectedSlots.clear();
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

      if (slot.status === 'available') {
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
        cells.push(`
          <td class="merged-slot-cell" colspan="${span}">
            <div
              class="merged-block ${slot.status}"
              title="${courtRow.courtName} • ${slot.startTime} - ${endMergedTime} (${statusLabels[slot.status]})"
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
    metaEl.textContent = `Đơn giá tiêu chuẩn: ${formatCurrencyVND(DEFAULT_SLOT_PRICE)} / 30 phút`;
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
    ? `Đang giữ chỗ ${totalSlots} khung giờ`
    : `Đã chọn ${totalSlots} khung giờ`;
  detailsEl.textContent = `${groupStrings.join('  |  ')} (${appState.currentDate.shortLabel})`;
  detailsEl.title = `${groupStrings.join(', ')} — Ngày ${appState.currentDate.shortLabel}`;
  metaEl.textContent = `Tổng thời lượng: ${totalMinutes} phút (${(totalMinutes / 60).toFixed(1).replace('.0', '')} giờ) • Đơn giá ${formatCurrencyVND(DEFAULT_SLOT_PRICE)}/30p`;
  totalAmountEl.textContent = formatCurrencyVND(totalPrice);

  btnClearAll.disabled = false;
  btnProceed.disabled = false;
}

// 6. LOGIC GIỮ CHỖ & ĐẾM NGƯỢC 10 PHÚT
function startHoldCountdown(holdUntilISO) {
  if (appState.holdTimerInterval) {
    clearInterval(appState.holdTimerInterval);
  }

  const footerBar = document.getElementById('bottomSummaryBar');
  const gridCard = document.querySelector('.grid-card');
  const btnClearAll = document.getElementById('btnClearAll');
  const holdCountdownBox = document.getElementById('holdCountdownBox');
  const countdownDisplay = document.getElementById('countdownDisplay');
  const btnProceed = document.getElementById('btnProceed');
  const btnGoBookingConfirm = document.getElementById('btnGoBookingConfirm');

  const slotsArray = Array.from(appState.selectedSlots.values());
  const grouped = groupConsecutiveSlots();
  const totalPrice = slotsArray.reduce((sum, s) => sum + s.price, 0);

  appState.holdSession = {
    holdId: 'HOLD_' + Date.now(),
    holdUntil: holdUntilISO,
    date: appState.currentDate,
    slots: slotsArray,
    grouped,
    totalPrice
  };

  sessionStorage.setItem('rk_hold_session', JSON.stringify(appState.holdSession));

  // Cập nhật UI sang trạng thái giữ chỗ
  footerBar.classList.add('is-holding');
  gridCard?.classList.add('is-locked');
  btnClearAll.classList.add('hidden');
  holdCountdownBox.classList.remove('hidden');
  btnProceed.classList.add('hidden');
  btnGoBookingConfirm.classList.remove('hidden');

  renderGridBody();
  updateSummaryBar();

  const expireTime = new Date(holdUntilISO).getTime();

  function tick() {
    const remainingMs = expireTime - Date.now();
    if (remainingMs <= 0) {
      clearInterval(appState.holdTimerInterval);
      appState.holdTimerInterval = null;
      countdownDisplay.textContent = '00:00';
      handleHoldTimeout();
      return;
    }

    const totalSeconds = Math.floor(remainingMs / 1000);
    const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
    const seconds = String(totalSeconds % 60).padStart(2, '0');
    countdownDisplay.textContent = `${minutes}:${seconds}`;
    countdownDisplay.classList.toggle('urgent', totalSeconds <= 60);
  }

  tick();
  appState.holdTimerInterval = setInterval(tick, 1000);
}

function resetHoldUIState() {
  if (appState.holdTimerInterval) {
    clearInterval(appState.holdTimerInterval);
    appState.holdTimerInterval = null;
  }

  appState.holdSession = null;
  sessionStorage.removeItem('rk_hold_session');

  document.getElementById('bottomSummaryBar').classList.remove('is-holding');
  document.querySelector('.grid-card')?.classList.remove('is-locked');
  document.getElementById('btnClearAll').classList.remove('hidden');
  document.getElementById('holdCountdownBox').classList.add('hidden');
  document.getElementById('countdownDisplay').classList.remove('urgent');
  document.getElementById('btnProceed').classList.remove('hidden');
  document.getElementById('btnGoBookingConfirm').addEventListener('click', () => {
    if (!appState.holdSession) {
      alert('Phiên giữ chỗ đã hết hạn, vui lòng chọn lại sân!');
      return;
    }
    sessionStorage.setItem('rk_hold_session', JSON.stringify(appState.holdSession));
    window.location.href = './booking.html';
  });
}

function handleHoldTimeout() {
  document.getElementById('cancelHoldModal')?.classList.remove('open');
  resetHoldUIState();
  document.getElementById('holdExpiredModal').classList.add('open');
}

async function reloadGridAfterTimeout() {
  document.getElementById('holdExpiredModal').classList.remove('open');
  document.getElementById('cancelHoldModal')?.classList.remove('open');
  resetHoldUIState();
  appState.selectedSlots.clear();
  await loadAndRenderGrid();
  updateSummaryBar();
}

// 7. SỰ KIỆN TƯƠNG TÁC
function handleSlotClick(event) {
  if (appState.holdSession) return;

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

async function loadAndRenderGrid() {
  appState.gridData = await fetchSlotsGrid(appState.currentDate.dateStr);
  renderGridHeader();
  renderGridBody();
}

// 8. KHỞI TẠO ỨNG DỤNG
async function initApp() {
  renderDateCards();
  await loadAndRenderGrid();
  updateSummaryBar();

  const scrollContainer = document.getElementById('gridScrollContainer');
  if (scrollContainer) {
    scrollContainer.scrollLeft = 12 * 58;
  }

  document.getElementById('bookingTableBody').addEventListener('click', handleSlotClick);
  document.getElementById('btnClearAll').addEventListener('click', clearAllSelections);
  document.getElementById('btnProceed').addEventListener('click', openConfirmModal);

  document.getElementById('btnPricingInfo').addEventListener('click', (e) => {
    e.preventDefault();
    alert('Bảng giá chuẩn RK Badminton:\n• Khung giờ thường: 60.000đ / 30 phút (120.000đ/giờ)\n• Khung giờ vàng (17:00 - 22:00): 75.000đ / 30 phút');
  });

  document.getElementById('btnCloseModal').addEventListener('click', closeConfirmModal);
  document.getElementById('btnCancelModal').addEventListener('click', closeConfirmModal);
  document.getElementById('confirmModal').addEventListener('click', (e) => {
    if (e.target.id === 'confirmModal') closeConfirmModal();
  });

  // Bấm "Xác nhận giữ chỗ" -> Đóng modal & Bắt đầu đếm ngược 10 phút trên thanh đáy
  document.getElementById('btnConfirmSubmit').addEventListener('click', () => {
    if (appState.selectedSlots.size === 0) return;

    // TODO: Khi nối API thật, gọi POST /api/v1/bookings/hold và lấy hold_until từ response
    const holdUntilISO = new Date(Date.now() + HOLD_DURATION_MS).toISOString();

    closeConfirmModal();
    startHoldCountdown(holdUntilISO);
  });

  // Bấm "TIẾP TỤC XÁC NHẬN →" -> Chuyển sang bước xác nhận đặt sân (module Đặt sân)
  document.getElementById('btnGoBookingConfirm').addEventListener('click', () => {
    if (!appState.holdSession) {
      alert('Phiên giữ chỗ đã hết hạn, vui lòng chọn lại sân!');
      return;
    }
    sessionStorage.setItem('rk_hold_session', JSON.stringify(appState.holdSession));
    window.location.href = './booking_confirm.html';
  });

  // Hết giờ -> Bấm "Tải lại lưới sân"
  document.getElementById('btnReloadGrid').addEventListener('click', reloadGridAfterTimeout);

  // Hủy giữ chỗ -> Mở modal xác nhận hủy
  const cancelHoldModal = document.getElementById('cancelHoldModal');

  document.getElementById('btnCancelHold').addEventListener('click', () => {
    if (!appState.holdSession) return;
    cancelHoldModal.classList.add('open');
  });

  document.getElementById('btnKeepHold').addEventListener('click', () => {
    cancelHoldModal.classList.remove('open');
  });

  cancelHoldModal.addEventListener('click', (e) => {
    if (e.target.id === 'cancelHoldModal') {
      cancelHoldModal.classList.remove('open');
    }
  });

  document.getElementById('btnConfirmCancelHold').addEventListener('click', async () => {
    cancelHoldModal.classList.remove('open');
    // TODO: Khi nối API thật, gọi DELETE /api/v1/bookings/hold/${appState.holdSession.holdId}
    await reloadGridAfterTimeout();
  });

  document.getElementById('btnNextDays').addEventListener('click', async () => {
    if (appState.holdSession) {
      alert('Bạn đang giữ chỗ. Vui lòng tiếp tục xác nhận hoặc bấm "Hủy giữ" trước khi đổi ngày.');
      return;
    }

    const currentIndex = AVAILABLE_DATES.findIndex(
      (d) => d.dateStr === appState.currentDate.dateStr
    );
    const nextIndex = (currentIndex + 1) % AVAILABLE_DATES.length;
    appState.currentDate = AVAILABLE_DATES[nextIndex];
    appState.selectedSlots.clear();
    renderDateCards();
    await loadAndRenderGrid();
    updateSummaryBar();
  });
}

document.addEventListener('DOMContentLoaded', initApp);