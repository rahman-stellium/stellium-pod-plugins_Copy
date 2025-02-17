sap.ui.define(['sap/dm/dme/podfoundation/component/production/ProductionUIComponent'], function(ProductionUIComponent) {
  'use strict';

  /**
     * 
     */
  var Component = ProductionUIComponent.extend('stellium.ext.podpluginsCopyRahman.manageCancellationPlugin.Component', {
    metadata: {
      manifest: 'json'
    },
    displayTarget: function(sTargetName, oData) {
      this.clearTarget();
      this.getTargets().display(sTargetName, oData);
    },

    clearTarget: function() {
      this.getRootControl().byId('idPage').removeAllContent();
    }
  });

  return Component;
});
