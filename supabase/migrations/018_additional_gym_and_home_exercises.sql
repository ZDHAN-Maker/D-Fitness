-- 018_additional_gym_and_home_exercises.sql
-- Comprehensive catalog of Gym (machines, barbells, cables) and Home (bodyweight, bands, dumbbells) exercises.

insert into public.exercises
  (source_id, category_id, name, primary_muscle, secondary_muscles, equipment, difficulty, movement_type, tracking_mode, data_source)
select 'seed:' || v.slug, c.id, v.name, v.muscle, v.secondary, v.equipment, v.difficulty, v.movement, v.mode, 'sample'
from (values
  -- =========================================================================
  -- GYM EXERCISES (Barbell, Cable, Machine, Dumbbell)
  -- =========================================================================
  ('incline-barbell-bench-press', 'chest',     'Incline Barbell Bench Press', 'chest',        array['shoulders','triceps'],        'barbell',    'intermediate','push',   'weight_reps'),
  ('cable-chest-fly',            'chest',     'Cable Chest Fly',             'chest',        array['shoulders'],                  'cable',      'beginner',    'push',   'weight_reps'),
  ('pec-deck-machine',           'chest',     'Pec Deck Machine',            'chest',        array['shoulders'],                  'machine',    'beginner',    'push',   'weight_reps'),
  ('chest-dips',                 'chest',     'Chest Dips',                  'chest',        array['triceps','shoulders'],        'bodyweight', 'intermediate','push',   'reps_only'),

  ('t-bar-row',                  'back',      'T-Bar Row',                   'lats',         array['biceps','mid back'],          'barbell',    'intermediate','pull',   'weight_reps'),
  ('straight-arm-cable-pulldown','back',      'Straight-Arm Cable Pulldown', 'lats',         array['triceps','abs'],              'cable',      'beginner',    'pull',   'weight_reps'),
  ('single-arm-dumbbell-row',    'back',      'Single-Arm Dumbbell Row',     'lats',         array['biceps','rear delts'],        'dumbbell',   'beginner',    'pull',   'weight_reps'),

  ('cable-face-pull',            'shoulders', 'Cable Face Pull',             'rear delts',   array['traps','rotator cuff'],       'cable',      'beginner',    'pull',   'weight_reps'),
  ('barbell-overhead-press',     'shoulders', 'Barbell Overhead Press',      'shoulders',    array['triceps','core'],             'barbell',    'intermediate','push',   'weight_reps'),
  ('cable-lateral-raise',        'shoulders', 'Cable Lateral Raise',         'shoulders',    array[]::text[],                     'cable',      'beginner',    'push',   'weight_reps'),
  ('reverse-pec-deck',           'shoulders', 'Reverse Pec Deck',            'rear delts',   array['traps'],                      'machine',    'beginner',    'pull',   'weight_reps'),
  ('dumbbell-front-raise',       'shoulders', 'Dumbbell Front Raise',        'shoulders',    array[]::text[],                     'dumbbell',   'beginner',    'push',   'weight_reps'),

  ('leg-extension',              'legs',      'Leg Extension',               'quadriceps',   array[]::text[],                     'machine',    'beginner',    'squat',  'weight_reps'),
  ('lying-leg-curl',             'legs',      'Lying Leg Curl',              'hamstrings',   array['calves'],                     'machine',    'beginner',    'hinge',  'weight_reps'),
  ('seated-calf-raise',          'legs',      'Seated Calf Raise',           'calves',       array[]::text[],                     'machine',    'beginner',    'squat',  'weight_reps'),
  ('hack-squat',                 'legs',      'Hack Squat',                  'quadriceps',   array['glutes','hamstrings'],        'machine',    'intermediate','squat',  'weight_reps'),
  ('bulgarian-split-squat',      'legs',      'Bulgarian Split Squat',       'quadriceps',   array['glutes','hamstrings'],        'dumbbell',   'intermediate','squat',  'weight_reps'),

  ('tricep-rope-pushdown',       'arms',      'Tricep Rope Pushdown',        'triceps',      array[]::text[],                     'cable',      'beginner',    'push',   'weight_reps'),
  ('skull-crusher',              'arms',      'Skull Crusher (EZ Bar)',      'triceps',      array[]::text[],                     'barbell',    'intermediate','push',   'weight_reps'),
  ('preacher-curl',              'arms',      'Preacher Curl',               'biceps',       array['forearms'],                   'barbell',    'beginner',    'pull',   'weight_reps'),
  ('hammer-curl',                'arms',      'Hammer Curl',                 'biceps',       array['forearms'],                   'dumbbell',   'beginner',    'pull',   'weight_reps'),

  -- =========================================================================
  -- HOME & BODYWEIGHT EXERCISES (Home Workout, Minimal Equipment)
  -- =========================================================================
  ('diamond-push-up',            'chest',     'Diamond Push-up',             'triceps',      array['chest','core'],               'bodyweight', 'intermediate','push',   'reps_only'),
  ('wide-grip-push-up',          'chest',     'Wide-Grip Push-up',           'chest',        array['shoulders','triceps'],        'bodyweight', 'beginner',    'push',   'reps_only'),
  ('incline-push-up',            'chest',     'Incline Push-up',             'chest',        array['triceps'],                    'bodyweight', 'beginner',    'push',   'reps_only'),
  ('dumbbell-floor-press',       'chest',     'Dumbbell Floor Press',        'chest',        array['triceps','shoulders'],        'dumbbell',   'beginner',    'push',   'weight_reps'),

  ('pike-push-up',               'shoulders', 'Pike Push-up',                'shoulders',    array['triceps','upper chest'],      'bodyweight', 'intermediate','push',   'reps_only'),
  ('chair-dips',                 'arms',      'Chair / Bench Dips',          'triceps',      array['shoulders','chest'],          'bodyweight', 'beginner',    'push',   'reps_only'),

  ('air-squats',                 'legs',      'Air Squats',                  'quadriceps',   array['glutes','core'],              'bodyweight', 'beginner',    'squat',  'reps_only'),
  ('jump-squats',                'legs',      'Jump Squats',                 'quadriceps',   array['glutes','calves'],            'bodyweight', 'intermediate','squat',  'reps_only'),
  ('glute-bridge',               'legs',      'Glute Bridge',                'glutes',       array['hamstrings','core'],          'bodyweight', 'beginner',    'hinge',  'reps_only'),
  ('single-leg-calf-raise',      'legs',      'Single-Leg Calf Raise',       'calves',       array[]::text[],                     'bodyweight', 'beginner',    'squat',  'reps_only'),
  ('wall-sit',                   'legs',      'Wall Sit',                    'quadriceps',   array['glutes','calves'],            'bodyweight', 'beginner',    'squat',  'duration'),

  ('bicycle-crunches',           'core',      'Bicycle Crunches',            'abs',          array['obliques'],                   'bodyweight', 'beginner',    'core',   'reps_only'),
  ('mountain-climbers',          'core',      'Mountain Climbers',           'abs',          array['shoulders','quadriceps'],     'bodyweight', 'beginner',    'core',   'duration'),
  ('russian-twist',              'core',      'Russian Twist',               'obliques',     array['abs'],                        'bodyweight', 'beginner',    'core',   'reps_only'),
  ('leg-raises',                 'core',      'Leg Raises',                  'abs',          array['hip flexors'],                'bodyweight', 'beginner',    'core',   'reps_only'),
  ('deadbug',                    'core',      'Deadbug',                     'abs',          array['lower back'],                 'bodyweight', 'beginner',    'core',   'reps_only'),
  ('side-plank',                 'core',      'Side Plank',                  'obliques',     array['shoulders','glutes'],         'bodyweight', 'beginner',    'core',   'duration'),

  ('burpees',                    'cardio',    'Burpees',                     'cardio',       array['chest','quadriceps','core'],  'bodyweight', 'intermediate','cardio', 'reps_only'),
  ('jumping-jacks',              'cardio',    'Jumping Jacks',               'cardio',       array['calves','shoulders'],         'bodyweight', 'beginner',    'cardio', 'duration'),
  ('high-knees',                 'cardio',    'High Knees',                  'cardio',       array['quadriceps','calves'],        'bodyweight', 'beginner',    'cardio', 'duration'),

  ('band-pull-apart',            'back',      'Band Pull-Apart',             'rear delts',   array['traps','mid back'],           'band',       'beginner',    'pull',   'reps_only'),
  ('banded-lateral-raise',       'shoulders', 'Banded Lateral Raise',        'shoulders',    array[]::text[],                     'band',       'beginner',    'push',   'reps_only'),
  ('banded-bicep-curl',          'arms',      'Banded Bicep Curl',           'biceps',       array['forearms'],                   'band',       'beginner',    'pull',   'reps_only')
) as v(slug, cat, name, muscle, secondary, equipment, difficulty, movement, mode)
join public.exercise_categories c on c.slug = v.cat
on conflict (source_id) do nothing;

