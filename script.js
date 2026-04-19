const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const ui = {
  startScreen: document.getElementById('startScreen'),
  btnStartGame: document.getElementById('btnStartGame'),
  btnStartMuted: document.getElementById('btnStartMuted'),
  levelNum: document.getElementById('levelNum'),
  levelCount: document.getElementById('levelCount'),
  loopCount: document.getElementById('loopCount'),
  moveCount: document.getElementById('moveCount'),
  timerText: document.getElementById('timerText'),
  chapterText: document.getElementById('chapterText'),
  objective: document.getElementById('objective'),
  storyText: document.getElementById('storyText'),
  hintText: document.getElementById('hintText'),
  flash: document.getElementById('flashMessage'),
  winModal: document.getElementById('winModal'),
  btnSound: document.getElementById('btnSound'),
};

const TILE = 64;
const COLORS = {
  floor: '#0d1a2c',
  floor2: '#12233c',
  wall: '#32465f',
  wallGlow: '#7aa6d6',
  switch: '#67ffbf',
  gateClosed: '#ff9f43',
  gateOpen: '#6ff3ff',
  hazard: '#ff4f7e',
  player: '#6ff3ff',
  clone: '#bb7cff',
  outline: 'rgba(255,255,255,0.08)',
};

const levels = [
  {
    name: 'Boot Sequence',
    chapter: 'Chapter 1 // First Echo',
    hint: 'Step onto the switch, create a loop, then use your live self to reach the gate.',
    objective: 'Hold the green switch with a clone and reach the gate.',
    story: 'The vault wakes up slowly. It wants proof that you understand the rewind mechanic. Give it one clean loop.',
    grid: [
      '###############',
      '#P....S....G..#',
      '#.............#',
      '#.............#',
      '#.............#',
      '#.............#',
      '#.............#',
      '###############',
    ],
  },
  {
    name: 'Cross Pressure',
    chapter: 'Chapter 2 // Dual Sync',
    hint: 'One loop can sit on a switch. Another loop can stop on the second. Then you make the final gate run.',
    objective: 'Activate both switches at the same time to open the gate.',
    story: 'The system realizes one echo is not enough. It splits control across two pressure nodes and watches how you adapt.',
    grid: [
      '###############',
      '#P.....S......#',
      '#.............#',
      '#.....#####...#',
      '#.............#',
      '#......S...G..#',
      '#.............#',
      '###############',
    ],
  },
  {
    name: 'Red Sector',
    chapter: 'Chapter 3 // Faultline',
    hint: 'Hazards reset only your live self. Keep loops clean and take a safer final route.',
    objective: 'Keep the switch active, avoid hazard zones, and reach the gate.',
    story: 'Now the vault injects corruption. One bad step and the chamber shreds your current timeline.',
    grid: [
      '###############',
      '#P....S..!!!G.#',
      '#.....!..!!!..#',
      '#.....!..!!!..#',
      '#.............#',
      '#.............#',
      '#.............#',
      '###############',
    ],
  },
  {
    name: 'Twin Sync',
    chapter: 'Chapter 4 // Parallel Minds',
    hint: 'Multiple clones replay together. Build your loops in the correct order before your final path.',
    objective: 'Use stacked timelines to hold both switches and reach the gate.',
    story: 'The chamber now runs multiple branches at once. Every mistake echoes louder, but so does every solution.',
    grid: [
      '###############',
      '#P....S...#...#',
      '#.........#...#',
      '#...###...#...#',
      '#.........#...#',
      '#...#...S...G.#',
      '#...#.........#',
      '###############',
    ],
  },
  {
    name: 'Omega Vault',
    chapter: 'Boss // Final Lockdown',
    hint: 'You need three active switches and a final clean route. Build multiple loops first, then sprint the gate before time expires.',
    objective: 'Boss room: sync all 3 switches during lockdown, avoid hazards, then breach the final gate.',
    story: 'Emergency lockdown engaged. The Omega Vault compresses time, floods the floor with hazards, and dares you to outplay your own history.',
    timer: 45,
    grid: [
      '###############',
      '#P....S..#....#',
      '#.!!!....#..S.#',
      '#....###.#....#',
      '#.S..#G#...!!!#',
      '#....#.#......#',
      '#....#.....!..#',
      '###############',
    ],
  },
];

ui.levelCount.textContent = String(levels.length);

const state = {
  levelIndex: 0,
  grid: [],
  playerStart: { x: 1, y: 1 },
  player: { x: 1, y: 1, px: 1, py: 1, anim: 1 },
  clones: [],
  currentRun: [],
  moveCount: 0,
  particles: [],
  gateOpen: false,
  animTick: 0,
  timer: null,
  lastTime: performance.now(),
  started: false,
};

const audioState = {
  enabled: true,
  ctx: null,
  ambientNode: null,
  masterGain: null,
};

function setupAudio() {
  if (audioState.ctx) return;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;
  audioState.ctx = new AudioCtx();
  audioState.masterGain = audioState.ctx.createGain();
  audioState.masterGain.gain.value = 0.06;
  audioState.masterGain.connect(audioState.ctx.destination);
}

function ensureAudio() {
  if (!audioState.enabled) return;
  setupAudio();
  if (audioState.ctx && audioState.ctx.state === 'suspended') audioState.ctx.resume();
  if (!audioState.ambientNode) startAmbient();
}

function tone(type, freq, duration, gain = 0.03, glide = null) {
  if (!audioState.enabled) return;
  setupAudio();
  const ctx = audioState.ctx;
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const vol = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  if (glide) osc.frequency.exponentialRampToValueAtTime(glide, ctx.currentTime + duration);
  vol.gain.setValueAtTime(0.0001, ctx.currentTime);
  vol.gain.exponentialRampToValueAtTime(gain, ctx.currentTime + 0.02);
  vol.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
  osc.connect(vol);
  vol.connect(audioState.masterGain || ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + duration + 0.03);
}

function noiseBurst(duration = 0.08, gain = 0.014) {
  if (!audioState.enabled) return;
  setupAudio();
  const ctx = audioState.ctx;
  if (!ctx) return;
  const buffer = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const source = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const vol = ctx.createGain();
  filter.type = 'highpass';
  filter.frequency.value = 900;
  vol.gain.value = gain;
  source.buffer = buffer;
  source.connect(filter);
  filter.connect(vol);
  vol.connect(audioState.masterGain || ctx.destination);
  source.start();
}

function startAmbient() {
  if (!audioState.ctx || audioState.ambientNode || !audioState.enabled) return;
  const ctx = audioState.ctx;
  const osc = ctx.createOscillator();
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  const vol = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.value = 72;
  lfo.frequency.value = 0.18;
  lfoGain.gain.value = 6;
  vol.gain.value = 0.018;
  lfo.connect(lfoGain);
  lfoGain.connect(osc.frequency);
  osc.connect(vol);
  vol.connect(audioState.masterGain || ctx.destination);
  osc.start();
  lfo.start();
  audioState.ambientNode = { osc, lfo, vol };
}

function stopAmbient() {
  if (!audioState.ambientNode) return;
  audioState.ambientNode.osc.stop();
  audioState.ambientNode.lfo.stop();
  audioState.ambientNode = null;
}

function playMoveSound() { tone('square', 280, 0.06, 0.025, 220); }
function playLoopSound() { tone('sawtooth', 250, 0.12, 0.03, 520); tone('triangle', 520, 0.18, 0.018, 720); }
function playGateSound() { tone('sine', 380, 0.12, 0.03, 760); tone('triangle', 520, 0.18, 0.026, 980); }
function playErrorSound() { noiseBurst(0.08, 0.016); tone('square', 140, 0.09, 0.02, 100); }
function playSuccessSound() { tone('triangle', 280, 0.08, 0.025, 420); tone('triangle', 420, 0.09, 0.022, 620); tone('triangle', 620, 0.12, 0.018, 860); }

function toggleSound(forceEnabled = null) {
  audioState.enabled = forceEnabled == null ? !audioState.enabled : forceEnabled;
  if (audioState.enabled) {
    ensureAudio();
    ui.btnSound.textContent = '🔊 Sound On';
    ui.btnSound.classList.add('primary');
  } else {
    stopAmbient();
    ui.btnSound.textContent = '🔇 Sound Off';
    ui.btnSound.classList.remove('primary');
  }
}

function loadLevel(index) {
  const level = levels[index];
  state.levelIndex = index;
  state.grid = level.grid.map(r => r.split(''));
  state.clones = [];
  state.currentRun = [];
  state.moveCount = 0;
  state.particles = [];
  state.gateOpen = false;
  state.timer = typeof level.timer === 'number' ? level.timer : null;

  for (let y = 0; y < state.grid.length; y++) {
    for (let x = 0; x < state.grid[y].length; x++) {
      if (state.grid[y][x] === 'P') {
        state.playerStart = { x, y };
        state.player = { x, y, px: x, py: y, anim: 1 };
        state.grid[y][x] = '.';
      }
    }
  }

  ui.levelNum.textContent = String(index + 1);
  ui.loopCount.textContent = '0';
  ui.moveCount.textContent = '0';
  ui.objective.textContent = level.objective;
  ui.hintText.textContent = level.hint;
  ui.chapterText.textContent = level.chapter;
  ui.storyText.textContent = level.story;
  ui.timerText.textContent = state.timer == null ? '--' : `${Math.ceil(state.timer)}s`;
  flash(level.name);
}

function flash(text) {
  ui.flash.textContent = text;
  ui.flash.classList.remove('hidden');
  clearTimeout(flash._timer);
  flash._timer = setTimeout(() => ui.flash.classList.add('hidden'), 1800);
}

function isWalkable(x, y) {
  const cell = state.grid[y]?.[x];
  return cell && cell !== '#';
}

function switchesRequired() {
  let count = 0;
  state.grid.forEach(row => row.forEach(c => { if (c === 'S') count++; }));
  return count;
}

function getEntities() {
  return [{ x: state.player.x, y: state.player.y }, ...state.clones.map(c => ({ x: c.x, y: c.y }))];
}

function getActiveSwitches() {
  let active = 0;
  const entities = getEntities();
  for (let y = 0; y < state.grid.length; y++) {
    for (let x = 0; x < state.grid[y].length; x++) {
      if (state.grid[y][x] === 'S' && entities.some(e => e.x === x && e.y === y)) active++;
    }
  }
  return active;
}

function getGatePos() {
  for (let y = 0; y < state.grid.length; y++) {
    for (let x = 0; x < state.grid[y].length; x++) {
      if (state.grid[y][x] === 'G') return { x, y };
    }
  }
  return null;
}

function createParticles(x, y, color, n = 18) {
  for (let i = 0; i < n; i++) {
    state.particles.push({
      x: x + TILE / 2,
      y: y + TILE / 2,
      vx: (Math.random() - 0.5) * 4,
      vy: (Math.random() - 0.5) * 4,
      life: 1,
      color,
      size: 2 + Math.random() * 3,
    });
  }
}

function createLoop() {
  if (!state.currentRun.length) {
    flash('Move first, then create a loop');
    playErrorSound();
    return;
  }
  state.clones.push({
    path: [...state.currentRun],
    step: 0,
    x: state.playerStart.x,
    y: state.playerStart.y,
    px: state.playerStart.x,
    py: state.playerStart.y,
    anim: 1,
  });
  state.currentRun = [];
  state.player = { x: state.playerStart.x, y: state.playerStart.y, px: state.playerStart.x, py: state.playerStart.y, anim: 1 };
  ui.loopCount.textContent = String(state.clones.length);
  createParticles(state.player.x * TILE, state.player.y * TILE, COLORS.clone, 22);
  flash('Loop created');
  playLoopSound();
  updateWorld();
}

function resetPlayerOnly() {
  state.player = { x: state.playerStart.x, y: state.playerStart.y, px: state.playerStart.x, py: state.playerStart.y, anim: 1 };
  state.currentRun = [];
  state.moveCount = 0;
  ui.moveCount.textContent = '0';
  flash('Player reset');
}

function tryMove(dx, dy) {
  const nx = state.player.x + dx;
  const ny = state.player.y + dy;
  if (!isWalkable(nx, ny)) return;
  state.player.px = state.player.x;
  state.player.py = state.player.y;
  state.player.x = nx;
  state.player.y = ny;
  state.player.anim = 0;
  state.currentRun.push({ dx, dy });
  state.moveCount++;
  ui.moveCount.textContent = String(state.moveCount);
  playMoveSound();
  updateClones();
  updateWorld();
}

function updateClones() {
  for (const clone of state.clones) {
    clone.px = clone.x;
    clone.py = clone.y;
    if (clone.step < clone.path.length) {
      clone.x += clone.path[clone.step].dx;
      clone.y += clone.path[clone.step].dy;
      clone.step++;
      clone.anim = 0;
    }
  }
}

function updateWorld() {
  state.gateOpen = getActiveSwitches() === switchesRequired();
  const cell = state.grid[state.player.y][state.player.x];
  if (cell === '!') {
    createParticles(state.player.x * TILE, state.player.y * TILE, COLORS.hazard, 30);
    flash('Hazard triggered');
    playErrorSound();
    resetPlayerOnly();
    return;
  }
  const gate = getGatePos();
  if (gate && state.player.x === gate.x && state.player.y === gate.y && state.gateOpen) {
    createParticles(gate.x * TILE, gate.y * TILE, COLORS.gateOpen, 36);
    playSuccessSound();
    if (state.levelIndex === levels.length - 1) {
      ui.winModal.classList.remove('hidden');
      flash('Omega Vault breached');
    } else {
      flash('Room cleared');
      setTimeout(() => loadLevel(state.levelIndex + 1), 750);
    }
  } else if (gate && state.player.x === gate.x && state.player.y === gate.y && !state.gateOpen) {
    flash('Gate locked: activate all switches');
    playErrorSound();
  }
}

function updateTimer(deltaSec) {
  if (state.timer == null || ui.winModal && !ui.winModal.classList.contains('hidden') || !state.started) return;
  state.timer -= deltaSec;
  if (state.timer <= 0) {
    state.timer = 0;
    ui.timerText.textContent = '0s';
    flash('Lockdown reset');
    playErrorSound();
    setTimeout(() => loadLevel(state.levelIndex), 150);
    return;
  }
  ui.timerText.textContent = `${Math.ceil(state.timer)}s`;
}

function startGame(withSound = true) {
  state.started = true;
  ui.startScreen.classList.add('hidden');
  toggleSound(withSound);
  if (withSound) ensureAudio();
}

function handleKey(e) {
  const k = e.key.toLowerCase();
  if (ui.winModal && !ui.winModal.classList.contains('hidden')) return;
  if (['arrowup','arrowdown','arrowleft','arrowright',' ','enter','r','h'].includes(k) || ['w','a','s','d'].includes(k)) e.preventDefault();
  if (!state.started) return;
  if (k === 'w' || k === 'arrowup') tryMove(0, -1);
  else if (k === 's' || k === 'arrowdown') tryMove(0, 1);
  else if (k === 'a' || k === 'arrowleft') tryMove(-1, 0);
  else if (k === 'd' || k === 'arrowright') tryMove(1, 0);
  else if (k === ' ' || k === 'enter') createLoop();
  else if (k === 'r') loadLevel(state.levelIndex);
  else if (k === 'h') flash(levels[state.levelIndex].hint);
}

function lerp(a, b, t) { return a + (b - a) * t; }

function drawRoundedRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawEntity(entity, color, glow, label = '') {
  const t = Math.min(1, entity.anim + 0.18);
  entity.anim = t;
  const x = lerp(entity.px, entity.x, t) * TILE;
  const y = lerp(entity.py, entity.y, t) * TILE;
  const pulse = 0.8 + Math.sin(state.animTick * 6 + entity.x + entity.y) * 0.08;
  ctx.save();
  ctx.shadowBlur = glow;
  ctx.shadowColor = color;
  ctx.fillStyle = color;
  drawRoundedRect(x + 14, y + 14, (TILE - 28) * pulse, (TILE - 28) * pulse, 18);
  ctx.fill();
  if (label) {
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.font = 'bold 13px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(label, x + TILE/2, y + TILE/2 + 5);
  }
  ctx.restore();
}

function drawGridBackground(width, height) {
  ctx.fillStyle = 'rgba(8,16,28,0.55)';
  drawRoundedRect(0, 0, width, height, 20);
  ctx.fill();
}

function draw() {
  const now = performance.now();
  const deltaSec = Math.min(0.05, (now - state.lastTime) / 1000);
  state.lastTime = now;
  state.animTick += deltaSec;
  updateTimer(deltaSec);

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const offsetX = (canvas.width - state.grid[0].length * TILE) / 2;
  const offsetY = (canvas.height - state.grid.length * TILE) / 2;
  ctx.save();
  ctx.translate(offsetX, offsetY);
  drawGridBackground(state.grid[0].length * TILE, state.grid.length * TILE);

  for (let y = 0; y < state.grid.length; y++) {
    for (let x = 0; x < state.grid[y].length; x++) {
      const cell = state.grid[y][x];
      const px = x * TILE;
      const py = y * TILE;
      const shade = (x + y) % 2 === 0 ? COLORS.floor : COLORS.floor2;

      ctx.fillStyle = shade;
      ctx.strokeStyle = COLORS.outline;
      ctx.lineWidth = 1;
      drawRoundedRect(px + 2, py + 2, TILE - 4, TILE - 4, 12);
      ctx.fill();
      ctx.stroke();

      if (cell === '#') {
        ctx.fillStyle = COLORS.wall;
        ctx.shadowBlur = 16;
        ctx.shadowColor = COLORS.wallGlow;
        drawRoundedRect(px + 4, py + 4, TILE - 8, TILE - 8, 14);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      if (cell === 'S') {
        const active = getEntities().some(e => e.x === x && e.y === y);
        ctx.fillStyle = active ? '#9dffd5' : COLORS.switch;
        ctx.shadowBlur = 20;
        ctx.shadowColor = COLORS.switch;
        drawRoundedRect(px + 18, py + 18, TILE - 36, TILE - 36, 10);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      if (cell === 'G') {
        const glow = state.gateOpen ? COLORS.gateOpen : COLORS.gateClosed;
        const pulse = state.gateOpen ? 4 + Math.sin(state.animTick * 7) * 2 : 0;
        ctx.strokeStyle = glow;
        ctx.lineWidth = 5 + pulse * 0.1;
        ctx.shadowBlur = 20 + pulse;
        ctx.shadowColor = glow;
        drawRoundedRect(px + 12, py + 12, TILE - 24, TILE - 24, 10);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
      if (cell === '!') {
        const pulse = 0.45 + Math.abs(Math.sin(state.animTick * 4 + x + y)) * 0.55;
        ctx.fillStyle = `rgba(255,79,126,${0.35 + pulse * 0.28})`;
        drawRoundedRect(px + 10, py + 10, TILE - 20, TILE - 20, 12);
        ctx.fill();
      }
    }
  }

  for (const clone of state.clones) drawEntity(clone, COLORS.clone, 24, 'C');
  drawEntity(state.player, COLORS.player, 28, 'Y');

  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.life -= 0.03;
    if (p.life <= 0) {
      state.particles.splice(i, 1);
      continue;
    }
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  ctx.restore();
  requestAnimationFrame(draw);
}

ui.btnStartGame.onclick = () => startGame(true);
ui.btnStartMuted.onclick = () => startGame(false);
ui.btnSound.onclick = () => toggleSound();
document.getElementById('btnLoop').onclick = () => createLoop();
document.getElementById('btnReset').onclick = () => loadLevel(state.levelIndex);
document.getElementById('btnPrev').onclick = () => { if (state.levelIndex > 0) loadLevel(state.levelIndex - 1); };
document.getElementById('btnNext').onclick = () => { if (state.levelIndex < levels.length - 1) loadLevel(state.levelIndex + 1); };
document.getElementById('btnRestartAll').onclick = () => { ui.winModal.classList.add('hidden'); loadLevel(0); };
window.addEventListener('keydown', handleKey);
window.addEventListener('pointerdown', () => ensureAudio(), { once: true });

loadLevel(0);
draw();
