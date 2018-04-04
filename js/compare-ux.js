/* global Chartist, Template7, getLastTiming, perfCascade, createUpload, getAllDomains */
/* exported showUpload, formatDate, generate, toggleRow, regenerate*/

// Hide the upload functionality
function hideUpload() {
  hide('choosehars');
  hide('loading');
  show('result');
}

function removeAndHide() {
  function removeChildren(parentId) {
    const parent = document.getElementById(parentId);
    while (parent.childNodes.length > 0) {
      parent.removeChild(parent.firstChild);
    }
  }
  removeChildren('har1');
  removeChildren('har2');
  removeChildren('pageXrayContent');
  removeChildren('thirdPartyContent');
  removeChildren('visualProgressContent');
  hide('result');
  hide('loading');
}

// Show the upload functionality
function showUpload() {
  removeAndHide();
  show('choosehars');
}

// Put a error message on the screen
function errorMessage(myMessage) {
  const message = document.getElementById('message');
  message.innerHTML = myMessage;
}

function show(id) {
  const el = document.getElementById(id);
  if (el) {
    el.style.display = 'block';
  }
}

function hide(id) {
  const el = document.getElementById(id);
  if (el) {
    el.style.display = 'none';
  }
}

function formatDate(dateString) {
  return new Date(dateString).toLocaleString();
}

function formatBytes(bytes) {
  if (bytes === 0) {
    return '0 B';
  }

  return Math.round(bytes / 1000) + ' kb';
}

function generateVisualProgress(visualProgress1, visualProgress2, id) {
  let maxTime = 0;
  const series = [visualProgress1, visualProgress2].map(progressList => {
    let previousProgress = -1;

    return Object.keys(progressList).reduce((coordinates, milliSecond) => {
      const currentProgress = progressList[milliSecond];
      if (currentProgress !== previousProgress) {
        previousProgress = currentProgress;
        const time = (Number(milliSecond) / 1000).toFixed(2);
        if (time > maxTime) {
          maxTime = time;
        }
        coordinates.push({
          x: time,
          y: currentProgress
        });
      }
      return coordinates;
    }, []);
  });

  // let them end on the same spot.
  series[0].push({
    x: maxTime,
    y: 100
  });

  series[1].push({
    x: maxTime,
    y: 100
  });

  new Chartist.Line(
    '#' + id,
    {
      series
    },
    {
      showArea: true,
      showPoint: true,
      chartPadding: {
        top: 10,
        right: 0,
        bottom: 30,
        left: 10
      },
      axisX: {
        type: Chartist.AutoScaleAxis,
        onlyInteger: false,
        scaleMinSpace: 100,
        referenceValue: 1
      },
      lineSmooth: Chartist.Interpolation.step({
        postpone: true,
        fillHoles: false
      }),
      axisY: {
        onlyInteger: true
      },
      plugins: [
        Chartist.plugins.ctAxisTitle({
          axisX: {
            axisTitle: 'Time (seconds)',
            axisClass: 'ct-axis-title',
            offset: {
              x: 0,
              y: 50
            },
            textAnchor: 'middle'
          },
          axisY: {
            axisTitle: 'Visual progress %',
            axisClass: 'ct-axis-title',
            offset: {
              x: 0,
              y: -4
            },
            textAnchor: 'middle',
            flipTitle: false
          }
        }),
        Chartist.plugins.tooltip({
          transformTooltipTextFnc: function(text) {
            const m = text.split(',');
            return m[0] + 's ' + m[1] + '%';
          }
        })
      ]
    }
  );
}

function regenerate(switchHar) {
  const e = document.getElementById('run1Option');
  const e2 = document.getElementById('run2Option');
  const runIndex = e ? e.options[e.selectedIndex].value : 0;
  const runIndex2 = e2 ? e2.options[e2.selectedIndex].value : 0;
  const har1 = switchHar ? window.har2 : window.har1;
  const har2 = switchHar ? window.har1 : window.har2;
  const run1 = switchHar ? runIndex2 : runIndex;
  const run2 = switchHar ? runIndex : runIndex2;
  removeAndHide();

  generate(
    {
      har: har1,
      run: run1
    },
    {
      har: har2,
      run: run2
    }
  );
}

function generate(config1, config2) {
  const time = getLastTiming(config1.har, config1.run);
  const time2 = getLastTiming(config2.har, config2.run);

  function storeHAR(name, har) {
    window[name] = har;
  }

  function parseTemplate(templateId, data, divId) {
    // parse the template
    const templateElement = document.getElementById(templateId);
    const template = Template7.compile(templateElement.innerHTML);
    const html = template(data);
    const div = document.getElementById(divId);
    div.innerHTML = html;
  }

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

  // we store the HAR to easy get it when we switch runs

  storeHAR('har1', config1.har);
  storeHAR('har2', config2.har);

  hideUpload();
  document.getElementById('range').value = 0;
  changeOpacity(0, 'har1', 'har2');

  // remove error messages
  errorMessage('');

  // TODO: we need to make runs configurable

  const pageXray1 = window.PageXray.convertIndex(config1.har, config1.run);
  const pageXray2 = window.PageXray.convertIndex(config2.har, config2.run);

  // special handling for Template7 limits
  const runs1 = [];
  const runs2 = [];
  for (let i = 0; i < config1.har.log.pages.length; i++) {
    runs1.push({
      id: i,
      selected: config1.run == i ? 'selected' : ''
    });
  }
  for (let i = 0; i < config2.har.log.pages.length; i++) {
    runs2.push({
      id: i,
      selected: config2.run == i ? 'selected' : ''
    });
  }

  Template7.registerHelper('get', function(obj, key, name) {
    if (!obj[key]) {
      return 0;
    }
    return obj[key][name];
  });

  Template7.registerHelper('getAsBytes', function(obj, key, name) {
    if (!obj[key]) {
      return 0;
    }
    return formatBytes(obj[key][name]);
  });

  parseTemplate(
    'resultHeaderTemplate',
    {
      p1: pageXray1,
      p2: pageXray2
    },
    'resultHeaderContent'
  );

  parseTemplate(
    'pageXrayTemplate',
    {
      p1: pageXray1,
      p2: pageXray2,
      runs1: runs1,
      runs2: runs2
    },
    'pageXrayContent'
  );

  const legendHolderEl = document.getElementById('waterfallLegendHolder');
  addWaterfall(
    config1.har,
    config1.run,
    'har1',
    legendHolderEl,
    Math.max(time, time2)
  );
  addWaterfall(
    config2.har,
    config2.run,
    'har2',
    legendHolderEl,
    Math.max(time, time2)
  );

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
        p2: pageXray2
      },
      'visualProgressContent'
    );

    generateVisualProgress(
      pageXray1.visualMetrics.VisualProgress,
      pageXray2.visualMetrics.VisualProgress,
      'visualProgress'
    );
  }

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
      domains: allDomains
    },
    'domainsContent'
  );

  createUpload('har1upload');
  createUpload('har2upload');
}

function changeOpacity(val, id1, id2) {
  const el1 = document.getElementById(id1);
  const el2 = document.getElementById(id2);
  el2.style.opacity = val;
  el1.style.opacity = Math.abs(1 - val);

  // make sure we can see the extra info
  if (val > 0.5) {
    el1.style['z-index'] = -1;
    el2.style['z-index'] = 1;
  } else {
    el1.style['z-index'] = 1;
    el2.style['z-index'] = -1;
  }
}

function toggleRow(element, className, toggler) {
  const rows = element.parentNode.parentNode.parentNode.getElementsByClassName(
    className
  );

  for (let i = 0; i < rows.length; i++) {
    const status = rows[i].currentStyle
      ? rows[i].currentStyle.display
      : getComputedStyle(rows[i], null).display;

    if (status === 'none') {
      rows[i].style.display = 'table-row';
      toggler.style.transform = 'rotate(45deg)';
      toggler.style['-webkit-transform'] = 'rotate(45deg)';
    } else {
      rows[i].style.display = 'none';
      toggler.style.transform = 'rotate(-45deg)';
      toggler.style['-webkit-transform'] = 'rotate(-45deg)';
    }
  }
}
