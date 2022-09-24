/* global isFileGzipped, isFileZipped, gzipArrayBufferToJSON, readGZipFile, errorMessage, generate, showUpload */
/* exported readHar, fetchHar, getHarURL, loadFilesFromURL, loadFilesFromGist, loadFilesFromConfig*/

/**
 * Help functions to read HAR/JSON files from file
 * or from URL
 */

function readJsonFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () =>
      reject(
        new Error('Error reading ' + file.name + ' : ' + reader.error.message)
      );
    reader.onload = () => {
      try {
        const har = JSON.parse(reader.result);
        resolve(har);
      } catch (e) {
        reject(new Error('Error reading ' + file.name + ' : ' + e.message));
      }
    };
    reader.readAsText(file.nativeFile ? file.nativeFile : file);
  });
}

/**
 * Is this the URL a sitespeed.io result page URL?
 * @param {*} url
 */
function isSitespeedIoURL(url) {
  if (
    url.endsWith('/') ||
    url.endsWith('/index.html') ||
    url.endsWith('.html')
  ) {
    return true;
  } else return false;
}
/**
 * Magically calculate the URL and run from a sitespeed.io upload
 * @param {string} url
 */
function getSitespeedIoHarURLAndRun(url) {
  let run = 0,
    harURL;

  // The sitespeed.io summary page
  if (url.endsWith('/') || url.endsWith('/index.html')) {
    run = 0;
    // TODO we are not sure the HAR file is gzipped, hmm
    harURL = url.slice(0, url.lastIndexOf('/')) + '/data/browsertime.har.gz';
  } else if (url.endsWith('.html')) {
    // Individual run page
    run = url.slice(url.lastIndexOf('/') + 1, url.length - 5);
    harURL = url.slice(0, url.lastIndexOf('/')) + '/data/browsertime.har.gz';
  }

  return {
    url: harURL,
    run: run
  };
}

function fetchHar(url) {
  return fetch(url).then(response => {
    if (!response.ok)
      throw new Error(
        'Failed to fetch har from ' + url + '. Error: ' + response.statusText
      );

    if (isFileZipped(url))
      throw new Error('Zip compressed HARs are not supported: ' + url);

    if (isFileGzipped(url))
      return response.arrayBuffer().then(gzipArrayBufferToJSON);

    return response.json();
  });
}

function readHar(file) {
  if (isFileZipped(file.name))
    return Promise.reject(
      new Error('Zip compressed HARs are not supported: ' + file.name)
    );

  if (isFileGzipped(file.name)) return readGZipFile(file);
  return readJsonFile(file);
}

function loadJson(url) {
  return fetch(url).then(response => {
    if (!response.ok)
      throw new Error(
        'Failed to fetch JSON from ' + url + '. Error: ' + response.statusText
      );

    if (isFileZipped(url))
      throw new Error('Zip compressed HARs are not supported: ' + url);

    if (isFileGzipped(url))
      return response.arrayBuffer().then(gzipArrayBufferToJSON);

    return response.json();
  });
}

function readConfig(config) {
  if (
    config &&
    config.har1 &&
    config.har1.url &&
    config.har2 &&
    config.har2.url
  ) {
    return loadHARsFromConfig(config);
  } else {
    throw new Error('Malformed config file.');
  }
}

function loadFilesFromConfig(url) {
  loadJson(url)
    .then(unparsedConfig => {
      let content;
      try {
        content = JSON.parse(unparsedConfig);
      } catch (e) {
        throw new Error('Malformed config file.' + e);
      }
      return readConfig(content);
    })
    .catch(e => {
      /* eslint-disable no-console */
      console.error(e);
      /* eslint-disable no-console */
      errorMessage(e.message);
      showUpload();
    });
}

function loadFilesFromGist(id) {
  const url = 'https://api.github.com/gists/' + id;

  loadJson(url)
    .then(gist => {
      // We only support one file at the moment
      const key = Object.keys(gist.files)[0];
      let content;
      try {
        content = JSON.parse(gist.files[key].content);
      } catch (e) {
        throw new Error('Malformed gist.' + e);
      }
      return readConfig(content);
    })
    .catch(e => {
      /* eslint-disable no-console */
      console.error(e);
      /* eslint-disable no-console */
      errorMessage(e.message);
      showUpload();
    });
}

function loadHARsFromConfig(config) {
  // The runs/pages are zero based since it's an array but
  // in configuration we wanna use 1 based since it makes more sense
  if (config.har1.run) {
    config.har1.run = config.har1.run - 1;
  }
  if (config.har2.run) {
    config.har2.run = config.har2.run - 1;
  }

  // There's a magic hack to get the HAR and the run if you use sitespeed.io
  let reworkedConfig = config.har1;
  if (isSitespeedIoURL(config.har1.url)) {
    reworkedConfig = getSitespeedIoHarURLAndRun(config.har1.url);
  }
  const harPromise = loadJson(reworkedConfig.url);

  let harPromise2 = harPromise;
  let reworkedConfig2 = config.har2;
  if (config.har2.url) {
    if (isSitespeedIoURL(config.har2.url)) {
      reworkedConfig2 = getSitespeedIoHarURLAndRun(config.har2.url);
    }
    harPromise2 = loadJson(reworkedConfig2.url);
  }
  Promise.all([harPromise, harPromise2])
    .then(([har1, har2]) =>
      generate({
        har1: {
          har: har1,
          run: reworkedConfig.run || config.har1.run || 0,
          label: config.har1.label || 'HAR1'
        },
        har2: {
          har: har2,
          run: reworkedConfig2.run || config.har2.run || 0,
          label: config.har2.label || 'HAR2'
        },
        comments: config.comments || undefined,
        title: config.title || 'Compare HAR files',
        firstParty: config.firstParty || undefined
      })
    )
    .catch(e => {
      /* eslint-disable no-console */
      console.error(e);
      /* eslint-disable no-console */
      errorMessage(e.message);
      showUpload();
    });
}
