// ============================================================
// planner.js — tampilan "Hari Ini" & "Rencana Mingguan"
// ============================================================

const Planner = {
  weekStart: startOfWeek(new Date()),
  weekPlans: [],

  // ---------- TODAY ----------
  async loadToday() {
    const todayISO = formatDateISO(new Date());
    document.getElementById("todayDateLabel").textContent = formatDateLabel(new Date());
    const plans = await DB.listMealPlansInRange(todayISO, todayISO);
    await Planner.renderTodayWithStockCheck(plans);
  },

  async renderTodayWithStockCheck(plans) {
    const list = document.getElementById("todayMealsList");
    const empty = document.getElementById("todayEmpty");

    if (!plans.length) {
      list.innerHTML = "";
      empty.hidden = false;
      return;
    }
    empty.hidden = true;

    const pantry = await DB.listPantry();
    const pantryMap = new Map(pantry.map(p => [p.ingredients?.id, Number(p.quantity)]));

    const cards = [];
    for (const plan of plans) {
      const ingredients = await DB.getRecipeIngredients(plan.recipe_id);
      const scale = (plan.servings || 1) / (plan.recipes?.servings || 1);
      const rows = ingredients.map(i => {
        const needed = Number(i.quantity) * scale;
        const have = pantryMap.get(i.ingredient_id) || 0;
        const enough = have >= needed;
        return `
          <div class="ingrow">
            <span class="ingrow__name">${escapeHtml(i.ingredients?.name || "")} <span class="ingrow__qty">(${formatQty(needed, i.unit)})</span></span>
            <span class="stamp ${enough ? "stamp--ok" : "stamp--buy"}">${enough ? "Ada" : "Beli"}</span>
          </div>
        `;
      }).join("");

      cards.push(`
        <div class="mealcard">
          <div class="mealcard__top">
            <div>
              <span class="mealcard__type">${mealTypeLabel(plan.meal_type)}</span>
              <p class="mealcard__name">${escapeHtml(plan.recipes?.name || "")}</p>
              <p class="mealcard__meta">${plan.servings} porsi</p>
            </div>
            <button class="iconbtn" data-delete-plan="${plan.id}" style="width:30px;height:30px;font-size:13px;">✕</button>
          </div>
          <div style="margin-top:10px;">${rows}</div>
        </div>
      `);
    }
    list.innerHTML = cards.join("");

    list.querySelectorAll("[data-delete-plan]").forEach(btn => {
      btn.addEventListener("click", async () => {
        await DB.deleteMealPlan(btn.dataset.deletePlan);
        showToast("Rencana dihapus");
        Planner.loadToday();
      });
    });
  },

  // ---------- WEEK ----------
  async loadWeek() {
    const weekEnd = addDays(Planner.weekStart, 6);
    document.getElementById("weekRangeLabel").textContent =
      `${formatDateLabel(Planner.weekStart, false)} – ${formatDateLabel(weekEnd, false)}`;

    Planner.weekPlans = await DB.listMealPlansInRange(formatDateISO(Planner.weekStart), formatDateISO(weekEnd));
    Planner.renderWeek();
  },

  renderWeek() {
    const container = document.getElementById("weekDaysList");
    const days = Array.from({ length: 7 }, (_, i) => addDays(Planner.weekStart, i));

    container.innerHTML = days.map(day => {
      const iso = formatDateISO(day);
      const dayPlans = Planner.weekPlans.filter(p => p.plan_date === iso);
      const isToday = iso === formatDateISO(new Date());

      return `
        <div class="mealcard" style="${isToday ? "border-color:var(--color-primary);" : ""}">
          <div class="mealcard__top">
            <div>
              <p class="mealcard__name" style="font-size:15px;">${DAY_NAMES[day.getDay()]} ${isToday ? "· hari ini" : ""}</p>
              <p class="mealcard__meta">${formatDateLabel(day, false)}</p>
            </div>
            <button class="btn btn--ghost btn--sm" data-add-plan="${iso}">+ Menu</button>
          </div>
          <div style="margin-top:8px;display:flex;flex-direction:column;gap:6px;">
            ${dayPlans.map(p => `
              <div class="ingrow">
                <span class="ingrow__name"><strong>${mealTypeLabel(p.meal_type)}:</strong> ${escapeHtml(p.recipes?.name || "")}</span>
                <button data-delete-plan="${p.id}" style="background:none;border:none;color:var(--color-clay);font-size:14px;">✕</button>
              </div>
            `).join("") || `<p style="font-size:12px;color:var(--color-ink-soft);">Belum ada menu</p>`}
          </div>
        </div>
      `;
    }).join("");

    container.querySelectorAll("[data-add-plan]").forEach(btn => {
      btn.addEventListener("click", () => Planner.openAddPlanForm(btn.dataset.addPlan));
    });
    container.querySelectorAll("[data-delete-plan]").forEach(btn => {
      btn.addEventListener("click", async () => {
        await DB.deleteMealPlan(btn.dataset.deletePlan);
        showToast("Menu dihapus");
        Planner.loadWeek();
      });
    });
  },

  async openAddPlanForm(dateISO) {
    if (!Recipes.cache.length) await Recipes.load();
    if (!Recipes.cache.length) {
      showToast("Tambahkan resep dulu di tab Resep");
      return;
    }

    Sheet.open(`
      <h3>Tambah Menu</h3>
      <p class="page__hint">${formatDateLabel(parseISODate(dateISO))}</p>
      <form id="planForm">
        <label class="fieldlabel">Waktu makan</label>
        <select id="pl_mealtype" class="selectinput">
          ${MEAL_TYPES.map(m => `<option value="${m.value}">${m.label}</option>`).join("")}
        </select>
        <label class="fieldlabel">Resep</label>
        <select id="pl_recipe" class="selectinput">
          ${Recipes.cache.map(r => `<option value="${r.id}" data-servings="${r.servings}">${escapeHtml(r.name)}</option>`).join("")}
        </select>
        <label class="fieldlabel">Porsi</label>
        <input type="number" id="pl_servings" class="textinput" min="1" value="${Recipes.cache[0].servings || 1}">
        <button type="submit" class="btn btn--primary btn--block">Tambahkan</button>
      </form>
    `, (content) => {
      content.querySelector("#pl_recipe").addEventListener("change", (e) => {
        const servings = e.target.selectedOptions[0].dataset.servings;
        content.querySelector("#pl_servings").value = servings;
      });
      content.querySelector("#planForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const mealType = content.querySelector("#pl_mealtype").value;
        const recipeId = content.querySelector("#pl_recipe").value;
        const servings = parseFloat(content.querySelector("#pl_servings").value) || 1;
        try {
          await DB.addMealPlan(dateISO, mealType, recipeId, servings);
          showToast("Menu ditambahkan");
          Sheet.close();
          Planner.loadWeek();
          if (dateISO === formatDateISO(new Date())) Planner.loadToday();
        } catch (err) {
          console.error(err);
          showToast("Gagal menambahkan menu");
        }
      });
    });
  },
};

document.getElementById("weekPrev").addEventListener("click", () => {
  Planner.weekStart = addDays(Planner.weekStart, -7);
  Planner.loadWeek();
});
document.getElementById("weekNext").addEventListener("click", () => {
  Planner.weekStart = addDays(Planner.weekStart, 7);
  Planner.loadWeek();
});
