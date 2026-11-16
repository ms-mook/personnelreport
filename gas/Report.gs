/**
 * Report.gs — สร้างรายงานรายวัน (HTML/PDF), ส่งอีเมลอัตโนมัติ และตั้งเวลา (trigger)
 */

function TH_MONTHS_() {
  return ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
}
function TH_DAYS_() { return ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์']; }
/** 2026-11-13 → วันศุกร์ที่ 13 พฤศจิกายน 2569 */
function thDateLong_(ymd) {
  const p = ymd.split('-').map(Number);
  const dow = new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay();
  return 'วัน' + TH_DAYS_()[dow] + 'ที่ ' + p[2] + ' ' + TH_MONTHS_()[p[1] - 1] + ' ' + (p[0] + 543);
}
/** 2026-11-13 → 13/11/2569 */
function thDate_(ymd) {
  const p = String(ymd || '').split('-');
  return p.length === 3 ? p[2] + '/' + p[1] + '/' + (Number(p[0]) + 543) : String(ymd || '');
}
/** 2026-11-13 → 2569-11-13 (ชื่อไฟล์ภาษาอังกฤษ เพื่อให้ดาวน์โหลดได้ทุกเบราว์เซอร์) */
function isoBE_(ymd) { const p = String(ymd).split('-'); return (Number(p[0]) + 543) + '-' + p[1] + '-' + p[2]; }
function esc_(s) {
  return String(s === null || s === undefined ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function webUrl_() {
  const u = String(settings_().APP_URL || '').trim();
  if (/^https:\/\//.test(u)) return u;
  try { return ScriptApp.getService().getUrl() || ''; } catch (e) { return ''; }
}

function buildDailyReport_(date) {
  return getDashboard_({ date: date, slotId: 'ALL', days: 30 });
}

/** HTML รายงาน — ใช้ทั้งเนื้ออีเมลและแปลงเป็น PDF (สไตล์ inline เพื่อให้แสดงใน Gmail ได้) */
function reportHtml_(rep, forPdf) {
  const t = rep.totals;
  const red = '#b42318', redBg = '#fee4e2', green = '#067647', amber = '#b54708';
  const font = "font-family:'Sarabun','Tahoma','Leelawadee UI',sans-serif;";
  const cell = 'padding:6px 8px;border:1px solid #d0d5dd;font-size:13px;';
  const card = (label, val, color) =>
    '<td style="padding:10px 12px;border:1px solid #d0d5dd;border-radius:6px;text-align:center;background:#fff;">' +
    '<div style="font-size:12px;color:#475467;">' + label + '</div>' +
    '<div style="font-size:22px;font-weight:700;color:' + (color || '#101828') + ';">' + val + '</div></td>';
  let h = '';
  if (forPdf) h += '<html><head><meta charset="utf-8"><style>@page{size:A4 portrait;margin:12mm;} body{' + font + 'color:#101828;}</style></head><body>';
  h += '<div style="' + font + 'color:#101828;max-width:760px;">';
  h += '<div style="font-size:18px;font-weight:700;">รายงานอัตรากำลัง ' + esc_(rep.org) + '</div>';
  h += '<div style="font-size:14px;color:#475467;margin-bottom:12px;">ประจำ' + thDateLong_(rep.date) + '</div>';

  if (!rep.rows.length) {
    h += '<div style="padding:12px;border:1px solid #fec84b;background:#fffaeb;color:' + amber + ';border-radius:6px;font-size:14px;">ยังไม่มีการบันทึกอัตรากำลังของวันนี้</div>';
  } else {
    h += '<table role="presentation" cellspacing="6" style="border-collapse:separate;width:100%;margin-bottom:8px;"><tr>' +
      card('อัตราตามแผน', t.plan + ' คน') + card('มาปฏิบัติงาน', t.actual + ' คน') +
      card('ขาด', t.short + ' คน', t.short > 0 ? red : green) +
      card('ร้อยละอัตรากำลัง', t.pct === null ? '-' : t.pct + '%', t.pct !== null && t.pct < 90 ? red : green) +
      card('จุดที่ขาด', t.pointsShort + '/' + t.points, t.pointsShort > 0 ? red : green) + '</tr></table>';

    if (rep.byRoom.length) {
      h += '<div style="font-size:14px;font-weight:600;margin:10px 0 4px;">สรุปตามห้อง</div>';
      h += '<table style="border-collapse:collapse;width:100%;"><tr style="background:#f2f4f7;">' +
        ['ห้อง', 'แผน', 'มาจริง', 'ขาด'].map(x => '<th style="' + cell + 'text-align:left;">' + x + '</th>').join('') + '</tr>';
      rep.byRoom.forEach(r => {
        h += '<tr' + (r.short > 0 ? ' style="background:' + redBg + ';"' : '') + '><td style="' + cell + '">' + esc_(r.room) + '</td><td style="' + cell + '">' + r.plan +
          '</td><td style="' + cell + '">' + r.actual + '</td><td style="' + cell + (r.short > 0 ? 'color:' + red + ';font-weight:700;' : '') + '">' + (r.short > 0 ? r.short : '-') + '</td></tr>';
      });
      h += '</table>';
    }

    h += '<div style="font-size:14px;font-weight:600;margin:12px 0 4px;">รายละเอียดตามจุดปฏิบัติงาน</div>';
    h += '<table style="border-collapse:collapse;width:100%;"><tr style="background:#f2f4f7;">' +
      ['ช่วงเวลา', 'ห้อง', 'จุดปฏิบัติงาน', 'แผน', 'ปัจจุบัน', 'สถานะ', 'หมายเหตุ'].map(x => '<th style="' + cell + 'text-align:left;">' + x + '</th>').join('') + '</tr>';
    rep.rows.forEach(r => {
      const short = r.diff < 0;
      h += '<tr' + (short ? ' style="background:' + redBg + ';"' : '') + '>' +
        '<td style="' + cell + '">' + esc_(r.slot) + '</td><td style="' + cell + '">' + esc_(r.room) + '</td><td style="' + cell + '">' + esc_(r.point) +
        '</td><td style="' + cell + 'text-align:center;">' + r.plan + '</td><td style="' + cell + 'text-align:center;">' + r.actual +
        '</td><td style="' + cell + 'font-weight:600;color:' + (short ? red : r.diff > 0 ? amber : green) + ';">' + esc_(r.status) +
        '</td><td style="' + cell + '">' + esc_(r.note) + '</td></tr>';
    });
    h += '</table>';
  }

  if (rep.missing.length) {
    h += '<div style="margin-top:12px;padding:10px 12px;border:1px solid #fec84b;background:#fffaeb;border-radius:6px;font-size:13px;color:' + amber + ';">' +
      '<b>ยังไม่ได้บันทึก ' + rep.missing.length + ' จุด:</b> ' + rep.missing.map(m => esc_(m.point) + ' (' + esc_(m.slot) + ')').join(', ') + '</div>';
  }

  const rt = rep.rangeTotals;
  h += '<div style="font-size:14px;font-weight:600;margin:14px 0 4px;">ภาพรวม 30 วันย้อนหลัง (' + thDate_(rep.from) + ' – ' + thDate_(rep.date) + ')</div>';
  h += '<div style="font-size:13px;color:#344054;">บันทึกข้อมูล ' + rt.days + ' วัน · มีวันที่อัตรากำลังขาด ' + rt.daysWithShort + ' วัน · ขาดรวม ' + rt.short +
    ' คน-ครั้ง · ร้อยละอัตรากำลังเฉลี่ย ' + (rt.pct === null ? '-' : rt.pct + '%') + '</div>';
  if (rep.topShort.length) {
    h += '<table style="border-collapse:collapse;width:100%;margin-top:6px;"><tr style="background:#f2f4f7;">' +
      ['จุดที่ขาดบ่อย', 'จำนวนวันที่ขาด', 'ขาดรวม (คน)'].map(x => '<th style="' + cell + 'text-align:left;">' + x + '</th>').join('') + '</tr>';
    rep.topShort.slice(0, 5).forEach(s => {
      h += '<tr><td style="' + cell + '">' + esc_(s.point) + '</td><td style="' + cell + '">' + s.shortDays + ' / ' + s.days + '</td><td style="' + cell + '">' + s.short + '</td></tr>';
    });
    h += '</table>';
  }
  const url = webUrl_();
  if (!forPdf && url) h += '<div style="margin-top:14px;font-size:13px;"><a href="' + esc_(url) + '">เปิด Dashboard อัตรากำลัง</a></div>';
  h += '<div style="margin-top:12px;font-size:11px;color:#98a2b3;">สร้างอัตโนมัติจากระบบ' + esc_(APP_NAME) + ' เมื่อ ' +
    Utilities.formatDate(new Date(), TZ, 'dd/MM/') + (Number(Utilities.formatDate(new Date(), TZ, 'yyyy')) + 543) + ' ' + Utilities.formatDate(new Date(), TZ, 'HH:mm') + ' น.</div>';
  h += '</div>';
  if (forPdf) h += '</body></html>';
  return h;
}

function pdfBlob_(rep) {
  return Utilities.newBlob(reportHtml_(rep, true), 'text/html', 'report.html').getAs('application/pdf')
    .setName('staffing_' + isoBE_(rep.date) + '.pdf');
}
function getPdfBase64_(date) {
  const rep = buildDailyReport_(isYmd_(date) ? date : today_());
  const b = pdfBlob_(rep);
  return { name: b.getName(), base64: Utilities.base64Encode(b.getBytes()) };
}

function subject_(rep) {
  const t = rep.totals;
  let tag;
  if (!rep.rows.length) tag = 'ยังไม่มีข้อมูล';
  else if (t.short > 0) tag = 'ขาด ' + t.short + ' คน (' + t.pointsShort + ' จุด)';
  else tag = 'ครบตามแผน';
  if (rep.rows.length && rep.missing.length) tag += ' · ยังไม่บันทึก ' + rep.missing.length + ' จุด';
  return '[อัตรากำลัง] ' + thDate_(rep.date) + ' — ' + tag;
}

function sendReport_(date, to, label) {
  if (!to.length) throw new Error('ยังไม่มีผู้รับอีเมล กรุณาเพิ่มที่แท็บ "ผู้รับรายงาน"');
  const rep = buildDailyReport_(date);
  const opt = { to: to.join(','), subject: subject_(rep) + (label ? ' · ' + label : ''), htmlBody: reportHtml_(rep, false), name: APP_NAME };
  if (bool_(settings_().ATTACH_PDF)) {
    try { opt.attachments = [pdfBlob_(rep)]; } catch (e) { Logger.log('PDF: ' + e); }
  }
  MailApp.sendEmail(opt);
  return { to: to.length, subject: opt.subject, quotaLeft: MailApp.getRemainingDailyQuota() };
}

/** ฟังก์ชันที่ trigger เรียกทุกวัน */
function sendDailyReport() {
  const st = settings_();
  const dow = Number(Utilities.formatDate(new Date(), TZ, 'u')) % 7; // 1=จันทร์ ... 7=อาทิตย์ → 0
  const days = String(st.REPORT_DAYS || '').split(',').map(x => Number(String(x).trim()));
  if (days.indexOf(dow) < 0) return;
  const to = rows_(SH_().RECIP).filter(r => r[0] && bool_(r[2])).map(r => String(r[0]).trim());
  if (!to.length) { log_('system', 'report-skip', 'ไม่มีผู้รับ'); return; }
  try {
    const res = sendReport_(today_(), to);
    log_('system', 'report-sent', res);
  } catch (e) {
    log_('system', 'report-error', String(e));
    throw e;
  }
}

function sendTestReport_(user, p) {
  const date = isYmd_(p.date) ? p.date : today_();
  const to = p.toMe ? [Session.getEffectiveUser().getEmail()]
    : rows_(SH_().RECIP).filter(r => r[0] && bool_(r[2])).map(r => String(r[0]).trim());
  const res = sendReport_(date, to.filter(Boolean));
  log_(user.id, 'report-test', res);
  return res;
}

function installTrigger_(user) {
  const st = settings_();
  removeTrigger_(null);
  ScriptApp.newTrigger('sendDailyReport').timeBased().everyDays(1)
    .atHour(Number(st.REPORT_HOUR) || 0).nearMinute(Number(st.REPORT_MINUTE) || 0).inTimezone(TZ).create();
  if (user) log_(user.id, 'trigger-install', st.REPORT_HOUR + ':' + st.REPORT_MINUTE);
  return { hour: st.REPORT_HOUR, minute: st.REPORT_MINUTE };
}
function removeTrigger_(user) {
  let n = 0;
  ScriptApp.getProjectTriggers().forEach(t => { if (t.getHandlerFunction() === 'sendDailyReport') { ScriptApp.deleteTrigger(t); n++; } });
  if (user) log_(user.id, 'trigger-remove', n);
  return n;
}
