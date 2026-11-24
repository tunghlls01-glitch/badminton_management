(function (global) {
  "use strict";

  const loginLink = document.getElementById("accountLoginLink");
  const account = document.getElementById("customerAccount");
  const profileLink = document.getElementById("customerAccountProfile");
  const avatar = document.getElementById("customerAccountAvatar");
  const name = document.getElementById("customerAccountName");
  const logoutButton = document.getElementById("customerAccountLogout");
  let accountRequest;

  function getToken() {
    return global.localStorage.getItem("access_token") || global.sessionStorage.getItem("access_token");
  }

  function getCachedUser() {
    for (const storage of [global.localStorage, global.sessionStorage]) {
      try {
        const user = JSON.parse(storage.getItem("user") || "null");
        if (user?.full_name) return user;
      } catch (_) {}
    }
    return null;
  }

  function render(user) {
    if (!account || !loginLink) return;
    const isAuthenticated = Boolean(user?.full_name);
    loginLink.hidden = isAuthenticated;
    account.hidden = !isAuthenticated;
    if (!isAuthenticated) return;

    const fullName = user.full_name.trim();
    name.textContent = fullName;
    avatar.textContent = fullName.charAt(0).toLocaleUpperCase("vi-VN") || "?";
    profileLink.title = user.email || fullName;
    profileLink.setAttribute("aria-label", `Hồ sơ tài khoản ${fullName}`);
  }

  function clearSession() {
    for (const storage of [global.localStorage, global.sessionStorage]) {
      storage.removeItem("access_token");
      storage.removeItem("user");
      storage.removeItem("token");
    }
  }

  function load() {
    if (accountRequest) return accountRequest;
    const token = getToken();
    if (!token) {
      render(null);
      accountRequest = Promise.resolve(null);
      return accountRequest;
    }

    const cachedUser = getCachedUser();
    if (cachedUser) render(cachedUser);

    const apiBase =
      (typeof CONFIG !== "undefined" && CONFIG.API_BASE_URL) ||
      "http://127.0.0.1:8000/api";

    accountRequest = global.fetch(`${apiBase}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(async (response) => {
      if (response.status === 401 || response.status === 403) {
        clearSession();
        render(null);
        const error = new Error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
        error.status = response.status;
        throw error;
      }
      if (!response.ok) {
        const error = new Error(`Không thể tải thông tin tài khoản (HTTP ${response.status}).`);
        error.status = response.status;
        throw error;
      }

      const user = await response.json();
      if (!user?.id || typeof user.full_name !== "string" || !user.full_name.trim()) {
        throw new Error("Backend không trả về hồ sơ tài khoản hợp lệ.");
      }

      const storage = global.localStorage.getItem("access_token")
        ? global.localStorage
        : global.sessionStorage;
      storage.setItem("user", JSON.stringify(user));
      render(user);
      return user;
    }).catch((error) => {
      if (cachedUser && ![401, 403].includes(error.status)) render(cachedUser);
      throw error;
    });

    return accountRequest;
  }

  function logout() {
    clearSession();
    global.location.assign("./login.html");
  }

  logoutButton?.addEventListener("click", logout);
  global.RK_CUSTOMER_ACCOUNT = { load, render, logout };
  void load().catch(() => {});
})(window);
