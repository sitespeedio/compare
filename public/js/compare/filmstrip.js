/* exported getFilmstrip */

//
// Filmstrip data extraction.
//
// We support two HAR flavours:
//
// 1. sitespeed.io HARs — frames live as separate JPGs on the same
//    server the HAR came from, under
//    `<base>/data/filmstrip/<run>/ms_<paddedMs>.jpg`. We detect this
//    by looking at `_meta.screenshot` (always present when sitespeed
//    was run with --video / --visualMetrics) and derive the base from
//    it. Frame timestamps come from `_visualMetrics`: a frame at 0,
//    every 100 ms between FirstVisualChange and LastVisualChange, and
//    a final frame at LastVisualChange exact.
//
// 2. Older WPT HARs that embed a `filmstrip` array on the page —
//    handled the legacy way via pageXray.meta.filmstrip when that's
//    populated.
//
// When neither HAR has filmstrip data, the section renders nothing.
//

/**
 * Build a filmstrip-frame list for one HAR page, or null if the HAR
 * doesn't have enough data to draw one.
 */
function getFilmstripForPage(har, pageIndex) {
  const page = har && har.log && har.log.pages && har.log.pages[pageIndex];
  if (!page) return null;

  // sitespeed.io path — derive the filmstrip URL base from the
  // screenshot URL (e.g. .../data/screenshots/1/afterPageCompleteCheck.jpg
  // → .../data/filmstrip/1/ms_NNNNNN.jpg)
  const meta = page._meta || {};
  const vm = page._visualMetrics;
  if (meta.screenshot && vm) {
    const m = meta.screenshot.match(/^(.+\/data)\/screenshots\/(\d+)\//);
    if (m) {
      const dataBase = m[1];
      const runId = m[2];
      const firstVis = Number(vm.FirstVisualChange) || 0;
      const lastVis = Number(vm.LastVisualChange) || 0;

      const times = [0];
      // Sitespeed.io only emits frames where visual progress is
      // changing — between First and Last Visual Change, at 100ms
      // intervals, with the last frame at the exact LastVisualChange.
      if (lastVis > 0) {
        const startMs = Math.max(100, Math.ceil(firstVis / 100) * 100);
        for (let t = startMs; t < lastVis; t += 100) times.push(t);
        if (times[times.length - 1] !== lastVis) times.push(lastVis);
      }

      return times.map(function (ms) {
        return {
          ms: ms,
          time: (ms / 1000).toFixed(2),
          img: dataBase + '/filmstrip/' + runId + '/ms_' +
               String(ms).padStart(6, '0') + '.jpg'
        };
      });
    }
  }

  // Legacy WPT path — the HAR's page object has a filmstrip array
  // directly. Translate into the same shape.
  const legacy = page.filmstrip || (page._wpt && page._wpt.filmstrip);
  if (Array.isArray(legacy) && legacy.length > 0) {
    return legacy.map(function (f) {
      const ms = Math.round((f.time || 0) * 1000);
      return {
        ms: ms,
        time: (ms / 1000).toFixed(2),
        img: f.file || f.image || ''
      };
    });
  }

  return null;
}

/**
 * Build filmstrip data for both HARs in the comparison.
 * Returns null if neither HAR has frames available.
 */
function getFilmstrip(har1, run1, har2, run2) {
  const frames1 = getFilmstripForPage(har1, run1) || [];
  const frames2 = getFilmstripForPage(har2, run2) || [];
  if (frames1.length === 0 && frames2.length === 0) return null;

  const maxMs = Math.max(
    frames1.length ? frames1[frames1.length - 1].ms : 0,
    frames2.length ? frames2[frames2.length - 1].ms : 0
  );
  return { frames1: frames1, frames2: frames2, maxMs: maxMs };
}
