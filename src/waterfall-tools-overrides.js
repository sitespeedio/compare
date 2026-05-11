// Compare-local wrapper around waterfall-tools.
//
// Lives here, not inside the vendored waterfall-tools bundle, so any
// fixes or compare-specific extensions can be iterated on without
// patching the upstream build. If something stabilises and looks
// generally useful, the path is to upstream it into waterfall-tools
// proper and drop it from this file.

// waterfall-tools is vendored as a pre-built ES bundle in
// src/vendor/. Imported dynamically so the bundle (plus its lazy
// decompress/tcpdump chunks) only downloads the first time the user
// actually renders a waterfall.
let waterfallToolsPromise;
function loadWaterfallTools() {
  if (!waterfallToolsPromise) {
    waterfallToolsPromise = import('./vendor/waterfall-tools/waterfall-tools.es.js');
  }
  return waterfallToolsPromise;
}

const encoder = new TextEncoder();

/**
 * Load a parsed HAR object into waterfall-tools and render it as a
 * canvas waterfall inside `container`. Both calls in a side-by-side
 * comparison should pass the *same* `endTimeMs` so the two waterfalls
 * share a time axis.
 *
 * @param {object} har        — parsed HAR object (already JSON.parsed)
 * @param {HTMLElement} container — destination DOM node (becomes parent of <canvas>)
 * @param {object} [opts]
 * @param {number} [opts.endTimeMs] — force the rendered time axis to extend to this many ms
 * @param {number} [opts.runIndex]  — which page in the HAR to render (waterfall-tools auto-picks the first if absent)
 * @returns {Promise<object>} — the WaterfallCanvas renderer instance
 */
export async function renderCompareWaterfall(har, container, opts = {}) {
  const { WaterfallTools } = await loadWaterfallTools();

  // waterfall-tools.loadBuffer wants a byte buffer it can stream. JSON-stringify
  // the parsed HAR and hand it back as UTF-8 bytes; cheap on a single HAR.
  const buf = encoder.encode(JSON.stringify(har));

  const wt = new WaterfallTools();
  await wt.loadBuffer(buf, { format: 'har' });

  const options = WaterfallTools.getDefaultOptions();

  // Sync the time axis across the pair. endTime is in seconds; the
  // caller measures the slowest run in ms (PerfCascade legacy unit).
  if (typeof opts.endTimeMs === 'number' && opts.endTimeMs > 0) {
    options.endTime = opts.endTimeMs / 1000;
    options.startTime = 0;
  }

  if (typeof opts.runIndex === 'number') {
    const keys = Object.keys(wt.data.pages);
    if (keys[opts.runIndex] != null) {
      options.pageId = keys[opts.runIndex];
    }
  }

  // Clear any previous canvas — generate() can be called multiple
  // times for the same container (e.g. when the run dropdown changes).
  container.innerHTML = '';

  return wt.renderTo(container, options);
}

// Expose for the classic-script consumers in js/compare/*.js.
window.compareWaterfall = { render: renderCompareWaterfall };
