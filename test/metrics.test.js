import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadPageXray, loadScripts, readHar } from './helpers.js';

// Every metric the result page showed before the redesign, and the
// labels it has now. Logo is missing because the fixtures have no Logo
// metric.
const expected = {
  // The old Run, URL, Date, Browser and Connectivity rows.
  Setup: ['en.wikipedia.org/wiki/Barack_Obama', 'Chrome 156.0.8078.47 · 4g', 'Run 1', 'Run 5'],
  // The old Total, HTML, CSS, JavaScript and Image rows.
  Content: [
    'Content', 'Requests', 'Transfer size', 'Content size',
    'HTML requests', 'HTML transfer size', 'HTML content size',
    'CSS requests', 'CSS transfer size', 'CSS content size',
    'JavaScript requests', 'JavaScript transfer size', 'JavaScript content size',
    'Image requests', 'Image transfer size'
  ],
  'Render blocking': [
    'Render blocking',
    'Style recalc elements (FCP)', 'Style recalc time (FCP)',
    'Style recalc elements (LCP)', 'Style recalc time (LCP)',
    'Render blocking requests', 'Potentially blocking requests',
    'In body parser blocking requests'
  ],
  'Visual metrics': [
    'Visual metrics', 'First Visual Change', 'Largest Image', 'Heading',
    'Speed Index', 'Last Visual Change', 'Visual Readiness'
  ],
  'Core Web Vitals': [
    'Core Web Vitals', 'First Contentful Paint', 'Largest Contentful Paint',
    'Total Blocking Time', 'Cumulative Layout Shift'
  ],
  // The CPU breakdown tables are now sections of their own.
  CPU: [
    'CPU', 'Total Blocking Time (long tasks)', 'Max Potential FID', 'Total CPU Long Tasks',
    'CPU time spent by category', 'CPU events'
  ],
  // Extra was the link to the result page.
  Captures: ['Captures', 'Video', 'Result page'],
  'First and third party': [
    'First party', 'First party requests', 'First party transfer size',
    'First party content size', 'First party cookies',
    'Third party', 'Third party requests', 'Third party transfer size',
    'Third party content size', 'Third party cookies'
  ],
  Domains: ['Domains', '(no host name) requests', '(no host name) transfer size'],
  'Request changes': ['New', 'Removed', 'Increased', 'Decreased'],
  Filmstrip: ['Filmstrip']
};

const PageXray = loadPageXray();
const context = loadScripts(['stats', 'ux', 'har', 'filmstrip', 'metrics', 'templates', 'generate'], { PageXray });
const har1 = readHar('sitespeed-chrome-wikipedia-2026-10-20.har.gz');
const har2 = readHar('sitespeed-chrome-wikipedia-2026-10-21.har.gz');
const runs1 = context.buildRuns(har1);
const runs2 = context.buildRuns(har2);

// Render the sections the way generate.js does, with every metric shown.
function renderPage() {
  const config = { har1: { har: har1, label: 'A' }, har2: { har: har2, label: 'B' } };
  const rows = context.compareMetrics(runs1, runs2, { allRuns: true });
  const px = runs1[0].px;
  const changes = context.compareRequests(context.requestSizes(har1, [0, 1, 2, 3, 4]), context.requestSizes(har2, [0, 1, 2, 3, 4]));
  return [
    context.summaryTemplate({
      url: px.url.replace(/^https?:\/\//, ''),
      details: px.meta.browser.name + ' ' + px.meta.browser.version + ' · ' + px.meta.connectivity,
      sides: [{ key: 1, label: 'A', when: '', runs: '' }, { key: 2, label: 'B', when: '', runs: '' }],
      modeBar: true, allowAll: true, mode: 'runs',
      runPickers: [{ key: 1, label: 'A', options: runs1.map(r => ({ value: r.run, text: 'Run ' + r.run })) }],
      verdict: { cls: 'same', tag: '', title: '', text: '', items: [] },
      cards: []
    }),
    context.metricsTableTemplate({
      rows: rows.map(r => (r.section === true ? { sectionRow: true, label: r.label } : { ...r, showDots: false })),
      labelA: 'A', labelB: 'B', referenceLabel: 'A'
    }),
    context.requestsTemplate({ ...context.buildRequestView(changes, { all: true, filter: 'all', min: 0, sort: 'change' }), labelA: 'A', labelB: 'B' }),
    context.capturesTemplate({
      sides: [runs1[0], runs2[0]].map((r, i) => ({ key: i + 1, label: 'run', screenshot: r.px.meta.screenshot, video: r.px.meta.video, result: r.px.meta.result }))
    }),
    context.filmstripTemplate({ config, filmstrip: context.getFilmstrip(har1, 0, har2, 0) })
  ].join('');
}

const html = renderPage();
// The text of every element, for example "Speed Index" or "New (1)".
const texts = html
  .split(/<[^>]+>/)
  .map(s => s.replace(/&nbsp;/g, ' ').trim())
  .filter(Boolean);
const shows = label => texts.some(t => t === label || t.startsWith(label + ' ('));
// In the metrics table a metric must be a row with a value, and a
// section a heading, not just text somewhere on the page.
const tableRows = new Set(Array.from(html.matchAll(/<th scope="row">([^<]*)<\/th><td>([^<]*)</g))
  .filter(m => m[2] !== '' && m[2] !== '—')
  .map(m => m[1]));
const tableSections = new Set(Array.from(html.matchAll(/<th colspan="5" scope="colgroup">([^<]*)<\/th>/g), m => m[1]));
const inTable = ['Content', 'Render blocking', 'Visual metrics', 'Core Web Vitals', 'CPU', 'First and third party', 'Domains'];
const sectionNames = ['Content', 'Render blocking', 'Visual metrics', 'Core Web Vitals', 'CPU',
  'CPU time spent by category', 'CPU events', 'First party', 'Third party', 'Domains'];

for (const [section, labels] of Object.entries(expected)) {
  test(`the result page shows ${section}`, () => {
    const missing = inTable.includes(section)
      ? labels.filter(label => (sectionNames.includes(label) ? !tableSections.has(label) : !tableRows.has(label)))
      : labels.filter(label => !shows(label));
    assert.deepEqual(missing, []);
  });
}

test('section headings in the table are not metrics', () => {
  for (const name of sectionNames) {
    assert.ok(tableSections.has(name), name);
    assert.ok(!tableRows.has(name), name);
  }
});

test('the CPU sections show every category and event', () => {
  for (const runs of [runs1, runs2]) {
    const names = [...Object.keys(runs[0].px.cpu.categories), ...Object.keys(runs[0].px.cpu.events)];
    assert.ok(names.length > 10);
    assert.deepEqual(names.filter(name => !tableRows.has(name)), []);
  }
});

test('the filmstrip uses the frames from the sitespeed.io result', () => {
  const filmstrip = context.getFilmstrip(har1, 0, har2, 0);
  assert.ok(filmstrip.frames1.length > 10);
  assert.match(filmstrip.frames1[0].img, /\/data\/filmstrip\/1\/ms_000000\.jpg$/);
});

test('all runs: Total Blocking Time is a significant regression, FCP is not', () => {
  const rows = context.compareMetrics(runs1, runs2, { allRuns: true });
  const row = label => rows.find(r => r.label === label);
  assert.equal(row('Total Blocking Time').p.toFixed(3), '0.032');
  assert.equal(row('Total Blocking Time').cls, 'worse');
  assert.equal(row('Total Blocking Time').notable, true);
  assert.equal(row('First Contentful Paint').significant, false);
  // Significant but under 2%: shown in the table, left out of the summary.
  assert.equal(row('Transfer size').significant, true);
  assert.equal(row('Transfer size').notable, false);
});

test('all runs: p-values are adjusted only with 10 runs or more on each side', () => {
  const few = context.compareMetrics(runs1, runs2, { allRuns: true });
  assert.ok(few.every(r => !String(r.pText || '').includes('adjusted')));
  // The 5 runs twice give 10 runs on each side.
  const many1 = runs1.concat(runs1);
  const many2 = runs2.concat(runs2);
  const rows = context.compareMetrics(many1, many2, { allRuns: true });
  const tbt = rows.find(r => r.label === 'Total Blocking Time');
  const raw = context.mannWhitneyP(tbt.valuesA.map(v => v.value), tbt.valuesB.map(v => v.value));
  assert.ok(tbt.p > raw);
  assert.match(tbt.pText, /\(adjusted\)$/);
});

test('single runs: an outlier run is flagged and differences need 5%', () => {
  assert.equal(context.medianRun(runs1), 5);
  assert.equal(context.isOutlierRun(runs1, 4), true);
  assert.equal(context.isOutlierRun(runs1, 1), false);
  const rows = context.compareMetrics(runs1, runs2, { allRuns: false, runA: 4, runB: 1 });
  const si = rows.find(r => r.label === 'Speed Index');
  assert.equal(si.dText, '−680 ms (−34%)');
  assert.equal(si.notable, true);
});

test('all runs needs two HAR files with several runs of one URL', () => {
  assert.equal(context.canCompareAllRuns(har1, har2, runs1, runs2), true);
  assert.equal(context.canCompareAllRuns(har1, har1, runs1, runs1), false);
  assert.equal(context.canCompareAllRuns(har1, har2, runs1.slice(0, 1), runs2), false);
});
