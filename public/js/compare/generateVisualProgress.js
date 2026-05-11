/* exported generateVisualProgress */

/**
 * Draw two visual-progress curves as inline SVG into #<id>. Mirrors
 * the approach used by sitespeed.io's visualProgress.pug — a stepped
 * line per series, light grid + axis labels, no external chart lib.
 *
 * @param {Object<string, number>} visualProgress1 milliseconds -> percent
 * @param {Object<string, number>} visualProgress2 milliseconds -> percent
 * @param {string} id container element id
 */
function generateVisualProgress(visualProgress1, visualProgress2, id) {
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
  if (maxTime <= 0) maxTime = 1;
  series.forEach(function(s) { s.push({ x: maxTime, y: 100 }); });

  // Viewbox in "data units" — we draw in time-on-X (0..maxTime) and
  // percent-on-Y (0..100) and rely on the SVG viewBox + width:100% in
  // CSS to scale the chart to its container. preserveAspectRatio
  // 'none' lets the axes stretch independently so wide cards still
  // give us a readable time axis.
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
    add('line', {
      class: 'vp-grid',
      x1: padL, x2: W - padR, y1: y(p), y2: y(p)
    });
    add('text', {
      class: 'vp-tick-label',
      x: padL - 6, y: y(p) + 4, 'text-anchor': 'end'
    }, p + '%');
  });

  // X-axis baseline + time ticks (every 1s when range allows, otherwise
  // five evenly-spaced ticks so the axis is always readable).
  add('line', {
    class: 'vp-baseline',
    x1: padL, x2: W - padR, y1: y(0), y2: y(0)
  });
  const tickCount = maxTime >= 5 ? Math.min(Math.ceil(maxTime), 8) : 5;
  for (let i = 0; i <= tickCount; i++) {
    const t = (i / tickCount) * maxTime;
    add('text', {
      class: 'vp-tick-label',
      x: x(t), y: H - padB + 16, 'text-anchor': 'middle'
    }, t.toFixed(t >= 10 ? 0 : 1) + 's');
  }

  // Axis title — placed at the bottom centre of the plot area.
  add('text', {
    class: 'vp-axis-label',
    x: padL + plotW / 2, y: H - 4, 'text-anchor': 'middle'
  }, 'Time (seconds)');

  // Series — stepped horizontal-then-vertical between consecutive
  // samples, matching the chartist step interpolation it replaces.
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
}
