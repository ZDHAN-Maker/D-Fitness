const fs = require('fs');
const envText = fs.readFileSync('.env.local', 'utf-8');
const env = {};
for (const line of envText.split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
  const idx = trimmed.indexOf('=');
  env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
}
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function exportCatalog() {
  const { data, error } = await supabase
    .from('exercises')
    .select('id, name, primary_muscle, secondary_muscles, equipment, difficulty, movement_type, tracking_mode')
    .order('primary_muscle')
    .order('name');

  if (error) {
    console.error(error);
    process.exit(1);
  }

  // Save clean JSON
  fs.writeFileSync('exercises_catalog.json', JSON.stringify(data, null, 2), 'utf-8');
  console.log(`Successfully exported ${data.length} exercises to exercises_catalog.json`);

  // Print grouped summary
  const groups = {};
  for (const ex of data) {
    const m = ex.primary_muscle || 'other';
    if (!groups[m]) groups[m] = [];
    groups[m].push(ex.name);
  }
  for (const [m, list] of Object.entries(groups)) {
    console.log(`${m.toUpperCase()} (${list.length}): ${list.join(', ')}`);
  }
}

exportCatalog();

