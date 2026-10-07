# Pitch Pilot — Hackathon Pitch Practice Coach

Speak into your mic, get a live transcript with filler-word highlights, live pace (WPM) vs a 160 WPM target, a 5-minute countdown timer, and a scored session history — all in one page, no backend.

## Features

1. **Big mic button** — start/stop listening, live transcript (interim in grey, final in white).
2. **Filler detection** — highlights `um, uh, uhm, hmm, like, you know, i mean, basically, actually, literally, so, well, right, kinda, sorta, stuff` in per-type colors, with total count + per-word breakdown.
3. **Live pace** — words-per-minute updated every 2s. Zones: 140–180 green (on pace), 120–139 / 181–200 yellow, otherwise red + hint.
4. **5-minute timer** — Start / Pause / Reset. Green > 1:00 left, yellow at 1:00 + “1 minute left” alert, red pulsing at 0:30 + “30 seconds left” alert. Auto-stops mic and saves at 0:00.
5. **Session history + score /100** — date, duration, word count, filler count, avg pace, score saved to `localStorage` (`pitchPilot.sessions.v1`), newest-first, with delete/clear. Persists across reloads.
6. **Dark premium UI** — camera-ready, responsive down to laptop/projector widths.

Score = filler (40) + pace (30) + duration (30). Zero fillers ≈ 40 pts; 10%+ filler rate ≈ 0. On-pace (140–180 WPM) = 30 pts; full 5 min = 30 pts.

## Quick start (Chrome, zero setup)

```text
1. Open index.html in Google Chrome (double-click works).
   More reliable for the mic: npx serve .  →  http://localhost:8000
2. Click the mic button → Allow microphone.
3. (Optional) Start the 5:00 timer. Speak your pitch.
4. Watch transcript highlights, WPM pill, and timer colors.
5. Tap mic again (or hit 0:00) to stop & auto-save to history.
```

## File structure

```text
index.html    – app shell & layout
style.css     – dark premium theme
app.js        – mic/transcript, fillers, pace, timer, history (plain JS, no modules)
plan.markdown – build plan
PRD.markdown  – product requirements
```

No npm, no build, no APIs, no backend. Plain `<script>` (not modules) so `file://` double-click works.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Mic network error` after Allow | Chrome reaches the mic but not Google’s speech service (the Web Speech API streams online). Check internet, disable VPN/firewall blocks, reload, tap mic again. App auto-retries 2×, then shows manual-text fallback. |
| `Mic blocked` | Click lock/mic icon in Chrome address bar → Allow → tap mic again. |
| `No microphone found` | Plug in/enable mic in Windows Settings → Sound, then retry. |
| Not Chrome / API unsupported | Use Chrome; or practice via Manual practice box (fillers, pace, saving all work). |
| Speech stops mid-pitch | Chrome pauses on long silence — app auto-restarts; just keep speaking. |
| Best reliability | Serve over localhost (`python -m http.server 8000` or `npx serve .`) instead of `file://`. |

## Privacy

Mic audio goes to your browser’s speech service for transcription; pitch text, stats, and history stay in your browser’s `localStorage`. Nothing is uploaded anywhere by this app.
