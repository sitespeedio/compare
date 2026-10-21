/* global PageXray, median, mannWhitneyP, benjaminiHochberg, formatBytes, formatTime */
/* exported buildRuns, canCompareAllRuns, medianRun, isOutlierRun, compareMetrics, MIN_EFFECT, SINGLE_RUN_MIN_EFFECT, ADJUST_MIN_RUNS */

// A change must be significant and at least this big (percent) to
// count in the summary. The table still shows every significant change.
const MIN_EFFECT = 2;
// Single runs have no test, so the summary needs a bigger change.
const SINGLE_RUN_MIN_EFFECT = 5;
// With fewer runs the smallest possible p-value (0.0079 for 5 + 5) is too
// big for the Benjamini-Hochberg adjustment, and real changes get lost.
const ADJUST_MIN_RUNS = 10;

// One entry per page (run) in the HAR.
function buildRuns(har, firstParty) {
  return har.log.pages.map((page, i) => ({
    run: i + 1,
    page,
    px: PageXray.convertIndex(har, i, { firstParty })
  }));
}

// Medians only make sense for runs of the same URL from two different HARs.
function canCompareAllRuns(har1, har2, runs1, runs2) {
  const oneUrl = runs => new Set(runs.map(r => r.px.url)).size === 1;
  return har1 !== har2 && runs1.length > 1 && runs2.length > 1 && oneUrl(runs1) && oneUrl(runs2);
}

const pick = (...path) => run => path.reduce((o, key) => (o == null ? undefined : o[key]), run);

// The run metric that picks the median run and finds outliers.
function rankMetric(runs) {
  const candidates = [
    pick('px', 'visualMetrics', 'SpeedIndex'),
    pick('px', 'googleWebVitals', 'firstContentfulPaint'),
    pick('page', 'pageTimings', 'onLoad')
  ];
  return candidates.find(get => runs.every(r => typeof get(r) === 'number')) || (() => 0);
}

function medianRun(runs) {
  const get = rankMetric(runs);
  return runs.slice().sort((x, y) => get(x) - get(y))[(runs.length - 1) >> 1].run;
}

function isOutlierRun(runs, run) {
  const get = rankMetric(runs);
  const mid = median(runs.map(get));
  return mid > 0 && Math.abs(get(runs[run - 1]) - mid) > 0.25 * mid;
}

const fmtMs = v => formatTime(v);
const fmtBytes = v => formatBytes(v);
const fmtCount = v => String(Math.round(v * 100) / 100);
const fmtCLS = v => v.toFixed(3);
const typeNames = {
  html: 'HTML', css: 'CSS', javascript: 'JavaScript', image: 'Image',
  font: 'Font', favicon: 'Favicon', svg: 'SVG', plain: 'Plain text',
  json: 'JSON', other: 'Other'
};

// Every metric the result page shows, grouped in sections.
function metricDefs(runs) {
  const keysOf = get => [...new Set(runs.flatMap(r => Object.keys(get(r) || {})))];
  const defs = [];
  let section = '';
  const sec = label => {
    section = label;
    defs.push({ section: true, label });
  };
  const add = (label, get, fmt) => defs.push({ label, get, fmt, section });
  const type = t => typeNames[t] || t;

  sec('Content');
  add('Requests', pick('px', 'requests'), fmtCount);
  add('Transfer size', pick('px', 'transferSize'), fmtBytes);
  add('Content size', pick('px', 'contentSize'), fmtBytes);
  for (const t of keysOf(pick('px', 'contentTypes'))) {
    add(type(t) + ' requests', pick('px', 'contentTypes', t, 'requests'), fmtCount);
    add(type(t) + ' transfer size', pick('px', 'contentTypes', t, 'transferSize'), fmtBytes);
    add(type(t) + ' content size', pick('px', 'contentTypes', t, 'contentSize'), fmtBytes);
  }

  sec('Timings');
  add('Time to first byte', pick('px', 'googleWebVitals', 'ttfb'), fmtMs);
  add('DOMContentLoaded', pick('page', 'pageTimings', 'onContentLoad'), fmtMs);
  add('Load event', pick('page', 'pageTimings', 'onLoad'), fmtMs);

  sec('Render blocking');
  const recalc = (milestone, key) => pick('px', 'renderBlocking', 'recalculateStyle', milestone, key);
  add('Style recalc elements (FCP)', recalc('beforeFCP', 'elements'), fmtCount);
  add('Style recalc time (FCP)', recalc('beforeFCP', 'durationInMillis'), fmtMs);
  add('Style recalc elements (LCP)', recalc('beforeLCP', 'elements'), fmtCount);
  add('Style recalc time (LCP)', recalc('beforeLCP', 'durationInMillis'), fmtMs);
  add('Render blocking requests', pick('px', 'renderBlocking', 'blocking'), fmtCount);
  add('Potentially blocking requests', pick('px', 'renderBlocking', 'potentiallyBlocking'), fmtCount);
  add('In body parser blocking requests', pick('px', 'renderBlocking', 'in_body_parser_blocking'), fmtCount);

  sec('Visual metrics');
  [
    ['First Visual Change', 'FirstVisualChange'], ['Largest Image', 'LargestImage'],
    ['Logo', 'Logo'], ['Heading', 'Heading'], ['Speed Index', 'SpeedIndex'],
    ['Last Visual Change', 'LastVisualChange'], ['Visual Readiness', 'VisualReadiness'],
    ['Visual Complete 85%', 'VisualComplete85'], ['Visual Complete 95%', 'VisualComplete95'],
    ['Visual Complete 99%', 'VisualComplete99']
  ].forEach(([label, key]) => add(label, pick('px', 'visualMetrics', key), fmtMs));

  sec('Core Web Vitals');
  add('First Contentful Paint', pick('px', 'googleWebVitals', 'firstContentfulPaint'), fmtMs);
  add('Largest Contentful Paint', pick('px', 'googleWebVitals', 'largestContentfulPaint'), fmtMs);
  add('Total Blocking Time', pick('px', 'googleWebVitals', 'totalBlockingTime'), fmtMs);
  add('Cumulative Layout Shift', pick('px', 'googleWebVitals', 'cumulativeLayoutShift'), fmtCLS);

  sec('CPU');
  add('Total Blocking Time (long tasks)', pick('px', 'cpu', 'longTasks', 'totalBlockingTime'), fmtMs);
  add('Max Potential FID', pick('px', 'cpu', 'longTasks', 'maxPotentialFid'), fmtMs);
  add('Total CPU Long Tasks', pick('px', 'cpu', 'longTasks', 'tasks'), fmtCount);
  add('Long task duration', pick('px', 'cpu', 'longTasks', 'totalDuration'), fmtMs);

  sec('CPU time spent by category');
  for (const key of keysOf(pick('px', 'cpu', 'categories')).sort()) {
    add(key, pick('px', 'cpu', 'categories', key), fmtMs);
  }
  sec('CPU events');
  for (const key of keysOf(pick('px', 'cpu', 'events')).sort()) {
    add(key, pick('px', 'cpu', 'events', key), fmtMs);
  }

  // PageXray leaves out the totals when a party has no requests, so
  // add up the content types instead.
  const partyTotal = (party, key) => run => {
    const p = run.px[party];
    if (!p) return undefined;
    if (typeof p[key] === 'number') return p[key];
    return Object.values(p.contentTypes || {}).reduce((sum, t) => sum + (t[key] || 0), 0);
  };
  for (const [party, title] of [['firstParty', 'First party'], ['thirdParty', 'Third party']]) {
    sec(title);
    add(title + ' requests', partyTotal(party, 'requests'), fmtCount);
    add(title + ' transfer size', partyTotal(party, 'transferSize'), fmtBytes);
    add(title + ' content size', partyTotal(party, 'contentSize'), fmtBytes);
    add(title + ' cookies', pick('px', party, 'cookies'), fmtCount);
    for (const t of keysOf(pick('px', party, 'contentTypes'))) {
      add(title + ' ' + type(t) + ' requests', pick('px', party, 'contentTypes', t, 'requests'), fmtCount);
      add(title + ' ' + type(t) + ' transfer size', pick('px', party, 'contentTypes', t, 'transferSize'), fmtBytes);
      add(title + ' ' + type(t) + ' content size', pick('px', party, 'contentTypes', t, 'contentSize'), fmtBytes);
    }
  }

  sec('Domains');
  for (const domain of keysOf(pick('px', 'domains'))) {
    const name = domain || '(no host name)';
    add(name + ' requests', pick('px', 'domains', domain, 'requests'), fmtCount);
    add(name + ' transfer size', pick('px', 'domains', domain, 'transferSize'), fmtBytes);
    for (const timing of keysOf(pick('px', 'domains', domain, 'timings'))) {
      add(name + ' ' + timing, pick('px', 'domains', domain, 'timings', timing), fmtMs);
    }
  }
  return defs;
}

const signOf = n => (n > 0 ? '+' : '−');

/**
 * Compare every metric. With allRuns, values are medians and a change
 * is significant when a Mann-Whitney U test gives p < 0.05. With
 * ADJUST_MIN_RUNS or more runs on each side, the p-values are adjusted
 * for the number of metrics (Benjamini-Hochberg). Without allRuns,
 * runA and runB (1-based) are compared directly. Every metric is
 * "lower is better".
 */
function compareMetrics(runsA, runsB, { allRuns, runA, runB }) {
  const defs = metricDefs(runsA.concat(runsB));
  const values = (def, runs) => runs
    .map(r => ({ run: r.run, value: def.get(r) }))
    .filter(v => typeof v.value === 'number' && isFinite(v.value));
  // Metrics with the same value in every run are not tested.
  const tested = defs.map(def => {
    if (!allRuns || def.section === true) return null;
    const numbers = runs => values(def, runs).map(v => v.value);
    const a = numbers(runsA);
    const b = numbers(runsB);
    return new Set(a.concat(b)).size > 1 ? mannWhitneyP(a, b) : null;
  });
  const adjust = allRuns && runsA.length >= ADJUST_MIN_RUNS && runsB.length >= ADJUST_MIN_RUNS;
  const adjusted = adjust ? benjaminiHochberg(tested) : tested;
  const rows = [];
  for (const [i, def] of defs.entries()) {
    if (def.section === true) {
      rows.push(def);
      continue;
    }
    const valuesA = values(def, runsA);
    const valuesB = values(def, runsB);
    if (!valuesA.length && !valuesB.length) continue;

    const numbersA = valuesA.map(v => v.value);
    const numbersB = valuesB.map(v => v.value);
    let a, b, p = null;
    if (allRuns) {
      a = median(numbersA);
      b = median(numbersB);
      p = adjusted[i] === null ? mannWhitneyP(numbersA, numbersB) : adjusted[i];
    } else {
      a = def.get(runsA[runA - 1]);
      b = def.get(runsB[runB - 1]);
    }
    const has = typeof a === 'number' && typeof b === 'number';
    const delta = has ? b - a : 0;
    const changed = has && Math.abs(delta) > 1e-9;
    const pct = has && a ? Math.round((delta / a) * 100) : null;
    const significant = allRuns ? p !== null && p < 0.05 && changed : changed;
    const minEffect = allRuns ? MIN_EFFECT : SINGLE_RUN_MIN_EFFECT;
    // A change from 0 has no percentage: count it only when the test
    // backs it up.
    const notable = significant && (pct === null ? allRuns : Math.abs(pct) >= minEffect);
    const range = numbers => (allRuns && Math.min(...numbers) !== Math.max(...numbers)
      ? def.fmt(Math.min(...numbers)) + ' – ' + def.fmt(Math.max(...numbers)) : '');

    rows.push({
      label: def.label,
      section: def.section,
      a, b, delta, pct, p, changed, significant, notable,
      cls: !significant ? 'same' : delta > 0 ? 'worse' : 'better',
      aText: typeof a === 'number' ? def.fmt(a) : '—',
      bText: typeof b === 'number' ? def.fmt(b) : '—',
      aRange: range(numbersA),
      bRange: range(numbersB),
      dText: !has ? '—' : !changed ? 'no change'
        : signOf(delta) + def.fmt(Math.abs(delta)) + (pct ? ' (' + signOf(pct) + Math.abs(pct) + '%)' : ''),
      pText: p === null ? '' : (p < 0.05 ? 'significant' : 'not significant') + ' · p ' + (p < 0.001 ? '< 0.001' : p.toFixed(3)) + (adjust && adjusted[i] !== null ? ' (adjusted)' : ''),
      zero: numbersA.concat(numbersB).every(v => v === 0),
      reference: allRuns ? median(numbersA) : a,
      valuesA, valuesB,
      fmt: def.fmt
    });
  }
  return rows;
}
