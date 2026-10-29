/* ==========================================================
   CONFIG — 換影片時只要改 youtube（或 videoSrc）
   ========================================================== */
const CONFIG = {
  // 禮物影片：填 YouTube 網址（或 11 碼影片 ID）就用 YouTube 播；留空 '' 則改播 videoSrc 的 mp4
  // YouTube 影片要設成「不公開」（不能是「私人」），並允許嵌入
  youtube: 'https://www.youtube.com/watch?v=6Wi2W2i5rh0',
  videoSrc: 'assets/video.mp4',
  bgmSrc: 'assets/bgm.mp3',
  bgmVolume: 0.3,      // 背景音樂預設音量（0–1）；觀眾用音量拉桿調過後會記在自己的瀏覽器
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

  // 吹蠟燭（麥克風）：吹不熄就調低 blowLevel；講話就誤觸就調高 blowFlatness 或 blowHoldMs
  // 網址加上 ?debug 會直接跳到蛋糕頁，並顯示麥克風收到的數值，方便校準
  blowLevel: 0.035,    // 音量門檻上限（RMS，0–1）；實際門檻會依背景噪音自動調低
  blowLevelMin: 0.006, // 音量門檻下限（麥克風收音很小時用）
  blowOverFloor: 4,    // 門檻 = 背景噪音 × 這個倍數
  blowFlatness: 0.4,   // 低頻「像雜訊」的程度（0–1）：模擬時講話約 0.2–0.3、吹氣約 0.7
  blowHoldMs: 450,     // 累積吹多久才全部熄滅（三根蠟燭依序熄）
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

// 回顧短片（kind: 'clip'）：youtube 填網址或影片 ID；caption 是短片旁的文字，留空 '' 就只放短片
const PAGES = [
  { kind: 'text', html: '<span class="line">首先，</span><span class="line">恭喜3.0募資成功、三週年快樂</span><span class="line">還有最重要的</span><span class="big">生日快樂</span>' },
  { kind: 'text', html: '<span class="line">在週年紀念日裡，</span><span class="line">希望跟大家一起回顧</span><span class="line">一些特別的片段</span>' },
  { kind: 'clip', youtube: 'https://youtube.com/shorts/XF5P75MUoIA', caption: '' },
  { kind: 'clip', youtube: 'https://youtube.com/shorts/6iTpPFWlfKU', caption: '' },
  { kind: 'clip', youtube: 'https://youtube.com/shorts/u3NtJbVkXWY', caption: '' },
  { kind: 'clip', youtube: 'https://www.youtube.com/shorts/CFiv3WnW6Qw', caption: '' },
  { kind: 'text', html: '<span class="line">雖然你真的很怪，但....</span>' },
  { kind: 'text', html: '<span class="big">也很帥</span>' },
  { kind: 'clip', youtube: 'https://youtube.com/shorts/Np53Ke76G2A', caption: '<span class="line">唱著平庸的你，</span><span class="line">其實一點也不平庸</span>' },
  { kind: 'clip', youtube: 'https://youtube.com/shorts/t0Vo1RvpU88', caption: '<span class="line">確實，</span><span class="line">我們買了一張</span><span class="line">通往你的單程票</span>' },
  { kind: 'text', html: '<span class="line">再來，在這個特別的日子裡</span><span class="line">有個小測驗給你</span>' },
  ...QUIZ.map((q, i) => ({ kind: 'quiz', index: i, ...q })),
  { kind: 'essay' },
  { kind: 'score' },
  { kind: 'final' },
  { kind: 'cake' },
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
  giftWatched: false, // 禮物影片看完了，才出現往蛋糕頁的「下一頁」
  clipPlaying: false, // 回顧短片播放中（背景音樂要讓開）
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
  prev: $('prevBtn'),
  progressNum: $('progressNum'),
  musicCtrl: $('musicCtrl'),
  musicToggle: $('musicToggle'),
  volumeBtn: $('volumeBtn'),
  volumePop: $('volumePop'),
  volumeSlider: $('volumeSlider'),
  volumeNum: $('volumeNum'),
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

/* ==========================================================
   Background music：用 audio.volume 做淡入淡出
   （不用 WebAudio，雙擊 file:// 開啟時也能正常出聲）
   ========================================================== */
// iOS Safari 的 volume 是唯讀（永遠 1）：淡入淡出做不到，改成直接播放 / 暫停
const canSetVolume = (() => { const a = new Audio(); a.volume = 0.5; return a.volume === 0.5; })();

let bgmVolume = CONFIG.bgmVolume;
try {
  const saved = parseFloat(localStorage.getItem('bgmVolume'));
  if (saved >= 0 && saved <= 1) bgmVolume = saved;
} catch (e) { /* 讀不到就用預設 */ }

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
  const videoPlaying = (state.videoOpen && !state.videoEnded) || state.clipPlaying;
  const want = state.musicOn && !videoPlaying;
  if (want) {
    if (els.bgm.paused) {
      els.bgm.play().then(() => {
        audioUnlocked = true;
        fadeBgm(bgmVolume, CONFIG.bgmFadeInMs);
      }).catch(() => {
        if (!audioUnlocked) waitForGesture();
        else if (els.bgm.paused) setMusicOn(false); // 播過之後又被擋：音樂鈕切成「關」，讓使用者點一下重試
      });
    } else {
      fadeBgm(bgmVolume, CONFIG.bgmFadeInMs);
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

// 音量拉桿：調過的音量記在觀眾自己的瀏覽器，下次打開沿用
function setBgmVolume(v) {
  bgmVolume = v;
  els.volumeSlider.value = String(Math.round(v * 100));
  els.volumeNum.textContent = String(Math.round(v * 100));
  const audible = state.musicOn && !(state.videoOpen && !state.videoEnded) && !state.clipPlaying && !els.bgm.paused;
  if (audible) { clearInterval(fadeTimer); els.bgm.volume = v; }
}
function openVolume(open) {
  els.volumePop.hidden = !open;
  els.volumeBtn.setAttribute('aria-expanded', String(open));
}

if (canSetVolume) {
  setBgmVolume(bgmVolume);
  els.volumeBtn.addEventListener('click', () => openVolume(els.volumePop.hidden));
  els.volumeSlider.addEventListener('input', () => setBgmVolume(Number(els.volumeSlider.value) / 100));
  els.volumeSlider.addEventListener('change', () => {
    try { localStorage.setItem('bgmVolume', String(bgmVolume)); } catch (e) { /* 無痕模式等存不了就算了 */ }
  });
  document.addEventListener('pointerdown', (e) => {
    if (!els.volumePop.hidden && !els.musicCtrl.contains(e.target)) openVolume(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !els.volumePop.hidden) { openVolume(false); els.volumeBtn.focus(); }
  });
} else {
  els.volumeBtn.hidden = true; // iOS 不能用程式調音量，只能用手機的音量鍵
}

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
        + '<textarea class="answer-box" id="answerBox" rows="3" maxlength="200" placeholder="寫在這裡（也可以直接說出來）"></textarea>';
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
    } else if (p.kind === 'clip') {
      // 播放器等翻到這頁才建立（不要一開信就載入六支影片）
      if (!p.caption) page.classList.add('clip-only');
      page.innerHTML = (p.caption ? `<p class="letter-text clip-caption">${p.caption}</p>` : '')
        + `<div class="clip-frame"><div id="clip${i}"></div></div>`;
    } else if (p.kind === 'cake') {
      page.innerHTML = cakeHTML();
    }
    els.pages.appendChild(page);

    const dot = document.createElement('li');
    dot.setAttribute('aria-hidden', 'true');
    els.progress.appendChild(dot);
  });
  $('giftBtn').addEventListener('click', openVideo);
  setupCake();
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
  if (p.kind === 'final') return state.giftWatched;
  return p.kind !== 'cake'; // 蛋糕頁是最後一頁，往下走的是「點開這裡」
}

// 第一頁以外都可以回上一頁
function canRetreat() {
  return state.page > 0;
}

function updateNav() {
  const p = PAGES[state.page];
  // 只隱藏、保留位置，上一頁鈕才不會跳動；禮物影片看完前不出現
  els.next.classList.toggle('is-off', p.kind === 'cake' || (p.kind === 'final' && !state.giftWatched));
  els.next.disabled = !canAdvance();
  els.progressNum.textContent = `${state.page + 1} / ${PAGES.length}`;
  els.prev.classList.toggle('is-off', !canRetreat());
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
  if (DEBUG) { // 偵錯：直接到蛋糕頁
    state.giftWatched = true;
    state.answers.fill(0);
    state.page = PAGES.findIndex((p) => p.kind === 'cake');
  }
  pageEl(state.page).classList.add('is-current');
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
function advance() {
  if (!state.opened) { openEnvelope(); return; }
  if (state.busy || state.videoOpen || !canAdvance()) return;
  turn(1);
}
function retreat() {
  if (!state.opened || state.busy || state.videoOpen || !canRetreat()) return;
  turn(-1);
}

// dir = 1 往後翻，-1 往前翻（動畫方向相反）
async function turn(dir) {
  state.busy = true;

  const fromKind = PAGES[state.page].kind;
  const from = pageEl(state.page);
  state.page += dir;
  const to = pageEl(state.page);
  const kind = PAGES[state.page].kind;
  const replayScore = kind === 'score' && dir > 0; // 從禮物頁退回成績頁時不重播，直接顯示 100 分
  const unlock = wait(replayScore && !reduceMotion.matches ? CONFIG.scoreLockMs : CONFIG.turnLockMs);

  if (kind === 'final') prepareFinal();
  if (fromKind === 'score') {
    sparkles.length = 0; // 成績頁的星星不要飄到下一頁
    if (dir < 0) { from.classList.remove('is-graded'); $('scoreNum').textContent = '0'; } // 再進成績頁時重播數分數、畫紅圈
  }
  if (fromKind === 'clip') pauseClip(state.page - dir); // 翻頁就停掉短片
  if (fromKind === 'cake') stopListening();
  if (kind === 'clip') ensureClip(state.page);
  pluck(state.page % 6);

  const rm = reduceMotion.matches;
  const outFrames = rm ? [{ opacity: 1 }, { opacity: 0 }]
    : [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translateX(${-5 * dir}%) rotate(${-dir}deg)` }];
  const inFrames = rm ? [{ opacity: 0 }, { opacity: 1 }]
    : [{ opacity: 0, transform: `translateX(${5 * dir}%)` }, { opacity: 1, transform: 'none' }];

  await from.animate(outFrames, { duration: rm ? 160 : 240, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' }).finished;
  from.classList.remove('is-current');
  to.classList.add('is-current');
  updateNav();
  const enter = to.animate(inFrames, { duration: rm ? 200 : 380, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' });

  if (kind === 'essay') {
    $('answerBox').focus({ preventScroll: true });
  } else {
    // 把焦點從上一頁的按鈕移走，避免空白鍵觸發到看不見的按鈕
    const active = document.activeElement;
    if (active && (els.pages.contains(active) || (active === els.prev && !canRetreat()))) els.paper.focus({ preventScroll: true });
  }
  if (replayScore) celebrate(to);

  await Promise.all([enter.finished, unlock]);
  state.busy = false;
}
els.next.addEventListener('click', advance);
els.prev.addEventListener('click', retreat);

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
   禮物影片：YouTube（CONFIG.youtube）或 mp4（CONFIG.videoSrc）
   兩種都走同一組事件：onGiftPlay / onGiftEnded / onGiftError
   ========================================================== */
function onGiftPlay() {
  els.videoError.hidden = true;
  if (state.videoOpen && state.videoEnded) { state.videoEnded = false; syncMusic(); } // 用控制列重播時再淡出
}
function onGiftEnded() { state.videoEnded = true; markGiftWatched(); syncMusic(); }
function onGiftError(message) {
  els.videoError.textContent = message;
  els.videoError.hidden = false;
  state.videoEnded = true;
  markGiftWatched(); // 影片壞掉也不能卡住，讓她能繼續往下
  syncMusic();
}
function markGiftWatched() {
  if (state.giftWatched) return;
  state.giftWatched = true;
  updateNav();
}

function parseYoutubeId(s) {
  if (!s) return '';
  const m = s.match(/(?:v=|youtu\.be\/|embed\/|shorts\/|live\/)([\w-]{11})/);
  return m ? m[1] : (/^[\w-]{11}$/.test(s) ? s : '');
}
const YT_ID = parseYoutubeId(CONFIG.youtube);

let yt = null;          // YT.Player
let ytReady = false;
let ytPending = false;  // 播放器還沒準備好時就按了禮物
let ytFailed = '';      // API 載入失敗的訊息

// YouTube IFrame API：禮物影片和回顧短片共用，只載入一次
const ytApi = new Promise((resolve, reject) => {
  window.onYouTubeIframeAPIReady = () => resolve(window.YT);
  const api = document.createElement('script');
  api.src = 'https://www.youtube.com/iframe_api';
  api.onerror = reject;
  document.head.appendChild(api);
});

if (YT_ID) {
  els.video.remove();
  ytApi.then(() => {
    yt = new YT.Player('ytPlayer', {
      videoId: YT_ID,
      playerVars: { playsinline: 1, rel: 0 },
      events: {
        onReady: () => {
          ytReady = true;
          if (ytPending && state.videoOpen) yt.playVideo();
          ytPending = false;
        },
        onStateChange: (e) => {
          if (e.data === YT.PlayerState.PLAYING) onGiftPlay();
          else if (e.data === YT.PlayerState.ENDED) onGiftEnded();
        },
        // 101 / 150：影片不允許嵌入（多半是版權或上傳設定）；100：影片不存在或是「私人」；153：缺少來源（用 file:// 開啟）
        onError: (e) => onGiftError(
          e.data === 101 || e.data === 150 ? '這支 YouTube 影片不允許嵌入播放（請確認上傳設定或版權聲明）'
          : e.data === 100 ? '找不到這支 YouTube 影片（可能被刪除或設成「私人」）'
          : e.data === 153 ? 'YouTube 影片要從網址開啟網頁才能播放，不能直接雙擊 html 檔'
          : `YouTube 影片無法播放（錯誤 ${e.data}）`),
      },
    });
  }).catch(() => { ytFailed = 'YouTube 載入失敗，請檢查網路連線'; });
} else {
  $('ytPlayer').remove();
  els.video.src = CONFIG.videoSrc;
  els.video.addEventListener('ended', onGiftEnded);
  els.video.addEventListener('error', () => onGiftError('影片載入失敗，請確認 assets 裡的影片檔'));
  els.video.addEventListener('play', onGiftPlay);
}

function giftPlayFromStart() {
  if (!YT_ID) {
    els.video.currentTime = 0;
    // 播不起來（被擋、載入失敗）就先把音樂恢復；之後按控制列播放時 play 事件會再淡出
    els.video.play().catch(() => { if (state.videoOpen && els.video.paused) { state.videoEnded = true; syncMusic(); } });
    return;
  }
  if (ytFailed) { onGiftError(ytFailed); return; }
  if (ytReady) { yt.seekTo(0, true); yt.playVideo(); } else ytPending = true;
}

function giftNearEnd() {
  if (!YT_ID) return els.video.duration > 0 && els.video.currentTime / els.video.duration >= 0.95;
  if (!ytReady) return false;
  const d = yt.getDuration();
  return d > 0 && yt.getCurrentTime() / d >= 0.95;
}

/* ==========================================================
   回顧短片：翻到那頁才建立播放器，由她自己按播放
   ========================================================== */
const clips = new Map(); // 頁碼 → YT.Player

function ensureClip(i) {
  if (clips.has(i)) return;
  clips.set(i, null);
  const id = parseYoutubeId(PAGES[i].youtube);
  ytApi.then(() => {
    const player = new YT.Player(`clip${i}`, {
      videoId: id,
      playerVars: { playsinline: 1, rel: 0 },
      events: {
        onReady: () => clips.set(i, player),
        onStateChange: (e) => {
          const playing = e.data === YT.PlayerState.PLAYING || e.data === YT.PlayerState.BUFFERING;
          // 只有目前這頁的短片能讓背景音樂讓開
          if (i !== state.page) return;
          if (playing !== state.clipPlaying) { state.clipPlaying = playing; syncMusic(); }
        },
      },
    });
  }).catch(() => {
    $(`clip${i}`).textContent = 'YouTube 載入失敗，請檢查網路連線';
  });
}

function pauseClip(i) {
  const player = clips.get(i);
  if (player) player.pauseVideo();
  if (state.clipPlaying) { state.clipPlaying = false; syncMusic(); }
}

function giftPause() {
  if (!YT_ID) { els.video.pause(); return; }
  ytPending = false;
  if (ytReady) yt.pauseVideo();
}

function openVideo() {
  if (state.videoOpen) return;
  state.videoOpen = true;
  state.videoEnded = false;
  els.videoLayer.hidden = false;
  els.stage.inert = true;
  openVolume(false);
  els.musicCtrl.inert = true;
  els.videoError.hidden = true;
  giftPlayFromStart(); // 「再看一次」一律從頭播
  syncMusic();
  els.videoLayer.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 280, easing: 'ease-out' });
  els.videoClose.focus({ preventScroll: true });
}

function closeVideo() {
  if (!state.videoOpen) return;
  if (giftNearEnd()) markGiftWatched(); // 快播完才關掉也算看完
  giftPause();
  state.videoOpen = false;
  els.stage.inert = false;
  els.musicCtrl.inert = false;
  syncMusic();
  els.videoLayer.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: 'ease-out' })
    .finished.then(() => { if (!state.videoOpen) els.videoLayer.hidden = true; });
  $('giftLabel').textContent = '再看一次';
  $('giftBtn').focus({ preventScroll: true });
}

els.videoClose.addEventListener('click', closeVideo);

/* ==========================================================
   許願：蛋糕、對著麥克風吹蠟燭（麥克風不能用時點蠟燭也可以）
   ========================================================== */
const CANDLES = [110, 150, 190];

function cakeHTML() {
  const candles = CANDLES.map((x) => (
    `<g class="candle"><rect x="${x - 6}" y="52" width="12" height="44" rx="3" class="candle-body"/>`
    + `<path d="M${x - 6} 62 l12 -6 M${x - 6} 76 l12 -6 M${x - 6} 90 l12 -6" class="candle-stripe"/>`
    + `<line x1="${x}" y1="52" x2="${x}" y2="45" class="wick"/>`
    + `<g class="flame" style="transform-origin:${x}px 46px"><ellipse cx="${x}" cy="34" rx="12" ry="16" class="flame-glow"/>`
    + `<path d="M${x} 18 C ${x + 9} 30, ${x + 8} 44, ${x} 46 C ${x - 8} 44, ${x - 9} 30, ${x} 18 Z" class="flame-outer"/>`
    + `<path d="M${x} 30 C ${x + 4} 37, ${x + 4} 44, ${x} 45 C ${x - 4} 44, ${x - 4} 37, ${x} 30 Z" class="flame-inner"/></g>`
    + `<g class="smoke" style="transform-origin:${x}px 40px"><circle cx="${x}" cy="38" r="4"/><circle cx="${x + 4}" cy="28" r="5"/><circle cx="${x - 2}" cy="16" r="6"/></g></g>`
  )).join('');
  return '<h2 class="cake-title">許願時間</h2>'
    + '<div class="cake-wrap">'
    + stickersHTML()
    + '<button class="cake" id="cake" type="button" aria-label="吹熄蠟燭">'
    + '<svg viewBox="0 0 300 240" aria-hidden="true">'
    + '<ellipse cx="150" cy="226" rx="132" ry="13" class="plate"/>'
    + '<rect x="40" y="148" width="220" height="76" rx="12" class="tier"/>'
    + '<path d="M40 162 q0 -14 14 -14 h192 q14 0 14 14 v6 q-11 10 -22 0 q-11 12 -22 0 q-11 10 -22 0 q-11 12 -22 0 q-11 10 -22 0 q-11 12 -22 0 q-11 10 -22 0 q-11 12 -22 0 q-11 10 -22 0 q-11 12 -22 0 z" class="frost"/>'
    + '<rect x="72" y="94" width="156" height="58" rx="10" class="tier tier-top"/>'
    + '<path d="M72 106 q0 -12 12 -12 h132 q12 0 12 12 v5 q-10 9 -19.5 0 q-10 11 -19.5 0 q-10 9 -19.5 0 q-10 11 -19.5 0 q-10 9 -19.5 0 q-10 11 -19.5 0 q-10 9 -19.5 0 q-10 11 -19.5 0 z" class="frost"/>'
    + '<g class="berries"><circle cx="70" cy="196" r="7"/><circle cx="110" cy="200" r="7"/><circle cx="150" cy="196" r="7"/><circle cx="190" cy="200" r="7"/><circle cx="230" cy="196" r="7"/></g>'
    + '<g class="sprinkles"><rect x="95" y="128" width="8" height="3" rx="1.5" transform="rotate(-30 99 129)"/><rect x="140" y="132" width="8" height="3" rx="1.5" transform="rotate(20 144 133)"/><rect x="185" y="126" width="8" height="3" rx="1.5" transform="rotate(-50 189 127)"/><rect x="120" y="138" width="8" height="3" rx="1.5" transform="rotate(60 124 139)"/><rect x="200" y="140" width="8" height="3" rx="1.5" transform="rotate(10 204 141)"/></g>'
    + candles
    + '</svg></button></div>'
    + '<p class="cake-hint" id="cakeHint">準備好了就按「開始許願」</p>'
    + '<pre class="mic-debug" id="micDebug" hidden></pre>'
    + '<div class="wish-slot"><div class="mic-meter" id="micMeter" hidden><span id="micLevel"></span></div>'
    + '<button class="gift-btn wish-btn" id="wishBtn" type="button"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15a3.5 3.5 0 0 0 3.5-3.5v-5a3.5 3.5 0 0 0-7 0v5A3.5 3.5 0 0 0 12 15zm6-3.5a6 6 0 0 1-12 0H4.5a7.5 7.5 0 0 0 6.75 7.46V21h1.5v-2.04a7.5 7.5 0 0 0 6.75-7.46z"/></svg>開始許願</button></div>'
    + '<div class="wish-done" id="wishDone" hidden>'
    + '<p class="wish-done-big">祝你生日快樂</p>'
    + '<p class="wish-done-line">最後一個小禮物，</p>'
    + '<button class="gift-btn" id="boardBtn" type="button">點開這裡</button></div>';
}

// 蛋糕旁的奇怪貼圖（之後可以換成實況貼圖）
function stickersHTML() {
  const s = (cls, body) => `<svg class="sticker ${cls}" viewBox="0 0 100 100" aria-hidden="true">${body}</svg>`;
  return s('st-ghost', // 恐遊
    '<path d="M20 90 V45 a30 30 0 0 1 60 0 V90 l-10 -8 -10 8 -10 -8 -10 8 -10 -8 z" fill="#fffaf0" stroke="#1d2858" stroke-width="4" stroke-linejoin="round"/>'
    + '<circle cx="40" cy="45" r="5" fill="#1d2858"/><circle cx="60" cy="45" r="5" fill="#1d2858"/><ellipse cx="50" cy="60" rx="5" ry="7" fill="#1d2858"/>'
    + '<ellipse cx="32" cy="56" rx="5" ry="3" fill="#f2a7b3"/><ellipse cx="68" cy="56" rx="5" ry="3" fill="#f2a7b3"/>')
    + s('st-chick', // 小雞汁
      '<ellipse cx="50" cy="62" rx="30" ry="26" fill="#ffd84d" stroke="#1d2858" stroke-width="4"/><circle cx="50" cy="36" r="20" fill="#ffd84d" stroke="#1d2858" stroke-width="4"/>'
      + '<path d="M44 22 q4 -12 8 0 q4 -10 7 1" fill="none" stroke="#1d2858" stroke-width="3" stroke-linecap="round"/>'
      + '<circle cx="43" cy="34" r="3.5" fill="#1d2858"/><circle cx="57" cy="34" r="3.5" fill="#1d2858"/><path d="M45 42 l5 7 l5 -7 z" fill="#e8873a" stroke="#1d2858" stroke-width="2.5" stroke-linejoin="round"/>'
      + '<path d="M26 62 q-10 -2 -8 8" fill="none" stroke="#1d2858" stroke-width="4" stroke-linecap="round"/>')
    + s('st-melon', // 拍西瓜
      '<path d="M10 40 a40 40 0 0 0 80 0 z" fill="#3f9a57" stroke="#1d2858" stroke-width="4" stroke-linejoin="round"/><path d="M17 40 a33 33 0 0 0 66 0 z" fill="#ff6b7a"/>'
      + '<g fill="#1d2858"><ellipse cx="35" cy="52" rx="2.5" ry="4"/><ellipse cx="50" cy="60" rx="2.5" ry="4"/><ellipse cx="65" cy="52" rx="2.5" ry="4"/><ellipse cx="50" cy="47" rx="2.5" ry="4"/></g>')
    + s('st-hat', // 派對帽
      '<path d="M50 8 L80 88 H20 Z" fill="#cc3346" stroke="#1d2858" stroke-width="4" stroke-linejoin="round"/><path d="M36 50 L64 40 M28 72 L72 58" stroke="#ffd84d" stroke-width="7" stroke-linecap="round"/>'
      + '<circle cx="50" cy="9" r="8" fill="#ffd84d" stroke="#1d2858" stroke-width="3.5"/>')
    + s('st-note', // 歌回
      '<path d="M38 74 V20 l40 -8 v52" fill="none" stroke="#1d2858" stroke-width="6" stroke-linejoin="round"/><ellipse cx="30" cy="76" rx="12" ry="9" fill="#e8b85c" stroke="#1d2858" stroke-width="4"/>'
      + '<ellipse cx="70" cy="66" rx="12" ry="9" fill="#e8b85c" stroke="#1d2858" stroke-width="4"/><circle cx="27" cy="74" r="2" fill="#1d2858"/><circle cx="33" cy="74" r="2" fill="#1d2858"/>')
    + s('st-star',
      '<path d="M50 6 L61 37 H94 L67 56 L77 88 L50 69 L23 88 L33 56 L6 37 H39 Z" fill="#ffd84d" stroke="#1d2858" stroke-width="4" stroke-linejoin="round"/>'
      + '<path d="M38 50 h8 M54 50 h8" stroke="#1d2858" stroke-width="4" stroke-linecap="round"/><path d="M42 60 q8 7 16 0" fill="none" stroke="#1d2858" stroke-width="3.5" stroke-linecap="round"/>');
}

let blown = false;
let mic = null; // { stream, ctx, raf }
const DEBUG = new URLSearchParams(location.search).has('debug');
const blowOutDisabled = new URLSearchParams(location.search).has('nofire'); // ?debug&nofire：只看數值、不會真的吹熄

function setupCake() {
  $('wishBtn').addEventListener('click', startWish);
  $('cake').addEventListener('click', () => blowOut()); // 備案：點蠟燭也能吹熄
  $('boardBtn').addEventListener('click', () => window.openBoard?.());
}

async function startWish() {
  const hint = $('cakeHint');
  $('wishBtn').hidden = true;
  hint.textContent = '正在開啟麥克風…';
  let stream;
  try {
    // 關掉降噪 / 自動增益，不然吹氣聲會被濾掉
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
  } catch (e) {
    hint.textContent = '沒辦法使用麥克風，直接點一下蠟燭也能吹熄喔';
    return;
  }
  if (blown || PAGES[state.page].kind !== 'cake') { stream.getTracks().forEach((t) => t.stop()); return; }

  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  ctx.createMediaStreamSource(stream).connect(analyser);
  mic = { stream, ctx, raf: 0 };
  const debugEl = DEBUG ? $('micDebug') : null;
  if (debugEl) debugEl.hidden = false;
  let peakRms = 0, peakFlat = 0, peakAt = 0;
  hint.textContent = '閉上眼睛許個願，然後對著麥克風吹一口氣～';
  $('micMeter').hidden = false;

  const time = new Float32Array(analyser.fftSize);
  const freq = new Float32Array(analyser.frequencyBinCount);
  // 只看 40–1000Hz：對著麥克風吹氣的風切聲集中在低頻，而且在這段很平均；講話在這段有明顯的音高峰值
  const hz = (f) => Math.round((f / (ctx.sampleRate / 2)) * freq.length);
  const lowBin = Math.max(1, hz(40)), maxBin = hz(1000);
  // 門檻跟著環境自動校準：持續追蹤背景噪音，門檻 = 背景的幾倍（但不會比 blowLevel 更嚴）
  let floor = 1;
  let score = 0; // 累積吹氣時間（ms）；中途換氣只會慢慢扣，不會歸零
  let last = performance.now();
  const candles = [...document.querySelectorAll('.cake .candle')];
  const listen = (now) => {
    const dt = Math.min(100, now - last);
    last = now;
    analyser.getFloatTimeDomainData(time);
    let sum = 0;
    for (const v of time) sum += v * v;
    const rms = Math.sqrt(sum / time.length);
    // 頻譜平坦度：吹氣像雜訊（平坦），講話有明顯的音高（不平坦）
    analyser.getFloatFrequencyData(freq);
    let logSum = 0, linSum = 0;
    for (let b = lowBin; b < maxBin; b++) {
      const pw = Math.max(1e-12, 10 ** (freq[b] / 10));
      logSum += Math.log(pw); linSum += pw;
    }
    const n = maxBin - lowBin;
    const flatness = Math.exp(logSum / n) / (linSum / n);

    floor = Math.min(rms, floor * 1.003 + 1e-6); // 往下立刻跟、往上慢慢爬
    const level = Math.min(CONFIG.blowLevel, Math.max(CONFIG.blowLevelMin, floor * CONFIG.blowOverFloor));
    const blowing = rms > level && flatness > CONFIG.blowFlatness;
    score = blowing ? score + dt : Math.max(0, score - dt * 0.5);

    // 即時回饋：音量條、火焰跟著吹氣變小，蠟燭一根一根熄
    $('micLevel').style.transform = `scaleX(${Math.min(1, rms / level)})`;
    const cake = $('cake');
    cake.style.setProperty('--blow', blowing ? Math.min(1, rms / level / 2) : 0);
    const out = Math.floor((score / CONFIG.blowHoldMs) * candles.length);
    candles.forEach((c, i) => c.classList.toggle('is-out', i < out));

    if (debugEl) {
      if (now - peakAt > 3000) { peakRms = 0; peakFlat = 0; peakAt = now; } // 每 3 秒重算最大值
      peakRms = Math.max(peakRms, rms); peakFlat = Math.max(peakFlat, flatness);
      debugEl.textContent = `麥克風：${stream.getAudioTracks()[0]?.label || '?'}\n`
        + `音量 ${rms.toFixed(4)}（3 秒內最大 ${peakRms.toFixed(4)}）目前門檻 ${level.toFixed(4)}（背景 ${floor.toFixed(4)}）\n`
        + `雜訊度 ${flatness.toFixed(3)}（3 秒內最大 ${peakFlat.toFixed(3)}）門檻 ${CONFIG.blowFlatness}\n`
        + (blowing ? '→ 判定：吹氣中' : '→ 判定：沒有吹');
      if (blowOutDisabled) { score = Math.min(score, CONFIG.blowHoldMs * 0.99); mic.raf = requestAnimationFrame(listen); return; }
    }
    if (score >= CONFIG.blowHoldMs) { blowOut(); return; }
    mic.raf = requestAnimationFrame(listen);
  };
  mic.raf = requestAnimationFrame(listen);
}

function stopListening() {
  if (!mic) return;
  cancelAnimationFrame(mic.raf);
  mic.stream.getTracks().forEach((t) => t.stop());
  mic.ctx.close();
  mic = null;
  $('micMeter').hidden = true;
  if (!blown) {
    $('cake').style.setProperty('--blow', 0);
    document.querySelectorAll('.cake .candle').forEach((c) => c.classList.remove('is-out'));
    $('wishBtn').hidden = false;
    $('cakeHint').textContent = '準備好了就按「開始許願」';
  }
}

async function blowOut() {
  if (blown) return;
  blown = true;
  stopListening();
  $('wishBtn').hidden = true;
  $('cakeHint').textContent = '';
  const cake = $('cake');
  cake.style.setProperty('--blow', 0);
  cake.classList.add('is-out');
  cake.disabled = true;
  pluckAll();
  await wait(reduceMotion.matches ? 300 : 1400);
  const done = $('wishDone');
  done.hidden = false;
  if (!reduceMotion.matches) {
    done.animate([{ opacity: 0, transform: 'translateY(16px) scale(0.96)' }, { opacity: 1, transform: 'none' }],
      { duration: 600, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' });
  }
  meteorShower();
  $('boardBtn').focus({ preventScroll: true });
}

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
  if (e.key === 'ArrowLeft') {
    e.preventDefault();
    if (!e.repeat) retreat();
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
