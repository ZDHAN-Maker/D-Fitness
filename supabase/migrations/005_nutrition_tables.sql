-- 005_nutrition_tables.sql
-- Custom foods, recipes, favorites and food logging.
--
-- Snapshot principle: food_log_items store the nutrition that was true when the
-- user logged it, so later edits to master data / recipes never rewrite history.
-- Quantities are always normalised to `base_amount` (g or ml) by server-side
-- calculation utilities (lib/calculations/nutrition.ts).

create table public.custom_foods (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  name          text not null check (length(trim(name)) > 0),
  brand         text,
  description   text,
  base_quantity numeric(10,2) not null default 100 check (base_quantity > 0),
  base_unit     text not null default 'g' check (base_unit in ('g','ml')),
  calories      numeric(8,2) not null default 0 check (calories >= 0),
  protein_g     numeric(8,2) not null default 0 check (protein_g >= 0),
  carbs_g       numeric(8,2) not null default 0 check (carbs_g >= 0),
  fat_g         numeric(8,2) not null default 0 check (fat_g >= 0),
  fiber_g       numeric(8,2) not null default 0 check (fiber_g >= 0),
  is_composite  boolean not null default false,             -- true => nutrition derived from ingredients
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.custom_food_ingredients (
  id             uuid primary key default gen_random_uuid(),
  custom_food_id uuid not null references public.custom_foods(id) on delete cascade,
  food_item_id   bigint not null references public.food_items(id) on delete restrict,
  position       int not null default 0,
  quantity       numeric(10,3) not null check (quantity > 0),
  unit_code      text not null references public.units(code) on update cascade,
  base_amount    numeric(10,2) not null check (base_amount > 0)   -- normalised g/ml
);

create table public.recipes (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  name          text not null check (length(trim(name)) > 0),
  description   text,
  instructions  text,
  servings      numeric(6,2) not null default 1 check (servings > 0),
  -- Cached totals for the whole recipe (per-serving = total / servings).
  total_calories numeric(9,2) not null default 0 check (total_calories >= 0),
  total_protein_g numeric(9,2) not null default 0 check (total_protein_g >= 0),
  total_carbs_g   numeric(9,2) not null default 0 check (total_carbs_g >= 0),
  total_fat_g     numeric(9,2) not null default 0 check (total_fat_g >= 0),
  total_fiber_g   numeric(9,2) not null default 0 check (total_fiber_g >= 0),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.recipe_ingredients (
  id             uuid primary key default gen_random_uuid(),
  recipe_id      uuid not null references public.recipes(id) on delete cascade,
  food_item_id   bigint references public.food_items(id) on delete restrict,
  custom_food_id uuid references public.custom_foods(id) on delete restrict,
  position       int not null default 0,
  quantity       numeric(10,3) not null check (quantity > 0),
  unit_code      text not null references public.units(code) on update cascade,
  base_amount    numeric(10,2) not null check (base_amount > 0),
  check (num_nonnulls(food_item_id, custom_food_id) = 1)
);

create table public.favorite_foods (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  food_item_id   bigint references public.food_items(id) on delete cascade,
  custom_food_id uuid references public.custom_foods(id) on delete cascade,
  recipe_id      uuid references public.recipes(id) on delete cascade,
  created_at     timestamptz not null default now(),
  check (num_nonnulls(food_item_id, custom_food_id, recipe_id) = 1)
);

create table public.food_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  logged_on  date not null,
  meal_type  text not null check (meal_type in ('breakfast','lunch','dinner','snack','other')),
  notes      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, logged_on, meal_type)                    -- one "meal container" per day+type
);

create table public.food_log_items (
  id             uuid primary key default gen_random_uuid(),
  food_log_id    uuid not null references public.food_logs(id) on delete cascade,
  source         text not null check (source in ('database','custom','recipe','ai_scan','manual')),
  food_item_id   bigint references public.food_items(id) on delete set null,
  custom_food_id uuid references public.custom_foods(id) on delete set null,
  recipe_id      uuid references public.recipes(id) on delete set null,
  ai_scan_id     uuid,                                      -- FK added in 006 (ai_food_scans)
  name_snapshot  text not null,
  quantity       numeric(10,3) not null check (quantity > 0),
  unit_code      text not null references public.units(code) on update cascade,
  base_amount    numeric(10,2) not null check (base_amount > 0),   -- normalised g/ml
  calories       numeric(8,2) not null check (calories >= 0),
  protein_g      numeric(8,2) not null default 0 check (protein_g >= 0),
  carbs_g        numeric(8,2) not null default 0 check (carbs_g >= 0),
  fat_g          numeric(8,2) not null default 0 check (fat_g >= 0),
  fiber_g        numeric(8,2) not null default 0 check (fiber_g >= 0),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (num_nonnulls(food_item_id, custom_food_id, recipe_id) <= 1)
);

-- Cached total for one recipe serving is derived: total_* / servings.
