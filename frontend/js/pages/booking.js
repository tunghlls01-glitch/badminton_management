const $ = s => document.querySelector(s);
const money = n => new Intl.NumberFormat('vi-VN').format(n) + 'đ';
const bookingsKey = 'san-nha-bookings';

const venues = {
  phutho: {
    name: 'Sân cầu lông Phú Thọ',
    sport: 'Cầu lông',
    address: '219 Lý Thường Kiệt, Quận 11',
    price: 120000
  },
  riverside: {
    name: 'Pickleball Riverside',
    sport: 'Pickleball',
    address: '28 Nguyễn Hữu Cảnh, Bình Thạnh',
    price: 180000
  },
  tanphu: {
    name: 'Sân cầu lông Tân Phú',
    sport: 'Cầu lông',
    address: '15 Tân Sơn Nhì, Tân Phú',
    price: 100000
  }
};

const initial = [
  { id: 1, venue: 'phutho', court: '03', date: '2026-11-10', start: '18:00', duration: 2, status: 'confirmed' },
  { id: 2, venue: 'riverside', court: '02', date: '2026-11-12', start: '16:00', duration: 2, status: 'pending' },
  { id: 3, venue: 'tanphu', court: '01', date: '2026-11-14', start: '18:00', duration: 2, status: 'confirmed' },
  { id: 4, venue: 'phutho', court: '02', date: '2026-11-09', start: '14:00', duration: 2, status: 'done' }
];

let bookings;
try {
  const saved = JSON.parse(localStorage.getItem(bookingsKey));
  bookings = Array.isArray(saved) && saved.every(b =>
    b && venues[b.venue] && /^\d{4}-\d{2}-\d{2}$/.test(b.date) &&
    /^\d{2}:\d{2}$/.test(b.start) && Number(b.duration) > 0
  ) ? saved : initial;
} catch (error) {
  console.error('Không thể đọc lịch đặt sân đã lưu.', error);
  bookings = initial;
}

let filter = 'upcoming', weekOffset = 0, toastTimer;

const dateOf = s => new Date(s + 'T12:00:00');
const dateText = s => dateOf(s).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
const localDate = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const isUpcoming = b => {
  const today = localDate(new Date());
  return b.status !== 'done' && b.status !== 'cancelled' &&
    (b.date > today || (b.date === today && b.start >= new Date().toTimeString().slice(0, 5)));
};
const endTime = b => {
  const minutes = Number(b.start.slice(0, 2)) * 60 + Number(b.start.slice(3)) + Number(b.duration) * 60;
  return String(Math.floor(minutes / 60)).padStart(2, '0') + ':' + String(minutes % 60).padStart(2, '0');
};
const statusText = status =>
  status === 'pending' ? 'Chờ xác nhận' :
  status === 'done' ? 'Đã hoàn thành' :
  status === 'cancelled' ? 'Đã hủy' : 'Đã xác nhận';
const bookingReference = b => b.booking_code || ('SN-' + String(b.id).padStart(8, '0'));

function toast(message) {
  $('#toast').textContent = message;
  $('#toast').classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('#toast').classList.remove('show'), 4000);
}

function info(title, content) {
  $('#infoTitle').textContent = title;
  $('#infoBody').innerHTML = content;
  $('#infoDialog').showModal();
  closeMenu();
}

function detail(id) {
  const b = bookings.find(x => x.id === Number(id));
  if (!b) return;
  const v = venues[b.venue];
  const row = (label, value) => `<div class="detail-row"><span>${label}</span><strong>${value}</strong></div>`;

  const matchStart = new Date(`${b.date}T${b.start}:00`);
  const now = new Date();
  const isPast = matchStart <= now;
  const isCancelled = b.status === 'cancelled';
  const isDone = b.status === 'done';

  let actionHtml = '';
  if (isCancelled) {
    actionHtml = `<div style="margin-top:14px;padding:10px;background:#f5f5f5;border-radius:8px;text-align:center;color:#888;font-weight:600">Lịch đặt này đã được hủy</div>`;
  } else if (isDone) {
    actionHtml = `<div style="margin-top:14px;padding:10px;background:#f5f5f5;border-radius:8px;text-align:center;color:#888;font-weight:600">Trận đấu đã hoàn thành</div>`;
  } else if (isPast) {
    actionHtml = `<div style="margin-top:14px;padding:10px;background:#fff5f5;border-radius:8px;text-align:center;color:var(--green);font-size:12px">Đã qua giờ bắt đầu trận đấu, không thể hủy đặt sân.</div>`;
  } else {
    actionHtml = `
      <button type="button" class="btn-cancel-action" id="btnOpenCancelModal">
        <svg style="width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/></svg>
        Hủy đặt sân này
      </button>
    `;
  }

  info(
    'Chi tiết đặt sân',
    `<p style="color:var(--green);font-weight:600;margin-top:0">${v.name}</p>` +
    row('Mã lượt đặt', bookingReference(b)) +
    row('Địa chỉ', v.address) +
    row('Sân', v.sport + ' · Sân ' + b.court) +
    row('Ngày chơi', dateOf(b.date).toLocaleDateString('vi-VN')) +
    row('Khung giờ', b.start + ' – ' + endTime(b)) +
    row('Trạng thái', statusText(b.status)) +
    row('Thành tiền', money(Number(b.total_price) || (v.price * b.duration))) +
    `<p class="form-note">Vui lòng đến trước 15 phút. Đưa mã đặt sân cho nhân viên tại quầy để nhận sân.</p>` +
    actionHtml
  );

  const cancelBtn = $('#btnOpenCancelModal');
  if (cancelBtn) {
    cancelBtn.onclick = () => openCancelConfirmation(b);
  }
}

async function openCancelConfirmation(b) {
  const v = venues[b.venue];
  const totalPrice = Number(b.total_price) || (v.price * Number(b.duration));
  const startDt = new Date(`${b.date}T${b.start}:00`);
  const now = new Date();
  const diffHours = (startDt - now) / 3600000;

  if (diffHours <= 0) {
    toast('Đã đến hoặc qua giờ vào sân, không thể hủy!');
    return;
  }

  let refundPercent = 0;
  let policyText = '';
  if (diffHours >= 24) {
    refundPercent = 100;
    policyText = 'Hủy trước 24 giờ: Hoàn lại 100% tổng tiền';
  } else if (diffHours >= 6) {
    refundPercent = 50;
    policyText = 'Hủy trước 6 giờ (từ 6h – 24h): Hoàn lại 50% tổng tiền';
  } else {
    refundPercent = 0;
    policyText = 'Hủy dưới 6 giờ trước giờ vào sân: Không hoàn tiền (0%)';
  }

  let refundAmount = Math.round(totalPrice * (refundPercent / 100));

  // Gọi backend cancellation preview nếu có kết nối
  if (typeof api !== "undefined" && b.id) {
    try {
      const preview = await api.get(`/bookings/${b.id}/cancellation-preview`);
      if (preview) {
        refundPercent = preview.refund_percent;
        refundAmount = preview.refund_amount;
        policyText = preview.policy_message;
      }
    } catch (err) {
      console.warn("Dùng tính toán chính sách hủy phía giao diện:", err);
    }
  }

  const hoursLeftDisplay = diffHours >= 24
    ? `${Math.floor(diffHours / 24)} ngày ${Math.round(diffHours % 24)} giờ`
    : `${diffHours.toFixed(1)} giờ`;

  const bodyEl = $('#cancelConfirmBody');
  bodyEl.innerHTML = `
    <div style="font-size:13px; line-height:1.6;">
      <p style="margin:0 0 10px;">Bạn đang yêu cầu hủy lượt đặt sân tại <strong>${v.name}</strong> (Sân ${b.court}).</p>
      <div class="detail-row"><span>Mã lượt đặt</span><strong>${bookingReference(b)}</strong></div>
      <div class="detail-row"><span>Thời gian chơi</span><strong>${dateOf(b.date).toLocaleDateString('vi-VN')} · ${b.start} – ${endTime(b)}</strong></div>
      <div class="detail-row"><span>Thời gian còn lại</span><strong style="color:var(--green)">Còn ${hoursLeftDisplay} trước giờ vào sân</strong></div>
      <div class="detail-row"><span>Tổng tiền ban đầu</span><strong>${money(totalPrice)}</strong></div>

      <div class="cancel-policy-card">
        <h4><svg style="width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg> Quy định hoàn tiền hủy sân:</h4>
        <ul>
          <li class="${diffHours >= 24 ? 'highlight' : ''}">• Trước 24 giờ: <strong>Hoàn 100%</strong></li>
          <li class="${diffHours >= 6 && diffHours < 24 ? 'highlight' : ''}">• Trước 6 giờ (từ 6h – 24h): <strong>Hoàn 50%</strong></li>
          <li class="${diffHours < 6 ? 'highlight' : ''}">• Dưới 6 giờ: <strong>Không hoàn tiền (0%)</strong></li>
        </ul>
      </div>

      <div style="background:#fff; border: 1.5px dashed var(--green); border-radius:8px; padding:12px; margin: 12px 0;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span>Tỷ lệ hoàn lại:</span>
          <strong style="font-size:15px; color:var(--green);">${refundPercent}%</strong>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:6px;">
          <span>Số tiền hoàn lại:</span>
          <strong style="font-size:17px; color:var(--green);">${money(refundAmount)}</strong>
        </div>
        <small style="display:block; margin-top:4px; color:var(--muted);">${policyText}</small>
      </div>

      <label style="display:block; margin-top:10px; font-weight:600; font-size:12px;">Lý do hủy (không bắt buộc):</label>
      <input id="cancelReasonInput" type="text" placeholder="Ví dụ: Bận đột xuất, thời tiết xấu..." style="width:100%; padding:9px 12px; border:1px solid #ddd; border-radius:6px; margin-top:5px; box-sizing:border-box;">

      <div id="cancelModalError" style="display:none; color:var(--green); background:#fff0f0; border:1px solid var(--green); border-radius:6px; padding:8px 12px; margin-top:10px; font-size:12px;"></div>

      <div style="display:flex; gap:10px; margin-top:18px;">
        <button type="button" class="close-dialog" style="flex:1; padding:11px; background:#f4f4f4; border:1px solid #ddd; border-radius:8px; font-weight:600; cursor:pointer;">Quay lại</button>
        <button type="button" id="btnSubmitCancelBooking" style="flex:1.4; padding:11px; background:var(--green); color:#fff; border:none; border-radius:8px; font-weight:600; cursor:pointer;">Xác nhận hủy đặt sân</button>
      </div>
    </div>
  `;

  // Đóng dialog chi tiết và mở dialog xác nhận hủy
  $('#infoDialog').close();
  $('#cancelConfirmDialog').showModal();

  $('#btnSubmitCancelBooking').onclick = async () => {
    const reason = $('#cancelReasonInput') ? $('#cancelReasonInput').value.trim() : '';
    const submitBtn = $('#btnSubmitCancelBooking');
    const errEl = $('#cancelModalError');
    if (errEl) errEl.style.display = 'none';

    try {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Đang hủy lịch...';

      // 1. Gọi backend API hủy
      if (typeof api !== "undefined" && b.id) {
        const query = reason ? `?reason=${encodeURIComponent(reason)}` : '';
        await api.post(`/bookings/${b.id}/cancel${query}`);
      }

      // 2. Cập nhật local state
      b.status = 'cancelled';
      try {
        localStorage.setItem(bookingsKey, JSON.stringify(bookings));
      } catch (err) {
        console.error("Lỗi khi lưu localStorage:", err);
      }

      // 3. Render lại UI
      renderBookings();
      renderCalendar();

      $('#cancelConfirmDialog').close();
      toast(`Đã hủy đặt sân thành công! Hoàn lại: ${money(refundAmount)} (${refundPercent}%)`);
    } catch (err) {
      console.error("Lỗi khi hủy đặt sân:", err);
      const errMsg = err.message || "Không thể hủy đặt sân vào lúc này!";
      if (errEl) {
        errEl.textContent = errMsg;
        errEl.style.display = 'block';
      }
      toast(errMsg);
      submitBtn.disabled = false;
      submitBtn.textContent = 'Xác nhận hủy đặt sân';
    }
  };
}

function renderBookings() {
  const selected = bookings.filter(b =>
    filter === 'all' ||
    (filter === 'done' ? (b.status === 'done' || b.status === 'cancelled') : isUpcoming(b))
  );
  $('#listCount').textContent = `(${selected.length})`;
  $('#bookingsBody').innerHTML = selected.length ? selected.map(b => {
    const v = venues[b.venue];
    const status = statusText(b.status);
    const pillClass = b.status === 'pending' ? 'pending' : b.status === 'done' ? 'done' : b.status === 'cancelled' ? 'cancelled' : '';
    return `<tr><td><div class="venue"><span class="venue-icon"><svg><use href="#i-court"/></svg></span><span><strong>${v.name}</strong><small>${v.sport} · Sân ${b.court}</small></span></div></td><td>${dateText(b.date)}<span style="color:#b0b7ab;padding:0 8px">·</span>${b.start} – ${endTime(b)}</td><td style="font-weight:600">${money(Number(b.total_price) || (v.price * b.duration))}</td><td><span class="pill ${pillClass}">${status}</span></td><td><button class="table-detail" data-detail="${b.id}" aria-label="Chi tiết ${v.name}"><svg><use href="#i-chevron"/></svg></button></td></tr>`;
  }).join('') : '<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:30px">Chưa có lượt đặt trong mục này.</td></tr>';

  const upcoming = bookings.filter(isUpcoming);
  $('#upcomingCount').textContent = String(upcoming.length).padStart(2, '0');
  $('#navCount').textContent = upcoming.length;

  const hours = upcoming.filter(b => b.date >= '2026-11-09' && b.date <= '2026-11-15').reduce((sum, b) => sum + Number(b.duration), 0);
  $('#hoursCount').innerHTML = hours + ' <span style="font-size:18px;font-weight:600">giờ</span>';
  renderNextBooking(upcoming);
}

function renderNextBooking(upcoming = bookings.filter(isUpcoming)) {
  const next = upcoming
    .sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start))[0];
  if (!next) {
    $('#next-venue').textContent = 'Chưa có lượt đặt';
    $('#next-address').textContent = 'Hãy đặt sân để thêm lịch chơi mới.';
    $('#next-date').textContent = '--/--/----';
    $('#next-time').textContent = '--:-- – --:--';
    return;
  }

  const venue = venues[next.venue];
  $('#next-sport').textContent = venue.sport.toUpperCase();
  $('#next-venue').textContent = venue.name + ' · Sân ' + next.court;
  $('#next-address').textContent = venue.address;
  $('#next-date').textContent = dateOf(next.date).toLocaleDateString('vi-VN');
  $('#next-time').textContent = next.start + ' – ' + endTime(next);
}

function renderCalendar() {
  const monday = new Date(2026, 10, 9 + weekOffset * 7, 12);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    return d;
  });
  const last = days[6];
  $('#weekTitle').textContent = `${String(monday.getDate()).padStart(2, '0')} – ${String(last.getDate()).padStart(2, '0')} tháng ${last.getMonth() + 1}, ${last.getFullYear()}`;
  $('#calendarHeader').innerHTML = '<div></div>' + days.map((d, i) => `<div class="day ${weekOffset === 0 && i === 1 ? 'today' : ''}"><small>${i === 6 ? 'CN' : 'TH ' + (i + 2)}</small><strong>${String(d.getDate()).padStart(2, '0')}</strong></div>`).join('');
  $('#calendarBody').innerHTML = '<div class="time-column">' + ['12:00', '14:00', '16:00', '18:00', '20:00', '22:00'].map(t => `<span>${t}</span>`).join('') + '</div>' + days.map((d, i) => {
    const iso = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    return `<div class="day-column ${weekOffset === 0 && i === 1 ? 'today' : ''}">` + bookings.filter(b => b.date === iso && b.status !== 'cancelled').map(b => {
      const hour = Number(b.start.slice(0, 2));
      const top = Math.max(0, Math.min(83, (hour - 12) / 12 * 100));
      const height = Math.min(100 - top, Number(b.duration) / 12 * 100 + 5);
      return `<button class="event ${b.status === 'pending' ? 'orange' : b.status === 'done' ? 'dark' : ''}" data-detail="${b.id}" style="top:${top}%;height:${height}%" aria-label="${venues[b.venue].name}, ${b.start}"><strong>${venues[b.venue].sport}</strong><small>Sân ${b.court}<br>${b.start}</small></button>`;
    }).join('') + '</div>';
  }).join('');
}

function closeMenu() {
  $('#sidebar').classList.remove('open');
  $('#menuButton').setAttribute('aria-expanded', 'false');
}

$('#menuButton').addEventListener('click', () => {
  const open = $('#sidebar').classList.toggle('open');
  $('#menuButton').setAttribute('aria-expanded', open);
});

document.addEventListener('click', e => {
  const detailButton = e.target.closest('[data-detail]');
  if (detailButton) detail(detailButton.dataset.detail);
  if (e.target.closest('.close-dialog')) e.target.closest('dialog').close();
  if (e.target.closest('.new-booking')) {
    setDialogError('');
    initDefaultDateTime();
    loadCourtsFromBackend();
    $('#bookingDialog').showModal();
    closeMenu();
  }
  if (e.target.closest('.supportButton')) {
    e.preventDefault();
    info('Sân Nhà luôn sẵn sàng', '<p>Cần đổi lịch, tìm sân hoặc hỗ trợ đặt sân?</p><div class="detail-row"><span>Hotline</span><a href="tel:1900636888"><strong>1900 636 888</strong></a></div><div class="detail-row"><span>Email</span><a href="mailto:hotro@sannha.vn"><strong>hotro@sannha.vn</strong></a></div><p class="form-note">Thời gian hỗ trợ: 07:00 – 22:00 mỗi ngày.<br>Thông tin liên hệ minh họa cho bản demo.</p>');
  }
  if (e.target.closest('[data-filter]')) {
    const button = e.target.closest('[data-filter]');
    filter = button.dataset.filter;
    document.querySelectorAll('[data-filter]').forEach(b => {
      b.classList.toggle('active', b === button);
      b.setAttribute('aria-pressed', b === button);
    });
    renderBookings();
  }
  if ($('#sidebar').classList.contains('open') && !e.target.closest('.sidebar') && !e.target.closest('#menuButton')) closeMenu();
});

document.querySelectorAll('dialog').forEach(d => d.addEventListener('click', e => {
  if (e.target === d) {
    const r = d.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) d.close();
  }
}));

$('#previousWeek').onclick = () => { weekOffset--; renderCalendar(); };
$('#nextWeek').onclick = () => { weekOffset++; renderCalendar(); };
$('#scheduleButton').onclick = () => { window.location.href = 'court_booking_schedule.html'; };
$('#exploreButton').onclick = () => {
  setDialogError('');
  initDefaultDateTime();
  loadCourtsFromBackend();
  $('#bookingDialog').showModal();
  closeMenu();
};
$('#view-schedule').onclick = () => { window.location.href = 'court_booking_schedule.html'; };
$('#offersButton').onclick = () => info('Ưu đãi dành cho bạn', '<div style="padding:20px;background:var(--green-light);border-radius:8px;color:var(--green)"><div class="eyebrow">CHƠI NHIỀU HƠN, VUI NHIỀU HƠN</div><h3 style="font-size:24px;margin:10px 0">Giảm 15% lượt đặt đầu</h3><p>Mã ưu đãi: <strong>CHAO SAN NHA</strong></p></div><p class="form-note">Ưu đãi minh họa. Chức năng áp dụng mã và thanh toán chưa được kết nối trong bản demo.</p>');
$('#profileButton').onclick = e => {
  e.preventDefault();
  info('Tài khoản của tôi', '<div class="detail-row"><span>Họ tên</span><strong>Minh Anh</strong></div><div class="detail-row"><span>Hạng thành viên</span><strong>Thành viên Sân Nhà</strong></div><p class="form-note">Đây là tài khoản minh họa. Kết nối hệ thống đăng nhập để quản lý thông tin cá nhân.</p>');
};
$('#notificationButton').onclick = () => {
  window.location.href = 'booking_notification.html';
};
$('#termsButton').onclick = e => {
  e.preventDefault();
  info('Điều khoản sử dụng', '<p>Vui lòng kiểm tra sân, ngày và giờ trước khi xác nhận. Liên hệ bộ phận hỗ trợ nếu bạn cần điều chỉnh lịch chơi.</p><p>Trang này là giao diện demo. Giá, địa điểm và thông tin đặt sân chỉ mang tính minh họa; không có giao dịch thanh toán thực tế.</p>');
};

function setDialogError(msg) {
  const errEl = $('#dialogError');
  if (!errEl) return;
  if (msg) {
    errEl.textContent = msg;
    errEl.style.display = 'block';
  } else {
    errEl.textContent = '';
    errEl.style.display = 'none';
  }
}

function initDefaultDateTime() {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinutes = now.getMinutes();
  const dateInput = $('#bookingDate');
  const startSelect = $('#startTime');

  if (dateInput) {
    dateInput.min = localDate(now);
  }

  if (startSelect && dateInput) {
    const options = Array.from(startSelect.options).map(o => o.value);
    const nextSlot = options.find(t => {
      const h = Number(t.slice(0, 2));
      return h > currentHour || (h === currentHour && currentMinutes < 15);
    });

    if (nextSlot) {
      dateInput.value = localDate(now);
      startSelect.value = nextSlot;
    } else {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      dateInput.value = localDate(tomorrow);
      startSelect.value = options[1] || options[0];
    }
  }
}

initDefaultDateTime();

function updatePrice() {
  $('#totalPrice').textContent = money(venues[$('#venueSelect').value].price * Number($('#duration').value));
}

$('#venueSelect').onchange = updatePrice;
$('#duration').onchange = updatePrice;

// Đồng bộ danh sách booking từ backend MySQL về giao diện
async function fetchBookingsFromBackend() {
  if (typeof api === "undefined") return;
  try {
    const list = await api.get("/bookings");
    if (Array.isArray(list) && list.length > 0) {
      // Map định dạng của backend sang định dạng giao diện
      const apiBookings = list.map(item => {
        const startStr = item.start_time ? item.start_time.slice(0, 5) : "18:00";
        let duration = 2;
        if (item.start_time && item.end_time) {
          const sMin = Number(item.start_time.slice(0, 2)) * 60 + Number(item.start_time.slice(3, 5));
          const eMin = Number(item.end_time.slice(0, 2)) * 60 + Number(item.end_time.slice(3, 5));
          if (eMin > sMin) duration = (eMin - sMin) / 60;
        }

        const courtNum = item.court_name ? item.court_name.replace(/\D/g, "") || String(item.court_id || 1).padStart(2, "0") : String(item.court_id || 1).padStart(2, "0");

        return {
          id: item.id,
          booking_code: item.booking_code,
          venue: 'phutho',
          court: courtNum.padStart(2, "0"),
          date: item.booking_date || localDate(new Date()),
          start: startStr,
          duration: duration,
          status: item.status ? item.status.toLowerCase() : 'confirmed',
          total_price: item.total_price
        };
      });

      bookings = apiBookings;
      renderBookings();
      renderCalendar();
    }
  } catch (err) {
    console.warn("Chưa tải được bookings từ server, dùng cache:", err);
  }
}

// Nạp danh sách sân thật từ Backend Database vào select box
async function loadCourtsFromBackend() {
  if (typeof api === "undefined") return;
  try {
    const courtsList = await api.get("/courts");
    const courtSelect = $("#courtSelect");
    if (!courtSelect || !courtsList || courtsList.length === 0) return;

    courtSelect.innerHTML = courtsList.map(c => {
      const courtNum = String(c.id).padStart(2, "0");
      const courtTitle = c.name || c.court_name || `Sân ${c.id}`;
      const isActive = c.status === "Active" || c.status === "HOẠT ĐỘNG";
      const statusLabel = isActive ? "" : " (Bảo trì)";
      return `<option value="${courtNum}" data-id="${c.id}" ${isActive ? "" : "disabled"}>${courtTitle}${statusLabel}</option>`;
    }).join("");
  } catch (err) {
    console.warn("Không thể tải danh sách sân từ backend, dùng danh sách mẫu:", err);
  }
}

loadCourtsFromBackend();
fetchBookingsFromBackend();

$('#bookingForm').onsubmit = async e => {
  e.preventDefault();
  setDialogError('');
  const submitBtn = $('#submitBookingBtn');

  const customerName = ($('#customerName') ? $('#customerName').value.trim() : '') || 'Minh Anh';
  const customerPhone = ($('#customerPhone') ? $('#customerPhone').value.trim() : '') || '0912345678';
  const noteInput = $('#bookingNote') ? $('#bookingNote').value.trim() : '';

  const venue = $('#venueSelect').value;
  const date = $('#bookingDate').value;
  const start = $('#startTime').value;
  const duration = Number($('#duration').value);
  const courtSelect = $('#courtSelect');
  const court = courtSelect.value;
  const startHour = Number(start.slice(0, 2));

  if (startHour + duration > 23) {
    const msg = 'Vui lòng chọn khung giờ kết thúc trước 23:00.';
    setDialogError(msg);
    toast(msg);
    return;
  }

  const current = new Date();
  const chosen = new Date(`${date}T${start}:00`);
  if (chosen <= current) {
    const msg = 'Vui lòng chọn khung giờ trong tương lai (sau giờ hiện tại).';
    setDialogError(msg);
    toast(msg);
    return;
  }

  // Tính end_time theo định dạng HH:MM:SS
  const startMinutes = startHour * 60 + Number(start.slice(3, 5) || 0);
  const endMinutes = startMinutes + duration * 60;
  const endStr = `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}:00`;
  const startStr = `${start}:00`;

  // Lấy court_id thật từ database
  const selectedOption = courtSelect.selectedOptions[0];
  const realCourtId = selectedOption && selectedOption.dataset.id ? Number(selectedOption.dataset.id) : (Number(court) || 1);

  const venueObj = venues[venue];
  const fullNote = noteInput ? `${noteInput} (${venueObj ? venueObj.name : venue})` : `Đặt tại ${venueObj ? venueObj.name : venue}`;

  let backendBookingId = null;
  let backendBookingCode = null;

  // 1. GỌI API BACKEND -> LƯU VÀO DATABASE MYSQL
  if (typeof api !== "undefined") {
    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Đang lưu vào hệ thống...';
      }

      const payload = {
        court_id: realCourtId,
        booking_date: date,
        start_time: startStr,
        end_time: endStr,
        customer_name: customerName,
        customer_phone: customerPhone,
        booking_channel: "Counter",
        note: fullNote
      };

      const res = await api.post("/bookings", payload);
      backendBookingId = res.id;
      backendBookingCode = res.booking_code;
      console.log("Đã lưu booking thành công vào Database MySQL:", res);
    } catch (apiErr) {
      console.error("Lỗi khi lưu vào Database MySQL:", apiErr);
      const errText = apiErr.message || "Lỗi khi lưu lịch vào cơ sở dữ liệu!";
      setDialogError(errText);
      toast(errText);
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Xác nhận đặt sân';
      }
      return;
    }
  }

  // 2. Lưu cache local để hiển thị UI
  const booking = {
    id: backendBookingId || Date.now(),
    booking_code: backendBookingCode,
    venue,
    court,
    date,
    start,
    duration,
    status: 'confirmed'
  };
  bookings.push(booking);
  try {
    localStorage.setItem(bookingsKey, JSON.stringify(bookings));
  } catch (error) {
    console.error('Không thể lưu vào localStorage', error);
  }

  window.location.href = `booking_notification.html?booking=${encodeURIComponent(booking.id)}`;
};

renderBookings();
renderCalendar();

// =============================================
// ĐẶT SÂN CỐ ĐỊNH HÀNG TUẦN (Recurring Booking)
// =============================================

let rcWeeksData = []; // Lưu kết quả kiểm tra từ backend

// Mở dialog đặt cố định từ nút chính
document.addEventListener('click', e => {
  if (e.target.closest('.recurring-booking')) {
    rcReset();
    rcLoadCourts();
    rcInitDate();
    $('#recurringDialog').showModal();
    closeMenu();
  }
  if (e.target.closest('#btnSwitchToRecurring') || e.target.closest('#btnTypeRecurring')) {
    e.preventDefault();
    openRecurringFromBooking();
  }
  if (e.target.closest('#rcBtnTypeSingle')) {
    e.preventDefault();
    openBookingFromRecurring();
  }
});

function openRecurringFromBooking() {
  const name = $('#customerName') ? $('#customerName').value : '';
  const phone = $('#customerPhone') ? $('#customerPhone').value : '';
  const courtSelect = $('#courtSelect');
  const selectedCourtOpt = courtSelect ? courtSelect.selectedOptions[0] : null;
  const courtId = selectedCourtOpt && selectedCourtOpt.dataset.id ? selectedCourtOpt.dataset.id : (courtSelect ? courtSelect.value : '');
  const date = $('#bookingDate') ? $('#bookingDate').value : '';
  const startTime = $('#startTime') ? $('#startTime').value : '';
  const duration = $('#duration') ? $('#duration').value : '2';
  const note = $('#bookingNote') ? $('#bookingNote').value : '';

  $('#bookingDialog').close();
  rcReset();

  rcLoadCourts().then(() => {
    if (courtId && $('#rcCourtSelect')) {
      const matchOpt = Array.from($('#rcCourtSelect').options).find(o => o.value === String(courtId));
      if (matchOpt) $('#rcCourtSelect').value = courtId;
    }
  });

  if (name && $('#rcCustomerName')) $('#rcCustomerName').value = name;
  if (phone && $('#rcCustomerPhone')) $('#rcCustomerPhone').value = phone;
  if (date && $('#rcStartDate')) $('#rcStartDate').value = date;
  if (startTime && $('#rcStartTime')) $('#rcStartTime').value = startTime;
  if (duration && $('#rcDuration')) $('#rcDuration').value = duration;
  if (note && $('#rcNote')) $('#rcNote').value = note;

  $('#recurringDialog').showModal();
}

function openBookingFromRecurring() {
  const name = $('#rcCustomerName') ? $('#rcCustomerName').value : '';
  const phone = $('#rcCustomerPhone') ? $('#rcCustomerPhone').value : '';
  const courtId = $('#rcCourtSelect') ? $('#rcCourtSelect').value : '';
  const date = $('#rcStartDate') ? $('#rcStartDate').value : '';
  const startTime = $('#rcStartTime') ? $('#rcStartTime').value : '';
  const duration = $('#rcDuration') ? $('#rcDuration').value : '2';
  const note = $('#rcNote') ? $('#rcNote').value : '';

  $('#recurringDialog').close();
  setDialogError('');

  loadCourtsFromBackend().then(() => {
    if (courtId && $('#courtSelect')) {
      const opt = Array.from($('#courtSelect').options).find(o => o.dataset.id === String(courtId) || o.value === String(courtId).padStart(2, '0'));
      if (opt) $('#courtSelect').value = opt.value;
    }
  });

  if (name && $('#customerName')) $('#customerName').value = name;
  if (phone && $('#customerPhone')) $('#customerPhone').value = phone;
  if (date && $('#bookingDate')) $('#bookingDate').value = date;
  if (startTime && $('#startTime')) $('#startTime').value = startTime;
  if (duration && $('#duration')) $('#duration').value = duration;
  if (note && $('#bookingNote')) $('#bookingNote').value = note;

  updatePrice();
  $('#bookingDialog').showModal();
}

// Đóng dialog khi click bên ngoài
$('#recurringDialog').addEventListener('click', e => {
  if (e.target === $('#recurringDialog')) {
    const r = e.target.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) {
      e.target.close();
    }
  }
});

function rcReset() {
  rcWeeksData = [];
  $('#recurringStep1').style.display = '';
  $('#recurringStep2').style.display = 'none';
  rcSetError('');
  rcSetError2('');
}

function rcSetError(msg) {
  const el = $('#rcError');
  if (!el) return;
  if (msg) { el.textContent = msg; el.style.display = 'block'; }
  else { el.textContent = ''; el.style.display = 'none'; }
}

function rcSetError2(msg) {
  const el = $('#rcError2');
  if (!el) return;
  if (msg) { el.textContent = msg; el.style.display = 'block'; }
  else { el.textContent = ''; el.style.display = 'none'; }
}

async function rcLoadCourts() {
  if (typeof api === 'undefined') return;
  try {
    const list = await api.get('/courts');
    const sel = $('#rcCourtSelect');
    if (!sel || !list || list.length === 0) return;
    sel.innerHTML = list.map(c => {
      const isActive = c.status === 'Active' || c.status === 'HOẠT ĐỘNG';
      const label = c.name || c.court_name || `Sân ${c.id}`;
      return `<option value="${c.id}" ${isActive ? '' : 'disabled'}>${label}${isActive ? '' : ' (Bảo trì)'}</option>`;
    }).join('');
  } catch (err) {
    console.warn('Không tải được danh sách sân cho đặt cố định:', err);
  }
}

function rcInitDate() {
  const el = $('#rcStartDate');
  if (!el) return;
  const now = new Date();
  el.min = localDate(now);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  el.value = localDate(tomorrow);
}

function rcCalcEndTime(startStr, durationHours) {
  const h = Number(startStr.slice(0, 2));
  const m = Number(startStr.slice(3, 5) || 0);
  const totalMin = h * 60 + m + durationHours * 60;
  return `${String(Math.floor(totalMin / 60)).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}:00`;
}

// Bước 1: Kiểm tra lịch trống
$('#rcCheckBtn').onclick = async () => {
  rcSetError('');
  const courtId = Number($('#rcCourtSelect').value);
  const startDate = $('#rcStartDate').value;
  const startTime = $('#rcStartTime').value;
  const duration = Number($('#rcDuration').value);
  const weeksCount = Number($('#rcWeeksCount').value);

  if (!courtId || !startDate || !startTime) {
    rcSetError('Vui lòng điền đầy đủ thông tin sân, ngày, giờ.');
    return;
  }

  const startHour = Number(startTime.slice(0, 2));
  if (startHour + duration > 23) {
    rcSetError('Khung giờ kết thúc phải trước 23:00.');
    return;
  }

  const chosen = new Date(`${startDate}T${startTime}:00`);
  if (chosen <= new Date()) {
    rcSetError('Vui lòng chọn ngày/giờ trong tương lai.');
    return;
  }

  const endTime = rcCalcEndTime(startTime, duration);
  const payload = {
    court_id: courtId,
    start_date: startDate,
    weeks_count: weeksCount,
    start_time: `${startTime}:00`,
    end_time: endTime
  };

  const btn = $('#rcCheckBtn');
  try {
    btn.disabled = true;
    btn.textContent = 'Đang kiểm tra...';
    const res = await api.post('/bookings/recurring/check', payload);
    rcWeeksData = res.weeks || [];
    rcRenderStep2(res);
  } catch (err) {
    const msg = err.message || 'Không thể kiểm tra lịch trống.';
    rcSetError(msg);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<svg><use href="#i-calendar"/></svg>Kiểm tra lịch trống các tuần';
  }
};

const dayNames = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];

function rcRenderStep2(res) {
  $('#recurringStep1').style.display = 'none';
  $('#recurringStep2').style.display = '';
  rcSetError2('');

  // Summary bar
  $('#rcSummaryBar').innerHTML = `
    <div class="rc-stat available"><strong>${res.available_weeks_count}</strong>Tuần trống</div>
    <div class="rc-stat conflict"><strong>${res.conflict_weeks_count}</strong>Tuần bị trùng</div>
    <div class="rc-stat total"><strong>${res.total_weeks}</strong>Tổng tuần</div>
  `;

  // Week list
  const weeks = res.weeks || [];
  $('#rcWeeksList').innerHTML = weeks.map((w, i) => {
    const d = new Date(w.booking_date + 'T12:00:00');
    const dateStr = d.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
    const timeStr = `${w.start_time.slice(0, 5)} – ${w.end_time.slice(0, 5)}`;

    if (w.is_available) {
      return `
        <div class="rc-week-item" data-idx="${i}">
          <span class="rc-week-num">${w.week_number}</span>
          <div class="rc-week-info">
            <strong>${dateStr}</strong>
            <small>${timeStr}</small>
          </div>
          <span class="rc-week-status ok">✓ Trống</span>
          <span class="rc-week-price">${money(w.price)}</span>
          <input type="checkbox" class="rc-week-checkbox" checked data-date="${w.booking_date}" data-available="1">
        </div>`;
    } else {
      return `
        <div class="rc-week-item conflict" data-idx="${i}">
          <span class="rc-week-num">${w.week_number}</span>
          <div class="rc-week-info">
            <strong>${dateStr}</strong>
            <small>${timeStr} · ${w.conflict_reason || 'Đã có người đặt'}</small>
          </div>
          <span class="rc-week-status bad">✗ Trùng lịch</span>
          <span class="rc-week-price" style="color:var(--muted);text-decoration:line-through">${money(w.price)}</span>
          <input type="checkbox" class="rc-week-checkbox" disabled data-date="${w.booking_date}" data-available="0" title="Tuần bị trùng, sẽ tự động bỏ qua">
        </div>`;
    }
  }).join('');

  rcUpdateTotal();

  // Gắn event cho checkbox
  $('#rcWeeksList').querySelectorAll('.rc-week-checkbox[data-available="1"]').forEach(cb => {
    cb.onchange = rcUpdateTotal;
  });
}

function rcUpdateTotal() {
  let total = 0;
  let count = 0;
  $('#rcWeeksList').querySelectorAll('.rc-week-checkbox[data-available="1"]:checked').forEach((cb, i) => {
    const idx = Number(cb.closest('.rc-week-item').dataset.idx);
    if (rcWeeksData[idx]) {
      total += rcWeeksData[idx].price;
      count++;
    }
  });
  $('#rcTotalPrice').textContent = money(total);

  if (count === 0) {
    $('#rcConfirmBtn').disabled = true;
    $('#rcConfirmBtn').textContent = 'Chọn ít nhất 1 tuần';
  } else {
    $('#rcConfirmBtn').disabled = false;
    $('#rcConfirmBtn').textContent = `Xác nhận đặt ${count} tuần`;
  }
}

// Quay lại bước 1
$('#rcBackBtn').onclick = () => {
  $('#recurringStep1').style.display = '';
  $('#recurringStep2').style.display = 'none';
  rcSetError('');
};

// Bước 2: Xác nhận tạo đặt cố định
$('#rcConfirmBtn').onclick = async () => {
  rcSetError2('');
  const courtId = Number($('#rcCourtSelect').value);
  const startDate = $('#rcStartDate').value;
  const startTime = $('#rcStartTime').value;
  const duration = Number($('#rcDuration').value);
  const weeksCount = Number($('#rcWeeksCount').value);
  const customerName = ($('#rcCustomerName').value.trim()) || 'Minh Anh';
  const customerPhone = ($('#rcCustomerPhone').value.trim()) || '0912345678';
  const note = $('#rcNote').value.trim();
  const endTime = rcCalcEndTime(startTime, duration);

  // Thu thập ngày bị trùng (conflict dates) để skip
  const skipDates = [];
  rcWeeksData.forEach(w => {
    if (!w.is_available) {
      skipDates.push(w.booking_date);
    }
  });

  // Thu thập ngày available nhưng user bỏ chọn (cũng skip)
  $('#rcWeeksList').querySelectorAll('.rc-week-checkbox[data-available="1"]').forEach(cb => {
    if (!cb.checked) {
      skipDates.push(cb.dataset.date);
    }
  });

  // Kiểm tra có tuần nào được chọn không
  const selectedCount = rcWeeksData.length - skipDates.length;
  if (selectedCount <= 0) {
    rcSetError2('Vui lòng chọn ít nhất 1 tuần để đặt sân.');
    return;
  }

  const payload = {
    court_id: courtId,
    start_date: startDate,
    weeks_count: weeksCount,
    start_time: `${startTime}:00`,
    end_time: endTime,
    customer_name: customerName,
    customer_phone: customerPhone,
    booking_channel: 'Counter',
    note: note || `Đặt cố định ${weeksCount} tuần`,
    skip_conflict_dates: skipDates
  };

  const btn = $('#rcConfirmBtn');
  try {
    btn.disabled = true;
    btn.textContent = 'Đang tạo đặt sân...';

    const res = await api.post('/bookings/recurring', payload);

    // Thành công
    $('#recurringDialog').close();
    toast(`✓ Đặt cố định thành công! Mã: ${res.booking_code} · ${res.booked_weeks_count} tuần · ${money(res.total_price)}`);

    // Refresh danh sách bookings
    await fetchBookingsFromBackend();
  } catch (err) {
    const msg = err.message || 'Không thể tạo đặt sân cố định.';
    rcSetError2(msg);
    btn.disabled = false;
    btn.textContent = `Xác nhận đặt ${selectedCount} tuần`;
  }
};