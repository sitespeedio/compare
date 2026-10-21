import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadPageXray, loadScripts, readHar } from './helpers.js';

test('the waterfall gets the selected run as a number', async () => {
  let options;
  const { addWaterfall } = loadScripts(['generate'], {
    document: { getElementById: () => ({}) },
    compareWaterfall: { render: (har, el, opts) => { options = opts; return Promise.resolve({}); } },
    addTimelineWaterfall: () => {},
    addDrawingLayer: () => {}
  });
  // <select> values are strings.
  await addWaterfall({}, '2', 'har1', 3000);
  assert.equal(options.runIndex, 2);
  assert.equal(options.endTimeMs, 3000);
});

test('error messages are shown as text', () => {
  const message = {};
  const { errorMessage } = loadScripts(['ux'], {
    document: { getElementById: () => message }
  });
  errorMessage('<img src=x onerror=alert(1)>');
  assert.equal(message.textContent, '<img src=x onerror=alert(1)>');
  assert.equal(message.innerHTML, undefined);
});

function run(n, px) {
  return { run: n, page: { pageTimings: {} }, px: { meta: {}, ...px } };
}

test('the metrics table shows Core Web Vitals with a Δ', () => {
  const context = loadScripts(['stats', 'ux', 'metrics', 'templates']);
  const runs1 = [run(1, { googleWebVitals: { firstContentfulPaint: 800, largestContentfulPaint: 1500, totalBlockingTime: 40, cumulativeLayoutShift: 0.05641193152186011 } })];
  const runs2 = [run(1, { googleWebVitals: { firstContentfulPaint: 600, largestContentfulPaint: 2100, totalBlockingTime: 40, cumulativeLayoutShift: 0.1 } })];
  const rows = context.compareMetrics(runs1, runs2, { allRuns: false, runA: 1, runB: 1 });
  const html = context.metricsTableTemplate({
    rows: rows.map(r => (r.section === true ? { sectionRow: true, label: r.label } : { ...r, showDots: false })),
    labelA: 'A', labelB: 'B', referenceLabel: 'A'
  });
  assert.match(html, /First Contentful Paint<\/th><td>800 ms<span class="range"><\/span><\/td><td>600 ms<span class="range"><\/span><\/td><td><span class="pill pill--better">−200 ms \(−25%\)/);
  assert.match(html, /Largest Contentful Paint<\/th><td>1\.500 s.*?<span class="pill pill--worse">\+600 ms \(\+40%\)/);
  assert.match(html, /Total Blocking Time<\/th><td>40 ms.*?<span class="pill pill--same">no change/);
  assert.match(html, /Cumulative Layout Shift<\/th><td>0\.056.*?<td>0\.100.*?\+0\.044 \(\+77%\)/);
});

test('in all runs mode only significant changes are coloured', () => {
  const PageXray = loadPageXray();
  const context = loadScripts(['stats', 'ux', 'metrics', 'templates'], { PageXray });
  const runs1 = context.buildRuns(readHar('sitespeed-chrome-wikipedia-2026-10-20.har.gz'));
  const runs2 = context.buildRuns(readHar('sitespeed-chrome-wikipedia-2026-10-21.har.gz'));
  const rows = context.compareMetrics(runs1, runs2, { allRuns: true });
  const html = context.metricsTableTemplate({
    rows: rows.filter(r => r.section !== true).map(r => ({ ...r, showDots: r.significant, dotsA: [], dotsB: [] })),
    labelA: 'A median', labelB: 'B median', referenceLabel: 'A median'
  });
  assert.match(html, /<th scope="row">Total Blocking Time<\/th><td>68 ms<span class="range">66 ms – 74 ms<\/span>.*?pill--worse">\+9 ms \(\+13%\)<\/span><span class="range">significant · p 0\.032/);
  assert.match(html, /<th scope="row">Speed Index<\/th>.*?pill--same">\+12 ms \(\+1%\)<\/span><span class="range">not significant · p 0\.730/);
});

test('run dots sit on one shared ±50% scale and can be clicked', () => {
  const context = loadScripts(['templates']);
  const html = context.metricsTableTemplate({
    rows: [{
      label: 'Speed Index', aText: '1.30 s', bText: '1.31 s', aRange: '', bRange: '', cls: 'same', dText: '', pText: '',
      showDots: true, reference: 1000,
      dotsA: [{ run: 1, value: 1000, text: '1.00 s' }, { run: 2, value: 2000, text: '2.00 s' }],
      dotsB: [{ run: 1, value: 750, text: '750 ms' }]
    }],
    labelA: 'A', labelB: 'B', referenceLabel: 'A', runA: 2
  });
  assert.match(html, /run-dot run-dot--1" data-x="50\.0" data-action="pick-run" data-side="1" data-run="1"/);
  // +100% is beyond the scale: drawn at the edge as a clipped square.
  assert.match(html, /run-dot run-dot--1 run-dot--selected run-dot--clipped" data-x="100\.0"/);
  assert.match(html, /run-dot run-dot--2" data-x="25\.0"/);
});

test('templates position elements with data attributes, not inline styles', () => {
  const source = readFileSync(new URL('../public/js/compare/templates.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /style="/);
});

test('the summary keeps the upload inputs for both HAR files', () => {
  const context = loadScripts(['templates']);
  const html = context.summaryTemplate({
    url: 'a.com', details: '', modeBar: false,
    sides: [{ key: 1, label: '<b>A</b>', when: '', runs: '' }, { key: 2, label: 'B', when: '', runs: '' }],
    verdict: { cls: 'same', tag: 'x', title: '', text: '', items: [] }, cards: []
  });
  assert.match(html, /id="har1upload"/);
  assert.match(html, /id="har2upload"/);
  assert.match(html, /&lt;b&gt;A&lt;\/b&gt;/);
});

test('the result header links to sections that exist', () => {
  const context = loadScripts(['templates']);
  const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const templates = readFileSync(new URL('../public/js/compare/templates.js', import.meta.url), 'utf8');
  const ids = ['summary', 'timelineHeader', 'waterfallHeader', 'metricsHeader', 'requestDiffHeader', 'capturesHeader'];
  const html = context.resultHeaderTemplate({ sections: ids.map(id => ({ id, label: id })) });
  for (const id of ids) {
    assert.match(html, new RegExp(`href="#${id}"`));
    assert.ok(index.includes(`id="${id}"`) || templates.includes(`id="${id}"`), id);
  }
});

test('the request view hides small changes but keeps new and removed requests', () => {
  const context = loadScripts(['stats', 'ux', 'har', 'generate']);
  const changes = [
    { url: 'https://a.com/small.js', a: { size: 5000 }, b: { size: 5400 }, diff: 400, kind: 'increased' },
    { url: 'https://a.com/smaller.png', a: { size: 5000 }, b: { size: 2952 }, diff: -2048, kind: 'decreased' },
    { url: 'https://a.com/new.css', b: { size: 0 }, diff: 0, kind: 'new' },
    { url: 'https://a.com/gone.js', a: { size: 3072 }, diff: -3072, kind: 'removed' }
  ];
  const v = context.buildRequestView(changes, { all: false, filter: 'all', min: 1000, sort: 'change' });
  assert.deepEqual(Array.from(v.rows, r => r.dText), ['Removed', '−2.0 KB', 'New']);
  assert.deepEqual(Array.from(v.summary, s => s.label + ' ' + s.value),
    ['New (1) +0 B', 'Removed (1) −3.0 KB', 'Increased (1) +400 B', 'Decreased (1) −2.0 KB']);
  assert.equal(v.filters.find(f => f.id === 'increased').count, 0);
});
