import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadScripts } from './helpers.js';

const { formatBytes, formatTime, formatURL } = loadScripts(['ux']);

test('formatBytes', () => {
  assert.equal(formatBytes(0), '0 B');
  assert.equal(formatBytes(512), '512 B');
  assert.equal(formatBytes(2048), '2.0 KB');
  assert.equal(formatBytes(3 * 1024 * 1024), '3.0 MB');
});

test('formatBytes shows N/A for unknown sizes', () => {
  assert.equal(formatBytes(undefined), 'N/A');
  assert.equal(formatBytes(null), 'N/A');
  assert.equal(formatBytes(-1), 'N/A');
});

test('formatTime', () => {
  assert.equal(formatTime(17.099), '17 ms');
  assert.equal(formatTime(1234), '1.234 s');
  assert.equal(formatTime(undefined), '');
});

test('formatURL shortens long URLs', () => {
  const long = 'https://example.com/' + 'a'.repeat(100);
  assert.equal(formatURL('https://example.com/'), 'https://example.com/');
  assert.equal(formatURL(long).length, 90);
});
