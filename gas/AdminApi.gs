/**
 * AdminApi.gs — ฟังก์ชันหลังบ้านสำหรับผู้ดูแล (ตั้งค่าจุด/ช่วงเวลา/ผู้ใช้/ผู้รับอีเมล, นำเข้าข้อมูลเก่า, จัดการข้อมูล)
 * ทุกฟังก์ชันถูกเรียกผ่าน api() ใน Code.gs ซึ่งตรวจสิทธิ์ admin แล้ว
 */

function adminGet_(p) {
  const users = rows_(SH_().USERS).filter(r => r[0]).map(r => ({
    id: String(r[0]), name: String(r[1]), role: String(r[2] || 'staff'), active: bool_(r[5]),
    mustChange: bool_(r[6]), last: r[7] instanceof Date ? r[7].toISOString() : String(r[7] || '')
  }));
  const recipients = rows_(SH_().RECIP).filter(r => r[0]).map(r => ({ email: String(r[0]), name: String(r[1] || ''), active: bool_(r[2]) }));
  const st = settings_();
  const trig = ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'sendDailyReport');
  const data = dataRows_();
  const dates = data.map(d => d.date).sort();
  return {
    points: points_(true), slots: slots_(true), users: users, recipients: recipients,
    settings: DEFAULT_SETTINGS_().map(d => ({ key: d[0], value: st[d[0]], desc: d[2] })),
    trigger: { installed: trig.length > 0, hour: st.REPORT_HOUR, minute: st.REPORT_MINUTE, days: st.REPORT_DAYS },
    stats: { rows: data.length, first: dates[0] || '', last: dates[dates.length - 1] || '', days: Object.keys(dates.reduce((a, d) => { a[d] = 1; return a; }, {})).length },
    sheetUrl: ss_().getUrl()
  };
}

function nextId_(prefix, ids) {
  let max = 0, width = 0;
  ids.forEach(id => {
    const m = String(id).match(/(\d+)$/);
    if (m && String(id).indexOf(prefix) === 0) { max = Math.max(max, Number(m[1])); width = Math.max(width, m[1].length); }
  });
  return prefix + String(max + 1).padStart(width || 2, '0');
}

// ---------- จุดปฏิบัติงาน ----------
function savePoint_(user, p) {
  const room = String(p.room || '').trim(), name = String(p.name || '').trim();
  if (!room || !name) throw new Error('กรุณากรอกชื่อห้องและจุดปฏิบัติงาน');
  const plan = Number(p.defPlan);
  if (!Number.isInteger(plan) || plan < 0 || plan > 200) throw new Error('แผนเริ่มต้นต้องเป็นจำนวนเต็ม 0–200');
  const type = p.type === 'เฉพาะวัน' ? 'เฉพาะวัน' : 'ประจำ';
  const s = sh_(SH_().POINTS);
  const all = rows_(SH_().POINTS);
  const order = Number(p.order) || (all.length + 1);
  if (p.id) {
    const i = all.findIndex(r => String(r[0]) === p.id);
    if (i < 0) throw new Error('ไม่พบจุดนี้แล้ว');
    s.getRange(i + 2, 2, 1, 6).setValues([[room, name, plan, type, order, p.active !== false]]);
    log_(user.id, 'point-edit', p);
    return p.id;
  }
  const id = nextId_('P', all.map(r => r[0]));
  s.appendRow([id, room, name, plan, type, order, true]);
  log_(user.id, 'point-add', { id: id, room: room, name: name });
  return id;
}

// ---------- ช่วงเวลา ----------
function saveSlot_(user, p) {
  const name = String(p.name || '').trim();
  if (!name) throw new Error('กรุณากรอกชื่อช่วงเวลา เช่น 08.30–12.30 น.');
  const s = sh_(SH_().SLOTS);
  const all = rows_(SH_().SLOTS);
  const order = Number(p.order) || (all.length + 1);
  if (p.id) {
    const i = all.findIndex(r => String(r[0]) === p.id);
    if (i < 0) throw new Error('ไม่พบช่วงเวลานี้แล้ว');
    s.getRange(i + 2, 2, 1, 3).setValues([[name, order, p.active !== false]]);
    log_(user.id, 'slot-edit', p);
    return p.id;
  }
  const id = nextId_('S', all.map(r => r[0]));
  s.appendRow([id, name, order, true]);
  log_(user.id, 'slot-add', { id: id, name: name });
  return id;
}

// ---------- ผู้ใช้ ----------
function saveUser_(user, p) {
  const id = String(p.id || '').trim(), name = String(p.name || '').trim();
  const role = ['viewer', 'staff', 'admin'].indexOf(p.role) >= 0 ? p.role : 'staff';
  if (!/^[A-Za-z0-9._-]{2,30}$/.test(id)) throw new Error('รหัสพนักงานใช้ตัวอักษรอังกฤษ/ตัวเลข 2–30 ตัว');
  if (!name) throw new Error('กรุณากรอกชื่อ-สกุล');
  const u = findUser_(id);
  const s = sh_(SH_().USERS);
  if (p.isNew) {
    if (u) throw new Error('มีรหัสพนักงานนี้แล้ว');
    const pin = String(p.pin || '');
    if (!/^\d{4,6}$/.test(pin)) throw new Error('PIN เริ่มต้นต้องเป็นตัวเลข 4–6 หลัก');
    const salt = Utilities.getUuid();
    s.appendRow([id, name, role, hash_(salt, pin), salt, true, true, '']);
    log_(user.id, 'user-add', { id: id, role: role });
    return true;
  }
  if (!u) throw new Error('ไม่พบผู้ใช้');
  if (u.r[0] === user.id && (role !== 'admin' || p.active === false)) throw new Error('ไม่สามารถลดสิทธิ์หรือปิดบัญชีของตัวเองได้');
  s.getRange(u.row, 2, 1, 2).setValues([[name, role]]);
  s.getRange(u.row, 6).setValue(p.active !== false);
  log_(user.id, 'user-edit', { id: id, role: role, active: p.active !== false });
  return true;
}
function resetPin_(user, p) {
  const u = findUser_(p.id);
  if (!u) throw new Error('ไม่พบผู้ใช้');
  const pin = String(p.pin || '');
  if (!/^\d{4,6}$/.test(pin)) throw new Error('PIN ต้องเป็นตัวเลข 4–6 หลัก');
  const salt = Utilities.getUuid();
  sh_(SH_().USERS).getRange(u.row, 4, 1, 4).setValues([[hash_(salt, pin), salt, true, true]]);
  CacheService.getScriptCache().remove('fail_' + String(p.id).toLowerCase());
  log_(user.id, 'user-reset-pin', { id: p.id });
  return true;
}

// ---------- ผู้รับอีเมล ----------
function saveRecipient_(user, p) {
  const email = String(p.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('อีเมลไม่ถูกต้อง');
  const s = sh_(SH_().RECIP);
  const all = rows_(SH_().RECIP);
  const i = all.findIndex(r => String(r[0]).trim().toLowerCase() === email);
  const row = [email, String(p.name || '').trim(), p.active !== false];
  if (i >= 0) s.getRange(i + 2, 1, 1, 3).setValues([row]); else s.appendRow(row);
  log_(user.id, 'recipient-save', email);
  return true;
}
function deleteRecipient_(user, p) {
  const email = String(p.email || '').trim().toLowerCase();
  const all = rows_(SH_().RECIP);
  const i = all.findIndex(r => String(r[0]).trim().toLowerCase() === email);
  if (i < 0) throw new Error('ไม่พบอีเมลนี้');
  sh_(SH_().RECIP).deleteRow(i + 2);
  log_(user.id, 'recipient-delete', email);
  return true;
}

// ---------- ตั้งค่า ----------
function saveSettings_(user, p) {
  const allowed = DEFAULT_SETTINGS_().map(d => d[0]);
  const vals = p.values || {};
  const h = Number(vals.REPORT_HOUR), m = Number(vals.REPORT_MINUTE), back = Number(vals.EDIT_BACK_DAYS);
  if (vals.REPORT_HOUR !== undefined && !(Number.isInteger(h) && h >= 0 && h <= 23)) throw new Error('ชั่วโมงต้องเป็น 0–23');
  if (vals.REPORT_MINUTE !== undefined && !(Number.isInteger(m) && m >= 0 && m <= 59)) throw new Error('นาทีต้องเป็น 0–59');
  if (vals.EDIT_BACK_DAYS !== undefined && !(Number.isInteger(back) && back >= 0 && back <= 60)) throw new Error('จำนวนวันย้อนหลังต้องเป็น 0–60');
  if (vals.REPORT_DAYS !== undefined && !/^[0-6](,[0-6])*$/.test(String(vals.REPORT_DAYS).replace(/\s/g, ''))) throw new Error('วันที่ส่งต้องเป็นตัวเลข 0–6 คั่นด้วยจุลภาค');
  if (vals.APP_URL !== undefined && String(vals.APP_URL).trim() && !/^https:\/\/[^\s<>"']+$/.test(String(vals.APP_URL).trim())) throw new Error('ลิงก์หน้าเว็บ ต้องขึ้นต้นด้วย https://');
  if (vals.SEND_ON_SAVE !== undefined && !/^(TRUE|FALSE)$/i.test(String(vals.SEND_ON_SAVE).trim())) throw new Error('ส่งอีเมลหลังบันทึก ต้องเป็น TRUE หรือ FALSE');
  if (vals.PUBLIC_DASHBOARD !== undefined && !/^(TRUE|FALSE)$/i.test(String(vals.PUBLIC_DASHBOARD).trim())) throw new Error('ดู Dashboard สาธารณะ ต้องเป็น TRUE หรือ FALSE');
  const s = sh_(SH_().SETTINGS);
  const all = rows_(SH_().SETTINGS);
  Object.keys(vals).forEach(k => {
    if (allowed.indexOf(k) < 0) return;
    const v = String(vals[k]).replace(/\s/g, k === 'ORG_NAME' ? ' ' : '').trim();
    const i = all.findIndex(r => String(r[0]) === k);
    const desc = DEFAULT_SETTINGS_().filter(d => d[0] === k)[0][2];
    if (i >= 0) s.getRange(i + 2, 2).setValue(v); else s.appendRow([k, v, desc]);
  });
  log_(user.id, 'settings', vals);
  // ถ้าตั้งเวลาส่งไว้แล้ว ให้ติดตั้ง trigger ใหม่ตามเวลาใหม่
  if (ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'sendDailyReport')) installTrigger_(user);
  return true;
}

// ---------- ข้อมูล ----------
function listData_(p) {
  const from = isYmd_(p.from) ? p.from : addDays_(today_(), -30);
  const to = isYmd_(p.to) ? p.to : today_();
  return dataRows_().filter(d => d.date >= from && d.date <= to)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0) || (a.slotId < b.slotId ? -1 : 1) || (a.pointId < b.pointId ? -1 : 1));
}
function deleteEntry_(user, p) {
  bumpPub_();
  const key = String(p.key || '');
  if (!key) throw new Error('ไม่พบรายการ');
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const s = sh_(SH_().DATA);
    const n = s.getLastRow();
    const keys = n > 1 ? s.getRange(2, 1, n - 1, 1).getValues().map(r => String(r[0])) : [];
    const i = keys.indexOf(key);
    if (i < 0) throw new Error('ไม่พบแถวนี้แล้ว (อาจถูกลบไปก่อนหน้า)');
    s.deleteRow(i + 2);
  } finally { lock.releaseLock(); }
  log_(user.id, 'data-delete', key);
  return true;
}

// ---------- นำเข้าข้อมูลจากไฟล์เดิม ----------
/** แปลงวันที่จากไฟล์เดิม (d/m/yyyy ค.ศ. หรือ พ.ศ., หรือ Date) เป็น yyyy-MM-dd */
function parseLegacyDate_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
  const s = String(v || '').trim();
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    let y = Number(m[3]); if (y > 2400) y -= 543;
    const mo = Number(m[2]), d = Number(m[1]);
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return '';
    return y + '-' + String(mo).padStart(2, '0') + '-' + String(d).padStart(2, '0');
  }
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? s : '';
}
/**
 * นำเข้าข้อมูลจาก Google Sheet เดิม (คอลัมน์: วันที่, ห้องเจาะเลือด, จุดปฏิบัติงาน, อัตราตามแผน, อัตราปัจจุบัน, ..., หมายเหตุ)
 * p = { sheetId, sheetName, slotId, overwrite }
 */
function importLegacy_(user, p) {
  let id = String(p.sheetId || '').trim();
  const m = id.match(/\/d\/([a-zA-Z0-9_-]{20,})/);
  if (m) id = m[1];
  const slot = slots_(true).filter(s => s.id === p.slotId)[0];
  if (!slot) throw new Error('กรุณาเลือกช่วงเวลาที่จะนำเข้า');
  const own = ss_();
  let src;
  if (!id || id === own.getId()) {
    // เว้นว่าง หรือเป็นไฟล์เดียวกับระบบ → อ่านจากแท็บในไฟล์นี้โดยตรง (ไม่ต้องใช้สิทธิ์เปิดไฟล์อื่น)
    src = own;
  } else {
    if (!/^[a-zA-Z0-9_-]{20,}$/.test(id)) throw new Error('ลิงก์หรือ ID ของ Google Sheet ไม่ถูกต้อง');
    try { src = SpreadsheetApp.openById(id); }
    catch (e) { throw new Error('เปิดไฟล์เดิมไม่ได้: ' + String(e && e.message ? e.message : e).slice(0, 200)); }
  }
  const sheet = p.sheetName ? src.getSheetByName(p.sheetName) : src.getSheets()[0];
  if (!sheet) throw new Error('ไม่พบแท็บ "' + p.sheetName + '" — ตรวจชื่อแท็บให้ตรงทุกตัวอักษร');
  const vals = sheet.getDataRange().getDisplayValues();
  return importRows_(user, vals, slot, !!p.overwrite);
}
/** แยกออกมาเพื่อทดสอบได้ — vals เป็นตาราง 2 มิติของข้อความ */
function importRows_(user, vals, slot, overwrite) {
  bumpPub_();
  const hi = vals.findIndex(r => String(r[0]).trim() === 'วันที่');
  if (hi < 0) throw new Error('ไม่พบหัวตาราง "วันที่" ในไฟล์เดิม');
  const head = vals[hi].map(h => String(h).trim());
  const col = (re, def) => { const i = head.findIndex(h => re.test(h)); return i >= 0 ? i : def; };
  const cDate = 0, cRoom = col(/ห้อง|หัอง/, 1), cPoint = col(/จุดปฏิบัติงาน/, 2),
    cPlan = col(/ตามแผน/, 3), cAct = col(/ปัจจุบัน/, 4), cNote = col(/หมายเหตุ/, 7);

  const norm = s => String(s || '').replace(/\s+/g, ' ').trim();
  const pts = points_(true);
  const ptKey = {};
  pts.forEach(pt => { ptKey[norm(pt.room) + '|' + norm(pt.name)] = pt; ptKey['|' + norm(pt.name)] = ptKey['|' + norm(pt.name)] || pt; });

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const s = sh_(SH_().DATA);
    const n = s.getLastRow();
    const keys = n > 1 ? s.getRange(2, 1, n - 1, 1).getValues().map(r => String(r[0])) : [];
    const idx = {};
    keys.forEach((k, i) => { if (k) idx[k] = i + 2; });

    let room = '', skipped = 0, bad = 0, created = [], badDates = [];
    const out = [], updates = [], seen = {};
    for (let i = hi + 1; i < vals.length; i++) {
      const r = vals[i];
      const date = parseLegacyDate_(r[cDate]);
      if (norm(r[cRoom])) room = norm(r[cRoom]);
      const name = norm(r[cPoint]);
      if (!date || !name) { if (String(r.join('')).trim()) bad++; continue; }
      const plan = Number(String(r[cPlan]).replace(/,/g, '')), act = Number(String(r[cAct]).replace(/,/g, ''));
      if (!isFinite(plan) || !isFinite(act) || String(r[cPlan]).trim() === '' || String(r[cAct]).trim() === '') {
        bad++; if (badDates.indexOf(date) < 0) badDates.push(date); continue;
      }
      let pt = ptKey[room + '|' + name] || ptKey['|' + name];
      if (!pt) {
        // จุดใหม่ที่ไม่มีในการตั้งค่า → สร้างเป็นแบบ "เฉพาะวัน"
        const newId = nextId_('P', pts.map(x => x.id).concat(created.map(x => x.id)));
        pt = { id: newId, room: room || '-', name: name, defPlan: plan, type: 'เฉพาะวัน', order: pts.length + created.length + 1, active: true };
        created.push(pt);
        ptKey[room + '|' + name] = pt; ptKey['|' + name] = pt;
      }
      const key = date + '|' + slot.id + '|' + pt.id;
      if (seen[key]) { skipped++; continue; }
      seen[key] = true;
      const diff = Math.round(act) - Math.round(plan);
      const row = [key, date, slot.id, slot.name, pt.id, pt.room, pt.name, Math.round(plan), Math.round(act), diff,
        statusText_(diff), cNote < r.length ? String(r[cNote] || '') : '', 'นำเข้าจากไฟล์เดิม', new Date()];
      if (idx[key]) { if (overwrite) updates.push([idx[key], row]); else skipped++; }
      else out.push(row);
    }
    if (created.length) {
      sh_(SH_().POINTS).getRange(sh_(SH_().POINTS).getLastRow() + 1, 1, created.length, 7)
        .setValues(created.map(pt => [pt.id, pt.room, pt.name, pt.defPlan, pt.type, pt.order, true]));
    }
    updates.forEach(u => s.getRange(u[0], 1, 1, u[1].length).setValues([u[1]]));
    appendRows_(s, out);
    const res = { added: out.length, updated: updates.length, skipped: skipped, bad: bad, badDates: badDates,
      newPoints: created.map(pt => pt.room + ' / ' + pt.name),
      days: Object.keys(out.concat(updates.map(u => u[1])).reduce((a, r) => { a[r[1]] = 1; return a; }, {})).length };
    log_(user.id, 'import-legacy', res);
    return res;
  } finally { lock.releaseLock(); }
}
