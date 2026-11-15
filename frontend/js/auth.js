(function (global) {
  "use strict";
  const listeners = new Set();
  let state = { user: null, token: null, status: "loading", error: "" };
  let generation = 0;
  let pending;
  const publish = (next) => {
    state = next;
    for (const listener of listeners) listener(state);
    global.dispatchEvent(new CustomEvent("rk:auth-change", { detail: state }));
  };
  function normalize(data) {
    const role = String(data?.role || "").toLowerCase();
    if (
      !data ||
      data.id == null ||
      typeof data.full_name !== "string" ||
      typeof data.email !== "string" ||
      !["admin", "staff", "customer"].includes(role)
    )
      throw new Error("Thông tin tài khoản trả về không hợp lệ.");
    return { id: data.id, full_name: data.full_name, email: data.email, role };
  }
  async function me(token, signal) {
    const response = await global.axiosClient.get(
      global.RK_CONFIG.authURL + "/me",
      { authToken: token, signal, skipAuthRedirect: true },
    );
    return normalize(response.data);
  }
  function logout() {
    generation += 1;
    pending?.abort();
    global.RK_SESSION.clear();
    publish({ user: null, token: null, status: "anonymous", error: "" });
  }
  async function restore() {
    const current = ++generation;
    pending?.abort();
    pending = new AbortController();
    const session = global.RK_SESSION.read();
    if (!session.token) {
      publish({ user: null, token: null, status: "anonymous", error: "" });
      return state;
    }
    publish({ user: null, token: session.token, status: "loading", error: "" });
    try {
      const user = await me(session.token, pending.signal);
      if (current !== generation) return state;
      global.RK_SESSION.save(session.token, user, session.remember);
      publish({
        user,
        token: session.token,
        status: "authenticated",
        error: "",
      });
    } catch (error) {
      if (current !== generation || global.axios.isCancel(error)) return state;
      if ([401, 403].includes(error.response?.status)) {
        logout();
        state.redirected = true;
        global.RK_NAV.go(
          global.RK_CONFIG.loginURL +
            "?reason=" +
            (error.response.status === 403 ? "locked" : "session-expired"),
          true,
        );
      } else
        publish({
          user: null,
          token: session.token,
          status: "error",
          error: global.RK_UI.message(error),
        });
    }
    return state;
  }
  global.RK_AUTH = {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    normalize,
    restore,
    logout,
    home(role) {
      return (
        {
          admin: global.RK_CONFIG.adminHome,
          staff: global.RK_CONFIG.staffHome,
          customer: global.RK_CONFIG.homeURL,
        }[role] || global.RK_CONFIG.forbiddenURL
      );
    },
    async login(account, password, remember, signal) {
      const current = ++generation;
      pending?.abort();
      const request = new AbortController();
      pending = request;
      const abort = () => request.abort();
      signal?.addEventListener("abort", abort, { once: true });
      if (signal?.aborted) request.abort();
      try {
        const response = await global.axiosClient.post(
          global.RK_CONFIG.authURL + "/login",
          { account: account.trim(), password },
          { signal: request.signal, skipAuth: true, skipAuthRedirect: true },
        );
        const token = response.data?.access_token;
        if (typeof token !== "string" || !token.trim())
          throw new Error("Máy chủ chưa trả về token đăng nhập.");
        const user = await me(token, request.signal);
        if (request.signal.aborted || current !== generation)
          throw new global.axios.CanceledError();
        global.RK_SESSION.save(token, user, remember);
        publish({ user, token, status: "authenticated", error: "" });
        return user;
      } finally {
        signal?.removeEventListener("abort", abort);
      }
    },
    async register(values, signal) {
      const payload = {
        full_name: values.full_name.trim(),
        phone: values.phone.trim(),
        email: values.email.trim(),
        password: values.password,
      };
      return (
        await global.axiosClient.post(
          global.RK_CONFIG.authURL + "/register",
          payload,
          { signal, skipAuth: true, skipAuthRedirect: true },
        )
      ).data;
    },
  };
  global.addEventListener("rk:session-expired", logout);
  global.addEventListener("storage", (event) => {
    if (event.key === "access_token" || event.key === null) void restore();
  });
})(window);
