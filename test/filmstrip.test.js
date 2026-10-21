import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadScripts, readHar } from './helpers.js';

const { getFilmstrip } = loadScripts(['filmstrip']);
const base = 'https://example.com/pages/a/data';

function sitespeedHar(visualProgress) {
  return {
    log: {
      pages: [{
        _meta: { screenshot: base + '/screenshots/1/afterPageCompleteCheck.jpg' },
        _visualMetrics: { VisualProgress: visualProgress }
      }]
    }
  };
}

test('getFilmstrip returns null without filmstrip data', () => {
  const har = readHar('en.wikipedia.org-webpagetest-chrome.har');
  assert.equal(getFilmstrip(har, 0, har, 0), null);
});

test('getFilmstrip only links to frames that exist on disk', () => {
  const har = sitespeedHar({ 0: 0, 2967: 40, 3267: 100 });
  const { frames1 } = getFilmstrip(har, 0, har, 0);
  const images = new Set(frames1.map(f => f.img));
  assert.deepEqual([...images], [
    base + '/filmstrip/1/ms_000000.jpg',
    base + '/filmstrip/1/ms_002967.jpg',
    base + '/filmstrip/1/ms_003267.jpg'
  ]);
});

test('getFilmstrip puts both HARs on the same time grid', () => {
  const fast = sitespeedHar({ 0: 0, 500: 100 });
  const slow = sitespeedHar({ 0: 0, 1200: 50, 2400: 100 });
  const filmstrip = getFilmstrip(fast, 0, slow, 0);
  assert.equal(filmstrip.stepMs, 100);
  assert.equal(filmstrip.maxMs, 2400);
  assert.equal(filmstrip.frames2.length, 25);
});

test('getFilmstrip gives both HARs the same number of frames', {
  todo: 'padFrames adds the last frame of the faster page after the grid end'
}, () => {
  const fast = sitespeedHar({ 0: 0, 500: 100 });
  const slow = sitespeedHar({ 0: 0, 1200: 50, 2400: 100 });
  const filmstrip = getFilmstrip(fast, 0, slow, 0);
  assert.equal(filmstrip.frames1.length, filmstrip.frames2.length);
});

test('getFilmstrip widens the step for long pages', () => {
  const har = sitespeedHar({ 0: 0, 60000: 100 });
  const { stepMs, frames1 } = getFilmstrip(har, 0, har, 0);
  assert.ok(stepMs > 100);
  assert.ok(frames1.length <= 121);
});
