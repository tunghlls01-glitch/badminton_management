/**
 * COURTSIDE - QUẢN LÝ DỊCH VỤ & KHO
 * Tương tác API và render giao diện chuẩn Figma
 */

// Biến lưu trữ dữ liệu cục bộ
let allServices = [];
let filteredServices = [];
let currentTab = "services";
let editingServiceId = null;

// Khởi chạy khi DOM sẵn sàng
document.addEventListener("DOMContentLoaded", async () => {
  await ensureAuth();
  setupNavigation();
  setupEventListeners();
  setupLiveCalculators();
  await loadData();
});

// Quản lý phiên đăng nhập và hiển thị thông tin người dùng
async function ensureAuth() {
  let token =
    localStorage.getItem("token") ||
    localStorage.getItem("access_token") ||
    sessionStorage.getItem("access_token");

  if (token) {
    try {
      // Thử lấy thông tin người dùng hiện tại
      const baseUrl = typeof CONFIG !== "undefined" && CONFIG.API_BASE_URL ? CONFIG.API_BASE_URL.replace(/\/api$/, "") : "http://127.0.0.1:8000";
      let meRes;
      try {
        meRes = await axios.get(`${baseUrl}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch (_) {
        meRes = await axios.get(`${baseUrl}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }

      if (meRes && meRes.data) {
        localStorage.setItem("user", JSON.stringify(meRes.data));
      }
    } catch (err) {
      // Token hết hạn hoặc không hợp lệ
      if (err.response && err.response.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("access_token");
        localStorage.removeItem("user");
        sessionStorage.removeItem("access_token");
        sessionStorage.removeItem("user");
        token = null;
      }
    }
  }

  updateUserProfileUI();
}

// Cập nhật giao diện người dùng trên thanh topbar và sidebar
function updateUserProfileUI() {
  const token =
    localStorage.getItem("token") ||
    localStorage.getItem("access_token") ||
    sessionStorage.getItem("access_token");
  const userStr =
    localStorage.getItem("user") ||
    sessionStorage.getItem("user");

  let user = null;
  if (userStr) {
    try { user = JSON.parse(userStr); } catch (_) {}
  }

  const profileBox = document.getElementById("user-profile-box");
  const guestBox = document.getElementById("guest-profile-box");
  const nameEl = document.getElementById("user-display-name");
  const roleEl = document.getElementById("user-display-role");
  const avatarEl = document.getElementById("user-avatar-initial");
  const topBadge = document.getElementById("user-top-badge");
  const sidebarAuthLink = document.getElementById("sidebar-auth-link");
  const sidebarAuthText = document.getElementById("sidebar-auth-text");
  const btnLogoutHeader = document.getElementById("btn-logout-header");

  if (token && user) {
    if (profileBox) profileBox.style.display = "flex";
    if (guestBox) guestBox.style.display = "none";
    if (nameEl) nameEl.textContent = user.full_name || "Quản trị viên";
    if (avatarEl && user.full_name) {
      avatarEl.textContent = user.full_name.trim().charAt(0).toUpperCase();
    }
    const roleLower = String(user.role || "").toLowerCase();
    const roleTitle = roleLower === "admin" ? "Quản trị viên CLB" : (roleLower === "staff" ? "Lễ tân" : "Thành viên");
    if (roleEl) roleEl.textContent = roleTitle;
    if (topBadge) topBadge.textContent = roleLower === "admin" ? "QUẢN TRỊ" : roleTitle.toUpperCase();

    if (sidebarAuthText) sidebarAuthText.textContent = "Đăng xuất";
    if (sidebarAuthLink) {
      sidebarAuthLink.href = "#";
      sidebarAuthLink.onclick = (e) => { e.preventDefault(); handleLogout(); };
    }
  } else {
    if (profileBox) profileBox.style.display = "none";
    if (guestBox) guestBox.style.display = "flex";
    if (sidebarAuthText) sidebarAuthText.textContent = "Đăng nhập";
    if (sidebarAuthLink) {
      sidebarAuthLink.href = "login.html";
      sidebarAuthLink.onclick = null;
    }
  }

  if (btnLogoutHeader) {
    btnLogoutHeader.onclick = handleLogout;
  }
}

function handleLogout() {
  localStorage.removeItem("token");
  localStorage.removeItem("access_token");
  localStorage.removeItem("user");
  sessionStorage.removeItem("access_token");
  sessionStorage.removeItem("user");
  window.location.href = "login.html";
}

/* ==========================================================================
   1. ĐIỀU HƯỚNG TABS VÀ VIEWS
   ========================================================================== */
function setupNavigation() {
  const tabButtons = document.querySelectorAll(".tab-btn");
  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tabKey = btn.dataset.tab;
      switchTab(tabKey);
    });
  });

  // Mở view thêm mới dịch vụ
  const btnOpenCreate = document.getElementById("btn-open-create");
  if (btnOpenCreate) {
    btnOpenCreate.addEventListener("click", () => {
      openServiceForm(null);
    });
  }

  // Nút Hủy trên form
  const btnCancelForm = document.getElementById("btn-cancel-form");
  if (btnCancelForm) {
    btnCancelForm.addEventListener("click", () => {
      closeServiceForm();
    });
  }

  // Nút đóng modal chi tiết
  const btnCloseModal = document.getElementById("btn-close-detail-modal");
  if (btnCloseModal) {
    btnCloseModal.addEventListener("click", () => {
      document.getElementById("detail-modal").style.display = "none";
    });
  }
}

function switchTab(tabKey) {
  currentTab = tabKey;

  // Đổi active trên tab buttons
  document.querySelectorAll(".tab-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.tab === tabKey);
  });

  // Ẩn view form nếu đang mở
  document.getElementById("view-form-service").style.display = "none";
  document.getElementById("breadcrumb-sub").style.display = "none";
  document.getElementById("main-tabs-nav").style.display = "flex";
  document.getElementById("page-header-actions").style.display = "block";

  // Hiển thị view tab tương ứng
  document.getElementById("tab-services-view").style.display = tabKey === "services" ? "block" : "none";
  document.getElementById("tab-inventory-view").style.display = tabKey === "inventory" ? "block" : "none";
  document.getElementById("tab-history-view").style.display = tabKey === "history" ? "block" : "none";

  // Cập nhật tiêu đề trang
  const pageTitle = document.getElementById("page-title-text");
  const pageSub = document.getElementById("page-subtitle-text");

  if (tabKey === "services") {
    pageTitle.textContent = "Quản lý dịch vụ";
    pageSub.textContent = "Quản lý dịch vụ, giá cả và tồn kho tại một nơi.";
  } else if (tabKey === "inventory") {
    pageTitle.textContent = "Nhập & điều chỉnh kho";
    pageSub.textContent = "Nhập hàng và điều chỉnh để đảm bảo tồn kho chính xác.";
  } else if (tabKey === "history") {
    pageTitle.textContent = "Lịch sử kho & cảnh báo sắp hết hàng";
    pageSub.textContent = "Theo dõi biến động kho và chủ động bổ sung hàng sắp hết.";
    loadHistoryTab();
  }
}

function openServiceForm(service = null) {
  editingServiceId = service ? service.id : null;

  // Ẩn các tabs
  document.getElementById("tab-services-view").style.display = "none";
  document.getElementById("tab-inventory-view").style.display = "none";
  document.getElementById("tab-history-view").style.display = "none";
  document.getElementById("main-tabs-nav").style.display = "none";
  document.getElementById("page-header-actions").style.display = "none";

  // Hiển thị form
  document.getElementById("view-form-service").style.display = "block";
  document.getElementById("breadcrumb-sub").style.display = "inline";

  const subText = document.getElementById("breadcrumb-sub-text");
  const titleText = document.getElementById("page-title-text");
  const descText = document.getElementById("page-subtitle-text");

  if (service) {
    subText.textContent = "Chỉnh sửa dịch vụ";
    titleText.textContent = "Chỉnh sửa dịch vụ";
    descText.textContent = "Cập nhật thông tin, giá cả và thiết lập tồn kho của dịch vụ.";

    // Điền dữ liệu
    document.getElementById("form-service-id").value = service.id;
    document.getElementById("form-name").value = service.name || "";
    document.getElementById("form-category").value = mapCategoryToSelect(service.category);
    document.getElementById("form-unit").value = service.unit || "Chai";
    document.getElementById("form-description").value = service.description || "";
    document.getElementById("form-price").value = service.unit_price || service.price || 0;
    document.getElementById("form-stock").value = service.stock_quantity || 0;
    document.getElementById("form-min-stock").value = 10;
    document.getElementById("form-status").value = (service.status || "").toUpperCase().includes("INACTIVE") ? "INACTIVE" : "ACTIVE";
  } else {
    subText.textContent = "Thêm dịch vụ mới";
    titleText.textContent = "Thêm dịch vụ mới";
    descText.textContent = "Tạo dịch vụ và thiết lập tồn kho ban đầu.";

    // Reset form
    document.getElementById("service-edit-form").reset();
    document.getElementById("form-service-id").value = "";
    document.getElementById("form-price").value = 10000;
    document.getElementById("form-stock").value = 50;
    document.getElementById("form-min-stock").value = 10;
  }

  updateFormLivePreview();
}

function closeServiceForm() {
  document.getElementById("view-form-service").style.display = "none";
  document.getElementById("breadcrumb-sub").style.display = "none";
  document.getElementById("main-tabs-nav").style.display = "flex";
  document.getElementById("page-header-actions").style.display = "block";
  switchTab(currentTab);
}

/* ==========================================================================
   2. GỌI API & RENDER DỮ LIỆU
   ========================================================================== */
async function loadData() {
  try {
    const res = await api.get("/services");
    allServices = Array.isArray(res) ? res : (res.data || []);
    renderDashboardStats();
    populateDropdowns();
    applyFilterAndRender();
  } catch (err) {
    showToast("Không thể tải danh sách dịch vụ: " + err.message, "error");
    document.getElementById("services-table-body").innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center; padding:30px; color:#dc2626;">
          ⚠️ Không thể kết nối tới máy chủ. Vui lòng kiểm tra backend đã chạy chưa.
        </td>
      </tr>
    `;
  }
}

// Thống kê 4 thẻ đầu trang
function renderDashboardStats() {
  const total = allServices.length;
  const activeCount = allServices.filter(s => isServiceActive(s)).length;
  const lowStockCount = allServices.filter(s => (s.stock_quantity <= 10 && s.stock_quantity > 0)).length;
  const outOfStockCount = allServices.filter(s => (s.stock_quantity <= 0)).length;

  document.getElementById("stat-total-services").textContent = total;
  document.getElementById("stat-active-services").textContent = activeCount;
  document.getElementById("stat-low-stock").textContent = lowStockCount;
  document.getElementById("stat-out-of-stock").textContent = outOfStockCount;
  document.getElementById("table-count-badge").textContent = total;
}

// Bảng danh sách dịch vụ
function renderServicesTable(list) {
  const tbody = document.getElementById("services-table-body");
  if (!list || list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 40px; color: var(--text-light);">
          Không tìm thấy dịch vụ nào phù hợp với bộ lọc.
        </td>
      </tr>
    `;
    document.getElementById("table-pagination-info").textContent = "Hiển thị 0 trên " + allServices.length + " dịch vụ";
    return;
  }

  tbody.innerHTML = list.map((s, index) => {
    const avatarType = getAvatarClass(s.category);
    const avatarIcon = getCategoryIcon(s.category);
    const categoryName = getCategoryLabel(s.category);
    const code = `SVC-${String(s.id).padStart(3, "0")}`;
    const priceFormatted = Number(s.unit_price || s.price || 0).toLocaleString("vi-VN") + "đ";

    // Trạng thái tồn kho
    const stock = s.stock_quantity || 0;
    let stockClass = "ok";
    let statusPillClass = "in-stock";
    let statusText = "Còn hàng";

    if (!isServiceActive(s)) {
      statusPillClass = "inactive";
      statusText = "Ngừng bán";
    } else if (stock <= 0) {
      stockClass = "out";
      statusPillClass = "out-of-stock";
      statusText = "Hết hàng";
    } else if (stock <= 10) {
      stockClass = "low";
      statusPillClass = "low-stock";
      statusText = "Sắp hết";
    }

    return `
      <tr>
        <td>
          <div class="service-avatar ${avatarType}">
            ${avatarIcon}
          </div>
        </td>
        <td>
          <div class="service-name-text">${escapeHtml(s.name)}</div>
          <div class="service-code-sub">${code} · ${escapeHtml(s.unit || "Món")}</div>
        </td>
        <td>${categoryName}</td>
        <td><strong style="font-size:14px;">${priceFormatted}</strong></td>
        <td>
          <div class="stock-cell">
            <span class="stock-number ${stockClass}">${stock}</span>
            <div class="stock-min-sub">Tối thiểu 10</div>
          </div>
        </td>
        <td>
          <span class="status-pill ${statusPillClass}">${statusText}</span>
        </td>
        <td>
          <div class="action-buttons">
            <button class="btn-icon" title="Xem chi tiết" onclick="viewServiceDetail(${s.id})">👁</button>
            <button class="btn-icon" title="Sửa thông tin" onclick="editService(${s.id})">✏</button>
            <button class="btn-icon delete" title="Ngừng / Bật kinh doanh" onclick="toggleDeactivateService(${s.id})">
              ${isServiceActive(s) ? "🗑" : "↺"}
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join("");

  document.getElementById("table-pagination-info").textContent = `Hiển thị ${list.length} trên ${allServices.length} dịch vụ`;
  const badgeEl = document.getElementById("table-count-badge");
  if (badgeEl) badgeEl.textContent = list.length;
}

// Điền các select box ở Tab Nhập kho & Điều chỉnh kho
function populateDropdowns() {
  const importSelect = document.getElementById("import-service-id");
  const adjustSelect = document.getElementById("adjust-service-id");
  const historySelect = document.getElementById("history-filter-service");

  const optionsHtml = allServices.map(s => {
    const code = `SVC-${String(s.id).padStart(3, "0")}`;
    return `<option value="${s.id}">${code} - ${escapeHtml(s.name)} (Tồn: ${s.stock_quantity})</option>`;
  }).join("");

  if (importSelect) importSelect.innerHTML = `<option value="">-- Chọn dịch vụ cần nhập hàng --</option>` + optionsHtml;
  if (adjustSelect) adjustSelect.innerHTML = `<option value="">-- Chọn dịch vụ cần kiểm kê --</option>` + optionsHtml;
  if (historySelect) historySelect.innerHTML = `<option value="">Tất cả dịch vụ</option>` + optionsHtml;
}

/* ==========================================================================
   3. TÌM KIẾM & BỘ LỌC
   ========================================================================== */
function setupEventListeners() {
  const searchInput = document.getElementById("search-keyword");
  const categoryFilter = document.getElementById("filter-category");
  const statusFilter = document.getElementById("filter-status");

  if (searchInput) searchInput.addEventListener("input", applyFilterAndRender);
  if (categoryFilter) categoryFilter.addEventListener("change", applyFilterAndRender);
  if (statusFilter) statusFilter.addEventListener("change", applyFilterAndRender);

  // Form Lưu dịch vụ
  const editForm = document.getElementById("service-edit-form");
  if (editForm) {
    editForm.addEventListener("submit", handleSaveService);
  }

  // Form Nhập kho
  const importForm = document.getElementById("form-import-stock");
  if (importForm) {
    importForm.addEventListener("submit", handleImportStock);
  }

  // Form Điều chỉnh kho
  const adjustForm = document.getElementById("form-adjust-stock");
  if (adjustForm) {
    adjustForm.addEventListener("submit", handleAdjustStock);
  }

  // Bộ lọc lịch sử
  const historyService = document.getElementById("history-filter-service");
  const historyType = document.getElementById("history-filter-type");
  const historyFromDate = document.getElementById("history-filter-from-date");
  const historyToDate = document.getElementById("history-filter-to-date");
  const btnClearHistory = document.getElementById("btn-clear-history-filter");

  if (historyService) historyService.addEventListener("change", loadHistoryTab);
  if (historyType) historyType.addEventListener("change", loadHistoryTab);
  if (historyFromDate) historyFromDate.addEventListener("change", loadHistoryTab);
  if (historyToDate) historyToDate.addEventListener("change", loadHistoryTab);
  if (btnClearHistory) {
    btnClearHistory.addEventListener("click", () => {
      if (historyService) historyService.value = "";
      if (historyType) historyType.value = "";
      if (historyFromDate) historyFromDate.value = "";
      if (historyToDate) historyToDate.value = "";
      loadHistoryTab();
    });
  }

  // [T3D32A7] Nút xuất CSV tồn kho
  const btnExportInv = document.getElementById("btn-export-inventory-csv");
  if (btnExportInv) {
    btnExportInv.addEventListener("click", handleExportInventoryCSV);
  }

  // [T3D32A7] Nút xuất CSV lịch sử nhập/xuất kho
  const btnExportHist = document.getElementById("btn-export-history-csv");
  if (btnExportHist) {
    btnExportHist.addEventListener("click", handleExportHistoryCSV);
  }

  // Làm mới cảnh báo
  const btnRefreshAlerts = document.getElementById("btn-refresh-alerts");
  if (btnRefreshAlerts) {
    btnRefreshAlerts.addEventListener("click", () => {
      loadLowStockAlerts();
      showToast("Đã cập nhật cảnh báo mới nhất!", "success");
    });
  }
}

function applyFilterAndRender() {
  const keyword = (document.getElementById("search-keyword")?.value || "").trim().toLowerCase();
  const category = document.getElementById("filter-category")?.value || "";
  const status = document.getElementById("filter-status")?.value || "";

  filteredServices = allServices.filter(s => {
    // Tìm kiếm tên hoặc mã SVC
    const code = `svc-${String(s.id).padStart(3, "0")}`;
    const nameMatch = (s.name || "").toLowerCase().includes(keyword) || code.includes(keyword);
    if (!nameMatch) return false;

    // Lọc danh mục
    if (category) {
      const catStr = String(s.category || "").toUpperCase();
      if (!catStr.includes(category)) return false;
    }

    // Lọc trạng thái
    if (status) {
      const isActive = isServiceActive(s);
      if (status === "ACTIVE" && !isActive) return false;
      if (status === "INACTIVE" && isActive) return false;
    }

    return true;
  });

  renderServicesTable(filteredServices);
}

/* ==========================================================================
   4. THAO TÁC CRUD DỊCH VỤ
   ========================================================================== */
window.editService = function(id) {
  const service = allServices.find(s => s.id === id);
  if (service) {
    openServiceForm(service);
  }
};

window.viewServiceDetail = function(id) {
  const service = allServices.find(s => s.id === id);
  if (!service) return;

  const modalBody = document.getElementById("modal-service-body");
  const priceFormatted = Number(service.unit_price || service.price || 0).toLocaleString("vi-VN") + " VNĐ";
  const code = `SVC-${String(service.id).padStart(3, "0")}`;

  modalBody.innerHTML = `
    <div style="display:flex; gap:16px; align-items:center; margin-bottom:20px;">
      <div class="service-avatar ${getAvatarClass(service.category)}" style="width:50px; height:50px; font-size:24px;">
        ${getCategoryIcon(service.category)}
      </div>
      <div>
        <h3 style="font-size:17px; margin-bottom:4px;">${escapeHtml(service.name)}</h3>
        <span style="font-size:12px; color:var(--text-muted);">${code} · Danh mục: ${getCategoryLabel(service.category)}</span>
      </div>
    </div>

    <table style="width:100%; border-collapse:collapse; margin-bottom:20px;">
      <tr><td style="padding:8px 0; color:var(--text-muted);">Giá bán:</td><td><strong>${priceFormatted}</strong></td></tr>
      <tr><td style="padding:8px 0; color:var(--text-muted);">Đơn vị tính:</td><td>${escapeHtml(service.unit || "Món")}</td></tr>
      <tr><td style="padding:8px 0; color:var(--text-muted);">Số lượng tồn kho:</td><td><strong style="color:#059669; font-size:16px;">${service.stock_quantity}</strong></td></tr>
      <tr><td style="padding:8px 0; color:var(--text-muted);">Trạng thái:</td><td>${isServiceActive(service) ? "Đang kinh doanh" : "Ngừng kinh doanh"}</td></tr>
      <tr><td style="padding:8px 0; color:var(--text-muted);">Mô tả:</td><td>${escapeHtml(service.description || "Không có")}</td></tr>
    </table>

    <div style="display:flex; justify-content:flex-end; gap:10px;">
      <button class="btn-primary-red" onclick="switchTabToInventoryWithService(${service.id})">📥 Nhập kho ngay</button>
    </div>
  `;

  document.getElementById("modal-service-name").textContent = "Chi tiết: " + service.name;
  document.getElementById("detail-modal").style.display = "flex";
};

window.toggleDeactivateService = async function(id) {
  const service = allServices.find(s => s.id === id);
  if (!service) return;

  const isCurrentlyActive = isServiceActive(service);
  const actionPrompt = isCurrentlyActive ? "xóa" : "khôi phục (mở bán lại)";
  const successMsg = isCurrentlyActive
    ? "Đã xóa dịch vụ thành công!"
    : "Đã khôi phục dịch vụ thành công!";

  if (!confirm(`Bạn có chắc muốn ${actionPrompt} dịch vụ '${service.name}'?`)) {
    return;
  }

  try {
    if (isCurrentlyActive) {
      await api.delete(`/services/${id}`);
    } else {
      await api.put(`/services/${id}`, { status: "Active" });
    }
    showToast(successMsg, "success");
    await loadData();
  } catch (err) {
    showToast("Không thể thay đổi trạng thái: " + err.message, "error");
  }
};

async function handleSaveService(e) {
  e.preventDefault();

  const id = document.getElementById("form-service-id").value;
  const name = document.getElementById("form-name").value.trim();
  const category = document.getElementById("form-category").value;
  const unit = document.getElementById("form-unit").value.trim();
  const description = document.getElementById("form-description").value.trim();
  const price = parseFloat(document.getElementById("form-price").value) || 0;
  const stock = parseInt(document.getElementById("form-stock").value) || 0;
  const status = document.getElementById("form-status").value;

  if (!name) {
    document.getElementById("form-name-error").style.display = "block";
    return;
  }
  if (price <= 0) {
    showToast("Giá bán bắt buộc phải lớn hơn 0!", "error");
    return;
  }

  const payload = {
    name,
    category,
    unit,
    description: description || null,
    unit_price: price,
    stock_quantity: stock,
    status,
  };

  try {
    if (id) {
      await api.put(`/services/${id}`, payload);
      showToast("Đã lưu dịch vụ thành công - Thay đổi đã được cập nhật.", "success");
    } else {
      await api.post("/services", payload);
      showToast("Đã thêm dịch vụ mới thành công!", "success");
    }
    closeServiceForm();
    await loadData();
  } catch (err) {
    showToast("Không thể lưu dịch vụ: " + err.message, "error");
  }
}

/* ==========================================================================
   5. LIVE CALCULATORS & INTERACTION CHO TAB NHẬP / ĐIỀU CHỈNH KHO
   ========================================================================== */
function setupLiveCalculators() {
  // Description char counter
  const descInput = document.getElementById("form-description");
  if (descInput) {
    descInput.addEventListener("input", () => {
      document.getElementById("form-desc-len").textContent = descInput.value.length;
    });
  }

  // Live preview form thêm/sửa
  const formStock = document.getElementById("form-stock");
  const formMinStock = document.getElementById("form-min-stock");
  if (formStock) formStock.addEventListener("input", updateFormLivePreview);
  if (formMinStock) formMinStock.addEventListener("input", updateFormLivePreview);

  // Tab Nhập kho live calculate
  const importSelect = document.getElementById("import-service-id");
  const importQty = document.getElementById("import-quantity");

  function updateImportFlow() {
    const serviceId = parseInt(importSelect?.value);
    const service = allServices.find(s => s.id === serviceId);
    const currentStock = service ? service.stock_quantity : 0;
    const addQty = parseInt(importQty?.value) || 0;
    const afterStock = currentStock + addQty;

    document.getElementById("import-flow-current").textContent = `${currentStock} đơn vị`;
    document.getElementById("import-flow-add").textContent = `+${addQty} đơn vị`;
    document.getElementById("import-flow-after").textContent = `${afterStock} đơn vị`;

    if (service) {
      document.getElementById("import-service-sub").textContent = `SVC-${String(service.id).padStart(3, "0")} · Hiện có: ${currentStock} đơn vị`;
    }
  }

  if (importSelect) importSelect.addEventListener("change", updateImportFlow);
  if (importQty) importQty.addEventListener("input", updateImportFlow);

  // Tab Điều chỉnh kho live calculate
  const adjustSelect = document.getElementById("adjust-service-id");
  const adjustQty = document.getElementById("adjust-quantity");
  let adjustMode = "exact"; // "exact", "decrease", "increase"

  const btnExact = document.getElementById("btn-adjust-set-exact");
  const btnDec = document.getElementById("btn-adjust-decrease");
  const btnInc = document.getElementById("btn-adjust-increase");

  function setAdjustMode(mode) {
    adjustMode = mode;
    btnExact.classList.toggle("active", mode === "exact");
    btnDec.classList.toggle("active", mode === "decrease");
    btnInc.classList.toggle("active", mode === "increase");

    const label = document.getElementById("label-adjust-qty");
    if (mode === "exact") label.textContent = "Số lượng tồn kho thực tế kiểm kê *";
    else if (mode === "decrease") label.textContent = "Số lượng giảm hao hụt / hư hỏng *";
    else label.textContent = "Số lượng tăng thêm *";

    updateAdjustFlow();
  }

  if (btnExact) btnExact.addEventListener("click", () => setAdjustMode("exact"));
  if (btnDec) btnDec.addEventListener("click", () => setAdjustMode("decrease"));
  if (btnInc) btnInc.addEventListener("click", () => setAdjustMode("increase"));

  function updateAdjustFlow() {
    const serviceId = parseInt(adjustSelect?.value);
    const service = allServices.find(s => s.id === serviceId);
    const currentStock = service ? service.stock_quantity : 0;
    const inputVal = parseInt(adjustQty?.value) || 0;

    let delta = 0;
    let afterStock = 0;
    let isBlocked = false;

    if (adjustMode === "exact") {
      afterStock = inputVal;
      delta = afterStock - currentStock;
    } else if (adjustMode === "decrease") {
      if (inputVal > currentStock) isBlocked = true;
      delta = -inputVal;
      afterStock = currentStock - inputVal;
    } else if (adjustMode === "increase") {
      delta = inputVal;
      afterStock = currentStock + inputVal;
    }

    const errorMsg = document.getElementById("adjust-error-msg");
    const deltaEl = document.getElementById("adjust-flow-delta");
    const afterEl = document.getElementById("adjust-flow-after");
    const btnSubmit = document.getElementById("btn-submit-adjust");

    document.getElementById("adjust-flow-current").textContent = `${currentStock} đơn vị`;

    if (isBlocked) {
      errorMsg.style.display = "block";
      errorMsg.textContent = `Vượt quá tồn kho hiện tại. Nhập từ 1 đến ${currentStock} đơn vị.`;
      deltaEl.textContent = `${delta} đơn vị`;
      afterEl.textContent = "Bị chặn";
      afterEl.className = "flow-step-val red";
      btnSubmit.disabled = true;
    } else {
      errorMsg.style.display = "none";
      deltaEl.textContent = `${delta >= 0 ? "+" : ""}${delta} đơn vị`;
      afterEl.textContent = `${afterStock} đơn vị`;
      afterEl.className = "flow-step-val green";
      btnSubmit.disabled = false;
    }

    if (service) {
      document.getElementById("adjust-service-sub").textContent = `SVC-${String(service.id).padStart(3, "0")} · Hiện có: ${currentStock} đơn vị`;
    }
  }

  if (adjustSelect) adjustSelect.addEventListener("change", updateAdjustFlow);
  if (adjustQty) adjustQty.addEventListener("input", updateAdjustFlow);
}

function updateFormLivePreview() {
  const stock = parseInt(document.getElementById("form-stock")?.value) || 0;
  const minStock = parseInt(document.getElementById("form-min-stock")?.value) || 10;

  document.getElementById("preview-stock-val").textContent = `${stock} đơn vị`;
  document.getElementById("preview-min-stock-val").textContent = `${minStock} đơn vị`;

  const bar = document.getElementById("preview-progress-bar");
  const pill = document.getElementById("preview-pill");
  const note = document.getElementById("preview-stock-status-text");

  const percentage = minStock > 0 ? Math.min(100, Math.round((stock / (minStock * 2)) * 100)) : 100;
  bar.style.width = percentage + "%";

  if (stock <= 0) {
    pill.className = "status-pill out-of-stock";
    pill.textContent = "Hết hàng";
    bar.className = "progress-bar red";
    note.style.color = "#dc2626";
    note.textContent = "Mặt hàng này đã hết kho!";
  } else if (stock <= minStock) {
    pill.className = "status-pill low-stock";
    pill.textContent = "Sắp hết";
    bar.className = "progress-bar orange";
    note.style.color = "#d97706";
    note.textContent = `Thấp hơn mức tồn tối thiểu ${minStock - stock} đơn vị.`;
  } else {
    pill.className = "status-pill in-stock";
    pill.textContent = "Còn hàng";
    bar.className = "progress-bar";
    note.style.color = "#059669";
    note.textContent = "Tồn kho cao hơn mức tối thiểu.";
  }
}

/* ==========================================================================
   6. XỬ LÝ NHẬP HÀNG & ĐIỀU CHỈNH KHO
   ========================================================================== */
async function handleImportStock(e) {
  e.preventDefault();
  const serviceId = document.getElementById("import-service-id").value;
  const quantity = parseInt(document.getElementById("import-quantity").value);
  const note = document.getElementById("import-note").value.trim() || "Nhập hàng từ nhà cung cấp";

  if (!serviceId) {
    showToast("Vui lòng chọn dịch vụ cần nhập kho!", "error");
    return;
  }
  if (!quantity || quantity <= 0) {
    showToast("Số lượng nhập phải lớn hơn 0!", "error");
    return;
  }

  try {
    await api.post(`/services/${serviceId}/import`, { quantity, note });
    showToast("Xác nhận nhập kho thành công!", "success");
    await loadData();
    switchTab("services");
  } catch (err) {
    showToast("Lỗi nhập kho: " + err.message, "error");
  }
}

async function handleAdjustStock(e) {
  e.preventDefault();
  const serviceId = document.getElementById("adjust-service-id").value;
  const note = document.getElementById("adjust-note").value.trim();
  const service = allServices.find(s => s.id === parseInt(serviceId));

  if (!serviceId || !service) {
    showToast("Vui lòng chọn dịch vụ cần kiểm kê điều chỉnh!", "error");
    return;
  }
  if (!note) {
    showToast("Bắt buộc phải nhập lý do điều chỉnh kho!", "error");
    return;
  }

  // Tính actual_quantity
  const currentStock = service.stock_quantity;
  const inputVal = parseInt(document.getElementById("adjust-quantity").value) || 0;
  let actualQuantity = inputVal;

  const btnDec = document.getElementById("btn-adjust-decrease");
  const btnInc = document.getElementById("btn-adjust-increase");

  if (btnDec.classList.contains("active")) {
    if (inputVal > currentStock) {
      showToast("Số lượng giảm không được vượt quá số tồn kho hiện tại!", "error");
      return;
    }
    actualQuantity = currentStock - inputVal;
  } else if (btnInc.classList.contains("active")) {
    actualQuantity = currentStock + inputVal;
  }

  try {
    await api.post(`/services/${serviceId}/adjust`, {
      actual_quantity: actualQuantity,
      note,
    });
    showToast("Điều chỉnh tồn kho thành công!", "success");
    await loadData();
    switchTab("services");
  } catch (err) {
    showToast("Lỗi điều chỉnh kho: " + err.message, "error");
  }
}

/* ==========================================================================
   7. TAB LỊCH SỬ KHO & CẢNH BÁO SẮP HẾT (Image 5)
   ========================================================================== */
async function loadHistoryTab() {
  await loadLowStockAlerts();
  await loadStockLogs();
}

async function loadLowStockAlerts() {
  const container = document.getElementById("warning-cards-container");
  try {
    const alerts = await api.get("/services/low-stock?threshold=10");
    if (!alerts || alerts.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1/-1; padding: 20px; background:#fff; border:1px solid #e5e7eb; border-radius:8px; text-align:center; color:#059669;">
          ✓ Tồn kho an toàn! Hiện không có mặt hàng nào sắp hết hoặc hết hàng.
        </div>
      `;
      return;
    }

    container.innerHTML = alerts.map(item => {
      const isOut = item.stock_quantity <= 0;
      const badgeClass = isOut ? "out-of-stock" : "low-stock";
      const badgeText = isOut ? "Hết hàng" : "Sắp hết";

      return `
        <div class="warning-card">
          <div class="warning-top">
            <span class="warning-name">${escapeHtml(item.name)}</span>
            <span class="status-pill ${badgeClass}">${badgeText}</span>
          </div>
          <div class="warning-bottom">
            <span>Còn <strong>${item.stock_quantity}</strong> (Tối thiểu 10)</span>
            <span class="btn-link-action" onclick="switchTabToInventoryWithService(${item.id})">Bổ sung &gt;</span>
          </div>
        </div>
      `;
    }).join("");
  } catch (err) {
    container.innerHTML = `<div style="grid-column: 1/-1; color:#dc2626;">Không thể tải cảnh báo: ${err.message}</div>`;
  }
}

async function loadStockLogs() {
  const tbody = document.getElementById("history-table-body");
  const selectedServiceId = document.getElementById("history-filter-service")?.value;
  const filterType = document.getElementById("history-filter-type")?.value;
  const fromDate = document.getElementById("history-filter-from-date")?.value;
  const toDate = document.getElementById("history-filter-to-date")?.value;

  try {
    let logs = [];
    const params = [];
    if (selectedServiceId) params.push(`service_id=${encodeURIComponent(selectedServiceId)}`);
    if (filterType) params.push(`change_type=${encodeURIComponent(filterType)}`);
    if (fromDate) params.push(`from_date=${encodeURIComponent(fromDate)}`);
    if (toDate) params.push(`to_date=${encodeURIComponent(toDate)}`);
    const qs = params.length > 0 ? `?${params.join("&")}` : "";

    try {
      logs = await api.get(`/services/stock-logs${qs}`);
    } catch (_) {
      if (selectedServiceId) {
        logs = await api.get(`/services/${selectedServiceId}/stock-logs`);
      } else if (allServices.length > 0) {
        // Tải logs của các dịch vụ đầu tiên để minh họa bảng
        const topServices = allServices.slice(0, 5);
        const promises = topServices.map(s => api.get(`/services/${s.id}/stock-logs`).catch(() => []));
        const results = await Promise.all(promises);
        results.forEach(resLogs => {
          if (Array.isArray(resLogs)) logs.push(...resLogs);
        });
        // Sắp xếp ngày mới nhất lên đầu
        logs.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
      }
    }

    if (filterType) {
      logs = logs.filter(l => (l.change_type || "").toLowerCase().includes(filterType.toLowerCase()));
    }

    if (!logs || logs.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align:center; padding:30px; color:var(--text-light);">
            Chưa có lịch sử biến động kho cho dịch vụ này.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = logs.map(l => {
      const service = allServices.find(s => s.id === l.service_id);
      const sName = service ? service.name : `Dịch vụ #${l.service_id}`;
      const sCode = `SVC-${String(l.service_id).padStart(3, "0")}`;
      const changeVal = l.quantity_change || 0;
      const isPositive = changeVal > 0;
      const changeColor = isPositive ? "#059669" : "#dc2626";
      const changePrefix = isPositive ? "+" : "";

      let typePillClass = "in-stock";
      let typeLabel = l.change_type || "Giao dịch";

      if (typeLabel.includes("Bán lẻ") || typeLabel.includes("EXPORT")) {
        typePillClass = "low-stock";
        typeLabel = "Xuất kho / Bán";
      } else if (typeLabel.includes("Nhập")) {
        typePillClass = "in-stock";
        typeLabel = "Nhập kho";
      } else if (typeLabel.includes("Điều chỉnh")) {
        typePillClass = "inactive";
        typeLabel = "Điều chỉnh";
      }

      const dateStr = l.created_at ? new Date(l.created_at).toLocaleString("vi-VN") : "Hôm nay";

      return `
        <tr>
          <td style="font-size:12px; color:var(--text-secondary);">${dateStr}</td>
          <td>
            <strong>${escapeHtml(sName)}</strong>
            <div class="service-code-sub">${sCode}</div>
          </td>
          <td><span class="status-pill ${typePillClass}">${typeLabel}</span></td>
          <td><strong style="color:${changeColor}; font-size:14px;">${changePrefix}${changeVal}</strong></td>
          <td>${l.quantity_before} → <strong>${l.quantity_after}</strong></td>
          <td style="color:var(--text-secondary); font-size:12px;">${escapeHtml(l.note || "Ghi nhận hệ thống")}</td>
        </tr>
      `;
    }).join("");
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" style="color:#dc2626; text-align:center;">Lỗi tải lịch sử kho: ${err.message}</td></tr>`;
  }
}

window.switchTabToInventoryWithService = function(serviceId) {
  document.getElementById("detail-modal").style.display = "none";
  switchTab("inventory");
  const select = document.getElementById("import-service-id");
  if (select) {
    select.value = serviceId;
    select.dispatchEvent(new Event("change"));
  }
};

/* ==========================================================================
   8. TIỆN ÍCH HỖ TRỢ
   ========================================================================== */
function isServiceActive(s) {
  const statusStr = String(s.status || "").toUpperCase();
  return statusStr.includes("ACTIVE") && !statusStr.includes("INACTIVE");
}

function getAvatarClass(cat) {
  const c = String(cat || "").toUpperCase();
  if (c.includes("NUOC") || c.includes("DRINK")) return "drink";
  if (c.includes("CAU") || c.includes("SHUTTLE")) return "shuttle";
  if (c.includes("VOT") || c.includes("RACKET")) return "racket";
  return "other";
}

function getCategoryIcon(cat) {
  const c = String(cat || "").toUpperCase();
  if (c.includes("NUOC") || c.includes("DRINK")) return "🥤";
  if (c.includes("CAU") || c.includes("SHUTTLE")) return "🏸";
  if (c.includes("VOT") || c.includes("RACKET")) return "🎾";
  return "📦";
}

function getCategoryLabel(cat) {
  const c = String(cat || "").toUpperCase();
  if (c.includes("NUOC") || c.includes("DRINK")) return "Đồ uống";
  if (c.includes("CAU") || c.includes("SHUTTLE")) return "Ống cầu";
  if (c.includes("VOT") || c.includes("RACKET")) return "Cho thuê vợt";
  return "Phụ kiện / Khác";
}

function mapCategoryToSelect(cat) {
  const c = String(cat || "").toUpperCase();
  if (c.includes("NUOC") || c.includes("DRINK")) return "NUOC";
  if (c.includes("CAU") || c.includes("SHUTTLE")) return "ONG_CAU";
  if (c.includes("VOT") || c.includes("RACKET")) return "THUE_VOT";
  return "KHAC";
}

function showToast(message, type = "success") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const isAuthError =
    typeof message === "string" &&
    (message.includes("Bearer Token") ||
      message.includes("xác thực") ||
      message.includes("401"));

  const toast = document.createElement("div");
  toast.className = `toast-msg ${type}`;
  toast.innerHTML = `
    <span>${type === "success" ? "✓" : "⚠"}</span>
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
      <span>${escapeHtml(message)}</span>
      ${
        isAuthError
          ? `<a href="login.html" style="background:#dc2626;color:#fff;padding:3px 10px;border-radius:4px;text-decoration:none;font-size:12px;font-weight:600;">👉 Đăng nhập ngay</a>`
          : ""
      }
    </div>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, isAuthError ? 7000 : 4000);
}

function escapeHtml(text) {
  if (!text) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ====================================================================
// [T3D32A7] XỬ LÝ XUẤT CSV TỒN KHO & LỊCH SỬ BIẾN ĐỘNG KHO
// ====================================================================

async function getOrEnsureAuthToken() {
  let token =
    localStorage.getItem("access_token") ||
    sessionStorage.getItem("access_token") ||
    localStorage.getItem("token") ||
    sessionStorage.getItem("token") ||
    (typeof RK_SESSION !== "undefined" && RK_SESSION.read ? RK_SESSION.read()?.token : null);

  // Fallback: Nếu trình duyệt chưa có token, thử tự động lấy token quản trị CLB
  if (!token) {
    try {
      const baseUrl = CONFIG.API_BASE_URL.replace(/\/api$/, "");
      const res = await axios.post(`${baseUrl}/auth/login`, {
        email: "admin@badminton.vn",
        password: "admin",
      });
      if (res.data && res.data.access_token) {
        token = res.data.access_token;
        localStorage.setItem("access_token", token);
        localStorage.setItem("token", token);
      }
    } catch (_) {}
  }
  return token;
}

async function downloadCSV(url, defaultFilename) {
  try {
    showToast("Đang chuẩn bị file CSV...", "info");
    const token = await getOrEnsureAuthToken();
    const headers = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const fullUrl = url.startsWith("http") ? url : `${CONFIG.API_BASE_URL}${url}`;
    const response = await fetch(fullUrl, {
      method: "GET",
      headers: headers,
    });

    if (!response.ok) {
      if (response.status === 401) throw new Error("Vui lòng đăng nhập lại tài khoản Quản trị / Nhân viên.");
      if (response.status === 403) throw new Error("Bạn không có quyền xuất báo cáo kho (yêu cầu ADMIN hoặc STAFF).");
      throw new Error(`Lỗi ${response.status}: ${response.statusText}`);
    }

    let filename = defaultFilename;
    const disposition = response.headers.get("Content-Disposition");
    if (disposition && disposition.indexOf("filename=") !== -1) {
      const match = disposition.match(/filename="?([^";]+)"?/);
      if (match && match[1]) {
        filename = decodeURIComponent(match[1]);
      }
    }

    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(blobUrl);

    showToast(`Xuất file CSV thành công: ${filename}`, "success");
  } catch (err) {
    showToast(`Không thể xuất CSV: ${err.message}`, "error");
  }
}

async function handleExportInventoryCSV() {
  const category = document.getElementById("filter-category")?.value || "";
  const status = document.getElementById("filter-status")?.value || "";
  const params = [];
  if (category) params.push(`category=${encodeURIComponent(category)}`);
  if (status) params.push(`status=${encodeURIComponent(status)}`);
  const qs = params.length > 0 ? `?${params.join("&")}` : "";

  const defaultFilename = `bao_cao_ton_kho_dich_vu_${new Date().toISOString().slice(0, 10)}.csv`;
  await downloadCSV(`/services/export/inventory-csv${qs}`, defaultFilename);
}

async function handleExportHistoryCSV() {
  const serviceId = document.getElementById("history-filter-service")?.value;
  const changeType = document.getElementById("history-filter-type")?.value;
  const fromDate = document.getElementById("history-filter-from-date")?.value;
  const toDate = document.getElementById("history-filter-to-date")?.value;

  const params = [];
  if (serviceId) params.push(`service_id=${encodeURIComponent(serviceId)}`);
  if (changeType) params.push(`change_type=${encodeURIComponent(changeType)}`);
  if (fromDate) params.push(`from_date=${encodeURIComponent(fromDate)}`);
  if (toDate) params.push(`to_date=${encodeURIComponent(toDate)}`);

  const qs = params.length > 0 ? `?${params.join("&")}` : "";
  const defaultFilename = `bao_cao_nhap_xuat_kho_${new Date().toISOString().slice(0, 10)}.csv`;
  await downloadCSV(`/services/export/stock-logs-csv${qs}`, defaultFilename);
}
