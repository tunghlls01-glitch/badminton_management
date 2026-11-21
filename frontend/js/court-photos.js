(function (global) {
  "use strict";

  const config = global.RK_CONFIG;
  const apiOrigin = new URL(config.apiURL, document.baseURI).origin;

  function resolve(value) {
    if (typeof value !== "string" || !value.trim()) return "";
    try {
      const url = new URL(value, apiOrigin);
      if (url.protocol === "http:" || url.protocol === "https:") return url.href;
    } catch {
      return "";
    }
    return "";
  }

  function show(image, url) {
    const placeholder = image.nextElementSibling;
    image.hidden = !url;
    placeholder.hidden = Boolean(url);
    placeholder.textContent = "Chưa có ảnh";
    if (url) image.src = url;
    else image.removeAttribute("src");
  }

  function recover(event) {
    const image = event.target;
    if (image instanceof HTMLImageElement && image.hasAttribute("src")) {
      show(image, "");
      image.nextElementSibling.textContent = "Không tải được ảnh";
    }
  }

  global.RK_COURT_PHOTOS = { resolve, show, recover };
})(window);
