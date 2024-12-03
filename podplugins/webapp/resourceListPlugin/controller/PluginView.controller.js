sap.ui.define(
  ['sap/ui/model/json/JSONModel', 'sap/dm/dme/podfoundation/controller/PluginViewController', 'sap/base/Log'],
  function(JSONModel, PluginViewController, Log) {
    'use strict';

    var oLogger = Log.getLogger('resourceListPlugin', Log.Level.INFO);

    var oPluginViewController = PluginViewController.extend(
      'stellium.ext.podplugins.resourceListPlugin.controller.PluginView',
      {
        metadata: {
          properties: {}
        },

        onInit: function() {
          if (PluginViewController.prototype.onInit) {
            PluginViewController.prototype.onInit.apply(this, arguments);
          }

          var oModel = new JSONModel();
          this.getView().setModel(oModel, 'data');
        },

        /**
         * @see PluginViewController.onBeforeRenderingPlugin()
         */
        onBeforeRenderingPlugin: function() {
          this.subscribe('PodSelectionChangeEvent', this.onPodSelectionChangeEvent, this);
          this.subscribe('OperationListSelectEvent', this.onOperationChangeEvent, this);
          this.subscribe('WorklistSelectEvent', this.onWorkListSelectEvent, this);

          this.subscribe('PageChangeEvent', this.onPageChangeEvent, this);

          var oConfig = this.getConfiguration();
          this.configureNavigationButtons(oConfig);

          this._loadResourceData();
        },

        onExit: function() {
          if (PluginViewController.prototype.onExit) {
            PluginViewController.prototype.onExit.apply(this, arguments);
          }
          this.unsubscribe('PodSelectionChangeEvent', this.onPodSelectionChangeEvent, this);
          this.unsubscribe('OperationListSelectEvent', this.onOperationChangeEvent, this);
          this.unsubscribe('WorklistSelectEvent', this.onWorkListSelectEvent, this);
          this.unsubscribe('PageChangeEvent', this.onPageChangeEvent, this);
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

        configureNavigationButtons: function(oConfiguration) {
          if (!this.isPopup() && !this.isDefaultPlugin()) {
            this.byId('closeButton').setVisible(oConfiguration.closeButtonVisible);
          }
        },

        onPageChangeEvent: function() {
          if (oData.page == 'MainPage' && !this.isResourceSelectionEvent) {
            let sHashPart = window.location.hash;
            let nHashIndex = sHashPart.indexOf('?');

            if (nHashIndex !== -1) {
              let sBeforeQueryParams = sHashPart.substring(0, nHashIndex);
              let sQueryParams = sHashPart.substring(nHashIndex + 1);

              let oSearchParams = new URLSearchParams(sQueryParams);
              oSearchParams.delete('RESOURCESELECTION');

              let sNewHash = `${sBeforeQueryParams}?${oSearchParams.toString()}`;
              window.location.hash = sNewHash;
            }
          }

          // Reset the flag after the selection event is handled to ensure that the flag is not already set when the user selects another resource.
          if (this.isResourceSelectionEvent) {
            this.isResourceSelectionEvent = false;
          }
        },

        onResourceItemPress: function(oEvent) {
          var oSource = oEvent.getSource(),
            oBindingContext = oSource.getBindingContext('data'),
            oSelectedResourceData = oBindingContext.getObject();

          var oPodSelectionModel = this.getPodSelectionModel();
          oPodSelectionModel.stelSelectedResourceData = oSelectedResourceData;

          this.navigateToPage('RESOURCEGRAPH');
        },

        _loadResourceData: function() {
          var that = this,
            sUrl = this.getPublicApiRestDataSourceUri() + '/resource/v2/resources';
          var oParameters = {
            plant: this.getPodController().getUserPlant()
          };

          this.ajaxGetRequest(
            sUrl,
            oParameters,
            function(oResponseData) {
              that._handleResourceResponse(oResponseData);
            },
            function(oError, sHttpErrorMessage) {
              that.handleErrorMessage(oError, sHttpErrorMessage);
            }
          );
        },

        _handleResourceResponse: function(oResponseData) {
          var oModel = this.getView().getModel('data');

          console.log('Data received', oResponseData);

          //Convert custom value array to object for data binding
          for (var i = 0; i < oResponseData.length; i++) {
            var oCustomData = oResponseData[i].customValues.reduce((acc, val) => {
              acc[val.attribute] = val.value;
              return acc;
            }, {});
            oResponseData[i].customData = oCustomData;
          }
          oModel.setProperty('/resources', oResponseData);

          console.log('Data set in model:', oModel.getData());
        }
      }
    );

    return oPluginViewController;
  }
);
