(function (global) {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const client = global.axiosClient;
  const profileURL = global.RK_CONFIG.apiURL.replace(/\/$/, "") + "/profile";
  let avatar = null;
  let readingAvatar = false;
  const show = (id, text, type = "error") => global.RK_UI.show($(id), text, type);
  function errorText(error) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) return detail.map((entry) => entry.msg.replace(/^Value error, /, "")).join("; ");
    return global.RK_UI.message(error);
  }
  function render(data) {
    $("full-name").value = data.full_name;
    $("phone").value = data.phone;
    $("email").value = data.email;
    $("avatar-initial").textContent = data.full_name.trim().charAt(0).toUpperCase();
    avatar = data.avatar;
    $("avatar-preview").hidden = !avatar;
    if (avatar) $("avatar-preview").src = avatar;
  }
  $("avatar").addEventListener("change", async () => {
    const file = $("avatar").files[0];
    if (!file) return;
    $("avatar").setCustomValidity("");
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 1024 * 1024) {
      $("avatar").setCustomValidity("Chọn ảnh PNG, JPEG hoặc WebP tối đa 1 MB.");
      $("avatar").reportValidity();
      return;
    }
    readingAvatar = true;
    $("profile-fields").disabled = true;
    try {
      const value = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("Không đọc được avatar."));
        reader.readAsDataURL(file);
      });
      await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = resolve;
        image.onerror = () => reject(new Error("Ảnh không hợp lệ."));
        image.src = value;
      });
      avatar = value;
      $("avatar-preview").src = avatar;
      $("avatar-preview").hidden = false;
      show("profile-message", "");
    } catch (error) {
      $("avatar").setCustomValidity(error.message);
      show("profile-message", error.message);
    } finally {
      readingAvatar = false;
      $("profile-fields").disabled = false;
    }
  });
  $("profile-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (readingAvatar || $("profile-fields").disabled) return;
    $("full-name").value = $("full-name").value.trim();
    $("phone").value = $("phone").value.trim();
    if (!$("profile-form").reportValidity()) return;
    $("profile-fields").disabled = true;
    show("profile-message", "");
    try {
      const { data } = await client.put(profileURL, {
        full_name: $("full-name").value, phone: $("phone").value, avatar,
      });
      render(data);
      show("profile-message", "Cập nhật hồ sơ thành công.", "success");
      await global.RK_AUTH.restore();
    } catch (error) { show("profile-message", errorText(error)); }
    finally { $("profile-fields").disabled = false; }
  });
  $("password-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    if ($("password-fields").disabled) return;
    const password = $("new-password").value;
    if (!password.trim()) return show("password-message", "Mật khẩu mới không được để trống.");
    if (new TextEncoder().encode(password).length > 72)
      return show("password-message", "Mật khẩu mới tối đa 72 byte UTF-8.");
    if (password !== $("confirm-password").value)
      return show("password-message", "Xác nhận mật khẩu mới không khớp.");
    $("password-fields").disabled = true;
    show("password-message", "");
    try {
      await client.post(global.RK_CONFIG.authURL + "/change-password", {
        old_password: $("old-password").value,
        new_password: password, confirm_password: $("confirm-password").value,
      });
      $("password-form").reset();
      show("password-message", "Đổi mật khẩu thành công.", "success");
    } catch (error) { show("password-message", errorText(error)); }
    finally { $("password-fields").disabled = false; }
  });
  global.RK_AUTH.subscribe((session) => global.RK_LAYOUT.guest(session));
  async function load() {
    if (!(await global.ProtectedRoute())) {
      $("profile-state").textContent = global.RK_AUTH.getState().error || "Vui lòng đăng nhập để xem hồ sơ.";
      return;
    }
    try {
      render((await client.get(profileURL)).data);
      $("profile-state").hidden = true;
      $("profile-content").hidden = false;
    } catch (error) { $("profile-state").textContent = errorText(error); }
  }
  void load();
})(window);
