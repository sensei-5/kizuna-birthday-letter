/* ==========================================================
   留言管理頁：截止 / 重新開放、即時看留言、刪除、匯出
   權限由資料庫把關（wish_admins + RLS），這頁只負責畫面
   ========================================================== */
const { supabaseUrl, supabaseKey } = window.WISH_CONFIG;
const db = window.supabase.createClient(supabaseUrl, supabaseKey, {
  auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true },
});

const $ = (id) => document.getElementById(id);
const els = {
  loading: $('loading'),
  signedOut: $('signedOut'),
  notAdmin: $('notAdmin'),
  adminView: $('adminView'),
  adminSql: $('adminSql'),
  avatar: $('avatar'),
  whoName: $('whoName'),
  stateDot: $('stateDot'),
  stateText: $('stateText'),
  countText: $('countText'),
  toggle: $('toggleBtn'),
  error: $('adminError'),
  list: $('wishList'),
  empty: $('emptyText'),
};

let user = null;
let isClosed = false;
const wishes = new Map(); // id → 留言

function show(view) {
  for (const k of ['loading', 'signedOut', 'notAdmin', 'adminView']) els[k].hidden = k !== view;
}
function showError(msg) {
  els.error.textContent = msg;
  els.error.hidden = !msg;
}
function accountName(u) {
  const m = u?.user_metadata || {};
  return m.nickname || m.full_name || m.name || m.preferred_username || '';
}

/* ============ 收件狀態 ============ */
function renderState() {
  els.stateDot.classList.toggle('closed-dot', isClosed);
  els.stateText.textContent = isClosed ? '已截止' : '收件中';
  els.toggle.textContent = isClosed ? '重新開放收件' : '截止收件';
  els.toggle.classList.toggle('reopen', isClosed);
}

els.toggle.addEventListener('click', async () => {
  const next = !isClosed;
  const ask = next
    ? '確定要截止收件嗎？觀眾將無法再送出或修改留言。'
    : '確定要重新開放收件嗎？';
  if (!confirm(ask)) return;
  els.toggle.disabled = true;
  showError('');
  const { data, error } = await db.from('wish_settings').update({ closed: next }).eq('id', 1).select().single();
  els.toggle.disabled = false;
  if (error || !data) { showError('切換失敗，請重新整理後再試一次。'); return; }
  isClosed = data.closed;
  renderState();
});

/* ============ 留言清單 ============ */
const fmtTime = new Intl.DateTimeFormat('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
const norm = (s) => (s || '').trim().toLowerCase();

function renderList(newId) {
  const items = [...wishes.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));
  // 同名、或內容一模一樣的留言做記號，方便看出可能是同一個人
  const nameCount = new Map(), textCount = new Map();
  for (const w of items) {
    nameCount.set(norm(w.display_name), (nameCount.get(norm(w.display_name)) || 0) + 1);
    textCount.set(norm(w.message), (textCount.get(norm(w.message)) || 0) + 1);
  }

  els.list.replaceChildren(...items.map((w) => {
    const li = document.createElement('li');
    li.className = 'wish-item' + (w.id === newId ? ' is-new' : '');

    const img = document.createElement('img');
    img.className = 'avatar';
    img.alt = '';
    img.referrerPolicy = 'no-referrer';
    if (w.avatar_url) img.src = w.avatar_url;

    const body = document.createElement('div');
    body.className = 'wish-body';
    const meta = document.createElement('div');
    meta.className = 'wish-meta';
    const name = document.createElement('span');
    name.className = 'wish-name';
    name.textContent = w.display_name;
    const tag = document.createElement('span');
    tag.className = 'wish-tag' + (w.provider === 'google' ? ' google' : '');
    tag.textContent = w.provider === 'google' ? 'Google' : 'Twitch';
    const time = document.createElement('span');
    time.className = 'wish-time';
    time.textContent = fmtTime.format(new Date(w.updated_at || w.created_at))
      + (w.updated_at && w.updated_at !== w.created_at ? '（改過）' : '');
    meta.append(name, tag);
    if (nameCount.get(norm(w.display_name)) > 1) meta.append(flag('名字重複'));
    if (textCount.get(norm(w.message)) > 1) meta.append(flag('內容重複'));
    meta.append(time);
    const text = document.createElement('p');
    text.className = 'wish-text';
    text.textContent = w.message;
    body.append(meta, text);

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'del-btn';
    del.textContent = '刪除';
    del.addEventListener('click', () => removeWish(w, del));

    li.append(img, body, del);
    return li;
  }));

  els.empty.hidden = items.length > 0;
  els.countText.textContent = `共 ${items.length} 則`;
}

function flag(label) {
  const s = document.createElement('span');
  s.className = 'wish-flag';
  s.textContent = label;
  return s;
}

async function removeWish(w, btn) {
  if (!confirm(`確定刪除「${w.display_name}」的留言嗎？\n\n${w.message}`)) return;
  btn.disabled = true;
  showError('');
  const { data, error } = await db.from('wishes').delete().eq('id', w.id).select('id');
  if (error || !data?.length) {
    btn.disabled = false;
    showError('刪除失敗，請重新整理後再試一次。');
    return;
  }
  wishes.delete(w.id);
  renderList();
}

/* ============ 匯出 ============ */
$('exportBtn').addEventListener('click', () => {
  const rows = [...wishes.values()].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [['名字', '平台', '留言', '送出時間', '頭像網址'].map(esc).join(',')]
    .concat(rows.map((w) => [w.display_name, w.provider, w.message, w.created_at, w.avatar_url].map(esc).join(',')))
    .join('\r\n');
  // 加 BOM，Excel 打開中文才不會亂碼
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `kizuna-wishes-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});

/* ============ 即時更新 ============ */
function subscribe() {
  db.channel('admin')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'wishes' }, (p) => {
      if (p.eventType === 'DELETE') wishes.delete(p.old.id);
      else wishes.set(p.new.id, p.new);
      renderList(p.eventType === 'INSERT' ? p.new.id : undefined);
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'wish_settings' }, (p) => {
      isClosed = !!p.new.closed;
      renderState();
    })
    .subscribe();
}

/* ============ 登入 ============ */
function login(provider) {
  db.auth.signInWithOAuth({ provider, options: { redirectTo: location.origin + location.pathname } });
}
$('loginTwitch').addEventListener('click', () => login('twitch'));
$('loginGoogle').addEventListener('click', () => login('google'));
document.querySelectorAll('[data-logout]').forEach((b) => b.addEventListener('click', async () => {
  await db.auth.signOut();
  location.reload();
}));
$('copySql').addEventListener('click', async (e) => {
  try { await navigator.clipboard.writeText(els.adminSql.textContent); e.target.textContent = '已複製'; } catch (err) { /* 手動選取複製 */ }
});

async function init() {
  const { data: { session } } = await db.auth.getSession();
  if (location.search.includes('code=')) history.replaceState(null, '', location.pathname);
  user = session?.user || null;
  if (!user) { show('signedOut'); return; }

  const { data: adminRow } = await db.from('wish_admins').select('user_id').eq('user_id', user.id).maybeSingle();
  if (!adminRow) {
    const note = (accountName(user) || user.email || '').replace(/'/g, "''");
    els.adminSql.textContent = `insert into public.wish_admins (user_id, note) values ('${user.id}', '${note}');`;
    show('notAdmin');
    return;
  }

  els.whoName.textContent = accountName(user) || user.email || '';
  const m = user.user_metadata || {};
  if (m.avatar_url || m.picture) els.avatar.src = m.avatar_url || m.picture;

  const [{ data: settings }, { data: rows, error }] = await Promise.all([
    db.from('wish_settings').select('closed').eq('id', 1).maybeSingle(),
    db.from('wishes').select('*').order('created_at', { ascending: false }),
  ]);
  isClosed = !!settings?.closed;
  if (error) showError('讀取留言失敗，請重新整理。');
  for (const w of rows || []) wishes.set(w.id, w);
  renderState();
  renderList();
  show('adminView');
  subscribe();
}
init();
