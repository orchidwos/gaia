/* global Notification */
/* jshint nonew: false */
'use strict';

(function(exports) {

  const DEFAULT_ICON_URL = 'style/icons/ic_default-notification.png';
  const DEBUG = 0;

  var Receiver = function Receiver() {};

  Receiver.prototype = {

    _onMessage: undefined,
    _onStateChange: undefined,
    _connection: undefined,
    _sequence: undefined,

    init: function r_init() {
      this._onMessage = this._handleMessage.bind(this);
      this._onStateChange = this._handleStateChange.bind(this);

      navigator.presentation &&
                          navigator.presentation.receiver.connectionList.then(
      function addConnection(list) {
        this._connection = list.connections[0];
        this._connection.addEventListener('message', this._onMessage);
        this._connection.addEventListener('connect', this._onStateChange);
        this._connection.addEventListener('close', this._onStateChange);
        this._connection.addEventListener('terminate', this._onStateChange);
        this._sequence = 0;
      }.bind(this),
      function connectionError() {
        console.warn('Getting connection failed.');
      });
    },

    uninit: function r_uninit() {
      if (this._connection) {
        this._connection.removeEventListener('message', this._onMessage);
        this._connection.removeEventListener(
                                            'statechange', this._onStateChange);
        this._connection = null;
        this._sequence = 0;
      }
    },

    _sendMessage: function r_sendMessage(type, data) {
      if (!this._connection) {
        return;
      }

      var msg = {
        'type': type,
        'seq': ++this._sequence
      };

      for (var i in data) {
        msg[i] = data [i];
      }

      this._connection.send(JSON.stringify(msg));
    },

    _renderMessage: function r_renderMessage(message) {
      var result;
      switch(message.type) {
        case 'view':
          this.sendViewUrl(message.url);
          break;
        case 'Message':
        case 'Laundry':
        case 'Home':
        case 'Mail':
          result = {
            body: message.body,
            title: message.title
          };
          break;
      }
      return result;
    },

    sendViewUrl: function r_sendViewUrl(targetUrl) {
      navigator.mozApps.getSelf().onsuccess = function(evt) {
        var selfApp = evt.target.result;
        var iacmsg = {
          type: 'view',
          data: {
            type: 'url',
            url: targetUrl,
          }
        };
        selfApp.connect('webpage-open').then(function (ports) {
          ports.forEach(function(port) {
            port.postMessage(iacmsg);
          });
          this._sendMessage('ack');
        }.bind(this),
        function () {
          console.warn('Sending view request failed.');
          this._sendMessage('ack', {'error': 'webpage-open failed'});
        });
      }.bind(this);
    },

    _handleMessage: function r_handleMessage(evt) {
      DEBUG && console.log('Got message:' + evt.data);
      var rawdata = '[' + evt.data.replace('}{', '},{') + ']';
      var messages = JSON.parse(rawdata);
      messages.forEach(message => {
        var renderedMessage = this._renderMessage(message);

        if (renderedMessage) {
          new Notification(renderedMessage.title, {
            body: renderedMessage.body,
            icon: DEFAULT_ICON_URL
          });
        }
      });
    },

    _handleStateChange: function r_handleStateChange() {
      DEBUG && console.log('connection state:' + this._connection.state);
      if(this._connection.state !== 'connected') {
        this.uninit();
        window.close();
      }
    }
  };

  exports.Receiver = Receiver;

}(window));
