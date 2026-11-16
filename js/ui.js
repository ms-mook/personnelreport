/* ===== UiJS: ตัวช่วยหน้าตา — ไอคอน Lucide, banner/badge แบบ DaisyUI, แอนิเมชันตัวเลข ===== */
var REDUCED = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

/** ไอคอน Lucide: คืน <i data-lucide> แล้ว MutationObserver ด้านล่างจะแปลงเป็น SVG ให้เอง (ถ้า CDN โหลดไม่ได้ ก็แค่ไม่มีไอคอน) */
function icon(name, cls) { return '<i data-lucide="' + name + '" class="' + (cls || 'size-4') + '" aria-hidden="true"></i>'; }
(function () {
  var raf = 0;
  function run() { raf = 0; try { if (window.lucide && window.lucide.createIcons) window.lucide.createIcons(); } catch (e) { } }
  new MutationObserver(function () { if (!raf) raf = requestAnimationFrame(run); }).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('load', run);
})();

/** กล่องแจ้งเตือนในหน้า: type = info | warn | bad | ok (ใช้คลาส alert ของ DaisyUI + คงคลาส stf-banner เป็นตัวอ้างอิง) */
var BANNER_TYPES = { info: ['alert-info', 'info'], warn: ['alert-warning', 'triangle-alert'], bad: ['alert-error', 'circle-alert'], ok: ['alert-success', 'circle-check'] };
function banner(type, html, cls) {
  var b = BANNER_TYPES[type] || BANNER_TYPES.info;
  return '<div role="alert" class="alert alert-soft ' + b[0] + ' stf-banner ' + type + ' items-start text-sm ' + (cls || 'mb-3.5') + '">' +
    icon(b[1], 'size-5 shrink-0') + '<div class="min-w-0">' + html + '</div></div>';
}

/** ให้การ์ด/KPI ในพื้นที่ที่เพิ่งวาดใหม่ไหลขึ้นทีละใบ */
function animateIn(root) {
  if (REDUCED || !root) return;
  var i = 0;
  Array.prototype.forEach.call(root.querySelectorAll('.stf-kpi, .card, .alert'), function (el) {
    el.style.setProperty('--i', Math.min(i++, 9));
    el.classList.remove('m-fade-up'); void el.offsetWidth; el.classList.add('m-fade-up');
  });
}
/** ตัวเลขวิ่งขึ้น: องค์ประกอบที่มี data-count="ค่าปลายทาง" (รองรับทศนิยม 1 ตำแหน่ง) */
function countUp(root) {
  Array.prototype.forEach.call((root || document).querySelectorAll('[data-count]'), function (el) {
    var to = Number(el.getAttribute('data-count')); if (isNaN(to)) return;
    var dec = (String(el.getAttribute('data-count')).split('.')[1] || '').length;
    var fmt = function (v) { return dec ? v.toFixed(dec) : String(Math.round(v)); };
    if (REDUCED || to === 0) { el.textContent = fmt(to); return; }
    var t0 = null, dur = 650;
    var step = function (t) {
      if (t0 === null) t0 = t;
      var p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(to * e);
      if (p < 1) requestAnimationFrame(step); else el.textContent = fmt(to);
    };
    requestAnimationFrame(step);
  });
}
/** เปลี่ยนหน้า: เฟดเนื้อหาเข้า */
function viewIn() { var m = document.getElementById('main'); if (!m || REDUCED) return; m.classList.remove('m-view'); void m.offsetWidth; m.classList.add('m-view'); }
