(function (global) {
  "use strict";
  const keys = ["access_token", "user"];
  let revision = 0;
  function removeAll() {
    for (const storage of [global.localStorage, global.sessionStorage])
      for (const key of keys) storage.removeItem(key);
  }
  global.RK_SESSION = {
    get revision() {
      return revision;
    },
    read() {
      const token =
        global.localStorage.getItem("access_token") ||
        global.sessionStorage.getItem("access_token");
      return {
        token,
        remember: Boolean(global.localStorage.getItem("access_token")),
      };
    },
    save(token, user, remember) {
      if (typeof token !== "string" || !token.trim())
        throw new Error("Token đăng nhập không hợp lệ.");
      removeAll();
      const storage = remember ? global.localStorage : global.sessionStorage;
      try {
        storage.setItem("access_token", token);
        storage.setItem("user", JSON.stringify(user));
      } catch {
        removeAll();
        throw new Error(
          "Trình duyệt không lưu được phiên. Vui lòng cho phép lưu trữ và thử lại.",
        );
      }
      revision += 1;
    },
    clear() {
      removeAll();
      revision += 1;
    },
  };
})(window);
