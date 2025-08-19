// --- Shadow Alley – ASCII Level + Light Cones ---
const cv = document.getElementById("game");
const ctx = cv.getContext("2d");
const W = cv.width,
  H = cv.height;

// Grid / Tiles
const TILE = 16,
  COLS = Math.floor(W / TILE),
  ROWS = Math.floor(H / TILE);

let levelIndex = 0;

// Level selection UI (only unlocked selectable)
const levelSelect = document.getElementById("levelSelect");

function refreshLevelSelect() {
  if (!levelSelect) return;
  levelSelect.innerHTML = "";
  for (let i = 0; i < LEVELS.length; i++) {
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = `Level ${i + 1}`;
    if (i > progress.unlocked) opt.disabled = true; // nur freigeschaltet wählbar
    if (i === levelIndex) opt.selected = true;
    levelSelect.appendChild(opt);
  }
}

if (levelSelect) {
  levelSelect.addEventListener("change", () => {
    const idx = parseInt(levelSelect.value, 10);
    if (!Number.isNaN(idx) && idx <= progress.unlocked) {
      levelIndex = idx;
      progress.current = idx;
      saveProgress();
      parseLevel(LEVELS[levelIndex]);
      doorWasOpen = false;
      winSfxPlayed = false;
      gameOver = false;
      youWin = false;
      winAdvanceAt = null;
      refreshLevelSelect();
    } else {
      // falls jemand trickst
      refreshLevelSelect();
    }
  });
}

// --- Persistent Progress (localStorage) ---
const LS_KEY = "js13k_shadowalley_v1";
let progress = { current: 0, unlocked: 0 }; // indices (0-based)

function clampi(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v | 0));
}

function loadProgress() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (typeof p === "object" && p)
        progress = { current: p.current | 0, unlocked: p.unlocked | 0 };
    }
  } catch (_) {}
  // clamp against current LEVELS length
  const last = LEVELS.length - 1;
  progress.unlocked = clampi(progress.unlocked, 0, last);
  progress.current = clampi(progress.current, 0, progress.unlocked);
}
function saveProgress() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(progress));
  } catch (_) {}
}
function unlockNext() {
  const last = LEVELS.length - 1;
  const target = Math.min(levelIndex + 1, last);
  if (progress.unlocked < target) {
    progress.unlocked = target;
    saveProgress();
  }
}

let walls = [],
  shadows = [],
  lamps = [],
  guards = [],
  fishes = [],
  exit = { x: W - 32, y: 16, w: TILE, h: TILE };
const player = {
  x: 64,
  y: H - 64,
  r: 6,
  speed: 1.7,
  vx: 0,
  vy: 0,
  dir: "R",
  step: 0,
  state: "idle",
  idle: 0,
  blink: 1, // 1=open, 0=closed
  blinkTimer: 2.0, // time until next change (s)
  fpTimer: 0.0, // footprint spawn timer (s)
  pawParity: 0, // alternate left/right footprints
  db: 0, // double-blink pending flag
};
const footprints = []; // {x,y,life}
const rain = []; // {x,y,vx,vy,len}
const splashes = []; // {x,y,life}
// Soft drifting fog blobs (fake Perlin via overlapping gradients)
const fog = [
  { x: 80, y: 60, dx: 6e-2, dy: 2e-2, r: 90, a: 0.12 },
  { x: 240, y: 140, dx: -4e-2, dy: 3e-2, r: 120, a: 0.1 },
  { x: 380, y: 220, dx: 3e-2, dy: -5e-2, r: 100, a: 0.09 },
];
let rainSpawn = 0;
const bubbles = []; // {x,y,vy,life}
let toCollect = 0,
  got = 0,
  gameOver = false,
  youWin = false;

function parseLevel(str) {
  walls.length =
    shadows.length =
    lamps.length =
    guards.length =
    fishes.length =
      0;
  got = 0;
  youWin = false;
  gameOver = false;
  const rows = str.split("\n");
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x],
        px = x * TILE,
        py = y * TILE;
      if (ch == "#") walls.push({ x: px, y: py, w: TILE, h: TILE });
      else if (ch == "s")
        shadows.push({
          x: px,
          y: py,
          w: TILE,
          h: TILE,
          glowIntensity: 0,
        });
      else if (ch == "l")
        lamps.push({
          x: px + TILE / 2,
          y: py + TILE / 2,
          range: 120,
          fov: Math.PI / 3,
          angle: 0,
          offX: 10, // lamp head offset (must match drawLamp)
          offY: -11,
        });
      else if (ch == "L") {
        const GUARD_COLORS = ["#cc4455", "#4aa3ff", "#7bd389", "#f2b134"];
        const accent =
          GUARD_COLORS[Math.floor(Math.random() * GUARD_COLORS.length)];
        guards.push({
          x: px + TILE / 2,
          y: py + TILE / 2,
          range: 160,
          fov: Math.PI / 2,
          angle: 0,
          dir: 1,
          sweep: 0.9,
          accent: accent,
        });
      } else if (ch == "f") {
        fishes.push({
          x: px + TILE / 2,
          y: py + TILE / 2,
          t: true,
          dir: Math.random() < 0.5 ? 0 : Math.PI,
          p: Math.random() * 6.28,
          anim: 0,
          cycle: 1.5 + Math.random() * 3.0,
        });
      } else if (ch == "x") {
        exit = { x: px, y: py, w: TILE, h: TILE };
      } else if (ch == "c") {
        player.x = px + TILE / 2;
        player.y = py + TILE / 2;
      }
    }
  });
  toCollect = fishes.length;
}

// Load progress and start at last played level
loadProgress();
levelIndex = clampi(
  progress.current,
  0,
  Math.max(0, Math.min(progress.unlocked, LEVELS.length - 1))
);
parseLevel(LEVELS[levelIndex]);
refreshLevelSelect();

// Input
const keys = Object.create(null);
addEventListener("keydown", (e) => {
  keys[e.key] = true;
  if (!started) ensureAudio();
  if (e.key === "m" || e.key === "M") setMuted(!muted);
  if (e.key === "r" || e.key === "R") reset();
  if ((e.key === "n" || e.key === "N") && youWin) nextLevel();
});
addEventListener("keyup", (e) => (keys[e.key] = false));

function reset() {
  parseLevel(LEVELS[levelIndex]);
  doorWasOpen = false;
  winSfxPlayed = false;
  player.vx = player.vy = 0;
  // Persist staying on current level
  progress.current = levelIndex;
  saveProgress();
  refreshLevelSelect();
}

let winAdvanceAt = null; // time (seconds) when we jump to next level

function nextLevel() {
  // Unlock next level when this one is completed
  unlockNext();
  const last = LEVELS.length - 1;
  if (levelIndex < last) {
    levelIndex = Math.min(progress.unlocked, last);
  } else {
    // already at last level: stay, no wrap
    levelIndex = last;
  }
  progress.current = levelIndex;
  saveProgress();
  parseLevel(LEVELS[levelIndex]);
  doorWasOpen = false;
  winSfxPlayed = false;
  gameOver = false;
  youWin = false;
  winAdvanceAt = null;
  refreshLevelSelect();
}

// Helpers
function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}
function inRect(px, py, r) {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}
function anyRectHit(cx, cy, r) {
  for (let i = 0; i < r.length; i++) {
    const t = r[i];
    if (inRect(cx, cy, t)) return true;
  }
  return false;
}
function inAnyShadow(px, py) {
  return anyRectHit(px, py, shadows);
}

function pointInCone(px, py, cx, cy, ang, fov, range) {
  const dx = px - cx,
    dy = py - cy,
    dist = Math.hypot(dx, dy);
  if (dist > range) return false;
  const a = Math.atan2(dy, dx);
  const d = Math.atan2(Math.sin(a - ang), Math.cos(a - ang));
  return Math.abs(d) <= fov * 0.5;
}

function inAnyLight(px, py) {
  for (const l of lamps)
    if (
      pointInCone(
        px,
        py,
        l.x + (l.offX || 0),
        l.y + (l.offY || 0),
        0,
        l.fov,
        l.range
      )
    )
      return true;
  for (const g of guards)
    if (pointInCone(px, py, g.x, g.y, g.angle, g.fov, g.range)) return true;
  return false;
}

// Main loop
let last = performance.now();
let time = 0;
let doorWasOpen = false;
let winSfxPlayed = false;
function loop(t) {
  const dt = (t - last) / 1000;
  last = t;
  time += dt;
  update(dt);
  render();
  requestAnimationFrame(loop);
}

// --- Audio (tiny WebAudio SFX) ---
let AC = null,
  master = null,
  started = false,
  muted = false;
let rainBus = null,
  lfo = null,
  lfoGain = null,
  panLFO = null,
  panGain = null,
  panner = null;
let melOsc = null,
  melEnv = null,
  melBus = null,
  melTimer = null,
  melLast = 0;
let lastStepAt = 0; // footstep rate limiter (seconds in AudioContext time)
const sfx = {
  collect() {
    if (!AC) return;
    const t = AC.currentTime;
    const g = AC.createGain();
    g.gain.setValueAtTime(0.0, t);
    g.gain.linearRampToValueAtTime(0.25, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    const o1 = AC.createOscillator();
    o1.type = "sine";
    o1.frequency.setValueAtTime(880, t);
    o1.frequency.exponentialRampToValueAtTime(1320, t + 0.12);
    const o2 = AC.createOscillator();
    o2.type = "sine";
    o2.frequency.setValueAtTime(660, t + 0.02);
    o2.frequency.exponentialRampToValueAtTime(990, t + 0.18);
    o1.connect(g);
    o2.connect(g);
    g.connect(master);
    o1.start(t);
    o1.stop(t + 0.2);
    o2.start(t + 0.02);
    o2.stop(t + 0.22);
  },
  door() {
    if (!AC) return;
    const t = AC.currentTime;
    const nSrc = noiseNode();
    const ng = AC.createGain();
    ng.gain.setValueAtTime(0.0, t);
    ng.gain.linearRampToValueAtTime(0.2, t + 0.05);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    const bp = AC.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1200;
    bp.Q.value = 0.8;
    nSrc.connect(bp).connect(ng).connect(master);
    nSrc.start(t);
    nSrc.stop(t + 0.65);
    const o = AC.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(180, t);
    o.frequency.exponentialRampToValueAtTime(90, t + 0.5);
    const og = AC.createGain();
    og.gain.setValueAtTime(0.0, t);
    og.gain.linearRampToValueAtTime(0.12, t + 0.1);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    o.connect(og).connect(master);
    o.start(t);
    o.stop(t + 0.65);
  },
  alert() {
    if (!AC) return;
    const t = AC.currentTime;
    const o = AC.createOscillator();
    o.type = "square";
    o.frequency.setValueAtTime(340, t);
    o.frequency.exponentialRampToValueAtTime(160, t + 0.08);
    const g = AC.createGain();
    g.gain.setValueAtTime(0.0, t);
    g.gain.linearRampToValueAtTime(0.28, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + 0.16);
    const n = noiseNode();
    const ng = AC.createGain();
    ng.gain.setValueAtTime(0.2, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    n.connect(ng).connect(master);
    n.start(t);
    n.stop(t + 0.08);
  },
  footstep(dim) {
    if (!AC) return;
    const now = AC.currentTime;
    // tiny noise burst shaped like a soft paw tap
    const dur = 0.05;
    const buf = AC.createBuffer(
      1,
      Math.floor(AC.sampleRate * dur),
      AC.sampleRate
    );
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      // exponential decay envelope to avoid click; slightly darker spectrum
      const env = Math.exp(-i / 180);
      const n = (Math.random() * 2 - 1) * 0.5; // pre-attenuated noise
      data[i] = n * env;
    }
    const src = AC.createBufferSource();
    src.buffer = buf;
    const lp = AC.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1100 + Math.random() * 200;
    const hs = AC.createBiquadFilter();
    hs.type = "highshelf";
    hs.frequency.value = 2000;
    hs.gain.value = -10; // remove hiss
    const g = AC.createGain();
    const base = 0.16 + Math.random() * 0.05; // louder base level
    g.gain.value = dim ? base * 0.55 : base; // softer in shadows
    src.connect(lp).connect(hs).connect(g).connect(master);
    src.start(now);
  },
  success() {
    if (!AC) return;
    const now = AC.currentTime;
    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
    notes.forEach((f) => {
      const osc = AC.createOscillator();
      osc.type = "sine";
      osc.frequency.value = f;
      const g = AC.createGain();
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(0.15, now + 0.02); // very quick fade in
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.25); // end within 0.25s
      osc.connect(g).connect(master);
      osc.start(now);
      osc.stop(now + 0.3); // stops cleanly
    });
  },
};
function ensureAudio() {
  if (started) return;
  started = true;
  AC = new (window.AudioContext || window.webkitAudioContext)();
  master = AC.createGain();
  master.gain.value = muted ? 0 : 0.7;
  master.connect(AC.destination);

  // Natural rain ambience (dual-layer filtered noise + gentle tremolo + stereo sway)
  rainBus = AC.createGain();
  rainBus.gain.value = 0.05; // overall base level
  panner = AC.createStereoPanner();
  panner.pan.value = 0;
  rainBus.connect(panner).connect(master);

  // --- Low rumble layer: brownish
  const rLow = noiseNode(true);
  const lp = AC.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 700;
  lp.Q.value = 0.0001;
  const ls = AC.createBiquadFilter();
  ls.type = "lowshelf";
  ls.frequency.value = 180;
  ls.gain.value = 8;
  const hs = AC.createBiquadFilter();
  hs.type = "highshelf";
  hs.frequency.value = 1500;
  hs.gain.value = -24;
  const gLow = AC.createGain();
  gLow.gain.value = 0.9; // dominant layer
  rLow.connect(lp).connect(ls).connect(hs).connect(gLow).connect(rainBus);

  // --- Mid patter layer: soft mid texture (no hiss)
  const rMid = noiseNode(true);
  const bp = AC.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 900;
  bp.Q.value = 0.8;
  const hs2 = AC.createBiquadFilter();
  hs2.type = "highshelf";
  hs2.frequency.value = 1500;
  hs2.gain.value = -12;
  const gMid = AC.createGain();
  gMid.gain.value = 0.35; // gentle layer
  rMid.connect(bp).connect(hs2).connect(gMid).connect(rainBus);

  // Gentle overall tremolo (wind sway)
  lfo = AC.createOscillator();
  lfo.frequency.value = 0.5; // Hz
  lfoGain = AC.createGain();
  lfoGain.gain.value = 0.04; // depth
  lfo.connect(lfoGain).connect(rainBus.gain);

  // Slow stereo sway
  panLFO = AC.createOscillator();
  panLFO.frequency.value = 0.12; // Hz
  panGain = AC.createGain();
  panGain.gain.value = 0.18; // pan depth
  panLFO.connect(panGain).connect(panner.pan);

  const t0 = AC.currentTime;
  rLow.start(t0);
  rMid.start(t0);
  lfo.start(t0);
  panLFO.start(t0);
  startMelody();
}
function noiseNode(loop = false) {
  const len = 1.0,
    sr = 44100;
  const ctx = AC || new (window.AudioContext || window.webkitAudioContext)();
  const buf = ctx.createBuffer(1, Math.floor(sr * len), sr);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.6;
  const src = AC.createBufferSource();
  src.buffer = buf;
  src.loop = !!loop;
  return src;
}
function setMuted(m) {
  muted = m;
  if (master) master.gain.value = muted ? 0 : 0.7;
}

function startMelody() {
  if (!AC || melOsc) return;
  // Very soft triangle tone with per-note envelope
  melBus = AC.createGain();
  melBus.gain.value = 0.05; // overall melody level (quiet)
  melEnv = AC.createGain();
  melEnv.gain.value = 0.0; // envelope starts closed
  melOsc = AC.createOscillator();
  melOsc.type = "triangle";
  melOsc.frequency.value = 440; // will be changed per note
  melOsc.connect(melEnv).connect(melBus).connect(master);
  const t0 = AC.currentTime;
  melOsc.start(t0);

  // Minor pentatonic (moody): A4,C5,D5,E5,G5,A5
  const scale = [440, 523.25, 587.33, 659.25, 783.99, 880];

  // choose next index near the previous (stepwise), occasional jump
  function pickIndex() {
    const r = Math.random();
    if (r < 0.72) {
      // step -1,0,+1
      const step = [-1, 0, 1][Math.floor(Math.random() * 3)];
      let i = melLast + step;
      i = Math.max(0, Math.min(scale.length - 1, i));
      return i;
    } else {
      return Math.floor(Math.random() * scale.length);
    }
  }

  function nextNote() {
    if (!AC) return;
    const now = AC.currentTime;
    melLast = pickIndex();
    const f = scale[melLast] * (Math.random() < 0.08 ? 0.5 : 1); // rare lower octave tone
    // gentle glide to target frequency
    melOsc.frequency.cancelScheduledValues(now);
    melOsc.frequency.setValueAtTime(melOsc.frequency.value, now);
    melOsc.frequency.exponentialRampToValueAtTime(Math.max(60, f), now + 0.12);

    // ADSR-ish envelope (very short)
    melEnv.gain.cancelScheduledValues(now);
    melEnv.gain.setValueAtTime(0.0, now);
    melEnv.gain.linearRampToValueAtTime(0.12, now + 0.04); // attack
    melEnv.gain.exponentialRampToValueAtTime(0.0001, now + 0.35); // decay
  }

  // schedule notes ~ every 600–800 ms with slight humanization
  function schedule() {
    nextNote();
    const dur = 0.6 + Math.random() * 0.2;
    melTimer = setTimeout(schedule, dur * 1000);
  }
  schedule();
}

function update(dt) {
  if (gameOver || youWin) {
    // Auto-advance if win
    if (youWin && winAdvanceAt != null && time >= winAdvanceAt) {
      nextLevel();
      return; // skip the rest this frame after loading
    }
    return;
  }

  // Move intent
  let vx = 0,
    vy = 0;
  if (keys["ArrowLeft"] || keys["a"] || keys["A"]) vx -= 1;
  if (keys["ArrowRight"] || keys["d"] || keys["D"]) vx += 1;
  if (keys["ArrowUp"] || keys["w"] || keys["W"]) vy -= 1;
  if (keys["ArrowDown"] || keys["s"] || keys["S"]) vy += 1;
  if (vx || vy) {
    const m = Math.hypot(vx, vy);
    vx /= m;
    vy /= m;
  }

  // Axis-aligned collision against walls
  const sp = player.speed * 60 * dt;
  let nx = clamp(player.x + vx * sp, player.r + 1, W - player.r - 1);
  if (!anyRectHit(nx, player.y, walls)) player.x = nx; // x move
  nx = clamp(player.y + vy * sp, player.r + 1, H - player.r - 1);
  if (!anyRectHit(player.x, nx, walls)) player.y = nx; // y move

  // Update facing direction and step animation
  if (vx < -0.01) player.dir = "L";
  else if (vx > 0.01) player.dir = "R";
  if (vx || vy) player.step += dt * 8;
  else player.step = 0;

  // Movement state (idle/sit, walk, crouch)
  const moving = !!(vx || vy);
  const hiddenNow = inAnyShadow(player.x, player.y);
  if (moving) {
    player.idle = 0;
    player.state = hiddenNow ? "crouch" : "walk";
  } else {
    player.idle += dt;
    if (hiddenNow) {
      player.state = "crouch"; // stay low in shadows even when still
    } else if (player.idle > 0.8) {
      player.state = "sit"; // sit after ~0.8s without movement
    } else {
      player.state = "idle"; // brief standstill
    }
  }

  // --- Idle Blink (with random double-blink) ---
  player.blinkTimer -= dt;
  if (player.blinkTimer <= 0) {
    if (player.blink > 0.5) {
      // close
      player.blink = 0;
      player.blinkTimer = 0.1; // closed duration
    } else {
      // open
      player.blink = 1;
      if (player.db) {
        // if a double-blink was scheduled, revert to normal cadence
        player.db = 0;
        player.blinkTimer = 1.8 + Math.random() * 2.2;
      } else if (Math.random() < 0.25 && player.state !== "walk") {
        // schedule a double-blink soon (second close)
        player.db = 1;
        player.blinkTimer = 0.2; // short pause before second close
      } else {
        player.blinkTimer = 1.8 + Math.random() * 2.2;
      }
    }
  }

  // --- Footprints (rain/nebula floor marks) ---
  // Spawn while moving; fade over time
  const movingNow = vx || vy;
  if (movingNow) {
    player.fpTimer -= dt;
    if (player.fpTimer <= 0) {
      const m = Math.hypot(vx, vy) || 1;
      const dx = vx / m,
        dy = vy / m; // move direction
      // place footprint slightly behind player, offset sideways for left/right
      const side = player.pawParity ? 1 : -1;
      const px = player.x - dx * 6 + -dy * 3 * side;
      const py = player.y - dy * 6 + dx * 3 * side;
      footprints.push({ x: px, y: py, life: 1 });
      player.fpTimer = 0.14; // next spawn
      player.pawParity ^= 1;
      // Footstep SFX (very subtle)
      if (started && AC) {
        const now = AC.currentTime;
        const interval = 0.25; // seconds between steps
        if ((vx || vy) && now - lastStepAt > interval) {
          const dim = inAnyShadow(player.x, player.y);
          sfx.footstep(dim);
          lastStepAt = now;
        }
      }
    }
  }

  // Age/cleanup footprints
  for (let i = footprints.length - 1; i >= 0; i--) {
    footprints[i].life -= dt * 0.35; // ~3s fade
    if (footprints[i].life <= 0) footprints.splice(i, 1);
  }

  // --- Fish idle pulses & bubbles ---
  for (const f of fishes) {
    if (!f.t) continue;
    f.cycle -= dt;
    if (f.cycle <= 0) {
      f.anim = 1; // sichtbarer Pulse
      f.cycle = 1.8 + Math.random() * 2.8;
      if (Math.random() < 0.2) f.dir = f.dir === 0 ? Math.PI : 0;
      // kleine Bubbles beim Maul
      for (let i = 0; i < 3; i++) {
        const ox = (f.dir === 0 ? 1 : -1) * (3.5 + Math.random());
        const oy = -0.5 + Math.random() * 1.0;
        bubbles.push({
          x: f.x + ox,
          y: f.y + oy,
          vy: -20 - Math.random() * 15,
          life: 0.9,
        });
      }
    }
    if (f.anim > 0) f.anim = Math.max(0, f.anim - dt * 1.5); // decay
  }
  // Update bubbles
  for (let i = bubbles.length - 1; i >= 0; i--) {
    const b = bubbles[i];
    b.y += b.vy * dt;
    b.life -= dt * 0.7;
    if (b.life <= 0 || b.y < 0) bubbles.splice(i, 1);
  }

  // --- Rain spawn & update ---
  rainSpawn -= dt;
  const density = 0.3; // lower is fewer drops
  if (rainSpawn <= 0) {
    // spawn a small burst
    for (let i = 0; i < 3; i++) {
      const x = Math.random() * W,
        y = -10 - Math.random() * 40;
      const vy = 220 + Math.random() * 80,
        vx = -60 - Math.random() * 40; // slanted
      rain.push({ x, y, vx, vy, len: 10 + Math.random() * 8 });
    }
    rainSpawn = 0.05 / density;
  }
  for (let i = rain.length - 1; i >= 0; i--) {
    const d = rain[i];
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    if (d.y > H - 18) {
      // ground hit
      splashes.push({ x: d.x, y: H - 18, life: 1 });
      rain.splice(i, 1);
    } else if (d.x < -20 || d.x > W + 20 || d.y > H + 20) {
      rain.splice(i, 1);
    }
  }
  for (let i = splashes.length - 1; i >= 0; i--) {
    splashes[i].life -= dt * 1.8;
    if (splashes[i].life <= 0) splashes.splice(i, 1);
  }

  // --- Fog drift ---
  for (const f of fog) {
    f.x += f.dx;
    f.y += f.dy;
    if (f.x < -f.r) f.x = W + f.r;
    else if (f.x > W + f.r) f.x = -f.r;
    if (f.y < -f.r) f.y = H + f.r;
    else if (f.y > H + f.r) f.y = -f.r;
  }

  // Update guards sweep
  for (const g of guards) {
    g.angle += g.dir * g.sweep * dt;
    if (g.angle > 1.0) {
      g.angle = 1.0;
      g.dir = -1;
    }
    if (g.angle < -1.0) {
      g.angle = -1.0;
      g.dir = 1;
    }
  }

  // Detection
  const hidden = inAnyShadow(player.x, player.y);
  // Static lamps see straight to the right by default
  let seen = false;
  for (const l of lamps) {
    if (
      pointInCone(
        player.x,
        player.y,
        l.x + (l.offX || 0),
        l.y + (l.offY || 0),
        0,
        l.fov,
        l.range
      )
    ) {
      seen = true;
      break;
    }
  }
  if (!seen)
    for (const g of guards) {
      if (pointInCone(player.x, player.y, g.x, g.y, g.angle, g.fov, g.range)) {
        seen = true;
        break;
      }
    }
  if (seen && !hidden) {
    if (!gameOver && started) sfx.alert();
    gameOver = true;
  }

  // Collect fish
  for (const f of fishes) {
    if (f.t && Math.hypot(player.x - f.x, player.y - f.y) < 8) {
      f.t = false;
      got++;
      if (started) sfx.collect();
    }
  }

  // Door open transition SFX
  const nowOpen = got === toCollect;
  if (nowOpen && !doorWasOpen) {
    if (started) sfx.door();
    doorWasOpen = true;
  }

  // Exit if all collected
  if (got === toCollect && inRect(player.x, player.y, exit)) {
    if (!youWin) {
      youWin = true;
      if (started && !winSfxPlayed) {
        sfx.success();
        winSfxPlayed = true;
      }
      if (winAdvanceAt == null) winAdvanceAt = time + 1.2; // auto next in ~1.2s
      // Mark next level unlocked in progress right when we win
      unlockNext();
      progress.current = Math.min(progress.unlocked, LEVELS.length - 1);
      saveProgress();
    }
  }
}

function drawCone(src, isLamp) {
  const range = src.range,
    fov = src.fov;
  const angle = isLamp ? 0 : src.angle;
  const x = isLamp && src.offX != null ? src.x + src.offX : src.x;
  const y = isLamp && src.offY != null ? src.y + src.offY : src.y;
  const a1 = angle - fov / 2,
    a2 = angle + fov / 2;
  const grad = ctx.createRadialGradient(x, y, 8, x, y, range);
  grad.addColorStop(0, "rgba(255,220,120,0.45)");
  grad.addColorStop(0.7, "rgba(255,210,110,0.18)");
  grad.addColorStop(1, "rgba(255,200,100,0.0)");
  ctx.save();
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.cos(a1) * range, y + Math.sin(a1) * range);
  ctx.arc(x, y, range, a1, a2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawCat(x, y, dir, hidden, step, state, blink) {
  ctx.save();
  ctx.globalAlpha = hidden ? 0.7 : 1;

  const s = 1; // base scale
  const faceX = x + (dir === "R" ? 5 : -5),
    faceY = y - 6;

  // Helper: eyes (dim when hidden)
  function eyes(dimY, blinkVal) {
    const k = Math.max(0.12, blinkVal); // keep a thin line when closed
    ctx.fillStyle = hidden ? "rgba(255,230,120,0.25)" : "#ffe678";
    // Draw as tiny ellipses squashed by blink factor
    const ex = faceX + (dir === "R" ? 1.2 : -1.2);
    ctx.beginPath();
    ctx.ellipse(
      ex - 1.5,
      faceY - 0.5 + (dimY || 0),
      0.9,
      0.9 * k,
      0,
      0,
      Math.PI * 2
    );
    ctx.ellipse(
      ex + 1.5,
      faceY - 0.5 + (dimY || 0),
      0.9,
      0.9 * k,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }

  // Helper: whiskers
  function whiskers() {
    ctx.strokeStyle = hidden
      ? "rgba(200,210,230,0.25)"
      : "rgba(200,210,230,0.55)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(faceX - 4, faceY);
    ctx.lineTo(faceX - 8, faceY - 1);
    ctx.moveTo(faceX - 4, faceY + 2);
    ctx.lineTo(faceX - 8, faceY + 2);
    ctx.moveTo(faceX + 4, faceY);
    ctx.lineTo(faceX + 8, faceY - 1);
    ctx.moveTo(faceX + 4, faceY + 2);
    ctx.lineTo(faceX + 8, faceY + 2);
    ctx.stroke();
  }

  // Poses
  if (state === "sit") {
    // Tail curled
    ctx.strokeStyle = "#11131a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x - (dir === "R" ? 6 : -6), y + 6, 6, Math.PI * 0.2, Math.PI * 1.6);
    ctx.stroke();

    // Body more upright
    ctx.fillStyle = "#0b0d12";
    ctx.beginPath();
    ctx.ellipse(x, y + 2, 7 * s, 9 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.beginPath();
    ctx.arc(faceX, faceY - 2, 4 * s, 0, Math.PI * 2);
    ctx.fill();

    // Ears
    ctx.beginPath();
    ctx.moveTo(faceX - 3, faceY - 4);
    ctx.lineTo(faceX - 1, faceY - 8);
    ctx.lineTo(faceX, faceY - 4);
    ctx.closePath();
    ctx.moveTo(faceX + 3, faceY - 4);
    ctx.lineTo(faceX + 1, faceY - 8);
    ctx.lineTo(faceX, faceY - 4);
    ctx.closePath();
    ctx.fill();

    // Paws tucked
    ctx.fillStyle = "#0c0e14";
    ctx.beginPath();
    ctx.arc(x - 3, y + 8, 1.2, 0, Math.PI * 2);
    ctx.arc(x + 3, y + 8, 1.2, 0, Math.PI * 2);
    ctx.fill();

    eyes(0, blink);
    whiskers();
  } else if (state === "crouch") {
    // Lower profile: flattened body, lowered head, tail straight but low
    const sway = Math.sin(step * Math.PI) * 2 * (dir === "R" ? 1 : -1);
    ctx.fillStyle = "#0b0d12";
    ctx.beginPath();
    ctx.ellipse(x, y + 3, 9 * s, 4.5 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head lower and closer to body
    ctx.beginPath();
    ctx.arc(x + (dir === "R" ? 6 : -6), y - 3, 3.6 * s, 0, Math.PI * 2);
    ctx.fill();

    // Ears slightly flattened
    const hx = x + (dir === "R" ? 6 : -6),
      hy = y - 3;
    ctx.beginPath();
    ctx.moveTo(hx - 3, hy - 1);
    ctx.lineTo(hx - 1, hy - 4);
    ctx.lineTo(hx, hy - 1);
    ctx.closePath();
    ctx.moveTo(hx + 3, hy - 1);
    ctx.lineTo(hx + 1, hy - 4);
    ctx.lineTo(hx, hy - 1);
    ctx.closePath();
    ctx.fill();

    // Tail low
    ctx.strokeStyle = "#11131a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    const tx = x - (dir === "R" ? 10 : -10),
      ty = y + 5;
    ctx.moveTo(tx, ty);
    ctx.bezierCurveTo(
      tx - 4,
      ty - 1 + sway,
      tx - 8,
      ty + 1 + sway,
      tx - 2,
      ty + 2 + sway
    );
    ctx.stroke();

    // Crawling paws (subtle)
    const lift = Math.sin(step * 2) * 0.6;
    ctx.fillStyle = "#0c0e14";
    ctx.beginPath();
    ctx.arc(x - 3, y + 6 - lift, 1, 0, Math.PI * 2);
    ctx.arc(x + 3, y + 6 + lift, 1, 0, Math.PI * 2);
    ctx.arc(x - 1, y + 5 + lift, 1, 0, Math.PI * 2);
    ctx.arc(x + 1, y + 5 - lift, 1, 0, Math.PI * 2);
    ctx.fill();

    eyes(0.8, blink);
    whiskers();
  } else {
    // walk/idle base (original pose)
    const sway = Math.sin(step * Math.PI) * 3 * (dir === "R" ? 1 : -1);
    ctx.fillStyle = "#0b0d12";
    ctx.beginPath();
    ctx.ellipse(x, y + 1, 8 * s, 6 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(faceX, faceY, 4 * s, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(faceX - 3, faceY - 2);
    ctx.lineTo(faceX - 1, faceY - 6);
    ctx.lineTo(faceX, faceY - 2);
    ctx.closePath();
    ctx.moveTo(faceX + 3, faceY - 2);
    ctx.lineTo(faceX + 1, faceY - 6);
    ctx.lineTo(faceX, faceY - 2);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "#11131a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    const tx = x - (dir === "R" ? 9 : -9),
      ty = y + 1;
    ctx.moveTo(tx, ty);
    ctx.bezierCurveTo(
      tx - 4,
      ty - 2 + sway,
      tx - 6,
      ty - 6 + sway,
      tx - 2,
      ty - 8 + sway
    );
    ctx.stroke();

    const lift = Math.sin(step * 2) * 1.2;
    ctx.fillStyle = "#0c0e14";
    ctx.beginPath();
    ctx.arc(x - 3, y + 6 - lift, 1, 0, Math.PI * 2);
    ctx.arc(x + 3, y + 6 + lift, 1, 0, Math.PI * 2);
    ctx.arc(x - 1, y + 5 + lift, 1, 0, Math.PI * 2);
    ctx.arc(x + 1, y + 5 - lift, 1, 0, Math.PI * 2);
    ctx.fill();

    eyes(0, blink);
    whiskers();
  }

  ctx.restore();
}

function drawFishSprite(f) {
  const { x, y, dir, p, anim } = f;
  const w = 9,
    h = 5; // etwas größer
  const t = time;
  const pulse = 1 + anim * 1.2;
  const wag = Math.sin(t * 7 + (p || 0)) * (0.7 * pulse);
  const bob = Math.sin(t * 1.6 + (p || 0)) * (0.9 * (0.5 + 0.5 * pulse));
  const breath = Math.sin(t * 2.2 + (p || 0) * 1.3) * (0.05 * pulse);
  const xScale = 1 + breath,
    yScale = 1 - breath * 0.7;

  // Glow zur Sichtbarkeit
  ctx.save();
  const glow = ctx.createRadialGradient(x, y, 0, x, y, 10);
  glow.addColorStop(0, "rgba(255,214,102,0.16)");
  glow.addColorStop(1, "rgba(255,214,102,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(x - 12, y - 12, 24, 24);
  ctx.restore();

  ctx.save();
  ctx.translate(x, y + bob);
  // Flip horizontally for left-facing fish without rotating the canvas (prevents upside-down look)
  const flip = dir && Math.abs(dir - Math.PI) < 0.001;
  ctx.scale((flip ? -1 : 1) * xScale, yScale);

  // Body + feiner Rand
  ctx.fillStyle = "#ffd166";
  ctx.beginPath();
  ctx.ellipse(0, 0, w * 0.6, h * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(50,60,80,0.35)";
  ctx.lineWidth = 0.8;
  ctx.stroke();

  // Tail (stärker)
  ctx.fillStyle = "#eab54a";
  ctx.beginPath();
  ctx.moveTo(-w * 0.6, 0);
  ctx.lineTo(-w * 0.6 - 3.5, 2 + wag);
  ctx.lineTo(-w * 0.6 - 3.5, -2 - wag);
  ctx.closePath();
  ctx.fill();

  // Rückenflosse mit leichtem Flap
  ctx.fillStyle = "#f6c255";
  ctx.save();
  ctx.translate(1.2, -h * 0.45);
  ctx.rotate(wag * 0.1);
  ctx.beginPath();
  ctx.moveTo(-2.2, 0);
  ctx.lineTo(1.8, -h * 0.6);
  ctx.lineTo(3.2, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Kiemen-Flare bei Pulse
  if (anim > 0.05) {
    ctx.fillStyle = "rgba(80,70,60,0.25)";
    ctx.beginPath();
    ctx.ellipse(-1.5, 0.2, 1.2 * (1 + anim * 0.6), 1.0, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Auge
  ctx.fillStyle = "#4b4f5a";
  ctx.beginPath();
  ctx.arc(w * 0.28, -0.4, 0.7, 0, Math.PI * 2);
  ctx.fill();

  // Highlight stärker bei Pulse
  ctx.globalAlpha = 0.28 + 0.22 * anim;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.ellipse(w * 0.05, -h * 0.25, 2.0, 1.0, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawDog(guard) {
  const { x, y, angle, accent } = guard;
  const t = time;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  // Overall scale (compact dog)
  const s = 0.72;

  // Drop shadow
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(0, 6 * s, 8 * s, 2.6 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  // Palette
  const BODY = "#4f4436";
  const UNDER = "#3f362c";
  const MUZZLE = "#c7ab92";
  const ACCENT = accent || "#cc4455";
  const EYE = "#12151b";

  // Torso
  ctx.fillStyle = BODY;
  ctx.beginPath();
  ctx.ellipse(-1 * s, 0, 9 * s, 6 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  // Underside
  ctx.fillStyle = UNDER;
  ctx.beginPath();
  ctx.ellipse(-2 * s, 2.6 * s, 6.4 * s, 2.6 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  // Neck ellipse (anchor for collar)
  const nx = 3.8 * s,
    ny = -1.0 * s,
    nrx = 3.6 * s,
    nry = 2.5 * s;
  ctx.fillStyle = BODY;
  ctx.beginPath();
  ctx.ellipse(nx, ny, nrx, nry, 0, 0, Math.PI * 2);
  ctx.fill();

  // >>> Collar: stroked elliptical band wrapped around neck (draw BEFORE head)
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 1.2 * s;
  ctx.beginPath();
  // Slight vertical offset so it sits mid-neck
  ctx.ellipse(nx, ny + 0.1 * s, nrx * 0.95, nry * 0.55, 0, 0, Math.PI * 2);
  ctx.stroke();
  // Tag hanging from bottom of collar
  ctx.fillStyle = "#ffd166";
  ctx.beginPath();
  ctx.arc(nx - nrx * 0.2, ny + nry * 0.8, 0.9 * s, 0, Math.PI * 2);
  ctx.fill();

  // Head (on top, so it overlaps collar correctly)
  ctx.fillStyle = BODY;
  ctx.beginPath();
  ctx.ellipse(7.6 * s, -2.2 * s, 4.6 * s, 3.6 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  // Muzzle
  ctx.fillStyle = MUZZLE;
  ctx.beginPath();
  ctx.moveTo(9.6 * s, -3.0 * s);
  ctx.lineTo(12.6 * s, -2.8 * s);
  ctx.lineTo(12.6 * s, -1.2 * s);
  ctx.lineTo(9.6 * s, -1.3 * s);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(12.7 * s, -2.0 * s, 1.0 * s, 1.0 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1b1f28";
  ctx.beginPath();
  ctx.arc(13.4 * s, -2.0 * s, 0.75 * s, 0, Math.PI * 2);
  ctx.fill();

  // Ears (upright, slight flop)
  const flop = Math.sin(t * 5.2) * 0.18 * s;
  ctx.fillStyle = BODY;
  ctx.beginPath();
  ctx.moveTo(6.6 * s, -5.2 * s);
  ctx.lineTo(7.8 * s, -7.9 * s - flop);
  ctx.lineTo(9.0 * s, -5.0 * s);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.moveTo(5.7 * s, -4.9 * s);
  ctx.lineTo(6.9 * s, -7.3 * s + flop * 0.6);
  ctx.lineTo(7.6 * s, -4.7 * s);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;

  // Eye
  ctx.fillStyle = EYE;
  ctx.beginPath();
  ctx.arc(9.8 * s, -3.0 * s, 0.6 * s, 0, Math.PI * 2);
  ctx.fill();

  // Legs anchored at belly line
  const bellyY = 3.2 * s;
  const gait = Math.sin(t * 4.8);
  ctx.fillStyle = BODY;
  // Front legs
  ctx.fillRect(4.4 * s, bellyY + gait * -0.2 * s, 1.6 * s, 3.6 * s);
  ctx.fillRect(6.2 * s, bellyY + gait * 0.2 * s, 1.6 * s, 3.6 * s);
  // Hind legs
  ctx.fillRect(-5.4 * s, bellyY + gait * 0.2 * s, 1.8 * s, 3.8 * s);
  ctx.fillRect(-3.4 * s, bellyY + gait * -0.2 * s, 1.8 * s, 3.8 * s);

  // Tail (arched up)
  const wag = Math.sin(t * 9.5) * 0.5 * s;
  ctx.strokeStyle = BODY;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-9.0 * s, -0.6 * s);
  ctx.quadraticCurveTo(-11.6 * s, -4.0 * s + wag, -8.4 * s, -6.8 * s + wag);
  ctx.stroke();

  ctx.restore();
}

function drawDoor(x, y, w, h, open) {
  const cx = x + w / 2,
    cy = y + h / 2;
  ctx.save();

  // Wall/jamb frame (dark, matches walls)
  ctx.fillStyle = "#0b0d12";
  ctx.fillRect(x, y, w, h);

  // Inner jamb inset
  const pad = 1;
  ctx.fillStyle = "#141a22";
  ctx.fillRect(x + pad, y + pad, w - pad * 2, h - pad * 2);

  if (!open) {
    // CLOSED: solid door leaf with simple panels + handle
    const dp = 2; // door padding inside jamb
    const dx = x + dp,
      dy = y + dp,
      dw = w - dp * 2,
      dh = h - dp * 2;

    // Door leaf color (neutral, not green)
    ctx.fillStyle = "#2a2f3a";
    ctx.fillRect(dx, dy, dw, dh);

    // Panels (subtle lines)
    ctx.strokeStyle = "rgba(200,210,230,0.12)";
    ctx.lineWidth = 1;
    // vertical panel split
    ctx.beginPath();
    ctx.moveTo(dx + dw * 0.5, dy + 2);
    ctx.lineTo(dx + dw * 0.5, dy + dh - 2);
    ctx.stroke();
    // top and bottom panel hints
    ctx.beginPath();
    ctx.moveTo(dx + 2, dy + dh * 0.35);
    ctx.lineTo(dx + dw - 2, dy + dh * 0.35);
    ctx.moveTo(dx + 2, dy + dh * 0.7);
    ctx.lineTo(dx + dw - 2, dy + dh * 0.7);
    ctx.stroke();

    // Hinges (left) + Handle (right)
    ctx.fillStyle = "#c7cedd";
    ctx.beginPath();
    ctx.arc(dx + 1.5, dy + dh * 0.25, 0.8, 0, Math.PI * 2);
    ctx.arc(dx + 1.5, dy + dh * 0.55, 0.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(dx + dw - 2.2, dy + dh * 0.5, 1.0, 0, Math.PI * 2);
    ctx.fill();

    // Outer frame stroke (subtle)
    ctx.strokeStyle = "rgba(95,208,138,0.35)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  } else {
    // OPEN: dark doorway + green light spill, and a slightly ajar door leaf
    const dp = 2;
    const dx = x + dp,
      dy = y + dp,
      dw = w - dp * 2,
      dh = h - dp * 2;

    // Dark interior (doorway)
    ctx.fillStyle = "#0a0f14";
    ctx.fillRect(dx, dy, dw, dh);

    // Light spill (interior glow)
    const glow = ctx.createRadialGradient(cx, cy, 2, cx, cy, Math.max(w, h));
    glow.addColorStop(0, "rgba(95,208,138,0.35)");
    glow.addColorStop(1, "rgba(95,208,138,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(x - 8, y - 8, w + 16, h + 16);

    // Floor spill (outside the door)
    ctx.fillStyle = "rgba(95,208,138,0.22)";
    ctx.beginPath();
    const fx0 = cx - dw * 0.25,
      fx1 = cx + dw * 0.25;
    ctx.moveTo(fx0, y + h);
    ctx.lineTo(fx1, y + h);
    ctx.lineTo(fx1 + 4, y + h + 5);
    ctx.lineTo(fx0 - 4, y + h + 5);
    ctx.closePath();
    ctx.fill();

    // Ajar door leaf (drawn as a small quad rotated to the right)
    ctx.fillStyle = "#23323b";
    ctx.strokeStyle = "rgba(200,210,230,0.1)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    const ax = dx + dw * 0.15,
      ay = dy + 1;
    ctx.moveTo(ax, ay);
    ctx.lineTo(ax + dw * 0.55, ay + dh * 0.1);
    ctx.lineTo(ax + dw * 0.55, ay + dh - 1);
    ctx.lineTo(ax, ay + dh - 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Bright slit inside (suggest depth)
    const phase = (Math.sin(time * 3) + 1) * 0.5; // 0..1
    const slit = Math.max(1.5, 3 + phase * 3);
    ctx.fillStyle = "#5fd08a";
    ctx.fillRect(cx - slit / 2, dy + 2, slit, dh - 4);

    // Outer frame stroke (subtle)
    ctx.strokeStyle = "rgba(95,208,138,0.35)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  }

  ctx.restore();
}

// Stylized lamp post sprite for static lamps
function drawLamp(l) {
  const { x, y } = l;
  ctx.save();

  // Post shadow
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath();
  ctx.ellipse(x, y + 8, 6, 2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Vertical post
  ctx.fillStyle = "#2a3140";
  ctx.fillRect(x - 1, y - 12, 2, 16);

  // Side arm to the right (since lamp shines to the right)
  ctx.fillRect(x + 0, y - 10, 8, 2);

  // Lamp head housing
  const hx = x + (l.offX ?? 10),
    hy = y + (l.offY ?? -11);
  ctx.fillStyle = "#232a38";
  ctx.fillRect(hx - 5, hy - 3, 10, 6); // housing box

  // Top cap
  ctx.fillStyle = "#1d2330";
  ctx.fillRect(hx - 4, hy - 5, 8, 2);

  // Glass (emissive)
  ctx.fillStyle = "rgba(255,236,170,0.9)";
  ctx.fillRect(hx - 4, hy - 2, 8, 4);

  // Little finial
  ctx.fillStyle = "#1d2330";
  ctx.fillRect(hx - 1, hy - 6, 2, 1);

  // Base plate on ground
  ctx.fillStyle = "#2a3140";
  ctx.fillRect(x - 3, y + 3, 6, 2);

  // Local glow around head (helps readability)
  const gx = hx + 2,
    gy = hy;
  const grad = ctx.createRadialGradient(gx, gy, 2, gx, gy, 26);
  grad.addColorStop(0, "rgba(255,236,170,0.35)");
  grad.addColorStop(1, "rgba(255,236,170,0.0)");
  ctx.fillStyle = grad;
  ctx.fillRect(hx - 26, hy - 26, 52, 52);

  ctx.restore();
}

function drawHideTile(s) {
  const x = s.x,
    y = s.y,
    w = s.w,
    h = s.h;
  const t = time || 0;
  ctx.save();

  // 1) Base: darker, cool-tinted patch (clearly different from wall)
  ctx.fillStyle = "rgba(8,14,24,0.78)";
  ctx.fillRect(x, y, w, h);

  // 2) Soft inner vignette to break the blocky look
  const cx = x + w * 0.5,
    cy = y + h * 0.5;
  const rg = ctx.createRadialGradient(cx, cy, 2, cx, cy, Math.max(w, h) * 0.75);
  rg.addColorStop(0.0, "rgba(0,0,0,0.38)");
  rg.addColorStop(0.65, "rgba(0,0,0,0.2)");
  rg.addColorStop(1.0, "rgba(0,0,0,0)");
  ctx.fillStyle = rg;
  ctx.fillRect(x - 8, y - 8, w + 16, h + 16);

  // 3) Edge feather on all sides (stronger, readable)
  // Top
  let lg = ctx.createLinearGradient(x, y, x, y + 7);
  lg.addColorStop(0, "rgba(0,0,0,0.65)");
  lg.addColorStop(1, "rgba(0,0,0,0.0)");
  ctx.fillStyle = lg;
  ctx.fillRect(x, y, w, 7);
  // Bottom
  lg = ctx.createLinearGradient(x, y + h, x, y + h - 7);
  lg.addColorStop(0, "rgba(0,0,0,0.55)");
  lg.addColorStop(1, "rgba(0,0,0,0.0)");
  ctx.fillStyle = lg;
  ctx.fillRect(x, y + h - 7, w, 7);
  // Left
  lg = ctx.createLinearGradient(x, y, x + 7, y);
  lg.addColorStop(0, "rgba(0,0,0,0.6)");
  lg.addColorStop(1, "rgba(0,0,0,0.0)");
  ctx.fillStyle = lg;
  ctx.fillRect(x, y, 7, h);
  // Right
  lg = ctx.createLinearGradient(x + w, y, x + w - 7, y);
  lg.addColorStop(0, "rgba(0,0,0,0.6)");
  lg.addColorStop(1, "rgba(0,0,0,0.0)");
  ctx.fillStyle = lg;
  ctx.fillRect(x + w - 7, y, 7, h);

  // 4) Faint inner outline (cool hue) for instant recognition
  ctx.strokeStyle = "rgba(120,170,220,0.12)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

  // 5) Subtle animated dither to differentiate from plain floor
  //    (tiny speckles, extremely faint)
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = "#5f6d85";
  // deterministic hash per tile so it doesn't swim too much
  const tx = (x / w) | 0,
    ty = (y / h) | 0;
  let seed = Math.sin((tx + 31) * 91 + (ty + 17) * 57 + t * 0.8) * 10000;
  function rnd() {
    seed = Math.sin(seed) * 10000;
    return seed - Math.floor(seed);
  }
  for (let i = 0; i < 8; i++) {
    const px = x + Math.floor(rnd() * w);
    const py = y + Math.floor(rnd() * h);
    ctx.fillRect(px, py, 1, 1);
  }
  ctx.globalAlpha = 1;

  // 6) Soft blue emission with gentle breathing pulse + fadeout
  const cx2 = x + w * 0.5,
    cy2 = y + h * 0.5;
  const lit = inAnyLight(cx2, cy2);
  // Smoothly ease intensity toward target (lit?1:0)
  const target = lit ? 1 : 0;
  if (typeof s.glowIntensity !== "number") s.glowIntensity = 0;
  s.glowIntensity += (target - s.glowIntensity) * 0.08; // ~0.5s fade
  if (s.glowIntensity > 0.01) {
    const pulse = 0.6 + 0.4 * (0.5 + 0.5 * Math.sin((time || 0) * 1.6));
    const alpha = 0.18 * pulse * s.glowIntensity;
    const rg2 = ctx.createRadialGradient(
      cx2,
      cy2,
      2,
      cx2,
      cy2,
      Math.max(w, h) * 1.2
    );
    rg2.addColorStop(0, `rgba(120,170,255,${alpha})`);
    rg2.addColorStop(1, "rgba(120,170,255,0)");
    ctx.fillStyle = rg2;
    ctx.fillRect(x - 12, y - 12, w + 24, h + 24);
  }

  ctx.restore();
}

function render() {
  // Ensure indices are valid if LEVELS changed at runtime
  const lastIdx = LEVELS.length - 1;
  if (progress.unlocked > lastIdx) progress.unlocked = lastIdx;
  if (levelIndex > progress.unlocked) levelIndex = progress.unlocked;
  if (progress.current !== levelIndex) {
    progress.current = levelIndex;
    saveProgress();
  }
  // Night bg
  ctx.clearRect(0, 0, W, H);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#0f1420");
  g.addColorStop(1, "#0b0e17");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Base pass (no flat fog here; custom fog below)
  ctx.fillStyle = "rgba(0,0,0,0.0)";
  ctx.fillRect(0, 0, W, H);

  // Walls
  ctx.fillStyle = "#0b0d12";
  for (const w of walls) ctx.fillRect(w.x, w.y, w.w, w.h);

  // Shadows (safe) – stylized hide tiles
  for (const s of shadows) drawHideTile(s);

  // Exit door (closed until all fish collected)
  const doorOpen = got === toCollect;
  drawDoor(exit.x, exit.y, exit.w, exit.h, doorOpen);

  // Nebel-Pulse: overlapping drifting radial gradients
  for (const f of fog) {
    const gr = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r);
    gr.addColorStop(0, `rgba(30,35,50,${f.a})`);
    gr.addColorStop(1, "rgba(30,35,50,0)");
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, W, H);
  }

  // Light cones
  for (const l of lamps) drawCone(l, true);
  for (const g2 of guards) drawCone(g2, false);

  // Guards/Lamps bodies
  for (const l of lamps) drawLamp(l);
  for (const g2 of guards) drawDog(g2);

  for (const b of bubbles) {
    ctx.save();
    ctx.globalAlpha = 0.25 * Math.max(0, b.life);
    ctx.fillStyle = "#bcd4ff";
    ctx.beginPath();
    ctx.ellipse(b.x, b.y, 1.2, 1.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Fishes (sprite)
  for (const f of fishes) {
    if (!f.t) continue;
    drawFishSprite(f);
  }

  // Ground splashes from raindrops
  for (const s of splashes) {
    ctx.save();
    ctx.globalAlpha = 0.2 * Math.max(0, s.life);
    ctx.strokeStyle = "#8fa3c2";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(s.x, s.y + 1, 4.5 * (1 - s.life * 0.6), 1.2, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Footprints under fog – subtle wet marks (brighter in light cones)
  for (const fp of footprints) {
    let a = 0.18 * Math.max(0, fp.life);
    if (inAnyLight(fp.x, fp.y)) a *= 1.8; // reflect more when lit
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = "#7b8aa1";
    ctx.beginPath();
    ctx.ellipse(fp.x, fp.y + 2, 3.2, 1.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Player (black cat sprite)
  const hidden = inAnyShadow(player.x, player.y);
  drawCat(
    player.x,
    player.y,
    player.dir,
    hidden,
    player.step,
    player.state,
    player.blink
  );

  // Rain streaks (top layer)
  ctx.save();
  ctx.strokeStyle = "rgba(170,190,220,0.35)";
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  for (const d of rain) {
    ctx.moveTo(d.x, d.y);
    ctx.lineTo(d.x - d.vx * 0.03, d.y - d.vy * 0.03 - d.len);
  }
  ctx.stroke();
  ctx.restore();

  // HUD
  const fishCountEl = document.getElementById("fishCount");
  const levelCountEl = document.getElementById("levelCount");
  const doorStateEl = document.getElementById("doorState");

  if (fishCountEl) fishCountEl.textContent = `${got}/${toCollect}`;
  if (levelCountEl)
    levelCountEl.textContent = `${levelIndex + 1}/${LEVELS.length}`;
  if (doorStateEl)
    doorStateEl.textContent = doorOpen ? "Tür geöffnet" : "Tür geschlossen";
  const tipEl = document.getElementById("tutorial");
  if (tipEl && TIPS[levelIndex] && TIPS[levelIndex].trim() !== "") {
    tipEl.innerHTML =
      "<strong>Level " + (levelIndex + 1) + ": </strong>" + TIPS[levelIndex];
    tipEl.style.opacity = 1;
  } else {
    tipEl.innerHTML = "";
    tipEl.style.opacity = 0;
  }

  if (gameOver) {
    overlay("#ffd166", "Entdeckt!", "R für Neustart");
  } else if (youWin) {
    overlay(
      "#5fd08a",
      "Geschafft!",
      "Alle Fische gesammelt – weiter in 1.2s (Taste N für sofort)"
    );
  }
}

function overlay(color, title, sub) {
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = "center";
  ctx.fillStyle = color;
  ctx.font = "bold 24px system-ui, sans-serif";
  ctx.fillText(title, W / 2, H / 2 - 6);
  ctx.fillStyle = "#dbe0ea";
  ctx.font = "14px system-ui, sans-serif";
  ctx.fillText(sub, W / 2, H / 2 + 16);
  ctx.textAlign = "left";
}

requestAnimationFrame(loop);

// window._clearProgress = () => { localStorage.removeItem(LS_KEY); location.reload(); };
