/* global formatTime, getLastTiming, removeAndHide, createUpload, hideUpload, parseTemplate, formatDate, formatBytes, getFilmstrip, compareWaterfall, renderShareControls, blendWaterfalls, applyWaterfallLayoutPreference, buildRuns, canCompareAllRuns, medianRun, isOutlierRun, compareMetrics, MIN_EFFECT, ADJUST_MIN_RUNS, requestSizes, compareRequests, initTimeline, addTimelineWaterfall, stopTimeline, prefersReducedMotion, addDrawingLayer */
/* exported generate, regenerate, buildRequestView, linkMetric, showMetric, setCompareMode, pickRun, setMetricsQuery, toggleAllMetrics, toggleMetricSection, setRequestFilter, setRequestSort, setRequestMin */

// What the result page shows right now.
const view = {
  config: null,
  runs1: [],
  runs2: [],
  allowAll: false,
  mode: 'runs',
  run1: 1,
  run2: 1,
  rows: [],
  query: '',
  showAll: false,
  expanded: new Set(),
  requestFilter: 'all',
  requestSort: 'change',
  requestMin: 1000
};

function storedFlag(key) {
  try { return localStorage.getItem(key) === '1'; }
  catch (e) { return false; }
}

function storeFlag(key, on) {
  try { localStorage.setItem(key, on ? '1' : '0'); }
  catch (e) { /* localStorage blocked — preference is in-memory only */ }
}

/**
 * You have pushed the switch button or have changed the run drop down
 * and you want to re-generate the output
 * @param {*} switchHar
 */
function regenerate(switchHar) {
  if (!switchHar) {
    const e = document.getElementById('run1Option');
    const e2 = document.getElementById('run2Option');
    if (e) view.run1 = Number(e.value);
    if (e2) view.run2 = Number(e2.value);
    render();
    return;
  }
  const prev = window.har || {};
  // Carry per-HAR metadata (url) and top-level config (title,
  // firstParty, stripVersion, comments) across a Switch / run change.
  // Without this, the share UI would flip from "Copy share link" to
  // "Download bundle" the moment the user toggled anything.
  generate({
    har1: { har: prev.har2.har, run: view.run2 - 1, label: prev.har2.label, url: prev.har2.url, drawings: prev.har2.drawings },
    har2: { har: prev.har1.har, run: view.run1 - 1, label: prev.har1.label, url: prev.har1.url, drawings: prev.har1.drawings },
    title: prev.title,
    firstParty: prev.firstParty,
    stripVersion: prev.stripVersion,
    comments: prev.comments,
    mode: view.mode
  });
}

function setCompareMode(mode) {
  if (mode === 'runs' && view.mode === 'all') {
    view.run1 = medianRun(view.runs1);
    view.run2 = medianRun(view.runs2);
  }
  view.mode = view.allowAll ? mode : 'runs';
  render();
}

// A run dot was clicked: compare that run in single runs mode.
function pickRun(side, run) {
  if (view.mode === 'all') {
    view.run1 = medianRun(view.runs1);
    view.run2 = medianRun(view.runs2);
  }
  view.mode = 'runs';
  if (side === 1) view.run1 = run;
  else view.run2 = run;
  render();
}

/**
 * Render one waterfall into #<waterfallDivId> using waterfall-tools.
 * Pass the same `maxTime` (ms) for both HARs in the pair so the
 * stacked panels share a time axis.
 */
function addWaterfall(har, selectedPage, waterfallDivId, maxTime, shapes) {
  const outputHolder = document.getElementById(waterfallDivId);
  if (!outputHolder) return Promise.resolve();
  return compareWaterfall.render(har, outputHolder, {
    endTimeMs: maxTime,
    runIndex: Number(selectedPage)
  }).then(renderer => {
    addTimelineWaterfall(waterfallDivId, renderer, outputHolder);
    addDrawingLayer(waterfallDivId, renderer, outputHolder, shapes);
  });
}

// Drawings belong to one run: on another run they point at other requests.
function shapesFor(side, run) {
  side.drawings = side.drawings || {};
  side.drawings[run] = side.drawings[run] || [];
  return side.drawings[run];
}

/**
 * Generate/create output for the HAR files. Config objects has the following structure:
 * { har1: {url, run, label, har}, har2: {url, run, label, har}}
 * @param {} config
 */
function generate(config) {
  // We remove the potential old HARs
  removeAndHide();
  hideUpload();
  stopTimeline();

  // we store the HAR to easy get it when we switch runs
  window.har = config;

  if (config.title) {
    document.title = config.title;
  } else if (
    config.har1.har.log.pages[config.har1.run].startedDateTime &&
    config.har2.har.log.pages[config.har2.run].startedDateTime
  ) {
    document.title =
      formatDate(config.har1.har.log.pages[config.har1.run].startedDateTime) +
      ' vs ' +
      formatDate(config.har2.har.log.pages[config.har2.run].startedDateTime);
  }

  view.config = config;
  view.runs1 = buildRuns(config.har1.har, config.firstParty);
  view.runs2 = buildRuns(config.har2.har, config.firstParty);
  view.allowAll = canCompareAllRuns(config.har1.har, config.har2.har, view.runs1, view.runs2);
  view.mode = view.allowAll ? config.mode || 'all' : 'runs';
  view.run1 = Number(config.har1.run) + 1;
  view.run2 = Number(config.har2.run) + 1;
  view.showAll = storedFlag('compare.showAllMetrics');
  view.expanded = new Set();

  render();

  // Render/refresh the share affordance now that window.har is set.
  // Guarded so a missing share.js (e.g. embedded usage) is a no-op
  // rather than a hard error.
  if (typeof renderShareControls === 'function') {
    renderShareControls();
  }
}

function render() {
  const config = view.config;
  const all = view.mode === 'all';
  const run1 = all ? medianRun(view.runs1) : view.run1;
  const run2 = all ? medianRun(view.runs2) : view.run2;
  view.selected = { run1, run2 };
  // Share links and bundles open the runs on screen.
  config.har1.run = run1 - 1;
  config.har2.run = run2 - 1;
  config.mode = view.mode;

  const r1 = view.runs1[run1 - 1];
  const r2 = view.runs2[run2 - 1];
  view.rows = compareMetrics(view.runs1, view.runs2, { allRuns: all, runA: run1, runB: run2 });

  renderSummary(r1, r2);
  const hasTimeline = renderTimeline(r1, r2);
  renderMetricsTable();
  const hasRequests = renderRequests(r1, r2);
  const hasCaptures = renderCaptures(r1, r2);

  const sections = [{ id: 'summary', label: 'Summary' }];
  if (hasTimeline) sections.push({ id: 'timelineHeader', label: 'Timeline' });
  sections.push({ id: 'waterfallHeader', label: 'Waterfall' });
  sections.push({ id: 'metricsHeader', label: 'All metrics' });
  if (hasRequests) sections.push({ id: 'requestDiffHeader', label: 'Request changes' });
  if (hasCaptures) sections.push({ id: 'capturesHeader', label: 'Captures' });
  parseTemplate('resultHeaderTemplate', { sections }, 'resultHeaderContent');

  // Take care of comments
  for (const key of Object.keys(config.comments || {})) {
    const el = document.getElementById('comment-' + key);
    if (el) el.textContent = config.comments[key];
  }

  createUpload('har1upload');
  createUpload('har2upload');
}

const metricRowsOnly = rows => rows.filter(r => r.section !== true);

function renderSummary(r1, r2) {
  const config = view.config;
  const all = view.mode === 'all';
  const { run1, run2 } = view.selected;
  const label1 = config.har1.label;
  const label2 = config.har2.label;
  const metrics = metricRowsOnly(view.rows);
  const browser = r1.px.meta.browser;

  const runText = (runs, run) => (all ? runs.length + ' runs' : 'run ' + run + ' of ' + runs.length);
  const pickerOptions = (runs, run) => runs.map(r => ({
    value: r.run,
    selected: r.run === run,
    text: 'Run ' + r.run +
      (runs.length > 2 && r.run === medianRun(runs) ? ' (median)' : '') +
      (runs.length > 2 && isOutlierRun(runs, r.run) ? ' (outlier)' : '')
  }));
  const runPickers = [];
  if (view.runs1.length > 1) runPickers.push({ key: 1, label: label1, options: pickerOptions(view.runs1, run1) });
  if (view.runs2.length > 1) runPickers.push({ key: 2, label: label2, options: pickerOptions(view.runs2, run2) });
  const outliers = [];
  if (view.runs1.length > 2 && isOutlierRun(view.runs1, run1)) outliers.push(label1 + ' run ' + run1);
  if (view.runs2.length > 2 && isOutlierRun(view.runs2, run2)) outliers.push(label2 + ' run ' + run2);

  // The verdict counts changes that are significant and big enough.
  const notable = metrics.filter(r => r.notable && !r.zero)
    .sort((x, y) => (y.delta > 0) - (x.delta > 0) || Math.abs(y.pct ?? 100) - Math.abs(x.pct ?? 100));
  const smallSignificant = all ? metrics.filter(r => r.significant && !r.notable && !r.zero).length : 0;
  const worse = notable.filter(r => r.delta > 0).length;
  const better = notable.length - worse;
  const smallText = smallSignificant
    ? ' ' + smallSignificant + (notable.length ? ' more' : ' metrics') + ' changed significantly by less than ' + MIN_EFFECT + '%; see All metrics.'
    : '';
  let verdict;
  if (all && !notable.length) {
    verdict = {
      cls: 'same', tag: 'No notable change',
      title: 'No metric changed significantly by ' + MIN_EFFECT + '% or more across ' + view.runs1.length + ' + ' + view.runs2.length + ' runs.',
      text: 'Differences between single runs are within run-to-run noise.' + smallText
    };
  } else if (all) {
    verdict = {
      cls: worse >= better ? 'worse' : 'better', tag: worse + ' worse · ' + better + ' better',
      title: notable.length + ' of ' + metrics.length + ' metrics changed significantly by ' + MIN_EFFECT + '% or more.',
      text: 'Regressions first. With this many metrics a few can pass the test by chance, so more runs give a firmer answer.' + smallText
    };
  } else {
    const multi = view.runs1.length > 1 || view.runs2.length > 1;
    verdict = {
      cls: notable.length ? 'warn' : 'same', tag: 'Single runs',
      title: 'Comparing ' + label1 + ' run ' + run1 + ' with ' + label2 + ' run ' + run2 + ': ' + notable.length + ' metrics differ by 5% or more.',
      text: view.allowAll
        ? 'One run per side cannot tell a real change from noise. Switch to All runs to see which changes hold up.'
        : multi ? 'Compare the same URL in two HAR files with several runs each to test if a change is real.'
          : 'Test with several runs to tell a real change from noise.'
    };
  }
  verdict.items = notable.slice(0, 8).map(r => ({ cls: r.delta > 0 ? 'worse' : 'better', text: r.label + ' ' + r.dText, metric: r.label }));

  const preferred = ['First Contentful Paint', 'Largest Contentful Paint', 'Speed Index', 'Total Blocking Time',
    'Cumulative Layout Shift', 'First Visual Change', 'Last Visual Change', 'Load event', 'Transfer size', 'Requests'];
  const cards = preferred
    .map(label => metrics.find(r => r.label === label))
    .filter(r => r && typeof r.a === 'number' && typeof r.b === 'number')
    .slice(0, 6)
    .map(r => {
      const values = r.valuesA.concat(r.valuesB).map(v => v.value);
      const lo = Math.min(...values);
      const hi = Math.max(...values);
      const dots = list => list.map(v => ({ run: v.run, value: v.value, text: r.fmt(v.value) }));
      return {
        label: r.label, aText: r.aText, bText: r.bText,
        delta: r.dText.replace(/ \(.*/, ''),
        cls: r.notable ? r.cls : 'same',
        note: all ? (r.significant && !r.notable ? 'significant, under ' + MIN_EFFECT + '%' : r.pText) : 'single runs',
        valuesA: dots(r.valuesA), valuesB: dots(r.valuesB),
        runA: all ? null : run1, runB: all ? null : run2,
        scale: v => (hi === lo ? 50 : 4 + ((v - lo) / (hi - lo)) * 92)
      };
    });

  parseTemplate('summaryTemplate', {
    url: r1.px.url.replace(/^https?:\/\//, ''),
    details: [browser && browser.name + ' ' + browser.version, r1.px.meta.connectivity].filter(Boolean).join(' · '),
    sides: [
      { key: 1, label: label1, when: formatDate(r1.page.startedDateTime), runs: runText(view.runs1, run1) },
      { key: 2, label: label2, when: formatDate(r2.page.startedDateTime), runs: runText(view.runs2, run2) }
    ],
    modeBar: view.allowAll || runPickers.length > 0,
    allowAll: view.allowAll,
    mode: view.mode,
    modeNote: 'Each metric compares the ' + view.runs1.length + ' runs of ' + label1 + ' with the ' + view.runs2.length +
      ' runs of ' + label2 + '. A change is significant when a Mann-Whitney U test gives p < 0.05. ' +
      (view.runs1.length >= ADJUST_MIN_RUNS && view.runs2.length >= ADJUST_MIN_RUNS
        ? 'The p-values are adjusted for the number of metrics (Benjamini-Hochberg), so fewer changes are significant by chance. ' : '') +
      'The timeline, video and waterfall show the median run of each side: ' + label1 + ' run ' + run1 + ' and ' + label2 + ' run ' + run2 + '.',
    runPickers,
    outlierNote: outliers.length ? outliers.join(' and ') + (outliers.length > 1 ? ' are outliers' : ' is an outlier') + ' (25% or more from the median).' : '',
    verdict,
    cards
  }, 'summaryContent');
}

function renderTimeline(r1, r2) {
  const config = view.config;
  const { run1, run2 } = view.selected;
  const maxTime = Math.max(getLastTiming(config.har1.har, run1 - 1), getLastTiming(config.har2.har, run2 - 1));
  const vp = r => (r.px.visualMetrics && r.px.visualMetrics.VisualProgress) || null;
  const filmstrip = getFilmstrip(config.har1.har, run1 - 1, config.har2.har, run2 - 1);
  const video1 = r1.px.meta.video;
  const video2 = r2.px.meta.video;
  const hasVideo = !!(video1 && video2);
  const hasChart = !!(vp(r1) && vp(r2));

  const section = document.getElementById('timelineSection');
  const show = hasChart || !!filmstrip || hasVideo;
  if (section) section.hidden = !show;

  if (filmstrip) {
    parseTemplate('filmstripTemplate', { config, filmstrip }, 'filmstripContent');
  } else {
    document.getElementById('filmstripContent').innerHTML = '';
  }
  const firstFrame = frames => (frames && frames.length ? frames[0].img : '');
  parseTemplate('timelineMediaTemplate', {
    hasVideo: hasVideo,
    sides: [
      { key: 1, label: config.har1.label + ' run ' + run1, video: video1, poster: r1.px.meta.screenshot, frame: firstFrame(filmstrip && filmstrip.frames1) },
      { key: 2, label: config.har2.label + ' run ' + run2, video: video2, poster: r2.px.meta.screenshot, frame: firstFrame(filmstrip && filmstrip.frames2) }
    ].filter(() => hasVideo || filmstrip)
  }, 'timelineMedia');

  // Marker timings — vertical guide lines on the chart anchor the
  // comparison in time so "when did this happen?" is answerable at
  // a glance. We pick the standard set: First Visual Change, FCP,
  // LCP and Speed Index. Each marker is per-HAR so a regressed LCP
  // shows up as two side-by-side red lines rather than one.
  function markerSet(p) {
    const vm = p.visualMetrics || {};
    const gw = p.googleWebVitals || {};
    return [
      { label: 'FVC',         time: vm.FirstVisualChange,            kind: 'fvc' },
      { label: 'FCP',         time: gw.firstContentfulPaint,         kind: 'fcp' },
      { label: 'LCP',         time: gw.largestContentfulPaint,       kind: 'lcp' },
      { label: 'Speed Index', time: vm.SpeedIndex,                   kind: 'si'  }
    ].filter(function (m) { return typeof m.time === 'number' && m.time > 0; });
  }
  // Every run of a side makes the shaded range when the runs are of one URL.
  const chartRuns = (runs, run) => runs
    .filter(r => vp(r) && (view.allowAll || r.run === run))
    .map(r => ({ vp: vp(r), selected: r.run === run }));

  // Slider labels for the blend control. Both waterfalls are rendered
  // into the same area on the same time axis; the slider blends har2
  // over har1.
  const label1 = document.getElementById('har1Label');
  const label2 = document.getElementById('har2Label');
  if (label1) label1.textContent = config.har1.label + ' run ' + run1;
  if (label2) label2.textContent = config.har2.label + ' run ' + run2;

  // Reset the slider to 0 (show HAR1 fully) when (re)generating.
  const slider = document.getElementById('harBlendSlider');
  if (slider) slider.value = 0;
  blendWaterfalls(0);
  // Restore the user's saved side-by-side / overlay preference now
  // that the waterfall DOM is populated. No-op when the wrapper is
  // missing (e.g. during the loading view).
  applyWaterfallLayoutPreference();

  // The milestones a HAR reached, for the HUD chips and timeline flags.
  // `metric` links each one to its card and table row.
  function milestones(r) {
    const vm = r.px.visualMetrics || {};
    const gw = r.px.googleWebVitals || {};
    return [
      ['First Visual Change', 'FVC', vm.FirstVisualChange],
      ['First Contentful Paint', 'FCP', gw.firstContentfulPaint],
      ['Largest Contentful Paint', 'LCP', gw.largestContentfulPaint],
      ['Speed Index', 'SI', vm.SpeedIndex],
      ['Visual Complete 85%', 'VC85', vm.VisualComplete85],
      ['Last Visual Change', 'LVC', vm.LastVisualChange],
      ['Load event', 'Load', r.page.pageTimings && r.page.pageTimings.onLoad]
    ]
      .filter(([, , t]) => typeof t === 'number' && t > 0 && t <= maxTime)
      .map(([name, short, t]) => ({ name, short, t, text: formatTime(t), metric: name }))
      .sort((a, b) => a.t - b.t);
  }
  // sitespeed.io lists the long tasks in its filmstrip timings.
  function longTasks(r) {
    return ((r.page._meta && r.page._meta.filmstrip) || [])
      .flatMap(frame => frame.timings || [])
      .filter(timing => timing.metric === 'longTask')
      .map(timing => ({ start: Number(timing.value), duration: Number(timing.duration) }))
      .filter(task => task.start < maxTime && task.duration > 0);
  }
  const firstVisual = Math.min(...[r1, r2]
    .map(r => (r.px.visualMetrics && r.px.visualMetrics.FirstVisualChange) || Infinity));

  const meta = document.getElementById('timelineMeta');
  if (meta) meta.textContent = config.har1.label + ' run ' + run1 + ' · ' + config.har2.label + ' run ' + run2;

  initTimeline({
    maxTime,
    start: hasChart ? Math.max(r1.px.visualMetrics.FirstVisualChange || 0, r2.px.visualMetrics.FirstVisualChange || 0) : 0,
    firstVisual: isFinite(firstVisual) ? firstVisual : 0,
    track: [
      { key: 1, label: config.har1.label, milestones: milestones(r1), longTasks: longTasks(r1) },
      { key: 2, label: config.har2.label, milestones: milestones(r2), longTasks: longTasks(r2) }
    ],
    chart: hasChart ? {
      runs1: chartRuns(view.runs1, run1),
      runs2: chartRuns(view.runs2, run2),
      markers1: markerSet(r1.px),
      markers2: markerSet(r2.px)
    } : { runs1: [], runs2: [] },
    sides: {
      1: { frames: filmstrip ? filmstrip.frames1 : [], vp: vp(r1) },
      2: { frames: filmstrip ? filmstrip.frames2 : [], vp: vp(r2) }
    }
  });
  document.getElementById('visualProgress').hidden = !hasChart;
  document.querySelector('.vp-title').hidden = !hasChart;
  document.getElementById('vpRangeNote').hidden = !hasChart || !view.allowAll;

  addWaterfall(config.har1.har, run1 - 1, 'har1', maxTime, shapesFor(config.har1, run1));
  addWaterfall(config.har2.har, run2 - 1, 'har2', maxTime, shapesFor(config.har2, run2));
  return show;
}

function renderMetricsTable() {
  const all = view.mode === 'all';
  const config = view.config;
  const { run1, run2 } = view.selected;
  const query = view.query.trim().toLowerCase();
  const metrics = metricRowsOnly(view.rows);
  // What counts as changed is what the summary counts: significant and
  // at least MIN_EFFECT across all runs, or 5% or more between two single
  // runs (they almost always differ a little).
  const changed = r => r.notable;
  const dots = (r, list) => list.map(v => ({ run: v.run, value: v.value, text: r.fmt(v.value) }));

  // Each section shows its changed metrics; the rest are folded.
  const rows = [];
  let section = null;
  let sectionRows = [];
  const flush = () => {
    if (!section) return;
    const open = view.showAll || view.expanded.has(section.label);
    const shown = sectionRows.filter(r => (query
      ? (r.section + ' ' + r.label).toLowerCase().includes(query)
      : open || changed(r)));
    if (query && !shown.length) return;
    const changedCount = sectionRows.filter(changed).length;
    rows.push({
      sectionRow: true,
      label: section.label,
      changedCount,
      unchanged: sectionRows.length - changedCount,
      expanded: open,
      canFold: !query && !view.showAll && sectionRows.length > changedCount
    });
    for (const r of shown) {
      rows.push({ ...r, showDots: all ? r.significant : r.notable, dotsA: dots(r, r.valuesA), dotsB: dots(r, r.valuesB) });
    }
  };
  for (const r of view.rows) {
    if (r.section === true) {
      flush();
      section = r;
      sectionRows = [];
    } else {
      sectionRows.push(r);
    }
  }
  flush();

  parseTemplate('metricsTableTemplate', {
    rows,
    labelA: config.har1.label + (all ? ' median' : ' run ' + run1),
    labelB: config.har2.label + (all ? ' median' : ' run ' + run2),
    referenceLabel: config.har1.label + (all ? ' median' : ' run ' + run1),
    runA: all ? null : run1,
    runB: all ? null : run2
  }, 'metricsTableContent');

  const note = document.getElementById('metricsNote');
  if (note) {
    note.textContent = metrics.filter(changed).length + ' of ' + metrics.length + ' metrics changed' +
      (all ? ' significantly by ' + MIN_EFFECT + '% or more' : ' by 5% or more') + '. The others are folded in each section. ' +
      (all ? 'Values are medians with the min – max range below. ' : '') +
      'Run dots show each run\'s difference from ' + config.har1.label + ' on one shared scale; click a dot to compare that run.';
  }
  const toggle = document.getElementById('allMetricsToggle');
  if (toggle) toggle.setAttribute('aria-pressed', String(view.showAll));
}

// The chart marker of a metric, when it has one.
const markerKinds = {
  'First Visual Change': 'fvc',
  'First Contentful Paint': 'fcp',
  'Largest Contentful Paint': 'lcp',
  'Speed Index': 'si'
};

// Pointing at a metric highlights it everywhere: card, verdict, table
// row and its marker on the chart.
function linkMetric(label, on) {
  for (const el of document.querySelectorAll('[data-metric]')) {
    if (el.dataset.metric === label) el.classList.toggle('is-linked', on);
  }
  const kind = markerKinds[label];
  if (kind) {
    for (const el of document.querySelectorAll('#visualProgress .vp-marker--' + kind)) el.classList.toggle('is-linked', on);
  }
}

// Scroll to the row of a metric and flash it. Clears the filters that
// would hide the row.
function showMetric(label) {
  const findRow = () => [...document.querySelectorAll('#metricsTableContent tr[data-metric]')]
    .find(tr => tr.dataset.metric === label);
  if (!findRow()) {
    view.query = '';
    const row = metricRowsOnly(view.rows).find(r => r.label === label);
    if (row) view.expanded.add(row.section);
    const search = document.getElementById('metricSearch');
    if (search) search.value = '';
    renderMetricsTable();
  }
  const row = findRow();
  if (!row) return;
  row.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  row.classList.remove('metric-flash');
  void row.offsetWidth;
  row.classList.add('metric-flash');
}

function setMetricsQuery(query) {
  view.query = query;
  renderMetricsTable();
}

// "Show all metrics" toggle for the metrics table. By default each
// section shows only the metrics that changed, so a long metric list
// collapses to just the things that actually moved. Persists the
// choice so the page comes back the way the user left it.
function toggleAllMetrics() {
  view.showAll = !view.showAll;
  storeFlag('compare.showAllMetrics', view.showAll);
  renderMetricsTable();
}

// Show or fold the unchanged metrics of one section.
function toggleMetricSection(label) {
  if (view.expanded.has(label)) view.expanded.delete(label);
  else view.expanded.add(label);
  renderMetricsTable();
}

function requestType(url) {
  const path = url.split(/[?#]/)[0].toLowerCase();
  if (/\.css$/.test(path) || /only=styles/.test(url)) return 'css';
  if (/\.m?js$/.test(path) || /only=scripts|load\.php/.test(url)) return 'js';
  if (/\.(png|jpe?g|gif|svg|webp|avif|ico)$/.test(path)) return 'image';
  if (/\.(woff2?|ttf|otf)$/.test(path)) return 'font';
  return 'other';
}

function renderRequests(r1, r2) {
  const config = view.config;
  const section = document.getElementById('requestsSection');
  // At the moment we only test this if you test the same URL
  // But we should find a better way to do it in the future
  const show = r1.px.url === r2.px.url;
  if (section) section.hidden = !show;
  if (!show) return false;

  const all = view.mode === 'all';
  const { run1, run2 } = view.selected;
  const pages = (runs, run) => (all ? runs.map(r => r.run - 1) : [run - 1]);
  const changes = compareRequests(
    requestSizes(config.har1.har, pages(view.runs1, run1), config.stripVersion),
    requestSizes(config.har2.har, pages(view.runs2, run2), config.stripVersion)
  );
  parseTemplate('requestsTemplate', {
    ...buildRequestView(changes, { all, filter: view.requestFilter, min: view.requestMin, sort: view.requestSort }),
    sort: view.requestSort,
    labelA: config.har1.label + (all ? '' : ' run ' + run1),
    labelB: config.har2.label + (all ? '' : ' run ' + run2)
  }, 'requestsContent');

  const note = document.getElementById('requestsNote');
  if (note) {
    note.textContent = all
      ? 'Median transfer size of each URL across the runs that requested it.'
      : 'Transfer size in ' + config.har1.label + ' run ' + run1 + ' and ' + config.har2.label + ' run ' + run2 + '.';
  }
  const min = document.getElementById('requestMinLabel');
  if (min) min.textContent = 'Hide size changes smaller than ' + (view.requestMin ? formatBytes(view.requestMin) : '0 B');
  return true;
}

// Summary, filter chips and rows for the request changes.
function buildRequestView(changes, { all, filter, min, sort }) {
  const visible = changes.filter(c => c.kind === 'new' || c.kind === 'removed' || Math.abs(c.diff) >= min);
  const filters = [['all', 'All'], ['increased', 'Bigger'], ['decreased', 'Smaller'], ['new', 'New'], ['removed', 'Removed']]
    .map(([id, label]) => ({
      id, label, active: filter === id,
      count: id === 'all' ? visible.length : visible.filter(c => c.kind === id).length
    }));
  const maxDiff = Math.max(...changes.map(c => Math.abs(c.diff)), 1);
  const sign = n => (n > 0 ? '+' : '−');
  const seen = s => (all && s.seen < s.runs ? ' · ' + s.seen + '/' + s.runs + ' runs' : '');
  const rows = visible
    .filter(c => filter === 'all' || c.kind === filter)
    .sort((x, y) => (sort === 'url' ? x.url.localeCompare(y.url) : Math.abs(y.diff) - Math.abs(x.diff)))
    .map(c => ({
      url: c.url,
      type: requestType(c.url),
      aText: c.a ? formatBytes(c.a.size) + seen(c.a) : '—',
      bText: c.b ? formatBytes(c.b.size) + seen(c.b) : '—',
      cls: c.diff > 0 ? 'worse' : 'better',
      dText: c.kind === 'new' ? 'New' : c.kind === 'removed' ? 'Removed' : sign(c.diff) + formatBytes(Math.abs(c.diff)),
      w: Math.max(Math.round((Math.abs(c.diff) / maxDiff) * 100), 2)
    }));
  const total = (kind, f) => changes.filter(c => c.kind === kind).reduce((sum, c) => sum + f(c), 0);
  const count = kind => changes.filter(c => c.kind === kind).length;
  const summary = [
    { label: 'New (' + count('new') + ')', value: '+' + formatBytes(total('new', c => c.b.size)), cls: 'worse' },
    { label: 'Removed (' + count('removed') + ')', value: '−' + formatBytes(total('removed', c => c.a.size)), cls: 'better' },
    { label: 'Increased (' + count('increased') + ')', value: '+' + formatBytes(total('increased', c => c.diff)), cls: 'worse' },
    { label: 'Decreased (' + count('decreased') + ')', value: '−' + formatBytes(-total('decreased', c => c.diff)), cls: 'better' }
  ];
  return { summary, filters, rows };
}

function setRequestFilter(filter) {
  view.requestFilter = filter;
  renderRequests(view.runs1[view.selected.run1 - 1], view.runs2[view.selected.run2 - 1]);
}

function setRequestSort(sort) {
  view.requestSort = sort;
  renderRequests(view.runs1[view.selected.run1 - 1], view.runs2[view.selected.run2 - 1]);
}

function setRequestMin(bytes) {
  view.requestMin = bytes;
  renderRequests(view.runs1[view.selected.run1 - 1], view.runs2[view.selected.run2 - 1]);
}

// Captures — final screenshot, video, link back to the per-run
// result page.
function renderCaptures(r1, r2) {
  const config = view.config;
  const { run1, run2 } = view.selected;
  const side = (key, label, r) => ({
    key, label,
    screenshot: r.px.meta.screenshot,
    video: r.px.meta.video,
    result: r.px.meta.result
  });
  const sides = [side(1, config.har1.label + ' run ' + run1, r1), side(2, config.har2.label + ' run ' + run2, r2)];
  const has = sides.some(s => s.screenshot || s.video || s.result);
  const target = document.getElementById('capturesContent');
  if (!has) {
    if (target) target.innerHTML = '';
    return false;
  }
  parseTemplate('capturesTemplate', { sides }, 'capturesContent');
  return true;
}
