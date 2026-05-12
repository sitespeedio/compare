/* global getLastTiming, removeAndHide, createUpload, getAllDomains, hideUpload, objectPropertiesToArray, registerTemplateHelpers, parseTemplate, getTotalDiff, generateVisualProgress, formatDate, getUniqueRequests, getFilmstrip, compareWaterfall */
/* exported showUpload, formatDate, generate, toggleRow, regenerate, formatTime, showLoading*/

/**
 * You have pushed the switch button or have changed the run drop down
 * and you want to re-generate the output
 * @param {*} switchHar
 */
function regenerate(switchHar) {
  const e = document.getElementById('run1Option');
  const e2 = document.getElementById('run2Option');
  const runIndex = e ? e.options[e.selectedIndex].value : 0;
  const runIndex2 = e2 ? e2.options[e2.selectedIndex].value : 0;
  generate({
    har1: {
      har: switchHar ? window.har.har2.har : window.har.har1.har,
      run: switchHar ? runIndex2 : runIndex,
      label: switchHar ? window.har.har2.label : window.har.har1.label
    },
    har2: {
      har: switchHar ? window.har.har1.har : window.har.har2.har,
      run: switchHar ? runIndex : runIndex2,
      label: switchHar ? window.har.har1.label : window.har.har2.label
    }
  });
}

/**
 * Render one waterfall into #<waterfallDivId> using waterfall-tools.
 * Pass the same `maxTime` (ms) for both HARs in the pair so the
 * stacked panels share a time axis.
 */
function addWaterfall(har, selectedPage, waterfallDivId, maxTime) {
  const outputHolder = document.getElementById(waterfallDivId);
  if (!outputHolder) return Promise.resolve();
  return compareWaterfall.render(har, outputHolder, {
    endTimeMs: maxTime,
    runIndex: selectedPage
  });
}

// Down-sample a filmstrip down to a small set of evenly-spaced frames
// for the under-chart thumbnail strip; the dense version still lives
// in the dedicated Filmstrip section below.
function sampleFrames(frames, count) {
  if (!frames || frames.length === 0) return [];
  if (frames.length <= count) return frames.slice();
  const step = (frames.length - 1) / (count - 1);
  const out = [];
  for (let i = 0; i < count; i++) out.push(frames[Math.round(i * step)]);
  return out;
}

function addVisualProgress(pageXray1, pageXray2, config, filmstrip) {
  if (
    !pageXray1.visualMetrics ||
    !pageXray1.visualMetrics.VisualProgress ||
    !pageXray2.visualMetrics ||
    !pageXray2.visualMetrics.VisualProgress
  ) return;

  parseTemplate(
    'visualProgressTemplate',
    { p1: pageXray1, p2: pageXray2, config },
    'visualProgressContent'
  );

  // Marker timings — vertical guide lines on the chart anchor the
  // comparison in time so "when did this happen?" is answerable at
  // a glance. We pick the standard set: First Visual Change, FCP,
  // LCP and Speed Index. Each marker is per-HAR so a regressed LCP
  // shows up as two side-by-side red lines rather than one.
  function markerSet(p) {
    const vm = p.visualMetrics || {};
    const gw = p.googleWebVitals || {};
    return [
      { label: 'FVC',         time: vm.FirstVisualChange,            kind: 'fvc' },
      { label: 'FCP',         time: gw.firstContentfulPaint,         kind: 'fcp' },
      { label: 'LCP',         time: gw.largestContentfulPaint,       kind: 'lcp' },
      { label: 'Speed Index', time: vm.SpeedIndex,                   kind: 'si'  }
    ].filter(function (m) { return typeof m.time === 'number' && m.time > 0; });
  }

  generateVisualProgress(
    pageXray1.visualMetrics.VisualProgress,
    pageXray2.visualMetrics.VisualProgress,
    'visualProgress',
    {
      thumbnails1: filmstrip ? sampleFrames(filmstrip.frames1, 6) : [],
      thumbnails2: filmstrip ? sampleFrames(filmstrip.frames2, 6) : [],
      label1:      config.har1.label,
      label2:      config.har2.label,
      markers1:    markerSet(pageXray1),
      markers2:    markerSet(pageXray2)
    }
  );
}

/**
 * Generate/create output for the HAR files. Config objects has the following structure:
 * { har1: {url, run, label, har}, har2: {url, run, label, har}}
 * @param {} config
 */
function generate(config) {
  // We remove the potential old HARs
  removeAndHide();
  hideUpload();

  // We wanna know which HAR that's the slowest (need the most)
  // output
  const lastTime = getLastTiming(config.har1.har, config.har1.run);
  const lastTime2 = getLastTiming(config.har2.har, config.har2.run);
  const slowestHarTiming = Math.max(lastTime, lastTime2);

  // we store the HAR to easy get it when we switch runs
  window.har = config;

  if (config.title) {
    document.title = config.title;
  } else if (
    config.har1.har.log.pages[config.har1.run].startedDateTime &&
    config.har2.har.log.pages[config.har2.run].startedDateTime
  ) {
    document.title =
      formatDate(config.har1.har.log.pages[config.har1.run].startedDateTime) +
      ' vs ' +
      formatDate(config.har2.har.log.pages[config.har2.run].startedDateTime);
  }

  const pageXray1 = window.PageXray.convertIndex(
    config.har1.har,
    config.har1.run,
    { firstParty: config.firstParty }
  );
  const pageXray2 = window.PageXray.convertIndex(
    config.har2.har,
    config.har2.run,
    { firstParty: config.firstParty }
  );

  // special handling for Template7 limits
  // so we massage the data
  const runs1 = [];
  const runs2 = [];
  for (let i = 0; i < config.har1.har.log.pages.length; i++) {
    runs1.push({
      id: i,
      selected: config.har1.run == i ? 'selected' : '',
      show: i + 1
    });
  }
  for (let i = 0; i < config.har2.har.log.pages.length; i++) {
    runs2.push({
      id: i,
      selected: config.har2.run == i ? 'selected' : '',
      show: i + 1
    });
  }

  // It's time to start to parse content
  // make sure we have the helpers ready
  registerTemplateHelpers();

  parseTemplate(
    'resultHeaderTemplate',
    {
      p1: pageXray1,
      p2: pageXray2
    },
    'resultHeaderContent'
  );

  const filmstrip = getFilmstrip(
    config.har1.har,
    config.har1.run,
    config.har2.har,
    config.har2.run
  );
  if (filmstrip) {
    parseTemplate(
      'filmstripTemplate',
      { config: config, filmstrip: filmstrip },
      'filmstripContent'
    );
  }

  // Slider labels for the blend control. Both waterfalls are rendered
  // into the same area on the same time axis; the slider blends har2
  // over har1.
  const label1 = document.getElementById('har1Label');
  const label2 = document.getElementById('har2Label');
  if (label1) label1.textContent = config.har1.label;
  if (label2) label2.textContent = config.har2.label;

  // Reset the slider to 0 (show HAR1 fully) when (re)generating.
  const slider = document.getElementById('harBlendSlider');
  if (slider) slider.value = 0;
  blendWaterfalls(0);
  // Restore the user's saved side-by-side / overlay preference now
  // that the waterfall DOM is populated. No-op when the wrapper is
  // missing (e.g. during the loading view).
  if (typeof applyWaterfallLayoutPreference === 'function') {
    applyWaterfallLayoutPreference();
  }

  parseTemplate(
    'pageXrayTemplate',
    {
      p1: pageXray1,
      p2: pageXray2,
      config,
      runs1: runs1,
      runs2: runs2,
      cpuCategories1:
        pageXray1.cpu && pageXray1.cpu.categories
          ? objectPropertiesToArray(pageXray1.cpu.categories)
          : undefined,
      cpuCategories2:
        pageXray2.cpu && pageXray2.cpu.categories
          ? objectPropertiesToArray(pageXray2.cpu.categories)
          : undefined,
      cpuEvents1:
        pageXray1.cpu && pageXray1.cpu.events
          ? objectPropertiesToArray(pageXray1.cpu.events)
          : undefined,
      cpuEvents2:
        pageXray2.cpu && pageXray2.cpu.events
          ? objectPropertiesToArray(pageXray2.cpu.events)
          : undefined
    },
    'pageXrayContent'
  );

  addWaterfall(config.har1.har, config.har1.run, 'har1', slowestHarTiming);
  addWaterfall(config.har2.har, config.har2.run, 'har2', slowestHarTiming);

  addVisualProgress(pageXray1, pageXray2, config, filmstrip);

  if (Object.keys(pageXray1.firstParty).length > 0) {
    parseTemplate(
      'thirdPartyTemplate',
      {
        p1: pageXray1,
        p2: pageXray2,
        config
      },
      'thirdPartyContent'
    );
  }

  const allDomains = getAllDomains(pageXray1, pageXray2);
  parseTemplate(
    'domainsTemplate',
    {
      domains: allDomains,
      config
    },
    'domainsContent'
  );

  // At the moment we only test this if you test the same URL
  // But we should find a better way to do it in the future
  if (pageXray1.url === pageXray2.url) {
    const requestDiff = getUniqueRequests(
      config.har1.har,
      config.har1.run,
      config.har2.har,
      config.har2.run,
      config
    );
    const total = getTotalDiff(requestDiff);
    parseTemplate(
      'requestDiffTemplate',
      {
        requestDiff,
        total,
        config
      },
      'requestDiffContent'
    );

    // Take care of comments
    if (config.comments) {
      const commentKeys = Object.keys(config.comments);
      for (let key of commentKeys) {
        const el = document.getElementById('comment-' + key);
        if (el) {
          el.innerHTML = config.comments[key];
        }
      }
    }
  }

  createUpload('har1upload');
  createUpload('har2upload');
}
