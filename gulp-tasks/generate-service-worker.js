'use strict';
/**
 * Generate the service worker using WorkBox
 */
const gulp = require('gulp');
const workboxBuild = require('workbox-build');
const gulpPaths = require('../gulp-paths');

const swSetup = {
  // set cache name prefix
  cacheId: 'sitespeed.io-compare-',
  // only allow caching of files under 1MB
  maximumFileSizeToCacheInBytes: 1 * 1024 * 1024,
  // use the a local copy of workbox (no the CDN)
  importWorkboxFrom: 'local',
  // what directory / files to precache
  globDirectory: gulpPaths.paths.dist.build,
  globPatterns: ['**\/*.{html,js,css,png,jpg,jpeg,ico}'],
  swDest: `${gulpPaths.paths.dist.build}service-worker.js`,
  // claim any browser tabs that are running immediately
  clientsClaim: true,
  // skip the wait and init immediately
  skipWaiting: true
};

function generateTask() {
  return workboxBuild.generateSW(swSetup)
    .then(({ warnings }) => {
      // In case there are any warnings from workbox-build, log them.
      for (const warning of warnings) {
        console.warn(warning);
      }
      console.info('Service worker generation completed.');
    }).catch((error) => {
      console.warn('Service worker generation failed:', error);
    });
}

gulp.task('generate-sw', generateTask);
