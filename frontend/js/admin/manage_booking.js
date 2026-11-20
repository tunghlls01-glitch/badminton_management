const $ = s => document.querySelector(s);
const icon = name => `<svg aria-hidden="true"><use href="#${name}"/></svg>`;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const localDate = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const today = localDate(new Date());

const labels = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  completed: 'Hoàn thành',
  cancelled: 'Đã huỷ',
  'no-show': 'Không đến'
};

const currency = n => Number(n || 0).toLocaleString('vi-VN') + ' ₫';
const dateText = d => d ? d.split('-').reverse().join('/') : 'Tất cả ngày';

let dbCourts = [];
let bookings = [];
let page = 1, toastTimer;

// Khởi tạo năm footer
const yearEl = $('#year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

// ── Cập nhật thông tin tài khoản đăng nhập động ────────────────────────────
function getLoggedInUser() {
  try {
    const raw = localStorage.getItem('user') || sessionStorage.getItem('user');
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return null;
}

function getUserInitials(name) {
  if (!name) return 'AD';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getRoleLabel(role) {
  const r = String(role || '').toLowerCase();
  if (r === 'admin') return 'Quản trị viên';
  if (r === 'staff') return 'Nhân viên';
  return 'Quản trị viên';
}

function applyUserUI() {
  const u = getLoggedInUser();
  const name = u?.full_name || 'Quản trị viên';
  const initials = getUserInitials(u?.full_name);
  const role = getRoleLabel(u?.role);

  const avatarEl = $('#adminAvatar');
  const nameEl = $('#adminName');
  const roleEl = $('#adminRole');

  if (avatarEl) avatarEl.textContent = initials;
  if (nameEl) nameEl.textContent = name;
  if (roleEl) roleEl.textContent = role;
}

// ── Mapping trạng thái Backend <-> Frontend ───────────────────────────────
function mapStatusFromBackend(s) {
  if (!s) return 'pending';
  const lower = String(s).toLowerCase();
  if (lower === 'pending') return 'pending';
  if (lower === 'confirmed') return 'confirmed';
  if (lower === 'completed' || lower === 'checked_in') return 'completed';
  if (lower === 'cancelled' || lower === 'expired') return 'cancelled';
  if (lower === 'no_show' || lower === 'no-show') return 'no-show';
  return 'pending';
}

function notify(text) {
  $('#toast').textContent = text;
  $('#toast').classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('#toast').classList.remove('show'), 3500);
}

// ── Gọi Backend API ───────────────────────────────────────────────────────
async function loadCourtsFromBackend() {
  try {
    let courts = [];
    if (typeof api !== 'undefined') {
      courts = await api.get('/courts');
    } else {
      const res = await fetch(`${CONFIG.API_BASE_URL}/courts`);
      courts = await res.json();
    }
    if (Array.isArray(courts) && courts.length) {
      dbCourts = courts;
      const courtFilter = $('#courtFilter');
      const curVal = courtFilter.value;
      courtFilter.innerHTML = '<option value="">Tất cả sân</option>' +
        dbCourts.map(c => `<option value="${c.id}">${esc(c.name || c.court_name || `Sân ${c.id}`)}</option>`).join('');
      courtFilter.value = curVal;
    }
  } catch (err) {
    console.warn('Lỗi tải danh sách sân từ database:', err);
  }
}

async function loadBookingsFromBackend() {
  try {
    let data = [];
    if (typeof api !== 'undefined') {
      data = await api.get('/bookings');
    } else {
      const res = await fetch(`${CONFIG.API_BASE_URL}/bookings`);
      data = await res.json();
    }

    if (Array.isArray(data)) {
      bookings = data.map(b => {
        const firstSlot = (b.slots && b.slots.length > 0) ? b.slots[0] : null;
        const courtId = b.court_id || (firstSlot ? firstSlot.court_id : 1);
        const courtObj = dbCourts.find(c => Number(c.id) === Number(courtId));
        const courtName = b.court_name || (firstSlot ? firstSlot.court_name : null) || (courtObj ? (courtObj.name || courtObj.court_name) : `Sân ${courtId}`);

        let bDate = b.booking_date;
        let bStart = b.start_time ? b.start_time.slice(0, 5) : '';
        let bEnd = b.end_time ? b.end_time.slice(0, 5) : '';

        if (firstSlot && firstSlot.start_at) {
          bDate = bDate || firstSlot.start_at.slice(0, 10);
          bStart = bStart || firstSlot.start_at.slice(11, 16);
        }
        if (firstSlot && firstSlot.end_at) {
          bEnd = bEnd || firstSlot.end_at.slice(11, 16);
        }
        if (!bDate) bDate = today;
        if (!bStart) bStart = '08:00';
        if (!bEnd) bEnd = '10:00';

        const totalAmt = Number(b.total_price) || 0;
        return {
          id: b.booking_code || ('RK' + String(b.id)),
          dbId: b.id,
          name: b.user_name || 'Khách vãng lai',
          phone: b.user_phone || '—',
          court: String(courtId),
          courtName: courtName,
          date: bDate,
          start: bStart,
          end: bEnd,
          amount: totalAmt,
          deposit: totalAmt,
          status: mapStatusFromBackend(b.status),
          rawStatus: b.status,
          created: b.created_at ? new Date(b.created_at).toLocaleString('vi-VN') : today,
          note: b.note || '',
          slots: b.slots || []
        };
      });
    }
  } catch (err) {
    console.error('Lỗi khi tải lịch từ database:', err);
    notify('Không thể kết nối máy chủ để tải danh sách booking!');
  }
  render();
}

function baseRows() {
  let query = $('#search').value.trim().toLowerCase().replace(/\s/g, '');
  return bookings.filter(b =>
    (!$('#dateFilter').value || b.date === $('#dateFilter').value) &&
    (!$('#courtFilter').value || b.court === $('#courtFilter').value) &&
    (!query || b.id.toLowerCase().includes(query) || b.phone.includes(query) || b.name.toLowerCase().includes(query))
  );
}

function filteredRows() {
  return baseRows()
    .filter(b => !$('#statusFilter').value || b.status === $('#statusFilter').value)
    .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.start || '').localeCompare(a.start || ''));
}

function initials(name) {
  if (!name) return 'KH';
  return name.split(' ').slice(-2).map(s => s[0]).join('').toUpperCase();
}

function actionable(b) {
  return ['pending', 'confirmed'].includes(b.status);
}

function overdue(b) {
  return new Date(`${b.date}T${b.start}:00`).getTime() < Date.now();
}

function render() {
  const daily = bookings.filter(b => !$('#dateFilter').value || b.date === $('#dateFilter').value);
  $('#totalStat').textContent = daily.length;
  $('#confirmedStat').textContent = daily.filter(b => b.status === 'confirmed').length;
  $('#pendingStat').textContent = daily.filter(b => b.status === 'pending').length;
  $('#revenueStat').innerHTML = daily.filter(b => !['cancelled', 'no-show'].includes(b.status)).reduce((s, b) => s + b.amount, 0).toLocaleString('vi-VN') + '<small>₫</small>';
  $('#statDate').textContent = dateText($('#dateFilter').value);
  $('#navCount').textContent = bookings.filter(actionable).length;

  const rows = filteredRows();
  const size = +$('#pageSize').value;
  const pages = Math.max(1, Math.ceil(rows.length / size));
  page = Math.min(page, pages);
  $('#listCount').textContent = rows.length + ' booking';

  document.querySelectorAll('.tab').forEach(t => {
    const active = t.dataset.status === $('#statusFilter').value;
    t.classList.toggle('active', active);
    t.setAttribute('aria-selected', active);
    t.querySelector('span').textContent = baseRows().filter(b => !t.dataset.status || b.status === t.dataset.status).length;
  });

  $('#bookingBody').innerHTML = rows.slice((page - 1) * size, page * size).map(b => {
    let durationHours = 1;
    try {
      const startMin = parseInt(b.start) * 60 + Number(b.start.slice(3) || 0);
      const endMin = parseInt(b.end) * 60 + Number(b.end.slice(3) || 0);
      durationHours = Math.max(0.5, (endMin - startMin) / 60);
    } catch (_) {}

    return `
    <tr>
      <td><button class="booking-code" data-action="detail" data-id="${esc(b.id)}">#${esc(b.id)}</button><span class="secondary">${dateText(b.date)}</span></td>
      <td><div class="customer"><span class="customer-avatar">${esc(initials(b.name))}</span><div><strong>${esc(b.name)}</strong><span class="secondary">${esc(b.phone)}</span></div></div></td>
      <td><span class="court">${icon('court')}${esc(b.courtName)}</span></td>
      <td><strong style="font-weight:500">${esc(b.start)} – ${esc(b.end)}</strong><span class="secondary">${durationHours} giờ chơi</span></td>
      <td><span class="money">${currency(b.amount)}</span><span class="secondary">Tổng tiền</span></td>
      <td><span class="status ${esc(b.status)}">${labels[b.status] || b.status}</span></td>
      <td>
        <div class="actions">
          <button class="icon-btn" data-action="detail" data-id="${esc(b.id)}" title="Xem chi tiết" aria-label="Xem chi tiết ${esc(b.id)}">${icon('eye')}</button>
          ${actionable(b) ? `
            <button class="icon-btn cancel" data-action="cancel" data-id="${esc(b.id)}" title="Huỷ booking" aria-label="Huỷ ${esc(b.id)}">${icon('close')}</button>
            <button class="icon-btn" data-action="noshow" data-id="${esc(b.id)}" title="${overdue(b) ? 'Đánh dấu không đến' : 'Chưa đến giờ nhận sân'}" aria-label="Đánh dấu không đến ${esc(b.id)}" ${overdue(b) ? '' : 'disabled'}>${icon('users')}</button>
          ` : ''}
        </div>
      </td>
    </tr>
  `;
  }).join('');

  $('#emptyState').hidden = rows.length > 0;
  $('#pageSummary').textContent = rows.length ? `Hiển thị ${(page - 1) * size + 1}–${Math.min(page * size, rows.length)} trong ${rows.length} booking` : '0 booking';
  $('#pageNumbers').innerHTML = Array.from({ length: pages }, (_, i) => `<button class="page-button ${i + 1 === page ? 'active' : ''}" data-page="${i + 1}" aria-label="Trang ${i + 1}" ${i + 1 === page ? 'aria-current="page"' : ''}>${i + 1}</button>`).join('');
  $('#prevPage').disabled = page === 1;
  $('#nextPage').disabled = page === pages;
}

function openModal(title, content, compact = false) {
  $('#modalTitle').textContent = title;
  $('#modalContent').innerHTML = content;
  $('#modal').classList.toggle('dialog-compact', compact);
  if (!$('#modal').open) $('#modal').showModal();
}

function footer(content) {
  return `<div class="dialog-footer">${content}</div>`;
}

function close() {
  $('#modal').close();
}

$('#closeModal').onclick = close;
$('#modal').addEventListener('click', e => {
  if (e.target === $('#modal')) {
    const r = $('#modal').getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) close();
  }
});

function details(id) {
  const b = bookings.find(b => b.id === id);
  if (!b) return;
  openModal('Chi tiết #' + b.id, `
    <div class="dialog-body">
      <div class="detail-title">Thông tin khách hàng</div>
      <div class="detail-grid">
        <div><small>Họ và tên</small><strong>${esc(b.name)}</strong></div>
        <div><small>Số điện thoại</small><strong>${esc(b.phone)}</strong></div>
      </div>
      <div class="detail-title">Lịch đặt sân</div>
      <div class="detail-grid">
        <div><small>Sân / Ngày</small><strong>${esc(b.courtName)} · ${dateText(b.date)}</strong></div>
        <div><small>Khung giờ</small><strong>${esc(b.start)} – ${esc(b.end)}</strong></div>
        <div><small>Trạng thái</small><span class="status ${b.status}">${labels[b.status] || b.status}</span></div>
        <div><small>Mã booking</small><strong>#${esc(b.id)}</strong></div>
      </div>
      <div class="detail-title">Thanh toán</div>
      <div class="detail-grid">
        <div><small>Tổng tiền</small><strong>${currency(b.amount)}</strong></div>
        <div><small>Ghi chú</small><strong>${esc(b.note || '—')}</strong></div>
      </div>
      <div class="detail-title">Lịch sử booking</div>
      <div class="history">Booking được tạo lúc<small>${esc(b.created)}</small></div>
    </div>
    ${footer(`
      <button class="btn" data-close>Đóng</button>
      ${b.status === 'pending' ? `<button class="btn primary" data-action="confirm" data-id="${b.id}">${icon('check')}Xác nhận booking</button>` : ''}
      ${b.status === 'confirmed' ? `<button class="btn primary" data-action="complete" data-id="${b.id}">${icon('check')}Hoàn thành</button>` : ''}
      ${actionable(b) ? `<button class="btn" style="color:var(--red)" data-action="cancel-confirm" data-id="${esc(b.id)}">Huỷ booking</button>` : ''}
    `)}
  `);
}

function confirmCancel(id) {
  const b = bookings.find(b => b.id === id);
  if (!b || !actionable(b)) return;
  openModal('Huỷ booking?', `
    <div class="dialog-body">
      <p class="cancel-confirmation">Bạn có chắc chắn muốn huỷ booking <strong>#${esc(b.id)}</strong> của khách <strong>${esc(b.name)}</strong> không?</p>
    </div>
    ${footer(`
      <button class="btn" data-action="cancel-back" data-id="${esc(b.id)}">Quay lại</button>
      <button class="btn danger" data-action="cancel-proceed" data-id="${esc(b.id)}">Tiếp tục huỷ</button>
    `)}
  `, true);
}

function cancelBooking(id) {
  const b = bookings.find(b => b.id === id);
  if (!b || !actionable(b)) return;
  openModal('Huỷ booking #' + b.id, `
    <form id="cancelForm">
      <div class="dialog-body">
        <p style="line-height:1.8;margin-top:0">Bạn muốn huỷ lịch của <strong>${esc(b.name)}</strong>, ${esc(b.courtName)}, ${b.start} – ${b.end} ngày ${dateText(b.date)}?</p>
        <div class="notice">Quản trị viên huỷ sân bắt buộc phải nhập lý do. Hệ thống sẽ tự động gửi thông báo đến khách hàng.</div>
        <div class="field"><label for="cancelReason">Lý do huỷ <span style="color:var(--red)">*</span></label><textarea id="cancelReason" required maxlength="500" placeholder="Ví dụ: Sân cần bảo trì đột xuất, khách báo hủy..."></textarea></div>
      </div>
      ${footer('<button type="button" class="btn" data-close>Giữ booking</button><button type="submit" class="btn danger" id="btnSubmitCancel">Xác nhận huỷ</button>')}
    </form>
  `);
  $('#cancelForm').onsubmit = async e => {
    e.preventDefault();
    const reason = $('#cancelReason').value.trim();
    if (!reason) {
      $('#cancelReason').setCustomValidity('Vui lòng nhập lý do huỷ.');
      $('#cancelReason').reportValidity();
      return;
    }
    const btn = $('#btnSubmitCancel');
    btn.disabled = true;
    btn.textContent = 'Đang xử lý...';

    try {
      if (typeof api !== 'undefined' && b.dbId) {
        try {
          await api.post(`/bookings/${b.dbId}/admin-cancel`, { admin_reason: reason });
        } catch (_) {
          await api.post(`/bookings/${b.dbId}/cancel?reason=${encodeURIComponent(reason)}`);
        }
      }
      close();
      notify('Đã huỷ booking #' + b.id + ' và cập nhật database!');
      await loadBookingsFromBackend();
    } catch (err) {
      console.error('Lỗi khi huỷ booking:', err);
      notify(err.message || 'Không thể huỷ booking!');
      btn.disabled = false;
      btn.textContent = 'Xác nhận huỷ';
    }
  };
  $('#cancelReason').oninput = e => e.target.setCustomValidity('');
}

function noShow(id) {
  const b = bookings.find(b => b.id === id);
  if (!b || !actionable(b)) return;
  if (!overdue(b)) {
    notify('Chưa đến giờ nhận sân, không thể đánh dấu không đến.');
    return;
  }
  const minutes = Math.floor((Date.now() - new Date(`${b.date}T${b.start}:00`).getTime()) / 60000);
  openModal('Xác nhận khách không đến', `
    <div class="dialog-body">
      <p style="line-height:1.8">Đánh dấu <strong>${esc(b.name)}</strong> không đến nhận sân cho booking <strong>#${b.id}</strong>?</p>
      <div class="notice">${icon('clock')} Đã quá giờ nhận sân <strong>${minutes < 60 ? minutes + ' phút' : Math.floor(minutes / 60) + ' giờ ' + minutes % 60 + ' phút'}</strong>.<br>Lịch ${esc(b.courtName)} · ${b.start} – ${b.end} · ${dateText(b.date)}</div>
    </div>
    ${footer('<button class="btn" data-close>Quay lại</button><button class="btn danger" id="confirmNoShow">Đánh dấu không đến</button>')}
  `);
  $('#confirmNoShow').onclick = async () => {
    try {
      if (typeof api !== 'undefined' && b.dbId) {
        await api.patch(`/bookings/${b.dbId}/status?status=NO_SHOW`);
      }
      close();
      notify('Đã đánh dấu khách không đến #' + b.id);
      await loadBookingsFromBackend();
    } catch (err) {
      console.error('Lỗi đánh dấu không đến:', err);
      notify(err.message || 'Lỗi khi cập nhật trạng thái');
    }
  };
}

async function updateStatus(b, statusVal, successMsg) {
  try {
    if (typeof api !== 'undefined' && b.dbId) {
      if (statusVal === 'Confirmed') {
        try {
          await api.post(`/bookings/${b.dbId}/confirm`);
        } catch (_) {
          await api.patch(`/bookings/${b.dbId}/status?status=Confirmed`);
        }
      } else {
        await api.patch(`/bookings/${b.dbId}/status?status=${statusVal}`);
      }
    }
    notify(successMsg);
    await loadBookingsFromBackend();
  } catch (err) {
    console.error('Lỗi cập nhật trạng thái:', err);
    notify(err.message || 'Không thể cập nhật trạng thái!');
  }
}

document.addEventListener('click', async e => {
  const closeButton = e.target.closest('[data-close]');
  if (closeButton) {
    close();
    return;
  }
  const action = e.target.closest('[data-action]');
  if (action) {
    const id = action.dataset.id, b = bookings.find(b => b.id === id);
    if (!b) return;
    switch (action.dataset.action) {
      case 'detail': details(id); break;
      case 'cancel': cancelBooking(id); break;
      case 'cancel-confirm': confirmCancel(id); break;
      case 'cancel-back': details(id); break;
      case 'cancel-proceed': cancelBooking(id); break;
      case 'noshow': noShow(id); break;
      case 'confirm':
        if (b.status === 'pending') {
          close();
          await updateStatus(b, 'Confirmed', 'Đã xác nhận booking #' + id);
        }
        break;
      case 'complete':
        if (b.status === 'confirmed') {
          close();
          await updateStatus(b, 'Completed', 'Đã hoàn thành booking #' + id);
        }
        break;
    }
  }
  const p = e.target.closest('[data-page]');
  if (p) {
    page = +p.dataset.page;
    render();
  }
});

['search', 'dateFilter', 'courtFilter', 'statusFilter', 'pageSize'].forEach(id =>
  $('#' + id).addEventListener(id === 'search' ? 'input' : 'change', () => {
    page = 1;
    render();
  })
);

document.querySelectorAll('.tab').forEach(t => t.onclick = () => {
  $('#statusFilter').value = t.dataset.status;
  page = 1;
  render();
});

$('#resetButton').onclick = () => {
  $('#search').value = '';
  $('#dateFilter').value = '';
  $('#courtFilter').value = '';
  $('#statusFilter').value = '';
  page = 1;
  render();
};

$('#prevPage').onclick = () => { page--; render(); };
$('#nextPage').onclick = () => { page++; render(); };

$('#exportButton').onclick = () => {
  const rows = filteredRows();
  if (!rows.length) {
    notify('Không có booking để xuất.');
    return;
  }
  const safe = v => '"' + String(v).replace(/^[=+\-@]/, "'$&").replace(/"/g, '""') + '"';
  const csv = '\uFEFF' + [
    ['Mã booking', 'Khách hàng', 'SĐT', 'Sân', 'Ngày', 'Bắt đầu', 'Kết thúc', 'Tổng tiền', 'Trạng thái'],
    ...rows.map(b => [b.id, b.name, b.phone, b.courtName, b.date, b.start, b.end, b.amount, labels[b.status] || b.status])
  ].map(r => r.map(safe).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'RK-bookings-' + ($('#dateFilter').value || 'tat-ca') + '.csv';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  notify('Đã xuất ' + rows.length + ' booking sang CSV.');
};

$('#createButton').onclick = () => {
  const courtOptions = dbCourts.length ? dbCourts.map(c => `<option value="${c.id}">${esc(c.name || c.court_name || `Sân ${c.id}`)}</option>`).join('') : '<option value="1">Sân 01</option><option value="2">Sân 02</option><option value="3">Sân 03</option><option value="4">Sân 04</option>';

  openModal('Tạo booking mới', `
    <form id="createForm">
      <div class="dialog-body form-grid">
        <div class="field full"><label for="newName">Tên khách hàng *</label><input id="newName" required maxlength="80" placeholder="Nhập họ và tên"></div>
        <div class="field full"><label for="newPhone">Số điện thoại *</label><input id="newPhone" type="tel" required pattern="0[0-9]{9}" placeholder="10 chữ số, bắt đầu bằng 0" maxlength="10"></div>
        <div class="field"><label for="newDate">Ngày đặt sân *</label><input id="newDate" type="date" value="${$('#dateFilter').value || today}" min="${today}" required></div>
        <div class="field"><label for="newCourt">Sân *</label><select id="newCourt">${courtOptions}</select></div>
        <div class="field"><label for="newStart">Giờ bắt đầu *</label><input id="newStart" type="time" value="18:00" required></div>
        <div class="field"><label for="newEnd">Giờ kết thúc *</label><input id="newEnd" type="time" value="20:00" required></div>
        <div class="field full"><label for="newNote">Ghi chú (tuỳ chọn)</label><input id="newNote" placeholder="Ví dụ: Khách quen, đặt trước..."></div>
      </div>
      ${footer('<button type="button" class="btn" data-close>Huỷ bỏ</button><button type="submit" class="btn primary" id="btnSubmitCreate">Tạo booking vào Database</button>')}
    </form>
  `);

  $('#createForm').onsubmit = async e => {
    e.preventDefault();
    const name = $('#newName').value.trim();
    const phone = $('#newPhone').value.trim();
    const date = $('#newDate').value;
    const courtId = Number($('#newCourt').value) || 1;
    const start = $('#newStart').value;
    const end = $('#newEnd').value;
    const note = $('#newNote') ? $('#newNote').value.trim() : '';

    if (!name) { notify('Vui lòng nhập tên khách hàng.'); return; }
    if (end <= start) { notify('Giờ kết thúc phải sau giờ bắt đầu.'); return; }

    const submitBtn = $('#btnSubmitCreate');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Đang lưu vào Database...';

    try {
      const payload = {
        court_id: courtId,
        booking_date: date,
        start_time: start + (start.length === 5 ? ':00' : ''),
        end_time: end + (end.length === 5 ? ':00' : ''),
        customer_name: name,
        customer_phone: phone,
        booking_channel: 'Admin',
        note: note || 'Đặt sân bởi Quản trị viên'
      };

      if (typeof api !== 'undefined') {
        await api.post('/bookings', payload);
      } else {
        const res = await fetch(`${CONFIG.API_BASE_URL}/bookings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.detail || 'Không thể tạo booking');
        }
      }

      close();
      notify('Đã tạo booking thành công vào database MySQL!');
      $('#dateFilter').value = date;
      page = 1;
      await loadBookingsFromBackend();
    } catch (err) {
      console.error('Lỗi khi tạo booking:', err);
      notify(err.message || 'Lỗi khi lưu booking vào cơ sở dữ liệu!');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Tạo booking vào Database';
    }
  };
};

$('#menuButton').onclick = () => {
  const open = $('#sidebar').classList.toggle('open');
  $('#menuButton').setAttribute('aria-expanded', open);
};

document.addEventListener('click', e => {
  if ($('#sidebar').classList.contains('open') && !e.target.closest('#sidebar') && !e.target.closest('#menuButton')) {
    $('#sidebar').classList.remove('open');
    $('#menuButton').setAttribute('aria-expanded', 'false');
  }
});

$('#bookingNav').onclick = () => {
  $('#sidebar').classList.remove('open');
  $('#menuButton').setAttribute('aria-expanded', 'false');
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

document.querySelectorAll('[data-info]').forEach(b => b.onclick = () => openModal(b.dataset.info, `<div class="dialog-body"><p style="line-height:1.9">Phân hệ <strong>${esc(b.dataset.info.toLowerCase())}</strong> của hệ thống quản trị.</p></div>${footer('<button class="btn primary" data-close>Đóng</button>')}`));

$('#helpButton').onclick = () => openModal('Hướng dẫn quản lý booking', `<div class="dialog-body"><div class="history"><strong>1. Dữ liệu thời gian thực</strong><small>Mọi booking hiển thị đều được tải trực tiếp từ cơ sở dữ liệu MySQL backend.</small><br><strong>2. Xác nhận / Hoàn thành</strong><small>Nhấn chi tiết booking để xác nhận hoặc đánh dấu hoàn thành đơn đặt sân.</small><br><strong>3. Huỷ sân có lý do</strong><small>Quản trị viên có thể huỷ đặt sân có kèm lý do. Hệ thống sẽ tự động lưu lại và gửi thông báo cho khách hàng.</small><br><strong>4. Xuất dữ liệu</strong><small>Hỗ trợ xuất báo cáo CSV theo bộ lọc ngày, sân và trạng thái.</small></div></div>${footer('<button class="btn primary" data-close>Đã hiểu</button>')}`);

$('#notificationButton').onclick = () => {
  const pending = bookings.filter(b => b.status === 'pending');
  openModal('Thông báo quản trị', `<div class="dialog-body"><p>Có <strong>${pending.length} booking</strong> đang chờ xác nhận từ khách hàng.</p>${pending.slice(0, 10).map(b => `<div style="padding:13px 0;border-top:1px solid var(--line);display:flex;justify-content:space-between;align-items:center;gap:12px"><div><strong>${esc(b.name)}</strong><span class="secondary">${esc(b.courtName)} · ${dateText(b.date)} · ${b.start}</span></div><button class="btn" data-action="detail" data-id="${b.id}">Xem</button></div>`).join('')}</div>${footer('<button class="btn" data-close>Đóng</button>')}`);
};

// ── Khởi động trang ───────────────────────────────────────────────────────
applyUserUI();
loadCourtsFromBackend().then(() => {
  loadBookingsFromBackend();
});
