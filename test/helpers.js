import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import vm from 'node:vm';

// The compare scripts are classic browser scripts that share globals,
// so load them into one context, the same as the page does.
export function loadScripts(names, globals = {}) {
  const context = vm.createContext({ ...globals });
  for (const name of names) {
    const file = new URL(`../public/js/compare/${name}.js`, import.meta.url);
    vm.runInContext(readFileSync(file, 'utf8'), context, {
      filename: file.pathname
    });
  }
  return context;
}

// PageXray is a UMD bundle; give it a CommonJS module to fill in.
export function loadPageXray() {
  const module = { exports: {} };
  const file = new URL('../public/js/dependencies/pagexray.min.js', import.meta.url);
  vm.runInContext(readFileSync(file, 'utf8'),
    vm.createContext({ module, exports: module.exports }), { filename: file.pathname });
  return module.exports;
}

export function readHar(name) {
  const buf = readFileSync(new URL(`har/${name}`, import.meta.url));
  return JSON.parse(name.endsWith('.gz') ? gunzipSync(buf) : buf);
}
