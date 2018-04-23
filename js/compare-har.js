/* exported getLastTiming getAllDomains getURLsDiff*/

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

function getURLsDiff(har1, run1, har2, run2) {
  const urls1 = getURLs(har1, run1);
  const urls2 = getURLs(har2, run2);
  let diffHar1 = urls1.filter(x => !urls2.includes(x));
  let diffHar2 = urls2.filter(x => !urls1.includes(x));
  return { diff1: diffHar1, diff2: diffHar2 };
}

function getURLs(har, run) {
  const harEntries = har.log.entries;
  const pageId = har.log.pages[run].id;
  harEntries.filter(entry => {
    // filter inline data
    if (
      entry.request.url.indexOf('data:') === 0 ||
      entry.request.url.indexOf('javascript:') === 0
    ) {
      return false;
    }
    return entry.pageref === pageId;
  });
  const urls = [];
  harEntries.filter(entry => urls.push(entry.request.url));
  return urls;
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
