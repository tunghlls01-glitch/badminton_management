(function (global) {
  "use strict";
  if (document.body.dataset.page === "forbidden") {
    global.RK_LAYOUT.guest(global.RK_AUTH.getState());
    global.RK_AUTH.subscribe((session) => {
      global.RK_LAYOUT.guest(session);
      document.getElementById("rk-back-home").href = session.user
        ? global.RK_AUTH.home(session.user.role)
        : global.RK_CONFIG.homeURL;
    });
    void global.RK_AUTH.restore();
    return;
  }
  const box = document.getElementById("rk-dashboard-state");
  const shell = document.getElementById("rk-dashboard");
  function render(session) {
    if (session.status === "error") {
      shell.hidden = true;
      global.RK_UI.sessionError(box, session.error);
      return;
    }
    if (session.status === "loading") {
      shell.hidden = true;
      box.hidden = false;
      box.textContent = "Đang kiểm tra quyền truy cập...";
      return;
    }
    if (!session.user) {
      global.RK_NAV.go(global.RK_CONFIG.loginURL, true);
      return;
    }
    if (!["admin", "staff"].includes(session.user.role)) {
      global.RK_NAV.go(global.RK_CONFIG.forbiddenURL, true);
      return;
    }
    if (new URLSearchParams(global.location.search).get("view") === "revenue" && session.user.role === "admin") {
      global.RK_NAV.go("analytics.html", true);
      return;
    }
    global.RK_LAYOUT.dashboard(session.user);
    const isOverview =
      session.user.role === "admin" &&
      [null, "dashboard"].includes(new URLSearchParams(global.location.search).get("view"));
    if (isOverview) global.RK_ADMIN_OVERVIEW.mount();
    box.hidden = true;
    shell.hidden = false;
  }
  const unsubscribe = global.RK_AUTH.subscribe(render);
  // Guard dùng được cho các trang của nhóm bằng ProtectedRoute(['admin', 'staff']).
  void global.ProtectedRoute(["admin", "staff"]);
  global.addEventListener("pagehide", unsubscribe, { once: true });
})(window);
