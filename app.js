// Pitch Pilot — plain JS, no backend, no APIs. Chrome Web Speech API + localStorage.
(function () {
  "use strict";

  var TIMER_TOTAL = 300; // 5 minutes
  var TARGET_WPM = 160;
  var STORE_KEY = "pitchPilot.sessions.v1";

  // Filler list (approved) + per-type color groups f-1..f-6
  var FILLERS = [
    { phrase: "you know", cls: "f-3" },
    { phrase: "i mean", cls: "f-4" },
    { phrase: "basically", cls: "f-5" },
    { phrase: "actually", cls: "f-5" },
    { phrase: "literally", cls: "f-5" },
    { phrase: "um", cls: "f-1" },
    { phrase: "uhm", cls: "f-1" },
    { phrase: "uh", cls: "f-1" },
    { phrase: "hmm", cls: "f-1" },
    { phrase: "like", cls: "f-2" },
    { phrase: "kinda", cls: "f-6" },
    { phrase: "sorta", cls: "f-6" },
    { phrase: "stuff", cls: "f-6" },
    { phrase: "well", cls: "f-6" },
    { phrase: "right", cls: "f-6" },
    { phrase: "so", cls: "f-6" }
  ];

  var $ = function (id) { return document.getElementById(id); };
  var micBtn = $("micBtn"), micLabel = $("micLabel"), sessionClock = $("sessionClock");
  var transcriptEl = $("transcript"), fillerTotalEl = $("fillerTotal"), fillerBreakdownEl = $("fillerBreakdown");
  var wordCountEl = $("wordCount"), wpmValue = $("wpmValue"), wpmPill = $("wpmPill"), wpmHint = $("wpmHint");
  var scorePreview = $("scorePreview"), timerDisplay = $("timerDisplay"), timerBox = $("timerBox"), timerFill = $("timerFill");
  var alertBanner = $("alertBanner"), errorBanner = $("errorBanner");
  var historyList = $("historyList");

  var recognition = null, listening = false, manualStop = false;
  var finalTranscript = "", interimTranscript = "";
  var listenStart = 0, paceTimer = null, clockTimer = null;
  var timerRemaining = TIMER_TOTAL, timerInterval = null, timerRunning = false;
  var warned60 = false, warned30 = false;
  var networkRetries = 0, restartTimeout = null;
  var MAX_NETWORK_RETRIES = 2;

  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;

  function esc(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function countWords(t) { var m = t.trim().match(/\S+/g); return m ? m.length : 0; }

  function fillerRegex() {
    var sorted = FILLERS.map(function (f) { return f.phrase; }).sort(function (a, b) { return b.length - a.length; });
    var pat = sorted.map(function (p) { return p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }).join("|");
    return new RegExp("\\b(" + pat + ")\\b", "gi");
  }
  var FILLER_RE = fillerRegex();

  function analyzeFillers(text) {
    var total = 0, per = {};
    text.replace(FILLER_RE, function (m) {
      var k = m.toLowerCase(); total++; per[k] = (per[k] || 0) + 1; return m;
    });
    return { total: total, per: per };
  }

  function highlight(text) {
    var safe = esc(text);
    var map = {};
    FILLERS.forEach(function (f) { map[f.phrase] = f.cls; });
    // re-run on escaped text is safe (fillers are plain letters/spaces)
    return safe.replace(FILLER_RE, function (m) {
      var cls = map[m.toLowerCase()] || "f-6";
      return "<mark class=\"" + cls + "\">" + m + "</mark>";
    });
  }

  function renderTranscript() {
    if (!finalTranscript && !interimTranscript) {
      transcriptEl.innerHTML = '<span class="placeholder">Your words will appear here as you speak…</span>';
      return;
    }
    transcriptEl.innerHTML = highlight(finalTranscript) +
      (interimTranscript ? ' <span class="interim">' + esc(interimTranscript) + "</span>" : "");
    transcriptEl.scrollTop = transcriptEl.scrollHeight;
  }

  function updateStats() {
    var all = (finalTranscript + " " + interimTranscript).trim();
    var words = countWords(finalTranscript);
    var fa = analyzeFillers(finalTranscript);
    fillerTotalEl.textContent = String(fa.total);
    wordCountEl.textContent = words + " words";
    // breakdown chips
    var keys = Object.keys(fa.per).sort(function (a, b) { return fa.per[b] - fa.per[a]; });
    if (!keys.length) { fillerBreakdownEl.innerHTML = '<span class="placeholder">No fillers yet.</span>'; }
    else {
      var colors = { "f-1": "#fbbf24", "f-2": "#a78bfa", "f-3": "#38bdf8", "f-4": "#f472b6", "f-5": "#34d399", "f-6": "#fb923c" };
      fillerBreakdownEl.innerHTML = keys.map(function (k) {
        var f = FILLERS.filter(function (x) { return x.phrase === k; })[0];
        var c = colors[f ? f.cls : "f-6"];
        return '<span class="chip"><span class="dot" style="background:' + c + '"></span>' + esc(k) + "<b>×" + fa.per[k] + "</b></span>";
      }).join("");
    }
    // live score preview
    var elapsed = listening && listenStart ? (Date.now() - listenStart) / 1000 : 0;
    if (words >= 1 && elapsed >= 1) {
      var wpm = Math.round(words / elapsed * 60);
      scorePreview.textContent = String(computeScore(words, fa.total, wpm, elapsed));
    } else if (words >= 1) { scorePreview.textContent = String(computeScore(words, fa.total, 0, 1)); }
    return { words: words, fillerTotal: fa.total };
  }

  function paceZone(wpm) {
    if (wpm >= 140 && wpm <= 180) return "green";
    if ((wpm >= 120 && wpm <= 139) || (wpm >= 181 && wpm <= 200)) return "yellow";
    return "red";
  }

  function updatePace() {
    if (!listening || !listenStart) return;
    var elapsed = (Date.now() - listenStart) / 1000;
    var all = (finalTranscript + " " + interimTranscript).trim();
    var words = countWords(all);
    if (elapsed < 5 || words < 10) { wpmValue.textContent = "—"; wpmPill.className = "pill idle"; wpmPill.textContent = "warming up"; wpmHint.textContent = "Keep speaking…"; return; }
    var wpm = Math.round(words / elapsed * 60);
    var zone = paceZone(wpm);
    wpmValue.textContent = String(wpm);
    wpmPill.className = "pill " + zone;
    wpmPill.textContent = zone === "green" ? "on pace" : zone === "yellow" ? "watch pace" : "off pace";
    wpmHint.textContent = zone === "green" ? "Nice — near 160 WPM target" : wpm < 140 ? "Too slow — pick up pace" : "Too fast — breathe & slow down";
  }

  function computeScore(words, fillers, avgWpm, durationSec) {
    if (words < 1) return 0;
    var rate = fillers / Math.max(words, 1);
    var fillerScore = Math.max(0, 40 - rate * 400);
    var paceScore = (avgWpm >= 140 && avgWpm <= 180) ? 30 : ((avgWpm >= 120 && avgWpm <= 200) ? 20 : 10);
    if (words < 10) paceScore = 0;
    var durationScore = Math.min(30, durationSec / 300 * 30);
    return Math.max(0, Math.min(100, Math.round(fillerScore + paceScore + durationScore)));
  }

  // ---- Speech ----
  function showError(msg) { errorBanner.textContent = msg; errorBanner.classList.remove("hidden"); }
  function hideError() { errorBanner.classList.add("hidden"); }
  function showAlert(msg, red) { alertBanner.textContent = msg; alertBanner.classList.remove("hidden"); alertBanner.classList.toggle("red", !!red); }
  function hideAlert() { alertBanner.classList.add("hidden"); }

  function beep(freq) {
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      var ctx = new Ctx(), o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = freq || 880; o.connect(g); g.connect(ctx.destination);
      o.start(); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4); o.stop(ctx.currentTime + 0.4);
    } catch (e) { /* silent */ }
  }

  function setupRecognition() {
    if (!SR) { $("fallbackPanel").classList.remove("hidden"); showError("Speech recognition not supported in this browser. Use Chrome, or practice with manual text below."); return false; }
    recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onstart = function () { networkRetries = 0; hideError(); };
    recognition.onresult = function (e) {
      interimTranscript = "";
      for (var i = e.resultIndex; i < e.results.length; i++) {
        var t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalTranscript += (finalTranscript ? " " : "") + t.trim();
        else interimTranscript += t;
      }
      networkRetries = 0; // success resets backoff
      renderTranscript(); updateStats(); updatePace();
    };
    recognition.onerror = function (e) {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        showError("Mic blocked — click the mic/lock icon in Chrome's address bar → Allow microphone → tap the mic button again.");
        failToIdle();
      } else if (e.error === "audio-capture") {
        showError("No microphone found — plug in / enable a mic in Windows Settings → Sound, then tap mic again.");
        failToIdle();
      } else if (e.error === "no-speech") { /* ignore, keep listening */ }
      else if (e.error === "network") { handleNetworkError(); }
      else if (e.error === "aborted") { /* user stopped, ignore */ }
      else showError("Mic error: " + e.error + " — tap mic to retry, or use manual text below.");
    };
    recognition.onend = function () {
      clearTimeout(restartTimeout);
      if (listening && !manualStop && timerRemaining > 0) {
        // delayed restart: immediate restart loops cause network errors in Chrome
        restartTimeout = setTimeout(function () {
          if (!listening || manualStop) return;
          try { recognition.start(); } catch (err) { /* will retry on next onend */ }
        }, 350);
      }
    };
    return true;
  }

  function isFileProtocol() { try { return window.location.protocol === "file:"; } catch (e) { return false; } }

  function handleNetworkError() {
    // Chrome's Speech API streams audio to Google — "network" = couldn't reach it,
    // even when mic permission was granted. NOT a code bug in most cases.
    networkRetries++;
    $("fallbackPanel").classList.remove("hidden");
    if (networkRetries <= MAX_NETWORK_RETRIES) {
      micLabel.textContent = "Network glitch — retrying (" + networkRetries + "/" + MAX_NETWORK_RETRIES + ")…";
      showError("Mic network error — retrying (" + networkRetries + "/" + MAX_NETWORK_RETRIES + "). Keep this tab online; don't VPN-block Google.");
      clearTimeout(restartTimeout);
      restartTimeout = setTimeout(function () {
        if (!listening || manualStop) return;
        try { recognition.start(); } catch (err) {}
      }, 1200);
    } else {
      var tips = "Mic network error: Chrome reached your mic but not Google's speech service. Fix: 1) check internet (no offline/VPN/firewall block), 2) ";
      tips += isFileProtocol()
        ? "you opened via file:// — serve over localhost instead: run `npx serve .` or `python -m http.server 8000` then open http://localhost:8000"
        : "reload with https or http://localhost";
      tips += ", 3) use Chrome (not Edge/Firefox), then tap mic again. You can keep practicing with manual text below meanwhile.";
      if (navigator && navigator.onLine === false) tips = "You appear offline — reconnect to the internet, then tap mic again. (Chrome sends mic audio to Google; offline always gives 'network' error.)";
      showError(tips);
      failToIdle();
    }
  }

  // Drop out of "listening" UI without saving an empty session, so the button isn't stuck pulsing.
  function failToIdle() {
    manualStop = true; listening = false;
    clearTimeout(restartTimeout); clearInterval(paceTimer); clearInterval(clockTimer);
    try { if (recognition) recognition.stop(); } catch (e) {}
    micBtn.classList.remove("listening"); micBtn.setAttribute("aria-pressed", "false");
    micLabel.textContent = "Mic stopped — fix above, then tap to retry";
    interimTranscript = ""; renderTranscript();
  }

  function startListening() {
    hideError();
    if (!recognition && !setupRecognition()) return;
    if (listening) return;
    // fresh session each tap after a saved stop
    if (finalTranscript && !listening) { /* keep until explicit? start new */ finalTranscript = ""; interimTranscript = ""; }
    manualStop = false; listening = true; listenStart = Date.now(); networkRetries = 0;
    clearTimeout(restartTimeout);
    renderTranscript(); updateStats();
    try { recognition.start(); } catch (e) { /* already started */ }
    micBtn.classList.add("listening"); micBtn.setAttribute("aria-pressed", "true");
    micLabel.textContent = "Listening… tap to stop & save";
    paceTimer = setInterval(updatePace, 2000);
    clockTimer = setInterval(function () {
      var s = Math.floor((Date.now() - listenStart) / 1000);
      sessionClock.textContent = fmt(s) + " speaking";
    }, 500);
  }

  function stopListening(reason) {
    if (!listening) return null;
    manualStop = true; listening = false;
    clearTimeout(restartTimeout);
    try { recognition.stop(); } catch (e) {}
    clearInterval(paceTimer); clearInterval(clockTimer);
    micBtn.classList.remove("listening"); micBtn.setAttribute("aria-pressed", "false");
    micLabel.textContent = "Ready — tap mic to start";
    interimTranscript = ""; renderTranscript();
    var durationSec = Math.max(1, Math.round((Date.now() - listenStart) / 1000));
    var words = countWords(finalTranscript);
    if (words < 1 && durationSec < 5) { sessionClock.textContent = "00:00 speaking"; return null; } // too short
    var fa = analyzeFillers(finalTranscript);
    var avgWpm = Math.round(words / durationSec * 60);
    var score = computeScore(words, fa.total, avgWpm, durationSec);
    var session = { id: "s" + Date.now(), dateISO: new Date().toISOString(), durationSec: durationSec, wordCount: words, fillerCount: fa.total, avgWpm: avgWpm, score: score };
    persist(session); renderHistory();
    var kept = finalTranscript;
    finalTranscript = ""; // reset for next session, keep visible copy below
    transcriptEl.innerHTML = highlight(kept) + '<div class="stat-sub" style="margin-top:8px">Saved ✓ — ' + words + " words, " + fa.total + " fillers, " + avgWpm + " WPM, score " + score + "/100" + (reason === "timer" ? " (timer ended)" : "") + "</div>";
    sessionClock.textContent = "00:00 speaking";
    wpmValue.textContent = "—"; wpmPill.className = "pill idle"; wpmPill.textContent = "idle"; wpmHint.textContent = "Tap mic and speak";
    fillerTotalEl.textContent = "0"; wordCountEl.textContent = "0 words"; scorePreview.textContent = "—";
    fillerBreakdownEl.innerHTML = '<span class="placeholder">No fillers yet.</span>';
    return session;
  }

  // ---- Timer ----
  function fmt(s) { var m = Math.floor(s / 60), r = s % 60; return (m < 10 ? "0" + m : "" + m) + ":" + (r < 10 ? "0" + r : "" + r); }
  function paintTimer() {
    timerDisplay.textContent = fmt(timerRemaining);
    timerFill.style.width = (timerRemaining / TIMER_TOTAL * 100) + "%";
    timerBox.classList.remove("green", "yellow", "red");
    if (timerRemaining <= 30) { timerBox.classList.add("red"); timerFill.style.background = "var(--red)"; }
    else if (timerRemaining <= 60) { timerBox.classList.add("yellow"); timerFill.style.background = "var(--yellow)"; }
    else { timerBox.classList.add("green"); timerFill.style.background = "var(--green)"; }
  }
  function timerTick() {
    timerRemaining = Math.max(0, timerRemaining - 1);
    paintTimer();
    if (timerRemaining === 60 && !warned60) { warned60 = true; showAlert("⏳ 1 minute left — land your key point."); beep(660); }
    if (timerRemaining === 30 && !warned30) { warned30 = true; showAlert("🔴 30 seconds left — wrap up!", true); beep(880); }
    if (timerRemaining <= 0) { pauseTimer(); stopListening("timer"); showAlert("⏰ Time! Session saved to history.", true); beep(440); }
  }
  function startTimer() { if (timerRunning || timerRemaining <= 0) return; timerRunning = true; timerInterval = setInterval(timerTick, 1000); }
  function pauseTimer() { timerRunning = false; clearInterval(timerInterval); }
  function resetTimer() { pauseTimer(); timerRemaining = TIMER_TOTAL; warned60 = warned30 = false; hideAlert(); paintTimer(); }

  // ---- History ----
  function loadAll() { try { return JSON.parse(localStorage.getItem(STORE_KEY)) || []; } catch (e) { return []; } }
  function persist(s) { var all = loadAll(); all.unshift(s); try { localStorage.setItem(STORE_KEY, JSON.stringify(all)); } catch (e) { showError("localStorage unavailable — session not saved."); } }
  function renderHistory() {
    var all = loadAll();
    if (!all.length) { historyList.innerHTML = '<p class="muted">No sessions yet — tap the mic and pitch for 30 seconds.</p>'; return; }
    historyList.innerHTML = "";
    all.forEach(function (s) {
      var d = document.createElement("div"); d.className = "session";
      var date = new Date(s.dateISO);
      d.innerHTML = '<div class="top"><strong>' + esc(date.toLocaleString()) + '</strong><span class="score">' + s.score + "/100</span></div>" +
        '<div class="meta">' + fmt(s.durationSec) + " • " + s.wordCount + " words • " + s.fillerCount + " fillers • " + s.avgWpm + ' WPM avg</div>';
      var btn = document.createElement("button"); btn.className = "del"; btn.textContent = "Delete";
      btn.onclick = function () {
        var rest = loadAll().filter(function (x) { return x.id !== s.id; });
        localStorage.setItem(STORE_KEY, JSON.stringify(rest)); renderHistory();
      };
      d.appendChild(btn); historyList.appendChild(d);
    });
  }

  // ---- Wire up ----
  micBtn.addEventListener("click", function () { listening ? stopListening("manual") : startListening(); });
  $("timerStart").addEventListener("click", startTimer);
  $("timerPause").addEventListener("click", pauseTimer);
  $("timerReset").addEventListener("click", resetTimer);
  $("clearHistory").addEventListener("click", function () { localStorage.removeItem(STORE_KEY); renderHistory(); });
  $("fallbackUse").addEventListener("click", function () {
    var v = $("fallbackText").value.trim(); if (!v) return;
    finalTranscript = v; listenStart = Date.now() - 30000; // assume ~30s typed pitch for pace preview
    renderTranscript(); updateStats(); updatePace();
    var fa = analyzeFillers(v), words = countWords(v);
    var score = computeScore(words, fa.total, Math.round(words / 30 * 60), 30);
    persist({ id: "s" + Date.now(), dateISO: new Date().toISOString(), durationSec: 30, wordCount: words, fillerCount: fa.total, avgWpm: Math.round(words / 30 * 60), score: score });
    renderHistory(); $("fallbackText").value = "";
  });

  paintTimer(); renderHistory(); renderTranscript();
})();
