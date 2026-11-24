const { chromium } = require("playwright");
const fs = require("node:fs");
const assert = require("node:assert/strict");

const [base, output] = process.argv.slice(2);
const password = "Qa-fixture-53!";
const records = [];
const pageURL = (file) => base + "/pages/" + file;
const formSubmit = (page, form) => page.locator(form + ' [type="submit"]').click();

async function check(browser, id, module, steps, expected, test, bug = "") {
  const context = await browser.newContext({ timezoneId: "Asia/Ho_Chi_Minh" });
  const page = await context.newPage();
  page.setDefaultTimeout(6500);
  let status = "Pass", actual = expected;
  try {
    await test(page);
  } catch (error) {
    status = "Fail";
    const phoneError = id === "UI-LOG-02" && await page.locator("#email-error").isVisible();
    actual = phoneError ? "Form giữ nguyên ở login.html và báo yêu cầu email hợp lệ." :
      error.name === "TimeoutError" ? "Hết thời gian chờ trạng thái UI mong đợi." :
        "Kiểm tra trạng thái UI không khớp.";
  } finally {
    await context.close();
  }
  records.push({ id, module, layer: "UI", steps, expected, status, actual, bug,
    time: new Date(Date.now() + 7 * 3600000).toISOString().replace("Z", "+07:00") });
  fs.writeFileSync(output, JSON.stringify(records));
}

async function login(page, account, credential = password) {
  await page.goto(pageURL("login.html"));
  await page.fill("#email", account);
  await page.fill("#password", credential);
  await formSubmit(page, "#rk-auth-form");
}

async function register(page, email, phone) {
  await page.goto(pageURL("register.html"));
  for (const [id, value] of Object.entries({ full_name: "QA Trình duyệt", email, phone, password })) {
    await page.fill("#" + id, value);
  }
  await formSubmit(page, "#rk-auth-form");
}

async function waitVisible(page, selector) {
  await page.locator(selector).waitFor({ state: "visible" });
}

async function adminPage(page, view = "") {
  await login(page, "admin53@example.com");
  await page.waitForURL("**/dashboard.html?view=dashboard");
  await page.goto(pageURL("admin-users.html" + view));
}

async function main() {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    const test = (...args) => check(browser, ...args);
    await test("UI-REG-01", "Đăng ký", "Bấm gửi form trống rồi kiểm tra họ tên, SĐT, email, mật khẩu.",
      "Bốn lỗi trường hiển thị; ở lại trang đăng ký.", async (page) => {
        await page.goto(pageURL("register.html"));
        await formSubmit(page, "#rk-auth-form");
        for (const id of ["full_name", "phone", "email", "password"]) await waitVisible(page, "#" + id + "-error");
        assert.match(page.url(), /register\.html$/);
      });
    await test("UI-REG-02", "Đăng ký", "Gửi form hợp lệ với tài khoản QA mới.",
      "Chuyển đến login.html?registered=1 và hiển thị thông báo thành công.", async (page) => {
        await register(page, "ui53@example.com", "0905300030");
        await page.waitForURL("**/login.html?registered=1");
        await waitVisible(page, "#rk-auth-notice");
      });
    await test("UI-REG-03", "Đăng ký", "Gửi email đã tồn tại với SĐT chưa dùng.",
      "API trả 409, UI hiện lỗi và ở lại trang đăng ký.", async (page) => {
        await page.goto(pageURL("register.html"));
        const response = page.waitForResponse(r => r.url().endsWith("/auth/register") && r.request().method() === "POST");
        await register(page, "booking53@example.com", "0905300032");
        assert.equal((await response).status(), 409);
        await waitVisible(page, "#rk-form-error");
        assert.match(page.url(), /register\.html$/);
      });
    await test("UI-REG-04", "Đăng ký", "Bấm nút đăng ký hai lần liên tiếp và đếm yêu cầu POST thực tại trình duyệt.",
      "Trạng thái aria-busy bật; nút vô hiệu; chỉ gửi một POST và chuyển trang xác nhận.", async (page) => {
        const posts = [];
        page.on("request", req => {
          if (req.method() === "POST" && req.url().endsWith("/auth/register")) posts.push(req.method());
        });
        await page.goto(pageURL("register.html"));
        for (const [id, value] of Object.entries({
          full_name: "QA Gửi lặp", email: "uirepeat53@example.com", phone: "0905300033", password
        })) await page.fill("#" + id, value);
        const busy = await page.locator("#rk-auth-form").evaluate(form => {
          const button = form.querySelector('button[type="submit"]');
          button.click();
          const state = form.getAttribute("aria-busy") === "true" && button.matches(":disabled");
          button.click();
          return state;
        });
        await page.waitForURL("**/login.html?registered=1");
        assert.ok(busy);
        assert.equal(posts.length, 1);
      });
    await test("UI-LOG-01", "Đăng nhập", "Gửi mật khẩu sai rồi đăng nhập tài khoản đã khóa.",
      "Hiện lỗi trên form cho cả hai trường hợp.", async (page) => {
        await login(page, "booking53@example.com", "sai");
        await waitVisible(page, "#rk-form-error");
        await login(page, "locked53@example.com");
        await waitVisible(page, "#rk-form-error");
      });
    await test("UI-LOG-02", "Đăng nhập", "Đăng nhập bằng số điện thoại của khách.",
      "Đăng nhập và chuyển tới customer-home.html như hợp đồng account của API.", async (page) => {
        await login(page, "0905300003");
        await page.waitForURL("**/customer-home.html");
      }, "BUG-02");
    await test("UI-LOG-03", "Đăng nhập", "Đăng nhập qua form, bấm Đăng xuất rồi mở lại URL hồ sơ.",
      "Phiên trình duyệt kết thúc và URL hồ sơ chuyển về login.html.", async (page) => {
        await login(page, "booking53@example.com");
        await page.waitForURL("**/customer-home.html");
        await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
        await page.goto(pageURL("profile.html"));
        await page.waitForURL("**/login.html");
      });
    await test("UI-LOG-04", "Đăng nhập", "Bật Ghi nhớ đăng nhập, đăng nhập, rồi mở URL hồ sơ bằng tab mới cùng hồ sơ Edge.",
      "Tab mới nhận phiên và hiển thị đúng người dùng.", async (page) => {
        await page.goto(pageURL("login.html"));
        await page.fill("#email", "booking53@example.com");
        await page.fill("#password", password);
        await page.check("[name=remember]");
        await formSubmit(page, "#rk-auth-form");
        await page.waitForURL("**/customer-home.html");
        const tab = await page.context().newPage();
        try {
          await tab.goto(pageURL("profile.html"));
          await waitVisible(tab, "#profile-content");
          assert.equal(await tab.inputValue("#email"), "booking53@example.com");
        } finally {
          await tab.close();
        }
      });
    await test("UI-PRO-01", "Hồ sơ", "Đăng nhập tài khoản vừa đăng ký → mở hồ sơ → sửa tên và SĐT → tải lại → đăng nhập lại.",
      "Nhận dữ liệu đúng; email chỉ đọc; thông báo lưu; dữ liệu mới còn sau tải lại và phiên mới.", async (page) => {
        await login(page, "ui53@example.com");
        await page.waitForURL("**/customer-home.html");
        await page.goto(pageURL("profile.html"));
        await waitVisible(page, "#profile-content");
        assert.equal(await page.inputValue("#full-name"), "QA Trình duyệt");
        assert.equal(await page.locator("#email").getAttribute("readonly"), "");
        await page.fill("#full-name", "QA Hồ sơ mới");
        await page.fill("#phone", "+84905300031");
        await formSubmit(page, "#profile-form");
        await waitVisible(page, "#profile-message");
        assert.match(await page.textContent("#profile-message"), /thành công/i);
        await page.reload();
        await waitVisible(page, "#profile-content");
        assert.equal(await page.inputValue("#full-name"), "QA Hồ sơ mới");
        assert.equal(await page.inputValue("#phone"), "+84905300031");
        const fresh = await page.context().browser().newPage();
        try {
          await login(fresh, "ui53@example.com");
          await fresh.waitForURL("**/customer-home.html");
          await fresh.goto(pageURL("profile.html"));
          await waitVisible(fresh, "#profile-content");
          assert.equal(await fresh.inputValue("#full-name"), "QA Hồ sơ mới");
        } finally {
          await fresh.close();
        }
      });
    await test("UI-PRO-02", "Hồ sơ", "Đăng nhập, đổi SĐT thành số của tài khoản khác, bấm lưu.",
      "Thông báo lỗi trùng hiển thị và dữ liệu cũ giữ nguyên sau tải lại.", async (page) => {
        await login(page, "booking53@example.com");
        await page.waitForURL("**/customer-home.html");
        await page.goto(pageURL("profile.html"));
        await waitVisible(page, "#profile-content");
        await page.fill("#phone", "0905300004");
        const rejected = page.waitForResponse(r => r.url().endsWith("/api/profile") && r.request().method() === "PUT");
        await formSubmit(page, "#profile-form");
        assert.equal((await rejected).status(), 409);
        await waitVisible(page, "#profile-message");
        await page.reload();
        await waitVisible(page, "#profile-content");
        assert.equal(await page.inputValue("#phone"), "0905300003");
      });
    await test("UI-PRO-03", "Hồ sơ", "Đăng nhập, chọn file văn bản rồi ảnh PNG, lưu và tải lại hồ sơ.",
      "File văn bản không hợp lệ; ảnh PNG xem trước được và còn hiển thị sau tải lại.", async (page) => {
        await login(page, "booking53@example.com");
        await page.waitForURL("**/customer-home.html");
        await page.goto(pageURL("profile.html"));
        await waitVisible(page, "#profile-content");
        await page.setInputFiles("#avatar", { name: "qa.txt", mimeType: "text/plain", buffer: Buffer.from("QA") });
        assert.equal(await page.locator("#avatar").evaluate(input => input.validity.valid), false);
        await page.setInputFiles("#avatar", { name: "qa.png", mimeType: "image/png",
          buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1cAAAAASUVORK5CYII=", "base64") });
        await waitVisible(page, "#avatar-preview");
        await formSubmit(page, "#profile-form");
        await waitVisible(page, "#profile-message");
        assert.match(await page.textContent("#profile-message"), /thành công/i);
        await page.reload();
        await waitVisible(page, "#avatar-preview");
      });
    await test("UI-PRO-04", "Hồ sơ", "Đổi mật khẩu với xác nhận không khớp, rồi gửi xác nhận đúng và đăng nhập lại.",
      "Thấy lỗi xác nhận, sau đó thấy thành công và đăng nhập được bằng mật khẩu mới.", async (page) => {
        const next = "QA-UI-pass-53!";
        await login(page, "ui53@example.com");
        await page.waitForURL("**/customer-home.html");
        await page.goto(pageURL("profile.html"));
        await waitVisible(page, "#profile-content");
        await page.fill("#old-password", password);
        await page.fill("#new-password", next);
        await page.fill("#confirm-password", "khác");
        await formSubmit(page, "#password-form");
        await waitVisible(page, "#password-message");
        assert.match(await page.textContent("#password-message"), /không khớp/i);
        await page.fill("#confirm-password", next);
        await formSubmit(page, "#password-form");
        await page.waitForFunction(() => document.querySelector("#password-message").textContent.includes("thành công"));
        const fresh = await page.context().browser().newPage();
        try {
          await login(fresh, "ui53@example.com", next);
          await fresh.waitForURL("**/customer-home.html");
        } finally {
          await fresh.close();
        }
      });
    await test("UI-RB-01", "Phân quyền", "Khách chưa đăng nhập mở URL quản trị và URL hồ sơ.",
      "Cả hai trang chuyển tới login.html.", async (page) => {
        for (const view of ["admin-users.html", "profile.html"]) {
          await page.goto(pageURL(view));
          await page.waitForURL("**/login.html");
        }
      });
    await test("UI-RB-02", "Phân quyền", "Đăng nhập CUSTOMER rồi mở URL quản trị.",
      "Chuyển đến 403.html.", async (page) => {
        await login(page, "booking53@example.com");
        await page.waitForURL("**/customer-home.html");
        await page.goto(pageURL("admin-users.html"));
        await page.waitForURL("**/403.html");
      });
    await test("UI-RB-03", "Phân quyền", "Đăng nhập STAFF, kiểm tra trang mặc định, rồi mở URL quản trị.",
      "STAFF đến dashboard?view=dashboard; URL quản trị chuyển 403.", async (page) => {
        await login(page, "staff53@example.com");
        await page.waitForURL("**/dashboard.html?view=dashboard");
        await page.locator("#staff-overview-title").waitFor({ state: "visible" });
        await page.goto(pageURL("admin-users.html"));
        await page.waitForURL("**/403.html");
      });
    await test("UI-STA-01", "Nhân viên", "Admin đăng nhập, tạo nhân viên, sửa họ tên, khóa và xác nhận.",
      "Bảng hiện tên mới và trạng thái Đã khóa.", async (page) => {
        await adminPage(page);
        await page.click("#au-add");
        const form = "#staff-form";
        for (const [field, value] of Object.entries({
          full_name: "QA Staff UI", email: "uistaff53@example.com", phone: "0905300035", password
        })) await page.fill(form + " [name=" + field + "]", value);
        await formSubmit(page, form);
        await page.locator("tr").filter({ hasText: "uistaff53@example.com" }).getByText("Sửa").click();
        await page.fill(form + " [name=full_name]", "QA Staff UI Mới");
        await formSubmit(page, form);
        const row = page.locator("tr").filter({ hasText: "QA Staff UI Mới" });
        await row.getByRole("button", { name: "Khóa", exact: true }).click();
        await page.click("#status-confirm");
        await row.getByText("Đã khóa", { exact: true }).waitFor();
      });
    await test("UI-CUS-01", "Khách hàng", "Admin tìm tên tiếng Việt rồi tìm SĐT và từ khóa không tồn tại.",
      "Bảng hiển thị khách khớp và giao diện không có dữ liệu khi không khớp.", async (page) => {
        await adminPage(page, "?view=customers");
        for (const query of ["Nguyễn", "0905300003", "QA-khong-khop"]) {
          await page.fill("#au-search [name=q]", query);
          const request = page.waitForResponse(r => r.url().includes("/api/admin/customers?") && r.url().includes("q="));
          await formSubmit(page, "#au-search");
          assert.equal((await request).status(), 200);
          if (query === "QA-khong-khop") await waitVisible(page, ".au-empty");
          else await page.locator("tr").filter({ hasText: "QA Nguyễn Văn Ánh" }).waitFor();
        }
      });
    await test("UI-HIS-01", "Lịch sử đặt sân", "Mở lịch sử từ dòng khách có lịch và từ dòng khách chưa đặt.",
      "Hiển thị hai mã đặt, tên sân, tiền, trạng thái và trạng thái rỗng cho khách chưa đặt.", async (page) => {
        await adminPage(page, "?view=customers");
        await page.locator("tr").filter({ hasText: "QA Nguyễn Văn Ánh" }).getByText("Xem lịch sử").click();
        for (const code of ["QA53-1", "QA53-2"]) {
          const row = page.locator("tr").filter({ hasText: code });
          await row.getByText("Sân QA 53").waitFor();
          assert.match(await row.innerText(), /100[. ]000/);
          assert.match(await row.innerText(), /Đã xác nhận/);
        }
        await page.getByText("Quay lại khách hàng", { exact: false }).click();
        await page.locator("tr").filter({ hasText: "QA Không Có Lịch" }).getByText("Xem lịch sử").click();
        await waitVisible(page, ".au-empty");
      });
  } finally {
    await browser.close();
  }
}

main().catch(() => { process.exitCode = 1; });
