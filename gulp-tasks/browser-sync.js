'use strict';
/**
 * Use Browser Sync for local development
 */
const gulp = require('gulp');
const browserSync = require('browser-sync').create();
const gulpPaths = require('../gulp-paths');
const changed = require('gulp-changed');

function copyHtmlTask() {
  return gulp.src(gulpPaths.paths.src.index, { base: './' })
    .pipe(changed(`${gulpPaths.paths.dist.build}`))
    .pipe(gulp.dest(`${gulpPaths.paths.dist.build}`));
}

function copyCssTask() {
  return gulp.src(`${gulpPaths.paths.src.css}**/*`, { base: './' })
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
  // watch CSS files for changes
  gulp.watch(`${gulpPaths.paths.src.css}**/*`, copyCssTask);
  // watch images for changes
  gulp.watch(`${gulpPaths.paths.src.img}**/*`, copyImageTask);
  // watch JavaScript for changes
  gulp.watch(`${gulpPaths.paths.src.js}**/*`, copyJsTask);
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

  // setup browsersync watch tasks
  // NOTE: This is quite crude at the moment, CSS injection will be possible
  gulp.watch(`${gulpPaths.paths.dist.css}**/*`).on('change', browserSync.reload);
  gulp.watch(`${gulpPaths.paths.dist.js}**/*`).on('change', browserSync.reload);
  gulp.watch(`${gulpPaths.paths.dist.img}**/*`).on('change', browserSync.reload);
  gulp.watch(`${gulpPaths.paths.dist.build}*.html`).on('change', browserSync.reload);
}

// watch files and serve run in parallel
gulp.task('serve', gulp.parallel(watchFilesTask, serveTask));
