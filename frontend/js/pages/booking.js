const $ = s => document.querySelector(s);
const money = n => new Intl.NumberFormat('vi-VN').format(n) + 'đ';
const bookingsKey = 'san-nha-bookings';

// ── Đọc thông tin user đang đăng nhập từ session ──────────────────────────
function getLoggedInUser() {
  try {
    const raw = localStorage.getItem('user') || sessionStorage.getItem('user');
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return null;
}
function getUserInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
function getRoleLabel(role) {
  if (!role) return 'Thành viên Sân Nhà';
  if (role === 'admin') return 'Quản trị viên';
  if (role === 'staff') return 'Nhân viên';
  return 'Thành viên Sân Nhà';
}
function applyUserUI() {
  const u = getLoggedInUser();
  const name = u?.full_name || 'Chưa đăng nhập';
  const initials = getUserInitials(u?.full_name);
  const role = u ? getRoleLabel(u?.role) : 'Bấm để đăng nhập';
  const sbName = $('#sidebarName'), sbAvatar = $('#sidebarAvatar'), sbRole = $('#sidebarRole');
  const tbAvatar = $('#topbarAvatar');
  if (sbName) sbName.textContent = name;
  if (sbAvatar) sbAvatar.textContent = initials;
  if (sbRole) sbRole.textContent = role;
  if (tbAvatar) tbAvatar.textContent = initials;

  const isEn = window.RK_I18N && window.RK_I18N.getLang() === 'en';
  const sbLogout = $('#sidebarLogoutBtn');
  if (sbLogout) {
    if (!u) {
      sbLogout.innerHTML = `<svg style="width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:2" viewBox="0 0 24 24"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3"/></svg><span>${isEn ? 'Log In' : 'Đăng nhập'}</span>`;
      sbLogout.style.color = 'var(--green)';
      sbLogout.title = isEn ? 'Log in to system' : 'Đăng nhập vào hệ thống';
      sbLogout.onclick = () => { window.location.href = 'login.html'; };
    } else {
      sbLogout.innerHTML = `<svg style="width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:2"><use href="#i-logout"/></svg><span>${isEn ? 'Log Out' : 'Đăng xuất'}</span>`;
      sbLogout.style.color = '#c0392b';
      sbLogout.title = isEn ? 'Log out account' : 'Đăng xuất tài khoản';
      sbLogout.onclick = handleLogout;
    }
  }

  const tbLogout = $('#topbarLogoutBtn');
  if (tbLogout) {
    if (!u) {
      tbLogout.title = isEn ? 'Log In' : 'Đăng nhập';
      tbLogout.onclick = () => { window.location.href = 'login.html'; };
    } else {
      tbLogout.title = isEn ? 'Log Out' : 'Đăng xuất';
      tbLogout.onclick = handleLogout;
    }
  }
}

window.addEventListener('rk:language-change', () => {
  applyUserUI();
  if (typeof renderCourtFilterTabs === 'function') renderCourtFilterTabs();
  if (typeof renderCalendar === 'function') renderCalendar();
  if (typeof renderBookings === 'function') renderBookings();
  if (typeof loadCourtsFromBackend === 'function') loadCourtsFromBackend();
});

let dbCourts = [];
let selectedCourtFilter = 'all';

const initial = [];

let bookings = [];
try {
  const saved = JSON.parse(localStorage.getItem(bookingsKey));
  if (Array.isArray(saved)) {
    // Chỉ giữ lại những booking thật có court_id hoặc booking_code từ DB
    bookings = saved.filter(b => b && (b.court_id || b.booking_code));
  }
} catch (error) {
  bookings = [];
}

const getCourtName = b => {
  let name = '';
  if (b.court_name) name = b.court_name;
  else {
    const found = dbCourts.find(c => Number(c.id) === Number(b.court_id || b.court));
    if (found) name = found.name || found.court_name || `Sân ${found.id}`;
    else name = `Sân ${b.court || b.court_id || 1}`;
  }
  const isEn = window.RK_I18N && window.RK_I18N.getLang() === 'en';
  if (isEn && window.RK_I18N.t) {
    return window.RK_I18N.t(name);
  }
  return name;
};

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
const statusText = status => {
  const isEn = window.RK_I18N && window.RK_I18N.getLang() === 'en';
  if (isEn) {
    return status === 'pending' ? 'Pending Confirmation' :
      status === 'done' ? 'Completed' :
      status === 'cancelled' ? 'Cancelled' : 'Confirmed';
  }
  return status === 'pending' ? 'Chờ xác nhận' :
    status === 'done' ? 'Đã hoàn thành' :
    status === 'cancelled' ? 'Đã hủy' : 'Đã xác nhận';
};
const bookingReference = b => b.booking_code || ('BK-' + String(b.id).padStart(6, '0'));

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
  const courtName = getCourtName(b);
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
    // Admin vẫn có thể hủy kể cả đã qua giờ
    const _u = getLoggedInUser();
    if (_u?.role === 'admin') {
      actionHtml = `
        <div style="margin-top:14px;padding:10px 12px;background:#fff8f8;border:1px solid #f5c6cb;border-radius:8px;font-size:12px;color:#c0392b;margin-bottom:8px;">
          Đã qua giờ bắt đầu — chỉ admin mới có thể hủy (không hoàn tiền).
        </div>
        <button type="button" class="btn-admin-cancel-action" id="btnOpenAdminCancelModal">
          <svg style="width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/></svg>
          Hủy sân (Admin)
        </button>
      `;
    } else {
      actionHtml = `<div style="margin-top:14px;padding:10px;background:#fff5f5;border-radius:8px;text-align:center;color:var(--green);font-size:12px">Đã qua giờ bắt đầu trận đấu, không thể hủy đặt sân.</div>`;
    }
  } else {
    // Chưa tới giờ — user thường dùng nút hủy thường, admin có thêm nút hủy admin
    const _u = getLoggedInUser();
    const isAdmin = _u?.role === 'admin';
    actionHtml = `
      <button type="button" class="btn-cancel-action" id="btnOpenCancelModal">
        <svg style="width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/></svg>
        Hủy đặt sân này
      </button>
      ${isAdmin ? `
      <button type="button" class="btn-admin-cancel-action" id="btnOpenAdminCancelModal" style="margin-top:8px;">
        <svg style="width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/></svg>
        Hủy sân (Admin) — Gửi thông báo
      </button>` : ''}
    `;
  }

  info(
    'Chi tiết đặt sân',
    `<p style="color:var(--green);font-weight:600;margin-top:0">${courtName}</p>` +
    row('Mã lượt đặt', bookingReference(b)) +
    row('Sân', courtName) +
    row('Ngày chơi', dateOf(b.date).toLocaleDateString('vi-VN')) +
    row('Khung giờ', b.start + ' – ' + endTime(b)) +
    row('Trạng thái', statusText(b.status)) +
    row('Thành tiền', money(Number(b.total_price) || 100000)) +
    (b.customer_name ? row('Khách hàng', b.customer_name + (b.customer_phone ? ` (${b.customer_phone})` : '')) : '') +
    `<p class="form-note">Vui lòng đến trước 15 phút. Đưa mã đặt sân cho nhân viên tại quầy để nhận sân.</p>` +
    actionHtml
  );

  const cancelBtn = $('#btnOpenCancelModal');
  if (cancelBtn) {
    cancelBtn.onclick = () => openCancelConfirmation(b);
  }
  const adminCancelBtn = $('#btnOpenAdminCancelModal');
  if (adminCancelBtn) {
    adminCancelBtn.onclick = () => openAdminCancelDialog(b);
  }
}

async function openCancelConfirmation(b) {
  const courtName = getCourtName(b);
  const totalPrice = Number(b.total_price) || 100000;
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
      <p style="margin:0 0 10px;">Bạn đang yêu cầu hủy lượt đặt sân tại <strong>${courtName}</strong>.</p>
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

// ── Hàm Admin Hủy Sân ────────────────────────────────────────────────────
async function openAdminCancelDialog(b) {
  const courtName = getCourtName(b);
  const totalPrice = Number(b.total_price) || 0;
  const startDt = new Date(`${b.date}T${b.start}:00`);
  const now = new Date();
  const diffHours = (startDt - now) / 3600000;

  // Xác định chính sách hoàn tiền (tính sẵn để hiển thị, backend sẽ tính lại)
  let refundPercent = 0, policyText = 'Không hoàn tiền (hủy sau giờ vào sân)';
  if (diffHours > 24) { refundPercent = 100; policyText = 'Hoàn 100% (hủy trước 24 giờ)'; }
  else if (diffHours > 6) { refundPercent = 50; policyText = 'Hoàn 50% (hủy trong 6–24 giờ)'; }
  else if (diffHours > 0) { refundPercent = 0; policyText = 'Không hoàn tiền (hủy dưới 6 giờ)'; }

  const refundAmount = Math.round(totalPrice * refundPercent / 100);
  const timeLabel = diffHours <= 0
    ? '<span style="color:#c0392b;font-weight:600">Đã qua giờ vào sân</span>'
    : diffHours >= 24
      ? `Còn ${Math.floor(diffHours / 24)} ngày ${Math.round(diffHours % 24)} giờ`
      : `Còn ${diffHours.toFixed(1)} giờ`;

  const bodyEl = $('#adminCancelBody');
  bodyEl.innerHTML = `
    <div class="detail-row"><span>Mã lượt đặt</span><strong>${bookingReference(b)}</strong></div>
    <div class="detail-row"><span>Sân</span><strong>${courtName}</strong></div>
    <div class="detail-row"><span>Ngày · Giờ</span><strong>${dateOf(b.date).toLocaleDateString('vi-VN')} · ${b.start} – ${endTime(b)}</strong></div>
    <div class="detail-row"><span>Thời gian còn lại</span><strong>${timeLabel}</strong></div>
    ${b.customer_name ? `<div class="detail-row"><span>Khách hàng</span><strong>${b.customer_name}${b.customer_phone ? ` (${b.customer_phone})` : ''}</strong></div>` : ''}
    <div class="detail-row"><span>Tổng tiền</span><strong>${money(totalPrice)}</strong></div>
    <div class="detail-row"><span>Dự kiến hoàn</span><strong style="color:var(--green)">${money(refundAmount)} (${refundPercent}%) — ${policyText}</strong></div>
  `;

  // Clear lý do cũ, reset lỗi
  const reasonEl = $('#adminCancelReason');
  const errEl = $('#adminCancelError');
  if (reasonEl) reasonEl.value = '';
  if (errEl) errEl.style.display = 'none';

  // Đóng detail dialog, mở admin cancel dialog
  $('#infoDialog').close();
  $('#adminCancelDialog').showModal();

  $('#btnSubmitAdminCancel').onclick = async () => {
    const reason = reasonEl ? reasonEl.value.trim() : '';
    const submitBtn = $('#btnSubmitAdminCancel');

    if (!reason) {
      if (errEl) {
        errEl.textContent = 'Vui lòng nhập lý do hủy. Lý do này sẽ được gửi đến khách hàng.';
        errEl.style.display = 'block';
      }
      reasonEl && reasonEl.focus();
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Đang xử lý...';
    if (errEl) errEl.style.display = 'none';

    try {
      let result = null;

      if (typeof api !== 'undefined' && b.id) {
        // Lấy token từ session để gọi API cần auth
        const token = localStorage.getItem('access_token') || sessionStorage.getItem('access_token');
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(`${CONFIG.API_BASE_URL}/bookings/${b.id}/admin-cancel`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ admin_reason: reason }),
        });
        result = await res.json();
        if (!res.ok) {
          throw new Error(result?.detail || `Lỗi ${res.status}`);
        }
      }

      // Cập nhật local state
      b.status = 'cancelled';
      try { localStorage.setItem(bookingsKey, JSON.stringify(bookings)); } catch (_) {}

      // Reload từ backend
      await fetchBookingsFromBackend();
      renderBookings();
      renderCalendar();

      $('#adminCancelDialog').close();

      const finalRefund = result?.refund_amount ?? refundAmount;
      const finalPercent = result?.refund_percent ?? refundPercent;
      toast(`✅ Đã hủy sân thành công! Hoàn lại: ${money(finalRefund)} (${finalPercent}%). Thông báo đã gửi cho khách.`);

    } catch (err) {
      console.error('Lỗi admin hủy sân:', err);
      const msg = err.message || 'Không thể hủy sân lúc này!';
      if (errEl) {
        errEl.textContent = msg;
        errEl.style.display = 'block';
      }
      toast(msg);
      submitBtn.disabled = false;
      submitBtn.textContent = 'Xác nhận hủy & gửi thông báo';
    }
  };
}

function renderBookings() {
  const isEn = window.RK_I18N && window.RK_I18N.getLang() === 'en';
  const validCourtIds = new Set(dbCourts.map(c => Number(c.id)));
  const selected = bookings.filter(b => {
    if (validCourtIds.size > 0 && b.court_id && !validCourtIds.has(Number(b.court_id))) return false;
    return filter === 'all' ||
      (filter === 'done' ? (b.status === 'done' || b.status === 'cancelled') : isUpcoming(b));
  });

  $('#listCount').textContent = `(${selected.length})`;
  $('#bookingsBody').innerHTML = selected.length ? selected.map(b => {
    const courtTitle = getCourtName(b);
    const status = statusText(b.status);
    const pillClass = b.status === 'pending' ? 'pending' : b.status === 'done' ? 'done' : b.status === 'cancelled' ? 'cancelled' : '';
    return `<tr><td><div class="venue"><span class="venue-icon"><svg><use href="#i-court"/></svg></span><span><strong>${courtTitle}</strong><small>${isEn ? 'Badminton' : 'Cầu lông'}</small></span></div></td><td>${dateText(b.date)}<span style="color:#b0b7ab;padding:0 8px">·</span>${b.start} – ${endTime(b)}</td><td style="font-weight:600">${money(Number(b.total_price) || 100000)}</td><td><span class="pill ${pillClass}">${status}</span></td><td><button class="table-detail" data-detail="${b.id}" aria-label="${isEn ? 'Details: ' : 'Chi tiết '}${courtTitle}"><svg><use href="#i-chevron"/></svg></button></td></tr>`;
  }).join('') : `<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:30px">${isEn ? 'No bookings found in this category.' : 'Chưa có lượt đặt trong mục này.'}</td></tr>`;

  const upcoming = bookings.filter(b => {
    if (validCourtIds.size > 0 && b.court_id && !validCourtIds.has(Number(b.court_id))) return false;
    return isUpcoming(b);
  });
  $('#upcomingCount').textContent = String(upcoming.length).padStart(2, '0');
  $('#navCount').textContent = upcoming.length;

  const hours = upcoming.reduce((sum, b) => sum + Number(b.duration), 0);
  $('#hoursCount').innerHTML = hours + ` <span style="font-size:18px;font-weight:600">${isEn ? 'hrs' : 'giờ'}</span>`;
  renderNextBooking(upcoming);
}

function renderNextBooking(upcoming = bookings.filter(isUpcoming)) {
  const isEn = window.RK_I18N && window.RK_I18N.getLang() === 'en';
  const validCourtIds = new Set(dbCourts.map(c => Number(c.id)));
  const next = upcoming
    .filter(b => validCourtIds.size === 0 || !b.court_id || validCourtIds.has(Number(b.court_id)))
    .sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start))[0];
  if (!next) {
    $('#next-venue').textContent = isEn ? 'No upcoming bookings' : 'Chưa có lượt đặt';
    $('#next-address').textContent = isEn ? 'Book a court to add a new match schedule.' : 'Hãy đặt sân để thêm lịch chơi mới.';
    $('#next-date').textContent = '--/--/----';
    $('#next-time').textContent = '--:-- – --:--';
    return;
  }

  const courtTitle = getCourtName(next);
  $('#next-sport').textContent = isEn ? 'BADMINTON' : 'CẦU LÔNG';
  $('#next-venue').textContent = courtTitle;
  $('#next-address').textContent = isEn ? 'San Nha Sports Complex' : 'Sân thể thao Sân Nhà';
  $('#next-date').textContent = dateOf(next.date).toLocaleDateString(isEn ? 'en-US' : 'vi-VN');
  $('#next-time').textContent = next.start + ' – ' + endTime(next);
}

function renderCalendar() {
  const isEn = window.RK_I18N && window.RK_I18N.getLang() === 'en';
  // Lấy thứ 2 của tuần hiện tại thay vì gán cứng ngày cũ
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = (day === 0 ? -6 : 1) - day;
  const currentMonday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday, 12);
  const monday = new Date(currentMonday.getFullYear(), currentMonday.getMonth(), currentMonday.getDate() + weekOffset * 7, 12);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    return d;
  });
  const last = days[6];
  const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const monthStr = isEn ? monthNames[last.getMonth() + 1] : `tháng ${last.getMonth() + 1}`;
  $('#weekTitle').textContent = isEn ?
    `${String(monday.getDate()).padStart(2, '0')} – ${String(last.getDate()).padStart(2, '0')} ${monthStr}, ${last.getFullYear()}` :
    `${String(monday.getDate()).padStart(2, '0')} – ${String(last.getDate()).padStart(2, '0')} tháng ${last.getMonth() + 1}, ${last.getFullYear()}`;

  const dayLabels = isEn ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] : ['TH 2', 'TH 3', 'TH 4', 'TH 5', 'TH 6', 'TH 7', 'CN'];
  const todayStr = localDate(now);
  $('#calendarHeader').innerHTML = '<div></div>' + days.map((d, i) => {
    const dStr = localDate(d);
    const isToday = dStr === todayStr;
    return `<div class="day ${isToday ? 'today' : ''}"><small>${dayLabels[i]}</small><strong>${String(d.getDate()).padStart(2, '0')}</strong></div>`;
  }).join('');

  // Lọc CHỈ những sân có trong database
  const validCourtIds = new Set(dbCourts.map(c => Number(c.id)));

  $('#calendarBody').innerHTML = '<div class="time-column">' + ['06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00'].map(t => `<span>${t}</span>`).join('') + '</div>' + days.map((d, i) => {
    const iso = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

    // Lọc theo ngày, trạng thái, và sân trong database
    const dayBookings = bookings.filter(b => {
      if (b.date !== iso || b.status === 'cancelled') return false;
      const cId = Number(b.court_id || b.court);
      // Chỉ hiển thị sân có trong database
      if (validCourtIds.size > 0 && !validCourtIds.has(cId)) return false;
      // Nếu có chọn lọc 1 sân cụ thể
      if (selectedCourtFilter !== 'all' && Number(selectedCourtFilter) !== cId) return false;
      return true;
    });

    return `<div class="day-column ${weekOffset === 0 && i === 1 ? 'today' : ''}">` + dayBookings.map(b => {
      const startMin = Number(b.start.slice(0, 2)) * 60 + Number(b.start.slice(3, 5) || 0);
      const top = Math.max(0, Math.min(95, (startMin - 360) / 960 * 100));
      const height = Math.min(100 - top, Math.max(14, (Number(b.duration) * 60) / 960 * 100));
      const courtTitle = getCourtName(b);
      return `<button class="event ${b.status === 'pending' ? 'orange' : b.status === 'done' ? 'dark' : ''}" data-detail="${b.id}" style="top:${top}%;height:${height}%" aria-label="${courtTitle}, ${b.start}"><strong>${courtTitle}</strong><small>${b.start} – ${endTime(b)}</small></button>`;
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

// Pre-fill customer name/phone from logged-in user
function prefillCustomerFields() {
  const u = getLoggedInUser();
  if (!u) return;
  const nameEl = $('#customerName'), phoneEl = $('#customerPhone');
  if (nameEl && !nameEl.value) nameEl.value = u.full_name || '';
  if (phoneEl && !phoneEl.value) phoneEl.value = u.phone || '';
  const rcNameEl = $('#rcCustomerName'), rcPhoneEl = $('#rcCustomerPhone');
  if (rcNameEl && !rcNameEl.value) rcNameEl.value = u.full_name || '';
  if (rcPhoneEl && !rcPhoneEl.value) rcPhoneEl.value = u.phone || '';
}

document.addEventListener('click', e => {
  const detailButton = e.target.closest('[data-detail]');
  if (detailButton) detail(detailButton.dataset.detail);
  if (e.target.closest('.close-dialog')) e.target.closest('dialog').close();
  if (e.target.closest('.new-booking')) {
    setDialogError('');
    initDefaultDateTime();
    loadCourtsFromBackend();
    prefillCustomerFields();
    $('#bookingDialog').showModal();
    closeMenu();
  }
  if (e.target.closest('.supportButton')) {
    e.preventDefault();
    info('Sân Nhà luôn sẵn sàng', '<p>Cần đổi lịch, tìm sân hoặc hỗ trợ đặt sân?</p><div class="detail-row"><span>Hotline</span><a href="tel:1900636888"><strong>1900 636 888</strong></a></div><div class="detail-row"><span>Email</span><a href="mailto:RKbamintoncaulongso1noithanh@gmail.com"><strong>RKbamintoncaulongso1noithanh@gmail.com</strong></a></div><p class="form-note">Thời gian hỗ trợ: 07:00 – 22:00 mỗi ngày.</p>');
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
$('#scheduleButton').onclick = () => { window.location.href = 'booking.html'; };
$('#exploreButton').onclick = () => { window.location.href = 'customer-home.html'; };
$('#view-schedule').onclick = () => { window.location.href = 'booking.html'; };
$('#offersButton').onclick = () => info('Ưu đãi dành cho bạn', '<div scolor:var(--green)"><div tyle="padding:20px;background:var(--green-light);border-radius:8px;class="eyebrow">CHƠI NHIỀU HƠN, VUI NHIỀU HƠN</div><h3 style="font-size:24px;margin:10px 0">Giảm 15% lượt đặt đầu</h3><p>Mã ưu đãi sẽ tự động nhập khi bạn đặt sân lần đầu</p></div><p class="form-note">Ưu đãi minh họa. Chức năng áp dụng mã và thanh toán chưa được kết nối trong bản demo.</p>');
function performLogout() {
  try {
    if (window.RK_AUTH && typeof window.RK_AUTH.logout === 'function') {
      window.RK_AUTH.logout();
    }
  } catch (_) {}
  try {
    if (window.RK_SESSION && typeof window.RK_SESSION.clear === 'function') {
      window.RK_SESSION.clear();
    }
  } catch (_) {}
  localStorage.removeItem('token');
  localStorage.removeItem('access_token');
  localStorage.removeItem('user');
  sessionStorage.removeItem('access_token');
  sessionStorage.removeItem('user');

  toast('Đã đăng xuất thành công.');
  setTimeout(() => {
    window.location.href = 'login.html';
  }, 400);
}

function handleLogout() {
  const dlg = $('#logoutConfirmDialog');
  if (dlg && typeof dlg.showModal === 'function') {
    closeMenu();
    $('#infoDialog')?.close();
    dlg.showModal();
  } else {
    performLogout();
  }
}

function showProfileModal() {
  const u = getLoggedInUser();
  if (!u) {
    info(
      'Tài khoản của tôi',
      `<p style="margin-bottom:16px;color:var(--muted)">Bạn chưa đăng nhập vào hệ thống.</p>
       <div style="display:flex;gap:10px;margin-top:16px">
         <a href="login.html" style="flex:1;text-align:center;padding:10px 14px;background:var(--green);color:#fff;border-radius:8px;font-weight:700;text-decoration:none;font-size:13px">Đăng nhập</a>
         <a href="register.html" style="flex:1;text-align:center;padding:10px 14px;background:#f3f4f6;color:#333;border-radius:8px;font-weight:600;text-decoration:none;font-size:13px">Đăng ký</a>
       </div>`
    );
    return;
  }
  const name = u?.full_name || 'Chưa đăng nhập';
  const email = u?.email || '';
  const phone = u?.phone || '';
  const role = getRoleLabel(u?.role);

  info(
    'Tài khoản của tôi',
    `<div class="detail-row"><span>Họ tên</span><strong>${name}</strong></div>
     <div class="detail-row"><span>Email</span><strong>${email || '—'}</strong></div>
     <div class="detail-row"><span>Điện thoại</span><strong>${phone || '—'}</strong></div>
     <div class="detail-row"><span>Hạng thành viên</span><strong>${role}</strong></div>
     <div style="margin-top:20px;display:flex;gap:10px">
       <a href="profile.html" style="flex:1;display:flex;align-items:center;justify-content:center;padding:10px;background:#f3f4f6;color:#333;border:1px solid #ddd;border-radius:8px;font-weight:600;text-decoration:none;font-size:13px">
         Hồ sơ cá nhân
       </a>
       <button type="button" id="modalLogoutBtn" style="flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:10px;background:#fff0f0;color:#c0392b;border:1px solid #f5c6cb;border-radius:8px;font-weight:700;cursor:pointer;font-size:13px;font-family:inherit">
         <svg style="width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>
         Đăng xuất
       </button>
     </div>`
  );

  const modalLogout = $('#modalLogoutBtn');
  if (modalLogout) {
    modalLogout.onclick = () => {
      $('#infoDialog')?.close();
      handleLogout();
    };
  }
}

const pBtn = $('#profileButton');
if (pBtn) {
  pBtn.onclick = e => {
    e.preventDefault();
    showProfileModal();
  };
}

const topAvatar = $('#topbarAvatar');
if (topAvatar) {
  topAvatar.onclick = showProfileModal;
}

const topLogout = $('#topbarLogoutBtn');
if (topLogout) {
  topLogout.onclick = handleLogout;
}

const sideLogout = $('#sidebarLogoutBtn');
if (sideLogout) {
  sideLogout.onclick = handleLogout;
}

const btnConfirmLogout = $('#btnConfirmLogoutSubmit');
if (btnConfirmLogout) {
  btnConfirmLogout.onclick = () => {
    $('#logoutConfirmDialog')?.close();
    performLogout();
  };
}
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
  const pricePerHour = 50000;
  $('#totalPrice').textContent = money(pricePerHour * Number($('#duration').value));
}

$('#duration').onchange = updatePrice;

// Đồng bộ danh sách booking từ backend MySQL về giao diện
async function fetchBookingsFromBackend() {
  if (typeof api === "undefined") return;
  try {
    const list = await api.get("/bookings");
    if (Array.isArray(list) && list.length > 0) {
      const apiBookings = [];
      list.forEach(item => {
        if (item.slots && item.slots.length > 0) {
          item.slots.forEach(slot => {
            const startDt = new Date(slot.start_at);
            const endDt = new Date(slot.end_at);
            const dateStr = slot.start_at.slice(0, 10);
            const startStr = slot.start_at.slice(11, 16);
            let duration = (endDt - startDt) / 3600000;
            if (isNaN(duration) || duration <= 0) duration = (slot.duration_minutes || 120) / 60;
            const courtNum = (slot.court_name ? slot.court_name.replace(/\D/g, "") : "") || String(slot.court_id || 1).padStart(2, "0");

            apiBookings.push({
              id: item.id,
              slot_id: slot.id,
              booking_code: item.booking_code,
              court_id: slot.court_id,
              court_name: slot.court_name,
              court: courtNum.padStart(2, "0"),
              date: dateStr,
              start: startStr,
              duration: duration,
              status: item.status ? item.status.toLowerCase() : 'confirmed',
              total_price: slot.amount || (item.total_price / item.slots.length),
              customer_name: item.user_name,
              customer_phone: item.user_phone
            });
          });
        } else {
          const startStr = item.start_time ? item.start_time.slice(0, 5) : "18:00";
          let duration = 2;
          if (item.start_time && item.end_time) {
            const sMin = Number(item.start_time.slice(0, 2)) * 60 + Number(item.start_time.slice(3, 5));
            const eMin = Number(item.end_time.slice(0, 2)) * 60 + Number(item.end_time.slice(3, 5));
            if (eMin > sMin) duration = (eMin - sMin) / 60;
          }
          const courtNum = item.court_name ? item.court_name.replace(/\D/g, "") || String(item.court_id || 1).padStart(2, "0") : String(item.court_id || 1).padStart(2, "0");

          apiBookings.push({
            id: item.id,
            booking_code: item.booking_code,
            court_id: item.court_id,
            court_name: item.court_name,
            court: courtNum.padStart(2, "0"),
            date: item.booking_date || localDate(new Date()),
            start: startStr,
            duration: duration,
            status: item.status ? item.status.toLowerCase() : 'confirmed',
            total_price: item.total_price,
            customer_name: item.user_name,
            customer_phone: item.user_phone
          });
        }
      });

      bookings = apiBookings;
      try { localStorage.setItem(bookingsKey, JSON.stringify(bookings)); } catch (_) {}
      renderBookings();
      renderCalendar();
    }
  } catch (err) {
    console.warn("Chưa tải được bookings từ server, dùng cache:", err);
  }
}

// Nạp danh sách sân thật từ Backend Database vào select box & thanh lọc
async function loadCourtsFromBackend() {
  if (typeof api === "undefined") return;
  try {
    const courtsList = await api.get("/courts");
    if (!Array.isArray(courtsList) || courtsList.length === 0) return;
    dbCourts = courtsList;

    const isEn = window.RK_I18N && window.RK_I18N.getLang() === 'en';
    // 1. Dropdown form đặt sân
    const courtSelect = $("#courtSelect");
    if (courtSelect) {
      courtSelect.innerHTML = dbCourts.map(c => {
        let courtTitle = c.name || c.court_name || `Sân ${c.id}`;
        if (isEn && window.RK_I18N.t) courtTitle = window.RK_I18N.t(courtTitle);
        const isActive = c.status === "Active" || c.status === "HOẠT ĐỘNG";
        const statusLabel = isActive ? "" : (isEn ? " (Maintenance)" : " (Bảo trì)");
        return `<option value="${c.id}" data-id="${c.id}" ${isActive ? "" : "disabled"}>${courtTitle}${statusLabel}</option>`;
      }).join("");
    }

    // 2. Dropdown form đặt cố định
    const rcCourtSelect = $("#rcCourtSelect");
    if (rcCourtSelect) {
      rcCourtSelect.innerHTML = dbCourts.map(c => {
        let courtTitle = c.name || c.court_name || `Sân ${c.id}`;
        if (isEn && window.RK_I18N.t) courtTitle = window.RK_I18N.t(courtTitle);
        const isActive = c.status === "Active" || c.status === "HOẠT ĐỘNG";
        const statusLabel = isActive ? "" : (isEn ? " (Maintenance)" : " (Bảo trì)");
        return `<option value="${c.id}" ${isActive ? "" : "disabled"}>${courtTitle}${statusLabel}</option>`;
      }).join("");
    }

    // 3. Render bộ lọc sân trên bảng lịch tuần
    renderCourtFilterTabs();

    // 4. Render lại giao diện
    renderBookings();
    renderCalendar();
  } catch (err) {
    console.warn("Không thể tải danh sách sân từ backend:", err);
  }
}

function renderCourtFilterTabs() {
  const container = $("#courtFilterBar");
  if (!container) return;
  const isEn = window.RK_I18N && window.RK_I18N.getLang() === 'en';

  let html = `<button type="button" class="court-filter-btn ${selectedCourtFilter === 'all' ? 'active' : ''}" data-court="all">${isEn ? 'All Courts' : 'Tất cả sân'} (${dbCourts.length})</button>`;
  dbCourts.forEach(c => {
    const isAct = selectedCourtFilter === String(c.id);
    let title = c.name || c.court_name || `Sân ${c.id}`;
    if (isEn && window.RK_I18N.t) title = window.RK_I18N.t(title);
    html += `<button type="button" class="court-filter-btn ${isAct ? 'active' : ''}" data-court="${c.id}">${title}</button>`;
  });
  container.innerHTML = html;

  container.querySelectorAll(".court-filter-btn").forEach(btn => {
    btn.onclick = () => {
      selectedCourtFilter = btn.dataset.court;
      container.querySelectorAll(".court-filter-btn").forEach(b => b.classList.toggle("active", b === btn));
      renderCalendar();
    };
  });
}

loadCourtsFromBackend();
fetchBookingsFromBackend();
applyUserUI();

$('#bookingForm').onsubmit = async e => {
  e.preventDefault();
  setDialogError('');
  const submitBtn = $('#submitBookingBtn');

  const _currentUser = getLoggedInUser();
  const customerName = ($('#customerName') ? $('#customerName').value.trim() : '') || _currentUser?.full_name || '';
  const customerPhone = ($('#customerPhone') ? $('#customerPhone').value.trim() : '') || _currentUser?.phone || '';
  const noteInput = $('#bookingNote') ? $('#bookingNote').value.trim() : '';

  const date = $('#bookingDate').value;
  const start = $('#startTime').value;
  const duration = Number($('#duration').value);
  const courtSelect = $('#courtSelect');
  const realCourtId = Number(courtSelect.value) || 1;
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

  const startMinutes = startHour * 60 + Number(start.slice(3, 5) || 0);
  const endMinutes = startMinutes + duration * 60;
  const endStr = `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}:00`;
  const startStr = `${start}:00`;

  const foundCourt = dbCourts.find(c => Number(c.id) === realCourtId);
  const courtName = foundCourt ? (foundCourt.name || foundCourt.court_name) : `Sân ${realCourtId}`;
  const fullNote = noteInput ? `${noteInput} (${courtName})` : `Đặt tại ${courtName}`;

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

  // 2. Refresh lại dữ liệu từ Backend
  await fetchBookingsFromBackend();
  window.location.href = `booking_notification.html?booking=${encodeURIComponent(backendBookingId || '')}`;
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
    prefillCustomerFields();
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
  const isEn = window.RK_I18N && window.RK_I18N.getLang() === 'en';
  $('#recurringStep1').style.display = 'none';
  $('#recurringStep2').style.display = '';
  rcSetError2('');

  // Summary bar
  $('#rcSummaryBar').innerHTML = `
    <div class="rc-stat available"><strong>${res.available_weeks_count}</strong>${isEn ? 'Available weeks' : 'Tuần trống'}</div>
    <div class="rc-stat conflict"><strong>${res.conflict_weeks_count}</strong>${isEn ? 'Conflicted weeks' : 'Tuần bị trùng'}</div>
    <div class="rc-stat total"><strong>${res.total_weeks}</strong>${isEn ? 'Total weeks' : 'Tổng tuần'}</div>
  `;

  // Week list
  const weeks = res.weeks || [];
  $('#rcWeeksList').innerHTML = weeks.map((w, i) => {
    const d = new Date(w.booking_date + 'T12:00:00');
    const dateStr = d.toLocaleDateString(isEn ? 'en-US' : 'vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
    const timeStr = `${w.start_time.slice(0, 5)} – ${w.end_time.slice(0, 5)}`;

    if (w.is_available) {
      return `
        <div class="rc-week-item" data-idx="${i}">
          <span class="rc-week-num">${w.week_number}</span>
          <div class="rc-week-info">
            <strong>${dateStr}</strong>
            <small>${timeStr}</small>
          </div>
          <span class="rc-week-status ok">✓ ${isEn ? 'Available' : 'Trống'}</span>
          <span class="rc-week-price">${money(w.price)}</span>
          <input type="checkbox" class="rc-week-checkbox" checked data-date="${w.booking_date}" data-available="1">
        </div>`;
    } else {
      const reason = w.conflict_reason ? (isEn && window.RK_I18N.t ? window.RK_I18N.t(w.conflict_reason) : w.conflict_reason) : (isEn ? 'Already booked' : 'Đã có người đặt');
      return `
        <div class="rc-week-item conflict" data-idx="${i}">
          <span class="rc-week-num">${w.week_number}</span>
          <div class="rc-week-info">
            <strong>${dateStr}</strong>
            <small>${timeStr} · ${reason}</small>
          </div>
          <span class="rc-week-status bad">✗ ${isEn ? 'Conflicted' : 'Trùng lịch'}</span>
          <span class="rc-week-price" style="color:var(--muted);text-decoration:line-through">${money(w.price)}</span>
          <input type="checkbox" class="rc-week-checkbox" disabled data-date="${w.booking_date}" data-available="0" title="${isEn ? 'Conflicted week, will be skipped' : 'Tuần bị trùng, sẽ tự động bỏ qua'}">
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
  const isEn = window.RK_I18N && window.RK_I18N.getLang() === 'en';
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
    $('#rcConfirmBtn').textContent = isEn ? 'Select at least 1 week' : 'Chọn ít nhất 1 tuần';
  } else {
    $('#rcConfirmBtn').disabled = false;
    $('#rcConfirmBtn').textContent = isEn ? `Confirm booking for ${count} weeks` : `Xác nhận đặt ${count} tuần`;
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
  const _rcUser = getLoggedInUser();
  const customerName = ($('#rcCustomerName').value.trim()) || _rcUser?.full_name || '';
  const customerPhone = ($('#rcCustomerPhone').value.trim()) || _rcUser?.phone || '';
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