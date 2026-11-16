/**
 * ระบบรายงานอัตรากำลังหน่วยเจาะเลือดฯ (Google Apps Script + Google Sheets)
 * Code.gs — โครงสร้างชีต, ล็อกอิน, ตัวกลางเรียก API, การบันทึกรายวัน และ Dashboard
 *
 * วันที่เก็บเป็น ค.ศ. รูปแบบ yyyy-MM-dd (ข้อความ) / แสดงผลเป็น พ.ศ. ฝั่งหน้าเว็บ
 */

const APP_NAME = 'รายงานอัตรากำลังหน่วยเจาะเลือดฯ';
const TZ = 'Asia/Bangkok';
const SESSION_SEC = 8 * 60 * 60;

// ---------- โครงสร้างชีต (เป็นฟังก์ชัน เพื่อไม่พึ่งลำดับโหลดไฟล์) ----------
function SH_() {
  return {
    DATA: 'Data', POINTS: 'Points', SLOTS: 'Slots', USERS: 'Users',
    RECIP: 'Recipients', SETTINGS: 'Settings', LOG: 'Log'
  };
}
function HEADERS_() {
  const S = SH_();
  const h = {};
  h[S.DATA] = ['key', 'วันที่', 'รหัสช่วงเวลา', 'ช่วงเวลา', 'รหัสจุด', 'ห้อง', 'จุดปฏิบัติงาน',
    'อัตราตามแผน', 'อัตราปัจจุบัน', 'ส่วนต่าง', 'สถานะ', 'หมายเหตุ', 'ผู้บันทึก', 'บันทึกเมื่อ'];
  h[S.POINTS] = ['รหัส', 'ห้อง', 'จุดปฏิบัติงาน', 'แผนเริ่มต้น', 'ประเภท', 'ลำดับ', 'ใช้งาน'];
  h[S.SLOTS] = ['รหัส', 'ชื่อช่วงเวลา', 'ลำดับ', 'ใช้งาน'];
  h[S.USERS] = ['StaffID', 'ชื่อ-สกุล', 'สิทธิ์', 'PIN_HASH', 'SALT', 'ใช้งาน', 'ต้องเปลี่ยน PIN', 'เข้าใช้ล่าสุด'];
  h[S.RECIP] = ['อีเมล', 'ชื่อ', 'ใช้งาน'];
  h[S.SETTINGS] = ['คีย์', 'ค่า', 'คำอธิบาย'];
  h[S.LOG] = ['เวลา', 'ผู้ใช้', 'การกระทำ', 'รายละเอียด'];
  return h;
}
// คอลัมน์ของชีต Data (index เริ่ม 0)
function DC_() {
  return { KEY: 0, DATE: 1, SLOT_ID: 2, SLOT: 3, POINT_ID: 4, ROOM: 5, POINT: 6,
    PLAN: 7, ACTUAL: 8, DIFF: 9, STATUS: 10, NOTE: 11, BY: 12, AT: 13, WIDTH: 14 };
}
function DEFAULT_SETTINGS_() {
  return [
    ['ORG_NAME', 'หน่วยเจาะเลือดและเก็บสิ่งส่งตรวจ', 'ชื่อหน่วยงานที่แสดงบนรายงาน'],
    ['REPORT_HOUR', '13', 'ชั่วโมงที่ส่งอีเมลรายงานอัตโนมัติ (0-23)'],
    ['REPORT_MINUTE', '0', 'นาทีโดยประมาณ (Google ส่งคลาดได้ ±15 นาที)'],
    ['REPORT_DAYS', '1,2,3,4,5', 'วันที่ส่งรายงาน 0=อาทิตย์ 1=จันทร์ ... 6=เสาร์'],
    ['ATTACH_PDF', 'TRUE', 'แนบไฟล์ PDF ไปกับอีเมล (TRUE/FALSE)'],
    ['SEND_ON_SAVE', 'TRUE', 'ส่งอีเมลรายงานทันทีหลังเจ้าหน้าที่กดบันทึก (เฉพาะข้อมูลของวันนี้) (TRUE/FALSE)'],
    ['EDIT_BACK_DAYS', '3', 'เจ้าหน้าที่แก้ไขข้อมูลย้อนหลังได้กี่วัน (ผู้ดูแลแก้ได้ทุกวัน)'],
    ['APP_URL', '', 'ลิงก์หน้าเว็บบน Vercel เช่น https://personnelreport.vercel.app (ใช้ในลิงก์ท้ายอีเมล)'],
    ['PUBLIC_DASHBOARD', 'TRUE', 'ให้ทุกคนที่มีลิงก์ดู Dashboard ได้โดยไม่ต้องเข้าสู่ระบบ (TRUE/FALSE) — ไม่แสดงหมายเหตุและชื่อผู้บันทึก']
  ];
}
function DEFAULT_POINTS_() {
  // ตามโครงสร้างไฟล์เดิม: [ห้อง, จุดปฏิบัติงาน, แผนเริ่มต้น, ประเภท]
  return [
    ['OPD', 'จุดลงทะเบียนห้องเจาะเลือด OPD', 5, 'ประจำ'],
    ['OPD', 'จุดเจาะเลือดห้องเจาะเลือด OPD', 9, 'ประจำ'],
    ['OPD', 'จุดอื่นๆ OPD', 4, 'ประจำ'],
    ['กว.', 'จุดลงทะเบียนห้องเจาะเลือด กว.', 2, 'ประจำ'],
    ['กว.', 'จุดเจาะเลือดห้องเจาะเลือด กว.', 5, 'ประจำ'],
    ['กว.', 'จุดอื่นๆ กว.', 3, 'ประจำ'],
    ['SMC', 'จุดลงทะเบียนห้องเจาะเลือด SMC', 2, 'ประจำ'],
    ['SMC', 'จุดเจาะเลือดห้องเจาะเลือด SMC', 2, 'ประจำ'],
    ['SMC', 'จุดอื่นๆ SMC', 2, 'ประจำ'],
    ['เวชกรรมสังคม', 'จุดเจาะเลือดห้องเจาะเลือดเวชกรรมสังคม', 2, 'เฉพาะวัน'],
    ['ออกหน่วยฯ', 'จุดเจาะเลือดออกหน่วยฯ', 2, 'เฉพาะวัน']
  ];
}

// ---------- เว็บ ----------
function doGet() {
  // หน้าเว็บย้ายไป Vercel แล้ว: ถ้ายังมีไฟล์ Index ในโปรเจกต์ ลิงก์เดิมยังใช้ได้ ; ถ้าลบไฟล์หน้าเว็บออกแล้ว จะพาไปที่ APP_URL
  try {
    return HtmlService.createTemplateFromFile('Index').evaluate()
      .setTitle(APP_NAME)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } catch (e) {
    const url = String(settings_().APP_URL || '').trim();
    return HtmlService.createHtmlOutput(url
      ? '<meta http-equiv="refresh" content="0;url=' + esc_(url) + '"><p style="font-family:sans-serif">ระบบย้ายไปที่ <a href="' + esc_(url) + '" target="_top">' + esc_(url) + '</a></p>'
      : '<p style="font-family:sans-serif">' + esc_(APP_NAME) + ' — API พร้อมใช้งาน</p>').setTitle(APP_NAME);
  }
}

/**
 * ทางเข้า API สำหรับหน้าเว็บบน Vercel (ผ่าน /api/gas)
 * รับ JSON { action, token, payload, key } → ตอบ JSON { ok, data } | { ok:false, code, message } (รูปแบบเดียวกับ api())
 * ถ้าตั้ง Script Property ชื่อ PROXY_KEY ไว้ ต้องส่ง key ตรงกันเท่านั้น (กันคนเรียก Apps Script ตรง ๆ โดยไม่ผ่าน Vercel)
 */
function doPost(e) {
  const out = o => ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const need = PropertiesService.getScriptProperties().getProperty('PROXY_KEY');
    if (need) {
      const got = typeof body.key === 'string' ? body.key : '';
      let diff = got.length ^ need.length;
      for (let i = 0; i < need.length; i++) diff |= need.charCodeAt(i) ^ (got.charCodeAt(i) || 0);
      if (diff !== 0) return out({ ok: false, code: 'FORBIDDEN', message: 'ไม่อนุญาต' });
    }
    if (typeof body.action !== 'string' || body.action.length > 40) return out({ ok: false, code: 'BAD', message: 'คำสั่งไม่ถูกต้อง' });
    return out(api(body.action, typeof body.token === 'string' ? body.token : null, body.payload && typeof body.payload === 'object' ? body.payload : {}));
  } catch (err) {
    Logger.log('doPost: ' + (err && err.stack ? err.stack : err));
    return out({ ok: false, code: 'ERR', message: 'ระบบขัดข้อง กรุณาลองใหม่อีกครั้ง' });
  }
}

/** รันครั้งเดียวจากตัวแก้ไข: สร้าง PROXY_KEY (ไม่สร้างทับถ้ามีแล้ว) แล้วนำค่าไปใส่ใน Vercel → Environment Variables ชื่อ GAS_PROXY_KEY */
function setupProxyKey() {
  const p = PropertiesService.getScriptProperties();
  if (p.getProperty('PROXY_KEY')) { Logger.log('มี PROXY_KEY อยู่แล้ว — ดูค่าได้ที่ ⚙ การตั้งค่าโปรเจกต์ > Script Properties'); return; }
  const k = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  p.setProperty('PROXY_KEY', k);
  Logger.log('PROXY_KEY = ' + k);
  Logger.log('นำค่านี้ไปตั้งใน Vercel > Settings > Environment Variables ชื่อ GAS_PROXY_KEY แล้ว Redeploy');
}
function include_(name) { return HtmlService.createHtmlOutputFromFile(name).getContent(); }

// ---------- ชีต ----------
function ss_() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  return id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
}
function sh_(name) {
  const s = ss_().getSheetByName(name);
  if (!s) throw new Error('ไม่พบชีต "' + name + '" กรุณารันฟังก์ชัน setup() ก่อน');
  return s;
}
/** อ่านข้อมูลทั้งชีต (ไม่รวมหัวตาราง) */
function rows_(name) {
  const s = sh_(name);
  const n = s.getLastRow();
  if (n < 2) return [];
  return s.getRange(2, 1, n - 1, s.getLastColumn()).getValues();
}
/** ต่อท้ายหลายแถวในครั้งเดียว (ขยายจำนวนแถวของชีตให้ก่อนถ้าไม่พอ) */
function appendRows_(s, rows) {
  if (!rows.length) return;
  const start = s.getLastRow() + 1;
  const need = start + rows.length - 1 - s.getMaxRows();
  if (need > 0) s.insertRowsAfter(s.getMaxRows(), need);
  s.getRange(start, 1, rows.length, rows[0].length).setValues(rows);
}
function bool_(v) { return v === true || String(v).toUpperCase() === 'TRUE'; }
function ymd_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
  return String(v || '').trim();
}
function today_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'); }
function addDays_(ymd, n) {
  const p = ymd.split('-').map(Number);
  const d = new Date(Date.UTC(p[0], p[1] - 1, p[2] + n));
  return d.toISOString().slice(0, 10);
}
function isYmd_(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')); }
function statusText_(diff) {
  if (diff < 0) return 'ขาด ' + (-diff) + ' คน';
  if (diff > 0) return 'เกิน ' + diff + ' คน';
  return 'ครบตามแผน';
}
function settings_() {
  const out = {};
  DEFAULT_SETTINGS_().forEach(r => { out[r[0]] = r[1]; });
  try { rows_(SH_().SETTINGS).forEach(r => { if (r[0]) out[String(r[0]).trim()] = String(r[1]).trim(); }); } catch (e) { /* ยังไม่ setup */ }
  return out;
}
function log_(user, action, detail) {
  try {
    sh_(SH_().LOG).appendRow([new Date(), user || '-', action, typeof detail === 'string' ? detail : JSON.stringify(detail || '')]);
  } catch (e) { Logger.log('log_: ' + e); }
}

// ---------- ติดตั้งครั้งแรก ----------
/** รันครั้งเดียวจากตัวแก้ไข: สร้างชีตทั้งหมด + ข้อมูลตั้งต้น + บัญชีผู้ดูแลเริ่มต้น */
function setup() {
  const book = ss_();
  const H = HEADERS_(), S = SH_();
  Object.keys(H).forEach(name => {
    let s = book.getSheetByName(name);
    if (!s) s = book.insertSheet(name);
    if (s.getLastRow() === 0) {
      s.getRange(1, 1, 1, H[name].length).setValues([H[name]]).setFontWeight('bold').setBackground('#e8eefc');
      s.setFrozenRows(1);
    }
  });
  // คอลัมน์ key/วันที่ เป็นข้อความ เพื่อไม่ให้ Sheets แปลงเป็นวันที่เอง
  sh_(S.DATA).getRange('A:B').setNumberFormat('@');
  sh_(S.USERS).getRange('A:A').setNumberFormat('@');

  if (rows_(S.SETTINGS).length === 0) {
    const d = DEFAULT_SETTINGS_();
    sh_(S.SETTINGS).getRange(2, 1, d.length, 3).setValues(d);
  }
  if (rows_(S.SLOTS).length === 0) {
    sh_(S.SLOTS).getRange(2, 1, 1, 4).setValues([['S1', '08.30–12.30 น.', 1, true]]);
  }
  if (rows_(S.POINTS).length === 0) {
    const p = DEFAULT_POINTS_().map((r, i) => ['P' + String(i + 1).padStart(2, '0'), r[0], r[1], r[2], r[3], i + 1, true]);
    sh_(S.POINTS).getRange(2, 1, p.length, 7).setValues(p);
  }
  if (rows_(S.USERS).length === 0) {
    const salt = Utilities.getUuid();
    sh_(S.USERS).appendRow(['admin', 'ผู้ดูแลระบบ', 'admin', hash_(salt, '123456'), salt, true, true, '']);
    Logger.log('สร้างบัญชีผู้ดูแลเริ่มต้น  StaffID = admin  PIN = 123456  (ระบบจะบังคับเปลี่ยน PIN เมื่อเข้าครั้งแรก)');
  }
  // ลบ Sheet1 ว่างเปล่า (ถ้ามี)
  const s1 = book.getSheetByName('Sheet1') || book.getSheetByName('ชีต1');
  if (s1 && s1.getLastRow() === 0 && book.getSheets().length > 1) book.deleteSheet(s1);
  Logger.log('✅ setup เสร็จ — ต่อไป: Deploy > New deployment > Web app');
}

/**
 * รันครั้งเดียวจากตัวแก้ไข เพื่อขอสิทธิ์ทั้งหมดที่ระบบต้องใช้ (ชีต, ส่งอีเมล, ตั้งเวลา, อีเมลเจ้าของ)
 * ในหน้าขออนุญาตของ Google ต้องติ๊กให้ครบทุกช่อง
 */
function authorize() {
  SpreadsheetApp.getActiveSpreadsheet().getName();
  ScriptApp.getProjectTriggers();
  const quota = MailApp.getRemainingDailyQuota();
  Logger.log('✅ ได้รับสิทธิ์ครบแล้ว · บัญชี: ' + Session.getEffectiveUser().getEmail() + ' · โควตาอีเมลวันนี้เหลือ ' + quota);
}

// ---------- ล็อกอิน ----------
function hash_(salt, pin) {
  const raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + '|' + pin, Utilities.Charset.UTF_8);
  return raw.map(b => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');
}
function findUser_(staffId) {
  const id = String(staffId || '').trim().toLowerCase();
  const data = rows_(SH_().USERS);
  for (let i = 0; i < data.length; i++) {
    if (String(data[i][0]).trim().toLowerCase() === id) return { row: i + 2, r: data[i] };
  }
  return null;
}
function login_(p) {
  const id = String(p && p.staffId || '').trim();
  const pin = String(p && p.pin || '').trim();
  if (!id || !pin) throw new Error('กรุณากรอกรหัสพนักงานและ PIN');
  const cache = CacheService.getScriptCache();
  const fk = 'fail_' + id.toLowerCase();
  const fails = Number(cache.get(fk) || 0);
  if (fails >= 5) throw new Error('ใส่ PIN ผิดหลายครั้ง กรุณารอ 10 นาทีแล้วลองใหม่');
  const u = findUser_(id);
  if (!u || !bool_(u.r[5]) || hash_(String(u.r[4]), pin) !== String(u.r[3])) {
    cache.put(fk, String(fails + 1), 600);
    log_(id, 'login-fail', '');
    throw new Error('รหัสพนักงานหรือ PIN ไม่ถูกต้อง');
  }
  cache.remove(fk);
  const user = { id: String(u.r[0]), name: String(u.r[1]), role: String(u.r[2] || 'staff') };
  const token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  cache.put('tok_' + token, JSON.stringify(user), SESSION_SEC);
  sh_(SH_().USERS).getRange(u.row, 8).setValue(new Date());
  log_(user.id, 'login', '');
  return Object.assign({ token: token, user: user, mustChange: bool_(u.r[6]), appName: APP_NAME, org: settings_().ORG_NAME }, initialView_(user));
}
function session_(token) {
  if (!token || typeof token !== 'string') return null;
  const v = CacheService.getScriptCache().get('tok_' + token);
  return v ? JSON.parse(v) : null;
}
function changePin_(user, p) {
  const pin = String(p && p.newPin || '');
  if (!/^\d{4,6}$/.test(pin)) throw new Error('PIN ต้องเป็นตัวเลข 4–6 หลัก');
  if (pin === '123456' || /^(\d)\1+$/.test(pin)) throw new Error('PIN นี้เดาง่ายเกินไป กรุณาตั้งใหม่');
  const u = findUser_(user.id);
  if (!u) throw new Error('ไม่พบผู้ใช้');
  if (p.oldPin !== undefined && hash_(String(u.r[4]), String(p.oldPin)) !== String(u.r[3])) throw new Error('PIN เดิมไม่ถูกต้อง');
  const salt = Utilities.getUuid();
  sh_(SH_().USERS).getRange(u.row, 4, 1, 4).setValues([[hash_(salt, pin), salt, true, false]]);
  log_(user.id, 'change-pin', '');
  return true;
}

// ---------- ตัวกลางเรียก API จากหน้าเว็บ ----------
// สิทธิ์: viewer = ดูอย่างเดียว, staff = กรอก + ดู, admin = ทั้งหมด
function ROUTES_() {
  const ANY = ['viewer', 'staff', 'admin'], ENTRY = ['staff', 'admin'], ADMIN = ['admin'];
  return {
    me: [ANY, (u) => Object.assign({ user: u, appName: APP_NAME, org: settings_().ORG_NAME, today: today_() }, initialView_(u))],
    logout: [ANY, (u, p, token) => { CacheService.getScriptCache().remove('tok_' + token); return true; }],
    changePin: [ANY, changePin_],
    getMeta: [ANY, () => getMeta_()],
    getDashboard: [ANY, (u, p) => getDashboard_(p)],
    getPdf: [ANY, (u, p) => getPdfBase64_(p && p.date)],
    getEntryForm: [ENTRY, (u, p) => getEntryForm_(u, p)],
    saveEntry: [ENTRY, (u, p) => saveEntry_(u, p)],
    // ผู้ดูแล (AdminApi.gs / Report.gs)
    adminGet: [ADMIN, (u, p) => adminGet_(p)],
    savePoint: [ADMIN, (u, p) => savePoint_(u, p)],
    saveSlot: [ADMIN, (u, p) => saveSlot_(u, p)],
    saveUser: [ADMIN, (u, p) => saveUser_(u, p)],
    resetPin: [ADMIN, (u, p) => resetPin_(u, p)],
    saveRecipient: [ADMIN, (u, p) => saveRecipient_(u, p)],
    deleteRecipient: [ADMIN, (u, p) => deleteRecipient_(u, p)],
    saveSettings: [ADMIN, (u, p) => saveSettings_(u, p)],
    installTrigger: [ADMIN, (u) => installTrigger_(u)],
    removeTrigger: [ADMIN, (u) => removeTrigger_(u)],
    sendTestReport: [ADMIN, (u, p) => sendTestReport_(u, p)],
    importLegacy: [ADMIN, (u, p) => importLegacy_(u, p)],
    listData: [ADMIN, (u, p) => listData_(p)],
    deleteEntry: [ADMIN, (u, p) => deleteEntry_(u, p)]
  };
}

/** จุดเดียวที่หน้าเว็บเรียก: google.script.run.api(action, token, payload) → {ok,data} | {ok:false,code,message} */
function api(action, token, payload) {
  try {
    if (action === 'login') return { ok: true, data: login_(payload) };
    if (action === 'publicMeta' || action === 'publicDashboard' || action === 'publicBoot') return publicApi_(action, payload || {});
    const route = ROUTES_()[action];
    if (!route) return { ok: false, code: 'BAD', message: 'คำสั่งไม่ถูกต้อง' };
    const user = session_(token);
    if (!user) return { ok: false, code: 'AUTH', message: 'หมดเวลาการใช้งาน กรุณาเข้าสู่ระบบใหม่' };
    if (route[0].indexOf(user.role) < 0) return { ok: false, code: 'DENIED', message: 'ไม่มีสิทธิ์ใช้งานส่วนนี้' };
    return { ok: true, data: route[1](user, payload || {}, token) };
  } catch (err) {
    const m = String(err && err.message ? err.message : err);
    Logger.log('api ' + action + ': ' + (err && err.stack ? err.stack : m));
    return { ok: false, code: 'ERR', message: /[฀-๿]/.test(m) ? m.slice(0, 300) : 'ระบบขัดข้อง กรุณาลองใหม่อีกครั้ง (' + m.slice(0, 120) + ')' };
  }
}

/** ข้อมูลหน้าแรกหลังล็อกอิน (ส่งมาพร้อม login/me ในรอบเดียว): เจ้าหน้าที่/ผู้ดูแล → ฟอร์มกรอกวันนี้ ; ผู้บริหาร → Dashboard */
function initialView_(user) {
  const meta = getMeta_();
  const out = { meta: meta };
  try {
    if (user.role === 'staff' || user.role === 'admin') out.form = getEntryForm_(user, { date: meta.today, slotId: meta.slots[0] && meta.slots[0].id });
    else {
      out.state = { date: meta.today, slotId: meta.slots.length > 1 ? 'ALL' : (meta.slots[0] && meta.slots[0].id) || '', days: 30 };
      out.dash = getDashboard_(out.state);
    }
  } catch (e) { Logger.log('initialView_: ' + e); }
  return out;
}

/** อุ่นเครื่อง: เติมแคช Dashboard สาธารณะไว้ล่วงหน้า (ตั้งเวลาด้วย installWarmup) */
function warmUp() { try { publicApi_('publicBoot', {}); } catch (e) { Logger.log('warmUp: ' + e); } }
/** รันครั้งเดียวจากตัวแก้ไข: ตั้งเวลาให้ warmUp ทำงานทุก 10 นาที — ให้เปิดหน้าเว็บครั้งแรกเร็วขึ้น */
function installWarmup() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'warmUp').forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('warmUp').timeBased().everyMinutes(10).create();
  warmUp();
  Logger.log('✅ ตั้งเวลาอุ่นเครื่องทุก 10 นาทีแล้ว');
}

/** เลขเวอร์ชันแคช Dashboard สาธารณะ — เปลี่ยนทุกครั้งที่ข้อมูลถูกบันทึก/ลบ/นำเข้า เพื่อให้เห็นข้อมูลล่าสุดทันที */
function pubVer_() { return CacheService.getScriptCache().get('pubver') || '0'; }
function bumpPub_() { try { CacheService.getScriptCache().put('pubver', String(Date.now()), 21600); } catch (e) { } }

/** Dashboard แบบสาธารณะ (ไม่ต้องล็อกอิน) — อ่านอย่างเดียว ไม่ส่งหมายเหตุ/ชื่อผู้บันทึก; ปิดได้ที่ตั้งค่า PUBLIC_DASHBOARD */
function publicApi_(action, p) {
  if (!bool_(settings_().PUBLIC_DASHBOARD)) return { ok: false, code: 'PUBLIC_OFF', message: 'ไม่ได้เปิดให้ดู Dashboard โดยไม่เข้าสู่ระบบ' };
  if (action === 'publicMeta') return { ok: true, data: getMeta_() };
  if (action === 'publicBoot') {
    // เปิดหน้าเว็บครั้งแรก: ส่งเมนู + Dashboard ค่าเริ่มต้นกลับไปในรอบเดียว (ลดการเรียกต่อกันหลายรอบ)
    const meta = getMeta_();
    const state = { date: meta.today, slotId: meta.slots.length > 1 ? 'ALL' : (meta.slots[0] && meta.slots[0].id) || '', days: 30 };
    const dash = publicApi_('publicDashboard', state);
    if (!dash.ok) return dash;
    return { ok: true, data: { meta: meta, state: state, dash: dash.data } };
  }
  const date = isYmd_(p.date) ? p.date : today_();
  const key = 'pub_' + pubVer_() + '_' + [date, String(p.slotId || '').slice(0, 10), Number(p.days) || 30].join('|');
  const cache = CacheService.getScriptCache();
  const hit = cache.get(key);
  if (hit) return { ok: true, data: JSON.parse(hit) };
  const d = getDashboard_({ date: date, slotId: p.slotId, days: p.days });
  d.rows = d.rows.map(r => Object.assign({}, r, { note: '', by: '', at: '' }));
  d.public = true;
  try { cache.put(key, JSON.stringify(d), 21600); } catch (e) { /* ใหญ่เกินแคช ข้ามได้ */ } // แคช 6 ชม. — ล้างอัตโนมัติเมื่อมีการบันทึก (bumpPub_)
  return { ok: true, data: d };
}

// ---------- ข้อมูลตั้งค่า ----------
function points_(includeInactive) {
  return rows_(SH_().POINTS)
    .filter(r => r[0] && (includeInactive || bool_(r[6])))
    .map(r => ({ id: String(r[0]), room: String(r[1]), name: String(r[2]), defPlan: Number(r[3]) || 0,
      type: String(r[4] || 'ประจำ'), order: Number(r[5]) || 999, active: bool_(r[6]) }))
    .sort((a, b) => a.order - b.order);
}
function slots_(includeInactive) {
  return rows_(SH_().SLOTS)
    .filter(r => r[0] && (includeInactive || bool_(r[3])))
    .map(r => ({ id: String(r[0]), name: String(r[1]), order: Number(r[2]) || 999, active: bool_(r[3]) }))
    .sort((a, b) => a.order - b.order);
}
function getMeta_() {
  return { points: points_(false), slots: slots_(false), today: today_(), org: settings_().ORG_NAME,
    editBackDays: Number(settings_().EDIT_BACK_DAYS) || 3 };
}
/** อ่านชีต Data ทั้งหมดเป็นอ็อบเจกต์ */
function dataRows_() {
  const C = DC_();
  return rows_(SH_().DATA).filter(r => r[C.KEY]).map(r => ({
    key: String(r[C.KEY]), date: ymd_(r[C.DATE]), slotId: String(r[C.SLOT_ID]), slot: String(r[C.SLOT]),
    pointId: String(r[C.POINT_ID]), room: String(r[C.ROOM]), point: String(r[C.POINT]),
    plan: Number(r[C.PLAN]) || 0, actual: Number(r[C.ACTUAL]) || 0, diff: Number(r[C.DIFF]) || 0,
    status: String(r[C.STATUS]), note: String(r[C.NOTE] || ''), by: String(r[C.BY] || ''),
    at: r[C.AT] instanceof Date ? r[C.AT].toISOString() : String(r[C.AT] || '')
  }));
}

// ---------- หน้ากรอกข้อมูล ----------
function checkEditable_(user, date) {
  if (!isYmd_(date)) throw new Error('วันที่ไม่ถูกต้อง');
  const t = today_();
  if (date > t) throw new Error('ไม่สามารถบันทึกข้อมูลล่วงหน้าได้');
  if (user.role !== 'admin') {
    const back = Number(settings_().EDIT_BACK_DAYS) || 3;
    if (date < addDays_(t, -back)) throw new Error('เจ้าหน้าที่แก้ไขย้อนหลังได้ไม่เกิน ' + back + ' วัน กรุณาติดต่อผู้ดูแล');
  }
}
function getEntryForm_(user, p) {
  const date = p.date || today_();
  if (!isYmd_(date)) throw new Error('วันที่ไม่ถูกต้อง');
  const slots = slots_(false);
  const slotId = p.slotId || (slots[0] && slots[0].id);
  const all = dataRows_();
  const existing = {};
  all.filter(d => d.date === date && d.slotId === slotId).forEach(d => { existing[d.pointId] = d; });
  // แผนล่าสุดของแต่ละจุดในช่วงเวลาเดียวกัน (ใช้เติมค่าแผนให้อัตโนมัติ)
  const lastPlan = {};
  all.filter(d => d.slotId === slotId && d.date < date).forEach(d => {
    if (!lastPlan[d.pointId] || lastPlan[d.pointId].date <= d.date) lastPlan[d.pointId] = { date: d.date, plan: d.plan };
  });
  const rows = points_(false).map(pt => {
    const e = existing[pt.id];
    return { pointId: pt.id, room: pt.room, name: pt.name, type: pt.type,
      plan: e ? e.plan : (lastPlan[pt.id] ? lastPlan[pt.id].plan : pt.defPlan),
      actual: e ? e.actual : '', note: e ? e.note : '', saved: !!e, by: e ? e.by : '', at: e ? e.at : '' };
  });
  let editable = true, reason = '';
  try { checkEditable_(user, date); } catch (err) { editable = false; reason = err.message; }
  return { date: date, slotId: slotId, slots: slots, rows: rows, editable: editable, reason: reason };
}

function saveEntry_(user, p) {
  const date = String(p.date || ''), slotId = String(p.slotId || ''), reqId = String(p.requestId || '');
  checkEditable_(user, date);
  const slot = slots_(true).filter(s => s.id === slotId)[0];
  if (!slot) throw new Error('ไม่พบช่วงเวลาที่เลือก');
  if (!Array.isArray(p.rows) || !p.rows.length) throw new Error('ไม่มีข้อมูลให้บันทึก');
  const cache = CacheService.getScriptCache();
  if (reqId) { const prev = cache.get('req_' + reqId); if (prev) return JSON.parse(prev); }

  const ptMap = {};
  points_(true).forEach(pt => { ptMap[pt.id] = pt; });
  const num = (v) => (v === '' || v === null || v === undefined) ? null : Number(v);
  const upserts = [], removes = [];
  p.rows.forEach(r => {
    const pt = ptMap[r.pointId];
    if (!pt) throw new Error('ไม่พบจุดปฏิบัติงาน ' + r.pointId);
    const plan = num(r.plan), actual = num(r.actual);
    const note = String(r.note || '').slice(0, 300);
    if (plan === null && actual === null && pt.type === 'เฉพาะวัน') { removes.push(pt.id); return; }
    [plan, actual].forEach(v => {
      if (v === null || !Number.isInteger(v) || v < 0 || v > 200) throw new Error('กรุณากรอกจำนวนคน (0–200) ให้ครบที่ ' + pt.name);
    });
    const diff = actual - plan;
    upserts.push([date + '|' + slotId + '|' + pt.id, date, slotId, slot.name, pt.id, pt.room, pt.name,
      plan, actual, diff, statusText_(diff), note, user.name + ' (' + user.id + ')', new Date()]);
  });

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  let added = 0, updated = 0, removed = 0;
  try {
    const s = sh_(SH_().DATA);
    const n = s.getLastRow();
    const keys = n > 1 ? s.getRange(2, 1, n - 1, 1).getValues().map(r => String(r[0])) : [];
    const idx = {};
    keys.forEach((k, i) => { if (k) idx[k] = i + 2; });
    const toAppend = [];
    upserts.forEach(row => {
      if (idx[row[0]]) { s.getRange(idx[row[0]], 1, 1, row.length).setValues([row]); updated++; }
      else toAppend.push(row);
    });
    appendRows_(s, toAppend);
    added = toAppend.length;
    // ลบจุด "เฉพาะวัน" ที่ถูกล้างค่า (ลบจากล่างขึ้นบน)
    removes.map(pid => idx[date + '|' + slotId + '|' + pid]).filter(Boolean).sort((a, b) => b - a)
      .forEach(r => { s.deleteRow(r); removed++; });
  } finally { lock.releaseLock(); }

  const result = { added: added, updated: updated, removed: removed,
    short: upserts.reduce((a, r) => a + (r[9] < 0 ? -r[9] : 0), 0) };
  log_(user.id, 'save', { date: date, slot: slotId, added: added, updated: updated, removed: removed });
  bumpPub_();
  result.mail = mailOnSave_(date, slot.name);
  if (reqId) cache.put('req_' + reqId, JSON.stringify(result), 21600);
  return result;
}

/** ส่งอีเมลรายงานทันทีหลังบันทึก — ไม่ทำให้การบันทึกล้มเหลวถ้าส่งไม่ได้ คืน 'sent' | 'off' | 'skip' | 'error' */
function mailOnSave_(date, slotName) {
  try {
    if (!bool_(settings_().SEND_ON_SAVE) || date !== today_()) return 'off';
    const to = rows_(SH_().RECIP).filter(r => r[0] && bool_(r[2])).map(r => String(r[0]).trim());
    if (!to.length) return 'skip';
    const res = sendReport_(date, to, 'อัปเดต' + slotName);
    log_('system', 'report-on-save', res);
    return 'sent';
  } catch (e) {
    log_('system', 'report-on-save-error', String(e));
    return 'error';
  }
}

// ---------- Dashboard ----------
function getDashboard_(p) {
  const date = isYmd_(p.date) ? p.date : today_();
  const days = Math.min(Math.max(Number(p.days) || 30, 7), 366);
  const slots = slots_(false);
  const slotId = p.slotId === 'ALL' ? 'ALL' : (p.slotId || (slots[0] && slots[0].id));
  const inSlot = d => slotId === 'ALL' || d.slotId === slotId;
  const everything = dataRows_();
  const all = everything.filter(inSlot);
  const from = addDays_(date, -(days - 1));
  // วันแรกที่ช่วงเวลา/จุดแต่ละอันเริ่มมีข้อมูล — ใช้ตัดสินว่าวันย้อนหลังควร "ต้องบันทึก" จุดนั้นหรือไม่
  const firstSlot = {}, firstPoint = {};
  everything.forEach(d => {
    if (!firstSlot[d.slotId] || d.date < firstSlot[d.slotId]) firstSlot[d.slotId] = d.date;
    if (!firstPoint[d.pointId] || d.date < firstPoint[d.pointId]) firstPoint[d.pointId] = d.date;
  });
  const expected = (sid, pid) => date >= today_() || (firstSlot[sid] && firstSlot[sid] <= date && firstPoint[pid] && firstPoint[pid] <= date);

  // วันที่เลือก
  const day = all.filter(d => d.date === date);
  const pts = points_(false);
  const savedKeys = {};
  day.forEach(d => { savedKeys[d.slotId + '|' + d.pointId] = true; });
  const missing = [];
  (slotId === 'ALL' ? slots : slots.filter(s => s.id === slotId)).forEach(s => {
    pts.filter(pt => pt.type === 'ประจำ').forEach(pt => {
      if (!savedKeys[s.id + '|' + pt.id] && expected(s.id, pt.id)) missing.push({ slot: s.name, room: pt.room, point: pt.name });
    });
  });
  const sum = arr => arr.reduce((a, d) => {
    a.plan += d.plan; a.actual += d.actual; a.short += d.diff < 0 ? -d.diff : 0;
    a.pointsShort += d.diff < 0 ? 1 : 0; a.points++; return a;
  }, { plan: 0, actual: 0, short: 0, pointsShort: 0, points: 0 });
  const totals = sum(day);
  totals.pct = totals.plan ? Math.round(totals.actual / totals.plan * 1000) / 10 : null;
  totals.missing = missing.length;

  const roomOrder = [];
  pts.forEach(pt => { if (roomOrder.indexOf(pt.room) < 0) roomOrder.push(pt.room); });
  const byRoomMap = {};
  day.forEach(d => { (byRoomMap[d.room] = byRoomMap[d.room] || []).push(d); });
  Object.keys(byRoomMap).forEach(r => { if (roomOrder.indexOf(r) < 0) roomOrder.push(r); });
  const byRoom = roomOrder.filter(r => byRoomMap[r]).map(r => Object.assign({ room: r }, sum(byRoomMap[r])));
  const ptOrder = {};
  pts.forEach(pt => { ptOrder[pt.id] = pt.order; });
  day.sort((a, b) => (a.slotId < b.slotId ? -1 : a.slotId > b.slotId ? 1 : 0) || (ptOrder[a.pointId] || 999) - (ptOrder[b.pointId] || 999));

  // แนวโน้มย้อนหลัง
  const range = all.filter(d => d.date >= from && d.date <= date);
  const byDate = {};
  range.forEach(d => { (byDate[d.date] = byDate[d.date] || []).push(d); });
  const trend = Object.keys(byDate).sort().map(k => {
    const t = sum(byDate[k]);
    return { date: k, plan: t.plan, actual: t.actual, short: t.short, pointsShort: t.pointsShort,
      pct: t.plan ? Math.round(t.actual / t.plan * 1000) / 10 : null };
  });
  // สรุปตามวันในสัปดาห์ จันทร์–ศุกร์ (เฉพาะวันที่มีข้อมูลในช่วงที่เลือก)
  const WD = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์'];
  const byWeekday = WD.map((name, i) => ({ dow: i + 1, name: name, days: 0, daysShort: 0, plan: 0, actual: 0, short: 0 }));
  trend.forEach(t => {
    const p = t.date.split('-').map(Number);
    const dow = new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay();
    if (dow < 1 || dow > 5) return;
    const w = byWeekday[dow - 1];
    w.days++; w.plan += t.plan; w.actual += t.actual; w.short += t.short; if (t.short > 0) w.daysShort++;
  });
  byWeekday.forEach(w => {
    w.avgShort = w.days ? Math.round(w.short / w.days * 10) / 10 : 0;
    w.pct = w.plan ? Math.round(w.actual / w.plan * 1000) / 10 : null;
  });
  const ptStat = {};
  range.forEach(d => {
    const k = d.room + '|' + d.point;
    const s = ptStat[k] = ptStat[k] || { room: d.room, point: d.point, days: 0, shortDays: 0, short: 0 };
    s.days++; if (d.diff < 0) { s.shortDays++; s.short += -d.diff; }
  });
  const topShort = Object.keys(ptStat).map(k => ptStat[k]).filter(s => s.shortDays > 0)
    .sort((a, b) => b.short - a.short || b.shortDays - a.shortDays).slice(0, 10);
  const rangeTotals = sum(range);
  rangeTotals.days = trend.length;
  rangeTotals.daysWithShort = trend.filter(t => t.short > 0).length;
  rangeTotals.pct = rangeTotals.plan ? Math.round(rangeTotals.actual / rangeTotals.plan * 1000) / 10 : null;

  const lastDate = all.length ? all.reduce((m, d) => d.date > m ? d.date : m, '') : '';
  return { date: date, slotId: slotId, slots: slots, days: days, from: from, org: settings_().ORG_NAME,
    rows: day, totals: totals, byRoom: byRoom, missing: missing, trend: trend, byWeekday: byWeekday, topShort: topShort,
    rangeTotals: rangeTotals, lastDate: lastDate };
}
