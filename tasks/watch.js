/*
 * grunt-contrib-watch
 * http://gruntjs.com/
 *
 * Copyright (c) 2013 "Cowboy" Ben Alman, contributors
 * Licensed under the MIT license.
 */

module.exports = function(grunt) {
  'use strict';

  var path = require('path');
  var Gaze = require('gaze').Gaze;
  var taskrun = require('./lib/taskrunner')(grunt);

  var waiting = 'Waiting...';
  var changedFiles = Object.create(null);

  // When task runner has started
  taskrun.on('start', function() {
    grunt.log.ok();
    Object.keys(changedFiles).forEach(function(filepath) {
      // Log which file has changed, and how.
      grunt.log.ok('File "' + filepath + '" ' + changedFiles[filepath] + '.');
    });
    // Reset changedFiles
    changedFiles = Object.create(null);
  });

  // When task runner has ended
  taskrun.on('end', function(time) {
    if (time > 0) {
      grunt.log.writeln('').write(String(
        'Completed in ' +
        time.toFixed(3) +
        's at ' +
        (new Date()).toString()
      ).cyan + ' - ' + waiting);
    }
  });

  // When a task run has been interrupted
  taskrun.on('interrupt', function() {
    grunt.log.writeln('').write('Scheduled tasks have been interrupted...'.yellow);
  });

  // When taskrun is reloaded
  taskrun.on('reload', function() {
    taskrun.clearRequireCache(Object.keys(changedFiles));
    grunt.log.writeln('').writeln('Reloading watch config...'.cyan);
  });

  grunt.registerTask('watch', 'Run predefined tasks whenever watched files change.', function() {
    var self = this;

    // Never gonna give you up, never gonna let you down
    taskrun.forever();

    if (taskrun.running === false) { grunt.log.write(waiting); }

    // initialize taskrun
    var targets = taskrun.init(self.name || 'watch', {
      interrupt: false,
      nospawn: false,
    });

    targets.forEach(function(target, i) {
      if (typeof target.files === 'string') { target.files = [target.files]; }

      // Process into raw patterns
      var patterns = grunt.util._.chain(target.files).flatten().map(function(pattern) {
        return grunt.config.process(pattern);
      }).value();

      // Create watcher per target
      new Gaze(patterns, target.options, function(err) {
        if (err) {
          if (typeof err === 'string') { err = new Error(err); }
          grunt.log.writeln('ERROR'.red);
          grunt.fatal(err);
          return taskrun.done();
        }

        // On changed/added/deleted
        this.on('all', function(status, filepath) {
          filepath = path.relative(process.cwd(), filepath);

          // If Gruntfile.js changed, reload self task
          if (/gruntfile\.(js|coffee)/i.test(filepath)) {
            taskrun.reload = true;
          }

          // Emit watch events if anyone is listening
          if (grunt.event.listeners('watch').length > 0) {
            grunt.event.emit('watch', status, filepath);
          }

          // Run tasks if any have been specified
          if (target.tasks) {
            changedFiles[filepath] = status;
            taskrun.queue(target.name);
            taskrun.run();
          }
        });

        // On watcher error
        this.on('error', function(err) {
          if (typeof err === 'string') { err = new Error(err); }
          grunt.log.error(err.message);
        });
      });
    });

  });
};
