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

test('a gist larger than 1 MB is read from its raw URL', async () => {
  const config = await loadWith(
    {
      'https://api.github.com/gists/abc': {
        files: { 'c.json': { truncated: true, content: '{"har1":', raw_url: 'https://e.com/raw' } }
      },
      'https://e.com/raw': { har1: { url: 'https://e.com/1.har' }, har2: { url: 'https://e.com/2.har' } },
      'https://e.com/1.har': harWithPages(1),
      'https://e.com/2.har': harWithPages(1)
    },
    context => context.loadFilesFromGist('abc')
  );
  assert.equal(config.har1.url, 'https://e.com/1.har');
});

// Record which loader a paste reaches.
function paste(text) {
  const calls = [];
  const context = loadScripts(['gzip', 'load'], {
    showLoading: () => calls.push('loading'),
    generate: config => calls.push(['generate', config.har2.run]),
    errorMessage: message => calls.push(['error', message]),
    showUpload: () => {},
    console: { error: () => {} }
  });
  context.loadFilesFromGist = id => calls.push(['gist', id]);
  context.loadFilesFromConfig = url => calls.push(['config', url]);
  context.loadFromPaste(text);
  return calls;
}

test('pasting a HAR compares its first two runs', () => {
  const har = JSON.stringify(harWithPages(2));
  assert.deepEqual(paste(har), ['loading', ['generate', 1]]);
});

test('pasting a gist URL, gist id or config URL loads it', () => {
  assert.deepEqual(paste('https://gist.github.com/me/94e4d997a78e03b32b939fcea63eae8e'),
    ['loading', ['gist', '94e4d997a78e03b32b939fcea63eae8e']]);
  assert.deepEqual(paste(' 94e4d997a78e03b32b939fcea63eae8e\n'),
    ['loading', ['gist', '94e4d997a78e03b32b939fcea63eae8e']]);
  assert.deepEqual(paste('https://e.com/config.json'),
    ['loading', ['config', 'https://e.com/config.json']]);
});

test('pasting other text does nothing', () => {
  assert.deepEqual(paste('www.example.com/page.har'), []);
  assert.deepEqual(paste('hello'), []);
  assert.deepEqual(paste('12345'), []);
});

test('pasting broken JSON shows an error instead of loading forever', () => {
  const calls = paste('{"har1": {}}');
  assert.deepEqual(calls, ['loading', ['error', 'Malformed config file.']]);
});

// Run compareFromForm with the given form values.
function compare(url1, url2, stripVersion) {
  const calls = [];
  const fields = {
    harurl: { value: url1 },
    harurl2: { value: url2 },
    stripVersion: { checked: stripVersion }
  };
  const context = loadScripts(['gzip', 'load'], {
    document: { getElementById: id => fields[id] },
    showLoading: () => calls.push('loading'),
    errorMessage: message => message && calls.push(['error', message])
  });
  context.loadHARsFromConfig = config => calls.push(JSON.parse(JSON.stringify(config)));
  context.compareFromForm();
  return calls;
}

test('the Compare button uses the strip version checkbox', () => {
  assert.deepEqual(compare('https://e.com/1.har', 'https://e.com/2.har', true), [
    'loading',
    { har1: { url: 'https://e.com/1.har' }, har2: { url: 'https://e.com/2.har' }, stripVersion: true }
  ]);
});

test('the Compare button compares runs in one HAR', () => {
  assert.deepEqual(compare('', ' https://e.com/2.har ', false), [
    'loading',
    { har1: { url: 'https://e.com/2.har' }, har2: { url: '' }, stripVersion: false }
  ]);
});

test('the Compare button needs a URL', () => {
  assert.deepEqual(compare('', '', false), [['error', 'Add the URL to at least one HAR file.']]);
});
