'use strict';

var TaskManager = require('./lib/task_manager');
var FakeApp = require('./lib/fakeapp');
var assert = require('assert');
var ReflowHelper =
    require('../../../../tests/jsmarionette/plugins/reflow_helper.js');

marionette('Task Manager', function() {
  var firstAppOrigin  = 'fakeapp.gaiamobile.org';
  var secondAppOrigin = 'fakegreenapp.gaiamobile.org';
  var slowAppOrigin   = 'fakecamera.gaiamobile.org';
  var apps = {};
  apps[firstAppOrigin]  = __dirname + '/../webapps/fakeapp';
  apps[secondAppOrigin] = __dirname + '/../webapps/fakegreenapp';
  apps[slowAppOrigin]   = __dirname + '/../webapps/fakecamera';


  var client = marionette.client({
    profile: {
      apps: apps
    },
    desiredCapabilities: { raisesAccessibilityExceptions: false }
  });

  var actions;
  var system;
  var taskManager;
  var firstApp;
  var secondApp;

  var fullWidth, halfWidth, halfHeight;

  setup(function() {
    actions = client.loader.getActions();
    system = client.loader.getAppClass('system');

    system.waitForFullyLoaded();
    taskManager = new TaskManager(client);

    // Launching 2 apps and wait for their screenshots to be ready
    firstApp = new FakeApp(client, 'app://' + firstAppOrigin);
    firstApp.launch();
    system.goHome();
    system.waitUntilScreenshotable(firstApp.iframe);

    secondApp = new FakeApp(client, 'app://' + secondAppOrigin);
    secondApp.launch();
    system.goHome();
    system.waitUntilScreenshotable(secondApp.iframe);

    fullWidth = client.executeScript(function() {
      return window.innerWidth;
    });
    halfWidth = fullWidth / 2;

    var height = client.executeScript(function() {
      return window.innerHeight;
    });
    halfHeight = height / 2;
  });

  suite('when launched from the homescreen', function() {
    setup(function() {
      taskManager.show();
    });

    test('should display moz-element screenshots for all apps',
    function() {
      var cards = taskManager.cards;
      cards.forEach(function(card) {
        var screenshot = card.findElement(taskManager.selectors.screenshot);
        client.waitFor(function() {
          return screenshot.scriptWith(function(div) {
            return div.style.backgroundImage.contains('-moz-element');
          });
        });
      });
    });

    test('pressing home should take you back to the homescreen',
    function() {
      taskManager.hide();

      client.waitFor(function(){
        return client.findElement(system.Selector.activeHomescreenFrame)
          .getAttribute('aria-hidden') !== 'true';
      });
    });
  });

  suite('when launched from an app', function() {
    setup(function() {
      firstApp.launch();
      taskManager.show();
    });

    test('pressing home should still take you back to the homescreen',
    function() {
      actions.flick(taskManager.element, 30, halfHeight,
                    halfWidth, halfHeight).perform();

      taskManager.hide();

      client.waitFor(function(){
        return client.findElement(system.Selector.activeHomescreenFrame)
          .getAttribute('aria-hidden') !== 'true';
      });
    });
  });

  suite('when launched while an app is still initializing', function() {
    var slowApp;
    setup(function() {
      // launch a 3rd app which we can mock easily
      slowApp = new FakeApp(client, 'app://' + slowAppOrigin);
      slowApp.launch();

      var iframeId = slowApp.iframe.getAttribute('id');
      // mock iframe.getScreenshot so the screenshot never appears
      client.executeScript(function(iframeId) {
        var win = window.wrappedJSObject;
        win.document.getElementById(iframeId).getScreenshot = function() {
          var reqReject;
          var req = {
            then: function(cb, eb) {
              return new window.Promise(function(resolve, reject) {
                reqReject = reject;
              });
            }
          };
          setTimeout(function() {
            req.error = new Error('mocked');
            reqReject(req.error);
          });
          return req;
        };
        // reset screenshotBlob state
        var app = win.Service.query('AppWindowManager.getActiveWindow');
        app._screenshotBlob = null;
      }, [iframeId]);

      taskManager.show();
    });

    test('should display identification overlay when theres no blob screenshot',
    function() {
      var card = taskManager.cards[taskManager.cards.length -1];
      var screenshot = client.helper
                       .waitForChild(card, taskManager.selectors.screenshot);
      var backgroundImage = screenshot.cssProperty('background-image');
      assert(backgroundImage.indexOf('blob') == -1);

      var instanceId = card.getAttribute('data-app-instance-id');
      var idOverlay =  client.findElement(
        '#'+ instanceId +
        '.appWindow.in-task-manager.overlay.no-screenshot ' +
        '> .identification-overlay');
      assert(idOverlay);
    });
  });

  suite('closing apps', function() {
    setup(function() {
      taskManager.show();
    });

    test('with the close button', function() {
      // Closing the first app
      var card = taskManager.cards[taskManager.cards.length -1];
      var closeButton = client.helper
                       .waitForChild(card, taskManager.selectors.close);
      closeButton.tap();

      client.waitFor(function() {
        return taskManager.cards.length == 1;
      });

      // Closing the second app
      card = taskManager.cards[taskManager.cards.length -1];
      closeButton = client.helper
                       .waitForChild(card, taskManager.selectors.close);
      closeButton.tap();

      taskManager.waitUntilHidden();
    });

    test('by swipping', function() {
      // Closing the first app
      var card = taskManager.cards[taskManager.cards.length -1];
      actions.flick(card, halfWidth, halfHeight, halfWidth, 0).perform();

      client.waitFor(function() {
        return taskManager.cards.length == 1;
      });

      // Closing the second app
      card = taskManager.cards[taskManager.cards.length -1];
      actions.flick(card, halfWidth, halfHeight, halfWidth, 0).perform();

      taskManager.waitUntilHidden();
    });
  });

  suite('new sheet buttons', function() {
    setup(function() {
      taskManager.show();
    });

    test('should open a new sheet', function() {
      taskManager.newSheetButton.tap();
      system.waitForBrowser(
        'app://search.gaiamobile.org/newtab.html?private=0');
    });

    test('should open a new private sheet', function() {
      taskManager.newPrivateSheetButton.tap();
      system.waitForBrowser(
        'app://search.gaiamobile.org/newtab.html?private=1');
    });
  });

  test('swiping+tapping should switch app, then make new app rightmost',
  function() {

    // Open task manager, focused on secondApp (since that app was most recently
    // launched). Swipe to make firstApp visible.
    taskManager.show();

    var element = taskManager.element;
    actions.flick(element, 30, halfHeight,
                  fullWidth, halfHeight).perform();
    element.tap();

    client.waitFor(function() {
      return firstApp.iframe.getAttribute('aria-hidden') !== 'true' &&
             secondApp.iframe.getAttribute('aria-hidden') === 'true';
    });

    taskManager.waitUntilHidden();
    // Now, go back into task manager, and the firstApp should be rightmost.
    // Flick left to go back to secondApp, leaving us where we began.
    taskManager.show();

    actions.flick(element, 30, halfHeight,
                  fullWidth, halfHeight).perform();
    element.tap();

    client.waitFor(function() {
      return firstApp.iframe.getAttribute('aria-hidden') === 'true' &&
             secondApp.iframe.getAttribute('aria-hidden') !== 'true';
    });
  });

  test('swiping should not cause reflows', function() {
    // Since the clock will cause reflows we're disabling it
    // Also disabling the developer hud because of
    // https://bugzilla.mozilla.org/show_bug.cgi?id=971008
    system.stopDevtools();
    system.stopClock();
    var reflowHelper = new ReflowHelper(client);

    taskManager.show();

    reflowHelper.startTracking(system.URL);

    // Going back and forth
    var element = taskManager.element;
    actions.flick(element, 30, halfHeight,
                  halfWidth, halfHeight).perform();
    actions.flick(element, fullWidth, halfHeight,
                  halfWidth, halfHeight).perform();

    var count = reflowHelper.getCount();
    assert.equal(count, 0, 'we got ' + count + ' reflows instead of 0');
    reflowHelper.stopTracking();
  });
});
