(function (global) {
  "use strict";
  const { escape: h, icon } = global.RK_UI;
  const config = global.RK_CONFIG;
  const menu = [
    { key: "dashboard", label: "Tổng quan", icon: "grid", roles: ["admin"] },
    { key: "courts", label: "Quản lý sân", icon: "grid", roles: ["admin"] },
    {
      key: "bookings",
      label: "Quản lý đặt sân",
      icon: "calendar",
      roles: ["admin"],
    },
    {
      key: "pricing",
      label: "Bảng giá & Khung giờ",
      icon: "clock",
      roles: ["admin"],
    },
    {
      key: "services",
      label: "Dịch vụ & Kho",
      icon: "package",
      roles: ["admin"],
    },
    {
      key: "users",
      label: "Quản lý nhân viên & Khách hàng",
      icon: "users",
      roles: ["admin"],
    },
    {
      key: "revenue",
      label: "Báo cáo doanh thu",
      icon: "chart",
      roles: ["admin"],
    },
    {
      key: "bookings",
      label: "Lịch đặt sân hôm nay",
      icon: "calendar",
      roles: ["staff"],
    },
    {
      key: "check-in",
      label: "Check-in / Thanh toán tại quầy",
      icon: "card",
      roles: ["admin", "staff"],
    },
    { key: "courts", label: "Danh sách sân", icon: "grid", roles: ["staff"] },
    {
      key: "services",
      label: "Dịch vụ đi kèm",
      icon: "package",
      roles: ["staff"],
    },
  ];
  const logo = () =>
    `<a class="rk-logo" href="${h(config.homeURL)}"><span class="rk-logo-mark" aria-hidden="true">//</span><span>RK BADMINTON</span></a>`;
  function renderAvatar(user) {
    const content = user.avatar
      ? `<img src="${h(user.avatar)}" alt="">`
      : h(user.full_name.trim().charAt(0).toUpperCase());
    return `<span class="rk-avatar">${content}</span>`;
  }
  const roleLabels = {
    admin: "Quản trị viên",
    staff: "Lễ tân",
    customer: "Thành viên",
  };
  function guest(session, minimal = false) {
    const target = document.getElementById("rk-header");
    const user = session.user;
    if (target)
      target.innerHTML = `<div class="rk-header-inner">${logo()}${minimal ? `<a class="rk-back" href="${h(config.homeURL)}">← Quay về trang chủ</a>` : `<button class="rk-icon-button rk-mobile-toggle" type="button" data-rk-action="menu" aria-label="Mở menu" aria-expanded="false" aria-controls="rk-nav">${icon("menu")}</button><nav id="rk-nav" class="rk-nav" aria-label="Điều hướng chính"><a class="active" href="${h(config.homeURL)}">Trang chủ</a><a href="${h(config.homeURL)}#courts">Danh sách sân</a><a href="${h(config.homeURL)}#pricing">Bảng giá</a><a data-require-auth href="${h(config.myBookingsURL)}">Lịch đặt của tôi</a></nav><div class="rk-header-actions">${user ? `<a class="rk-user" href="${h(config.profileURL)}">${renderAvatar(user)}<span class="rk-user-name">${h(user.full_name)}</span></a><button class="rk-icon-button" type="button" data-rk-action="logout" aria-label="Đăng xuất">${icon("logout")}<span class="rk-logout-label">Đăng xuất</span></button>` : `<a class="rk-login-link" href="${h(config.loginURL)}">Đăng nhập</a><a class="rk-btn rk-primary rk-small" href="${h(config.registerURL)}">Đăng ký</a>`}</div>`}</div>`;
    const footer = document.getElementById("rk-footer");
    if (footer)
      footer.innerHTML = `<div class="rk-container rk-footer-inner"><div><strong>RK BADMINTON</strong><p>Đam mê hết mình. Sân đồng hành tuyệt vời.</p></div><div><p>Giờ mở cửa 06:00 - 23:00 · Hỗ trợ trực tiếp tại quầy lễ tân</p><div class="rk-footer-links"><small>© ${new Date().getFullYear()} RK BADMINTON</small><a href="${h(config.homeURL)}#courts">Danh sách sân</a><a href="${h(config.homeURL)}#pricing">Bảng giá</a><a data-require-auth href="${h(config.myBookingsURL)}">Lịch đặt của tôi</a></div><small class="rk-credit">Ảnh minh họa: AI và Alanands3 / CC BY-SA 4.0.</small></div></div>`;
  }
  function dashboard(user) {
    const items = menu.filter((item) => item.roles.includes(user.role));
    const view =
      new URLSearchParams(global.location.search).get("view") || items[0].key;
    const active = items.find((item) => item.key === view) || items[0];
    const sidebar = document.getElementById("rk-sidebar");
    sidebar.innerHTML = `<div class="rk-sidebar-logo">${logo()}<button class="rk-icon-button rk-sidebar-close" type="button" data-rk-action="sidebar-close" aria-label="Đóng menu">${icon("close")}</button></div><p class="rk-nav-caption">KHÔNG GIAN LÀM VIỆC</p><nav aria-label="Quản lý">${items
      .map((item) => {
        const override = config.dashboardLinks[user.role + "." + item.key];
        const href =
          override ||
          (item.key === items[0].key
            ? config.dashboardURL + "?view=" + item.key
            : null);
        return href
          ? `<a href="${h(href)}" class="${item.key === active.key ? "active" : ""}" ${item.key === active.key ? 'aria-current="page"' : ""}>${icon(item.icon)}<span>${h(item.label)}</span></a>`
          : `<button type="button" disabled title="Chức năng đang được hoàn thiện">${icon(item.icon)}<span>${h(item.label)}</span></button>`;
      })
      .join(
        "",
      )}</nav><div class="rk-sidebar-bottom"><a href="${h(config.profileURL)}">Hồ sơ cá nhân</a><a href="${h(config.homeURL)}">Xem trang khách hàng ${icon("arrow")}</a><button type="button" data-rk-action="logout">${icon("logout")}Đăng xuất</button></div>`;
    document.getElementById("rk-dashboard-header").innerHTML =
      `<div><button type="button" class="rk-icon-button rk-dashboard-toggle" data-rk-action="sidebar" aria-label="Mở menu quản lý" aria-expanded="false" aria-controls="rk-sidebar">${icon("menu")}</button><strong>${h(active.label)}</strong></div><div class="rk-user">${renderAvatar(user)}<span><strong>${h(user.full_name)}</strong><small>${roleLabels[user.role]}</small></span><button type="button" class="rk-icon-button" data-rk-action="logout" aria-label="Đăng xuất">${icon("logout")}</button></div>`;
    document.querySelector("[data-welcome]").textContent =
      "Xin chào, " + user.full_name + ".";
    document.querySelector("[data-role-label]").textContent =
      roleLabels[user.role];
  }
  global.RK_LAYOUT = { guest, dashboard, menu };
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-rk-action]");
    const action = button?.dataset.rkAction;
    if (action === "logout") {
      global.RK_AUTH.logout();
      global.RK_NAV.go(config.loginURL, true);
    } else if (action === "retry-session") void global.RK_AUTH.restore();
    else if (action === "menu") {
      const open = document
        .getElementById("rk-nav")
        ?.classList.toggle("is-open");
      button.setAttribute("aria-expanded", String(Boolean(open)));
      button.setAttribute("aria-label", open ? "Đóng menu" : "Mở menu");
    } else if (action === "sidebar" || action === "sidebar-close") {
      const sidebar = document.getElementById("rk-sidebar");
      const open =
        action === "sidebar" && !sidebar.classList.contains("is-open");
      sidebar.classList.toggle("is-open", open);
      document
        .querySelector('[data-rk-action="sidebar"]')
        ?.setAttribute("aria-expanded", String(open));
      const backdrop = document.getElementById("rk-backdrop");
      if (backdrop) backdrop.hidden = !open;
    }
    const link = event.target.closest("a[data-require-auth]");
    if (link && global.RK_AUTH.getState().status !== "authenticated") {
      event.preventDefault();
      global.RK_NAV.go(config.loginURL);
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    document.getElementById("rk-nav")?.classList.remove("is-open");
    document.getElementById("rk-sidebar")?.classList.remove("is-open");
    const backdrop = document.getElementById("rk-backdrop");
    if (backdrop) backdrop.hidden = true;
    const button = document.querySelector('[data-rk-action="menu"]');
    button?.setAttribute("aria-expanded", "false");
    button?.setAttribute("aria-label", "Mở menu");
  });
})(window);
