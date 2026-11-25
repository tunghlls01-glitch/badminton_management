(async function () {
  "use strict";

  function getActiveUser() {
    let user = null;
    try {
      if (window.RK_AUTH && typeof window.RK_AUTH.getState === "function") {
        const auth = window.RK_AUTH.getState();
        if (auth && auth.user) user = auth.user;
      }
      if (!user && window.authStorage && typeof window.authStorage.getUser === "function") {
        user = window.authStorage.getUser();
      }
      if (!user) {
        const raw = localStorage.getItem("user") || sessionStorage.getItem("user");
        if (raw) user = JSON.parse(raw);
      }
    } catch (e) {
      console.warn("admin-sidebar: could not read storage user:", e);
    }
    if (!user) {
      user = {
        id: 1,
        full_name: "Quản Trị Viên Hệ Thống",
        role: "admin",
        email: "admin@badminton.com",
      };
    }
    return user;
  }

  function renderSidebar(u) {
    const user = u || getActiveUser();
    const sidebar = document.getElementById("rk-sidebar");
    if (sidebar && sidebar.children.length === 0) {
      delete sidebar.dataset.rendered;
    }
    if (window.RK_LAYOUT && typeof window.RK_LAYOUT.dashboard === "function") {
      window.RK_LAYOUT.dashboard(user);
    }
  }

  // 1. Render ngay lập tức khi load script
  renderSidebar();

  // 2. Chạy ProtectedRoute nếu có để cập nhật thông tin user chính thức
  try {
    if (typeof ProtectedRoute === "function") {
      const ok = await ProtectedRoute(["admin", "staff"]);
      if (ok && window.RK_AUTH) {
        const authUser = window.RK_AUTH.getState()?.user;
        if (authUser) {
          const sidebar = document.getElementById("rk-sidebar");
          if (sidebar) delete sidebar.dataset.rendered;
          renderSidebar(authUser);
        }
      }
    }
  } catch (err) {
    console.warn("admin-sidebar: ProtectedRoute check error:", err);
  }

  // 3. Lắng nghe cập nhật auth
  if (window.RK_AUTH && typeof window.RK_AUTH.subscribe === "function") {
    window.RK_AUTH.subscribe((authState) => {
      if (authState && authState.user) {
        const sidebar = document.getElementById("rk-sidebar");
        if (sidebar) delete sidebar.dataset.rendered;
        renderSidebar(authState.user);
      }
    });
  }
  window.addEventListener("rk:auth-change", (e) => {
    if (e.detail && e.detail.user) {
      const sidebar = document.getElementById("rk-sidebar");
      if (sidebar) delete sidebar.dataset.rendered;
      renderSidebar(e.detail.user);
    }
  });
})();
