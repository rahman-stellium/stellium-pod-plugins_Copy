sap.ui.define(
  [
    'sap/ui/model/json/JSONModel',
    'sap/dm/dme/podfoundation/controller/PluginViewController',
    'sap/dm/dme/util/PlantSettings',
    'sap/base/Log',
    'sap/m/TablePersoController',
    '../util/formatter'
  ],
  function(JSONModel, PluginViewController, PlantSettings, Log, TablePersoController, Formatter) {
    'use strict';

    var oLogger = Log.getLogger('resourceListPlugin', Log.Level.INFO);

    var oPluginViewController = PluginViewController.extend(
      'stellium.ext.podplugins.manageCancellationPlugin.controller.MasterObject',
      {
        metadata: {
          properties: {}
        },

        formatter: Formatter,

        onInit: function() {
          var oView = this.getView();

          PluginViewController.prototype.onInit.apply(this, arguments);

          oView.setModel(
            new JSONModel({
              quantityConfirmationTitle: this.getI18nText('postingTitle', [0]),
              postingTitle: this.getI18nText('postingTitle', [0]),
              FINISH_GOOD_TITLE: this.getI18nText('FINISH_GOOD', [0]),
              CO_PRODUCT_TITLE: this.getI18nText('CO_PRODUCT', [0]),
              BY_PRODUCT_TITLE: this.getI18nText('BY_PRODUCT', [0]),
              authorizedToCancel: false
            }),
            'data'
          );

          oView.setModel(
            new JSONModel({
              value: ''
            }),
            'cancelReason'
          );

          //Create table personalization service
          const TablePersonalizeService = {
            oData: {
              _persoSchemaVersion: '1.0',
              aColumns: []
            },

            getPersData: function() {
              const oDeferred = new jQuery.Deferred();
              if (!this._oBundle) {
                this._oBundle = this.oData;
              }
              const oBundle = this._oBundle;
              oDeferred.resolve(oBundle);
              return oDeferred.promise();
            },

            setPersData: function(oBundle) {
              const oDeferred = new jQuery.Deferred();
              this._oBundle = oBundle;
              oDeferred.resolve();
              return oDeferred.promise();
            }
          };
          TablePersonalizeService.getPersData();
          TablePersonalizeService.setPersData({});

          //Create table settings
          this._oTableSettings = new TablePersoController({
            table: this.byId('idConfirmationsTable'),
            componentName: 'settings',
            persoService: TablePersonalizeService
          }).activate();

          this.goodsIssueTableSettings = new TablePersoController({
            table: this.byId('goodsIssueTable'),
            componentName: 'settings',
            persoService: TablePersonalizeService
          }).activate();

          this.goodsReceiptFinishGoodTableSettings = new TablePersoController({
            table: this.byId('goodsReceiptFinishGoodTable'),
            componentName: 'settings',
            persoService: TablePersonalizeService
          }).activate();

          this.goodsReceiptByProductTableSettings = new TablePersoController({
            table: this.byId('goodsReceiptByProductTable'),
            componentName: 'settings',
            persoService: TablePersonalizeService
          }).activate();

          this.goodsReceiptCoProductTableSettings = new TablePersoController({
            table: this.byId('goodsReceiptCoProductTable'),
            componentName: 'settings',
            persoService: TablePersonalizeService
          }).activate();

          var oMessageManager = sap.ui.getCore().getMessageManager();
          oView.setModel(oMessageManager.getMessageModel(), 'message');
          oMessageManager.registerObject(oView, true);

          this.cancel = false;
          this.activityConfirmationPageNo = 0;
          this.goodsIssuePageNo = 0;
          this.goodsReceiptPageNo = {
            FINISH_GOOD: 0,
            CO_PRODUCT: 0,
            BY_PRODUCT: 0
          };

          oView.setModel(new JSONModel([]), 'activityConfirmationItems');
          oView.setModel(new JSONModel([]), 'quantityConfirmationItems');
          oView.setModel(new JSONModel(), 'viewModel');

          this.getOwnerComponent().getTargets().getTarget('OrderDetail').attachDisplay(this.onRouteMatched, this);
          this.cancalletionAuthorizationCheck();
        },

        /**
         * @see PluginViewController.onBeforeRenderingPlugin()
         */
        onBeforeRenderingPlugin: function() {},

        onExit: function() {
          PluginViewController.prototype.onExit.apply(this, arguments);
        },

        onBeforeRendering: function() {},

        onAfterRendering: function() {},

        onRouteMatched: function(oEvent) {
          this.activityConfirmationGroupFunctions = {
            opration: function(t) {
              const e = t.getProperty('opration');
              return {
                key: e,
                text: e
              };
            },
            postedBy: function(t) {
              const e = t.getProperty('postedBy');
              return {
                key: e,
                text: e
              };
            }
          };

          // this.byId('activityConfirmationSearch').setValue('');
          // this.byId('quantityConfirmationSearch').setValue('');
          // this.byId('goodsReceiptSearch').setValue('');
          // this.byId('goodsReceiptByProductSearch').setValue('');
          // this.byId('goodsReceiptByCoProductSearch').setValue('');
          // this.byId('goodsIssueSearch').setValue('');

          // this.currentTab = 'activityConfirmation';
          // this.byId('detailPage').setSelectedSection(this.byId('activityConfirmation'));
          // this.byId('activityConfirmationSearch').setValue('');

          const oData = oEvent.getParameter('data');
          this.mGroupFunctions = {
            phrase: function(t) {
              return {
                key: t.getProperty('phrase'),
                text: t.getProperty('phrase')
              };
            }
          };

          const oQuery = oData['?query'];
          oQuery.materialDescription = decodeURIComponent(oQuery.materialDescription);
          oQuery.material = decodeURIComponent(oQuery.material);

          this.getView().setModel(new JSONModel(oQuery), 'entity');
          this.oQuery = oQuery;
          this.activityConfirmationPageNo = 0;

          this.getOrderDetail(oQuery.shopOrder);
          // this.getActivityConfirmationItems();
        },

        getOrderDetail: function(sShopOrder) {
          const sPlant = PlantSettings.getCurrentPlant();
          const sUrl = this.getDemandRestDataSourceUri() + 'v1/orders?order=' + sShopOrder + '&plant=' + sPlant;

          // $.ajaxSettings.async = false;
          this.ajaxGetRequest(
            sUrl,
            null,
            function(oResponse) {
              this.getView().getModel('viewModel').setProperty('/order', oResponse);
              this.getActivityConfirmationItems();
            }.bind(this),
            this._requestFailure.bind(this)
          );

          // $.ajaxSettings.async = true;
        },

        getActivityConfirmationItems: function(oSort) {
          let e = 'operationActivity,desc';

          if (oSort) {
            const i = oSort.order ? 'desc' : 'asc';
            e = oSort.by + ',' + i;
          }

          if (this.activityConfirmationPageNo === 0) {
            this.byId('idConfirmationsTable').setBusyIndicatorDelay(0);
            this.byId('idConfirmationsTable').setBusy(true);
          }

          const oShopOrder = this.getView().getModel('viewModel').getProperty('/order');
          const sUrl =
            this.getActivityConfirmationRestDataSourceUri() +
            'activityconfirmation/internal/v1/sfc/' +
            this.oQuery.sfc +
            '/postings?sort=operationActivity,confirmationGroup,confirmationCounter&orderQuantity=' +
            oShopOrder.orderedQuantity +
            '&shopOrder=' +
            oShopOrder.order +
            '&page=' +
            this.activityConfirmationPageNo +
            '&size=20';

          this.ajaxGetRequest(
            sUrl,
            null,
            this._readConfirmationItemsSuccess.bind(this),
            this._requestFailure.bind(this)
          );
        },

        _readConfirmationItemsSuccess: function(oResponse) {
          if (oResponse) {
            this.getView().getModel('data').setProperty(
              '/postingTitle',
              this.getI18nText('postingTitle', [oResponse.totalElements])
            );
            const oActConfItemsModel = this.getView().getModel('activityConfirmationItems');
            let aData = [];
            if (this.activityConfirmationPageNo === 0) {
              aData = oResponse.content;
            } else {
              aData = oActConfItemsModel.getData().concat(oResponse.content);
            }
            this.getActivityConfirmationOperations(aData, oActConfItemsModel, oResponse.totalElements);
            this.cancel = false;
            this.activityConfirmationPageNo++;
          }
          this.byId('idConfirmationsTable').setBusy(false);
          this.byId('headerRefresh').setEnabled(true);
        },

        getActivityConfirmationOperations: function(aData, oModel, iTotalElements) {
          let aActivityList = [];
          for (let i = 0; i < aData.length; i++) {
            aActivityList.push(aData[i].operationActivity);
          }
          const sActivities = aActivityList.join(',');

          if (aData.length > 0) {
            const sUrl =
              this.getDemandRestDataSourceUri() +
              'shopOrderConfirmations/operationDescriptions?operations=' +
              sActivities;

            this.ajaxGetRequest(
              sUrl,
              null,
              function(oResponse) {
                if (oResponse) {
                  aData.forEach(function(t) {
                    const e = oResponse.findIndex(function(e) {
                      return e.operation == t.operationActivity;
                    });
                    t.description = oResponse[e] && oResponse[e].description;
                  });
                  oModel.setData(aData);
                  // this.byId('activityConfirmationSearch').fireLiveChange();
                  // this.setTableGrowingTrigger(this.byId('idConfirmationsTable'), 'activityConfirmationItems', iTotalElements);
                }
              }.bind(this),
              this._requestFailure.bind(this)
            );
          } else {
            oModel.setData(aData);
            // this.byId('activityConfirmationSearch').fireLiveChange();
            // this.setTableGrowingTrigger(this.byId('activityConfirmationTable'), 'activityConfirmationItems', iTotalElements);
          }
        },

        cancalletionAuthorizationCheck: function() {
          const sUrl = this.getDemandRestDataSourceUri() + 'shopOrderConfirmations/authorizations/check';

          this.ajaxPostRequest(
            sUrl,
            null,
            function() {
              this.getView().getModel('data').setProperty('/authorizedToCancel', true);
            }.bind(this),
            function(t, e, i) {
              if (i !== 403) {
                this._requestFailure(t, e);
              }
            }.bind(this)
          );
        },

        _requestFailure: function(t, e, i) {
          // this.modifyDataErrorHandler(t, e, i);
          this.getView().setBusy(false);

          if (this.byId('masterList')) {
            this.byId('masterList').setBusy(false);
          }

          if (this.byId('goodsIssueTable')) {
            this.byId('goodsIssueTable').setBusy(false);
          }

          this.setGoodsReceiptTableBusy(false);

          if (this.byId('activityConfirmation')) {
            this.byId('activityConfirmation').setBusy(false);
          }

          if (this.byId('quantityConfirmation')) {
            this.byId('quantityConfirmation').setBusy(false);
          }

          this.cancel = false;

          if (this.byId('headerRefresh')) {
            this.byId('headerRefresh').setEnabled(true);
          }
        },

        setGoodsReceiptTableBusy: function(bBusyState, e) {
          const oGRFinishedGoodsTab = this.byId('goodsReceiptFinishGoodTable'),
            oGRByProdTab = this.byId('goodsReceiptByProductTable'),
            oGRCoProdTab = this.byId('goodsReceiptCoProductTable');

          oGRFinishedGoodsTab.setBusyIndicatorDelay(0);
          oGRByProdTab.setBusyIndicatorDelay(0);
          oGRCoProdTab.setBusyIndicatorDelay(0);

          if (e) {
            if (e === 'FINISH_GOOD') {
              oGRFinishedGoodsTab.setBusy(bBusyState);
            } else if (e === 'CO_PRODUCT') {
              oGRCoProdTab.setBusy(bBusyState);
            } else {
              oGRByProdTab.setBusy(bBusyState);
            }
          } else {
            oGRFinishedGoodsTab.setBusy(bBusyState);
            oGRByProdTab.setBusy(bBusyState);
            oGRCoProdTab.setBusy(bBusyState);
          }
        }
      }
    );

    return oPluginViewController;
  }
);
