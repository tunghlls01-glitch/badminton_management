(function (global) {
  "use strict";

  const PAGE_SIZE = 6;
  const photos = global.RK_COURT_PHOTOS;

  let allCourts = [];
  let currentFilter = "ALL";
  let searchKeyword = "";
  let currentPage = 1;
  let pendingAction = null;
  let currentUserRole = "";
  let booted = false;

  const courtsTableBody = document.getElementById("courtsTableBody");
  const searchInput = document.getElementById("searchInput");
  const tabAll = document.getElementById("tabAll");
  const tabActive = document.getElementById("tabActive");
  const tabMaint = document.getElementById("tabMaint");
  const paginationInfo = document.getElementById("paginationInfo");
  const paginationControls = document.getElementById("paginationControls");

  const drawerOverlay = document.getElementById("drawerOverlay");
  const drawerTitle = document.getElementById("drawerTitle");
  const drawerSubtitle = document.getElementById("drawerSubtitle");
  const courtForm = document.getElementById("courtForm");
  const courtIdInput = document.getElementById("courtId");
  const courtNameInput = document.getElementById("courtName");
  const courtStatusInput = document.getElementById("courtStatus");
  const courtDescriptionInput = document.getElementById("courtDescription");
  const courtImageInput = document.getElementById("courtImageInput");
  const previewImg = document.getElementById("previewImg");
  courtsTableBody.addEventListener("error", photos.recover, true);
  previewImg.addEventListener("error", photos.recover);
  const fileNameLabel = document.getElementById("fileNameLabel");
  const fileMetaLabel = document.getElementById("fileMetaLabel");
  const formErrorBox = document.getElementById("formErrorBox");
  const btnSaveCourt = document.getElementById("btnSaveCourt");
  const btnOpenAddDrawer = document.getElementById("btnOpenAddDrawer");

  const confirmOverlay = document.getElementById("confirmOverlay");
  const confirmTitle = document.getElementById("confirmTitle");
  const confirmMainText = document.getElementById("confirmMainText");
  const confirmSubText = document.getElementById("confirmSubText");
  const btnProceedConfirm = document.getElementById("btnProceedConfirm");
  const toastEl = document.getElementById("toast");

  function esc(str) {
    if (global.RK_UI && typeof global.RK_UI.escape === "function") {
      return global.RK_UI.escape(str);
    }
    return String(str ?? "").replace(/[&<>"']/g, (m) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[m]));
  }

  function extractErrorMsg(err) {
    const detail = err?.response?.data?.detail;
    if (Array.isArray(detail)) {
      return detail.map((d) => `${d.loc?.slice(-1)[0] || "Lỗi"}: ${d.msg}`).join("; ");
    }
    if (typeof detail === "string") return detail;
    if (err?.request && !err.response) {
      return "Không nhận được phản hồi từ API quản lý sân. Kiểm tra backend đã chạy rồi thử lại.";
    }
    return err?.message || "Không thể kết nối máy chủ.";
  }

  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => toastEl.classList.remove("show"), 3200);
  }

  function normalizeStatus(raw) {
    const val = (raw || "Active").trim();
    if (val === "Maintenance" || val === "BẢO TRÌ" || val === "BẢO_TRÌ") return "Maintenance";
    if (val === "Inactive" || val === "NGỪNG HOẠT ĐỘNG" || val === "NGƯNG_HOẠT_ĐỘNG") return "Inactive";
    return "Active";
  }

  function updateCounts() {
    const total = allCourts.length;
    const activeCount = allCourts.filter((c) => normalizeStatus(c.status) === "Active").length;
    const maintCount = total - activeCount;

    tabAll.textContent = `Tất cả (${total})`;
    tabActive.textContent = `Hoạt động (${activeCount})`;
    tabMaint.textContent = `Bảo trì (${maintCount})`;
  }

  function getFilteredCourts() {
    const q = searchKeyword.trim().toLowerCase();
    return allCourts.filter((court) => {
      const st = normalizeStatus(court.status);
      const matchTab =
        currentFilter === "ALL" ||
        (currentFilter === "Active" && st === "Active") ||
        (currentFilter === "Maintenance" && st !== "Active");
      const name = (court.name || court.court_name || "").toLowerCase();
      const desc = (court.description || "").toLowerCase();
      const matchSearch = !q || name.includes(q) || desc.includes(q);
      return matchTab && matchSearch;
    });
  }

  function renderTable() {
    const filtered = getFilteredCourts();
    const totalItems = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
    if (currentPage > totalPages) currentPage = totalPages;

    const startIdx = (currentPage - 1) * PAGE_SIZE;
    const pageItems = filtered.slice(startIdx, startIdx + PAGE_SIZE);

    if (totalItems === 0) {
      courtsTableBody.innerHTML = `<tr><td colspan="4" class="courts-state-cell">Chưa có sân cầu lông nào phù hợp.</td></tr>`;
      paginationInfo.textContent = "Hiển thị 0–0 trong tổng số 0 sân";
      paginationControls.innerHTML = "";
      return;
    }

    const isAdmin = currentUserRole === "admin";

    courtsTableBody.innerHTML = pageItems
      .map((court) => {
        const st = normalizeStatus(court.status);
        const isMaint = st !== "Active";
        const name = esc(court.name || court.court_name || `Sân #${court.id}`);
        const desc = esc(court.description || "Sân tiêu chuẩn, hệ thống đèn LED chống chói.");
        const imgUrl = esc(photos.resolve(court.image_url));

        const badgeHtml = isMaint
          ? `<span class="court-badge is-maint">${st === "Inactive" ? "Ngưng hoạt động" : "Bảo trì"}</span>`
          : `<span class="court-badge is-active">Hoạt động</span>`;

        const actionsHtml = isAdmin
          ? `${
              isMaint
                ? `<button type="button" class="btn-court-action to-active" data-action="toggle" data-id="${court.id}" data-next="Active">Mở hoạt động</button>`
                : `<button type="button" class="btn-court-action" data-action="toggle" data-id="${court.id}" data-next="Maintenance">Chuyển bảo trì</button>`
            }<button type="button" class="btn-court-action" data-action="edit" data-id="${court.id}">Sửa</button><button type="button" class="btn-court-action to-delete" data-action="delete" data-id="${court.id}">Xóa</button>`
          : `<span class="court-sub">Chỉ xem</span>`;

        return `<tr>
          <td>
            <div class="court-cell">
              <div class="court-thumb-frame">
                <img class="court-thumb" alt="${name}" ${imgUrl ? `src="${imgUrl}"` : "hidden"}>
                <div class="rk-court-photo-placeholder" ${imgUrl ? "hidden" : ""}>Chưa có ảnh</div>
              </div>
              <div>
                <span class="court-name">${name}</span>
                <span class="court-sub">Mã sân #${court.id}</span>
              </div>
            </div>
          </td>
          <td><div class="court-desc">${desc}</div></td>
          <td>${badgeHtml}</td>
          <td class="text-right"><div class="court-actions">${actionsHtml}</div></td>
        </tr>`;
      })
      .join("");

    const fromNum = startIdx + 1;
    const toNum = Math.min(startIdx + PAGE_SIZE, totalItems);
    paginationInfo.textContent = `Hiển thị ${fromNum}–${toNum} trong tổng số ${totalItems} sân`;
    renderPagination(totalPages);
  }

  function renderPagination(totalPages) {
    let html = `<button type="button" class="rk-page-btn" data-page="${currentPage - 1}" ${currentPage === 1 ? "disabled" : ""}>‹</button>`;
    for (let p = 1; p <= totalPages; p++) {
      html += `<button type="button" class="rk-page-btn ${p === currentPage ? "active" : ""}" data-page="${p}">${p}</button>`;
    }
    html += `<button type="button" class="rk-page-btn" data-page="${currentPage + 1}" ${currentPage === totalPages ? "disabled" : ""}>›</button>`;
    paginationControls.innerHTML = html;
  }

  async function loadCourts() {
    btnOpenAddDrawer.disabled = true;
    try {
      const res = await global.axiosClient.get("/courts");
      if (!Array.isArray(res.data)) throw new Error("API trả về danh sách sân không hợp lệ.");
      if (res.data.some(court => !Object.hasOwn(court, "image_url"))) {
        throw new Error("Backend đang chạy bản chưa hỗ trợ ảnh sân. Mở trang qua backend đã cập nhật.");
      }
      allCourts = res.data;
      updateCounts();
      renderTable();
      btnOpenAddDrawer.disabled = currentUserRole !== "admin";
    } catch (err) {
      allCourts = [];
      courtsTableBody.innerHTML = `<tr><td colspan="4" class="courts-state-cell" style="color:#b91c1c">${esc(extractErrorMsg(err))}</td></tr>`;
    }
  }

  function openAddDrawer() {
    drawerTitle.textContent = "Thêm sân mới";
    drawerSubtitle.textContent = "Nhập thông tin và tải lên hình ảnh thực tế của sân.";
    courtIdInput.value = "";
    courtForm.reset();
    courtStatusInput.value = "Active";
    photos.show(previewImg, "");
    fileNameLabel.textContent = "Chưa chọn ảnh mới";
    fileMetaLabel.textContent = "PNG, JPG hoặc WEBP (Tối đa 5MB)";
    formErrorBox.style.display = "none";
    drawerOverlay.classList.add("open");
  }

  function openEditDrawer(id) {
    const court = allCourts.find((c) => c.id === id);
    if (!court) return;

    drawerTitle.textContent = "Sửa thông tin sân";
    drawerSubtitle.textContent = "Cập nhật thông tin và hình ảnh của sân.";
    courtIdInput.value = court.id;
    courtNameInput.value = court.name || court.court_name || "";
    courtStatusInput.value = normalizeStatus(court.status);
    courtDescriptionInput.value = court.description || "";
    courtImageInput.value = "";
    photos.show(previewImg, photos.resolve(court.image_url));
    fileNameLabel.textContent = court.image_url ? court.image_url.split("/").pop() : "Ảnh sân hiện tại";
    fileMetaLabel.textContent = "Chọn ảnh mới nếu muốn thay đổi";
    formErrorBox.style.display = "none";
    drawerOverlay.classList.add("open");
  }

  function closeDrawer() {
    drawerOverlay.classList.remove("open");
  }

  courtImageInput.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    fileNameLabel.textContent = file.name;
    fileMetaLabel.textContent = `${(file.size / (1024 * 1024)).toFixed(2)} MB`;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (courtImageInput.files?.[0] === file) photos.show(previewImg, ev.target.result);
    };
    reader.readAsDataURL(file);
  });

  async function uploadCourtImage(courtId, file) {
    const formData = new FormData();
    formData.append("file", file);
    const { data } = await global.axiosClient.post(`/courts/${courtId}/upload-image`, formData);
    if (!photos.resolve(data?.image_url)) {
      throw new Error("API chưa xác nhận đường dẫn ảnh đã lưu.");
    }
  }

  courtForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    formErrorBox.style.display = "none";
    btnSaveCourt.disabled = true;
    btnSaveCourt.textContent = "Đang lưu...";

    const id = courtIdInput.value;
    const payload = {
      name: courtNameInput.value.trim(),
      status: courtStatusInput.value,
      description: courtDescriptionInput.value.trim() || null,
    };

    try {
      const res = id
        ? await global.axiosClient.put(`/courts/${id}`, payload)
        : await global.axiosClient.post("/courts", payload);

      const targetId = res.data?.id || id;
      const file = courtImageInput.files?.[0];
      if (!targetId) throw new Error("API chưa trả về mã sân đã lưu.");
      courtIdInput.value = targetId;
      if (file && targetId) {
        try {
          await uploadCourtImage(targetId, file);
        } catch (err) {
          throw new Error(`Thông tin sân đã lưu, nhưng ảnh chưa tải lên: ${extractErrorMsg(err)}`);
        }
      }

      closeDrawer();
      showToast(id ? "Đã cập nhật thông tin sân!" : "Đã thêm sân mới thành công!");
      await loadCourts();
    } catch (err) {
      formErrorBox.textContent = extractErrorMsg(err);
      formErrorBox.style.display = "block";
    } finally {
      btnSaveCourt.disabled = false;
      btnSaveCourt.textContent = "Lưu thông tin sân";
    }
  });

  function openToggleConfirm(id, nextStatus) {
    const court = allCourts.find((c) => c.id === id);
    if (!court) return;
    const name = court.name || court.court_name || `Sân #${id}`;
    const toMaint = nextStatus === "Maintenance";

    confirmTitle.textContent = toMaint
      ? "Xác nhận chuyển trạng thái bảo trì"
      : "Xác nhận mở hoạt động trở lại";
    confirmMainText.textContent = toMaint
      ? `Bạn có chắc chắn muốn chuyển ${name} sang trạng thái bảo trì?`
      : `Bạn có chắc chắn muốn mở lại ${name} sang trạng thái hoạt động?`;
    confirmSubText.textContent = toMaint
      ? "Sân sẽ tạm ngừng nhận lịch đặt mới cho đến khi được mở hoạt động trở lại."
      : "Khách hàng có thể đặt lịch chơi trên sân này ngay sau khi xác nhận.";
    btnProceedConfirm.textContent = toMaint ? "Xác nhận bảo trì" : "Mở hoạt động";

    pendingAction = async () => {
      await global.axiosClient.put(`/courts/${id}`, { status: nextStatus });
      showToast(toMaint ? `Đã chuyển ${name} sang Bảo trì!` : `Đã mở hoạt động ${name}!`);
      await loadCourts();
    };

    confirmOverlay.classList.add("open");
  }

  function openDeleteConfirm(id) {
    const court = allCourts.find((c) => c.id === id);
    if (!court) return;
    const name = court.name || court.court_name || `Sân #${id}`;

    confirmTitle.textContent = "Xác nhận xóa sân";
    confirmMainText.textContent = `Bạn có chắc chắn muốn xóa ${name} khỏi danh sách?`;
    confirmSubText.textContent = "Hệ thống sẽ chặn xóa nếu sân đã phát sinh lịch đặt.";
    btnProceedConfirm.textContent = "Xác nhận xóa";

    pendingAction = async () => {
      await global.axiosClient.delete(`/courts/${id}`);
      showToast(`Đã xóa ${name} thành công!`);
      await loadCourts();
    };

    confirmOverlay.classList.add("open");
  }

  btnProceedConfirm.addEventListener("click", async () => {
    if (!pendingAction) return;
    btnProceedConfirm.disabled = true;
    try {
      await pendingAction();
      confirmOverlay.classList.remove("open");
    } catch (err) {
      confirmOverlay.classList.remove("open");
      showToast(extractErrorMsg(err));
    } finally {
      btnProceedConfirm.disabled = false;
      pendingAction = null;
    }
  });

  courtsTableBody.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const id = Number(btn.dataset.id);
    const action = btn.dataset.action;
    if (action === "toggle") openToggleConfirm(id, btn.dataset.next);
    else if (action === "edit") openEditDrawer(id);
    else if (action === "delete") openDeleteConfirm(id);
  });

  paginationControls.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-page]");
    if (!btn || btn.disabled) return;
    currentPage = Number(btn.dataset.page);
    renderTable();
  });

  searchInput.addEventListener("input", (e) => {
    searchKeyword = e.target.value;
    currentPage = 1;
    renderTable();
  });

  document.querySelectorAll(".courts-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".courts-tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      currentFilter = tab.dataset.filter;
      currentPage = 1;
      renderTable();
    });
  });

  btnOpenAddDrawer.addEventListener("click", openAddDrawer);
  document.getElementById("btnCloseDrawer").addEventListener("click", closeDrawer);
  document.getElementById("btnCancelDrawer").addEventListener("click", closeDrawer);
  drawerOverlay.addEventListener("click", (e) => {
    if (e.target === drawerOverlay) closeDrawer();
  });

  document.getElementById("btnCancelConfirm").addEventListener("click", () => {
    confirmOverlay.classList.remove("open");
  });
  confirmOverlay.addEventListener("click", (e) => {
    if (e.target === confirmOverlay) confirmOverlay.classList.remove("open");
  });

  async function initPage() {
    if (booted) return;
    booted = true;

    const stateEl = document.getElementById("rk-dashboard-state");
    const dashEl = document.getElementById("rk-dashboard");

    if (!await global.ProtectedRoute(["admin", "staff"])) {
      const { error } = global.RK_AUTH.getState();
      if (error) stateEl.textContent = error;
      return;
    }

    const { user } = global.RK_AUTH.getState();
    currentUserRole = user.role;
    if (currentUserRole !== "admin" && btnOpenAddDrawer) {
      btnOpenAddDrawer.hidden = true;
    }

    if (global.RK_LAYOUT && typeof global.RK_LAYOUT.dashboard === "function") {
      global.RK_LAYOUT.dashboard(user);
    }

    if (stateEl) stateEl.remove();
    if (dashEl) dashEl.hidden = false;

    await loadCourts();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initPage, { once: true });
  } else {
    initPage();
  }
})(window);
