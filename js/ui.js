// ============================================================
// ui.js — bottom sheet modal & navigasi tab
// ============================================================

const Sheet = {
  open(html, onMount) {
    const overlay = document.getElementById("sheetOverlay");
    const content = document.getElementById("sheetContent");
    content.innerHTML = html;
    overlay.hidden = false;
    requestAnimationFrame(() => { overlay.style.opacity = "1"; });
    if (onMount) onMount(content);
  },
  close() {
    document.getElementById("sheetOverlay").hidden = true;
  },
};

document.addEventListener("click", (e) => {
  if (e.target.id === "sheetOverlay") Sheet.close();
});

const Nav = {
  current: "today",
  goTo(pageName) {
    Nav.current = pageName;
    document.querySelectorAll(".page").forEach(p => { p.hidden = p.dataset.page !== pageName; });
    document.querySelectorAll(".bottomnav__item").forEach(btn => {
      btn.classList.toggle("is-active", btn.dataset.nav === pageName);
    });
    const subtitleMap = {
      today: "Rencana makan hari ini",
      planner: "Atur menu mingguanmu",
      recipes: "Koleksi resep meal prep",
      pantry: "Bahan yang kamu punya",
      shopping: "Apa yang perlu dibeli",
    };
    document.getElementById("topbarSubtitle").textContent = subtitleMap[pageName] || "";
    window.dispatchEvent(new CustomEvent("page:show", { detail: { page: pageName } }));
  },
};

document.addEventListener("click", (e) => {
  const navBtn = e.target.closest("[data-nav]");
  if (navBtn) Nav.goTo(navBtn.dataset.nav);
});
