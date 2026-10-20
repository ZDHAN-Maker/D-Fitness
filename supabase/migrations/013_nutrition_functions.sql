-- 013_nutrition_functions.sql  (Phase 2)
-- Atomic save of custom foods and recipes together with their ingredient rows.
-- SECURITY INVOKER: RLS still applies; user_id always comes from auth.uid(), never from the payload.
-- Nutrition totals are computed by the application's calculation engine (single source of truth)
-- and persisted here as a cache; ingredient rows keep the normalised g/ml amounts.

create or replace function public.save_custom_food(
  p_id          uuid,
  p_food        jsonb,
  p_ingredients jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_id  uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if p_id is null then
    insert into public.custom_foods
      (user_id, name, brand, description, base_quantity, base_unit, calories, protein_g, carbs_g, fat_g, fiber_g, is_composite)
    values (
      v_uid,
      p_food ->> 'name',
      nullif(p_food ->> 'brand', ''),
      nullif(p_food ->> 'description', ''),
      (p_food ->> 'base_quantity')::numeric,
      p_food ->> 'base_unit',
      (p_food ->> 'calories')::numeric,
      (p_food ->> 'protein_g')::numeric,
      (p_food ->> 'carbs_g')::numeric,
      (p_food ->> 'fat_g')::numeric,
      (p_food ->> 'fiber_g')::numeric,
      coalesce((p_food ->> 'is_composite')::boolean, false)
    )
    returning id into v_id;
  else
    update public.custom_foods set
      name          = p_food ->> 'name',
      brand         = nullif(p_food ->> 'brand', ''),
      description   = nullif(p_food ->> 'description', ''),
      base_quantity = (p_food ->> 'base_quantity')::numeric,
      base_unit     = p_food ->> 'base_unit',
      calories      = (p_food ->> 'calories')::numeric,
      protein_g     = (p_food ->> 'protein_g')::numeric,
      carbs_g       = (p_food ->> 'carbs_g')::numeric,
      fat_g         = (p_food ->> 'fat_g')::numeric,
      fiber_g       = (p_food ->> 'fiber_g')::numeric,
      is_composite  = coalesce((p_food ->> 'is_composite')::boolean, false)
    where id = p_id and user_id = v_uid
    returning id into v_id;

    if v_id is null then
      raise exception 'custom food not found' using errcode = 'P0002';
    end if;
    delete from public.custom_food_ingredients where custom_food_id = v_id;
  end if;

  insert into public.custom_food_ingredients (custom_food_id, food_item_id, position, quantity, unit_code, base_amount)
  select v_id,
         (i ->> 'food_item_id')::bigint,
         (ord - 1)::int,
         (i ->> 'quantity')::numeric,
         i ->> 'unit_code',
         (i ->> 'base_amount')::numeric
  from jsonb_array_elements(coalesce(p_ingredients, '[]'::jsonb)) with ordinality as t(i, ord);

  return v_id;
end;
$$;

create or replace function public.save_recipe(
  p_id          uuid,
  p_recipe      jsonb,
  p_ingredients jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_id  uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if p_id is null then
    insert into public.recipes
      (user_id, name, description, instructions, servings,
       total_calories, total_protein_g, total_carbs_g, total_fat_g, total_fiber_g)
    values (
      v_uid,
      p_recipe ->> 'name',
      nullif(p_recipe ->> 'description', ''),
      nullif(p_recipe ->> 'instructions', ''),
      (p_recipe ->> 'servings')::numeric,
      (p_recipe ->> 'total_calories')::numeric,
      (p_recipe ->> 'total_protein_g')::numeric,
      (p_recipe ->> 'total_carbs_g')::numeric,
      (p_recipe ->> 'total_fat_g')::numeric,
      (p_recipe ->> 'total_fiber_g')::numeric
    )
    returning id into v_id;
  else
    update public.recipes set
      name            = p_recipe ->> 'name',
      description     = nullif(p_recipe ->> 'description', ''),
      instructions    = nullif(p_recipe ->> 'instructions', ''),
      servings        = (p_recipe ->> 'servings')::numeric,
      total_calories  = (p_recipe ->> 'total_calories')::numeric,
      total_protein_g = (p_recipe ->> 'total_protein_g')::numeric,
      total_carbs_g   = (p_recipe ->> 'total_carbs_g')::numeric,
      total_fat_g     = (p_recipe ->> 'total_fat_g')::numeric,
      total_fiber_g   = (p_recipe ->> 'total_fiber_g')::numeric
    where id = p_id and user_id = v_uid
    returning id into v_id;

    if v_id is null then
      raise exception 'recipe not found' using errcode = 'P0002';
    end if;
    delete from public.recipe_ingredients where recipe_id = v_id;
  end if;

  insert into public.recipe_ingredients (recipe_id, food_item_id, custom_food_id, position, quantity, unit_code, base_amount)
  select v_id,
         nullif(i ->> 'food_item_id', '')::bigint,
         nullif(i ->> 'custom_food_id', '')::uuid,
         (ord - 1)::int,
         (i ->> 'quantity')::numeric,
         i ->> 'unit_code',
         (i ->> 'base_amount')::numeric
  from jsonb_array_elements(p_ingredients) with ordinality as t(i, ord);

  return v_id;
end;
$$;

revoke execute on function public.save_custom_food(uuid, jsonb, jsonb) from public, anon;
revoke execute on function public.save_recipe(uuid, jsonb, jsonb)      from public, anon;
grant  execute on function public.save_custom_food(uuid, jsonb, jsonb) to authenticated;
grant  execute on function public.save_recipe(uuid, jsonb, jsonb)      to authenticated;
