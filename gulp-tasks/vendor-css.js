'use strict';
/**
 * Vendor CSS Concat
 * Required due to Sass lang depreciating direct CSS inclusion in Sass files:
 * https://github.com/sass/node-sass/issues/2362
 */
const gulp = require('gulp');
const concatCss = require('gulp-concat-css');
const cleanCSS = require('gulp-clean-css');
const mode = require('gulp-mode')();
const gulpPaths = require('../gulp-paths');

function vendorCssTask() {
  return gulp.src([
    `${gulpPaths.paths.src.vendor}normalize.css`,
    `${gulpPaths.paths.src.vendor}simplegrid.css`,
    `${gulpPaths.paths.src.vendor}perf-cascade.css`,
    `${gulpPaths.paths.src.vendor}filedrop.css`,
    `${gulpPaths.paths.src.vendor}chartist.min.css`,
    `${gulpPaths.paths.src.vendor}chartist-plugin-tooltip.css`,
    `${gulpPaths.paths.src.vendor}loader.css`
  ], { base: './' })
  .pipe(concatCss('vendor.css'))
  .pipe(mode.production(cleanCSS()))
  .pipe(gulp.dest(gulpPaths.paths.dist.css));
}

gulp.task('vendor-css', vendorCssTask);
