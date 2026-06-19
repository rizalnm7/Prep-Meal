// ============================================================
// db.js — semua query Supabase terpusat di sini
// ============================================================

let supabaseClient = null;

function initSupabase() {
  const gate = document.getElementById("configGate");
  const gateText = document.getElementById("configGateText");

  if (!window.supabase) {
    // Penyebab paling umum: index.html dibuka langsung via file:// (double-click)
    // alih-alih lewat local server / domain http(s), sehingga script CDN gagal jalan.
    gateText.innerHTML = `Library Supabase gagal dimuat dari CDN. Ini biasanya terjadi kalau
      <code>index.html</code> dibuka langsung dari File Explorer (alamatnya <code>file:///...</code>).
      Jalankan lewat local server, contoh: <code>npx serve .</code> di folder project ini, lalu buka
      <code>http://localhost</code>-nya. Cek juga koneksi internet (CDN jsdelivr) dan console untuk error lain.`;
    gate.hidden = false;
    return false;
  }
  if (SUPABASE_URL.includes("YOUR-PROJECT") || SUPABASE_ANON_KEY.includes("YOUR-ANON")) {
    gateText.innerHTML = `Isi <code>SUPABASE_URL</code> dan <code>SUPABASE_ANON_KEY</code> di
      <code>js/config.js</code> dengan nilai dari Supabase Dashboard, lalu reload halaman.`;
    gate.hidden = false;
    return false;
  }
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return true;
}

const DB = {
  // ---------- ingredients (master list) ----------
  async listIngredients() {
    const { data, error } = await supabaseClient.from("ingredients").select("*").order("name");
    if (error) throw error;
    return data;
  },
  async upsertIngredientByName(name, unit) {
    const trimmed = name.trim();
    const { data: existing } = await supabaseClient.from("ingredients").select("*").ilike("name", trimmed).maybeSingle();
    if (existing) return existing;
    const { data, error } = await supabaseClient.from("ingredients").insert({ name: trimmed, default_unit: unit || "gram" }).select().single();
    if (error) throw error;
    return data;
  },

  // ---------- recipes ----------
  async listRecipes() {
    const { data, error } = await supabaseClient.from("recipes").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },
  async getRecipe(id) {
    const { data, error } = await supabaseClient.from("recipes").select("*").eq("id", id).single();
    if (error) throw error;
    return data;
  },
  async getRecipeIngredients(recipeId) {
    const { data, error } = await supabaseClient
      .from("recipe_ingredients")
      .select("*, ingredients(*)")
      .eq("recipe_id", recipeId);
    if (error) throw error;
    return data;
  },
  async createRecipe(recipe, ingredientLines) {
    const { data: createdRecipe, error } = await supabaseClient.from("recipes").insert(recipe).select().single();
    if (error) throw error;
    await DB.replaceRecipeIngredients(createdRecipe.id, ingredientLines);
    return createdRecipe;
  },
  async updateRecipe(id, recipe, ingredientLines) {
    const { error } = await supabaseClient.from("recipes").update(recipe).eq("id", id);
    if (error) throw error;
    await DB.replaceRecipeIngredients(id, ingredientLines);
  },
  async replaceRecipeIngredients(recipeId, ingredientLines) {
    await supabaseClient.from("recipe_ingredients").delete().eq("recipe_id", recipeId);
    const rows = [];
    for (const line of ingredientLines) {
      if (!line.name?.trim() || !line.quantity) continue;
      const ing = await DB.upsertIngredientByName(line.name, line.unit);
      rows.push({ recipe_id: recipeId, ingredient_id: ing.id, quantity: line.quantity, unit: line.unit || ing.default_unit });
    }
    if (rows.length) {
      const { error } = await supabaseClient.from("recipe_ingredients").insert(rows);
      if (error) throw error;
    }
  },
  async deleteRecipe(id) {
    const { error } = await supabaseClient.from("recipes").delete().eq("id", id);
    if (error) throw error;
  },

  // ---------- pantry stock ----------
  async listPantry() {
    const { data, error } = await supabaseClient
      .from("pantry_stock")
      .select("*, ingredients(*)")
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return data;
  },
  async addPantryItem(name, quantity, unit) {
    const ing = await DB.upsertIngredientByName(name, unit);
    const { data: existing } = await supabaseClient.from("pantry_stock").select("*").eq("ingredient_id", ing.id).maybeSingle();
    if (existing) {
      return DB.setPantryQty(existing.id, Number(existing.quantity) + Number(quantity));
    }
    const { data, error } = await supabaseClient
      .from("pantry_stock")
      .insert({ ingredient_id: ing.id, quantity, unit: unit || ing.default_unit })
      .select("*, ingredients(*)").single();
    if (error) throw error;
    return data;
  },
  async setPantryQty(pantryId, quantity) {
    const { data, error } = await supabaseClient
      .from("pantry_stock")
      .update({ quantity: Math.max(0, quantity), updated_at: new Date().toISOString() })
      .eq("id", pantryId).select("*, ingredients(*)").single();
    if (error) throw error;
    return data;
  },
  async deletePantryItem(pantryId) {
    const { error } = await supabaseClient.from("pantry_stock").delete().eq("id", pantryId);
    if (error) throw error;
  },

  // ---------- meal plans ----------
  async listMealPlansInRange(startISO, endISO) {
    const { data, error } = await supabaseClient
      .from("meal_plans")
      .select("*, recipes(*)")
      .gte("plan_date", startISO)
      .lte("plan_date", endISO)
      .order("plan_date");
    if (error) throw error;
    return data;
  },
  async addMealPlan(planDateISO, mealType, recipeId, servings) {
    const { data, error } = await supabaseClient
      .from("meal_plans")
      .insert({ plan_date: planDateISO, meal_type: mealType, recipe_id: recipeId, servings })
      .select("*, recipes(*)").single();
    if (error) throw error;
    return data;
  },
  async deleteMealPlan(id) {
    const { error } = await supabaseClient.from("meal_plans").delete().eq("id", id);
    if (error) throw error;
  },

  // ---------- shopping list ----------
  async listShoppingItems() {
    const { data, error } = await supabaseClient
      .from("shopping_list_items")
      .select("*, ingredients(*)")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },
  async clearGeneratedItems() {
    // hapus item hasil auto-generate yang belum dicentang, supaya bisa di-refresh tanpa duplikat
    const { error } = await supabaseClient.from("shopping_list_items").delete().eq("is_manual", false).eq("is_checked", false);
    if (error) throw error;
  },
  async insertShoppingItems(rows) {
    if (!rows.length) return;
    const { error } = await supabaseClient.from("shopping_list_items").insert(rows);
    if (error) throw error;
  },
  async addManualShoppingItem(name, quantity, unit) {
    const { data, error } = await supabaseClient
      .from("shopping_list_items")
      .insert({ custom_name: name, quantity, unit, is_manual: true })
      .select("*, ingredients(*)").single();
    if (error) throw error;
    return data;
  },
  async toggleShoppingItem(id, isChecked) {
    const { error } = await supabaseClient.from("shopping_list_items").update({ is_checked: isChecked }).eq("id", id);
    if (error) throw error;
  },
  async deleteShoppingItem(id) {
    const { error } = await supabaseClient.from("shopping_list_items").delete().eq("id", id);
    if (error) throw error;
  },
};
