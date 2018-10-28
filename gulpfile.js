'use strict';
/**
 * Gulp 4 config file
 * See 'gulp-tasks' directory for individual tasks
 */
const requireDir = require('require-dir');
const gulp = require('gulp');

// include the task files
requireDir('./gulp-tasks', { recurse: false });

/**
 * Production workflow:
 * 1. Clean the build directory
 * 2. Copy img / header files into build. Compile Sass and vendor CSS into build.
 * 3. Compile template index.html file
 * 4. Revision the CSS files and update index.html
 * 5. Generate the service worker
 */
gulp.task('default',
  gulp.series('clean', gulp.parallel('copy-assets:production', 'sass', 'vendor-css'), 'usemin', 'revision', 'generate-sw',
    function defaultSeriesComplete(done) {
      done();
    }));

/**
 * Development workflow:
 * 1. Clean the build directory
 * 2. Copy img / JS into build. Compile Sass and vendor CSS into build.
 * 3. Generate the service worker
 * 4. Run BrowserSync server
 */
gulp.task('develop',
  gulp.series('clean', gulp.parallel('copy-assets:development', 'sass', 'vendor-css'), 'generate-sw', 'serve',
    function developmentSeriesComplete(done) {
      done();
    }));
