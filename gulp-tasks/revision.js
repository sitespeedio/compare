'use strict';
/**
 * Revision the CSS files on production build only
 */
const gulp = require('gulp');
const rev = require('gulp-rev');
const revRewrite = require('gulp-rev-rewrite');
const revDelete = require('gulp-rev-delete-original');
const del = require('del');
const gulpPaths = require('../gulp-paths');

function revisionTask() {
  return gulp.src(`${gulpPaths.paths.dist.css}*.css`)
    .pipe(rev())
    .pipe(revDelete())
    .pipe(gulp.dest(gulpPaths.paths.dist.css))
    .pipe(rev.manifest())
    .pipe(gulp.dest(gulpPaths.paths.dist.css));
}

function revisionRewriteTask() {
  const manifest = gulp.src(`${gulpPaths.paths.dist.css}rev-manifest.json`);

  return gulp.src(`${gulpPaths.paths.dist.build}index.html`)
    .pipe(revRewrite({manifest}))
    .pipe(gulp.dest(gulpPaths.paths.dist.build));
}

function cleanManifestTask() {
  return del([`${gulpPaths.paths.dist.css}rev-manifest.json`]);
}

gulp.task('revision-generate', revisionTask);
gulp.task('revision-rewrite', revisionRewriteTask);
gulp.task('clean-manifest', cleanManifestTask);


gulp.task('revision', gulp.series('revision-generate', 'revision-rewrite', 'clean-manifest'));
