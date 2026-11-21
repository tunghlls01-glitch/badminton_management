// Thông báo dùng chung cho các trang đặt sân, thay cho hộp thoại alert của trình duyệt.
(function () {
  const icons = {
    success: "✓",
    error: "!",
    warning: "!",
    info: "i",
  };

  function getRegion() {
    let region = document.getElementById("rkNoticeRegion");
    if (!region) {
      region = document.createElement("div");
      region.id = "rkNoticeRegion";
      region.className = "rk-notice-region";
      region.setAttribute("aria-live", "polite");
      region.setAttribute("aria-relevant", "additions removals");
      document.body.appendChild(region);
    }
    return region;
  }

  window.showAppNotice = function (message, options = {}) {
    const type = ["success", "error", "warning", "info"].includes(options.type)
      ? options.type
      : "info";
    const duration = Number.isFinite(options.duration) ? options.duration : 5200;
    const card = document.createElement("div");
    card.className = `rk-notice rk-notice-${type}`;
    card.setAttribute("role", type === "error" ? "alert" : "status");

    const icon = document.createElement("span");
    icon.className = "rk-notice-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = icons[type];

    const text = document.createElement("p");
    text.className = "rk-notice-text";
    text.textContent = String(message || "");

    const close = document.createElement("button");
    close.className = "rk-notice-close";
    close.type = "button";
    close.setAttribute("aria-label", "Đóng thông báo");
    close.textContent = "×";
    close.addEventListener("click", () => card.remove());

    card.append(icon, text, close);
    getRegion().appendChild(card);

    if (duration > 0) {
      window.setTimeout(() => card.remove(), duration);
    }
    return card;
  };
})();
