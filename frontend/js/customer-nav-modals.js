(function () {
  const modal = document.createElement("div");
  modal.id = "customerNavModal";
  modal.className = "modal-backdrop customer-nav-backdrop";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-labelledby", "customerNavModalTitle");
  modal.innerHTML = `
    <section class="modal-card customer-nav-card">
      <header class="modal-header customer-nav-modal-header">
        <h2 id="customerNavModalTitle" class="modal-title"></h2>
        <button type="button" class="modal-close" data-nav-modal-close aria-label="Đóng">×</button>
      </header>
      <div class="modal-body customer-nav-modal-body" id="customerNavModalBody"></div>
    </section>
  `;
  document.body.append(modal);

  const title = modal.querySelector("#customerNavModalTitle");
  const body = modal.querySelector("#customerNavModalBody");
  const closeButton = modal.querySelector("[data-nav-modal-close]");
  let previousTrigger = null;

  const panels = {
    offers: {
      title: "Ưu đãi dành cho bạn",
      body: `
        <div class="customer-offer-panel">
          <p class="customer-offer-eyebrow">CHƠI NHIỀU HƠN, VUI NHIỀU HƠN</p>
          <h3>Giảm 15% lượt đặt đầu</h3>
          <p class="customer-offer-code">Mã ưu đãi: <strong aria-label="Chưa có mã ưu đãi"></strong></p>
        </div>
        <p class="customer-nav-note">Ưu đãi minh họa. Chức năng áp dụng mã và thanh toán chưa được kết nối trong bản demo.</p>
      `,
    },
    support: {
      title: "Sân Nhà luôn sẵn sàng",
      body: `
        <p class="customer-support-intro">Cần đổi lịch, tìm sân hoặc hỗ trợ đặt sân?</p>
        <div class="customer-support-row"><span>Hotline</span><a href="tel:1900636888"><strong>1900 636 888</strong></a></div>
        <div class="customer-support-row"><span>Email</span><a href="mailto:khangtien10032008@gmail.com"><strong>khangtien10032008@gmail.com</strong></a></div>
        <p class="customer-nav-note">Thời gian hỗ trợ: 07:00 – 22:00 mỗi ngày.</p>
      `,
    },
  };

  function closePanel() {
    modal.classList.remove("open");
    previousTrigger?.focus();
  }

  document.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-nav-panel]");
    if (trigger) {
      const panel = panels[trigger.dataset.navPanel];
      if (!panel) return;
      event.preventDefault();
      previousTrigger = trigger;
      title.textContent = panel.title;
      body.innerHTML = panel.body;
      modal.classList.add("open");
      closeButton.focus();
      return;
    }

    if (event.target === modal || event.target.closest("[data-nav-modal-close]")) {
      closePanel();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && modal.classList.contains("open")) closePanel();
  });
})();
