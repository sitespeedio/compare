import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadScripts } from './helpers.js';

test('the waterfall gets the selected run as a number', () => {
  let options;
  const { addWaterfall } = loadScripts(['generate'], {
    document: { getElementById: () => ({}) },
    compareWaterfall: { render: (har, el, opts) => { options = opts; } }
  });
  // <select> values are strings.
  addWaterfall({}, '2', 'har1', 3000);
  assert.equal(options.runIndex, 2);
  assert.equal(options.endTimeMs, 3000);
});

test('the request diff shows decreases with a minus sign', () => {
  const context = loadScripts(['ux', 'har', 'templates']);
  const requestDiff = [
    { url: 'https://a.com/smaller.js', har1: 5000, har2: 2952, diff: -2048 },
    { url: 'https://a.com/removed.js', har1: 3072, diff: -3072 }
  ];
  const html = context.requestDiffTemplate({
    requestDiff,
    total: context.getTotalDiff(requestDiff),
    config: { har1: { label: 'A' }, har2: { label: 'B' } }
  });
  assert.doesNotMatch(html, /green">(<b>)?N\/A/);
  assert.match(html, /green">-2\.0 KB/);
  assert.match(html, /Decreased \(1\)<\/td><td class="green">-2\.0 KB/);
  assert.match(html, /green"><b>-5\.0 KB/);
});

test('the request diff labels requests with unknown size', () => {
  const context = loadScripts(['ux', 'har', 'templates']);
  const requestDiff = [
    { url: 'https://a.com/new.js', har2: 0, diff: 0 },
    { url: 'https://a.com/removed.js', har1: 0, diff: -0 }
  ];
  const html = context.requestDiffTemplate({
    requestDiff,
    total: context.getTotalDiff(requestDiff),
    config: { har1: { label: 'A' }, har2: { label: 'B' } }
  });
  assert.match(html, /new\.js<\/a><\/td><td class="tabletext">N\/A<\/td><td class="tabletext">0 B<\/td><td class="tabletext red">New/);
  assert.match(html, /removed\.js<\/a><\/td><td class="tabletext">0 B<\/td><td class="tabletext">N\/A<\/td><td class="tabletext green">Removed/);
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

function pageXray(overrides) {
  return {
    url: 'https://a.com/',
    meta: { title: 'A', startedDateTime: '2026-01-01T00:00:00.000Z' },
    requests: 10,
    transferSize: 1000,
    contentSize: 2000,
    contentTypes: {},
    ...overrides
  };
}

test('the page x-ray table shows Core Web Vitals with a Δ', () => {
  const context = loadScripts(['ux', 'templates']);
  const runs = [{ id: 0, selected: 'selected', show: 1 }];
  const html = context.pageXrayTemplate({
    p1: pageXray({ googleWebVitals: { firstContentfulPaint: 800, largestContentfulPaint: 1500, totalBlockingTime: 40, cumulativeLayoutShift: 0.05641193152186011 } }),
    p2: pageXray({ googleWebVitals: { firstContentfulPaint: 600, largestContentfulPaint: 2100, totalBlockingTime: 40, cumulativeLayoutShift: 0.1 } }),
    config: { har1: { label: 'A' }, har2: { label: 'B' } },
    runs1: runs,
    runs2: runs
  });
  assert.match(html, /First Contentful Paint<\/td><td>800 ms<\/td><td>600 ms<\/td><td class="pageXrayDiff pageXrayDiff--better">−200 ms/);
  assert.match(html, /Largest Contentful Paint<\/td><td>1\.500 s<\/td><td>2\.100 s<\/td><td class="pageXrayDiff pageXrayDiff--worse">\+600 ms/);
  assert.match(html, /Total Blocking Time<\/td><td>40 ms<\/td><td>40 ms<\/td><td class="pageXrayDiff pageXrayDiff--same">no change/);
  assert.match(html, /Cumulative Layout Shift<\/td><td>0\.056<\/td><td>0\.100<\/td><td class="pageXrayDiff pageXrayDiff--worse">\+0\.044/);
});

test('the result header links to sections that exist', () => {
  const context = loadScripts(['ux', 'templates']);
  const p = pageXray({});
  const withFilmstrip = context.resultHeaderTemplate({ p1: p, p2: p, filmstrip: {} });
  assert.match(withFilmstrip, /href="#filmstripHeader"/);
  assert.doesNotMatch(context.resultHeaderTemplate({ p1: p, p2: p }), /filmstripHeader/);

  const requestDiff = context.requestDiffTemplate({ requestDiff: [], config: {} });
  const anchor = withFilmstrip.match(/href="#(requestDiff[^"]*)"/)[1];
  assert.match(requestDiff, new RegExp(`id="${anchor}"`));
});
