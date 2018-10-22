'use strict';
/**
 * Copy images into build directory
 */
const gulp = require('gulp');
const gulpPaths = require('../gulp-paths');

function copyImgTask(){
  return gulp.src([`${gulpPaths.paths.src.img}**/*`]).pipe(gulp.dest(`${gulpPaths.paths.dist.img}`));
}

gulp.task('copy-img', copyImgTask);
