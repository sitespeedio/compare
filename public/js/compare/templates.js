/* global formatURL */
/* exported parseTemplate, applyPositions */

//
// Templates. Replaces the Template7 setup that used to live here —
// each template is now a plain JS function that returns an HTML
// string.
//
// parseTemplate(templateId, data, divId) is the public entry point.
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

// Inline style attributes are blocked by the Content-Security-Policy, so
// positions go in data-x / data-w and applyPositions() sets them.
function applyPositions(container) {
  for (const el of container.querySelectorAll('[data-x]')) el.style.left = el.dataset.x + '%';
  for (const el of container.querySelectorAll('[data-w]')) el.style.width = el.dataset.w + '%';
}

function pill(cls, text) {
  return '<span class="pill pill--' + cls + '">' + h(text) + '</span>';
}

// One lane of run dots for a side. Positions are the difference from
// the reference value, on a shared -50% to +50% scale. A card passes its
// own scale and gets plain marks, because the card itself is a button.
function runDots(values, side, reference, selected, scale) {
  return '<span class="run-lane">' + each(values, function (v) {
    const pct = reference ? ((v.value - reference) / reference) * 100 : 0;
    const x = scale ? scale(v.value) : 50 + Math.max(-50, Math.min(50, pct));
    const cls = 'run-dot run-dot--' + side +
      (v.run === selected ? ' run-dot--selected' : '') +
      (!scale && Math.abs(pct) > 50 ? ' run-dot--clipped' : '');
    const label = 'Run ' + v.run + ': ' + v.text;
    if (scale) return '<span class="' + cls + '" data-x="' + x.toFixed(1) + '"></span>';
    return '<button type="button" class="' + cls + '" data-x="' + x.toFixed(1) + '"' +
      ' data-action="pick-run" data-side="' + side + '" data-run="' + v.run + '"' +
      ' aria-label="' + h(label) + '" title="' + h(label) + '"></button>';
  }) + '</span>';
}

//
// resultHeaderTemplate — links to the sections that have content.
//
function resultHeaderTemplate(d) {
  return '<div class="header-links">' +
    d.sections.map(function (s) { return '<a href="#' + s.id + '">' + h(s.label) + '</a>'; }).join(' - ') +
    '</div>';
}

//
// summaryTemplate — the answer first: the two HAR files, what to
// compare (all runs or single runs), a verdict and the key metrics.
//
function summaryTemplate(d) {
  let html = '<div class="summary-head">' +
    '<div class="summary-page"><h2 class="summary-title">' + h(d.url) + '</h2>' +
    '<p class="muted">' + h(d.details) + '</p></div>' +
    '<div class="har-chips">' + each(d.sides, function (s) {
      return '<span class="har-chip"><span class="har-dot har-dot--' + s.key + '"></span>' +
        '<b>' + h(s.label) + '</b> ' + h(s.when) + ' · ' + h(s.runs) +
        '<input type="file" id="har' + s.key + 'upload" class="inputfile"/>' +
        '<label for="har' + s.key + 'upload" class="har-chip-upload">Replace</label></span>';
    }) + '</div></div>';

  if (d.modeBar) {
    html += '<div class="mode-bar">';
    if (d.allowAll) {
      html += '<div class="segmented" role="group" aria-label="What to compare">' +
        '<button type="button" data-action="compare-mode" data-mode="all" aria-pressed="' + (d.mode === 'all') + '">All runs (median)</button>' +
        '<button type="button" data-action="compare-mode" data-mode="runs" aria-pressed="' + (d.mode === 'runs') + '">Single runs</button>' +
        '</div>';
    }
    if (d.mode === 'all') {
      html += '<p class="muted mode-note">' + h(d.modeNote) + '</p>';
    } else {
      html += each(d.runPickers, function (p) {
        return '<label class="run-pick"><span class="har-name har-name--' + p.key + '">' + h(p.label) + '</span>' +
          '<select id="run' + p.key + 'Option" data-action="change-run">' + each(p.options, function (o) {
            return '<option value="' + o.value + '"' + (o.selected ? ' selected' : '') + '>' + h(o.text) + '</option>';
          }) + '</select></label>';
      });
      if (d.outlierNote) html += pill('warn', d.outlierNote);
    }
    html += '</div>';
  }

  const v = d.verdict;
  html += '<div class="verdict verdict--' + v.cls + '">' + pill(v.cls, v.tag) +
    '<div><p class="verdict-title">' + h(v.title) + '</p><p class="muted">' + h(v.text) + '</p>' +
    (v.items.length ? '<p class="verdict-items">' + each(v.items, function (i) {
      return '<button type="button" class="pill pill--' + i.cls + '" data-action="show-metric" data-metric="' + h(i.metric) + '">' + h(i.text) + '</button>';
    }) + '</p>' : '') +
    '</div></div>';

  html += '<div class="metric-cards">' + each(d.cards, function (c) {
    return '<button type="button" class="metric-card" data-action="show-metric" data-metric="' + h(c.label) + '">' +
      '<span class="metric-card-label">' + h(c.label) + '</span>' +
      '<span class="metric-card-value">' + h(c.bText) + ' ' + pill(c.cls, c.delta) + '</span>' +
      '<span class="muted">' + h(d.sides[0].label) + ' ' + h(c.aText) + (c.note ? ' · ' + h(c.note) : '') + '</span>' +
      '<span class="metric-card-runs" aria-hidden="true">' +
        runDots(c.valuesA, 1, 0, c.runA, c.scale) + runDots(c.valuesB, 2, 0, c.runB, c.scale) +
      '</span></button>';
  }) + '</div>';
  return html;
}

//
// metricsTableTemplate — every metric, grouped in the same sections as
// before, with medians and ranges (all runs) or the two picked runs.
//
function metricsTableTemplate(d) {
  if (!d.rows.length) return '<p class="muted">No metrics match.</p>';
  const head = '<thead><tr>' +
    '<th scope="col">Metric</th>' +
    '<th scope="col" class="har-name har-name--1">' + h(d.labelA) + '</th>' +
    '<th scope="col" class="har-name har-name--2">' + h(d.labelB) + '</th>' +
    '<th scope="col">Change</th>' +
    '<th scope="col" class="runs-col">Runs vs ' + h(d.referenceLabel) +
      '<span class="runs-axis" aria-hidden="true"><span>−50%</span><span>0</span><span>+50%</span></span></th>' +
    '</tr></thead>';
  const body = each(d.rows, function (r) {
    if (r.sectionRow) {
      const count = r.changedCount === undefined ? ''
        : '<span class="section-count">' + (r.changedCount ? r.changedCount + ' changed' : 'No changes') + '</span>';
      const fold = r.canFold
        ? '<button type="button" class="chip-toggle" data-action="toggle-section" data-section="' + h(r.label) + '"' +
          ' aria-expanded="' + r.expanded + '">' + (r.expanded ? 'Fold unchanged' : 'Show ' + r.unchanged + ' unchanged') + '</button>'
        : '';
      return '<tr class="metricsSection"><th colspan="5" scope="colgroup">' + h(r.label) + count + fold + '</th></tr>';
    }
    return '<tr data-metric="' + h(r.label) + '"><th scope="row">' + h(r.label) + '</th>' +
      '<td>' + h(r.aText) + '<span class="range">' + h(r.aRange) + '</span></td>' +
      '<td>' + h(r.bText) + '<span class="range">' + h(r.bRange) + '</span></td>' +
      '<td>' + pill(r.cls, r.dText) + '<span class="range">' + h(r.pText) + '</span></td>' +
      '<td class="runs-col">' + (r.showDots
        ? runDots(r.dotsA, 1, r.reference, d.runA) + runDots(r.dotsB, 2, r.reference, d.runB)
        : '') + '</td></tr>';
  });
  return '<div class="table-scroll"><table class="metricsTable">' +
    '<caption class="sr-only">All metrics: ' + h(d.labelA) + ' versus ' + h(d.labelB) + '</caption>' +
    head + '<tbody>' + body + '</tbody></table></div>';
}

//
// requestsTemplate — requests that are new, removed or changed size.
//
function requestsTemplate(d) {
  const summary = '<div class="request-summary">' + each(d.summary, function (s) {
    return '<div><span class="muted">' + h(s.label) + '</span><b class="change--' + s.cls + '">' + h(s.value) + '</b></div>';
  }) + '</div>';
  const filters = '<div class="request-filters" role="group" aria-label="Filter requests">' + each(d.filters, function (f) {
    return '<button type="button" class="chip-toggle" data-action="request-filter" data-filter="' + f.id + '"' +
      ' aria-pressed="' + f.active + '">' + h(f.label) + ' <span class="muted">' + f.count + '</span></button>';
  }) + '</div>';
  if (!d.rows.length) {
    return summary + filters + '<p class="muted">No requests match. Lower the size limit or pick another filter.</p>';
  }
  const sortButton = (id, label) => '<button type="button" class="sort-button" data-action="request-sort" data-sort="' + id + '"' +
    ' aria-pressed="' + (d.sort === id) + '">' + label + '</button>';
  return summary + filters +
    '<div class="table-scroll"><table class="requestsTable">' +
    '<caption class="sr-only">Request changes</caption>' +
    '<thead><tr><th scope="col">' + sortButton('url', 'URL') + '</th><th scope="col">Type</th>' +
    '<th scope="col" class="har-name har-name--1">' + h(d.labelA) + '</th>' +
    '<th scope="col" class="har-name har-name--2">' + h(d.labelB) + '</th>' +
    '<th scope="col">' + sortButton('change', 'Change') + '</th></tr></thead><tbody>' +
    each(d.rows, function (r) {
      return '<tr><td class="request-url"><a href="' + h(r.url) + '" title="' + h(r.url) + '">' + h(formatURL(r.url)) + '</a></td>' +
        '<td><span class="tag">' + h(r.type) + '</span></td>' +
        '<td>' + h(r.aText) + '</td><td>' + h(r.bText) + '</td>' +
        '<td class="request-change"><span class="change-bar change-bar--' + r.cls + '" data-w="' + r.w + '"></span>' +
          '<span class="change--' + r.cls + '">' + h(r.dText) + '</span></td></tr>';
    }) + '</tbody></table></div>';
}

//
// timelineMediaTemplate — the stage: the two runs at the timeline
// cursor, their videos when both have one, else their filmstrip frames.
//
function timelineMediaTemplate(d) {
  return '<div class="rendering-stage">' + each(d.sides, function (s) {
    const media = d.hasVideo
      ? '<video class="timeline-video" data-side="' + s.key + '" src="' + h(s.video) + '"' +
        (s.poster ? ' poster="' + h(s.poster) + '"' : '') + ' muted playsinline preload="auto"></video>'
      : '<img class="timeline-frame" data-side="' + s.key + '" src="' + h(s.frame) + '" alt="' + h(s.label) + ' at the timeline cursor">';
    return '<figure class="rendering-stage-item rendering-stage-item--' + s.key + '">' + media +
      '<figcaption><span class="har-dot har-dot--' + s.key + '"></span>' + h(s.label) +
      ' <span class="timeline-progress" data-side="' + s.key + '"></span></figcaption></figure>';
  }) + '</div>';
}

//
// timelineTrackTemplate — milestone chips per HAR that light up as the
// cursor passes them, and the milestone timeline: HAR1 flags above the
// axis, HAR2 flags below, long tasks and divergence bands on the axis.
//
function timelineTrackTemplate(d) {
  const pct = t => ((t / d.end) * 100).toFixed(2);
  const hud = '<div class="rendering-hud">' + each(d.sides, function (s) {
    return '<div class="rendering-hud-row"><span class="rendering-hud-name har-name har-name--' + s.key + '">' +
      '<span class="har-dot har-dot--' + s.key + '"></span>' + h(s.label) + '</span>' +
      each(s.milestones, function (m) {
        return '<button type="button" class="rendering-chip" data-action="timeline-seek" data-t="' + m.t + '"' +
          (m.metric ? ' data-metric="' + h(m.metric) + '"' : '') + '>' + h(m.name) + ' <b>' + h(m.text) + '</b></button>';
      }) + '</div>';
  }) + '</div>';

  let flags = '';
  d.sides.forEach(function (s) {
    // Milestones at almost the same time share one flag.
    const groups = [];
    s.milestones.forEach(function (m) {
      const group = groups[groups.length - 1];
      if (group && ((m.t - group.t) / d.end) * 100 < 3) {
        group.short += ' · ' + m.short;
        group.name += ', ' + m.name;
        group.metric = null;
      } else {
        groups.push(Object.assign({}, m));
      }
    });
    let last = -100;
    let low = false;
    groups.forEach(function (m) {
      const at = (m.t / d.end) * 100;
      // Alternate lanes when two flags would collide.
      low = at - last < 7 ? !low : false;
      last = at;
      flags += '<button type="button" class="rendering-flag rendering-flag--' + s.key + (low ? ' rendering-flag--low' : '') + '"' +
        ' data-x="' + pct(m.t) + '" data-t="' + m.t + '" data-action="timeline-seek"' +
        (m.metric ? ' data-metric="' + h(m.metric) + '"' : '') +
        ' aria-label="' + h(s.label + ' ' + m.name + ' ' + m.text) + '">' +
        '<span class="rendering-flag-label">' + h(m.short) + '</span><span class="rendering-flag-stem"></span></button>';
    });
  });

  const busy = each(d.sides, function (s) {
    return each(s.longTasks, function (task) {
      return '<span class="rendering-busy-bar rendering-busy-bar--' + s.key + '" data-x="' + pct(task.start) + '"' +
        ' data-w="' + Math.max(((Math.min(task.start + task.duration, d.end) - task.start) / d.end) * 100, 0.4).toFixed(2) + '"' +
        ' title="' + h(s.label + ': main thread busy ' + Math.round(task.duration) + ' ms') + '"></span>';
    });
  });
  const bands = each(d.bands, function (b) {
    return '<span class="rendering-band" data-x="' + pct(b.from) + '" data-w="' + (((b.to - b.from) / d.end) * 100).toFixed(2) + '"' +
      ' data-from="' + b.from + '" data-to="' + b.to + '"></span>';
  });
  const ticks = each(d.ticks, function (t) {
    return '<span class="rendering-tick" data-x="' + pct(t) + '">' + (t / 1000) + 's</span>';
  });

  return hud +
    '<div class="rendering-timeline" id="timelineTrack" data-end="' + d.end + '">' +
      '<div class="rendering-axis" id="timelineAxis" role="slider" tabindex="0" aria-label="Timeline position"' +
        ' aria-valuemin="0" aria-valuemax="' + d.end + '" aria-valuenow="0">' + bands + '</div>' +
      '<div class="rendering-axis-fill" id="timelineFill"></div>' +
      (busy ? '<div class="rendering-busy">' + busy + '</div>' : '') +
      '<div class="rendering-playhead" id="timelinePlayhead"></div>' +
      flags + ticks +
    '</div>' +
    (busy ? '<p class="muted rendering-note">Red marks on the timeline are long tasks: the main thread was busy and the page could not paint or respond.</p>' : '');
}

//
// capturesTemplate — final screenshots, videos and result pages.
//
function capturesTemplate(d) {
  return '<h3 id="capturesHeader" class="card-title">Captures</h3><div class="captures">' + each(d.sides, function (s) {
    const links = [];
    if (s.video) links.push('<a href="' + h(s.video) + '" target="_blank" rel="noopener noreferrer">Video</a>');
    if (s.result) links.push('<a href="' + h(s.result) + '" target="_blank" rel="noopener noreferrer">Result page</a>');
    return '<figure class="capture"><figcaption><span class="har-dot har-dot--' + s.key + '"></span>' + h(s.label) + '</figcaption>' +
      (s.screenshot
        ? '<button type="button" class="lightbox-trigger" aria-label="Open larger screenshot of ' + h(s.label) + '">' +
          '<img class="capture-screenshot" src="' + h(s.screenshot) + '" alt="Final screenshot of ' + h(s.label) + '" loading="lazy"></button>'
        : '') +
      (links.length ? '<p>' + links.join(' · ') + '</p>' : '') + '</figure>';
  }) + '</div>';
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
             (typeof f.progress === 'number' ? '<span class="filmstrip-cell-pct">' + Math.round(f.progress) + '%</span>' : '') +
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
    const ms = (f1 && f1.ms) || (f2 && f2.ms) || 0;
    // A dot on the time marks a column where either page changed.
    const changed = i > 0 && ((f1 && fs1[i - 1] && f1.sourceMs !== fs1[i - 1].sourceMs) ||
                              (f2 && fs2[i - 1] && f2.sourceMs !== fs2[i - 1].sourceMs));
    columns += '<figure class="filmstrip-column' + diffCls + (changed ? ' filmstrip-column--changed' : '') + '" data-ms="' + ms + '">' +
                 cellHtml(f1, config.har1.label, time, 1) +
                 cellHtml(f2, config.har2.label, time, 2) +
                 '<figcaption class="filmstrip-time">' + h(time) + ' s</figcaption>' +
               '</figure>';
  }

  return '<div class="card-head"><h3 id="filmstripHeader" class="card-title">Filmstrip</h3>' +
         '<label class="filmstrip-zoom">Zoom <input type="range" min="70" max="260" value="120" data-action="filmstrip-zoom" aria-label="Filmstrip frame size"></label></div>' +
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

const TEMPLATES = {
  resultHeaderTemplate: resultHeaderTemplate,
  summaryTemplate: summaryTemplate,
  metricsTableTemplate: metricsTableTemplate,
  requestsTemplate: requestsTemplate,
  timelineMediaTemplate: timelineMediaTemplate,
  timelineTrackTemplate: timelineTrackTemplate,
  capturesTemplate: capturesTemplate,
  filmstripTemplate: filmstripTemplate
};

function parseTemplate(templateId, data, divId) {
  const renderer = TEMPLATES[templateId];
  if (!renderer) return;
  const target = document.getElementById(divId);
  if (target) {
    target.innerHTML = renderer(data);
    applyPositions(target);
  }
}
