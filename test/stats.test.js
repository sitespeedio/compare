import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadScripts } from './helpers.js';

const { median, mannWhitneyP, benjaminiHochberg } = loadScripts(['stats']);

test('median', () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 3, 2]), 2.5);
  assert.equal(median([]), undefined);
});

test('mannWhitneyP needs two values on each side', () => {
  assert.equal(mannWhitneyP([1], [2, 3]), null);
});

test('mannWhitneyP is 1 for identical samples', () => {
  assert.equal(mannWhitneyP([5, 5, 5], [5, 5, 5]), 1);
});

test('mannWhitneyP is exact for five runs each', () => {
  // Every value in B is larger: 2 of the 252 splits are this extreme.
  assert.equal(mannWhitneyP([1, 2, 3, 4, 5], [6, 7, 8, 9, 10]), 2 / 252);
  // Total Blocking Time in the 2026 fixtures.
  assert.equal(mannWhitneyP([68, 66, 74, 67, 74], [80, 76, 71, 77, 80]).toFixed(3), '0.032');
});

test('mannWhitneyP does not flag overlapping samples', () => {
  // First Visual Change in the 2026 fixtures, one outlier on each side.
  assert.equal(mannWhitneyP([1167, 1133, 1133, 1833, 1200], [1200, 1167, 1966, 1166, 1203]).toFixed(3), '0.365');
});

test('mannWhitneyP uses the normal approximation for many runs', () => {
  const a = Array.from({ length: 20 }, (_, i) => 100 + i);
  const b = Array.from({ length: 20 }, (_, i) => 110 + i);
  // U = 350, z = (350 - 200 - 0.5) / sqrt(20 * 20 * 41 / 12) = 4.04
  assert.equal(mannWhitneyP(a, b).toPrecision(2), '0.000053');
});

test('benjaminiHochberg adjusts for the number of tests and keeps the order', () => {
  const adjusted = benjaminiHochberg([0.01, 0.04, 0.03, 0.005, null]);
  assert.deepEqual(adjusted.map(p => (p === null ? null : p.toFixed(3))), ['0.020', '0.040', '0.040', '0.020', null]);
});
