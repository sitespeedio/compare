'use strict';
/**
 * Delete the build folder
 */
const gulp = require('gulp');
const del = require('del');
const gulpPaths = require('../gulp-paths');

function cleanTask(){
  return del([`${gulpPaths.paths.dist.build}**/*`]);
}

gulp.task('clean', cleanTask);
