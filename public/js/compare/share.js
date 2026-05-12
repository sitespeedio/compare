/* exported renderShareControls */

// The share affordance for the result page. Two modes:
//
//  * Both HARs were fetched from URLs → "Copy share link". The
//    recipient opens the URL and lands on the same comparison.
//
//  * One or both HARs are local (drop / paste / single-HAR upload) →
//    "Download bundle". The recipient can't reach a local file, so we
//    ship a single JSON with both HARs embedded; drop / paste of that
//    bundle on the start page re-renders the same comparison.
//
// renderShareControls() reads window.har (populated by generate.js) so
// it always reflects the current comparison after a swap or run change.

function renderShareControls() {
  const container = document.getElementById('shareControls');
  if (!container) return;
  container.innerHTML = '';
  const cfg = window.har;
  if (!cfg || !cfg.har1 || !cfg.har2) return;

  const u1 = cfg.har1.url;
  const u2 = cfg.har2.url;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'submit submit-smaller share-button';

  if (u1 && u2) {
    btn.textContent = 'Copy share link';
    btn.title = 'Copy a link that opens this comparison';
    btn.addEventListener('click', function () {
      copyShareLink(btn, u1, u2, cfg.stripVersion);
    });
  } else {
    btn.textContent = 'Download bundle';
    btn.title = 'Save both HARs into a single file you can re-open or share';
    btn.addEventListener('click', function () {
      downloadBundle(btn, cfg);
    });
  }
  container.appendChild(btn);
}

function copyShareLink(btn, u1, u2, stripVersion) {
  const url = new URL(window.location.origin + window.location.pathname);
  url.searchParams.set('har1', u1);
  url.searchParams.set('har2', u2);
  if (stripVersion) url.searchParams.set('stripVersion', '1');
  const link = url.toString();
  copyToClipboard(link).then(function (ok) {
    flashShareFeedback(btn, ok ? 'Link copied' : 'Copy failed');
  });
}

function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text)
      .then(function () { return true; })
      .catch(function () { return fallbackCopy(text); });
  }
  return Promise.resolve(fallbackCopy(text));
}

// Old execCommand path — kept for browsers / contexts where the async
// Clipboard API is unavailable (insecure origins, some embeds).
function fallbackCopy(text) {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'absolute';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch (e) {
    return false;
  }
}

function flashShareFeedback(btn, text) {
  const previous = btn.textContent;
  btn.textContent = text;
  btn.disabled = true;
  setTimeout(function () {
    btn.textContent = previous;
    btn.disabled = false;
  }, 1500);
}

function downloadBundle(btn, cfg) {
  const bundle = {
    compareBundle: true,
    version: 1,
    title: cfg.title || undefined,
    firstParty: cfg.firstParty || undefined,
    stripVersion: !!cfg.stripVersion,
    comments: cfg.comments || undefined,
    har1: {
      har: cfg.har1.har,
      run: cfg.har1.run,
      label: cfg.har1.label
    },
    har2: {
      har: cfg.har2.har,
      run: cfg.har2.run,
      label: cfg.har2.label
    }
  };
  const blob = new Blob([JSON.stringify(bundle)], { type: 'application/json' });
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = bundleFilename(cfg);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function () { URL.revokeObjectURL(objectUrl); }, 0);
  flashShareFeedback(btn, 'Downloaded');
}

function bundleFilename(cfg) {
  function safe(s) {
    return (s || '').toString().replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 40);
  }
  const a = safe(cfg.har1 && cfg.har1.label) || 'har1';
  const b = safe(cfg.har2 && cfg.har2.label) || 'har2';
  return 'compare-' + a + '-vs-' + b + '.json';
}
