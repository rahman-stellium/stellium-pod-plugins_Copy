sap.ui.define(['sap/ui/model/json/JSONModel', 'sap/dm/dme/podfoundation/controller/PluginViewController'], function(
  JSONModel,
  PluginViewController
) {
  'use strict';

  var oLogger = Log.getLogger('packingPlugin', Log.Level.INFO);

  var oPluginViewController = PluginViewController.extend(
    'stellium.ext.podplugins.packingPlugin.controller.PluginView',
    {
      onInit: function() {
        if (PluginViewController.prototype.onInit) {
          PluginViewController.prototype.onInit.apply(this, arguments);
        }
      },

      /**
         * @see PluginViewController.onBeforeRenderingPlugin()
         */
      onBeforeRenderingPlugin: function() {},

      onExit: function() {},

      onBeforeRendering: function() {},

      onAfterRendering: function() {},

      isSubscribingToNotifications: function() {
        return true;
      }
    }
  );

  return oPluginViewController;
});
