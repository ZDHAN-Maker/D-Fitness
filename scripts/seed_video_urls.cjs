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

const VIDEO_MAPPINGS = {
  "Ab Wheel Rollout": "https://www.youtube.com/watch?v=rqiTPdK1cWg",
  "Air Squats": "https://www.youtube.com/watch?v=C_VtOYc6j5c",
  "Arnold Press": "https://www.youtube.com/watch?v=6Z15_WdXmVw",
  "Back Extension (Hyperextension)": "https://www.youtube.com/watch?v=ph3pddpKzzw",
  "Back Squat": "https://www.youtube.com/watch?v=bEv6CCg2BC8",
  "Band Pull-Apart": "https://www.youtube.com/watch?v=JObXOnznsqE",
  "Banded Bicep Curl": "https://www.youtube.com/watch?v=4yqQ_rQ4-W4",
  "Banded Lateral Raise": "https://www.youtube.com/watch?v=PPrzBWZDOhA",
  "Barbell Bicep Curl": "https://www.youtube.com/watch?v=ykJmrZ5v0Oo",
  "Barbell Overhead Press": "https://www.youtube.com/watch?v=2yjwXTZQDDI",
  "Barbell Row": "https://www.youtube.com/watch?v=FWJR5Ve8gkQ",
  "Barbell Shrugs": "https://www.youtube.com/watch?v=M_8qQ92q4-A",
  "Bench Press": "https://www.youtube.com/watch?v=rT7DgCr-3pg",
  "Bicycle Crunches": "https://www.youtube.com/watch?v=9FGilxCbdz8",
  "Bulgarian Split Squat": "https://www.youtube.com/watch?v=2C-uNgKwPLE",
  "Burpees": "https://www.youtube.com/watch?v=auBLPXO8Fww",
  "Cable Bicep Curl": "https://www.youtube.com/watch?v=NFzTWp2qpiE",
  "Cable Chest Fly": "https://www.youtube.com/watch?v=Iwe6AmxVf7o",
  "Cable Crossover": "https://www.youtube.com/watch?v=taI4XduLpTk",
  "Cable Face Pull": "https://www.youtube.com/watch?v=rep-qVOkqgk",
  "Cable Lateral Raise": "https://www.youtube.com/watch?v=PPrzBWZDOhA",
  "Cable Rope Crunch": "https://www.youtube.com/watch?v=6GMKPQVERTE",
  "Cable Tricep Kickback": "https://www.youtube.com/watch?v=2-LAMcpzODU",
  "Cable Woodchoppers (High to Low)": "https://www.youtube.com/watch?v=pZapR0tcTyg",
  "Cable Woodchoppers (Low to High)": "https://www.youtube.com/watch?v=17oUvK9G6iM",
  "Chair / Bench Dips": "https://www.youtube.com/watch?v=0326dy_-CzM",
  "Chest Dips": "https://www.youtube.com/watch?v=2z8JmcrW-As",
  "Chin-up": "https://www.youtube.com/watch?v=b-Addsbfd8g",
  "Close-Grip Barbell Bench Press": "https://www.youtube.com/watch?v=nEF0bv2FW94",
  "Close-Grip Lat Pulldown": "https://www.youtube.com/watch?v=lueEJGjTuPQ",
  "Concentration Curl": "https://www.youtube.com/watch?v=0AUGkch3tzc",
  "Deadbug": "https://www.youtube.com/watch?v=g_BYB0R-4Ws",
  "Deadlift": "https://www.youtube.com/watch?v=op9kVnSso6Q",
  "Decline Weighted Sit-up": "https://www.youtube.com/watch?v=sK1S3_a6vF8",
  "Deficit Deadlift": "https://www.youtube.com/watch?v=q6t8pU2UuL8",
  "Diamond Push-up": "https://www.youtube.com/watch?v=J0DnG1_S92I",
  "Dragon Flag": "https://www.youtube.com/watch?v=jWc87L36Uak",
  "Dumbbell Curl": "https://www.youtube.com/watch?v=sAq_ocpRh_I",
  "Dumbbell Floor Press": "https://www.youtube.com/watch?v=uUGDRwge4F8",
  "Dumbbell Front Raise": "https://www.youtube.com/watch?v=-t7fuZ0KhDA",
  "Dumbbell Rear Delt Fly": "https://www.youtube.com/watch?v=ea_0pUj6Ppg",
  "Dumbbell Romanian Deadlift": "https://www.youtube.com/watch?v=_oyxCn2iSjU",
  "Dumbbell Shrugs": "https://www.youtube.com/watch?v=cJRVVxmytaM",
  "Dumbbell Tricep Kickback": "https://www.youtube.com/watch?v=6SS6KTAmvNE",
  "Front Squat": "https://www.youtube.com/watch?v=v-mQm_droHg",
  "Glute Bridge": "https://www.youtube.com/watch?v=wPM8icPu6H8",
  "Goblet Squat": "https://www.youtube.com/watch?v=MeIiIdhvXT4",
  "Hack Squat": "https://www.youtube.com/watch?v=0tn5K9NlCfo",
  "Hammer Curl": "https://www.youtube.com/watch?v=zC3nLlEvin4",
  "Hanging Knee Raise": "https://www.youtube.com/watch?v=RD_A-Z15Er4",
  "Hanging Straight Leg Raise": "https://www.youtube.com/watch?v=hdng3Nm1x_E",
  "High Knees": "https://www.youtube.com/watch?v=oDdkytliOqE",
  "Hip Abduction Machine": "https://www.youtube.com/watch?v=G_8L9u1xLrk",
  "Hip Adduction Machine": "https://www.youtube.com/watch?v=e_p5a_QjQO4",
  "Hip Thrust": "https://www.youtube.com/watch?v=SEdqd1n0cvg",
  "Hollow Body Hold": "https://www.youtube.com/watch?v=V2xhmXWwE_o",
  "Incline Barbell Bench Press": "https://www.youtube.com/watch?v=SrqOu55lrYU",
  "Incline Dumbbell Curl": "https://www.youtube.com/watch?v=soxrZlIl35U",
  "Incline Dumbbell Fly": "https://www.youtube.com/watch?v=bDaIL_zKbGs",
  "Incline Dumbbell Press": "https://www.youtube.com/watch?v=8iPEnn-ltC8",
  "Incline Push-up": "https://www.youtube.com/watch?v=-9S9gdRwwak",
  "Jump Rope": "https://www.youtube.com/watch?v=1BZM2Vre5oc",
  "Jump Squats": "https://www.youtube.com/watch?v=A-cFYWvaW3I",
  "Jumping Jacks": "https://www.youtube.com/watch?v=c4DAnQ6DtF8",
  "Kettlebell Deadlift": "https://www.youtube.com/watch?v=zP0T7Qz0iT4",
  "Lat Pulldown": "https://www.youtube.com/watch?v=CAwf7n6Luuc",
  "Lateral Raise": "https://www.youtube.com/watch?v=3VcKaXpzqRo",
  "Leg Extension": "https://www.youtube.com/watch?v=YyvSfVjQeL0",
  "Leg Press": "https://www.youtube.com/watch?v=IZxyjW7MPJQ",
  "Leg Raises": "https://www.youtube.com/watch?v=JB2oyawG9KI",
  "Lying Leg Curl": "https://www.youtube.com/watch?v=1Tq3QdYUuHs",
  "Machine Chest Press": "https://www.youtube.com/watch?v=xUm0BiZCWlQ",
  "Machine Shoulder Press": "https://www.youtube.com/watch?v=WvLMauqrnK8",
  "Mountain Climbers": "https://www.youtube.com/watch?v=nmwgirgXLYM",
  "Overhead Cable Triceps Extension": "https://www.youtube.com/watch?v=1u18yJcLuh0",
  "Overhead Dumbbell Triceps Extension": "https://www.youtube.com/watch?v=_gsUck-7M74",
  "Overhead EZ-Bar French Press": "https://www.youtube.com/watch?v=fJzZvd7F9w8",
  "Pallof Press": "https://www.youtube.com/watch?v=AH_QZLM_0-s",
  "Parallel Bar Dips": "https://www.youtube.com/watch?v=2z8JmcrW-As",
  "Pec Deck Machine": "https://www.youtube.com/watch?v=O-OnnvyS8rE",
  "Pike Push-up": "https://www.youtube.com/watch?v=sposDXWEB0A",
  "Plank": "https://www.youtube.com/watch?v=ASdvN_XEl_c",
  "Plank to Push-up": "https://www.youtube.com/watch?v=L4oFJRDAU4Q",
  "Preacher Curl": "https://www.youtube.com/watch?v=fIWP-FRFNU0",
  "Pull-up": "https://www.youtube.com/watch?v=eGo4IYlbE5g",
  "Push-up": "https://www.youtube.com/watch?v=IODxDxX7oi4",
  "Rack Pulls": "https://www.youtube.com/watch?v=u7ne1u_hA2Y",
  "Reverse Crunch": "https://www.youtube.com/watch?v=hyv14e2QDq0",
  "Reverse Pec Deck": "https://www.youtube.com/watch?v=2kTvhqDkQYI",
  "Reverse-Grip Barbell Curl": "https://www.youtube.com/watch?v=nRisHW32nKs",
  "Romanian Deadlift": "https://www.youtube.com/watch?v=JCXUYuzwNrM",
  "Rowing Machine": "https://www.youtube.com/watch?v=zQ82RYIFLN8",
  "Russian Twist": "https://www.youtube.com/watch?v=wkD8rjkodUI",
  "Seated Cable Row": "https://www.youtube.com/watch?v=GZbfZ033f74",
  "Seated Calf Raise": "https://www.youtube.com/watch?v=JbyjNymZOt0",
  "Seated Dumbbell Shoulder Press": "https://www.youtube.com/watch?v=qEwKCR5JCog",
  "Seated Leg Curl": "https://www.youtube.com/watch?v=ELOCsoDSmrg",
  "Shoulder Press": "https://www.youtube.com/watch?v=qEwKCR5JCog",
  "Side Plank": "https://www.youtube.com/watch?v=N_cbdfwV0Gs",
  "Single-Arm Cable Tricep Pushdown": "https://www.youtube.com/watch?v=2-LAMcpzODU",
  "Single-Arm Dumbbell Row": "https://www.youtube.com/watch?v=dFzUjzfih7k",
  "Single-Leg Calf Raise": "https://www.youtube.com/watch?v=JbyjNymZOt0",
  "Single-Leg Dumbbell Deadlift": "https://www.youtube.com/watch?v=1FmW3X1bE_Y",
  "Skull Crusher (EZ Bar)": "https://www.youtube.com/watch?v=d_KZxkY_0cM",
  "Snatch-Grip Deadlift": "https://www.youtube.com/watch?v=x8QyA2X5uQY",
  "Standing Machine Calf Raise": "https://www.youtube.com/watch?v=3UWi44yN-wE",
  "Stiff-Leg Deadlift": "https://www.youtube.com/watch?v=1uDiW5--rAE",
  "Straight-Arm Cable Pulldown": "https://www.youtube.com/watch?v=gT_uI0gV6V4",
  "Sumo Deadlift": "https://www.youtube.com/watch?v=wbhTqvyiO28",
  "T-Bar Row": "https://www.youtube.com/watch?v=j3Igk5nyZE4",
  "Toes to Bar": "https://www.youtube.com/watch?v=6dHvTlsMvNY",
  "Trap Bar / Hex Bar Deadlift": "https://www.youtube.com/watch?v=9b8O4Ym45Ew",
  "Treadmill Run": "https://www.youtube.com/watch?v=brFHyOTTwHU",
  "Tricep Rope Pushdown": "https://www.youtube.com/watch?v=vB5OHsJ3EME",
  "Triceps Pushdown": "https://www.youtube.com/watch?v=2-LAMcpzODU",
  "Upright Row": "https://www.youtube.com/watch?v=amCU-ziHITM",
  "Walking Lunge": "https://www.youtube.com/watch?v=L8fvypPrzzs",
  "Wall Sit": "https://www.youtube.com/watch?v=y-wV4Venusw",
  "Wide-Grip Push-up": "https://www.youtube.com/watch?v=rr6eFNNDQxE",
  "Wrist Curls": "https://www.youtube.com/watch?v=FW7URAaC_I8",
};

async function seed() {
  console.log('Fetching exercises from database...');
  const { data: exercises, error } = await supabase.from('exercises').select('id, name, video_url');
  if (error) {
    console.error('Error:', error);
    process.exit(1);
  }

  console.log(`Found ${exercises.length} exercises. Updating video_url...`);
  let updatedCount = 0;
  for (const ex of exercises) {
    const videoUrl = VIDEO_MAPPINGS[ex.name];
    if (videoUrl) {
      const { error: updateErr } = await supabase
        .from('exercises')
        .update({ video_url: videoUrl })
        .eq('id', ex.id);
      if (updateErr) {
        console.error(`Failed to update ${ex.name}:`, updateErr);
      } else {
        updatedCount++;
      }
    }
  }
  console.log(`Successfully updated ${updatedCount} exercises with tutorial video URLs!`);
}

seed();

