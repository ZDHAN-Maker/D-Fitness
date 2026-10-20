#!/usr/bin/env node
/**
 * Verifies the Supabase migrations WITHOUT Docker, using PGlite (WASM Postgres).
 * It stubs the pieces Supabase normally provides (auth.users, auth.uid(), storage, roles),
 * applies every migration in order, then asserts relationships, RLS isolation and business functions.
 *
 *   npm run db:verify
 */
import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { unaccent } from '@electric-sql/pglite/contrib/unaccent';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const migrationsDir = path.join(root, 'supabase', 'migrations');

const db = new PGlite({ extensions: { pg_trgm, unaccent } });

const stub = `
  create role anon nologin; create role authenticated nologin;
  create role service_role nologin; create role supabase_auth_admin nologin;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb not null default '{}'::jsonb);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as
    $$ select (string_to_array(name, '/'))[1:greatest(array_length(string_to_array(name, '/'), 1) - 1, 0)] $$;
  grant usage on schema public, auth, storage to anon, authenticated, service_role, supabase_auth_admin;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  grant all on all tables in schema storage to authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`;

let passed = 0;
let failed = 0;
const ok = (name) => { passed++; console.log(`  ✓ ${name}`); };
const bad = (name, detail) => { failed++; console.log(`  ✗ ${name}\n      ${detail}`); };

async function as(role, uid, fn) {
  await db.exec(`select set_config('request.jwt.claim.sub', '${uid ?? ''}', false); set role ${role};`);
  try { return await fn(); } finally { await db.exec('reset role;'); }
}
async function expectOk(name, fn) { try { await fn(); ok(name); } catch (e) { bad(name, e.message); } }
async function expectDenied(name, fn) {
  try { await fn(); bad(name, 'expected an error but the statement succeeded'); }
  catch { ok(name); }
}
async function expectRows(name, fn, n) {
  try { const r = await fn(); r.rows.length === n ? ok(name) : bad(name, `expected ${n} rows, got ${r.rows.length}`); }
  catch (e) { bad(name, e.message); }
}

console.log('Applying stubs + migrations');
await db.exec(stub);
for (const f of readdirSync(migrationsDir).filter((x) => x.endsWith('.sql')).sort()) {
  try { await db.exec(readFileSync(path.join(migrationsDir, f), 'utf8')); console.log(`  applied ${f}`); }
  catch (e) { console.error(`  FAILED ${f}: ${e.message}`); process.exit(1); }
}

const A = '00000000-0000-0000-0000-00000000000a';
const B = '00000000-0000-0000-0000-00000000000b';
await db.exec(`insert into auth.users (id, email) values ('${A}','a@example.com'), ('${B}','b@example.com');`);

console.log('\nAuth bootstrap');
for (const t of ['profiles','user_settings','user_preferences','notification_preferences']) {
  const col = t === 'profiles' ? 'id' : 'user_id';
  const r = await db.query(`select count(*)::int c from public.${t} where ${col} = $1`, [A]);
  r.rows[0].c === 1 ? ok(`${t} row auto-created`) : bad(`${t} row auto-created`, `count=${r.rows[0].c}`);
}
{
  const r = await db.query(`select count(*)::int c from public.streaks where user_id = $1`, [A]);
  r.rows[0].c === 4 ? ok('4 streak rows auto-created') : bad('4 streak rows auto-created', `count=${r.rows[0].c}`);
}

console.log('\nMaster data');
{
  const counts = {};
  for (const t of ['units','food_categories','food_items','food_servings','exercise_categories','exercises','activity_types','goal_templates','achievement_definitions']) {
    counts[t] = (await db.query(`select count(*)::int c from public.${t}`)).rows[0].c;
  }
  console.log('  ', JSON.stringify(counts));
  Object.values(counts).every((c) => c > 0) ? ok('all master tables seeded') : bad('all master tables seeded', 'an empty table');
}
await expectOk('authenticated can read food_items', () => as('authenticated', A, () => db.query('select * from public.food_items limit 1')));
await expectDenied('authenticated cannot insert master data', () => as('authenticated', A, () => db.exec(`insert into public.units (code,name,kind) values ('x','x','mass')`)));
await expectDenied('authenticated cannot update master data', () => as('authenticated', A, () => db.exec(`update public.food_items set calories = 0`)));
await expectDenied('anon cannot read master data', () => as('anon', null, () => db.query('select * from public.food_items')));

console.log('\nFood search');
await as('authenticated', A, async () => {
  const exact = await db.query(`select name from public.search_foods('nasi putih')`);
  exact.rows[0]?.name === 'Nasi putih' ? ok('search "nasi putih" -> Nasi putih first') : bad('exact search', JSON.stringify(exact.rows));
  const typo = await db.query(`select name from public.search_foods('nasi puteh')`);
  typo.rows.some((r) => r.name === 'Nasi putih') ? ok('typo-tolerant search finds Nasi putih') : bad('typo search', JSON.stringify(typo.rows));
  const cat = await db.query(`select name from public.search_foods('', (select id from public.food_categories where slug='fruit'))`);
  cat.rows.length === 2 ? ok('category filter works') : bad('category filter', JSON.stringify(cat.rows));
  const wild = await db.query(`select name from public.search_foods('%')`);
  wild.rows.length === 0 ? ok('LIKE wildcards are escaped') : bad('wildcard escape', `${wild.rows.length} rows`);
});

console.log('\nRLS isolation (nutrition)');
let logA;
await as('authenticated', A, async () => {
  logA = (await db.query(`insert into public.food_logs (user_id, logged_on, meal_type) values ($1, current_date, 'lunch') returning id`, [A])).rows[0].id;
  await db.query(`insert into public.food_log_items (food_log_id, source, food_item_id, name_snapshot, quantity, unit_code, base_amount, calories, protein_g, carbs_g, fat_g, fiber_g)
                  select $1, 'database', id, name, 200, 'g', 200, 260, 5.4, 56.4, 0.6, 0.8 from public.food_items where source_id = 'seed:nasi-putih'`, [logA]);
});
await expectRows('user B cannot see user A food_logs', () => as('authenticated', B, () => db.query('select * from public.food_logs')), 0);
await expectRows('user B cannot see user A food_log_items (child via parent)', () => as('authenticated', B, () => db.query('select * from public.food_log_items')), 0);
await expectDenied('user B cannot insert item into A\'s food_log', () => as('authenticated', B, () =>
  db.query(`insert into public.food_log_items (food_log_id, source, name_snapshot, quantity, unit_code, base_amount, calories) values ($1,'manual','x',1,'g',1,1)`, [logA])));
await expectDenied('user B cannot insert a row with user_id = A', () => as('authenticated', B, () =>
  db.query(`insert into public.water_logs (user_id, logged_on, amount_ml) values ($1, current_date, 250)`, [A])));
await expectRows('user B update of A\'s settings affects 0 rows', () => as('authenticated', B, () =>
  db.query(`update public.user_settings set calorie_target = 3000 where user_id = $1 returning 1`, [A])), 0);
await expectDenied('calorie target below safety floor is rejected', () => as('authenticated', A, () =>
  db.query(`update public.user_settings set calorie_target = 600 where user_id = $1`, [A])));
await expectDenied('negative calories rejected', () => as('authenticated', A, () =>
  db.query(`insert into public.food_log_items (food_log_id, source, name_snapshot, quantity, unit_code, base_amount, calories) values ($1,'manual','x',1,'g',1,-5)`, [logA])));

console.log('\nCross-reference guards');
let customB;
await as('authenticated', B, async () => {
  customB = (await db.query(`insert into public.custom_foods (user_id, name) values ($1,'B only') returning id`, [B])).rows[0].id;
});
await expectDenied('A cannot log B\'s custom food', () => as('authenticated', A, () =>
  db.query(`insert into public.food_log_items (food_log_id, source, custom_food_id, name_snapshot, quantity, unit_code, base_amount, calories) values ($1,'custom',$2,'x',1,'g',1,1)`, [logA, customB])));
await expectDenied('A cannot favourite B\'s custom food', () => as('authenticated', A, () =>
  db.query(`insert into public.favorite_foods (user_id, custom_food_id) values ($1,$2)`, [A, customB])));

console.log('\nDaily aggregates');
await as('authenticated', A, async () => {
  const t = (await db.query(`select * from public.daily_nutrition_totals(current_date)`)).rows[0];
  Number(t.calories) === 260 && Number(t.protein_g) === 5.4 && t.items_count === 1
    ? ok('daily_nutrition_totals = 260 kcal for 200 g nasi putih') : bad('daily_nutrition_totals', JSON.stringify(t));
  await db.query(`insert into public.water_logs (user_id, logged_on, amount_ml) values ($1, current_date, 500), ($1, current_date, 250)`, [A]);
  const w = (await db.query(`select public.daily_water_total(current_date) as ml`)).rows[0].ml;
  w === 750 ? ok('daily_water_total = 750 ml') : bad('daily_water_total', String(w));
});
await as('authenticated', B, async () => {
  const t = (await db.query(`select * from public.daily_nutrition_totals(current_date)`)).rows[0];
  Number(t.calories) === 0 ? ok('totals do not leak across users') : bad('totals leak', JSON.stringify(t));
});

console.log('\nStreaks');
await as('authenticated', A, async () => {
  await db.query(`select public.update_streak('workout', current_date - 1)`);
  const s = (await db.query(`select * from public.update_streak('workout', current_date)`)).rows[0];
  s.current_count === 2 && s.longest_count === 2 ? ok('streak increments on consecutive days') : bad('streak increment', JSON.stringify(s));
  const same = (await db.query(`select * from public.update_streak('workout', current_date)`)).rows[0];
  same.current_count === 2 ? ok('same-day call is idempotent') : bad('idempotent', JSON.stringify(same));
});
await expectDenied('streak date far in the past is rejected', () => as('authenticated', A, () => db.query(`select public.update_streak('workout', current_date - 30)`)));
await expectDenied('clients cannot write streaks directly', () => as('authenticated', A, () => db.query(`update public.streaks set current_count = 999 where user_id = $1`, [A])));
await expectDenied('anon cannot call update_streak', () => as('anon', null, () => db.query(`select public.update_streak('workout')`)));

console.log('\nWorkouts, PRs, achievements');
let sessionId;
await as('authenticated', A, async () => {
  sessionId = (await db.query(`insert into public.workout_sessions (user_id, name, logged_on, status) values ($1,'Push Day', current_date, 'in_progress') returning id`, [A])).rows[0].id;
  const se = (await db.query(`insert into public.workout_session_exercises (session_id, exercise_id, position)
                              select $1, id, 0 from public.exercises where source_id = 'seed:bench-press' returning id`, [sessionId])).rows[0].id;
  await db.query(`insert into public.workout_sets (session_exercise_id, set_number, weight_kg, reps, is_completed) values ($1,1,60,10,true), ($1,2,62.5,8,true), ($1,3,40,12,true)`, [se]);
  await db.query(`update public.workout_sessions set status = 'completed', ended_at = now() where id = $1`, [sessionId]);
});
await expectDenied('only one in-progress workout per user', () => as('authenticated', A, async () => {
  await db.query(`insert into public.workout_sessions (user_id, name, logged_on) values ($1,'one',current_date)`, [A]);
  await db.query(`insert into public.workout_sessions (user_id, name, logged_on) values ($1,'two',current_date)`, [A]);
}));
await db.exec(`delete from public.workout_sessions where name in ('one','two')`);
await expectRows('user B cannot see A\'s workout sets', () => as('authenticated', B, () => db.query('select * from public.workout_sets')), 0);
await as('authenticated', A, async () => {
  const n = (await db.query(`select public.record_workout_prs($1) as n`, [sessionId])).rows[0].n;
  n === 4 ? ok('record_workout_prs created 4 PRs (weight, reps, e1RM, volume)') : bad('record_workout_prs', `n=${n}`);
  const e1 = (await db.query(`select value from public.personal_records where record_type='estimated_1rm'`)).rows[0].value;
  // sets: 60x10 -> 80.00, 62.5x8 -> 79.17, 40x12 -> 56.00; the best estimate is 80.00
  Math.abs(Number(e1) - 60 * (1 + 10 / 30)) < 0.01 ? ok('Epley estimated 1RM = 80.00 (best of 3 sets)') : bad('e1RM', String(e1));
  const again = (await db.query(`select public.record_workout_prs($1) as n`, [sessionId])).rows[0].n;
  again === 0 ? ok('re-running does not duplicate PRs') : bad('PR idempotency', `n=${again}`);
  const unlocked = (await db.query(`select code from public.evaluate_achievements()`)).rows.map((r) => r.code).sort();
  unlocked.includes('first-workout') && unlocked.includes('first-pr')
    ? ok(`achievements unlocked server-side: ${unlocked.join(', ')}`) : bad('evaluate_achievements', unlocked.join(','));
  const again2 = (await db.query(`select code from public.evaluate_achievements()`)).rows.length;
  again2 === 0 ? ok('achievements are not unlocked twice') : bad('achievement idempotency', `n=${again2}`);
});
await expectDenied('clients cannot insert achievements', () => as('authenticated', A, () =>
  db.query(`insert into public.user_achievements (user_id, achievement_id) select $1, id from public.achievement_definitions limit 1`, [A])));
await expectDenied('clients cannot insert personal_records', () => as('authenticated', A, () =>
  db.query(`insert into public.personal_records (user_id, exercise_id, record_type, value, unit, achieved_on) select $1, id, 'max_weight', 500, 'kg', current_date from public.exercises limit 1`, [A])));
await expectDenied('user B cannot compute PRs from A\'s session', () => as('authenticated', B, () => db.query(`select public.record_workout_prs($1)`, [sessionId])));

console.log('\nStorage policies');
await expectOk('user can insert object under own folder', () => as('authenticated', A, () =>
  db.query(`insert into storage.objects (bucket_id, name) values ('progress-photos', $1)`, [`${A}/2026-10-07-front.jpg`])));
await expectDenied('user cannot insert object under another user\'s folder', () => as('authenticated', A, () =>
  db.query(`insert into storage.objects (bucket_id, name) values ('progress-photos', $1)`, [`${B}/x.jpg`])));
await expectRows('user B cannot read A\'s photo objects', () => as('authenticated', B, () => db.query(`select * from storage.objects`)), 0);
{
  const r = await db.query(`select bool_and(not public) ok from storage.buckets`);
  r.rows[0].ok ? ok('all buckets are private') : bad('buckets private', 'a bucket is public');
}
await expectDenied('progress_photos.storage_path must start with own user id', () => as('authenticated', A, () =>
  db.query(`insert into public.progress_photos (user_id, taken_on, storage_path) values ($1, current_date, $2)`, [A, `${B}/x.jpg`])));

console.log('\nPhase 2: custom foods, recipes, meal upsert');
let cfId, recId;
await as('authenticated', A, async () => {
  const eggId = (await db.query(`select id from public.food_items where source_id='seed:telur-ayam-rebus'`)).rows[0].id;
  const noodleId = (await db.query(`select id from public.food_items where source_id='seed:mie-instan-goreng'`)).rows[0].id;
  const food = { name: 'Indomie + 2 eggs', brand: '', base_quantity: 185, base_unit: 'g', calories: 529, protein_g: 20.4, carbs_g: 63.1, fat_g: 28.1, fiber_g: 1.7, is_composite: true };
  const ings = [
    { food_item_id: noodleId, quantity: 1, unit_code: 'serving', base_amount: 85 },
    { food_item_id: eggId, quantity: 2, unit_code: 'egg', base_amount: 100 },
  ];
  cfId = (await db.query(`select public.save_custom_food(null, $1::jsonb, $2::jsonb) as id`, [JSON.stringify(food), JSON.stringify(ings)])).rows[0].id;
  const n = (await db.query(`select count(*)::int c from public.custom_food_ingredients where custom_food_id=$1`, [cfId])).rows[0].c;
  n === 2 ? ok('save_custom_food inserts food + 2 ingredients atomically') : bad('save_custom_food', `ingredients=${n}`);

  await db.query(`select public.save_custom_food($1, $2::jsonb, $3::jsonb)`, [cfId, JSON.stringify({ ...food, name: 'Indomie + 1 egg' }), JSON.stringify([ings[0]])]);
  const after = (await db.query(`select (select name from public.custom_foods where id=$1) as name, (select count(*)::int from public.custom_food_ingredients where custom_food_id=$1) as c`, [cfId])).rows[0];
  after.name === 'Indomie + 1 egg' && after.c === 1 ? ok('editing replaces ingredients (no duplicates)') : bad('edit custom food', JSON.stringify(after));

  const recipe = { name: 'My Breakfast', description: '', instructions: '', servings: 2, total_calories: 525.08, total_protein_g: 21.4, total_carbs_g: 60, total_fat_g: 14, total_fiber_g: 9 };
  recId = (await db.query(`select public.save_recipe(null, $1::jsonb, $2::jsonb) as id`, [JSON.stringify(recipe),
    JSON.stringify([{ food_item_id: eggId, custom_food_id: '', quantity: 1, unit_code: 'egg', base_amount: 50 }, { food_item_id: '', custom_food_id: cfId, quantity: 1, unit_code: 'serving', base_amount: 185 }])])).rows[0].id;
  const ri = (await db.query(`select count(*) filter (where food_item_id is not null)::int f, count(*) filter (where custom_food_id is not null)::int c from public.recipe_ingredients where recipe_id=$1`, [recId])).rows[0];
  ri.f === 1 && ri.c === 1 ? ok('recipe accepts master and custom ingredients') : bad('recipe ingredients', JSON.stringify(ri));
});
await expectDenied('user B cannot edit A\'s custom food through the RPC', () => as('authenticated', B, () =>
  db.query(`select public.save_custom_food($1, '{"name":"x","base_quantity":1,"base_unit":"g","calories":1,"protein_g":0,"carbs_g":0,"fat_g":0,"fiber_g":0}'::jsonb, '[]'::jsonb)`, [cfId])));
await expectDenied('user B cannot edit A\'s recipe through the RPC', () => as('authenticated', B, () =>
  db.query(`select public.save_recipe($1, '{"name":"x","servings":1,"total_calories":1,"total_protein_g":0,"total_carbs_g":0,"total_fat_g":0,"total_fiber_g":0}'::jsonb, '[]'::jsonb)`, [recId])));
await expectDenied('B cannot put A\'s custom food into B\'s recipe', () => as('authenticated', B, () =>
  db.query(`select public.save_recipe(null, '{"name":"steal","servings":1,"total_calories":1,"total_protein_g":0,"total_carbs_g":0,"total_fat_g":0,"total_fiber_g":0}'::jsonb, $1::jsonb)`,
    [JSON.stringify([{ food_item_id: '', custom_food_id: cfId, quantity: 1, unit_code: 'serving', base_amount: 10 }])])));
await expectDenied('anon cannot call save_recipe', () => as('anon', null, () => db.query(`select public.save_recipe(null,'{}'::jsonb,'[]'::jsonb)`)));
await expectDenied('custom food used in a recipe cannot be deleted (RESTRICT)', () => as('authenticated', A, () => db.query(`delete from public.custom_foods where id=$1`, [cfId])));
await as('authenticated', A, async () => {
  const a = (await db.query(`insert into public.food_logs (user_id, logged_on, meal_type) values ($1, current_date, 'lunch')
                             on conflict (user_id, logged_on, meal_type) do update set meal_type = excluded.meal_type returning id`, [A])).rows[0].id;
  a === logA ? ok('meal upsert reuses the same food_log for the same day + meal') : bad('meal upsert', 'created a duplicate log');
  await db.query(`insert into public.favorite_foods (user_id, food_item_id) select $1, id from public.food_items limit 1`, [A]);
});
await expectDenied('same food cannot be favourited twice', () => as('authenticated', A, () =>
  db.query(`insert into public.favorite_foods (user_id, food_item_id) select $1, id from public.food_items limit 1`, [A])));
await expectDenied('log item cannot reference two sources at once', () => as('authenticated', A, () =>
  db.query(`insert into public.food_log_items (food_log_id, source, food_item_id, custom_food_id, name_snapshot, quantity, unit_code, base_amount, calories)
            select $1,'database', (select id from public.food_items limit 1), $2, 'x',1,'g',1,1`, [logA, cfId])));

console.log('\nPhase 3: exercises, plans, workouts, activities');
await as('authenticated', A, async () => {
  const f = (await db.query(`select public.exercise_facets() as f`)).rows[0].f;
  f.muscles.includes('chest') && f.equipment.includes('barbell') ? ok(`exercise_facets: ${f.muscles.length} muscles, ${f.equipment.length} equipment`) : bad('facets', JSON.stringify(f));
  const bp = await db.query(`select name from public.search_exercises('bench')`);
  bp.rows[0]?.name === 'Bench Press' ? ok('search_exercises "bench" -> Bench Press') : bad('search_exercises', JSON.stringify(bp.rows));
  const typo = await db.query(`select name from public.search_exercises('benchpress')`);
  typo.rows.some((r) => r.name === 'Bench Press') ? ok('exercise search tolerates a missing space') : bad('exercise typo', JSON.stringify(typo.rows));
  const filt = await db.query(`select name from public.search_exercises('', null, 'chest', 'barbell')`);
  filt.rows.length === 1 && filt.rows[0].name === 'Bench Press' ? ok('combined muscle + equipment filter') : bad('exercise filter', JSON.stringify(filt.rows));
});

let planId, push;
await as('authenticated', A, async () => {
  const ex = Object.fromEntries((await db.query(`select source_id, id from public.exercises where source_id like 'seed:%'`)).rows.map((r) => [r.source_id.slice(5), r.id]));
  push = ex;
  const plan = { name: 'Push Day', description: '', scheduled_days: [1, 4] };
  const exs = [
    { exercise_id: ex['bench-press'], target_sets: 4, target_reps_min: 6, target_reps_max: 8, rest_seconds: 120 },
    { exercise_id: ex['incline-dumbbell-press'], target_sets: 3, target_reps_min: 8, target_reps_max: 10 },
    { exercise_id: ex['shoulder-press'], target_sets: 3, target_reps_min: 8, target_reps_max: 10 },
  ];
  planId = (await db.query(`select public.save_workout_plan(null, $1::jsonb, $2::jsonb) as id`, [JSON.stringify(plan), JSON.stringify(exs)])).rows[0].id;
  const rows = (await db.query(`select e.name, p.position from public.workout_plan_exercises p join public.exercises e on e.id = p.exercise_id where plan_id=$1 order by position`, [planId])).rows;
  rows.map((r) => r.name).join('|') === 'Bench Press|Incline Dumbbell Press|Shoulder Press' ? ok('plan saved with exercises in order') : bad('plan order', JSON.stringify(rows));

  // reorder: move shoulder press first
  await db.query(`select public.save_workout_plan($1, $2::jsonb, $3::jsonb)`, [planId, JSON.stringify(plan), JSON.stringify([exs[2], exs[0], exs[1]])]);
  const re = (await db.query(`select e.name from public.workout_plan_exercises p join public.exercises e on e.id = p.exercise_id where plan_id=$1 order by position`, [planId])).rows.map((r) => r.name);
  re[0] === 'Shoulder Press' && re.length === 3 ? ok('reordering replaces positions without conflicts') : bad('plan reorder', re.join('|'));
  const days = (await db.query(`select scheduled_days from public.workout_plans where id=$1`, [planId])).rows[0].scheduled_days;
  JSON.stringify(days) === '[1,4]' ? ok('scheduled_days stored') : bad('scheduled_days', JSON.stringify(days));
});
await expectDenied('user B cannot edit A\'s plan through the RPC', () => as('authenticated', B, () =>
  db.query(`select public.save_workout_plan($1, '{"name":"x"}'::jsonb, '[]'::jsonb)`, [planId])));
await expectDenied('user B cannot start A\'s plan', () => as('authenticated', B, () => db.query(`select public.start_workout($1, null, current_date)`, [planId])));

let sess2;
await as('authenticated', A, async () => {
  sess2 = (await db.query(`select public.start_workout($1, null, current_date) as id`, [planId])).rows[0].id;
  const c = (await db.query(`select (select count(*)::int from public.workout_session_exercises where session_id=$1) as ex,
                                    (select count(*)::int from public.workout_sets w join public.workout_session_exercises se on se.id=w.session_exercise_id where se.session_id=$1) as sets`, [sess2])).rows[0];
  c.ex === 3 && c.sets === 10 ? ok('start_workout copies 3 exercises and pre-creates 10 sets (3+4+3)') : bad('start_workout', JSON.stringify(c));
  const nm = (await db.query(`select name, plan_id from public.workout_sessions where id=$1`, [sess2])).rows[0];
  nm.name === 'Push Day' && nm.plan_id === planId ? ok('session named after the plan') : bad('session name', JSON.stringify(nm));
});
await expectDenied('a second workout cannot start while one is in progress', () => as('authenticated', A, () => db.query(`select public.start_workout(null, 'Another', current_date)`)));
await expectDenied('workout date far from today is rejected', () => as('authenticated', B, () => db.query(`select public.start_workout(null, 'x', current_date - 10)`)));

await as('authenticated', A, async () => {
  // bench: 60x10 (new best vs the earlier 60x10/62.5x8 session? no: ties), 65x6 beats weight PR; leave other exercises' sets unfinished
  const se = (await db.query(`select se.id, e.source_id from public.workout_session_exercises se join public.exercises e on e.id=se.exercise_id where se.session_id=$1`, [sess2])).rows;
  const bench = se.find((r) => r.source_id === 'seed:bench-press').id;
  const sets = (await db.query(`select id from public.workout_sets where session_exercise_id=$1 order by set_number`, [bench])).rows;
  await db.query(`update public.workout_sets set weight_kg=65, reps=6, is_completed=true where id=$1`, [sets[0].id]);
  await db.query(`update public.workout_sets set weight_kg=60, reps=8, is_completed=true where id=$1`, [sets[1].id]);
  const r = (await db.query(`select public.complete_workout($1, 8, 'felt good') as r`, [sess2])).rows[0].r;
  r.total_volume_kg === 870 ? ok('complete_workout caches volume = 65x6 + 60x8 = 870') : bad('volume', JSON.stringify(r));
  r.new_prs >= 1 ? ok(`complete_workout recorded ${r.new_prs} new PRs`) : bad('prs', JSON.stringify(r));
  const left = (await db.query(`select (select count(*)::int from public.workout_session_exercises where session_id=$1) as ex, (select count(*)::int from public.workout_sets w join public.workout_session_exercises se on se.id=w.session_exercise_id where se.session_id=$1) as sets`, [sess2])).rows[0];
  left.ex === 1 && left.sets === 2 ? ok('unfinished sets and empty exercises were dropped') : bad('cleanup', JSON.stringify(left));
  const st = (await db.query(`select status, perceived_effort from public.workout_sessions where id=$1`, [sess2])).rows[0];
  st.status === 'completed' && Number(st.perceived_effort) === 8 ? ok('status completed with effort saved') : bad('status', JSON.stringify(st));
});
await expectDenied('completing an already completed workout fails', () => as('authenticated', A, () => db.query(`select public.complete_workout($1)`, [sess2])));
await as('authenticated', A, async () => {
  const s3 = (await db.query(`select public.start_workout(null, 'Empty', current_date) as id`)).rows[0].id;
  let blocked = false;
  try { await db.query(`select public.complete_workout($1)`, [s3]); } catch { blocked = true; }
  blocked ? ok('cannot complete a workout with no finished sets') : bad('empty complete', 'allowed');
  const still = (await db.query(`select status from public.workout_sessions where id=$1`, [s3])).rows[0].status;
  still === 'in_progress' ? ok('failed completion leaves the workout in progress (rolled back)') : bad('rollback', still);
  await db.query(`update public.workout_sessions set status='cancelled', ended_at=now() where id=$1`, [s3]);
});

await as('authenticated', A, async () => {
  const prev = (await db.query(`select * from public.previous_performance(array[$1::bigint, $2::bigint])`, [push['bench-press'], push['shoulder-press']])).rows;
  const b = prev.filter((r) => r.exercise_id === push['bench-press']);
  b.length === 2 && Number(b[0].weight_kg) === 65 && b[0].reps === 6 ? ok('previous_performance returns the latest completed session\'s sets') : bad('previous_performance', JSON.stringify(prev));
  prev.some((r) => r.exercise_id === push['shoulder-press']) ? bad('previous_performance includes exercises never completed', '') : ok('exercises never completed have no previous data');
  const cur = (await db.query(`select * from public.current_personal_records() where exercise_id=$1`, [push['bench-press']])).rows;
  const w = cur.find((r) => r.record_type === 'max_weight');
  cur.length === 4 && Number(w.value) === 65 ? ok('current_personal_records: best per type (max weight 65)') : bad('current PRs', JSON.stringify(cur));
});
await expectRows('user B sees no workout history or PRs of A', () => as('authenticated', B, () => db.query(`select * from public.current_personal_records()`)), 0);
await as('authenticated', B, async () => {
  const none = (await db.query(`select count(*)::int c from public.previous_performance(array[(select id from public.exercises limit 1)])`)).rows[0].c;
  none === 0 ? ok('previous_performance is scoped to the caller') : bad('prev scope', String(none));
});

await as('authenticated', A, async () => {
  const h = (await db.query(`select * from public.exercise_history($1, 5)`, [push['bench-press']])).rows;
  // two completed bench sessions exist (one from the Phase 1 checks); newest first
  h.length === 2 && h[0].sets.length === 2 && Number(h[0].sets[0].weight_kg) === 65 && h[1].sets.length === 3 ? ok('exercise_history lists completed sets per session, newest first') : bad('exercise_history', JSON.stringify(h));
});
await as('authenticated', B, async () => {
  const n = (await db.query(`select count(*)::int c from public.exercise_history($1, 5)`, [push['bench-press']])).rows[0].c;
  n === 0 ? ok('exercise_history is scoped to the caller') : bad('history scope', String(n));
});

let runId;
await as('authenticated', A, async () => {
  const running = (await db.query(`select id from public.activity_types where slug='running'`)).rows[0].id;
  runId = (await db.query(`insert into public.activity_logs (user_id, activity_type_id, logged_on, duration_minutes, distance_km, avg_pace_sec_per_km) values ($1,$2,current_date,30,5,360) returning id`, [A, running])).rows[0].id;
  const n1 = (await db.query(`select public.record_activity_prs($1) as n`, [runId])).rows[0].n;
  n1 === 2 ? ok('first run sets longest-distance and fastest-pace records') : bad('activity prs', String(n1));
  const slower = (await db.query(`insert into public.activity_logs (user_id, activity_type_id, logged_on, duration_minutes, distance_km) values ($1,$2,current_date,40,4) returning id`, [A, running])).rows[0].id;
  const n2 = (await db.query(`select public.record_activity_prs($1) as n`, [slower])).rows[0].n;
  n2 === 0 ? ok('a shorter, slower run sets no record') : bad('no-record run', String(n2));
  const pace = (await db.query(`select value from public.current_personal_records() where record_type='fastest_time'`)).rows[0].value;
  Number(pace) === 360 ? ok('fastest pace stored as 360 s/km (6:00/km)') : bad('pace', String(pace));
  const ach = (await db.query(`select code from public.evaluate_achievements()`)).rows.map((r) => r.code);
  ach.includes('first-5k') ? ok('First 5K achievement unlocked from a 5 km run') : bad('first-5k', ach.join(','));
});
await expectDenied('user B cannot compute PRs from A\'s activity', () => as('authenticated', B, () => db.query(`select public.record_activity_prs($1)`, [runId])));
await expectDenied('clients cannot write personal_records directly', () => as('authenticated', A, () => db.query(`delete from public.personal_records`)));

console.log('\nPhase 4: body, recovery, hydration');
await as('authenticated', B, async () => {
  const r1 = (await db.query(`select public.add_water(current_date, 500) as r`)).rows[0].r;
  r1.total_ml === 500 && r1.target_ml === 2500 && r1.reached === false ? ok('add_water returns running total vs target') : bad('add_water', JSON.stringify(r1));
  await db.query(`update public.user_settings set water_target_ml = 1000 where user_id = $1`, [B]);
  const r2 = (await db.query(`select public.add_water(current_date, 500) as r`)).rows[0].r;
  r2.total_ml === 1000 && r2.reached === true ? ok('reaching the target is reported') : bad('add_water reached', JSON.stringify(r2));
  const st = (await db.query(`select current_count, last_activity_date::text d from public.streaks where user_id=$1 and streak_type='hydration'`, [B])).rows[0];
  st.current_count === 1 ? ok('hydration streak starts when the daily target is reached') : bad('hydration streak', JSON.stringify(st));
  await db.query(`select public.add_water(current_date, 250)`);
  const st2 = (await db.query(`select current_count from public.streaks where user_id=$1 and streak_type='hydration'`, [B])).rows[0];
  st2.current_count === 1 ? ok('more water the same day does not inflate the streak') : bad('streak idempotent', JSON.stringify(st2));
  const r3 = (await db.query(`select public.add_water(current_date - 3, 300) as r`)).rows[0].r;
  r3.total_ml === 300 && r3.reached === false ? ok('water can be back-dated within 7 days') : bad('back-date', JSON.stringify(r3));
});
await expectDenied('water older than 7 days is rejected', () => as('authenticated', B, () => db.query(`select public.add_water(current_date - 30, 250)`)));
await expectDenied('water amount above 5 L is rejected', () => as('authenticated', B, () => db.query(`select public.add_water(current_date, 9000)`)));
await expectDenied('zero water is rejected', () => as('authenticated', B, () => db.query(`select public.add_water(current_date, 0)`)));
await expectDenied('anon cannot add water', () => as('anon', null, () => db.query(`select public.add_water(current_date, 250)`)));
await as('authenticated', B, async () => {
  const t = (await db.query(`select logged_on::text d, total_ml from public.water_totals(current_date - 7, current_date)`)).rows;
  t.length === 2 && t.reduce((a, r) => a + r.total_ml, 0) === 1550 ? ok('water_totals groups per day (1550 ml over 2 days)') : bad('water_totals', JSON.stringify(t));
});
await as('authenticated', A, async () => {
  const t = (await db.query(`select total_ml from public.water_totals(current_date - 7, current_date)`)).rows.reduce((a, r) => a + r.total_ml, 0);
  t === 750 ? ok('water_totals only counts the caller (A: 750 ml)') : bad('water scope', String(t));
});

await as('authenticated', A, async () => {
  const upsert = (w) => db.query(`insert into public.weight_logs (user_id, logged_on, weight_kg) values ($1, current_date, $2)
                                  on conflict (user_id, logged_on) do update set weight_kg = excluded.weight_kg returning id`, [A, w]);
  const a = (await upsert(75.4)).rows[0].id;
  const b = (await upsert(75.1)).rows[0].id;
  const n = (await db.query(`select count(*)::int c, max(weight_kg) w from public.weight_logs where user_id=$1`, [A])).rows[0];
  a === b && n.c === 1 && Number(n.w) === 75.1 ? ok('one weight per day: logging again updates it') : bad('weight upsert', JSON.stringify(n));
});
await expectDenied('weight of 0 is rejected', () => as('authenticated', A, () => db.query(`insert into public.weight_logs (user_id, logged_on, weight_kg) values ($1, current_date - 5, 0)`, [A])));
await expectDenied('weight over 700 kg is rejected', () => as('authenticated', A, () => db.query(`insert into public.weight_logs (user_id, logged_on, weight_kg) values ($1, current_date - 5, 800)`, [A])));
await expectRows('user B cannot read A\'s weight', () => as('authenticated', B, () => db.query(`select * from public.weight_logs where user_id = $1`, [A])), 0);

await as('authenticated', A, async () => {
  await db.query(`insert into public.body_measurements (user_id, measured_on, waist_cm) values ($1, current_date, 82)
                  on conflict (user_id, measured_on) do update set waist_cm = excluded.waist_cm`, [A]);
  await db.query(`insert into public.body_measurements (user_id, measured_on, chest_cm) values ($1, current_date, 101)
                  on conflict (user_id, measured_on) do update set chest_cm = excluded.chest_cm`, [A]);
  const m = (await db.query(`select waist_cm, chest_cm from public.body_measurements where user_id=$1`, [A])).rows;
  m.length === 1 && Number(m[0].waist_cm) === 82 && Number(m[0].chest_cm) === 101 ? ok('measurement upserts merge fields on the same date') : bad('measurement merge', JSON.stringify(m));
});
await expectDenied('a measurement row needs at least one value', () => as('authenticated', A, () => db.query(`insert into public.body_measurements (user_id, measured_on) values ($1, current_date - 2)`, [A])));
await expectDenied('body fat above 70% is rejected', () => as('authenticated', A, () => db.query(`insert into public.body_measurements (user_id, measured_on, body_fat_pct) values ($1, current_date - 2, 90)`, [A])));

await as('authenticated', A, async () => {
  await db.query(`insert into public.sleep_logs (user_id, sleep_date, duration_minutes, quality) values ($1, current_date, 444, 4)
                  on conflict (user_id, sleep_date) do update set duration_minutes = excluded.duration_minutes`, [A]);
  await db.query(`insert into public.sleep_logs (user_id, sleep_date, duration_minutes, quality) values ($1, current_date, 330, 4)
                  on conflict (user_id, sleep_date) do update set duration_minutes = excluded.duration_minutes`, [A]);
  const sl = (await db.query(`select count(*)::int c, max(duration_minutes) m from public.sleep_logs where user_id=$1`, [A])).rows[0];
  sl.c === 1 && sl.m === 330 ? ok('one sleep log per wake date (5h 30m after update)') : bad('sleep upsert', JSON.stringify(sl));
  await db.query(`insert into public.recovery_logs (user_id, log_date, energy, stress, soreness, overall, recovery_score) values ($1, current_date, 4, 2, 3, 4, 71.5)
                  on conflict (user_id, log_date) do update set energy = excluded.energy`, [A]);
});
await expectDenied('sleep over 24h is rejected', () => as('authenticated', A, () => db.query(`insert into public.sleep_logs (user_id, sleep_date, duration_minutes) values ($1, current_date - 3, 2000)`, [A])));
await expectDenied('sleep quality of 6 is rejected', () => as('authenticated', A, () => db.query(`insert into public.sleep_logs (user_id, sleep_date, duration_minutes, quality) values ($1, current_date - 3, 400, 6)`, [A])));
await expectDenied('recovery scale outside 1-5 is rejected', () => as('authenticated', A, () => db.query(`insert into public.recovery_logs (user_id, log_date, energy) values ($1, current_date - 3, 7)`, [A])));
await expectDenied('recovery score above 100 is rejected', () => as('authenticated', A, () => db.query(`insert into public.recovery_logs (user_id, log_date, recovery_score) values ($1, current_date - 3, 150)`, [A])));
await expectRows('user B cannot read A\'s sleep or recovery', () => as('authenticated', B, () => db.query(`select 1 from public.sleep_logs union all select 1 from public.recovery_logs where user_id = $1`, [A])), 0);

await as('authenticated', A, async () => {
  const path = `${A}/11111111-1111-4111-8111-111111111111.jpg`;
  await db.query(`insert into storage.objects (bucket_id, name) values ('progress-photos', $1)`, [path]);
  const id = (await db.query(`insert into public.progress_photos (user_id, taken_on, pose, storage_path, mime_type, size_bytes) values ($1, current_date, 'front', $2, 'image/jpeg', 250000) returning id`, [A, path])).rows[0].id;
  id ? ok('progress photo row stores only path + metadata') : bad('photo insert', '');
});
await expectDenied('the same storage path cannot be registered twice', () => as('authenticated', A, () =>
  db.query(`insert into public.progress_photos (user_id, taken_on, storage_path) values ($1, current_date, $2)`, [A, `${A}/11111111-1111-4111-8111-111111111111.jpg`])));
await expectDenied('invalid photo pose is rejected', () => as('authenticated', A, () =>
  db.query(`insert into public.progress_photos (user_id, taken_on, pose, storage_path) values ($1, current_date, 'upside-down', $2)`, [A, `${A}/22222222-2222-4222-8222-222222222222.jpg`])));
await expectRows('user B cannot see A\'s photo rows', () => as('authenticated', B, () => db.query(`select * from public.progress_photos`)), 0);

console.log('\nPhase 5: goals, achievements, calendar, analytics');
const C = '00000000-0000-0000-0000-00000000000c';
await db.exec(`insert into auth.users (id, email) values ('${C}','c@example.com');`);
const ids = {};
{
  const ex = (await db.query(`select id from public.exercises where source_id='seed:bench-press'`)).rows[0].id;
  ids.bench = ex;
}
// goals for C (inserted as the user: RLS applies)
await as('authenticated', C, async () => {
  const g = (type, title, metric, dir, target, extra = {}) => db.query(
    `insert into public.goals (user_id, goal_type, title, metric, direction, target_value, unit, start_value, exercise_id, config, target_date)
     values ($1,$2,$3,$4,$5,$6,'u',$7,$8,$9::jsonb,$10) returning id`,
    [C, type, title, metric, dir, target, extra.start ?? null, extra.exercise ?? null, JSON.stringify(extra.config ?? {}), extra.targetDate ?? null]);
  ids.weight  = (await g('body', 'Reach 70 kg', 'weight_kg', 'decrease', 70, { start: 80 })).rows[0].id;
  ids.bench1  = (await g('strength', 'Bench 1RM 100', 'one_rep_max_kg', 'increase', 100, { exercise: ids.bench, start: 60 })).rows[0].id;
  ids.protein = (await g('nutrition', 'Protein 150 g/day', 'daily_protein_g', 'increase', 150)).rows[0].id;
  ids.wk      = (await g('habit', 'Workout 4x/week', 'workouts_per_week', 'increase', 4)).rows[0].id;
  ids.custom  = (await g('habit', 'Read 20 books', 'custom', 'increase', 20, { start: 0 })).rows[0].id;
  ids.run     = (await g('running', '5K under 28', 'run_time_min', 'decrease', 28, { config: { distance_km: 5 } })).rows[0].id;
});

// data for C (written directly: these tables are client-readable only for PRs/streaks, but the rest is user data)
await db.exec(`
  insert into public.weight_logs (user_id, logged_on, weight_kg) values ('${C}', current_date, 75);
  insert into public.personal_records (user_id, exercise_id, record_type, value, unit, achieved_on) values ('${C}', ${ids.bench}, 'estimated_1rm', 80, 'kg', current_date);
  insert into public.food_logs (user_id, logged_on, meal_type) values ('${C}', current_date, 'lunch'), ('${C}', current_date - 1, 'lunch');
  insert into public.food_log_items (food_log_id, source, name_snapshot, quantity, unit_code, base_amount, calories, protein_g)
    select id, 'manual', 'Nasi putih', 1, 'g', 200, 260, case when logged_on = current_date then 100 else 140 end from public.food_logs where user_id = '${C}';
  insert into public.workout_sessions (user_id, name, status, logged_on, started_at, ended_at, total_volume_kg)
    values ('${C}','Push','completed', current_date, now() - interval '1 hour', now(), 1200), ('${C}','Pull','completed', current_date, now() - interval '3 hours', now() - interval '2 hours', 900);
  insert into public.activity_logs (user_id, activity_type_id, logged_on, duration_minutes, distance_km)
    select '${C}', id, current_date, 50, 10 from public.activity_types where slug = 'running';
  insert into public.sleep_logs (user_id, sleep_date, duration_minutes) values ('${C}', current_date, 420);
`);

let sync1;
await as('authenticated', C, async () => {
  sync1 = (await db.query(`select public.sync_progress(current_date) as r`)).rows[0].r;
  const gs = Object.fromEntries((await db.query(`select id, current_value, start_value, status from public.goals where user_id=$1`, [C])).rows.map((r) => [r.id, r]));
  Number(gs[ids.weight].current_value) === 75 && Number(gs[ids.weight].start_value) === 80 ? ok('body goal: current weight 75 (start 80, target 70)') : bad('weight goal', JSON.stringify(gs[ids.weight]));
  Number(gs[ids.bench1].current_value) === 80 ? ok('strength goal reads the best estimated 1RM from personal records') : bad('strength goal', JSON.stringify(gs[ids.bench1]));
  Number(gs[ids.protein].current_value) === 120 && Number(gs[ids.protein].start_value) === 0 ? ok('nutrition goal = average of logged days (100 and 140 -> 120 g), starts at 0') : bad('protein goal', JSON.stringify(gs[ids.protein]));
  Number(gs[ids.wk].current_value) === 2 ? ok('habit goal counts this week\'s completed workouts (2)') : bad('workouts/week', JSON.stringify(gs[ids.wk]));
  Number(gs[ids.run].current_value) === 25 ? ok('5K goal: 50 min over 10 km extrapolates to 25:00') : bad('run goal', JSON.stringify(gs[ids.run]));
  gs[ids.run].status === 'completed' ? ok('reaching a decrease-goal (25 <= 28) completes it') : bad('run completion', gs[ids.run].status);
  gs[ids.custom].current_value === null ? ok('custom goals are left for the user to update') : bad('custom goal', JSON.stringify(gs[ids.custom]));
  gs[ids.weight].status === 'active' ? ok('unmet goals stay active') : bad('weight status', gs[ids.weight].status);
  sync1.goals_updated === 5 && JSON.stringify(sync1.goals_completed) === '["5K under 28"]' ? ok('sync_progress reports updated and completed goals') : bad('sync result', JSON.stringify(sync1));
  const hs = (await db.query(`select current_count from public.streaks where user_id=$1 and streak_type='habit'`, [C])).rows[0].current_count;
  hs === 1 ? ok('habit streak starts when anything is tracked today') : bad('habit streak', String(hs));
});
await as('authenticated', C, async () => {
  await db.query(`select public.sync_progress(current_date)`);
  const n = (await db.query(`select count(*)::int c from public.goal_progress where user_id=$1 and goal_id=$2`, [C, ids.weight])).rows[0].c;
  n === 1 ? ok('goal progress history keeps one point per goal per day') : bad('goal_progress dup', String(n));
  const nt = (await db.query(`select count(*)::int c from public.notifications where user_id=$1 and type='goal_done'`, [C])).rows[0].c;
  nt === 1 ? ok('goal-reached notification is created once') : bad('goal_done notifications', String(nt));
  const done = (await db.query(`select status from public.goals where id=$1`, [ids.run])).rows[0].status;
  done === 'completed' ? ok('completed goals stay completed on later syncs') : bad('stay completed', done);
});
await as('authenticated', C, async () => {
  await db.query(`insert into public.weight_logs (user_id, logged_on, weight_kg) values ($1, current_date - 1, 69.5)`, [C]);
  await db.query(`delete from public.weight_logs where user_id=$1 and logged_on = current_date`, [C]);
  await db.query(`select public.sync_progress(current_date)`);
  const w = (await db.query(`select status, completed_at is not null as done from public.goals where id=$1`, [ids.weight])).rows[0];
  w.status === 'completed' && w.done ? ok('weight goal completes once 69.5 <= 70') : bad('weight completion', JSON.stringify(w));
});
await expectDenied('sync_progress rejects dates outside the +-1 day window', () => as('authenticated', C, () => db.query(`select public.sync_progress(current_date - 5)`)));
await expectDenied('anon cannot sync progress', () => as('anon', null, () => db.query(`select public.sync_progress(current_date)`)));
await expectRows('user B cannot see C\'s goals', () => as('authenticated', B, () => db.query(`select * from public.goals where user_id = $1`, [C])), 0);
await expectRows('user B cannot see C\'s goal progress', () => as('authenticated', B, () => db.query(`select * from public.goal_progress where user_id = $1`, [C])), 0);
await expectDenied('clients cannot create notifications', () => as('authenticated', C, () => db.query(`insert into public.notifications (user_id, type, title) values ($1,'x','forged')`, [C])));
await expectRows('user B cannot read C\'s notifications', () => as('authenticated', B, () => db.query(`select * from public.notifications where user_id = $1`, [C])), 0);
await expectDenied('a goal cannot point at another user\'s progress row (goal ownership)', () => as('authenticated', B, () =>
  db.query(`insert into public.goal_progress (goal_id, user_id, recorded_on, value) values ($1, $2, current_date - 9, 1)`, [ids.weight, B])));

console.log('  -- achievements');
await as('authenticated', C, async () => {
  const p = (await db.query(`select * from public.achievement_progress()`)).rows;
  p.length === 16 ? ok('achievement_progress lists all 16 definitions') : bad('achievement_progress count', String(p.length));
  const w = p.find((r) => r.code === 'workouts-5');
  Number(w.current_value) === 2 && Number(w.threshold) === 5 && w.unlocked_at === null ? ok('progress toward "5 Workouts" = 2 / 5') : bad('workouts-5 progress', JSON.stringify(w));
  const fw = p.find((r) => r.code === 'first-workout');
  fw.unlocked_at !== null ? ok('"First Workout" was unlocked by the sync (2 completed workouts)') : bad('first-workout', JSON.stringify(fw));
  const k = p.find((r) => r.code === 'first-5k');
  Number(k.current_value) === 10 && k.unlocked_at !== null ? ok('"First 5K" unlocked from a 10 km run') : bad('first-5k', JSON.stringify(k));
  const nt = (await db.query(`select count(*)::int c from public.notifications where user_id=$1 and type='achievement'`, [C])).rows[0].c;
  nt >= 2 ? ok(`unlocking creates in-app notifications (${nt})`) : bad('achievement notifications', String(nt));
  const again = (await db.query(`select count(*)::int c from public.evaluate_achievements()`)).rows[0].c;
  again === 0 ? ok('re-evaluating unlocks nothing twice') : bad('evaluate idempotent', String(again));
});

console.log('  -- calendar');
await as('authenticated', C, async () => {
  const rows = (await db.query(`select day::text d, workouts, activities, kcal, water_ml, sleep_minutes, weight_kg from public.calendar_days(current_date - 3, current_date)`)).rows;
  const today = rows.find((r) => r.d === new Date().toISOString().slice(0, 10)) ?? rows[rows.length - 1];
  rows.length === 2 ? ok('calendar returns only days that have data (2 of 4)') : bad('calendar rows', JSON.stringify(rows));
  today.workouts.length === 2 && today.activities[0] === 'Running' && Number(today.kcal) === 260 && today.sleep_minutes === 420 ? ok('a day combines workouts, activities, calories and sleep') : bad('calendar day', JSON.stringify(today));
  const cap = (await db.query(`select count(*)::int c from public.calendar_days(current_date - 400, current_date)`)).rows[0].c;
  cap <= 63 ? ok('calendar range is capped (no unbounded scans)') : bad('calendar cap', String(cap));
});
await as('authenticated', B, async () => {
  const cnt = (await db.query(`select count(*)::int c from public.calendar_days(current_date - 3, current_date) where kcal = 260`)).rows[0].c;
  cnt === 0 ? ok('calendar is scoped to the caller') : bad('calendar scope', String(cnt));
});

console.log('  -- analytics');
await as('authenticated', C, async () => {
  const w = (await db.query(`select public.analytics_workout(current_date - 30, current_date, 1) as r`)).rows[0].r;
  w.weekly.length === 1 && w.weekly[0].workouts === 2 && Number(w.weekly[0].volume_kg) === 2100 ? ok('workout analytics: weekly frequency 2 and volume 2100 kg') : bad('analytics_workout weekly', JSON.stringify(w.weekly));
  Array.isArray(w.muscles) && Array.isArray(w.top_exercises) ? ok('workout analytics return muscle and exercise breakdowns') : bad('analytics_workout shape', JSON.stringify(w));
  const n = (await db.query(`select public.analytics_nutrition(current_date - 30, current_date) as r`)).rows[0].r;
  n.daily.length === 2 && Number(n.daily[0].protein_g) === 140 && n.top_foods[0].name === 'Nasi putih' && n.top_foods[0].count === 2 ? ok('nutrition analytics: daily totals and most-eaten foods') : bad('analytics_nutrition', JSON.stringify(n));
});
await as('authenticated', B, async () => {
  const w = (await db.query(`select public.analytics_workout(current_date - 30, current_date, 1) as r`)).rows[0].r;
  const n = (await db.query(`select public.analytics_nutrition(current_date - 30, current_date) as r`)).rows[0].r;
  !w.weekly.some((x) => x.workouts === 2 && Number(x.volume_kg) === 2100) && !n.top_foods.some((f) => f.count === 2 && f.name === 'Nasi putih' && n.daily.some((d) => Number(d.protein_g) === 140)) ? ok('analytics never include another user\'s data') : bad('analytics scope', JSON.stringify({ w: w.weekly, n: n.daily }));
});
await expectDenied('anon cannot run analytics', () => as('anon', null, () => db.query(`select public.analytics_workout(current_date - 30, current_date, 1)`)));

console.log('\nPhase 6: AI data, candidates, isolation');
await as('authenticated', C, async () => {
  const all = (await db.query(`select name from public.meal_candidates(20, 150)`)).rows.map((r) => r.name);
  all.length >= 15 ? ok(`meal_candidates returns a diverse set (${all.length} foods)`) : bad('meal_candidates size', String(all.length));
  const cap = (await db.query(`select count(*)::int c from public.meal_candidates(1, 150)`)).rows[0].c;
  const cats = (await db.query(`select count(distinct coalesce(category_id,0))::int c from public.food_items`)).rows[0].c;
  cap === cats ? ok('per-category cap: one food per category when asked for 1') : bad('meal_candidates cap', `${cap} vs ${cats}`);
  const lim = (await db.query(`select count(*)::int c from public.meal_candidates(20, 5)`)).rows[0].c;
  lim === 5 ? ok('meal_candidates respects the overall limit') : bad('meal limit', String(lim));
  await db.query(`update public.user_preferences set disliked_foods = array['tempe','  Salmon '] where user_id = $1`, [C]);
  const after = (await db.query(`select name from public.meal_candidates(20, 150)`)).rows.map((r) => r.name.toLowerCase());
  !after.some((n) => n.includes('tempe') || n.includes('salmon')) && after.length < all.length ? ok('disliked foods are excluded in SQL (case/space insensitive)') : bad('disliked exclusion', after.join(','));
  const ranked = (await db.query(`select name from public.meal_candidates(1, 150) where name in ('Dada ayam panggang (tanpa kulit)','Sosis ayam')`)).rows.map((r) => r.name);
  ranked.includes('Dada ayam panggang (tanpa kulit)') && !ranked.includes('Sosis ayam') ? ok('within a category the highest protein-per-calorie food wins') : bad('protein ranking', ranked.join(','));
});
await as('authenticated', C, async () => {
  const bw = (await db.query(`select distinct lower(equipment) e from public.exercise_candidates(array['dumbbell'], null, 20, 150)`)).rows.map((r) => r.e);
  bw.every((e) => ['dumbbell', 'bodyweight'].includes(e)) && bw.includes('dumbbell') && bw.includes('bodyweight') ? ok('exercise_candidates: only owned equipment plus bodyweight') : bad('equipment filter', bw.join(','));
  const none = (await db.query(`select distinct lower(equipment) e from public.exercise_candidates(array['kettlebell'], null, 20, 150)`)).rows.map((r) => r.e);
  none.every((e) => e === 'bodyweight') ? ok('with no matching equipment only bodyweight movements remain') : bad('bodyweight fallback', none.join(','));
  const adv = (await db.query(`select count(*)::int c from public.exercise_candidates(null, 'beginner', 20, 150) where difficulty = 'advanced'`)).rows[0].c;
  const adv2 = (await db.query(`select count(*)::int c from public.exercise_candidates(null, 'advanced', 20, 150) where difficulty = 'advanced'`)).rows[0].c;
  adv === 0 && adv2 > 0 ? ok('beginners are never offered advanced exercises') : bad('experience filter', `${adv}/${adv2}`);
  const per = (await db.query(`select max(c)::int m from (select count(*) c from public.exercise_candidates(null, null, 2, 150) group by coalesce(primary_muscle,'other')) s`)).rows[0].m;
  per <= 2 ? ok('per-muscle cap keeps the candidate list balanced') : bad('per muscle cap', String(per));
});
await expectDenied('anon cannot read AI candidates', () => as('anon', null, () => db.query(`select * from public.meal_candidates()`)));

// AI tables: ownership and integrity
let convA, scanA;
await as('authenticated', A, async () => {
  convA = (await db.query(`insert into public.ai_conversations (user_id, feature, title) values ($1,'coach','Training check') returning id`, [A])).rows[0].id;
  await db.query(`insert into public.ai_messages (conversation_id, role, content, metadata) values ($1,'user','How was my week?','{}'), ($1,'assistant','Solid.','{"missing_data":["sleep"]}')`, [convA]);
  await db.query(`insert into public.ai_insights (user_id, insight_date, kind, facts, recommendation) values ($1, current_date, 'daily', '{"a":1}', 'Drink water')`, [A]);
  scanA = (await db.query(`insert into public.ai_food_scans (user_id, storage_path, status) values ($1, $2, 'analyzed') returning id`, [A, `${A}/33333333-3333-4333-8333-333333333333.jpg`])).rows[0].id;
  await db.query(`insert into public.ai_weekly_reviews (user_id, week_start, week_end, metrics, went_well) values ($1, current_date - 6, current_date, '{"workouts":4}', 'Consistent')`, [A]);
  await db.query(`insert into public.ai_generated_workouts (user_id, prompt, params, result) values ($1, '30 minutes', '{}', '{"title":"Full body"}')`, [A]);
  ok('a user can store their own conversations, insights, scans, reviews and generated workouts');
});
await expectDenied('only one daily insight per user per day', () => as('authenticated', A, () => db.query(`insert into public.ai_insights (user_id, insight_date, kind, recommendation) values ($1, current_date, 'daily', 'again')`, [A])));
await as('authenticated', A, async () => {
  const up = (await db.query(`insert into public.ai_insights (user_id, insight_date, kind, facts, recommendation) values ($1, current_date, 'daily', '{}', 'Updated')
                              on conflict (user_id, insight_date, kind) do update set recommendation = excluded.recommendation returning recommendation`, [A])).rows[0].recommendation;
  up === 'Updated' ? ok('regenerating a daily insight replaces it (upsert)') : bad('insight upsert', up);
});
for (const [t, q] of [['conversations', `select * from public.ai_conversations`], ['messages', `select * from public.ai_messages`], ['insights', `select * from public.ai_insights`], ['food scans', `select * from public.ai_food_scans`], ['weekly reviews', `select * from public.ai_weekly_reviews`], ['generated workouts', `select * from public.ai_generated_workouts`]]) {
  await expectRows(`user B cannot read A's AI ${t}`, () => as('authenticated', B, () => db.query(q)), 0);
}
await expectDenied('user B cannot add a message to A\'s conversation', () => as('authenticated', B, () => db.query(`insert into public.ai_messages (conversation_id, role, content) values ($1,'user','hi')`, [convA])));
await expectDenied('a scan path must be inside the owner\'s folder', () => as('authenticated', B, () => db.query(`insert into public.ai_food_scans (user_id, storage_path) values ($1, $2)`, [B, `${A}/44444444-4444-4444-8444-444444444444.jpg`])));
await expectDenied('invalid scan status is rejected', () => as('authenticated', A, () => db.query(`update public.ai_food_scans set status = 'trusted' where id = $1`, [scanA])));
await expectDenied('invalid conversation feature is rejected', () => as('authenticated', A, () => db.query(`insert into public.ai_conversations (user_id, feature) values ($1, 'oracle')`, [A])));
await expectDenied('clients cannot write AI usage logs (so they cannot reset their own limits)', () => as('authenticated', A, () => db.query(`insert into public.ai_usage_logs (user_id, feature, model) values ($1, 'coach', 'm')`, [A])));
await expectDenied('clients cannot delete AI usage logs', () => as('authenticated', A, () => db.query(`delete from public.ai_usage_logs`)));
{
  await db.query(`insert into public.ai_usage_logs (user_id, feature, model, input_tokens, output_tokens) values ('${A}','coach','m',100,50), ('${A}','food_scan','m',900,80)`);
  const mine = await as('authenticated', A, () => db.query(`select count(*)::int c from public.ai_usage_logs`));
  const theirs = await as('authenticated', B, () => db.query(`select count(*)::int c from public.ai_usage_logs`));
  mine.rows[0].c === 2 && theirs.rows[0].c === 0 ? ok('usage logs written server-side are readable by their owner only') : bad('usage logs scope', `${mine.rows[0].c}/${theirs.rows[0].c}`);
}

console.log('\nRLS coverage');
{
  const r = await db.query(`select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
                            where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`);
  r.rows.length === 0 ? ok('every public table has RLS enabled') : bad('RLS coverage', r.rows.map((x) => x.relname).join(', '));
  const t = await db.query(`select count(*)::int c from pg_policies where schemaname = 'public'`);
  console.log(`   ${t.rows[0].c} policies defined`);
}

console.log(`\n${passed} passed, ${failed} failed`);
await db.close();
process.exit(failed ? 1 : 0);
