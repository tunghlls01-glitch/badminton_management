(function (global) {
  "use strict";
  const { escape: h, icon, message } = global.RK_UI;
  const config = global.RK_CONFIG;
  const photos = global.RK_COURT_PHOTOS;
  const grid = document.getElementById("rk-court-grid");
  grid.addEventListener("error", photos.recover, true);
  const note = document.getElementById("rk-court-state");
  const summary = document.getElementById("rk-court-summary");
  const sessionBox = document.getElementById("rk-session-state");
  const pricingBody = document.querySelector("#pricing .rk-pricing-table tbody");
  const pricingCourt = document.getElementById("rk-pricing-court");
  const days = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"];
  const currency = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" });
  const controller = new AbortController();
  let pending = false;
  let pricingPending = false;
  let pricingNeedsRefresh = false;
  let priceRules = null;

  function renderPricing() {
    if (!priceRules) return;
    const groups = new Map();
    for (const rule of priceRules) {
      if (rule.court_id !== Number(pricingCourt.value)) continue;
      const range = rule.start_time.slice(0, 5) + " – " + rule.end_time.slice(0, 5);
      const key = range + "|" + rule.hourly_rate;
      if (!groups.has(key)) groups.set(key, { range, price: rule.hourly_rate, days: [] });
      groups.get(key).days.push(days[rule.weekday_index]);
    }
    const rows = [...groups.values()].sort((a, b) => a.range.localeCompare(b.range));
    pricingBody.innerHTML = rows.length ? rows.map((row) =>
      `<tr><th scope="row">${h(row.range)}</th><td>${h(row.days.join(", "))}</td><td>${h(currency.format(row.price))} <small>/ giờ</small></td></tr>`
    ).join("") : '<tr><td colspan="3">Chưa có bảng giá cho sân này.</td></tr>';
  }

  async function loadPricing() {
    if (controller.signal.aborted) return;
    if (pricingPending) {
      pricingNeedsRefresh = true;
      return;
    }
    pricingPending = true;
    try {
      const { data } = await global.axiosClient.get("/price-rules", {
        skipAuth: true, signal: controller.signal,
      });
      priceRules = data;
      renderPricing();
    } catch {
      if (controller.signal.aborted) return;
      priceRules = null;
      pricingBody.innerHTML = '<tr><td colspan="3">Không tải được bảng giá. <button type="button" class="rk-link">Thử lại</button></td></tr>';
      pricingBody.querySelector("button").addEventListener("click", loadPricing);
    } finally {
      pricingPending = false;
      if (pricingNeedsRefresh) {
        pricingNeedsRefresh = false;
        void loadPricing();
      }
    }
  }

  async function load() {
    if (pending || controller.signal.aborted) return;
    pending = true;
    grid.setAttribute("aria-busy", "true");
    note.innerHTML = '<p role="status">Đang tải danh sách sân...</p>';
    try {
      const { data } = await global.axiosClient.get("/courts", {
        signal: controller.signal,
        skipAuth: true,
      });
      if (controller.signal.aborted) return;
      if (!Array.isArray(data))
        throw new Error("Danh sách sân từ máy chủ không hợp lệ.");
      if (data.some(court => !Object.hasOwn(court, "image_url"))) {
        throw new Error("Backend đang chạy bản chưa hỗ trợ ảnh sân. Mở trang qua backend đã cập nhật.");
      }
      const selectedCourt = pricingCourt.value;
      pricingCourt.replaceChildren(...data.map((court) => new Option(court.name, court.id)));
      if (data.some((court) => String(court.id) === selectedCourt)) pricingCourt.value = selectedCourt;
      pricingCourt.disabled = !data.length;
      renderPricing();
      let count = 0;
      grid.innerHTML = data
        .map((court) => {
          const name = court.name || court.court_name || "Sân " + court.id;
          const status = String(court.status || "").toLowerCase();
          const active = ["active", "hoạt động"].includes(status);
          if (active) count += 1;
          const photo = photos.resolve(court.image_url);
          return `<article class="rk-court-card"><div class="rk-court-photo"><img alt="${h(name)}" width="600" height="280" loading="lazy" ${photo ? `src="${h(photo)}"` : "hidden"}><div class="rk-court-photo-placeholder" ${photo ? "hidden" : ""}>Chưa có ảnh</div><span class="rk-badge ${active ? "rk-available" : "rk-maintenance"}"><span class="rk-dot"></span>${active ? "Đang hoạt động" : status === "inactive" ? "Ngưng hoạt động" : "Bảo trì"}</span></div><div class="rk-court-info"><h3>${h(name)}</h3><p>${h(court.description || "Sân cầu lông trong nhà · Ánh sáng tiêu chuẩn")}</p><div class="rk-court-bottom"><span class="rk-price-label">Giá theo khung giờ</span>${active ? `<a class="rk-book-link" href="${h(config.bookingURL)}" data-require-auth>Đặt sân ${icon("arrow", 15)}</a>` : '<button type="button" class="rk-muted-link" disabled>Sắp mở lại</button>'}</div></div></article>`;
        })
        .join("");
      summary.textContent = `${data.length} sân · ${count} đang hoạt động`;
      summary.hidden = false;
      note.innerHTML = data.length
        ? "<p>Trạng thái hoạt động lấy từ hệ thống. Kiểm tra lịch trống và giá theo khung giờ trước khi đặt.</p>"
        : "<p>Chưa có sân nào trong hệ thống. Vui lòng liên hệ lễ tân hoặc quay lại sau.</p>";
    } catch (error) {
      if (controller.signal.aborted || global.axios.isCancel(error)) return;
      note.innerHTML = `<p role="status">${h(message(error))}</p><button type="button" id="rk-retry-courts" class="rk-link">Thử lại ${icon("arrow", 15)}</button>`;
      document
        .getElementById("rk-retry-courts")
        .addEventListener("click", load, {
          once: true,
          signal: controller.signal,
        });
    } finally {
      pending = false;
      if (!controller.signal.aborted) grid.setAttribute("aria-busy", "false");
    }
  }
  const unsubscribe = global.RK_AUTH.subscribe((session) => {
    global.RK_LAYOUT.guest(session);
    if (session.status === "error")
      global.RK_UI.sessionError(sessionBox, session.error);
    else sessionBox.hidden = true;
  });
  global.RK_LAYOUT.guest(global.RK_AUTH.getState());
  void global.RK_AUTH.restore();
  pricingCourt.addEventListener("change", renderPricing);
  void loadPricing();
  void load();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      void loadPricing();
      void load();
    }
  }, { signal: controller.signal });
  global.addEventListener("pageshow", (event) => {
    if (event.persisted) {
      void loadPricing();
      void load();
    }
  }, { signal: controller.signal });
  global.addEventListener("storage", (event) => {
    if (event.key === "rk:pricing-updated") void loadPricing();
  }, { signal: controller.signal });
  const pricingRefresh = global.setInterval(() => {
    if (document.visibilityState === "visible") void loadPricing();
  }, 30000);
  global.addEventListener(
    "pagehide",
    (event) => {
      if (event.persisted) return;
      global.clearInterval(pricingRefresh);
      controller.abort();
      unsubscribe();
    },
    { signal: controller.signal },
  );
})(window);