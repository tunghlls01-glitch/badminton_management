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
  const PRICING_STORAGE_KEY = "rk_pricing_rules_v1";
  const PRICING_SLOTS = [
    {
      label: "Buổi sáng",
      range: "06:00 - 12:00",
      start: "06:00",
      end: "12:00",
      fallbackWeekday: 180000,
      fallbackWeekend: 200000,
    },
    {
      label: "Buổi chiều",
      range: "12:00 - 17:00",
      start: "12:00",
      end: "17:00",
      fallbackWeekday: 180000,
      fallbackWeekend: 220000,
    },
    {
      label: "Buổi tối - Giờ cao điểm",
      range: "17:00 - 23:00",
      start: "17:00",
      end: "23:00",
      fallbackWeekday: 240000,
      fallbackWeekend: 280000,
    },
  ];
  const controller = new AbortController();
  let pending = false;

  function toMinutes(hhmm) {
    const [hours, minutes] = String(hhmm || "00:00").split(":").map(Number);
    return (hours || 0) * 60 + (minutes || 0);
  }

  function formatHourlyPrice(amount) {
    return `${h(Number(amount || 0).toLocaleString("vi-VN"))}đ <small>/ giờ</small>`;
  }

  function pickRuleForSlot(rules, dayType, startStr, endStr) {
    const slotStart = toMinutes(startStr);
    const slotEnd = toMinutes(endStr);
    const matches = rules.filter((rule) => {
      const sameDayType = rule.day_type === dayType || rule.day_type === "ALL";
      if (!sameDayType) return false;
      const ruleStart = toMinutes(rule.start_time);
      const ruleEnd = toMinutes(rule.end_time);
      return ruleStart < slotEnd && ruleEnd > slotStart;
    });

    if (!matches.length) return null;

    matches.sort((a, b) => {
      const exactDiff = (b.day_type === dayType ? 1 : 0) - (a.day_type === dayType ? 1 : 0);
      if (exactDiff !== 0) return exactDiff;
      return Number(b.price || 0) - Number(a.price || 0);
    });

    return matches[0];
  }

  function renderReferencePricing() {
    if (!pricingBody) return;
    let rules = [];
    try {
      const raw = global.localStorage.getItem(PRICING_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (Array.isArray(parsed) && parsed.length > 0) {
        rules = parsed.filter((rule) => (rule.status || "Active") === "Active");
      }
    } catch {
      rules = [];
    }

    if (!rules.length) return;

    pricingBody.innerHTML = PRICING_SLOTS.map((slot) => {
      const weekdayRule = pickRuleForSlot(rules, "WEEKDAY", slot.start, slot.end);
      const weekendRule = pickRuleForSlot(rules, "WEEKEND", slot.start, slot.end);
      const weekdayPrice = weekdayRule ? weekdayRule.price : slot.fallbackWeekday;
      const weekendPrice = weekendRule ? weekendRule.price : slot.fallbackWeekend;

      return `<tr><th scope="row"><span>${h(slot.label)}</span><small>${h(slot.range)}</small></th><td>${formatHourlyPrice(weekdayPrice)}</td><td>${formatHourlyPrice(weekendPrice)}</td></tr>`;
    }).join("");
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
  renderReferencePricing();
  void load();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      renderReferencePricing();
      void load();
    }
  }, { signal: controller.signal });
  global.addEventListener("pageshow", (event) => {
    renderReferencePricing();
    if (event.persisted) void load();
  }, { signal: controller.signal });
  global.addEventListener("storage", (event) => {
    if (event.key === PRICING_STORAGE_KEY) renderReferencePricing();
  }, { signal: controller.signal });
  global.addEventListener(
    "pagehide",
    (event) => {
      if (event.persisted) return;
      controller.abort();
      unsubscribe();
    },
    { signal: controller.signal },
  );
})(window);