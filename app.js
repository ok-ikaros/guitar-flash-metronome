/* global ChordEngine */
(function () {
  'use strict';

  const CE = ChordEngine;
  const $ = (id) => document.getElementById(id);
  const STORAGE_KEY = 'guitar-flash-metronome.settings.v1';

  // ------------------------------------------------------------------ settings
  const defaults = {
    v: 2,                    // settings version, for migrations
    bpm: 80,
    beats: 4,
    changeEvery: 1,
    countIn: 1,              // measures of count-in before the first card
    mode: 'name',            // 'name' | 'find'
    accidentals: 'sharps',   // 'sharps' | 'flats' | 'mixed'
    forms: { C: true, A: false, G: false, E: false, D: false },
    maxPosition: 12,
    autoReveal: true,
    accent: true,
    sound: true,
    volume: 0.6,
    flash: true,
    wake: true,
    settingsOpen: true,
  };
  let S = loadSettings();

  function loadSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return structuredClone(defaults);
      const saved = JSON.parse(raw);
      // v1 defaulted to a 2-measure card because the reveal took a whole
      // measure; the reveal is now on the last beat, so one measure is enough.
      if (!saved.v && saved.changeEvery === 2) saved.changeEvery = 1;
      return { ...structuredClone(defaults), ...saved, forms: { ...defaults.forms, ...(saved.forms || {}) }, v: defaults.v };
    } catch {
      return structuredClone(defaults);
    }
  }
  function saveSettings() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(S)); } catch { /* private mode etc. */ }
  }
  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

  // ----------------------------------------------------------------- metronome
  // Web Audio lookahead scheduler: audio is scheduled slightly ahead of time on
  // the audio clock, visuals are fired from requestAnimationFrame when the audio
  // clock reaches each beat. This keeps the click rock steady even when the UI
  // thread hiccups.
  class Metronome {
    constructor(onBeat) {
      this.onBeat = onBeat;
      this.ctx = null;
      this.running = false;
      this.lookahead = 25;        // ms between scheduler ticks
      this.scheduleAhead = 0.12;  // seconds of audio to schedule ahead
      this.queue = [];            // beats scheduled but not yet shown
      this.timer = null;
      this.raf = null;
    }

    ensureContext() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AC();
        this.gain = this.ctx.createGain();
        this.gain.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    }

    start(skipCountIn) {
      if (this.running) return;
      this.ensureContext();
      this.running = true;
      this.beat = 0;            // 0-based beat within the measure
      this.measure = skipCountIn ? S.countIn : 0; // measures < countIn are the count-in
      this.nextTime = this.ctx.currentTime + 0.08;
      this.queue = [];
      this.tick();
      this.draw();
    }

    stop() {
      if (!this.running) return;
      this.running = false;
      clearTimeout(this.timer);
      cancelAnimationFrame(this.raf);
      this.queue = [];
    }

    click(time, accent) {
      if (!S.sound) return;
      const osc = this.ctx.createOscillator();
      const env = this.ctx.createGain();
      osc.frequency.value = accent ? 1320 : 880;
      osc.type = 'square';
      env.gain.setValueAtTime(0.0001, time);
      env.gain.exponentialRampToValueAtTime(S.volume * (accent ? 1 : 0.7) + 0.0001, time + 0.002);
      env.gain.exponentialRampToValueAtTime(0.0001, time + (accent ? 0.06 : 0.04));
      osc.connect(env).connect(this.gain);
      osc.start(time);
      osc.stop(time + 0.08);
    }

    tick() {
      if (!this.running) return;
      while (this.nextTime < this.ctx.currentTime + this.scheduleAhead) {
        const accent = S.accent && this.beat === 0 && S.beats > 1;
        this.click(this.nextTime, accent);
        this.queue.push({ time: this.nextTime, beat: this.beat, measure: this.measure });
        this.nextTime += 60 / S.bpm;
        this.beat += 1;
        if (this.beat >= S.beats) { this.beat = 0; this.measure += 1; }
      }
      this.timer = setTimeout(() => this.tick(), this.lookahead);
    }

    draw() {
      if (!this.running) return;
      const now = this.ctx.currentTime;
      while (this.queue.length && this.queue[0].time <= now) {
        this.onBeat(this.queue.shift());
      }
      this.raf = requestAnimationFrame(() => this.draw());
    }
  }

  // ---------------------------------------------------------------- flash card
  let card = null;        // current card
  let queued = null;      // the card after this one, shown as "next up"
  let history = [];       // cards already dealt, most recent last
  let forward = [];       // "next" previews set aside by Back, restored on the way forward
  let revealed = false;
  let holdCard = false;   // restart the cycle without dealing (after Back)
  const HISTORY_MAX = 20;

  function enabledForms() {
    const list = CE.FORM_ORDER.filter((f) => S.forms[f]);
    return list.length ? list : CE.FORM_ORDER.slice();
  }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function makeCard(prev) {
    const forms = enabledForms();
    let next;
    for (let tries = 0; tries < 20; tries++) {
      const form = pick(forms);
      const position = Math.floor(Math.random() * (S.maxPosition + 1));
      const acc = S.accidentals === 'mixed' ? pick(['sharps', 'flats']) : S.accidentals;
      next = { form, position, acc, name: CE.chordName(form, position, acc) };
      if (!prev) break;
      if (S.mode === 'name' && (next.form !== prev.form || next.position !== prev.position)) break;
      if (S.mode === 'find' && (next.form !== prev.form || next.name !== prev.name)) break;
    }
    next.positions = CE.positionsFor(next.form, next.name, S.maxPosition);
    return next;
  }

  /** The upcoming card, generated once and kept until it is dealt. */
  function upcoming() {
    if (!queued) queued = makeCard(card);
    return queued;
  }

  function newCard() {
    if (card) {
      history.push(card);
      if (history.length > HISTORY_MAX) history.shift();
    }
    card = upcoming();
    queued = forward.length ? forward.pop() : makeCard(card);
    revealed = false;
    renderCard();
  }

  /** Go back to the previous card; the one we leave becomes "next" again. */
  function back() {
    if (!history.length) return;
    forward.push(queued);
    queued = card;
    card = history.pop();
    revealed = false;
    if (metro.running) { holdCard = true; restartCycle(); }
    renderCard();
  }

  function reveal() {
    if (!card || revealed) return;
    revealed = true;
    renderCard();
  }

  /** Question side of a card, as text, with no answer in it. */
  function questionText(c) {
    return S.mode === 'name'
      ? `${c.form} Form ${CE.positionLabel(c.position)}`
      : `${c.name} Chord, ${c.form} Form`;
  }

  /** Answer side of a card, as text. */
  function answerText(c) {
    return S.mode === 'name'
      ? `${c.name} Chord`
      : c.positions.map(CE.positionLabel).join(' or ');
  }

  function renderPrev() {
    const c = history[history.length - 1];
    const el = $('prevUp');
    $('backBtn').disabled = !c;
    if (!c) { el.hidden = true; return; }
    el.hidden = false;
    $('prevText').innerHTML = `${questionText(c)} <b>${answerText(c)}</b>`;
    $('prevDiagram').innerHTML = renderDiagram(c.form, c.position, { showPosition: true, compact: true });
  }

  function renderNextUp(c) {
    const el = $('nextUp');
    if (!c) { el.hidden = true; return; }
    el.hidden = false;
    $('nextText').textContent = questionText(c);
    $('nextDiagram').innerHTML = renderDiagram(c.form, c.position, { showPosition: S.mode === 'name', compact: true });
  }

  function renderCountIn(beat) {
    const next = upcoming();
    $('modeTag').textContent = 'Count-in';
    $('measureTag').textContent = 'Get ready';
    $('prompt').innerHTML = `${beat + 1}<small>${S.mode === 'name' ? 'Name the chord' : 'Find the position'}</small>`;
    $('answer').className = 'answer hidden';
    $('diagram').innerHTML = '';
    $('revealBtn').disabled = true;
    $('nextBtn').disabled = true;
    renderPrev();
    renderNextUp(next);
  }

  function renderCard() {
    const prompt = $('prompt');
    const answer = $('answer');
    const diagram = $('diagram');
    $('modeTag').textContent = S.mode === 'name' ? 'Name the chord' : 'Find the position';

    if (!card) {
      prompt.textContent = 'Press Start';
      answer.className = 'answer hidden';
      diagram.innerHTML = '';
      $('revealBtn').disabled = true;
      $('nextBtn').disabled = true;
      renderPrev();
      renderNextUp(null);
      return;
    }
    $('nextBtn').disabled = false;
    $('revealBtn').disabled = revealed;
    renderPrev();
    renderNextUp(queued);

    if (S.mode === 'name') {
      // Question: the form and the position. Answer: the chord name.
      prompt.innerHTML = `${card.form} Form <small>${CE.positionLabel(card.position)}</small>`;
      diagram.innerHTML = renderDiagram(card.form, card.position, { showPosition: true });
      if (revealed) {
        answer.className = 'answer';
        answer.innerHTML = `${card.name} Chord`;
      } else {
        answer.className = 'answer placeholder';
        answer.textContent = 'Which chord is this?';
      }
    } else {
      // Question: the chord name and the form. Answer: the position.
      prompt.innerHTML = `${card.name} Chord <small>${card.form} Form</small>`;
      diagram.innerHTML = renderDiagram(card.form, card.position, { showPosition: revealed });
      if (revealed) {
        const labels = card.positions.map(CE.positionLabel);
        answer.className = 'answer';
        answer.innerHTML = labels.join('<small>or</small>');
      } else {
        answer.className = 'answer placeholder';
        answer.textContent = 'Where do you bar it?';
      }
    }
  }

  // ------------------------------------------------------------- fret diagram
  // 6 strings, low E on the left. 5 frets shown. Position 0 draws the nut and
  // open-string circles, like the "A Form Open" diagram in the chapter; any
  // other position draws the bar with the position number beside it.
  function renderDiagram(form, position, { showPosition, compact = false }) {
    const shape = CE.FORMS[form];
    const W = 160, H = 200;
    const x0 = 32, dx = 20;           // string spacing
    const yTop = 42, dy = 30, rows = 5;
    const yBottom = yTop + dy * rows;
    // With the position hidden, always draw the movable (barred) shape so an
    // open-position card does not give itself away by showing the nut.
    const barred = position > 0 || !showPosition;
    const sx = (i) => x0 + i * dx;
    const rowY = (r) => yTop + (r - 0.5) * dy; // r = 1..rows

    let s = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${CE.formLabel(form, position)}">`;
    s += `<style>
      .st{stroke:var(--muted);stroke-width:1.2}
      .fr{stroke:var(--line);stroke-width:1.2}
      .nut{stroke:var(--text);stroke-width:5;stroke-linecap:round}
      .bar{fill:var(--text)}
      .dot{fill:var(--accent)}
      .num{fill:var(--accent-ink);font:700 11px system-ui,sans-serif;text-anchor:middle;dominant-baseline:central}
      .mark{fill:var(--muted);font:600 12px system-ui,sans-serif;text-anchor:middle;dominant-baseline:central}
      .open{fill:none;stroke:var(--muted);stroke-width:1.5}
      .pos{fill:var(--text);font:700 15px system-ui,sans-serif;text-anchor:end;dominant-baseline:central}
      .pos.q{fill:var(--accent)}
    </style>`;

    // frets
    for (let r = 0; r <= rows; r++) {
      const y = yTop + r * dy;
      s += `<line class="${r === 0 && !barred ? 'nut' : 'fr'}" x1="${sx(0)}" y1="${y}" x2="${sx(5)}" y2="${y}"/>`;
    }
    // strings
    for (let i = 0; i < 6; i++) {
      s += `<line class="st" x1="${sx(i)}" y1="${yTop}" x2="${sx(i)}" y2="${yBottom}"/>`;
    }
    // bar + position number
    if (barred) {
      const lo = shape.frets.findIndex((f) => f !== 'x');
      s += `<rect class="bar" x="${sx(lo) - 8}" y="${rowY(1) - 6}" width="${sx(5) - sx(lo) + 16}" height="12" rx="6"/>`;
      s += `<text class="pos${showPosition ? '' : ' q'}" x="${x0 - 12}" y="${rowY(1)}">${showPosition ? position : '?'}</text>`;
    }
    // string markers and finger dots
    shape.frets.forEach((fret, i) => {
      const x = sx(i);
      if (fret === 'x') {
        s += `<text class="mark" x="${x}" y="${yTop - 14}">×</text>`;
        return;
      }
      if (fret === 0) {
        if (!barred) s += `<circle class="open" cx="${x}" cy="${yTop - 14}" r="5"/>`;
        return;
      }
      const r = barred ? fret + 1 : fret;
      s += `<circle class="dot" cx="${x}" cy="${rowY(r)}" r="${compact ? 7 : 9}"/>`;
      if (!compact) s += `<text class="num" x="${x}" y="${rowY(r)}">${shape.fingers[i]}</text>`;
    });
    s += '</svg>';
    return s;
  }

  // --------------------------------------------------------------- beat view
  function renderBeatDots(active) {
    const el = $('beatDots');
    if (el.childElementCount !== S.beats) {
      el.innerHTML = '';
      for (let i = 0; i < S.beats; i++) {
        const d = document.createElement('span');
        if (i === 0) d.className = 'first';
        el.appendChild(d);
      }
    }
    [...el.children].forEach((d, i) => d.classList.toggle('on', i === active));
  }

  function flash(accent) {
    if (!S.flash) return;
    const el = $('card');
    el.animate(
      [{ boxShadow: `inset 0 0 0 ${accent ? 6 : 3}px var(--accent)`, offset: 0 },
       { boxShadow: 'inset 0 0 0 0px transparent', offset: 1 }],
      { duration: accent ? 180 : 110, easing: 'ease-out' },
    );
    // Also flash the background layer (::after) by toggling a class briefly.
    el.style.setProperty('--flash-opacity', accent ? 0.22 : 0.1);
    el.classList.add('is-flash');
    setTimeout(() => el.classList.remove('is-flash'), accent ? 90 : 60);
  }

  // ----------------------------------------------------------- beat handling
  function onBeat({ beat, measure }) {
    const isFirst = beat === 0;
    if (measure < S.countIn) {
      renderCountIn(beat);
      renderBeatDots(beat);
      flash(isFirst && S.accent && S.beats > 1);
      return;
    }
    const cycle = Math.max(1, S.changeEvery);
    const inCycle = (measure - S.countIn) % cycle;   // 0 .. cycle-1

    if (isFirst && inCycle === 0) {
      if (holdCard) holdCard = false;   // Back already put the card up
      else newCard();
    }

    // Reveal on the last beat of the card's last measure.
    if (S.autoReveal && !revealed && inCycle === cycle - 1 && beat === S.beats - 1
        && !(cycle === 1 && S.beats === 1)) {
      reveal();
    }

    $('measureTag').textContent = `Measure ${inCycle + 1} / ${cycle}`;
    renderBeatDots(beat);
    flash(isFirst && S.accent && S.beats > 1);
  }

  const metro = new Metronome(onBeat);

  // ----------------------------------------------------------- wake lock
  let wakeLock = null;
  async function acquireWake() {
    if (!S.wake || !('wakeLock' in navigator)) return;
    try { wakeLock = await navigator.wakeLock.request('screen'); } catch { /* denied */ }
  }
  function releaseWake() {
    if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && metro.running) acquireWake();
  });

  // ----------------------------------------------------------- transport
  function start() {
    holdCard = false;
    metro.start();
    $('startBtn').textContent = 'Pause';
    $('startBtn').classList.remove('primary');
    acquireWake();
  }
  function pause() {
    metro.stop();
    $('startBtn').textContent = card ? 'Resume' : 'Start';
    $('startBtn').classList.add('primary');
    renderBeatDots(-1);
    releaseWake();
  }
  function toggle() { metro.running ? pause() : start(); }

  function restartCycle() {
    // Called when settings change the rhythm; keeps playing but restarts the
    // measure count so the card cycle stays in sync.
    if (metro.running) { metro.stop(); metro.start(true); }
  }
  function nextCard(discardQueued) {
    if (discardQueued) { queued = null; forward = []; }   // settings changed: previews no longer apply
    holdCard = false;
    // While running, the restarted cycle deals the card on its first beat.
    if (metro.running) restartCycle(); else newCard();
  }

  // ----------------------------------------------------------- bindings
  function setBpm(v, fromSlider) {
    S.bpm = clamp(Math.round(Number(v) || S.bpm), 30, 240);
    $('bpmInput').value = S.bpm;
    if (!fromSlider) $('bpmSlider').value = S.bpm;
    saveSettings();
  }

  $('startBtn').addEventListener('click', toggle);
  $('revealBtn').addEventListener('click', reveal);
  $('nextBtn').addEventListener('click', () => nextCard(false));
  $('backBtn').addEventListener('click', back);

  $('bpmInput').addEventListener('change', (e) => setBpm(e.target.value));
  $('bpmSlider').addEventListener('input', (e) => setBpm(e.target.value, true));
  $('bpmDown').addEventListener('click', () => setBpm(S.bpm - 1));
  $('bpmUp').addEventListener('click', () => setBpm(S.bpm + 1));

  // tap tempo: average of the last taps within a 2.5 s window
  let taps = [];
  $('tapBtn').addEventListener('click', () => {
    const now = performance.now();
    taps = taps.filter((t) => now - t < 2500);
    taps.push(now);
    if (taps.length >= 2) {
      const intervals = taps.slice(1).map((t, i) => t - taps[i]);
      const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      setBpm(60000 / avg);
    }
  });

  document.querySelectorAll('input[name=mode]').forEach((r) => {
    r.checked = r.value === S.mode;
    r.addEventListener('change', () => {
      S.mode = r.value; saveSettings(); updateModeHint();
      if (card) nextCard(true);
      renderCard();
    });
  });
  function updateModeHint() {
    $('modeHint').textContent = S.mode === 'name'
      ? 'You see the form and the bar position. Say the chord name out loud; the answer appears on the last beat.'
      : 'You see the chord name and the form. Bar it where it belongs; the fret number is hidden until the reveal.';
  }

  function bindNumber(id, key, lo, hi, after) {
    const el = $(id);
    el.value = S[key];
    el.addEventListener('change', () => {
      const n = parseInt(el.value, 10);
      S[key] = clamp(Number.isNaN(n) ? defaults[key] : n, lo, hi);
      el.value = S[key];
      saveSettings();
      if (after) after();
    });
  }
  bindNumber('beatsInput', 'beats', 1, 12, () => { renderBeatDots(-1); restartCycle(); });
  bindNumber('changeEveryInput', 'changeEvery', 1, 16, restartCycle);
  bindNumber('countInInput', 'countIn', 0, 4);
  bindNumber('maxPosInput', 'maxPosition', 1, 15, () => { if (card) nextCard(true); });

  function bindCheck(id, key, after) {
    const el = $(id);
    el.checked = !!S[key];
    el.addEventListener('change', () => { S[key] = el.checked; saveSettings(); if (after) after(); });
  }
  bindCheck('autoRevealInput', 'autoReveal');
  bindCheck('accentInput', 'accent');
  bindCheck('soundInput', 'sound');
  bindCheck('flashInput', 'flash');
  bindCheck('wakeInput', 'wake', () => { metro.running && S.wake ? acquireWake() : releaseWake(); });

  $('volumeInput').value = S.volume;
  $('volumeInput').addEventListener('input', (e) => { S.volume = Number(e.target.value); saveSettings(); });

  $('accidentalsInput').value = S.accidentals;
  $('accidentalsInput').addEventListener('change', (e) => {
    S.accidentals = e.target.value; saveSettings();
    if (card) nextCard(true);
  });

  document.querySelectorAll('input[name=form]').forEach((cb) => {
    cb.checked = !!S.forms[cb.value];
    cb.addEventListener('change', () => {
      S.forms[cb.value] = cb.checked;
      if (!Object.values(S.forms).some(Boolean)) { S.forms[cb.value] = true; cb.checked = true; }
      saveSettings();
      if (card) nextCard(true);
    });
  });

  $('settingsToggle').addEventListener('click', () => {
    S.settingsOpen = !S.settingsOpen; saveSettings(); applySettingsOpen();
  });
  function applySettingsOpen() {
    $('settings').classList.toggle('collapsed', !S.settingsOpen);
    $('settingsToggle').setAttribute('aria-expanded', String(S.settingsOpen));
  }

  document.addEventListener('keydown', (e) => {
    const tag = (e.target.tagName || '').toLowerCase();
    const typing = tag === 'input' && e.target.type !== 'checkbox' && e.target.type !== 'radio' && e.target.type !== 'range';
    if (typing || tag === 'select') return;
    if (e.code === 'Space') { e.preventDefault(); toggle(); }
    else if (e.key === 'r' || e.key === 'R') reveal();
    else if (e.key === 'n' || e.key === 'N') { if (card) nextCard(); }
    else if (e.key === 'b' || e.key === 'B' || e.key === 'ArrowLeft') back();
    else if (e.key === 'ArrowUp') { e.preventDefault(); setBpm(S.bpm + (e.shiftKey ? 5 : 1)); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setBpm(S.bpm - (e.shiftKey ? 5 : 1)); }
  });

  // ----------------------------------------------------------- init
  setBpm(S.bpm);
  updateModeHint();
  applySettingsOpen();
  renderBeatDots(-1);
  renderCard();
})();
