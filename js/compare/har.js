/* exported getLastTiming getAllDomains getTotalDiff getUniqueRequests*/

/**
 * Helper functions to get things out of the HAR
 */

function getLastTiming(har, run) {
  const harEntries = har.log.entries;
  const pageId = har.log.pages[run].id;
  const pageStartTime = new Date(har.log.pages[run].startedDateTime).getTime();

  let doneTime = 0;
  harEntries
    .filter((entry) => {
      // filter inline data
      if (
        entry.request.url.indexOf('data:') === 0 ||
        entry.request.url.indexOf('javascript:') === 0
      ) {
        return false;
      }
      return entry.pageref === pageId;
    })
    .forEach((entry) => {
      const startRelative =
        new Date(entry.startedDateTime).getTime() - pageStartTime;
      doneTime = Math.max(doneTime, startRelative + entry.time);
    });

  // Take care of the case when a timing is later than latest response
  Object.keys(har.log.pages[run].pageTimings).forEach((key) => {
    if (har.log.pages[run].pageTimings[key] > doneTime) {
      doneTime = har.log.pages[run].pageTimings[key];
    }
  });

  return doneTime;
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

function getTotalDiff(requestDiff) {
  const total = {
    har1: 0,
    har2: 0,
    diff: 0,
    new: 0,
    newBytes: 0,
    removed: 0,
    removedBytes: 0,
    increased: 0,
    increasedBytes: 0,
    decreased: 0,
    decreasedBytes: 0,
  };
  for (let diff of requestDiff) {
    if (diff.har1) total.har1 += diff.har1;
    if (diff.har2) total.har2 += diff.har2;
    if (diff.diff) total.diff += diff.diff;

    // is new!
    if (diff.har2 && !diff.har1) {
      total.new += 1;
      total.newBytes += diff.har2;
    } else if (diff.har1 && !diff.har2) {
      // is removed
      total.removed += 1;
      total.removedBytes += diff.har1;
    } else if (diff.diff < 0) {
      // decrease!
      total.decreased += 1;
      total.decreasedBytes += diff.diff;
    } else {
      // must be increase
      total.increased += 1;
      total.increasedBytes += diff.diff;
    }
  }
  return total;
}

function getUniqueRequests(har1, run1, har2, run2, options) {
  const urls1 = getURLs(har1, run1, options.stripVersion);
  const urls2 = getURLs(har2, run2, options.stripVersion);
  const all = [];
  const minDiffInBytes = 1000;
  for (let url of Object.keys(urls1)) {
    if (
      (urls2[url] && urls2[url] === urls1[url]) ||
      (urls2[url] &&
        urls2[url] - urls1[url] < minDiffInBytes &&
        urls2[url] - urls1[url] > -minDiffInBytes)
    ) {
      // TODO no diff, do nada
    } else if (urls2[url]) {
      // There's a diff in size
      all.push({
        url: url,
        har1: urls1[url],
        har2: urls2[url],
        diff: urls2[url] - urls1[url],
      });
    } else {
      all.push({
        url: url,
        diff: -urls1[url],
        har1: urls1[url],
      });
    }
  }
  for (let url of Object.keys(urls2)) {
    if (urls2[url] && !urls1[url]) {
      all.push({
        url: url,
        diff: urls2[url],
        har2: urls2[url],
      });
    }
  }
  return all;
}

function getURLs(har, run, stripVersion) {
  const harEntries = har.log.entries;
  const pageId = har.log.pages[run].id;
  const cleaned = harEntries.filter((entry) => {
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
      url = url.replace(/version=[A-Za-z0-9]+/i, '');
    }
    urls[url] = entry.response.bodySize;
  }
  return urls;
}
