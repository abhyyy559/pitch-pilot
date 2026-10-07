# Pitch Pilot — Build Plan (PLAN MODE — Awaiting Approval)

> Status: **PLAN ONLY. No app code written yet.**
> Approval gate: Review this file + `PRD.markdown`. Reply "approved" to start building step-by-step.

## 1. What I understood

Pitch Pilot is a pitch practice coach for hackathon participants:

- User speaks into microphone in Chrome.
- App transcribes live in browser via built-in Web Speech API.
- Counts/highlights filler words like "like", "um", etc.
- Shows live words-per-minute (WPM) pace with target zone around 160 WPM.
- Runs a 5-minute countdown timer with color zones (green / yellow / red for last 30s).
- Saves every session to localStorage with scores to track improvement.
- Clean, dark, premium design — required, will be demoed on camera.
- Constraints: single-page app, no backend, no APIs, localStorage only, plain HTML/CSS/JS, open in Chrome immediately with zero setup.

## 2. Tech stack (no build step)

- Plain `HTML + CSS + JavaScript`, no framework, no npm, no bundler.
- Browser APIs only:
  - `webkitSpeechRecognition` (Chrome) with `continuous=true`, `interimResults=true`
  - `localStorage` for history
  - No network calls.
- How to run: double-click `index.html` **or** `npx serve .` — works immediately in Chrome. Microphone permission prompt on first use.

## 3. Proposed file structure

```text
task-5/
  plan.markdown   <- this file (build plan)
  PRD.markdown    <- product requirements
  index.html      <- (AFTER approval) app shell + UI layout
  style.css       <- (AFTER approval) dark premium theme
  app.js          <- (AFTER approval) mic/transcript/filler/pace/timer/history logic
```

Why 3 app files instead of 1: easier to review/demo, still zero setup. All relative paths, no modules required (plain `<script>` to avoid CORS issues on `file://`).

Alternative if you prefer: single `index.html` with inline CSS/JS. Tell me before approval if you want single-file.

## 4. Filler word list (proposed — confirm)

Default set: `um, uh, uhm, hmm, like, you know, i mean, basically, actually, literally, so, well, right, kinda, sorta, stuff`

- Matching: case-insensitive, word-boundary, handles "you know" / "i mean" as phrases.
- UI: highlighted inline in transcript + legend with per-word counts + total count.
- Note on your wording "different color": I propose each filler *type* gets its own color chip + legend (e.g., um=amber, like=violet). Confirm, or I can do single highlight color.

## 5. Pace spec (proposed)

- Target: **160 WPM**.
- Compute: `WPM = (final words / elapsed speaking seconds) * 60`, updated every 2s, only while listening.
- Zones (proposed):
  - Green / On pace: 140–180 WPM
  - Yellow / Watch: 120–139 or 181–200 WPM
  - Red / Too slow/fast: <120 or >200 WPM
- Visual: numeric WPM + colored pill + small hint ("Too slow — pick up pace" / "Too fast — breathe").

## 6. Timer spec

- 5:00 countdown, buttons: Start / Pause / Reset.
- Color zones:
  - Green: > 1:00 remaining
  - Yellow: 1:00–0:31 remaining + text alert "1 minute left"
  - Red: 0:30–0:00 + pulsing + text alert "30 seconds left"
- At 0:00: auto-stop listening, auto-save session.
- Timer runs independently of mic so user can practice without speaking.

## 7. Score out of 100 (proposed formula — confirm)

Needed because PRD says "score" but no formula was given. Proposed v1:

```text
fillerRate = fillerCount / max(totalWords, 1)
fillerScore = max(0, 40 - fillerRate * 400)   // 0 fillers = 40 pts, 10%+ fillers = 0 pts, 40 pts max
paceScore = 30 pts if 140-180, 20 pts if 120-139/181-200, 10 pts otherwise, 0 if <10 words
durationScore = min(30, durationSec / 300 * 30) // 5 min = 30 pts, proportional below
total = round(fillerScore + paceScore + durationScore) // 0-100
```

Example: 300 words, 6 fillers (2%), 150 WPM, 3 min → 32 + 30 + 18 = 80.
History row shows this score + date, duration, words, fillers, avg WPM.

## 8. Features in build order

### Step 1 — Shell + dark theme + timer
- Static layout: header, mic button (disabled placeholder), transcript pane, stats cards (WPM, fillers, timer), history list shell.
- Dark premium CSS: near-black bg, card surfaces, accent color, large readable type.
- Timer: start/pause/reset, mm:ss, green/yellow/red zones, 1:00 and 0:30 alerts.
- Verify: open `index.html` in Chrome, timer counts down, colors change, no console errors.

### Step 2 — Mic + live transcript (Web Speech API)
- Big mic button toggles `SpeechRecognition`, live interim + final transcript append.
- Handle: no-mic / permission-denied / unsupported-browser messages.
- Manual textarea fallback if speech API blocked (so demo never dead-airs).
- Verify: click mic → allow mic → speak → words appear live; stop → transcript stays.

### Step 3 — Filler detection + highlighting
- Scan final transcript against list, wrap matches in `<mark>`, live total + per-word breakdown.
- Verify: say "um like you know" → 3+ highlights, count increments, legend updates.

### Step 4 — Live pace (WPM)
- Track session start time + word count, update WPM every 2s, zone pill color.
- Verify: speak steadily 30s → WPM reads ~plausible; silence → WPM decays/holds; pill changes color.

### Step 5 — Session history + scoring
- On Stop or Timer-end: compute date, duration, words, fillers, avg WPM, score; push to `localStorage key: pitchPilot.sessions.v1`; render list newest-first + Clear + Delete per row.
- Verify: do 2 short sessions → reload page → both persist; score shows 0–100.

### Step 6 — Polish for camera demo
- Responsive layout, focus states, empty states, footer hint "Chrome + mic required".
- Final pass: no console errors, works from `file://` double-click.
- Verify: full 1-min dry run on camera: start timer + mic, speak, show highlights/WPM/timer colors, stop, history entry appears.

## 9. Risks / assumptions

1. Web Speech API is Chrome-only and requires mic permission; on `file://` it generally works in Chrome but hosted `https`/`localhost` is more reliable. Mitigation: include fallback textarea.
2. Auto-stop at 0:00 + interim results can duplicate words — dedupe by only counting final results for stats.
3. WPM is noisy in first 10s — gate display until ≥10 words or ≥5s elapsed.
4. No backend means no sharing/export — out of scope unless you ask (could add JSON export later).

## 10. What I will NOT do until approval

- No `index.html`, `style.css`, `app.js` code.
- No npm, no APIs, no backend.

---

**Next:** Review this + `PRD.markdown`. Reply `approved` (plus any changes to filler list, WPM zones, score formula, single-file vs 3-file) and I will build Step 1 and show you how to check it.
