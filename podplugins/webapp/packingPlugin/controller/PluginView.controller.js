sap.ui.define(
  [
    'sap/dm/dme/podfoundation/controller/PluginViewController',
    'sap/ui/model/json/JSONModel',
    'sap/base/Log',
    '../util/PackingPluginFormatter',
    'sap/dm/dme/formatter/GeneralFormatter',
    'sap/dm/dme/formatter/StatusFormatter'
  ],
  function(PluginViewController, JSONModel, Log, PackingPluginFormatter, GeneralFormatter, StatusFormatter) {
    'use strict';

    var oLogger = Log.getLogger('packingPlugin', Log.Level.INFO);

    var oPluginViewController = PluginViewController.extend(
      'stellium.ext.podplugins.packingPlugin.controller.PluginView',
      {
        packingPluginFormatter: PackingPluginFormatter,
        generalFormatter: GeneralFormatter,
        statusFormatter: StatusFormatter,

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
        onBeforeRenderingPlugin: function() {},

        onExit: function() {
          if (PluginViewController.prototype.onExit) {
            PluginViewController.prototype.onExit.apply(this, arguments);
          }
        },

        onBeforeRendering: function() {},

        onAfterRendering: function() {}
      }
    );

    return oPluginViewController;
  }
);
