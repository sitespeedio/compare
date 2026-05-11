/* global formatBytes, formatTime, formatDate, formatURL */
/* exported parseTemplate, registerTemplateHelpers */

//
// Templates. Replaces the Template7 setup that used to live here —
// each template is now a plain JS function that returns an HTML
// string built with template literals.
//
// parseTemplate(templateId, data, divId) is the public entry point;
// callers in generate.js stay unchanged. registerTemplateHelpers is
// kept as a no-op so the existing call site doesn't need touching.
//

// HTML-escape user-supplied or pulled-from-HAR strings.
function h(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Iterate over an array or object's values, mapping each entry to an
// HTML chunk and concatenating the results.
function each(collection, fn) {
  if (!collection) return '';
  if (Array.isArray(collection)) {
    return collection.map(fn).join('');
  }
  return Object.keys(collection)
    .map(function (key) { return fn(collection[key], key); })
    .join('');
}

// Safe property lookup for nested keys that might be missing on
// either of the two HARs (e.g. p2.firstParty.contentTypes['css'] may
// be undefined if HAR2 has no CSS at all).
function getValue(obj, key, name) {
  if (!obj || !obj[key]) return 0;
  return obj[key][name] != null ? obj[key][name] : 0;
}

//
// visualProgressTemplate
//
function visualProgressTemplate(d) {
  return (
    '<h3 id="visualProgressHeader">Visual Progress</h3>' +
    '<div id="comment-visualProgress" class="comment"></div>' +
    '<div id="visualProgress" class="vp-chart"></div>' +
    '<div id="visualProgressLegendHolder">' +
      '<ul class="resource-legend">' +
        '<li class="legend-url1" title="' + h(d.p1.url) + '">' + h(d.config.har1.label) + '</li>' +
        '<li class="legend-url2" title="' + h(d.p2.url) + '">' + h(d.config.har2.label) + '</li>' +
      '</ul>' +
    '</div>'
  );
}

//
// pageXrayTemplate
//
function pageXrayTemplate(d) {
  const p1 = d.p1, p2 = d.p2, config = d.config;
  const showRuns = d.runs1.length > 1 || d.runs2.length > 1;

  let html = '';
  html += '<div><table class="pageXrayTable">';
  html += '<thead><tr>';
  html += '<th class="tabletext tableXrayMetric">Metric ' +
            '<button onclick="regenerate(true);" class="submit submit-smaller">Switch</button></th>';
  html += '<th class="tableXrayHarMetric">' + h(config.har1.label) +
            '<input type="file" id="har1upload" class="inputfile"/>' +
            '<label for="har1upload">Upload</label></th>';
  html += '<th class="tableXrayHar2Metric"> ' + h(config.har2.label) +
            '<input type="file" id="har2upload" class="inputfile"/>' +
            '<label for="har2upload">Upload</label></th>';
  html += '</tr></thead><tbody>';

  if (showRuns) {
    html += '<tr><td class="tabletext">Run</td><td>';
    if (d.runs1.length > 1) {
      html += '<select name="runs1" onchange="regenerate();" id="run1Option">';
      html += each(d.runs1, function (r) {
        return '<option value="' + h(r.id) + '"' + (r.selected ? ' selected' : '') + '>' + h(r.show) + '</option>';
      });
      html += '</select>';
    }
    html += '</td><td>';
    if (d.runs2.length > 1) {
      html += '<select name="runs2" onchange="regenerate();" id="run2Option">';
      html += each(d.runs2, function (r) {
        return '<option value="' + h(r.id) + '"' + (r.selected ? ' selected' : '') + '>' + h(r.show) + '</option>';
      });
      html += '</select>';
    }
    html += '</td></tr>';
  }

  html += '<tr><td class="tabletext">URL</td>' +
          '<td><a href="' + h(p1.url) + '" title="' + h(p1.meta.title) + '">' + h(p1.url) + '</a></td>' +
          '<td><a href="' + h(p2.url) + '" title="' + h(p2.meta.title) + '">' + h(p2.url) + '</a></td></tr>';

  html += '<tr><td class="tabletext">Date</td>' +
          '<td>' + h(formatDate(p1.meta.startedDateTime)) + '</td>' +
          '<td>' + h(formatDate(p2.meta.startedDateTime)) + '</td></tr>';

  html += '<tr><td class="tabletext">Browser</td>' +
          '<td>' + (p1.meta.browser ? h(p1.meta.browser.name) + ' ' + h(p1.meta.browser.version) : '') + '</td>' +
          '<td>' + (p2.meta.browser ? h(p2.meta.browser.name) + ' ' + h(p2.meta.browser.version) : '') + '</td></tr>';

  if (p1.meta.connectivity && p2.meta.connectivity) {
    html += '<tr><td class="tabletext">Connectivity</td>' +
            '<td>' + h(p1.meta.connectivity) + '</td>' +
            '<td>' + h(p2.meta.connectivity) + '</td></tr>';
  }

  html += '<tr><td class="tabletext">Total</td>' +
          '<td>' + p1.requests + ' (' + formatBytes(p1.transferSize) + ' / ' + formatBytes(p1.contentSize) + ')</td>' +
          '<td>' + p2.requests + ' (' + formatBytes(p2.transferSize) + ' / ' + formatBytes(p2.contentSize) + ')</td></tr>';

  ['html', 'css', 'javascript'].forEach(function (kind) {
    const label = { html: 'HTML', css: 'CSS', javascript: 'JavaScript' }[kind];
    const a = p1.contentTypes[kind] || { requests: 0, transferSize: 0, contentSize: 0 };
    const b = p2.contentTypes[kind] || { requests: 0, transferSize: 0, contentSize: 0 };
    html += '<tr><td class="tabletext">' + label + '</td>' +
            '<td>' + a.requests + ' (' + formatBytes(a.transferSize) + ' / ' + formatBytes(a.contentSize) + ')</td>' +
            '<td>' + b.requests + ' (' + formatBytes(b.transferSize) + ' / ' + formatBytes(b.contentSize) + ')</td></tr>';
  });

  const img1 = p1.contentTypes.image || { requests: 0, transferSize: 0 };
  const img2 = p2.contentTypes.image || { requests: 0, transferSize: 0 };
  html += '<tr><td class="tabletext">Image</td>' +
          '<td>' + img1.requests + ' (' + formatBytes(img1.transferSize) + ')</td>' +
          '<td>' + img2.requests + ' (' + formatBytes(img2.transferSize) + ')</td></tr>';

  if (p1.renderBlocking && p2.renderBlocking) {
    html += '<tr><td class="tabletext">Render blocking</td>' +
            '<td>' + p1.renderBlocking.blocking + '</td>' +
            '<td>' + p2.renderBlocking.blocking + '</td></tr>';
    html += '<tr><td class="tabletext">Potentially blocking</td>' +
            '<td>' + p1.renderBlocking.potentiallyBlocking + '</td>' +
            '<td>' + p2.renderBlocking.potentiallyBlocking + '</td></tr>';
    html += '<tr><td class="tabletext">In body parser blocking</td>' +
            '<td>' + p1.renderBlocking.in_body_parser_blocking + '</td>' +
            '<td>' + p2.renderBlocking.in_body_parser_blocking + '</td></tr>';
  }

  if (p1.visualMetrics) {
    // Only render rows where both HARs have the value.
    const vmRows = [
      ['First Visual Change', 'FirstVisualChange'],
      ['Largest Image',       'LargestImage'],
      ['Logo',                'Logo'],
      ['Heading',             'Heading'],
      ['Speed Index',         'SpeedIndex'],
      ['Last Visual Change',  'LastVisualChange'],
      ['Visual Readiness',    'VisualReadiness']
    ];
    vmRows.forEach(function (row) {
      const label = row[0], key = row[1];
      if (p1.visualMetrics[key] && p2.visualMetrics && p2.visualMetrics[key]) {
        html += '<tr><td class="tabletext">' + label + '</td>' +
                '<td>' + formatTime(p1.visualMetrics[key]) + '</td>' +
                '<td>' + formatTime(p2.visualMetrics[key]) + '</td></tr>';
      }
    });
  }

  if (p1.googleWebVitals && p2.googleWebVitals) {
    html += '<tr><td class="tabletext">First Contentful Paint</td>' +
            '<td>' + formatTime(p1.googleWebVitals.firstContentfulPaint) + '</td>' +
            '<td>' + formatTime(p2.googleWebVitals.firstContentfulPaint) + '</td></tr>';
    html += '<tr><td class="tabletext">Largest Contentful Paint</td>' +
            '<td>' + formatTime(p1.googleWebVitals.largestContentfulPaint) + '</td>' +
            '<td>' + formatTime(p2.googleWebVitals.largestContentfulPaint) + '</td></tr>';
    html += '<tr><td class="tabletext">Total Blocking Time</td>' +
            '<td>' + formatTime(p1.googleWebVitals.totalBlockingTime) + '</td>' +
            '<td>' + formatTime(p2.googleWebVitals.totalBlockingTime) + '</td></tr>';
    html += '<tr><td class="tabletext">Cumulative Layout Shift</td>' +
            '<td>' + p1.googleWebVitals.cumulativeLayoutShift + '</td>' +
            '<td>' + p2.googleWebVitals.cumulativeLayoutShift + '</td></tr>';
  }

  if (p1.cpu && p2.cpu && p1.cpu.longTasks && p2.cpu.longTasks) {
    if (p1.cpu.longTasks.totalBlockingTime && p2.cpu.longTasks.totalBlockingTime) {
      html += '<tr><td class="tabletext">Total Blocking Time</td>' +
              '<td>' + formatTime(p1.cpu.longTasks.totalBlockingTime) + '</td>' +
              '<td>' + formatTime(p2.cpu.longTasks.totalBlockingTime) + '</td></tr>';
    }
    if (p1.cpu.longTasks.maxPotentialFid && p2.cpu.longTasks.maxPotentialFid) {
      html += '<tr><td class="tabletext">Max Potential FID</td>' +
              '<td>' + formatTime(p1.cpu.longTasks.maxPotentialFid) + '</td>' +
              '<td>' + formatTime(p2.cpu.longTasks.maxPotentialFid) + '</td></tr>';
    }
    if (p1.cpu.longTasks.tasks && p2.cpu.longTasks.tasks) {
      html += '<tr><td class="tabletext">Total CPU Long Tasks</td>' +
              '<td>' + p1.cpu.longTasks.tasks + '</td>' +
              '<td>' + p2.cpu.longTasks.tasks + '</td></tr>';
    }
  }

  if (p1.meta.screenshot && p2.meta.screenshot) {
    html += '<tr><td class="tabletext">Screenshot</td>' +
            '<td><a href="' + h(p1.meta.screenshot) + '"><img src="' + h(p1.meta.screenshot) + '" width="200"/></a></td>' +
            '<td><a href="' + h(p2.meta.screenshot) + '"><img src="' + h(p2.meta.screenshot) + '" width="200"/></a></td></tr>';
  }

  if (p1.meta.video && p2.meta.video) {
    html += '<tr><td class="tabletext">Video</td>' +
            '<td><video width="200" controls poster="' + h(p1.meta.screenshot) + '"><source src="' + h(p1.meta.video) + '" type="video/mp4"></video></td>' +
            '<td><video width="200" controls poster="' + h(p2.meta.screenshot) + '"><source src="' + h(p2.meta.video) + '" type="video/mp4"></video></td></tr>';
  }

  if (p1.meta.result && p2.meta.result) {
    html += '<tr><td class="tabletext">Extra</td>' +
            '<td><a href="' + h(p1.meta.result) + '" target="_blank" rel="noopener noreferrer">Result page</a></td>' +
            '<td><a href="' + h(p2.meta.result) + '" target="_blank" rel="noopener noreferrer">Result page</a></td></tr>';
  }

  if (d.cpuCategories1 && d.cpuCategories2) {
    html += '<tr><td class="tabletext" colspan="3"> CPU time spent by category ' +
              '<button onclick="toggleRow(this, \'cpuCategoryInfo\', this.childNodes[0]);" class="submit submit-smaller">' +
                '<i class="arrow right"></i></button></td></tr>';
    html += '<tr class="userShowable cpuCategoryInfo"><td class="tabletext"></td>' +
            '<td><ul>' +
              each(d.cpuCategories1, function (cat) {
                return '<li>' + h(cat.name) + ' : ' + h(cat.value) + '</li>';
              }) +
            '</ul></td>' +
            '<td><ul>' +
              each(d.cpuCategories2, function (cat) {
                return '<li>' + h(cat.name) + ' : ' + h(cat.value) + '</li>';
              }) +
            '</ul></td></tr>';
    html += '<tr><td class="tabletext" colspan="3">CPU Events ' +
              '<button onclick="toggleRow(this, \'cpuExtraInfo\', this.childNodes[0]);" class="submit submit-smaller">' +
                '<i class="arrow right"></i></button></td></tr>';
    html += '<tr class="userShowable cpuExtraInfo"><td class="tabletext"></td>' +
            '<td><ul>' +
              each(d.cpuEvents1, function (ev) {
                return '<li>' + h(ev.name) + ' : ' + h(ev.value.toFixed(3)) + '</li>';
              }) +
            '</ul></td>' +
            '<td><ul>' +
              each(d.cpuEvents2, function (ev) {
                return '<li>' + h(ev.name) + ' : ' + h(ev.value.toFixed(3)) + '</li>';
              }) +
            '</ul></td></tr>';
  }

  html += '</tbody></table></div>';
  return html;
}

//
// filmstripTemplate
//
function filmstripTemplate(d) {
  const config = d.config, fs1 = d.filmstrip1 || [], fs2 = d.filmstrip2 || [];

  function timingsCell(frame, cls) {
    return '<td class="' + cls + '">' + each(frame.timings, function (t) {
      const label = t.name || t.metric;
      const value = t.duration != null ? t.duration : t.value;
      return '<p class="ss"> ' + h(label) + ' : <b> ' + h(value) + ' </b></p>';
    }) + '</td>';
  }

  let html = '<h3 id="filmstripHeader">Filmstrip</h3>';
  html += '<div id="carousel"><div class="slide"><table>';
  // Row 1 — HAR1 timings
  html += '<tr><td></td>' + each(fs1, function (f) { return timingsCell(f, 'top-slide'); }) + '</tr>';
  // Row 2 — HAR1 images
  html += '<tr><td>' + h(config.har1.label) + ' </td>' +
          each(fs1, function (f) {
            return '<td style="text-align:center"><a href="' + h(f.img) + '"><img src="' + h(f.img) + '" style="max-height:250px"></a></td>';
          }) + '</tr>';
  // Row 3 — frame times
  html += '<tr><td></td>' + each(fs1, function (f) { return '<td>' + h(f.time) + '</td>'; }) + '</tr>';
  // Row 4 — HAR2 images
  html += '<tr><td>' + h(config.har2.label) + ' </td>' +
          each(fs2, function (f) {
            return '<td style="text-align:center"><a href="' + h(f.img) + '"><img src="' + h(f.img) + '" style="max-height:250px"/></a></td>';
          }) + '</tr>';
  // Row 5 — HAR2 timings
  html += '<tr><td></td>' + each(fs2, function (f) { return timingsCell(f, 'bottom-slide'); }) + '</tr>';
  html += '</table></div></div>';
  return html;
}

//
// thirdPartyTemplate
//
function thirdPartyTemplate(d) {
  const p1 = d.p1, p2 = d.p2, config = d.config;
  let html = '<h3 id="firstPartyHeader">First Party vs Third Party content</h3>';
  if (p1.firstPartyRegEx === p2.firstPartyRegEx) {
    html += '<p class="small">Using <b>' + h(p1.firstPartyRegEx) + '</b> as <i>--firstParty</i> parameter.</p>';
  } else {
    html += '<p class="small">Using <b>' + h(p1.firstPartyRegEx) + '</b> as <i>--firstParty</i> parameter for ' +
            h(config.har1.label) + ' and <b>' + h(p2.firstPartyRegEx) + '</b> for ' + h(config.har2.label) + '.</p>';
  }
  html += '<div id="comment-firstParty" class="comment"></div>';
  html += '<table><thead><tr>' +
          '<th class="tabletext">Metric</th>' +
          '<th> ' + h(config.har1.label) + '</th>' +
          '<th> ' + h(config.har2.label) + '</th>' +
          '</tr></thead><tbody>';

  function pct(n, total) {
    if (!n || !total || n <= 0) return 0;
    return Math.round((n / total) * 100);
  }

  function expandableRow(label, toggleClass, p1Cell, p2Cell, contentTypes1, contentTypes2, cellFn) {
    let row = '<tr><td class="tabletext">' + label + ' ' +
                '<button onclick="toggleRow(this, \'' + toggleClass + '\', this.childNodes[0]);" class="submit submit-smaller">' +
                  '<i class="arrow right"></i></button></td>' +
              '<td>' + p1Cell + '</td>' +
              '<td>' + p2Cell + '</td></tr>';
    row += each(contentTypes1, function (entry, key) {
      return '<tr class="userShowable ' + toggleClass + '">' +
               '<td class="tabletext">&nbsp;&nbsp;' + h(key) + '</td>' +
               '<td>' + cellFn(entry) + '</td>' +
               '<td>' + cellFn(contentTypes2 ? contentTypes2[key] : null) + '</td>' +
             '</tr>';
    });
    return row;
  }

  // First-party block
  html += expandableRow('First party requests', 'firstPartyRequests',
    p1.firstParty.requests + ' (' + pct(p1.firstParty.requests, p1.requests) + '%)',
    p2.firstParty.requests + ' (' + pct(p2.firstParty.requests, p2.requests) + '%)',
    p1.firstParty.contentTypes, p2.firstParty.contentTypes,
    function (entry) { return entry ? entry.requests : 0; }
  );
  html += expandableRow('First party transfer size', 'firstPartyTransferSize',
    formatBytes(p1.firstParty.transferSize) + ' (' + pct(p1.firstParty.transferSize, p1.transferSize) + '%)',
    formatBytes(p2.firstParty.transferSize) + ' (' + pct(p2.firstParty.transferSize, p2.transferSize) + '%)',
    p1.firstParty.contentTypes, p2.firstParty.contentTypes,
    function (entry) { return formatBytes(entry ? entry.transferSize : 0); }
  );
  html += expandableRow('First party content size', 'firstPartyContentSize',
    formatBytes(p1.firstParty.contentSize) + ' (' + pct(p1.firstParty.contentSize, p1.contentSize) + '%)',
    formatBytes(p2.firstParty.contentSize) + ' (' + pct(p2.firstParty.contentSize, p2.contentSize) + '%)',
    p1.firstParty.contentTypes, p2.firstParty.contentTypes,
    function (entry) { return formatBytes(entry ? entry.contentSize : 0); }
  );
  html += '<tr><td class="tabletext">First party cookies</td>' +
          '<td>' + (p1.firstParty.cookies != null ? p1.firstParty.cookies : '') + '</td>' +
          '<td></td></tr>';

  // Third-party block
  html += expandableRow('Third party requests', 'thirdPartyRequests',
    p1.thirdParty.requests + ' (' + pct(p1.thirdParty.requests, p1.requests) + '%)',
    p2.thirdParty.requests + ' (' + pct(p2.thirdParty.requests, p2.requests) + '%)',
    p1.thirdParty.contentTypes, p2.thirdParty.contentTypes,
    function (entry) { return entry ? entry.requests : 0; }
  );
  html += expandableRow('Third party transfer size', 'thirdPartyTransferSize',
    formatBytes(p1.thirdParty.transferSize) + ' (' + pct(p1.thirdParty.transferSize, p1.transferSize) + '%)',
    formatBytes(p2.thirdParty.transferSize) + ' (' + pct(p2.thirdParty.transferSize, p2.transferSize) + '%)',
    p1.thirdParty.contentTypes, p2.thirdParty.contentTypes,
    function (entry) { return formatBytes(entry ? entry.transferSize : 0); }
  );
  html += expandableRow('Third party content size', 'thirdPartyContentSize',
    formatBytes(p1.thirdParty.contentSize) + ' (' + pct(p1.thirdParty.contentSize, p1.contentSize) + '%)',
    formatBytes(p2.thirdParty.contentSize) + ' (' + pct(p2.thirdParty.contentSize, p2.contentSize) + '%)',
    p1.thirdParty.contentTypes, p2.thirdParty.contentTypes,
    function (entry) { return formatBytes(entry ? entry.contentSize : 0); }
  );
  html += '<tr><td class="tabletext">Third party cookies</td>' +
          '<td>' + (p1.thirdParty.cookies != null ? p1.thirdParty.cookies : '') + '</td>' +
          '<td></td></tr>';

  html += '</tbody></table>';
  return html;
}

//
// resultHeaderTemplate
//
function resultHeaderTemplate(d) {
  const p1 = d.p1, p2 = d.p2;
  let html = '<div class="header-links">';
  html += '<a href="#pageXrayContent">Metrics</a> - ';
  html += '<a href="#waterfallHeader">Waterfall</a> - ';
  if (p1.visualMetrics && p1.visualMetrics.VisualProgress) {
    html += '<a href="#visualProgressHeader">Visual Progress</a> - ';
  }
  if (p1.thirdParty && p1.thirdParty.contentTypes) {
    html += '<a href="#firstPartyHeader">1st vs 3rd party</a> - ';
  }
  if (p1.url === p2.url) {
    html += '<a href="#requestDifffHeader">Request diff</a> - ';
  }
  html += '<a href="#domainsHeader">Domains</a>';
  html += '</div>';
  return html;
}

//
// domainsTemplate
//
function domainsTemplate(d) {
  const config = d.config;
  let html = '<h3 id="domainsHeader">Domains</h3>';
  html += '<div id="comment-domains" class="comment"></div>';
  html += '<div class="col-1-1"><table><thead><tr>' +
          '<th class="tabletext">Domain</th>' +
          '<th class="no-break">' + h(config.har1.label) + ' Request</th>' +
          '<th class="no-break">' + h(config.har2.label) + ' Request</th>' +
          '<th class="no-break">' + h(config.har1.label) + ' Size</th>' +
          '<th class="no-break">' + h(config.har2.label) + ' Size</th>' +
          '</tr></thead><tbody>';

  html += each(d.domains, function (domain) {
    const safeId = 'domainDetails' + domain.name;
    let row = '<tr>' +
              '<td class="tabletext">' + h(domain.name) + ' ' +
                '<button onclick="toggleRow(this, \'' + h(safeId) + '\', this.childNodes[0]);" class="submit submit-smaller">' +
                  '<i class="arrow right"></i></button></td>' +
              '<td class="no-break">' + (domain.firstPage ? domain.firstPage.requests : '') + '</td>' +
              '<td class="no-break">' + (domain.secondPage ? domain.secondPage.requests : '') + '</td>' +
              '<td class="no-break">' + (domain.firstPage ? formatBytes(domain.firstPage.transferSize) : '') + '</td>' +
              '<td class="no-break">' + (domain.secondPage ? formatBytes(domain.secondPage.transferSize) : '') + '</td>' +
              '</tr>';
    row += '<tr class="userShowable ' + h(safeId) + '">' +
           '<td colspan="2" class="tabletext">&nbsp;<b>Total time spent HAR 1</b><br/>' +
           (domain.firstPage ? each(domain.firstPage.timings, function (val, key) {
             return '&nbsp;&nbsp;' + h(key) + ' : ' + val.toFixed(0) + ' <br/>';
           }) : '') +
           '</td>' +
           '<td colspan="3" class="tabletext">&nbsp;<b>Total time spent HAR 2</b><br/>' +
           (domain.secondPage ? each(domain.secondPage.timings, function (val, key) {
             return '&nbsp;&nbsp;' + h(key) + ' : ' + val.toFixed(0) + ' <br/>';
           }) : '') +
           '</td></tr>';
    return row;
  });

  html += '</tbody></table></div>';
  return html;
}

//
// requestDiffTemplate
//
function requestDiffTemplate(d) {
  if (!d.requestDiff) return '';
  let html = '<h3 id="requestDifffHeader">Request/response difference (larger than 1 kb)</h3>';
  html += '<div id="comment-requestDiff" class="comment"></div>';

  if (!d.requestDiff.length) {
    html += '<p>There are no difference in size of the requests/responses.</p>';
    return html;
  }

  const t = d.total;

  html += '<div class="col-1-1">';
  html += '<table class="requestDiffTable"><thead><tr>' +
          '<th class="tabletext">URL</th>' +
          '<th class="tabletext">' + h(d.config.har1.label) + '</th>' +
          '<th class="tabletext">' + h(d.config.har2.label) + '</th>' +
          '<th class="tabletext">Diff</th>' +
          '</tr></thead><tbody>';

  html += each(d.requestDiff, function (r) {
    let diffCell;
    if (r.har1 && r.har2) {
      if (r.diff < 0) {
        diffCell = '<td class="tabletext green">' + formatBytes(r.diff) + '</td>';
      } else {
        diffCell = '<td class="tabletext red">+' + formatBytes(r.diff) + '</td>';
      }
    } else if (r.har1) {
      diffCell = '<td class="tabletext green">Removed</td>';
    } else {
      diffCell = '<td class="tabletext red">New</td>';
    }
    return '<tr>' +
           '<td class="tabletext"><a href="' + h(r.url) + '">' + h(formatURL(r.url)) + '</a></td>' +
           '<td class="tabletext">' + formatBytes(r.har1) + '</td>' +
           '<td class="tabletext">' + formatBytes(r.har2) + '</td>' +
           diffCell +
           '</tr>';
  });

  html += '<tr><td class="tabletext"><b>Total</b></td>' +
          '<td class="tabletext"><b>' + formatBytes(t.har1) + '</b></td>' +
          '<td class="tabletext"><b>' + formatBytes(t.har2) + '</b></td>' +
          (t.diff < 0
            ? '<td class="tabletext green"><b>' + formatBytes(t.diff) + '</b></td>'
            : '<td class="tabletext red"><b>+' + formatBytes(t.diff) + '</b></td>') +
          '</tr>';

  html += '</tbody></table>';

  // Summary table
  html += '<table><thead><tr>' +
          '<th class="tabletext">Summary of request/response difference</th>' +
          '<th>Size</th>' +
          '</tr></thead><tbody>' +
          '<tr><td class="tabletext">New (' + t.new + ')</td><td class="red">' + formatBytes(t.newBytes) + '</td></tr>' +
          '<tr><td class="tabletext">Removed (' + t.removed + ')</td><td class="green">-' + formatBytes(t.removedBytes) + '</td></tr>' +
          '<tr><td class="tabletext">Increased (' + t.increased + ')</td><td class="red">' + formatBytes(t.increasedBytes) + '</td></tr>' +
          '<tr><td class="tabletext">Decreased (' + t.decreased + ')</td><td class="green">' + formatBytes(t.decreasedBytes) + '</td></tr>' +
          '<tr><td class="tabletext"><b>Total</b></td>' +
          (t.diff < 0
            ? '<td class="green"><b>' + formatBytes(t.diff) + '</b></td>'
            : '<td class="red"><b>+' + formatBytes(t.diff) + '</b></td>') +
          '</tr></tbody></table>';

  html += '</div>';
  return html;
}

const TEMPLATES = {
  visualProgressTemplate: visualProgressTemplate,
  pageXrayTemplate: pageXrayTemplate,
  filmstripTemplate: filmstripTemplate,
  thirdPartyTemplate: thirdPartyTemplate,
  resultHeaderTemplate: resultHeaderTemplate,
  domainsTemplate: domainsTemplate,
  requestDiffTemplate: requestDiffTemplate
};

function parseTemplate(templateId, data, divId) {
  const renderer = TEMPLATES[templateId];
  if (!renderer) return;
  const target = document.getElementById(divId);
  if (target) target.innerHTML = renderer(data);
}

// No-op kept for backwards compatibility with generate.js calling it
// at the start of every render.
function registerTemplateHelpers() {}
