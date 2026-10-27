/* ==========================================================
   CONFIG — 換最終版影片時只要改 videoSrc
   ========================================================== */
const CONFIG = {
  videoSrc: 'assets/video.mp4',
  bgmSrc: 'assets/bgm.mp3',
  bgmVolume: 0.6,      // 背景音樂音量（0–1）
  bgmFadeInMs: 2000,   // 淡入
  bgmFadeOutMs: 900,   // 淡出
  bgmToVideoMs: 350,   // 開影片時的淡出（短一點，避免和影片聲音重疊太久）
  turnLockMs: 650,     // 翻頁防連點
  scoreLockMs: 2100,   // 成績頁：等分數數到 100、紅圈畫完才能翻頁

  // 夜空（數字越大越熱鬧）
  starDensity: 1 / 3800, // 每 px² 幾顆星（1920×1080 約 545 顆）
  starMax: 600,
  twinkleSpeed: 1.5,     // 閃爍速度倍率（1 = 原本）
  meteorEvery: [3, 6],   // 平常流星間隔（秒，隨機範圍）
  meteorPairChance: 0.3, // 偶爾一次來兩顆
  showerCount: 24,       // 成績頁的流星雨數量
};

/* ==========================================================
   內容（題目文字照原文，不更正）
   ========================================================== */
const QUIZ = [
  { title: '本台的主題曲', options: ['山海', '拍西瓜', '友情的雞絆飯', '格鬥寶絆'] },
  { title: '本台特色', options: ['吼睡歌回', '恐遊台', '暴力歌組合拳', '酒雜'] },
  { title: '今年金句', options: ['羅百輯', '底線這種東西，跨過去就是榮華富貴', '以待以待', '吉娃娃之外都是不倫不類的狗'] },
  { title: '絆哥今年最想做的事情', options: ['錄米老鼠情慾記', '再玩一個恐遊', '翻唱小雞汁的歌', '百首歌回'] },
];
const ESSAY = '問答題：請說一句現在此時此刻最想跟絆唱吉說的話';
const NUMERALS = ['一', '二', '三', '四', '五'];
const KEYS = ['A', 'B', 'C', 'D'];

const PAGES = [
  { kind: 'text', html: '<span class="line">首先，</span><span class="line">恭喜3.0募資成功、三週年快樂</span><span class="line">還有最重要的</span><span class="big">生日快樂</span>' },
  { kind: 'text', html: '<span class="line">再來，在這個特別的日子裡</span><span class="line">有個小測驗給你</span>' },
  ...QUIZ.map((q, i) => ({ kind: 'quiz', index: i, ...q })),
  { kind: 'essay' },
  { kind: 'score' },
  { kind: 'final' },
];

/* ==========================================================
   State
   ========================================================== */
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const state = {
  opened: false,      // 信封已打開
  page: 0,
  busy: false,        // 翻頁 / 開信中，防連點
  answers: new Array(QUIZ.length).fill(null),
  musicOn: true,      // 使用者的音樂開關
  videoOpen: false,
  videoEnded: false,
};

const $ = (id) => document.getElementById(id);
const els = {
  envelope: $('envelope'),
  sceneEnvelope: $('sceneEnvelope'),
  sceneLetter: $('sceneLetter'),
  paper: $('paper'),
  pages: $('pages'),
  progress: $('progress'),
  next: $('nextBtn'),
  musicToggle: $('musicToggle'),
  musicLabel: $('musicLabel'),
  bgm: $('bgm'),
  videoLayer: $('videoLayer'),
  video: $('giftVideo'),
  videoClose: $('videoClose'),
  videoError: $('videoError'),
  stage: document.querySelector('.stage'),
};

els.bgm.src = CONFIG.bgmSrc;
els.bgm.volume = 0;
els.video.src = CONFIG.videoSrc;

/* ==========================================================
   Background music：用 audio.volume 做淡入淡出
   （不用 WebAudio，雙擊 file:// 開啟時也能正常出聲）
   ========================================================== */
// iOS Safari 的 volume 是唯讀（永遠 1）：淡入淡出做不到，改成直接播放 / 暫停
const canSetVolume = (() => { const a = new Audio(); a.volume = 0.5; return a.volume === 0.5; })();

let fadeTimer = 0;
function fadeBgm(target, ms, done) {
  clearInterval(fadeTimer);
  if (!canSetVolume) { if (done) done(); return; }
  const from = els.bgm.volume;
  const start = performance.now();
  fadeTimer = setInterval(() => {
    const k = Math.min(1, (performance.now() - start) / ms);
    els.bgm.volume = Math.max(0, Math.min(1, from + (target - from) * k));
    if (k >= 1) {
      clearInterval(fadeTimer);
      if (done) done();
    }
  }, 30);
}

// 一打開網頁就播。瀏覽器若擋下有聲自動播放，就等使用者第一次點擊 / 按鍵（任何地方）再播
let audioUnlocked = false;
let waitingGesture = false;
function waitForGesture() {
  if (waitingGesture) return;
  waitingGesture = true;
  const go = () => {
    waitingGesture = false;
    ['pointerdown', 'keydown'].forEach((t) => document.removeEventListener(t, go, true));
    syncMusic();
  };
  ['pointerdown', 'keydown'].forEach((t) => document.addEventListener(t, go, true));
}

function syncMusic() {
  const videoPlaying = state.videoOpen && !state.videoEnded;
  const want = state.musicOn && !videoPlaying;
  if (want) {
    if (els.bgm.paused) {
      els.bgm.play().then(() => {
        audioUnlocked = true;
        fadeBgm(CONFIG.bgmVolume, CONFIG.bgmFadeInMs);
      }).catch(() => {
        if (!audioUnlocked) waitForGesture();
        else if (els.bgm.paused) setMusicOn(false); // 播過之後又被擋：音樂鈕切成「關」，讓使用者點一下重試
      });
    } else {
      fadeBgm(CONFIG.bgmVolume, CONFIG.bgmFadeInMs);
    }
  } else if (!els.bgm.paused) {
    fadeBgm(0, videoPlaying ? CONFIG.bgmToVideoMs : CONFIG.bgmFadeOutMs, () => els.bgm.pause());
  }
}

function setMusicOn(on) {
  state.musicOn = on;
  els.musicToggle.setAttribute('aria-pressed', String(on));
  els.musicToggle.setAttribute('aria-label', `背景音樂：${on ? '開' : '關'}`);
}

els.musicToggle.addEventListener('click', () => {
  setMusicOn(!state.musicOn);
  syncMusic();
});

/* ==========================================================
   建立信紙頁面
   ========================================================== */
function circlePath() {
  // 手畫感的紅筆圈：起點與終點稍微錯開
  return '<svg class="circle-mark" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">'
    + '<path pathLength="1" d="M8 22 C 6 8, 40 3, 62 4 C 88 5, 98 14, 96 24 C 94 35, 60 39, 38 37 C 14 35, 3 28, 9 15 C 12 9, 22 6, 30 5"/></svg>';
}

function buildPages() {
  PAGES.forEach((p, i) => {
    const page = document.createElement('article');
    page.className = `page page-${p.kind}`;
    page.dataset.index = i;

    if (p.kind === 'text') {
      page.innerHTML = `<p class="letter-text">${p.html}</p>`;
    } else if (p.kind === 'quiz') {
      page.classList.add('q-choice');
      const opts = p.options.map((o, k) => (
        `<button class="option" type="button" role="radio" aria-checked="false" data-k="${k}">`
        + `<span class="opt-key">${KEYS[k]}.</span><span class="opt-text">${o}</span>${circlePath()}</button>`
      )).join('');
      page.innerHTML = `<p class="q-num">第${NUMERALS[p.index]}題</p>`
        + `<h2 class="q-text" id="q${i}">${p.title}</h2>`
        + `<div class="options" role="radiogroup" aria-labelledby="q${i}">${opts}</div>`;
      page.querySelectorAll('.option').forEach((btn) => {
        btn.addEventListener('click', () => choose(p.index, Number(btn.dataset.k)));
      });
    } else if (p.kind === 'essay') {
      page.classList.add('q-essay');
      page.innerHTML = `<p class="q-num">第${NUMERALS[4]}題</p>`
        + `<h2 class="q-text"><label for="answerBox">${ESSAY}</label></h2>`
        + '<textarea class="answer-box" id="answerBox" rows="3" maxlength="200" placeholder="寫在這裡（也可以留空）"></textarea>';
    } else if (p.kind === 'score') {
      page.innerHTML = '<p class="score-label">你的成績</p>'
        + '<p class="score" aria-label="100 分"><span class="score-num" id="scoreNum">0</span><span class="score-unit">分</span>'
        + '<svg class="score-mark" viewBox="0 0 100 50" preserveAspectRatio="none" aria-hidden="true">'
        + '<path pathLength="1" d="M10 30 C 6 12, 40 2, 66 4 C 92 6, 99 20, 95 32 C 90 46, 52 49, 30 46 C 10 43, 2 34, 8 20 C 12 12, 24 7, 34 6"/></svg></p>'
        + '<p class="score-note">滿分！</p>';
    } else if (p.kind === 'final') {
      page.innerHTML = '<blockquote class="answer-quote" id="answerQuote" hidden></blockquote>'
        + '<p class="gift-line">給滿分的你一個禮物</p>'
        + '<button class="gift-btn" id="giftBtn" type="button"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l13-7.5z"/></svg><span id="giftLabel">打開禮物</span></button>';
    }
    els.pages.appendChild(page);

    const dot = document.createElement('li');
    dot.setAttribute('aria-hidden', 'true');
    els.progress.appendChild(dot);
  });
  $('giftBtn').addEventListener('click', openVideo);
}

function pageEl(i) { return els.pages.children[i]; }

function choose(qIndex, k) {
  state.answers[qIndex] = k;
  const page = pageEl(PAGES.findIndex((p) => p.kind === 'quiz' && p.index === qIndex));
  page.querySelectorAll('.option').forEach((btn) => {
    btn.setAttribute('aria-checked', String(Number(btn.dataset.k) === k));
  });
  updateNav();
}

function canAdvance() {
  const p = PAGES[state.page];
  if (p.kind === 'quiz') return state.answers[p.index] !== null;
  return p.kind !== 'final';
}

function updateNav() {
  const p = PAGES[state.page];
  els.next.hidden = p.kind === 'final';
  els.next.disabled = !canAdvance();
  [...els.progress.children].forEach((dot, i) => {
    dot.classList.toggle('is-done', i < state.page);
    dot.classList.toggle('is-here', i === state.page);
  });
}

/* ==========================================================
   開信封
   ========================================================== */
function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function openEnvelope() {
  if (state.opened || state.busy) return;
  state.busy = true;
  state.opened = true;
  pluckAll();

  const env = els.envelope;
  env.classList.add('is-opening');
  $('envHint').style.visibility = 'hidden';
  const flap = env.querySelector('.env-flap');
  const seal = env.querySelector('.env-seal');
  const letter = env.querySelector('.env-letter');

  if (reduceMotion.matches) {
    await els.sceneEnvelope.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: 'forwards' }).finished;
  } else {
    seal.animate([{ opacity: 1, transform: 'translate(-50%, -62%) scale(1)' }, { opacity: 0, transform: 'translate(-50%, -62%) scale(0.9)' }],
      { duration: 160, easing: 'ease-out', fill: 'forwards' });
    const flapAnim = flap.animate([{ transform: 'rotateX(0deg)' }, { transform: 'rotateX(180deg)' }],
      { duration: 560, delay: 120, easing: 'cubic-bezier(0.77, 0, 0.175, 1)', fill: 'forwards' });
    setTimeout(() => { flap.style.zIndex = 1; }, 400); // 翻過一半後移到信紙後面
    await flapAnim.finished;
    await letter.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-58%)' }],
      { duration: 720, easing: 'cubic-bezier(0.23, 1, 0.32, 1)', fill: 'forwards' }).finished;
    await els.sceneEnvelope.animate([{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(40px)' }],
      { duration: 420, easing: 'cubic-bezier(0.23, 1, 0.32, 1)', fill: 'forwards' }).finished;
  }
  els.sceneEnvelope.hidden = true;
  els.sceneLetter.hidden = false;
  pageEl(0).classList.add('is-current');
  updateNav();
  const enter = reduceMotion.matches
    ? [{ opacity: 0 }, { opacity: 1 }]
    : [{ opacity: 0, transform: 'translateY(32px) scale(0.97)' }, { opacity: 1, transform: 'none' }];
  await els.paper.animate(enter, { duration: 520, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' }).finished;
  els.paper.focus({ preventScroll: true });
  state.busy = false;
}
els.envelope.addEventListener('click', openEnvelope);

/* ==========================================================
   翻頁
   ========================================================== */
async function advance() {
  if (!state.opened) { openEnvelope(); return; }
  if (state.busy || state.videoOpen || !canAdvance()) return;
  state.busy = true;

  const from = pageEl(state.page);
  state.page += 1;
  const to = pageEl(state.page);
  const kind = PAGES[state.page].kind;
  const unlock = wait(kind === 'score' && !reduceMotion.matches ? CONFIG.scoreLockMs : CONFIG.turnLockMs);

  if (kind === 'final') prepareFinal();
  if (PAGES[state.page - 1].kind === 'score') sparkles.length = 0; // 成績頁的星星不要飄到下一頁
  pluck(state.page % 6);

  const rm = reduceMotion.matches;
  const outFrames = rm ? [{ opacity: 1 }, { opacity: 0 }]
    : [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateX(-5%) rotate(-1deg)' }];
  const inFrames = rm ? [{ opacity: 0 }, { opacity: 1 }]
    : [{ opacity: 0, transform: 'translateX(5%)' }, { opacity: 1, transform: 'none' }];

  await from.animate(outFrames, { duration: rm ? 160 : 240, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' }).finished;
  from.classList.remove('is-current');
  to.classList.add('is-current');
  updateNav();
  const enter = to.animate(inFrames, { duration: rm ? 200 : 380, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' });

  if (kind === 'essay') {
    $('answerBox').focus({ preventScroll: true });
  } else {
    // 把焦點從上一頁的按鈕移走，避免空白鍵觸發到看不見的按鈕
    if (document.activeElement && els.pages.contains(document.activeElement)) els.paper.focus({ preventScroll: true });
  }
  if (kind === 'score') celebrate(to);

  await Promise.all([enter.finished, unlock]);
  state.busy = false;
}
els.next.addEventListener('click', advance);

function prepareFinal() {
  const text = $('answerBox').value.trim();
  const quote = $('answerQuote');
  quote.textContent = text;
  quote.hidden = text === '';
}

/* ==========================================================
   成績頁：分數從 0 數到 100 + 流星
   ========================================================== */
function celebrate(page) {
  const num = $('scoreNum');
  page.classList.add('is-graded');
  if (reduceMotion.matches) {
    num.textContent = '100';
    sparkleBurst(true);
    return;
  }
  const start = performance.now();
  const dur = 1100;
  const tick = (now) => {
    const k = Math.min(1, (now - start) / dur);
    num.textContent = String(Math.round(100 * (1 - Math.pow(1 - k, 3))));
    if (k < 1) requestAnimationFrame(tick);
    else { sparkleBurst(false); meteorShower(); }
  };
  requestAnimationFrame(tick);
}

/* ==========================================================
   禮物影片
   ========================================================== */
function openVideo() {
  if (state.videoOpen) return;
  state.videoOpen = true;
  state.videoEnded = false;
  els.videoLayer.hidden = false;
  els.stage.inert = true;
  els.musicToggle.inert = true;
  els.videoError.hidden = !els.video.error;
  els.video.currentTime = 0; // 「再看一次」一律從頭播
  // 播不起來（被擋、載入失敗）就先把音樂恢復；之後按控制列播放時 play 事件會再淡出
  els.video.play().catch(() => { if (state.videoOpen && els.video.paused) { state.videoEnded = true; syncMusic(); } });
  syncMusic();
  els.videoLayer.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 280, easing: 'ease-out' });
  els.videoClose.focus({ preventScroll: true });
}

function closeVideo() {
  if (!state.videoOpen) return;
  els.video.pause();
  state.videoOpen = false;
  els.stage.inert = false;
  els.musicToggle.inert = false;
  syncMusic();
  els.videoLayer.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: 'ease-out' })
    .finished.then(() => { if (!state.videoOpen) els.videoLayer.hidden = true; });
  $('giftLabel').textContent = '再看一次';
  $('giftBtn').focus({ preventScroll: true });
}

els.video.addEventListener('ended', () => { state.videoEnded = true; syncMusic(); });
els.video.addEventListener('error', () => {
  els.videoError.hidden = false;
  state.videoEnded = true;
  syncMusic();
});
els.video.addEventListener('playing', () => { els.videoError.hidden = true; });
els.video.addEventListener('play', () => {
  if (state.videoEnded) { state.videoEnded = false; syncMusic(); } // 用控制列重播時再淡出
});
els.videoClose.addEventListener('click', closeVideo);

/* ==========================================================
   鍵盤：空白鍵 / 右方向鍵翻頁，A–D 或 1–4 選答案
   ========================================================== */
function isTyping(target) {
  return target instanceof Element && !!target.closest('textarea, input, select, [contenteditable="true"]');
}
// 用 Tab 移到按鈕上時，空白鍵照原生行為按下那顆按鈕；滑鼠點過的按鈕則空白鍵照樣翻頁
// （:focus-visible 對滑鼠點過的按鈕不可靠，自己記最近的操作方式）
let tabbing = false;
document.addEventListener('pointerdown', () => { tabbing = false; }, true);
function isKeyboardFocusedButton(target) {
  return tabbing && target instanceof Element && target.matches('button');
}

// Esc 用 capture：焦點在影片內建控制列上時，冒泡階段的 Esc 會被瀏覽器吃掉
document.addEventListener('keydown', (e) => {
  if (state.videoOpen && e.key === 'Escape') { e.preventDefault(); closeVideo(); }
}, true);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Tab') tabbing = true;
  if (state.videoOpen) return;
  if (isTyping(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;

  if (e.key === ' ' && isKeyboardFocusedButton(e.target)) return;
  if (e.key === ' ' || e.key === 'ArrowRight') {
    e.preventDefault(); // 也擋掉空白鍵對（滑鼠點過的）焦點按鈕的 click
    if (!e.repeat) advance();
    return;
  }
  const p = PAGES[state.page];
  if (state.opened && !state.busy && p.kind === 'quiz') {
    const k = 'abcd'.indexOf(e.key.toLowerCase()) >= 0 ? 'abcd'.indexOf(e.key.toLowerCase()) : '1234'.indexOf(e.key);
    if (k >= 0) { e.preventDefault(); choose(p.index, k); }
  }
});
document.addEventListener('keyup', (e) => {
  if (e.key === ' ' && !isTyping(e.target) && !isKeyboardFocusedButton(e.target) && !state.videoOpen) e.preventDefault();
});

/* ==========================================================
   夜空：星星微閃 + 偶爾的流星
   ========================================================== */
const sky = $('sky');
const skyCtx = sky.getContext('2d');
const fx = $('fx');
const fxCtx = fx.getContext('2d');
let W = 0, H = 0, DPR = 1;
let K = 1; // 畫布元素的縮放：以 1920×1080 為 1，螢幕更大時跟著放大（4K = 2）
let stars = [];
const meteors = [];   // 夜空層（信紙後面）
const sparkles = [];  // 前景層（成績周圍）

function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth; H = window.innerHeight;
  K = Math.max(1, Math.min(W / 1920, H / 1080));
  for (const c of [sky, fx]) {
    c.width = Math.round(W * DPR); c.height = Math.round(H * DPR);
  }
  skyCtx.setTransform(DPR, 0, 0, DPR, 0, 0);
  fxCtx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const count = Math.round(Math.min(CONFIG.starMax, (W * H * CONFIG.starDensity) / (K * K))); // 大螢幕星星跟著變大，數量維持和 1080p 一樣的觀感
  stars = Array.from({ length: count }, () => ({
    x: Math.random() * W,
    y: Math.random() * H * 0.92,
    r: K * (Math.random() < 0.88 ? 0.6 + Math.random() * 0.9 : 1.6 + Math.random() * 0.9),
    a: 0.35 + Math.random() * 0.55,
    speed: 0.6 + Math.random() * 1.6,
    phase: Math.random() * Math.PI * 2,
  }));
  if (reduceMotion.matches) drawSky(0);
  layoutStrings();
}

function drawSky(t) {
  skyCtx.clearRect(0, 0, W, H);
  const still = reduceMotion.matches;
  for (const s of stars) {
    const tw = still ? 1 : 0.6 + 0.4 * Math.sin(t * 0.001 * CONFIG.twinkleSpeed * s.speed + s.phase);
    skyCtx.globalAlpha = s.a * tw;
    skyCtx.fillStyle = '#fffaf0';
    skyCtx.beginPath();
    skyCtx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    skyCtx.fill();
  }
  skyCtx.globalAlpha = 1;
  drawMeteors(skyCtx, meteors);
}

function spawnMeteor(list, delay = 0) {
  const fromLeft = Math.random() < 0.5;
  const speed = K * (900 + Math.random() * 700); // px/s
  const angle = (fromLeft ? 1 : -1) * (Math.PI / 5 + Math.random() * 0.25);
  list.push({
    x: fromLeft ? Math.random() * W * 0.6 : W * 0.4 + Math.random() * W * 0.6,
    y: -20 + Math.random() * H * 0.35,
    vx: Math.sin(angle) * speed,
    vy: Math.cos(angle) * speed,
    len: K * (140 + Math.random() * 160),
    life: 0,
    max: 0.9 + Math.random() * 0.6,
    delay,
  });
}

function drawMeteors(ctx, list) {
  for (const m of list) {
    if (m.delay > 0 || m.life <= 0) continue;
    const k = m.life / m.max;
    const alpha = k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85;
    const mag = Math.hypot(m.vx, m.vy);
    const tx = m.x - (m.vx / mag) * m.len;
    const ty = m.y - (m.vy / mag) * m.len;
    const g = ctx.createLinearGradient(m.x, m.y, tx, ty);
    g.addColorStop(0, `rgba(255, 246, 220, ${alpha})`);
    g.addColorStop(1, 'rgba(255, 246, 220, 0)');
    ctx.strokeStyle = g;
    ctx.lineWidth = 2.2 * K;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(tx, ty); ctx.stroke();
  }
}

function stepMeteors(list, dt) {
  for (let i = list.length - 1; i >= 0; i--) {
    const m = list[i];
    if (m.delay > 0) { m.delay -= dt; continue; }
    m.life += dt;
    m.x += m.vx * dt; m.y += m.vy * dt;
    if (m.life > m.max) list.splice(i, 1);
  }
}

function meteorShower() {
  for (let i = 0; i < CONFIG.showerCount; i++) spawnMeteor(meteors, i * 0.12 + Math.random() * 0.1);
}

function sparkleBurst(still) {
  const target = $('scoreNum');
  if (!target) return;
  const r = target.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const colors = ['#e8b85c', '#cc3346', '#f3e6c2', '#ffffff'];
  for (let i = 0; i < 46; i++) {
    const a = Math.random() * Math.PI * 2;
    const d = still ? r.width * (0.6 + Math.random() * 0.5) : 0;
    const v = still ? 0 : K * (220 + Math.random() * 420);
    sparkles.push({
      x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d * 0.6,
      vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.7,
      size: K * (5 + Math.random() * 9),
      rot: Math.random() * Math.PI,
      color: colors[i % colors.length],
      life: 0, max: 1.2 + Math.random() * 0.9,
      still,
    });
  }
}

function drawStar4(ctx, x, y, s, rot) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(rot);
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const rr = i % 2 === 0 ? s : s * 0.32;
    const a = (i / 8) * Math.PI * 2;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

function stepSparkles(dt) {
  fxCtx.clearRect(0, 0, W, H);
  for (let i = sparkles.length - 1; i >= 0; i--) {
    const p = sparkles[i];
    p.life += dt;
    if (p.life > p.max) { sparkles.splice(i, 1); continue; }
    if (!p.still) {
      p.vx *= 0.94; p.vy = p.vy * 0.94 + 40 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += dt * 2;
    }
    const k = p.life / p.max;
    fxCtx.globalAlpha = k < 0.1 ? k / 0.1 : 1 - k;
    fxCtx.fillStyle = p.color;
    drawStar4(fxCtx, p.x, p.y, p.size, p.rot);
  }
  fxCtx.globalAlpha = 1;
}

/* ==========================================================
   吉他弦：每次翻頁撥一根
   ========================================================== */
const stringsGroup = $('strings');
const strings = [];
const NUT_X = 214;
function layoutStrings() {
  if (strings.length) return;
  for (let i = 0; i < 6; i++) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('stroke-width', String(1.4 + i * 0.5));
    stringsGroup.appendChild(path);
    // 從琴頸上的 nut 往右上延伸出畫面
    strings.push({ path, y0: 818 + i * 30, y1: 560 + i * 26, amp: 0, t: 0 });
  }
  strings.forEach((s) => setString(s, 0));
}
function setString(s, offset) {
  const x1 = 2000;
  const mx = (NUT_X + x1) / 2, my = (s.y0 + s.y1) / 2 + offset;
  s.path.setAttribute('d', `M${NUT_X} ${s.y0} Q${mx} ${my} ${x1} ${s.y1}`);
}
function pluck(i) {
  if (reduceMotion.matches) return;
  strings[i].amp = 14;
  strings[i].t = 0;
}
function pluckAll() {
  if (reduceMotion.matches) return;
  strings.forEach((s, i) => { s.amp = 10; s.t = -i * 0.06; });
}
function stepStrings(dt) {
  for (const s of strings) {
    if (s.amp <= 0) continue;
    s.t += dt;
    if (s.t < 0) continue;
    const decay = Math.exp(-s.t * 2.2);
    if (decay < 0.02) { s.amp = 0; setString(s, 0); continue; }
    setString(s, s.amp * decay * Math.sin(s.t * 46));
  }
}

/* ==========================================================
   主迴圈
   ========================================================== */
let last = performance.now();
let nextAmbient = 2;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!reduceMotion.matches) {
    nextAmbient -= dt;
    if (nextAmbient <= 0) {
      spawnMeteor(meteors);
      if (Math.random() < CONFIG.meteorPairChance) spawnMeteor(meteors, 0.3 + Math.random() * 0.5);
      const [lo, hi] = CONFIG.meteorEvery;
      nextAmbient = lo + Math.random() * (hi - lo);
    }
    stepMeteors(meteors, dt);
    drawSky(now);
    stepStrings(dt);
  }
  if (sparkles.length || fx.dataset.dirty) {
    stepSparkles(dt);
    fx.dataset.dirty = sparkles.length ? '1' : '';
  }
  requestAnimationFrame(frame);
}

/* ========================================================== */
buildPages();
window.addEventListener('resize', resize);
reduceMotion.addEventListener('change', resize);
resize();
requestAnimationFrame(frame);
syncMusic(); // 一打開就播背景音樂
