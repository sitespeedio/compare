import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

// The Content-Security-Policy in public/_headers blocks inline scripts
// and inline event handlers. These tests stop them from coming back.
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const scripts = readdirSync(new URL('../public/js/compare', import.meta.url))
  .map(name => `public/js/compare/${name}`);
const sources = ['index.html', ...scripts].map(path => [path, read(path)]);

test('the CSP blocks inline scripts', () => {
  assert.match(read('public/_headers'), /Content-Security-Policy: default-src 'self'; script-src 'self';/);
});

test('index.html has no inline scripts', () => {
  assert.doesNotMatch(read('index.html'), /<script(?![^>]*\bsrc=)[^>]*>/);
});

test('there are no inline event handlers', () => {
  for (const [path, source] of sources) {
    assert.doesNotMatch(source, /\son[a-z]+=["\\']/, path);
  }
});

test('every data-action has a handler', () => {
  const start = read('public/js/compare/start.js');
  for (const [path, source] of sources) {
    for (const [, action] of source.matchAll(/data-action="([^"]+)"/g)) {
      assert.match(start, new RegExp(`['\\s]${action}'?:`), `${path}: ${action}`);
    }
  }
});
