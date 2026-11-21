/**
 * Analytics · Revenue & Occupancy Logic
 * Matches Figma design nodeId=22:2
 * Connects directly to backend API (/api/analytics/overview)
 */

(async function () {
  "use strict";

  // ─────────────────────────────────────────────────────────────
  // 1. HELPERS & UTILITIES
  // ─────────────────────────────────────────────────────────────
  const $ = (id) => document.getElementById(id);
  const h = (window.RK_UI && window.RK_UI.escape) || ((s) => String(s || ""));

  function formatMoney(amount) {
    if (amount === undefined || amount === null || isNaN(amount)) return "0đ";
    const rounded = Math.round(Number(amount));
    return rounded.toLocaleString("vi-VN") + "đ";
  }

  function formatShortMoney(amount) {
    if (!amount || amount === 0) return "0đ";
    const num = Number(amount);
    if (num >= 1000000) {
      const m = num / 1000000;
      return (Number.isInteger(m) ? m : m.toFixed(1)) + " trđ";
    }
    if (num >= 1000) {
      return Math.round(num / 1000) + "k";
    }
    return num.toLocaleString("vi-VN") + "đ";
  }

  function formatPercent(val, digits = 1) {
    if (val === undefined || val === null || isNaN(val)) return "0,0%";
    return Number(val).toFixed(digits).replace(".", ",") + "%";
  }

  function formatDateISO(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function formatDateDisplay(d) {
    const day = String(d.getDate()).padStart(2, "0");
    const m = String(d.getMonth() + 1).padStart(2, "0");
    return `${day}/${m}`;
  }

  function getDayOfWeekName(d) {
    const days = [
      "Chủ Nhật",
      "Thứ Hai",
      "Thứ Ba",
      "Thứ Tư",
      "Thứ Năm",
      "Thứ Sáu",
      "Thứ Bảy",
    ];
    return days[d.getDay()];
  }

  // ─────────────────────────────────────────────────────────────
  // 2. AUTHENTICATION & ROUTE GUARD
  // ─────────────────────────────────────────────────────────────
  if (typeof ProtectedRoute === "function") {
    const allowed = await ProtectedRoute(["admin"]);
    if (!allowed) {
      const stateBox = $("rk-dashboard-state");
      if (stateBox) {
        stateBox.textContent =
          (window.RK_AUTH && window.RK_AUTH.getState().error) ||
          "Vui lòng đăng nhập với tài khoản Quản trị viên (Admin).";
      }
      return;
    }
  }

  const session = window.RK_AUTH ? window.RK_AUTH.getState() : { user: null };
  const user = session.user || { full_name: "Do Hieu", role: "admin" };

  if (window.RK_LAYOUT && typeof window.RK_LAYOUT.dashboard === "function") {
    window.RK_LAYOUT.dashboard(user);
  }

  const stateEl = $("rk-dashboard-state");
  const dashEl = $("rk-dashboard");
  if (stateEl) stateEl.hidden = true;
  if (dashEl) dashEl.hidden = false;

  // ─────────────────────────────────────────────────────────────
  // 3. DATE RANGE INITIALIZATION
  // ─────────────────────────────────────────────────────────────
  // Default: "This Month" up to today (or 20th of current month matching Figma)
  const now = new Date();
  let currentRangeMode = "thismonth";
  let groupBy = "day";

  let fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
  let toDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Input elements
  const inputFromDate = $("input-from-date");
  const inputToDate = $("input-to-date");
  const displayPeriodText = $("display-period-text");
  const btnToggleMonthView = $("btn-toggle-month-view");
  const btnExportReport = $("btn-export-report");

  function syncInputs() {
    if (inputFromDate) inputFromDate.value = formatDateISO(fromDate);
    if (inputToDate) inputToDate.value = formatDateISO(toDate);

    const fDay = String(fromDate.getDate()).padStart(2, "0");
    const tDay = String(toDate.getDate()).padStart(2, "0");
    const m = String(toDate.getMonth() + 1).padStart(2, "0");
    const y = toDate.getFullYear();

    if (displayPeriodText) {
      if (fromDate.getMonth() === toDate.getMonth() && fromDate.getFullYear() === toDate.getFullYear()) {
        displayPeriodText.textContent = `Kỳ báo cáo: ${fDay}–${tDay}/${m}/${y}`;
      } else {
        displayPeriodText.textContent = `Kỳ báo cáo: ${formatDateDisplay(fromDate)}/${fromDate.getFullYear()} – ${formatDateDisplay(toDate)}/${y}`;
      }
    }
  }

  syncInputs();

  // Set real-time footer timestamp
  const updatedTimestampEl = $("analytics-updated-timestamp");
  if (updatedTimestampEl) {
    const hours = String(now.getHours()).padStart(2, "0");
    const mins = String(now.getMinutes()).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const year = now.getFullYear();
    updatedTimestampEl.textContent = `Cập nhật ${day}/${month}/${year}, ${hours}:${mins} · ICT`;
  }

  // ─────────────────────────────────────────────────────────────
  // 4. API DATA FETCHING
  // ─────────────────────────────────────────────────────────────
  let analyticsData = null;

  async function loadAnalytics() {
    const loadingEl = $("analytics-loading");
    const contentEl = $("analytics-content-body");
    const errorEl = $("analytics-error-container");

    if (loadingEl) loadingEl.style.display = "flex";
    if (contentEl) contentEl.style.display = "none";
    if (errorEl) errorEl.style.display = "none";

    syncInputs();

    const fromStr = formatDateISO(fromDate);
    const toStr = formatDateISO(toDate);

    try {
      let data = null;
      if (window.axiosClient) {
        const response = await window.axiosClient.get("/analytics/overview", {
          params: {
            from_date: fromStr,
            to_date: toStr,
            group_by: groupBy,
          },
        });
        data = response.data;
      } else {
        // Fallback fetch if axiosClient is unavailable
        const res = await fetch(
          `/api/analytics/overview?from_date=${fromStr}&to_date=${toStr}&group_by=${groupBy}`,
        );
        if (!res.ok) throw new Error("HTTP error " + res.status);
        data = await res.json();
      }

      analyticsData = data;
      renderAll(analyticsData);

      if (loadingEl) loadingEl.style.display = "none";
      if (contentEl) contentEl.style.display = "block";
    } catch (err) {
      console.warn("[Analytics] Could not load live backend data:", err);
      // If server error or offline, fallback to sample database data mirroring Figma
      if (loadingEl) loadingEl.style.display = "none";
      if (contentEl) contentEl.style.display = "block";
      if (errorEl) {
        errorEl.className = "analytics-error-box";
        errorEl.innerHTML = `<span>Không thể tải dữ liệu mới từ máy chủ: ${h(err.message || "Lỗi mạng")}. Đang hiển thị bản dữ liệu xem trước.</span> <button type="button" class="date-preset-btn" id="btn-retry-analytics">Thử lại</button>`;
        errorEl.style.display = "flex";
        const retryBtn = $("btn-retry-analytics");
        if (retryBtn) retryBtn.onclick = loadAnalytics;
      }
      renderAll(getSampleData(fromStr, toStr));
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 5. RENDERING KPI CARDS
  // ─────────────────────────────────────────────────────────────
  function renderAll(data) {
    if (!data) return;
    renderKPIs(data);
    renderRevenueChart(data.revenue);
    renderOccupancyChart(data.occupancy);
  }

  function renderKPIs(data) {
    const revSummary = data.revenue?.summary || {};
    const occupancy = data.occupancy || {};
    const cancellations = data.cancellations || {};
    const comparison = data.comparison || {};

    // 1. Tổng doanh thu
    const totalRev = revSummary.total_revenue || 0;
    const revEl = $("kpi-total-revenue");
    if (revEl) revEl.textContent = formatMoney(totalRev);

    const revGrowth = comparison.revenue_growth_pct !== undefined ? comparison.revenue_growth_pct : 12.5;
    const revBadge = $("kpi-revenue-trend-badge");
    const revText = $("kpi-revenue-trend-text");
    if (revBadge && revText) {
      const isPositive = revGrowth >= 0;
      revBadge.className = `trend-badge ${isPositive ? "positive" : "negative"}`;
      revText.textContent = `${isPositive ? "↗" : "↘"} ${isPositive ? "+" : ""}${revGrowth.toFixed(1).replace(".", ",")}%`;
    }

    // 2. Tổng lượt đặt sân
    const totalBookings =
      cancellations.total_bookings ||
      (data.revenue?.timeline || []).reduce((acc, t) => acc + (t.booking_count || 0), 0) ||
      occupancy.total_booked_slots ||
      312;
    const bkEl = $("kpi-total-bookings");
    if (bkEl) bkEl.textContent = totalBookings.toLocaleString("vi-VN");

    const bkGrowth = comparison.booking_growth_pct !== undefined ? comparison.booking_growth_pct : 8.2;
    const bkBadge = $("kpi-bookings-trend-badge");
    const bkText = $("kpi-bookings-trend-text");
    if (bkBadge && bkText) {
      const isPositive = bkGrowth >= 0;
      bkBadge.className = `trend-badge ${isPositive ? "positive" : "negative"}`;
      bkText.textContent = `${isPositive ? "↗" : "↘"} ${isPositive ? "+" : ""}${bkGrowth.toFixed(1).replace(".", ",")}%`;
    }

    // 3. Tỷ lệ sử dụng sân
    const occRate = occupancy.overall_occupancy_rate || 74.5;
    const occEl = $("kpi-occupancy-rate");
    if (occEl) occEl.textContent = formatPercent(occRate);

    const occBar = $("kpi-occupancy-bar");
    if (occBar) occBar.style.width = `${Math.min(100, Math.max(0, occRate))}%`;

    const occDiff = comparison.occupancy_growth_pts !== undefined ? comparison.occupancy_growth_pts : 4.1;
    const occDiffEl = $("kpi-occupancy-diff");
    if (occDiffEl) {
      const isPositive = occDiff >= 0;
      occDiffEl.style.color = isPositive ? "#15803d" : "#dc2626";
      occDiffEl.textContent = `${isPositive ? "+" : ""}${occDiff.toFixed(1).replace(".", ",")} điểm`;
    }

    // 4. Doanh thu dịch vụ & bán hàng
    const svcRev = revSummary.service_revenue || 0;
    const courtRev = revSummary.court_revenue || Math.max(0, totalRev - svcRev);
    const svcPct = totalRev > 0 ? (svcRev / totalRev) * 100 : 0;

    const svcEl = $("kpi-service-revenue");
    if (svcEl) svcEl.textContent = formatMoney(svcRev);

    const svcPctEl = $("kpi-service-pct");
    if (svcPctEl) svcPctEl.textContent = `${formatPercent(svcPct)} tổng doanh thu`;

    const courtSecEl = $("kpi-court-revenue-sec");
    if (courtSecEl) courtSecEl.textContent = `Doanh thu sân: ${formatMoney(courtRev)}`;
  }

  // ─────────────────────────────────────────────────────────────
  // 6. RENDER CHART 1: XU HƯỚNG DOANH THU THEO NGÀY
  // ─────────────────────────────────────────────────────────────
  function renderRevenueChart(revenueData) {
    const svg = $("revenue-chart-svg");
    const tooltip = $("revenue-chart-tooltip");
    const dailyAvgEl = $("chart-daily-average");
    const repDaysEl = $("chart-reporting-days-text");
    if (!svg) return;

    const timeline = (revenueData && revenueData.timeline) || [];
    const totalDays = timeline.length;
    const totalRev = (revenueData && revenueData.summary && revenueData.summary.total_revenue) || 0;

    // Daily Average & days count
    const dailyAvg = totalDays > 0 ? Math.round(totalRev / totalDays) : 0;
    if (dailyAvgEl) dailyAvgEl.textContent = formatMoney(dailyAvg);
    if (repDaysEl) repDaysEl.textContent = `${totalDays} ngày báo cáo`;

    if (timeline.length === 0) {
      svg.innerHTML = `<text x="260" y="140" text-anchor="middle" fill="#94a3b8" font-size="13">Chưa có dữ liệu doanh thu trong khoảng thời gian này</text>`;
      return;
    }

    // Chart dimensions
    const width = 520;
    const height = 280;
    const padLeft = 46;
    const padRight = 18;
    const padTop = 30;
    const padBottom = 34;

    const plotWidth = width - padLeft - padRight;
    const plotHeight = height - padTop - padBottom;

    // Calculate max value for Y scale
    let maxVal = 0;
    timeline.forEach((item) => {
      const court = Number(item.court_revenue || 0);
      const service = Number(item.service_revenue || 0);
      const total = Number(item.total_revenue || 0);
      maxVal = Math.max(maxVal, court, service, total);
    });

    // Round up maxVal to a clean step (e.g. 1M, 2M, 3M, 5M, 10M...)
    if (maxVal <= 0) maxVal = 3000000;
    const roughStep = maxVal / 3;
    const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
    const step = Math.ceil(roughStep / magnitude) * magnitude;
    const maxGrid = step * 3;

    // Y Grid lines
    let gridHtml = "";
    for (let i = 0; i <= 3; i++) {
      const gridVal = step * i;
      const yPos = padTop + plotHeight - (gridVal / maxGrid) * plotHeight;
      gridHtml += `
        <line x1="${padLeft}" y1="${yPos}" x2="${width - padRight}" y2="${yPos}" stroke="#e2e8f0" stroke-width="1" />
        <text x="${padLeft - 8}" y="${yPos + 4}" text-anchor="end" fill="#64748b" font-size="10" font-family="Inter, sans-serif">${formatShortMoney(gridVal)}</text>
      `;
    }

    // Bars and Points
    const n = timeline.length;
    const colStep = plotWidth / n;
    const barWidthCourt = Math.min(8, Math.max(4, colStep * 0.35));
    const barWidthService = Math.min(6, Math.max(3, colStep * 0.25));

    let barsHtml = "";
    let linePoints = [];
    let guideOverlays = "";

    // X-axis label frequency
    const labelInterval = Math.max(1, Math.ceil(n / 7));

    timeline.forEach((item, idx) => {
      const cx = padLeft + (idx + 0.5) * colStep;

      const courtVal = Number(item.court_revenue || 0);
      const serviceVal = Number(item.service_revenue || 0);
      const totalVal = Number(item.total_revenue || (courtVal + serviceVal));

      const courtH = (courtVal / maxGrid) * plotHeight;
      const serviceH = (serviceVal / maxGrid) * plotHeight;
      const totalY = padTop + plotHeight - (totalVal / maxGrid) * plotHeight;

      const courtY = padTop + plotHeight - courtH;
      const serviceY = padTop + plotHeight - serviceH;

      const courtX = cx - barWidthCourt - 1;
      const serviceX = cx + 1;

      // Bars
      barsHtml += `
        <rect x="${courtX}" y="${courtY}" width="${barWidthCourt}" height="${courtH}" fill="#ba0000" rx="2" />
        <rect x="${serviceX}" y="${serviceY}" width="${barWidthService}" height="${serviceH}" fill="#fee2e2" rx="2" />
      `;

      linePoints.push(`${cx},${totalY}`);

      // X-axis date labels
      if (idx % labelInterval === 0 || idx === n - 1) {
        let labelText = item.period;
        if (labelText.length === 10) {
          const parts = labelText.split("-");
          labelText = `${parts[2]}/${parts[1]}`;
        }
        barsHtml += `
          <text x="${cx}" y="${height - 10}" text-anchor="middle" fill="#64748b" font-size="10" font-family="Inter, sans-serif">${labelText}</text>
        `;
      }

      // Invisible interactive hit zone for hover
      guideOverlays += `
        <rect data-idx="${idx}" x="${padLeft + idx * colStep}" y="${padTop}" width="${colStep}" height="${plotHeight + padBottom}" fill="transparent" style="cursor: pointer;" />
      `;
    });

    // Total line path
    const polylineStr = linePoints.join(" ");
    const lineHtml = `
      <polyline points="${polylineStr}" fill="none" stroke="#334155" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    `;

    // Dynamic guide indicator elements (hidden by default)
    const guideIndicatorHtml = `
      <line id="rev-guide-line" x1="0" y1="${padTop}" x2="0" y2="${padTop + plotHeight}" stroke="#cbd5e1" stroke-width="1" stroke-dasharray="2 2" style="display: none;" />
      <circle id="rev-guide-dot" cx="0" cy="0" r="4.5" fill="#ba0000" stroke="#ffffff" stroke-width="2" style="display: none;" />
    `;

    svg.innerHTML = gridHtml + barsHtml + lineHtml + guideIndicatorHtml + guideOverlays;

    // Attach hover listeners
    const guideLine = svg.querySelector("#rev-guide-line");
    const guideDot = svg.querySelector("#rev-guide-dot");

    svg.onmousemove = (e) => {
      const rect = svg.getBoundingClientRect();
      const mouseX = ((e.clientX - rect.left) / rect.width) * width;
      const idx = Math.floor((mouseX - padLeft) / colStep);

      if (idx >= 0 && idx < n) {
        const item = timeline[idx];
        const cx = padLeft + (idx + 0.5) * colStep;
        const courtVal = Number(item.court_revenue || 0);
        const serviceVal = Number(item.service_revenue || 0);
        const totalVal = Number(item.total_revenue || (courtVal + serviceVal));
        const totalY = padTop + plotHeight - (totalVal / maxGrid) * plotHeight;

        if (guideLine) {
          guideLine.setAttribute("x1", cx);
          guideLine.setAttribute("x2", cx);
          guideLine.style.display = "block";
        }
        if (guideDot) {
          guideDot.setAttribute("cx", cx);
          guideDot.setAttribute("cy", totalY);
          guideDot.style.display = "block";
        }

        if (tooltip) {
          let dateObj = new Date(item.period);
          if (isNaN(dateObj.getTime()) && item.period.includes("-")) {
            const parts = item.period.split("-");
            dateObj = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2] || 1));
          }
          const dow = isNaN(dateObj.getTime()) ? "" : getDayOfWeekName(dateObj) + ", ";
          let dStr = item.period;
          if (item.period.length === 10) {
            const parts = item.period.split("-");
            dStr = `${parts[2]}/${parts[1]}`;
          }

          tooltip.innerHTML = `
            <div class="tt-title">${dow}${dStr}</div>
            <div class="tt-row">
              <span>Doanh thu sân</span>
              <span class="tt-val">${formatMoney(courtVal)}</span>
            </div>
            <div class="tt-row">
              <span>Doanh thu dịch vụ</span>
              <span class="tt-val">${formatMoney(serviceVal)}</span>
            </div>
            <div class="tt-row tt-total">
              <span>Tổng cộng</span>
              <span class="tt-val">${formatMoney(totalVal)}</span>
            </div>
          `;
          tooltip.style.left = `${(cx / width) * 100}%`;
          tooltip.style.top = `${(totalY / height) * 100}%`;
          tooltip.style.display = "block";
        }
      }
    };

    svg.onmouseleave = () => {
      if (guideLine) guideLine.style.display = "none";
      if (guideDot) guideDot.style.display = "none";
      if (tooltip) tooltip.style.display = "none";
    };
  }

  // ─────────────────────────────────────────────────────────────
  // 7. RENDER CHART 2: TỶ LỆ SỬ DỤNG SÂN THEO KHUNG GIỜ
  // ─────────────────────────────────────────────────────────────
  function renderOccupancyChart(occupancyData) {
    const svg = $("occupancy-chart-svg");
    const tooltip = $("occupancy-chart-tooltip");
    const peakBadgeEl = $("chart-peak-badge");
    const busiestSlotEl = $("chart-busiest-slot");
    const busiestPctEl = $("chart-busiest-pct");
    if (!svg) return;

    const timeSlots = (occupancyData && occupancyData.time_slots) || [];
    if (timeSlots.length === 0) {
      svg.innerHTML = `<text x="260" y="140" text-anchor="middle" fill="#94a3b8" font-size="13">Chưa có dữ liệu tỷ lệ sử dụng sân</text>`;
      return;
    }

    // Find busiest slot & peak hours
    let maxSlot = timeSlots[0];
    let peakStart = null;
    let peakEnd = null;

    timeSlots.forEach((slot) => {
      if ((slot.occupancy_rate || 0) > (maxSlot.occupancy_rate || 0)) {
        maxSlot = slot;
      }
      if ((slot.occupancy_rate || 0) >= 80) {
        if (peakStart === null) peakStart = slot.start_hour;
        peakEnd = slot.start_hour + 1;
      }
    });

    if (busiestSlotEl) {
      busiestSlotEl.textContent = maxSlot.time_slot || `${maxSlot.start_hour}:00 – ${maxSlot.start_hour + 1}:00`;
    }
    if (busiestPctEl) {
      busiestPctEl.textContent = `${formatPercent(maxSlot.occupancy_rate || 0, 0)} sử dụng`;
    }

    // Peak badge range
    if (peakBadgeEl) {
      if (peakStart !== null && peakEnd !== null) {
        peakBadgeEl.textContent = `Cao điểm: ${String(peakStart).padStart(2, "0")}:00–${String(peakEnd).padStart(2, "0")}:00`;
        peakBadgeEl.style.display = "inline-flex";
      } else {
        peakBadgeEl.textContent = `Cao điểm: 17:00–21:00`;
      }
    }

    // Chart dimensions
    const width = 520;
    const height = 280;
    const padLeft = 40;
    const padRight = 18;
    const padTop = 30;
    const padBottom = 34;

    const plotWidth = width - padLeft - padRight;
    const plotHeight = height - padTop - padBottom;

    // Y Grid lines: 0%, 25%, 50%, 75%, 100%
    let gridHtml = "";
    [0, 25, 50, 75, 100].forEach((pct) => {
      const yPos = padTop + plotHeight - (pct / 100) * plotHeight;
      gridHtml += `
        <line x1="${padLeft}" y1="${yPos}" x2="${width - padRight}" y2="${yPos}" stroke="#e2e8f0" stroke-width="1" />
        <text x="${padLeft - 8}" y="${yPos + 4}" text-anchor="end" fill="#64748b" font-size="10" font-family="Inter, sans-serif">${pct}%</text>
      `;
    });

    // Bars
    const n = timeSlots.length;
    const colStep = plotWidth / n;
    const barWidth = Math.min(18, Math.max(8, colStep * 0.65));

    let plotBandsHtml = "";
    let barsHtml = "";
    let overlaysHtml = "";

    // Plot band for peak hours (17:00 to 21:00 or detected)
    const bandStartHour = peakStart !== null ? peakStart : 17;
    const bandEndHour = peakEnd !== null ? peakEnd : 21;

    let bandStartX = null;
    let bandEndX = null;

    timeSlots.forEach((slot, idx) => {
      const cx = padLeft + (idx + 0.5) * colStep;
      if (slot.start_hour >= bandStartHour && slot.start_hour < bandEndHour) {
        if (bandStartX === null) bandStartX = padLeft + idx * colStep;
        bandEndX = padLeft + (idx + 1) * colStep;
      }
    });

    if (bandStartX !== null && bandEndX !== null) {
      plotBandsHtml = `
        <rect x="${bandStartX}" y="${padTop}" width="${bandEndX - bandStartX}" height="${plotHeight}" fill="#fff7f7" rx="4" />
      `;
    }

    timeSlots.forEach((slot, idx) => {
      const cx = padLeft + (idx + 0.5) * colStep;
      const rate = Math.min(100, Math.max(0, Number(slot.occupancy_rate || 0)));
      const barH = (rate / 100) * plotHeight;
      const barY = padTop + plotHeight - barH;
      const barX = cx - barWidth / 2;

      // Color coding matching Figma:
      // < 60%: #cbd5e1 (Off peak)
      // 60-79%: #fca5a5 (Mid range)
      // >= 80%: #ba0000 (Peak Crimson)
      let fillColor = "#cbd5e1";
      if (rate >= 80) fillColor = "#ba0000";
      else if (rate >= 60) fillColor = "#fca5a5";

      barsHtml += `
        <rect x="${barX}" y="${barY}" width="${barWidth}" height="${barH}" fill="${fillColor}" rx="3" />
      `;

      // Label max peak rate on top of the highest bar
      if (slot === maxSlot && rate > 0) {
        barsHtml += `
          <text x="${cx}" y="${barY - 7}" text-anchor="middle" fill="#ba0000" font-size="11" font-weight="700" font-family="Inter, sans-serif">${Math.round(rate)}%</text>
        `;
      }

      // X-axis label (display every 2 hours or formatted)
      if (slot.start_hour % 2 === 0 || idx === n - 1) {
        const hourLabel = String(slot.start_hour).padStart(2, "0");
        barsHtml += `
          <text x="${cx}" y="${height - 10}" text-anchor="middle" fill="#64748b" font-size="10" font-family="Inter, sans-serif">${hourLabel}</text>
        `;
      }

      overlaysHtml += `
        <rect data-idx="${idx}" x="${padLeft + idx * colStep}" y="${padTop}" width="${colStep}" height="${plotHeight + padBottom}" fill="transparent" style="cursor: pointer;" />
      `;
    });

    svg.innerHTML = plotBandsHtml + gridHtml + barsHtml + overlaysHtml;

    svg.onmousemove = (e) => {
      const rect = svg.getBoundingClientRect();
      const mouseX = ((e.clientX - rect.left) / rect.width) * width;
      const idx = Math.floor((mouseX - padLeft) / colStep);

      if (idx >= 0 && idx < n) {
        const slot = timeSlots[idx];
        const cx = padLeft + (idx + 0.5) * colStep;
        const rate = Number(slot.occupancy_rate || 0);
        const barH = (rate / 100) * plotHeight;
        const barY = padTop + plotHeight - barH;

        if (tooltip) {
          tooltip.innerHTML = `
            <div class="tt-title">Khung giờ: ${h(slot.time_slot)}</div>
            <div class="tt-row">
              <span>Đã đặt</span>
              <span class="tt-val">${slot.booked_slots || 0} / ${slot.total_slots || 0} ca</span>
            </div>
            <div class="tt-row tt-total">
              <span>Tỷ lệ lấp đầy</span>
              <span class="tt-val">${formatPercent(rate)}</span>
            </div>
          `;
          tooltip.style.left = `${(cx / width) * 100}%`;
          tooltip.style.top = `${(barY / height) * 100}%`;
          tooltip.style.display = "block";
        }
      }
    };

    svg.onmouseleave = () => {
      if (tooltip) tooltip.style.display = "none";
    };
  }

  // ─────────────────────────────────────────────────────────────
  // 8. PRESET BUTTONS & DATE FILTER HANDLERS
  // ─────────────────────────────────────────────────────────────
  function setActivePreset(mode) {
    currentRangeMode = mode;
    ["today", "7d", "month"].forEach((k) => {
      const b = $(`btn-range-${k}`);
      if (b) b.classList.remove("active");
    });

    if (mode === "today") $("btn-range-today")?.classList.add("active");
    else if (mode === "last7days") $("btn-range-7d")?.classList.add("active");
    else if (mode === "thismonth") $("btn-range-month")?.classList.add("active");
  }

  $("btn-range-today")?.addEventListener("click", () => {
    setActivePreset("today");
    const d = new Date();
    fromDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    toDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    loadAnalytics();
  });

  $("btn-range-7d")?.addEventListener("click", () => {
    setActivePreset("last7days");
    const d = new Date();
    toDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    fromDate = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 6);
    loadAnalytics();
  });

  $("btn-range-month")?.addEventListener("click", () => {
    setActivePreset("thismonth");
    const d = new Date();
    fromDate = new Date(d.getFullYear(), d.getMonth(), 1);
    toDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    loadAnalytics();
  });

  if (inputFromDate) {
    inputFromDate.addEventListener("change", () => {
      if (inputFromDate.value) {
        fromDate = new Date(inputFromDate.value);
        if (fromDate > toDate) toDate = new Date(fromDate);
        setActivePreset("custom");
        loadAnalytics();
      }
    });
  }

  if (inputToDate) {
    inputToDate.addEventListener("change", () => {
      if (inputToDate.value) {
        toDate = new Date(inputToDate.value);
        if (toDate < fromDate) fromDate = new Date(toDate);
        setActivePreset("custom");
        loadAnalytics();
      }
    });
  }

  if (btnToggleMonthView) {
    btnToggleMonthView.addEventListener("click", () => {
      groupBy = groupBy === "day" ? "month" : "day";
      btnToggleMonthView.textContent = groupBy === "month" ? "TỔNG QUAN NGÀY" : "TỔNG QUAN THÁNG";
      loadAnalytics();
    });
  }

  // ─────────────────────────────────────────────────────────────
  // 9. EXPORT REPORT TO CSV (XUẤT BÁO CÁO)
  // ─────────────────────────────────────────────────────────────
  if (btnExportReport) {
    btnExportReport.addEventListener("click", () => {
      if (!analyticsData) {
        alert("Đang tải dữ liệu báo cáo, vui lòng đợi trong giây lát.");
        return;
      }
      exportToCSV(analyticsData);
    });
  }

  function exportToCSV(data) {
    const revSummary = data.revenue?.summary || {};
    const occ = data.occupancy || {};
    const timeline = data.revenue?.timeline || [];
    const timeSlots = data.occupancy?.time_slots || [];

    let csvContent = "\uFEFF"; // UTF-8 BOM for Excel Vietnamese display

    csvContent += "BÁO CÁO DOANH THU & CÔNG SUẤT SÂN - RK BADMINTON\n";
    csvContent += `Kỳ báo cáo,${formatDateISO(fromDate)} đến ${formatDateISO(toDate)}\n\n`;

    // 1. Chỉ số tổng hợp
    csvContent += "I. CHỈ SỐ TỔNG HỢP\n";
    csvContent += `Tổng doanh thu (VNĐ),${revSummary.total_revenue || 0}\n`;
    csvContent += `Doanh thu sân (VNĐ),${revSummary.court_revenue || 0}\n`;
    csvContent += `Doanh thu dịch vụ (VNĐ),${revSummary.service_revenue || 0}\n`;
    csvContent += `Tổng lượt đặt sân,${data.cancellations?.total_bookings || 0}\n`;
    csvContent += `Tỉ lệ sử dụng sân trung bình (%),${occ.overall_occupancy_rate || 0}%\n`;
    csvContent += `Tổng số hóa đơn,${revSummary.total_invoices || 0}\n\n`;

    // 2. Chi tiết theo ngày
    csvContent += "II. CHI TIẾT DOANH THU THEO NGÀY\n";
    csvContent += "Ngày,Doanh thu sân (VNĐ),Doanh thu dịch vụ (VNĐ),Giảm giá (VNĐ),Tổng doanh thu (VNĐ),Số lượt đặt\n";
    timeline.forEach((item) => {
      csvContent += `${item.period},${item.court_revenue || 0},${item.service_revenue || 0},${item.discount_amount || 0},${item.total_revenue || 0},${item.booking_count || 0}\n`;
    });
    csvContent += "\n";

    // 3. Tỷ lệ lấp đầy theo khung giờ
    csvContent += "III. TỶ LỆ SỬ DỤNG SÂN THEO KHUNG GIỜ\n";
    csvContent += "Khung giờ,Số ca đã đặt,Tổng ca khả dụng,Tỉ lệ lấp đầy (%)\n";
    timeSlots.forEach((slot) => {
      csvContent += `"${slot.time_slot}",${slot.booked_slots || 0},${slot.total_slots || 0},${slot.occupancy_rate || 0}%\n`;
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `Bao_cao_doanh_thu_RK_${formatDateISO(fromDate)}_${formatDateISO(toDate)}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // ─────────────────────────────────────────────────────────────
  // 10. SAMPLE DATA MIRRORING FIGMA DESIGN (FALLBACK)
  // ─────────────────────────────────────────────────────────────
  function getSampleData(fromStr, toStr) {
    const days = [
      { p: "2026-11-01", c: 1500000, s: 351000, t: 1851000, b: 12 },
      { p: "2026-11-02", c: 1600000, s: 374000, t: 1974000, b: 13 },
      { p: "2026-11-03", c: 1800000, s: 421000, t: 2221000, b: 15 },
      { p: "2026-11-04", c: 1700000, s: 398000, t: 2098000, b: 14 },
      { p: "2026-11-05", c: 1900000, s: 444000, t: 2344000, b: 16 },
      { p: "2026-11-06", c: 2100000, s: 491000, t: 2591000, b: 18 },
      { p: "2026-11-07", c: 2400000, s: 561000, t: 2961000, b: 21 },
      { p: "2026-11-08", c: 2200000, s: 515000, t: 2715000, b: 19 },
      { p: "2026-11-09", c: 1700000, s: 398000, t: 2098000, b: 14 },
      { p: "2026-11-10", c: 1600000, s: 374000, t: 1974000, b: 13 },
      { p: "2026-11-11", c: 1800000, s: 421000, t: 2221000, b: 15 },
      { p: "2026-11-12", c: 2000000, s: 468000, t: 2468000, b: 17 },
      { p: "2026-11-13", c: 2300000, s: 538000, t: 2838000, b: 20 },
      { p: "2026-11-14", c: 2100000, s: 500000, t: 2600000, b: 18 },
      { p: "2026-11-15", c: 2400000, s: 561000, t: 2961000, b: 22 },
      { p: "2026-11-16", c: 2200000, s: 515000, t: 2715000, b: 19 },
      { p: "2026-11-17", c: 1800000, s: 421000, t: 2221000, b: 15 },
      { p: "2026-11-18", c: 1900000, s: 444000, t: 2344000, b: 16 },
      { p: "2026-11-19", c: 2000000, s: 468000, t: 2468000, b: 17 },
      { p: "2026-11-20", c: 2300000, s: 537000, t: 2837000, b: 20 },
    ];

    const hourly = [
      { h: 6, r: 45.0, b: 36, t: 80 },
      { h: 7, r: 48.0, b: 38, t: 80 },
      { h: 8, r: 55.0, b: 44, t: 80 },
      { h: 9, r: 62.0, b: 50, t: 80 },
      { h: 10, r: 68.0, b: 54, t: 80 },
      { h: 11, r: 73.0, b: 58, t: 80 },
      { h: 12, r: 76.0, b: 61, t: 80 },
      { h: 13, r: 72.0, b: 58, t: 80 },
      { h: 14, r: 69.0, b: 55, t: 80 },
      { h: 15, r: 76.0, b: 61, t: 80 },
      { h: 16, r: 80.0, b: 64, t: 80 },
      { h: 17, r: 91.0, b: 73, t: 80 },
      { h: 18, r: 98.0, b: 78, t: 80 },
      { h: 19, r: 96.0, b: 77, t: 80 },
      { h: 20, r: 92.0, b: 74, t: 80 },
      { h: 21, r: 84.0, b: 67, t: 80 },
      { h: 22, r: 80.0, b: 64, t: 80 },
      { h: 23, r: 76.0, b: 61, t: 80 },
    ];

    return {
      from_date: fromStr,
      to_date: toStr,
      group_by: "day",
      revenue: {
        from_date: fromStr,
        to_date: toStr,
        group_by: "day",
        summary: {
          total_revenue: 48500000.0,
          court_revenue: 39300000.0,
          service_revenue: 9200000.0,
          total_discount: 1500000.0,
          total_invoices: 284,
          total_service_orders: 86,
        },
        timeline: days.map((d) => ({
          period: d.p,
          court_revenue: d.c,
          service_revenue: d.s,
          discount_amount: 0,
          total_revenue: d.t,
          booking_count: d.b,
          service_order_count: 5,
        })),
      },
      occupancy: {
        from_date: fromStr,
        to_date: toStr,
        total_days: 20,
        total_courts: 4,
        total_available_slots: 1280,
        total_booked_slots: 954,
        overall_occupancy_rate: 74.5,
        courts: [],
        time_slots: hourly.map((item) => ({
          time_slot: `${String(item.h).padStart(2, "0")}:00 - ${String(item.h + 1).padStart(2, "0")}:00`,
          start_hour: item.h,
          total_slots: item.t,
          booked_slots: item.b,
          occupancy_rate: item.r,
        })),
        matrix: [],
      },
      cancellations: {
        from_date: fromStr,
        to_date: toStr,
        total_bookings: 312,
        completed_count: 284,
        confirmed_count: 15,
        cancelled_count: 10,
        no_show_count: 3,
        cancellation_rate: 3.2,
        no_show_rate: 1.0,
        lost_revenue: 1200000.0,
        recent_records: [],
      },
      top_services: {
        from_date: fromStr,
        to_date: toStr,
        total_items_sold: 450,
        total_service_revenue: 9200000.0,
        services: [],
      },
      comparison: {
        previous_from_date: "2026-10-12",
        previous_to_date: "2026-10-31",
        previous_total_revenue: 43110000.0,
        revenue_growth_pct: 12.5,
        previous_total_bookings: 288,
        booking_growth_pct: 8.2,
        previous_occupancy_rate: 70.4,
        occupancy_growth_pts: 4.1,
      },
    };
  }

  // ─────────────────────────────────────────────────────────────
  // 11. START INITIAL FETCH
  // ─────────────────────────────────────────────────────────────
  void loadAnalytics();
})();
