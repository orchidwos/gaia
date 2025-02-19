'use strict';
/* global CarrierInfoNotifier */
/* global MobileOperator */
/* global Service */

(function(exports) {

  /**
   * CellBroadcastSystem
   * @class CellBroadcastSystem
   * @requires CarrierInfoNotifier
   * @requires MobileOperator
   */
  function CellBroadcastSystem() {}

  CellBroadcastSystem.prototype = {
    name: 'CellBroadcastSystem',

    /**
     * Whether or not the cellbroadcast setting is enabled or disabled.
     * @memberof CellBroadcastSystem.prototype
     * @type {Array}
     */
    _settingsDisabled: [],

    /**
     * The cell broadcast settings key.
     * @memberof CellBroadcastSystem.prototype
     * @type {String}
     */
    _settingsKey: 'ril.cellbroadcast.disabled',

    /**
     * Starts listening for events and settings changes.
     * @memberof CellBroadcastSystem.prototype
     */
    start: function cbs_start() {
      var self = this;
      if (navigator && navigator.mozCellBroadcast) {
        navigator.mozCellBroadcast.onreceived = this.show.bind(this);
      }

      var settings = window.SettingsObserver;
      var req = settings.getValue(this._settingsKey);
      req.onsuccess = function() {
        self._settingsDisabled = req.result[self._settingsKey];
      };

      settings.addObserver(
        this._settingsKey, this.settingsChangedHandler.bind(this));
      Service.register('show', this);
    },

    /**
     * Called when the cellbroadcast setting is changed.
     * @memberof CellBroadcastSystem.prototype
     */
    settingsChangedHandler: function cbs_settingsChangedHandler(event) {
      this._settingsDisabled = event.settingValue;

      if (this._hasCBSDisabled()) {
        var evt = new CustomEvent('cellbroadcastmsgchanged', { detail: null });
        window.dispatchEvent(evt);
      }
    },

    /**
     * Shows the cell broadcast notification.
     * @memberof CellBroadcastSystem.prototype
     */
    show: function cbs_show(event) {
      var msg = event.message;
      var serviceId = msg.serviceId || 0;
      var conn = window.navigator.b2g.mobileConnections[serviceId];
      var id = msg.messageId;
      var cdmaCategory = msg.cdmaServiceCategory;

      // Early return CMAS messsage and let network alert app handle it. Please
      // ref http://www.etsi.org/deliver/etsi_ts/123000_123099/123041/
      // 11.06.00_60/ts_123041v110600p.pdf, chapter 9.4.1.2.2 Message identifier
      // for GSM and http://www.3gpp2.org/public_html/specs/
      // C.R1001-G_v1.0_Param_Administration.pdf for CDMA.
      // GSM Message id from range 4370 to 4399(1112 hex to 112f hex) and 
      // CDMA service category from range 4096 to 4351(1000 hex to 10ff hex)
      // should be CMAS and network alert will display detail information.

      var isGSM = cdmaCategory === null;
      var isGSMCmas = isGSM && (id >= 4370 && id < 4400);
      var isCDMACmas = !isGSM &&
        (cdmaCategory >= 0x1000 && cdmaCategory <= 0x10FF);

      if (isGSMCmas || isCDMACmas) {
        return Promise.resolve();
      }

      if (conn && conn.voice && conn.voice.network &&
          conn.voice.network.mcc === MobileOperator.BRAZIL_MCC &&
          id === MobileOperator.BRAZIL_CELLBROADCAST_CHANNEL) {
        var evt = new CustomEvent('cellbroadcastmsgchanged',
          { detail: msg.body });
        window.dispatchEvent(evt);
        return Promise.resolve();
      }

      var body = msg.body;

      // XXX: 'undefined' test until bug-1021177 lands
      if (msg.etws && (!body || (body == 'undefined'))) {
        body = document.l10n.formatValue('cb-etws-warningType-' +
          (msg.etws.warningType ? msg.etws.warningType : 'other'));
      }

      return Promise.all([
        body,
        document.l10n.formatValue('cb-channel', { channel: id })
      ]).then(([body, message]) => {
        CarrierInfoNotifier.show(body, message);
      });
    },

    /**
     * To make sure there is any CBS pref is disabled
     * @memberof CellBroadcastSystem.prototype
     */
    _hasCBSDisabled: function cbs__getDisabledCBSIndex() {
      var index =
        this._settingsDisabled.findIndex(disabled => (disabled === true));
      return (index >= 0);
    }
  };

  exports.CellBroadcastSystem = CellBroadcastSystem;

}(window));
