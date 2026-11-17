(function (global) {
  "use strict";
  const client = global.axios.create({
    baseURL: global.RK_CONFIG.apiURL,
    timeout: 12000,
    headers: { Accept: "application/json" },
  });
  client.interceptors.request.use((config) => {
    const token = config.skipAuth
      ? null
      : config.authToken || global.RK_SESSION.read().token;
    if (config.skipAuth) config.headers.delete("Authorization");
    else if (token) config.headers.set("Authorization", "Bearer " + token);
    config.sessionToken = token;
    config.sessionRevision = global.RK_SESSION.revision;
    return config;
  });
  client.interceptors.response.use(
    (response) => response,
    (error) => {
      const config = error.config || {};
      if (
        error.response?.status === 401 &&
        !config.skipAuthRedirect &&
        config.sessionToken === global.RK_SESSION.read().token &&
        config.sessionRevision === global.RK_SESSION.revision
      ) {
        global.RK_SESSION.clear();
        global.dispatchEvent(new Event("rk:session-expired"));
        global.RK_NAV.go(
          global.RK_CONFIG.loginURL + "?reason=session-expired",
          true,
        );
      }
      return Promise.reject(error);
    },
  );
  global.axiosClient = client;
})(window);
