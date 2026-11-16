// Built-in exercise library and starter routines.
// Exercise ids are stable slugs so workouts keep pointing at the right exercise.

export const MUSCLES = [
  'Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps',
  'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Core', 'Other',
];

export const DEFAULT_EXERCISES = [
  ['bench-press', 'Bench Press', 'Chest'],
  ['incline-bench-press', 'Incline Bench Press', 'Chest'],
  ['db-bench-press', 'Dumbbell Bench Press', 'Chest'],
  ['incline-db-press', 'Incline Dumbbell Press', 'Chest'],
  ['machine-chest-press', 'Chest Press (Machine)', 'Chest'],
  ['chest-fly', 'Chest Fly (Machine)', 'Chest'],
  ['cable-crossover', 'Cable Crossover', 'Chest'],
  ['push-up', 'Push-Up', 'Chest'],
  ['dip', 'Dip', 'Chest'],

  ['deadlift', 'Deadlift', 'Back'],
  ['barbell-row', 'Barbell Row', 'Back'],
  ['db-row', 'Dumbbell Row', 'Back'],
  ['pull-up', 'Pull-Up', 'Back'],
  ['chin-up', 'Chin-Up', 'Back'],
  ['lat-pulldown', 'Lat Pulldown', 'Back'],
  ['seated-cable-row', 'Seated Cable Row', 'Back'],
  ['t-bar-row', 'T-Bar Row', 'Back'],
  ['shrug', 'Shrug', 'Back'],
  ['back-extension', 'Back Extension', 'Back'],

  ['overhead-press', 'Overhead Press', 'Shoulders'],
  ['db-shoulder-press', 'Dumbbell Shoulder Press', 'Shoulders'],
  ['machine-shoulder-press', 'Shoulder Press (Machine)', 'Shoulders'],
  ['lateral-raise', 'Lateral Raise', 'Shoulders'],
  ['cable-lateral-raise', 'Cable Lateral Raise', 'Shoulders'],
  ['rear-delt-fly', 'Rear Delt Fly', 'Shoulders'],
  ['face-pull', 'Face Pull', 'Shoulders'],

  ['barbell-curl', 'Barbell Curl', 'Biceps'],
  ['db-curl', 'Dumbbell Curl', 'Biceps'],
  ['hammer-curl', 'Hammer Curl', 'Biceps'],
  ['preacher-curl', 'Preacher Curl', 'Biceps'],
  ['cable-curl', 'Cable Curl', 'Biceps'],

  ['triceps-pushdown', 'Triceps Pushdown', 'Triceps'],
  ['overhead-triceps-ext', 'Overhead Triceps Extension', 'Triceps'],
  ['skull-crusher', 'Skull Crusher', 'Triceps'],
  ['close-grip-bench', 'Close-Grip Bench Press', 'Triceps'],

  ['squat', 'Squat', 'Quads'],
  ['front-squat', 'Front Squat', 'Quads'],
  ['leg-press', 'Leg Press', 'Quads'],
  ['hack-squat', 'Hack Squat', 'Quads'],
  ['leg-extension', 'Leg Extension', 'Quads'],
  ['bulgarian-split-squat', 'Bulgarian Split Squat', 'Quads'],
  ['walking-lunge', 'Walking Lunge', 'Quads'],
  ['goblet-squat', 'Goblet Squat', 'Quads'],

  ['romanian-deadlift', 'Romanian Deadlift', 'Hamstrings'],
  ['lying-leg-curl', 'Lying Leg Curl', 'Hamstrings'],
  ['seated-leg-curl', 'Seated Leg Curl', 'Hamstrings'],

  ['hip-thrust', 'Hip Thrust', 'Glutes'],
  ['glute-bridge', 'Glute Bridge', 'Glutes'],
  ['hip-abduction', 'Hip Abduction (Machine)', 'Glutes'],
  ['cable-kickback', 'Cable Kickback', 'Glutes'],

  ['standing-calf-raise', 'Standing Calf Raise', 'Calves'],
  ['seated-calf-raise', 'Seated Calf Raise', 'Calves'],

  ['hanging-leg-raise', 'Hanging Leg Raise', 'Core'],
  ['cable-crunch', 'Cable Crunch', 'Core'],
  ['ab-wheel', 'Ab Wheel Rollout', 'Core'],
  ['crunch', 'Crunch', 'Core'],
  ['russian-twist', 'Russian Twist', 'Core'],
];

// Starter programs offered during onboarding. [routine name, [exercise ids]]
export const STARTER_PROGRAMS = {
  ppl: {
    label: 'Push · Pull · Legs',
    detail: '3 routines, great for 3–6 days a week',
    routines: [
      ['Push', ['bench-press', 'overhead-press', 'incline-db-press', 'lateral-raise', 'triceps-pushdown', 'overhead-triceps-ext']],
      ['Pull', ['deadlift', 'pull-up', 'barbell-row', 'face-pull', 'barbell-curl', 'hammer-curl']],
      ['Legs', ['squat', 'romanian-deadlift', 'leg-press', 'lying-leg-curl', 'standing-calf-raise']],
    ],
  },
  upperLower: {
    label: 'Upper · Lower',
    detail: '2 routines, great for 4 days a week',
    routines: [
      ['Upper Body', ['bench-press', 'barbell-row', 'overhead-press', 'lat-pulldown', 'db-curl', 'triceps-pushdown']],
      ['Lower Body', ['squat', 'romanian-deadlift', 'leg-press', 'lying-leg-curl', 'standing-calf-raise', 'hanging-leg-raise']],
    ],
  },
  fullBody: {
    label: 'Full Body',
    detail: '2 routines, great for 2–3 days a week',
    routines: [
      ['Full Body A', ['squat', 'bench-press', 'barbell-row', 'lateral-raise', 'db-curl']],
      ['Full Body B', ['deadlift', 'overhead-press', 'lat-pulldown', 'leg-press', 'triceps-pushdown']],
    ],
  },
};
