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
    diff: 0
  };
  for (let diff of requestDiff) {
    if (diff.har1) total.har1 += diff.har1;
    if (diff.har2) total.har2 += diff.har2;
    if (diff.diff) total.diff += diff.diff;
  }
  return total;
}

function getUniqueRequests(har1, run1, har2, run2) {
  const urls1 = getURLs(har1, run1);
  const urls2 = getURLs(har2, run2);
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
        diff: urls2[url] - urls1[url]
      });
    } else {
      all.push({
        url: url,
        diff: -urls1[url],
        har1: urls1[url]
      });
    }
  }
  for (let url of Object.keys(urls2)) {
    if (urls2[url] && !urls1[url]) {
      all.push({
        url: url,
        diff: urls2[url],
        har2: urls2[url]
      });
    }
  }
  return all;
}

function getURLs(har, run) {
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
    urls[entry.request.url] = entry.response.bodySize;
  }
  return urls;
}
