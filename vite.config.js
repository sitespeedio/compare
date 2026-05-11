import { defineConfig } from 'vite';

export default defineConfig({
  // Anything in public/ is served at the site root verbatim, with the
  // same paths in dev and production. Used for the classic compare
  // scripts (which share globals via window) and the pre-built
  // waterfall-tools ES bundle.
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
