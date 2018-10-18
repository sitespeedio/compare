/* global readHar, errorMessage, generate, showUpload, removeAndHide, FileDrop */
/* exported createMainDropZone, createUpload  */

/**
 * The main drop zone on the start page. Can handle one or two
 * HAR files.
 * @param {string} id
 */
function createMainDropZone(id) {
  const zone = new FileDrop(id, {});
  zone.multiple(true);

  zone.event('send', function(files) {
    if (files.length > 2) {
      errorMessage('You can only compare max two HAR files at a time!');
    } else if (files.length === 2) {
      Promise.all([readHar(files[0]), readHar(files[1])])
        .then(([har1, har2]) =>
          generate(
            {
              har: har1,
              run: 0
            },
            {
              har: har2,
              run: 0
            }
          )
        )
        .catch(e => {
          /* eslint-disable no-console */
          console.error(e);
          /* eslint-disable no-console */
          errorMessage(e.message);
          showUpload();
        });
    } else {
      readHar(files[0])
        .then(har => {
          removeAndHide();
          generate(
            {
              har: har,
              run: 0
            },
            {
              har: har,
              run: har.log.pages.length > 1 ? 1 : 0
            }
          );
        })
        .catch(e => {
          /* eslint-disable no-console */
          console.error(e);
          /* eslint-disable no-console */
          errorMessage(e.message);
          showUpload();
        });
    }
  });
}

/**
 *
 * The upload button
 * @param {string} id
 */
function createUpload(id) {
  const upload = document.getElementById(id);

  upload.addEventListener('change', function() {
    const files = this.files;
    if (files.length > 1) {
      errorMessage('You can only add one HAR at a time');
    } else {
      readHar(files[0])
        .then(har => {
          const changeHar1 = id.indexOf('har1') > -1;
          const optionName = changeHar1 ? 'run2Option' : 'run1Option';
          const e2 = document.getElementById(optionName);
          const run = e2 ? e2.options[e2.selectedIndex].value : 0;
          const har1 = changeHar1 ? har : window.har1;
          const har2 = changeHar1 ? window.har2 : har;
          const run1 = changeHar1 ? 0 : run;
          const run2 = changeHar1 ? run : 0;
          const label1 = changeHar1 ? 'HAR1' : window.label1;
          const label2 = changeHar1 ? window.label2 : 'HAR2';

          generate(
            {
              har: har1,
              run: run1,
              label: label1
            },
            {
              har: har2,
              run: run2,
              label: label2
            }
          );
        })
        .catch(e => {
          /* eslint-disable no-console */
          console.error(e);
          /* eslint-disable no-console */
          errorMessage(e.message);
        });
    }
  });
}
