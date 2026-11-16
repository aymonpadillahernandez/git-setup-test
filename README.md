# Lift: a simple workout tracker for iPhone

A clean, Apple-style gym log that you install on your iPhone's Home Screen. It
remembers the weight and reps of every set and shows them **week by week**, so you
can always see whether you're progressing and know exactly what to beat next time.

![Lift on iPhone: Today's workout, live logger, weekly plan, strength chart, weight & reps charts, dark mode](docs/preview.png)

It's a Progressive Web App: plain HTML/CSS/JavaScript with no build step, no
account and no server. Your data stays on your phone.

## Your day in the gym

1. **Open Lift.** The **Today** tab shows the next workout in your order
   (Day 1 → Day 2 → … → Day 5 → Day 1). Each exercise shows the weight × reps of
   every set from the last time you did that day, plus today's **target**.
2. **Tap Start.** Every set is pre-filled with last session's numbers. Tap ✓ if you
   matched them, or type what you actually did.
3. **Tap Finish.** Today's sets are saved and become the **baseline for next
   time**. Everything is kept forever in History and Progress.

Train as many days a week as you like (4 one week, 6 the next). Lift doesn't care
about weekdays in this mode: it always picks the workout after the last one you
finished. If you'd rather tie workouts to weekdays, switch **Plan → How you train**
to **Fixed days**. Then a missed day is offered as a catch-up on your next free day.

## Your program (preloaded)

| Day | Exercises |
|---|---|
| **Day 1 · Shoulders** | Dumbbell Front Raise · Seated Dumbbell Press · Cable Face Pull |
| **Day 2 · Chest** | Flat Bench Press · Pec Deck · Incline Bench Press |
| **Day 3 · Legs** | Leg Extension · Seated Leg Curl · Calf Press · Leg Press · Hip Abduction (in → out) · Hip Adduction (out → in) · Hip Thrust |
| **Day 4 · Back** | Pullover · Back Extension · Seated Cable Row · Machine Row |
| **Day 5 · Biceps & Triceps** | Hammer Curl · Overhead Triceps Extension · Dumbbell Curl · Triceps Rope Pushdown |

Every exercise starts at 3 sets × 8–12 reps. Change sets, rep ranges, exercises or
order in **Plan**, and rename any exercise in **Settings → Exercises** (its history
stays attached).

## What it does

| Tab | What you get |
|---|---|
| **Today** | The next workout with last time's sets and today's targets, where you are in your order (e.g. 3 of 5), a week strip of the days you trained, rings for workouts vs. weekly goal and volume vs. last week, your streak, an 8-week volume chart, and recent records. |
| **Plan** | **How you train**: *In order* (numbered list, drag to reorder) or *Fixed days* (tap a weekday to pick a workout). Each exercise in a workout has sets and a **rep range** (e.g. 8–12). Other ready-made programs (Push/Pull/Legs, Upper/Lower, Full Body) are available too. |
| **History** | Every workout grouped by week, with duration, sets, volume and record count. Open one to see each set compared with the previous session. Edit it, delete it, or do it again. |
| **Progress** | Every exercise you've trained, with its latest top set, change vs. the previous week, and a trend line. Each exercise has its own page with **strength (est. 1RM)**, **weight** and **reps** charts that share the same weeks, a weekly volume chart, personal records, and a **week-by-week log of every set's weight × reps**. |

While you train:

- The **Previous** column shows last session's sets (from the same day of your program), and empty fields are pre-filled with them.
- Each exercise shows a target using **double progression** (below).
- When a set beats your best weight or estimated 1RM, you get a **🏆 record** right away.
- A **rest timer** starts after each set (adjustable, or turn it off in Settings).
- Swipe a set left to delete it. Minimize the workout to browse your history while it keeps running.
- kg or lb, weeks starting Monday or Sunday, and light/dark mode that follows your iPhone.
- **Backups**: Settings → Export Backup saves a `.json` file to Files/iCloud Drive. Restore it on any device.

## The formulas

**Estimated one-rep max (e1RM)** is the standard way to combine weight and reps
into one strength number, so `80 kg × 5` and `70 kg × 10` can be compared. Lift
uses the best set of each week. Choose the formula in Settings:

| Formula | Est. 1RM | Example: 80 kg × 8 |
|---|---|---|
| Epley (default) | weight × (1 + reps ÷ 30) | 101 kg |
| Brzycki | weight × 36 ÷ (37 − reps) | 99 kg |

Both are widely used. They give the same result at 10 reps and stay within a few percent of each other below that. Above about 12
reps, estimates get unreliable, so watch the reps chart for high-rep work.

**Volume** = sets × reps × weight (also called tonnage or volume load). It
measures total work, and Lift shows it per workout and per week.

**Double progression** sets the "beat last time" target. Each exercise has a rep
range. Add a rep each session until **every** set at your top weight reaches the
top of the range, then add weight (2.5 kg / 5 lb) and start again at the bottom.
Bodyweight exercises progress by reps.

## Put it on your iPhone

The app has to be served from an `https://` address once. After that it's installed and works offline.

1. **Host it** (pick one):
   - **GitHub Pages (simplest).** Free GitHub Pages needs a *public* repository. The repo contains only app code; your workouts never leave your phone. Set the repo to public, then go to **Settings → Pages → Build and deployment → Deploy from a branch**, choose `main` and `/ (root)`, and save. After a minute your app is at `https://<your-username>.github.io/<repo-name>/`.
   - **Keep the repo private:** connect it to [Netlify](https://www.netlify.com/) or [Cloudflare Pages](https://pages.cloud.cloudflare.com/) (both free, no build command, publish directory = repo root), or use GitHub Pages with a paid GitHub plan.
2. On your iPhone, open that address in **Safari**.
3. Tap **Share** → **Add to Home Screen** → **Add**.
4. Open **Lift** from your Home Screen. It runs full-screen like a native app and works with no signal at the gym.

> Tip: export a backup once in a while (Settings → Export Backup). The data lives inside the app on your phone, so a backup protects it if you delete the app or switch phones.

## Run it on your computer

Any static file server works:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

## Project layout

```
index.html              App shell
manifest.webmanifest    Home Screen name, icons, colors
sw.js                   Offline cache (bump VERSION when you change files)
css/app.css             iOS-style design system, light + dark
js/app.js               Router, navigation bar, tab bar
js/store.js             Data model + localStorage persistence (weights stored in kg)
js/stats.js             Weekly stats, records, est. 1RM, double progression, today's plan
js/workout.js           Live workout logger, rest timer, finish summary
js/picker.js            Exercise picker / new exercise
js/charts.js            SVG line chart (scrubbable), columns, sparklines, rings
js/views/*.js           Today, Plan/Routines, History, Progress, Settings
js/data.js              Exercise library, starter programs (schedule + rep ranges)
icons/                  App icons
```

### Updating the app

After changing any file, bump `VERSION` in `sw.js` (e.g. `lift-v2` → `lift-v3`) and push. The
installed app updates in the background and shows the new version the next time
you open it.
