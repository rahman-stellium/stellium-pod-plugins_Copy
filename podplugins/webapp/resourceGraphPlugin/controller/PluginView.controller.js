sap.ui.define(
  ['sap/ui/model/json/JSONModel', 'sap/dm/dme/podfoundation/controller/PluginViewController', 'sap/base/Log'],
  function(JSONModel, PluginViewController, Log) {
    'use strict';

    var oLogger = Log.getLogger('resourceGraphPlugin', Log.Level.INFO);

    var oPluginViewController = PluginViewController.extend(
      'stellium.ext.podplugins.resourceGraphPlugin.controller.PluginView',
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
          this.subscribe('PodSelectionChangeEvent', this.onPodSelectionChangeEvent, this);
          this.subscribe('OperationListSelectEvent', this.onOperationChangeEvent, this);
          this.subscribe('WorklistSelectEvent', this.onWorkListSelectEvent, this);

          this.subscribe('StelResourceSelectionEvent', this.onResourceSelectionEvent, this);

          var oConfig = this.getConfiguration();
          this.configureNavigationButtons(oConfig);

          console.log(this.getPodSelectionModel().stelSelectedResourceData);
        },

        onExit: function() {
          if (PluginViewController.prototype.onExit) {
            PluginViewController.prototype.onExit.apply(this, arguments);
          }
          this.unsubscribe('PodSelectionChangeEvent', this.onPodSelectionChangeEvent, this);
          this.unsubscribe('OperationListSelectEvent', this.onOperationChangeEvent, this);
          this.unsubscribe('WorklistSelectEvent', this.onWorkListSelectEvent, this);

          this.unsubscribe('StelResourceSelectionEvent', this.onResourceSelectionEvent, this);
        },

        onBeforeRendering: function() {},

        onAfterRendering: function() {},

        onPodSelectionChangeEvent: function(sChannelId, sEventId, oData) {
          // don't process if same object firing event
          if (this.isEventFiredByThisPlugin(oData)) {
            return;
          }
        },

        onOperationChangeEvent: function(sChannelId, sEventId, oData) {
          // don't process if same object firing event
          if (this.isEventFiredByThisPlugin(oData)) {
            return;
          }
        },

        onWorkListSelectEvent: function(sChannelId, sEventId, oData) {
          // don't process if same object firing event
          if (this.isEventFiredByThisPlugin(oData)) {
            return;
          }
        },

        onResourceSelectionEvent: function(sChannelId, sEventId, oData) {
          // don't process if same object firing event
          if (this.isEventFiredByThisPlugin(oData)) {
            return;
          }
          console.log(oData)
        },

        configureNavigationButtons: function(oConfiguration) {
          if (!this.isPopup() && !this.isDefaultPlugin()) {
            this.byId('closeButton').setVisible(oConfiguration.closeButtonVisible);
          }
        }
      }
    );

    return oPluginViewController;
  }
);
