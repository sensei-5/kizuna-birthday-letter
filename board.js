/* ==========================================================
   觀眾留言板：蛋糕頁按「點開這裡」後打開
   留言從 Supabase 讀取並即時更新；可存成一張圖片
   ========================================================== */
(() => {
  const $ = (id) => document.getElementById(id);
  const layer = $('boardLayer');
  const cloud = $('boardCloud');
  const countEl = $('boardCount');
  const emptyEl = $('boardEmpty');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const wishes = new Map(); // id → 留言
  let db = null;
  let started = false;

  // 每則留言固定一組隨機的傾斜、大小、漂浮節奏（重新排版時不會亂跳）
  const looks = new Map();
  function lookOf(id, message) {
    if (!looks.has(id)) {
      const len = [...message].length;
      looks.set(id, {
        tilt: (Math.random() * 8 - 4).toFixed(2),
        // 短的留言字大很多、長的小一點，大小錯落才像文字雲
        size: (len <= 6 ? 1.6 : len <= 12 ? 1.3 : len <= 30 ? 1.02 : 0.9) * (0.85 + Math.random() * 0.3),
        lift: (Math.random() * 1.2 - 0.6).toFixed(2), // 上下錯開，不要排成一列列
        delay: (-Math.random() * 6).toFixed(2),
        dur: (5 + Math.random() * 3).toFixed(2),
      });
    }
    return looks.get(id);
  }

  function card(w, isNew) {
    const look = lookOf(w.id, w.message);
    // 卡片是按鈕：留言多、字變小時，點開來看大字
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'wish-card' + (isNew ? ' is-new' : '');
    el.setAttribute('aria-label', `${w.display_name}：${w.message}`);
    el.addEventListener('click', () => openZoom(w.id));
    el.dataset.id = w.id;
    el.style.setProperty('--tilt', `${look.tilt}deg`);
    el.style.setProperty('--size', look.size);
    el.style.setProperty('--lift', `${look.lift}em`);
    el.style.setProperty('--delay', `${look.delay}s`);
    el.style.setProperty('--dur', `${look.dur}s`);

    const head = document.createElement('span');
    head.className = 'wish-card-head';
    const img = document.createElement('img');
    img.className = 'wish-card-avatar';
    img.alt = '';
    img.crossOrigin = 'anonymous'; // 存圖片時才畫得進去
    img.referrerPolicy = 'no-referrer';
    if (w.avatar_url) img.src = w.avatar_url;
    const name = document.createElement('span');
    name.className = 'wish-card-name';
    name.textContent = w.display_name;
    head.append(img, name);

    const text = document.createElement('span');
    text.className = 'wish-card-text';
    text.textContent = w.message;
    el.append(head, text);
    return el;
  }

  /* ============ 點開單張卡片 ============ */
  const zoom = $('wishZoom');
  let zoomId = null;
  function cardIds() { return [...cloud.children].map((el) => Number(el.dataset.id)); }

  function showZoom(id) {
    const w = wishes.get(id);
    if (!w) { closeZoom(); return; }
    zoomId = id;
    const img = $('zoomAvatar');
    if (w.avatar_url) img.src = w.avatar_url; else img.removeAttribute('src');
    $('zoomName').textContent = w.display_name;
    $('zoomText').textContent = w.message;
    const ids = cardIds();
    const i = ids.indexOf(id);
    $('zoomPos').textContent = `${i + 1} / ${ids.length}`;
    $('zoomPrev').disabled = i <= 0;
    $('zoomNext').disabled = i >= ids.length - 1;
  }
  function openZoom(id) {
    showZoom(id);
    zoom.hidden = false;
    if (!reduceMotion.matches) {
      $('zoomCard').animate([{ opacity: 0, transform: 'scale(0.9)' }, { opacity: 1, transform: 'none' }],
        { duration: 260, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' });
    }
    $('zoomClose').focus({ preventScroll: true });
  }
  function closeZoom() {
    if (zoom.hidden) return;
    zoom.hidden = true;
    cloud.querySelector(`[data-id="${zoomId}"]`)?.focus({ preventScroll: true });
    zoomId = null;
  }
  function stepZoom(d) {
    const ids = cardIds();
    const next = ids[ids.indexOf(zoomId) + d];
    if (next !== undefined) showZoom(next);
  }
  $('zoomClose').addEventListener('click', closeZoom);
  $('zoomPrev').addEventListener('click', () => stepZoom(-1));
  $('zoomNext').addEventListener('click', () => stepZoom(1));
  zoom.addEventListener('click', (e) => { if (e.target === zoom) closeZoom(); }); // 點外面關閉
  document.addEventListener('keydown', (e) => {
    if (layer.hidden || zoom.hidden) return;
    if (e.key === 'Escape') { e.preventDefault(); closeZoom(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); stepZoom(-1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); stepZoom(1); }
  });

  function updateCount() {
    countEl.textContent = wishes.size ? `共 ${wishes.size} 則祝福` : '';
    emptyEl.hidden = wishes.size > 0;
    fit();
  }

  // 即時更新只動有變的那張卡片，其他卡片的漂浮動畫不會重來
  function onChange(p) {
    if (p.eventType === 'DELETE') {
      wishes.delete(p.old.id);
      const el = cloud.querySelector(`[data-id="${p.old.id}"]`);
      if (el && !reduceMotion.matches) {
        el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400 }).finished.then(() => { el.remove(); fit(); });
      } else el?.remove();
    } else {
      const old = cloud.querySelector(`[data-id="${p.new.id}"]`);
      wishes.set(p.new.id, p.new);
      const el = card(p.new, p.eventType === 'INSERT');
      if (old) old.replaceWith(el); else cloud.append(el);
    }
    updateCount();
    if (zoomId !== null) showZoom(zoomId);
  }

  // 留言多的時候縮小字級，盡量一個畫面放得下（太多就捲動）
  function fit() {
    let size = Math.max(14, Math.min(26, window.innerWidth / 60));
    cloud.style.setProperty('--fs', `${size}px`);
    const room = () => cloud.scrollHeight <= cloud.clientHeight + 1;
    while (!room() && size > 11) {
      size -= 1;
      cloud.style.setProperty('--fs', `${size}px`);
    }
  }

  async function load() {
    const cfg = window.WISH_CONFIG;
    db = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data, error } = await db.from('wishes').select('id, display_name, avatar_url, message, created_at');
    if (error) {
      emptyEl.textContent = '留言載入失敗，請檢查網路後重新整理';
      emptyEl.hidden = false;
      return;
    }
    data.sort((x, y) => x.created_at.localeCompare(y.created_at));
    for (const w of data) wishes.set(w.id, w);
    cloud.replaceChildren(...data.map((w) => card(w, false)));
    updateCount();
    db.channel('board')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wishes' }, onChange)
      .subscribe();
  }

  /* ============ 打開 / 關閉 ============ */
  const stage = document.querySelector('.stage');
  window.openBoard = () => {
    layer.hidden = false;
    stage.inert = true;
    if (!reduceMotion.matches) {
      stage.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 500, fill: 'forwards' });
      layer.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 700, delay: 200, fill: 'backwards', easing: 'ease-out' });
    } else stage.style.opacity = '0';
    if (!started) { started = true; load(); } else fit();
    $('boardSave').focus({ preventScroll: true });
  };
  $('boardBack').addEventListener('click', () => {
    closeZoom();
    layer.hidden = true;
    stage.inert = false;
    stage.getAnimations().forEach((a) => a.cancel());
    stage.style.opacity = '';
    $('boardBtn')?.focus({ preventScroll: true });
  });
  window.addEventListener('resize', () => { if (!layer.hidden) fit(); });

  /* ============ 存成圖片 ============ */
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src; s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  $('boardSave').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const label = btn.textContent;
    btn.disabled = true;
    btn.textContent = '保存中…';
    try {
      if (!window.html2canvas) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
      layer.classList.add('is-capturing'); // 拍照時停掉漂浮動畫、收起按鈕
      const scale = Math.max(2, window.devicePixelRatio || 1);
      const canvas = await window.html2canvas(document.body, {
        backgroundColor: '#0c1330',
        useCORS: true,
        scale,
        width: window.innerWidth,
        height: window.innerHeight,
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight,
        ignoreElements: (el) => el.classList?.contains('board-actions') || el.id === 'wishZoom' || el.id === 'musicCtrl' || el.classList?.contains('stage'),
      });
      // 右下角小小的署名
      const g = canvas.getContext('2d');
      const W = window.innerWidth, H = window.innerHeight;
      g.save();
      g.scale(scale, scale);
      g.font = `${Math.max(12, W / 110)}px ${getComputedStyle(document.body).fontFamily}`;
      g.fillStyle = 'rgba(243, 230, 194, 0.7)';
      g.textAlign = 'right';
      g.textBaseline = 'alphabetic';
      g.fillText(`絆Kizuna 生日快樂 · ${new Date().toISOString().slice(0, 10)}`, W - 16, H - 14);
      g.restore();
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `絆Kizuna生日祝福-${new Date().toISOString().slice(0, 10)}.png`;
      a.click();
      btn.textContent = '已保存 ✓';
    } catch (err) {
      btn.textContent = '保存失敗，再試一次';
    } finally {
      layer.classList.remove('is-capturing');
      btn.disabled = false;
      setTimeout(() => { btn.textContent = label; }, 2500);
    }
  });
})();
