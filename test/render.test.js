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
