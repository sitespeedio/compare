import { defineConfig } from 'vite';

// One per `vite build` invocation. Stamps the classic-script URLs in
// index.html below so the browser can tell two deploys' upload.js
// apart even though the path itself never changes.
const buildId = Date.now().toString(36);

export default defineConfig({
  // Relative asset URLs so the built site works both at the root of
  // compare.sitespeed.io and when mounted under a sub-path (e.g. the
  // onlinetest server serves a vendored copy at `/compare/`).
  base: './',
  // Anything in public/ is served at the site root verbatim, with the
  // same paths in dev and production. Used for the classic compare
  // scripts (which share globals via window).
  publicDir: 'public',
  plugins: [
    {
      // The Vite-emitted assets in /assets/ are already content-hashed
      // (filename changes when content changes). The classic compare
      // scripts in public/js/ are served at stable URLs — without help
      // they'd sit in browser caches across deploys. This plugin
      // appends ?v=<buildId> to those src URLs at build time so each
      // deploy invalidates the cache for its classic-script set.
      name: 'version-classic-scripts',
      apply: 'build',
      transformIndexHtml(html) {
        // base: './' rewrites root-relative paths to `./` form, so
        // match either shape.
        return html.replace(
          /src="((?:\.\/|\/)js\/[^"?]+\.js)"/g,
          'src="$1?v=' + buildId + '"'
        );
      }
    }
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true
  },
  server: {
    port: 3000,
    strictPort: false,
    open: false
  }
});
