/* global require, marionette, setup, suite, test, __dirname */
'use strict';

var assert = require('chai').assert;

var Messages = require('./lib/messages.js');
var MessagesActivityCaller = require('./lib/messages_activity_caller.js');

marionette('Attachment picking and sending tests', function() {
  var apps = {};

  apps[MessagesActivityCaller.ORIGIN] = __dirname + '/webapps/activitycaller';

  var client = marionette.client({
    profile: {
      prefs: {
        'focusmanager.testmode': true
      },

      apps: apps
    },
    desiredCapabilities: { raisesAccessibilityExceptions: false }
  });

  var messagesApp, activityCallerApp;

  setup(function() {
    messagesApp = Messages.create(client);
    activityCallerApp = MessagesActivityCaller.create(client);

    client.loader.getMockManager('sms').inject([
       'navigator_moz_icc_manager',
       'navigator_moz_mobile_message'
     ]);
  });

  suite('Test Suite', function() {

    setup(function() {
      messagesApp.launch();
      messagesApp.Inbox.navigateToComposer();
    });

    test('A contact can be enclosed as attachment', function() {
      messagesApp.addRecipient('+346666666');

      var composer = messagesApp.Composer;

      client.waitFor(function() {
        return composer.attachButton.enabled();
      });
      composer.attachButton.tap();
      messagesApp.Menu.selectSystemMenuOption('Messages Activity Caller');

      activityCallerApp.switchTo();
      activityCallerApp.pickContact();

      messagesApp.switchTo();
      messagesApp.send();

      client.helper.waitForElement(messagesApp.Selectors.Message.
                                                              vcardAttachment);
      var fileName = client.helper.waitForElement(messagesApp.Selectors.
                                                            Message.fileName);
      assert.equal(fileName.text(), 'test_file.vcf');
    });
  });
});
