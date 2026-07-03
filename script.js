// ─────────────────────────────────────────────
// TURBO RUSH 2D — script.js (Versão com correção dos botões de nível)
// ─────────────────────────────────────────────
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = 480;
canvas.height = 620;

// ── Elementos da UI ──────────────────────────
const speedDisplay = document.getElementById('speedDisplay');
const scoreDisplay = document.getElementById('scoreDisplay');
const livesDisplay = document.getElementById('livesDisplay');
const overlay = document.getElementById('overlay');
const gameOverScreen = document.getElementById('gameOverScreen');
const finalScoreEl = document.getElementById('finalScore');
const bestScoreEl = document.getElementById('bestScore');
const levelSelectScreen = document.getElementById('levelSelectScreen');
const helpScreen = document.getElementById('helpScreen');
const levelCompleteScreen = document.getElementById('levelCompleteScreen');

document.getElementById('startBtn').addEventListener('click', showLevelSelect);
document.getElementById('restartBtn').addEventListener('click', restartGame);
document.getElementById('backToMenuBtn').addEventListener('click', backToMenu);
document.getElementById('closeHelpBtn').addEventListener('click', toggleHelp);
document.getElementById('nextLevelBtn').addEventListener('click', goToNextLevel);
document.getElementById('backToLevelsBtn').addEventListener('click', showLevelSelect);
document.getElementById('backToMenuFromGameOver').addEventListener('click', backToMenu);

// Multiplayer button (placeholder)
document.getElementById('multiplayerBtn').addEventListener('click', () => {
  alert("🌐 Modo Multiplayer\n\nEsta função está em desenvolvimento.\n\nNa próxima versão vamos adicionar:\n- Salas de jogo\n- Jogadores online\n- Ranking global\n\nPor enquanto o jogo funciona 100% no modo Single Player!");
});

// =============================================
// PREPARAÇÃO PARA MULTIPLAYER (ESTRUTURA)
// =============================================
let multiplayer = {
  enabled: false,
  roomId: null,
  playerId: null,
  otherPlayers: {},
  connect: () => { console.log("[Multiplayer] Conectar ao servidor..."); },
  disconnect: () => { console.log("[Multiplayer] Desconectar..."); },
  sendState: (state) => {},
  receiveState: (data) => {},
};

// ==================== EVENTOS DOS BOTÕES DE NÍVEL (CORRIGIDO) ====================
function setupLevelButtons() {
  const levelButtons = document.querySelectorAll('.level-btn');
  
  levelButtons.forEach(btn => {
    btn.addEventListener('click', function() {
      const level = parseInt(this.dataset.level);
      console.log("✅ Clicou no nível:", level);   // Ajuda a testar
      startLevel(level);
    });
  });
}

// Chama a função quando a página terminar de carregar
window.addEventListener('load', setupLevelButtons);

// ── Áudio ─────────────────────────────
let audioCtx = null;
let engineNode = null;
let engineGain = null;
let melodyTimer = null;
let melodyIndex = 0;
const MELODY = [220, 247, 262, 294, 330, 294, 262, 247];

function initAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

function startEngine() {
  if (!audioCtx) return;
  stopEngine();
  engineGain = audioCtx.createGain();
  engineGain.gain.value = 0.08;
  engineGain.connect(audioCtx.destination);
  engineNode = audioCtx.createOscillator();
  engineNode.type = 'sawtooth';
  engineNode.frequency.value = 80;
  engineNode.connect(engineGain);
  engineNode.start();
}

function updateEngineSound(gameSpeed) {
  if (!engineNode) return;
  const freq = 80 + (gameSpeed / 12) * 140;
  engineNode.frequency.setTargetAtTime(freq, audioCtx.currentTime, 0.1);
}

function stopEngine() {
  if (engineNode) { try { engineNode.stop(); } catch(e){} engineNode = null; }
  if (engineGain) { engineGain.disconnect(); engineGain = null; }
}

function playCollisionSound() {
  if (!audioCtx) return;
  const bufferSize = audioCtx.sampleRate * 0.3;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1);
  const noise = audioCtx.createBufferSource();
  noise.buffer = buffer;
  const gainNode = audioCtx.createGain();
  gainNode.gain.setValueAtTime(0.4, audioCtx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
  const filter = audioCtx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 400;
  noise.connect(filter);
  filter.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  noise.start();
}

function playMelodyNote() {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'square';
  osc.frequency.value = MELODY[melodyIndex % MELODY.length];
  melodyIndex++;
  gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.18);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.18);
  melodyTimer = setTimeout(playMelodyNote, 200);
}

function startMusic() {
  if (!audioCtx) return;
  stopMusic();
  playMelodyNote();
}

function stopMusic() {
  if (melodyTimer) { clearTimeout(melodyTimer); melodyTimer = null; }
}

function playGameOverSound() {
  if (!audioCtx) return;
  stopMusic();
  stopEngine();
  const notes = [330, 294, 262, 220, 196];
  notes.forEach((freq, i) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime + i * 0.15);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + i * 0.15 + 0.14);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(audioCtx.currentTime + i * 0.15);
    osc.stop(audioCtx.currentTime + i * 0.15 + 0.15);
  });
}

// ── Constantes ───────────────────────────────
const ROAD_LEFT = 80;
const ROAD_RIGHT = 400;
const ROAD_W = ROAD_RIGHT - ROAD_LEFT;
const LANE_W = ROAD_W / 3;
const LANES = [
  ROAD_LEFT + LANE_W * 0.5,
  ROAD_LEFT + LANE_W * 1.5,
  ROAD_LEFT + LANE_W * 2.5,
];

// ── Definição dos Níveis ─────────────────────
const LEVELS = {
  1: { name: "Nível 1", goalType: "time", goalValue: 40,  description: "Sobreviva 40 segundos" },
  2: { name: "Nível 2", goalType: "score", goalValue: 1500, description: "Faça 1.500 pontos" },
  3: { name: "Nível 3", goalType: "time", goalValue: 55,  description: "Sobreviva 55 segundos" },
  4: { name: "Nível 4", goalType: "score", goalValue: 2500, description: "Faça 2.500 pontos" },
  5: { name: "Nível 5", goalType: "time", goalValue: 80,  description: "Sobreviva 80 segundos (Difícil!)" },
};

// ── Estado do Jogo ───────────────────────────
let state = {};
let bestScore = 0;
let currentLevel = 1;
let levelStartTime = 0;
let animId = null;
let isHelpOpen = false;

let highScores = JSON.parse(localStorage.getItem('turboRushHighScores')) || [];

function resetState(level = 1) {
  currentLevel = level;
  const levelData = LEVELS[level];
  
  return {
    running: false,
    score: 0,
    lives: 3,
    speed: 3,
    gameSpeed: 3,
    spawnTimer: 0,
    spawnInterval: 90,
    invincible: 0,
    stripes: [],
    enemies: [],
    sparks: [],
    player: {
      lane: 1,
      x: LANES[1],
      y: canvas.height - 120,
      w: 36,
      h: 64,
      moving: false,
      targetX: LANES[1],
    },
    keys: { left: false, right: false, up: false, down: false },
    levelData: levelData,
    levelComplete: false,
    startTime: Date.now(),
  };
}

// ── Funções de Tela ──────────────────────────
function showLevelSelect() {
  overlay.classList.add('hidden');
  gameOverScreen.classList.add('hidden');
  levelCompleteScreen.classList.add('hidden');
  helpScreen.classList.add('hidden');
  levelSelectScreen.classList.remove('hidden');
}

function backToMenu() {
  levelSelectScreen.classList.add('hidden');
  levelCompleteScreen.classList.add('hidden');
  gameOverScreen.classList.add('hidden');
  helpScreen.classList.add('hidden');
  overlay.classList.remove('hidden');
}

function toggleHelp() {
  isHelpOpen = !isHelpOpen;
  if (isHelpOpen) {
    helpScreen.classList.remove('hidden');
  } else {
    helpScreen.classList.add('hidden');
  }
}

// ── Iniciar Nível ────────────────────────────
function startLevel(level) {
  levelSelectScreen.classList.add('hidden');
  overlay.classList.add('hidden');
  gameOverScreen.classList.add('hidden');
  levelCompleteScreen.classList.add('hidden');

  cancelAnimationFrame(animId);
  initAudio();
  startEngine();
  startMusic();

  state = resetState(level);
  state.running = true;
  levelStartTime = Date.now();

  initStripes(state);
  loop();
}

// ── Ranking Local ────────────────────────────
function saveScore(score) {
  highScores.push(score);
  highScores.sort((a, b) => b - a);
  highScores = highScores.slice(0, 5);
  localStorage.setItem('turboRushHighScores', JSON.stringify(highScores));
}

function displayRanking() {
  const container = document.getElementById('rankingDisplay');
  if (!container) return;

  if (highScores.length === 0) {
    container.innerHTML = "<p style='color:#888'>Nenhuma pontuação ainda</p>";
    return;
  }

  let html = "<h4>🏆 MELHORES PONTUAÇÕES</h4><ol>";
  highScores.forEach((score, index) => {
    html += `<li>${index + 1}. ${score} pontos</li>`;
  });
  html += "</ol>";
  container.innerHTML = html;
}

// ── Listras da Pista ─────────────────────────
function initStripes(s) {
  s.stripes = [];
  for (let y = 0; y < canvas.height; y += 60) {
    s.stripes.push({ y });
  }
}

// ── Cores dos Carros ─────────────────────────
const ENEMY_COLORS = ['#e63946','#f4a261','#2ec4b6','#a8dadc','#ffbe0b','#8338ec','#fb5607'];
function randColor() {
  return ENEMY_COLORS[Math.floor(Math.random() * ENEMY_COLORS.length)];
}

function spawnEnemy(s) {
  const lane = Math.floor(Math.random() * 3);
  s.enemies.push({
    x: LANES[lane],
    y: -80,
    w: 36,
    h: 64,
    lane,
    color: randColor(),
    speed: s.gameSpeed * (0.7 + Math.random() * 0.5),
  });
}

function addSparks(s, x, y) {
  for (let i = 0; i < 18; i++) {
    const angle = Math.random() * Math.PI * 2;
    const vel = 2 + Math.random() * 4;
    s.sparks.push({
      x, y,
      vx: Math.cos(angle) * vel,
      vy: Math.sin(angle) * vel,
      life: 30 + Math.random() * 20,
      maxLife: 50,
      color: ['#ffe800','#ff6600','#ff2244'][Math.floor(Math.random()*3)],
    });
  }
}

// ── Input ────────────────────────────────────
window.addEventListener('keydown', e => {
  if (e.key === 'F1') {
    e.preventDefault();
    toggleHelp();
    return;
  }

  if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) {
    e.preventDefault();
  }
  if (!state.running) return;

  if (e.key === 'ArrowLeft') state.keys.left = true;
  if (e.key === 'ArrowRight') state.keys.right = true;
  if (e.key === 'ArrowUp') state.keys.up = true;
  if (e.key === 'ArrowDown') state.keys.down = true;
});

window.addEventListener('keyup', e => {
  if (e.key === 'ArrowLeft') state.keys.left = false;
  if (e.key === 'ArrowRight') state.keys.right = false;
  if (e.key === 'ArrowUp') state.keys.up = false;
  if (e.key === 'ArrowDown') state.keys.down = false;
});

// ── Loop Principal ───────────────────────────
function loop() {
  if (!state.running) return;
  update(state);
  draw(state);
  animId = requestAnimationFrame(loop);
}

// ── Update ───────────────────────────────────
function update(s) {
  const p = s.player;
  const levelData = s.levelData;

  s.score += Math.ceil(s.gameSpeed * 0.1);
  s.gameSpeed += 0.001;
  s.speed = s.gameSpeed;

  if (s.keys.up && s.gameSpeed < 12) s.gameSpeed += 0.04;
  if (s.keys.down && s.gameSpeed > 1) s.gameSpeed -= 0.06;

  if (s.keys.left && p.lane > 0 && !p.moving) { p.lane--; p.moving = true; p.targetX = LANES[p.lane]; }
  if (s.keys.right && p.lane < 2 && !p.moving) { p.lane++; p.moving = true; p.targetX = LANES[p.lane]; }

  const dx = p.targetX - p.x;
  if (Math.abs(dx) < 2) { p.x = p.targetX; p.moving = false; }
  else { p.x += dx * 0.18; }

  s.stripes.forEach(st => {
    st.y += s.speed;
    if (st.y > canvas.height) st.y -= canvas.height + 30;
  });

  s.spawnTimer++;
  if (s.spawnTimer >= s.spawnInterval) {
    spawnEnemy(s);
    s.spawnTimer = 0;
    s.spawnInterval = Math.max(25, s.spawnInterval - 0.4);
  }

  s.enemies.forEach(e => { e.y += s.speed * 0.9; });
  s.enemies = s.enemies.filter(e => e.y < canvas.height + 100);

  if (s.invincible > 0) {
    s.invincible--;
  } else {
    for (const e of s.enemies) {
      if (rectsOverlap(p, e)) {
        s.lives--;
        s.invincible = 90;
        addSparks(s, p.x, p.y);
        playCollisionSound();
        s.enemies = s.enemies.filter(en => en !== e);
        if (s.lives <= 0) {
          endGame(s, false);
          return;
        }
        break;
      }
    }
  }

  s.sparks.forEach(sp => {
    sp.x += sp.vx;
    sp.y += sp.vy;
    sp.vy += 0.15;
    sp.life--;
  });
  s.sparks = s.sparks.filter(sp => sp.life > 0);

  speedDisplay.textContent = Math.floor(s.gameSpeed * 18);
  scoreDisplay.textContent = s.score;
  livesDisplay.textContent = '❤️'.repeat(s.lives);

  updateEngineSound(s.gameSpeed);

  checkLevelComplete(s);
}

// ── Verificar Objetivo do Nível ──────────────
function checkLevelComplete(s) {
  const levelData = s.levelData;
  let completed = false;

  if (levelData.goalType === "time") {
    const elapsed = Math.floor((Date.now() - s.startTime) / 1000);
    if (elapsed >= levelData.goalValue) completed = true;
  } 
  else if (levelData.goalType === "score") {
    if (s.score >= levelData.goalValue) completed = true;
  }

  if (completed && !s.levelComplete) {
    s.levelComplete = true;
    endGame(s, true);
  }
}

// ── Finalizar Jogo / Nível ───────────────────
function endGame(s, levelCompleted) {
  s.running = false;
  stopEngine();
  stopMusic();

  if (levelCompleted) {
    document.getElementById('levelScore').textContent = s.score;
    const elapsed = Math.floor((Date.now() - s.startTime) / 1000);
    document.getElementById('levelTime').textContent = elapsed;

    levelCompleteScreen.classList.remove('hidden');
    saveScore(s.score);
  } else {
    if (s.score > bestScore) bestScore = s.score;
    finalScoreEl.textContent = s.score;
    bestScoreEl.textContent = bestScore;
    playGameOverSound();
    displayRanking();
    gameOverScreen.classList.remove('hidden');
    saveScore(s.score);
  }
}

function restartGame() {
  startLevel(currentLevel);
}

function goToNextLevel() {
  let next = currentLevel + 1;
  if (next > 5) next = 1;
  startLevel(next);
}

// ── Colisão ──────────────────────────────────
function rectsOverlap(a, b) {
  const pad = 6;
  return (
    a.x - a.w/2 + pad < b.x + b.w/2 - pad &&
    a.x + a.w/2 - pad > b.x - b.w/2 + pad &&
    a.y - a.h/2 + pad < b.y + b.h/2 - pad &&
    a.y + a.h/2 - pad > b.y - b.h/2 + pad
  );
}

// ── Desenhar ─────────────────────────────────
function draw(s) {
  const p = s.player;

  ctx.fillStyle = '#1a1f15';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#1e2a18';
  ctx.fillRect(0, 0, ROAD_LEFT, canvas.height);
  ctx.fillRect(ROAD_RIGHT, 0, canvas.width - ROAD_RIGHT, canvas.height);

  ctx.fillStyle = '#1c1e24';
  ctx.fillRect(ROAD_LEFT, 0, ROAD_W, canvas.height);

  ctx.strokeStyle = '#ffe800';
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(ROAD_LEFT, 0); ctx.lineTo(ROAD_LEFT, canvas.height); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(ROAD_RIGHT, 0); ctx.lineTo(ROAD_RIGHT, canvas.height); ctx.stroke();

  ctx.strokeStyle = '#ffffff30';
  ctx.lineWidth = 2;
  ctx.setLineDash([30, 30]);
  s.stripes.forEach(st => {
    ctx.beginPath();
    ctx.moveTo(ROAD_LEFT + LANE_W, st.y - 30);
    ctx.lineTo(ROAD_LEFT + LANE_W, st.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(ROAD_LEFT + LANE_W * 2, st.y - 30);
    ctx.lineTo(ROAD_LEFT + LANE_W * 2, st.y);
    ctx.stroke();
  });
  ctx.setLineDash([]);

  s.enemies.forEach(e => drawCar(e.x, e.y, e.w, e.h, e.color, false));

  const visible = s.invincible === 0 || Math.floor(s.invincible / 6) % 2 === 0;
  if (visible) drawCar(p.x, p.y, p.w, p.h, '#00f0ff', true);

  s.sparks.forEach(sp => {
    const alpha = sp.life / sp.maxLife;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = sp.color;
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, 3 * alpha, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

// ── Desenhar Carro ───────────────────────────
function drawCar(x, y, w, h, color, isPlayer) {
  const cx = x - w / 2;
  const cy = y - h / 2;

  ctx.shadowColor = color;
  ctx.shadowBlur = isPlayer ? 18 : 8;

  ctx.fillStyle = color;
  roundRect(cx + 2, cy + 4, w - 4, h - 8, 6);
  ctx.fill();

  ctx.fillStyle = isPlayer ? '#003040' : '#11111a';
  roundRect(cx + 6, cy + h * 0.28, w - 12, h * 0.36, 4);
  ctx.fill();

  ctx.fillStyle = isPlayer ? '#00f0ff55' : '#ffffff22';
  roundRect(cx + 7, cy + h * 0.30, w - 14, h * 0.15, 3);
  ctx.fill();

  ctx.fillStyle = '#111';
  ctx.shadowBlur = 0;
  roundRect(cx - 3, cy + 6, 8, 14, 3); ctx.fill();
  roundRect(cx + w - 5, cy + 6, 8, 14, 3); ctx.fill();
  roundRect(cx - 3, cy + h - 20, 8, 14, 3); ctx.fill();
  roundRect(cx + w - 5, cy + h - 20, 8, 14, 3); ctx.fill();

  if (isPlayer) {
    ctx.fillStyle = '#ffffa0';
    ctx.fillRect(cx + 4, cy + 4, 8, 4);
    ctx.fillRect(cx + w-12, cy + 4, 8, 4);
  } else {
    ctx.fillStyle = '#ff3300aa';
    ctx.fillRect(cx + 4, cy + h - 8, 8, 4);
    ctx.fillRect(cx + w-12, cy + h - 8, 8, 4);
  }
  ctx.shadowBlur = 0;
}

function roundRect(x, y, w, h, r) {
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
