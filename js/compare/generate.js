/* global getLastTiming, removeAndHide, perfCascade, createUpload, getAllDomains, hideUpload, changeOpacity, objectPropertiesToArray, registerTemplateHelpers, parseTemplate, getTotalDiff, generateVisualProgress, formatDate  getUniqueRequests */
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
 * Add perfcascade waterfall
 * @param {*} har
 * @param {*} selectedPage
 * @param {*} waterfallDivId
 * @param {*} legendHolderEl
 * @param {*} maxTime
 */
function addWaterfall(
  har,
  selectedPage,
  waterfallDivId,
  legendHolderEl,
  maxTime
) {
  const perfCascadeSvg = perfCascade.fromHar(har, {
    rowHeight: 23,
    showAlignmentHelpers: false,
    showIndicatorIcons: false,
    showMimeTypeIcon: true,
    leftColumnWidth: 30,
    selectedPage: selectedPage,
    legendHolder: legendHolderEl,
    fixedLengthMs: maxTime
  });

  const outputHolder = document.getElementById(waterfallDivId);
  outputHolder.appendChild(perfCascadeSvg);
}

function addVisualProgress(pageXray1, pageXray2, config) {
  if (
    pageXray1.visualMetrics &&
    pageXray1.visualMetrics.VisualProgress &&
    pageXray2.visualMetrics &&
    pageXray2.visualMetrics.VisualProgress
  ) {
    parseTemplate(
      'visualProgressTemplate',
      {
        p1: pageXray1,
        p2: pageXray2,
        config
      },
      'visualProgressContent'
    );

    generateVisualProgress(
      pageXray1.visualMetrics.VisualProgress,
      pageXray2.visualMetrics.VisualProgress,
      'visualProgress'
    );
  }
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
    config.har1.run
  );
  const pageXray2 = window.PageXray.convertIndex(
    config.har2.har,
    config.har2.run
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

  parseTemplate(
    'waterfallTemplate',
    {
      config
    },
    'waterfallContent'
  );

  // Hack for settimng correct opacity
  document.getElementById('range').value = 0;
  changeOpacity(0, 'har1', 'har2');

  parseTemplate(
    'pageXrayTemplate',
    {
      p1: pageXray1,
      p2: pageXray2,
      config,
      runs1: runs1,
      runs2: runs2,
      cpuCategories1: pageXray1.cpu ? pageXray1.cpu.categories : undefined,
      cpuCategories2: pageXray2.cpu ? pageXray2.cpu.categories : undefined,
      cpuEvents1: pageXray1.cpu
        ? objectPropertiesToArray(pageXray1.cpu.events)
        : undefined,
      cpuEvents2: pageXray2.cpu
        ? objectPropertiesToArray(pageXray2.cpu.events)
        : undefined
    },
    'pageXrayContent'
  );

  const legendHolderEl = document.getElementById('waterfallLegendHolder');
  addWaterfall(
    config.har1.har,
    config.har1.run,
    'har1',
    legendHolderEl,
    slowestHarTiming
  );
  addWaterfall(
    config.har2.har,
    config.har2.run,
    'har2',
    legendHolderEl,
    slowestHarTiming
  );

  addVisualProgress(pageXray1, pageXray2, config);

  if (Object.keys(pageXray1.firstParty).length > 0) {
    parseTemplate(
      'thirdPartyTemplate',
      {
        p1: pageXray1,
        p2: pageXray2
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
      config.har2.run
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
