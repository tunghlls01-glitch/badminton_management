// Cấu hình chung của frontend.
// Đổi API_BASE_URL nếu backend chạy ở địa chỉ/cổng khác (hoặc khi deploy).
const CONFIG = {
  API_BASE_URL: location.pathname.startsWith("/web/")
    ? new URL("/api", location.origin).href
    : "http://127.0.0.1:8000/api",
  APP_NAME: "KS25 Base",
};

// Tự động tải bộ chuyển đổi ngôn ngữ (Tiếng Việt <-> English) cho toàn bộ các trang trong hệ thống
(function () {
  if (typeof window !== "undefined" && !window.__RK_I18N_INJECTED__) {
    window.__RK_I18N_INJECTED__ = true;
    const scripts = document.getElementsByTagName("script");
    let i18nPath = "js/i18n.js";
    for (let i = 0; i < scripts.length; i++) {
      const src = scripts[i].getAttribute("src") || "";
      if (src.includes("config.js")) {
        i18nPath = src.replace("config.js", "i18n.js");
        break;
      }
    }
    const script = document.createElement("script");
    script.src = i18nPath;
    document.head.appendChild(script);
  }
})();
