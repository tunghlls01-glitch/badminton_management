(function () {
  const lockOverlay = document.getElementById("lockDrawerOverlay");
  if (!lockOverlay) return;

  const lockForm = document.getElementById("lockCourtForm");
  const lockCourtIdInput = document.getElementById("lockCourtId");
  const lockDrawerTitle = document.getElementById("lockDrawerTitle");
  const lockDrawerSubtitle = document.getElementById("lockDrawerSubtitle");
  const lockStartInput = document.getElementById("lockStartAt");
  const lockEndInput = document.getElementById("lockEndAt");
  const lockReasonInput = document.getElementById("lockReason");
  const lockErrorBox = document.getElementById("lockFormErrorBox");
  const affectedBox = document.getElementById("affectedBookingsBox");
  const affectedTitle = document.getElementById("affectedBookingsTitle");
  const affectedList = document.getElementById("affectedBookingsList");
  const locksListEl = document.getElementById("courtLocksList");

  const MOCK_BOOKINGS = [
    { id: 101, customer_name: "Nguyễn Văn A", start_at: "2026-11-22T08:00:00", end_at: "2026-11-22T10:00:00", status: "confirmed" },
    { id: 102, customer_name: "Trần Thị B", start_at: "2026-11-22T14:00:00", end_at: "2026-11-22T16:00:00", status: "pending" },
  ];

  const storageKey = (courtId) => `rk_court_locks_${courtId}`;

  function loadLocalLocks(courtId) {
    try {
      return JSON.parse(localStorage.getItem(storageKey(courtId)) || "[]");
    } catch {
      return [];
    }
  }

  function saveLocalLocks(courtId, items) {
    localStorage.setItem(storageKey(courtId), JSON.stringify(items));
  }

  function formatDt(val) {
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) return val;
    return d.toLocaleString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  function findAffectedBookings(startStr, endStr) {
    const s = new Date(startStr).getTime();
    const e = new Date(endStr).getTime();
    return MOCK_BOOKINGS.filter(
      (b) => new Date(b.start_at).getTime() < e && new Date(b.end_at).getTime() > s
    );
  }

  function renderAffectedBookings(bookings) {
    if (!bookings || bookings.length === 0) {
      affectedBox.hidden = true;
      affectedList.innerHTML = "";
      return;
    }
    affectedBox.hidden = false;
    affectedTitle.textContent = `Cảnh báo: Có ${bookings.length} booking đã đặt bị ảnh hưởng`;
    affectedList.innerHTML = bookings
      .map(
        (b) =>
          `<li><strong>${b.customer_name || "Khách đặt"}</strong> (#${b.id}) — ${formatDt(b.start_at)} đến ${formatDt(b.end_at)}</li>`
      )
      .join("");
  }

  async function fetchLocks(courtId) {
    locksListEl.innerHTML = `<span style="color:#6b7280;">Đang tải lịch khoá...</span>`;
    if (window.axiosClient) {
      try {
        const res = await window.axiosClient.get(`/courts/${courtId}/maintenance-blocks`);
        const data = Array.isArray(res.data) ? res.data : [];
        saveLocalLocks(courtId, data);
        renderLocksList(courtId, data);
        return;
      } catch {
        // Fallback localStorage when API not wired
      }
    }
    renderLocksList(courtId, loadLocalLocks(courtId));
  }

  function renderLocksList(courtId, locks) {
    if (!locks || locks.length === 0) {
      locksListEl.innerHTML = `<span style="color:#6b7280;">Sân hiện chưa có khoảng thời gian nào bị khoá.</span>`;
      return;
    }
    locksListEl.innerHTML = locks
      .map(
        (lk) => `
        <div class="rk-lock-item">
          <div class="rk-lock-item-meta">
            <strong>${lk.reason}</strong>
            <span>${formatDt(lk.start_at)} → ${formatDt(lk.end_at)}</span>
          </div>
          <button type="button" class="btn-court-action to-delete" data-unlock-id="${lk.id}">Gỡ khoá</button>
        </div>`
      )
      .join("");

    locksListEl.querySelectorAll("[data-unlock-id]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const blockId = btn.getAttribute("data-unlock-id");
        if (window.axiosClient) {
          try {
            await window.axiosClient.delete(`/courts/${courtId}/maintenance-blocks/${blockId}`);
          } catch {
            // ignore in mock mode
          }
        }
        const next = loadLocalLocks(courtId).filter((x) => String(x.id) !== String(blockId));
        saveLocalLocks(courtId, next);
        renderLocksList(courtId, next);
      });
    });
  }

  function injectLockButtons() {
    const tbody = document.getElementById("courtsTableBody");
    if (!tbody) return;
    tbody.querySelectorAll("tr").forEach((tr) => {
      const actionsCell = tr.querySelector(".court-actions");
      if (!actionsCell || actionsCell.querySelector(".to-lock")) return;

      const idAttr =
        tr.getAttribute("data-court-id") ||
        actionsCell.querySelector("[data-id]")?.getAttribute("data-id") ||
        tr.querySelector("button[onclick*='(']")?.getAttribute("onclick")?.match(/\((\d+)\)/)?.[1];

      const courtName = tr.querySelector(".court-name")?.textContent?.trim() || "Sân";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn-court-action to-lock";
      btn.textContent = "Khoá lịch";
      btn.addEventListener("click", () => openLockDrawer(idAttr || "1", courtName));
      actionsCell.prepend(btn);
    });
  }

  function openLockDrawer(courtId, courtName) {
    lockCourtIdInput.value = courtId;
    lockDrawerTitle.textContent = `Khoá sân bảo trì — ${courtName}`;
    lockDrawerSubtitle.textContent = "Chọn khung giờ khoá sân; hệ thống tự báo booking bị trùng lịch.";
    lockForm.reset();
    lockErrorBox.style.display = "none";
    affectedBox.hidden = true;
    affectedList.innerHTML = "";
    lockOverlay.classList.add("open");
    fetchLocks(courtId);
  }

  function closeLockDrawer() {
    lockOverlay.classList.remove("open");
  }

  document.getElementById("btnCloseLockDrawer")?.addEventListener("click", closeLockDrawer);
  document.getElementById("btnCancelLockDrawer")?.addEventListener("click", closeLockDrawer);

  lockForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const courtId = lockCourtIdInput.value;
    const startAt = lockStartInput.value;
    const endAt = lockEndInput.value;
    const reason = lockReasonInput.value.trim();

    if (!startAt || !endAt || new Date(endAt) <= new Date(startAt)) {
      lockErrorBox.textContent = "Thời gian kết thúc phải lớn hơn thời gian bắt đầu.";
      lockErrorBox.style.display = "block";
      return;
    }
    lockErrorBox.style.display = "none";

    let created = null;
    if (window.axiosClient) {
      try {
        const res = await window.axiosClient.post(`/courts/${courtId}/maintenance-blocks`, {
          reason,
          start_at: startAt,
          end_at: endAt,
        });
        created = res.data;
      } catch {
        // Fallback local when API not wired
      }
    }

    const affected = created?.affected_bookings || findAffectedBookings(startAt, endAt);
    const blockRecord = created || {
      id: Date.now(),
      court_id: courtId,
      reason,
      start_at: startAt,
      end_at: endAt,
    };

    const updated = [blockRecord, ...loadLocalLocks(courtId)];
    saveLocalLocks(courtId, updated);
    renderLocksList(courtId, updated);
    renderAffectedBookings(affected);
  });

  const observer = new MutationObserver(injectLockButtons);
  const tbody = document.getElementById("courtsTableBody");
  if (tbody) {
    observer.observe(tbody, { childList: true, subtree: true });
  }
  injectLockButtons();
})();