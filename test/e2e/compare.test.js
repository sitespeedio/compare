// Browser tests for the built site in dist/. Run `npm run build` first.
//
// The server sends the Content-Security-Policy from public/_headers, so
// a test fails if the page needs something the policy blocks.
//
// Selenium Manager finds Chrome and chromedriver. Set CHROME_BIN and
// CHROMEDRIVER to use a local install instead (for example on Linux
// ARM, where Selenium Manager has no Chrome to download).

/* global pickRun, setCompareMode, timeline */
// The page globals above are used in code that runs in the browser.

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createReadStream, existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Builder, By, Key, logging, until } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome.js';

const root = fileURLToPath(new URL('../..', import.meta.url));
const csp = readFileSync(join(root, 'public/_headers'), 'utf8')
  .match(/Content-Security-Policy: (.*)/)[1];
const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.json': 'application/json'
};

let server;
let driver;
let base;

before(async () => {
  server = createServer((req, res) => {
    const { pathname } = new URL(req.url, 'http://localhost');
    const file = pathname.startsWith('/har/')
      ? join(root, 'test', pathname)
      : join(root, 'dist', pathname === '/' ? 'index.html' : pathname);
    if (!file.startsWith(root) || !existsSync(file)) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream');
    res.setHeader('Content-Security-Policy', csp);
    createReadStream(file).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}/`;

  const options = new chrome.Options().addArguments(
    '--headless=new',
    '--no-sandbox',
    '--window-size=1280,1000'
  );
  if (process.env.CHROME_BIN) options.setChromeBinaryPath(process.env.CHROME_BIN);
  const prefs = new logging.Preferences();
  prefs.setLevel(logging.Type.BROWSER, logging.Level.ALL);
  options.setLoggingPrefs(prefs);

  const builder = new Builder().forBrowser('chrome').setChromeOptions(options);
  if (process.env.CHROMEDRIVER) {
    builder.setChromeService(new chrome.ServiceBuilder(process.env.CHROMEDRIVER));
  }
  driver = await builder.build();
});

after(async () => {
  await driver?.quit();
  server?.close();
});

const har = name => `${base}har/browsertime-${name}-wikipedia.har.gz`;
const $ = css => driver.findElement(By.css(css));
const waitFor = css => driver.wait(until.elementLocated(By.css(css)), 15000);
// Scroll to the middle first so the sticky header never covers the target.
async function click(css) {
  const el = await $(css);
  await driver.executeScript(e => e.scrollIntoView({ block: 'center' }), el);
  await el.click();
}
const text = css => driver.executeScript(c => document.querySelector(c).textContent, css);
const tableRows = () => driver.executeScript(() => document.querySelectorAll('.metricsTable tbody tr').length);

test('the start page asks for a URL', async () => {
  await driver.get(base);
  assert.equal(await $('#footerYear').getText(), String(new Date().getFullYear()));
  await $('button[type=submit]').click();
  assert.match(await $('#message').getText(), /at least one HAR/);
});

test('pressing Enter in the form compares two HAR files', async () => {
  await $('#harurl').sendKeys(har('chrome'));
  await $('#harurl2').sendKeys(har('firefox'), Key.ENTER);
  await waitFor('.metricsTable');
  assert.equal(await driver.getCurrentUrl(), base);
  assert.match(await text('#summaryContent'), /Chrome/);
});

test('every header link points to a section', async () => {
  const missing = await driver.executeScript(() =>
    [...document.querySelectorAll('.header-links a')]
      .map(a => a.getAttribute('href').slice(1))
      .filter(id => !document.getElementById(id)));
  assert.deepEqual(missing, []);
});

test('the waterfalls render', async () => {
  await waitFor('#har1 canvas');
  await waitFor('#har2 canvas');
});

test('a later run draws its own connections, not those of run 1', async () => {
  // Run 3 opens connection 63 again, as run 1 did.
  await driver.executeScript(() => pickRun(1, 3));
  const connects = () => driver.executeScript(() => {
    const wf = timeline.waterfalls.har1;
    const entries = (wf && wf.renderer.rawEntries) || [];
    return entries.filter(e => e.timings && e.timings.connect > 0)
      .map(e => ({ late: e._connectTimeMs >= e.time_start - 1, page: wf.renderer.options.pageId }));
  });
  try {
    await driver.wait(async () => (await connects()).some(c => c.page === 'page_1-1-1'), 15000);
    const found = await connects();
    assert.ok(found.length >= 2);
    assert.ok(found.every(c => c.late));
  } finally {
    await driver.executeScript(() => setCompareMode('all'));
  }
});

test('two HAR files with five runs each are compared by their medians', async () => {
  assert.match(await text('.segmented [aria-pressed="true"]'), /All runs/);
  assert.match(await text('.metricsTable thead'), /HAR1 median/);
  assert.equal(await $('#allMetricsToggle').getAttribute('aria-pressed'), 'false');
});

test('the timeline axis moves every cursor', async () => {
  await driver.wait(async () => (await $('#har1 .wf-cursor').getAttribute('style')).includes('left'), 5000);
  const before = await $('#har1 .wf-cursor').getCssValue('left');
  const axis = await $('#timelineAxis');
  await driver.executeScript(el => el.scrollIntoView({ block: 'center' }), axis);
  await axis.sendKeys(Key.HOME);
  assert.equal(await text('#timelineTime'), '0.000 s');
  assert.notEqual(await $('#har1 .wf-cursor').getCssValue('left'), before);
  assert.equal(await driver.executeScript(() => document.querySelectorAll('.rendering-chip.is-passed').length), 0);
  await axis.sendKeys(Key.END);
  assert.equal(await driver.executeScript(() =>
    document.querySelectorAll('.rendering-chip:not(.is-passed)').length), 0);
});

test('the timeline shades where the two runs render differently', async () => {
  assert.ok(await driver.executeScript(() => document.querySelectorAll('.rendering-band').length) > 0);
  assert.ok(await driver.executeScript(() => document.querySelectorAll('#visualProgress .vp-band').length) > 0);
});

test('the speed buttons change the playback speed', async () => {
  await click('[data-action="timeline-speed"][data-speed="0.5"]');
  assert.equal(await $('[data-action="timeline-speed"][data-speed="0.5"]').getAttribute('aria-pressed'), 'true');
  assert.equal(await $('[data-action="timeline-speed"][data-speed="1"]').getAttribute('aria-pressed'), 'false');
  await click('[data-action="timeline-speed"][data-speed="1"]');
});

test('pointing at a metric card highlights its row', async () => {
  const card = await $('.metric-card');
  await driver.executeScript(el => el.scrollIntoView({ block: 'center' }), card);
  await driver.actions().move({ origin: card }).perform();
  const metric = await card.getAttribute('data-metric');
  assert.ok(await driver.executeScript(m =>
    [...document.querySelectorAll('.metricsTable tr.is-linked')].some(tr => tr.dataset.metric === m), metric), metric);
});

test('clicking a metric card shows and flashes its row', async () => {
  const card = await $('.metric-card');
  const metric = await card.getAttribute('data-metric');
  await card.click();
  await driver.wait(() => driver.executeScript(m => {
    const row = [...document.querySelectorAll('.metricsTable tr')].find(tr => tr.dataset.metric === m);
    const r = row && row.getBoundingClientRect();
    return row && row.classList.contains('metric-flash') && r.top >= 0 && r.bottom <= window.innerHeight;
  }, metric), 5000);
});

test('Play runs the timeline and Pause stops it', async () => {
  await click('#timelinePlay');
  await driver.wait(async () => (await text('#timelineTime')) !== '0.00 s', 5000);
  await click('#timelinePlay');
  assert.equal(await $('#timelinePlay').getAttribute('aria-pressed'), 'false');
});

test('a run dot compares that run in single runs mode', async () => {
  // Dots of runs with the same value overlap; click one that is on top.
  const dot = await driver.executeScript(() => [...document.querySelectorAll('.metricsTable .run-dot--2')].find(d => {
    d.scrollIntoView({ block: 'center' });
    const r = d.getBoundingClientRect();
    return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === d;
  }));
  await dot.click();
  await driver.wait(async () => (await text('.segmented [aria-pressed="true"]')) === 'Single runs', 5000);
  assert.match(await text('.metricsTable thead'), /HAR2 run \d/);
});

test('the run select changes the run', async () => {
  await click('#run1Option option[value="2"]');
  await driver.wait(async () => (await $('#run1Option').getAttribute('value')) === '2', 5000);
  assert.match(await text('.metricsTable thead'), /HAR1 run 2/);
});

test('unchanged metrics are folded and can be shown', async () => {
  const folded = await tableRows();
  await click('[data-action="toggle-section"]');
  const oneOpen = await tableRows();
  assert.ok(oneOpen > folded);
  await click('#allMetricsToggle');
  assert.equal(await $('#allMetricsToggle').getAttribute('aria-pressed'), 'true');
  assert.ok(await tableRows() > oneOpen);
  await click('#allMetricsToggle');
});

test('the search finds a metric', async () => {
  const search = await $('#metricSearch');
  await driver.executeScript(el => el.scrollIntoView({ block: 'center' }), search);
  await search.sendKeys('speed index');
  await driver.wait(async () => (await tableRows()) <= 3, 5000);
  assert.match(await text('.metricsTable tbody'), /Speed Index/);
  await search.clear();
  await search.sendKeys(Key.BACK_SPACE);
});

test('the request filters show one kind of change', async () => {
  await click('[data-action="request-filter"][data-filter="decreased"]');
  assert.equal(await $('[data-action="request-filter"][data-filter="decreased"]').getAttribute('aria-pressed'), 'true');
  const changes = await driver.executeScript(() =>
    [...document.querySelectorAll('.requestsTable .request-change')].map(td => td.textContent));
  assert.ok(changes.every(c => c.startsWith('−')), changes.join());
});

test('Swap swaps the HAR files', async () => {
  await click('button[data-action=switch]');
  await driver.wait(async () => (await text('.har-chip b')) === 'HAR2', 5000);
});

test('the blend slider fades in HAR2', async () => {
  const slider = await $('#harBlendSlider');
  await driver.executeScript(el => el.scrollIntoView({ block: 'center' }), slider);
  await slider.sendKeys(Key.END);
  assert.equal(await $('#har2').getCssValue('opacity'), '1');
});

test('Side by side shows both waterfalls next to each other', async () => {
  await click('#waterfallLayoutToggle');
  assert.match(await $('.harwrapper').getAttribute('class'), /harwrapper--side-by-side/);
});

// Pixels drawn on the drawing layer of a waterfall.
const drawnPixels = key => driver.executeScript(k => {
  const c = document.querySelector('#' + k + ' .wf-draw');
  const data = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let n = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i]) n++;
  return n;
}, key);

async function drag(css, from, to) {
  const el = await $(css);
  await driver.executeScript(e => e.scrollIntoView({ block: 'center' }), el);
  await driver.actions()
    .move({ origin: el, x: from[0], y: from[1] }).press()
    .move({ origin: el, x: to[0], y: to[1], duration: 100 })
    .release().perform();
}

test('a circle drawn on a waterfall can be undone', async () => {
  await click('[data-action=draw-tool][data-tool=circle]');
  assert.equal(await $('#drawHint').isDisplayed(), true);
  await drag('#har1 .wf-draw', [-60, -40], [60, 0]);
  assert.ok(await drawnPixels('har1') > 100);
  await click('[data-action=draw-undo]');
  assert.equal(await drawnPixels('har1'), 0);
});

// The top of the drawn pixels on the drawing layer of a waterfall.
const drawnTop = key => driver.executeScript(k => {
  const c = document.querySelector('#' + k + ' .wf-draw');
  const data = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  for (let i = 3; i < data.length; i += 4) if (data[i]) return Math.floor((i - 3) / 4 / c.width);
  return -1;
}, key);

test('a drawing can be moved and the move undone', async () => {
  // Esc first: clicking the tool that is on turns it off.
  await driver.actions().sendKeys(Key.ESCAPE).perform();
  await click('[data-action=draw-tool][data-tool=circle]');
  await drag('#har1 .wf-draw', [-60, -40], [60, 0]);
  const top = await drawnTop('har1');
  // Grab the left side of the circle outline and move it down.
  await drag('#har1 .wf-draw', [-60, -20], [-60, 80]);
  assert.ok(Math.abs(await drawnTop('har1') - top - 100) <= 3);
  await click('[data-action=draw-undo]');
  assert.equal(await drawnTop('har1'), top);
  await click('[data-action=draw-undo]');
  assert.equal(await drawnPixels('har1'), 0);
});

test('text can be added to a waterfall', async () => {
  await click('[data-action=draw-tool][data-tool=text]');
  const layer = await $('#har2 .wf-draw');
  await driver.actions().move({ origin: layer, x: 0, y: -40 }).click().perform();
  const input = await waitFor('#har2 .wf-draw-input');
  await input.sendKeys('slow font', Key.ENTER);
  assert.ok(await drawnPixels('har2') > 100);
  await click('[data-action=draw-clear]');
  assert.equal(await drawnPixels('har2'), 0);
});

test('a drawing follows its HAR when the files are swapped', async () => {
  await click('[data-action=draw-tool][data-tool=line]');
  await drag('#har1 .wf-draw', [-80, -30], [40, 10]);
  await driver.actions().sendKeys(Key.ESCAPE).perform();
  assert.equal(await $('#drawHint').isDisplayed(), false);
  await click('button[data-action=switch]');
  await driver.wait(async () => await drawnPixels('har2') > 50, 15000);
  assert.equal(await drawnPixels('har1'), 0);
});

test('Save as PNG downloads the waterfalls with the drawings', async () => {
  await driver.executeScript(() => {
    window.savedPng = null;
    HTMLAnchorElement.prototype.click = function () { window.savedPng = this.download; };
  });
  await click('[data-action=draw-save]');
  await driver.wait(() => driver.executeScript(() => window.savedPng), 5000);
  assert.equal(await driver.executeScript(() => window.savedPng), 'compare-waterfall.png');
});

test('Replace names the new HAR after its file', async () => {
  await $('#har2upload').sendKeys(join(root, 'test/har/browsertime-firefox-wikipedia.har.gz'));
  await driver.wait(async () => (await text('#summaryContent')).includes('browsertime-firefox'), 15000);
});

test('Upload again shows the start page', async () => {
  await click('button[data-action=upload-again]');
  assert.equal(await $('#choosehars').isDisplayed(), true);
});

test('a share link loads the comparison', async () => {
  await driver.get(`${base}?har1=${har('chrome')}&har2=${har('firefox')}`);
  await waitFor('.metricsTable');
});

test('the browser logged no errors or CSP violations', async () => {
  const errors = (await driver.manage().logs().get(logging.Type.BROWSER))
    .filter(entry => entry.level.value >= logging.Level.SEVERE.value)
    .map(entry => entry.message);
  assert.deepEqual(errors, []);
});
