(function (global) {
  "use strict";
  global.ProtectedRoute = async function (allowedRoles = []) {
    const state = await global.RK_AUTH.restore();
    if (
      state.redirected ||
      state.status === "loading" ||
      state.status === "error"
    )
      return false;
    if (!state.user || !state.token) {
      global.RK_NAV.go(global.RK_CONFIG.loginURL, true);
      return false;
    }
    if (allowedRoles.length && !allowedRoles.includes(state.user.role)) {
      global.RK_NAV.go(global.RK_CONFIG.forbiddenURL, true);
      return false;
    }
    return true;
  };
})(window);
