/* globals dump */

(function() {
  'use strict';

  function dump_off(msg, optionalObject) {}
  function dump_on(msg, optionalObject) {
    var output = msg;
    if (optionalObject) {
      try {
        output += JSON.stringify(optionalObject);
      } catch(e) {}
    }
    if (dump) {
      var appName = document.location.hostname.replace(/\..*$/, '');
      dump('[' + appName + '] ' + output + '\n');
    } else {
      console.log(output);
    }
  }

  window.DUMP = dump_off;   // no traces by default

  // enable/disable DUMP according to the related setting
  var settings = window.SettingsObserver;
  var reqGaiaDebug = settings.getValue('debug.gaia.enabled');
  reqGaiaDebug.onsuccess = function gaiaDebug() {
    window.DUMP =
      reqGaiaDebug.result['debug.gaia.enabled'] ? dump_on : dump_off;
  };
  // settings.addObserver('debug.gaia.enabled', function(event) {
  //   window.DUMP = event.settingValue ? dump_on : dump_off;
  //   dump_on(event.settingValue ? 'Enabling DUMP' : 'Disabling DUMP');
  // });
}());
