/* jshint node: true */
'use strict';

var gulp = require('gulp');
var documentation = require('gulp-documentation');
var ghPages = require('gulp-gh-pages');
var del = require('del');
var fs = require('fs');
var path = require('path');

var JSDOC_JSON = 'jsdoc.json';
var JSDOC_TASK_PREFIX = 'jsdoc:';

var jsdocTasks = [];

var generatePerAppTasks = function(appFolder) {
  var files = fs.readdirSync(appFolder);

  // generate per app tasks and host those tasks name in jsdocTasks list
  files.forEach(function(filePath, i) {
    var appName = path.join(appFolder, filePath);
    if (fs.statSync(appName).isDirectory()) {
      // read jsdoc.json file in each app
      var jsonFile = path.join(appFolder, filePath, JSDOC_JSON);
      if (fs.existsSync(jsonFile)) {
        console.log(filePath + ' config file found');
        var appcfg = JSON.parse(fs.readFileSync(jsonFile,
          { encoding: 'utf8' }));
        if('name' in appcfg) {
          var property = appcfg['name'];
          jsdocTasks.push(JSDOC_TASK_PREFIX + property);
          gulp.task(JSDOC_TASK_PREFIX + property, function() {
            console.log('checking '+ appcfg.source.include)
            gulp.src(appcfg.source.include)
              .pipe(documentation({format: 'html'}))
              .pipe(gulp.dest(appcfg.opts.destination));
          });
          console.log('... ' + property + ' task registered');
        }
      }
    }
  });
};

['webapps', 'tv_webapps'].forEach(function(appFolder) {
  generatePerAppTasks(appFolder);
});

gulp.task('clean', function(cb) {
  del(['./docs'], cb);
});

gulp.task('docs', jsdocTasks);

gulp.task('github', ['docs'], function() {
  return gulp.src('./docs/**/*')
    .pipe(ghPages());
});
