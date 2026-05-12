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
//    it. Sitespeed.io's filmstrip plugin writes files on a fixed
//    100 ms cadence anchored to FirstVisualChange and LastVisualChange
//    — NOT one per VisualProgress change point. Specifically it
//    writes:
//      - ms 0 (the pre-load frame)
//      - FirstVisualChange (only when not on a 100 ms boundary)
//      - every 100 ms multiple strictly between FVC and LVC
//      - LastVisualChange (only when not on a 100 ms boundary)
//    VisualProgress is sampled at video-frame cadence (~30 fps),
//    so most change points fall between filmstrip frames and have
//    no file on disk. Deriving the strip from VP change points
//    therefore produced a steady stream of 404s.
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
  // → .../data/filmstrip/1/ms_NNNNNN.jpg) and construct the frame
  // timestamps to match what the filmstrip plugin actually wrote.
  const meta = page._meta || {};
  const vm = page._visualMetrics;
  if (meta.screenshot && vm &&
      typeof vm.FirstVisualChange === 'number' &&
      typeof vm.LastVisualChange === 'number') {
    const m = meta.screenshot.match(/^(.+\/data)\/screenshots\/(\d+)\//);
    if (m) {
      const dataBase = m[1];
      const runId = m[2];
      const fvc = vm.FirstVisualChange;
      const lvc = vm.LastVisualChange;
      const vp = vm.VisualProgress || {};

      const times = [0];
      if (fvc > 0 && fvc % 100 !== 0) times.push(fvc);
      // First 100 ms boundary strictly after FVC, then step to the
      // last boundary strictly before LVC. The `< lvc` guard is what
      // matches sitespeed.io's behaviour when LVC sits exactly on a
      // boundary (the file is the LVC one, not an extra boundary
      // frame).
      const firstBoundary = Math.floor(fvc / 100) * 100 + 100;
      for (let t = firstBoundary; t < lvc; t += 100) {
        times.push(t);
      }
      if (lvc > 0 && (lvc % 100 !== 0 || lvc > (times[times.length - 1] || 0))) {
        if (lvc !== times[times.length - 1]) times.push(lvc);
      }

      // VisualProgress is sampled finer than the filmstrip; for each
      // filmstrip timestamp pick the most recent VP entry at or
      // before it as the "rendered %" tag. Drives the divergence
      // colouring in the column view.
      const vpKeys = Object.keys(vp).map(Number).sort(function (a, b) { return a - b; });
      function progressAt(ms) {
        let best = null;
        for (let i = 0; i < vpKeys.length; i++) {
          if (vpKeys[i] <= ms) best = vp[vpKeys[i]];
          else break;
        }
        return best;
      }

      return times.map(function (ms) {
        return {
          ms: ms,
          time: (ms / 1000).toFixed(2),
          img: dataBase + '/filmstrip/' + runId + '/ms_' +
               String(ms).padStart(6, '0') + '.jpg',
          progress: progressAt(ms)
        };
      });
    }
  }

  // Legacy WPT path — the HAR's page object has a filmstrip array
  // directly. Translate into the same shape. WPT entries usually carry
  // a `VisuallyComplete` percent on each frame; surface it as
  // progress so divergence colouring still works.
  const legacy = page.filmstrip || (page._wpt && page._wpt.filmstrip);
  if (Array.isArray(legacy) && legacy.length > 0) {
    return legacy.map(function (f) {
      const ms = Math.round((f.time || 0) * 1000);
      const prog = typeof f.progress === 'number' ? f.progress
                 : typeof f.VisuallyComplete === 'number' ? f.VisuallyComplete
                 : null;
      return {
        ms: ms,
        time: (ms / 1000).toFixed(2),
        img: f.file || f.image || '',
        progress: prog
      };
    });
  }

  return null;
}

/**
 * Resample a change-point frame list onto a uniform time grid so the
 * rendered strip reads like an actual filmstrip: every cell represents
 * the same time slice, repeating the last-known frame until the page
 * visibly changes again. Without this the cells are spaced by *visual
 * progress*, which makes "nothing happened for 2 s" look identical to
 * "everything changed in 50 ms".
 */
function padFrames(frames, maxMs, stepMs) {
  if (frames.length === 0) return [];
  const padded = [];
  let lastFrame = frames[0];
  let nextIdx = 0;
  for (let t = 0; t <= maxMs; t += stepMs) {
    while (nextIdx < frames.length && frames[nextIdx].ms <= t) {
      lastFrame = frames[nextIdx];
      nextIdx++;
    }
    padded.push({
      ms: t,
      time: (t / 1000).toFixed(1),
      img: lastFrame.img,
      sourceMs: lastFrame.ms,
      progress: lastFrame.progress
    });
  }
  // Always end on the exact LastVisualChange frame so the final visual
  // state is shown, even if it falls between two grid steps.
  const lastAvailable = frames[frames.length - 1];
  if (lastAvailable.ms !== padded[padded.length - 1].ms) {
    padded.push({
      ms: lastAvailable.ms,
      time: (lastAvailable.ms / 1000).toFixed(1),
      img: lastAvailable.img,
      sourceMs: lastAvailable.ms,
      progress: lastAvailable.progress
    });
  }
  return padded;
}

/**
 * Build filmstrip data for both HARs in the comparison.
 * Returns null if neither HAR has frames available.
 */
function getFilmstrip(har1, run1, har2, run2) {
  const raw1 = getFilmstripForPage(har1, run1) || [];
  const raw2 = getFilmstripForPage(har2, run2) || [];
  if (raw1.length === 0 && raw2.length === 0) return null;

  const maxMs = Math.max(
    raw1.length ? raw1[raw1.length - 1].ms : 0,
    raw2.length ? raw2[raw2.length - 1].ms : 0
  );

  // 100 ms is sitespeed.io's native capture cadence, so every cell
  // maps to a real on-disk frame whenever the page is actually
  // changing. For very long pages we widen the step so the rail
  // stops at ~120 cells.
  let stepMs = 100;
  while (Math.floor(maxMs / stepMs) + 1 > 120) {
    stepMs *= 2;
  }

  return {
    frames1: padFrames(raw1, maxMs, stepMs),
    frames2: padFrames(raw2, maxMs, stepMs),
    maxMs: maxMs,
    stepMs: stepMs
  };
}
