/* -*Mode: js; js-indent-level: 2; indent-tabs-mode: nil -**/
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

/* global BrowserFrame,
   EntrySheet,
   Notification,
   NotificationHelper,
   MozActivity,
   Service,
   LazyLoader
*/

'use strict';

var CaptivePortal = {
  eventId: null,
  settings: null,
  notification: null,
  notificationPrefix: 'captivePortal:',
  captiveNotification_onClick: null,

  handleLogin: function cp_handleLogin(id, url) {
    var wifiManager = window.navigator.mozWifiManager;
    var settings = window.SettingsObserver;
    var icon = window.location.origin +
      '/style/icons/captivePortal.png';

    //captive portal login needed
    this.eventId = id;
    var currentNetwork = wifiManager.connection.network;
    var networkName = (currentNetwork && currentNetwork.ssid) ?
        currentNetwork.ssid : '';
    var message = { id: 'captive-wifi-available', 
                    args: { networkName: networkName }
                  };

    if (Service.query('isFtuRunning')) {
      settings.setValue({'wifi.connect_via_settings': false});

      LazyLoader.load(['js/entry_sheet.js']).then(function() {
        this.entrySheet = new EntrySheet(
          document.getElementById('screen'),
          // Prefix url with LRM character
          // This ensures truncation occurs correctly in an RTL document
          // We can remove this when bug 1154438 is fixed.
          '\u200E' + url,
          new BrowserFrame({url: url})
        );
        this.entrySheet.open();
      }.bind(this)).catch((err) => {
        console.error(err);
      });
      return;
    }

    this.captiveNotification_onClick = () => {
      this.notification.removeEventListener('click',
        this.captiveNotification_onClick);
      this.captiveNotification_onClick = null;
      var activity = new MozActivity({
        name: 'view',
        data: { type: 'url', url: url }
      });
      activity.onerror = function() {
        console.error('CaptivePortal Activity error: ' + this.error);
      };
    };

    var options = {
      bodyL10n: message,
      icon: icon,
      tag: this.notificationPrefix + networkName,
      mozbehavior: {
        showOnlyOnce: true
      }
    };

    NotificationHelper.send('', options).then(notification => {
      this.notification = notification;
      notification.addEventListener('click',
        this.captiveNotification_onClick);
      notification.addEventListener('close', () => {
        this.notification = null;
      });
    });
  },

  dismissNotification: function dismissNotification(id) {
    if (id === this.eventId) {
      if (this.notification) {
        if (this.captiveNotification_onClick) {
          this.notification.removeEventListener('click',
                                              this.captiveNotification_onClick);
          this.captiveNotification_onClick = null;
        }

        this.notification.close();
      }

      if (this.entrySheet) {
        this.entrySheet.close();
        this.entrySheet = null;
      }
    }
  },

  handleLoginAbort: function handleLoginAbort(id) {
    this.dismissNotification(id);
  },

  handleLoginSuccess: function handleLoginSuccess(id) {
    this.dismissNotification(id);
  },

  handleEvent: function cp_handleEvent(evt) {
    switch (evt.detail.type) {
      case 'captive-portal-login':
        this.handleLogin(evt.detail.id, evt.detail.url);
        break;
      case 'captive-portal-login-abort':
        this.handleLoginAbort(evt.detail.id);
        break;
      case 'captive-portal-login-success':
        this.handleLoginSuccess(evt.detail.id);
        break;
    }
  },

  init: function cp_init() {
    var promise = Notification.get();
    var prefix = this.notificationPrefix;
    promise.then(function(notifications) {
      notifications.forEach(function(notification) {
        if (!notification) {
          return;
        }

        // We just care about notification with tag 'captivePortal:'
        if (!notification.tag || !notification.tag.startsWith(prefix)) {
          return;
        }

        notification.close();
      });
    }).then((function() {
      window.addEventListener('mozChromeEvent', this);
    }).bind(this));
    return promise;
  }
};

// unit tests call init() manually
if (document.l10n) {
  document.l10n.ready.then(CaptivePortal.init.bind(CaptivePortal));
}
