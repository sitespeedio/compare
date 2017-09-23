/* global Chartist, Template7, Zlib, perfCascade, FileDrop */
/* exported help, toggleRow, formatDate, regenerate, loadFilesFromURL, createDropZone, switchHAR  */

// Hide the upload functionality
function hideUpload() {
  hide('choosehars');
  show('result');
}

function helpUs() {
  /* eslint-disable no-console */
  console.log('Issues and PRs: https://github.com/sitespeedio/compare');
  /* eslint-enable no-console */
}

function getLastTiming(har, run) {
  const harEntries = har.log.entries;
  const pageId = har.log.pages[run].id;
  const pageStartTime = new Date(har.log.pages[run].startedDateTime).getTime();

  let doneTime = 0;
  harEntries
    .filter(entry => {
      // filter inline data
      if (
        entry.request.url.indexOf('data:') === 0 ||
        entry.request.url.indexOf('javascript:') === 0
      ) {
        return false;
      }
      return entry.pageref === pageId;
    })
    .forEach(entry => {
      const startRelative =
        new Date(entry.startedDateTime).getTime() - pageStartTime;
      doneTime = Math.max(doneTime, startRelative + entry.time);
    });

  // Take care of the case when a timig is later than latest response
  Object.keys(har.log.pages[run].pageTimings).forEach(key => {
    if (har.log.pages[run].pageTimings[key] > doneTime) {
      doneTime = har.log.pages[run].pageTimings[key];
    }
  });

  return doneTime;
}

// Show the upload functionality
function showUpload() {
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
  show('choosehars');
  hide('result');
}

function help() {
  // eslint-disable-line  no-unused-vars
  show('help');
}

// Put a error message on the screen
function errorMessage(myMessage) {
  const message = document.getElementById('message');
  message.innerHTML = myMessage;
}

function show(id) {
  const el = document.getElementById(id);
  el.style.display = 'block';
}

function hide(id) {
  const el = document.getElementById(id);
  el.style.display = 'none';
}

function gzipArrayBufferToJSON(arrayBuffer) {
  /* utf.js - UTF-8 <=> UTF-16 convertion
   *
   * Copyright (C) 1999 Masanao Izumo <iz@onicos.co.jp>
   * Version: 1.0
   * LastModified: Dec 25 1999
   * This library is free.  You can redistribute it and/or modify it.
   */

  function Utf8ArrayToStr(array) {
    let out, i, len, c;
    let char2, char3;

    out = '';
    len = array.length;
    i = 0;
    while (i < len) {
      c = array[i++];
      switch (c >> 4) {
        case 0:
        case 1:
        case 2:
        case 3:
        case 4:
        case 5:
        case 6:
        case 7:
          // 0xxxxxxx
          out += String.fromCharCode(c);
          break;
        case 12:
        case 13:
          // 110x xxxx   10xx xxxx
          char2 = array[i++];
          out += String.fromCharCode(((c & 0x1f) << 6) | (char2 & 0x3f));
          break;
        case 14:
          // 1110 xxxx  10xx xxxx  10xx xxxx
          char2 = array[i++];
          char3 = array[i++];
          out += String.fromCharCode(
            ((c & 0x0f) << 12) | ((char2 & 0x3f) << 6) | ((char3 & 0x3f) << 0)
          );
          break;
      }
    }

    return out;
  }

  const byteArray = new Uint8Array(arrayBuffer);
  const gunzip = new Zlib.Gunzip(byteArray);
  const decompressedArray = gunzip.decompress();
  let string = '';
  // only way to make it work on Safari iOS?
  try {
    string = new TextDecoder('utf-8').decode(decompressedArray);
  } catch (e) {
    string = Utf8ArrayToStr(decompressedArray);
  }
  return JSON.parse(string);
}

function isFileGzipped(url) {
  return url.endsWith('.gz');
}

function isFileZipped(url) {
  return url.endsWith('.zip') || url.endsWith('.zhar');
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleString();
}

function formatBytes(bytes) {
  if (bytes === 0) {
    return '0 B';
  }

  return Math.round(bytes / 1000) + ' kb';
}

function switchHAR() {
  const e = document.getElementById('run1Option');
  const run = e.options[e.selectedIndex].value;
  const e2 = document.getElementById('run2Option');
  const run2 = e2.options[e2.selectedIndex].value;

  const har2 = window.har1;
  const har1 = window.har2;
  // hack to remove the old HARs, make this cleaner
  showUpload();

  generate(
    {
      har: har1,
      run: run
    },
    {
      har: har2,
      run: run2
    }
  );
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

function regenerate() {
  const e = document.getElementById('run1Option');
  const run = e.options[e.selectedIndex].value;
  const e2 = document.getElementById('run2Option');
  const run2 = e2.options[e2.selectedIndex].value;

  const har1 = window.har1;
  const har2 = window.har2;
  // hack to remove the old HARs, make this cleaner
  showUpload();

  generate(
    {
      har: har1,
      run: run
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

  function addWaterfall(har, selectedPage, waterfallDivId, legendHolderEl) {
    const perfCascadeSvg = perfCascade.fromHar(har, {
      rowHeight: 23,
      showAlignmentHelpers: false,
      showIndicatorIcons: false,
      showMimeTypeIcon: true,
      leftColumnWith: 30,
      selectedPage: selectedPage,
      legendHolder: legendHolderEl,
      fixedLengthMs: Math.max(time, time2)
    });

    const outputHolder = document.getElementById(waterfallDivId);
    outputHolder.appendChild(perfCascadeSvg);
  }

  // we store the HAR to easy get it when we switch runs
  if (config1.har.log.pages.length > 1) {
    storeHAR('har1', config1.har);
  }
  if (config2.har.log.pages.length > 1) {
    storeHAR('har2', config2.har);
  }

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
  addWaterfall(config1.har, config1.run, 'har1', legendHolderEl);
  addWaterfall(config2.har, config2.run, 'har2', legendHolderEl);

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

  var allDomains = getAllDomains(pageXray1, pageXray2);
  parseTemplate(
    'domainsTemplate',
    {
      domains: allDomains
    },
    'domainsContent'
  );
}

function getAllDomains(firstPage, secondPage) {
  const domainMap = {};

  for (let name of Object.keys(firstPage.domains)) {
    let domain = domainMap[name] || {};
    domain.firstPage = firstPage.domains[name];
    domainMap[name] = domain;
  }
  for (let name of Object.keys(secondPage.domains)) {
    let domain = domainMap[name] || {};
    domain.secondPage = secondPage.domains[name];
    domainMap[name] = domain;
  }

  const allDomains = [];

  for (let name of Object.keys(domainMap)) {
    const domain = domainMap[name];
    domain.name = name;
    allDomains.push(domain);
  }

  return allDomains;
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

function readGZipFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () =>
      reject(
        new Error('Error reading ' + file.name + ' : ' + reader.error.name)
      );
    reader.onload = () => {
      try {
        const har = gzipArrayBufferToJSON(reader.result);
        resolve(har);
      } catch (e) {
        reject(new Error('Error reading ' + file.name + ' : ' + e.message));
      }
    };

    reader.readAsArrayBuffer(file.nativeFile);
  });
}

function readJsonFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () =>
      reject(
        new Error('Error reading ' + file.name + ' : ' + reader.error.message)
      );
    reader.onload = () => {
      try {
        const har = JSON.parse(reader.result);
        resolve(har);
      } catch (e) {
        reject(new Error('Error reading ' + file.name + ' : ' + e.message));
      }
    };

    reader.readAsText(file.nativeFile);
  });
}

function getHarURL(url) {
  let run = 0,
    harURL;

  // The sitespeed.io summary page
  if (url.endsWith('/') || url.endsWith('/index.html')) {
    run = 0;
    // TODO we are not sure the HAR file is gzipped, hmm
    harURL = url.slice(0, url.lastIndexOf('/')) + '/data/browsertime.har.gz';
  } else if (url.endsWith('.html')) {
    // Individual run page
    run = url.slice(url.lastIndexOf('/') + 1, url.length - 5);
    harURL = url.slice(0, url.lastIndexOf('/')) + '/data/browsertime.har.gz';
  } else {
    harURL = url;
  }
  return {
    har: harURL,
    run: run
  };
}

function toggleRow(element, className, toggler) {
  var rows = element.parentNode.parentNode.parentNode.getElementsByClassName(
    className
  );

  for (let i = 0; i < rows.length; i++) {
    var status = rows[i].currentStyle
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

function loadFilesFromURL() {
  function fetchHar(url) {
    return fetch(url).then(response => {
      if (!response.ok)
        throw new Error(
          'Failed to fetch har from ' + url + '. Error: ' + response.statusText
        );

      if (isFileZipped(url))
        throw new Error('Zip compressed HARs are not supported: ' + url);

      if (isFileGzipped(url))
        return response.arrayBuffer().then(gzipArrayBufferToJSON);

      return response.json();
    });
  }

  const URL = document.getElementById('harurl').value;
  const URL2 = document.getElementById('harurl2').value;

  if (URL.startsWith('http') && URL2.startsWith('http')) {
    const har1 = getHarURL(URL);
    const har2 = getHarURL(URL2);

    const harPromise = fetchHar(har1.har);
    const harPromise2 = fetchHar(har2.har);

    Promise.all([harPromise, harPromise2])
      .then(([h1, h2]) =>
        generate(
          {
            har: h1,
            run: har1.run
          },
          {
            har: h2,
            run: har2.run
          }
        )
      )
      .catch(e => {
        errorMessage(e.message);
        showUpload();
      });
  } else {
    errorMessage(
      'You need to add two URLs to be able to compare or drag/drop the HAR files.'
    );
  }
}

function createDropZone(id) {
  const zone = new FileDrop(id, {});
  zone.multiple(true);

  zone.event('send', function(files) {
    function readHar(file) {
      if (isFileZipped(file.name))
        return Promise.reject(
          new Error('Zip compressed HARs are not supported: ' + file.name)
        );

      if (isFileGzipped(file.name)) return readGZipFile(file);

      return readJsonFile(file);
    }

    if (files.length > 2) {
      errorMessage('You can only compare two HAR files at a time!');
    } else if (files.length !== 2) {
      errorMessage('You must add two HAR files that you will compare!');
    } else {
      Promise.all([readHar(files[0]), readHar(files[1])])
        .then(([har1, har2]) =>
          generate(
            {
              har: har1,
              run: 0
            },
            {
              har: har2,
              run: 0
            }
          )
        )
        .catch(e => {
          errorMessage(e.message);
          showUpload();
        });
    }
  });
}

helpUs();
