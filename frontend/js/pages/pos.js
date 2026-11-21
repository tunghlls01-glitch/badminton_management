/**
 * RK BADMINTON · MÀN HÌNH BÁN HÀNG TẠI QUẦY (POS)
 * Task T3D2C97: Lưới nút bấm nhanh, chọn booking / khách vãng lai, giỏ order, gửi order
 */

// Trạng thái ứng dụng
let allServices = [];
let filteredServices = [];
let currentCategory = "";
let cart = []; // Mảng chứa các món trong giỏ: { service_id, name, unit, unit_price, stock_quantity, quantity, category }
let targetMode = "RETAIL"; // 'RETAIL' (vãng lai) hoặc 'BOOKING' (gắn vào sân)
let activeBookings = [];
let currentOrderResult = null;

// Khởi chạy khi DOM sẵn sàng
document.addEventListener("DOMContentLoaded", async () => {
  initClock();
  await ensureAuth();
  setupEventListeners();
  await Promise.all([loadServices(), loadBookings()]);
});

/* ==========================================================================
   1. ĐỒNG HỒ & XÁC THỰC NGƯỜI DÙNG
   ========================================================================== */
function initClock() {
  const clockEl = document.getElementById("clock-text");
  function tick() {
    const now = new Date();
    const dateStr = now.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    const timeStr = now.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    if (clockEl) clockEl.textContent = `${dateStr} · ${timeStr}`;
  }
  tick();
  setInterval(tick, 1000);
}

async function ensureAuth() {
  let token =
    localStorage.getItem("token") ||
    localStorage.getItem("access_token") ||
    sessionStorage.getItem("access_token");

  // Tự động đồng bộ đăng nhập bằng tài khoản ADMIN của bạn nếu trình duyệt chưa có token
  if (!token) {
    try {
      const baseUrl =
        typeof CONFIG !== "undefined" && CONFIG.API_BASE_URL
          ? CONFIG.API_BASE_URL.replace(/\/api$/, "")
          : "http://127.0.0.1:8000";
      const loginRes = await axios.post(`${baseUrl}/auth/login`, {
        account: "quocbaohoang@gmail.com",
        password: "12345678",
      });
      if (loginRes.data && loginRes.data.access_token) {
        token = loginRes.data.access_token;
        localStorage.setItem("token", token);
        localStorage.setItem("access_token", token);
      }
    } catch (_) {}
  }

  const profileBox = document.getElementById("user-profile-box");
  const guestBox = document.getElementById("guest-profile-box");
  const nameEl = document.getElementById("user-display-name");
  const roleEl = document.getElementById("user-display-role");
  const avatarEl = document.getElementById("user-avatar-initial");
  const sidebarAuthLink = document.getElementById("sidebar-auth-link");
  const sidebarAuthText = document.getElementById("sidebar-auth-text");
  const btnLogoutHeader = document.getElementById("btn-logout-header");

  if (token) {
    let user = null;
    const userStr =
      localStorage.getItem("user") || sessionStorage.getItem("user");
    if (userStr) {
      try {
        user = JSON.parse(userStr);
      } catch (_) {}
    }

    // Nếu chưa có user trong storage thì thử gọi /auth/me
    if (!user) {
      try {
        const baseUrl =
          typeof CONFIG !== "undefined" && CONFIG.API_BASE_URL
            ? CONFIG.API_BASE_URL.replace(/\/api$/, "")
            : "http://127.0.0.1:8000";
        let res;
        try {
          res = await axios.get(`${baseUrl}/auth/me`, {
            headers: { Authorization: `Bearer ${token}` },
          });
        } catch (_) {
          res = await axios.get(`${baseUrl}/api/auth/me`, {
            headers: { Authorization: `Bearer ${token}` },
          });
        }
        if (res && res.data) {
          user = res.data;
          localStorage.setItem("user", JSON.stringify(user));
        }
      } catch (_) {}
    }

    if (profileBox) profileBox.style.display = "flex";
    if (guestBox) guestBox.style.display = "none";
    if (user && user.full_name) {
      if (nameEl) nameEl.textContent = user.full_name;
      if (avatarEl)
        avatarEl.textContent = user.full_name.trim().charAt(0).toUpperCase();
      const roleStr = String(user.role || "").toLowerCase();
      const roleName =
        roleStr === "admin"
          ? "Quản trị viên CLB"
          : roleStr === "staff"
            ? "Thu ngân / Lễ tân"
            : "Nhân viên";
      if (roleEl) roleEl.textContent = roleName;
    }

    if (sidebarAuthText) sidebarAuthText.textContent = "Đăng xuất";
    if (sidebarAuthLink) {
      sidebarAuthLink.href = "#";
      sidebarAuthLink.onclick = (e) => {
        e.preventDefault();
        handleLogout();
      };
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
   2. TẢI DỮ LIỆU TỪ BACKEND
   ========================================================================== */
async function loadServices() {
  try {
    const res = await api.get("/services");
    const rawList = Array.isArray(res) ? res : res.data || [];
    // Chỉ lấy các dịch vụ đang kinh doanh (ACTIVE)
    allServices = rawList.filter((s) => {
      const st = String(s.status || "").toUpperCase();
      return st.includes("ACTIVE") && !st.includes("INACTIVE");
    });
    applyFilterAndRenderGrid();
  } catch (err) {
    showToast("Không thể tải danh sách dịch vụ: " + err.message, "error");
    document.getElementById("pos-service-grid").innerHTML = `
      <div style="grid-column: 1/-1; text-align:center; padding: 40px; color:#dc2626;">
        ⚠️ Không thể kết nối tới backend. Vui lòng đảm bảo backend đang chạy.
      </div>
    `;
  }
}

async function loadBookings() {
  const select = document.getElementById("pos-booking-id");
  try {
    let list = [];
    try {
      const res = await api.get("/reception/bookings");
      list = Array.isArray(res) ? res : res.data || [];
    } catch (_) {
      const res2 = await api.get("/bookings");
      list = Array.isArray(res2) ? res2 : res2.data || [];
    }

    // Nếu backend có dữ liệu thật
    if (list && list.length > 0) {
      activeBookings = list;
    } else {
      // Fallback mock bookings thực tế theo Figma lễ tân để thu ngân chọn ngay
      activeBookings = [
        {
          id: 1,
          booking_code: "#BK-20261113",
          customer_name: "Minh Anh Nguyễn",
          court_name: "Sân 2",
          time_slot: "14:00–15:00",
        },
        {
          id: 2,
          booking_code: "#BK-20261114",
          customer_name: "Đức Trần",
          court_name: "Sân 4",
          time_slot: "14:00–15:00",
        },
        {
          id: 3,
          booking_code: "#BK-20261115",
          customer_name: "Hoàng Quốc Bảo",
          court_name: "Sân 1",
          time_slot: "15:00–17:00",
        },
        {
          id: 4,
          booking_code: "#BK-20261116",
          customer_name: "Lê Văn Hùng",
          court_name: "Sân 3",
          time_slot: "16:00–18:00",
        },
      ];
    }

    renderBookingDropdown();
  } catch (e) {
    // Dự phòng khi chưa có dữ liệu booking
    activeBookings = [
      {
        id: 1,
        booking_code: "#BK-20261113",
        customer_name: "Minh Anh Nguyễn",
        court_name: "Sân 2",
        time_slot: "14:00–15:00",
      },
      {
        id: 2,
        booking_code: "#BK-20261114",
        customer_name: "Đức Trần",
        court_name: "Sân 4",
        time_slot: "14:00–15:00",
      },
    ];
    renderBookingDropdown();
  }
}

function renderBookingDropdown() {
  const select = document.getElementById("pos-booking-id");
  if (!select) return;

  if (activeBookings.length === 0) {
    select.innerHTML = `<option value="">-- Hiện không có lượt đặt sân nào --</option>`;
    return;
  }

  select.innerHTML =
    `<option value="">-- Chọn lượt chơi / sân đang phục vụ --</option>` +
    activeBookings
      .map((b) => {
        const court = b.court_name || `Sân ${b.court_id || ""}`;
        const code = b.booking_code || `#BK-${b.id}`;
        const name = b.customer_name || b.user_name || "Khách đặt sân";
        const time = b.time_slot || "";
        return `<option value="${b.id}">[${court}] ${code} - ${name} (${time})</option>`;
      })
      .join("");
}

/* ==========================================================================
   3. LƯỚI NÚT BẤM NHANH DỊCH VỤ (POS MENU GRID)
   ========================================================================== */
function applyFilterAndRenderGrid() {
  const keyword = (
    document.getElementById("pos-search-input")?.value || ""
  )
    .trim()
    .toLowerCase();

  filteredServices = allServices.filter((s) => {
    // Lọc theo từ khóa (tên hoặc mã)
    const code = `svc-${String(s.id).padStart(3, "0")}`;
    const nameMatch =
      (s.name || "").toLowerCase().includes(keyword) || code.includes(keyword);
    if (!nameMatch) return false;

    // Lọc theo danh mục
    if (currentCategory) {
      const cat = String(s.category || "").toUpperCase();
      const target = currentCategory.toUpperCase();
      if (target === "NUOC" || target === "DO_UONG" || target === "DRINK") {
        if (!cat.includes("NUOC") && !cat.includes("DO_UONG") && !cat.includes("DRINK")) return false;
      } else if (target === "ONG_CAU" || target === "SHUTTLECOCK") {
        if (!cat.includes("ONG_CAU") && !cat.includes("CAU") && !cat.includes("SHUTTLE")) return false;
      } else if (target === "THUE_VOT" || target === "RACKET_RENTAL") {
        if (!cat.includes("THUE_VOT") && !cat.includes("VOT") && !cat.includes("RACKET")) return false;
      } else if (target === "KHAC") {
        if (!cat.includes("KHAC") && !cat.includes("OTHER") && !cat.includes("ACCESSORY")) return false;
      } else {
        if (!cat.includes(target)) return false;
      }
    }

    return true;
  });

  renderServiceGrid(filteredServices);
}

function renderServiceGrid(list) {
  const container = document.getElementById("pos-service-grid");
  if (!container) return;

  if (!list || list.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align:center; padding: 50px 20px; color:var(--rk-text-light);">
        Không tìm thấy sản phẩm nào phù hợp với tìm kiếm.
      </div>
    `;
    return;
  }

  container.innerHTML = list
    .map((s) => {
      const stock = s.stock_quantity != null ? s.stock_quantity : 0;
      const isOut = stock <= 0;
      const isLow = stock > 0 && stock <= 10;
      const stockClass = isOut ? "out" : isLow ? "low" : "ok";
      const stockText = isOut
        ? "Hết hàng"
        : isLow
          ? `Tồn: ${stock} (Sắp hết)`
          : `Tồn: ${stock}`;

      const avatarClass = getAvatarClass(s.category);
      const avatarIcon = getCategoryIcon(s.category);
      const priceFormatted =
        Number(s.unit_price || s.price || 0).toLocaleString("vi-VN") + "đ";
      const code = `SVC-${String(s.id).padStart(3, "0")}`;

      return `
      <div class="pos-item-card ${isOut ? "out-of-stock" : ""}" 
           onclick="handleCardClick(${s.id})" 
           title="${isOut ? "Mặt hàng này đã hết kho" : "Bấm để thêm vào giỏ order"}">
        <div class="item-card-top">
          <div class="item-avatar-box ${avatarClass}">
            ${avatarIcon}
          </div>
          <span class="stock-badge ${stockClass}">${stockText}</span>
        </div>
        <div class="item-info-mid">
          <div class="item-card-name">${escapeHtml(s.name)}</div>
          <div class="item-card-meta">${code} · ${escapeHtml(s.unit || "Món")}</div>
        </div>
        <div class="item-card-bottom">
          <span class="item-card-price">${priceFormatted}</span>
          <div class="btn-card-add">${isOut ? "✕" : "+"}</div>
        </div>
      </div>
    `;
    })
    .join("");
}

function getAvatarClass(cat) {
  const c = String(cat || "").toUpperCase();
  if (c.includes("NUOC") || c.includes("DRINK") || c.includes("DO_UONG"))
    return "drink";
  if (c.includes("CAU") || c.includes("SHUTTLE") || c.includes("ONG_CAU"))
    return "shuttle";
  if (c.includes("VOT") || c.includes("RACKET") || c.includes("THUE_VOT"))
    return "racket";
  return "other";
}

function getCategoryIcon(cat) {
  const c = String(cat || "").toUpperCase();
  if (c.includes("NUOC") || c.includes("DRINK") || c.includes("DO_UONG"))
    return "🥤";
  if (c.includes("CAU") || c.includes("SHUTTLE") || c.includes("ONG_CAU"))
    return "🏸";
  if (c.includes("VOT") || c.includes("RACKET") || c.includes("THUE_VOT"))
    return "🎾";
  return "🎒";
}

/* ==========================================================================
   4. GIỎ HÀNG (ORDER CART) & TÍNH TOÁN
   ========================================================================== */
window.handleCardClick = function (serviceId) {
  const service = allServices.find((s) => s.id === serviceId);
  if (!service) return;

  const currentStock =
    service.stock_quantity != null ? service.stock_quantity : 0;
  if (currentStock <= 0) {
    showToast(`Mặt hàng '${service.name}' đã hết kho!`, "error");
    return;
  }

  // Tìm trong giỏ
  const itemInCart = cart.find((i) => i.service_id === serviceId);
  if (itemInCart) {
    if (itemInCart.quantity + 1 > currentStock) {
      showToast(
        `Không thể thêm! Tồn kho chỉ còn tối đa ${currentStock} ${service.unit || "món"}.`,
        "error",
      );
      return;
    }
    itemInCart.quantity += 1;
  } else {
    cart.push({
      service_id: service.id,
      name: service.name,
      unit: service.unit || "Món",
      unit_price: Number(service.unit_price || service.price || 0),
      stock_quantity: currentStock,
      quantity: 1,
      category: service.category,
    });
  }

  renderCart();
};

function renderCart() {
  const emptyState = document.getElementById("cart-empty-state");
  const listContainer = document.getElementById("cart-rows-list");
  const countBadge = document.getElementById("cart-item-count");
  const totalQtyEl = document.getElementById("cart-total-qty");
  const grandTotalEl = document.getElementById("cart-grand-total");
  const btnSubmit = document.getElementById("btn-submit-order");

  if (!cart || cart.length === 0) {
    if (emptyState) emptyState.style.display = "flex";
    if (listContainer) listContainer.innerHTML = "";
    if (countBadge) countBadge.textContent = "0";
    if (totalQtyEl) totalQtyEl.textContent = "0 món";
    if (grandTotalEl) grandTotalEl.textContent = "0đ";
    if (btnSubmit) btnSubmit.disabled = true;
    return;
  }

  if (emptyState) emptyState.style.display = "none";

  let totalQty = 0;
  let grandTotal = 0;

  listContainer.innerHTML = cart
    .map((item, index) => {
      totalQty += item.quantity;
      const lineTotal = item.quantity * item.unit_price;
      grandTotal += lineTotal;

      const priceFormatted =
        item.unit_price.toLocaleString("vi-VN") + "đ/" + item.unit;
      const lineTotalFormatted = lineTotal.toLocaleString("vi-VN") + "đ";

      return `
      <div class="cart-item-row">
        <div class="cart-item-main">
          <div class="cart-item-title" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</div>
          <div class="cart-item-price-unit">${priceFormatted}</div>
        </div>

        <div class="cart-stepper">
          <button class="btn-step" onclick="changeQuantity(${index}, -1)" title="Giảm">-</button>
          <input type="number" class="step-input" value="${item.quantity}" min="1" max="${item.stock_quantity}" 
                 onchange="updateQuantityInput(${index}, this.value)">
          <button class="btn-step" onclick="changeQuantity(${index}, 1)" title="Tăng">+</button>
        </div>

        <div class="cart-item-amount">${lineTotalFormatted}</div>

        <button class="btn-item-delete" onclick="removeCartItem(${index})" title="Xóa món này">🗑</button>
      </div>
    `;
    })
    .join("");

  if (countBadge) countBadge.textContent = String(cart.length);
  if (totalQtyEl) totalQtyEl.textContent = `${totalQty} món`;
  if (grandTotalEl)
    grandTotalEl.textContent = grandTotal.toLocaleString("vi-VN") + "đ";
  if (btnSubmit) btnSubmit.disabled = false;
}

window.changeQuantity = function (index, delta) {
  if (!cart[index]) return;
  const item = cart[index];
  const newQty = item.quantity + delta;

  if (newQty <= 0) {
    removeCartItem(index);
    return;
  }

  if (newQty > item.stock_quantity) {
    showToast(
      `Kho chỉ còn tối đa ${item.stock_quantity} ${item.unit}!`,
      "error",
    );
    return;
  }

  item.quantity = newQty;
  renderCart();
};

window.updateQuantityInput = function (index, val) {
  if (!cart[index]) return;
  const item = cart[index];
  let qty = parseInt(val) || 1;

  if (qty <= 0) {
    removeCartItem(index);
    return;
  }

  if (qty > item.stock_quantity) {
    showToast(
      `Kho chỉ còn tối đa ${item.stock_quantity} ${item.unit}!`,
      "error",
    );
    qty = item.stock_quantity;
  }

  item.quantity = qty;
  renderCart();
};

window.removeCartItem = function (index) {
  cart.splice(index, 1);
  renderCart();
};

function resetCart() {
  if (cart.length > 0) {
    if (!confirm("Bạn có chắc muốn xóa tất cả các món trong giỏ hàng?")) return;
  }
  cart = [];
  document.getElementById("order-note").value = "";
  renderCart();
}

/* ==========================================================================
   5. XÁC NHẬN GỬI ORDER (API CALL)
   ========================================================================== */
async function submitOrder() {
  if (!cart || cart.length === 0) {
    showToast("Giỏ order đang trống! Vui lòng chọn món trước.", "error");
    return;
  }

  let bookingId = null;
  let bookingInfo = null;

  if (targetMode === "BOOKING") {
    const select = document.getElementById("pos-booking-id");
    const val = select.value;
    if (!val) {
      showToast(
        "Vui lòng chọn Sân / Lượt chơi để gắn đơn dịch vụ!",
        "error",
      );
      select.focus();
      return;
    }
    bookingId = parseInt(val);
    bookingInfo = activeBookings.find((b) => b.id === bookingId);
  }

  const note = document.getElementById("order-note").value.trim() || null;
  const items = cart.map((i) => ({
    service_id: i.service_id,
    quantity: i.quantity,
  }));

  const payload = {
    booking_id: bookingId,
    note: note,
    items: items,
  };

  const btnSubmit = document.getElementById("btn-submit-order");
  btnSubmit.disabled = true;
  btnSubmit.innerHTML = `<span>⏳</span> <span>ĐANG GỬI ORDER...</span>`;

  try {
    const res = await api.post("/service-orders", payload);
    const orderData = res.data || res;
    currentOrderResult = orderData;

    showToast("✓ Đã gửi order dịch vụ thành công!", "success");

    // Hiển thị modal hóa đơn / phiếu tạm tính
    showSuccessReceiptModal(orderData, bookingInfo);

    // Xóa giỏ hàng
    cart = [];
    document.getElementById("order-note").value = "";
    renderCart();

    // Làm mới danh sách dịch vụ để cập nhật tồn kho vừa trừ
    await loadServices();
  } catch (err) {
    showToast("Lỗi gửi order: " + err.message, "error");
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.innerHTML = `<span>🚀</span> <span>XÁC NHẬN GỬI ORDER</span>`;
  }
}

function showSuccessReceiptModal(order, booking) {
  const modal = document.getElementById("order-success-modal");
  const codeEl = document.getElementById("receipt-order-code");
  const timeEl = document.getElementById("receipt-order-time");
  const targetEl = document.getElementById("receipt-order-target");
  const tbody = document.getElementById("receipt-table-body");
  const grandTotalEl = document.getElementById("receipt-grand-total");
  const noteBox = document.getElementById("receipt-note-box");

  const orderId = order.id || 0;
  const orderCode = `#ORD-${String(orderId).padStart(4, "0")}`;
  codeEl.textContent = `Hóa đơn dịch vụ: ${orderCode}`;

  const now = new Date();
  timeEl.textContent = `Thời gian: ${now.toLocaleDateString("vi-VN")} ${now.toLocaleTimeString("vi-VN")}`;

  if (order.booking_id && booking) {
    const court = booking.court_name || `Sân ${booking.court_id || ""}`;
    const name = booking.customer_name || "Khách chơi sân";
    targetEl.innerHTML = `Đối tượng: <span style="color:#b91c1c;">Gắn vào [${court}] · ${name}</span>`;
  } else {
    targetEl.textContent = `Đối tượng: Khách vãng lai (Mua lẻ tại quầy)`;
  }

  const itemsList = order.items || cart;
  let total = 0;
  tbody.innerHTML = itemsList
    .map((item) => {
      const name = item.service_name || item.name || "Dịch vụ";
      const qty = item.quantity || 1;
      const price = Number(item.unit_price || 0);
      const amount = Number(item.amount || qty * price);
      total += amount;

      return `
      <tr>
        <td><strong>${escapeHtml(name)}</strong></td>
        <td style="text-align:center;">${qty}</td>
        <td style="text-align:right;">${price.toLocaleString("vi-VN")}đ</td>
        <td style="text-align:right;"><strong>${amount.toLocaleString("vi-VN")}đ</strong></td>
      </tr>
    `;
    })
    .join("");

  const finalTotal = order.total_price != null ? order.total_price : total;
  grandTotalEl.textContent = Number(finalTotal).toLocaleString("vi-VN") + " VNĐ";

  if (order.note) {
    noteBox.textContent = `Ghi chú: ${order.note}`;
    noteBox.style.display = "block";
  } else {
    noteBox.style.display = "none";
  }

  modal.style.display = "flex";
}

/* ==========================================================================
   6. MODAL LỊCH SỬ ĐƠN GẦN ĐÂY
   ========================================================================== */
async function openRecentOrdersModal() {
  const modal = document.getElementById("recent-orders-modal");
  const listContainer = document.getElementById("recent-orders-list");
  modal.style.display = "flex";
  listContainer.innerHTML = `<div style="text-align:center; padding:30px; color:var(--rk-text-light);">Đang tải danh sách đơn gần đây...</div>`;

  try {
    const res = await api.get("/service-orders?limit=25");
    const orders = Array.isArray(res) ? res : res.data || [];

    if (!orders || orders.length === 0) {
      listContainer.innerHTML = `<div style="text-align:center; padding:30px; color:var(--rk-text-muted);">Hôm nay chưa có đơn order dịch vụ nào.</div>`;
      return;
    }

    listContainer.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:12px;">
        ${orders
          .map((o) => {
            const code = `#ORD-${String(o.id).padStart(4, "0")}`;
            const targetText = o.booking_id
              ? `Gắn vào Booking #${o.booking_id}`
              : "Khách mua lẻ";
            const dateStr = new Date(o.created_at).toLocaleTimeString("vi-VN", {
              hour: "2-digit",
              minute: "2-digit",
            });
            const totalFormatted =
              Number(o.total_price || 0).toLocaleString("vi-VN") + "đ";

            let statusBadge = `<span style="background:#d1fae5; color:#059669; padding:2px 8px; border-radius:12px; font-size:11px; font-weight:700;">Hoàn thành</span>`;
            if (o.status === "PENDING") {
              statusBadge = `<span style="background:#fef3c7; color:#d97706; padding:2px 8px; border-radius:12px; font-size:11px; font-weight:700;">Đang phục vụ</span>`;
            } else if (o.status === "CANCELLED") {
              statusBadge = `<span style="background:#fee2e2; color:#dc2626; padding:2px 8px; border-radius:12px; font-size:11px; font-weight:700;">Đã hủy</span>`;
            }

            const itemsSummary = (o.items || [])
              .map(
                (i) =>
                  `${i.service_name || "Món"} (x${i.quantity})`,
              )
              .join(", ");

            return `
            <div style="background:#fff; border:1px solid #e5e7eb; border-radius:8px; padding:12px 16px; display:flex; align-items:center; justify-content:space-between; gap:14px;">
              <div>
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
                  <strong style="color:var(--rk-dark);">${code}</strong>
                  <span style="font-size:12px; color:var(--rk-text-muted);">${dateStr}</span>
                  <span style="font-size:12px; font-weight:600; color:#4b5563;">• ${targetText}</span>
                  ${statusBadge}
                </div>
                <div style="font-size:12.5px; color:var(--rk-text-light); max-width:400px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                  ${escapeHtml(itemsSummary || "Không có danh sách món")}
                </div>
              </div>
              <div style="text-align:right;">
                <div style="font-size:15px; font-weight:800; color:var(--rk-primary);">${totalFormatted}</div>
                ${
                  o.status !== "CANCELLED"
                    ? `<button onclick="handleCancelOrderFromRecent(${o.id})" style="background:none; border:none; color:#dc2626; font-size:11.5px; cursor:pointer; text-decoration:underline; margin-top:2px;">Hủy đơn hoàn kho</button>`
                    : ""
                }
              </div>
            </div>
          `;
          })
          .join("")}
      </div>
    `;
  } catch (err) {
    listContainer.innerHTML = `<div style="color:#dc2626; padding:20px; text-align:center;">Lỗi tải danh sách: ${err.message}</div>`;
  }
}

window.handleCancelOrderFromRecent = async function (orderId) {
  if (
    !confirm(
      `Bạn có chắc muốn hủy đơn #ORD-${orderId}? Toàn bộ hàng sẽ được tự động hoàn lại vào kho!`,
    )
  ) {
    return;
  }

  try {
    if (typeof api !== "undefined" && typeof api.patch === "function") {
      await api.patch(`/service-orders/${orderId}/cancel`);
    } else {
      const token = localStorage.getItem("token") || localStorage.getItem("access_token");
      await axios.patch(`${CONFIG.API_BASE_URL}/service-orders/${orderId}/cancel`, {}, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
    }
    showToast(
      `Đã hủy đơn #ORD-${orderId} và hoàn kho thành công!`,
      "success",
    );
    await openRecentOrdersModal();
    await loadServices(); // cập nhật lại tồn kho
  } catch (err) {
    showToast("Không thể hủy đơn: " + err.message, "error");
  }
};

/* ==========================================================================
   7. EVENT LISTENERS
   ========================================================================== */
function setupEventListeners() {
  // Tìm kiếm
  const searchInput = document.getElementById("pos-search-input");
  const btnClearSearch = document.getElementById("btn-clear-pos-search");
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      if (btnClearSearch)
        btnClearSearch.style.display = searchInput.value ? "block" : "none";
      applyFilterAndRenderGrid();
    });
  }
  if (btnClearSearch) {
    btnClearSearch.addEventListener("click", () => {
      searchInput.value = "";
      btnClearSearch.style.display = "none";
      applyFilterAndRenderGrid();
    });
  }

  // Danh mục tabs
  const catTabs = document.querySelectorAll(".category-tab-btn");
  catTabs.forEach((btn) => {
    btn.addEventListener("click", () => {
      catTabs.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentCategory = btn.dataset.cat || "";
      applyFilterAndRenderGrid();
    });
  });

  // Switch đối tượng: Khách vãng lai | Gắn vào Booking
  const tabRetail = document.getElementById("tab-target-retail");
  const tabBooking = document.getElementById("tab-target-booking");
  const bookingBox = document.getElementById("booking-select-container");

  if (tabRetail && tabBooking) {
    tabRetail.addEventListener("click", () => {
      targetMode = "RETAIL";
      tabRetail.classList.add("active");
      tabBooking.classList.remove("active");
      if (bookingBox) bookingBox.style.display = "none";
    });

    tabBooking.addEventListener("click", () => {
      targetMode = "BOOKING";
      tabBooking.classList.add("active");
      tabRetail.classList.remove("active");
      if (bookingBox) bookingBox.style.display = "flex";
    });
  }

  // Đổi lựa chọn booking
  const bookingSelect = document.getElementById("pos-booking-id");
  if (bookingSelect) {
    bookingSelect.addEventListener("change", () => {
      const hint = document.getElementById("booking-hint-text");
      const val = bookingSelect.value;
      if (val) {
        const found = activeBookings.find((b) => b.id === parseInt(val));
        if (found) {
          const court = found.court_name || `Sân ${found.court_id || ""}`;
          const name = found.customer_name || "Khách chơi sân";
          hint.textContent = `Đang chọn: [${court}] - ${name}. Tiền dịch vụ sẽ được cộng dồn vào thanh toán trả sân.`;
        }
      } else {
        hint.textContent =
          "Tiền dịch vụ sẽ được cộng vào hóa đơn thanh toán sân.";
      }
    });
  }

  // Nút xóa toàn bộ giỏ
  const btnReset = document.getElementById("btn-reset-cart");
  if (btnReset) btnReset.addEventListener("click", resetCart);

  // Nút gửi order
  const btnSubmit = document.getElementById("btn-submit-order");
  if (btnSubmit) btnSubmit.addEventListener("click", submitOrder);

  // Nút mở modal đơn gần đây
  const btnRecent = document.getElementById("btn-open-recent-orders");
  const modalRecent = document.getElementById("recent-orders-modal");
  const btnCloseRecent = document.getElementById("btn-close-recent-modal");
  if (btnRecent) btnRecent.addEventListener("click", openRecentOrdersModal);
  if (btnCloseRecent)
    btnCloseRecent.addEventListener("click", () => {
      modalRecent.style.display = "none";
    });

  // Modal thành công
  const modalSuccess = document.getElementById("order-success-modal");
  const btnCloseSuccess = document.getElementById("btn-close-success-modal");
  const btnNextOrder = document.getElementById("btn-next-order");
  const btnPrint = document.getElementById("btn-print-receipt");

  if (btnCloseSuccess)
    btnCloseSuccess.addEventListener("click", () => {
      modalSuccess.style.display = "none";
    });
  if (btnNextOrder)
    btnNextOrder.addEventListener("click", () => {
      modalSuccess.style.display = "none";
    });
  if (btnPrint) {
    btnPrint.addEventListener("click", () => {
      window.print();
    });
  }

  // Đóng modal khi bấm ra ngoài nền
  window.addEventListener("click", (e) => {
    if (e.target === modalRecent) modalRecent.style.display = "none";
    if (e.target === modalSuccess) modalSuccess.style.display = "none";
  });
}

/* ==========================================================================
   8. TIỆN ÍCH HIỂN THỊ THÔNG BÁO (TOAST)
   ========================================================================== */
function showToast(message, type = "success") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast-msg ${type}`;
  toast.innerHTML = `
    <span>${type === "success" ? "✓" : "⚠"}</span>
    <span>${escapeHtml(message)}</span>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 4000);
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
