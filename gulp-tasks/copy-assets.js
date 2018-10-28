'use strict';
/**
 * Copy the development assets into the build directory on first build
 */
const gulp = require('gulp');
const gulpPaths = require('../gulp-paths');

function copyDevelopmentAssetsTask() {
  return gulp.src([
    gulpPaths.paths.src.index,
    `${gulpPaths.paths.src.js}**/*`,
    `${gulpPaths.paths.src.img}**/*`,
  ], { base: './' }).pipe(gulp.dest(`${gulpPaths.paths.dist.build}`));
}

function copyProductionAssetsTask() {
  return gulp.src([
    gulpPaths.paths.src.index,
    gulpPaths.paths.src.headers,
    `${gulpPaths.paths.src.img}**/*`,
  ], { base: './' }).pipe(gulp.dest(`${gulpPaths.paths.dist.build}`));
}

gulp.task('copy-assets:development', copyDevelopmentAssetsTask);
gulp.task('copy-assets:production', copyProductionAssetsTask);
