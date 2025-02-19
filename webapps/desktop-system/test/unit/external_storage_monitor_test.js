'use strict';
/* global ExternalStorageMonitor, MocksHelper, MockNotification, MockL10n,
          MockNotificationHelper, MockGetDeviceStorages, MockMozActivity,
          MockNavigatorSettings, MockMozIntl */

requireApp('system/js/external_storage_monitor.js');

require('/shared/test/unit/mocks/mock_l20n.js');
require('/shared/test/unit/mocks/mock_moz_intl.js');
require('/shared/test/unit/mocks/mock_notification.js');
require('/shared/test/unit/mocks/mock_notification_helper.js');
require('/shared/test/unit/mocks/mock_moz_activity.js');
require('/shared/test/unit/mocks/mock_event_target.js');
require('/shared/test/unit/mocks/mock_dom_request.js');
require('/shared/test/unit/mocks/mock_navigator_getdevicestorage.js');
require('/shared/test/unit/mocks/mock_navigator_getdevicestorages.js');
require('/shared/test/unit/mocks/mock_navigator_moz_settings.js');

var mocksForExternalStorageMonitor = new MocksHelper([
  'MozActivity'
]).init();

/**
 * Test ExternalStorageMonitor functionality.
 */
suite('system/ExternalStorageMonitor', function() {

  var realL10n;
  var realMozIntl;
  var realNotification;
  var realNotificationHelper;
  var realNavigatorGetDeviceStorages;
  var realMozActivity;
  var realMozSettings;

  var externalStorageMonitor;

  mocksForExternalStorageMonitor.attachTestHelpers();

  suiteSetup(function() {
    realL10n = document.l10n;
    document.l10n = MockL10n;

    realMozIntl = window.mozIntl;
    window.mozIntl = MockMozIntl;

    realNotification = window.Notification;
    window.Notification = MockNotification;
    
    realNotificationHelper = window.NotificationHelper;
    window.NotificationHelper = MockNotificationHelper;

    realNavigatorGetDeviceStorages = navigator.b2g.getDeviceStorages;
    navigator.b2g.getDeviceStorages = MockGetDeviceStorages;

    realMozActivity = window.MozActivity;
    window.MozActivity = MockMozActivity;

    realMozSettings = SettingsObserver;
    SettingsObserver = MockNavigatorSettings;

    externalStorageMonitor = new ExternalStorageMonitor();
  });

  suiteTeardown(function() {
    document.l10n = realL10n;
    window.mozIntl = realMozIntl;
    window.Notification = realNotification;
    window.NotificationHelper = realNotificationHelper;
    navigator.b2g.getDeviceStorages = realNavigatorGetDeviceStorages;
    window.MozActivity = realMozActivity;
    SettingsObserver = realMozSettings;
    MockNavigatorSettings.mTeardown();
  });

  suite('new > ', function() {
    var spyGetDeviceStorages, tempExternalStorageMonitor;
    setup(function() {
      spyGetDeviceStorages = this.sinon.spy(navigator, 'getDeviceStorages');
      tempExternalStorageMonitor = new ExternalStorageMonitor();
    });

    teardown(function() {
      tempExternalStorageMonitor = null;
    });

    test('call getDeviceStorages, store _storage..', function() {
      assert.isTrue(spyGetDeviceStorages.calledWith('sdcard'),
        'getDeviceStorages should be called with sdcard');
      assert.isDefined(externalStorageMonitor._storage,
        'this._storage should be defined');
    });
  });

  suite('start > ', function() {
    suite('has external storage > ', function() {
      setup(function() {
        this.sinon.stub(externalStorageMonitor, 'enableStorageUnrecognised');
        this.sinon.spy(externalStorageMonitor._storage, 'storageStatus');
        this.sinon.stub(externalStorageMonitor._storage, 'addEventListener');
        externalStorageMonitor.start();
      });

      test('will addEventListener with "storage-state-change" ' +
        'get storage status success..', function() {
        var req =
          externalStorageMonitor._storage.storageStatus.getCall(0).returnValue;
        req.fireSuccess('');
        assert.isTrue(
          externalStorageMonitor._storage.addEventListener.calledWith(
            'storage-state-change'),
          'event "storage-state-change" should be listened');
      });

      test('will addEventListener with "storage-state-change" ' +
        'get storage status fail..', function() {
        var req =
          externalStorageMonitor._storage.storageStatus.getCall(0).returnValue;
        req.fireError();
        assert.isTrue(
          externalStorageMonitor._storage.addEventListener.calledWith(
            'storage-state-change'),
          'event "storage-state-change" should be listened');
      });

      test('will call enableStorageUnrecognised', function() {
        var req =
          externalStorageMonitor._storage.storageStatus.getCall(0).returnValue;
        req.fireSuccess('Idle');
        assert.isTrue(
          externalStorageMonitor.enableStorageUnrecognised.calledWith(false),
          'with false');
      });

      test('will call enableStorageUnrecognised', function() {
        var req =
          externalStorageMonitor._storage.storageStatus.getCall(0).returnValue;
        req.fireSuccess('Mount-Fail');
        assert.isTrue(
          externalStorageMonitor.enableStorageUnrecognised.calledWith(true),
          'with true');
      });
    });
  });

  suite('pushStatus > ', function() {
    setup(function() {
      externalStorageMonitor.pushStatus('Mounted');
    });

    teardown(function() {
      externalStorageMonitor.statusStack = [];
    });

    test('status stack is pushed..', function() {
      assert.equal(externalStorageMonitor.statusStack.length, 1,
        'should be one status in stack');
      assert.equal(externalStorageMonitor.statusStack[0], 4,
        'first element should be "Mounted" status "4" in stack');
    });
  });

  suite('clearStatus > ', function() {
    setup(function() {
      externalStorageMonitor.statusStack = [4, 5];
      externalStorageMonitor.clearStatus();
    });

    teardown(function() {
      externalStorageMonitor.statusStack = [];
    });

    test('status stack is cleared, keep the latest storage status in stack ..',
      function() {
      assert.equal(externalStorageMonitor.statusStack.length, 1,
        'should keep one status only');
      assert.equal(externalStorageMonitor.statusStack[0], 5,
        'should keep latest status');
    });
  });

  suite('enableEnterIdleStateTimer > ', function() {
    var fakeTimer;
    setup(function() {
      fakeTimer = this.sinon.useFakeTimers();
      externalStorageMonitor.justEnterIdleLessThanOneSecond = false;
      externalStorageMonitor.enableEnterIdleStateTimer();
    });

    teardown(function() {
      fakeTimer.restore();
      externalStorageMonitor.justEnterIdleLessThanOneSecond = false;
      externalStorageMonitor.resetJustEnterIdleFlagTimer = null;
    });

    test('enable flag "justEnterIdleLessThanOneSecond", ' +
      'then reset it after 1 second..', function() {
      assert.isTrue(externalStorageMonitor.justEnterIdleLessThanOneSecond,
        'flag "justEnterIdleLessThanOneSecond" should be true');
      fakeTimer.tick(1000);
      assert.isFalse(externalStorageMonitor.justEnterIdleLessThanOneSecond,
        'flag "justEnterIdleLessThanOneSecond" should be reset to false');
    });
  });

  suite('recogniseStorageActions > ', function() {
    suite('action: Recognised > ', function() {
      setup(function() {
        externalStorageMonitor.statusStack = [0, 2, 1, 3, 4];
        this.sinon.stub(externalStorageMonitor, 'clearStatus');
        this.sinon.stub(externalStorageMonitor, 'enableStorageUnrecognised');
        this.sinon.stub(externalStorageMonitor, 'createMessage');
        externalStorageMonitor.recogniseStorageActions();
      });

      teardown(function() {
        externalStorageMonitor.statusStack = [];
      });

      test('match "Recognised"..', function() {
        assert.isTrue(externalStorageMonitor.clearStatus.called,
          'clearStatus() should be called');
        assert.isTrue(
          externalStorageMonitor.enableStorageUnrecognised.calledWith(false),
          'enableStorageUnrecognised() should be called with "false"');
        assert.isTrue(externalStorageMonitor.createMessage.calledWith(
          'detected-recognised'),
          'createMessage() should be called with "detected-recognised"');
      });
    });

    suite('action: Unrecognised > ', function() {
      setup(function() {
        externalStorageMonitor.statusStack = [0, 1, 3, 9];
        this.sinon.stub(externalStorageMonitor, 'clearStatus');
        this.sinon.stub(externalStorageMonitor, 'enableStorageUnrecognised');
        this.sinon.stub(externalStorageMonitor, 'createMessage');
        externalStorageMonitor.recogniseStorageActions();
      });

      teardown(function() {
        externalStorageMonitor.statusStack = [];
      });

      test('match "Unrecognised"..', function() {
        assert.isTrue(externalStorageMonitor.clearStatus.called,
          'clearStatus() should be called');
        assert.isTrue(
          externalStorageMonitor.enableStorageUnrecognised.calledWith(true),
          'enableStorageUnrecognised() should be called with "true"');
        assert.isTrue(externalStorageMonitor.createMessage.calledWith(
          'detected-unrecognised'),
          'createMessage() should be called with "detected-unrecognised"');
      });
    });

    suite('action: Removed > ', function() {
      suite('in case of "normally-removed" > ', function() {
        setup(function() {
          externalStorageMonitor.statusStack = [4, 5, 1, 0];
          externalStorageMonitor.justEnterIdleLessThanOneSecond = false;
          this.sinon.stub(externalStorageMonitor, 'clearStatus');
          this.sinon.stub(externalStorageMonitor, 'enableStorageUnrecognised');
          this.sinon.stub(externalStorageMonitor, 'createMessage');
          externalStorageMonitor.recogniseStorageActions();
        });

        teardown(function() {
          externalStorageMonitor.statusStack = [];
        });

        test('match "Removed"..', function() {
          assert.isTrue(externalStorageMonitor.clearStatus.called,
            'clearStatus() should be called');
          assert.isTrue(
            externalStorageMonitor.enableStorageUnrecognised.calledWith(false),
            'enableStorageUnrecognised() should be called with "false"');
          assert.isTrue(externalStorageMonitor.createMessage.calledWith(
            'normally-removed'),
            'createMessage() should be called with "normally-removed"');
        });
      });

      suite('in case of "unexpectedly-removed" > ', function() {
        setup(function() {
          externalStorageMonitor.statusStack = [4, 5, 1, 0];
          externalStorageMonitor.justEnterIdleLessThanOneSecond = true;
          this.sinon.stub(externalStorageMonitor, 'clearStatus');
          this.sinon.stub(externalStorageMonitor, 'enableStorageUnrecognised');
          this.sinon.stub(externalStorageMonitor, 'createMessage');
          externalStorageMonitor.recogniseStorageActions();
        });

        teardown(function() {
          externalStorageMonitor.statusStack = [];
        });

        test('match "Removed"..', function() {
          assert.isTrue(externalStorageMonitor.clearStatus.called,
            'clearStatus() should be called');
          assert.isTrue(
            externalStorageMonitor.enableStorageUnrecognised.calledWith(false),
            'enableStorageUnrecognised() should be called with "false"');
          assert.isTrue(externalStorageMonitor.createMessage.calledWith(
            'unexpectedly-removed'),
            'createMessage() should be called with "unexpectedly-removed"');
        });
      });
    });

    suite('action: UnrecognisedStorageRemoved > ', function() {
      setup(function() {
        externalStorageMonitor.statusStack = [9, 0];
        this.sinon.stub(externalStorageMonitor, 'clearStatus');
        this.sinon.stub(externalStorageMonitor, 'enableStorageUnrecognised');
        externalStorageMonitor.recogniseStorageActions();
      });

      teardown(function() {
        externalStorageMonitor.statusStack = [];
      });

      test('match "UnrecognisedStorageRemoved"..', function() {
        assert.isTrue(externalStorageMonitor.clearStatus.called,
          'clearStatus() should be called');
        assert.isTrue(
          externalStorageMonitor.enableStorageUnrecognised.calledWith(false),
          'enableStorageUnrecognised() should be called with "false"');
      });
    });

    suite('createMessage > ', function() {
      suite('case: "detected-recognised" > ', function() {
        setup(function(done) {
          this.sinon.stub(externalStorageMonitor._storage, 'usedSpace', () => {
            return Promise.resolve(20);
          });
          this.sinon.stub(externalStorageMonitor._storage, 'freeSpace', () => {
            return Promise.resolve(10);
          });
          this.sinon.spy(externalStorageMonitor, 'getTotalSpace');
          this.sinon.spy(externalStorageMonitor, 'fireNotification');
          externalStorageMonitor.createMessage('detected-recognised').then(done,
              done);
        });

        test('fireNotification() should be called ' +
          'after got total space..', function() {
          assert.isTrue(externalStorageMonitor.getTotalSpace.called);
          var titleL10n = 'sdcard-detected-title';
          var bodyL10n = {
            id: 'sdcard-total-size-body2',
            args: {
              size: MockMozIntl._gaia._stringifyUnit('digital', 'short', 30)
            }
          };
          assert.isTrue(externalStorageMonitor.fireNotification.calledWith(
            titleL10n, bodyL10n, true));
        });
      });

      suite('case: "detected-unrecognised" > ', function() {
        setup(function() {
          this.sinon.stub(externalStorageMonitor, 'fireNotification');
          externalStorageMonitor.createMessage('detected-unrecognised');
        });

        test('fireNotification() should be called with three args', function() {
          var title = 'sdcard-detected-title';
          var body = 'sdcard-unknown-size-then-tap-to-format-body';
          assert.isTrue(externalStorageMonitor.fireNotification.calledWith(
            title, body, true));
        });
      });

      suite('case: "normally-removed" > ', function() {
        setup(function() {
          this.sinon.stub(externalStorageMonitor, 'fireNotification');
          externalStorageMonitor.createMessage('normally-removed');
        });

        test('fireNotification() should be called with two args', function() {
          var title = 'sdcard-removed-title';
          var body = 'sdcard-removed-ejected-successfully';
          assert.isTrue(externalStorageMonitor.fireNotification.calledWith(
            title, body));
        });
      });

      suite('case: "unexpectedly-removed" > ', function() {
        setup(function() {
          this.sinon.stub(externalStorageMonitor, 'fireNotification');
          externalStorageMonitor.createMessage('unexpectedly-removed');
        });

        test('fireNotification() should be called with two args', function() {
          var title = 'sdcard-removed-title';
          var body = 'sdcard-removed-not-ejected-properly';
          assert.isTrue(externalStorageMonitor.fireNotification.calledWith(
            title, body));
        });
      });
    });

    suite('enableStorageUnrecognised > ', function() {
      setup(function() {
        externalStorageMonitor.enableStorageUnrecognised(true);
      });

      teardown(function() {
        delete MockNavigatorSettings.mSettings['volume.external.unrecognised'];
      });

      test('settings key "volume.external.unrecognised" should be set ' +
        'after enableStorageUnrecognised() called.. ', function() {
        assert.isTrue(
          MockNavigatorSettings.mSettings['volume.external.unrecognised'],
          'settings key "volume.external.unrecognised" should be true');
      });
    });

    suite('fireNotification > ', function() {
      var notificationSpy, title, body, openSettings;
      setup(function() {
        notificationSpy = this.sinon.spy(window.NotificationHelper, 'send');
        title = 'SD card removed';
        body = 'SD card removed eject successfully';
        openSettings = true;
        externalStorageMonitor.fireNotification(title, body, openSettings);
      });

      test('new and fired one notification, set notification ' +
        'onclick handler ', function() {
        assert.isTrue(notificationSpy.calledOnce,
          'Notification should be called');
        assert.equal(notificationSpy.firstCall.args[0], title,
          'Notification should be called with correct title');
        assert.equal(notificationSpy.firstCall.args[1].body, body,
          'Notification should be called with correct body');
      });
    });

    suite('notificationHandler > ', function() {
      suite('no need to openSettings > ', function() {
        var mockNotification, stubMockNotification, mozActivitySpy;
        setup(function() {
          mockNotification = {
            close: function() {}
          };
          stubMockNotification = this.sinon.stub(mockNotification, 'close');
          mozActivitySpy = this.sinon.stub(window, 'MozActivity');
          externalStorageMonitor.notificationHandler(mockNotification, false);
        });

        teardown(function() {
          stubMockNotification.restore();
          mozActivitySpy.restore();
        });

        test('close notification and do early return..', function() {
          assert.isTrue(stubMockNotification.called,
            'notification.close() should be called');
          assert.isFalse(mozActivitySpy.called,
            'MozActivity should not be called');
        });
      });

      suite('will request MozActivity with "configure" > ', function() {
        var mockNotification, stubMockNotification;
        setup(function() {
          MockMozActivity.mSetup();
          mockNotification = {
            close: function() {}
          };
          stubMockNotification = this.sinon.stub(mockNotification, 'close');
          externalStorageMonitor.notificationHandler(mockNotification, true);
        });

        teardown(function() {
          MockMozActivity.mTeardown();
        });

        test('close notification and new MozActivity with ' +
          '"configure"', function() {
          assert.isTrue(stubMockNotification.called,
            'notification.close() should be called');
          var activity = MockMozActivity.calls[0];
          assert.deepEqual(activity, {
            name: 'configure',
            data: {
              target: 'device',
              section: 'mediaStorage'
            }
          });

        });
      });

      suite('handleEvent > ', function() {
        suite('"storage-state-change" event coming, status is not "Idle"',
          function() {
          setup(function() {
            this.sinon.stub(externalStorageMonitor, 'pushStatus');
            this.sinon.stub(externalStorageMonitor,
                            'enableEnterIdleStateTimer');
            this.sinon.stub(externalStorageMonitor, 'recogniseStorageActions');

            var event = {
              type: 'storage-state-change',
              reason: 'Mounted'
            };

            externalStorageMonitor.handleEvent(event);
          });

          test('pushStatus(), recogniseStorageActions() should be called..',
            function() {
            assert.isTrue(externalStorageMonitor.pushStatus.called,
              'pushStatus should be called');
            assert.isFalse(
              externalStorageMonitor.enableEnterIdleStateTimer.called,
              'enableEnterIdleStateTimer should not be called');
            assert.isTrue(externalStorageMonitor.recogniseStorageActions.called,
              'recogniseStorageActions should be called');
          });
        });

        suite('"storage-state-change" event coming, status is "Idle"',
          function() {
          setup(function() {
            this.sinon.stub(externalStorageMonitor, 'pushStatus');
            this.sinon.stub(externalStorageMonitor,
                            'enableEnterIdleStateTimer');
            this.sinon.stub(externalStorageMonitor, 'recogniseStorageActions');

            var event = {
              type: 'storage-state-change',
              reason: 'Idle'
            };

            externalStorageMonitor.handleEvent(event);
          });

          test('pushStatus(), enableEnterIdleStateTimer(), ' +
            'recogniseStorageActions() should be called..', function() {
            assert.isTrue(externalStorageMonitor.pushStatus.called,
              'pushStatus should be called');
            assert.isTrue(
              externalStorageMonitor.enableEnterIdleStateTimer.called,
              'enableEnterIdleStateTimer should be called');
            assert.isTrue(externalStorageMonitor.recogniseStorageActions.called,
              'recogniseStorageActions should be called');
          });
        });
      });

      suite('getTotalSpace > ', function() {
        var returnValue;
        setup(function(done) {
          var storages = MockGetDeviceStorages('sdcard');
          externalStorageMonitor._storage = storages[0];
          this.sinon.spy(externalStorageMonitor, 'formatSize');
          this.sinon.stub(externalStorageMonitor._storage, 'usedSpace', () => {
            return Promise.resolve(100);
          });
          this.sinon.stub(externalStorageMonitor._storage, 'freeSpace', () => {
            return Promise.resolve(300);
          });
          externalStorageMonitor.getTotalSpace().then(v => {
            returnValue = v;
            done();
          }, done);
        });

        test('formatSize function should be called with total space',
          function() {
            assert.isTrue(externalStorageMonitor.formatSize.calledWith(400));
            assert.equal(returnValue,
                MockMozIntl._gaia._stringifyUnit('digital', 'short', 400));
          }
        );
      });
    });
  });
});
