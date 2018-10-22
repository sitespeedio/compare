'use strict';
/**
 * Gulp 4 config file
 * See 'gulp-tasks' directory for individual tasks
 */
const requireDir = require('require-dir');
const gulp = require('gulp');

// include the task files
requireDir('./gulp-tasks', { recurse: false });

// set the default task, all tasks run in series
gulp.task('default', gulp.series('clean', 'copy-img', 'copy-headers', 'usemin', function defaultSeriesComplete(done) {
  done();
}));

// setup the development workflow
gulp.task('develop', gulp.series('clean', 'copy-development-assets', 'serve', function developmentSeriesComplete(done) {
  done();
}));
