// ===== ตัวกลางเรียก Apps Script (Vercel Serverless Function) =====
// หน้าเว็บเรียก POST /api/gas { action, token, payload } → ส่งต่อไปยัง Apps Script (doPost) → ส่งผลกลับ
// ตั้งค่าใน Vercel > Settings > Environment Variables:
//   GAS_URL        = URL /exec ของ Apps Script (Deploy > Manage deployments)   [จำเป็น]
//   GAS_PROXY_KEY  = ค่าเดียวกับ Script Property PROXY_KEY (จากฟังก์ชัน setupProxyKey) [แนะนำ]
// ข้อดี: หน้าเว็บไม่ติดปัญหา CORS ของ Apps Script และไม่ต้องเปิดเผย URL/กุญแจของ Apps Script ในหน้าเว็บ

const MAX_BODY = 200 * 1024; // คำขอจากหน้าเว็บไม่ควรเกิน 200 KB

function send(res, status, obj) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}

async function readBody(req) {
  if (req.body !== undefined && req.body !== null) {
    return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body;
  }
  const chunks = []; let size = 0;
  for await (const c of req) { size += c.length; if (size > MAX_BODY) throw new Error('TOO_LARGE'); chunks.push(c); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return send(res, 405, { ok: false, code: 'METHOD', message: 'ใช้ได้เฉพาะ POST' }); }
  const url = process.env.GAS_URL;
  if (!url || !/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(url)) {
    return send(res, 500, { ok: false, code: 'CONFIG', message: 'ยังไม่ได้ตั้งค่า GAS_URL บน Vercel (ต้องเป็นลิงก์ /exec ของ Apps Script)' });
  }
  let body;
  try { body = await readBody(req); } catch (e) {
    return send(res, e.message === 'TOO_LARGE' ? 413 : 400, { ok: false, code: 'BAD', message: 'ข้อมูลที่ส่งมาไม่ถูกต้อง' });
  }
  if (!body || typeof body.action !== 'string' || body.action.length > 40) return send(res, 400, { ok: false, code: 'BAD', message: 'คำสั่งไม่ถูกต้อง' });

  const forward = {
    action: body.action,
    token: typeof body.token === 'string' ? body.token : null,
    payload: body.payload && typeof body.payload === 'object' ? body.payload : {},
    key: process.env.GAS_PROXY_KEY || undefined
  };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 55000);
  try {
    // Apps Script ตอบ 302 ไปยัง googleusercontent — fetch ตาม redirect ให้อัตโนมัติ
    // ส่งเป็น text/plain เพื่อให้ e.postData.contents เป็น JSON ดิบ
    const r = await fetch(url, { method: 'POST', redirect: 'follow', signal: ctrl.signal,
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(forward) });
    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch (e) {
      const login = /accounts\.google\.com|ServiceLogin/i.test(text);
      return send(res, 502, { ok: false, code: 'UPSTREAM', message: login
        ? 'Apps Script ยังไม่เปิดให้ทุกคนเข้าถึง — ตั้ง Deploy เป็น "ทุกคน (Anyone)" แล้วลองใหม่'
        : 'Apps Script ตอบกลับไม่ถูกต้อง (HTTP ' + r.status + ') — ตรวจว่า Deploy เวอร์ชันล่าสุดที่มี doPost แล้ว' });
    }
    return send(res, 200, data);
  } catch (e) {
    return send(res, 504, { ok: false, code: 'TIMEOUT', message: e.name === 'AbortError'
      ? 'Apps Script ใช้เวลานานเกินไป กรุณาลองใหม่' : 'เชื่อมต่อ Apps Script ไม่ได้ กรุณาลองใหม่' });
  } finally { clearTimeout(timer); }
};
