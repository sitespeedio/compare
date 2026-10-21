/* exported generateVisualProgress */

/**
 * Draw the visual progress as inline SVG: a shaded range of all runs
 * and a strong line for the selected run of each side, and the
 * timeline cursor on top.
 *
 * @param {string} id container element id
 * @param {Object} opts
 * @param {number} opts.maxTime milliseconds on the x axis
 * @param {Array<{vp: Object<string, number>, selected: boolean}>} opts.runs1
 * @param {Array<{vp: Object<string, number>, selected: boolean}>} opts.runs2
 * @param {Array} [opts.markers1]
 * @param {Array} [opts.markers2]
 * @param {Array<{from: number, to: number}>} [opts.bands] time ranges (ms) to shade
 * @param {function(number)} [opts.onTime] called with the time (ms) under the pointer
 * @returns {{setCursor: function(number)}|null}
 */
function generateVisualProgress(id, opts) {
  const container = document.getElementById(id);
  if (!container) return null;
  container.innerHTML = '';

  const maxTime = Math.max(opts.maxTime, 1) / 1000;

  // Build de-duplicated stepped point lists; series end on (maxTime, 100)
  // so the visual progress line is anchored even when the last sample
  // was below 100%.
  function points(list) {
    let prev = -1;
    const out = [];
    Object.keys(list || {}).forEach(function (ms) {
      const v = list[ms];
      if (v !== prev) {
        prev = v;
        out.push({ x: Math.min(Number(ms) / 1000, maxTime), y: v });
      }
    });
    out.push({ x: maxTime, y: 100 });
    return out;
  }

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
  svg.setAttribute('aria-label', 'Visual progress of every run');

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
  function stepPath(pts) {
    if (!pts.length) return '';
    let d = 'M ' + x(pts[0].x) + ' ' + y(pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      d += ' H ' + x(pts[i].x) + ' V ' + y(pts[i].y);
    }
    return d;
  }

  // Shade where the two selected runs differ a lot, under the lines.
  const bands = (opts.bands || []).map(function (b) {
    const x1 = x(Math.min(b.from / 1000, maxTime));
    const x2 = x(Math.min(b.to / 1000, maxTime));
    return {
      from: b.from,
      to: b.to,
      el: add('rect', { class: 'vp-band', x: x1, y: y(100), width: Math.max(x2 - x1, 1), height: y(0) - y(100) })
    };
  });

  // One shaded range per side, from the slowest to the fastest run.
  // Separate lines per run cross and cover each other.
  function rangePath(runs) {
    const steps = runs.map(function (r) {
      return Object.keys(r.vp).map(function (ms) { return [Number(ms) / 1000, r.vp[ms]]; })
        .sort(function (a, b) { return a[0] - b[0]; });
    });
    const at = function (s, t) {
      let v = 0;
      s.forEach(function (p) { if (p[0] <= t) v = p[1]; });
      return v;
    };
    const times = [...new Set([].concat(...steps.map(function (s) { return s.map(function (p) { return p[0]; }); })))]
      .filter(function (t) { return t < maxTime; })
      .sort(function (a, b) { return a - b; });
    if (!times.length) return '';
    const hi = times.map(function (t) { return Math.max(...steps.map(function (s) { return at(s, t); })); });
    const lo = times.map(function (t) { return Math.min(...steps.map(function (s) { return at(s, t); })); });
    let d = 'M ' + x(times[0]) + ' ' + y(hi[0]);
    for (let i = 1; i < times.length; i++) d += ' H ' + x(times[i]) + ' V ' + y(hi[i]);
    d += ' H ' + x(maxTime) + ' V ' + y(lo[times.length - 1]);
    for (let i = times.length - 1; i > 0; i--) d += ' H ' + x(times[i]) + ' V ' + y(lo[i - 1]);
    return d + ' H ' + x(times[0]) + ' Z';
  }
  [[opts.runs1, 1], [opts.runs2, 2]].forEach(function (pair) {
    const runs = (pair[0] || []).filter(function (r) { return r.vp; });
    if (runs.length > 1) add('path', { class: 'vp-range vp-range--' + pair[1], d: rangePath(runs) });
  });
  [[opts.runs1, 1], [opts.runs2, 2]].forEach(function (pair) {
    (pair[0] || []).filter(function (r) { return r.selected; }).forEach(function (r) {
      add('path', { class: 'vp-series--' + pair[1], d: stepPath(points(r.vp)) });
    });
  });

  // Marker lines — vertical guides at FCP / LCP / FVC / Speed Index
  // for each HAR. Drawn under the series paths so the curves stay
  // dominant. Their names are on the timeline flags above the chart.
  function drawMarkers(markers, hark) {
    (markers || []).forEach(function (m) {
      const t = m.time / 1000;
      if (t > maxTime) return;
      const xv = x(t);
      add('line', {
        class: 'vp-marker vp-marker--' + hark + ' vp-marker--' + m.kind,
        x1: xv, x2: xv,
        y1: y(0), y2: y(100)
      });
    });
  }
  drawMarkers(opts.markers1, 1);
  drawMarkers(opts.markers2, 2);

  container.appendChild(svg);

  const cursor = document.createElement('div');
  cursor.className = 'vp-cursor';
  container.appendChild(cursor);

  if (opts.onTime) {
    const fromPointer = function (e) {
      const rect = svg.getBoundingClientRect();
      const xv = ((e.clientX - rect.left) / rect.width) * W;
      const t = Math.max(0, Math.min(maxTime, ((xv - padL) / plotW) * maxTime));
      opts.onTime(Math.round(t * 1000));
    };
    svg.addEventListener('pointermove', fromPointer);
    svg.addEventListener('pointerdown', fromPointer);
  }

  return {
    setCursor: function (ms) {
      cursor.style.left = ((x(Math.min(ms / 1000, maxTime)) / W) * 100).toFixed(3) + '%';
      bands.forEach(function (b) {
        b.el.classList.toggle('vp-band--active', ms >= b.from && ms < b.to);
      });
    }
  };
}
