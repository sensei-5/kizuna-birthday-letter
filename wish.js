/* ==========================================================
   觀眾留言頁：登入（Twitch / Google）→ 寫祝福 → 送出（截止前可修改）
   ========================================================== */
const { supabaseUrl, supabaseKey, maxMessage, maxName } = window.WISH_CONFIG;
const db = window.supabase.createClient(supabaseUrl, supabaseKey, {
  auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true },
});

const $ = (id) => document.getElementById(id);
const els = {
  loading: $('loading'),
  signedOut: $('signedOut'),
  form: $('wishForm'),
  avatar: $('avatar'),
  whoName: $('whoName'),
  whoVia: $('whoVia'),
  nameField: $('nameField'),
  nameInput: $('nameInput'),
  nameHint: $('nameHint'),
  message: $('messageInput'),
  count: $('count'),
  saveHint: $('saveHint'),
  error: $('formError'),
  submit: $('submitBtn'),
  closedNote: $('closedNote'),
  loginBtns: document.querySelector('.login-btns'),
  loginNote: $('loginNote'),
  deviceNote: $('deviceNote'),
};

let user = null;     // 登入的帳號
let myWish = null;   // 已送出的留言（資料庫那一列）
let isClosed = false;  // 是否已截止
let saving = false;
let deviceBlocked = false; // 這台裝置已經用別的帳號留過言

// 同一台裝置只能留一則：記下在這台裝置留言的帳號（換瀏覽器 / 無痕就擋不住，只是減少重複）
const DEVICE_KEY = 'wishAccount';
function deviceAccount() { try { return localStorage.getItem(DEVICE_KEY); } catch (e) { return null; } }
function rememberDevice() { try { localStorage.setItem(DEVICE_KEY, user.id); } catch (e) { /* 存不了就算了 */ } }

// 簡單的字詞過濾：擋明顯的髒話，其餘交給管理員刪除
const BLOCKED = ['幹你', '操你', '靠北', '靠杯', '去死', '白痴', '智障', '腦殘', '雞掰', '機掰', '王八', '婊子', '垃圾主播'];
const hasBlocked = (s) => BLOCKED.some((w) => s.includes(w));
const charLen = (s) => [...s].length; // 和資料庫 char_length 一樣以字元計

/* ============ 登入資訊 ============ */
function providerOf(u) { return u?.app_metadata?.provider || ''; }
// 和資料庫 wishes_fill() 的取名順序一致
function accountName(u) {
  const m = u?.user_metadata || {};
  return (m.nickname || m.full_name || m.name || m.preferred_username || '匿名').slice(0, maxName);
}
function avatarOf(u) {
  const m = u?.user_metadata || {};
  return m.avatar_url || m.picture || '';
}

/* ============ 畫面 ============ */
function show(view) {
  els.loading.hidden = view !== 'loading';
  els.signedOut.hidden = view !== 'signedOut';
  els.form.hidden = view !== 'form';
}

function renderUser() {
  const prov = providerOf(user);
  const isGoogle = prov === 'google';
  const name = myWish?.display_name || accountName(user);
  els.whoName.textContent = name;
  els.whoVia.textContent = prov === 'twitch' ? '以 Twitch 帳號登入' : '以 Google 帳號登入';
  const src = myWish?.avatar_url || avatarOf(user);
  if (src) els.avatar.src = src; else els.avatar.removeAttribute('src');

  // Google 可以自己填名字（例如 YT 名字），留空就用帳號名字；Twitch 固定用 Twitch 名字
  els.nameField.hidden = !isGoogle;
  els.nameInput.placeholder = accountName(user);
  els.nameHint.textContent = `留空會顯示「${accountName(user)}」`;
}

function renderState() {
  const done = !!myWish;
  els.submit.textContent = done ? '更新留言' : '送出祝福';
  els.saveHint.textContent = !done ? '' : isClosed ? '你的祝福已送出 ✓' : '已送出 ✓ 截止前都可以修改';
  els.saveHint.classList.toggle('saved', done);
  const locked = isClosed || deviceBlocked;
  els.closedNote.hidden = !isClosed;
  els.deviceNote.hidden = !deviceBlocked || isClosed;
  els.form.classList.toggle('is-blocked', deviceBlocked); // 不能留言就收起輸入框
  els.message.disabled = locked;
  els.nameInput.disabled = locked;
  els.submit.hidden = locked;
  els.loginBtns.hidden = isClosed; // 截止後未登入的人也不用再登入
  els.loginNote.hidden = isClosed;
  updateCount();
}

function updateCount() {
  const n = charLen(els.message.value.trim());
  els.count.textContent = `${n} / ${maxMessage}`;
  els.count.classList.toggle('over', n > maxMessage);
  els.submit.disabled = isClosed || deviceBlocked || saving || n === 0 || n > maxMessage;
}

function showError(msg) {
  els.error.textContent = msg;
  els.error.hidden = !msg;
}

/* ============ 資料 ============ */
async function loadClosed() {
  const { data } = await db.from('wish_settings').select('closed').eq('id', 1).maybeSingle();
  isClosed = !!data?.closed;
}

async function loadMyWish() {
  const { data } = await db.from('wishes').select('*').eq('user_id', user.id).maybeSingle();
  myWish = data || null;
  if (myWish) {
    els.message.value = myWish.message;
    if (providerOf(user) === 'google' && myWish.display_name !== accountName(user)) els.nameInput.value = myWish.display_name;
  }
}

// 截止 / 重新開放時即時更新
db.channel('wish-settings')
  .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'wish_settings' }, (payload) => {
    isClosed = !!payload.new.closed;
    renderState();
  })
  .subscribe();

/* ============ 送出 ============ */
els.form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (saving || isClosed || deviceBlocked) return;
  const message = els.message.value.trim();
  const display_name = els.nameInput.value.trim().slice(0, maxName); // Twitch 會被伺服器忽略
  if (!message || charLen(message) > maxMessage) return;
  if (hasBlocked(message) || hasBlocked(display_name)) {
    showError('留言裡有不適合的字詞，請修改後再送出。');
    return;
  }

  saving = true;
  showError('');
  els.submit.textContent = '送出中…';
  updateCount();

  const query = myWish
    ? db.from('wishes').update({ message, display_name }).eq('id', myWish.id)
    : db.from('wishes').insert({ message, display_name });
  const { data, error } = await query.select().single();

  saving = false;
  if (error) {
    await loadClosed();
    if (isClosed) showError('留言已經截止了，謝謝你！');
    else if (error.code === '23505') { await loadMyWish(); showError('你已經留過言了，已載入你的留言，可以修改後再送出。'); }
    else showError('送出失敗，請稍後再試一次。');
  } else {
    myWish = data;
    rememberDevice();
    renderUser();
    window.sky?.pluckAll(); // 送出成功：撥一下吉他弦
  }
  renderState();
});

els.message.addEventListener('input', () => { showError(''); updateCount(); });

/* ============ 登入 / 登出 ============ */
function login(provider) {
  const redirectTo = location.origin + location.pathname; // 登入完回到這一頁
  db.auth.signInWithOAuth({ provider, options: { redirectTo } });
}
$('loginTwitch').addEventListener('click', () => login('twitch'));
$('loginGoogle').addEventListener('click', () => login('google'));
$('logout').addEventListener('click', async () => {
  await db.auth.signOut();
  location.reload();
});

async function init() {
  const [{ data: { session } }] = await Promise.all([db.auth.getSession(), loadClosed()]);
  // 登入回來時網址會帶 ?code=…，換完 session 後清掉
  if (location.search.includes('code=')) history.replaceState(null, '', location.pathname);

  user = session?.user || null;
  if (!user) {
    renderState();
    show('signedOut');
    return;
  }
  await loadMyWish();
  // 自己的留言一律可以改；這個帳號還沒留過、但這台裝置已經用別的帳號留過，就不能再留
  const other = deviceAccount();
  if (myWish) rememberDevice();
  else deviceBlocked = !!other && other !== user.id;
  renderUser();
  renderState();
  show('form');
}
init();
