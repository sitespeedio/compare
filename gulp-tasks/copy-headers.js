'use strict';
/**
 * Copy _headers file into the build directory
 */
const gulp = require('gulp');
const gulpPaths = require('../gulp-paths');

function copyHeadersTask() {
  return gulp.src(['_headers']).pipe(gulp.dest(gulpPaths.paths.dist.build));
}

gulp.task('copy-headers', copyHeadersTask);
