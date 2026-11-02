'use strict';

/* =========================================================
   Tiện ích chung
   ========================================================= */
const STORAGE_KEY = 'chitieu.v1';
const HIDE_INSTALL_KEY = 'chitieu.hideInstall';
const APP_VERSION = '1.0.0';

const nf = new Intl.NumberFormat('vi-VN');
const money = (n) => nf.format(Math.round(n)) + ' ₫';
const pad = (n) => String(n).padStart(2, '0');
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const sum = (arr) => arr.reduce((s, x) => s + x, 0);

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

/* =========================================================
   Dữ liệu
   ========================================================= */
const DEFAULT_CATEGORIES = [
  { id: 'food', name: 'Ăn uống', icon: '🍜', color: '#f97316', type: 'expense' },
  { id: 'transport', name: 'Đi lại', icon: '🛵', color: '#3b82f6', type: 'expense' },
  { id: 'home', name: 'Nhà ở', icon: '🏠', color: '#8b5cf6', type: 'expense' },
  { id: 'bills', name: 'Hoá đơn', icon: '💡', color: '#eab308', type: 'expense' },
  { id: 'shopping', name: 'Mua sắm', icon: '🛍️', color: '#ec4899', type: 'expense' },
  { id: 'fun', name: 'Giải trí', icon: '🎬', color: '#06b6d4', type: 'expense' },
  { id: 'health', name: 'Sức khoẻ', icon: '💊', color: '#ef4444', type: 'expense' },
  { id: 'edu', name: 'Học tập', icon: '📚', color: '#14b8a6', type: 'expense' },
  { id: 'gift', name: 'Quà tặng', icon: '🎁', color: '#a855f7', type: 'expense' },
  { id: 'other-exp', name: 'Khác', icon: '📦', color: '#64748b', type: 'expense' },
  { id: 'salary', name: 'Lương', icon: '💼', color: '#0e9f6e', type: 'income' },
  { id: 'bonus', name: 'Thưởng', icon: '🏆', color: '#22c55e', type: 'income' },
  { id: 'side', name: 'Làm thêm', icon: '💻', color: '#10b981', type: 'income' },
  { id: 'invest', name: 'Đầu tư', icon: '📈', color: '#84cc16', type: 'income' },
  { id: 'other-inc', name: 'Khác', icon: '💰', color: '#64748b', type: 'income' },
];
// Danh mục "Khác" không xoá được: giao dịch của danh mục bị xoá sẽ chuyển về đây
const FALLBACK = { expense: 'other-exp', income: 'other-inc' };
const isLocked = (id) => id === FALLBACK.expense || id === FALLBACK.income;

const EMOJIS = ['🍜', '🍔', '☕', '🧋', '🍺', '🛒', '🛵', '🚗', '⛽', '🚌', '✈️', '🏠', '💡', '💧', '📱', '🌐',
  '🛍️', '👕', '💄', '💇', '🎬', '🎮', '🎵', '⚽', '💊', '🏥', '📚', '🎓', '🎁', '❤️', '👶', '🐶',
  '💼', '🏆', '💻', '📈', '💰', '🏦', '🧾', '📦'];
const COLORS = ['#f97316', '#ef4444', '#ec4899', '#a855f7', '#8b5cf6', '#3b82f6', '#06b6d4', '#14b8a6',
  '#0e9f6e', '#84cc16', '#eab308', '#64748b'];

function defaultState() {
  return {
    version: 1,
    categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
    transactions: [],
    budgets: {},
    settings: { lastBackup: null },
  };
}

// Kiểm tra và làm sạch dữ liệu (dùng khi mở app và khi nhập file sao lưu)
function normalizeState(s) {
  const out = defaultState();
  if (Array.isArray(s.categories) && s.categories.length) {
    out.categories = s.categories
      .filter((c) => c && c.id && c.name && (c.type === 'expense' || c.type === 'income'))
      .map((c) => ({
        id: String(c.id),
        name: String(c.name).slice(0, 30),
        icon: String(c.icon || '📦').slice(0, 8),
        color: /^#[0-9a-f]{6}$/i.test(c.color) ? c.color : '#64748b',
        type: c.type,
      }));
  }
  for (const id of Object.values(FALLBACK)) {
    if (!out.categories.some((c) => c.id === id)) out.categories.push({ ...DEFAULT_CATEGORIES.find((c) => c.id === id) });
  }
  const catType = new Map(out.categories.map((c) => [c.id, c.type]));

  out.transactions = (Array.isArray(s.transactions) ? s.transactions : [])
    .filter((t) => t && (t.type === 'expense' || t.type === 'income') && Number(t.amount) > 0 && /^\d{4}-\d{2}-\d{2}$/.test(t.date))
    .map((t) => ({
      id: String(t.id || uid()),
      type: t.type,
      amount: Math.round(Number(t.amount)),
      categoryId: catType.get(String(t.categoryId)) === t.type ? String(t.categoryId) : FALLBACK[t.type],
      date: t.date,
      note: String(t.note || '').slice(0, 100),
      createdAt: Number(t.createdAt) || Date.now(),
    }));

  if (s.budgets && typeof s.budgets === 'object') {
    for (const [id, v] of Object.entries(s.budgets)) {
      if (catType.get(id) === 'expense' && Number(v) > 0) out.budgets[id] = Math.round(Number(v));
    }
  }
  out.settings.lastBackup = Number(s.settings && s.settings.lastBackup) || null;
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
const ui = { view: 'home', month: currentMonth(), search: '', filter: 'all', reportType: 'expense' };
let lastTxType = 'expense';

/* ---------- Truy vấn ---------- */
const UNKNOWN_CAT = { id: '', name: 'Không rõ', icon: '❓', color: '#94a3b8' };
const catById = (id) => state.categories.find((c) => c.id === id) || UNKNOWN_CAT;
const catsOf = (type) => state.categories.filter((c) => c.type === type);
const monthTx = (ym) => state.transactions.filter((t) => t.date.startsWith(ym));
const sortTx = (list) => list.slice().sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
const countTx = (catId) => state.transactions.filter((t) => t.categoryId === catId).length;

function totals(list) {
  let income = 0;
  let expense = 0;
  for (const t of list) {
    if (t.type === 'income') income += t.amount;
    else expense += t.amount;
  }
  return { income, expense };
}

function sumByCategory(list, type) {
  const m = {};
  for (const t of list) if (t.type === type) m[t.categoryId] = (m[t.categoryId] || 0) + t.amount;
  return m;
}

const tint = (color) => `background:${color}22`;

/* =========================================================
   Hiển thị
   ========================================================= */
const TITLES = { home: 'Tổng quan', history: 'Lịch sử', reports: 'Báo cáo', settings: 'Cài đặt' };

function render() {
  $('#viewTitle').textContent = TITLES[ui.view];
  $('#monthLabel').textContent = monthLabel(ui.month);
  $('#monthSwitch').hidden = ui.view === 'settings';
  $$('.view').forEach((v) => v.classList.toggle('active', v.id === 'view-' + ui.view));
  $$('.tabbar [data-view]').forEach((b) => b.classList.toggle('active', b.dataset.view === ui.view));
  ({ home: renderHome, history: renderHistory, reports: renderReports, settings: renderSettings })[ui.view]();
}

function txItem(t, withDate) {
  const c = catById(t.categoryId);
  const sub = [t.note, withDate ? shortDate(t.date) : ''].filter(Boolean).map(esc).join(' · ');
  return `<button class="tx" data-edit="${esc(t.id)}">
    <span class="cat-chip" style="${tint(c.color)}">${c.icon}</span>
    <span class="tx-main"><span class="tx-cat">${esc(c.name)}</span>${sub ? `<span class="tx-note">${sub}</span>` : ''}</span>
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
  const last = state.settings.lastBackup;
  return state.transactions.length >= 5 && (!last || Date.now() - last > 30 * 864e5);
}

function renderHome() {
  const list = monthTx(ui.month);
  const { income, expense } = totals(list);
  const bal = income - expense;
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

  parts.push(`<div class="card summary">
    <div class="summary-label">Còn lại trong ${monthLabel(ui.month).toLowerCase()}</div>
    <div class="summary-balance">${bal < 0 ? '−' : ''}${money(Math.abs(bal))}</div>
    <div class="summary-row">
      <div>↓ Thu<b>${money(income)}</b></div>
      <div>↑ Chi<b>${money(expense)}</b></div>
    </div>
  </div>`);

  parts.push(budgetCard());

  const recent = sortTx(list).slice(0, 6);
  parts.push(`<div class="card">
    <div class="card-head"><h2>Giao dịch gần đây</h2>${list.length > recent.length ? '<button class="link" data-view="history">Xem tất cả</button>' : ''}</div>
    ${recent.length
      ? recent.map((t) => txItem(t, true)).join('')
      : `<p class="empty">Chưa có giao dịch nào trong tháng này.<br>Nhấn nút <b>+</b> để thêm.</p>`}
  </div>`);

  $('#view-home').innerHTML = parts.join('');
}

/* ---------- Ngân sách ---------- */
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
  const spent = sumByCategory(monthTx(ui.month), 'expense');
  const rows = catsOf('expense')
    .filter((c) => state.budgets[c.id] > 0)
    .map((c) => ({ c, b: state.budgets[c.id], s: spent[c.id] || 0 }))
    .sort((a, b) => b.s / b.b - a.s / a.b);

  if (!rows.length) {
    return `<div class="card"><div class="card-head"><h2>Ngân sách</h2></div>
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
    <div class="card-head"><h2>Ngân sách</h2><button class="link" data-view="settings">Chỉnh</button></div>
    ${budgetRow('🎯', 'Tổng ngân sách', totalS, totalB)}
    ${extra}
    <div class="sep"></div>
    ${rows.map((r) => budgetRow(r.c.icon, r.c.name, r.s, r.b)).join('')}
  </div>`;
}

// Cảnh báo khi khoản chi mới làm danh mục chạm 80% hoặc vượt ngân sách
function budgetWarning(others, rec) {
  const b = state.budgets[rec.categoryId];
  if (rec.type !== 'expense' || !b) return null;
  const ym = rec.date.slice(0, 7);
  const before = sum(others.filter((t) => t.type === 'expense' && t.categoryId === rec.categoryId && t.date.startsWith(ym)).map((t) => t.amount));
  const after = before + rec.amount;
  const name = catById(rec.categoryId).name;
  if (after > b) return { level: 'error', msg: `⚠️ Đã vượt ngân sách “${name}” ${money(after - b)}` };
  if (after >= 0.8 * b) return { level: 'warn', msg: `Đã dùng ${Math.round((after / b) * 100)}% ngân sách “${name}”` };
  return null;
}

/* ---------- Lịch sử ---------- */
function renderHistory() {
  if (ui.filter !== 'all' && !ui.filter.startsWith('type:') && !state.categories.some((c) => c.id === ui.filter)) ui.filter = 'all';
  const opt = (value, label) => `<option value="${esc(value)}"${ui.filter === value ? ' selected' : ''}>${esc(label)}</option>`;
  const group = (type, label) => `<optgroup label="${label}">${catsOf(type).map((c) => opt(c.id, `${c.icon} ${c.name}`)).join('')}</optgroup>`;

  $('#view-history').innerHTML = `
    <div class="filters">
      <input type="search" id="hSearch" placeholder="Tìm theo ghi chú, danh mục…" value="${esc(ui.search)}" autocomplete="off">
      <select id="hFilter" aria-label="Lọc">
        ${opt('all', 'Tất cả giao dịch')}${opt('type:expense', 'Chỉ khoản chi')}${opt('type:income', 'Chỉ khoản thu')}
        ${group('expense', 'Danh mục chi')}${group('income', 'Danh mục thu')}
      </select>
    </div>
    <div id="hList"></div>`;
  renderHistoryList();
}

function renderHistoryList() {
  let list = monthTx(ui.month);
  const f = ui.filter;
  if (f.startsWith('type:')) list = list.filter((t) => t.type === f.slice(5));
  else if (f !== 'all') list = list.filter((t) => t.categoryId === f);
  const q = fold(ui.search.trim());
  if (q) list = list.filter((t) => fold(t.note).includes(q) || fold(catById(t.categoryId).name).includes(q));
  list = sortTx(list);

  const box = $('#hList');
  if (!list.length) {
    box.innerHTML = `<div class="card"><p class="empty">${q || f !== 'all' ? 'Không có giao dịch phù hợp.' : 'Chưa có giao dịch nào trong tháng này.'}</p></div>`;
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

function categoryCard() {
  const type = ui.reportType;
  const by = sumByCategory(monthTx(ui.month), type);
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

function dailyCard() {
  const ym = ui.month;
  const n = daysInMonth(ym);
  const vals = Array(n).fill(0);
  for (const t of monthTx(ym)) if (t.type === 'expense') vals[Number(t.date.slice(8)) - 1] += t.amount;
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
  const data = months.map((m) => ({ m, ...totals(monthTx(m)) }));
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
  $('#view-reports').innerHTML = categoryCard() + dailyCard() + trendCard();
}

/* ---------- Cài đặt ---------- */
function renderSettings() {
  const catRow = (c) => `<button class="row" data-action="edit-cat" data-id="${esc(c.id)}">
      <span class="cat-chip" style="${tint(c.color)}">${c.icon}</span>
      <span class="grow">${esc(c.name)}</span>
      <span class="muted">${countTx(c.id)} giao dịch</span><span class="chev">›</span>
    </button>`;
  const exp = catsOf('expense');
  const last = state.settings.lastBackup;

  $('#view-settings').innerHTML = `
    <div class="card">
      <div class="card-head"><h2>Ngân sách hằng tháng</h2><span class="muted" id="budgetTotal"></span></div>
      <p class="hint">Hạn mức chi mỗi tháng cho từng danh mục. Để trống nếu không cần.</p>
      ${exp.map((c) => `<label class="row">
          <span class="cat-chip" style="${tint(c.color)}">${c.icon}</span>
          <span class="grow">${esc(c.name)}</span>
          <input class="money-input" inputmode="numeric" autocomplete="off" data-budget="${esc(c.id)}" placeholder="Không đặt" value="${state.budgets[c.id] ? nf.format(state.budgets[c.id]) : ''}">
        </label>`).join('')}
    </div>

    <div class="card">
      <div class="card-head"><h2>Danh mục chi</h2><button class="link" data-action="add-cat" data-type="expense">+ Thêm</button></div>
      ${exp.map(catRow).join('')}
    </div>
    <div class="card">
      <div class="card-head"><h2>Danh mục thu</h2><button class="link" data-action="add-cat" data-type="income">+ Thêm</button></div>
      ${catsOf('income').map(catRow).join('')}
    </div>

    <div class="card">
      <h2>Sao lưu &amp; dữ liệu</h2>
      <p class="hint">${state.transactions.length} giao dịch đang lưu trên máy này. Lần sao lưu gần nhất: <b>${last ? new Date(last).toLocaleString('vi-VN') : 'chưa có'}</b>.<br>
        Nên sao lưu định kỳ và lưu file vào iCloud Drive (ứng dụng Tệp) để không mất dữ liệu khi đổi máy.</p>
      <div class="btn-col">
        <button class="btn primary" data-action="export-json">💾 Xuất file sao lưu (.json)</button>
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
  return $('.sheet-panel', sheet);
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

function openTxSheet(tx) {
  const editing = !!tx;
  let type = editing ? tx.type : lastTxType;
  let catId = editing ? tx.categoryId : null;
  const defaultDate = editing ? tx.date : ui.month === currentMonth() ? todayStr() : `${ui.month}-01`;

  const p = openSheet(`${sheetHead(editing ? 'Sửa giao dịch' : 'Thêm giao dịch')}
    <div class="sheet-body">
      <div class="seg" id="txType"><button data-t="expense">Khoản chi</button><button data-t="income">Khoản thu</button></div>
      <div class="amount-box"><input id="txAmount" inputmode="numeric" autocomplete="off" placeholder="0" aria-label="Số tiền" value="${editing ? nf.format(tx.amount) : ''}"><span>₫</span></div>
      <div class="chips"><button data-add="000">000</button><button data-add="10000">+10k</button><button data-add="50000">+50k</button><button data-add="100000">+100k</button><button data-add="500000">+500k</button></div>
      <div class="cat-grid" id="txCats"></div>
      <label class="field"><span>Ngày</span><input type="date" id="txDate" value="${defaultDate}"></label>
      <label class="field"><span>Ghi chú</span><input type="text" id="txNote" maxlength="100" placeholder="Không bắt buộc" value="${esc(editing ? tx.note : '')}"></label>
      ${editing ? '<button class="btn danger full" data-sheet="delete">Xoá giao dịch này</button>' : ''}
    </div>`);
  const amount = $('#txAmount', p);

  const paintCats = () => {
    $('#txCats', p).innerHTML = catsOf(type).map((c) => `<button class="cat-pick${c.id === catId ? ' active' : ''}" data-cat="${esc(c.id)}">
      <span class="cat-chip" style="${tint(c.color)}">${c.icon}</span><span>${esc(c.name)}</span></button>`).join('');
  };
  const paintType = () => {
    $$('#txType button', p).forEach((b) => b.classList.toggle('active', b.dataset.t === type));
    p.classList.toggle('is-income', type === 'income');
    paintCats();
  };
  paintType();
  amount.addEventListener('input', () => formatMoneyInput(amount));

  const submit = () => {
    const value = parseMoney(amount.value);
    if (!value) { toast('Hãy nhập số tiền', 'error'); amount.focus(); return; }
    if (!catId) { toast('Hãy chọn danh mục', 'error'); return; }
    const rec = {
      id: editing ? tx.id : uid(),
      type,
      amount: value,
      categoryId: catId,
      date: $('#txDate', p).value || todayStr(),
      note: $('#txNote', p).value.trim(),
      createdAt: editing ? tx.createdAt : Date.now(),
    };
    const others = state.transactions.filter((t) => t.id !== rec.id);
    const warning = budgetWarning(others, rec);
    state.transactions = [...others, rec];
    lastTxType = type;
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
    if (d.t && d.t !== type) { type = d.t; catId = null; paintType(); }
    else if (d.cat) { catId = d.cat; paintCats(); }
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

  if (!editing) amount.focus();
}

function openCatSheet(cat, newType) {
  const editing = !!cat;
  const type = editing ? cat.type : newType;
  let icon = editing ? cat.icon : EMOJIS[0];
  let color = editing ? cat.color : COLORS[state.categories.length % COLORS.length];
  const canDelete = editing && !isLocked(cat.id);

  const p = openSheet(`${sheetHead(editing ? 'Sửa danh mục' : type === 'expense' ? 'Thêm danh mục chi' : 'Thêm danh mục thu')}
    <div class="sheet-body">
      <div class="cat-preview"><span class="cat-chip big" id="cPrev"></span></div>
      <label class="field"><span>Tên</span><input id="cName" maxlength="30" placeholder="VD: Cà phê" value="${esc(editing ? cat.name : '')}"></label>
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
  };
  paint();

  p.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const d = b.dataset;
    if (d.emoji) { icon = d.emoji; paint(); }
    else if (d.color) { color = d.color; paint(); }
    else if (d.sheet === 'cancel') closeSheet();
    else if (d.sheet === 'save') {
      const name = $('#cName', p).value.trim();
      if (!name) { toast('Hãy nhập tên danh mục', 'error'); return; }
      if (editing) Object.assign(cat, { name, icon, color });
      else state.categories.push({ id: uid(), name, icon, color, type });
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
      for (const t of state.transactions) if (t.categoryId === cat.id) t.categoryId = FALLBACK[cat.type];
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

/* =========================================================
   Sao lưu & khôi phục
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

function exportCSV() {
  const cell = (v) => {
    let s = String(v);
    if (/^[=+@]/.test(s)) s = "'" + s; // tránh Excel hiểu ghi chú là công thức
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = [['Ngày', 'Loại', 'Danh mục', 'Số tiền', 'Ghi chú']];
  for (const t of sortTx(state.transactions)) {
    rows.push([t.date, t.type === 'expense' ? 'Chi' : 'Thu', catById(t.categoryId).name, t.type === 'expense' ? -t.amount : t.amount, t.note]);
  }
  const csv = '﻿' + rows.map((r) => r.map(cell).join(',')).join('\r\n');
  shareOrDownload(new Blob([csv], { type: 'text/csv' }), `chi-tieu-${todayStr()}.csv`);
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
  if (!confirm('Xoá TOÀN BỘ giao dịch, danh mục và ngân sách?')) return;
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
  toastTimer = setTimeout(() => { el.className = ''; }, level ? 3500 : 2200);
}

/* =========================================================
   Sự kiện
   ========================================================= */
document.addEventListener('click', (e) => {
  if (e.target.closest('#sheet')) return; // bảng trượt tự xử lý sự kiện của nó
  const el = e.target.closest('[data-view],[data-month],[data-edit],[data-report-type],[data-action]');
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
  } else {
    switch (d.action) {
      case 'add-tx': openTxSheet(); break;
      case 'this-month': ui.month = currentMonth(); render(); break;
      case 'add-cat': openCatSheet(null, d.type); break;
      case 'edit-cat': openCatSheet(state.categories.find((c) => c.id === d.id)); break;
      case 'export-json': exportJSON(); break;
      case 'export-csv': exportCSV(); break;
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
