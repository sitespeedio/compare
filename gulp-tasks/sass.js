'use strict';
/**
 * Sass to CSS compilation
 * Based on: https://goede.site/setting-up-gulp-4-for-automatic-sass-compilation-and-css-injection
 */
const gulp = require('gulp');
const sass = require('gulp-sass')(require('sass'));
const postcss = require('gulp-postcss');
const autoprefixer = require('autoprefixer');
const cssnano = require('cssnano');
const sourcemaps = require('gulp-sourcemaps');
const sassLint = require('gulp-sass-lint');
const mode = require('gulp-mode')();
// get the browsersync server if it is running
const browserSync = require('browser-sync').get('Compare server');
const gulpPaths = require('../gulp-paths');

function styleTask(){
  return gulp
    .src(`${gulpPaths.paths.src.sass}*.scss`)
    // only generate sourcemaps in development
    .pipe(mode.development(sourcemaps.init()))
    .pipe(mode.development(sassLint({
      options: {
        'merge-default-rules': true
      },
      configFile: '.sass-lint.yml'
    })))
    .pipe(mode.development(sassLint.format()))
    .pipe(mode.development(sassLint.failOnError()))
    .pipe(sass())
    .on('error', sass.logError)
    .pipe(postcss([autoprefixer()]))
    // only minimise CSS in production
    .pipe(mode.production(postcss([cssnano()])))
    // only write sourcemaps in development
    .pipe(mode.development(sourcemaps.write()))
    .pipe(gulp.dest(gulpPaths.paths.dist.css))
    // only inject changed CSS into the page in development
    .pipe(mode.development(browserSync.stream()));
}

gulp.task('sass', styleTask);

// expose the module so it can be used in browsersync watch
module.exports = styleTask;
