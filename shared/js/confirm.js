/* exported ConfirmDialog */
'use strict';

var ConfirmDialog = (function() {
  var isAnimationPlaying = false;
  var isShown = false;
  var doc = (parent.location === window.location) ?
      document : parent.document;
  var screen = doc.getElementById('confirmation-message');
  var titleNode = screen.querySelector('h1');
  var messageNode = screen.querySelector('p');
  var action1Node = screen.querySelector('button:nth-of-type(1)');
  var action1Callback;
  var action2Node = screen.querySelector('button:nth-of-type(2)');
  var action2Callback;
  var oldzIndex;
  var dialogSound = new Audio('/shared/style/exclamation.wav');

  var callBackAndPreventDefault = function callBackAndPreventDefault(ev) {
    if (ev.target === action1Node) {
      action1Callback();
      ev.preventDefault();
      return false;
    } else if (ev.target === action2Node) {
      action2Callback();
      ev.preventDefault();
      return false;
    }
  };

  var _hide = function _hide() {
    // Reset the 'confirmation-message' element and its children to their
    // initial values and hide it.
    if (!isShown) {
      return;
    }

    titleNode.removeAttribute('data-l10n-id');
    titleNode.className = '';
    messageNode.removeAttribute('data-l10n-id');
    messageNode.className = '';
    action1Node.removeAttribute('data-l10n-id');
    action1Node.onclick = null;
    action2Node.removeAttribute('data-l10n-id');
    action2Node.onclick = null;
    screen.classList.remove('fade-in');
    screen.classList.add('fade-out');
    isAnimationPlaying = true;
    // Custom event that can be used to apply (screen reader) visibility
    // changes.
    window.dispatchEvent(new CustomEvent('confirmdialoghiding'));
    screen.addEventListener('animationend', function cd_fadeOut(ev) {
      action1Node.className = '';
      action2Node.className = '';
      isAnimationPlaying = false;
      screen.removeEventListener('animationend', cd_fadeOut);
      screen.classList.add('no-opacity');
      screen.classList.add('hide');
      isShown = false;
    });
  };

  /**
    * Method that shows the dialog
    * @param  {String} title the title of the dialog. null or empty for
    *                        no title.
    * @param  {String} msg message for the dialog.
    * @param  {Object} action1 {title, isDanger, callback} object.
    * @param  {Object} action2 {title, isDanger, callback} object.
    */
  var _show = function _show(title, msg, action1, action2, options) {

    var setL10nAttributes = function (element, options){
      if ('string' === typeof options) {
        document.l10n.setAttributes(element, options);
      }

      if(options.id) {
        document.l10n.setAttributes(element, options.id, options.args);
      }
    };

    if (options && options.zIndex) {
      oldzIndex = screen.style.zIndex;
      screen.style.zIndex = options.zIndex;
    }
    else {
      oldzIndex = null;
    }
    if (title) {
      setL10nAttributes(titleNode, title);
    } else {
      titleNode.classList.add('hide');
    }
    if (msg) {
      setL10nAttributes(messageNode, msg);
    } else {
      messageNode.classList.add('hide');
    }
    if (action1) {
      if (action1.title) {
        setL10nAttributes(action1Node, action1.title);
      }
      if (action1.isDanger) {
        action1Node.classList.add('danger');
      }
      if (action1.isRecommend) {
        action1Node.classList.add('recommend');
      }
      if (action1.callback) {
        action1Callback = action1.callback;
        action1Node.onclick = callBackAndPreventDefault;
      }
      if (!action2) {
        action2Node.classList.add('hide');
        action1Node.classList.add('full');
      }
    }
    if (action2) {
      if (action2.title) {
        setL10nAttributes(action2Node, action2.title);
      }
      if (action2.isDanger) {
        action2Node.classList.add('danger');
      }
      if (action2.isRecommend) {
        action2Node.classList.add('recommend');
      }
      if (action2.callback) {
        action2Callback = action2.callback;
        action2Node.onclick = callBackAndPreventDefault;
      }
      if (!action1) {
        action1Node.classList.add('hide');
        action2Node.classList.add('full');
      }
    }
    if (isShown) {
      return;
    }

    screen.classList.remove('hide');
    screen.classList.remove('fade-out');
    screen.classList.add('fade-in');
    isAnimationPlaying = true;
    // Custom event that can be used to apply (screen reader) visibility
    // changes.
    window.dispatchEvent(new CustomEvent('confirmdialogshowing'));
    screen.addEventListener('animationend', function cd_fadeIn(ev) {
      isAnimationPlaying = false;
      screen.removeEventListener('animationend', cd_fadeIn);
      screen.classList.remove('no-opacity');
      isShown = true;
    });

    dialogSound.currentTime = 0;
    dialogSound.play();
  };

  return {
    hide: function dialog_hide() {
      // Reset the 'confirmation-message' element and its children to their
      // initial values and hide it.
      if (oldzIndex) {
        screen.style.zIndex = oldzIndex;
        oldzIndex = null;
      }

      if (!isAnimationPlaying) {
        _hide();
        return;
      }

      screen.addEventListener('animationend',
        function cd_hideWhenFinished(ev) {
          screen.removeEventListener('animationend', cd_hideWhenFinished);
          _hide();
        }
      );
    },

    /**
    * Method that shows the dialog
    * @param  {String} title the title of the dialog. null or empty for
    *                        no title.
    * @param  {String} msg message for the dialog.
    * @param  {Object} action1 {title, isDanger, callback} object.
    * @param  {Object} action2 {title, isDanger, callback} object.
    */
    show: function dialog_show(title, msg, action1, action2, options) {
      if (!isAnimationPlaying) {
        _show(title, msg, action1, action2, options);

        return;
      }

      screen.addEventListener('animationend',
        function cd_showWhenFinished(ev) {
          screen.removeEventListener('animationend', cd_showWhenFinished);
          _show(title, msg, action1, action2, options);
        }
      );
    }
  };
}());
