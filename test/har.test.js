import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadScripts, readHar } from './helpers.js';

const { getLastTiming, requestSizes, compareRequests } = loadScripts(['stats', 'har']);
const chrome = readHar('browsertime-chrome-wikipedia.har.gz');
const firefox = readHar('browsertime-firefox-wikipedia.har.gz');

function page(id, entries) {
  return {
    log: {
      pages: [{ id, startedDateTime: '2026-01-01T00:00:00.000Z', pageTimings: {} }],
      entries: entries.map(([url, response]) => ({
        pageref: id,
        startedDateTime: '2026-01-01T00:00:00.000Z',
        time: 10,
        request: { url },
        response
      }))
    }
  };
}

test('getLastTiming covers every page timing', () => {
  for (let run = 0; run < chrome.log.pages.length; run++) {
    const last = getLastTiming(chrome, run);
    assert.ok(last > 0);
    for (const value of Object.values(chrome.log.pages[run].pageTimings)) {
      assert.ok(last >= value);
    }
  }
});

// Request changes between the first page of two HARs.
const changes = (har1, har2, stripVersion) =>
  compareRequests(requestSizes(har1, [0], stripVersion), requestSizes(har2, [0], stripVersion));

test('compareRequests finds no difference between a run and itself', () => {
  assert.equal(compareRequests(requestSizes(chrome, [2]), requestSizes(chrome, [2])).length, 0);
});

test('compareRequests classifies every change', () => {
  const diff = compareRequests(requestSizes(chrome, [0]), requestSizes(firefox, [0]));
  assert.ok(diff.length > 0);
  for (const c of diff) {
    const expected = !c.a ? 'new' : !c.b ? 'removed' : c.diff > 0 ? 'increased' : 'decreased';
    assert.equal(c.kind, expected, c.url);
  }
});

test('compareRequests reports small changes; the page hides them', () => {
  const har1 = page('p', [['https://a.com/x.js', { _transferSize: 5000 }]]);
  const har2 = page('p', [['https://a.com/x.js', { _transferSize: 5999 }]]);
  assert.deepEqual(Array.from(changes(har1, har2), c => [c.kind, c.diff]), [['increased', 999]]);
});

test('requestSizes prefers _transferSize, then bodySize, then content.size', () => {
  const har = page('p', [
    ['https://a.com/1', { _transferSize: 2000, bodySize: 9000 }],
    ['https://a.com/2', { bodySize: -1, content: { size: 3000 } }]
  ]);
  const sizes = requestSizes(har, [0]);
  assert.deepEqual(Object.keys(sizes).map(url => sizes[url].size), [2000, 3000]);
});

test('requestSizes takes the median of every run and counts the runs', () => {
  const har = readHar('sitespeed-chrome-wikipedia-2026-10-20.har.gz');
  const sizes = requestSizes(har, [0, 1, 2, 3, 4]);
  const html = sizes['https://en.wikipedia.org/wiki/Barack_Obama'];
  assert.equal(html.runs, 5);
  assert.equal(html.seen, 5);
  const perRun = [0, 1, 2, 3, 4].map(run => requestSizes(har, [run])['https://en.wikipedia.org/wiki/Barack_Obama'].size);
  assert.equal(html.size, perRun.sort((a, b) => a - b)[2]);
});

test('requestSizes counts the runs that requested a URL', () => {
  const har = page('p1', [['https://a.com/x.js', { _transferSize: 1000 }]]);
  har.log.pages.push({ id: 'p2', startedDateTime: '2026-01-01T00:00:00.000Z', pageTimings: {} });
  har.log.entries.push({ pageref: 'p2', startedDateTime: '2026-01-01T00:00:00.000Z', time: 10,
    request: { url: 'https://a.com/y.js' }, response: { _transferSize: 500 } });
  const sizes = requestSizes(har, [0, 1]);
  assert.deepEqual([sizes['https://a.com/x.js'].seen, sizes['https://a.com/x.js'].runs], [1, 2]);
  assert.equal(sizes['https://a.com/y.js'].size, 500);
});

test('stripVersion matches URLs that only differ in version', () => {
  const har1 = page('p', [['https://a.com/x.js?version=abc', { _transferSize: 5000 }]]);
  const har2 = page('p', [['https://a.com/x.js?version=def', { _transferSize: 5000 }]]);
  assert.equal(changes(har1, har2).length, 2);
  assert.equal(changes(har1, har2, true).length, 0);
});

test('stripVersion removes the whole version value', () => {
  const har1 = page('p', [['https://a.com/x.js?version=1.2.3&a=1', { _transferSize: 5000 }]]);
  const har2 = page('p', [['https://a.com/x.js?version=1.2.4&a=1', { _transferSize: 5000 }]]);
  assert.equal(changes(har1, har2, true).length, 0);
});

test('stripVersion keeps parameters that only end in version', () => {
  const har1 = page('p', [['https://a.com/x.js?subversion=1', { _transferSize: 5000 }]]);
  const har2 = page('p', [['https://a.com/x.js?subversion=2', { _transferSize: 5000 }]]);
  assert.equal(changes(har1, har2, true).length, 2);
});

test('compareRequests counts requests with unknown size as new or removed', () => {
  const har1 = page('p', [['https://a.com/removed.js', {}]]);
  const har2 = page('p', [['https://a.com/new.js', {}]]);
  assert.deepEqual(Array.from(changes(har1, har2), c => c.kind).sort(), ['new', 'removed']);
});
