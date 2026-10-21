import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadScripts, readHar } from './helpers.js';

const { getLastTiming, getUniqueRequests, getTotalDiff } = loadScripts(['har']);
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

test('getUniqueRequests finds no difference between a run and itself', () => {
  assert.equal(getUniqueRequests(chrome, 2, chrome, 2, {}).length, 0);
});

test('getTotalDiff sums the request diff', () => {
  const diff = getUniqueRequests(chrome, 0, firefox, 0, {});
  const total = getTotalDiff(diff);
  assert.ok(diff.length > 0);
  assert.equal(total.new + total.removed + total.increased + total.decreased, diff.length);
  assert.equal(total.har2 - total.har1, total.diff);
});

test('getUniqueRequests ignores changes smaller than 1000 bytes', () => {
  const har1 = page('p', [['https://a.com/x.js', { _transferSize: 5000 }]]);
  const har2 = page('p', [['https://a.com/x.js', { _transferSize: 5999 }]]);
  assert.equal(getUniqueRequests(har1, 0, har2, 0, {}).length, 0);
});

test('getUniqueRequests prefers _transferSize, then bodySize, then content.size', () => {
  const har1 = page('p', [
    ['https://a.com/1', { _transferSize: 2000, bodySize: 9000 }],
    ['https://a.com/2', { bodySize: -1, content: { size: 3000 } }]
  ]);
  const har2 = page('p', []);
  const diff = getUniqueRequests(har1, 0, har2, 0, {});
  assert.deepEqual(Array.from(diff, d => d.har1), [2000, 3000]);
});

test('stripVersion matches URLs that only differ in version', () => {
  const har1 = page('p', [['https://a.com/x.js?version=abc', { _transferSize: 5000 }]]);
  const har2 = page('p', [['https://a.com/x.js?version=def', { _transferSize: 5000 }]]);
  assert.equal(getUniqueRequests(har1, 0, har2, 0, {}).length, 2);
  assert.equal(getUniqueRequests(har1, 0, har2, 0, { stripVersion: true }).length, 0);
});
