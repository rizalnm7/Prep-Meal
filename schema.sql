-- ============================================================
-- Meal Prep Planner — Supabase schema
-- Jalankan seluruh file ini di Supabase SQL Editor (sekali saja)
-- ============================================================

create extension if not exists "pgcrypto";

-- Master daftar bahan (supaya nama bahan konsisten di seluruh resep & stok)
create table if not exists ingredients (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  default_unit text not null default 'gram',
  created_at timestamptz default now()
);

-- Resep
create table if not exists recipes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'makan_siang', -- sarapan | makan_siang | makan_malam | camilan
  description text,
  servings int not null default 1,
  prep_minutes int,
  instructions text,
  photo_url text,
  created_at timestamptz default now()
);

-- Bahan per resep (banyak ke banyak antara recipes & ingredients)
create table if not exists recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references recipes(id) on delete cascade,
  ingredient_id uuid not null references ingredients(id) on delete cascade,
  quantity numeric not null,
  unit text not null
);

-- Stok bahan di rumah (pantry)
create table if not exists pantry_stock (
  id uuid primary key default gen_random_uuid(),
  ingredient_id uuid not null unique references ingredients(id) on delete cascade,
  quantity numeric not null default 0,
  unit text not null,
  updated_at timestamptz default now()
);

-- Rencana makan harian
create table if not exists meal_plans (
  id uuid primary key default gen_random_uuid(),
  plan_date date not null,
  meal_type text not null, -- sarapan | makan_siang | makan_malam | camilan
  recipe_id uuid not null references recipes(id) on delete cascade,
  servings numeric not null default 1,
  created_at timestamptz default now()
);

-- Daftar belanja (hasil generate otomatis + bisa ditambah manual)
create table if not exists shopping_list_items (
  id uuid primary key default gen_random_uuid(),
  ingredient_id uuid references ingredients(id) on delete set null,
  custom_name text,
  quantity numeric,
  unit text,
  is_checked boolean not null default false,
  is_manual boolean not null default false,
  created_at timestamptz default now()
);

-- RLS — app ini single-user (kamu sendiri), jadi kita buka akses penuh
-- lewat anon key. Kalau nanti mau multi-user, ganti policy ini.
alter table ingredients enable row level security;
alter table recipes enable row level security;
alter table recipe_ingredients enable row level security;
alter table pantry_stock enable row level security;
alter table meal_plans enable row level security;
alter table shopping_list_items enable row level security;

create policy "allow all - ingredients" on ingredients for all using (true) with check (true);
create policy "allow all - recipes" on recipes for all using (true) with check (true);
create policy "allow all - recipe_ingredients" on recipe_ingredients for all using (true) with check (true);
create policy "allow all - pantry_stock" on pantry_stock for all using (true) with check (true);
create policy "allow all - meal_plans" on meal_plans for all using (true) with check (true);
create policy "allow all - shopping_list_items" on shopping_list_items for all using (true) with check (true);
