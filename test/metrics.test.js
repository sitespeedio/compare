import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadPageXray, loadScripts, readHar } from './helpers.js';

// The result page shows these metrics for a sitespeed.io HAR with CPU,
// Core Web Vitals and visual metrics. A redesign must keep all of them.
// Logo is missing because the fixtures have no Logo metric.
const expected = {
  Setup: ['Run', 'URL', 'Date', 'Browser', 'Connectivity'],
  Content: ['Content', 'Total', 'HTML', 'CSS', 'JavaScript', 'Image'],
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
  CPU: [
    'CPU', 'Max Potential FID', 'Total CPU Long Tasks',
    'CPU time spent by category', 'CPU Events'
  ],
  Captures: ['Captures', 'Screenshot', 'Video', 'Extra'],
  'First and third party': [
    'First Party vs Third Party content',
    'First party requests', 'First party transfer size',
    'First party content size', 'First party cookies',
    'Third party requests', 'Third party transfer size',
    'Third party content size', 'Third party cookies'
  ],
  'Other sections': [
    'Visual Progress', 'Filmstrip', 'Domains',
    'Request/response transfer size difference (larger than 1 KB)',
    'Summary of request/response difference',
    'New', 'Removed', 'Increased', 'Decreased'
  ]
};

const PageXray = loadPageXray();
const context = loadScripts(['ux', 'har', 'filmstrip', 'templates']);
const har1 = readHar('sitespeed-chrome-wikipedia-2026-10-20.har.gz');
const har2 = readHar('sitespeed-chrome-wikipedia-2026-10-21.har.gz');
const p1 = PageXray.convertIndex(har1, 0, {});
const p2 = PageXray.convertIndex(har2, 0, {});

// Render every section with the same data generate.js passes.
function renderPage() {
  const config = { har1: { har: har1, run: 0, label: 'A' }, har2: { har: har2, run: 0, label: 'B' } };
  const runs = har => har.log.pages.map((_, i) => ({ id: i, selected: i === 0 ? 'selected' : '', show: i + 1 }));
  const cpu = (p, key) => context.objectPropertiesToArray(p.cpu[key]);
  const requestDiff = context.getUniqueRequests(har1, 0, har2, 0, {});
  const filmstrip = context.getFilmstrip(har1, 0, har2, 0);
  return [
    context.resultHeaderTemplate({ p1, p2, filmstrip }),
    context.pageXrayTemplate({
      p1, p2, config, runs1: runs(har1), runs2: runs(har2),
      cpuCategories1: cpu(p1, 'categories'), cpuCategories2: cpu(p2, 'categories'),
      cpuEvents1: cpu(p1, 'events'), cpuEvents2: cpu(p2, 'events')
    }),
    context.filmstripTemplate({ config, filmstrip }),
    context.visualProgressTemplate({ p1, p2, config }),
    context.thirdPartyTemplate({ p1, p2, config }),
    context.domainsTemplate({ domains: context.getAllDomains(p1, p2), config }),
    context.requestDiffTemplate({ requestDiff, total: context.getTotalDiff(requestDiff), config })
  ].join('');
}

// The text of every element, for example "Speed Index" or "New (1)".
const texts = renderPage()
  .split(/<[^>]+>/)
  .map(s => s.replace(/&nbsp;/g, ' ').trim())
  .filter(Boolean);
const shows = label => texts.some(t => t === label || t.startsWith(label + ' ('));

for (const [section, labels] of Object.entries(expected)) {
  test(`the result page shows ${section}`, () => {
    assert.deepEqual(labels.filter(label => !shows(label)), []);
  });
}

test('Total Blocking Time shows in Core Web Vitals and in CPU', () => {
  assert.equal(texts.filter(t => t === 'Total Blocking Time').length, 2);
});

test('the CPU breakdowns show every category and event', () => {
  for (const p of [p1, p2]) {
    const names = [...Object.keys(p.cpu.categories), ...Object.keys(p.cpu.events)];
    assert.ok(names.length > 10);
    assert.deepEqual(names.filter(name => !shows(name)), []);
  }
});

test('the filmstrip uses the frames from the sitespeed.io result', () => {
  const filmstrip = context.getFilmstrip(har1, 0, har2, 0);
  assert.ok(filmstrip.frames1.length > 10);
  assert.match(filmstrip.frames1[0].img, /\/data\/filmstrip\/1\/ms_000000\.jpg$/);
});
