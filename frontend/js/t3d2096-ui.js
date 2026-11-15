(function (global) {
  "use strict";
  const shapes = {
    arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    eyeOff:
      '<path d="m3 3 18 18M10 5c8-1 12 7 12 7a20 20 0 0 1-4 4M6 6a20 20 0 0 0-4 6s3 7 10 7c2 0 4-1 5-2"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    calendar:
      '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    users:
      '<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3m2-17a3 3 0 0 1 0 6m1 4a5 5 0 0 1 3 4v3"/>',
    chart: '<path d="M4 3v18h17M8 17v-5m5 5V8m5 9V5"/>',
    package: '<path d="m12 3 9 5-9 5-9-5 9-5Zm-9 5v10l9 5 9-5V8m-9 5v10"/>',
    card: '<rect x="2" y="4" width="20" height="16" rx="3"/><path d="M2 10h20M6 16h3"/>',
    shield:
      '<path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3Z"/><path d="m8 12 3 3 5-6"/>',
    logout: '<path d="M9 4H4v16h5m3-8h9m-4-4 4 4-4 4"/>',
  };
  const escape = (value = "") =>
    String(value).replace(
      /[&<>"']/g,
      (char) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[char],
    );
  function message(error) {
    if (error.response?.status === 401)
      return "Email hoặc mật khẩu chưa đúng. Vui lòng thử lại.";
    if (error.response?.status === 403)
      return "Tài khoản bị khóa hoặc không có quyền thực hiện thao tác này.";
    if (error.response?.status === 409) {
      const detail = String(error.response.data?.detail || "").toLowerCase();
      return detail.includes("phone") || detail.includes("dien thoai")
        ? "Số điện thoại đã được đăng ký."
        : "Email đã được đăng ký.";
    }
    if (error.response?.status === 422)
      return "Thông tin gửi lên chưa hợp lệ. Vui lòng kiểm tra lại các ô nhập.";
    if (error.code === "ECONNABORTED")
      return "Máy chủ phản hồi chậm. Vui lòng thử lại.";
    if (error.response?.status >= 500)
      return "Máy chủ đang gặp sự cố. Vui lòng thử lại sau.";
    if (error.isAxiosError && !error.response)
      return "Chưa kết nối được máy chủ. Vui lòng thử lại.";
    return error.message || "Đã xảy ra lỗi. Vui lòng thử lại.";
  }
  global.RK_UI = {
    escape,
    message,
    icon: (name, size = 18) =>
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${shapes[name] || shapes.grid}</svg>`,
    show(element, text, type = "error") {
      element.hidden = !text;
      element.textContent = text;
      element.className = "rk-alert rk-alert-" + type;
    },
    sessionError(element, text) {
      element.hidden = false;
      element.innerHTML = `<div class="rk-alert rk-alert-error"><span>${escape(text)}</span><button type="button" class="rk-link" data-rk-action="retry-session">Thử lại</button><button type="button" class="rk-link" data-rk-action="logout">Về đăng nhập</button></div>`;
    },
  };
})(window);
