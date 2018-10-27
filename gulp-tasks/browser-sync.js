'use strict';
/**
 * Use Browser Sync for local development
 */
const gulp = require('gulp');
const browserSync = require('browser-sync').create('Compare server');
const changed = require('gulp-changed');

// import local sass module for watch task
const sass = require('./sass');
const gulpPaths = require('../gulp-paths');


function copyHtmlTask() {
  return gulp.src(gulpPaths.paths.src.index, { base: './' })
    .pipe(changed(`${gulpPaths.paths.dist.build}`))
    .pipe(gulp.dest(`${gulpPaths.paths.dist.build}`));
}

function copyImageTask() {
  return gulp.src(`${gulpPaths.paths.src.img}**/*`, { base: './' })
    .pipe(changed(`${gulpPaths.paths.dist.build}`))
    .pipe(gulp.dest(`${gulpPaths.paths.dist.build}`));
}

function copyJsTask() {
  return gulp.src(`${gulpPaths.paths.src.js}**/*`, { base: './' })
    .pipe(changed(`${gulpPaths.paths.dist.build}`))
    .pipe(gulp.dest(`${gulpPaths.paths.dist.build}`));
}

// setup watch copy tasks
// NOTE: Copy tasks only copy the files that have changed
function watchFilesTask() {
  // watch HTML file for changes
  gulp.watch(gulpPaths.paths.src.index, copyHtmlTask);
  // watch images for changes
  gulp.watch(`${gulpPaths.paths.src.img}**/*`, copyImageTask);
  // watch JavaScript for changes
  gulp.watch(`${gulpPaths.paths.src.js}**/*`, copyJsTask);
}

// Simple reload task
function reload() {
  browserSync.reload();
}

gulp.task('watch', watchFilesTask);

function serveTask(){
  browserSync.init({
    server: gulpPaths.paths.dist.build,
    notify: false,
    // open browser window once server is running
    open: false,
    // server port
    port: 8080,
    // browsersync settings UI port
    ui: {
      port: 8081,
      weinre: {
        port: 9090
      }
    }
  });

  // If sass changes, inject into the page
  gulp.watch(`${gulpPaths.paths.src.sass}*.scss`, sass);
  // if any below file changes will browsersync will reload the page
  gulp.watch(`${gulpPaths.paths.dist.js}**/*`).on('change', reload);
  gulp.watch(`${gulpPaths.paths.dist.img}**/*`).on('change', reload);
  gulp.watch(`${gulpPaths.paths.dist.build}*.html`).on('change', reload);
}

// watch files and serve run in parallel
gulp.task('serve', gulp.parallel(watchFilesTask, serveTask));
