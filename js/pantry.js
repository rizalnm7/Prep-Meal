// ============================================================
// pantry.js — stok bahan di rumah
// ============================================================

const Pantry = {
  cache: [],

  async load() {
    Pantry.cache = await DB.listPantry();
    Pantry.render();
  },

  render(filterText = "") {
    const list = document.getElementById("pantryList");
    const empty = document.getElementById("pantryEmpty");
    const items = Pantry.cache.filter(p => (p.ingredients?.name || "").toLowerCase().includes(filterText.toLowerCase()));

    if (!items.length) {
      list.innerHTML = "";
      empty.hidden = false;
      return;
    }
    empty.hidden = true;

    list.innerHTML = items.map(p => `
      <div class="pantryrow" data-pantry-id="${p.id}">
        <span class="pantryrow__name">${escapeHtml(p.ingredients?.name || "")}</span>
        <div class="pantryrow__qtywrap">
          <button class="qtybtn" data-qty-action="dec">−</button>
          <span class="pantryrow__qty">${formatQty(p.quantity, p.unit)}</span>
          <button class="qtybtn" data-qty-action="inc">+</button>
          <button class="iconbtn" data-qty-action="del" style="width:30px;height:30px;font-size:13px;">✕</button>
        </div>
      </div>
    `).join("");

    list.querySelectorAll(".pantryrow").forEach(row => {
      const pantryId = row.dataset.pantryId;
      const item = Pantry.cache.find(p => p.id === pantryId);
      const step = item.unit === "gram" || item.unit === "ml" ? 50 : 1;

      row.querySelector('[data-qty-action="inc"]').addEventListener("click", async () => {
        const updated = await DB.setPantryQty(pantryId, Number(item.quantity) + step);
        Pantry.patchOne(updated);
      });
      row.querySelector('[data-qty-action="dec"]').addEventListener("click", async () => {
        const updated = await DB.setPantryQty(pantryId, Number(item.quantity) - step);
        Pantry.patchOne(updated);
      });
      row.querySelector('[data-qty-action="del"]').addEventListener("click", async () => {
        if (!confirm(`Hapus "${item.ingredients?.name}" dari stok?`)) return;
        await DB.deletePantryItem(pantryId);
        Pantry.cache = Pantry.cache.filter(p => p.id !== pantryId);
        Pantry.render(document.getElementById("pantrySearch").value);
      });
    });
  },

  patchOne(updated) {
    const idx = Pantry.cache.findIndex(p => p.id === updated.id);
    if (idx !== -1) Pantry.cache[idx] = updated;
    Pantry.render(document.getElementById("pantrySearch").value);
  },

  openAddForm() {
    Sheet.open(`
      <h3>Tambah Bahan ke Stok</h3>
      <form id="pantryForm">
        <label class="fieldlabel">Nama bahan</label>
        <input type="text" id="p_name" class="textinput" required placeholder="cth. Beras">
        <div style="display:flex;gap:10px;">
          <div style="flex:1;">
            <label class="fieldlabel">Jumlah</label>
            <input type="number" id="p_qty" class="textinput" min="0" step="any" required placeholder="0">
          </div>
          <div style="flex:1;">
            <label class="fieldlabel">Satuan</label>
            <select id="p_unit" class="selectinput">
              ${UNIT_OPTIONS.map(u => `<option value="${u}">${u}</option>`).join("")}
            </select>
          </div>
        </div>
        <button type="submit" class="btn btn--primary btn--block">Simpan</button>
      </form>
    `, (content) => {
      content.querySelector("#pantryForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const name = content.querySelector("#p_name").value.trim();
        const qty = parseFloat(content.querySelector("#p_qty").value);
        const unit = content.querySelector("#p_unit").value;
        if (!name || !qty) return;
        try {
          await DB.addPantryItem(name, qty, unit);
          showToast("Bahan ditambahkan ke stok");
          Sheet.close();
          Pantry.load();
        } catch (err) {
          console.error(err);
          showToast("Gagal menambahkan bahan");
        }
      });
    });
  },
};

document.getElementById("btnAddIngredient").addEventListener("click", () => Pantry.openAddForm());
document.getElementById("pantrySearch").addEventListener("input", (e) => Pantry.render(e.target.value));
