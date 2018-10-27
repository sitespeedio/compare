'use strict';
/**
 * Usemin task for replaces references to non-optimized scripts
 * or stylesheets into a set of HTML files
 */
const gulp = require('gulp');
const usemin = require('gulp-usemin');
const htmlmin = require('gulp-htmlmin');
const rev = require('gulp-rev');
const gulpPaths = require('../gulp-paths');

function useminTask(){
  return gulp
    .src(gulpPaths.paths.src.index)
    .pipe(
      usemin({
        jsAttributes: {
          defer: true
        },
        html: [htmlmin({
          collapseWhitespace: true
        })],
        js: [rev()]
      })
    )
    .pipe(gulp.dest(gulpPaths.paths.dist.build));
}

gulp.task('usemin', useminTask);
