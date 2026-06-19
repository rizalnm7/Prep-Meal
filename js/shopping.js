// ============================================================
// shopping.js — daftar belanja: generate otomatis dari rencana
// makan (7 hari ke depan) dibanding stok di pantry
// ============================================================

const Shopping = {
  cache: [],

  async load() {
    Shopping.cache = await DB.listShoppingItems();
    Shopping.render();
  },

  render() {
    const needList = document.getElementById("shoppingNeedList");
    const needEmpty = document.getElementById("shoppingNeedEmpty");
    const checkedList = document.getElementById("shoppingCheckedList");

    const needed = Shopping.cache.filter(i => !i.is_checked);
    const checked = Shopping.cache.filter(i => i.is_checked);

    needEmpty.hidden = needed.length > 0;
    needList.innerHTML = needed.map(Shopping.itemHtml).join("");
    checkedList.innerHTML = checked.map(Shopping.itemHtml).join("") ||
      `<p style="font-size:12px;color:var(--color-ink-soft);">Belum ada yang dicentang.</p>`;

    [needList, checkedList].forEach(container => {
      container.querySelectorAll("[data-item-id]").forEach(row => {
        const id = row.dataset.itemId;
        const item = Shopping.cache.find(i => i.id === id);

        row.querySelector(".checkbox").addEventListener("click", async () => {
          const newChecked = !item.is_checked;
          await DB.toggleShoppingItem(id, newChecked);
          if (newChecked && item.ingredient_id) {
            // tawarkan tambah ke stok otomatis
            await DB.addPantryItem(item.ingredients?.name || item.custom_name, item.quantity || 0, item.unit || "pcs");
          }
          item.is_checked = newChecked;
          Shopping.render();
        });

        const delBtn = row.querySelector(".shopitem__del");
        if (delBtn) {
          delBtn.addEventListener("click", async () => {
            await DB.deleteShoppingItem(id);
            Shopping.cache = Shopping.cache.filter(i => i.id !== id);
            Shopping.render();
          });
        }
      });
    });
  },

  itemHtml(item) {
    const name = item.ingredients?.name || item.custom_name || "Item";
    return `
      <div class="shopitem ${item.is_checked ? "is-checked" : ""}" data-item-id="${item.id}">
        <button class="checkbox ${item.is_checked ? "is-checked" : ""}">${item.is_checked ? "✓" : ""}</button>
        <span class="shopitem__name">${escapeHtml(name)}</span>
        <span class="shopitem__qty">${item.quantity ? formatQty(item.quantity, item.unit) : ""}</span>
        <button class="shopitem__del">✕</button>
      </div>
    `;
  },

  async generate() {
    const today = new Date();
    const endDate = addDays(today, 6);
    const plans = await DB.listMealPlansInRange(formatDateISO(today), formatDateISO(endDate));

    if (!plans.length) {
      showToast("Belum ada rencana makan 7 hari ke depan");
      return;
    }

    // total kebutuhan bahan, di-scale sesuai porsi rencana vs porsi resep asli
    const neededMap = new Map(); // ingredient_id -> { quantity, unit, name }
    for (const plan of plans) {
      const ingredients = await DB.getRecipeIngredients(plan.recipe_id);
      const scale = (plan.servings || 1) / (plan.recipes?.servings || 1);
      for (const i of ingredients) {
        const key = i.ingredient_id;
        const qty = Number(i.quantity) * scale;
        if (neededMap.has(key)) {
          neededMap.get(key).quantity += qty;
        } else {
          neededMap.set(key, { quantity: qty, unit: i.unit, name: i.ingredients?.name });
        }
      }
    }

    const pantry = await DB.listPantry();
    const pantryMap = new Map(pantry.map(p => [p.ingredients?.id, Number(p.quantity)]));

    const rowsToInsert = [];
    for (const [ingredientId, need] of neededMap.entries()) {
      const have = pantryMap.get(ingredientId) || 0;
      const shortfall = need.quantity - have;
      if (shortfall > 0.001) {
        rowsToInsert.push({
          ingredient_id: ingredientId,
          quantity: Math.round(shortfall * 100) / 100,
          unit: need.unit,
          is_manual: false,
          is_checked: false,
        });
      }
    }

    await DB.clearGeneratedItems();
    await DB.insertShoppingItems(rowsToInsert);
    showToast(`Daftar belanja diperbarui (${rowsToInsert.length} item)`);
    Shopping.load();
  },

  openManualForm() {
    Sheet.open(`
      <h3>Tambah Item Manual</h3>
      <form id="manualItemForm">
        <label class="fieldlabel">Nama item</label>
        <input type="text" id="m_name" class="textinput" required placeholder="cth. Plastik wrap">
        <div style="display:flex;gap:10px;">
          <div style="flex:1;">
            <label class="fieldlabel">Jumlah (opsional)</label>
            <input type="number" id="m_qty" class="textinput" min="0" step="any" placeholder="0">
          </div>
          <div style="flex:1;">
            <label class="fieldlabel">Satuan</label>
            <select id="m_unit" class="selectinput">
              <option value="pcs">pcs</option>
              ${UNIT_OPTIONS.map(u => `<option value="${u}">${u}</option>`).join("")}
            </select>
          </div>
        </div>
        <button type="submit" class="btn btn--primary btn--block">Tambahkan</button>
      </form>
    `, (content) => {
      content.querySelector("#manualItemForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const name = content.querySelector("#m_name").value.trim();
        const qty = parseFloat(content.querySelector("#m_qty").value) || null;
        const unit = content.querySelector("#m_unit").value;
        if (!name) return;
        await DB.addManualShoppingItem(name, qty, unit);
        showToast("Item ditambahkan");
        Sheet.close();
        Shopping.load();
      });
    });
  },
};

document.getElementById("btnGenerateList").addEventListener("click", () => Shopping.generate());
document.getElementById("btnAddManualItem").addEventListener("click", () => Shopping.openManualForm());
