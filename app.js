'use strict';

/* =========================================================
   Tiện ích chung
   ========================================================= */
const STORAGE_KEY = 'chitieu.v1';
const HIDE_INSTALL_KEY = 'chitieu.hideInstall';
const APP_VERSION = '2.0.0';

const nf = new Intl.NumberFormat('vi-VN');
const money = (n) => nf.format(Math.round(n) || 0) + ' ₫'; // || 0: tránh hiện "-0"
const smoney = (n) => (n < 0 ? '−' : '') + money(Math.abs(n));
const pad = (n) => String(n).padStart(2, '0');
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const sum = (arr) => arr.reduce((s, x) => s + x, 0);
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s);

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Bỏ dấu tiếng Việt để tìm kiếm không phân biệt dấu
function fold(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
}

function compactMoney(n) {
  const a = Math.abs(n);
  const one = (x) => String(Math.round(x * 10) / 10).replace('.', ',');
  if (a >= 1e9) return one(n / 1e9) + ' tỷ';
  if (a >= 1e6) return one(n / 1e6) + 'tr';
  if (a >= 1e3) return one(n / 1e3) + 'k';
  return String(Math.round(n));
}

function parseMoney(s) {
  return Number(String(s).replace(/\D/g, '')) || 0;
}

function formatMoneyInput(input) {
  const digits = input.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 12);
  input.value = digits ? nf.format(Number(digits)) : '';
}

/* ---------- Ngày tháng ---------- */
const WEEKDAYS = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
const toDateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayStr = () => toDateStr(new Date());
const currentMonth = () => todayStr().slice(0, 7);

function parseDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function shiftMonth(ym, delta) {
  let [y, m] = ym.split('-').map(Number);
  m += delta;
  while (m < 1) { m += 12; y--; }
  while (m > 12) { m -= 12; y++; }
  return `${y}-${pad(m)}`;
}

function monthLabel(ym) {
  const [y, m] = ym.split('-');
  return `Tháng ${Number(m)}/${y}`;
}

function daysInMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

function dayLabel(s) {
  const d = parseDate(s);
  const short = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
  const yest = new Date();
  yest.setDate(yest.getDate() - 1);
  if (s === todayStr()) return `Hôm nay, ${short}`;
  if (s === toDateStr(yest)) return `Hôm qua, ${short}`;
  return `${WEEKDAYS[d.getDay()]}, ${short}`;
}

const shortDate = (s) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;
const fullDate = (s) => `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}`;

/* =========================================================
   Dữ liệu
   ========================================================= */
// Phạm vi của khoản thu/chi. Tạm ứng – chi hộ chỉ áp dụng cho khoản chi.
const SCOPES = { personal: 'Cá nhân', work: 'Công việc', advance: 'Tạm ứng' };
const IMPORTANCE = { 1: 'Thiết yếu', 2: 'Quan trọng', 3: 'Có thể cắt giảm' };
const SORTS = { manual: 'Thứ tự tự đặt', amount: 'Số tiền trong tháng', importance: 'Mức độ quan trọng', usage: 'Số lần dùng' };

// Nhóm danh mục: chi cá nhân, chi công việc (dùng chung cho tạm ứng), thu
const GROUP_TITLES = { personal: 'Danh mục chi cá nhân', work: 'Danh mục chi công việc & tạm ứng', income: 'Danh mục thu' };
const catGroupFor = (type, scope) => (type === 'income' ? 'income' : scope === 'personal' ? 'personal' : 'work');

const DEFAULT_CATEGORIES = [
  { id: 'food', name: 'Ăn uống', icon: '🍜', color: '#f97316', group: 'personal', importance: 1 },
  { id: 'transport', name: 'Đi lại', icon: '🛵', color: '#3b82f6', group: 'personal', importance: 1 },
  { id: 'home', name: 'Nhà ở', icon: '🏠', color: '#8b5cf6', group: 'personal', importance: 1 },
  { id: 'bills', name: 'Hoá đơn', icon: '💡', color: '#eab308', group: 'personal', importance: 1 },
  { id: 'shopping', name: 'Mua sắm', icon: '🛍️', color: '#ec4899', group: 'personal', importance: 3 },
  { id: 'fun', name: 'Giải trí', icon: '🎬', color: '#06b6d4', group: 'personal', importance: 3 },
  { id: 'health', name: 'Sức khoẻ', icon: '💊', color: '#ef4444', group: 'personal', importance: 1 },
  { id: 'edu', name: 'Học tập', icon: '📚', color: '#14b8a6', group: 'personal', importance: 2 },
  { id: 'gift', name: 'Quà tặng', icon: '🎁', color: '#a855f7', group: 'personal', importance: 3 },
  { id: 'other-exp', name: 'Khác', icon: '📦', color: '#64748b', group: 'personal', importance: 2 },
  { id: 'w-print', name: 'In ấn', icon: '🖨️', color: '#3b82f6', group: 'work', importance: 2 },
  { id: 'w-supplies', name: 'Vật tư', icon: '🧰', color: '#f97316', group: 'work', importance: 2 },
  { id: 'w-trip', name: 'Đi công tác', icon: '🧳', color: '#8b5cf6', group: 'work', importance: 2 },
  { id: 'w-client', name: 'Tiếp khách', icon: '🍽️', color: '#ec4899', group: 'work', importance: 2 },
  { id: 'w-ship', name: 'Vận chuyển', icon: '🚚', color: '#06b6d4', group: 'work', importance: 2 },
  { id: 'other-work', name: 'Khác', icon: '📦', color: '#64748b', group: 'work', importance: 2 },
  { id: 'salary', name: 'Lương', icon: '💼', color: '#0e9f6e', group: 'income', importance: 2 },
  { id: 'bonus', name: 'Thưởng', icon: '🏆', color: '#22c55e', group: 'income', importance: 2 },
  { id: 'side', name: 'Làm thêm', icon: '💻', color: '#10b981', group: 'income', importance: 2 },
  { id: 'invest', name: 'Đầu tư', icon: '📈', color: '#84cc16', group: 'income', importance: 2 },
  { id: 'other-inc', name: 'Khác', icon: '💰', color: '#64748b', group: 'income', importance: 2 },
].map((c) => ({ ...c, type: c.group === 'income' ? 'income' : 'expense' }));
// Danh mục "Khác" không xoá được: giao dịch của danh mục bị xoá sẽ chuyển về đây
const FALLBACK = { personal: 'other-exp', work: 'other-work', income: 'other-inc' };
const isLockedCat = (id) => Object.values(FALLBACK).includes(id);

// Ví thường có số dư; ví trả sau (PayLater) theo dõi dư nợ
const MAIN_WALLET = 'main';
const DEFAULT_WALLETS = [
  { id: 'main', name: 'Tài khoản chính', icon: '🏦', kind: 'normal', opening: 0 },
  { id: 'cash', name: 'Tiền mặt', icon: '💵', kind: 'normal', opening: 0 },
  { id: 'momo', name: 'Ví MoMo', icon: '📱', kind: 'normal', opening: 0 },
  { id: 'momo-later', name: 'MoMo Ví trả sau', icon: '🅿️', kind: 'credit', opening: 0 },
  { id: 'tiktok-later', name: 'TikTok PayLater', icon: '🎵', kind: 'credit', opening: 0 },
];

const EMOJIS = ['🍜', '🍔', '☕', '🧋', '🍺', '🛒', '🛵', '🚗', '⛽', '🚌', '✈️', '🏠', '💡', '💧', '📱', '🌐',
  '🛍️', '👕', '💄', '💇', '🎬', '🎮', '🎵', '⚽', '💊', '🏥', '📚', '🎓', '🎁', '❤️', '👶', '🐶',
  '💼', '🏆', '💻', '📈', '💰', '🏦', '🧾', '📦', '🖨️', '🧰', '🧳', '🍽️', '🚚', '✏️', '📎', '🔧'];
const WALLET_ICONS = ['🏦', '💵', '📱', '💳', '🅿️', '🎵', '🛒', '💰', '🐷', '🪙', '🧧', '🏧'];
const COLORS = ['#f97316', '#ef4444', '#ec4899', '#a855f7', '#8b5cf6', '#3b82f6', '#06b6d4', '#14b8a6',
  '#0e9f6e', '#84cc16', '#eab308', '#64748b'];

function defaultState() {
  return {
    version: 2,
    categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
    wallets: DEFAULT_WALLETS.map((w) => ({ ...w })),
    transactions: [],
    budgets: {},
    settings: { lastBackup: null, catSort: 'manual' },
  };
}

// Kiểm tra, làm sạch và nâng cấp dữ liệu (dùng khi mở app và khi nhập file sao lưu).
// Dữ liệu bản 1: giao dịch được gán phạm vi Cá nhân, ví Tài khoản chính.
function normalizeState(s) {
  const out = defaultState();

  if (Array.isArray(s.categories) && s.categories.length) {
    out.categories = s.categories
      .filter((c) => c && c.id && c.name && (c.type === 'expense' || c.type === 'income'))
      .map((c) => {
        const def = DEFAULT_CATEGORIES.find((d) => d.id === c.id);
        const imp = Number(c.importance);
        return {
          id: String(c.id),
          name: String(c.name).slice(0, 30),
          icon: String(c.icon || '📦').slice(0, 8),
          color: /^#[0-9a-f]{6}$/i.test(c.color) ? c.color : '#64748b',
          type: c.type,
          group: c.type === 'income' ? 'income' : c.group === 'work' ? 'work' : 'personal',
          importance: [1, 2, 3].includes(imp) ? imp : def ? def.importance : 2,
        };
      });
    if (!out.categories.some((c) => c.group === 'work')) {
      out.categories.push(...DEFAULT_CATEGORIES.filter((c) => c.group === 'work').map((c) => ({ ...c })));
    }
  }
  for (const id of Object.values(FALLBACK)) {
    if (!out.categories.some((c) => c.id === id)) out.categories.push({ ...DEFAULT_CATEGORIES.find((c) => c.id === id) });
  }
  const catGroup = new Map(out.categories.map((c) => [c.id, c.group]));

  if (Array.isArray(s.wallets) && s.wallets.length) {
    out.wallets = s.wallets
      .filter((w) => w && w.id && w.name)
      .map((w) => ({
        id: String(w.id),
        name: String(w.name).slice(0, 30),
        icon: String(w.icon || '💳').slice(0, 8),
        kind: w.kind === 'credit' ? 'credit' : 'normal',
        opening: Math.round(Number(w.opening)) || 0,
      }));
  }
  if (!out.wallets.some((w) => w.id === MAIN_WALLET)) out.wallets.unshift({ ...DEFAULT_WALLETS[0] });
  const walletIds = new Set(out.wallets.map((w) => w.id));
  const wallet = (id) => (walletIds.has(String(id)) ? String(id) : MAIN_WALLET);

  out.transactions = [];
  for (const t of Array.isArray(s.transactions) ? s.transactions : []) {
    if (!t || !['expense', 'income', 'transfer'].includes(t.type) || !(Number(t.amount) > 0) || !isDate(t.date)) continue;
    const base = {
      id: String(t.id || uid()),
      type: t.type,
      amount: Math.round(Number(t.amount)),
      date: t.date,
      note: String(t.note || '').slice(0, 100),
      createdAt: Number(t.createdAt) || Date.now(),
    };
    if (t.type === 'transfer') {
      const fromId = wallet(t.fromId);
      const toId = wallet(t.toId);
      if (fromId !== toId) out.transactions.push({ ...base, fromId, toId });
      continue;
    }
    const scope = t.type === 'income' ? (t.scope === 'work' ? 'work' : 'personal') : SCOPES[t.scope] ? t.scope : 'personal';
    const group = catGroupFor(t.type, scope);
    const tx = {
      ...base,
      scope,
      walletId: wallet(t.walletId),
      categoryId: catGroup.get(String(t.categoryId)) === group ? String(t.categoryId) : FALLBACK[group],
    };
    if (scope === 'advance') {
      const r = t.repaid;
      tx.repaid = r && isDate(r.date) ? { walletId: wallet(r.walletId), date: r.date } : null;
    }
    out.transactions.push(tx);
  }

  if (s.budgets && typeof s.budgets === 'object') {
    for (const [id, v] of Object.entries(s.budgets)) {
      if (catGroup.get(id) === 'personal' && Number(v) > 0) out.budgets[id] = Math.round(Number(v));
    }
  }
  const st = s.settings || {};
  out.settings.lastBackup = Number(st.lastBackup) || null;
  out.settings.catSort = SORTS[st.catSort] ? st.catSort : 'manual';
  return out;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return normalizeState(JSON.parse(raw));
  } catch (e) { /* dữ liệu hỏng hoặc không đọc được: bắt đầu mới */ }
  return defaultState();
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (e) {
    toast('Không lưu được dữ liệu! Hãy xuất file sao lưu ngay.', 'error');
    return false;
  }
}

let state = loadState();
const ui = { view: 'home', month: currentMonth(), scope: 'personal', search: '', filter: 'all', histMode: 'list', reportType: 'expense' };
// Lựa chọn gần nhất khi nhập, để lần sau khỏi chọn lại
const last = { type: 'expense', scope: 'personal', wallet: { expense: MAIN_WALLET, income: MAIN_WALLET } };

/* ---------- Truy vấn ---------- */
const UNKNOWN_CAT = { id: '', name: 'Không rõ', icon: '❓', color: '#94a3b8', importance: 2 };
const UNKNOWN_WALLET = { id: '', name: 'Ví đã xoá', icon: '❓', kind: 'normal', opening: 0 };
const catById = (id) => state.categories.find((c) => c.id === id) || UNKNOWN_CAT;
const walletById = (id) => state.wallets.find((w) => w.id === id) || UNKNOWN_WALLET;
const monthTx = (ym) => state.transactions.filter((t) => t.date.startsWith(ym));
const sortTx = (list) => list.slice().sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
const countTx = (catId) => state.transactions.filter((t) => t.categoryId === catId).length;
const pendingAdvances = () => state.transactions.filter((t) => t.scope === 'advance' && !t.repaid);
const scopeName = (scope) => (scope === 'all' ? 'Tất cả' : SCOPES[scope]);

// Giao dịch chuyển ví không thuộc phạm vi nào; hiện cùng nhóm Cá nhân cho dễ thấy
function inScope(t, scope) {
  if (scope === 'all') return true;
  if (t.type === 'transfer') return scope === 'personal';
  return t.scope === scope;
}

// Chuyển ví không phải thu hay chi nên không tính vào tổng
function totals(list) {
  let income = 0;
  let expense = 0;
  for (const t of list) {
    if (t.type === 'income') income += t.amount;
    else if (t.type === 'expense') expense += t.amount;
  }
  return { income, expense };
}

function sumByCategory(list, type) {
  const m = {};
  for (const t of list) if (t.type === type) m[t.categoryId] = (m[t.categoryId] || 0) + t.amount;
  return m;
}

// Số dư mọi ví. Ví trả sau: số âm là dư nợ.
function walletBalances() {
  const bal = {};
  for (const w of state.wallets) bal[w.id] = w.kind === 'credit' ? -w.opening : w.opening;
  const add = (id, v) => { if (id in bal) bal[id] += v; };
  for (const t of state.transactions) {
    if (t.type === 'income') add(t.walletId, t.amount);
    else if (t.type === 'expense') {
      add(t.walletId, -t.amount);
      if (t.repaid) add(t.repaid.walletId, t.amount);
    } else {
      add(t.fromId, -t.amount);
      add(t.toId, t.amount);
    }
  }
  return bal;
}

const walletUseCount = (id) => state.transactions.filter((t) =>
  t.walletId === id || t.fromId === id || t.toId === id || (t.repaid && t.repaid.walletId === id)).length;

function sortCats(list) {
  const mode = state.settings.catSort;
  if (mode === 'manual') return list;
  const metric = {};
  if (mode === 'amount') for (const t of monthTx(ui.month)) if (t.categoryId) metric[t.categoryId] = (metric[t.categoryId] || 0) + t.amount;
  if (mode === 'usage') for (const t of state.transactions) if (t.categoryId) metric[t.categoryId] = (metric[t.categoryId] || 0) + 1;
  const idx = new Map(state.categories.map((c, i) => [c.id, i]));
  return list.slice().sort((a, b) => {
    const d = mode === 'importance' ? a.importance - b.importance : (metric[b.id] || 0) - (metric[a.id] || 0);
    return d || idx.get(a.id) - idx.get(b.id);
  });
}
const catsOfGroup = (group) => sortCats(state.categories.filter((c) => c.group === group));

const tint = (color) => `background:${color}22`;

/* =========================================================
   Hiển thị
   ========================================================= */
const TITLES = { home: 'Tổng quan', history: 'Lịch sử', reports: 'Báo cáo', settings: 'Cài đặt' };

function render() {
  $('#viewTitle').textContent = TITLES[ui.view];
  $('#monthLabel').textContent = monthLabel(ui.month);
  $('#monthSwitch').hidden = ui.view === 'settings' || (ui.view === 'history' && ui.histMode !== 'list');
  $$('.view').forEach((v) => v.classList.toggle('active', v.id === 'view-' + ui.view));
  $$('.tabbar [data-view]').forEach((b) => b.classList.toggle('active', b.dataset.view === ui.view));
  ({ home: renderHome, history: renderHistory, reports: renderReports, settings: renderSettings })[ui.view]();
}

function scopeChips() {
  return `<div class="chips-row">${['personal', 'work', 'advance', 'all']
    .map((k) => `<button class="chip${ui.scope === k ? ' active' : ''}" data-scope="${k}">${scopeName(k)}</button>`).join('')}</div>`;
}

function txItem(t, withDate) {
  const date = withDate ? shortDate(t.date) : '';
  if (t.type === 'transfer') {
    const from = walletById(t.fromId);
    const to = walletById(t.toId);
    const title = to.kind === 'credit' ? `Trả nợ ${to.name}` : `Chuyển sang ${to.name}`;
    const sub = [`Từ ${from.name}`, t.note, date].filter(Boolean).map(esc).join(' · ');
    return `<button class="tx" data-edit="${esc(t.id)}">
      <span class="cat-chip transfer-chip">⇄</span>
      <span class="tx-main"><span class="tx-cat">${esc(title)}</span><span class="tx-note">${sub}</span></span>
      <span class="tx-amt transfer">${money(t.amount)}</span>
    </button>`;
  }
  const c = catById(t.categoryId);
  const sub = [walletById(t.walletId).name, t.note, date].filter(Boolean).map(esc).join(' · ');
  let tag = '';
  if (t.scope === 'work') tag = '<span class="tag">Công việc</span>';
  else if (t.scope === 'advance') tag = t.repaid ? '<span class="tag ok">Đã hoàn</span>' : '<span class="tag warn">Chờ hoàn</span>';
  return `<button class="tx" data-edit="${esc(t.id)}">
    <span class="cat-chip" style="${tint(c.color)}">${c.icon}</span>
    <span class="tx-main"><span class="tx-cat">${esc(c.name)}${tag}</span><span class="tx-note">${sub}</span></span>
    <span class="tx-amt ${t.type}">${t.type === 'expense' ? '−' : '+'}${money(t.amount)}</span>
  </button>`;
}

/* ---------- Tổng quan ---------- */
function isIOS() {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}
function isStandalone() {
  return navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
}
function showInstallHint() {
  let hidden = false;
  try { hidden = localStorage.getItem(HIDE_INSTALL_KEY) === '1'; } catch (e) { /* bỏ qua */ }
  return isIOS() && !isStandalone() && !hidden;
}
function needBackupReminder() {
  const lastBackup = state.settings.lastBackup;
  return state.transactions.length >= 5 && (!lastBackup || Date.now() - lastBackup > 30 * 864e5);
}

function renderHome() {
  const list = monthTx(ui.month).filter((t) => inScope(t, ui.scope));
  const parts = [];

  if (showInstallHint()) {
    parts.push(`<div class="banner"><div>📲 <b>Cài lên màn hình chính:</b> trong Safari, nhấn nút <b>Chia sẻ</b> rồi chọn <b>“Thêm vào MH chính”</b>.</div>
      <button class="banner-x" data-action="hide-install" aria-label="Ẩn">✕</button></div>`);
  }
  if (needBackupReminder()) {
    const msg = state.settings.lastBackup ? 'Đã hơn 30 ngày bạn chưa sao lưu.' : 'Bạn chưa sao lưu dữ liệu lần nào.';
    parts.push(`<div class="banner warn"><div>💾 ${msg} Dữ liệu chỉ nằm trên máy này.</div>
      <button class="banner-btn" data-action="export-json">Sao lưu</button></div>`);
  }

  parts.push(scopeChips());
  parts.push(ui.scope === 'advance' ? advanceSummaryCard(list) : summaryCard(list));
  parts.push(walletCard());

  const pend = pendingAdvances();
  if (pend.length && ui.scope !== 'advance') {
    parts.push(`<button class="card pending-card" data-action="show-pending">
      <span class="cat-chip" style="background:#f59e0b22">🤝</span>
      <span class="grow">Đang chờ hoàn ứng<br><b>${money(sum(pend.map((t) => t.amount)))}</b> <span class="muted">· ${pend.length} khoản</span></span>
      <span class="chev">›</span></button>`);
  }
  if (ui.scope === 'personal' || ui.scope === 'all') parts.push(budgetCard());

  const recent = sortTx(list).slice(0, 6);
  parts.push(`<div class="card">
    <div class="card-head"><h2>Giao dịch gần đây</h2>${list.length > recent.length ? '<button class="link" data-view="history">Xem tất cả</button>' : ''}</div>
    ${recent.length
      ? recent.map((t) => txItem(t, true)).join('')
      : `<p class="empty">Chưa có giao dịch nào trong tháng này.<br>Nhấn nút <b>+</b> để thêm.</p>`}
  </div>`);

  $('#view-home').innerHTML = parts.join('');
}

function summaryCard(list) {
  const { income, expense } = totals(list);
  const bal = income - expense;
  return `<div class="card summary">
    <div class="summary-label">${scopeName(ui.scope)} · còn lại trong ${monthLabel(ui.month).toLowerCase()}</div>
    <div class="summary-balance">${smoney(bal)}</div>
    <div class="summary-row">
      <div>↓ Thu<b>${money(income)}</b></div>
      <div>↑ Chi<b>${money(expense)}</b></div>
    </div>
  </div>`;
}

function advanceSummaryCard(list) {
  const spent = totals(list).expense;
  const pending = sum(pendingAdvances().map((t) => t.amount));
  const repaid = sum(state.transactions.filter((t) => t.repaid && t.repaid.date.startsWith(ui.month)).map((t) => t.amount));
  return `<div class="card summary advance">
    <div class="summary-label">Tạm ứng · chi hộ trong ${monthLabel(ui.month).toLowerCase()}</div>
    <div class="summary-balance">${money(spent)}</div>
    <div class="summary-row">
      <div>⏳ Chờ hoàn (mọi tháng)<b>${money(pending)}</b></div>
      <div>✅ Đã hoàn trong tháng<b>${money(repaid)}</b></div>
    </div>
  </div>`;
}

function walletCard() {
  const bal = walletBalances();
  const normal = state.wallets.filter((w) => w.kind === 'normal');
  const credit = state.wallets.filter((w) => w.kind === 'credit');
  const charged = {};
  for (const t of monthTx(ui.month)) if (t.type === 'expense') charged[t.walletId] = (charged[t.walletId] || 0) + t.amount;
  const totalDebt = sum(credit.map((w) => Math.max(0, -bal[w.id])));
  const main = walletById(MAIN_WALLET);

  const normalRows = normal.map((w) => `<button class="wallet-row" data-wallet="${esc(w.id)}">
      <span class="wicon">${w.icon}</span><span class="grow">${esc(w.name)}</span>
      <b class="${bal[w.id] < 0 ? 'expense-text' : ''}">${smoney(bal[w.id])}</b></button>`).join('');
  const creditRows = credit.map((w) => {
    const debt = -bal[w.id];
    return `<div class="wallet-row">
      <button class="wallet-main" data-wallet="${esc(w.id)}">
        <span class="wicon">${w.icon}</span>
        <span class="grow">${esc(w.name)}<small>Phát sinh trong tháng ${money(charged[w.id] || 0)}</small></span>
        <b class="${debt > 0 ? 'expense-text' : ''}">${debt >= 0 ? money(debt) : 'dư ' + money(-debt)}</b>
      </button>
      ${debt > 0 ? `<button class="mini-btn" data-action="pay-debt" data-id="${esc(w.id)}">Trả nợ</button>` : ''}
    </div>`;
  }).join('');

  return `<div class="card">
    <div class="card-head"><h2>Ví & nguồn tiền</h2><button class="link" data-action="add-transfer">⇄ Chuyển ví</button></div>
    ${normalRows}
    ${credit.length ? `<div class="sub-head">Dư nợ trả sau</div>${creditRows}
      <div class="avail"><span>Khả dụng thực<small>${esc(main.name)} − tổng dư nợ trả sau</small></span><b class="${bal[MAIN_WALLET] - totalDebt < 0 ? 'expense-text' : ''}">${smoney(bal[MAIN_WALLET] - totalDebt)}</b></div>` : ''}
  </div>`;
}

/* ---------- Ngân sách (chỉ chi tiêu cá nhân) ---------- */
const budgetStatus = (p) => (p >= 1 ? 'over' : p >= 0.8 ? 'warn' : 'ok');

function budgetRow(icon, name, spent, budget) {
  const p = spent / budget;
  const right = spent <= budget ? `còn ${money(budget - spent)}` : `vượt ${money(spent - budget)}`;
  return `<div class="budget ${budgetStatus(p)}">
    <div class="budget-top"><span>${icon} ${esc(name)}</span><span class="budget-right">${right}</span></div>
    <div class="bar"><i style="width:${Math.min(100, p * 100).toFixed(1)}%"></i></div>
    <div class="budget-sub">${money(spent)} / ${money(budget)} · ${Math.round(p * 100)}%</div>
  </div>`;
}

function budgetCard() {
  const spent = sumByCategory(monthTx(ui.month).filter((t) => t.scope === 'personal'), 'expense');
  const rows = catsOfGroup('personal')
    .filter((c) => state.budgets[c.id] > 0)
    .map((c) => ({ c, b: state.budgets[c.id], s: spent[c.id] || 0 }))
    .sort((a, b) => b.s / b.b - a.s / a.b);

  if (!rows.length) {
    return `<div class="card"><div class="card-head"><h2>Ngân sách cá nhân</h2></div>
      <p class="empty">Chưa đặt ngân sách cho danh mục nào.<br><button class="link" data-view="settings">Đặt ngân sách ngay</button></p></div>`;
  }

  const totalB = sum(rows.map((r) => r.b));
  const totalS = sum(rows.map((r) => r.s));
  let extra = '';
  if (ui.month === currentMonth()) {
    const daysLeft = daysInMonth(ui.month) - new Date().getDate() + 1;
    const remain = totalB - totalS;
    extra = remain > 0
      ? `<p class="hint">Còn ${daysLeft} ngày · mỗi ngày nên tiêu tối đa khoảng <b>${money(remain / daysLeft)}</b></p>`
      : `<p class="hint over-text">Đã vượt tổng ngân sách ${money(-remain)}</p>`;
  }
  return `<div class="card">
    <div class="card-head"><h2>Ngân sách cá nhân</h2><button class="link" data-view="settings">Chỉnh</button></div>
    ${budgetRow('🎯', 'Tổng ngân sách', totalS, totalB)}
    ${extra}
    <div class="sep"></div>
    ${rows.map((r) => budgetRow(r.c.icon, r.c.name, r.s, r.b)).join('')}
  </div>`;
}

// Cảnh báo khi khoản chi cá nhân mới làm danh mục chạm 80% hoặc vượt ngân sách
function budgetWarning(others, rec) {
  const b = state.budgets[rec.categoryId];
  if (rec.type !== 'expense' || rec.scope !== 'personal' || !b) return null;
  const ym = rec.date.slice(0, 7);
  const before = sum(others.filter((t) => t.type === 'expense' && t.categoryId === rec.categoryId && t.date.startsWith(ym)).map((t) => t.amount));
  const after = before + rec.amount;
  const name = catById(rec.categoryId).name;
  if (after > b) return { level: 'error', msg: `⚠️ Đã vượt ngân sách “${name}” ${money(after - b)}` };
  if (after >= 0.8 * b) return { level: 'warn', msg: `Đã dùng ${Math.round((after / b) * 100)}% ngân sách “${name}”` };
  return null;
}

/* ---------- Lịch sử ---------- */
function filterValid(f) {
  if (f === 'all') return true;
  const [k, v] = f.split(':');
  if (k === 'type') return ['expense', 'income', 'transfer'].includes(v);
  if (k === 'scope') return !!SCOPES[v];
  if (k === 'wallet') return state.wallets.some((w) => w.id === v);
  if (k === 'cat') return state.categories.some((c) => c.id === v);
  return false;
}

function matchFilter(t, f) {
  if (f === 'all') return true;
  const i = f.indexOf(':');
  const k = f.slice(0, i);
  const v = f.slice(i + 1);
  if (k === 'type') return t.type === v;
  if (k === 'scope') return t.type !== 'transfer' && t.scope === v;
  if (k === 'wallet') return t.walletId === v || t.fromId === v || t.toId === v || (t.repaid && t.repaid.walletId === v);
  if (k === 'cat') return t.categoryId === v;
  return true;
}

function renderHistory() {
  const pendN = pendingAdvances().length;
  const mode = ui.histMode;
  const modeBtn = (m, label) => `<button data-hist="${m}" class="${mode === m ? 'active' : ''}">${label}</button>`;
  let html = `<div class="seg seg3 hist-mode">${modeBtn('list', 'Giao dịch')}${modeBtn('pending', `Chờ hoàn${pendN ? ` (${pendN})` : ''}`)}${modeBtn('repaid', 'Đã hoàn')}</div>`;

  if (mode !== 'list') {
    $('#view-history').innerHTML = html + advanceList(mode);
    return;
  }

  if (!filterValid(ui.filter)) ui.filter = 'all';
  const opt = (value, label) => `<option value="${esc(value)}"${ui.filter === value ? ' selected' : ''}>${esc(label)}</option>`;
  const catGroup = (group) => `<optgroup label="${GROUP_TITLES[group]}">${catsOfGroup(group).map((c) => opt('cat:' + c.id, `${c.icon} ${c.name}`)).join('')}</optgroup>`;
  html += `
    <div class="filters">
      <input type="search" id="hSearch" placeholder="Tìm theo ghi chú, danh mục, ví…" value="${esc(ui.search)}" autocomplete="off">
      <select id="hFilter" aria-label="Lọc">
        ${opt('all', 'Tất cả giao dịch')}
        <optgroup label="Loại">${opt('type:expense', 'Khoản chi')}${opt('type:income', 'Khoản thu')}${opt('type:transfer', 'Chuyển ví / Trả nợ')}</optgroup>
        <optgroup label="Phạm vi">${Object.entries(SCOPES).map(([k, v]) => opt('scope:' + k, v)).join('')}</optgroup>
        <optgroup label="Ví">${state.wallets.map((w) => opt('wallet:' + w.id, `${w.icon} ${w.name}`)).join('')}</optgroup>
        ${catGroup('personal')}${catGroup('work')}${catGroup('income')}
      </select>
    </div>
    <div id="hList"></div>`;
  $('#view-history').innerHTML = html;
  renderHistoryList();
}

function renderHistoryList() {
  let list = monthTx(ui.month).filter((t) => matchFilter(t, ui.filter));
  const q = fold(ui.search.trim());
  if (q) {
    list = list.filter((t) => [t.note, catById(t.categoryId).name, walletById(t.walletId || t.fromId).name, t.toId ? walletById(t.toId).name : '']
      .some((s) => fold(s).includes(q)));
  }
  list = sortTx(list);

  const box = $('#hList');
  if (!list.length) {
    box.innerHTML = `<div class="card"><p class="empty">${q || ui.filter !== 'all' ? 'Không có giao dịch phù hợp.' : 'Chưa có giao dịch nào trong tháng này.'}</p></div>`;
    return;
  }

  const { income, expense } = totals(list);
  const days = [];
  for (const t of list) {
    if (!days.length || days[days.length - 1].date !== t.date) days.push({ date: t.date, items: [] });
    days[days.length - 1].items.push(t);
  }
  box.innerHTML = `
    <div class="hist-sum"><span>${list.length} giao dịch</span><span><b class="income-text">+${money(income)}</b> · <b class="expense-text">−${money(expense)}</b></span></div>
    ${days.map((d) => {
      const t = totals(d.items);
      const net = t.income - t.expense;
      return `<div class="day-head"><span>${dayLabel(d.date)}</span><span>${net >= 0 ? '+' : '−'}${money(Math.abs(net))}</span></div>
        <div class="card tx-list">${d.items.map((x) => txItem(x, false)).join('')}</div>`;
    }).join('')}`;
}

function advanceList(mode) {
  const pending = mode === 'pending';
  const list = state.transactions
    .filter((t) => t.scope === 'advance' && (pending ? !t.repaid : !!t.repaid))
    .sort((a, b) => (pending ? b.date.localeCompare(a.date) : b.repaid.date.localeCompare(a.repaid.date)));
  if (!list.length) {
    return `<div class="card"><p class="empty">${pending ? 'Không có khoản tạm ứng nào đang chờ hoàn. 🎉' : 'Chưa có khoản tạm ứng nào được hoàn.'}</p></div>`;
  }
  return `<div class="hist-sum"><span>${list.length} khoản · tính trên mọi tháng</span><b class="${pending ? 'warn-text' : 'income-text'}">${money(sum(list.map((t) => t.amount)))}</b></div>
    <div class="card tx-list">${list.map((t) => txItem(t, true)).join('')}</div>
    ${pending ? '<p class="hint center">Chạm vào một khoản để đánh dấu đã hoàn tiền.</p>' : ''}`;
}

/* ---------- Báo cáo ---------- */
function donutSVG(items, total, label) {
  const r = 60;
  const C = 2 * Math.PI * r;
  let offset = 0;
  const segs = items.map((it) => {
    const len = (it.value / total) * C;
    const seg = `<circle cx="80" cy="80" r="${r}" fill="none" stroke="${it.c.color}" stroke-width="24"
      stroke-dasharray="${len.toFixed(2)} ${(C - len).toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}"/>`;
    offset += len;
    return seg;
  }).join('');
  return `<svg viewBox="0 0 160 160" class="donut" role="img" aria-label="${label} ${money(total)}">
    <g transform="rotate(-90 80 80)">${segs}</g>
    <text x="80" y="76" class="donut-label">${label}</text>
    <text x="80" y="96" class="donut-value">${compactMoney(total)}</text>
  </svg>`;
}

function categoryCard(list) {
  const type = ui.reportType;
  const by = sumByCategory(list, type);
  const items = Object.entries(by).map(([id, value]) => ({ c: catById(id), value })).sort((a, b) => b.value - a.value);
  const total = sum(items.map((i) => i.value));
  const label = type === 'expense' ? 'Tổng chi' : 'Tổng thu';

  const body = total
    ? `<div class="donut-wrap">${donutSVG(items, total, label)}</div>
       ${items.map((i) => `<div class="legend-row">
          <span class="cat-chip" style="${tint(i.c.color)}">${i.c.icon}</span>
          <div class="grow">
            <div class="legend-top"><span>${esc(i.c.name)}</span><b>${money(i.value)}</b></div>
            <div class="bar thin"><i style="width:${((i.value / total) * 100).toFixed(1)}%;background:${i.c.color}"></i></div>
          </div>
          <span class="legend-pct">${Math.round((i.value / total) * 100)}%</span>
        </div>`).join('')}`
    : `<p class="empty">Chưa có ${type === 'expense' ? 'khoản chi' : 'khoản thu'} nào trong tháng này.</p>`;

  return `<div class="card">
    <div class="seg"><button data-report-type="expense" class="${type === 'expense' ? 'active' : ''}">Khoản chi</button><button data-report-type="income" class="${type === 'income' ? 'active' : ''}">Khoản thu</button></div>
    ${body}
  </div>`;
}

function importanceCard(list) {
  const by = { 1: 0, 2: 0, 3: 0 };
  for (const t of list) if (t.type === 'expense') by[catById(t.categoryId).importance] += t.amount;
  const total = by[1] + by[2] + by[3];
  if (!total) return '';
  const pct = (k) => (by[k] / total) * 100;
  return `<div class="card">
    <div class="card-head"><h2>Chi theo mức độ quan trọng</h2></div>
    <div class="stack">${[1, 2, 3].map((k) => (by[k] ? `<i class="imp-bg${k}" style="width:${pct(k).toFixed(1)}%"></i>` : '')).join('')}</div>
    ${[1, 2, 3].map((k) => `<div class="imp-row"><span><i class="key imp-bg${k}"></i>${IMPORTANCE[k]}</span><span>${money(by[k])} · <b>${Math.round(pct(k))}%</b></span></div>`).join('')}
  </div>`;
}

function dailyCard(list) {
  const ym = ui.month;
  const n = daysInMonth(ym);
  const vals = Array(n).fill(0);
  for (const t of list) if (t.type === 'expense') vals[Number(t.date.slice(8)) - 1] += t.amount;
  const max = Math.max(...vals);
  if (!max) return `<div class="card"><div class="card-head"><h2>Chi tiêu theo ngày</h2></div><p class="empty">Chưa có khoản chi nào.</p></div>`;

  const cur = currentMonth();
  const now = new Date();
  const elapsed = ym < cur ? n : ym === cur ? now.getDate() : n;
  const avg = sum(vals) / elapsed;
  const todayIdx = ym === cur ? now.getDate() - 1 : -1;
  const maxDay = vals.indexOf(max) + 1;

  const W = 340, H = 160, T = 10, B = 22;
  const ch = H - T - B;
  const bw = W / n;
  const y = (v) => H - B - (v / max) * ch;
  const bars = vals.map((v, i) => {
    if (!v) return '';
    const h = Math.max(2, (v / max) * ch);
    return `<rect x="${(i * bw + bw * 0.18).toFixed(1)}" y="${(H - B - h).toFixed(1)}" width="${(bw * 0.64).toFixed(1)}" height="${h.toFixed(1)}" rx="1.5" class="${i === todayIdx ? 'bar-today' : 'bar-exp'}"/>`;
  }).join('');
  const ticks = [...new Set([1, 5, 10, 15, 20, 25, n])]
    .map((d) => `<text x="${((d - 0.5) * bw).toFixed(1)}" y="${H - 6}" class="axis" text-anchor="middle">${d}</text>`).join('');

  return `<div class="card">
    <div class="card-head"><h2>Chi tiêu theo ngày</h2></div>
    <svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Biểu đồ chi tiêu theo ngày">
      <line x1="0" x2="${W}" y1="${H - B}" y2="${H - B}" class="grid-line"/>
      ${bars}
      <line x1="0" x2="${W}" y1="${y(avg).toFixed(1)}" y2="${y(avg).toFixed(1)}" class="avg-line"/>
      ${ticks}
    </svg>
    <div class="chart-caption"><span><i class="key avg"></i>Trung bình ${money(avg)}/ngày</span><span>Cao nhất: ngày ${maxDay} (${money(max)})</span></div>
  </div>`;
}

function trendCard() {
  const months = [];
  for (let i = 5; i >= 0; i--) months.push(shiftMonth(ui.month, -i));
  const data = months.map((m) => ({ m, ...totals(monthTx(m).filter((t) => t.type !== 'transfer' && inScope(t, ui.scope))) }));
  const max = Math.max(1, ...data.map((d) => Math.max(d.income, d.expense)));

  const W = 340, H = 170, T = 14, B = 22, R = 34; // R: lề phải dành cho nhãn trục
  const ch = H - T - B;
  const gw = (W - R) / 6;
  const bw = Math.min(18, gw * 0.3);
  const grid = [1 / 3, 2 / 3, 1].map((k) => {
    const gy = (H - B - k * ch).toFixed(1);
    return `<line x1="0" x2="${W - R + 4}" y1="${gy}" y2="${gy}" class="grid-line"/><text x="${W}" y="${(Number(gy) + 3).toFixed(1)}" class="axis" text-anchor="end">${compactMoney(max * k)}</text>`;
  }).join('');
  const bars = data.map((d, i) => {
    const cx = gw * i + gw / 2;
    const hi = (d.income / max) * ch;
    const he = (d.expense / max) * ch;
    const label = `T${Number(d.m.slice(5))}`;
    return `<rect x="${(cx - bw - 1).toFixed(1)}" y="${(H - B - hi).toFixed(1)}" width="${bw.toFixed(1)}" height="${hi.toFixed(1)}" rx="2" class="bar-inc"/>
      <rect x="${(cx + 1).toFixed(1)}" y="${(H - B - he).toFixed(1)}" width="${bw.toFixed(1)}" height="${he.toFixed(1)}" rx="2" class="bar-exp"/>
      <text x="${cx.toFixed(1)}" y="${H - 6}" class="axis" text-anchor="middle"${d.m === ui.month ? ' font-weight="700"' : ''}>${label}</text>`;
  }).join('');

  const rows = data.slice().reverse().map((d) => {
    const net = d.income - d.expense;
    return `<tr><td>${monthLabel(d.m).replace('Tháng ', 'T')}</td><td class="income-text">${nf.format(d.income)}</td><td class="expense-text">${nf.format(d.expense)}</td><td>${net < 0 ? '−' : ''}${nf.format(Math.abs(net))}</td></tr>`;
  }).join('');

  return `<div class="card">
    <div class="card-head"><h2>6 tháng gần nhất</h2></div>
    <svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="So sánh thu chi 6 tháng">${grid}<line x1="0" x2="${W}" y1="${H - B}" y2="${H - B}" class="grid-line"/>${bars}</svg>
    <div class="chart-caption"><span><i class="key inc"></i>Thu</span><span><i class="key exp"></i>Chi</span><span style="margin-left:auto">Đơn vị: ₫</span></div>
    <table class="table"><thead><tr><th>Tháng</th><th>Thu</th><th>Chi</th><th>Còn lại</th></tr></thead><tbody>${rows}</tbody></table>
  </div>`;
}

function renderReports() {
  const list = monthTx(ui.month).filter((t) => t.type !== 'transfer' && inScope(t, ui.scope));
  $('#view-reports').innerHTML = scopeChips() + categoryCard(list) + importanceCard(list) + dailyCard(list) + trendCard();
}

/* ---------- Cài đặt ---------- */
function renderSettings() {
  const bal = walletBalances();
  const manual = state.settings.catSort === 'manual';
  const catRow = (c) => `<div class="row">
      <button class="row-main" data-action="edit-cat" data-id="${esc(c.id)}">
        <span class="cat-chip" style="${tint(c.color)}">${c.icon}</span>
        <span class="grow">${esc(c.name)}${c.type === 'expense' ? `<small class="imp imp${c.importance}">${IMPORTANCE[c.importance]}</small>` : ''}</span>
        <span class="muted">${countTx(c.id)} gd</span>
      </button>
      ${manual
        ? `<button class="mini-btn" data-action="move-cat" data-id="${esc(c.id)}" data-dir="-1" aria-label="Lên">↑</button><button class="mini-btn" data-action="move-cat" data-id="${esc(c.id)}" data-dir="1" aria-label="Xuống">↓</button>`
        : '<span class="chev">›</span>'}
    </div>`;
  const catCard = (group) => `<div class="card">
      <div class="card-head"><h2>${GROUP_TITLES[group]}</h2><button class="link" data-action="add-cat" data-group="${group}">+ Thêm</button></div>
      ${catsOfGroup(group).map(catRow).join('')}
    </div>`;
  const walletRow = (w) => {
    const b = bal[w.id];
    const value = w.kind === 'credit' ? (b <= 0 ? `nợ ${money(-b)}` : `dư ${money(b)}`) : smoney(b);
    return `<button class="row" data-action="edit-wallet" data-id="${esc(w.id)}">
      <span class="wicon">${w.icon}</span>
      <span class="grow">${esc(w.name)}<small class="muted block">${w.kind === 'credit' ? 'Ví trả sau' : 'Ví thường'}</small></span>
      <span class="${w.kind === 'credit' && b < 0 ? 'expense-text' : ''}">${value}</span><span class="chev">›</span>
    </button>`;
  };
  const lastBackup = state.settings.lastBackup;

  $('#view-settings').innerHTML = `
    <div class="card">
      <div class="card-head"><h2>Ví & nguồn tiền</h2><button class="link" data-action="add-wallet">+ Thêm ví</button></div>
      <p class="hint">Chạm vào ví để đổi tên hoặc nhập số dư / dư nợ ban đầu.</p>
      ${state.wallets.map(walletRow).join('')}
    </div>

    <div class="card">
      <div class="card-head"><h2>Ngân sách cá nhân hằng tháng</h2><span class="muted" id="budgetTotal"></span></div>
      <p class="hint">Hạn mức chi mỗi tháng cho từng danh mục cá nhân. Để trống nếu không cần.</p>
      ${catsOfGroup('personal').map((c) => `<label class="row">
          <span class="cat-chip" style="${tint(c.color)}">${c.icon}</span>
          <span class="grow">${esc(c.name)}</span>
          <input class="money-input" inputmode="numeric" autocomplete="off" data-budget="${esc(c.id)}" placeholder="Không đặt" value="${state.budgets[c.id] ? nf.format(state.budgets[c.id]) : ''}">
        </label>`).join('')}
    </div>

    <div class="card">
      <div class="card-head"><h2>Sắp xếp danh mục</h2>
        <select id="catSort" class="mini-select" aria-label="Sắp xếp danh mục">${Object.entries(SORTS).map(([k, v]) => `<option value="${k}"${state.settings.catSort === k ? ' selected' : ''}>${v}</option>`).join('')}</select>
      </div>
      <p class="hint" style="margin-bottom:0">Áp dụng cho lưới chọn danh mục khi nhập và các danh sách bên dưới.${manual ? ' Dùng nút ↑ ↓ để đổi thứ tự.' : ''}</p>
    </div>
    ${catCard('personal')}${catCard('work')}${catCard('income')}

    <div class="card">
      <h2>Sao lưu & xuất dữ liệu</h2>
      <p class="hint">${state.transactions.length} giao dịch đang lưu trên máy này. Lần sao lưu gần nhất: <b>${lastBackup ? new Date(lastBackup).toLocaleString('vi-VN') : 'chưa có'}</b>.<br>
        Nên sao lưu định kỳ và lưu file vào iCloud Drive (ứng dụng Tệp) để không mất dữ liệu khi đổi máy.</p>
      <div class="btn-col">
        <button class="btn primary" data-action="export-json">💾 Xuất file sao lưu (.json)</button>
        <button class="btn" data-action="copy-month">📋 Sao chép ${monthLabel(ui.month).toLowerCase()} cho Google Sheets</button>
        <button class="btn" data-action="copy-all">📋 Sao chép toàn bộ cho Google Sheets</button>
        <button class="btn" data-action="export-csv">📊 Xuất bảng tính (.csv)</button>
        <label class="btn">📥 Khôi phục từ file sao lưu
          <input type="file" id="importFile" class="file-input" accept=".json,application/json">
        </label>
        <button class="btn danger" data-action="reset-all">🗑️ Xoá toàn bộ dữ liệu</button>
      </div>
    </div>

    ${isStandalone() ? '' : `<div class="card">
      <h2>Cài lên iPhone</h2>
      <ol class="steps">
        <li>Mở trang này bằng <b>Safari</b>.</li>
        <li>Nhấn nút <b>Chia sẻ</b> (hình vuông có mũi tên hướng lên).</li>
        <li>Chọn <b>“Thêm vào MH chính”</b> rồi nhấn <b>Thêm</b>.</li>
      </ol>
    </div>`}
    <p class="footer">Quản lý chi tiêu · phiên bản ${APP_VERSION}</p>`;
  updateBudgetTotal();
}

function updateBudgetTotal() {
  const el = $('#budgetTotal');
  if (el) el.textContent = 'Tổng ' + money(sum(Object.values(state.budgets)));
}

function moveCat(id, dir) {
  const cats = state.categories;
  const i = cats.findIndex((c) => c.id === id);
  if (i < 0) return;
  let j = i + dir;
  while (j >= 0 && j < cats.length && cats[j].group !== cats[i].group) j += dir;
  if (j < 0 || j >= cats.length) return;
  [cats[i], cats[j]] = [cats[j], cats[i]];
  save();
  render();
}

/* =========================================================
   Bảng trượt (thêm/sửa)
   ========================================================= */
function openSheet(html) {
  const sheet = $('#sheet');
  sheet.innerHTML = `<div class="sheet-backdrop"></div><div class="sheet-panel" role="dialog" aria-modal="true">${html}</div>`;
  sheet.hidden = false;
  document.body.classList.add('no-scroll');
  sheet.offsetHeight; // ép trình duyệt vẽ trạng thái ban đầu để có hiệu ứng trượt lên
  sheet.classList.add('open');
  $('.sheet-backdrop', sheet).addEventListener('click', closeSheet);
  const panel = $('.sheet-panel', sheet);
  // Nút trong bảng thường bị vẽ lại ngay khi bấm (đã rời khỏi trang), nên chặn cú bấm
  // lan ra trình xử lý chung, tránh bị hiểu nhầm là bấm vào nút cùng tên ngoài trang.
  panel.addEventListener('click', (e) => e.stopPropagation());
  return panel;
}

function closeSheet() {
  const sheet = $('#sheet');
  if (document.activeElement) document.activeElement.blur();
  sheet.classList.remove('open');
  document.body.classList.remove('no-scroll');
  setTimeout(() => {
    if (!sheet.classList.contains('open')) {
      sheet.hidden = true;
      sheet.innerHTML = '';
    }
  }, 280);
}

function sheetHead(title) {
  return `<div class="sheet-head"><button class="link" data-sheet="cancel">Huỷ</button><h2>${title}</h2><button class="link strong" data-sheet="save">Lưu</button></div>`;
}

function walletChips(selected, attr, exclude) {
  const bal = walletBalances();
  return state.wallets.filter((w) => w.id !== exclude).map((w) => {
    const extra = w.kind === 'credit' ? `<small>nợ ${compactMoney(Math.max(0, -bal[w.id]))}</small>` : '';
    return `<button class="wchip${w.id === selected ? ' active' : ''}" data-${attr}="${esc(w.id)}">${w.icon} ${esc(w.name)}${extra}</button>`;
  }).join('');
}

// preset: { type, toId, amount } cho các lối tắt "Chuyển ví" / "Trả nợ"
function openTxSheet(tx, preset = {}) {
  const editing = !!tx;
  let type = editing ? tx.type : preset.type || last.type;
  let scope = editing && tx.type !== 'transfer' ? tx.scope : ui.scope !== 'all' ? ui.scope : last.scope;
  let catId = editing ? tx.categoryId || null : null;
  let walletId = editing && tx.walletId ? tx.walletId : last.wallet[type === 'income' ? 'income' : 'expense'];
  const firstCredit = state.wallets.find((w) => w.kind === 'credit');
  let fromId = editing && tx.fromId ? tx.fromId : MAIN_WALLET;
  let toId = editing && tx.toId ? tx.toId : preset.toId || (firstCredit ? firstCredit.id : (state.wallets.find((w) => w.id !== MAIN_WALLET) || {}).id);
  let repaid = editing && tx.repaid ? { ...tx.repaid } : null;
  const defaultDate = editing ? tx.date : ui.month === currentMonth() ? todayStr() : `${ui.month}-01`;
  const startAmount = editing ? tx.amount : preset.amount || 0;

  const p = openSheet(`${sheetHead(editing ? 'Sửa giao dịch' : 'Thêm giao dịch')}
    <div class="sheet-body">
      <div class="seg seg3" id="txType"><button data-t="expense">Khoản chi</button><button data-t="income">Khoản thu</button><button data-t="transfer">Chuyển ví</button></div>
      <div class="seg seg3 small" id="txScope"></div>
      <div class="amount-box"><input id="txAmount" inputmode="numeric" autocomplete="off" placeholder="0" aria-label="Số tiền" value="${startAmount ? nf.format(startAmount) : ''}"><span>₫</span></div>
      <div class="chips"><button data-add="000">000</button><button data-add="10000">+10k</button><button data-add="50000">+50k</button><button data-add="100000">+100k</button><button data-add="500000">+500k</button></div>
      <div id="txCatWrap"><div class="cat-grid" id="txCats"></div></div>
      <div id="txWalletWrap"><div class="field-label" id="txWalletLabel"></div><div class="wallet-chips" id="txWallets"></div></div>
      <div id="txTransferWrap">
        <div class="field-label">Từ ví</div><div class="wallet-chips" id="txFrom"></div>
        <div class="field-label">Đến ví</div><div class="wallet-chips" id="txTo"></div>
        <div id="txDebtHint"></div>
      </div>
      <label class="field" style="margin-top:14px"><span>Ngày</span><input type="date" id="txDate" value="${defaultDate}"></label>
      <label class="field"><span>Ghi chú</span><input type="text" id="txNote" maxlength="100" placeholder="Không bắt buộc" value="${esc(editing ? tx.note : '')}"></label>
      <div id="txAdvance"></div>
      ${editing ? '<button class="btn danger full" data-sheet="delete">Xoá giao dịch này</button>' : ''}
    </div>`);
  const amount = $('#txAmount', p);

  const paintCats = () => {
    const group = catGroupFor(type, scope);
    const cats = catsOfGroup(group);
    if (!cats.some((c) => c.id === catId)) catId = null;
    $('#txCats', p).innerHTML = cats.map((c) => `<button class="cat-pick${c.id === catId ? ' active' : ''}" data-cat="${esc(c.id)}">
      <span class="cat-chip" style="${tint(c.color)}">${c.icon}</span><span>${esc(c.name)}</span></button>`).join('');
  };
  const paintWallets = () => {
    $('#txWalletLabel', p).textContent = type === 'income' ? 'Nhận vào ví' : 'Trả từ ví';
    $('#txWallets', p).innerHTML = walletChips(walletId, 'wallet');
  };
  const paintTransfer = () => {
    if (fromId === toId) toId = (state.wallets.find((w) => w.id !== fromId) || {}).id;
    $('#txFrom', p).innerHTML = walletChips(fromId, 'from');
    $('#txTo', p).innerHTML = walletChips(toId, 'to', fromId);
    const to = walletById(toId);
    const debt = -walletBalances()[toId];
    $('#txDebtHint', p).innerHTML = to.kind === 'credit'
      ? `<div class="status-box">Dư nợ hiện tại của ${esc(to.name)}: <b>${money(Math.max(0, debt))}</b>${debt > 0 ? ` <button class="mini-btn" data-fill="${debt}">Trả hết</button>` : ''}<br><small>Trả nợ chỉ trừ tiền ví nguồn và giảm dư nợ, không tính thêm vào chi tiêu.</small></div>`
      : '';
  };
  const paintAdvance = () => {
    const box = $('#txAdvance', p);
    if (type !== 'expense' || scope !== 'advance') { box.innerHTML = ''; return; }
    box.innerHTML = repaid
      ? `<div class="status-box ok">✅ <b>Đã hoàn tiền</b> <button class="mini-btn" data-repay="off">Huỷ</button>
          <div class="field-label">Tiền hoàn nhận vào ví</div><div class="wallet-chips">${walletChips(repaid.walletId, 'repay-wallet')}</div>
          <label class="field" style="margin:10px 0 0"><span>Ngày hoàn</span><input type="date" id="txRepaidDate" value="${repaid.date}"></label>
          <small>Số dư ví tăng lên nhưng không tính là thu nhập.</small></div>`
      : `<div class="status-box warn">⏳ <b>Chờ hoàn ứng</b> <button class="mini-btn" data-repay="on">Đánh dấu đã hoàn</button></div>`;
  };
  const paint = () => {
    $$('#txType button', p).forEach((b) => b.classList.toggle('active', b.dataset.t === type));
    if (type === 'income' && scope === 'advance') scope = 'personal';
    const scopes = type === 'expense' ? ['personal', 'work', 'advance'] : type === 'income' ? ['personal', 'work'] : [];
    const scopeBox = $('#txScope', p);
    scopeBox.hidden = !scopes.length;
    scopeBox.classList.toggle('seg3', scopes.length === 3);
    scopeBox.innerHTML = scopes.map((k) => `<button data-scope-pick="${k}" class="${k === scope ? 'active' : ''}">${SCOPES[k]}</button>`).join('');
    p.classList.toggle('is-income', type === 'income');
    p.classList.toggle('is-transfer', type === 'transfer');
    $('#txCatWrap', p).hidden = type === 'transfer';
    $('#txWalletWrap', p).hidden = type === 'transfer';
    $('#txTransferWrap', p).hidden = type !== 'transfer';
    if (type === 'transfer') paintTransfer();
    else { paintCats(); paintWallets(); }
    paintAdvance();
  };
  paint();
  amount.addEventListener('input', () => formatMoneyInput(amount));

  const submit = () => {
    const value = parseMoney(amount.value);
    if (!value) { toast('Hãy nhập số tiền', 'error'); amount.focus(); return; }
    const rec = {
      id: editing ? tx.id : uid(),
      type,
      amount: value,
      date: $('#txDate', p).value || todayStr(),
      note: $('#txNote', p).value.trim(),
      createdAt: editing ? tx.createdAt : Date.now(),
    };
    if (type === 'transfer') {
      if (!fromId || !toId || fromId === toId) { toast('Hãy chọn hai ví khác nhau', 'error'); return; }
      Object.assign(rec, { fromId, toId });
    } else {
      if (!catId) { toast('Hãy chọn danh mục', 'error'); return; }
      Object.assign(rec, { scope, categoryId: catId, walletId });
      if (type === 'expense' && scope === 'advance') {
        rec.repaid = repaid ? { walletId: repaid.walletId, date: $('#txRepaidDate', p).value || todayStr() } : null;
      }
      last.scope = scope;
      last.wallet[type] = walletId;
    }
    last.type = type;
    const others = state.transactions.filter((t) => t.id !== rec.id);
    const warning = budgetWarning(others, rec);
    state.transactions = [...others, rec];
    save();
    closeSheet();
    render();
    if (warning) toast(warning.msg, warning.level);
    else toast(editing ? 'Đã cập nhật giao dịch' : 'Đã thêm giao dịch');
  };

  p.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const d = b.dataset;
    if (d.t) { if (d.t !== type) { type = d.t; catId = null; walletId = last.wallet[type === 'income' ? 'income' : 'expense']; paint(); } }
    else if (d.scopePick) { scope = d.scopePick; paint(); }
    else if (d.cat) { catId = d.cat; paintCats(); }
    else if (d.wallet) { walletId = d.wallet; paintWallets(); }
    else if (d.from) { fromId = d.from; paintTransfer(); }
    else if (d.to) { toId = d.to; paintTransfer(); }
    else if (d.fill) amount.value = nf.format(Number(d.fill));
    else if (d.repay) { repaid = d.repay === 'on' ? { walletId: MAIN_WALLET, date: todayStr() } : null; paintAdvance(); }
    else if (d.repayWallet) { repaid.walletId = d.repayWallet; repaid.date = $('#txRepaidDate', p).value || repaid.date; paintAdvance(); }
    else if (d.add) {
      const cur = parseMoney(amount.value);
      const next = d.add === '000' ? cur * 1000 : cur + Number(d.add);
      if (next < 1e12) amount.value = next ? nf.format(next) : '';
    }
    else if (d.sheet === 'cancel') closeSheet();
    else if (d.sheet === 'save') submit();
    else if (d.sheet === 'delete' && confirm('Xoá giao dịch này?')) {
      state.transactions = state.transactions.filter((t) => t.id !== tx.id);
      save();
      closeSheet();
      render();
      toast('Đã xoá giao dịch');
    }
  });

  if (!editing && !preset.amount) amount.focus();
}

function openCatSheet(cat, newGroup) {
  const editing = !!cat;
  const group = editing ? cat.group : newGroup;
  let icon = editing ? cat.icon : EMOJIS[0];
  let color = editing ? cat.color : COLORS[state.categories.length % COLORS.length];
  let importance = editing ? cat.importance : 2;
  const canDelete = editing && !isLockedCat(cat.id);
  const title = editing ? 'Sửa danh mục' : group === 'income' ? 'Thêm danh mục thu' : group === 'work' ? 'Thêm danh mục công việc' : 'Thêm danh mục chi';

  const p = openSheet(`${sheetHead(title)}
    <div class="sheet-body">
      <div class="cat-preview"><span class="cat-chip big" id="cPrev"></span></div>
      <label class="field"><span>Tên</span><input id="cName" maxlength="30" placeholder="VD: Cà phê" value="${esc(editing ? cat.name : '')}"></label>
      ${group === 'income' ? '' : `<div class="field-label">Mức độ quan trọng</div>
        <div class="seg seg3 small" id="cImp">${[1, 2, 3].map((k) => `<button data-imp="${k}">${IMPORTANCE[k]}</button>`).join('')}</div>`}
      <div class="field-label">Biểu tượng</div>
      <div class="emoji-grid">${EMOJIS.map((e) => `<button data-emoji="${e}">${e}</button>`).join('')}</div>
      <div class="field-label">Màu</div>
      <div class="color-row">${COLORS.map((c) => `<button data-color="${c}" style="background:${c}" aria-label="Màu ${c}"></button>`).join('')}</div>
      ${canDelete ? '<button class="btn danger full" data-sheet="delete" style="margin-top:20px">Xoá danh mục</button>' : ''}
    </div>`);

  const paint = () => {
    const prev = $('#cPrev', p);
    prev.textContent = icon;
    prev.style.background = color + '22';
    $$('[data-emoji]', p).forEach((b) => b.classList.toggle('active', b.dataset.emoji === icon));
    $$('[data-color]', p).forEach((b) => b.classList.toggle('active', b.dataset.color === color));
    $$('[data-imp]', p).forEach((b) => b.classList.toggle('active', Number(b.dataset.imp) === importance));
  };
  paint();

  p.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const d = b.dataset;
    if (d.emoji) { icon = d.emoji; paint(); }
    else if (d.color) { color = d.color; paint(); }
    else if (d.imp) { importance = Number(d.imp); paint(); }
    else if (d.sheet === 'cancel') closeSheet();
    else if (d.sheet === 'save') {
      const name = $('#cName', p).value.trim();
      if (!name) { toast('Hãy nhập tên danh mục', 'error'); return; }
      if (editing) Object.assign(cat, { name, icon, color, importance });
      else state.categories.push({ id: uid(), name, icon, color, importance, group, type: group === 'income' ? 'income' : 'expense' });
      save();
      closeSheet();
      render();
      toast(editing ? 'Đã cập nhật danh mục' : 'Đã thêm danh mục');
    }
    else if (d.sheet === 'delete') {
      const n = countTx(cat.id);
      const msg = n
        ? `Xoá danh mục “${cat.name}”?\n${n} giao dịch của danh mục này sẽ được chuyển sang “Khác”.`
        : `Xoá danh mục “${cat.name}”?`;
      if (!confirm(msg)) return;
      for (const t of state.transactions) if (t.categoryId === cat.id) t.categoryId = FALLBACK[cat.group];
      delete state.budgets[cat.id];
      state.categories = state.categories.filter((c) => c.id !== cat.id);
      save();
      closeSheet();
      render();
      toast('Đã xoá danh mục');
    }
  });

  if (!editing) $('#cName', p).focus();
}

function openWalletSheet(w) {
  const editing = !!w;
  let icon = editing ? w.icon : '💳';
  let kind = editing ? w.kind : 'normal';
  const canDelete = editing && w.id !== MAIN_WALLET;

  const p = openSheet(`${sheetHead(editing ? 'Sửa ví' : 'Thêm ví')}
    <div class="sheet-body">
      <div class="cat-preview"><span class="cat-chip big" id="wPrev" style="background:var(--input)"></span></div>
      <label class="field"><span>Tên</span><input id="wName" maxlength="30" placeholder="VD: Thẻ tín dụng" value="${esc(editing ? w.name : '')}"></label>
      <div class="seg" id="wKind"><button data-kind="normal">Ví thường</button><button data-kind="credit">Ví trả sau</button></div>
      <div class="field-label" id="wOpenLabel"></div>
      <label class="field"><input id="wOpening" inputmode="numeric" autocomplete="off" placeholder="0" value="${editing && w.opening ? nf.format(w.opening) : ''}" aria-label="Số tiền ban đầu"></label>
      <p class="hint" id="wHint"></p>
      <div class="field-label">Biểu tượng</div>
      <div class="emoji-grid">${WALLET_ICONS.map((e) => `<button data-emoji="${e}">${e}</button>`).join('')}</div>
      ${canDelete ? '<button class="btn danger full" data-sheet="delete" style="margin-top:20px">Xoá ví</button>' : ''}
    </div>`);
  const opening = $('#wOpening', p);
  opening.addEventListener('input', () => formatMoneyInput(opening));

  const paint = () => {
    $('#wPrev', p).textContent = icon;
    $$('[data-emoji]', p).forEach((b) => b.classList.toggle('active', b.dataset.emoji === icon));
    $$('[data-kind]', p).forEach((b) => b.classList.toggle('active', b.dataset.kind === kind));
    $('#wOpenLabel', p).textContent = kind === 'credit' ? 'Dư nợ ban đầu (₫)' : 'Số dư ban đầu (₫)';
    $('#wHint', p).textContent = kind === 'credit'
      ? 'Số tiền đang nợ lúc bắt đầu dùng app. Mua hàng bằng ví này sẽ cộng vào dư nợ; trả nợ bằng “Chuyển ví” từ ví khác.'
      : 'Số tiền đang có trong ví lúc bắt đầu dùng app. App tự cộng thu, trừ chi và tính các lần chuyển ví.';
  };
  paint();

  p.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const d = b.dataset;
    if (d.emoji) { icon = d.emoji; paint(); }
    else if (d.kind) { kind = d.kind; paint(); }
    else if (d.sheet === 'cancel') closeSheet();
    else if (d.sheet === 'save') {
      const name = $('#wName', p).value.trim();
      if (!name) { toast('Hãy nhập tên ví', 'error'); return; }
      const data = { name, icon, kind, opening: parseMoney(opening.value) };
      if (editing) Object.assign(w, data);
      else state.wallets.push({ id: uid(), ...data });
      save();
      closeSheet();
      render();
      toast(editing ? 'Đã cập nhật ví' : 'Đã thêm ví');
    }
    else if (d.sheet === 'delete') {
      const n = walletUseCount(w.id);
      if (n) { toast(`Ví đang có ${n} giao dịch nên không xoá được. Bạn có thể đổi tên ví.`, 'error'); return; }
      if (!confirm(`Xoá ví “${w.name}”?`)) return;
      state.wallets = state.wallets.filter((x) => x.id !== w.id);
      save();
      closeSheet();
      render();
      toast('Đã xoá ví');
    }
  });

  if (!editing) $('#wName', p).focus();
}

/* =========================================================
   Sao lưu, khôi phục & xuất dữ liệu
   ========================================================= */
// Trên iPhone dùng bảng Chia sẻ (có "Lưu vào Tệp"); nơi khác thì tải file xuống
async function shareOrDownload(blob, filename) {
  const file = new File([blob], filename, { type: blob.type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return true;
    } catch (e) {
      if (e.name === 'AbortError') return false;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

function exportJSON() {
  const data = JSON.stringify({ app: 'quan-ly-chi-tieu', exportedAt: new Date().toISOString(), ...state }, null, 2);
  shareOrDownload(new Blob([data], { type: 'application/json' }), `chi-tieu-${todayStr()}.json`).then((ok) => {
    if (!ok) return;
    state.settings.lastBackup = Date.now();
    save();
    render();
    toast('Đã xuất file sao lưu');
  });
}

// Bảng dữ liệu dùng chung cho CSV và Google Sheets. Số tiền: chi âm, thu dương.
function exportRows(list) {
  const rows = [['Ngày', 'Loại', 'Phạm vi', 'Danh mục', 'Ví', 'Số tiền', 'Ghi chú', 'Hoàn ứng']];
  const sorted = list.slice().sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);
  for (const t of sorted) {
    if (t.type === 'transfer') {
      rows.push([t.date, 'Chuyển ví', '', '', `${walletById(t.fromId).name} → ${walletById(t.toId).name}`, t.amount, t.note, '']);
      continue;
    }
    const advance = t.scope === 'advance' ? (t.repaid ? `Đã hoàn ${t.repaid.date}` : 'Chờ hoàn') : '';
    rows.push([t.date, t.type === 'expense' ? 'Chi' : 'Thu', SCOPES[t.scope], catById(t.categoryId).name, walletById(t.walletId).name,
      t.type === 'expense' ? -t.amount : t.amount, t.note, advance]);
  }
  return rows;
}

// Tránh Excel/Sheets hiểu chữ bắt đầu bằng = + @ là công thức
const safeText = (v) => (typeof v === 'string' && /^[=+@]/.test(v) ? "'" + v : v);

function exportCSV() {
  const cell = (v) => {
    const s = String(safeText(v));
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = '﻿' + exportRows(state.transactions).map((r) => r.map(cell).join(',')).join('\r\n');
  shareOrDownload(new Blob([csv], { type: 'text/csv' }), `chi-tieu-${todayStr()}.csv`);
}

async function copyForSheets(all) {
  const list = all ? state.transactions : monthTx(ui.month);
  if (!list.length) { toast('Không có giao dịch nào để sao chép', 'error'); return; }
  const tsv = exportRows(list).map((r) => r.map((v) => String(safeText(v)).replace(/[\t\r\n]+/g, ' ')).join('\t')).join('\n');
  let ok = false;
  try {
    await navigator.clipboard.writeText(tsv);
    ok = true;
  } catch (e) {
    const ta = document.createElement('textarea');
    ta.value = tsv;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
    ta.remove();
  }
  if (ok) toast(`Đã sao chép ${list.length} giao dịch. Mở Google Sheets, chọn ô A1 rồi dán.`);
  else toast('Không sao chép được. Hãy dùng “Xuất bảng tính (.csv)”.', 'error');
}

function importFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    let data;
    try { data = JSON.parse(reader.result); } catch (e) { toast('File không đọc được', 'error'); return; }
    if (!data || !Array.isArray(data.transactions) || !Array.isArray(data.categories)) {
      toast('Đây không phải file sao lưu của app', 'error');
      return;
    }
    const next = normalizeState(data);
    const ok = confirm(`Khôi phục ${next.transactions.length} giao dịch từ file?\n\nDữ liệu hiện tại (${state.transactions.length} giao dịch) sẽ bị thay thế.`);
    if (!ok) return;
    state = next;
    save();
    render();
    toast('Đã khôi phục dữ liệu');
  };
  reader.readAsText(file);
}

function resetAll() {
  if (!confirm('Xoá TOÀN BỘ giao dịch, ví, danh mục và ngân sách?')) return;
  if (!confirm('Không thể hoàn tác. Bạn chắc chắn chứ?')) return;
  state = defaultState();
  save();
  render();
  toast('Đã xoá toàn bộ dữ liệu');
}

/* =========================================================
   Thông báo nhanh
   ========================================================= */
let toastTimer;
function toast(msg, level = '') {
  const el = $('#toast');
  el.textContent = msg;
  el.className = 'show ' + level;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = ''; }, level ? 3500 : 2600);
}

/* =========================================================
   Sự kiện
   ========================================================= */
document.addEventListener('click', (e) => {
  if (!e.target.isConnected || e.target.closest('#sheet')) return; // bảng trượt tự xử lý sự kiện của nó
  const el = e.target.closest('[data-view],[data-month],[data-edit],[data-report-type],[data-scope],[data-hist],[data-wallet],[data-action]');
  if (!el) return;
  const d = el.dataset;

  if (d.view) {
    ui.view = d.view;
    render();
    window.scrollTo(0, 0);
  } else if (d.month) {
    ui.month = shiftMonth(ui.month, Number(d.month));
    render();
  } else if (d.edit) {
    const tx = state.transactions.find((t) => t.id === d.edit);
    if (tx) openTxSheet(tx);
  } else if (d.reportType) {
    ui.reportType = d.reportType;
    render();
  } else if (d.scope) {
    ui.scope = d.scope;
    render();
  } else if (d.hist) {
    ui.histMode = d.hist;
    render();
  } else if (d.wallet) {
    Object.assign(ui, { view: 'history', histMode: 'list', filter: 'wallet:' + d.wallet, search: '' });
    render();
    window.scrollTo(0, 0);
  } else {
    switch (d.action) {
      case 'add-tx': openTxSheet(); break;
      case 'add-transfer': openTxSheet(null, { type: 'transfer' }); break;
      case 'pay-debt': openTxSheet(null, { type: 'transfer', toId: d.id, amount: Math.max(0, -walletBalances()[d.id]) }); break;
      case 'show-pending':
        Object.assign(ui, { view: 'history', histMode: 'pending' });
        render();
        window.scrollTo(0, 0);
        break;
      case 'this-month': ui.month = currentMonth(); render(); break;
      case 'add-cat': openCatSheet(null, d.group); break;
      case 'edit-cat': openCatSheet(state.categories.find((c) => c.id === d.id)); break;
      case 'move-cat': moveCat(d.id, Number(d.dir)); break;
      case 'add-wallet': openWalletSheet(); break;
      case 'edit-wallet': openWalletSheet(state.wallets.find((w) => w.id === d.id)); break;
      case 'export-json': exportJSON(); break;
      case 'export-csv': exportCSV(); break;
      case 'copy-month': copyForSheets(false); break;
      case 'copy-all': copyForSheets(true); break;
      case 'reset-all': resetAll(); break;
      case 'hide-install':
        try { localStorage.setItem(HIDE_INSTALL_KEY, '1'); } catch (err) { /* bỏ qua */ }
        render();
        break;
    }
  }
});

document.addEventListener('input', (e) => {
  const t = e.target;
  if (t.id === 'hSearch') { ui.search = t.value; renderHistoryList(); }
  else if (t.dataset.budget) formatMoneyInput(t);
});

document.addEventListener('change', (e) => {
  const t = e.target;
  if (t.id === 'hFilter') { ui.filter = t.value; renderHistoryList(); }
  else if (t.id === 'catSort') { state.settings.catSort = t.value; save(); render(); }
  else if (t.id === 'importFile') { importFile(t.files[0]); t.value = ''; }
  else if (t.dataset.budget) {
    const v = parseMoney(t.value);
    if (v > 0) state.budgets[t.dataset.budget] = v;
    else delete state.budgets[t.dataset.budget];
    save();
    updateBudgetTotal();
  }
});

// Mở lại app sau một thời gian: vẽ lại để cập nhật "hôm nay", số ngày còn lại...
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && $('#sheet').hidden) render();
});

/* =========================================================
   Khởi động
   ========================================================= */
render();
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
