document.addEventListener("DOMContentLoaded", () => {
  let pricingRules = [];

  const tableBody = document.getElementById("pricingTableBody");
  const overlapAlert = document.getElementById("overlapAlert");
  const drawerOverlay = document.getElementById("pricingDrawer");
  const btnOpenAddRule = document.getElementById("btnOpenAddRule");
  const btnCloseDrawer = document.getElementById("btnCloseDrawer");
  const btnCancelDrawer = document.getElementById("btnCancelDrawer");
  const pricingForm = document.getElementById("pricingForm");
  const drawerTitle = document.getElementById("drawerTitle");
  const ruleIdInput = document.getElementById("ruleId");
  const ruleNameInput = document.getElementById("ruleName");
  const dayTypeSelect = document.getElementById("dayType");
  const startTimeInput = document.getElementById("startTime");
  const endTimeInput = document.getElementById("endTime");
  const priceValueInput = document.getElementById("priceValue");
  const formErrorBox = document.getElementById("formErrorBox");

  // Preview elements
  const btnPreviewPrice = document.getElementById("btnPreviewPrice");
  const previewModal = document.getElementById("previewModal");
  const btnClosePreview = document.getElementById("btnClosePreview");
  const btnRunPreview = document.getElementById("btnRunPreview");
  const previewDateInput = document.getElementById("previewDate");
  const previewResult = document.getElementById("previewResult");

  function fetchPricingRules() {
    try {
      tableBody.innerHTML = `<tr><td colspan="5" class="pricing-state-cell">Đang tải quy tắc giá...</td></tr>`;
      
      pricingRules = [
        { id: 1, name: "Giờ vàng buổi sáng", day_type: "WEEKDAY", start_time: "06:00", end_time: "11:00", price: 120000, status: "Active" },
        { id: 2, name: "Giờ tiêu chuẩn trưa", day_type: "WEEKDAY", start_time: "11:00", end_time: "17:00", price: 90000, status: "Active" },
        { id: 3, name: "Giờ cao điểm tối", day_type: "WEEKDAY", start_time: "17:00", end_time: "22:00", price: 180000, status: "Active" },
        { id: 4, name: "Cuối tuần trọn gói", day_type: "WEEKEND", start_time: "06:00", end_time: "22:00", price: 150000, status: "Active" }
      ];

      checkTimeOverlaps();
      renderTable();
    } catch (err) {
      console.error("Lỗi tải bảng giá:", err);
      tableBody.innerHTML = `<tr><td colspan="5" class="pricing-state-cell" style="color: #b91c1c;">Không thể tải dữ liệu bảng giá.</td></tr>`;
    }
  }

  function checkTimeOverlaps() {
    let hasOverlap = false;
    for (let i = 0; i < pricingRules.length; i++) {
      for (let j = i + 1; j < pricingRules.length; j++) {
        const r1 = pricingRules[i];
        const r2 = pricingRules[j];

        if (r1.day_type === r2.day_type || r1.day_type === "ALL" || r2.day_type === "ALL") {
          if (r1.start_time < r2.end_time && r2.start_time < r1.end_time) {
            hasOverlap = true;
            break;
          }
        }
      }
      if (hasOverlap) break;
    }

    if (overlapAlert) {
      overlapAlert.style.display = hasOverlap ? "flex" : "none";
    }
  }

  function renderTable() {
    if (pricingRules.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="5" class="pricing-state-cell">Chưa có quy tắc giá nào được thiết lập.</td></tr>`;
      return;
    }

    tableBody.innerHTML = pricingRules.map(rule => {
      const dayLabel = rule.day_type === "WEEKDAY" ? "Ngày thường" : rule.day_type === "WEEKEND" ? "Cuối tuần" : "Tất cả các ngày";
      const formattedPrice = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(rule.price);

      return `
        <tr>
          <td>
            <strong style="color: #111827; font-size: 13.5px;">${rule.name}</strong>
            <div style="font-size: 12px; color: #6b7280; margin-top: 2px;">Khung giờ: ${rule.start_time} - ${rule.end_time}</div>
          </td>
          <td><span class="rk-badge rk-secondary">${dayLabel}</span></td>
          <td class="text-right" style="font-weight: 700; color: #b91c1c; font-size: 14px;">${formattedPrice}</td>
          <td>
            <span class="rk-badge is-active">
              <span style="width: 6px; height: 6px; border-radius: 50%; background: currentColor; display: inline-block; margin-right: 4px;"></span>Áp dụng
            </span>
          </td>
          <td class="text-right">
            <div style="display: flex; align-items: center; justify-content: flex-end; gap: 8px;">
              <button type="button" class="btn-pricing-action" onclick="window.editRule(${rule.id})">Sửa</button>
              <button type="button" class="btn-pricing-action to-delete" onclick="window.deleteRule(${rule.id})">Xóa</button>
            </div>
          </td>
        </tr>
      `;
    }).join("");
  }

  if (btnOpenAddRule) {
    btnOpenAddRule.addEventListener("click", () => {
      drawerTitle.textContent = "Thêm quy tắc giá mới";
      ruleIdInput.value = "";
      pricingForm.reset();
      formErrorBox.style.display = "none";
      drawerOverlay.classList.add("open");
    });
  }

  const closeDrawer = () => drawerOverlay.classList.remove("open");
  if (btnCloseDrawer) btnCloseDrawer.addEventListener("click", closeDrawer);
  if (btnCancelDrawer) btnCancelDrawer.addEventListener("click", closeDrawer);

  if (pricingForm) {
    pricingForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const sTime = startTimeInput.value;
      const eTime = endTimeInput.value;

      if (sTime >= eTime) {
        formErrorBox.textContent = "Thời gian kết thúc phải lớn hơn thời gian bắt đầu.";
        formErrorBox.style.display = "block";
        return;
      }

      const newRule = {
        id: ruleIdInput.value ? Number(ruleIdInput.value) : Date.now(),
        name: ruleNameInput.value.trim(),
        day_type: dayTypeSelect.value,
        start_time: sTime,
        end_time: eTime,
        price: Number(priceValueInput.value)
      };

      if (ruleIdInput.value) {
        const idx = pricingRules.findIndex(r => r.id === newRule.id);
        if (idx !== -1) pricingRules[idx] = newRule;
      } else {
        pricingRules.push(newRule);
      }

      closeDrawer();
      checkTimeOverlaps();
      renderTable();
    });
  }

  window.editRule = (id) => {
    const rule = pricingRules.find(r => r.id === id);
    if (!rule) return;

    drawerTitle.textContent = "Chỉnh sửa quy tắc giá";
    ruleIdInput.value = rule.id;
    ruleNameInput.value = rule.name;
    dayTypeSelect.value = rule.day_type;
    startTimeInput.value = rule.start_time;
    endTimeInput.value = rule.end_time;
    priceValueInput.value = rule.price;
    formErrorBox.style.display = "none";
    drawerOverlay.classList.add("open");
  };

  window.deleteRule = (id) => {
    if (confirm("Bạn có chắc chắn muốn xóa quy tắc giá này?")) {
      pricingRules = pricingRules.filter(r => r.id !== id);
      checkTimeOverlaps();
      renderTable();
    }
  };

  if (btnPreviewPrice) {
    btnPreviewPrice.addEventListener("click", () => {
      previewDateInput.value = new Date().toISOString().split('T')[0];
      previewResult.textContent = "Nhấn 'Kiểm tra ngay' để mô phỏng bảng giá cho ngày đã chọn.";
      previewModal.classList.add("open");
    });
  }

  if (btnClosePreview) {
    btnClosePreview.addEventListener("click", () => previewModal.classList.remove("open"));
  }

  if (btnRunPreview) {
    btnRunPreview.addEventListener("click", () => {
      const selectedDateStr = previewDateInput.value;
      if (!selectedDateStr) return;

      const dateObj = new Date(selectedDateStr);
      const dayOfWeek = dateObj.getDay(); 
      const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);

      const applicableRules = pricingRules.filter(r => {
        if (r.day_type === "ALL") return true;
        if (isWeekend && r.day_type === "WEEKEND") return true;
        if (!isWeekend && r.day_type === "WEEKDAY") return true;
        return false;
      });

      if (applicableRules.length === 0) {
        previewResult.innerHTML = `<strong>Ngày ${selectedDateStr} (${isWeekend ? 'Cuối tuần' : 'Ngày thường'}):</strong> Không có quy tắc giá nào áp dụng.`;
      } else {
        let html = `<strong>Ngày ${selectedDateStr} (${isWeekend ? 'Cuối tuần' : 'Ngày thường'}):</strong><ul style="margin: 6px 0 0 16px; padding: 0;">`;
        applicableRules.forEach(r => {
          const formattedPrice = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(r.price);
          html += `<li><b>${r.name}</b> (${r.start_time} - ${r.end_time}): <span style="color:#b91c1c; font-weight:bold;">${formattedPrice}/h</span></li>`;
        });
        html += `</ul>`;
        previewResult.innerHTML = html;
      }
    });
  }

  fetchPricingRules();
});