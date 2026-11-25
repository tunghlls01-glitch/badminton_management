/**
 * RK BADMINTON — xác nhận booking qua API và lưu lựa chọn thanh toán.
 */

let confirmTimerInterval = null;
let uploadedReceiptFile = null;
let holdSession = null;
let appliedPromotionCode = "";

const API_BASE_URL =
  (typeof CONFIG !== "undefined" && CONFIG.API_BASE_URL) ||
  "http://127.0.0.1:8000/api";
const RECEIPT_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;

function getAccessToken() {
  return localStorage.getItem("access_token") || sessionStorage.getItem("access_token");
}

async function apiRequest(path, options = {}) {
  const token = getAccessToken();
  if (!token) throw new Error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");

  const headers = { Authorization: `Bearer ${token}`, ...(options.headers || {}) };
  if (!(options.body instanceof FormData)) headers["Content-Type"] = "application/json";

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  } catch {
    throw new Error("Không kết nối được backend. Hãy kiểm tra Uvicorn và cấu hình API.");
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = typeof data?.detail === "string"
      ? data.detail
      : Array.isArray(data?.detail)
        ? data.detail.map((item) => item.msg).join("; ")
        : data?.detail?.message || `Yêu cầu thất bại (HTTP ${response.status}).`;
    const error = new Error(detail);
    error.status = response.status;
    error.code = data?.detail?.code;
    throw error;
  }
  return data;
}

function formatCurrencyVND(amount) {
  return Number(amount || 0).toLocaleString("vi-VN") + "đ";
}

function redirectToGrid(message, day) {
  if (message) sessionStorage.setItem("rk_grid_notice", message);
  const query = day ? `?day=${encodeURIComponent(day)}` : "";
  window.location.replace("./timeline_grid.html" + query);
}

function showExpiredModal() {
  document.getElementById("confirmExpiredModal")?.classList.add("open");
}

async function releaseHold(bookingId) {
  if (!bookingId || !getAccessToken()) return;
  try {
    await apiRequest("/v1/slots/release", {
      method: "POST",
      body: JSON.stringify({ booking_id: bookingId, user_id: holdSession?.userId }),
    });
  } catch (error) {
    // Lưới API vẫn tự bỏ qua hold đã hết hạn; báo lỗi để người dùng biết nếu nhả chỗ thất bại.
    showAppNotice(error.message, { type: "warning" });
  }
}

async function expireCurrentHold() {
  if (confirmTimerInterval) clearInterval(confirmTimerInterval);
  confirmTimerInterval = null;
  const bookingId = holdSession?.holdId;
  sessionStorage.removeItem("rk_hold_session");
  showExpiredModal();
  await releaseHold(bookingId);
}

async function loadAccountContact() {
  try {
    const user = window.RK_CUSTOMER_ACCOUNT
      ? await window.RK_CUSTOMER_ACCOUNT.load()
      : await apiRequest("/auth/me");
    if (!user) return;
    document.getElementById("customerName").value = user.full_name || "";
    document.getElementById("customerPhone").value = user.phone || "";
  } catch (error) {
    showAppNotice(error.message, { type: "warning" });
  }
}

function buildDateInfo(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const dayNames = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];
  const dayLabel = dayNames[date.getDay()];
  const longDate = date.toLocaleDateString("vi-VN", { day: "2-digit", month: "long" }).toUpperCase();
  return {
    dateStr: dateString,
    dayLabel,
    dayNum: String(day).padStart(2, "0"),
    fullLabel: `${dayLabel.toUpperCase()}, ${longDate}`,
    shortLabel: date.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }),
  };
}

async function restoreHoldSessionFromApi() {
  const requestedId = new URLSearchParams(window.location.search).get("hold_id") || holdSession?.holdId;
  const path = requestedId
    ? `/v1/slots/hold/${encodeURIComponent(requestedId)}`
    : "/v1/slots/hold/current";
  const data = await apiRequest(path);
  if (data.state === "confirmed") {
    return { alreadyConfirmed: true, bookingId: data.booking_id, bookingCode: data.booking_code };
  }
  if (data.state === "awaiting_reception") {
    return { awaitingReception: true, bookingId: data.booking_id, bookingCode: data.booking_code };
  }
  const timeLabel = (value) => `${value.getHours()}:${String(value.getMinutes()).padStart(2, "0")}`;
  const slots = (data.slots || []).map((item) => {
    const startAt = new Date(item.start_at);
    const endAt = new Date(item.end_at);
    const courtId = String(item.court_id);
    return {
      id: `${courtId}_${startAt.getTime()}`,
      courtId,
      courtName: item.court_name,
      slotIndex: 0,
      startTime: timeLabel(startAt),
      endTime: timeLabel(endAt),
      startAt,
      endAt,
      status: "booked",
      price: Number(item.price || 0),
    };
  }).sort((a, b) => Number(a.courtId) - Number(b.courtId) || a.startAt - b.startAt);
  if (!slots.length) throw new Error("Phiên giữ chỗ không còn khung giờ hoạt động.");

  const nextIndexByCourt = new Map();
  const grouped = [];
  for (const slot of slots) {
    slot.slotIndex = nextIndexByCourt.get(slot.courtId) || 0;
    nextIndexByCourt.set(slot.courtId, slot.slotIndex + 1);
    const previousGroup = grouped[grouped.length - 1];
    if (previousGroup && previousGroup.courtId === slot.courtId && previousGroup.endAt.getTime() === slot.startAt.getTime()) {
      previousGroup.endAt = slot.endAt;
      previousGroup.endTime = slot.endTime;
      previousGroup.slotCount += 1;
      previousGroup.totalPrice += slot.price;
    } else {
      grouped.push({
        courtId: slot.courtId,
        courtName: slot.courtName,
        startTime: slot.startTime,
        endTime: slot.endTime,
        startAt: slot.startAt,
        endAt: slot.endAt,
        slotCount: 1,
        totalPrice: slot.price,
      });
    }
  }

  const date = buildDateInfo(data.date);
  const totalPrice = Number(data.total_price || slots.reduce((sum, slot) => sum + slot.price, 0));
  holdSession = {
    holdId: data.booking_id,
    holdUntil: data.hold_expires_at,
    userId: data.user_id,
    date,
    slots,
    grouped,
    totalPrice,
  };
  sessionStorage.setItem("rk_hold_session", JSON.stringify(holdSession));
  if (!requestedId) {
    const restoredUrl = new URL(window.location.href);
    restoredUrl.searchParams.set("hold_id", String(holdSession.holdId));
    window.history.replaceState({}, "", restoredUrl);
  }
  return holdSession;
}

async function initConfirmPage() {
  document.getElementById("btnReturnToGrid")?.addEventListener("click", () => {
    redirectToGrid("Phiên giữ chỗ đã hết hạn. Hãy chọn khung giờ lại.");
  });

  const rawSession = sessionStorage.getItem("rk_hold_session");
  if (rawSession) {
    try { holdSession = JSON.parse(rawSession); }
    catch { holdSession = null; }
  }
  let restoredSession;
  try {
    restoredSession = await restoreHoldSessionFromApi();
  } catch (error) {
    showAppNotice(error.message || "Không tìm thấy phiên giữ chỗ còn hạn.", { type: "warning" });
    if (error.status === 410) showExpiredModal();
    else window.setTimeout(() => redirectToGrid("Không tìm thấy phiên giữ chỗ còn hạn. Hãy chọn khung giờ lại."), 1800);
    return;
  }
  if (restoredSession?.alreadyConfirmed) {
    sessionStorage.removeItem("rk_hold_session");
    showAppNotice(
      `Booking ${restoredSession.bookingCode} đã được xác nhận và lưu thành công.`,
      { type: "success", duration: 7000 },
    );
    window.setTimeout(() => {
      window.location.href = "./booking.html";
    }, 1800);
    return;
  }
  if (restoredSession?.awaitingReception) {
    sessionStorage.removeItem("rk_hold_session");
    window.location.replace(`./booking_notification.html?booking=${encodeURIComponent(restoredSession.bookingId)}`);
    return;
  }
  if (!new URLSearchParams(window.location.search).has("hold_id")) {
    const restoredUrl = new URL(window.location.href);
    restoredUrl.searchParams.set("hold_id", String(holdSession.holdId));
    window.history.replaceState({}, "", restoredUrl);
  }

  const expireTime = new Date(holdSession.holdUntil).getTime();
  if (!holdSession.holdId || !Number.isFinite(expireTime) || expireTime <= Date.now()) {
    void expireCurrentHold();
    return;
  }

  void loadAccountContact();
  document.getElementById("confirmDate").textContent =
    `${holdSession.date.fullLabel} (${holdSession.date.shortLabel})`;
  document.getElementById("confirmSlotList").innerHTML = (holdSession.grouped || [])
    .map((group) => `
      <div class="summary-row">
        <span><strong>${group.courtName}</strong> (${group.startTime} – ${group.endTime})</span>
        <strong>${formatCurrencyVND(group.totalPrice)}</strong>
      </div>
    `)
    .join("");

  const formattedTotal = formatCurrencyVND(holdSession.totalPrice);
  document.getElementById("confirmSubtotalPrice").textContent = formattedTotal;
  document.getElementById("confirmTotalPrice").textContent = formattedTotal;
  document.getElementById("qrTransferAmount").textContent = formattedTotal;
  document.getElementById("qrTransferNote").textContent =
    `RK DATSAN ${String(holdSession.holdId).slice(-6)}`;

  const promoInput = document.getElementById("promoCodeInput");
  const btnApplyPromo = document.getElementById("btnApplyPromo");
  const promoMessageEl = document.getElementById("confirmPromoMessage");
  const discountRowEl = document.getElementById("confirmDiscountRow");
  const discountBadgeEl = document.getElementById("confirmDiscountBadge");
  const discountAmountEl = document.getElementById("confirmDiscountAmount");

  const applyPromotionPreview = (preview) => {
    const subtotal = Number(preview.subtotal_price ?? holdSession.totalPrice) || 0;
    const discountAmt = Number(preview.discount_amount || 0);
    const total = Number(preview.total_price ?? subtotal) || 0;

    document.getElementById("confirmSubtotalPrice").textContent = formatCurrencyVND(subtotal);
    const formattedFinal = formatCurrencyVND(total);
    document.getElementById("confirmTotalPrice").textContent = formattedFinal;
    document.getElementById("qrTransferAmount").textContent = formattedFinal;

    if (discountAmt > 0 && preview.discount_code) {
      discountBadgeEl.textContent = `${preview.discount_code} (-${Number(preview.discount_percent || 0)}%)`;
      discountAmountEl.textContent = `-${formatCurrencyVND(discountAmt)}`;
      discountRowEl.hidden = false;
    } else {
      discountRowEl.hidden = true;
    }

    appliedPromotionCode = preview.discount_code || "";
    if (promoInput && preview.discount_code && !promoInput.value.trim()) {
      promoInput.value = preview.discount_code;
    }
    if (promoMessageEl && preview.message) {
      promoMessageEl.textContent = preview.message;
      promoMessageEl.classList.remove("is-error");
      promoMessageEl.hidden = false;
    }
  };

  const requestPromotionPreview = async (rawCode) => {
    if (btnApplyPromo) btnApplyPromo.disabled = true;
    try {
      const preview = await apiRequest(
        `/bookings/${encodeURIComponent(holdSession.holdId)}/promotion-preview`,
        {
          method: "POST",
          body: JSON.stringify({ code: rawCode ? rawCode.trim() : null }),
        },
      );
      applyPromotionPreview(preview);
    } catch (error) {
      if (error.status === 410) {
        await expireCurrentHold();
        return;
      }
      if (promoMessageEl) {
        promoMessageEl.textContent = error.message || "Không thể kiểm tra mã ưu đãi.";
        promoMessageEl.classList.add("is-error");
        promoMessageEl.hidden = false;
      }
    } finally {
      if (btnApplyPromo) btnApplyPromo.disabled = false;
    }
  };

  if (btnApplyPromo && promoInput) {
    btnApplyPromo.addEventListener("click", () => {
      void requestPromotionPreview(promoInput.value);
    });
    promoInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        void requestPromotionPreview(promoInput.value);
      }
    });
  }

  void requestPromotionPreview(null);

  const countdownEl = document.getElementById("confirmCountdown");
  const updateCountdown = () => {
    const remainingMs = expireTime - Date.now();
    if (remainingMs <= 0) {
      countdownEl.textContent = "00:00";
      void expireCurrentHold();
      return;
    }
    const totalSec = Math.floor(remainingMs / 1000);
    countdownEl.textContent = `${String(Math.floor(totalSec / 60)).padStart(2, "0")}:${String(totalSec % 60).padStart(2, "0")}`;
    countdownEl.classList.toggle("urgent", totalSec <= 60);
  };
  updateCountdown();
  confirmTimerInterval = window.setInterval(updateCountdown, 1000);

  const paymentSelect = document.getElementById("paymentMethod");
  const bankTransferSection = document.getElementById("bankTransferSection");
  const updatePaymentSection = () => {
    bankTransferSection.classList.toggle("hidden", paymentSelect.value !== "banking");
  };
  paymentSelect.addEventListener("change", updatePaymentSection);
  updatePaymentSection();

  const receiptInput = document.getElementById("receiptImageInput");
  const uploadPlaceholder = document.getElementById("uploadPlaceholder");
  const uploadPreviewBox = document.getElementById("uploadPreviewBox");
  const receiptPreviewImg = document.getElementById("receiptPreviewImg");
  const receiptFileName = document.getElementById("receiptFileName");
  const btnRemoveReceipt = document.getElementById("btnRemoveReceipt");

  receiptInput.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!RECEIPT_TYPES.has(file.type)) {
      showAppNotice("Chỉ nhận ảnh JPG, PNG hoặc WEBP.", { type: "warning" });
      receiptInput.value = "";
      return;
    }
    if (file.size > MAX_RECEIPT_BYTES) {
      showAppNotice("Ảnh minh chứng không được vượt quá 5 MB.", { type: "warning" });
      receiptInput.value = "";
      return;
    }

    uploadedReceiptFile = file;
    receiptFileName.textContent = file.name;
    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      receiptPreviewImg.src = loadEvent.target.result;
      uploadPlaceholder.classList.add("hidden");
      uploadPreviewBox.classList.remove("hidden");
    };
    reader.readAsDataURL(file);
  });

  btnRemoveReceipt.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    uploadedReceiptFile = null;
    receiptInput.value = "";
    receiptPreviewImg.src = "";
    uploadPreviewBox.classList.add("hidden");
    uploadPlaceholder.classList.remove("hidden");
  });

  document.getElementById("btnBackToGrid").addEventListener("click", () => {
    window.location.href = "./timeline_grid.html";
  });
  const submitButton = document.querySelector(".btn-submit-full");
  document.getElementById("confirmBookingForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (Date.now() >= expireTime) {
      await expireCurrentHold();
      return;
    }

    const paymentMethod = paymentSelect.value;
    if (paymentMethod === "banking" && !uploadedReceiptFile) {
      showAppNotice("Vui lòng tải ảnh minh chứng chuyển khoản trước khi hoàn tất.", { type: "warning" });
      return;
    }

    const formData = new FormData();
    formData.append("payment_method", paymentMethod === "banking" ? "BANK_TRANSFER" : "CASH");
    formData.append("customer_name", document.getElementById("customerName").value.trim());
    formData.append("customer_phone", document.getElementById("customerPhone").value.trim());
    formData.append("note", document.getElementById("bookingNote").value.trim());
    formData.append("promotion_code", appliedPromotionCode);
    if (paymentMethod === "banking" && uploadedReceiptFile) {
      formData.append("receipt", uploadedReceiptFile, uploadedReceiptFile.name);
    }

    if (submitButton.disabled) return;
    submitButton.disabled = true;
    const originalText = submitButton.textContent;
    submitButton.textContent = "ĐANG GỬI YÊU CẦU…";
    try {
      const result = await apiRequest(`/bookings/${encodeURIComponent(holdSession.holdId)}/confirm-with-payment`, {
        method: "POST",
        body: formData,
      });

      if (confirmTimerInterval) clearInterval(confirmTimerInterval);
      confirmTimerInterval = null;
      if (result.booking) {
        sessionStorage.setItem("rk_booking_success", JSON.stringify(result.booking));
      }
      sessionStorage.removeItem("rk_hold_session");
      submitButton.textContent = "ĐÃ GHI NHẬN ✓";
      showAppNotice(
        `${result.message} Mã booking: ${result.booking?.booking_code || holdSession.holdId}.`,
        { type: "success", duration: 7000 },
      );
      window.setTimeout(() => {
        const bookingTargetId = result.booking?.id || holdSession.holdId || "";
        window.location.href = `./booking_notification.html?booking=${encodeURIComponent(bookingTargetId)}`;
      }, 2000);
    } catch (error) {
      if (error.status === 410) {
        await expireCurrentHold();
      } else if (error.code === "SLOT_UNAVAILABLE") {
        if (confirmTimerInterval) clearInterval(confirmTimerInterval);
        confirmTimerInterval = null;
        sessionStorage.removeItem("rk_hold_session");
        await releaseHold(holdSession.holdId);
        redirectToGrid(error.message, holdSession.date?.dateStr);
      } else {
        showAppNotice(error.message, { type: "error", duration: 7000 });
        submitButton.disabled = false;
        submitButton.textContent = originalText;
      }
    }
  });
}

document.addEventListener("DOMContentLoaded", initConfirmPage);
