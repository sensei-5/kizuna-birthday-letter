/* ==========================================================
   夜空背景（留言頁、管理頁共用）：星星微閃、流星、吉他弦
   和生日信 main.js 的夜空同一套參數；頁面需有 #sky canvas 與 #strings
   用法：window.sky.pluckAll() 撥一下所有弦（例如送出留言時）
   ========================================================== */
(() => {
  const SKY = {
    starDensity: 1 / 3800, starMax: 600, twinkleSpeed: 1.5,
    meteorEvery: [3, 6], meteorPairChance: 0.3,
  };
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const canvas = document.getElementById('sky');
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, K = 1;
  let stars = [];
  const meteors = [];

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    K = Math.max(1, Math.min(W / 1920, H / 1080));
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.round(Math.min(SKY.starMax, (W * H * SKY.starDensity) / (K * K)));
    stars = Array.from({ length: count }, () => ({
      x: Math.random() * W,
      y: Math.random() * H * 0.92,
      r: K * (Math.random() < 0.88 ? 0.6 + Math.random() * 0.9 : 1.6 + Math.random() * 0.9),
      a: 0.35 + Math.random() * 0.55,
      speed: 0.6 + Math.random() * 1.6,
      phase: Math.random() * Math.PI * 2,
    }));
    if (reduceMotion.matches) draw(0);
  }

  function draw(t) {
    ctx.clearRect(0, 0, W, H);
    const still = reduceMotion.matches;
    for (const s of stars) {
      const tw = still ? 1 : 0.6 + 0.4 * Math.sin(t * 0.001 * SKY.twinkleSpeed * s.speed + s.phase);
      ctx.globalAlpha = s.a * tw;
      ctx.fillStyle = '#fffaf0';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const m of meteors) {
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

  function spawnMeteor(delay = 0) {
    const fromLeft = Math.random() < 0.5;
    const speed = K * (900 + Math.random() * 700);
    const angle = (fromLeft ? 1 : -1) * (Math.PI / 5 + Math.random() * 0.25);
    meteors.push({
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

  function stepMeteors(dt) {
    for (let i = meteors.length - 1; i >= 0; i--) {
      const m = meteors[i];
      if (m.delay > 0) { m.delay -= dt; continue; }
      m.life += dt;
      m.x += m.vx * dt; m.y += m.vy * dt;
      if (m.life > m.max) meteors.splice(i, 1);
    }
  }

  /* ============ 吉他弦 ============ */
  const group = document.getElementById('strings');
  const strings = [];
  const NUT_X = 214;
  for (let i = 0; i < 6; i++) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('stroke-width', String(1.4 + i * 0.5));
    group.appendChild(path);
    strings.push({ path, y0: 818 + i * 30, y1: 560 + i * 26, amp: 0, t: 0 });
  }
  function setString(s, offset) {
    const x1 = 2000;
    const mx = (NUT_X + x1) / 2, my = (s.y0 + s.y1) / 2 + offset;
    s.path.setAttribute('d', `M${NUT_X} ${s.y0} Q${mx} ${my} ${x1} ${s.y1}`);
  }
  strings.forEach((s) => setString(s, 0));
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

  /* ============ 主迴圈 ============ */
  let last = performance.now();
  let nextAmbient = 2;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!reduceMotion.matches) {
      nextAmbient -= dt;
      if (nextAmbient <= 0) {
        spawnMeteor();
        if (Math.random() < SKY.meteorPairChance) spawnMeteor(0.3 + Math.random() * 0.5);
        const [lo, hi] = SKY.meteorEvery;
        nextAmbient = lo + Math.random() * (hi - lo);
      }
      stepMeteors(dt);
      draw(now);
      stepStrings(dt);
    }
    requestAnimationFrame(frame);
  }

  window.addEventListener('resize', resize);
  reduceMotion.addEventListener('change', resize);
  resize();
  requestAnimationFrame(frame);
  window.sky = { pluckAll };
})();
