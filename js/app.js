/* ===== ตัวช่วยทั่วไป ===== */
var S = { token: null, user: null, view: null, meta: null, charts: {}, form: null, dash: null, loading: 0 };
var ROLE_TH = { admin: 'ผู้ดูแล', staff: 'เจ้าหน้าที่', viewer: 'ผู้บริหาร' };
var TH_M = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
var TH_MS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
var TH_D = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];

function $(id) { return document.getElementById(id); }
function esc(s) { return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function thDate(ymd) { var p = String(ymd || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + (Number(p[0]) + 543) : ''; }
function thShort(ymd) { var p = String(ymd || '').split('-'); return p.length === 3 ? Number(p[2]) + ' ' + TH_MS[Number(p[1]) - 1] : ''; }
function thLong(ymd) {
  var p = String(ymd || '').split('-').map(Number); if (p.length !== 3) return '';
  var dow = new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay();
  return 'วัน' + TH_D[dow] + 'ที่ ' + p[2] + ' ' + TH_M[p[1] - 1] + ' ' + (p[0] + 543);
}
function thTs(iso) {
  if (!iso) return '';
  var d = new Date(iso); if (isNaN(d)) return String(iso);
  var p = function (n) { return ('0' + n).slice(-2); };
  return p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + (d.getFullYear() + 543) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
}
function isoBE(ymd) { var p = String(ymd || '').split('-'); return (Number(p[0]) + 543) + '-' + p[1] + '-' + p[2]; }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 10); }
function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } }

function setLoading(on) {
  S.loading = Math.max(0, S.loading + (on ? 1 : -1));
  $('loading').classList.toggle('stf-hide', S.loading === 0);
}
/** เรียก backend: api(action, token, payload) → Promise(data) */
var PUBLIC_MAP = { getMeta: 'publicMeta', getDashboard: 'publicDashboard' };
/** เรียกหลังบ้าน (Apps Script) ผ่านตัวกลางบน Vercel: POST /api/gas  { action, token, payload } → { ok, data } | { ok:false, code, message } */
var API_URL = '/api/gas';
function call(action, payload, quiet) {
  if (!S.token && PUBLIC_MAP[action]) action = PUBLIC_MAP[action]; // ยังไม่ล็อกอิน → ใช้เส้นทางสาธารณะ (อ่านอย่างเดียว)
  if (!quiet) setLoading(true);
  return fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: action, token: S.token, payload: payload || {} }) })
    .then(function (res) { return res.json().catch(function () { throw new Error('เซิร์ฟเวอร์ตอบกลับไม่ถูกต้อง (HTTP ' + res.status + ')'); }); },
          function (e) { throw new Error('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจอินเทอร์เน็ตแล้วลองใหม่'); })
    .then(function (r) {
      if (!quiet) setLoading(false);
      if (r && r.ok) return r.data;
      if (r && r.code === 'AUTH' && action !== 'login' && action !== 'me') { clearSession(); showLogin(r.message); }
      throw new Error(r && r.message ? r.message : 'ไม่มีการตอบกลับจากเซิร์ฟเวอร์');
    }, function (e) { if (!quiet) setLoading(false); throw e; });
}
function toast(type, msg, ms) {
  var map = { success: ['alert-success', 'circle-check'], error: ['alert-error', 'circle-alert'], info: ['alert-info', 'info'] };
  var m = map[type] || map.info;
  var t = document.createElement('div');
  t.className = 'alert ' + m[0] + ' stf-toast ' + type + ' shadow-lg text-sm min-w-64 max-w-sm py-2.5';
  t.setAttribute('role', type === 'error' ? 'alert' : 'status');
  t.innerHTML = icon(m[1], 'size-5 shrink-0') + '<span class="min-w-0"></span>';
  t.lastChild.textContent = msg;
  $('toasts').appendChild(t);
  setTimeout(function () { t.classList.add('m-out'); setTimeout(function () { t.remove(); }, 260); }, ms || (type === 'error' ? 6000 : 3500));
}
/** modal ทั่วไป: opt = {title, html, okText, cancelText, danger, noCancel, onOk(box) → false เพื่อค้างไว้ / Promise} */
function modal(opt) {
  return new Promise(function (resolve) {
    var root = document.createElement('div');
    root.className = 'modal modal-open stf-modal';
    root.innerHTML = '<div class="modal-box stf-modal-box max-w-lg" role="dialog" aria-modal="true">' +
      '<h3 class="stf-modal-h text-lg font-bold mb-2 flex items-center gap-2">' + (opt.danger ? icon('triangle-alert', 'size-5 text-error') : '') + esc(opt.title || '') + '</h3>' +
      '<div class="stf-modal-b">' + (opt.html || '') + '<div class="stf-err" data-err></div></div><div class="modal-action">' +
      (opt.noCancel ? '' : '<button class="btn btn-ghost" data-x>' + esc(opt.cancelText || 'ยกเลิก') + '</button>') +
      '<button class="btn ' + (opt.danger ? 'btn-error' : 'btn-primary') + '" data-ok>' + esc(opt.okText || 'ยืนยัน') + '</button></div></div>';
    $('modalRoot').appendChild(root);
    var box = root.querySelector('.stf-modal-box');
    var close = function (v) { root.remove(); resolve(v); };
    var okBtn = root.querySelector('[data-ok]');
    okBtn.onclick = function () {
      var err = root.querySelector('[data-err]'); err.textContent = '';
      okBtn.disabled = true;
      var res;
      try { res = opt.onOk ? opt.onOk(box) : true; } catch (e) { res = Promise.reject(e); }
      Promise.resolve(res).then(function (v) { if (v !== false) close(v === undefined ? true : v); })
        .catch(function (e) { err.textContent = e.message || String(e); okBtn.disabled = false; });
    };
    var x = root.querySelector('[data-x]'); if (x) x.onclick = function () { close(false); };
    var first = box.querySelector('input,select,textarea'); (first || okBtn).focus();
    box.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); okBtn.click(); } if (e.key === 'Escape' && !opt.noCancel) close(false); });
  });
}
function statusBadge(diff) {
  var b = 'badge badge-soft gap-1 whitespace-nowrap font-semibold stf-badge ';
  if (diff === null || diff === undefined || isNaN(diff)) return '<span class="' + b + 'badge-ghost na">–</span>';
  if (diff < 0) return '<span class="' + b + 'badge-error bad">' + icon('arrow-down', 'size-3.5') + 'ขาด ' + (-diff) + ' คน</span>';
  if (diff > 0) return '<span class="' + b + 'badge-warning over">' + icon('arrow-up', 'size-3.5') + 'เกิน ' + diff + ' คน</span>';
  return '<span class="' + b + 'badge-success ok">' + icon('check', 'size-3.5') + 'ครบตามแผน</span>';
}
function downloadText(name, text, mime) {
  var blob = new Blob([String.fromCharCode(0xFEFF) + text], { type: mime || 'text/csv;charset=utf-8' });
  var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
function csvRow(arr) { return arr.map(function (v) { v = String(v === null || v === undefined ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(','); }

/* ===== ล็อกอิน / เซสชัน ===== */
function clearSession() { S.token = null; S.user = null; store('stf_tok', null); }
function showLogin(msg) {
  document.body.classList.remove('stf-admin-bg', 'stf-green-bg');
  $('vApp').classList.add('stf-hide'); $('vLogin').classList.remove('stf-hide');
  $('lgErr').textContent = msg || ''; $('lgPin').value = ''; $('lgPin').type = 'password'; loginBusy(false);
  $('lgId').parentNode.classList.remove('bad'); $('lgPin').parentNode.classList.remove('bad');
  window.scrollTo(0, 0);
  $('lgBack').classList.toggle('stf-hide', !S.publicOn);
  setTimeout(function () { $('lgId').focus(); }, 50);
}
function showPublic(org, boot) {
  S.user = null; S.publicOn = true; S.meta = boot ? boot.meta : null; S.dash = null;
  S.preDash = boot ? boot.dash : null; S.dashState = boot ? Object.assign({}, boot.state) : null; S.touched = false;
  $('vLogin').classList.add('stf-hide'); $('vApp').classList.remove('stf-hide');
  $('orgName').textContent = org || '';
  ['userName', 'userRole', 'btnPin', 'btnLogout'].forEach(function (id) { $(id).classList.add('stf-hide'); });
  $('btnLogin').classList.remove('stf-hide');
  document.querySelector('[data-view="entry"]').classList.add('stf-hide');
  document.querySelector('[data-view="admin"]').classList.add('stf-hide');
  go('dash');
}
/** ข้อมูล Dashboard สาธารณะล่าสุดที่จำไว้ในเครื่อง — เปิดครั้งถัดไปแสดงได้ทันทีระหว่างรอข้อมูลใหม่ (ไม่มีหมายเหตุ/ชื่อผู้บันทึก) */
var BOOT_KEY = 'stf_boot_v1', BOOT_MAX_AGE = 24 * 3600 * 1000;
function readBoot() {
  try { var c = JSON.parse(localStorage.getItem(BOOT_KEY) || 'null'); return c && c.t && Date.now() - c.t < BOOT_MAX_AGE && c.d && c.d.meta ? c.d : null; } catch (e) { return null; }
}
function saveBoot(d) { try { localStorage.setItem(BOOT_KEY, JSON.stringify({ t: Date.now(), d: d })); } catch (e) { } }
/** จุดเข้าใช้งาน: มี token ที่ยังใช้ได้ → เข้าแอป; ไม่มี → Dashboard สาธารณะ (ถ้าเปิดไว้) หรือหน้าเข้าสู่ระบบ */
function enter(msg) {
  var tok = store('stf_tok');
  var fallback = function () {
    var cached = readBoot();
    if (cached) showPublic(cached.meta.org, cached);          // แสดงข้อมูลที่จำไว้ทันที
    call('publicBoot', {}, !!cached).then(function (b) {
      saveBoot(b);
      if (S.token) return;                                    // ระหว่างรอ ผู้ใช้ล็อกอินไปแล้ว
      if (!cached || !S.touched) showPublic(b.meta.org, b);   // แทนที่ด้วยข้อมูลล่าสุด (ถ้าผู้ใช้ยังไม่ได้เปลี่ยนตัวกรอง)
    }).catch(function (e) {
      if (/PUBLIC_OFF|ไม่ได้เปิดให้ดู/.test(e.message)) { try { localStorage.removeItem(BOOT_KEY); } catch (x) { } }
      if (cached && !/PUBLIC_OFF|ไม่ได้เปิดให้ดู/.test(e.message)) return; // ใช้ข้อมูลที่จำไว้ต่อ
      // หลังบ้านรุ่นเก่า (ยังไม่มี publicBoot) → วิธีเดิม
      call('publicMeta', {}, true).then(function (m) { showPublic(m.org); })
        .catch(function () { S.publicOn = false; showLogin(msg); });
    });
  };
  if (!tok) { S.token = null; return fallback(); }
  S.token = tok;
  call('me').then(function (d) { showApp(d.user, d.org, d.meta); }).catch(function () { clearSession(); fallback(); });
}
function showApp(user, org, meta) {
  S.user = user; S.meta = meta || null; S.preDash = null; S.dashState = null;
  ['userName', 'userRole', 'btnPin', 'btnLogout'].forEach(function (id) { $(id).classList.remove('stf-hide'); });
  $('btnLogin').classList.add('stf-hide');
  $('vLogin').classList.add('stf-hide'); $('vApp').classList.remove('stf-hide');
  $('userName').textContent = user.name; $('userRole').textContent = ROLE_TH[user.role] || user.role;
  $('orgName').textContent = org || '';
  var canEntry = user.role === 'staff' || user.role === 'admin';
  document.querySelector('[data-view="entry"]').classList.toggle('stf-hide', !canEntry);
  document.querySelector('[data-view="admin"]').classList.toggle('stf-hide', user.role !== 'admin');
  go(canEntry ? 'entry' : 'dash');
}
function loginBusy(on) {
  $('lgBtn').disabled = on;
  $('lgSpin').classList.toggle('stf-hide', !on); $('lgIco').classList.toggle('stf-hide', on);
  $('lgTxt').textContent = on ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ';
}
function loginFieldErr(id, msg) {
  var box = $(id).parentNode; box.classList.remove('bad'); void box.offsetWidth; box.classList.add('bad');
  $('lgErr').textContent = msg; $(id).focus();
}
$('loginForm').addEventListener('submit', function (e) {
  e.preventDefault();
  var id = $('lgId').value.trim(), pin = $('lgPin').value.trim();
  $('lgErr').textContent = ''; $('lgId').parentNode.classList.remove('bad'); $('lgPin').parentNode.classList.remove('bad');
  if (!id) return loginFieldErr('lgId', 'กรุณากรอกรหัสพนักงาน');
  if (!/^\d{4,6}$/.test(pin)) return loginFieldErr('lgPin', 'PIN ต้องเป็นตัวเลข 4–6 หลัก');
  loginBusy(true);
  call('login', { staffId: id, pin: pin }, true).then(function (d) {
    S.token = d.token; store('stf_tok', d.token);
    if (d.mustChange) return changePinDialog(true).then(function () { showApp(d.user, d.org, d.meta); });
    showApp(d.user, d.org, d.meta);
  }).catch(function (err) { loginFieldErr('lgPin', err.message); $('lgPin').select(); })
    .then(function () { loginBusy(false); });
});
$('lgEye').addEventListener('click', function () {
  var show = $('lgPin').type === 'password';
  $('lgPin').type = show ? 'text' : 'password';
  this.setAttribute('aria-label', show ? 'ซ่อน PIN' : 'แสดง PIN');
  this.innerHTML = icon(show ? 'eye-off' : 'eye', '');
  $('lgPin').focus();
});
['keydown', 'keyup'].forEach(function (ev) {
  $('lgPin').addEventListener(ev, function (e) { if (e.getModifierState) $('lgCaps').classList.toggle('stf-hide', !e.getModifierState('CapsLock')); });
});
$('lgPin').addEventListener('input', function () { this.value = this.value.replace(/\D/g, '').slice(0, 6); });
$('lgYear').textContent = String(new Date().getFullYear() + 543);
function changePinDialog(forced) {
  return modal({
    title: forced ? 'ตั้ง PIN ใหม่ก่อนใช้งาน' : 'เปลี่ยน PIN', noCancel: forced, okText: 'บันทึก PIN',
    html: (forced ? banner('info', 'เพื่อความปลอดภัย กรุณาตั้ง PIN ส่วนตัว (ตัวเลข 4–6 หลัก)', 'mb-3') :
      '<label class="stf-field">PIN เดิม<input class="input" type="password" inputmode="numeric" data-old></label>') +
      '<label class="stf-field">PIN ใหม่<input class="input" type="password" inputmode="numeric" maxlength="6" data-new></label>' +
      '<label class="stf-field">ยืนยัน PIN ใหม่<input class="input" type="password" inputmode="numeric" maxlength="6" data-new2></label>',
    onOk: function (box) {
      var n = box.querySelector('[data-new]').value, n2 = box.querySelector('[data-new2]').value;
      if (!/^\d{4,6}$/.test(n)) throw new Error('PIN ต้องเป็นตัวเลข 4–6 หลัก');
      if (n !== n2) throw new Error('PIN ใหม่ทั้งสองช่องไม่ตรงกัน');
      var p = { newPin: n }; var o = box.querySelector('[data-old]'); if (o) p.oldPin = o.value;
      return call('changePin', p).then(function () { toast('success', 'เปลี่ยน PIN เรียบร้อย'); });
    }
  });
}
$('btnPin').onclick = function () { changePinDialog(false); };
$('btnLogout').onclick = function () {
  // ออกทันที ไม่รอเซิร์ฟเวอร์ (ถ้าเซิร์ฟเวอร์ช้า/ค้าง ปุ่มต้องไม่ดูเหมือนกดไม่ติด) แล้วแจ้งเซิร์ฟเวอร์เลิกใช้ token ทีหลัง
  var tok = S.token;
  S.form = null; S.view = null;               // ทิ้งข้อมูลที่ยังไม่บันทึก เพื่อไม่ให้กล่องยืนยัน "ออกจากหน้านี้" มาขวาง
  clearSession();
  if (tok) { try { fetch(API_URL, { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'logout', token: tok, payload: {} }) }).catch(function () { }); } catch (e) { } }
  enter();                                       // กลับ Dashboard สาธารณะ (ถ้าปิดโหมดสาธารณะไว้ จะไปหน้าเข้าสู่ระบบแทน)
  toast('info', 'ออกจากระบบแล้ว', 2500);
};
$('btnLogin').onclick = function () { showLogin(); };
$('lgBack').onclick = function () { enter(); };
Array.prototype.forEach.call(document.querySelectorAll('#nav button'), function (b) { b.onclick = function () { go(b.getAttribute('data-view')); }; });

function go(view) {
  if (S.view === 'entry' && view !== 'entry' && isDirty() && !confirm('มีข้อมูลที่ยังไม่บันทึก ต้องการออกจากหน้านี้หรือไม่?')) return;
  S.view = view;
  Array.prototype.forEach.call(document.querySelectorAll('#nav button'), function (b) { b.classList.toggle('on', b.getAttribute('data-view') === view); });
  $('main').classList.toggle('wide', view === 'admin');
  document.body.classList.toggle('stf-admin-bg', view === 'admin');                          // ผู้ดูแล: ชมพูพาสเทล
  document.body.classList.toggle('stf-green-bg', view === 'dash' || view === 'entry');      // Dashboard + กรอกอัตรากำลัง: เขียวอ่อน
  destroyCharts(); viewIn();
  if (view === 'entry') renderEntry();
  else if (view === 'dash') renderDash();
  else if (view === 'admin') renderAdmin();
}
function ensureMeta() {
  if (S.meta) return Promise.resolve(S.meta);
  return call('getMeta').then(function (m) { S.meta = m; return m; });
}

/* ===== หน้ากรอกอัตรากำลัง ===== */
function renderEntry(date, slotId) {
  ensureMeta().then(function (m) {
    date = date || (S.form && S.form.date) || m.today;
    slotId = slotId || (S.form && S.form.slotId) || (m.slots[0] && m.slots[0].id);
    $('main').innerHTML =
      '<div class="flex flex-wrap items-end gap-3 mb-3.5 stf-h"><div><h1>กรอกอัตรากำลัง</h1><div class="stf-sub" id="enDateLong"></div></div>' +
      '<div class="flex flex-wrap items-end gap-2 md:ml-auto w-full md:w-auto stf-ctrl"><label class="stf-field">วันที่<input type="date" id="enDate" class="input" max="' + m.today + '" value="' + esc(date) + '"></label>' +
      '<label class="stf-field">ช่วงเวลา<select id="enSlot" class="select">' + m.slots.map(function (s) { return '<option value="' + esc(s.id) + '"' + (s.id === slotId ? ' selected' : '') + '>' + esc(s.name) + '</option>'; }).join('') + '</select></label></div></div>' +
      '<div id="enBody"></div>' +
      '<div class="stf-dock" id="enDock"><div class="stf-dock-in"><div class="sum" id="enSum"></div><button class="btn btn-sm btn-primary" id="enSave">' + icon('save', 'size-4') + ' บันทึกอัตรากำลัง</button></div></div>';
    $('enDate').onchange = function () { if (this.value) loadEntry(this.value, $('enSlot').value); };
    $('enSlot').onchange = function () { loadEntry($('enDate').value, this.value); };
    $('enSave').onclick = saveEntry;
    loadEntry(date, slotId);
  }).catch(function (e) { toast('error', e.message); });
}
function isDirty() {
  if (!S.form || !$('enBody')) return false;
  return S.form.rows.some(function (r) {
    var el = document.querySelector('[data-pid="' + r.pointId + '"]'); if (!el) return false;
    return String(el.querySelector('.plan').value) !== String(r.plan) || String(el.querySelector('.act').value) !== String(r.actual) || el.querySelector('.note').value !== r.note;
  });
}
function loadEntry(date, slotId) {
  if (S.form && (S.form.date !== date || S.form.slotId !== slotId) && isDirty() && !confirm('มีข้อมูลที่ยังไม่บันทึก ต้องการเปลี่ยนวัน/ช่วงเวลาหรือไม่?')) {
    $('enDate').value = S.form.date; $('enSlot').value = S.form.slotId; return;
  }
  call('getEntryForm', { date: date, slotId: slotId }).then(function (f) { S.form = f; drawEntry(); })
    .catch(function (e) { toast('error', e.message); });
}
function ptRow(r, editable) {
  var dis = editable ? '' : ' disabled';
  return '<div class="stf-pt" data-pid="' + esc(r.pointId) + '" data-type="' + esc(r.type) + '">' +
    '<div class="nm">' + esc(r.name) + (r.saved ? '<small>บันทึกล่าสุด ' + esc(thTs(r.at)) + ' · ' + esc(r.by) + '</small>' : '<small>ยังไม่บันทึก</small>') + '</div>' +
    '<div><span class="lbl">ตามแผน</span><input class="input plan" type="number" inputmode="numeric" min="0" max="200" step="1" value="' + esc(r.plan) + '" aria-label="อัตราตามแผน ' + esc(r.name) + '"' + dis + '></div>' +
    '<div><span class="lbl">มาปฏิบัติงาน</span><input class="input act" type="number" inputmode="numeric" min="0" max="200" step="1" value="' + esc(r.actual) + '" placeholder="–" aria-label="อัตราปัจจุบัน ' + esc(r.name) + '"' + dis + '></div>' +
    '<div class="diff"></div>' +
    '<div class="note-w"><span class="lbl">หมายเหตุ</span><input class="input note" maxlength="300" placeholder="เช่น ลาป่วย 1, ลาพักร้อน 1" value="' + esc(r.note) + '"' + dis + '></div></div>';
}
function drawEntry() {
  var f = S.form;
  $('enDateLong').textContent = thLong(f.date) + ' · ' + ((f.slots.filter(function (s) { return s.id === f.slotId; })[0] || {}).name || '');
  var reg = f.rows.filter(function (r) { return r.type !== 'เฉพาะวัน'; });
  var occ = f.rows.filter(function (r) { return r.type === 'เฉพาะวัน'; });
  var rooms = [];
  reg.forEach(function (r) { if (rooms.indexOf(r.room) < 0) rooms.push(r.room); });
  var head = '<div class="stf-pt-head"><span>จุดปฏิบัติงาน</span><span>ตามแผน</span><span>มาปฏิบัติงาน</span><span>สถานะ</span><span>หมายเหตุ</span></div>';
  var savedN = f.rows.filter(function (r) { return r.saved; }).length;
  var html = '';
  if (!f.editable) html += banner('warn', esc(f.reason) + ' (ดูได้อย่างเดียว)');
  else if (savedN) html += banner('info', 'วันนี้บันทึกไปแล้ว ' + savedN + ' จุด — แก้ไขตัวเลขแล้วกดบันทึกเพื่ออัปเดตได้');
  rooms.forEach(function (room) {
    var rs = reg.filter(function (r) { return r.room === room; });
    html += '<div class="card bg-base-100 border border-base-300 shadow-sm p-4 stf-card stf-room"><div class="stf-room-h"><span>' + icon('building-2', 'size-4 inline text-primary mr-1 align-[-2px]') + 'ห้องเจาะเลือด ' + esc(room) + '</span><span class="stf-sub" data-room-sum="' + esc(room) + '"></span></div>' + head +
      rs.map(function (r) { return ptRow(r, f.editable); }).join('') + '</div>';
  });
  if (occ.length) {
    html += '<div class="card bg-base-100 border border-base-300 shadow-sm p-4 stf-card stf-room"><div class="stf-room-h"><span>' + icon('calendar-plus', 'size-4 inline text-primary mr-1 align-[-2px]') + 'จุดเฉพาะวัน</span><span class="stf-sub">กรอกเฉพาะวันที่เปิดให้บริการ — เว้นช่อง "มาปฏิบัติงาน" ว่าง = ไม่เปิด</span></div>' + head +
      occ.map(function (r) { return ptRow(r, f.editable); }).join('') + '</div>';
  }
  $('enBody').innerHTML = html;
  animateIn($('enBody'));
  $('enSave').disabled = !f.editable;
  Array.prototype.forEach.call(document.querySelectorAll('.stf-pt input'), function (el) { el.addEventListener('input', recalc); });
  recalc();
}
function readRows() {
  return Array.prototype.map.call(document.querySelectorAll('.stf-pt'), function (el) {
    var p = el.querySelector('.plan').value, a = el.querySelector('.act').value;
    return { el: el, pointId: el.getAttribute('data-pid'), type: el.getAttribute('data-type'), name: el.querySelector('.nm').firstChild.textContent,
      plan: p === '' ? '' : Number(p), actual: a === '' ? '' : Number(a), note: el.querySelector('.note').value.trim() };
  });
}
function recalc() {
  var rows = readRows(), plan = 0, act = 0, short = 0, nShort = 0, filled = 0, need = 0, roomSum = {};
  rows.forEach(function (r) {
    var has = r.plan !== '' && r.actual !== '';
    var diff = has ? r.actual - r.plan : null;
    r.el.querySelector('.diff').innerHTML = statusBadge(diff);
    r.el.classList.toggle('short', diff !== null && diff < 0);
    if (r.type !== 'เฉพาะวัน') need++;
    if (!has) return;
    filled++; plan += r.plan; act += r.actual;
    if (diff < 0) { short -= diff; nShort++; }
    var room = r.el.closest('.stf-room').querySelector('[data-room-sum]');
    if (room) { var k = room.getAttribute('data-room-sum'); roomSum[k] = roomSum[k] || { p: 0, a: 0 }; roomSum[k].p += r.plan; roomSum[k].a += r.actual; }
  });
  Object.keys(roomSum).forEach(function (k) {
    var el = document.querySelector('[data-room-sum="' + k.replace(/"/g, '\\"') + '"]');
    if (el) { var d = roomSum[k].a - roomSum[k].p; el.textContent = '· แผน ' + roomSum[k].p + ' มา ' + roomSum[k].a + (d < 0 ? ' · ขาด ' + (-d) : ''); }
  });
  $('enSum').innerHTML = '<span>กรอกแล้ว <b>' + filled + '</b> จุด</span><span>ตามแผน <b>' + plan + '</b></span><span>มาปฏิบัติงาน <b>' + act + '</b></span>' +
    '<span class="' + (short ? 'bad' : '') + '">ขาด <b>' + short + '</b> คน' + (nShort ? ' (' + nShort + ' จุด)' : '') + '</span>';
}
function saveEntry() {
  var rows = readRows(), errs = [];
  rows.forEach(function (r) {
    var bad = function (v) { return v === '' || !(Number.isInteger(v) && v >= 0 && v <= 200); };
    if (r.type === 'เฉพาะวัน') { if (r.actual !== '' && (bad(r.plan) || bad(r.actual))) errs.push(r); }
    else if (bad(r.plan) || bad(r.actual)) errs.push(r);
  });
  Array.prototype.forEach.call(document.querySelectorAll('.stf-pt .input'), function (el) { el.classList.remove('input-error'); });
  if (errs.length) {
    errs.forEach(function (r) { ['.plan', '.act'].forEach(function (c) { var i = r.el.querySelector(c); if (i.value === '' || !Number.isInteger(Number(i.value)) || Number(i.value) < 0) i.classList.add('input-error'); }); });
    errs[0].el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    toast('error', 'กรุณากรอกจำนวนคน (เลขจำนวนเต็ม 0–200) ให้ครบ ' + errs.length + ' จุด');
    return;
  }
  // จุดเฉพาะวัน: ช่องมาปฏิบัติงานว่าง = ไม่เปิดบริการ (ถ้าเคยบันทึกไว้ ส่งค่าว่างไปเพื่อล้าง)
  var send = rows.filter(function (r) { return r.type !== 'เฉพาะวัน' || r.actual !== '' || S.form.rows.some(function (x) { return x.pointId === r.pointId && x.saved; }); })
    .map(function (r) { return (r.type === 'เฉพาะวัน' && r.actual === '') ? Object.assign({}, r, { plan: '', actual: '' }) : r; });
  var shortList = send.filter(function (r) { return r.plan !== '' && r.actual < r.plan; });
  var tot = send.reduce(function (a, r) { if (r.plan !== '') { a.p += r.plan; a.a += r.actual; } return a; }, { p: 0, a: 0 });
  var slotName = $('enSlot').options[$('enSlot').selectedIndex].text;
  var reqId = uid();
  modal({
    title: 'ยืนยันบันทึกอัตรากำลัง', okText: 'ยืนยันบันทึก',
    html: '<p><b>' + esc(thLong(S.form.date)) + '</b><br>' + esc(slotName) + '</p>' +
      '<p>ตามแผน <b>' + tot.p + '</b> คน · มาปฏิบัติงาน <b>' + tot.a + '</b> คน</p>' +
      (shortList.length ? banner('bad', '<b>ขาด ' + shortList.reduce(function (a, r) { return a + r.plan - r.actual; }, 0) + ' คน</b><br>' +
        shortList.map(function (r) { return '• ' + esc(r.name) + ' ขาด ' + (r.plan - r.actual) + (r.note ? ' (' + esc(r.note) + ')' : ''); }).join('<br>'), 'mb-0')
        : banner('ok', 'ทุกจุดครบตามแผน', 'mb-0')),
    onOk: function () {
      return call('saveEntry', { date: S.form.date, slotId: S.form.slotId, requestId: reqId,
        rows: send.map(function (r) { return { pointId: r.pointId, plan: r.plan, actual: r.actual, note: r.note }; }) })
        .then(function (res) {
          if (res.mail === 'sent') setTimeout(function () { toast('success', '✉ ส่งอีเมลรายงานให้ผู้รับแล้ว'); }, 400);
          if (res.mail === 'error') setTimeout(function () { toast('error', 'บันทึกแล้ว แต่ส่งอีเมลไม่สำเร็จ (ดูที่ Log)'); }, 400);
          toast('success', 'บันทึกเรียบร้อย (เพิ่ม ' + res.added + ' · แก้ไข ' + res.updated + (res.removed ? ' · ล้าง ' + res.removed : '') + ' จุด)');
          S.form = null; loadEntry($('enDate').value, $('enSlot').value);
        });
    }
  });
}

/* ===== Dashboard ===== */
function destroyCharts() { Object.keys(S.charts).forEach(function (k) { try { S.charts[k].destroy(); } catch (e) { } }); S.charts = {}; }
function renderDash() {
  ensureMeta().then(function (m) {
    var st = S.dashState || { date: m.today, slotId: m.slots.length > 1 ? 'ALL' : (m.slots[0] && m.slots[0].id), days: 30 };
    S.dashState = st;
    $('main').innerHTML =
      '<div class="stf-print-only"><h2 style="margin:0">รายงานอัตรากำลัง ' + esc(m.org) + '</h2><div id="prDate"></div></div>' +
      '<div class="flex flex-wrap items-end gap-3 mb-3.5 stf-h"><div><h1>Dashboard รายงานอัตรากำลังห้องเจาะเลือดและเก็บสิ่งส่งตรวจ</h1><div class="stf-sub" id="dsDateLong"></div></div><div class="flex flex-wrap items-end gap-2 md:ml-auto w-full md:w-auto stf-ctrl">' +
      '<label class="stf-field">วันที่<input type="date" id="dsDate" class="input" value="' + esc(st.date) + '"></label>' +
      '<label class="stf-field">ช่วงเวลา<select id="dsSlot" class="select">' + (m.slots.length > 1 ? '<option value="ALL">ทุกช่วงเวลา</option>' : '') +
      m.slots.map(function (s) { return '<option value="' + esc(s.id) + '">' + esc(s.name) + '</option>'; }).join('') + '</select></label>' +
      '<label class="stf-field">แนวโน้มย้อนหลัง<select id="dsDays" class="select"><option value="7">7 วัน</option><option value="30">30 วัน</option><option value="90">90 วัน</option><option value="365">1 ปี</option></select></label>' +
      '<button class="btn btn-sm btn-outline" id="dsPrint" title="พิมพ์หรือบันทึกเป็น PDF จากเบราว์เซอร์">' + icon('printer') + ' พิมพ์</button>' +
      '<button class="btn btn-sm btn-outline" id="dsPdf">' + icon('file-down') + ' PDF</button><button class="btn btn-sm btn-outline" id="dsCsv">' + icon('file-spreadsheet') + ' CSV</button></div></div>' +
      '<div id="dsBody"></div>';
    $('dsSlot').value = st.slotId; $('dsDays').value = String(st.days);
    var reload = function () { S.touched = true; S.preDash = null; st.date = $('dsDate').value || m.today; st.slotId = $('dsSlot').value; st.days = Number($('dsDays').value); loadDash(); };
    $('dsDate').onchange = reload; $('dsSlot').onchange = reload; $('dsDays').onchange = reload;
    $('dsPrint').onclick = function () { window.print(); };
    $('dsPdf').onclick = function () {
      call('getPdf', { date: st.date }).then(function (r) {
        var bin = atob(r.base64), arr = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([arr], { type: 'application/pdf' })); a.download = r.name;
        document.body.appendChild(a); a.click(); setTimeout(function () { a.remove(); }, 1000);
      }).catch(function (e) { toast('error', e.message); });
    };
    $('dsCsv').onclick = exportDashCsv;
    if (!S.token) $('dsPdf').classList.add('stf-hide');
    if (S.preDash) { S.dash = S.preDash; S.preDash = null; drawDash(); } else loadDash();
  }).catch(function (e) { toast('error', e.message); });
}
function loadDash() {
  var st = S.dashState;
  call('getDashboard', st).then(function (d) { S.dash = d; drawDash(); }).catch(function (e) { toast('error', e.message); });
}
function kpi(label, val, unit, cls, desc, ico, first) {
  var tone = cls === 'bad' ? 'text-error' : (cls === 'ok' ? 'text-success' : '');
  var chip = cls === 'bad' ? 'chip-bad' : (cls === 'ok' ? 'chip-ok' : 'bg-base-200');
  var num = (typeof val === 'number') ? '<span data-count="' + val + '">' + val + '</span>' : val;
  return '<div class="stf-kpi card bg-base-100 border border-base-300 shadow-sm p-3.5 m-lift ' + (cls || '') + (first ? ' col-span-2 min-[900px]:col-span-1' : '') + '">' +
    '<div class="flex items-start justify-between gap-2"><div class="text-sm stf-muted">' + label + '</div>' +
    '<span class="m-icon grid place-items-center size-8 rounded-lg shrink-0 ' + chip + '">' + icon(ico || 'activity', 'size-4') + '</span></div>' +
    '<div class="v text-3xl font-bold leading-tight mt-1 ' + tone + '">' + num + (unit ? '<small>' + unit + '</small>' : '') + '</div>' +
    (desc ? '<div class="text-xs stf-muted mt-0.5">' + desc + '</div>' : '') + '</div>';
}
function drawDash() {
  var d = S.dash, t = d.totals, rt = d.rangeTotals;
  destroyCharts();
  $('dsDateLong').textContent = thLong(d.date);
  if ($('prDate')) $('prDate').textContent = 'ประจำ' + thLong(d.date) + ' · พิมพ์เมื่อ ' + thTs(new Date().toISOString());
  var html = '';
  if (!d.rows.length) {
    html += banner('warn', 'ยังไม่มีการบันทึกอัตรากำลังของ' + esc(thLong(d.date)) + (d.lastDate ? ' — ข้อมูลล่าสุดคือวันที่ ' + esc(thDate(d.lastDate)) : ''));
  }
  html += '<div class="stf-kpis grid grid-cols-2 min-[900px]:grid-cols-5 gap-3 mb-3.5">' +
    kpi('ร้อยละอัตรากำลัง', t.pct === null ? '–' : t.pct, t.pct === null ? '' : '%', t.pct === null ? '' : (t.pct < 90 ? 'bad' : 'ok'), 'มาปฏิบัติงานเทียบกับแผน', 'percent', true) +
    kpi('อัตราตามแผน', t.plan, 'คน', '', '', 'users') +
    kpi('มาปฏิบัติงาน', t.actual, 'คน', '', '', 'user-check') +
    kpi('ขาด', t.short, 'คน', t.short > 0 ? 'bad' : (t.points ? 'ok' : ''), t.short > 0 ? 'ต่ำกว่าแผน' : (t.points ? 'ไม่มีจุดขาด' : ''), 'user-minus') +
    kpi('จุดที่ขาด', t.pointsShort + '<small>/' + t.points + '</small>', '', t.pointsShort > 0 ? 'bad' : '', t.missing ? 'ยังไม่บันทึก ' + t.missing + ' จุด' : 'บันทึกครบทุกจุด', 'map-pin') +
    '</div>';
  if (d.missing.length) {
    // จัดกลุ่มตามช่วงเวลา: ถ้าทั้งช่วงยังไม่บันทึก แสดงสั้น ๆ
    var regN = (S.meta ? S.meta.points : []).filter(function (p) { return p.type !== 'เฉพาะวัน'; }).length;
    var bySlot = {}, order = [];
    d.missing.forEach(function (x) { if (!bySlot[x.slot]) { bySlot[x.slot] = []; order.push(x.slot); } bySlot[x.slot].push(x.point); });
    html += banner('warn', '<b>ยังไม่ได้บันทึก ' + d.missing.length + ' จุด</b>' + order.map(function (sl) {
      var pts = bySlot[sl];
      return '<br>' + esc(sl) + ': ' + (pts.length === regN ? 'ยังไม่บันทึกทั้งช่วงเวลา (' + pts.length + ' จุด)' : pts.map(esc).join(', '));
    }).join(''));
  }
  // ตารางรายละเอียด
  var pub = !S.token, cols = pub ? 5 : 6;
  var rowsHtml = '', lastRoom = null, lastSlot = null;
  d.rows.forEach(function (r) {
    if (d.slotId === 'ALL' && r.slot !== lastSlot) { rowsHtml += '<tr class="grp"><td colspan="' + cols + '">' + esc(r.slot) + '</td></tr>'; lastSlot = r.slot; lastRoom = null; }
    var roomCell = r.room !== lastRoom ? esc(r.room) : ''; lastRoom = r.room;
    rowsHtml += '<tr class="' + (r.diff < 0 ? 'short' : '') + '"><td>' + roomCell + '</td><td>' + esc(r.point) + '</td><td class="num">' + r.plan + '</td><td class="num">' + r.actual + '</td><td>' + statusBadge(r.diff) + '</td>' + (pub ? '' : '<td>' + esc(r.note) + '</td>') + '</tr>';
  });
  html += '<div class="grid gap-3.5 stf-grid grid-cols-1 min-[900px]:grid-cols-[2fr_1fr] mb-3.5">' +
    '<div class="card bg-base-100 border border-base-300 shadow-sm p-4 stf-card"><h2>รายละเอียดตามจุดปฏิบัติงาน</h2><div class="stf-tbl-wrap"><table class="table table-sm stf-tbl"><thead><tr><th>ห้อง</th><th>จุดปฏิบัติงาน</th><th class="num">ตามแผน</th><th class="num">ปัจจุบัน</th><th>สถานะ</th>' + (pub ? '' : '<th>หมายเหตุ</th>') + '</tr></thead><tbody>' +
    (rowsHtml || '<tr><td colspan="' + cols + '" class="stf-muted" style="text-align:center;padding:24px">ไม่มีข้อมูล</td></tr>') + '</tbody></table></div></div>' +
    '<div class="card bg-base-100 border border-base-300 shadow-sm p-4 stf-card"><h2>สรุปตามห้อง</h2>' +
    '<div class="stf-legend"><span><i style="background:#c3c9d4"></i>ตามแผน</span><span><i style="background:var(--stf-s1)"></i>มาปฏิบัติงาน</span></div>' +
    '<div class="stf-chart" style="height:200px"><canvas id="cRoom" role="img" aria-label="กราฟแท่งเปรียบเทียบแผนกับจำนวนที่มาปฏิบัติงานตามห้อง"></canvas></div>' +
    '<div class="stf-tbl-wrap"><table class="table table-sm stf-tbl" style="margin-top:8px"><thead><tr><th>ห้อง</th><th class="num">แผน</th><th class="num">มา</th><th class="num">ขาด</th></tr></thead><tbody>' +
    d.byRoom.map(function (r) { return '<tr class="' + (r.short ? 'short' : '') + '"><td>' + esc(r.room) + '</td><td class="num">' + r.plan + '</td><td class="num">' + r.actual + '</td><td class="num">' + (r.short ? '<b class="text-error">' + r.short + '</b>' : '–') + '</td></tr>'; }).join('') +
    '</tbody></table></div></div></div>';
  // แนวโน้ม
  html += '<div class="grid gap-3.5 stf-grid grid-cols-1 min-[900px]:grid-cols-2 mb-3.5">' +
    '<div class="card bg-base-100 border border-base-300 shadow-sm p-4 stf-card"><h2>แผนเทียบกับที่มาปฏิบัติงาน<small>' + esc(thDate(d.from)) + ' – ' + esc(thDate(d.date)) + '</small></h2>' +
    '<div class="stf-legend"><span><i class="dash"></i>ตามแผน</span><span><i style="background:var(--stf-s1)"></i>มาปฏิบัติงาน</span></div>' +
    '<div class="stf-chart"><canvas id="cTrend" role="img" aria-label="กราฟเส้นแนวโน้มอัตรากำลังรายวัน"></canvas></div></div>' +
    '<div class="card bg-base-100 border border-base-300 shadow-sm p-4 stf-card"><h2>จำนวนคนที่ขาดรายวัน<small>' + rt.daysWithShort + ' จาก ' + rt.days + ' วันมีการขาด</small></h2>' +
    '<div class="stf-chart" style="margin-top:26px"><canvas id="cShort" role="img" aria-label="กราฟแท่งจำนวนคนที่ขาดรายวัน"></canvas></div></div></div>';
  // จำนวนขาดตามวัน จันทร์–ศุกร์ + ร้อยละอัตรากำลังรายวัน
  var wd = d.byWeekday || [];
  html += '<div class="grid gap-3.5 stf-grid grid-cols-1 min-[900px]:grid-cols-2 mb-3.5">' +
    '<div class="card bg-base-100 border border-base-300 shadow-sm p-4 stf-card"><h2>จำนวนขาดเวรตามวัน (จันทร์–ศุกร์)<small>รวมทั้งช่วง ' + esc(thDate(d.from)) + ' – ' + esc(thDate(d.date)) + '</small></h2>' +
    '<div class="stf-chart" style="height:200px;margin-top:10px"><canvas id="cWeekday" role="img" aria-label="กราฟแท่งจำนวนคนที่ขาดเวรแยกตามวันจันทร์ถึงศุกร์"></canvas></div>' +
    '<div class="stf-tbl-wrap"><table class="table table-sm stf-tbl" style="margin-top:8px"><thead><tr><th>วัน</th><th class="num">ขาดรวม</th><th class="num">เฉลี่ย/วัน</th><th class="num">วันที่ขาด</th><th class="num">% มา</th></tr></thead><tbody>' +
    wd.map(function (w) { return '<tr class="' + (w.short ? 'short' : '') + '"><td>' + w.name + '</td><td class="num">' + (w.short ? '<b class="text-error">' + w.short + '</b>' : '–') + '</td><td class="num">' + (w.days ? w.avgShort : '–') + '</td><td class="num">' + w.daysShort + ' / ' + w.days + '</td><td class="num">' + (w.pct === null ? '–' : w.pct + '%') + '</td></tr>'; }).join('') +
    '</tbody></table></div></div>' +
    '<div class="card bg-base-100 border border-base-300 shadow-sm p-4 stf-card"><h2>ร้อยละอัตรากำลังรายวัน<small>มาปฏิบัติงาน ÷ ตามแผน · เฉลี่ย ' + (rt.pct === null ? '–' : rt.pct + '%') + '</small></h2>' +
    '<div class="stf-legend"><span><i style="background:var(--stf-s1)"></i>ร้อยละที่มาปฏิบัติงาน</span><span><i class="dash"></i>100% (ครบตามแผน)</span></div>' +
    '<div class="stf-chart"><canvas id="cPct" role="img" aria-label="กราฟเส้นร้อยละอัตรากำลังรายวัน"></canvas></div></div></div>';
  // จุดที่ขาดบ่อย
  html += '<div class="card bg-base-100 border border-base-300 shadow-sm p-4 stf-card"><h2>จุดที่ขาดบ่อย<small>ช่วง ' + esc(thDate(d.from)) + ' – ' + esc(thDate(d.date)) + ' · ร้อยละอัตรากำลังเฉลี่ย ' + (rt.pct === null ? '–' : rt.pct + '%') + ' · ขาดรวม ' + rt.short + ' คน-ครั้ง</small></h2>' +
    (d.topShort.length ? '<div class="stf-tbl-wrap"><table class="table table-sm stf-tbl"><thead><tr><th>ห้อง</th><th>จุดปฏิบัติงาน</th><th class="num">วันที่ขาด / วันที่บันทึก</th><th class="num">ขาดรวม (คน)</th><th class="num">ขาดเฉลี่ยเมื่อขาด</th></tr></thead><tbody>' +
      d.topShort.map(function (s) { return '<tr><td>' + esc(s.room) + '</td><td>' + esc(s.point) + '</td><td class="num">' + s.shortDays + ' / ' + s.days + '</td><td class="num">' + s.short + '</td><td class="num">' + (Math.round(s.short / s.shortDays * 10) / 10) + '</td></tr>'; }).join('') +
      '</tbody></table></div>' : '<div class="stf-muted">ไม่มีจุดที่ขาดในช่วงนี้</div>') + '</div>';
  $('dsBody').innerHTML = html;
  animateIn($('dsBody')); countUp($('dsBody'));
  drawCharts(d);
}
function exportDashCsv() {
  var d = S.dash; if (!d) return;
  var lines = [csvRow(['รายงานอัตรากำลัง', d.org]), csvRow(['วันที่', thDate(d.date)]), '',
    csvRow(['ช่วงเวลา', 'ห้อง', 'จุดปฏิบัติงาน', 'อัตราตามแผน', 'อัตราปัจจุบัน', 'ส่วนต่าง', 'สถานะ'].concat(S.token ? ['หมายเหตุ', 'ผู้บันทึก'] : []))];
  d.rows.forEach(function (r) { lines.push(csvRow([r.slot, r.room, r.point, r.plan, r.actual, r.diff, r.status].concat(S.token ? [r.note, r.by] : []))); });
  lines.push('', csvRow(['แนวโน้มรายวัน']), csvRow(['วันที่', 'ตามแผน', 'มาปฏิบัติงาน', 'ขาด (คน)', 'จุดที่ขาด', 'ร้อยละอัตรากำลัง']));
  d.trend.forEach(function (x) { lines.push(csvRow([thDate(x.date), x.plan, x.actual, x.short, x.pointsShort, x.pct === null ? '' : x.pct])); });
  lines.push('', csvRow(['สรุปตามวัน จันทร์–ศุกร์']), csvRow(['วัน', 'จำนวนวัน', 'ขาดรวม (คน)', 'ขาดเฉลี่ยต่อวัน', 'วันที่ขาด', 'ร้อยละอัตรากำลัง']));
  (d.byWeekday || []).forEach(function (w) { lines.push(csvRow([w.name, w.days, w.short, w.avgShort, w.daysShort, w.pct === null ? '' : w.pct])); });
  downloadText('staffing_' + isoBE(d.date) + '.csv', lines.join('\r\n'));
}

/* ===== เริ่มต้น ===== */
document.addEventListener('DOMContentLoaded', function () { enter(); });
