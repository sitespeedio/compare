/* global readHar, errorMessage, generate, showUpload, showLoading, removeAndHide, isBundle, loadFromBundle */
/* exported createMainDropZone, createUpload  */

// Native drag-and-drop + click-to-pick replacement for the old
// FileDropJS dep. The drop zone is a real fieldset in the markup; we
// attach a hidden <input type="file"> so clicks fall through to the
// OS file picker, and we listen for `drop` to receive dragged files.

function createMainDropZone(id) {
  const zone = document.getElementById(id);
  if (!zone) return;

  const picker = document.createElement('input');
  picker.type = 'file';
  picker.accept = '.har,.har.gz,.json,application/json';
  picker.multiple = true;
  picker.hidden = true;
  zone.appendChild(picker);

  function handleFiles(filesLike) {
    const files = Array.from(filesLike || []);
    if (files.length === 0) return;

    const stripVersion = document.getElementById('stripVersion').checked;

    if (files.length > 2) {
      errorMessage('You can only compare max two HAR files at a time!');
      return;
    }

    if (files.length === 2) {
      showLoading();
      Promise.all([readHar(files[0]), readHar(files[1])])
        .then(([har1, har2]) =>
          generate({
            har1: {
              har: har1,
              run: 0,
              label: shortLabel(files[0].name)
            },
            har2: {
              har: har2,
              run: 0,
              label: shortLabel(files[1].name)
            },
            stripVersion: stripVersion
          })
        )
        .catch(e => {
          /* eslint-disable no-console */
          console.error(e);
          /* eslint-enable no-console */
          showUpload();
          errorMessage(e.message);
        });
    } else {
      showLoading();
      readHar(files[0])
        .then(har => {
          removeAndHide();
          // Bundles round-trip through the same file picker as HARs,
          // so detect by the explicit flag and route to the bundle
          // loader (which fills in both HARs from the embedded data).
          if (isBundle(har)) {
            loadFromBundle(har);
            return;
          }
          generate({
            har1: { har: har, run: 0, label: 'HAR1' },
            har2: {
              har: har,
              run: har.log.pages.length > 1 ? 1 : 0,
              label: 'HAR2'
            },
            stripVersion: stripVersion
          });
        })
        .catch(e => {
          /* eslint-disable no-console */
          console.error(e);
          /* eslint-enable no-console */
          showUpload();
          errorMessage(e.message);
        });
    }
  }

  // Drag-and-drop
  ['dragenter', 'dragover'].forEach(ev =>
    zone.addEventListener(ev, e => {
      e.preventDefault();
      zone.classList.add('over');
    })
  );
  ['dragleave', 'dragend'].forEach(ev =>
    zone.addEventListener(ev, () => zone.classList.remove('over'))
  );
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('over');
    handleFiles(e.dataTransfer && e.dataTransfer.files);
  });

  // Click-to-pick
  zone.addEventListener('click', e => {
    // Don't re-trigger the picker when the inner click came from the
    // picker itself (or from a child interactive element if one is
    // ever added).
    if (e.target === picker) return;
    picker.click();
  });
  picker.addEventListener('change', () => {
    handleFiles(picker.files);
    picker.value = '';
  });
}

function shortLabel(name) {
  return name.length > 20 ? name.slice(0, 20) + '...' : name;
}

/**
 * The per-HAR "Upload" buttons that swap a single HAR after the
 * comparison is rendered.
 */
function createUpload(id) {
  const upload = document.getElementById(id);
  upload.addEventListener('change', function() {
    const files = this.files;
    if (files.length > 1) {
      errorMessage('You can only add one HAR at a time');
      return;
    }
    const stripVersion = document.getElementById('stripVersion').checked;
    readHar(files[0])
      .then(har => {
        const changeHar1 = id.indexOf('har1') > -1;
        const optionName = changeHar1 ? 'run2Option' : 'run1Option';
        const e2 = document.getElementById(optionName);
        const run = e2 ? e2.options[e2.selectedIndex].value : 0;
        const prev = window.har || {};
        const har1 = changeHar1 ? har : prev.har1.har;
        const har2 = changeHar1 ? prev.har2.har : har;
        const run1 = changeHar1 ? 0 : run;
        const run2 = changeHar1 ? run : 0;
        const label1 = changeHar1 ? 'HAR1' : prev.har1.label;
        const label2 = changeHar1 ? prev.har2.label : 'HAR2';
        // The freshly-uploaded HAR has no source URL; preserve the
        // other HAR's URL so the share UI keeps "Copy share link"
        // available if both are still URL-backed (else it correctly
        // falls through to "Download bundle").
        const url1 = changeHar1 ? undefined : prev.har1 && prev.har1.url;
        const url2 = changeHar1 ? (prev.har2 && prev.har2.url) : undefined;

        generate({
          har1: { har: har1, run: run1, label: label1, url: url1 },
          har2: { har: har2, run: run2, label: label2, url: url2 },
          stripVersion: stripVersion,
          title: prev.title,
          firstParty: prev.firstParty,
          comments: prev.comments
        });
      })
      .catch(e => {
        /* eslint-disable no-console */
        console.error(e);
        /* eslint-enable no-console */
        errorMessage(e.message);
      });
  });
}
