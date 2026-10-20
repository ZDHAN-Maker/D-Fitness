-- 010_seed_master_data.sql
-- BASELINE reference data so the app works out of the box.
--
-- IMPORTANT: nutrition values for the sample foods below are APPROXIMATE (per 100 g/ml,
-- rounded from common public references). They exist to exercise the schema and calculators.
-- When the real starter dataset is available, run `npm run seed:import` (scripts/import-starter-data.mjs):
-- it deletes every row whose source_id starts with 'seed:' and inserts the starter rows with their ORIGINAL IDs.

-- Units ---------------------------------------------------------------------------------------------------
insert into public.units (source_id, code, name, kind, base_unit_code, to_base_factor)
select 'seed:' || code, code, name, kind, base_unit_code, to_base_factor from (values
  ('g',     'Gram',        'mass',   'g',  1),
  ('kg',    'Kilogram',    'mass',   'g',  1000),
  ('mg',    'Milligram',   'mass',   'g',  0.001),
  ('oz',    'Ounce',       'mass',   'g',  28.3495),
  ('lb',    'Pound',       'mass',   'g',  453.592),
  ('ml',    'Milliliter',  'volume', 'ml', 1),
  ('l',     'Liter',       'volume', 'ml', 1000),
  ('tsp',   'Teaspoon',    'volume', 'ml', 5),
  ('tbsp',  'Tablespoon',  'volume', 'ml', 15),
  ('cup',   'Cup',         'volume', 'ml', 240),
  ('glass', 'Glass',       'volume', 'ml', 250),
  ('piece', 'Piece',       'portion', null, null),
  ('egg',   'Egg',         'portion', null, null),
  ('slice', 'Slice',       'portion', null, null),
  ('bowl',  'Bowl',        'portion', null, null),
  ('plate', 'Plate',       'portion', null, null),
  ('serving','Serving',    'portion', null, null),
  ('scoop', 'Scoop',       'portion', null, null)
) as v(code, name, kind, base_unit_code, to_base_factor);

-- Food categories --------------------------------------------------------------------------------------------
insert into public.food_categories (source_id, slug, name, sort_order)
select 'seed:' || slug, slug, name, sort_order from (values
  ('grains',        'Rice, noodles & grains',   1),
  ('meat',          'Poultry & meat',           2),
  ('seafood',       'Fish & seafood',           3),
  ('eggs-dairy',    'Eggs & dairy',             4),
  ('plant-protein', 'Tempeh, tofu & legumes',   5),
  ('vegetables',    'Vegetables',               6),
  ('fruit',         'Fruit',                    7),
  ('bakery',        'Bread & bakery',           8),
  ('nuts-spreads',  'Nuts, seeds & spreads',    9),
  ('beverages',     'Beverages',               10)
) as v(slug, name, sort_order);

-- Food items (APPROXIMATE sample values, per 100 g / 100 ml) ---------------------------------------------------
insert into public.food_items
  (source_id, category_id, name, brand, base_quantity, base_unit, calories, protein_g, carbs_g, fat_g, fiber_g, data_source)
select 'seed:' || v.slug, c.id, v.name, v.brand, 100, v.base_unit, v.kcal, v.p, v.c, v.f, v.fiber, 'sample'
from (values
  ('nasi-putih',          'grains',        'Nasi putih',                          null,     'g',  130, 2.7, 28.2,  0.3,  0.4),
  ('mie-instan-goreng',   'grains',        'Mie instan goreng (dry noodles)',     'Indomie','g',  440, 8.8, 62.0, 17.0,  2.0),
  ('oatmeal',             'grains',        'Oatmeal (rolled oats, dry)',          null,     'g',  379,13.2, 67.7,  6.5, 10.1),
  ('ubi-jalar-rebus',     'grains',        'Ubi jalar rebus',                     null,     'g',   76, 1.4, 17.7,  0.1,  2.5),
  ('dada-ayam-panggang',  'meat',          'Dada ayam panggang (tanpa kulit)',    null,     'g',  165,31.0,  0.0,  3.6,  0.0),
  ('sosis-ayam',          'meat',          'Sosis ayam',                          null,     'g',  250,12.0,  6.0, 20.0,  0.3),
  ('salmon-panggang',     'seafood',       'Salmon panggang',                     null,     'g',  206,22.0,  0.0, 12.0,  0.0),
  ('telur-ayam-rebus',    'eggs-dairy',    'Telur ayam rebus',                    null,     'g',  155,12.6,  1.1, 10.6,  0.0),
  ('yogurt-plain',        'eggs-dairy',    'Yogurt plain',                        null,     'g',   61, 3.5,  4.7,  3.3,  0.0),
  ('susu-sapi',           'beverages',     'Susu sapi (full cream)',              null,     'ml',  61, 3.2,  4.8,  3.3,  0.0),
  ('tempe-mentah',        'plant-protein', 'Tempe (mentah)',                      null,     'g',  192,20.3,  7.6, 10.8,  1.4),
  ('tahu-putih',          'plant-protein', 'Tahu putih',                          null,     'g',   76, 8.1,  1.9,  4.8,  0.3),
  ('brokoli-rebus',       'vegetables',    'Brokoli rebus',                       null,     'g',   35, 2.4,  7.2,  0.4,  3.3),
  ('pisang',              'fruit',         'Pisang',                              null,     'g',   89, 1.1, 22.8,  0.3,  2.6),
  ('apel',                'fruit',         'Apel',                                null,     'g',   52, 0.3, 13.8,  0.2,  2.4),
  ('roti-tawar',          'bakery',        'Roti tawar',                          null,     'g',  265, 9.0, 49.0,  3.2,  2.7),
  ('selai-kacang',        'nuts-spreads',  'Selai kacang',                        null,     'g',  588,25.0, 20.0, 50.0,  6.0)
) as v(slug, cat, name, brand, base_unit, kcal, p, c, f, fiber)
join public.food_categories c on c.slug = v.cat;

-- Household portions -> gram/ml equivalents -----------------------------------------------------------------------
insert into public.food_servings (source_id, food_item_id, label, unit_code, quantity, base_amount, is_default, sort_order)
select 'seed:' || v.slug || ':' || v.label, f.id, v.label, v.unit, 1, v.amount, v.is_default, v.sort_order
from (values
  ('nasi-putih',         '1 bowl',            'bowl',    160, true,  1),
  ('nasi-putih',         '1 plate',           'plate',   250, false, 2),
  ('mie-instan-goreng',  '1 pack (85 g)',     'serving',  85, true,  1),
  ('oatmeal',            '1 serving (40 g)',  'serving',  40, true,  1),
  ('ubi-jalar-rebus',    '1 piece',           'piece',   130, true,  1),
  ('dada-ayam-panggang', '1 piece',           'piece',   120, true,  1),
  ('sosis-ayam',         '1 piece',           'piece',    40, true,  1),
  ('salmon-panggang',    '1 fillet',          'piece',   150, true,  1),
  ('telur-ayam-rebus',   '1 egg',             'egg',      50, true,  1),
  ('yogurt-plain',       '1 serving (150 g)', 'serving', 150, true,  1),
  ('susu-sapi',          '1 glass',           'glass',   250, true,  1),
  ('tempe-mentah',       '1 piece',           'piece',    25, true,  1),
  ('tahu-putih',         '1 piece',           'piece',    40, true,  1),
  ('brokoli-rebus',      '1 serving',         'serving',  90, true,  1),
  ('pisang',             '1 piece',           'piece',   100, true,  1),
  ('apel',               '1 piece',           'piece',   180, true,  1),
  ('roti-tawar',         '1 slice',           'slice',    28, true,  1),
  ('selai-kacang',       '1 tbsp',            'tbsp',     16, true,  1)
) as v(slug, label, unit, amount, is_default, sort_order)
join public.food_items f on f.source_id = 'seed:' || v.slug;

-- Exercise categories & exercises ------------------------------------------------------------------------------------
insert into public.exercise_categories (source_id, slug, name, sort_order)
select 'seed:' || slug, slug, name, sort_order from (values
  ('chest','Chest',1), ('back','Back',2), ('shoulders','Shoulders',3), ('arms','Arms',4),
  ('legs','Legs & glutes',5), ('core','Core',6), ('cardio','Cardio',7)
) as v(slug, name, sort_order);

insert into public.exercises
  (source_id, category_id, name, primary_muscle, secondary_muscles, equipment, difficulty, movement_type, tracking_mode, data_source)
select 'seed:' || v.slug, c.id, v.name, v.muscle, v.secondary, v.equipment, v.difficulty, v.movement, v.mode, 'sample'
from (values
  ('bench-press',            'chest',     'Bench Press',            'chest',      array['triceps','shoulders'],          'barbell',    'intermediate','push',   'weight_reps'),
  ('incline-dumbbell-press', 'chest',     'Incline Dumbbell Press', 'chest',      array['shoulders','triceps'],          'dumbbell',   'intermediate','push',   'weight_reps'),
  ('push-up',                'chest',     'Push-up',                'chest',      array['triceps','core'],               'bodyweight', 'beginner',    'push',   'reps_only'),
  ('shoulder-press',         'shoulders', 'Shoulder Press',         'shoulders',  array['triceps'],                      'dumbbell',   'beginner',    'push',   'weight_reps'),
  ('lateral-raise',          'shoulders', 'Lateral Raise',          'shoulders',  array[]::text[],                       'dumbbell',   'beginner',    'push',   'weight_reps'),
  ('triceps-pushdown',       'arms',      'Triceps Pushdown',       'triceps',    array[]::text[],                       'cable',      'beginner',    'push',   'weight_reps'),
  ('dumbbell-curl',          'arms',      'Dumbbell Curl',          'biceps',     array['forearms'],                     'dumbbell',   'beginner',    'pull',   'weight_reps'),
  ('barbell-row',            'back',      'Barbell Row',            'lats',       array['biceps','rear delts'],          'barbell',    'intermediate','pull',   'weight_reps'),
  ('lat-pulldown',           'back',      'Lat Pulldown',           'lats',       array['biceps'],                       'cable',      'beginner',    'pull',   'weight_reps'),
  ('seated-cable-row',       'back',      'Seated Cable Row',       'mid back',   array['biceps','lats'],                'cable',      'beginner',    'pull',   'weight_reps'),
  ('pull-up',                'back',      'Pull-up',                'lats',       array['biceps'],                       'bodyweight', 'intermediate','pull',   'reps_only'),
  ('back-squat',             'legs',      'Back Squat',             'quadriceps', array['glutes','hamstrings','core'],   'barbell',    'intermediate','squat',  'weight_reps'),
  ('goblet-squat',           'legs',      'Goblet Squat',           'quadriceps', array['glutes','core'],                'dumbbell',   'beginner',    'squat',  'weight_reps'),
  ('leg-press',              'legs',      'Leg Press',              'quadriceps', array['glutes','hamstrings'],          'machine',    'beginner',    'squat',  'weight_reps'),
  ('romanian-deadlift',      'legs',      'Romanian Deadlift',      'hamstrings', array['glutes','lower back'],          'barbell',    'intermediate','hinge',  'weight_reps'),
  ('deadlift',               'legs',      'Deadlift',               'hamstrings', array['glutes','lower back','traps'],  'barbell',    'advanced',    'hinge',  'weight_reps'),
  ('hip-thrust',             'legs',      'Hip Thrust',             'glutes',     array['hamstrings'],                   'barbell',    'intermediate','hinge',  'weight_reps'),
  ('walking-lunge',          'legs',      'Walking Lunge',          'quadriceps', array['glutes','hamstrings'],          'dumbbell',   'beginner',    'squat',  'weight_reps'),
  ('plank',                  'core',      'Plank',                  'abs',        array['shoulders'],                    'bodyweight', 'beginner',    'core',   'duration'),
  ('hanging-knee-raise',     'core',      'Hanging Knee Raise',     'abs',        array['hip flexors'],                  'bodyweight', 'intermediate','core',   'reps_only'),
  ('treadmill-run',          'cardio',    'Treadmill Run',          'cardio',     array[]::text[],                       'machine',    'beginner',    'cardio', 'distance_duration'),
  ('rowing-machine',         'cardio',    'Rowing Machine',         'cardio',     array['back','legs'],                  'machine',    'beginner',    'cardio', 'distance_duration'),
  ('jump-rope',              'cardio',    'Jump Rope',              'cardio',     array['calves'],                       'bodyweight', 'beginner',    'cardio', 'duration')
) as v(slug, cat, name, muscle, secondary, equipment, difficulty, movement, mode)
join public.exercise_categories c on c.slug = v.cat;

-- Activity types (MET values from the Compendium of Physical Activities, rounded) -----------------------------------
insert into public.activity_types (source_id, slug, name, category, met_value, tracks_distance, tracks_pace, icon)
select 'seed:' || slug, slug, name, category, met, dist, pace, icon from (values
  ('running',       'Running',       'cardio',    9.8, true,  true,  'footprints'),
  ('walking',       'Walking',       'cardio',    3.5, true,  true,  'footprints'),
  ('cycling',       'Cycling',       'cardio',    7.5, true,  true,  'bike'),
  ('swimming',      'Swimming',      'cardio',    6.0, true,  true,  'waves'),
  ('hiking',        'Hiking',        'cardio',    6.0, true,  false, 'mountain'),
  ('jump-rope',     'Jump rope',     'cardio',   11.0, false, false, 'zap'),
  ('rowing',        'Rowing',        'cardio',    7.0, true,  true,  'ship'),
  ('hiit',          'HIIT',          'cardio',    8.0, false, false, 'flame'),
  ('elliptical',    'Elliptical',    'cardio',    5.0, true,  false, 'activity'),
  ('stair-climbing','Stair climbing','cardio',    8.8, false, false, 'footprints'),
  ('badminton',     'Badminton',     'sport',     5.5, false, false, 'trophy'),
  ('basketball',    'Basketball',    'sport',     6.5, false, false, 'trophy'),
  ('football',      'Football',      'sport',     7.0, false, false, 'trophy'),
  ('futsal',        'Futsal',        'sport',     7.0, false, false, 'trophy'),
  ('tennis',        'Tennis',        'sport',     7.3, false, false, 'trophy'),
  ('volleyball',    'Volleyball',    'sport',     4.0, false, false, 'trophy'),
  ('martial-arts',  'Martial arts',  'sport',    10.0, false, false, 'swords'),
  ('dancing',       'Dancing',       'cardio',    5.0, false, false, 'music'),
  ('yoga',          'Yoga',          'mind_body', 2.5, false, false, 'flower'),
  ('stretching',    'Stretching',    'mind_body', 2.3, false, false, 'move')
) as v(slug, name, category, met, dist, pace, icon);

-- Goal templates ---------------------------------------------------------------------------------------------------------
insert into public.goal_templates
  (source_id, goal_type, title, description, metric, direction, default_unit, default_target, default_duration_days, config)
select 'seed:' || slug, goal_type, title, descr, metric, direction, unit, target, days, config::jsonb from (values
  ('lose-weight',     'body',      'Lose weight',            'Reach a lower body weight at a steady pace.',   'weight_kg',          'decrease', 'kg',            70,   112, '{}'),
  ('gain-weight',     'body',      'Gain weight',            'Build mass with a gradual surplus.',            'weight_kg',          'increase', 'kg',            75,   112, '{}'),
  ('lower-body-fat',  'body',      'Lower body fat',         'Reduce body-fat percentage.',                   'body_fat_pct',       'decrease', '%',             15,   168, '{}'),
  ('smaller-waist',   'body',      'Reduce waist size',      'Reduce waist circumference.',                   'waist_cm',           'decrease', 'cm',            80,   112, '{}'),
  ('bench-1rm',       'strength',  'Bench press 1RM',        'Raise your estimated bench press 1RM.',         'one_rep_max_kg',     'increase', 'kg',            80,    84, '{"exercise_slug":"bench-press"}'),
  ('squat-1rm',       'strength',  'Squat 1RM',              'Raise your estimated back squat 1RM.',          'one_rep_max_kg',     'increase', 'kg',           100,    84, '{"exercise_slug":"back-squat"}'),
  ('deadlift-1rm',    'strength',  'Deadlift 1RM',           'Raise your estimated deadlift 1RM.',            'one_rep_max_kg',     'increase', 'kg',           120,    84, '{"exercise_slug":"deadlift"}'),
  ('run-5k',          'running',   '5K under 28 minutes',    'Run 5 km faster than your current best.',       'run_time_min',       'decrease', 'min',           28,    84, '{"distance_km":5}'),
  ('run-monthly',     'running',   'Run 100 km this month',  'Accumulate running distance over a month.',     'monthly_run_km',     'increase', 'km',           100,    30, '{}'),
  ('protein-daily',   'nutrition', 'Protein every day',      'Hit your daily protein target.',                'daily_protein_g',    'increase', 'g/day',        150,    30, '{}'),
  ('hydration-daily', 'nutrition', 'Hydration every day',    'Hit your daily water target.',                  'daily_water_ml',     'increase', 'ml/day',      2500,    30, '{}'),
  ('workout-4x',      'habit',     'Workout 4x per week',    'Complete four workouts every week.',            'workouts_per_week',  'increase', 'sessions/week',   4,    56, '{}'),
  ('sleep-7-5',       'habit',     'Sleep 7.5 hours',        'Average 7.5 hours of sleep per night.',         'sleep_hours',        'increase', 'h',             7.5,   30, '{}')
) as v(slug, goal_type, title, descr, metric, direction, unit, target, days, config);

-- Achievement definitions (metric >= threshold, evaluated in public.evaluate_achievements) --------------------------------
insert into public.achievement_definitions (source_id, code, name, description, category, icon, metric, threshold, sort_order)
select 'seed:' || code, code, name, descr, category, icon, metric, threshold, sort_order from (values
  ('first-workout',  'First Workout',     'Complete your first workout.',                    'workout',   'dumbbell',  'workouts_completed',        1,   1),
  ('workouts-5',     '5 Workouts',        'Complete 5 workouts.',                            'workout',   'dumbbell',  'workouts_completed',        5,   2),
  ('workouts-10',    '10 Workouts',       'Complete 10 workouts.',                           'workout',   'dumbbell',  'workouts_completed',       10,   3),
  ('workouts-25',    '25 Workouts',       'Complete 25 workouts.',                           'workout',   'dumbbell',  'workouts_completed',       25,   4),
  ('workouts-50',    '50 Workouts',       'Complete 50 workouts.',                           'workout',   'dumbbell',  'workouts_completed',       50,   5),
  ('streak-7',       '7 Day Streak',      'Train 7 days in a row.',                          'streak',    'flame',     'longest_workout_streak',    7,   6),
  ('streak-30',      '30 Day Streak',     'Train 30 days in a row.',                         'streak',    'flame',     'longest_workout_streak',   30,   7),
  ('first-pr',       'First PR',          'Set your first personal record.',                 'strength',  'trophy',    'personal_records',          1,   8),
  ('prs-10',         '10 Personal Records','Set 10 personal records.',                       'strength',  'trophy',    'personal_records',         10,   9),
  ('first-5k',       'First 5K',          'Run 5 km in a single session.',                   'running',   'footprints','longest_run_km',            5,  10),
  ('first-10k',      'First 10K',         'Run 10 km in a single session.',                  'running',   'footprints','longest_run_km',           10,  11),
  ('meals-50',       '50 Meals Logged',   'Log 50 meals.',                                   'nutrition', 'utensils',  'meals_logged',             50,  12),
  ('meals-100',      '100 Meals Logged',  'Log 100 meals.',                                  'nutrition', 'utensils',  'meals_logged',            100,  13),
  ('nutrition-7',    'Logging Week',      'Log your food 7 days in a row.',                  'nutrition', 'utensils',  'longest_nutrition_streak',  7,  14),
  ('hydration-week', 'Hydration Week',    'Hit your water target 7 days in a row.',          'hydration', 'droplets',  'longest_hydration_streak',  7,  15),
  ('sleep-week',     'Sleep Week',        'Log your sleep 7 times.',                         'recovery',  'moon',      'sleep_logs',                7,  16)
) as v(code, name, descr, category, icon, metric, threshold, sort_order);
