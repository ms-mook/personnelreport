/* ===== หน้าผู้ดูแลระบบ ===== */
var AD = { tab: 'report', data: null };
var AD_TABS = [
  ['report', 'รายงานอีเมล', 'mail'], ['points', 'จุดปฏิบัติงาน', 'map-pin'], ['slots', 'ช่วงเวลา', 'clock'], ['users', 'ผู้ใช้งาน', 'users'],
  ['data', 'ข้อมูลรายวัน', 'database'], ['import', 'นำเข้าข้อมูลเดิม', 'upload'], ['settings', 'ตั้งค่า', 'settings']
];
function renderAdmin() {
  $('main').innerHTML = '<div class="flex flex-wrap items-end gap-3 mb-3.5 stf-h"><div><h1>ผู้ดูแลระบบ</h1><div class="stf-sub" id="adStats"></div></div></div>' +
    '<div role="tablist" class="tabs tabs-border stf-tabs" id="adTabs">' + AD_TABS.map(function (t) { return '<button role="tab" class="tab" data-tab="' + t[0] + '">' + icon(t[2], 'size-4 mr-1.5') + t[1] + '</button>'; }).join('') + '</div><div id="adBody"></div>';
  Array.prototype.forEach.call(document.querySelectorAll('#adTabs button'), function (b) { b.onclick = function () { AD.tab = b.getAttribute('data-tab'); drawAdmin(); }; });
  loadAdmin();
}
function loadAdmin() {
  return call('adminGet').then(function (d) { AD.data = d; S.meta = null; drawAdmin(); }).catch(function (e) { toast('error', e.message); });
}
function drawAdmin() {
  var d = AD.data; if (!d || !$('adBody')) return;
  Array.prototype.forEach.call(document.querySelectorAll('#adTabs button'), function (b) { b.classList.toggle('on', b.getAttribute('data-tab') === AD.tab); b.classList.toggle('tab-active', b.getAttribute('data-tab') === AD.tab); });
  $('adStats').innerHTML = 'ข้อมูล ' + d.stats.rows.toLocaleString() + ' แถว · ' + d.stats.days + ' วัน' + (d.stats.first ? ' (' + thDate(d.stats.first) + ' – ' + thDate(d.stats.last) + ')' : '') +
    ' · <a href="' + esc(d.sheetUrl) + '" target="_blank" rel="noopener">เปิด Google Sheet</a>';
  var f = { report: adReport, points: adPoints, slots: adSlots, users: adUsers, data: adData, import: adImport, settings: adSettings }[AD.tab];
  f(d);
}
function act(promise, okMsg, inModal) {
  return promise.then(function (r) { if (okMsg) toast('success', okMsg); return loadAdmin().then(function () { return r; }); })
    .catch(function (e) { if (!inModal) toast('error', e.message); throw e; });
}
function pill(on, a, b) { return '<span class="badge badge-soft badge-sm ' + (on ? 'badge-success' : 'badge-ghost') + '">' + (on ? (a || 'ใช้งาน') : (b || 'ปิด')) + '</span>'; }

/* --- รายงานอีเมล --- */
function adReport(d) {
  var tr = d.trigger;
  var dayNames = String(tr.days || '').split(',').map(function (x) { return TH_D[Number(x)] || ''; }).filter(Boolean).join(', ');
  $('adBody').innerHTML = '<div class="grid gap-3.5 stf-grid grid-cols-1 min-[900px]:grid-cols-2">' +
    '<div class="card bg-base-100 border border-base-300 shadow-sm p-4 stf-card"><h2>การส่งอัตโนมัติ</h2>' +
    (tr.installed ? banner('ok', 'เปิดใช้งาน — ส่งทุกวัน' + esc(dayNames) + ' เวลาประมาณ ' + esc(('0' + tr.hour).slice(-2)) + ':' + esc(('0' + tr.minute).slice(-2)) + ' น.')
      : banner('warn', 'ยังไม่ได้เปิดการส่งอัตโนมัติ')) +
    '<p class="stf-muted">เปลี่ยนเวลา/วันที่ส่งได้ที่แท็บ "ตั้งค่า" · Google จะส่งคลาดเคลื่อนได้ประมาณ ±15 นาที · บัญชี Gmail ส่วนตัวส่งได้ไม่เกิน 100 ผู้รับต่อวัน</p>' +
    '<div class="stf-form-row"><button class="btn btn-sm btn-primary" id="tgOn">' + (tr.installed ? 'ติดตั้งเวลาใหม่' : 'เปิดการส่งอัตโนมัติ') + '</button>' +
    (tr.installed ? '<button class="btn btn-sm btn-outline btn-error" id="tgOff">ปิดการส่ง</button>' : '') + '</div>' +
    '<h2 style="margin-top:18px">ทดสอบส่งรายงาน</h2><div class="stf-form-row"><label class="stf-field">วันที่ของรายงาน<input type="date" class="input" id="tsDate" value="' + esc(d.stats.last || '') + '"></label>' +
    '<button class="btn btn-sm btn-outline" id="tsMe">ส่งหาตัวเอง (เจ้าของสคริปต์)</button><button class="btn btn-sm btn-outline" id="tsAll">ส่งหาผู้รับทั้งหมด</button></div></div>' +
    '<div class="card bg-base-100 border border-base-300 shadow-sm p-4 stf-card"><h2>ผู้รับรายงาน<small>' + d.recipients.filter(function (r) { return r.active; }).length + ' คนที่เปิดใช้งาน</small></h2>' +
    '<div class="stf-form-row"><label class="stf-field" style="flex:1 1 200px">อีเมล<input class="input" id="rcEmail" type="email" placeholder="name@hospital.go.th"></label>' +
    '<label class="stf-field" style="flex:1 1 160px">ชื่อ/ตำแหน่ง<input class="input" id="rcName" placeholder="เช่น หัวหน้ากลุ่มงาน"></label><button class="btn btn-sm btn-primary" id="rcAdd">' + icon('plus') + ' เพิ่ม</button></div>' +
    '<table class="table table-sm stf-tbl"><thead><tr><th>อีเมล</th><th>ชื่อ</th><th>สถานะ</th><th></th></tr></thead><tbody>' +
    (d.recipients.length ? d.recipients.map(function (r, i) {
      return '<tr><td>' + esc(r.email) + '</td><td>' + esc(r.name) + '</td><td>' + pill(r.active, 'รับ', 'หยุดรับ') + '</td><td style="white-space:nowrap">' +
        '<button class="btn btn-xs btn-outline" data-rt="' + i + '">' + (r.active ? 'หยุดส่ง' : 'เปิดส่ง') + '</button> <button class="btn btn-xs btn-outline btn-error" data-rd="' + i + '">ลบ</button></td></tr>';
    }).join('') : '<tr><td colspan="4" class="stf-muted">ยังไม่มีผู้รับ</td></tr>') + '</tbody></table></div></div>';
  $('tgOn').onclick = function () { act(call('installTrigger'), 'ตั้งเวลาส่งรายงานเรียบร้อย'); };
  if ($('tgOff')) $('tgOff').onclick = function () { modal({ title: 'ปิดการส่งอัตโนมัติ?', danger: true, okText: 'ปิดการส่ง', html: 'ทีมบริหารจะไม่ได้รับอีเมลรายวันจนกว่าจะเปิดใหม่' }).then(function (ok) { if (ok) act(call('removeTrigger'), 'ปิดการส่งอัตโนมัติแล้ว'); }); };
  var test = function (toMe) {
    call('sendTestReport', { date: $('tsDate').value, toMe: toMe }).then(function (r) { toast('success', 'ส่งแล้ว ' + r.to + ' ผู้รับ — ' + r.subject + ' (โควตาคงเหลือวันนี้ ' + r.quotaLeft + ')', 7000); })
      .catch(function (e) { toast('error', e.message); });
  };
  $('tsMe').onclick = function () { test(true); };
  $('tsAll').onclick = function () { modal({ title: 'ส่งรายงานทดสอบ', html: 'ส่งรายงานวันที่ ' + esc(thDate($('tsDate').value)) + ' ไปยังผู้รับที่เปิดใช้งานทั้งหมด?' }).then(function (ok) { if (ok) test(false); }); };
  $('rcAdd').onclick = function () { act(call('saveRecipient', { email: $('rcEmail').value, name: $('rcName').value }), 'เพิ่มผู้รับแล้ว').catch(function () { }); };
  Array.prototype.forEach.call(document.querySelectorAll('[data-rt]'), function (b) { b.onclick = function () { var r = d.recipients[b.getAttribute('data-rt')]; act(call('saveRecipient', { email: r.email, name: r.name, active: !r.active }), 'อัปเดตแล้ว'); }; });
  Array.prototype.forEach.call(document.querySelectorAll('[data-rd]'), function (b) {
    b.onclick = function () { var r = d.recipients[b.getAttribute('data-rd')]; modal({ title: 'ลบผู้รับ', danger: true, okText: 'ลบ', html: 'ลบ ' + esc(r.email) + ' ออกจากรายชื่อผู้รับ?' }).then(function (ok) { if (ok) act(call('deleteRecipient', { email: r.email }), 'ลบแล้ว'); }); };
  });
}

/* --- จุดปฏิบัติงาน --- */
function pointDialog(p) {
  p = p || { room: '', name: '', defPlan: 0, type: 'ประจำ', order: '', active: true };
  return modal({
    title: p.id ? 'แก้ไขจุดปฏิบัติงาน ' + p.id : 'เพิ่มจุดปฏิบัติงาน', okText: 'บันทึก',
    html: '<label class="stf-field">ห้อง<input class="input" data-k="room" value="' + esc(p.room) + '" placeholder="เช่น OPD, กว., SMC"></label>' +
      '<label class="stf-field">ชื่อจุดปฏิบัติงาน<input class="input" data-k="name" value="' + esc(p.name) + '"></label>' +
      '<label class="stf-field">อัตราตามแผนเริ่มต้น (คน)<input class="input" type="number" min="0" max="200" data-k="defPlan" value="' + esc(p.defPlan) + '"></label>' +
      '<label class="stf-field">ประเภท<select class="select" data-k="type"><option value="ประจำ">ประจำ — ต้องกรอกทุกวัน</option><option value="เฉพาะวัน"' + (p.type === 'เฉพาะวัน' ? ' selected' : '') + '>เฉพาะวัน — กรอกเมื่อเปิดบริการ</option></select></label>' +
      '<label class="stf-field">ลำดับการแสดงผล<input class="input" type="number" data-k="order" value="' + esc(p.order) + '"></label>' +
      (p.id ? '<label class="stf-field"><span><input type="checkbox" class="checkbox checkbox-sm align-middle" data-k="active"' + (p.active ? ' checked' : '') + '> ใช้งาน (ปิดแล้วจะไม่แสดงในหน้ากรอก แต่ข้อมูลเก่ายังอยู่)</span></label>' : ''),
    onOk: function (box) {
      var g = function (k) { var el = box.querySelector('[data-k="' + k + '"]'); return el ? (el.type === 'checkbox' ? el.checked : el.value) : undefined; };
      return act(call('savePoint', { id: p.id, room: g('room'), name: g('name'), defPlan: Number(g('defPlan')), type: g('type'), order: g('order'), active: p.id ? g('active') : true }), 'บันทึกจุดปฏิบัติงานแล้ว', true);
    }
  }).then(function () { }, function () { });
}
function adPoints(d) {
  $('adBody').innerHTML = '<div class="card bg-base-100 border border-base-300 shadow-sm p-4 stf-card"><h2>จุดปฏิบัติงาน<small>แผนเริ่มต้นใช้เติมค่าอัตโนมัติเมื่อยังไม่เคยกรอก (ถ้าเคยกรอกแล้วระบบใช้แผนของวันล่าสุด)</small></h2>' +
    '<div class="stf-form-row"><button class="btn btn-sm btn-primary" id="ptAdd">' + icon('plus') + ' เพิ่มจุดปฏิบัติงาน</button></div><div class="stf-tbl-wrap"><table class="table table-sm stf-tbl"><thead><tr><th>รหัส</th><th>ห้อง</th><th>จุดปฏิบัติงาน</th><th class="num">แผนเริ่มต้น</th><th>ประเภท</th><th class="num">ลำดับ</th><th>สถานะ</th><th></th></tr></thead><tbody>' +
    d.points.map(function (p, i) {
      return '<tr><td>' + esc(p.id) + '</td><td>' + esc(p.room) + '</td><td>' + esc(p.name) + '</td><td class="num">' + p.defPlan + '</td><td>' + esc(p.type) + '</td><td class="num">' + p.order + '</td><td>' + pill(p.active) + '</td><td><button class="btn btn-xs btn-outline" data-pe="' + i + '">แก้ไข</button></td></tr>';
    }).join('') + '</tbody></table></div></div>';
  $('ptAdd').onclick = function () { pointDialog(null); };
  Array.prototype.forEach.call(document.querySelectorAll('[data-pe]'), function (b) {
    b.onclick = function () { pointDialog(d.points[b.getAttribute('data-pe')]); };
  });
}

/* --- ช่วงเวลา --- */
function adSlots(d) {
  $('adBody').innerHTML = '<div class="card bg-base-100 border border-base-300 shadow-sm p-4 stf-card"><h2>ช่วงเวลา / เวร<small>ระบบเดิมใช้ช่วง 08.30–12.30 น. — เพิ่มช่วงบ่าย/เวรดึกได้ที่นี่</small></h2>' +
    '<div class="stf-form-row"><label class="stf-field">ชื่อช่วงเวลา<input class="input" id="slName" placeholder="เช่น 12.30–16.30 น."></label><button class="btn btn-sm btn-primary" id="slAdd">' + icon('plus') + ' เพิ่ม</button></div>' +
    '<table class="table table-sm stf-tbl"><thead><tr><th>รหัส</th><th>ชื่อช่วงเวลา</th><th class="num">ลำดับ</th><th>สถานะ</th><th></th></tr></thead><tbody>' +
    d.slots.map(function (s, i) { return '<tr><td>' + esc(s.id) + '</td><td>' + esc(s.name) + '</td><td class="num">' + s.order + '</td><td>' + pill(s.active) + '</td><td><button class="btn btn-xs btn-outline" data-se="' + i + '">แก้ไข</button></td></tr>'; }).join('') +
    '</tbody></table></div>';
  $('slAdd').onclick = function () { act(call('saveSlot', { name: $('slName').value }), 'เพิ่มช่วงเวลาแล้ว').catch(function () { }); };
  Array.prototype.forEach.call(document.querySelectorAll('[data-se]'), function (b) {
    b.onclick = function () {
      var s = d.slots[b.getAttribute('data-se')];
      modal({ title: 'แก้ไขช่วงเวลา ' + s.id, okText: 'บันทึก',
        html: '<label class="stf-field">ชื่อช่วงเวลา<input class="input" data-n value="' + esc(s.name) + '"></label><label class="stf-field">ลำดับ<input class="input" type="number" data-o value="' + s.order + '"></label>' +
          '<label class="stf-field"><span><input type="checkbox" class="checkbox checkbox-sm align-middle" data-a' + (s.active ? ' checked' : '') + '> ใช้งาน</span></label>',
        onOk: function (box) { return act(call('saveSlot', { id: s.id, name: box.querySelector('[data-n]').value, order: box.querySelector('[data-o]').value, active: box.querySelector('[data-a]').checked }), 'บันทึกแล้ว', true); }
      }).then(function () { }, function () { });
    };
  });
}

/* --- ผู้ใช้งาน --- */
function adUsers(d) {
  var roleSel = function (v) { return '<select class="select" data-role>' + ['staff', 'viewer', 'admin'].map(function (r) { return '<option value="' + r + '"' + (r === v ? ' selected' : '') + '>' + ROLE_TH[r] + '</option>'; }).join('') + '</select>'; };
  $('adBody').innerHTML = '<div class="card bg-base-100 border border-base-300 shadow-sm p-4 stf-card"><h2>ผู้ใช้งาน<small>เจ้าหน้าที่ = กรอก+ดู · ผู้บริหาร = ดู Dashboard · ผู้ดูแล = ทั้งหมด</small></h2>' +
    '<div class="stf-form-row"><button class="btn btn-sm btn-primary" id="usAdd">' + icon('plus') + ' เพิ่มผู้ใช้</button></div><div class="stf-tbl-wrap"><table class="table table-sm stf-tbl"><thead><tr><th>รหัสพนักงาน</th><th>ชื่อ-สกุล</th><th>สิทธิ์</th><th>สถานะ</th><th>เข้าใช้ล่าสุด</th><th></th></tr></thead><tbody>' +
    d.users.map(function (u, i) {
      return '<tr><td>' + esc(u.id) + '</td><td>' + esc(u.name) + '</td><td>' + esc(ROLE_TH[u.role] || u.role) + '</td><td>' + pill(u.active) + (u.mustChange ? ' <span class="badge badge-soft badge-warning badge-sm">รอตั้ง PIN</span>' : '') +
        '</td><td>' + esc(thTs(u.last)) + '</td><td style="white-space:nowrap"><button class="btn btn-xs btn-outline" data-ue="' + i + '">แก้ไข</button> <button class="btn btn-xs btn-outline" data-ur="' + i + '">รีเซ็ต PIN</button></td></tr>';
    }).join('') + '</tbody></table></div></div>';
  $('usAdd').onclick = function () {
    modal({ title: 'เพิ่มผู้ใช้', okText: 'เพิ่ม',
      html: '<label class="stf-field">รหัสพนักงาน (อังกฤษ/ตัวเลข)<input class="input" data-id></label><label class="stf-field">ชื่อ-สกุล<input class="input" data-name></label>' +
        '<label class="stf-field">สิทธิ์' + roleSel('staff') + '</label><label class="stf-field">PIN เริ่มต้น (4–6 หลัก — ผู้ใช้ต้องเปลี่ยนเมื่อเข้าครั้งแรก)<input class="input" inputmode="numeric" maxlength="6" data-pin></label>',
      onOk: function (box) { return act(call('saveUser', { isNew: true, id: box.querySelector('[data-id]').value.trim(), name: box.querySelector('[data-name]').value, role: box.querySelector('[data-role]').value, pin: box.querySelector('[data-pin]').value }), 'เพิ่มผู้ใช้แล้ว', true); }
    }).then(function () { }, function () { });
  };
  Array.prototype.forEach.call(document.querySelectorAll('[data-ue]'), function (b) {
    b.onclick = function () {
      var u = d.users[b.getAttribute('data-ue')];
      modal({ title: 'แก้ไขผู้ใช้ ' + u.id, okText: 'บันทึก',
        html: '<label class="stf-field">ชื่อ-สกุล<input class="input" data-name value="' + esc(u.name) + '"></label><label class="stf-field">สิทธิ์' + roleSel(u.role) + '</label>' +
          '<label class="stf-field"><span><input type="checkbox" class="checkbox checkbox-sm align-middle" data-a' + (u.active ? ' checked' : '') + '> เปิดใช้งาน</span></label>',
        onOk: function (box) { return act(call('saveUser', { id: u.id, name: box.querySelector('[data-name]').value, role: box.querySelector('[data-role]').value, active: box.querySelector('[data-a]').checked }), 'บันทึกแล้ว', true); }
      }).then(function () { }, function () { });
    };
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-ur]'), function (b) {
    b.onclick = function () {
      var u = d.users[b.getAttribute('data-ur')];
      modal({ title: 'รีเซ็ต PIN ของ ' + u.name, okText: 'รีเซ็ต',
        html: '<label class="stf-field">PIN ชั่วคราว (4–6 หลัก)<input class="input" inputmode="numeric" maxlength="6" data-pin></label><div class="stf-muted">ผู้ใช้จะถูกบังคับตั้ง PIN ใหม่เมื่อเข้าระบบ</div>',
        onOk: function (box) { return act(call('resetPin', { id: u.id, pin: box.querySelector('[data-pin]').value }), 'รีเซ็ต PIN แล้ว', true); }
      }).then(function () { }, function () { });
    };
  });
}

/* --- ข้อมูลรายวัน --- */
function adData(d) {
  var to = (S.meta && S.meta.today) || d.stats.last || '';
  var from = AD.dataFrom || (to ? addDaysJs(to, -6) : '');
  $('adBody').innerHTML = '<div class="card bg-base-100 border border-base-300 shadow-sm p-4 stf-card"><h2>ข้อมูลรายวัน<small>แก้ตัวเลขได้ที่หน้า "กรอกอัตรากำลัง" (ผู้ดูแลเลือกวันย้อนหลังได้ทุกวัน)</small></h2>' +
    '<div class="stf-form-row"><label class="stf-field">ตั้งแต่<input type="date" class="input" id="dtFrom" value="' + esc(from) + '"></label><label class="stf-field">ถึง<input type="date" class="input" id="dtTo" value="' + esc(AD.dataTo || to) + '"></label>' +
    '<button class="btn btn-sm btn-outline" id="dtLoad">แสดง</button><button class="btn btn-sm btn-outline" id="dtCsv">ส่งออก CSV</button></div><div id="dtList" class="stf-tbl-wrap"></div></div>';
  var load = function () {
    AD.dataFrom = $('dtFrom').value; AD.dataTo = $('dtTo').value;
    call('listData', { from: AD.dataFrom, to: AD.dataTo }).then(function (rows) {
      AD.rows = rows;
      $('dtList').innerHTML = '<div class="stf-muted" style="margin-bottom:6px">' + rows.length + ' แถว</div><table class="table table-sm stf-tbl"><thead><tr><th>วันที่</th><th>ช่วงเวลา</th><th>ห้อง</th><th>จุดปฏิบัติงาน</th><th class="num">แผน</th><th class="num">ปัจจุบัน</th><th>สถานะ</th><th>หมายเหตุ</th><th>ผู้บันทึก</th><th></th></tr></thead><tbody>' +
        rows.map(function (r, i) {
          return '<tr class="' + (r.diff < 0 ? 'short' : '') + '"><td>' + thDate(r.date) + '</td><td>' + esc(r.slot) + '</td><td>' + esc(r.room) + '</td><td>' + esc(r.point) + '</td><td class="num">' + r.plan + '</td><td class="num">' + r.actual + '</td><td>' + statusBadge(r.diff) +
            '</td><td>' + esc(r.note) + '</td><td class="stf-muted">' + esc(r.by) + '</td><td><button class="btn btn-xs btn-outline btn-error" data-dd="' + i + '">ลบ</button></td></tr>';
        }).join('') + '</tbody></table>';
      Array.prototype.forEach.call(document.querySelectorAll('[data-dd]'), function (b) {
        b.onclick = function () {
          var r = AD.rows[b.getAttribute('data-dd')];
          modal({ title: 'ลบข้อมูล', danger: true, okText: 'ลบ', html: 'ลบข้อมูล ' + esc(r.point) + ' วันที่ ' + esc(thDate(r.date)) + ' (' + esc(r.slot) + ')?<br>การลบไม่สามารถย้อนกลับได้ (มีบันทึกในชีต Log)' })
            .then(function (ok) { if (ok) call('deleteEntry', { key: r.key }).then(function () { toast('success', 'ลบแล้ว'); load(); }).catch(function (e) { toast('error', e.message); }); });
        };
      });
    }).catch(function (e) { toast('error', e.message); });
  };
  $('dtLoad').onclick = load;
  $('dtCsv').onclick = function () {
    if (!AD.rows) return toast('info', 'กด "แสดง" ก่อน');
    var lines = [csvRow(['วันที่', 'ช่วงเวลา', 'ห้อง', 'จุดปฏิบัติงาน', 'อัตราตามแผน', 'อัตราปัจจุบัน', 'ส่วนต่าง', 'สถานะ', 'หมายเหตุ', 'ผู้บันทึก'])];
    AD.rows.forEach(function (r) { lines.push(csvRow([thDate(r.date), r.slot, r.room, r.point, r.plan, r.actual, r.diff, r.status, r.note, r.by])); });
    downloadText('staffing-data_' + isoBE(AD.dataFrom) + '_to_' + isoBE(AD.dataTo) + '.csv', lines.join('\r\n'));
  };
  load();
}
function addDaysJs(ymd, n) { var p = ymd.split('-').map(Number); return new Date(Date.UTC(p[0], p[1] - 1, p[2] + n)).toISOString().slice(0, 10); }

/* --- นำเข้าข้อมูลเดิม --- */
function adImport(d) {
  $('adBody').innerHTML = '<div class="card bg-base-100 border border-base-300 shadow-sm p-4 stf-card max-w-3xl"><h2>นำเข้าข้อมูลจาก Google Sheet เดิม</h2>' +
    banner('info', 'รองรับไฟล์รูปแบบเดิม: คอลัมน์ วันที่ (ว/ด/ปี) · ห้องเจาะเลือด · จุดปฏิบัติงาน · อัตราตามแผน · อัตราปัจจุบัน · … · หมายเหตุ<br>' +
    'ช่องห้องที่ว่างจะใช้ห้องของแถวก่อนหน้า · แถวที่ไม่มีอัตราปัจจุบัน (เช่น วันหยุด) จะถูกข้าม · นำเข้าซ้ำได้ ไม่เกิดข้อมูลซ้ำ') +
    '<label class="stf-field">ลิงก์หรือ ID ของ Google Sheet เดิม <span class="stf-muted">(เว้นว่าง = อ่านจากแท็บใน Sheet ของระบบนี้ — วิธีที่แนะนำ)</span><input class="input" id="imId" placeholder="เว้นว่างไว้ ถ้าคัดลอกแท็บข้อมูลเดิมมาไว้ใน Sheet นี้แล้ว"></label>' +
    '<div class="stf-form-row" style="margin-top:10px"><label class="stf-field">ชื่อแท็บ<input class="input" id="imTab" value="Sheet data"></label>' +
    '<label class="stf-field">นำเข้าเป็นช่วงเวลา<select class="select" id="imSlot">' + d.slots.map(function (s) { return '<option value="' + esc(s.id) + '">' + esc(s.name) + '</option>'; }).join('') + '</select></label>' +
    '<label class="stf-field"><span><input type="checkbox" class="checkbox checkbox-sm align-middle" id="imOver"> เขียนทับวันที่มีข้อมูลอยู่แล้ว</span></label></div>' +
    '<button class="btn btn-sm btn-primary" id="imGo">' + icon('upload') + ' นำเข้า</button><div id="imRes" style="margin-top:12px">' + (AD.importRes || '') + '</div></div>';
  $('imGo').onclick = function () {
    modal({ title: 'ยืนยันนำเข้าข้อมูล', html: 'ระบบจะอ่านข้อมูลจากไฟล์เดิมและเพิ่มลงชีต Data (ไฟล์เดิมไม่ถูกแก้ไข)' + ($('imOver').checked ? '<br><b>เปิดเขียนทับ:</b> ข้อมูลวันที่ซ้ำจะถูกแทนที่ด้วยค่าจากไฟล์เดิม' : '') }).then(function (ok) {
      if (!ok) return;
      call('importLegacy', { sheetId: $('imId').value, sheetName: $('imTab').value.trim(), slotId: $('imSlot').value, overwrite: $('imOver').checked }).then(function (r) {
        AD.importRes = banner('ok', '<b>นำเข้าเสร็จ</b><br>เพิ่มใหม่ ' + r.added + ' แถว (' + r.days + ' วัน) · เขียนทับ ' + r.updated + ' · ข้ามเพราะมีอยู่แล้ว ' + r.skipped +
          (r.bad ? '<br>ข้าม ' + r.bad + ' แถวที่ข้อมูลไม่ครบ' + (r.badDates && r.badDates.length ? ' (วันที่ ' + r.badDates.map(thDate).join(', ') + ')' : '') : '') +
          (r.newPoints.length ? '<br>สร้างจุดใหม่แบบ "เฉพาะวัน": ' + r.newPoints.map(esc).join(', ') : ''), 'mb-0');
        AD.tab = 'import'; loadAdmin();
        toast('success', 'นำเข้า ' + r.added + ' แถวเรียบร้อย');
      }).catch(function (e) { toast('error', e.message); });
    });
  };
}

/* --- ตั้งค่า --- */
function adSettings(d) {
  $('adBody').innerHTML = '<div class="card bg-base-100 border border-base-300 shadow-sm p-4 stf-card max-w-3xl"><h2>ตั้งค่า</h2>' +
    d.settings.map(function (s) {
      return '<label class="stf-field" style="margin-bottom:12px">' + esc(s.desc) + ' <span class="stf-muted">(' + esc(s.key) + ')</span><input class="input" data-set="' + esc(s.key) + '" value="' + esc(s.value) + '"></label>';
    }).join('') + '<button class="btn btn-sm btn-primary" id="stSave">บันทึกการตั้งค่า</button></div>';
  $('stSave').onclick = function () {
    var vals = {};
    Array.prototype.forEach.call(document.querySelectorAll('[data-set]'), function (el) { vals[el.getAttribute('data-set')] = el.value; });
    act(call('saveSettings', { values: vals }), 'บันทึกการตั้งค่าแล้ว' + (d.trigger.installed ? ' (ปรับเวลาส่งอัตโนมัติให้แล้ว)' : '')).catch(function () { });
  };
}
