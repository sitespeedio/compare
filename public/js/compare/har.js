/* global median */
/* exported getLastTiming, requestSizes, compareRequests */

/**
 * Helper functions to get things out of the HAR
 */

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

  // Take care of the case when a timing is later than latest response
  Object.keys(har.log.pages[run].pageTimings).forEach(key => {
    if (har.log.pages[run].pageTimings[key] > doneTime) {
      doneTime = har.log.pages[run].pageTimings[key];
    }
  });

  return doneTime;
}

// Median transfer size of each URL across the given runs (0-based page
// indexes), and how many of the runs requested it.
function requestSizes(har, runs, stripVersion) {
  const perRun = runs.map(run => getURLs(har, run, stripVersion));
  const sizes = {};
  for (const url of new Set(perRun.flatMap(Object.keys))) {
    const values = perRun.filter(urls => url in urls).map(urls => urls[url]);
    sizes[url] = { size: median(values), seen: values.length, runs: runs.length };
  }
  return sizes;
}

// The URLs whose size differs between two requestSizes() results.
// Use `in` for presence checks because a URL whose transfer size is
// unknown is stored as 0 — truthy checks would mis-classify those as
// removed/added.
function compareRequests(sizes1, sizes2) {
  const changes = [];
  for (const url of new Set(Object.keys(sizes1).concat(Object.keys(sizes2)))) {
    const a = url in sizes1 ? sizes1[url] : undefined;
    const b = url in sizes2 ? sizes2[url] : undefined;
    const diff = (b ? b.size : 0) - (a ? a.size : 0);
    const kind = !a ? 'new' : !b ? 'removed' : diff > 0 ? 'increased' : diff < 0 ? 'decreased' : 'same';
    if (kind !== 'same') changes.push({ url, a, b, diff, kind });
  }
  return changes;
}

function getURLs(har, run, stripVersion) {
  const harEntries = har.log.entries;
  const pageId = har.log.pages[run].id;
  const cleaned = harEntries.filter(entry => {
    // filter inline data
    if (
      entry.request.url.indexOf('data:') === 0 ||
      entry.request.url.indexOf('javascript:') === 0
    ) {
      return false;
    }
    return entry.pageref === pageId;
  });
  const urls = {};
  for (let entry of cleaned) {
    let url = entry.request.url;
    if (stripVersion) {
      url = url.replace(/([?&])version=[^&#]*/i, '$1');
    }
    urls[url] = bestTransferSize(entry.response);
  }
  return urls;
}

// Best-effort "bytes over the wire" for a HAR response. The request
// diff cares about network cost, not decoded payload size, so prefer
// _transferSize (added by Chrome devtools / sitespeed.io / WPT) which
// is exactly that. HAR-spec bodySize is the encoded body length when
// known and -1 when not — usable as a fallback. content.size is the
// decoded body and a last resort. Anything missing or <= 0 (spec uses
// -1 for "unknown") becomes 0 so totals don't go negative.
function bestTransferSize(response) {
  if (!response) return 0;
  if (typeof response._transferSize === 'number' && response._transferSize > 0) {
    return response._transferSize;
  }
  if (typeof response.bodySize === 'number' && response.bodySize > 0) {
    return response.bodySize;
  }
  if (response.content &&
      typeof response.content.size === 'number' &&
      response.content.size > 0) {
    return response.content.size;
  }
  return 0;
}
