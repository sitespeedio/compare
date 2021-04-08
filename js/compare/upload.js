/* global readHar, errorMessage, generate, showUpload, showLoading, removeAndHide, FileDrop */
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
      showLoading();
      Promise.all([readHar(files[0]), readHar(files[1])])
        .then(([har1, har2]) =>
          generate({
            har1: {
              har: har1,
              run: 0,
              label: files[0].name.length > 20 ? files[0].name.substr(0, 20) + '...' : files[0].name
            },
            har2: {
              har: har2,
              run: 0,
              label: files[1].name.length > 20 ? files[1].name.substr(0, 20) + '...' : files[1].name
            }
          })
        )
        .catch(e => {
          /* eslint-disable no-console */
          console.error(e);
          /* eslint-disable no-console */
          showUpload();
          errorMessage(e.message);
        });
    } else {
      showLoading();
      readHar(files[0])
        .then(har => {
          removeAndHide();
          generate({
            har1: {
              har: har,
              run: 0,
              label: 'HAR1'
            },
            har2: {
              har: har,
              run: har.log.pages.length > 1 ? 1 : 0,
              label: 'HAR2'
            }
          });
        })
        .catch(e => {
          /* eslint-disable no-console */
          console.error(e);
          /* eslint-disable no-console */
          showUpload();
          errorMessage(e.message);
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
          const har1 = changeHar1 ? har : window.har.har1.har;
          const har2 = changeHar1 ? window.har.har2.har : har;
          const run1 = changeHar1 ? 0 : run;
          const run2 = changeHar1 ? run : 0;
          const label1 = changeHar1 ? 'HAR1' : window.har.har1.label;
          const label2 = changeHar1 ? window.har.har2.label : 'HAR2';

          generate({
            har1: {
              har: har1,
              run: run1,
              label: label1
            },
            har2: {
              har: har2,
              run: run2,
              label: label2
            }
          });
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
