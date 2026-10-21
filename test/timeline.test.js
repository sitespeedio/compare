import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { loadScripts, readHar } from './helpers.js';

const { divergenceBands } = loadScripts(['timeline']);
const bands = (...args) => Array.from(divergenceBands(...args), b => [b.from, b.to]);

test('divergenceBands finds where the runs differ by 20 points or more', () => {
  const fast = { 0: 0, 500: 100 };
  const slow = { 0: 0, 1200: 50, 2400: 100 };
  // 500-1200: 100 vs 0, 1200-2400: 100 vs 50.
  assert.deepEqual(bands(fast, slow, 3000), [[500, 2400]]);
});

test('divergenceBands ignores small differences', () => {
  assert.deepEqual(bands({ 0: 0, 1000: 90, 1500: 100 }, { 0: 0, 1000: 85, 1600: 100 }, 2000), []);
});

test('divergenceBands splits separate ranges and stops at the end of the axis', () => {
  const a = { 0: 0, 100: 50, 300: 50, 600: 100 };
  const b = { 0: 0, 200: 50, 900: 100 };
  // 100-200: 50 vs 0, then 600-900: 100 vs 50, cut at 800.
  assert.deepEqual(bands(a, b, 800), [[100, 200], [600, 800]]);
});

test('divergenceBands needs visual progress on both sides', () => {
  assert.deepEqual(bands({ 0: 0, 100: 100 }, null, 1000), []);
});

test('divergenceBands on the 2026 fixtures: the outlier run renders late', () => {
  const vp = har => har.log.pages.map(p => p._visualMetrics.VisualProgress);
  const a = vp(readHar('sitespeed-chrome-wikipedia-2026-10-20.har.gz'));
  const b = vp(readHar('sitespeed-chrome-wikipedia-2026-10-21.har.gz'));
  // Run 5 of A against the slow run 3 of B: B is blank until 1966 ms and
  // stays at 61-62% (A is at 99%) until it reaches 95% at 2266 ms.
  assert.deepEqual(bands(a[4], b[2], 3500)[0], [1200, 2266]);
});

// A frame image with just what replaceMissingFrame reads.
function frameImage(src, { side, ms }) {
  const attrs = { src };
  const isCell = ms !== undefined;
  const cell = isCell && { classList: { contains: c => c === 'filmstrip-cell--har' + side } };
  const column = isCell && { dataset: { ms: String(ms) } };
  return {
    classList: { contains: c => c === 'timeline-frame' && !isCell },
    dataset: { side: String(side) },
    closest: sel => (sel === '.filmstrip-cell' ? cell : sel === '.filmstrip-column' ? column : null) || null,
    getAttribute: name => attrs[name],
    setAttribute: (name, value) => { attrs[name] = value; }
  };
}

test('a frame that does not load is replaced by the nearest frame that does', () => {
  const context = loadScripts(['timeline']);
  const state = vm.runInContext('timeline', context);
  // Run 1 of the Sweden test: VisualProgress has 1100 ms, the server has no image.
  state.sides = {
    1: { frames: [{ ms: 0, img: 'ms_000000' }, { ms: 1100, img: 'ms_001100' }, { ms: 1133, img: 'ms_001133' }] }
  };
  const cell = frameImage('ms_001100', { side: 1, ms: 1100 });
  context.replaceMissingFrame(cell);
  // 1133 ms is nearer than the blank frame at 0 ms.
  assert.equal(cell.getAttribute('src'), 'ms_001133');

  // The timeline frame skips the missing image too.
  state.t = 1110;
  const frame = frameImage('ms_001100', { side: 1 });
  context.replaceMissingFrame(frame);
  assert.equal(frame.getAttribute('src'), 'ms_001133');

  // On a tie, the earlier frame.
  state.sides[1].frames = [{ ms: 0, img: 'ms_000000' }, { ms: 1100, img: 'ms_001100' }, { ms: 2200, img: 'ms_002200' }];
  const tie = frameImage('ms_001100', { side: 1, ms: 1100 });
  context.replaceMissingFrame(tie);
  assert.equal(tie.getAttribute('src'), 'ms_000000');
});
