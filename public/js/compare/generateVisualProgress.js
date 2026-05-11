/* exported generateVisualProgress */

/**
 * Draw two visual-progress curves as inline SVG, with an optional
 * pair of thumbnail strips below aligned to the same time axis.
 *
 * @param {Object<string, number>} visualProgress1 milliseconds -> percent
 * @param {Object<string, number>} visualProgress2 milliseconds -> percent
 * @param {string} id container element id
 * @param {Object} [opts]
 * @param {Array<{time:string,img:string}>} [opts.thumbnails1]
 * @param {Array<{time:string,img:string}>} [opts.thumbnails2]
 * @param {string} [opts.label1]
 * @param {string} [opts.label2]
 */
function generateVisualProgress(visualProgress1, visualProgress2, id, opts) {
  opts = opts || {};
  const container = document.getElementById(id);
  if (!container) return;
  container.innerHTML = '';

  // Build de-duplicated stepped point lists; series end on (maxTime, 100)
  // so the visual progress line is anchored even when the last sample
  // was below 100%.
  let maxTime = 0;
  const series = [visualProgress1, visualProgress2].map(function(list) {
    let prev = -1;
    const points = [];
    Object.keys(list || {}).forEach(function(ms) {
      const v = list[ms];
      if (v !== prev) {
        prev = v;
        const t = Number(ms) / 1000;
        if (t > maxTime) maxTime = t;
        points.push({ x: t, y: v });
      }
    });
    return points;
  });

  // Extend maxTime so the last thumbnail still fits on the axis.
  function tMax(arr, key) {
    if (!arr || !arr.length) return 0;
    return Math.max.apply(null, arr.map(function (a) { return Number(a[key]) || 0; }));
  }
  maxTime = Math.max(
    maxTime,
    tMax(opts.thumbnails1, 'time'),
    tMax(opts.thumbnails2, 'time')
  );
  if (maxTime <= 0) maxTime = 1;
  series.forEach(function(s) { s.push({ x: maxTime, y: 100 }); });

  // Viewbox in "data units" — we draw in time-on-X (0..maxTime) and
  // percent-on-Y (0..100) and rely on the SVG viewBox + width:100% in
  // CSS to scale the chart to its container.
  const W = 1000;
  const H = 240;
  const padL = 40;
  const padR = 12;
  const padT = 8;
  const padB = 28;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  function x(t) { return padL + (t / maxTime) * plotW; }
  function y(p) { return padT + (1 - p / 100) * plotH; }

  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Visual progress comparison');

  function add(tag, attrs, text) {
    const el = document.createElementNS(ns, tag);
    Object.keys(attrs).forEach(function(k) { el.setAttribute(k, attrs[k]); });
    if (text != null) el.textContent = text;
    svg.appendChild(el);
    return el;
  }

  // Y-axis gridlines + percent labels at 0/25/50/75/100.
  [0, 25, 50, 75, 100].forEach(function(p) {
    add('line', { class: 'vp-grid', x1: padL, x2: W - padR, y1: y(p), y2: y(p) });
    add('text', { class: 'vp-tick-label', x: padL - 6, y: y(p) + 4, 'text-anchor': 'end' }, p + '%');
  });

  // X-axis baseline + time ticks.
  add('line', { class: 'vp-baseline', x1: padL, x2: W - padR, y1: y(0), y2: y(0) });
  const tickCount = maxTime >= 5 ? Math.min(Math.ceil(maxTime), 8) : 5;
  for (let i = 0; i <= tickCount; i++) {
    const t = (i / tickCount) * maxTime;
    add('text', { class: 'vp-tick-label', x: x(t), y: H - padB + 16, 'text-anchor': 'middle' },
        t.toFixed(t >= 10 ? 0 : 1) + 's');
  }
  add('text', { class: 'vp-axis-label', x: padL + plotW / 2, y: H - 4, 'text-anchor': 'middle' },
      'Time (seconds)');

  // Stepped path between consecutive samples.
  function stepPath(points) {
    if (!points.length) return '';
    let d = 'M ' + x(points[0].x) + ' ' + y(points[0].y);
    for (let i = 1; i < points.length; i++) {
      d += ' H ' + x(points[i].x) + ' V ' + y(points[i].y);
    }
    return d;
  }

  add('path', { class: 'vp-series--1', d: stepPath(series[0]) });
  add('path', { class: 'vp-series--2', d: stepPath(series[1]) });

  container.appendChild(svg);

  // Thumbnail strips below the chart, aligned to the same time axis
  // as the SVG. Each strip is a relative-positioned row; each thumb
  // is absolutely positioned at its time's X percentage so they line
  // up visually with the curve and markers above.
  function thumbStrip(label, frames) {
    if (!frames || !frames.length) return null;
    const row = document.createElement('div');
    row.className = 'vp-thumb-row';
    if (label) {
      const lab = document.createElement('span');
      lab.className = 'vp-thumb-label';
      lab.textContent = label;
      row.appendChild(lab);
    }
    const rail = document.createElement('div');
    rail.className = 'vp-thumb-rail';
    frames.forEach(function (f) {
      const t = Number(f.time);
      // Express the X position as a percentage of container width that
      // matches the SVG's viewBox X coordinate at this time.
      const xv = padL + (t / maxTime) * plotW;
      const leftPct = (xv / W) * 100;
      const wrap = document.createElement('div');
      wrap.className = 'vp-thumb';
      wrap.style.left = leftPct.toFixed(2) + '%';
      wrap.innerHTML =
        '<a href="' + escapeAttr(f.img) + '" target="_blank" rel="noopener">' +
          '<img src="' + escapeAttr(f.img) + '" alt="" loading="lazy" decoding="async">' +
        '</a>' +
        '<span class="vp-thumb-time">' + (typeof f.time === 'number' ? f.time.toFixed(1) : f.time) + 's</span>';
      rail.appendChild(wrap);
    });
    row.appendChild(rail);
    return row;
  }

  function escapeAttr(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
      .replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  const row1 = thumbStrip(opts.label1, opts.thumbnails1);
  const row2 = thumbStrip(opts.label2, opts.thumbnails2);
  if (row1) container.appendChild(row1);
  if (row2) container.appendChild(row2);
}
