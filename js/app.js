// ============================================================
// app.js — inisialisasi aplikasi & load data per halaman
// ============================================================

const loadedPages = new Set();

async function loadPage(pageName) {
  try {
    if (pageName === "today") {
      await Planner.loadToday();
    } else if (pageName === "planner") {
      await Planner.loadWeek();
    } else if (pageName === "recipes") {
      await Recipes.load();
    } else if (pageName === "pantry") {
      await Pantry.load();
    } else if (pageName === "shopping") {
      await Shopping.load();
    }
  } catch (err) {
    console.error(`Gagal memuat halaman ${pageName}:`, err);
    showToast("Gagal memuat data. Cek koneksi Supabase.");
  }
}

window.addEventListener("page:show", (e) => {
  // selalu refresh "today" & "shopping" karena bergantung pada stok terbaru;
  // halaman lain cukup dimuat sekali lalu cache di-reuse.
  const pageName = e.detail.page;
  if (pageName === "today" || pageName === "shopping" || !loadedPages.has(pageName)) {
    loadedPages.add(pageName);
    loadPage(pageName);
  }
});

document.getElementById("btnSettings").addEventListener("click", () => {
  Nav.goTo("pantry");
});

(async function init() {
  const ok = initSupabase();
  if (!ok) return;
  // muat halaman pertama (today)
  loadedPages.add("today");
  await loadPage("today");
})();
