'use strict';

/* global AbortablePromiseQueue */

(function(exports) {

var StateManager = function(app) {
  this.app = app;

  this._started = false;

  this._isActive = undefined;
  this._layoutName = undefined;
};

StateManager.prototype.start = function() {
  this.app.console.log('StateManager.start()');

  if (this._started) {
    throw new Error('StateManager: Should not be start()\'ed twice.');
  }
  this._started = true;

  // Start with inactive state.
  this._isActive = false;

  this._queue = new AbortablePromiseQueue();
  this._queue.start();

  window.addEventListener('hashchange', this);
  window.addEventListener('visibilitychange', this);
  navigator.b2g.inputMethod.addEventListener('inputcontextchange', this);

  this.app.setInputContext(navigator.b2g.inputMethod.inputcontext);
  this._layoutName = window.location.hash.substr(1);

  var active = (!document.hidden && !!this.app.inputContext);

  // If the app was started inactive, we should start the loading process of
  // what we would need.
  if (!active) {
    this._queue.run([
      this._preloadLayout.bind(this),
      this._preloadInputMethod.bind(this)
    ]);
  }

  this._updateActiveState(active);
};

StateManager.prototype.stop = function() {
  this.app.console.log('StateManager.stop()');

  if (!this._started) {
    throw new Error('StateManager: Was not start()\'ed but stop() is called.');
  }
  this._started = false;

  this._queue.stop();
  this._queue = null;

  window.removeEventListener('hashchange', this);
  window.removeEventListener('visibilitychange', this);
  navigator.b2g.inputMethod.removeEventListener('inputcontextchange', this);

  this._isActive = undefined;
  this._layoutName = undefined;
};

StateManager.prototype.handleEvent = function(evt) {
  var active = (!document.hidden &&
                !!navigator.b2g.inputMethod.inputcontext);
  this.app.console.info('StateManager.handleEvent()', evt, active);

  switch (evt.type) {
    case 'hashchange':
      this._layoutName = window.location.hash.substr(1);
      if (!active) {
        this._queue.run([
          this._preloadLayout.bind(this),
          this._preloadInputMethod.bind(this)
        ]);
      }

      break;

    case 'visibilitychange':
      break;

    case 'inputcontextchange':
      this.app.setInputContext(navigator.b2g.inputMethod.inputcontext);

      break;
  }

  this._updateActiveState(active);
};

StateManager.prototype._updateActiveState = function(active) {
  this.app.console.log('StateManager._updateActiveState()', active);

  if (active) {
    this.app.console.time('activate');

    // Perform the following async tasks with a promise chain.
    this._queue.run([
      function() {
        // Before switching away, clean up anything pending in the previous
        // active layout.
        // We however don't clear active target here because the user might
        // want to input continuously between two layouts.
        this.app.candidatePanelManager.hideFullPanel();
        this.app.candidatePanelManager.updateCandidates([]);

        // We would need to deactivate the IMEngine too to cancel any pending
        // compositions.
        this.app.inputMethodManager.deactivateIMEngine();

        this.app.feedbackManager.activate();
      }.bind(this),
      // Switch the layout,
      this.app.layoutManager.switchCurrentLayout.bind(
        this.app.layoutManager, this._layoutName),
      // ... activate the IMEngine for the current page,
      this._activateIMEngineForCurrentPage.bind(this),
      // ... load the layout rendering,
      this.app.layoutRenderingManager.updateLayoutRendering
        .bind(this.app.layoutRenderingManager)
    ]);
  } else {
    // Do nothing if we are already hidden.
    if (active === this._isActive) {
      return;
    }

    this._queue.run([
      // Finish off anything pending & cancel everything
      function() {
        this.app.candidatePanelManager.hideFullPanel();
        this.app.candidatePanelManager.updateCandidates([]);
        this.app.targetHandlersManager.activeTargetsManager.clearAllTargets();
        this.app.feedbackManager.deactivate();
      }.bind(this),
      // ... deactivate the IMEngine too.
      this.app.inputMethodManager.deactivateIMEngine.bind(
        this.app.inputMethodManager)
    ]);
  }

  this._isActive = active;
};

StateManager.prototype._preloadLayout = function() {
  this.app.console.log('StateManager._preloadLayout()');
  var layoutLoader = this.app.layoutManager.loader;
  return layoutLoader.getLayoutAsync(this._layoutName);
};

StateManager.prototype._preloadInputMethod = function(layout) {
  this.app.console.log('StateManager._preloadInputMethod()');
  var imEngineName = layout.imEngine;
  var imEngineLoader = this.app.inputMethodManager.loader;
  // Ask the loader to start loading IMEngine
  if (imEngineName) {
    var p = imEngineLoader.getInputMethodAsync(imEngineName);
    return p;
  }
};

StateManager.prototype._activateIMEngineForCurrentPage = function() {
  this.app.console.log('StateManager._activateIMEngineForCurrentPage()');

  var page = this.app.layoutManager.currentPage;
  var imEngineName = page.imEngine || 'default';

  this.app.upperCaseStateManager.reset();
  this.app.candidatePanelManager.reset();

  var p = this.app.inputMethodManager.activateIMEngine(imEngineName);

  return p;
};

exports.StateManager = StateManager;

})(window);
