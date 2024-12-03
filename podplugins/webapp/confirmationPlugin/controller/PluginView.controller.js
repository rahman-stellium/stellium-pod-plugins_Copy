sap.ui.define(
  ['sap/ui/model/json/JSONModel', 'sap/dm/dme/podfoundation/controller/PluginViewController', 'sap/base/Log'],
  function(JSONModel, PluginViewController, Log) {
    'use strict';

    var oLogger = Log.getLogger('confirmationPlugin', Log.Level.INFO);

    var oPluginViewController = PluginViewController.extend(
      'stellium.ext.podplugins.confirmationPlugin.controller.PluginView',
      {
        metadata: {
          properties: {}
        },

        onInit: function() {
          if (PluginViewController.prototype.onInit) {
            PluginViewController.prototype.onInit.apply(this, arguments);
          }
        },

        /**
         * @see PluginViewController.onBeforeRenderingPlugin()
         */
        onBeforeRenderingPlugin: function() {

        },

        onExit: function() {
        },

        onBeforeRendering: function() {},

        onAfterRendering: function() {},
      }
    );

    return oPluginViewController;
  }
);
