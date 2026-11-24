// Layout chung: tự chèn header (menu) và footer vào mọi trang,
// để không phải copy lại HTML menu ở từng file.
//
// Mỗi trang cần có:  <body data-root="./">   (trang ở thư mục gốc)
//              hoặc  <body data-root="../">  (trang trong thư mục pages/)
// và hai thẻ rỗng:   <header id="app-header"></header> ... <footer id="app-footer"></footer>

// Danh sách các trang trong toàn bộ dự án
const MENU = [
  { href: "pages/customer-home.html", label: "Trang chủ KH" },
  { href: "pages/dashboard.html", label: "Tổng quan" },
  { href: "pages/courts.html", label: "Quản lý sân" },
  { href: "pages/booking.html", label: "Quản lý đặt sân" },
  { href: "pages/court_booking_schedule.html", label: "Lịch đặt sân" },
  { href: "pages/timeline_grid.html", label: "Lưới đặt sân" },
  { href: "pages/pricing.html", label: "Bảng giá" },
  { href: "pages/services.html", label: "Dịch vụ & Kho" },
  { href: "pages/pos.html", label: "Bán hàng POS" },
  { href: "pages/reception.html", label: "Nhận sân & Thanh toán" },
  { href: "pages/admin-users.html", label: "Nhân viên & KH" },
  { href: "pages/analytics.html", label: "Báo cáo DT" },
];

function renderLayout() {
  const root = document.body.dataset.root || "./";
  const currentPath = window.location.pathname;

  const links = MENU.map((item) => {
    const isActive = currentPath.endsWith("/" + item.href) ||
      (item.href === "index.html" && currentPath.endsWith("/"));
    return `<a href="${root}${item.href}" class="${isActive ? "active" : ""}">${item.label}</a>`;
  }).join("");

  document.getElementById("app-header").innerHTML = `
    <div class="container header-inner">
      <a href="${root}index.html" class="brand">
        <img src="${root}assets/images/logo.svg" alt="logo" width="28" height="28">
        <span>${CONFIG.APP_NAME}</span>
      </a>
      <nav class="nav">${links}</nav>
    </div>`;

  document.getElementById("app-footer").innerHTML = `
    <div class="container">© ${new Date().getFullYear()} HN-KS25-CNTT1 · Base code thực tập doanh nghiệp</div>`;
}

renderLayout();
