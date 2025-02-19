'use strict';

var FxAUser = require('./fxa_user'),
    config = require('./config.json');

/**
 * Abstraction around FxA app.
 * 'Entrance point' app URL is passed in since FxA acts more like a
 * component than a standalone app
 * (launched by Settings, Marketplace, FTU, FMD, dev_apps, etc.)
 *
 * @param client
 * @constructor
 */

var system;

function FxA(client) {
    this.config = config;
    this.fxaUser = new FxAUser();
    this.client = client.scope({ searchTimeout: config.MARIONETTE_TIMEOUT});
    system = this.client.loader.getAppClass('system');
}

FxA.SETTINGS_ORIGIN = 'app://smart-settings.gaiamobile.org';
FxA.UITEST_ORIGIN = 'app://uitest.gaiamobile.org';
FxA.TEST_FXA_CLIENT_ORIGIN = 'app://test-fxa-client.gaiamobile.org';
FxA.FTU_ORIGIN = 'app://ftu.gaiamobile.org';
FxA.BROWSER_ORIGIN = 'app://browser.gaiamobile.org';
FxA.SERVER_PATH = 'http://' +
    config.SERVER_HOST + ':' +
    config.SERVER_PORT + '/' +
    config.SERVER_PATH;
FxA.SERVER_ARGS = [
    config.SERVER_HOST,
    config.SERVER_PORT,
    config.SERVER_PATH
];

FxA.COPPA_YEAR = new Date().getFullYear() - 13;

FxA.Selectors = {
    body: 'body',
    bodyReady: 'body .view-body',
    // dev_apps/uitest
    apiFxaFrame: '#test-iframe',
    fxaFrame:  '#fxa-iframe',
    tabAPI: '#API',
    fxaButton: '#mozId-fxa',
    requestButton: '#request',
    // dev_apps/test-fxa-client
    tabOpenFlow: '#openFlow',
    // webapps/settings
    menuItemFxa: '#menuItem-fxa',
    menuItemFmd: '#menuItem-findmydevice',
    fxaLogin: '#fxa-login',
    fmdLogin: '#findmydevice-login',
    fxaCancelAccountConfirmation: '#fxa-cancel-confirmation',
    // webapps/ftu
    forward: '#forward',
    createAccountOrLogin: '#fxa-create-account',
    // webapps/findmydevice
    emailInput: '#fxa-email-input',
    fxaForgotPassword: 'fxa-forgot-password',
    pwInput: '#fxa-pw-input',
    //COPPA (age-restriction menu no longer appears,
    // but password input tag is still different)
    pwInputPostCOPPA: '#fxa-pw-set-input',
    pwSetInput: '#fxa-pw-set-input',
    pwRefresh: '#fxa-pw-input-refresh',
    COPPAElementId: '#fxa-coppa',
    COPPASelectId: '#fxa-age-select',
    COPPAOptionVal: FxA.COPPA_YEAR + ' or earlier',
    COPPAOptionValToFail: FxA.COPPA_YEAR.toString(),
    moduleNext: '#fxa-module-next',
    moduleDone: '#fxa-module-done',
    errorOK: '#fxa-error-ok'
};

FxA.prototype = {
    /**
     * Launches FxA app and focuses on frame.
     */
    launch: function (origin) {
        // do unless FTU
        if (origin.search('ftu') === -1) {
          this.client.apps.launch(origin);
        }
        this.client.apps.switchToApp(origin);
    },

    enterInput: function (inputId, inputString) {
        this.client.helper
            .waitForElement(inputId)
            .sendKeys(inputString);
    },

    enterCOPPANew: function () {
      var sel = FxA.Selectors.COPPASelectId;
      var inputString = FxA.Selectors.COPPAOptionVal;
      this.client.helper.tapSelectOption(sel, inputString);
    },

    enterEmailNew: function () {
        var sel = FxA.Selectors.emailInput;
        var inputString = this.fxaUser.email(config.USER_NEW);
        this.client.helper.fillInputField(sel, inputString);
    },
    enterPasswordNew: function () {
        var sel = FxA.Selectors.pwInputPostCOPPA;
        var inputString = this.fxaUser.password(config.USER_NEW);
        this.client.helper.fillInputField(sel, inputString);
    },
    enterEmailExisting: function () {
        var sel = FxA.Selectors.emailInput;
        var inputString = this.fxaUser.email(config.USER_EXISTING);
        this.client.helper.fillInputField(sel, inputString);
    },
    enterPasswordExisting: function () {
        var sel = FxA.Selectors.pwInput;
        var inputString = this.fxaUser.password(config.USER_EXISTING);
        this.client.helper.fillInputField(sel, inputString);
    },
    onClick:  function(searchSelector) {
        var element = this.client.findElement(searchSelector);
        this.client.helper
            .waitForElement(element)
            .tap();
    },
    clickNext: function() {
      var element = this.client.findElement(FxA.Selectors.moduleNext);
      var client = this.client;

      client.waitFor(function () {
        return client.findElement(FxA.Selectors.moduleNext)
          .scriptWith(function (el) {
            return el.getAttribute('disabled') !== 'disabled';
          });
      });

      client.helper
        .waitForElement(element)
        .tap();
    },
    clickDone: function() {
      var element = this.client.findElement(FxA.Selectors.moduleDone);
      this.client.helper
          .waitForElement(element)
          .tap();
    },
    clickTabOpenFlow: function() {
      var element = this.client.findElement(FxA.Selectors.tabOpenFlow);
      this.client.helper
          .waitForElement(element)
          .tap();
    },
    clickFxaLogin: function() {
      var element = this.client.findElement(FxA.Selectors.fxaLogin);
      this.client.helper
          .waitForElement(element)
          .tap();
    },
    clickMenuItemFxa: function() {
      var element = this.client.findElement(FxA.Selectors.menuItemFxa);
      this.client.helper
          .waitForElement(element)
          .tap();
    },
    clickRequestButton: function() {
      var element = this.client.findElement(FxA.Selectors.requestButton);
      this.client.helper
          .waitForElement(element)
          .tap();
    },
    clickTabAPI: function() {
      var element = this.client.findElement(FxA.Selectors.tabAPI);
      this.client.helper
          .waitForElement(element)
          .tap();
    },
    clickFxaButton: function() {
      var element = this.client.findElement(FxA.Selectors.fxaButton);
      this.client.helper
          .waitForElement(element)
          .tap();
    },
    switchFrame:  function(frameId) {
      this.client.switchToFrame();
      var frame = this.client.findElement(frameId);
      this.client.switchToFrame(frame);
    },
    switchFrameDirect:  function(frameId) {
      var frame = this.client.findElement(frameId);
      this.client.switchToFrame(frame);
    },
    clickThruPanel: function(panelId, buttonId) {
      if (panelId === '#wifi') {
        // The wifi panel will bring up a screen to show it is scanning for
        // networks. Not waiting for this to clear will blow test timing
        // and cause things to fail.
        this.client.helper.waitForElementToDisappear('#loading-overlay');
      }
      // waitForElement is used to make sure animations and page changes have
      // finished, and that the panel is displayed.
      this.client.helper.waitForElement(panelId);

      if (buttonId) {
        var button = this.client.helper.waitForElement(buttonId);
        button.click();
      }
    },
    runSettingsMenu: function() {
      this.clickMenuItemFxa();
      this.clickFxaLogin();
      this.switchFrame(FxA.Selectors.fxaFrame);
    },
    runUITestMenu: function() {
      this.clickTabAPI();
      this.clickFxaButton();
      this.switchFrameDirect(FxA.Selectors.apiFxaFrame);
      this.clickRequestButton();
      this.switchFrame(FxA.Selectors.fxaFrame);
    },
    runBrowserMenu: function() {
      var signin = this.client.helper.waitForElement('#fte-sign-in');
      signin.sendKeys(system.Keys.enter);
      this.switchFrame(FxA.Selectors.fxaFrame);
    },
    runFTUMenu: function() {
      this.clickThruPanel('#languages', '#forward');
      this.clickThruPanel('#wifi', '#forward');
      this.clickThruPanel('#date_and_time', '#forward');
      this.clickThruPanel('#geolocation', '#forward');
      this.clickThruPanel('#import_contacts', '#forward');
      this.clickThruPanel('#firefox_accounts',
          FxA.Selectors.createAccountOrLogin);
      this.switchFrame(FxA.Selectors.fxaFrame);
    },
    runFxAClientTestMenu: function() {
      this.clickTabOpenFlow();
      this.switchFrame(FxA.Selectors.fxaFrame);
    }
};

module.exports = FxA;
