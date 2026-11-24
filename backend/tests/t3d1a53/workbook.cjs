const { Workbook, SpreadsheetFile } = require("@oai/artifact-tool");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const assert = require("node:assert/strict");

const folder = path.resolve(__dirname, "../../../docs/testing/T3D1A53");
const filename = "T3D1A53_NguyenAnhTung_TestCase_TestLog.xlsx";
const localDate = stamp => stamp ? Date.parse(stamp.slice(0, 19) + "Z") / 86400000 + 25569 : "";
const dateFormat = "dd/mm/yyyy hh:mm:ss";
const statuses = {
  Pass: ["#DCFCE7", "#166534"], Fail: ["#FEE2E2", "#991B1B"],
  Blocked: ["#FEF3C7", "#92400E"], "Not Run": ["#E5E7EB", "#374151"],
};
const sources = {
  "Đăng ký": "frontend/pages/register.html, frontend/js/pages/auth-page.js, app/routers/auth.py, app/schemas/user.py",
  "Đăng nhập": "frontend/pages/login.html, frontend/js/auth.js, app/routers/auth.py, app/core/security.py",
  "Phân quyền": "frontend/js/ProtectedRoute.js, frontend/js/axiosClient.js, backend/docs/RBAC_GUIDE.md, app/core/security.py",
  "Hồ sơ": "frontend/pages/profile.html, frontend/js/pages/profile.js, app/routers/profile.py, backend/tests/README_T3D20B0.md",
  "Nhân viên": "frontend/pages/admin-users.html, frontend/js/pages/admin-users.js, app/routers/admin_users.py, app/schemas/admin_users.py",
  "Khách hàng": "frontend/pages/admin-users.html?view=customers, app/routers/admin_users.py, app/models/user.py",
  "Lịch sử đặt sân": "frontend/js/pages/admin-users.js, app/routers/admin_users.py, app/models/booking.py, booking_slot.py, payment.py",
};
const info = [
  ["Đăng ký", "register.html", "POST /auth/register", "auth.py · UserCreate · users", "Công khai", "Email/SĐT duy nhất; mặc định CUSTOMER/ACTIVE; bcrypt. UI kiểm tra số di động VN, họ tên và mật khẩu.", "Yêu cầu task §4 và form đăng ký"],
  ["Đăng nhập", "login.html", "POST /auth/login; GET /auth/me", "auth.py · UserLogin · security.py", "Công khai / đã đăng nhập", "API nhận email hoặc SĐT; bearer JWT có hạn 24 giờ. Frontend lưu sessionStorage hoặc localStorage tùy lựa chọn ghi nhớ.", "Yêu cầu task §5 và RBAC_GUIDE.md"],
  ["Hồ sơ", "profile.html", "GET/PUT /api/profile; POST /auth/change-password", "profile.py · schemas/profile.py · auth.py", "ADMIN, STAFF, CUSTOMER đang ACTIVE", "Họ tên và SĐT hợp lệ, email chỉ đọc; avatar tùy chọn; đổi mật khẩu xác nhận và kiểm tra mật khẩu cũ.", "README_T3D20B0.md"],
  ["Nhân viên", "admin-users.html?view=users", "GET/POST /api/admin/staff; GET/PUT /api/admin/staff/{id}; PATCH /api/admin/staff/{id}/status", "admin_users.py · schemas/admin_users.py · users", "ADMIN", "Tạo STAFF/ACTIVE, chỉnh tên/email/SĐT, khóa hoặc mở khóa; bản ghi phải là STAFF.", "Yêu cầu task §8 và thông báo khóa trên UI"],
  ["Khách hàng", "admin-users.html?view=customers", "GET /api/admin/customers; GET /api/admin/customers/{id}", "admin_users.py · users · bookings", "ADMIN", "Tìm chuỗi theo tên/SĐT, bỏ khoảng trắng ngoài; danh sách theo ID, có phân trang.", "Yêu cầu task §8 và tham số route"],
  ["Lịch sử đặt sân", "admin-users.html?view=customers&customer={id}", "GET /api/admin/customers/{id}/bookings", "admin_users.py · bookings · booking_slots · payments · courts", "ADMIN", "Theo user_id khách, mới trước; lọc ngày/trạng thái, phân trang; ghép ca sân và thanh toán.", "Yêu cầu task §8 và truy vấn Booking"],
];
const knownBugs = {
  "BUG-01": ["API đăng ký thiếu ràng buộc dữ liệu đầu vào", "Cao",
    "Schema UserCreate không đồng bộ các giới hạn trên form và độ dài cột MySQL."],
  "BUG-02": ["Form đăng nhập từ chối số điện thoại hợp lệ", "Trung bình",
    "Validator trang đăng nhập chỉ chấp nhận mẫu email, trong khi UserLogin.account và router hỗ trợ SĐT."],
};
const planned = [
  ["PLAN-02", "Đăng nhập", "UI", "Đóng toàn bộ Edge rồi khởi động lại cùng hồ sơ đã chọn Ghi nhớ.", "Khôi phục được phiên sau khi khởi động lại trình duyệt."],
  ["PLAN-08", "Phân quyền", "API", "Kiểm tra bổ sung các trường được bảo vệ và ranh giới truy cập hồ sơ.", "Thuộc tính được bảo vệ vẫn giữ nguyên và tài khoản chỉ sử dụng được dữ liệu trong phạm vi quyền."],
];
const rights = [
  ["Chưa đăng nhập", "GET/PUT /api/profile", "Từ chối API 401", "RB-01"],
  ["Chưa đăng nhập", "admin-users.html, profile.html", "Chuyển đến login.html", "UI-RB-01"],
  ["Chưa đăng nhập", "/api/admin/staff, /api/admin/customers và lịch sử", "Từ chối API 401", "RB-04"],
  ["ADMIN", "Quản lý nhân viên", "UI cho thao tác tạo/sửa/khóa", "UI-STA-01"],
  ["ADMIN", "POST/PUT/PATCH /api/admin/staff", "Cho phép, lưu MySQL", "STA-01"],
  ["ADMIN", "/api/admin/customers", "Cho phép đọc và tìm khách", "CUS-07"],
  ["ADMIN", "/api/admin/customers/{id}/bookings", "Cho phép xem lịch sử", "HIS-01"],
  ["STAFF", "/api/admin/staff, /api/admin/customers và lịch sử", "Từ chối API 403", "RB-05"],
  ["STAFF", "admin-users.html", "Chuyển đến 403.html", "UI-RB-03"],
  ["STAFF", "/api/profile", "Cho hồ sơ khi hoạt động; 403 ngay sau khi khóa", "STA-01"],
  ["CUSTOMER", "/api/admin/staff, /api/admin/customers và lịch sử", "Từ chối API 403", "RB-06"],
  ["CUSTOMER", "admin-users.html", "Chuyển đến 403.html", "UI-RB-02"],
  ["CUSTOMER", "/api/profile", "Xem và sửa thông tin của tài khoản trong phiên", "PRO-01"],
  ["Bearer không hợp lệ/hết hạn", "GET/PUT /api/profile", "Từ chối API 401", "RB-02"],
  ["Bearer không hợp lệ/hết hạn", "GET/PUT /api/profile", "Từ chối API 401", "RB-03"],
];

async function main() {
  const runs = (await fs.readFile(path.join(folder, "runs.jsonl"), "utf8")).trim().split("\n").map(JSON.parse);
  const recent = runs.at(-1);
  const history = runs.flatMap(run => run.records.map(row => ({ ...row, run })));
  const latest = new Map(history.map(row => [row.id, row]));
  for (const [id, module, layer, steps, expected] of planned) {
    if (!latest.has(id)) latest.set(id, { id, module, layer, steps, expected, status: "Not Run",
      actual: "Chưa có lượt thực thi.", time: "", bug: "", run: recent });
  }
  const count = Object.fromEntries(Object.keys(statuses).map(s => [s, [...latest.values()].filter(x => x.status === s).length]));
  const bugGroups = new Map();
  for (const row of history) {
    if (row.status !== "Fail") continue;
    if (!row.bug && latest.get(row.id)?.status === "Pass") continue;
    const key = row.bug || "OBS-" + row.id;
    if (!bugGroups.has(key)) bugGroups.set(key, []);
    const items = bugGroups.get(key);
    if (!items.some(old => old.id === row.id)) items.push(row);
  }
  const wb = Workbook.create();
  function make(name, headers, rows, widths, statusIndex = -1) {
    const sh = wb.worksheets.add(name);
    const block = [headers, ...rows];
    sh.showGridLines = false;
    const last = String.fromCharCode(64 + headers.length);
    const area = sh.getRange("A1:" + last + block.length);
    area.values = block;
    area.format.font = { name: "Arial", size: 11, color: "#172B3D" };
    area.format.wrapText = true;
    area.format.verticalAlignment = "center";
    area.format.rowHeight = 46;
    sh.getRange("A1:" + last + "1").format = {
      fill: "#173B56", font: { name: "Arial", size: 11, bold: true, color: "#FFFFFF" },
      wrapText: true, rowHeight: 32, verticalAlignment: "center",
    };
    widths.forEach((width, i) => sh.getRangeByIndexes(0, i, block.length, 1).format.columnWidth = width);
    rows.forEach((row, i) => {
      const line = sh.getRangeByIndexes(i + 1, 0, 1, headers.length);
      if (i % 2 === 0) line.format.fill = "#F0F6FA";
      const lines = Math.max(...row.map((cell, col) => Math.max(1,
        String(cell ?? "").split("\n").reduce((sum, part) => sum + Math.max(1, Math.ceil(part.length / (widths[col] * .88))), 0))));
      line.format.rowHeight = Math.max(29, lines * 15 + 13);
      if (statuses[row[statusIndex]]) {
        const cell = sh.getRangeByIndexes(i + 1, statusIndex, 1, 1);
        const [fill, color] = statuses[row[statusIndex]];
        cell.format.fill = fill;
        cell.format.font = { bold: true, color };
      }
    });
    sh.freezePanes.freezeRows(1);
    if (rows.length) {
      const table = sh.tables.add("A1:" + last + block.length, true, name + "_Bang");
      table.style = "TableStyleLight1";
      table.showBandedRows = false;
      table.showFilterButton = true;
    }
    return { sh, expected: block.length };
  }
  const command = ".\\.venv-t3d1a53\\Scripts\\python.exe backend/tests/t3d1a53/run.py";
  const overview = make("Tong_quan", ["Hạng mục", "Giá trị", "Diễn giải"], [
    ["Task", "T3D1A53", "[Kiểm thử] Test case và test log module mình"],
    ["Người thực hiện", "Nguyễn Anh Tùng 2", "PTIT-K25-001"],
    ["Sprint / hạn nộp", "18–24/11/2026", "Hạn nộp 23/11/2026"],
    ["Phạm vi", "6 chức năng", "Đăng ký, đăng nhập, phân quyền, hồ sơ, nhân viên và khách hàng gồm lịch sử đặt sân."],
    ["Thời gian bắt đầu (UTC+7)", localDate(recent.started), "Kết thúc " + recent.finished + " · Asia/Ho_Chi_Minh"],
    ["Môi trường", "FastAPI + MySQL " + (recent.mysql || "chưa xác minh"), "Uvicorn và HTTP loopback; Edge headless qua Playwright; schema SQLAlchemy trên MySQL riêng."],
    ["Phiên bản", recent.commit, recent.revision],
    ["Test case", latest.size, "Đếm mã test duy nhất, gồm ca chưa chạy"],
    ["Lượt thực thi", history.length, "Số bản ghi API và UI thực sự chạy trong tất cả run"],
    ["Pass", count.Pass, "Ca đạt ở lần thực thi gần nhất"],
    ["Fail", count.Fail, "Ca sai kỳ vọng ở lần thực thi gần nhất"],
    ["Blocked", count.Blocked, "Ca bị chặn bởi điều kiện thực thi"],
    ["Not Run", count["Not Run"], "Ca chưa thực thi"],
    ["Tỷ lệ Pass", "", "Pass / (Pass + Fail)"],
    ["Bug/quan sát có kết quả Fail", bugGroups.size, "Xem Bug_Log để phân biệt lỗi đã xác định và quan sát cần xác minh"],
    ["Đã sửa và retest Pass", 0, "Giữ nguyên mã ứng dụng theo yêu cầu bàn giao"],
    ["Còn mở", bugGroups.size, "Có bằng chứng lượt chạy trong Test_Log"],
    ["Điểm chưa kiểm chứng", count["Not Run"], "Xem các ca Not Run; chưa kiểm chứng migration SQL, cấu hình triển khai hoặc cạnh tranh đồng thời."],
    ["Chênh lệch tài liệu", "Auth / axios", "Auth có cả /auth và /api/auth, frontend dùng /auth. README frontend nói axios CDN; các màn hình test tải axios nội bộ."],
    ["Trạng thái lần chạy", recent.error || "Đã thu kết quả", "Bằng chứng nằm trong runs.jsonl, không kèm token hoặc mật khẩu."],
  ], [35, 38, 87], 0);
  overview.sh.getRange("B6").setNumberFormat(dateFormat);
  overview.sh.getRange("B15").formulas = [['=IF(SUM(B11:B12)=0,"N/A",B11/SUM(B11:B12))']];
  overview.sh.getRange("B15").setNumberFormat("0.0%");

  const builds = [overview,
    make("Ma_tran_quyen", ["Vai trò", "Chức năng / Endpoint", "Quyền mong đợi", "Test Case ID", "Kết quả mới nhất", "Căn cứ / Ghi chú"],
      rights.map(row => [...row, latest.get(row[3])?.status || "Not Run", "ProtectedRoute.js · security.py · RBAC_GUIDE.md"]), [28, 54, 50, 18, 22, 52], 4),
    make("Test_Cases", ["Test Case ID", "Module", "Chức năng", "UI/API", "Kịch bản", "Nhóm kiểm thử", "Mức ưu tiên", "Tiền điều kiện", "Dữ liệu", "Các bước thực hiện", "Kết quả mong đợi", "Căn cứ yêu cầu", "Tự động / Thủ công", "Kết quả mới nhất"],
      [...latest.values()].map(row => [row.id, row.module, row.module, row.layer, row.steps,
        row.module === "Phân quyền" ? "Xác thực / quyền" : "Chức năng / dữ liệu",
        ["Phân quyền", "Đăng ký", "Đăng nhập"].includes(row.module) ? "Cao" : "Trung bình",
        "Ứng dụng thật, dữ liệu giả trên MySQL test", "Fixture QA53; xem bước thực hiện và script",
        row.steps, row.expected, sources[row.module], row.status === "Not Run" ? "Chưa thực thi" : "Tự động", row.status]),
      [17, 21, 21, 10, 48, 24, 16, 32, 32, 57, 60, 65, 22, 21], 13),
    make("Test_Log", ["Run ID", "Test Case ID", "Thời gian (UTC+7)", "Môi trường / Phiên bản", "Kết quả thực tế", "Trạng thái", "Bằng chứng", "Bug ID", "Người thực hiện", "Ghi chú"],
      [...history, ...[...latest.values()].filter(row => row.status === "Not Run")].map(row => [
        row.status === "Not Run" ? "" : row.run.id, row.id, localDate(row.time),
        row.layer + " · " + row.run.commit + " · MySQL " + (row.run.mysql || "—"),
        row.actual, row.status, row.status === "Not Run" ? "" : "runs.jsonl · " + row.run.id + " / " + row.id,
        row.status === "Fail" && bugGroups.has(row.bug || "OBS-" + row.id) ? (row.bug || "OBS-" + row.id) : "", "Nguyễn Anh Tùng 2",
        row.id === "UI-LOG-04" && row.status === "Fail" && latest.get(row.id)?.status === "Pass"
          ? "Lỗi cấu hình Playwright khi mở tab phụ. Lượt sau dùng browser context tường minh và Pass."
          : row.layer === "UI" ? "Edge / Playwright" : "HTTP + DB",
      ]), [31, 17, 34, 36, 63, 16, 58, 20, 24, 24], 5),
    make("Bug_Log", ["Bug ID", "Tiêu đề", "Test Case ID", "Mức độ", "Bước tái hiện", "Expected", "Actual", "Nguyên nhân", "Trạng thái sửa", "File sửa", "Kết quả retest", "Bằng chứng"],
      [...bugGroups].map(([id, items]) => {
        const [title, severity, reason] = knownBugs[id] || ["Sai lệch quan sát khi kiểm thử", "Chờ đánh giá", "Cần xác minh thêm bằng kết quả chạy."];
        const join = field => items.map(x => x.id + " · " + x[field]).join("\n");
        return [id, title, items.map(x => x.id).join(", "), severity, join("steps"), join("expected"), join("actual"),
          reason, "Còn mở", "—", "Chưa retest bản sửa", items.map(x => x.run.id + " / " + x.id).join("\n")];
      }), [19, 42, 29, 18, 59, 58, 58, 54, 22, 18, 26, 50]),
    make("Huong_dan_chay", ["Hạng mục", "Nội dung", "Vị trí / Căn cứ"], [
      ["Điều kiện", "Windows; Python 3.12, MySQL Server 8.0, Edge và Node có Playwright cùng @oai/artifact-tool.", "Python 3.14 với SQLAlchemy được ghim không import được app. Route upload sân cũng cần python-multipart."],
      ["Chuẩn bị Python", "Tạo .venv-t3d1a53 bằng Python 3.12. Cài phụ thuộc trong môi trường test riêng.", ".\\.venv-t3d1a53\\Scripts\\python.exe -m pip install -r backend/requirements.txt python-multipart"],
      ["NODE_PATH", "Trỏ NODE_PATH đến node_modules của Codex workspace runtime hoặc thư mục có Playwright và @oai/artifact-tool.", "PowerShell khi dùng Node từ Codex: $env:NODE_PATH = Join-Path (Split-Path (Split-Path (Get-Command node).Source)) 'node_modules'"],
      ["MySQL", "mysqld.exe mặc định từ thư mục cài MySQL 8.0 của Windows. Đặt QA_MYSQLD nếu dùng đường dẫn khác.", "Tạo data dir trong thư mục tạm, bind 127.0.0.1 trên cổng động."],
      ["Chạy từ gốc repository", command, "Tạo schema → fixture → FastAPI HTTP → Edge → log → cleanup → xuất Excel."],
      ["Chạy lại và xuất lại", command, "Mỗi lần nối thêm run vào runs.jsonl. Runner trả mã khác 0 nếu test Fail hoặc môi trường không chạy được."],
      ["Chỉ xuất lại", "node backend/tests/t3d1a53/workbook.cjs", "Đọc toàn bộ runs.jsonl, giữ lịch sử và lấy kết quả mới nhất mỗi case."],
      ["Dữ liệu", "ADMIN, STAFF, CUSTOMER, tài khoản đã khóa; một khách hai lượt, một khách chưa đặt và lượt thuộc tài khoản khác.", "backend/tests/t3d1a53/api_cases.py"],
      ["Cleanup", "Đóng Edge và frontend, dừng MySQL/Uvicorn, xóa thư mục dữ liệu tạm.", "backend/tests/t3d1a53/run.py"],
      ["Mã và minh chứng", "run.py, api_cases.py, browser.cjs, workbook.cjs; runs.jsonl ghi mã test, thời gian, kết quả và kiểm tra đã đạt.", "backend/tests/t3d1a53/ và docs/testing/T3D1A53/"],
      ["Giới hạn", "Schema tạo từ model; chưa kiểm tra migration SQL và các ca Not Run. Xác nhận mật khẩu lúc đăng ký không có trên form.", "Test_Cases và Test_Log"],
      ...runs.filter(run => run.error).map(run => [
        "Lần chạy bị gián đoạn", run.error, run.id + " · " + run.started,
      ]),
    ], [33, 105, 100]),
    make("Doi_chieu_code", ["Chức năng", "Màn hình", "Endpoint / Method", "File xử lý", "Vai trò được phép", "Quy tắc dữ liệu", "Căn cứ yêu cầu"],
      info, [23, 53, 70, 48, 34, 75, 56]),
  ];
  const log = builds.find(({ sh }) => sh.name === "Test_Log");
  log.sh.getRange("C2:C" + log.expected).setNumberFormat(dateFormat);
  wb.recalculate();
  assert.equal(overview.sh.getRange("B15").values[0][0],
    count.Pass + count.Fail ? count.Pass / (count.Pass + count.Fail) : "N/A");
  const file = path.join(folder, filename);
  const output = await SpreadsheetFile.exportXlsx(wb);
  await output.save(file);
  assert.ok((await fs.stat(file)).size < 20_000_000);
  const reopened = await SpreadsheetFile.importXlsx(await fs.readFile(file));
  for (const { sh, expected } of builds) {
    const parsed = reopened.worksheets.getItem(sh.name);
    const actual = parsed.getUsedRange().values;
    assert.equal(actual.filter(row => row.some(value => value !== null && value !== "")).length, expected, sh.name);
    assert.equal(parsed.getRange("A1").values[0][0], sh.getRange("A1").values[0][0]);
    assert.ok(parsed.tables.items.length, sh.name);
  }
  if (process.argv.includes("--preview")) {
    const previewDir = await fs.mkdtemp(path.join(os.tmpdir(), "qa53-preview-"));
    for (const { sh } of builds) {
      const preview = await wb.render({ sheetName: sh.name, range: "A1:D5", scale: 1 });
      await fs.writeFile(path.join(previewDir, sh.name + ".png"), new Uint8Array(await preview.arrayBuffer()));
    }
    console.log("Preview: " + previewDir);
  }
  console.log(JSON.stringify({ tests: latest.size, executions: history.length, ...count, bugs: bugGroups.size, xlsx: file }));
}

main().catch(error => { console.error(error); process.exitCode = 1; });
