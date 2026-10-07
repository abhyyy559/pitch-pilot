# Pitch Pilot — Product Requirements Document (PRD)

> Companion to `plan.markdown`. Plan mode only — no app code yet.

## 1. Overview

**Name:** Pitch Pilot
**Tagline:** A pitch practice coach for hackathon participants.
**Problem:** Hackathon pitches ramble, overuse fillers, and run over time. No lightweight tool to rehearse pace and delivery.
**Solution:** Single-page browser app: speak → live transcript → filler highlights + live WPM vs 160 target → 5-min countdown → scored session history in localStorage.

## 2. Users & goals

- Primary: hackathon participant rehearsing a 3–5 min pitch.
- Goals: stay near 160 WPM, cut fillers, finish on time, see score improve across sessions.
- Non-goals (v1): no accounts, no backend, no sharing, no AI feedback, no recording/playback.

## 3. Functional requirements

### FR1 — Mic + live transcript
- Big mic button toggles listening. States: idle / listening (pulsing) / error.
- Live transcript pane appends interim (grey) + final (white) text as user speaks.
- Must handle: permission denied, no mic, unsupported browser (show clear message + manual text fallback).
- Acceptance: in Chrome, click mic → speak 15s → words appear within ~1s lag.

### FR2 — Filler detection
- Detect list: um, uh, uhm, hmm, like, you know, i mean, basically, actually, literally, so, well, right, kinda, sorta, stuff (case-insensitive, phrase-aware).
- Transcript highlights each filler inline; dashboard shows total count + per-word breakdown with color legend.
- Acceptance: saying "um like you know" yields ≥3 highlights and total increments.

### FR3 — Pace (live WPM)
- Target 160 WPM. Update every 2s while listening.
- Zones: 140–180 green (on pace), 120–139 / 181–200 yellow, <120 / >200 red + hint text.
- Gate: show "—" until ≥5s elapsed or ≥10 words to avoid noisy early readings.
- Acceptance: steady speech shows plausible WPM; zone pill changes color correctly.

### FR4 — 5-minute countdown timer
- Display mm:ss. Controls: Start / Pause / Reset.
- Zones: green >1:00 left, yellow 1:00–0:31 + "1 minute left" alert, red 0:30–0:00 pulsing + "30 seconds left" alert.
- At 0:00: auto-stop mic, auto-save session.
- Independent of mic state.
- Acceptance: timer hits 1:00 → yellow + alert; 0:30 → red; 0:00 → stops + saves.

### FR5 — Session history + score
- On Stop or timer-end (if ≥1 word or ≥5s), save: `{ id, dateISO, durationSec, wordCount, fillerCount, avgWpm, score }` to `localStorage["pitchPilot.sessions.v1"]`.
- List newest-first: date, duration, words, fillers, avg WPM, score /100. Actions: delete per row, clear all.
- Score formula v1 (see plan.markdown §7): filler 40 + pace 30 + duration 30 = 100.
- Persists across reloads.
- Acceptance: 2 sessions → reload → both present with 0–100 scores.

### FR6 — Dark premium design (requirement, not nice-to-have)
- Clean dark theme, card layout, large mic button, readable transcript, responsive (laptop + projector).
- No broken layout at 1280×720 (demo resolution).
- Acceptance: looks polished on camera, all controls reachable without scroll on laptop.

## 4. Non-functional requirements

- NFR1: Zero setup — double-click `index.html` in Chrome works. No npm/build/API keys.
- NFR2: No backend, no network calls. All data in localStorage.
- NFR3: Chrome-first via Web Speech API; graceful message on Firefox/Safari.
- NFR4: No console errors on load or during happy-path session.
- NFR5: Plain HTML/CSS/JS, commented, hackathon-readable.

## 5. Edge cases

| Case | Handling |
|---|---|
| Mic denied | Error banner + enable manual textarea practice |
| Speech API unsupported | Banner + fallback mode |
| Silence (mic on, no speech) | WPM holds/gates, no crash, timer still runs |
| Very short session (<5s / 0 words) | Don't save; show "too short to save" hint |
| Timer ends while speaking | Auto-stop recognition, save session |
| localStorage full/disabled | Show warning, app still works for live session |
| Interim duplicate words | Stats computed from final results only |

## 6. Out of scope (v1)

- Audio recording, playback, export, cloud sync, auth, analytics, AI coaching tips, multi-language.

## 7. Open questions for you (answer with approval)

1. Filler list OK, or add/remove any?
2. WPM zones (140–180 green) OK?
3. Score formula OK?
4. 3 files (`index.html`/`style.css`/`app.js`) vs single `index.html`?
5. Per-filler-type colors vs single highlight color?

---

**Next:** Approve (with answers) → I build Step 1 (shell + theme + timer) and tell you how to check it. Still in plan mode.
