(async function () {
  "use strict";
  if (await ProtectedRoute(["admin", "staff"])) {
    RK_LAYOUT.dashboard(RK_AUTH.getState().user);
  }
})();
