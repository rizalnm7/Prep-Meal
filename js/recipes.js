// ============================================================
// recipes.js — daftar resep, tambah/edit, detail
// ============================================================

const Recipes = {
  cache: [],

  async load() {
    Recipes.cache = await DB.listRecipes();
    Recipes.render();
  },

  render(filterText = "") {
    const grid = document.getElementById("recipeGrid");
    const empty = document.getElementById("recipeEmpty");
    const list = Recipes.cache.filter(r => r.name.toLowerCase().includes(filterText.toLowerCase()));

    if (!list.length) {
      grid.innerHTML = "";
      empty.hidden = false;
      return;
    }
    empty.hidden = true;

    grid.innerHTML = list.map(r => `
      <button class="recipecard" data-recipe-id="${r.id}">
        <div class="recipecard__photo" style="${r.photo_url ? `background-image:url('${escapeHtml(r.photo_url)}')` : ""}">
          ${r.photo_url ? "" : "🍲"}
        </div>
        <p class="recipecard__name">${escapeHtml(r.name)}</p>
        <p class="recipecard__meta">${mealTypeLabel(r.category)} · ${r.prep_minutes ? r.prep_minutes + " mnt" : "—"}</p>
      </button>
    `).join("");

    grid.querySelectorAll("[data-recipe-id]").forEach(card => {
      card.addEventListener("click", () => Recipes.openDetail(card.dataset.recipeId));
    });
  },

  async openDetail(recipeId) {
    const recipe = Recipes.cache.find(r => r.id === recipeId) || await DB.getRecipe(recipeId);
    const ingredients = await DB.getRecipeIngredients(recipeId);

    Sheet.open(`
      <h3>${escapeHtml(recipe.name)}</h3>
      <p class="page__hint">${mealTypeLabel(recipe.category)} · ${recipe.servings} porsi ${recipe.prep_minutes ? "· " + recipe.prep_minutes + " menit" : ""}</p>
      ${recipe.description ? `<p style="margin-bottom:14px;font-size:14px;">${escapeHtml(recipe.description)}</p>` : ""}

      <p class="fieldlabel" style="margin-top:10px;">Bahan</p>
      <div class="mealcard" style="margin-bottom:14px;">
        ${ingredients.map(i => `
          <div class="ingrow">
            <span class="ingrow__name">${escapeHtml(i.ingredients?.name || "")}</span>
            <span class="ingrow__qty">${formatQty(i.quantity, i.unit)}</span>
          </div>
        `).join("") || `<p style="font-size:13px;color:var(--color-ink-soft);">Belum ada bahan tercatat.</p>`}
      </div>

      ${recipe.instructions ? `
        <p class="fieldlabel">Cara membuat</p>
        <p style="font-size:14px;white-space:pre-wrap;line-height:1.6;margin-bottom:16px;">${escapeHtml(recipe.instructions)}</p>
      ` : ""}

      <div style="display:flex;gap:8px;">
        <button class="btn btn--ghost" style="flex:1;" id="btnEditRecipe">Edit</button>
        <button class="btn btn--danger" style="flex:1;" id="btnDeleteRecipe">Hapus</button>
      </div>
    `, (content) => {
      content.querySelector("#btnEditRecipe").addEventListener("click", () => Recipes.openForm(recipe, ingredients));
      content.querySelector("#btnDeleteRecipe").addEventListener("click", async () => {
        if (!confirm(`Hapus resep "${recipe.name}"?`)) return;
        await DB.deleteRecipe(recipe.id);
        Sheet.close();
        showToast("Resep dihapus");
        Recipes.load();
      });
    });
  },

  openForm(recipe = null, existingIngredients = []) {
    const isEdit = !!recipe;
    const lines = existingIngredients.length
      ? existingIngredients.map(i => ({ name: i.ingredients?.name || "", quantity: i.quantity, unit: i.unit }))
      : [{ name: "", quantity: "", unit: "gram" }];

    const renderIngredientRows = (lines) => lines.map((l, idx) => `
      <div class="dynrow" data-idx="${idx}">
        <input type="text" class="textinput ing-name" placeholder="Nama bahan" value="${escapeHtml(l.name)}" style="flex:2;">
        <input type="number" class="textinput ing-qty" placeholder="Jml" value="${l.quantity || ""}" style="flex:1;" min="0" step="any">
        <select class="selectinput ing-unit" style="flex:1;">
          ${UNIT_OPTIONS.map(u => `<option value="${u}" ${u === l.unit ? "selected" : ""}>${u}</option>`).join("")}
        </select>
        <button type="button" class="dynrow__del" data-del-idx="${idx}">✕</button>
      </div>
    `).join("");

    Sheet.open(`
      <h3>${isEdit ? "Edit Resep" : "Resep Baru"}</h3>
      <form id="recipeForm">
        <label class="fieldlabel">Nama resep</label>
        <input type="text" id="f_name" class="textinput" required value="${escapeHtml(recipe?.name || "")}" placeholder="cth. Ayam Geprek Sambal Matah">

        <label class="fieldlabel">Kategori</label>
        <select id="f_category" class="selectinput">
          ${MEAL_TYPES.map(m => `<option value="${m.value}" ${recipe?.category === m.value ? "selected" : ""}>${m.label}</option>`).join("")}
        </select>

        <div style="display:flex;gap:10px;">
          <div style="flex:1;">
            <label class="fieldlabel">Porsi</label>
            <input type="number" id="f_servings" class="textinput" min="1" value="${recipe?.servings || 1}">
          </div>
          <div style="flex:1;">
            <label class="fieldlabel">Waktu (menit)</label>
            <input type="number" id="f_prep" class="textinput" min="0" value="${recipe?.prep_minutes || ""}">
          </div>
        </div>

        <label class="fieldlabel">Foto (URL, opsional)</label>
        <input type="text" id="f_photo" class="textinput" value="${escapeHtml(recipe?.photo_url || "")}" placeholder="https://...">

        <label class="fieldlabel">Bahan-bahan</label>
        <div id="ingredientRows">${renderIngredientRows(lines)}</div>
        <button type="button" class="btn btn--ghost btn--block" id="btnAddIngRow" style="margin-bottom:14px;">+ Tambah bahan</button>

        <label class="fieldlabel">Cara membuat</label>
        <textarea id="f_instructions" class="textinput" rows="4" placeholder="Langkah-langkah memasak...">${escapeHtml(recipe?.instructions || "")}</textarea>

        <button type="submit" class="btn btn--primary btn--block">${isEdit ? "Simpan Perubahan" : "Simpan Resep"}</button>
      </form>
    `, (content) => {
      let rowState = [...lines];

      const readRowsFromDOM = () => {
        const domRows = content.querySelectorAll("#ingredientRows .dynrow");
        return Array.from(domRows).map(row => ({
          name: row.querySelector(".ing-name").value,
          quantity: row.querySelector(".ing-qty").value,
          unit: row.querySelector(".ing-unit").value,
        }));
      };

      const refreshRows = () => {
        content.querySelector("#ingredientRows").innerHTML = renderIngredientRows(rowState);
      };

      content.querySelector("#btnAddIngRow").addEventListener("click", () => {
        rowState = readRowsFromDOM(); // simpan dulu apa yang sudah diketik
        rowState.push({ name: "", quantity: "", unit: "gram" });
        refreshRows();
      });

      content.querySelector("#ingredientRows").addEventListener("click", (e) => {
        const delBtn = e.target.closest("[data-del-idx]");
        if (delBtn) {
          rowState = readRowsFromDOM(); // simpan dulu apa yang sudah diketik di baris lain
          rowState.splice(Number(delBtn.dataset.delIdx), 1);
          if (!rowState.length) rowState.push({ name: "", quantity: "", unit: "gram" });
          refreshRows();
        }
      });

      content.querySelector("#recipeForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const rows = content.querySelectorAll("#ingredientRows .dynrow");
        const ingredientLines = Array.from(rows).map(row => ({
          name: row.querySelector(".ing-name").value,
          quantity: parseFloat(row.querySelector(".ing-qty").value) || 0,
          unit: row.querySelector(".ing-unit").value,
        })).filter(l => l.name.trim() && l.quantity > 0);

        const payload = {
          name: content.querySelector("#f_name").value.trim(),
          category: content.querySelector("#f_category").value,
          servings: parseInt(content.querySelector("#f_servings").value) || 1,
          prep_minutes: parseInt(content.querySelector("#f_prep").value) || null,
          photo_url: content.querySelector("#f_photo").value.trim() || null,
          instructions: content.querySelector("#f_instructions").value.trim() || null,
        };

        try {
          if (isEdit) {
            await DB.updateRecipe(recipe.id, payload, ingredientLines);
            showToast("Resep diperbarui");
          } else {
            await DB.createRecipe(payload, ingredientLines);
            showToast("Resep tersimpan");
          }
          Sheet.close();
          Recipes.load();
        } catch (err) {
          console.error(err);
          showToast("Gagal menyimpan resep");
        }
      });
    });
  },
};

document.getElementById("btnAddRecipe").addEventListener("click", () => Recipes.openForm());
document.getElementById("recipeSearch").addEventListener("input", (e) => Recipes.render(e.target.value));
