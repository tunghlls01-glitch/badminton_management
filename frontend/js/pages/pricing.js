document.addEventListener("DOMContentLoaded", async () => {
  const $ = (id) => document.getElementById(id);
  const api = window.axiosClient;
  const { escape: h, message } = window.RK_UI;
  const formatPrice = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" });
  const days = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"];
  const table = $("pricingTableBody");
  const form = $("pricingForm");
  const courtSelect = $("pricingCourt");
  const drawer = $("pricingDrawer");
  const preview = $("previewModal");
  const save = $("btnSaveRule");
  const add = $("btnOpenAddRule");
  const previewButton = $("btnPreviewPrice");
  const error = $("formErrorBox");
  let courts = [];
  let rules = [];
  let busy = false;

  function courtName(id) {
    return courts.find((court) => court.id === id)?.name || "Sân " + id;
  }

  function timeRange(rule) {
    return rule.start_time.slice(0, 5) + " – " + rule.end_time.slice(0, 5);
  }

  function render() {
    table.innerHTML = rules.length ? rules.map((rule) => `
      <tr>
        <td><strong>${h(courtName(rule.court_id))}</strong><div>${h(timeRange(rule))}</div></td>
        <td><span class="rk-badge rk-secondary">${h(days[rule.weekday_index])}</span></td>
        <td class="text-right">${h(formatPrice.format(rule.hourly_rate))}</td>
        <td><span class="rk-badge is-active">Áp dụng</span></td>
        <td class="text-right">
          ${canEdit ? `<button type="button" class="btn-pricing-action" data-edit="${rule.id}">Sửa</button>
          <button type="button" class="btn-pricing-action to-delete" data-delete="${rule.id}">Xóa</button>` : "—"}
        </td>
      </tr>`).join("") : '<tr><td colspan="5" class="pricing-state-cell">Chưa có quy tắc giá nào.</td></tr>';
  }

  function open(rule) {
    form.reset();
    $("drawerTitle").textContent = rule ? "Chỉnh sửa quy tắc giá" : "Thêm quy tắc giá mới";
    $("ruleId").value = rule?.id ?? "";
    courtSelect.disabled = Boolean(rule);
    if (rule) {
      courtSelect.value = rule.court_id;
      $("dayType").value = rule.weekday_index;
      $("startTime").value = rule.start_time.slice(0, 5);
      $("endTime").value = rule.end_time.slice(0, 5);
      $("priceValue").value = rule.hourly_rate;
    }
    error.style.display = "none";
    drawer.classList.add("open");
  }

  function notifyChange() {
    try { localStorage.setItem("rk:pricing-updated", String(Date.now())); } catch {}
  }

  const close = () => drawer.classList.remove("open");
  $("btnCloseDrawer").onclick = $("btnCancelDrawer").onclick = close;
  add.disabled = previewButton.disabled = true;
  if (!await window.ProtectedRoute(["admin", "staff"])) return;
  const canEdit = window.RK_AUTH.getState().user.role === "admin";
  add.hidden = !canEdit;
  add.onclick = () => open();
  table.addEventListener("click", async (event) => {
    const control = event.target.closest("button[data-edit], button[data-delete]");
    if (!canEdit || !control || busy) return;
    const rule = rules.find((item) => item.id === Number(control.dataset.edit || control.dataset.delete));
    if (!rule) return;
    if (control.dataset.edit) { open(rule); return; }
    if (!confirm("Bạn có chắc muốn xóa quy tắc giá này?")) return;
    busy = true;
    control.disabled = true;
    try {
      await api.delete("/price-rules/" + rule.id);
      rules = rules.filter((item) => item.id !== rule.id);
      notifyChange();
      render();
    } catch (err) {
      alert(message(err));
    } finally {
      busy = false;
      control.disabled = false;
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!canEdit || busy) return;
    const id = $("ruleId").value;
    const payload = {
      weekday_index: Number($("dayType").value),
      start_time: $("startTime").value,
      end_time: $("endTime").value,
      hourly_rate: Number($("priceValue").value),
    };
    error.style.display = "none";
    busy = save.disabled = true;
    try {
      const { data } = id
        ? await api.put("/price-rules/" + id, payload)
        : await api.post("/price-rules", { ...payload, court_id: Number(courtSelect.value) });
      rules = rules.filter((item) => item.id !== data.id).concat(data);
      rules.sort((a, b) => a.court_id - b.court_id || a.weekday_index - b.weekday_index || a.start_time.localeCompare(b.start_time));
      notifyChange();
      render();
      close();
    } catch (err) {
      error.textContent = message(err);
      error.style.display = "block";
    } finally {
      busy = save.disabled = false;
    }
  });

  previewButton.onclick = () => {
    $("previewDate").value = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
    $("previewResult").textContent = "";
    preview.classList.add("open");
  };
  $("btnClosePreview").onclick = () => preview.classList.remove("open");
  $("btnRunPreview").onclick = () => {
    const date = $("previewDate").value;
    if (!date) return;
    const day = (new Date(date + "T12:00:00Z").getUTCDay() + 6) % 7;
    const rows = rules.filter((rule) => rule.weekday_index === day);
    $("previewResult").innerHTML = rows.length ? '<ul>' + rows.map((rule) =>
      `<li>${h(courtName(rule.court_id))} · ${h(timeRange(rule))} · ${h(formatPrice.format(rule.hourly_rate))}/giờ</li>`
    ).join("") + '</ul>' : "Ngày này chưa có quy tắc giá.";
  };

  try {
    const [courtResponse, ruleResponse] = await Promise.all([api.get("/courts"), api.get("/price-rules")]);
    courts = courtResponse.data;
    rules = ruleResponse.data;
    courtSelect.replaceChildren(...courts.map((court) => new Option(court.name, court.id)));
    render();
    add.disabled = !courts.length;
    previewButton.disabled = false;
  } catch (err) {
    table.innerHTML = `<tr><td colspan="5" class="pricing-state-cell">${h(message(err))}</td></tr>`;
  }
});
