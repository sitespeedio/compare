/* exported getLastTiming getAllDomains*/

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
