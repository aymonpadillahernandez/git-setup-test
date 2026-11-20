// Built-in exercise library and starter routines.
// Exercise ids are stable slugs so workouts keep pointing at the right exercise.

export const MUSCLES = [
  'Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps',
  'Quads', 'Hamstrings', 'Glutes', 'Adductors', 'Calves', 'Core', 'Other',
];

export const DEFAULT_EXERCISES = [
  ['bench-press', 'Flat Bench Press', 'Chest'],
  ['incline-bench-press', 'Incline Bench Press', 'Chest'],
  ['db-bench-press', 'Dumbbell Bench Press', 'Chest'],
  ['incline-db-press', 'Incline Dumbbell Press', 'Chest'],
  ['machine-chest-press', 'Chest Press (Machine)', 'Chest'],
  ['chest-fly', 'Pec Deck', 'Chest'],
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
  ['pullover', 'Pullover', 'Back'],
  ['machine-row', 'Machine Row', 'Back'],

  ['overhead-press', 'Overhead Press', 'Shoulders'],
  ['db-shoulder-press', 'Dumbbell Shoulder Press', 'Shoulders'],
  ['seated-db-press', 'Seated Dumbbell Press', 'Shoulders'],
  ['db-front-raise', 'Dumbbell Front Raise', 'Shoulders'],
  ['machine-shoulder-press', 'Shoulder Press (Machine)', 'Shoulders'],
  ['lateral-raise', 'Lateral Raise', 'Shoulders'],
  ['cable-lateral-raise', 'Cable Lateral Raise', 'Shoulders'],
  ['rear-delt-fly', 'Rear Delt Fly', 'Shoulders'],
  ['face-pull', 'Cable Face Pull', 'Shoulders'],

  ['barbell-curl', 'Barbell Curl', 'Biceps'],
  ['db-curl', 'Dumbbell Curl', 'Biceps'],
  ['hammer-curl', 'Hammer Curl', 'Biceps'],
  ['preacher-curl', 'Preacher Curl', 'Biceps'],
  ['cable-curl', 'Cable Curl', 'Biceps'],

  ['triceps-pushdown', 'Triceps Pushdown', 'Triceps'],
  ['rope-pushdown', 'Triceps Rope Pushdown', 'Triceps'],
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
  ['hip-abduction', 'Hip Abduction (in → out)', 'Glutes'],
  ['hip-adduction', 'Hip Adduction (out → in)', 'Adductors'],
  ['cable-kickback', 'Cable Kickback', 'Glutes'],

  ['standing-calf-raise', 'Standing Calf Raise', 'Calves'],
  ['seated-calf-raise', 'Seated Calf Raise', 'Calves'],
  ['calf-press', 'Calf Press', 'Calves'],

  ['hanging-leg-raise', 'Hanging Leg Raise', 'Core'],
  ['cable-crunch', 'Cable Crunch', 'Core'],
  ['ab-wheel', 'Ab Wheel Rollout', 'Core'],
  ['crunch', 'Crunch', 'Core'],
  ['russian-twist', 'Russian Twist', 'Core'],
];

// Programs offered during onboarding.
// mode 'rotation': routines are done in order (Day 1 → Day 2 → …), any number of days a week.
// mode 'schedule': each routine is tied to weekdays.
// Each routine: [name, weekdays (0 = Sun … 6 = Sat), [[exercise id, sets, min reps, max reps]]].
// Rep ranges drive "double progression": add reps until every set hits the top of the
// range, then add weight and start again from the bottom.
export const STARTER_PROGRAMS = {
  mySplit: {
    label: 'My 5-day split',
    detail: 'Shoulders · Chest · Legs · Back · Arms, in order',
    mode: 'rotation',
    routines: [
      ['Day 1 · Shoulders', [], [['db-front-raise', 3, 8, 12], ['seated-db-press', 3, 8, 12], ['face-pull', 3, 8, 12]]],
      ['Day 2 · Chest', [], [['bench-press', 3, 8, 12], ['chest-fly', 3, 8, 12], ['incline-bench-press', 3, 8, 12]]],
      ['Day 3 · Legs', [], [['leg-extension', 3, 8, 12], ['seated-leg-curl', 3, 8, 12], ['calf-press', 3, 8, 12], ['leg-press', 3, 8, 12], ['hip-abduction', 3, 8, 12], ['hip-adduction', 3, 8, 12], ['hip-thrust', 3, 8, 12]]],
      ['Day 4 · Back', [], [['pullover', 3, 8, 12], ['back-extension', 3, 8, 12], ['seated-cable-row', 3, 8, 12], ['machine-row', 3, 8, 12]]],
      ['Day 5 · Biceps & Triceps', [], [['hammer-curl', 3, 8, 12], ['overhead-triceps-ext', 3, 8, 12], ['db-curl', 3, 8, 12], ['rope-pushdown', 3, 8, 12]]],
    ],
  },
  ppl: {
    label: 'Push · Pull · Legs',
    detail: 'Mon Push · Wed Pull · Fri Legs',
    routines: [
      ['Push', [1], [['bench-press', 3, 5, 8], ['overhead-press', 3, 6, 10], ['incline-db-press', 3, 8, 12], ['lateral-raise', 3, 12, 15], ['triceps-pushdown', 3, 10, 15], ['overhead-triceps-ext', 3, 10, 15]]],
      ['Pull', [3], [['deadlift', 3, 3, 6], ['pull-up', 3, 6, 10], ['barbell-row', 3, 6, 10], ['face-pull', 3, 12, 15], ['barbell-curl', 3, 8, 12], ['hammer-curl', 3, 10, 15]]],
      ['Legs', [5], [['squat', 3, 5, 8], ['romanian-deadlift', 3, 8, 12], ['leg-press', 3, 10, 15], ['lying-leg-curl', 3, 10, 15], ['standing-calf-raise', 3, 12, 15]]],
    ],
  },
  upperLower: {
    label: 'Upper · Lower',
    detail: 'Mon & Thu Upper · Tue & Fri Lower',
    routines: [
      ['Upper Body', [1, 4], [['bench-press', 3, 5, 8], ['barbell-row', 3, 6, 10], ['overhead-press', 3, 6, 10], ['lat-pulldown', 3, 8, 12], ['db-curl', 3, 10, 15], ['triceps-pushdown', 3, 10, 15]]],
      ['Lower Body', [2, 5], [['squat', 3, 5, 8], ['romanian-deadlift', 3, 8, 12], ['leg-press', 3, 10, 15], ['lying-leg-curl', 3, 10, 15], ['standing-calf-raise', 3, 12, 15], ['hanging-leg-raise', 3, 10, 15]]],
    ],
  },
  fullBody: {
    label: 'Full Body',
    detail: 'Mon & Fri A · Wed B',
    routines: [
      ['Full Body A', [1, 5], [['squat', 3, 5, 8], ['bench-press', 3, 5, 8], ['barbell-row', 3, 6, 10], ['lateral-raise', 3, 12, 15], ['db-curl', 3, 10, 15]]],
      ['Full Body B', [3], [['deadlift', 3, 3, 6], ['overhead-press', 3, 6, 10], ['lat-pulldown', 3, 8, 12], ['leg-press', 3, 10, 15], ['triceps-pushdown', 3, 10, 15]]],
    ],
  },
};

export const DEFAULT_REP_RANGE = [8, 12];
