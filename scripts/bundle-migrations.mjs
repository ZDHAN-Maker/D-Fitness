import fs from 'node:fs';
import path from 'node:path';

const migrationsDir = path.join('supabase', 'migrations');
const files = [
  '001_extensions.sql',
  '002_master_tables.sql',
  '003_user_tables.sql',
  '004_workout_tables.sql',
  '005_nutrition_tables.sql',
  '006_ai_tables.sql',
  '007_indexes.sql',
  '008_rls.sql',
  '009_functions.sql',
  '010_seed_master_data.sql',
  '011_storage.sql',
  '013_nutrition_functions.sql',
  '014_workout_functions.sql',
  '015_body_recovery_functions.sql',
  '016_goals_analytics_functions.sql',
  '017_ai_functions.sql'
];

let bundle = `-- ======================================================================
-- PERSONAL FITNESS OS: ALL MIGRATIONS (001 - 017)
-- Run this script in Supabase Dashboard -> SQL Editor -> New Query -> Run
-- ======================================================================

`;

for (const file of files) {
  const filePath = path.join(migrationsDir, file);
  bundle += `-- >>> START ${file} <<<\n`;
  bundle += fs.readFileSync(filePath, 'utf8') + '\n';
  bundle += `-- >>> END ${file} <<<\n\n`;
}

bundle += `-- ======================================================================
-- BACKFILL FOR USERS ALREADY REGISTERED (auth.users)
-- ======================================================================
do $$
declare u record;
begin
  for u in select * from auth.users loop
    insert into public.profiles (id, display_name)
    values (
      u.id,
      coalesce(
        nullif(u.raw_user_meta_data ->> 'display_name', ''),
        nullif(u.raw_user_meta_data ->> 'full_name', ''),
        split_part(u.email, '@', 1)
      )
    ) on conflict (id) do nothing;
    
    insert into public.user_settings (user_id) values (u.id) on conflict (user_id) do nothing;
    insert into public.user_preferences (user_id) values (u.id) on conflict (user_id) do nothing;
    insert into public.notification_preferences (user_id) values (u.id) on conflict (user_id) do nothing;
    insert into public.streaks (user_id, streak_type)
      select u.id, t from unnest(array['workout','nutrition','hydration','habit']) as t
      on conflict (user_id, streak_type) do nothing;
  end loop;
end $$;
`;

fs.writeFileSync(path.join('supabase', 'setup_remote_database.sql'), bundle, 'utf8');
console.log('Successfully created supabase/setup_remote_database.sql. Size:', bundle.length, 'bytes');

