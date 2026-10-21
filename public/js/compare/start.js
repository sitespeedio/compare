/* global createMainDropZone, showLoading, loadHARsFromConfig, loadFilesFromGist, loadFilesFromConfig, loadFromPaste, compareFromForm, errorMessage, showUpload, toggleWaterfallLayout, blendWaterfalls, regenerate, setCompareMode, pickRun, setMetricsQuery, toggleAllMetrics, toggleMetricSection, setRequestFilter, setRequestSort, setRequestMin, toggleTimelinePlay, scrubTimeline, showMetric, linkMetric, setTimelineSpeed, stepTimelineFrame, jumpTimeline, setDrawTool, undoDrawing, clearDrawings, saveDrawingPng */

// Start-up code for the page. It lives in a file, not in index.html,
// because the Content-Security-Policy blocks inline scripts.

function getParam(name) {
  if (
    (name = new RegExp(
      '[?&]' + encodeURIComponent(name) + '=([^&]*)'
    ).exec(location.search))
  )
    return decodeURIComponent(name[1]);
}

// One-time cleanup for browsers that previously installed the
// compare service worker. The SW + workbox stack was removed, so
// any clients still controlled by an old SW would keep serving
// stale assets indefinitely. Unregister + drop its caches so the
// very next reload after this change is fresh. Cheap no-op for
// anyone who never had an SW.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(function (regs) {
    regs.forEach(function (r) { r.unregister(); });
  }).catch(function () {});
}
if ('caches' in window) {
  caches.keys().then(function (keys) {
    keys.forEach(function (k) { caches.delete(k); });
  }).catch(function () {});
}

document.addEventListener('DOMContentLoaded', function () {
  const footerYear = document.getElementById('footerYear');
  if (footerYear) footerYear.textContent = new Date().getFullYear();
  createMainDropZone('zone');

  function getAndSet(paramName, elementId) {
    const paramValue = getParam(paramName);
    if (paramValue) {
      const el = document.getElementById(elementId);
      el.value = paramValue;
    }
  }
  getAndSet('har1', 'harurl');
  getAndSet('har2', 'harurl2');
  // Carry stripVersion through share links — `?stripVersion=1`
  // mirrors the start-page checkbox so a shared URL renders the
  // same comparison the sender saw.
  const stripVersionFromUrl = getParam('stripVersion') === '1';
  if (getParam('har1') != undefined && getParam('har2') != undefined) {
    showLoading();
    loadHARsFromConfig({
      har1: { url: getParam('har1') },
      har2: { url: getParam('har2') },
      stripVersion: stripVersionFromUrl
    });
  } else if (
    (getParam('har1') != undefined || getParam('har2') != undefined) &&
    getParam('compare')
  ) {
    showLoading();
    loadHARsFromConfig({
      har1: { url: getParam('har1') || getParam('har2') },
      har2: {},
      stripVersion: stripVersionFromUrl
    });
  } else if (getParam('gist') !== undefined) {
    showLoading();
    loadFilesFromGist(getParam('gist'));
  } else if (getParam('config') !== undefined) {
    showLoading();
    loadFilesFromConfig(getParam('config'));
  }

  document.addEventListener('paste', function (e) {
    // Ok let the the user paste the URL into the field
    if (e.target.closest && e.target.closest('input, textarea')) return;
    loadFromPaste(e.clipboardData.getData('Text'));
  });
});

// The Content-Security-Policy also blocks inline event handlers, so
// buttons, selects and inputs name their action in data-action.
const actions = {
  compare: () => compareFromForm(),
  'upload-again': () => {
    errorMessage('');
    showUpload();
  },
  'toggle-waterfall-layout': () => toggleWaterfallLayout(),
  blend: el => blendWaterfalls(el.value),
  switch: () => regenerate(true),
  'change-run': () => regenerate(),
  'compare-mode': el => setCompareMode(el.dataset.mode),
  'pick-run': el => pickRun(Number(el.dataset.side), Number(el.dataset.run)),
  'toggle-all-metrics': () => toggleAllMetrics(),
  'toggle-section': el => toggleMetricSection(el.dataset.section),
  'metric-search': el => setMetricsQuery(el.value),
  'request-filter': el => setRequestFilter(el.dataset.filter),
  'request-sort': el => setRequestSort(el.dataset.sort),
  'request-min': el => setRequestMin(Number(el.value)),
  'timeline-play': () => toggleTimelinePlay(),
  'timeline-seek': el => scrubTimeline(Number(el.dataset.t)),
  'timeline-speed': el => setTimelineSpeed(el.dataset.speed),
  'timeline-step': el => stepTimelineFrame(Number(el.dataset.step)),
  'timeline-jump': () => jumpTimeline(),
  'filmstrip-zoom': el => el.closest('.card').style.setProperty('--filmstrip-frame-width', el.value + 'px'),
  'show-metric': el => showMetric(el.dataset.metric),
  'draw-tool': el => setDrawTool(el.dataset.tool),
  'draw-undo': () => undoDrawing(),
  'draw-clear': () => clearDrawings(),
  'draw-save': () => saveDrawingPng()
};

const actionElements = {
  submit: 'form[data-action]',
  click: 'button[data-action]',
  change: 'select[data-action]',
  input: 'input[data-action]'
};

for (const [type, selector] of Object.entries(actionElements)) {
  document.addEventListener(type, e => {
    const el = e.target instanceof Element && e.target.closest(selector);
    if (!el) return;
    if (type === 'submit') e.preventDefault();
    actions[el.dataset.action](el);
  });
}

// Pointing at (or tabbing to) a metric highlights it everywhere.
for (const [type, on] of [['mouseover', true], ['mouseout', false], ['focusin', true], ['focusout', false]]) {
  document.addEventListener(type, e => {
    const el = e.target instanceof Element && e.target.closest('[data-metric]');
    if (el) linkMetric(el.dataset.metric, on);
  });
}
