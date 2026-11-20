/* global CONFIG */
/* Cấu hình riêng T3D2096. Không thay CONFIG hay js/config.js của nhóm. */
(function (global) {
  "use strict";
  const oldConfig = typeof CONFIG !== "undefined" ? CONFIG : {};
  const custom = global.RK_TASK_CONFIG || {};
  const root = new URL(document.body.dataset.root || "../", document.baseURI);
  const page = (file) => new URL("pages/" + file, root).href;
  const apiURL =
    custom.apiURL ||
    global.VITE_API_URL ||
    oldConfig.API_BASE_URL ||
    "http://localhost:8000/api/v1";
  const origin = new URL(apiURL, document.baseURI).origin;
  global.RK_CONFIG = Object.freeze({
    apiURL,
    // main.py của project_code.txt đăng ký auth ở gốc, không dưới /api.
    authURL: custom.authURL || origin + "/auth",
    homeURL: page("customer-home.html"),
    profileURL: page("profile.html"),
    loginURL: page("login.html"),
    registerURL: page("register.html"),
    forbiddenURL: page("403.html"),
    dashboardURL: page("dashboard.html"),
    bookingURL: page("booking.html"),
    myBookingsURL: page("court_booking_schedule.html"),
    assetURL: new URL("assets/images/", root).href,
    adminHome: custom.adminHome || page("dashboard.html") + "?view=dashboard",
    staffHome: custom.staffHome || page("dashboard.html") + "?view=bookings",
    receptionURL: page("reception.html"),
    posURL: page("pos.html"),
    // Các module còn lại do thành viên phụ trách nối URL thật tại đây.
    dashboardLinks: custom.dashboardLinks || {
      "admin.courts": page("courts.html"),
      "staff.courts": page("courts.html"),
      "admin.pricing": page("pricing.html"),
      "admin.users": page("admin-users.html") + "?view=users",
      "admin.customers": page("admin-users.html") + "?view=customers",
      "admin.services": page("services.html"),
      "staff.services": page("services.html"),
      "admin.pos": page("pos.html"),
      "staff.pos": page("pos.html"),
      "staff.check-in": page("reception.html"),
      "admin.check-in": page("reception.html"),
      "admin.revenue": page("analytics.html"),
    },
  });
  global.RK_NAV = {
    go(url, replace = false) {
      if (replace) global.location.replace(url);
      else global.location.assign(url);
    },
  };
})(window);
