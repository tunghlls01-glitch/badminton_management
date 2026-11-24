document.addEventListener("DOMContentLoaded", async () => {
  const api = window.axiosClient;
  const { escape: h, message } = window.RK_UI;
  const saveButton = document.getElementById("btnSaveRule");
  let revision = 0;
  let saving = false;

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

  function loadTable(data) {
    revision = data.revision;
    pricingRules = data.rules.map((rule) => ({
      ...rule, start_time: rule.start_time.slice(0, 5), end_time: rule.end_time.slice(0, 5),
    }));
    checkTimeOverlaps();
    renderTable();
  }

  async function savePricingRules(rules) {
    if (saving) return false;
    saving = saveButton.disabled = true;
    try {
      const { data } = await api.put("/price-rules/public-table", { revision, rules });
      loadTable(data);
      try { localStorage.setItem("rk:pricing-updated", String(Date.now())); } catch {}
      return true;
    } finally {
      saving = saveButton.disabled = false;
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
    const canEdit = window.RK_AUTH.getState().user.role === "admin";
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
            <strong style="color: #111827; font-size: 13.5px;">${h(rule.name)}</strong>
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
              ${canEdit ? `<button type="button" class="btn-pricing-action" onclick="window.editRule(${rule.id})">Sửa</button>
              <button type="button" class="btn-pricing-action to-delete" onclick="window.deleteRule(${rule.id})">Xóa</button>` : "—"}
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
    pricingForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const sTime = startTimeInput.value;
      const eTime = endTimeInput.value;

      if (sTime >= eTime) {
        formErrorBox.textContent = "Thời gian kết thúc phải lớn hơn thời gian bắt đầu.";
        formErrorBox.style.display = "block";
        return;
      }

      const id = Number(ruleIdInput.value);
      const newRule = {
        id: id || Math.max(0, ...pricingRules.map((rule) => rule.id)) + 1,
        name: ruleNameInput.value.trim(),
        day_type: dayTypeSelect.value,
        start_time: sTime,
        end_time: eTime,
        price: Number(priceValueInput.value),
      };
      const rules = id
        ? pricingRules.map((rule) => rule.id === id ? newRule : rule)
        : [...pricingRules, newRule];
      formErrorBox.style.display = "none";
      try {
        if (await savePricingRules(rules)) closeDrawer();
      } catch (err) {
        formErrorBox.textContent = message(err);
        formErrorBox.style.display = "block";
      }
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

  window.deleteRule = async (id) => {
    if (saving || !confirm("Bạn có chắc chắn muốn xóa quy tắc giá này?")) return;
    try {
      await savePricingRules(pricingRules.filter((rule) => rule.id !== id));
    } catch (err) {
      alert(message(err));
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

      const dateObj = new Date(selectedDateStr + "T12:00:00");
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
          html += `<li><b>${h(r.name)}</b> (${r.start_time} - ${r.end_time}): <span style="color:#b91c1c; font-weight:bold;">${formattedPrice}/h</span></li>`;
        });
        html += `</ul>`;
        previewResult.innerHTML = html;
      }
    });
  }

  btnOpenAddRule.disabled = btnPreviewPrice.disabled = true;
  if (!await window.ProtectedRoute(["admin", "staff"])) return;
  const { user } = window.RK_AUTH.getState();
  window.RK_LAYOUT.dashboard(user);
  btnOpenAddRule.hidden = user.role !== "admin";
  try {
    const { data } = await api.get("/price-rules/public-table");
    loadTable(data);
    btnOpenAddRule.disabled = btnPreviewPrice.disabled = false;
  } catch (err) {
    tableBody.innerHTML = `<tr><td colspan="5" class="pricing-state-cell">${h(message(err))}</td></tr>`;
  }
});