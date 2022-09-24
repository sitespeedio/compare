'use strict';
/**
 * Generate the service worker using WorkBox
 */
const gulp = require('gulp');
const workboxBuild = require('workbox-build');
const gulpPaths = require('../gulp-paths');

const swSetup = {
  // set cache name prefix
  cacheId: 'sitespeed.io-compare-html-',
  // only allow caching of files under 1MB
  maximumFileSizeToCacheInBytes: 1 * 1024 * 1024,
  // use the a local copy of workbox (no the CDN)
  // importWorkboxFrom: 'local',
  // what directory / files to precache
  globDirectory: gulpPaths.paths.dist.build,
  globPatterns: ['**\/*.html'],
  swDest: `${gulpPaths.paths.dist.build}service-worker.js`,
  // claim any browser tabs that are running immediately
  clientsClaim: true,
  // skip the wait and init immediately
  skipWaiting: true,
  // remove outdated caches from WorkBox 3.x.x
  cleanupOutdatedCaches: true,
  // define custom caching routes for more flexibility
  runtimeCaching: [{
    urlPattern: new RegExp('.*.(?:css|js)'),
    // using cache first strategy since files are revisioned
    handler: 'CacheFirst',
    options: {
      cacheName: 'sitespeed.io-compare-application-cache-',
      expiration: {
        // assets cached for 30 days ensuring older revisions clear out after this time
        maxAgeSeconds: 30 * 24 * 60 * 60
      }
    }
  },
  {
    urlPattern: new RegExp('.*.(?:png|jpg|jpeg|ico)'),
    // StaleWhileRevalidate used for minor assets, cache used first then updated later if required
    handler: 'StaleWhileRevalidate',
    options: {
      cacheName: 'sitespeed.io-compare-image-cache-'
    }
  }
]
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

// expose the module so it can be used in browsersync watch
module.exports = generateTask;
