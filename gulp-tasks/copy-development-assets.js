'use strict';
/**
 * Copy all the development assets into the build directory on first build
 */
const gulp = require('gulp');
const gulpPaths = require('../gulp-paths');

function copyDevelopmentAssetsTask() {
  return gulp.src([
    'index.html',
    `${gulpPaths.paths.src.css}**/*`,
    `${gulpPaths.paths.src.js}**/*`,
    `${gulpPaths.paths.src.img}**/*`,
  ], {base: './'}).pipe(gulp.dest(`${gulpPaths.paths.dist.build}`));
}

gulp.task('copy-development-assets', copyDevelopmentAssetsTask);
