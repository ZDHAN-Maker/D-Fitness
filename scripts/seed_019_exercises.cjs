const fs = require('fs');
const envText = fs.readFileSync('.env.local', 'utf-8');
const env = {};
for (const line of envText.split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
  const idx = trimmed.indexOf('=');
  const key = trimmed.slice(0, idx).trim();
  const val = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
  env[key] = val;
}

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const exercisesToInsert = [
  // Triceps & Arms
  { slug: 'close-grip-bench-press', cat: 'arms', name: 'Close-Grip Barbell Bench Press', muscle: 'triceps', secondary: ['chest','shoulders'], equipment: 'barbell', difficulty: 'intermediate', movement: 'push', mode: 'weight_reps' },
  { slug: 'overhead-dumbbell-tricep-ext', cat: 'arms', name: 'Overhead Dumbbell Triceps Extension', muscle: 'triceps', secondary: [], equipment: 'dumbbell', difficulty: 'beginner', movement: 'push', mode: 'weight_reps' },
  { slug: 'overhead-cable-tricep-ext', cat: 'arms', name: 'Overhead Cable Triceps Extension', muscle: 'triceps', secondary: [], equipment: 'cable', difficulty: 'beginner', movement: 'push', mode: 'weight_reps' },
  { slug: 'dumbbell-tricep-kickback', cat: 'arms', name: 'Dumbbell Tricep Kickback', muscle: 'triceps', secondary: [], equipment: 'dumbbell', difficulty: 'beginner', movement: 'push', mode: 'weight_reps' },
  { slug: 'cable-tricep-kickback', cat: 'arms', name: 'Cable Tricep Kickback', muscle: 'triceps', secondary: [], equipment: 'cable', difficulty: 'beginner', movement: 'push', mode: 'weight_reps' },
  { slug: 'parallel-bar-dips', cat: 'arms', name: 'Parallel Bar Dips', muscle: 'triceps', secondary: ['chest','shoulders'], equipment: 'bodyweight', difficulty: 'intermediate', movement: 'push', mode: 'reps_only' },
  { slug: 'overhead-ez-bar-french-press', cat: 'arms', name: 'Overhead EZ-Bar French Press', muscle: 'triceps', secondary: [], equipment: 'barbell', difficulty: 'intermediate', movement: 'push', mode: 'weight_reps' },
  { slug: 'single-arm-cable-pushdown', cat: 'arms', name: 'Single-Arm Cable Tricep Pushdown', muscle: 'triceps', secondary: [], equipment: 'cable', difficulty: 'beginner', movement: 'push', mode: 'weight_reps' },
  { slug: 'barbell-bicep-curl', cat: 'arms', name: 'Barbell Bicep Curl', muscle: 'biceps', secondary: ['forearms'], equipment: 'barbell', difficulty: 'beginner', movement: 'pull', mode: 'weight_reps' },
  { slug: 'incline-dumbbell-curl', cat: 'arms', name: 'Incline Dumbbell Curl', muscle: 'biceps', secondary: ['forearms'], equipment: 'dumbbell', difficulty: 'intermediate', movement: 'pull', mode: 'weight_reps' },
  { slug: 'concentration-curl', cat: 'arms', name: 'Concentration Curl', muscle: 'biceps', secondary: ['forearms'], equipment: 'dumbbell', difficulty: 'beginner', movement: 'pull', mode: 'weight_reps' },
  { slug: 'cable-bicep-curl', cat: 'arms', name: 'Cable Bicep Curl', muscle: 'biceps', secondary: ['forearms'], equipment: 'cable', difficulty: 'beginner', movement: 'pull', mode: 'weight_reps' },
  { slug: 'reverse-barbell-curl', cat: 'arms', name: 'Reverse-Grip Barbell Curl', muscle: 'forearms', secondary: ['biceps'], equipment: 'barbell', difficulty: 'beginner', movement: 'pull', mode: 'weight_reps' },
  { slug: 'wrist-curls', cat: 'arms', name: 'Wrist Curls', muscle: 'forearms', secondary: [], equipment: 'dumbbell', difficulty: 'beginner', movement: 'pull', mode: 'weight_reps' },

  // Abs, Obliques & Core
  { slug: 'cable-rope-crunch', cat: 'core', name: 'Cable Rope Crunch', muscle: 'abs', secondary: [], equipment: 'cable', difficulty: 'beginner', movement: 'core', mode: 'weight_reps' },
  { slug: 'ab-wheel-rollout', cat: 'core', name: 'Ab Wheel Rollout', muscle: 'abs', secondary: ['shoulders','lower back'], equipment: 'bodyweight', difficulty: 'intermediate', movement: 'core', mode: 'reps_only' },
  { slug: 'hanging-straight-leg-raise', cat: 'core', name: 'Hanging Straight Leg Raise', muscle: 'abs', secondary: ['hip flexors'], equipment: 'bodyweight', difficulty: 'intermediate', movement: 'core', mode: 'reps_only' },
  { slug: 'decline-weighted-situp', cat: 'core', name: 'Decline Weighted Sit-up', muscle: 'abs', secondary: ['hip flexors'], equipment: 'dumbbell', difficulty: 'intermediate', movement: 'core', mode: 'weight_reps' },
  { slug: 'dragon-flag', cat: 'core', name: 'Dragon Flag', muscle: 'abs', secondary: ['lats','lower back'], equipment: 'bodyweight', difficulty: 'advanced', movement: 'core', mode: 'reps_only' },
  { slug: 'toes-to-bar', cat: 'core', name: 'Toes to Bar', muscle: 'abs', secondary: ['lats','forearms'], equipment: 'bodyweight', difficulty: 'advanced', movement: 'core', mode: 'reps_only' },
  { slug: 'cable-woodchopper-high-low', cat: 'core', name: 'Cable Woodchoppers (High to Low)', muscle: 'obliques', secondary: ['abs','shoulders'], equipment: 'cable', difficulty: 'beginner', movement: 'core', mode: 'weight_reps' },
  { slug: 'cable-woodchopper-low-high', cat: 'core', name: 'Cable Woodchoppers (Low to High)', muscle: 'obliques', secondary: ['abs','shoulders'], equipment: 'cable', difficulty: 'beginner', movement: 'core', mode: 'weight_reps' },
  { slug: 'pallof-press', cat: 'core', name: 'Pallof Press', muscle: 'obliques', secondary: ['abs'], equipment: 'cable', difficulty: 'beginner', movement: 'core', mode: 'duration' },
  { slug: 'hollow-body-hold', cat: 'core', name: 'Hollow Body Hold', muscle: 'abs', secondary: ['hip flexors'], equipment: 'bodyweight', difficulty: 'beginner', movement: 'core', mode: 'duration' },
  { slug: 'reverse-crunch', cat: 'core', name: 'Reverse Crunch', muscle: 'abs', secondary: [], equipment: 'bodyweight', difficulty: 'beginner', movement: 'core', mode: 'reps_only' },
  { slug: 'plank-to-pushup', cat: 'core', name: 'Plank to Push-up', muscle: 'abs', secondary: ['chest','triceps','shoulders'], equipment: 'bodyweight', difficulty: 'intermediate', movement: 'core', mode: 'reps_only' },

  // Deadlifts & Hinges
  { slug: 'trap-bar-deadlift', cat: 'legs', name: 'Trap Bar / Hex Bar Deadlift', muscle: 'quadriceps', secondary: ['glutes','hamstrings','traps'], equipment: 'barbell', difficulty: 'intermediate', movement: 'hinge', mode: 'weight_reps' },
  { slug: 'sumo-deadlift', cat: 'legs', name: 'Sumo Deadlift', muscle: 'glutes', secondary: ['hamstrings','quadriceps'], equipment: 'barbell', difficulty: 'intermediate', movement: 'hinge', mode: 'weight_reps' },
  { slug: 'dumbbell-romanian-deadlift', cat: 'legs', name: 'Dumbbell Romanian Deadlift', muscle: 'hamstrings', secondary: ['glutes','lower back'], equipment: 'dumbbell', difficulty: 'beginner', movement: 'hinge', mode: 'weight_reps' },
  { slug: 'single-leg-dumbbell-deadlift', cat: 'legs', name: 'Single-Leg Dumbbell Deadlift', muscle: 'hamstrings', secondary: ['glutes','calves'], equipment: 'dumbbell', difficulty: 'intermediate', movement: 'hinge', mode: 'weight_reps' },
  { slug: 'stiff-leg-deadlift', cat: 'legs', name: 'Stiff-Leg Deadlift', muscle: 'hamstrings', secondary: ['glutes','lower back'], equipment: 'barbell', difficulty: 'intermediate', movement: 'hinge', mode: 'weight_reps' },
  { slug: 'deficit-deadlift', cat: 'legs', name: 'Deficit Deadlift', muscle: 'hamstrings', secondary: ['glutes','lower back'], equipment: 'barbell', difficulty: 'advanced', movement: 'hinge', mode: 'weight_reps' },
  { slug: 'snatch-grip-deadlift', cat: 'back', name: 'Snatch-Grip Deadlift', muscle: 'traps', secondary: ['hamstrings','lats','mid back'], equipment: 'barbell', difficulty: 'advanced', movement: 'hinge', mode: 'weight_reps' },
  { slug: 'rack-pulls', cat: 'back', name: 'Rack Pulls', muscle: 'traps', secondary: ['lower back','lats','glutes'], equipment: 'barbell', difficulty: 'intermediate', movement: 'hinge', mode: 'weight_reps' },
  { slug: 'kettlebell-deadlift', cat: 'legs', name: 'Kettlebell Deadlift', muscle: 'glutes', secondary: ['hamstrings'], equipment: 'dumbbell', difficulty: 'beginner', movement: 'hinge', mode: 'weight_reps' },

  // Shoulders, Back, Chest & Legs Expansion
  { slug: 'arnold-press', cat: 'shoulders', name: 'Arnold Press', muscle: 'shoulders', secondary: ['triceps'], equipment: 'dumbbell', difficulty: 'intermediate', movement: 'push', mode: 'weight_reps' },
  { slug: 'seated-dumbbell-shoulder-press', cat: 'shoulders', name: 'Seated Dumbbell Shoulder Press', muscle: 'shoulders', secondary: ['triceps'], equipment: 'dumbbell', difficulty: 'beginner', movement: 'push', mode: 'weight_reps' },
  { slug: 'machine-shoulder-press', cat: 'shoulders', name: 'Machine Shoulder Press', muscle: 'shoulders', secondary: ['triceps'], equipment: 'machine', difficulty: 'beginner', movement: 'push', mode: 'weight_reps' },
  { slug: 'upright-row', cat: 'shoulders', name: 'Upright Row', muscle: 'shoulders', secondary: ['traps','biceps'], equipment: 'barbell', difficulty: 'intermediate', movement: 'pull', mode: 'weight_reps' },
  { slug: 'dumbbell-rear-delt-fly', cat: 'shoulders', name: 'Dumbbell Rear Delt Fly', muscle: 'rear delts', secondary: ['traps'], equipment: 'dumbbell', difficulty: 'beginner', movement: 'pull', mode: 'weight_reps' },
  { slug: 'barbell-shrugs', cat: 'back', name: 'Barbell Shrugs', muscle: 'traps', secondary: ['forearms'], equipment: 'barbell', difficulty: 'beginner', movement: 'pull', mode: 'weight_reps' },
  { slug: 'dumbbell-shrugs', cat: 'back', name: 'Dumbbell Shrugs', muscle: 'traps', secondary: ['forearms'], equipment: 'dumbbell', difficulty: 'beginner', movement: 'pull', mode: 'weight_reps' },
  { slug: 'chin-up', cat: 'back', name: 'Chin-up', muscle: 'biceps', secondary: ['lats'], equipment: 'bodyweight', difficulty: 'intermediate', movement: 'pull', mode: 'reps_only' },
  { slug: 'close-grip-lat-pulldown', cat: 'back', name: 'Close-Grip Lat Pulldown', muscle: 'lats', secondary: ['biceps'], equipment: 'cable', difficulty: 'beginner', movement: 'pull', mode: 'weight_reps' },
  { slug: 'back-extension', cat: 'back', name: 'Back Extension (Hyperextension)', muscle: 'lower back', secondary: ['glutes','hamstrings'], equipment: 'bodyweight', difficulty: 'beginner', movement: 'hinge', mode: 'reps_only' },
  { slug: 'front-squat', cat: 'legs', name: 'Front Squat', muscle: 'quadriceps', secondary: ['glutes','core'], equipment: 'barbell', difficulty: 'advanced', movement: 'squat', mode: 'weight_reps' },
  { slug: 'seated-leg-curl', cat: 'legs', name: 'Seated Leg Curl', muscle: 'hamstrings', secondary: ['calves'], equipment: 'machine', difficulty: 'beginner', movement: 'hinge', mode: 'weight_reps' },
  { slug: 'hip-abduction-machine', cat: 'legs', name: 'Hip Abduction Machine', muscle: 'glutes', secondary: [], equipment: 'machine', difficulty: 'beginner', movement: 'hinge', mode: 'weight_reps' },
  { slug: 'hip-adduction-machine', cat: 'legs', name: 'Hip Adduction Machine', muscle: 'quadriceps', secondary: [], equipment: 'machine', difficulty: 'beginner', movement: 'squat', mode: 'weight_reps' },
  { slug: 'standing-machine-calf-raise', cat: 'legs', name: 'Standing Machine Calf Raise', muscle: 'calves', secondary: [], equipment: 'machine', difficulty: 'beginner', movement: 'squat', mode: 'weight_reps' },
  { slug: 'incline-dumbbell-fly', cat: 'chest', name: 'Incline Dumbbell Fly', muscle: 'chest', secondary: ['shoulders'], equipment: 'dumbbell', difficulty: 'intermediate', movement: 'push', mode: 'weight_reps' },
  { slug: 'cable-crossover', cat: 'chest', name: 'Cable Crossover', muscle: 'chest', secondary: ['shoulders'], equipment: 'cable', difficulty: 'beginner', movement: 'push', mode: 'weight_reps' },
  { slug: 'machine-chest-press', cat: 'chest', name: 'Machine Chest Press', muscle: 'chest', secondary: ['triceps','shoulders'], equipment: 'machine', difficulty: 'beginner', movement: 'push', mode: 'weight_reps' },
];

async function seed() {
  console.log('Fetching exercise categories...');
  const { data: cats, error: catErr } = await supabase.from('exercise_categories').select('id, slug');
  if (catErr) {
    console.error('Failed to fetch categories:', catErr);
    process.exit(1);
  }
  const catMap = Object.fromEntries(cats.map(c => [c.slug, c.id]));
  console.log('Category map:', catMap);

  const rows = exercisesToInsert.map(e => ({
    source_id: 'seed:' + e.slug,
    category_id: catMap[e.cat] || null,
    name: e.name,
    primary_muscle: e.muscle,
    secondary_muscles: e.secondary,
    equipment: e.equipment,
    difficulty: e.difficulty,
    movement_type: e.movement,
    tracking_mode: e.mode,
    data_source: 'sample'
  }));

  console.log(`Upserting ${rows.length} exercises into Supabase...`);
  const { data, error } = await supabase.from('exercises').upsert(rows, { onConflict: 'source_id' }).select('id, name');
  if (error) {
    console.error('Upsert failed:', error);
    process.exit(1);
  }
  console.log(`Successfully upserted ${data.length} exercises!`);

  // Verify total count
  const { count } = await supabase.from('exercises').select('*', { count: 'exact', head: true });
  console.log(`New total exercises in database: ${count}`);
}

seed();

