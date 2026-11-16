# Lift: a simple workout tracker for iPhone

A clean, Apple-style gym log that you install on your iPhone's Home Screen. It
remembers the weight and reps of every set and shows them **week by week**, so you
can always see whether you're progressing and know exactly what to beat next time.

![Lift on iPhone: Summary, live workout, exercise progress, week-by-week log, dark mode](docs/preview.png)

It's a Progressive Web App: plain HTML/CSS/JavaScript with no build step, no
account and no server. Your data stays on your phone.

## What it does

| Tab | What you get |
|---|---|
| **Summary** | Activity-style rings for this week: workouts vs. your weekly goal, and volume vs. last week. Also your goal streak, sets and time this week, an 8-week volume chart, and recent personal records. |
| **Workout** | One-tap start from your routines (Push/Pull/Legs and other starter programs are included), an empty workout, or logging a past workout. Create and edit routines, and drag to reorder exercises. |
| **History** | Every workout grouped by week, with duration, sets, volume and record count. Open one to see each set, compared with the previous session. Edit or delete it, or do it again. |
| **Progress** | Every exercise you've trained, with its latest top set, change vs. the previous week, and a 10-week sparkline. Each exercise has its own page with a chart (weight, est. 1RM, volume or reps; 3M/6M/1Y/All), personal records, and a **week-by-week log of every set's weight × reps**. |

While you train:

- The **Previous** column shows what you did last time, and empty fields are pre-filled with it. Tap ✓ to accept, or type a new number.
- **"Beat last time"** gives a target for every exercise: one more rep, or more weight once you reach 12 reps.
- When a set beats your best weight or estimated 1RM, you get a **🏆 record** right away.
- A **rest timer** starts after each set (adjustable, or turn it off in Settings).
- Swipe a set left to delete it. Minimize the workout to browse your history while it keeps running.
- kg or lb, weeks starting Monday or Sunday, and light/dark mode that follows your iPhone.
- **Backups**: Settings → Export Backup saves a `.json` file to Files/iCloud Drive. Restore it on any device.

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
js/stats.js             Weekly stats, records, est. 1RM, progression suggestions
js/workout.js           Live workout logger, rest timer, finish summary
js/picker.js            Exercise picker / new exercise
js/charts.js            SVG line chart (scrubbable), columns, sparklines, rings
js/views/*.js           Summary, Workout/Routines, History, Progress, Settings
js/data.js              Exercise library and starter programs
icons/                  App icons
```

### Updating the app

After changing any file, bump `VERSION` in `sw.js` (e.g. `lift-v2`) and push. The
installed app updates in the background and shows the new version the next time
you open it.
