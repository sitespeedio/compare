/* exported readHar, isFileGzipped, isFileZipped, readGZipFile, gzipArrayBufferToJSON */

// gzip helpers — the heavy lifting is done by the browser-native
// DecompressionStream (Compression Streams API). zlib.js used to live
// here as a polyfill back when this was Safari < 16.4 territory; the
// native API is now available everywhere we care about (Chrome 80+,
// Firefox 113+, Safari 16.4+).

async function gzipArrayBufferToJSON(arrayBuffer) {
  const stream = new Blob([arrayBuffer])
    .stream()
    .pipeThrough(new DecompressionStream('gzip'));
  const text = await new Response(stream).text();
  return JSON.parse(text);
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
      gzipArrayBufferToJSON(reader.result)
        .then(resolve)
        .catch(e =>
          reject(new Error('Error reading ' + file.name + ' : ' + e.message))
        );
    };

    reader.readAsArrayBuffer(file.nativeFile ? file.nativeFile : file);
  });
}
