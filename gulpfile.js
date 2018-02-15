const usemin = require('gulp-usemin');
const htmlmin = require('gulp-htmlmin');
const rev = require('gulp-rev');
const gulp = require('gulp');
const del = require('del');

gulp.task('usemin', ['copy-img', 'copy-headers'], function() {
  return gulp
    .src('./index.html')
    .pipe(
      usemin({
        jsAttributes: {
          defer: true
        },
        css: [rev()],
        html: [htmlmin({
          collapseWhitespace: true
        })],
        js: [rev()]
      })
    )
    .pipe(gulp.dest('build/'));
});

gulp.task('copy-img', ['clean'], function() {
  return gulp.src(['./img/**/*']).pipe(gulp.dest('build/img/'));
});

gulp.task('copy-headers', [], function() {
  return gulp.src(['_headers']).pipe(gulp.dest('build/'));
});

gulp.task('clean', function() {
  return del([
    'build/**/*'
  ]);
});

gulp.task('default', ['usemin']);
