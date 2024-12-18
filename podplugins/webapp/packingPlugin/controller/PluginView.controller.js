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
        onBeforeRenderingPlugin: function() {
          this.subscribe('phaseSelectionEvent', this.handlePhaseSelectionEvent, this);
          this.publish('requestForPhaseData', this);
        },

        onExit: function() {
          if (PluginViewController.prototype.onExit) {
            PluginViewController.prototype.onExit.apply(this, arguments);
          }

          this.unsubscribe('phaseSelectionEvent', this.handlePhaseSelectionEvent, this);
        },

        onBeforeRendering: function() {
          var oViewModel = new JSONModel({
            availableObjectsSelectedTab: 'availableSfcsTab',
            availableSfcsListLength: 0,
            availableSfcsSearchValue: null,
            assignedObjectsListLength: 0,
            assignedObjectsSearchValue: null,
            availableSfcsSelectedAndValid: false,
            assignedItemsSelected: false,
            packingUnitsLength: 0,
            availablePusLength: 0
          });
          this.getView().setModel(oViewModel, 'viewModel');

          // ObjectTypeFormatter.init(this.getOwnerComponent().getModel('i18n-objectType').getResourceBundle());
          StatusFormatter.init(this.getOwnerComponent().getModel('i18n-status').getResourceBundle());

          // load packing unit list by odata
          this.loadPackingUnitsList();
          // this.initializeUnitsListFilterBar();
        },

        onAfterRendering: function() {},

        handlePhaseSelectionEvent: function(sChannelId, sEventId, oData) {
          this.selectedOrderData = oData;
        },

        loadPackingUnitsList: function(sSearchValue) {
          let oPodSelectionModel = this.getPodSelectionModel();

          let sResource = this.getResourceFromPodSelectionModel(oPodSelectionModel);
          let sQuery = sSearchValue || this.byId('packingUnitsSearch').getValue();

          const sFilter = this.createFilterArgumentParam(sResource);

          let oUnitsList = this.byId('packingUnitsList');
          let oUnitsListItem = this.byId('unitsListItem');
          let sErrorMessage = this.getI18nText('error.packingUnitsFetchFail.msg');

          // resource in function call should be empty and its value should be in filter
          let sUrl = `packing>/GetPackingsList(resource='',number='${sQuery}',order='',material='')`;

          const oBindParams = {
            path: sUrl,
            template: oUnitsListItem,
            events: {
              dataRequested: function() {
                oUnitsList.setBusy(true);
              },
              dataReceived: function(oResponse) {
                oUnitsList.setNoDataText(oResponse.getParameter('error') ? sErrorMessage : null);
                oUnitsList.setBusy(false);
              }
            },
            sorter: new sap.ui.model.Sorter('modifiedDateTime', true)
          };

          if (sFilter) {
            oBindParams.parameters = { $filter: sFilter };
          }
          oUnitsList.bindItems(oBindParams);
        },

        // Work Center POD and Operation POD return different getResource objects.
        // WC POD returns a string with resource name, while Operation POD returns an object with resource name.
        getResourceFromPodSelectionModel: function(oPodSelectionModel) {
          const oResource = oPodSelectionModel.getResource();
          if (!oResource) {
            return '';
          }

          if (oResource.resource) {
            return oResource.resource;
          }

          return oResource;
        },

        /**
         * Creates a filter parameter for bindItems function call.
         * Used with OData bindings.
         * @param sResource
         * @returns {string} filter with material or resource in filter statements. The values are not encoded.
         */
        createFilterArgumentParam: function(sResource) {
          const sMaterialRef = this.sMaterialFilterRef;
          if (!sResource && !sMaterialRef) {
            return '';
          }

          if (this.sMaterialFilterRef && !sResource) {
            return `contains(material,'${sMaterialRef}')`;
          }

          if (!this.sMaterialFilterRef && sResource) {
            return `resource eq '${sResource}'`;
          }

          if (this.sMaterialFilterRef && sResource) {
            return `contains(material,'${sMaterialRef}') and resource eq '${sResource}'`;
          }
        }
      }
    );

    return oPluginViewController;
  }
);
