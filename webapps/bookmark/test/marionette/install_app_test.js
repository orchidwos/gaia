'use strict';
/* global __dirname, require, marionette, suiteSetup, suiteTeardown */
/* global   setup, test */

var Bookmark = require('../../../../webapps/system/test/marionette/lib/bookmark');
var Server = require('../../../../shared/test/integration/server');

marionette('Bookmark -', function() {
  var options = require(__dirname + '/client_options.js');
  options.settings['dev.gaia.pinning_the_web'] = false;
  var client = marionette.client({
    profile: options,
    desiredCapabilities: { raisesAccessibilityExceptions: false }
  });
  var bookmark, server, system;

  suiteSetup(function(done) {
    Server.create(__dirname + '/fixtures/', function(err, _server) {
      server = _server;
      done();
    });
  });

  suiteTeardown(function() {
    server.stop();
  });

  setup(function() {
    system = client.loader.getAppClass('system');
    system.waitForFullyLoaded();
    bookmark = new Bookmark(client, server);
  });

  test('Install app from page', function() {

    var url = server.url('app.html');

    client.switchToFrame();
    bookmark.openAndInstall(url, 'My App Shortname', '/favicon.ico');

  });

});
