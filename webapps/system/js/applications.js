/* -*- Mode: js; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- /
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

'use strict';
/* global Applications, applications*/
/** Application module handles the information of apps on behalf of other
 *  modules
 *  @class Applications
 */
(function(exports) {
  function Applications() {
  }

  Applications.prototype = {
    /**
     * The installed APPs list
     * @access public
     * @type {Object}
     * @memberof Applications.prototype
     */
    installedApps: {},

    /**
     * The statuts about get all installed Apps by mozApps API.
     * @access public
     * @type {boolean}
     * @memberof Applications.prototype
     */
    ready: false,

    /**
     * Stop the Applications services,
     * un-register apps.oninstall and apps.uninstall handler.
     * @memberof Applications.prototype
     */
    stop: function a_stop() {
      this.ready = false;
      AppsManager.oninstall = null;
      AppsManager.onuninstall = null;
    },

    waitForReady: function() {
      return new Promise((resolve) => {
        if (this.ready) {
          resolve();
        } else {
          this.waitingResolve = resolve;
        }
      });
    },

    /**
     * Start the Applications to get all installed Apps and
     * register apps.oninstall and apps.uninstall handler.
     * @memberof Applications.prototype
     */
    start: function a_start() {
      var self = this;
      var apps = AppsManager;

      var getAllApps = function getAllApps() {
        AppsManager.getAll().then(function(result) {
          var apps = result;
          apps.forEach(function(app) {
            self.installedApps[app.manifestURL] = app;
            // TODO Followup for retrieving homescreen & comms app
          });

          self.ready = true;
          self.fireApplicationReadyEvent();
          self.waitingResolve && self.waitingResolve();
        });
      };

      // We need to wait for the chrome shell to let us know when it's ok to
      // launch activities. This prevents race conditions.
      // The event does not fire again when we reload System app in on
      // B2G Desktop, so we save the information into sessionStorage.
      if (window.sessionStorage.getItem('webapps-registry-ready')) {
        getAllApps();
      } else {
        window.addEventListener('mozChromeEvent', function mozAppReady(event) {
          if (event.detail.type != 'webapps-registry-ready') {
            return;
          }

          window.sessionStorage.setItem('webapps-registry-ready', 'yes');
          window.removeEventListener('mozChromeEvent', mozAppReady);

          getAllApps();
        });
      }

      apps.oninstall = function a_install(evt) {
        var newapp = evt.application;
        self.installedApps[newapp.manifestURL] = newapp;

        self.fireApplicationInstallEvent(newapp);
      };

      apps.onuninstall = function a_uninstall(evt) {
        var deletedapp = evt.application;
        delete self.installedApps[deletedapp.manifestURL];

        self.fireApplicationUninstallEvent(deletedapp);
      };

      apps.onenabledstatechange = function a_enabledstatechange(evt) {
        var app = evt.application;
        if (app.enabled) {
          self.fireApplicationEnabledEvent(app);
        } else {
          self.fireApplicationDisabledEvent(app);
        }
      };
    },

    /**
     * Get App by ManifestURL.
     * @memberof Applications.prototype
     */
    getByManifestURL: function a_getByManifestURL(manifestURL) {
      if (manifestURL in this.installedApps) {
        return this.installedApps[manifestURL];
      }

      return null;
    },

    /**
     * Broadcast ApplicationReadyEvent when mozapps.getAll() done.
     * @memberof Applications.prototype
     */

    fireApplicationReadyEvent: function a_fireAppReadyEvent() {
      var evt = new CustomEvent('applicationready',
                           { bubbles: true,
                             cancelable: false,
                             detail: { applications: this.installedApps } });
      window.dispatchEvent(evt);
    },

    /**
     * Broadcast ApplicationInstallEvent when apps.oninstall occured.
     * We need to dispatch the following events because
     * mozApps is not doing so right now.
     * ref: @link https://bugzilla.mozilla.org/show_bug.cgi?id=731746
     * @memberof Applications.prototype
     */

    fireApplicationInstallEvent: function a_fireApplicationInstallEvent(app) {
      var evt = new CustomEvent('applicationinstall',
                               { bubbles: true,
                                 cancelable: false,
                                 detail: { application: app } });
      window.dispatchEvent(evt);
    },

    /**
     * Broadcast ApplicationUninstallEvent when apps.onuninstall occured.
     * @memberof Applications.prototype
     */

    fireApplicationUninstallEvent:
                                function a_fireApplicationUninstallEvent(app) {
      var evt = new CustomEvent('applicationuninstall',
                               { bubbles: true,
                                 cancelable: false,
                                 detail: { application: app } });
      window.dispatchEvent(evt);
    },

    /**
     * Broadcast ApplicationEnabledEvent when apps.onenabledstatechange
     * occured when the application was enabled.
     * @memberof Applications.prototype
     */

    fireApplicationEnabledEvent:
                                function a_fireApplicationEnabledEvent(app) {
      var evt = new CustomEvent('applicationenabled',
                               { bubbles: true,
                                 cancelable: false,
                                 detail: { application: app } });
      window.dispatchEvent(evt);
    },

    /**
     * Broadcast ApplicationDisabledEvent when apps.onenabledstatechange
     * occured when the application was enabled.
     * @memberof Applications.prototype
     */

    fireApplicationDisabledEvent:
                                function a_fireApplicationDisabledEvent(app) {
      var evt = new CustomEvent('applicationdisabled',
                               { bubbles: true,
                                 cancelable: false,
                                 detail: { application: app } });
      window.dispatchEvent(evt);
    }
  };

  exports.Applications = Applications;
}(window));

window.applications = new Applications();
applications.start();
