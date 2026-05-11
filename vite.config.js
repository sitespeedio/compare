import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset URLs so the built site works both at the root of
  // compare.sitespeed.io and when mounted under a sub-path (e.g. the
  // onlinetest server serves a vendored copy at `/compare/`).
  base: './',
  // Anything in public/ is served at the site root verbatim, with the
  // same paths in dev and production. Used for the classic compare
  // scripts (which share globals via window).
  publicDir: 'public',
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
