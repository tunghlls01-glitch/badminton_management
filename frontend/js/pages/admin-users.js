(async function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const h = RK_UI.escape;
  const params = new URLSearchParams(location.search);
  const customers = params.get("view") === "customers";
  const customerId = params.get("customer");
  const resource = customers ? "customers" : "staff";
  const api = "/admin/" + resource;
  const root = $("admin-users");
  let page = 1, rows = [], editId = null, pendingStatus = null, requestNumber = 0;
  const statusNames = {Pending:"Chờ xác nhận", Confirmed:"Đã xác nhận", CHECKED_IN:"Đang chơi", NO_SHOW:"Không đến", Completed:"Hoàn thành", Cancelled:"Đã hủy", Expired:"Hết hạn", SUCCESS:"Thành công", PENDING:"Chờ thanh toán", FAILED:"Thất bại", REFUNDED:"Đã hoàn tiền"};
  const date = (value) => value ? new Date(value).toLocaleString("vi-VN") : "Chưa có";
  const money = (value) => Number(value).toLocaleString("vi-VN") + " ₫";
  function errorText(error) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) return detail.map(e => e.loc.slice(1).join(".") + ": " + e.msg).join(" · ");
    return RK_UI.message(error);
  }
  if (!await ProtectedRoute(["admin"])) {
    $("rk-dashboard-state").textContent = RK_AUTH.getState().error || "Vui lòng đăng nhập bằng tài khoản Admin.";
    return;
  }
  RK_LAYOUT.dashboard(RK_AUTH.getState().user);
  $("rk-dashboard-state").hidden = true;
  $("rk-dashboard").hidden = false;
  root.innerHTML = `${customerId ? '<a class="au-back" href="admin-users.html?view=customers">← Quay lại khách hàng</a>' : ""}<h1>${customerId ? "Lịch sử đặt sân" : customers ? "Quản lý khách hàng" : "Quản lý nhân viên"}</h1><p>${customerId ? "Tra cứu lượt đặt và thanh toán của khách hàng." : customers ? "Tra cứu khách hàng và lịch sử đặt sân." : "Quản lý tài khoản và quyền truy cập của nhân viên."}</p><div id="au-summary" class="au-summary"></div><section class="au-panel"><form id="au-search" class="au-toolbar">${customerId ? '<label>Từ ngày<input type="date" name="date_from"></label><label>Đến ngày<input type="date" name="date_to"></label>' : '<label class="au-query">Tìm kiếm<input name="q" maxlength="100" placeholder="' + (customers ? 'Tên hoặc số điện thoại' : 'Tên, SĐT, email đăng nhập') + '"></label>'}${!customers || customerId ? '<label>Trạng thái<select name="status"><option value="">Tất cả trạng thái</option>' + (customerId ? Object.entries(statusNames).slice(0,7).map(([value,label]) => `<option value="${value}">${label}</option>`).join("") : '<option value="ACTIVE">Đang hoạt động</option><option value="LOCKED">Đã khóa</option>') + '</select></label>' : ''}<button class="rk-btn rk-primary" type="submit">${customerId ? "Áp dụng" : "Tìm kiếm"}</button>${!customers ? '<button type="button" id="au-add" class="rk-btn rk-primary">+ Thêm nhân viên</button>' : ''}</form><p id="au-notice" role="status"></p><div id="au-table" class="au-table"></div><div id="au-pages" class="au-pagination"></div></section>`;
  $("au-search").addEventListener("submit", e => { e.preventDefault(); page = 1; void load(); });
  async function load() {
    const request = ++requestNumber;
    const filters = Object.fromEntries(new FormData($("au-search")));
    for (const key of Object.keys(filters)) if (!filters[key]) delete filters[key];
    if (filters.date_from && filters.date_to && filters.date_from > filters.date_to) {
      $("au-notice").textContent = "Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.";
      return;
    }
    $("au-table").textContent = "Đang tải dữ liệu…";
    $("au-pages").replaceChildren();
    $("au-notice").textContent = "";
    try {
      const {data} = await axiosClient.get(customerId ? `${api}/${encodeURIComponent(customerId)}/bookings` : api, {params: {...filters, page, limit: 6}});
      if (request !== requestNumber) return;
      rows = data.items;
      if (!customers) $("au-summary").innerHTML = `<article>Tổng nhân viên<strong>${data.active_count + data.locked_count}</strong></article><article>Đang hoạt động<strong>${data.active_count}</strong></article><article>Đã khóa<strong>${data.locked_count}</strong></article>`;
      const columns = customerId ? ["Mã đặt", "Sân / Ngày chơi / Giờ", "Tổng tiền sân", "Trạng thái đặt", "Thanh toán"] : customers ? ["Mã", "Họ tên", "SĐT", "Tổng lượt đặt", "Lần đặt gần nhất", ""] : ["Mã", "Họ tên", "Email / Đăng nhập", "SĐT", "Trạng thái", "Thao tác"];
      $("au-table").innerHTML = rows.length ? `<table><thead><tr>${columns.map(c => `<th>${c}</th>`).join("")}</tr></thead><tbody>${rows.map(row => {
        if (customerId) return `<tr><td>${h(row.booking_code)}</td><td>${row.slots.map(s => `<div>${h(s.court_name)}<br><small>${h(date(s.start_at))} – ${h(new Date(s.end_at).toLocaleTimeString("vi-VN"))}</small></div>`).join("") || "Chưa có ca sân"}</td><td>${h(money(row.total_price))}</td><td>${h(statusNames[row.booking_status] || row.booking_status)}</td><td>${row.payments.map(p => `${h(statusNames[p.payment_status] || p.payment_status)} · ${h(money(p.amount))}`).join("<br>") || "Chưa ghi nhận thanh toán"}</td></tr>`;
        if (customers) return `<tr><td>KH${row.id}</td><td>${h(row.full_name)}</td><td>${h(row.phone)}</td><td>${row.total_bookings}</td><td>${h(date(row.last_booking_at))}</td><td><a class="au-link" href="admin-users.html?view=customers&customer=${row.id}">Xem lịch sử</a></td></tr>`;
        return `<tr><td>NV${row.id}</td><td>${h(row.full_name)}</td><td>${h(row.email)}</td><td>${h(row.phone)}</td><td><span class="au-badge ${row.status === "LOCKED" ? "au-locked" : ""}">${row.status === "ACTIVE" ? "Đang hoạt động" : "Đã khóa"}</span></td><td><div class="au-actions"><button data-edit="${row.id}">Sửa</button><button data-status="${row.id}">${row.status === "ACTIVE" ? "Khóa" : "Mở khóa"}</button></div></td></tr>`;
      }).join("")}</tbody></table>` : '<div class="au-empty">Không có dữ liệu phù hợp.</div>';
      const pages = Math.max(1, Math.ceil(data.total / 6));
      $("au-pages").innerHTML = `<span>${data.total} kết quả · Trang ${page}/${pages}</span><div class="au-actions"><button data-page="${page-1}" ${page===1 ? "disabled" : ""}>Trước</button><button data-page="${page+1}" ${page>=pages ? "disabled" : ""}>Sau</button></div>`;
    } catch (error) {
      if (request !== requestNumber) return;
      $("au-table").innerHTML = '<button type="button" id="au-retry">Thử lại</button>';
      $("au-notice").textContent = errorText(error);
      $("au-retry").onclick = load;
    }
  }
  function openStaff(row) {
    editId = row?.id || null;
    const form = $("staff-form"); form.reset();
    for (const key of ["full_name","email","phone"]) form.elements[key].value = row?.[key] || "";
    form.elements.password.required = !editId;
    form.elements.password.disabled = Boolean(editId);
    $("staff-password-label").hidden = Boolean(editId);
    $("staff-title").textContent = editId ? "Chỉnh sửa nhân viên" : "Thêm nhân viên";
    $("staff-error").textContent = "";
    $("staff-dialog").showModal();
  }
  root.addEventListener("click", e => {
    const button = e.target.closest("button"); if (!button) return;
    if (button.id === "au-add") openStaff();
    if (button.dataset.page) { page = Number(button.dataset.page); void load(); }
    if (button.dataset.edit) openStaff(rows.find(row => row.id === Number(button.dataset.edit)));
    if (button.dataset.status) {
      pendingStatus = rows.find(row => row.id === Number(button.dataset.status));
      $("status-title").textContent = pendingStatus.status === "ACTIVE" ? "Khóa tài khoản nhân viên?" : "Mở khóa tài khoản nhân viên?";
      $("status-description").textContent = pendingStatus.full_name + (pendingStatus.status === "ACTIVE" ? " sẽ không thể đăng nhập hoặc tiếp tục sử dụng phiên hiện tại." : " sẽ có thể đăng nhập và làm việc trở lại.");
      $("status-error").textContent = ""; $("status-dialog").showModal();
    }
  });
  document.querySelectorAll("[data-close]").forEach(button => button.onclick = () => button.closest("dialog").close());
  $("staff-form").onsubmit = async e => {
    e.preventDefault(); const form = e.target;
    const payload = Object.fromEntries(new FormData(form));
    if (payload.password && new TextEncoder().encode(payload.password).length > 72) { $("staff-error").textContent = "Mật khẩu tối đa 72 byte UTF-8."; return; }
    const button = form.querySelector('[type="submit"]'); button.disabled = true;
    try {
      if (editId) await axiosClient.put(`${api}/${editId}`, payload);
      else await axiosClient.post(api, payload);
      $("staff-dialog").close(); await load(); $("au-notice").textContent = "Đã lưu thông tin nhân viên.";
    } catch(error) { $("staff-error").textContent = errorText(error); }
    finally { button.disabled = false; }
  };
  $("status-confirm").onclick = async () => {
    const button = $("status-confirm"); button.disabled = true;
    try {
      await axiosClient.patch(`${api}/${pendingStatus.id}/status`, {status: pendingStatus.status === "ACTIVE" ? "LOCKED" : "ACTIVE"});
      $("status-dialog").close(); await load(); $("au-notice").textContent = "Đã cập nhật trạng thái tài khoản.";
    } catch(error) { $("status-error").textContent = errorText(error); }
    finally { button.disabled = false; }
  };
  if (customerId) {
    try { const {data} = await axiosClient.get(`${api}/${encodeURIComponent(customerId)}`); $("au-summary").textContent = `${data.full_name} · ${data.phone} · ${data.total_bookings} lượt đặt`; }
    catch(error) { $("au-notice").textContent = errorText(error); return; }
  }
  await load();
})();
