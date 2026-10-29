-- 019_expanded_triceps_core_and_deadlifts.sql
-- Expanded catalog of Triceps, Core/Abs, Deadlifts, Biceps, Shoulders, Back, Chest, and Legs exercises.

insert into public.exercises
  (source_id, category_id, name, primary_muscle, secondary_muscles, equipment, difficulty, movement_type, tracking_mode, data_source)
select 'seed:' || v.slug, c.id, v.name, v.muscle, v.secondary, v.equipment, v.difficulty, v.movement, v.mode, 'sample'
from (values
  -- =========================================================================
  -- 1. TRICEPS & ARMS
  -- =========================================================================
  ('close-grip-bench-press',         'arms',      'Close-Grip Barbell Bench Press',     'triceps',      array['chest','shoulders'],          'barbell',    'intermediate','push',   'weight_reps'),
  ('overhead-dumbbell-tricep-ext',   'arms',      'Overhead Dumbbell Triceps Extension','triceps',      array[]::text[],                     'dumbbell',   'beginner',    'push',   'weight_reps'),
  ('overhead-cable-tricep-ext',      'arms',      'Overhead Cable Triceps Extension',   'triceps',      array[]::text[],                     'cable',      'beginner',    'push',   'weight_reps'),
  ('dumbbell-tricep-kickback',       'arms',      'Dumbbell Tricep Kickback',           'triceps',      array[]::text[],                     'dumbbell',   'beginner',    'push',   'weight_reps'),
  ('cable-tricep-kickback',          'arms',      'Cable Tricep Kickback',              'triceps',      array[]::text[],                     'cable',      'beginner',    'push',   'weight_reps'),
  ('parallel-bar-dips',              'arms',      'Parallel Bar Dips',                  'triceps',      array['chest','shoulders'],          'bodyweight', 'intermediate','push',   'reps_only'),
  ('overhead-ez-bar-french-press',   'arms',      'Overhead EZ-Bar French Press',       'triceps',      array[]::text[],                     'barbell',    'intermediate','push',   'weight_reps'),
  ('single-arm-cable-pushdown',      'arms',      'Single-Arm Cable Tricep Pushdown',   'triceps',      array[]::text[],                     'cable',      'beginner',    'push',   'weight_reps'),
  ('barbell-bicep-curl',             'arms',      'Barbell Bicep Curl',                 'biceps',       array['forearms'],                   'barbell',    'beginner',    'pull',   'weight_reps'),
  ('incline-dumbbell-curl',          'arms',      'Incline Dumbbell Curl',              'biceps',       array['forearms'],                   'dumbbell',   'intermediate','pull',   'weight_reps'),
  ('concentration-curl',             'arms',      'Concentration Curl',                 'biceps',       array['forearms'],                   'dumbbell',   'beginner',    'pull',   'weight_reps'),
  ('cable-bicep-curl',               'arms',      'Cable Bicep Curl',                   'biceps',       array['forearms'],                   'cable',      'beginner',    'pull',   'weight_reps'),
  ('reverse-barbell-curl',           'arms',      'Reverse-Grip Barbell Curl',          'forearms',     array['biceps'],                     'barbell',    'beginner',    'pull',   'weight_reps'),
  ('wrist-curls',                    'arms',      'Wrist Curls',                        'forearms',     array[]::text[],                     'dumbbell',   'beginner',    'pull',   'weight_reps'),

  -- =========================================================================
  -- 2. ABS, OBLIQUES & CORE
  -- =========================================================================
  ('cable-rope-crunch',              'core',      'Cable Rope Crunch',                  'abs',          array[]::text[],                     'cable',      'beginner',    'core',   'weight_reps'),
  ('ab-wheel-rollout',               'core',      'Ab Wheel Rollout',                   'abs',          array['shoulders','lower back'],     'bodyweight', 'intermediate','core',   'reps_only'),
  ('hanging-straight-leg-raise',     'core',      'Hanging Straight Leg Raise',         'abs',          array['hip flexors'],                'bodyweight', 'intermediate','core',   'reps_only'),
  ('decline-weighted-situp',         'core',      'Decline Weighted Sit-up',            'abs',          array['hip flexors'],                'dumbbell',   'intermediate','core',   'weight_reps'),
  ('dragon-flag',                    'core',      'Dragon Flag',                        'abs',          array['lats','lower back'],          'bodyweight', 'advanced',    'core',   'reps_only'),
  ('toes-to-bar',                    'core',      'Toes to Bar',                        'abs',          array['lats','forearms'],            'bodyweight', 'advanced',    'core',   'reps_only'),
  ('cable-woodchopper-high-low',     'core',      'Cable Woodchoppers (High to Low)',   'obliques',     array['abs','shoulders'],            'cable',      'beginner',    'core',   'weight_reps'),
  ('cable-woodchopper-low-high',     'core',      'Cable Woodchoppers (Low to High)',   'obliques',     array['abs','shoulders'],            'cable',      'beginner',    'core',   'weight_reps'),
  ('pallof-press',                   'core',      'Pallof Press',                       'obliques',     array['abs'],                        'cable',      'beginner',    'core',   'duration'),
  ('hollow-body-hold',               'core',      'Hollow Body Hold',                   'abs',          array['hip flexors'],                'bodyweight', 'beginner',    'core',   'duration'),
  ('reverse-crunch',                 'core',      'Reverse Crunch',                     'abs',          array[]::text[],                     'bodyweight', 'beginner',    'core',   'reps_only'),
  ('plank-to-pushup',                'core',      'Plank to Push-up',                   'abs',          array['chest','triceps','shoulders'],'bodyweight', 'intermediate','core',   'reps_only'),

  -- =========================================================================
  -- 3. DEADLIFT & HINGES
  -- =========================================================================
  ('trap-bar-deadlift',              'legs',      'Trap Bar / Hex Bar Deadlift',        'quadriceps',   array['glutes','hamstrings','traps'],'barbell',    'intermediate','hinge',  'weight_reps'),
  ('sumo-deadlift',                  'legs',      'Sumo Deadlift',                      'glutes',       array['hamstrings','quadriceps'],    'barbell',    'intermediate','hinge',  'weight_reps'),
  ('dumbbell-romanian-deadlift',     'legs',      'Dumbbell Romanian Deadlift',         'hamstrings',   array['glutes','lower back'],        'dumbbell',   'beginner',    'hinge',  'weight_reps'),
  ('single-leg-dumbbell-deadlift',   'legs',      'Single-Leg Dumbbell Deadlift',       'hamstrings',   array['glutes','calves'],            'dumbbell',   'intermediate','hinge',  'weight_reps'),
  ('stiff-leg-deadlift',             'legs',      'Stiff-Leg Deadlift',                 'hamstrings',   array['glutes','lower back'],        'barbell',    'intermediate','hinge',  'weight_reps'),
  ('deficit-deadlift',               'legs',      'Deficit Deadlift',                   'hamstrings',   array['glutes','lower back'],        'barbell',    'advanced',    'hinge',  'weight_reps'),
  ('snatch-grip-deadlift',           'back',      'Snatch-Grip Deadlift',               'traps',        array['hamstrings','lats','mid back'],'barbell',   'advanced',    'hinge',  'weight_reps'),
  ('rack-pulls',                     'back',      'Rack Pulls',                         'traps',        array['lower back','lats','glutes'], 'barbell',    'intermediate','hinge',  'weight_reps'),
  ('kettlebell-deadlift',            'legs',      'Kettlebell Deadlift',                'glutes',       array['hamstrings'],                 'dumbbell',   'beginner',    'hinge',  'weight_reps'),

  -- =========================================================================
  -- 4. SHOULDERS, BACK, CHEST & LEGS EXPANSION
  -- =========================================================================
  ('arnold-press',                   'shoulders', 'Arnold Press',                       'shoulders',    array['triceps'],                    'dumbbell',   'intermediate','push',   'weight_reps'),
  ('seated-dumbbell-shoulder-press', 'shoulders', 'Seated Dumbbell Shoulder Press',     'shoulders',    array['triceps'],                    'dumbbell',   'beginner',    'push',   'weight_reps'),
  ('machine-shoulder-press',         'shoulders', 'Machine Shoulder Press',             'shoulders',    array['triceps'],                    'machine',    'beginner',    'push',   'weight_reps'),
  ('upright-row',                    'shoulders', 'Upright Row',                        'shoulders',    array['traps','biceps'],             'barbell',    'intermediate','pull',   'weight_reps'),
  ('dumbbell-rear-delt-fly',         'shoulders', 'Dumbbell Rear Delt Fly',             'rear delts',   array['traps'],                      'dumbbell',   'beginner',    'pull',   'weight_reps'),
  ('barbell-shrugs',                 'back',      'Barbell Shrugs',                     'traps',        array['forearms'],                   'barbell',    'beginner',    'pull',   'weight_reps'),
  ('dumbbell-shrugs',                'back',      'Dumbbell Shrugs',                    'traps',        array['forearms'],                   'dumbbell',   'beginner',    'pull',   'weight_reps'),
  ('chin-up',                        'back',      'Chin-up',                            'biceps',       array['lats'],                       'bodyweight', 'intermediate','pull',   'reps_only'),
  ('close-grip-lat-pulldown',        'back',      'Close-Grip Lat Pulldown',            'lats',         array['biceps'],                     'cable',      'beginner',    'pull',   'weight_reps'),
  ('back-extension',                 'back',      'Back Extension (Hyperextension)',    'lower back',   array['glutes','hamstrings'],        'bodyweight', 'beginner',    'hinge',  'reps_only'),
  ('front-squat',                    'legs',      'Front Squat',                        'quadriceps',   array['glutes','core'],              'barbell',    'advanced',    'squat',  'weight_reps'),
  ('seated-leg-curl',                'legs',      'Seated Leg Curl',                    'hamstrings',   array['calves'],                     'machine',    'beginner',    'hinge',  'weight_reps'),
  ('hip-abduction-machine',          'legs',      'Hip Abduction Machine',              'glutes',       array[]::text[],                     'machine',    'beginner',    'hinge',  'weight_reps'),
  ('hip-adduction-machine',          'legs',      'Hip Adduction Machine',              'quadriceps',   array[]::text[],                     'machine',    'beginner',    'squat',  'weight_reps'),
  ('standing-machine-calf-raise',    'legs',      'Standing Machine Calf Raise',        'calves',       array[]::text[],                     'machine',    'beginner',    'squat',  'weight_reps'),
  ('incline-dumbbell-fly',           'chest',     'Incline Dumbbell Fly',               'chest',        array['shoulders'],                  'dumbbell',   'intermediate','push',   'weight_reps'),
  ('cable-crossover',                'chest',     'Cable Crossover',                    'chest',        array['shoulders'],                  'cable',      'beginner',    'push',   'weight_reps'),
  ('machine-chest-press',            'chest',     'Machine Chest Press',                'chest',        array['triceps','shoulders'],        'machine',    'beginner',    'push',   'weight_reps')
) as v(slug, cat, name, muscle, secondary, equipment, difficulty, movement, mode)
join public.exercise_categories c on c.slug = v.cat
on conflict (source_id) do nothing;

