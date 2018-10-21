/* global Zlib */
/* exported readHar, isFileGzipped, isFileZipped, readGZipFile */

/**
 * Help functions to read gzipped files
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
