/* ===== ChartsJS: กราฟทั้งหมดของ Dashboard (Chart.js) — แยกออกจากตรรกะหน้าเว็บ ===== */
function drawCharts(d) {
  if (typeof Chart === 'undefined') return;
  Chart.defaults.font.family = "'Sarabun', system-ui, sans-serif"; Chart.defaults.font.size = 12; Chart.defaults.color = '#475467';
  var grid = { color: '#eef0f3' }, noGrid = { display: false };
  var tip = { backgroundColor: '#101828', padding: 8, titleFont: { weight: '600' } };
  if ($('cRoom')) S.charts.room = new Chart($('cRoom'), {
    type: 'bar',
    data: { labels: d.byRoom.map(function (r) { return r.room; }),
      datasets: [{ label: 'ตามแผน', data: d.byRoom.map(function (r) { return r.plan; }), backgroundColor: '#c3c9d4', borderRadius: 4, maxBarThickness: 26 },
        { label: 'มาปฏิบัติงาน', data: d.byRoom.map(function (r) { return r.actual; }), backgroundColor: '#2a78d6', borderRadius: 4, maxBarThickness: 26 }] },
    options: { maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: tip }, scales: { x: { grid: noGrid }, y: { beginAtZero: true, grid: grid, ticks: { precision: 0 } } } }
  });
  var labels = d.trend.map(function (x) { return thShort(x.date); });
  var tTip = Object.assign({}, tip, { mode: 'index', intersect: false, callbacks: { title: function (it) { return thLong(d.trend[it[0].dataIndex].date); } } });
  if ($('cTrend')) S.charts.trend = new Chart($('cTrend'), {
    type: 'line',
    data: { labels: labels, datasets: [
      { label: 'ตามแผน', data: d.trend.map(function (x) { return x.plan; }), borderColor: '#667085', borderDash: [5, 4], borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: 0 },
      { label: 'มาปฏิบัติงาน', data: d.trend.map(function (x) { return x.actual; }), borderColor: '#2a78d6', backgroundColor: '#2a78d6', borderWidth: 2, pointRadius: d.trend.length > 45 ? 0 : 3, pointHoverRadius: 5, tension: 0 }] },
    options: { maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { display: false }, tooltip: tTip },
      scales: { x: { grid: noGrid, ticks: { maxTicksLimit: 10, maxRotation: 0 } }, y: { grid: grid, ticks: { precision: 0 } } } }
  });
  if ($('cShort')) S.charts.short = new Chart($('cShort'), {
    type: 'bar',
    data: { labels: labels, datasets: [{ label: 'ขาด (คน)', data: d.trend.map(function (x) { return x.short; }), backgroundColor: '#eb6834', borderRadius: 4, maxBarThickness: 18 }] },
    options: { maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: Object.assign({}, tTip, { callbacks: { title: tTip.callbacks.title, label: function (c) { var x = d.trend[c.dataIndex]; return ' ขาด ' + x.short + ' คน (' + x.pointsShort + ' จุด)'; } } }) },
      scales: { x: { grid: noGrid, ticks: { maxTicksLimit: 10, maxRotation: 0 } }, y: { beginAtZero: true, grid: grid, ticks: { precision: 0 } } } }
  });
  drawCharts2(d, grid, noGrid, tip, tTip, labels);
}
function drawCharts2(d, grid, noGrid, tip, tTip, labels) {
  var wd = d.byWeekday || [];
  if ($('cWeekday')) S.charts.weekday = new Chart($('cWeekday'), {
    type: 'bar',
    data: { labels: wd.map(function (w) { return w.name; }), datasets: [{ label: 'ขาดรวม (คน)', data: wd.map(function (w) { return w.short; }), backgroundColor: '#eb6834', borderRadius: 4, maxBarThickness: 44 }] },
    options: { maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: Object.assign({}, tip, { callbacks: { label: function (c) { var w = wd[c.dataIndex]; return [' ขาดรวม ' + w.short + ' คน', ' เฉลี่ย ' + w.avgShort + ' คน/วัน (' + w.days + ' วัน)']; } } }) },
      scales: { x: { grid: noGrid }, y: { beginAtZero: true, grid: grid, ticks: { precision: 0 } } } }
  });
  var pcts = d.trend.map(function (x) { return x.pct; });
  var minP = Math.min.apply(null, pcts.filter(function (v) { return v !== null; }).concat([100]));
  if ($('cPct')) S.charts.pct = new Chart($('cPct'), {
    type: 'line',
    data: { labels: labels, datasets: [
      { label: 'ร้อยละอัตรากำลัง', data: pcts, borderColor: '#2a78d6', backgroundColor: '#2a78d6', borderWidth: 2, pointRadius: d.trend.length > 45 ? 0 : 3, pointHoverRadius: 5, tension: 0 },
      { label: '100%', data: pcts.map(function () { return 100; }), borderColor: '#667085', borderDash: [5, 4], borderWidth: 1.5, pointRadius: 0, pointHoverRadius: 0, tension: 0 }] },
    options: { maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
      plugins: { legend: { display: false }, tooltip: Object.assign({}, tTip, { filter: function (it) { return it.datasetIndex === 0; }, callbacks: { title: tTip.callbacks.title, label: function (c) { var x = d.trend[c.dataIndex]; return ' ' + (x.pct === null ? '–' : x.pct + '%') + ' (' + x.actual + ' จาก ' + x.plan + ' คน)'; } } }) },
      scales: { x: { grid: noGrid, ticks: { maxTicksLimit: 10, maxRotation: 0 } }, y: { grid: grid, min: Math.max(0, Math.floor(minP / 10) * 10 - 10), max: Math.max(105, Math.ceil(Math.max.apply(null, pcts.filter(function (v) { return v !== null; }).concat([100])) / 5) * 5), ticks: { callback: function (v) { return v + '%'; } } } } }
  });
}
