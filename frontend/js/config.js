// Cấu hình chung của frontend.
// Đổi API_BASE_URL nếu backend chạy ở địa chỉ/cổng khác (hoặc khi deploy).
const CONFIG = {
  API_BASE_URL: location.pathname.startsWith("/web/")
    ? new URL("/api", location.origin).href
    : "http://127.0.0.1:8000/api",
  APP_NAME: "KS25 Base",
};
