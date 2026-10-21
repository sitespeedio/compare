import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadScripts } from './helpers.js';

function harWithPages(count) {
  const pages = Array.from({ length: count }, (_, i) => ({ id: 'page_' + i }));
  return { log: { pages, entries: [] } };
}

// Serve JSON from a URL map and resolve with the config that
// load.js gives to generate().
function loadWith(responses, start) {
  return new Promise((resolve, reject) => {
    const context = loadScripts(['gzip', 'load'], {
      fetch: async url =>
        url in responses
          ? { ok: true, json: async () => responses[url] }
          : { ok: false, statusText: 'Not Found' },
      generate: resolve,
      errorMessage: message => reject(new Error(message)),
      showUpload: () => {},
      console: { error: () => {} }
    });
    start(context);
  });
}

test('?config= loads both HARs from the config file', async () => {
  const config = await loadWith(
    {
      'https://e.com/config.json': {
        har1: { url: 'https://e.com/1.har', label: 'Before' },
        har2: { url: 'https://e.com/2.har', run: 2 },
        title: 'My title'
      },
      'https://e.com/1.har': harWithPages(1),
      'https://e.com/2.har': harWithPages(3)
    },
    context => context.loadFilesFromConfig('https://e.com/config.json')
  );
  assert.equal(config.har1.label, 'Before');
  assert.equal(config.har2.label, 'HAR2');
  assert.equal(config.har2.run, 1);
  assert.equal(config.title, 'My title');
});

test('a single HAR is compared with its own second run', async () => {
  const har = harWithPages(2);
  const config = await loadWith({ 'https://e.com/1.har': har }, context =>
    context.loadHARsFromConfig({ har1: { url: 'https://e.com/1.har' }, har2: {} })
  );
  assert.equal(config.har1.har, har);
  assert.equal(config.har2.har, har);
  assert.equal(config.har1.run, 0);
  assert.equal(config.har2.run, 1);
  assert.equal(config.har2.url, undefined);
});

test('a sitespeed.io result page URL loads its HAR', async () => {
  const config = await loadWith(
    { 'https://e.com/r/data/browsertime.har.gz': harWithPages(1) },
    context => {
      // Skip the gzip step; the stubbed fetch already returns JSON.
      context.isFileGzipped = () => false;
      context.loadHARsFromConfig({
        har1: { url: 'https://e.com/r/index.html' },
        har2: { url: 'https://e.com/r/' }
      });
    }
  );
  assert.equal(config.har1.url, 'https://e.com/r/index.html');
});

test('isBundle needs the explicit flag', () => {
  const { isBundle } = loadScripts(['gzip', 'load']);
  assert.equal(isBundle({ compareBundle: true, har1: {}, har2: {} }), true);
  assert.equal(isBundle({ har1: {}, har2: {} }), false);
  assert.equal(isBundle(null), false);
});
