(function (global) {
  "use strict";
  const register = document.body.dataset.page === "register";
  const { icon, show, message } = global.RK_UI;
  const form = document.getElementById("rk-auth-form");
  const fieldset = form.querySelector("fieldset");
  const button = form.querySelector('button[type="submit"]');
  const alert = document.getElementById("rk-form-error");
  const main = document.getElementById("main-content");
  const sessionBox = document.getElementById("rk-session-state");
  const controller = new AbortController();
  const touched = new Set();
  let busy = false;
  const emailOK = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  function values() {
    return Object.fromEntries(
      ["full_name", "phone", "email", "password"].map((name) => [
        name,
        form.elements.namedItem(name)?.value || "",
      ]),
    );
  }
  function validate(data) {
    const errors = {};
    if (register && data.full_name.trim().length < 2)
      errors.full_name = "Vui lòng nhập họ và tên từ 2 ký tự.";
    if (
      register &&
      !/^(0[35789]\d{8}|\+84[35789]\d{8})$/.test(data.phone.trim())
    )
      errors.phone = "Số điện thoại chưa hợp lệ. Ví dụ: 0912345678.";
    if (!emailOK(data.email))
      errors.email = "Vui lòng nhập địa chỉ email hợp lệ.";
    if (!data.password) errors.password = "Vui lòng nhập mật khẩu.";
    else if (
      register &&
      (data.password.length < 8 ||
        new TextEncoder().encode(data.password).length > 72)
    )
      errors.password = "Mật khẩu cần ít nhất 8 ký tự và tối đa 72 byte.";
    return errors;
  }
  function display(name, text) {
    const wrapper = form.querySelector('[data-field="' + name + '"]');
    if (!wrapper) return;
    const input = wrapper.querySelector("input");
    const note = wrapper.querySelector(".rk-field-message");
    wrapper.classList.toggle("has-error", Boolean(text));
    input.setAttribute("aria-invalid", String(Boolean(text)));
    note.textContent = text || "";
    note.hidden = !text;
    if (text) input.setAttribute("aria-describedby", name + "-error");
    else if (register && name === "password")
      input.setAttribute("aria-describedby", "password-hint");
    else input.removeAttribute("aria-describedby");
    if (name === "email") {
      const valid = touched.has("email") && emailOK(input.value) && !text;
      wrapper.classList.toggle("is-valid", valid);
      wrapper.querySelector(".rk-valid-icon").hidden = !valid;
    }
  }
  form.querySelector(".rk-password-toggle").innerHTML = icon("eye");
  form.addEventListener(
    "focusout",
    (event) => {
      if (
        !["full_name", "phone", "email", "password"].includes(event.target.name)
      )
        return;
      touched.add(event.target.name);
      display(event.target.name, validate(values())[event.target.name]);
    },
    { signal: controller.signal },
  );
  form.addEventListener(
    "input",
    (event) => {
      if (event.target.name === "remember") return;
      display(
        event.target.name,
        touched.has(event.target.name)
          ? validate(values())[event.target.name]
          : "",
      );
      show(alert, "");
    },
    { signal: controller.signal },
  );
  form.querySelector(".rk-password-toggle").addEventListener(
    "click",
    (event) => {
      const password = form.elements.namedItem("password");
      const visible = password.type === "password";
      password.type = visible ? "text" : "password";
      event.currentTarget.setAttribute(
        "aria-label",
        visible ? "Ẩn mật khẩu" : "Hiện mật khẩu",
      );
      event.currentTarget.setAttribute("aria-pressed", String(visible));
      event.currentTarget.innerHTML = icon(visible ? "eyeOff" : "eye");
    },
    { signal: controller.signal },
  );
  document.getElementById("rk-forgot")?.addEventListener(
    "click",
    () => {
      document.getElementById("rk-forgot-note").hidden = false;
    },
    { signal: controller.signal },
  );
  form.addEventListener(
    "submit",
    async (event) => {
      event.preventDefault();
      if (busy) return;
      const data = values();
      const errors = validate(data);
      for (const name of Object.keys(data)) {
        touched.add(name);
        display(name, errors[name]);
      }
      show(alert, "");
      if (Object.keys(errors).length) {
        form.elements.namedItem(Object.keys(errors)[0])?.focus();
        return;
      }
      busy = true;
      fieldset.disabled = true;
      form.setAttribute("aria-busy", "true");
      button.innerHTML =
        '<span class="rk-spinner"></span>' +
        (register
          ? "Đang tạo tài khoản cho bạn..."
          : "Đang đăng nhập cho bạn...");
      try {
        if (register) {
          await global.RK_AUTH.register(data, controller.signal);
          if (!controller.signal.aborted)
            global.RK_NAV.go(global.RK_CONFIG.loginURL + "?registered=1", true);
        } else {
          const user = await global.RK_AUTH.login(
            data.email,
            data.password,
            form.elements.namedItem("remember").checked,
            controller.signal,
          );
          if (!controller.signal.aborted)
            global.RK_NAV.go(global.RK_AUTH.home(user.role), true);
        }
      } catch (error) {
        if (!controller.signal.aborted && !global.axios.isCancel(error))
          show(alert, message(error));
      } finally {
        busy = false;
        if (!controller.signal.aborted) {
          fieldset.disabled = false;
          form.setAttribute("aria-busy", "false");
          button.innerHTML =
            (register ? "Tạo tài khoản " : "Đăng nhập ") + icon("arrow");
        }
      }
    },
    { signal: controller.signal },
  );
  const query = new URLSearchParams(global.location.search);
  const notice = query.has("registered")
    ? "Tạo tài khoản thành công. Bạn có thể đăng nhập ngay."
    : query.get("reason") === "session-expired"
      ? "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."
      : query.get("reason") === "locked"
        ? "Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên."
        : "";
  show(
    document.getElementById("rk-auth-notice"),
    notice,
    query.has("registered") ? "success" : "info",
  );
  const unsubscribe = global.RK_AUTH.subscribe((session) => {
    global.RK_LAYOUT.guest(session, true);
    if (session.status === "error") {
      main.hidden = true;
      global.RK_UI.sessionError(sessionBox, session.error);
    } else if (session.status === "loading") {
      main.hidden = true;
      sessionBox.hidden = false;
      sessionBox.textContent = "Đang kiểm tra phiên đăng nhập...";
    } else if (session.user && !busy)
      global.RK_NAV.go(global.RK_AUTH.home(session.user.role), true);
    else {
      main.hidden = false;
      sessionBox.hidden = true;
    }
  });
  void global.RK_AUTH.restore();
  global.addEventListener(
    "pagehide",
    () => {
      controller.abort();
      unsubscribe();
    },
    { once: true },
  );
})(window);
