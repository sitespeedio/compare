/* global Zlib, errorMessage, generate, showUpload */
/* exported readHar, fetchHar, getHarURL, loadFilesFromURL*/

/**
 * Help functions to read HAR files from file
 * or from URL
 */

function gzipArrayBufferToJSON(arrayBuffer) {
  /* utf.js - UTF-8 <=> UTF-16 convertion
   *
   * Copyright (C) 1999 Masanao Izumo <iz@onicos.co.jp>
   * Version: 1.0
   * LastModified: Dec 25 1999
   * This library is free.  You can redistribute it and/or modify it.
   */

  function Utf8ArrayToStr(array) {
    let out, i, len, c;
    let char2, char3;

    out = '';
    len = array.length;
    i = 0;
    while (i < len) {
      c = array[i++];
      switch (c >> 4) {
        case 0:
        case 1:
        case 2:
        case 3:
        case 4:
        case 5:
        case 6:
        case 7:
          // 0xxxxxxx
          out += String.fromCharCode(c);
          break;
        case 12:
        case 13:
          // 110x xxxx   10xx xxxx
          char2 = array[i++];
          out += String.fromCharCode(((c & 0x1f) << 6) | (char2 & 0x3f));
          break;
        case 14:
          // 1110 xxxx  10xx xxxx  10xx xxxx
          char2 = array[i++];
          char3 = array[i++];
          out += String.fromCharCode(
            ((c & 0x0f) << 12) | ((char2 & 0x3f) << 6) | ((char3 & 0x3f) << 0)
          );
          break;
      }
    }

    return out;
  }

  const byteArray = new Uint8Array(arrayBuffer);
  const gunzip = new Zlib.Gunzip(byteArray);
  const decompressedArray = gunzip.decompress();
  let string = '';
  // only way to make it work on Safari iOS?
  try {
    string = new TextDecoder('utf-8').decode(decompressedArray);
  } catch (e) {
    string = Utf8ArrayToStr(decompressedArray);
  }
  return JSON.parse(string);
}

function isFileGzipped(url) {
  return url.endsWith('.gz');
}

function isFileZipped(url) {
  return url.endsWith('.zip') || url.endsWith('.zhar');
}

function readGZipFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () =>
      reject(
        new Error('Error reading ' + file.name + ' : ' + reader.error.name)
      );
    reader.onload = () => {
      try {
        const har = gzipArrayBufferToJSON(reader.result);
        resolve(har);
      } catch (e) {
        reject(new Error('Error reading ' + file.name + ' : ' + e.message));
      }
    };

    reader.readAsArrayBuffer(file.nativeFile ? file.nativeFile : file);
  });
}

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
 * Magically calculate the URL from a sitespeed.io upload
 * @param {string} url
 */
function getHarURL(url) {
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
  } else {
    harURL = url;
  }
  return {
    har: harURL,
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

function loadFilesFromURL() {
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

  const URL = document.getElementById('harurl').value;
  const URL2 = document.getElementById('harurl2').value;

  if (URL.startsWith('http') && URL2.startsWith('http')) {
    const har1 = getHarURL(URL);
    const har2 = getHarURL(URL2);

    const harPromise = fetchHar(har1.har);
    const harPromise2 = fetchHar(har2.har);

    Promise.all([harPromise, harPromise2])
      .then(([h1, h2]) =>
        generate(
          {
            har: h1,
            run: har1.run
          },
          {
            har: h2,
            run: har2.run
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
  } else if (URL.startsWith('http') || URL2.startsWith('http')) {
    const theOne = URL.startsWith('http') ? URL : URL2;
    const harUrl = getHarURL(theOne);
    fetchHar(harUrl.har)
      .then(har => {
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
  } else {
    errorMessage(
      'You need to add two URLs to be able to compare or drag/drop the HAR files.'
    );
  }
}
