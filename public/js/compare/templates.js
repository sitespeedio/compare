/* global formatBytes, formatTime, formatDate, formatURL */
/* exported parseTemplate, registerTemplateHelpers */

//
// Templates. Replaces the Template7 setup that used to live here —
// each template is now a plain JS function that returns an HTML
// string built with template literals.
//
// parseTemplate(templateId, data, divId) is the public entry point;
// callers in generate.js stay unchanged. registerTemplateHelpers is
// kept as a no-op so the existing call site doesn't need touching.
//

// HTML-escape user-supplied or pulled-from-HAR strings.
function h(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Iterate over an array or object's values, mapping each entry to an
// HTML chunk and concatenating the results.
function each(collection, fn) {
  if (!collection) return '';
  if (Array.isArray(collection)) {
    return collection.map(fn).join('');
  }
  return Object.keys(collection)
    .map(function (key) { return fn(collection[key], key); })
    .join('');
}

// Safe property lookup for nested keys that might be missing on
// either of the two HARs (e.g. p2.firstParty.contentTypes['css'] may
// be undefined if HAR2 has no CSS at all).
function getValue(obj, key, name) {
  if (!obj || !obj[key]) return 0;
  return obj[key][name] != null ? obj[key][name] : 0;
}

//
// visualProgressTemplate
//
function visualProgressTemplate(d) {
  return (
    '<h3 id="visualProgressHeader">Visual Progress</h3>' +
    '<div id="comment-visualProgress" class="comment"></div>' +
    '<div id="visualProgress" class="vp-chart"></div>' +
    '<div id="visualProgressLegendHolder">' +
      '<ul class="resource-legend">' +
        '<li class="legend-url1" title="' + h(d.p1.url) + '">' + h(d.config.har1.label) + '</li>' +
        '<li class="legend-url2" title="' + h(d.p2.url) + '">' + h(d.config.har2.label) + '</li>' +
      '</ul>' +
    '</div>'
  );
}

//
// pageXrayTemplate
//
function pageXrayTemplate(d) {
  const p1 = d.p1, p2 = d.p2, config = d.config;
  const showRuns = d.runs1.length > 1 || d.runs2.length > 1;

  function section(title, kind) {
    const cls = 'pageXraySection' + (kind ? ' pageXraySection--' + kind : '');
    return '<tr class="' + cls + '"><th colspan="4">' + h(title) + '</th></tr>';
  }

  // Compute a Δ cell for a numeric metric. Every metric in this table
  // is "lower is better" (request count, byte size, paint timing, CLS,
  // long-task count), so a positive HAR2−HAR1 delta is a regression
  // and renders in error red; a negative delta is an improvement and
  // renders in success green. Non-numeric inputs produce an empty cell.
  function diffCell(a, b, formatter) {
    if (typeof a !== 'number' || typeof b !== 'number' ||
        !isFinite(a) || !isFinite(b)) {
      return '<td class="pageXrayDiff"></td>';
    }
    const delta = b - a;
    if (Math.abs(delta) < 1e-4) {
      return '<td class="pageXrayDiff pageXrayDiff--same">no change</td>';
    }
    const cls = delta > 0 ? 'pageXrayDiff--worse' : 'pageXrayDiff--better';
    const sign = delta > 0 ? '+' : '−';
    const absDelta = Math.abs(delta);
    const value = formatter ? formatter(absDelta) : absDelta.toString();
    let pctStr = '';
    if (a !== 0) {
      const pct = Math.round((delta / a) * 100);
      pctStr = ' <span class="pageXrayDiff-pct">(' +
               (pct > 0 ? '+' : (pct < 0 ? '−' : '')) +
               Math.abs(pct) + '%)</span>';
    }
    return '<td class="pageXrayDiff ' + cls + '">' + sign + value + pctStr + '</td>';
  }

  // CLS is a unitless float; browsers report it at full precision
  // (e.g. 0.05641193152186011). Three decimals is the granularity that
  // matters for comparison and matches the sitespeed.io HTML report.
  function fmtCLS(v) {
    return typeof v === 'number' ? v.toFixed(3) : (v == null ? '' : v);
  }

  // Empty Δ cell — for rows where a delta wouldn't make sense
  // (URLs, dates, captures).
  const emptyDiff = '<td class="pageXrayDiff"></td>';

  // "Only show differences" toggle — read the user's last choice from
  // localStorage so the preference survives reload. The button itself
  // is rendered below; this just controls the initial class on the
  // table so the page renders in the desired state without a flash.
  const diffOnlyOn = (function () {
    try { return localStorage.getItem('compare.diffOnly') === '1'; }
    catch (e) { return false; }
  })();
  const diffOnlyClass = diffOnlyOn ? ' pageXrayTable--diff-only' : '';
  const diffOnlyPressed = diffOnlyOn ? 'true' : 'false';

  let html = '';
  html += '<div><table class="pageXrayTable' + diffOnlyClass + '">';
  // Visually-hidden caption — useful for screen readers and gives the
  // table a programmatic name without taking up real estate.
  html += '<caption class="sr-only">Page X-ray comparison: ' +
          h(config.har1.label) + ' versus ' + h(config.har2.label) + '</caption>';
  html += '<thead><tr>';
  html += '<th class="tabletext tableXrayMetric" scope="col">' +
            '<div class="tableXrayMetric-stack">' +
              '<span class="tableXrayMetric-label">Metric</span>' +
              '<span class="tableXrayMetric-actions">' +
                '<button onclick="regenerate(true);" class="submit submit-smaller" ' +
                        'aria-label="Swap HAR1 and HAR2">Switch</button>' +
                '<button id="diffOnlyToggle" type="button" ' +
                        'onclick="toggleDiffOnly(this);" ' +
                        'class="chip-toggle" ' +
                        'aria-pressed="' + diffOnlyPressed + '">' +
                  'Only differences</button>' +
              '</span>' +
            '</div></th>';
  html += '<th class="tableXrayHarMetric" scope="col">' + h(config.har1.label) +
            '<input type="file" id="har1upload" class="inputfile"/>' +
            '<label for="har1upload">Upload</label></th>';
  html += '<th class="tableXrayHar2Metric" scope="col"> ' + h(config.har2.label) +
            '<input type="file" id="har2upload" class="inputfile"/>' +
            '<label for="har2upload">Upload</label></th>';
  html += '<th class="tableXrayDiff" scope="col" ' +
              'title="HAR2 minus HAR1 — green = improvement, red = regression">Δ</th>';
  html += '</tr></thead><tbody>';

  // Setup (top of the table — first rows after the header, no section
  // title because there's no group above it to separate from).
  if (showRuns) {
    html += '<tr><td class="tabletext">Run</td><td>';
    if (d.runs1.length > 1) {
      html += '<select name="runs1" onchange="regenerate();" id="run1Option">';
      html += each(d.runs1, function (r) {
        return '<option value="' + h(r.id) + '"' + (r.selected ? ' selected' : '') + '>' + h(r.show) + '</option>';
      });
      html += '</select>';
    }
    html += '</td><td>';
    if (d.runs2.length > 1) {
      html += '<select name="runs2" onchange="regenerate();" id="run2Option">';
      html += each(d.runs2, function (r) {
        return '<option value="' + h(r.id) + '"' + (r.selected ? ' selected' : '') + '>' + h(r.show) + '</option>';
      });
      html += '</select>';
    }
    html += '</td>' + emptyDiff + '</tr>';
  }

  html += '<tr><td class="tabletext">URL</td>' +
          '<td><a href="' + h(p1.url) + '" title="' + h(p1.meta.title) + '">' + h(p1.url) + '</a></td>' +
          '<td><a href="' + h(p2.url) + '" title="' + h(p2.meta.title) + '">' + h(p2.url) + '</a></td>' +
          emptyDiff + '</tr>';

  html += '<tr><td class="tabletext">Date</td>' +
          '<td>' + h(formatDate(p1.meta.startedDateTime)) + '</td>' +
          '<td>' + h(formatDate(p2.meta.startedDateTime)) + '</td>' +
          emptyDiff + '</tr>';

  html += '<tr><td class="tabletext">Browser</td>' +
          '<td>' + (p1.meta.browser ? h(p1.meta.browser.name) + ' ' + h(p1.meta.browser.version) : '') + '</td>' +
          '<td>' + (p2.meta.browser ? h(p2.meta.browser.name) + ' ' + h(p2.meta.browser.version) : '') + '</td>' +
          emptyDiff + '</tr>';

  if (p1.meta.connectivity && p2.meta.connectivity) {
    html += '<tr><td class="tabletext">Connectivity</td>' +
            '<td>' + h(p1.meta.connectivity) + '</td>' +
            '<td>' + h(p2.meta.connectivity) + '</td>' +
            emptyDiff + '</tr>';
  }

  html += section('Content', 'content');
  html += '<tr><td class="tabletext">Total</td>' +
          '<td>' + p1.requests + ' (' + formatBytes(p1.transferSize) + ' / ' + formatBytes(p1.contentSize) + ')</td>' +
          '<td>' + p2.requests + ' (' + formatBytes(p2.transferSize) + ' / ' + formatBytes(p2.contentSize) + ')</td>' +
          diffCell(p1.transferSize, p2.transferSize, formatBytes) + '</tr>';

  ['html', 'css', 'javascript'].forEach(function (kind) {
    const label = { html: 'HTML', css: 'CSS', javascript: 'JavaScript' }[kind];
    const a = p1.contentTypes[kind] || { requests: 0, transferSize: 0, contentSize: 0 };
    const b = p2.contentTypes[kind] || { requests: 0, transferSize: 0, contentSize: 0 };
    html += '<tr><td class="tabletext">' + label + '</td>' +
            '<td>' + a.requests + ' (' + formatBytes(a.transferSize) + ' / ' + formatBytes(a.contentSize) + ')</td>' +
            '<td>' + b.requests + ' (' + formatBytes(b.transferSize) + ' / ' + formatBytes(b.contentSize) + ')</td>' +
            diffCell(a.transferSize, b.transferSize, formatBytes) + '</tr>';
  });

  const img1 = p1.contentTypes.image || { requests: 0, transferSize: 0 };
  const img2 = p2.contentTypes.image || { requests: 0, transferSize: 0 };
  html += '<tr><td class="tabletext">Image</td>' +
          '<td>' + img1.requests + ' (' + formatBytes(img1.transferSize) + ')</td>' +
          '<td>' + img2.requests + ' (' + formatBytes(img2.transferSize) + ')</td>' +
          diffCell(img1.transferSize, img2.transferSize, formatBytes) + '</tr>';

  if (p1.renderBlocking && p2.renderBlocking) {
    html += section('Render blocking', 'blocking');
    html += '<tr><td class="tabletext">Render blocking</td>' +
            '<td>' + p1.renderBlocking.blocking + '</td>' +
            '<td>' + p2.renderBlocking.blocking + '</td>' +
            diffCell(p1.renderBlocking.blocking, p2.renderBlocking.blocking) + '</tr>';
    html += '<tr><td class="tabletext">Potentially blocking</td>' +
            '<td>' + p1.renderBlocking.potentiallyBlocking + '</td>' +
            '<td>' + p2.renderBlocking.potentiallyBlocking + '</td>' +
            diffCell(p1.renderBlocking.potentiallyBlocking, p2.renderBlocking.potentiallyBlocking) + '</tr>';
    html += '<tr><td class="tabletext">In body parser blocking</td>' +
            '<td>' + p1.renderBlocking.in_body_parser_blocking + '</td>' +
            '<td>' + p2.renderBlocking.in_body_parser_blocking + '</td>' +
            diffCell(p1.renderBlocking.in_body_parser_blocking, p2.renderBlocking.in_body_parser_blocking) + '</tr>';
  }

  if (p1.visualMetrics) {
    // Only render rows where both HARs have the value.
    const vmRows = [
      ['First Visual Change', 'FirstVisualChange'],
      ['Largest Image',       'LargestImage'],
      ['Logo',                'Logo'],
      ['Heading',             'Heading'],
      ['Speed Index',         'SpeedIndex'],
      ['Last Visual Change',  'LastVisualChange'],
      ['Visual Readiness',    'VisualReadiness']
    ];
    let vmHtml = '';
    vmRows.forEach(function (row) {
      const label = row[0], key = row[1];
      if (p1.visualMetrics[key] && p2.visualMetrics && p2.visualMetrics[key]) {
        vmHtml += '<tr><td class="tabletext">' + label + '</td>' +
                  '<td>' + formatTime(p1.visualMetrics[key]) + '</td>' +
                  '<td>' + formatTime(p2.visualMetrics[key]) + '</td>' +
                  diffCell(p1.visualMetrics[key], p2.visualMetrics[key], formatTime) + '</tr>';
      }
    });
    if (vmHtml) html += section('Visual metrics', 'visual') + vmHtml;
  }

  if (p1.googleWebVitals && p2.googleWebVitals) {
    html += section('Core Web Vitals', 'cwv');
    html += '<tr><td class="tabletext">First Contentful Paint</td>' +
            '<td>' + formatTime(p1.googleWebVitals.firstContentfulPaint) + '</td>' +
            '<td>' + formatTime(p2.googleWebVitals.firstContentfulPaint) + '</td>' +
            diffCell(p1.googleWebVitals.firstContentfulPaint, p2.googleWebVitals.firstContentfulPaint, formatTime) + '</tr>';
    html += '<tr><td class="tabletext">Largest Contentful Paint</td>' +
            '<td>' + formatTime(p1.googleWebVitals.largestContentfulPaint) + '</td>' +
            '<td>' + formatTime(p2.googleWebVitals.largestContentfulPaint) + '</td>' +
            diffCell(p1.googleWebVitals.largestContentfulPaint, p2.googleWebVitals.largestContentfulPaint, formatTime) + '</tr>';
    html += '<tr><td class="tabletext">Total Blocking Time</td>' +
            '<td>' + formatTime(p1.googleWebVitals.totalBlockingTime) + '</td>' +
            '<td>' + formatTime(p2.googleWebVitals.totalBlockingTime) + '</td>' +
            diffCell(p1.googleWebVitals.totalBlockingTime, p2.googleWebVitals.totalBlockingTime, formatTime) + '</tr>';
    html += '<tr><td class="tabletext">Cumulative Layout Shift</td>' +
            '<td>' + fmtCLS(p1.googleWebVitals.cumulativeLayoutShift) + '</td>' +
            '<td>' + fmtCLS(p2.googleWebVitals.cumulativeLayoutShift) + '</td>' +
            diffCell(p1.googleWebVitals.cumulativeLayoutShift, p2.googleWebVitals.cumulativeLayoutShift, function (n) { return n.toFixed(3); }) + '</tr>';
  }

  // Long-task block — sitespeed.io HARs that ran Lighthouse get
  // these; older / WPT-style HARs don't, so the block stays silent.
  let cpuHtml = '';
  let cpuSectionEmitted = false;
  function ensureCpuSection() {
    if (!cpuSectionEmitted) {
      html += section('CPU', 'cpu');
      cpuSectionEmitted = true;
    }
  }
  if (p1.cpu && p2.cpu && p1.cpu.longTasks && p2.cpu.longTasks) {
    if (p1.cpu.longTasks.totalBlockingTime && p2.cpu.longTasks.totalBlockingTime) {
      cpuHtml += '<tr><td class="tabletext">Total Blocking Time</td>' +
                 '<td>' + formatTime(p1.cpu.longTasks.totalBlockingTime) + '</td>' +
                 '<td>' + formatTime(p2.cpu.longTasks.totalBlockingTime) + '</td>' +
                 diffCell(p1.cpu.longTasks.totalBlockingTime, p2.cpu.longTasks.totalBlockingTime, formatTime) + '</tr>';
    }
    if (p1.cpu.longTasks.maxPotentialFid && p2.cpu.longTasks.maxPotentialFid) {
      cpuHtml += '<tr><td class="tabletext">Max Potential FID</td>' +
                 '<td>' + formatTime(p1.cpu.longTasks.maxPotentialFid) + '</td>' +
                 '<td>' + formatTime(p2.cpu.longTasks.maxPotentialFid) + '</td>' +
                 diffCell(p1.cpu.longTasks.maxPotentialFid, p2.cpu.longTasks.maxPotentialFid, formatTime) + '</tr>';
    }
    if (p1.cpu.longTasks.tasks && p2.cpu.longTasks.tasks) {
      cpuHtml += '<tr><td class="tabletext">Total CPU Long Tasks</td>' +
                 '<td>' + p1.cpu.longTasks.tasks + '</td>' +
                 '<td>' + p2.cpu.longTasks.tasks + '</td>' +
                 diffCell(p1.cpu.longTasks.tasks, p2.cpu.longTasks.tasks) + '</tr>';
    }
    if (cpuHtml) {
      ensureCpuSection();
      html += cpuHtml;
      cpuHtml = '';
    }
  }


  // Sub-table for the CPU disclosure rows. The two HARs may report
  // different sets of categories/events, so we union the names and
  // render one row per name with HAR1 / HAR2 / Δ — same red-green
  // pattern as the parent table, so a regression in scripting time is
  // visible at the same glance as a regression in total bytes.
  function cpuBreakdownTable(list1, list2, formatter, eventLabel) {
    const map1 = {}, map2 = {};
    (list1 || []).forEach(function (e) { map1[e.name] = e.value; });
    (list2 || []).forEach(function (e) { map2[e.name] = e.value; });
    const names = Object.keys(Object.assign({}, map1, map2)).sort();
    let body = '';
    names.forEach(function (name) {
      const v1 = map1[name];
      const v2 = map2[name];
      body += '<tr>' +
        '<td class="tabletext">' + h(name) + '</td>' +
        '<td>' + (v1 == null ? '<span class="muted">—</span>' : h(formatter(v1))) + '</td>' +
        '<td>' + (v2 == null ? '<span class="muted">—</span>' : h(formatter(v2))) + '</td>' +
        diffCell(v1, v2, formatter) +
        '</tr>';
    });
    return '<table class="cpuBreakdownTable"><thead><tr>' +
             '<th scope="col">' + h(eventLabel) + '</th>' +
             '<th scope="col">' + h(config.har1.label) + '</th>' +
             '<th scope="col">' + h(config.har2.label) + '</th>' +
             '<th scope="col" title="HAR2 minus HAR1">Δ</th>' +
           '</tr></thead><tbody>' + body + '</tbody></table>';
  }

  function fmtCategoryValue(v) {
    return typeof v === 'number' ? formatTime(v) : (v == null ? '' : String(v));
  }
  function fmtEventValue(v) {
    return typeof v === 'number' ? v.toFixed(3) : (v == null ? '' : String(v));
  }

  if (d.cpuCategories1 && d.cpuCategories2) {
    ensureCpuSection();
    html += '<tr><td class="tabletext" colspan="4"> CPU time spent by category ' +
              '<button onclick="toggleRow(this, \'cpuCategoryInfo\', this.childNodes[0]);" class="submit submit-smaller" ' +
                      'aria-label="Show CPU category breakdown">' +
                '<i class="arrow right"></i></button></td></tr>';
    html += '<tr class="userShowable cpuCategoryInfo"><td colspan="4" class="cpuBreakdownCell">' +
              cpuBreakdownTable(d.cpuCategories1, d.cpuCategories2, fmtCategoryValue, 'Category') +
            '</td></tr>';
    html += '<tr><td class="tabletext" colspan="4">CPU Events ' +
              '<button onclick="toggleRow(this, \'cpuExtraInfo\', this.childNodes[0]);" class="submit submit-smaller" ' +
                      'aria-label="Show CPU event breakdown">' +
                '<i class="arrow right"></i></button></td></tr>';
    html += '<tr class="userShowable cpuExtraInfo"><td colspan="4" class="cpuBreakdownCell">' +
              cpuBreakdownTable(d.cpuEvents1, d.cpuEvents2, fmtEventValue, 'Event') +
            '</td></tr>';
  }

  // Captures — final screenshot, video, link back to the per-run
  // result page. Last group because the values are large media
  // elements, not numbers; pushing them to the bottom keeps the
  // scannable metric rows above contiguous. Screenshots and videos
  // get a CSS-sized treatment via .pageXrayCapture so the regression
  // spotter has room to actually see the difference.
  let capturesHtml = '';
  if (p1.meta.screenshot && p2.meta.screenshot) {
    capturesHtml += '<tr><td class="tabletext">Screenshot</td>' +
            '<td><button type="button" class="lightbox-trigger" aria-label="Open larger screenshot of ' + h(config.har1.label) + '">' +
              '<img class="pageXrayCapture" src="' + h(p1.meta.screenshot) +
              '" alt="Final screenshot of ' + h(config.har1.label) + '" loading="lazy"></button></td>' +
            '<td><button type="button" class="lightbox-trigger" aria-label="Open larger screenshot of ' + h(config.har2.label) + '">' +
              '<img class="pageXrayCapture" src="' + h(p2.meta.screenshot) +
              '" alt="Final screenshot of ' + h(config.har2.label) + '" loading="lazy"></button></td>' +
            emptyDiff + '</tr>';
  }
  if (p1.meta.video && p2.meta.video) {
    capturesHtml += '<tr><td class="tabletext">Video</td>' +
            '<td><video class="pageXrayCapture" controls preload="none" poster="' + h(p1.meta.screenshot) + '">' +
              '<source src="' + h(p1.meta.video) + '" type="video/mp4"></video></td>' +
            '<td><video class="pageXrayCapture" controls preload="none" poster="' + h(p2.meta.screenshot) + '">' +
              '<source src="' + h(p2.meta.video) + '" type="video/mp4"></video></td>' +
            emptyDiff + '</tr>';
  }
  if (p1.meta.result && p2.meta.result) {
    capturesHtml += '<tr><td class="tabletext">Extra</td>' +
            '<td><a href="' + h(p1.meta.result) + '" target="_blank" rel="noopener noreferrer">Result page</a></td>' +
            '<td><a href="' + h(p2.meta.result) + '" target="_blank" rel="noopener noreferrer">Result page</a></td>' +
            emptyDiff + '</tr>';
  }
  if (capturesHtml) html += section('Captures', 'captures') + capturesHtml;

  html += '</tbody></table></div>';
  return html;
}

//
// filmstripTemplate — one rail of *columns*, each column representing
// the same timestamp in both HARs (HAR1 cell on top, HAR2 below,
// shared timestamp underneath). The two padded frame arrays come in
// the same length and grid step from getFilmstrip(), so iterating by
// index lines them up cell-for-cell.
//
// Columns where the two HARs disagree on visual progress are tinted
// red/amber so a regression like "HAR2 was still blank at 800 ms"
// shows up before the user has to actually look at the pixels.
//
function filmstripTemplate(d) {
  const config = d.config;
  const fs1 = (d.filmstrip && d.filmstrip.frames1) || [];
  const fs2 = (d.filmstrip && d.filmstrip.frames2) || [];

  if (fs1.length === 0 && fs2.length === 0) {
    return '<h3 id="filmstripHeader" class="card-title">Filmstrip</h3>' +
           '<p class="muted">No filmstrip data available.</p>';
  }

  // Both arrays have the same length and grid step after padFrames(),
  // but guard the lookup so a one-sided strip still renders.
  const cells = Math.max(fs1.length, fs2.length);

  function cellHtml(f, label, time, hark) {
    const harkCls = ' filmstrip-cell--har' + hark;
    const badge = '<span class="filmstrip-cell-badge" aria-hidden="true">' + hark + '</span>';
    if (!f) {
      return '<div class="filmstrip-cell filmstrip-cell--missing' + harkCls + '"' +
               ' aria-label="' + h(label) + ' has no frame at ' + h(time) + ' s">' +
               badge +
             '</div>';
    }
    const alt = h(label) + ' at ' + h(f.time) + ' s' +
                (typeof f.progress === 'number' ? ' (' + Math.round(f.progress) + '% rendered)' : '');
    return '<button type="button" class="filmstrip-cell' + harkCls + ' lightbox-trigger" aria-label="Open ' + alt + '">' +
             badge +
             '<img src="' + h(f.img) + '" alt="' + alt + '" loading="lazy" decoding="async">' +
           '</button>';
  }

  // Divergence: when both HARs report a numeric VisualProgress for
  // this cell, classify by gap so the column gets a coloured accent.
  function divergenceClass(a, b) {
    if (typeof a !== 'number' || typeof b !== 'number') return '';
    const gap = Math.abs(a - b);
    if (gap < 5) return '';
    if (gap < 20) return ' filmstrip-column--diff-mild';
    return ' filmstrip-column--diff-strong';
  }

  let columns = '';
  for (let i = 0; i < cells; i++) {
    const f1 = fs1[i];
    const f2 = fs2[i];
    const time = (f1 && f1.time) || (f2 && f2.time) || '';
    const diffCls = divergenceClass(f1 && f1.progress, f2 && f2.progress);
    columns += '<figure class="filmstrip-column' + diffCls + '">' +
                 cellHtml(f1, config.har1.label, time, 1) +
                 cellHtml(f2, config.har2.label, time, 2) +
                 '<figcaption class="filmstrip-time">' + h(time) + ' s</figcaption>' +
               '</figure>';
  }

  return '<h3 id="filmstripHeader" class="card-title">Filmstrip</h3>' +
         '<div class="filmstrip">' +
           '<div class="filmstrip-legend" aria-hidden="true">' +
             '<span class="filmstrip-legend-label filmstrip-legend-label--har1">' + h(config.har1.label) + '</span>' +
             '<span class="filmstrip-legend-label filmstrip-legend-label--har2">' + h(config.har2.label) + '</span>' +
           '</div>' +
           '<div class="filmstrip-rail" role="list" tabindex="0" aria-label="Filmstrip — use arrow keys to move between frames">' +
             columns +
           '</div>' +
         '</div>';
}

//
// thirdPartyTemplate
//
function thirdPartyTemplate(d) {
  const p1 = d.p1, p2 = d.p2, config = d.config;
  let html = '<h3 id="firstPartyHeader">First Party vs Third Party content</h3>';
  if (p1.firstPartyRegEx === p2.firstPartyRegEx) {
    html += '<p class="small">Using <b>' + h(p1.firstPartyRegEx) + '</b> as <i>--firstParty</i> parameter.</p>';
  } else {
    html += '<p class="small">Using <b>' + h(p1.firstPartyRegEx) + '</b> as <i>--firstParty</i> parameter for ' +
            h(config.har1.label) + ' and <b>' + h(p2.firstPartyRegEx) + '</b> for ' + h(config.har2.label) + '.</p>';
  }
  html += '<div id="comment-firstParty" class="comment"></div>';
  html += '<table><thead><tr>' +
          '<th class="tabletext">Metric</th>' +
          '<th> ' + h(config.har1.label) + '</th>' +
          '<th> ' + h(config.har2.label) + '</th>' +
          '</tr></thead><tbody>';

  function pct(n, total) {
    if (!n || !total || n <= 0) return 0;
    return Math.round((n / total) * 100);
  }

  function expandableRow(label, toggleClass, p1Cell, p2Cell, contentTypes1, contentTypes2, cellFn) {
    let row = '<tr><td class="tabletext">' + label + ' ' +
                '<button onclick="toggleRow(this, \'' + toggleClass + '\', this.childNodes[0]);" class="submit submit-smaller">' +
                  '<i class="arrow right"></i></button></td>' +
              '<td>' + p1Cell + '</td>' +
              '<td>' + p2Cell + '</td></tr>';
    row += each(contentTypes1, function (entry, key) {
      return '<tr class="userShowable ' + toggleClass + '">' +
               '<td class="tabletext">&nbsp;&nbsp;' + h(key) + '</td>' +
               '<td>' + cellFn(entry) + '</td>' +
               '<td>' + cellFn(contentTypes2 ? contentTypes2[key] : null) + '</td>' +
             '</tr>';
    });
    return row;
  }

  // First-party block
  html += expandableRow('First party requests', 'firstPartyRequests',
    p1.firstParty.requests + ' (' + pct(p1.firstParty.requests, p1.requests) + '%)',
    p2.firstParty.requests + ' (' + pct(p2.firstParty.requests, p2.requests) + '%)',
    p1.firstParty.contentTypes, p2.firstParty.contentTypes,
    function (entry) { return entry ? entry.requests : 0; }
  );
  html += expandableRow('First party transfer size', 'firstPartyTransferSize',
    formatBytes(p1.firstParty.transferSize) + ' (' + pct(p1.firstParty.transferSize, p1.transferSize) + '%)',
    formatBytes(p2.firstParty.transferSize) + ' (' + pct(p2.firstParty.transferSize, p2.transferSize) + '%)',
    p1.firstParty.contentTypes, p2.firstParty.contentTypes,
    function (entry) { return formatBytes(entry ? entry.transferSize : 0); }
  );
  html += expandableRow('First party content size', 'firstPartyContentSize',
    formatBytes(p1.firstParty.contentSize) + ' (' + pct(p1.firstParty.contentSize, p1.contentSize) + '%)',
    formatBytes(p2.firstParty.contentSize) + ' (' + pct(p2.firstParty.contentSize, p2.contentSize) + '%)',
    p1.firstParty.contentTypes, p2.firstParty.contentTypes,
    function (entry) { return formatBytes(entry ? entry.contentSize : 0); }
  );
  html += '<tr><td class="tabletext">First party cookies</td>' +
          '<td>' + (p1.firstParty.cookies != null ? p1.firstParty.cookies : '') + '</td>' +
          '<td></td></tr>';

  // Third-party block
  html += expandableRow('Third party requests', 'thirdPartyRequests',
    p1.thirdParty.requests + ' (' + pct(p1.thirdParty.requests, p1.requests) + '%)',
    p2.thirdParty.requests + ' (' + pct(p2.thirdParty.requests, p2.requests) + '%)',
    p1.thirdParty.contentTypes, p2.thirdParty.contentTypes,
    function (entry) { return entry ? entry.requests : 0; }
  );
  html += expandableRow('Third party transfer size', 'thirdPartyTransferSize',
    formatBytes(p1.thirdParty.transferSize) + ' (' + pct(p1.thirdParty.transferSize, p1.transferSize) + '%)',
    formatBytes(p2.thirdParty.transferSize) + ' (' + pct(p2.thirdParty.transferSize, p2.transferSize) + '%)',
    p1.thirdParty.contentTypes, p2.thirdParty.contentTypes,
    function (entry) { return formatBytes(entry ? entry.transferSize : 0); }
  );
  html += expandableRow('Third party content size', 'thirdPartyContentSize',
    formatBytes(p1.thirdParty.contentSize) + ' (' + pct(p1.thirdParty.contentSize, p1.contentSize) + '%)',
    formatBytes(p2.thirdParty.contentSize) + ' (' + pct(p2.thirdParty.contentSize, p2.contentSize) + '%)',
    p1.thirdParty.contentTypes, p2.thirdParty.contentTypes,
    function (entry) { return formatBytes(entry ? entry.contentSize : 0); }
  );
  html += '<tr><td class="tabletext">Third party cookies</td>' +
          '<td>' + (p1.thirdParty.cookies != null ? p1.thirdParty.cookies : '') + '</td>' +
          '<td></td></tr>';

  html += '</tbody></table>';
  return html;
}

//
// resultHeaderTemplate
//
function resultHeaderTemplate(d) {
  const p1 = d.p1, p2 = d.p2;
  let html = '<div class="header-links">';
  html += '<a href="#pageXrayContent">Metrics</a> - ';
  html += '<a href="#waterfallHeader">Waterfall</a> - ';
  if (p1.visualMetrics && p1.visualMetrics.VisualProgress) {
    html += '<a href="#visualProgressHeader">Visual Progress</a> - ';
  }
  if (p1.thirdParty && p1.thirdParty.contentTypes) {
    html += '<a href="#firstPartyHeader">1st vs 3rd party</a> - ';
  }
  if (p1.url === p2.url) {
    html += '<a href="#requestDifffHeader">Request diff</a> - ';
  }
  html += '<a href="#domainsHeader">Domains</a>';
  html += '</div>';
  return html;
}

//
// domainsTemplate
//
function domainsTemplate(d) {
  const config = d.config;
  let html = '<h3 id="domainsHeader">Domains</h3>';
  html += '<div id="comment-domains" class="comment"></div>';
  html += '<div class="col-1-1"><table><thead><tr>' +
          '<th class="tabletext">Domain</th>' +
          '<th class="no-break">' + h(config.har1.label) + ' Request</th>' +
          '<th class="no-break">' + h(config.har2.label) + ' Request</th>' +
          '<th class="no-break">' + h(config.har1.label) + ' Size</th>' +
          '<th class="no-break">' + h(config.har2.label) + ' Size</th>' +
          '</tr></thead><tbody>';

  html += each(d.domains, function (domain) {
    const safeId = 'domainDetails' + domain.name;
    let row = '<tr>' +
              '<td class="tabletext">' + h(domain.name) + ' ' +
                '<button onclick="toggleRow(this, \'' + h(safeId) + '\', this.childNodes[0]);" class="submit submit-smaller">' +
                  '<i class="arrow right"></i></button></td>' +
              '<td class="no-break">' + (domain.firstPage ? domain.firstPage.requests : '') + '</td>' +
              '<td class="no-break">' + (domain.secondPage ? domain.secondPage.requests : '') + '</td>' +
              '<td class="no-break">' + (domain.firstPage ? formatBytes(domain.firstPage.transferSize) : '') + '</td>' +
              '<td class="no-break">' + (domain.secondPage ? formatBytes(domain.secondPage.transferSize) : '') + '</td>' +
              '</tr>';
    row += '<tr class="userShowable ' + h(safeId) + '">' +
           '<td colspan="2" class="tabletext">&nbsp;<b>Total time spent HAR 1</b><br/>' +
           (domain.firstPage ? each(domain.firstPage.timings, function (val, key) {
             return '&nbsp;&nbsp;' + h(key) + ' : ' + val.toFixed(0) + ' <br/>';
           }) : '') +
           '</td>' +
           '<td colspan="3" class="tabletext">&nbsp;<b>Total time spent HAR 2</b><br/>' +
           (domain.secondPage ? each(domain.secondPage.timings, function (val, key) {
             return '&nbsp;&nbsp;' + h(key) + ' : ' + val.toFixed(0) + ' <br/>';
           }) : '') +
           '</td></tr>';
    return row;
  });

  html += '</tbody></table></div>';
  return html;
}

//
// requestDiffTemplate
//
function requestDiffTemplate(d) {
  if (!d.requestDiff) return '';
  let html = '<h3 id="requestDifffHeader">Request/response difference (larger than 1 kb)</h3>';
  html += '<div id="comment-requestDiff" class="comment"></div>';

  if (!d.requestDiff.length) {
    html += '<p>There are no difference in size of the requests/responses.</p>';
    return html;
  }

  const t = d.total;

  html += '<div class="col-1-1">';
  html += '<table class="requestDiffTable"><thead><tr>' +
          '<th class="tabletext">URL</th>' +
          '<th class="tabletext">' + h(d.config.har1.label) + '</th>' +
          '<th class="tabletext">' + h(d.config.har2.label) + '</th>' +
          '<th class="tabletext">Diff</th>' +
          '</tr></thead><tbody>';

  html += each(d.requestDiff, function (r) {
    let diffCell;
    if (r.har1 && r.har2) {
      if (r.diff < 0) {
        diffCell = '<td class="tabletext green">' + formatBytes(r.diff) + '</td>';
      } else {
        diffCell = '<td class="tabletext red">+' + formatBytes(r.diff) + '</td>';
      }
    } else if (r.har1) {
      diffCell = '<td class="tabletext green">Removed</td>';
    } else {
      diffCell = '<td class="tabletext red">New</td>';
    }
    return '<tr>' +
           '<td class="tabletext"><a href="' + h(r.url) + '">' + h(formatURL(r.url)) + '</a></td>' +
           '<td class="tabletext">' + formatBytes(r.har1) + '</td>' +
           '<td class="tabletext">' + formatBytes(r.har2) + '</td>' +
           diffCell +
           '</tr>';
  });

  html += '<tr><td class="tabletext"><b>Total</b></td>' +
          '<td class="tabletext"><b>' + formatBytes(t.har1) + '</b></td>' +
          '<td class="tabletext"><b>' + formatBytes(t.har2) + '</b></td>' +
          (t.diff < 0
            ? '<td class="tabletext green"><b>' + formatBytes(t.diff) + '</b></td>'
            : '<td class="tabletext red"><b>+' + formatBytes(t.diff) + '</b></td>') +
          '</tr>';

  html += '</tbody></table>';

  // Summary table
  html += '<table><thead><tr>' +
          '<th class="tabletext">Summary of request/response difference</th>' +
          '<th>Size</th>' +
          '</tr></thead><tbody>' +
          '<tr><td class="tabletext">New (' + t.new + ')</td><td class="red">' + formatBytes(t.newBytes) + '</td></tr>' +
          '<tr><td class="tabletext">Removed (' + t.removed + ')</td><td class="green">-' + formatBytes(t.removedBytes) + '</td></tr>' +
          '<tr><td class="tabletext">Increased (' + t.increased + ')</td><td class="red">' + formatBytes(t.increasedBytes) + '</td></tr>' +
          '<tr><td class="tabletext">Decreased (' + t.decreased + ')</td><td class="green">' + formatBytes(t.decreasedBytes) + '</td></tr>' +
          '<tr><td class="tabletext"><b>Total</b></td>' +
          (t.diff < 0
            ? '<td class="green"><b>' + formatBytes(t.diff) + '</b></td>'
            : '<td class="red"><b>+' + formatBytes(t.diff) + '</b></td>') +
          '</tr></tbody></table>';

  html += '</div>';
  return html;
}

const TEMPLATES = {
  visualProgressTemplate: visualProgressTemplate,
  pageXrayTemplate: pageXrayTemplate,
  filmstripTemplate: filmstripTemplate,
  thirdPartyTemplate: thirdPartyTemplate,
  resultHeaderTemplate: resultHeaderTemplate,
  domainsTemplate: domainsTemplate,
  requestDiffTemplate: requestDiffTemplate
};

function parseTemplate(templateId, data, divId) {
  const renderer = TEMPLATES[templateId];
  if (!renderer) return;
  const target = document.getElementById(divId);
  if (target) target.innerHTML = renderer(data);
}

// No-op kept for backwards compatibility with generate.js calling it
// at the start of every render.
function registerTemplateHelpers() {}
