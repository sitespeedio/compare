// Browser tests for the built site in dist/. Run `npm run build` first.
//
// The server sends the Content-Security-Policy from public/_headers, so
// a test fails if the page needs something the policy blocks.
//
// Selenium Manager finds Chrome and chromedriver. Set CHROME_BIN and
// CHROMEDRIVER to use a local install instead (for example on Linux
// ARM, where Selenium Manager has no Chrome to download).

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
const browserCell = () =>
  driver.executeScript(() => [...document.querySelectorAll('.pageXrayTable tr')]
    .find(tr => tr.textContent.startsWith('Browser')).cells[1].textContent);
const display = rowClass =>
  driver.executeScript(c => getComputedStyle(document.getElementsByClassName(c)[0]).display, rowClass);

test('the start page asks for a URL', async () => {
  await driver.get(base);
  assert.equal(await $('#footerYear').getText(), String(new Date().getFullYear()));
  await $('button[type=submit]').click();
  assert.match(await $('#message').getText(), /at least one HAR/);
});

test('pressing Enter in the form compares two HAR files', async () => {
  await $('#harurl').sendKeys(har('chrome'));
  await $('#harurl2').sendKeys(har('firefox'), Key.ENTER);
  await waitFor('.pageXrayTable');
  assert.equal(await driver.getCurrentUrl(), base);
  assert.match(await browserCell(), /Chrome/);
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

test('Switch swaps the HAR files', async () => {
  await $('button[data-action=switch]').click();
  assert.match(await browserCell(), /Firefox/);
});

test('the run select changes the run', async () => {
  await $('#run1Option option[value="2"]').click();
  await driver.wait(async () => (await $('#run1Option').getAttribute('value')) === '2', 5000);
});

test('Only differences hides unchanged rows', async () => {
  await $('#diffOnlyToggle').click();
  assert.match(await $('.pageXrayTable').getAttribute('class'), /pageXrayTable--diff-only/);
  assert.equal(await $('#diffOnlyToggle').getAttribute('aria-pressed'), 'true');
});

for (const section of ['#domainsContent', '#thirdPartyContent']) {
  test(`rows in ${section} expand and collapse`, async () => {
    const button = await $(`${section} button[data-action=toggle-row]`);
    const rows = await button.getAttribute('data-rows');
    await driver.executeScript(el => el.scrollIntoView({ block: 'center' }), button);
    await button.click();
    assert.equal(await display(rows), 'table-row');
    await button.click();
    assert.equal(await display(rows), 'none');
  });
}

test('the blend slider fades in HAR2', async () => {
  const slider = await $('#harBlendSlider');
  await driver.executeScript(el => el.scrollIntoView({ block: 'center' }), slider);
  await slider.sendKeys(Key.END);
  assert.equal(await $('#har2').getCssValue('opacity'), '1');
});

test('Side by side shows both waterfalls next to each other', async () => {
  await $('#waterfallLayoutToggle').click();
  assert.match(await $('.harwrapper').getAttribute('class'), /harwrapper--side-by-side/);
});

test('Upload names the new HAR after its file', async () => {
  await $('#har2upload').sendKeys(join(root, 'test/har/browsertime-firefox-wikipedia.har.gz'));
  await driver.wait(async () =>
    (await $('.tableXrayHar2Metric').getText()).includes('browsertime-firefox'), 15000);
});

test('Upload again shows the start page', async () => {
  const button = await $('button[data-action=upload-again]');
  await driver.executeScript(el => el.scrollIntoView({ block: 'center' }), button);
  await button.click();
  assert.equal(await $('#choosehars').isDisplayed(), true);
});

test('a share link loads the comparison', async () => {
  await driver.get(`${base}?har1=${har('chrome')}&har2=${har('firefox')}`);
  await waitFor('.pageXrayTable');
});

test('the browser logged no errors or CSP violations', async () => {
  const errors = (await driver.manage().logs().get(logging.Type.BROWSER))
    .filter(entry => entry.level.value >= logging.Level.SEVERE.value)
    .map(entry => entry.message);
  assert.deepEqual(errors, []);
});
