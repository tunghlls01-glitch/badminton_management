/**
 * RK Badminton Management - Hệ thống Đa Ngôn ngữ Hoàn Thiện (i18n: Tiếng Việt / English)
 * Tự động dịch toàn bộ thông tin trên giao diện tĩnh và động của hệ thống.
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "rk_app_language";

  const MONTHS_EN = [
    "", "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const MONTHS_SHORT_EN = [
    "", "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
    "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"
  ];

  const DAYS_SHORT = {
    "2": "Mon",
    "3": "Tue",
    "4": "Wed",
    "5": "Thu",
    "6": "Fri",
    "7": "Sat"
  };

  // Từ điển dịch thuật đầy đủ cho toàn bộ các trang và tính năng
  const DICTIONARY = {
    // Header & Sidebar Navigation
    "Trang chủ": "Home",
    "Trang Chủ": "Home",
    "Sân Nhà — Trang chủ": "San Nha — Home",
    "Điều hướng chính": "Main navigation",
    "Xem thông tin tài khoản": "View account details",
    "Thông tin": "Information",
    "Lọc lượt đặt": "Filter bookings",
    "09 – 15 tháng 11, 2026": "09 – 15 November, 2026",
    "TUẦN NÀY · 09–15 TH11": "THIS WEEK · 09–15 NOV",
    "Nhập lý do hủy sân (ví dụ: Sân cần bảo trì, sự cố kỹ thuật, lịch sự kiện đặc biệt...)": "Enter cancellation reason (e.g., maintenance, technical issue, special event...)",
    "Lịch đặt của tôi": "My Bookings",
    "Lịch của tôi": "My Bookings",
    "Lịch đặt sân": "Court Schedule",
    "Lịch sân": "Court Schedule",
    "Khám phá sân": "Explore Courts",
    "Danh sách sân": "Court List",
    "Bảng giá": "Pricing",
    "Ưu đãi": "Offers",
    "Hỗ trợ": "Support",
    "Tài khoản": "Account",
    "TÀI KHOẢN": "ACCOUNT",
    "ĐIỀU HƯỚNG": "NAVIGATION",
    "Hồ sơ cá nhân": "My Profile",
    "Hồ sơ tài khoản": "Account Profile",
    "Mở hồ sơ tài khoản": "Open Account Profile",
    "Hồ sơ": "Profile",
    "Đăng xuất": "Log Out",
    "Đăng nhập": "Log In",
    "Đăng ký": "Register",
    "Đăng xuất tài khoản": "Log Out Account",
    "Đổi mật khẩu": "Change Password",
    "Quản lý": "Management",
    "Cài đặt": "Settings",
    "Xem trang khách hàng": "View Customer Site",
    "TP. Hà Nội": "Hanoi City",
    "Xem thông báo": "View Notifications",
    "Thông báo": "Notifications",
    "Hộp thư đến": "Inbox",
    "Đã đọc tất cả": "Mark all as read",
    "Menu chính": "Main Menu",

    // Banner & Giới thiệu
    "RA SÂN. KẾT NỐI. HẾT MÌNH.": "PLAY. CONNECT. INSPIRE.",
    "Mỗi trận đấu, một niềm vui.": "Every match, a joy.",
    "QUẢN LÝ LỊCH CHƠI": "SCHEDULE MANAGEMENT",
    "Lịch đặt sân của tôi": "My Court Bookings",
    "Theo dõi lịch chơi, sẵn sàng cho mỗi trận đấu.": "Track your schedule, ready for every match.",
    "Đặt sân mới": "Book New Court",
    "Đặt cố định hàng tuần": "Weekly Recurring Booking",
    "Đặt theo lượt": "Single Booking",
    "Đặt cố định hàng tuần (4–8 tuần)": "Weekly Booking (4–8 weeks)",
    "Đặt sân cố định hàng tuần": "Book Weekly Recurring Court",
    "Cần một chút hỗ trợ?": "Need some assistance?",
    "Đội ngũ Sân Nhà luôn sẵn sàng đồng hành cùng bạn.": "Our team is always here to support you.",
    "Liên hệ với chúng tôi": "Contact Us",
    "Sân Nhà luôn sẵn sàng": "San Nha is always here",
    "Thời gian hỗ trợ: 07:00 – 22:00 mỗi ngày.": "Support hours: 07:00 – 22:00 daily.",
    "Ưu đãi dành cho bạn": "Exclusive Offers For You",
    "CHƠI NHIỀU HƠN, VUI NHIỀU HƠN": "PLAY MORE, ENJOY MORE",
    "Giảm 15% lượt đặt đầu": "15% off first booking",
    "Mã ưu đãi sẽ tự động nhập khi bạn đặt sân lần đầu": "Discount code will be applied automatically on your first booking",
    "Điều khoản": "Terms",
    "Điều khoản sử dụng": "Terms of Use",
    "Tài khoản của tôi": "My Account",
    "Hạng thành viên": "Membership Tier",
    "Sân Nhà — Đặt sân thể thao": "San Nha — Sports Court Booking",

    // Tổng quan thống kê (Overview)
    "Tổng quan lịch chơi": "Booking Overview",
    "Sắp diễn ra": "Upcoming",
    "Đã hoàn thành": "Completed",
    "Thời lượng tuần này": "Duration This Week",
    "TUẦN NÀY": "THIS WEEK",
    "Tuần này": "This Week",
    "giờ": "hrs",
    "Thời lượng": "Duration",
    "Tất cả các sân": "All Courts",
    "Tuần trước": "Previous Week",
    "Tuần sau": "Next Week",
    "Lịch đặt sân theo tuần": "Weekly Court Schedule",

    // Lượt đặt tiếp theo (Next match card)
    "Lượt đặt tiếp theo": "Next Booking",
    "Lượt đặt sắp tới": "Upcoming Booking",
    "CẦU LÔNG": "BADMINTON",
    "Cầu lông": "Badminton",
    "Sân cầu lông Phú Thọ": "Phu Tho Badminton Court",
    "Sân cầu lông Tân Phú": "Tan Phu Badminton Court",
    "Pickleball Riverside": "Pickleball Riverside",
    "219 Lý Thường Kiệt, Quận 11": "219 Ly Thuong Kiet, Dist. 11",
    "NGÀY CHƠI": "MATCH DATE",
    "KHUNG GIỜ": "TIME SLOT",
    "Xem lịch đặt sân": "View Court Schedule",
    "Vui lòng có mặt trước giờ chơi 15 phút để chuẩn bị cho trận đấu.": "Please arrive 15 minutes before your match time.",
    "Chưa có lượt đặt": "No upcoming bookings",
    "Hãy đặt sân để thêm lịch chơi mới.": "Book a court to add a new match schedule.",

    // Bảng danh sách lượt đặt & Bộ lọc
    "Các lượt đặt của bạn": "Your Bookings",
    "Lịch sử / Đã hủy": "History / Cancelled",
    "Tất cả": "All",
    "SÂN / ĐỊA ĐIỂM": "COURT / LOCATION",
    "NGÀY / GIỜ": "DATE / TIME",
    "THÀNH TIỀN": "AMOUNT",
    "TRẠNG THÁI": "STATUS",
    "Chưa có lượt đặt trong mục này.": "No bookings found in this section.",
    "Đã xác nhận": "Confirmed",
    "Chờ xác nhận": "Pending Confirmation",
    "Đã hủy": "Cancelled",
    "Chờ thanh toán": "Pending Payment",
    "Đã thanh toán": "Paid",
    "Chi tiết": "Details",
    "Xem chi tiết": "View Details",
    "Thao tác": "Actions",

    // Form Đặt sân (Single & Recurring)
    "Chọn địa điểm và khung giờ phù hợp. Lượt đặt sẽ được cập nhật vào lịch của bạn.": "Select a location and suitable time slot. Bookings will be updated to your schedule.",
    "Họ tên khách hàng": "Customer Name",
    "Nhập tên người đặt": "Enter customer name",
    "Số điện thoại": "Phone Number",
    "Nhập số điện thoại": "Enter phone number",
    "Địa điểm": "Venue / Location",
    "Sân": "Court",
    "Chọn sân": "Select Court",
    "Đang tải danh sách sân...": "Loading court list...",
    "Sân tiêu chuẩn": "Standard Court",
    "Sân VIP": "VIP Court",

    // Database Courts & Descriptions (Thông tin sân từ database)
    "Sân số 1": "Court 1",
    "Sân số 2": "Court 2",
    "Sân số 3": "Court 3",
    "Sân số 4": "Court 4",
    "Sân số 5": "Court 5",
    "Sân số 6": "Court 6",
    "Sân số 4 (VIP)": "Court 4 (VIP)",
    "Sân số 5 (VIP)": "Court 5 (VIP)",
    "Sân 1": "Court 1",
    "Sân 2": "Court 2",
    "Sân 3": "Court 3",
    "Sân 4": "Court 4",
    "Sân 5": "Court 5",
    "Sân 6": "Court 6",
    "Sân 7": "Court 7",
    "Sân 8": "Court 8",
    "Sân 01": "Court 01",
    "Sân 02": "Court 02",
    "Sân 03": "Court 03",
    "Sân 04": "Court 04",
    "Sân 05": "Court 05",
    "Sân 06": "Court 06",
    "Sân 01 - Sân Trung Tâm": "Court 01 - Center Court",
    "Sân 02 - Sẵn sàng xuất phát": "Court 02 - Ready to Launch",
    "Sân 03 - Đấu trường Xanh": "Court 03 - Green Arena",
    "Sân thảm tiêu chuẩn thi đấu, ánh sáng chống chói.": "Tournament-standard mat court with anti-glare lighting.",
    "Sân thảm chất lượng cao, độ bám tốt, thích hợp đánh đơn và đôi.": "High-quality mat court with superior traction, ideal for singles and doubles.",
    "Thảm PVC 5 lớp đàn hồi cao, giảm chấn thương khớp gối.": "5-layer high-resilience PVC mat, minimizing knee and joint fatigue.",
    "Sân phòng lạnh riêng biệt, khán đài mini, nước uống miễn phí.": "Private air-conditioned court, mini grandstand, complimentary refreshments.",
    "Sân thi đấu chuyên nghiệp, hệ thống camera xem lại pha bóng.": "Professional tournament court with instant match replay cameras.",
    "Sân đang thay thảm mới và bảo trì dàn đèn chiếu sáng.": "Court currently undergoing mat renewal and lighting maintenance.",
    "HOẠT ĐỘNG": "ACTIVE",
    "BẢO TRÌ": "MAINTENANCE",
    "Hoạt động": "Active",
    "Tất cả sân": "All Courts",
    "Khán đài mini": "Mini grandstand",
    "Thảm PVC cao cấp": "Premium PVC Mat",
    "Tiêu chuẩn": "Standard",

    // Notes & Footers (Tất cả ghi chú, lưu ý và chân trang)
    "© 2026 Sân Nhà. Mỗi trận đấu, một niềm vui.": "© 2026 San Nha. Every match, a joy.",
    "© 2026 Sân Nhà. Đặt sân · Lịch của tôi": "© 2026 San Nha. Book Court · My Bookings",
    "© 2026 Sân Nhà.": "© 2026 San Nha.",
    "Mỗi trận đấu, một niềm vui.": "Every match, a joy.",
    "Ưu đãi minh họa. Chức năng áp dụng mã và thanh toán chưa được kết nối trong bản demo.": "Promotional demo. Promo code and payment integration are demo only.",
    "Trang này là giao diện demo. Giá, địa điểm và thông tin đặt sân chỉ mang tính minh họa; không có giao dịch thanh toán thực tế.": "This is a demo interface. Pricing, locations, and booking details are for illustration; no actual payment transactions occur.",
    "Vui lòng kiểm tra sân, ngày và giờ trước khi xác nhận. Liên hệ bộ phận hỗ trợ nếu bạn cần điều chỉnh lịch chơi.": "Please verify court, date, and time before confirming. Contact support for any adjustments.",
    "Áp dụng cho 1 sân. Giá tham khảo theo thiết kế; vui lòng xác nhận giá thực tế theo sân và khung giờ trước khi đặt.": "Applies to 1 court. Reference rates; please confirm actual rates by court and time slot before booking.",
    "Vui lòng bật JavaScript để đăng nhập và tải dữ liệu.": "Please enable JavaScript to log in and load data.",
    "Vui lòng có mặt trước giờ chơi 15 phút để chuẩn bị cho trận đấu.": "Please arrive 15 minutes before your match time to prepare.",
    "Vui lòng đến trước 15 phút. Đưa mã đặt sân cho nhân viên tại quầy để nhận sân.": "Please arrive 15 minutes early. Present booking code at the counter to claim your court.",
    "Thanh toán trực tiếp tại sân. Thông tin đặt sân sẽ được lưu vào cơ sở dữ liệu.": "Pay directly at the court. Booking info will be saved to database.",
    "Admin có thể hủy bất kỳ lúc nào. Chính sách hoàn tiền áp dụng bình thường nếu còn trước giờ chơi. Hệ thống sẽ tự động gửi thông báo đến khách hàng.": "Admin can cancel at any time. Standard refund policy applies before play time. The system will notify the customer automatically.",
    "Lý do này sẽ được gửi cho khách hàng qua hệ thống thông báo.": "This reason will be sent to the customer via notifications.",
    "Sau khi hủy, khung giờ sẽ được mở lại cho người khác đặt.": "Once cancelled, this time slot will be reopened for other players.",
    "Đặt cùng sân, cùng giờ, cùng thứ trong 4–8 tuần liên tiếp. Hệ thống sẽ kiểm tra từng tuần và cho bạn chọn bỏ qua tuần bị trùng.": "Book the same court, time, and day for 4–8 consecutive weeks. The system will check availability each week and allow you to skip conflicting dates.",
    "Chọn địa điểm và khung giờ phù hợp. Lượt đặt sẽ được cập nhật vào lịch của bạn.": "Select a location and suitable time slot. Bookings will be updated to your schedule.",
    "Đã qua giờ bắt đầu trận đấu, không thể hủy đặt sân.": "Past match start time, cancellation is no longer possible.",
    "Đã qua giờ bắt đầu — chỉ admin mới có thể hủy (không hoàn tiền).": "Past start time — only admin can cancel (no refund).",
    "Hủy trước 24 giờ: Hoàn lại 100% tổng tiền": "Cancel 24+ hrs ahead: 100% full refund",
    "Hủy trước 6 giờ (từ 6h – 24h): Hoàn lại 50% tổng tiền": "Cancel 6-24 hrs ahead: 50% refund",
    "Hủy dưới 6 giờ trước giờ vào sân: Không hoàn tiền (0%)": "Cancel under 6 hrs: No refund (0%)",
    "Thời gian hỗ trợ: 07:00 – 22:00 mỗi ngày.": "Support hours: 07:00 – 22:00 daily.",

    // Chi tiết nhỏ (Small details, badges, tags)
    "(bắt buộc)": "(required)",
    "(tùy chọn)": "(optional)",
    "(không bắt buộc):": "(optional):",
    "(bắt buộc):": "(required):",
    "(Đã gồm VAT):": "(VAT incl.):",
    "(Đã gồm VAT)": "(VAT incl.)",
    "Đã bao gồm VAT": "VAT Included",
    "(các tuần đã chọn)": "(selected weeks)",
    "(4–8 tuần)": "(4–8 weeks)",
    "(Bảo trì)": "(Maintenance)",
    " (Bảo trì)": " (Maintenance)",
    "(Admin)": "(Admin)",
    "(Admin) — Gửi thông báo": "(Admin) — Send Notification",
    "(Quyền Admin)": "(Admin Role)",
    "Mở điều hướng": "Open navigation",
    "Đóng điều hướng": "Close navigation",
    "Khách": "Guest",
    "ngày": "days",
    "tuần": "weeks",
    "phút": "minutes",
    "15 phút": "15 minutes",
    "trước giờ chơi 15 phút": "15 minutes before play",
    "Chưa có lượt đặt": "No upcoming bookings",
    "Hãy đặt sân để thêm lịch chơi mới.": "Book a court to add a new match schedule.",
    "Sân thể thao Sân Nhà": "San Nha Sports Complex",
    "Pickleball": "Pickleball",
    "Ngày chơi": "Match Date",
    "Ngày bắt đầu": "Start Date",
    "Giờ bắt đầu": "Start Time",
    "Khung giờ": "Time Slot",
    "Giờ chơi": "Play Time",
    "Ghi chú khi đặt sân (tùy chọn)": "Booking notes (optional)",
    "Ghi chú (tùy chọn)": "Notes (optional)",
    "Ghi chú": "Notes",
    "Nhập ghi chú": "Enter notes",
    "Tạm tính": "Subtotal",
    "Tổng tiền": "Total Amount",
    "Tổng cộng": "Total",
    "Xác nhận đặt sân": "Confirm Booking",
    "Thanh toán trực tiếp tại sân. Thông tin đặt sân sẽ được lưu vào cơ sở dữ liệu.": "Pay directly at the court. Booking info will be saved.",
    "Thanh toán trực tiếp tại sân": "Pay at counter",
    "Đặt cùng sân, cùng giờ, cùng thứ trong 4–8 tuần liên tiếp. Hệ thống sẽ kiểm tra từng tuần và cho bạn chọn bỏ qua tuần bị trùng.": "Book the same court, time, and day for 4–8 consecutive weeks. The system will check availability each week and let you skip conflicting dates.",
    "Số tuần": "Number of Weeks",
    "Kiểm tra lịch trống các tuần": "Check Availability Across Weeks",
    "Tổng tiền (các tuần đã chọn)": "Total Amount (Selected Weeks)",
    "Xác nhận đặt cố định": "Confirm Recurring Booking",
    "Tuần trống": "Available weeks",
    "Tuần bị trùng": "Conflicted weeks",
    "Tổng tuần": "Total weeks",
    "Đã có người đặt": "Already booked",
    "(Bảo trì)": "(Maintenance)",
    "Bảo trì": "Maintenance",

    // Modal Chi tiết & Hủy sân
    "Chi tiết đặt sân": "Booking Details",
    "Mã lượt đặt": "Booking Code",
    "Mã đặt sân": "Booking Code",
    "Khách hàng": "Customer",
    "Họ tên": "Full Name",
    "Điện thoại": "Phone",
    "Vui lòng đến trước 15 phút. Đưa mã đặt sân cho nhân viên tại quầy để nhận sân.": "Please arrive 15 minutes early. Present booking code at the counter to check in.",
    "Hủy đặt sân này": "Cancel This Booking",
    "Hủy đặt sân": "Cancel Booking",
    "Xác nhận hủy đặt sân": "Confirm Cancellation",
    "Hủy sân (Admin)": "Cancel Court (Admin)",
    "Hủy sân (Admin) — Gửi thông báo": "Cancel Court (Admin) — Send Notification",
    "Hủy sân (Quyền Admin)": "Cancel Court (Admin Role)",
    "Xác nhận hủy & gửi thông báo": "Confirm Cancel & Notify",
    "Lịch đặt này đã được hủy": "This booking has been cancelled",
    "Trận đấu đã hoàn thành": "Match completed",
    "Đã qua giờ bắt đầu trận đấu, không thể hủy đặt sân.": "Past match start time, cancellation is no longer possible.",
    "Đã qua giờ bắt đầu — chỉ admin mới có thể hủy (không hoàn tiền).": "Past start time — only admin can cancel (no refund).",
    "Bạn đang yêu cầu hủy lượt đặt sân tại": "You are requesting to cancel booking at",
    "Chính sách hoàn tiền:": "Refund Policy:",
    "Hủy trước 24 giờ: Hoàn lại 100% tổng tiền": "Cancel 24+ hrs ahead: 100% full refund",
    "Hủy trước 6 giờ (từ 6h – 24h): Hoàn lại 50% tổng tiền": "Cancel 6-24 hrs ahead: 50% refund",
    "Hủy dưới 6 giờ trước giờ vào sân: Không hoàn tiền (0%)": "Cancel under 6 hrs: No refund (0%)",
    "Dự kiến hoàn": "Estimated Refund",
    "Dự kiến hoàn:": "Estimated Refund:",
    "Sau khi hủy, khung giờ sẽ được mở lại cho người khác đặt.": "Once cancelled, this time slot will be reopened for other players.",
    "Lý do hủy (không bắt buộc):": "Cancellation reason (optional):",
    "Lý do hủy": "Cancellation Reason",
    "Lý do này sẽ được gửi cho khách hàng qua hệ thống thông báo.": "This reason will be sent to the customer via notifications.",
    "Nhập lý do hủy (ví dụ: Sân cần bảo trì, sự cố kỹ thuật, lịch sự kiện đặc biệt...)": "Enter cancellation reason (e.g., maintenance, technical issue, special event...)",
    "Admin có thể hủy bất kỳ lúc nào. Chính sách hoàn tiền áp dụng bình thường nếu còn trước giờ chơi. Hệ thống sẽ tự động gửi thông báo đến khách hàng.": "Admin can cancel at any time. Standard refund policy applies before play time. The system will notify the customer automatically.",
    "Lưu ý:": "Note:",
    "⚠ Lưu ý:": "⚠ Note:",
    "Hủy bỏ": "Cancel",
    "Ở lại": "Stay",
    "Quay lại": "Back",
    "← Quay lại": "← Back",
    "Đóng": "Close",
    "Thử lại": "Retry",
    "Hủy sân thành công!": "Booking cancelled successfully!",
    "Đã thêm lịch đặt sân mới!": "New booking created successfully!",
    "Đã đến hoặc qua giờ vào sân, không thể hủy!": "Match time reached, cancellation not allowed!",
    "Không thể hủy đặt sân vào lúc này!": "Cannot cancel booking at this time!",

    // Dialog Đăng xuất
    "Kết thúc phiên làm việc của bạn?": "End your current session?",
    "Sau khi đăng xuất, bạn sẽ cần đăng nhập lại để xem lịch cá nhân và thực hiện các giao dịch mới.": "After logging out, you will need to log in again to view your schedule and make new bookings.",
    "Bạn chưa đăng nhập vào hệ thống.": "You are not currently logged in.",
    "Đăng ký ngay": "Register now",
    "Đăng nhập ngay": "Log in now",
    "Đã đăng xuất thành công.": "Logged out successfully.",

    // Grid & Giữ chỗ (timeline_grid.html)
    "Bảng lưới chọn sân và giờ": "Court & Time Grid Selector",
    "Chọn khung giờ & sân trống": "Select Time Slot & Available Court",
    "Chưa chọn khung giờ nào": "No time slot selected",
    "Hết thời gian giữ chỗ": "Hold time expired",
    "Khung giờ vừa hết chỗ": "Slot just became unavailable",
    "Xác nhận thông tin giữ chỗ": "Confirm Hold Details",
    "Xác nhận hủy giữ chỗ?": "Confirm Cancel Hold?",
    "Hủy giữ": "Cancel Hold",
    "Đang chọn": "Selecting",
    "Còn trống": "Available",
    "Trống": "Available",
    "Đã đặt": "Booked",
    "Khoá": "Locked",
    "Đã bao gồm VAT": "VAT Included",
    "Tổng cộng (Đã gồm VAT):": "Total (VAT incl.):",
    "Tổng thanh toán": "Total Payment",
    "Xem các ngày tiếp theo": "View Upcoming Days",
    "Quay lại chỉnh sửa": "Back to Edit",
    "Sự kiện": "Events",
    "Đang kiểm tra đăng nhập...": "Checking authentication...",
    "Chọn tháng": "Select Month",
    "Chọn ngày đặt sân": "Select Date",
    "Cuối tuần": "Weekend",
    "Ngày thường": "Weekday",
    "Hôm nay": "Today",
    "Lưới sân đã được cập nhật.": "Court grid updated.",
    "Vui lòng đăng nhập trước khi đặt sân.": "Please log in before booking.",

    // Profile & Đổi mật khẩu
    "Thông tin cá nhân": "Personal Information",
    "Cập nhật thông tin cá nhân và quản lý mật khẩu của bạn.": "Update your personal details and manage your password.",
    "Thay đổi ảnh": "Change Avatar",
    "PNG, JPEG hoặc WebP · Tối đa 1 MB": "PNG, JPEG or WebP · Max 1 MB",
    "Email (chỉ đọc)": "Email (read only)",
    "Lưu thay đổi": "Save Changes",
    "Mật khẩu cũ": "Current Password",
    "Nhập mật khẩu cũ": "Enter current password",
    "Mật khẩu mới": "New Password",
    "Nhập mật khẩu mới": "Enter new password",
    "Tối đa 72 byte UTF-8.": "Max 72 UTF-8 bytes.",
    "Xác nhận mật khẩu mới": "Confirm New Password",
    "Nhập lại mật khẩu mới": "Re-enter new password",
    "Cập nhật mật khẩu": "Update Password",

    // Customer Home Page
    "MỞ CỬA HÀNG NGÀY 06:00 - 23:00": "OPEN DAILY 06:00 - 23:00",
    "Sân chuẩn thi đấu.": "Tournament-Grade Courts.",
    "Sẵn sàng bùng nổ.": "Ready for Action.",
    "Đặt sân nhanh chóng, không cần chờ đợi.": "Fast booking, zero waiting.",
    "Chọn sân yêu thích, khung giờ phù hợp và ra sân ngay.": "Choose your court, pick your slot and get playing.",
    "Đặt sân ngay": "Book Now",
    "Xem danh sách sân": "View Court List",
    "Mặt sân đạt chuẩn thi đấu": "Tournament-grade court surface",
    "Đặt sân trực tuyến dễ dàng": "Effortless online court booking",
    "KHÔNG GIAN THỂ THAO CHO MỌI TRÌNH ĐỘ": "SPORTS DESTINATION FOR ALL LEVELS",
    "Sân tiêu chuẩn giải đấu. Phục vụ mỗi ngày.": "Tournament standard courts. Open every day.",
    "Sân cầu lông cho mọi trình độ.": "Badminton courts for all skill levels.",
    "Bảng giá tham khảo, cuộn ngang trên điện thoại": "Reference pricing, swipe horizontally on mobile",
    "BẢNG GIÁ THAM KHẢO": "REFERENCE PRICING",
    "Bảng giá dịch vụ": "Pricing & Rates",
    "Bảng giá minh bạch, không phí ẩn.": "Transparent rates, no hidden fees.",
    "Buổi sáng - Tiêu chuẩn": "Morning - Standard",
    "Buổi chiều - Phổ thông": "Afternoon - Regular",
    "Buổi tối - Giờ cao điểm": "Evening - Peak Hours",
    "Buổi sáng": "Morning",
    "Buổi chiều": "Afternoon",
    "Buổi tối": "Evening",
    "NGÀY THƯỜNG (T2 - T6)": "WEEKDAYS (MON - FRI)",
    "CUỐI TUẦN (T7 - CN)": "WEEKENDS (SAT - SUN)",
    "Chơi thả ga, giá hợp lý.": "Play freely, fair pricing.",
    "/ giờ": "/ hr",
    "Sân 01 - Sân Trung Tâm": "Court 01 - Center Court",
    "Sân 02 - Sẵn sàng xuất phát": "Court 02 - Ready to Launch",
    "Sân 03 - Đấu trường Xanh": "Court 03 - Green Arena",

    // Vai trò & Thành viên
    "Quản trị viên": "Administrator",
    "Nhân viên": "Staff",
    "Khách hàng": "Customer",
    "Thành viên Sân Nhà": "Club Member",
    "Thành viên": "Member",
    "Chưa đăng nhập": "Not logged in",
    "Bấm để đăng nhập": "Click to log in",
    "Đang tải...": "Loading...",

    // Thứ ngày tháng
    "Thứ Hai": "Monday",
    "Thứ Ba": "Tuesday",
    "Thứ Tư": "Wednesday",
    "Thứ Năm": "Thursday",
    "Thứ Sáu": "Friday",
    "Thứ Bảy": "Saturday",
    "Chủ Nhật": "Sunday",
    "Thứ hai": "Monday",
    "Thứ ba": "Tuesday",
    "Thứ tư": "Wednesday",
    "Thứ năm": "Thursday",
    "Thứ sáu": "Friday",
    "Thứ bảy": "Saturday",
    "Chủ nhật": "Sunday",
    "Thứ 2": "Mon",
    "Thứ 3": "Tue",
    "Thứ 4": "Wed",
    "Thứ 5": "Thu",
    "Thứ 6": "Fri",
    "Thứ 7": "Sat",
    "CN": "Sun",
    "T2": "Mon",
    "T3": "Tue",
    "T4": "Wed",
    "T5": "Thu",
    "T6": "Fri",
    "T7": "Sat",

    // Thời lượng & Tuần options
    "1 giờ": "1 hour",
    "1,5 giờ": "1.5 hours",
    "2 giờ": "2 hours",
    "4 tuần": "4 weeks",
    "5 tuần": "5 weeks",
    "6 tuần": "6 weeks",
    "7 tuần": "7 weeks",
    "8 tuần": "8 weeks"
  };

  // Map ngược lại EN -> VI
  const REVERSE_DICTIONARY = {};
  for (const [vi, en] of Object.entries(DICTIONARY)) {
    REVERSE_DICTIONARY[en] = vi;
  }

  // Danh sách cụm từ sắp xếp theo độ dài giảm dần để thay thế cụm dài trước
  const SORTED_VI_KEYS = Object.keys(DICTIONARY).sort((a, b) => b.length - a.length);

  let currentLang = localStorage.getItem(STORAGE_KEY) || "vi";

  function getLang() {
    return currentLang;
  }

  function setLang(lang) {
    if (lang !== "vi" && lang !== "en") lang = "vi";
    currentLang = lang;
    localStorage.setItem(STORAGE_KEY, lang);
    applyLanguage(lang);
    updateSwitcherUI(lang);
    try {
      global.dispatchEvent(new CustomEvent("rk:language-change", { detail: lang }));
    } catch (_) {}
  }

  // Hàm dịch chuỗi nâng cao (kết hợp exact, pattern và substring replacement)
  function translateStringEN(raw) {
    if (!raw || typeof raw !== "string") return raw;
    const trimmed = raw.trim();

    // 1. Khớp nguyên chuỗi chính xác
    if (DICTIONARY[trimmed]) {
      return raw.replace(trimmed, DICTIONARY[trimmed]);
    }

    let text = raw;

    // 2. Pattern: Ngày tháng dạng "09 – 15 tháng 11, 2026" hoặc "tháng 11"
    text = text.replace(/(\d{1,2})\s*[–-]\s*(\d{1,2})\s*tháng\s*(\d{1,2}),\s*(\d{4})/gi, (_, d1, d2, m, y) => {
      const monthName = MONTHS_EN[parseInt(m, 10)] || `Month ${m}`;
      return `${d1} – ${d2} ${monthName}, ${y}`;
    });
    text = text.replace(/\btháng\s*(\d{1,2})\b/gi, (_, m) => {
      return MONTHS_EN[parseInt(m, 10)] || `Month ${m}`;
    });

    // 3. Pattern: "TUẦN NÀY · 09–15 TH11"
    text = text.replace(/TUẦN NÀY\s*·\s*(\d{1,2})[–-](\d{1,2})\s*TH(\d{1,2})/gi, (_, d1, d2, m) => {
      const monthShort = MONTHS_SHORT_EN[parseInt(m, 10)] || `M${m}`;
      return `THIS WEEK · ${d1}–${d2} ${monthShort}`;
    });

    // 4. Pattern: Header lịch "TH 2", "TH 3" ... "TH 7", "CN"
    text = text.replace(/\bTH\s*([2-7])\b/g, (_, d) => DAYS_SHORT[d] || `Day ${d}`);
    text = text.replace(/\bCN\b/g, "Sun");

    // 5. Pattern: "Sân số 1", "Sân số 2", "Sân 1", "Sân 2", "Sân 01", "Sân số 4 (VIP)"
    text = text.replace(/\bSân\s+số\s+(\d+)\s*\(VIP\)/gi, "Court $1 (VIP)");
    text = text.replace(/\bSân\s+(\d+)\s*\(VIP\)/gi, "Court $1 (VIP)");
    text = text.replace(/\bSân\s+số\s+(\d+)\b/gi, "Court $1");
    text = text.replace(/\bSân\s+(\d+)\b/gi, "Court $1");
    text = text.replace(/Tất cả sân\s*\(([^)]+)\)/gi, "All Courts ($1)");
    text = text.replace(/Tất cả các sân/gi, "All Courts");
    text = text.replace(/\bTất cả sân\b/gi, "All Courts");

    // 6. Pattern: "X giờ", "X,X giờ"
    text = text.replace(/\b(\d+(?:[.,]\d+)?)\s*giờ\b/g, "$1 hrs");

    // 7. Pattern: "X tuần"
    text = text.replace(/\b(\d+)\s*tuần\b/g, "$1 weeks");

    // 8. Pattern: "Chi tiết Sân ..."
    text = text.replace(/\bChi tiết\s+(Sân\s+[^<]+)/gi, "Details: $1");

    // 9. Dịch cụm từ con (substrings) cho các cụm phổ biến
    for (const key of SORTED_VI_KEYS) {
      if (key.length >= 4 && text.includes(key)) {
        text = text.split(key).join(DICTIONARY[key]);
      }
    }

    return text;
  }

  // Duyệt cây DOM và dịch
  function translateDOM(root, lang) {
    const isEn = lang === "en";

    // 1. Dịch Text Nodes
    const walker = document.createTreeWalker(
      root || document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          if (!node || !node.nodeValue) return NodeFilter.FILTER_REJECT;
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          const tag = parent.tagName.toLowerCase();
          if (["script", "style", "noscript", "svg", "code"].includes(tag)) {
            return NodeFilter.FILTER_REJECT;
          }
          if (parent.closest("#rk-lang-switcher")) {
            return NodeFilter.FILTER_REJECT;
          }
          if (!node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        },
      }
    );

    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);

    for (const node of nodes) {
      const val = node.nodeValue;

      // Lưu giá trị gốc Tiếng Việt
      if (!node.__rkOriginalVI) {
        node.__rkOriginalVI = val;
      }

      if (isEn) {
        const translated = translateStringEN(node.__rkOriginalVI || val);
        if (translated !== val) {
          node.nodeValue = translated;
        }
      } else {
        // Khôi phục về tiếng Việt
        if (node.__rkOriginalVI && node.nodeValue !== node.__rkOriginalVI) {
          node.nodeValue = node.__rkOriginalVI;
        }
      }
    }

    // 2. Dịch các thuộc tính input placeholder, title, aria-label, option
    const targets = (root || document.body).querySelectorAll(
      "input[placeholder], textarea[placeholder], button[title], a[title], button[aria-label], option"
    );
    for (const el of targets) {
      if (el.closest("#rk-lang-switcher")) continue;

      if (el.tagName.toLowerCase() === "option") {
        if (!el.__rkOriginalVI) el.__rkOriginalVI = el.textContent;
        if (isEn) {
          el.textContent = translateStringEN(el.__rkOriginalVI);
        } else if (el.__rkOriginalVI) {
          el.textContent = el.__rkOriginalVI;
        }
        continue;
      }

      ["placeholder", "title", "aria-label"].forEach((attr) => {
        const val = el.getAttribute(attr);
        if (!val) return;
        const key = `__rkOrig_${attr}`;
        if (!el[key]) el[key] = val;

        if (isEn) {
          el.setAttribute(attr, translateStringEN(el[key]));
        } else if (el[key]) {
          el.setAttribute(attr, el[key]);
        }
      });
    }
  }

  function applyLanguage(lang) {
    document.documentElement.lang = lang;
    translateDOM(document.body, lang);
  }

  // Cập nhật UI nút đổi ngôn ngữ
  function updateSwitcherUI(lang) {
    const switcher = document.getElementById("rk-lang-switcher");
    if (!switcher) return;
    const btnVi = switcher.querySelector('[data-lang="vi"]');
    const btnEn = switcher.querySelector('[data-lang="en"]');
    if (btnVi && btnEn) {
      btnVi.classList.toggle("active", lang === "vi");
      btnEn.classList.toggle("active", lang === "en");
    }
  }

  function createLanguageSwitcher() {
    return; // Đã tắt nút chuyển đổi ngôn ngữ theo yêu cầu
    if (document.getElementById("rk-lang-switcher")) return;

    // Inject CSS
    const styleId = "rk-lang-switcher-style";
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = `
        #rk-lang-switcher {
          position: fixed;
          top: 18px;
          right: 20px;
          z-index: 999999;
          display: inline-flex;
          align-items: center;
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          padding: 4px;
          border-radius: 999px;
          border: 1px solid rgba(0, 0, 0, 0.08);
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.04);
          user-select: none;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        #rk-lang-switcher:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.12);
        }
        #rk-lang-switcher .lang-btn {
          border: none;
          background: transparent;
          font-size: 11px;
          font-weight: 700;
          color: #64748b;
          padding: 5px 10px;
          border-radius: 999px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          line-height: 1;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          font-family: inherit;
        }
        #rk-lang-switcher .lang-btn:hover {
          color: #174c3c;
        }
        #rk-lang-switcher .lang-btn.active {
          background: #174c3c;
          color: #ffffff;
          box-shadow: 0 2px 6px rgba(23, 76, 60, 0.35);
        }
        #rk-lang-switcher .lang-flag {
          font-size: 13px;
          line-height: 1;
        }
        @media (min-width: 768px) {
          .topbar .top-tools {
            margin-right: 125px !important;
          }
          .rk-header-actions {
            margin-right: 125px !important;
          }
          .header-actions {
            margin-right: 125px !important;
          }
          .btn-account {
            margin-right: 125px !important;
          }
        }
        @media (max-width: 768px) {
          #rk-lang-switcher {
            top: 12px;
            right: 12px;
            padding: 3px;
          }
          #rk-lang-switcher .lang-btn {
            font-size: 10px;
            padding: 4px 7px;
          }
        }
      `;
      document.head.appendChild(style);
    }

    const container = document.createElement("div");
    container.id = "rk-lang-switcher";
    container.setAttribute("aria-label", "Language selector / Chọn ngôn ngữ");
    container.innerHTML = `
      <button type="button" class="lang-btn ${currentLang === "vi" ? "active" : ""}" data-lang="vi" title="Tiếng Việt">
        <span class="lang-flag">🇻🇳</span> <span>VI</span>
      </button>
      <button type="button" class="lang-btn ${currentLang === "en" ? "active" : ""}" data-lang="en" title="English">
        <span class="lang-flag">🇬🇧</span> <span>EN</span>
      </button>
    `;

    container.addEventListener("click", (e) => {
      const btn = e.target.closest(".lang-btn");
      if (!btn) return;
      const targetLang = btn.dataset.lang;
      if (targetLang && targetLang !== currentLang) {
        setLang(targetLang);
      }
    });

    document.body.appendChild(container);
  }

  // MutationObserver để dịch tự động các nội dung được tải động (dynamic content / AJAX / modals)
  let observer = null;
  function startObserver() {
    if (observer) return;
    let timeout = null;
    observer = new MutationObserver((mutations) => {
      if (currentLang !== "en") return;
      let hasNewNodes = false;
      for (const m of mutations) {
        if (m.addedNodes && m.addedNodes.length > 0) {
          hasNewNodes = true;
          break;
        }
      }
      if (hasNewNodes) {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
          translateDOM(document.body, currentLang);
        }, 60);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function init() {
    createLanguageSwitcher();
    if (currentLang === "en") {
      applyLanguage("en");
    }
    startObserver();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Xuất API toàn cục
  global.RK_I18N = {
    getLang,
    setLang,
    t: translateStringEN,
    translateDOM,
  };
})(typeof window !== "undefined" ? window : this);
