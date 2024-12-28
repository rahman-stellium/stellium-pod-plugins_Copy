sap.ui.define(
  [
    'sap/ui/model/json/JSONModel',
    'sap/dm/dme/podfoundation/controller/PluginViewController',
    'sap/dm/dme/util/PlantSettings',
    'sap/base/Log',
    'sap/m/TablePersoController',
    'sap/m/MessageBox',
    'sap/m/MessageToast',
    'sap/m/TextArea',
    'sap/m/Dialog',
    'sap/m/DialogType',
    'sap/m/Label',
    'sap/m/Button',
    'sap/m/ButtonType',
    'sap/ui/core/Fragment',
    '../util/formatter'
  ],
  function(
    JSONModel,
    PluginViewController,
    PlantSettings,
    Log,
    TablePersoController,
    MessageBox,
    MessageToast,
    TextArea,
    Dialog,
    DialogType,
    Label,
    Button,
    ButtonType,
    Fragment,
    Formatter
  ) {
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
          this.quantityConfirmationPageNo = 0;
          this.goodsIssuePageNo = 0;
          this.goodsReceiptPageNo = {
            FINISH_GOOD: 0,
            CO_PRODUCT: 0,
            BY_PRODUCT: 0
          };

          oView.setModel(new JSONModel([]), 'activityConfirmationItems');
          oView.setModel(new JSONModel([]), 'quantityConfirmationItems');
          oView.setModel(new JSONModel([]), 'confirmationItems');
          oView.setModel(new JSONModel([]), 'cancellationItems');
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
        },

        onRefreshBtnPress: function() {
          // Reset query and table models
          this.sQuery = null;
          this.resetTableModels();

          // Handle refresh based on the current tab
          switch (this.currentTab) {
            case 'actQtyConfirmations':
              this.activityConfirmationPageNo = 0;
              // this.sQuery = this.byId('activityConfirmationSearch').getValue();
              this.getActQtyConfirmationData();
              break;

            case 'goodsReceipt':
              this.goodsReceiptPageNo = {
                FINISH_GOOD: 0,
                CO_PRODUCT: 0,
                BY_PRODUCT: 0
              };
              //TODO:
              // this.getGoodsReceiptItems('FINISH_GOOD', true, this.byId('goodsReceiptSearch').getValue());
              // this.getGoodsReceiptItems('CO_PRODUCT', true, this.byId('goodsReceiptByCoProductSearch').getValue());
              // this.getGoodsReceiptItems('BY_PRODUCT', true, this.byId('goodsReceiptByProductSearch').getValue());
              break;

            case 'goodsIssue':
              this.goodsIssuePageNo = 0;
              //TODO:
              // this.sQuery = this.byId('goodsIssueSearch').getValue();
              // this.getGoodsIssueItems();
              break;
          }
        },

        onNavigate: function(oEvent) {
          const viewId = this.getView().getId();
          const selectedSection = oEvent.getSource().getSelectedSection();

          // Reset properties
          // this.sQuery = null;
          this.activityConfirmationPageNo = 0;
          this.quantityConfirmationPageNo = 0;
          this.goodsIssuePageNo = 0;
          this.goodsReceiptPageNo = {
            FINISH_GOOD: 0,
            CO_PRODUCT: 0,
            BY_PRODUCT: 0
          };

          this.resetTableModels();
          //TODO
          // this.resetSearchText();

          // Handle navigation
          switch (selectedSection) {
            case viewId + '--actQtyConfirmations':
              this.currentTab = 'actQtyConfirmations';
              this.getActQtyConfirmationData();

            case viewId + '--goodsReceiptSection':
              if (this.currentTab === 'goodsReceipt') {
                return;
              }
              this.currentTab = 'goodsReceipt';
              //TODO
              // this.getGoodsReceiptItems('FINISH_GOOD');
              // this.getGoodsReceiptItems('CO_PRODUCT');
              // this.getGoodsReceiptItems('BY_PRODUCT');
              break;

            case viewId + '--goodsIssue':
              this.currentTab = 'goodsIssue';
              //TODO
              // this.getGoodsIssueItems();
              break;
          }
        },

        onCancelConfirmationPress: function(oEvent) {
          var oView = this.getView(),
            oConfirmation = oEvent.getSource().getBindingContext('confirmationItems').getObject(),
            oCancellationModel = oView.getModel('cancellationItems');

          //Get the associated confirmation item
          var oAssocConfirmation = this.getAssocConfirmation(
            oConfirmation.confirmationGroup,
            oConfirmation.confirmationCounter,
            oConfirmation.createdOn
          );

          //Create the cancellation dialog data
          var aCancellationData = [oConfirmation];
          if (oAssocConfirmation) {
            aCancellationData.push(oAssocConfirmation);
          }
          oCancellationModel.setData(aCancellationData);

          //Show the cancellation dialog
          this.showCancellationDialog();
        },

        /**
         * Gets the associated confirmation item based on the following conditions
         *    Confirmation group matches
         *    Confirmation counter is one away from the current confirmation
         *    Confirmation created datetime is within 30 seconds of eachother
         * @param {string} sConfGrp Confirmation Group for the confirmation item
         * @param {string} sConfCtr Confirmation Counter for the confirmation item
         * @param {Date} sCreatedOn Confirmation created date
         * @returns {object}
         */
        getAssocConfirmation: function(sConfGrp, sConfCtr, sCreatedOn) {
          var oView = this.getView(),
            aConfItems = oView.getModel('confirmationItems').getData();
          var oItem = aConfItems.find(item => {
            //Check for confirmation group match
            if (item.confirmationGroup !== sConfGrp) {
              return false;
            }

            //Associated confirmation counter will be 1 away from current confirmation
            var bFlag = false;
            if (+item.confirmationCounter === +sConfCtr + 1 || +item.confirmationCounter === +sConfCtr - 1) {
              bFlag = true;
            }
            if (!bFlag) {
              return false;
            }

            //Check if confirmation created on is within 30 seconds of eachother
            var oDate1 = moment(item.createdOn),
              oDate2 = moment(sCreatedOn);
            if (Math.abs(oDate1.diff(oDate2)) > 30 * 1000) {
              return false;
            }

            // return bFlag && item.confirmationGroup === sConfGrp && item.createdOn === sCreatedOn;
            return true;
          });

          return oItem;
        },

        /**
         * Show cancellation dialog
         * Show dialog if exists. Else create the dialog and show
         */
        showCancellationDialog: function() {
          var oView = this.getView(),
            oConfirmCancellationDialog = oView.byId('idConfirmCancellationDialog');

          if (oConfirmCancellationDialog) {
            oConfirmCancellationDialog.open();
            return;
          }

          Fragment.load({
            id: oView.getId(),
            name: 'stellium.ext.podplugins.manageCancellationPlugin.view.fragments.CancellationDialog',
            controller: this
          }).then(function(oDialog) {
            //Handle dialog close function on escape button press
            oDialog.setEscapeHandler(function(oPromise) {
              that.onConfirmCancellationBtnPress();
              oPromise.resolve();
            });

            //Add the dialog to the view
            oView.addDependent(oDialog);

            //Show the dialog
            oDialog.open();
          });
        },

        onConfirmCancellationBtnPress: function() {
          this.onSubmitDialogPress();
        },

        /**
         * Handle cancel button press event in the dialog
         *  Close the dialog
         *  Clear the model
         * @returns {undefined}
         */
        onCancelCancellationBtnPress: function() {
          var oView = this.getView(),
            oConfirmCancellationDialog = oView.byId('idConfirmCancellationDialog');

          //If dialog does not exist, do nothing
          if (!oConfirmCancellationDialog) {
            return;
          }

          //Close the dialog
          oConfirmCancellationDialog.close();
        },

        onCancelConfirmationDialogAfterClose: function(oEvent) {
          var oView = this.getView(),
            oCancellationModel = oView.getModel('cancellationItems');
          oCancellationModel.setData([]);
          oCancellationModel.refresh(true);
        },

        /**
         * Returns an object containing payloads for activity and quantity cancellations.
         *
         * @param {string} sCancelationText - The payload for activity confirmation cancellation.
         *
         * @returns {Object} An object containing the activity and quantity cancellation payloads.
         * @returns {Object} return.activityCancellation - The payload for activity confirmation cancellation.
         * @returns {Object} return.quantityCancellation - The payload for quantity confirmation cancellation.
         */
        createActQtyCancellationPayloads: function(sCancelationText) {
          var oView = this.getView(),
            oCancellationModel = oView.getModel('cancellationItems'),
            aCancellationData = oCancellationModel.getData(),
            oCancelActConfPayload = {},
            oCancelQtyConfPayload = {};

          for (var i = 0; i < aCancellationData.length; i++) {
            var oItem = aCancellationData[i];
            if (oItem.isActivityConfirmation) {
              oCancelActConfPayload = {
                shopOrder: this.oQuery.shopOrder,
                confirmationText: sCancelationText,
                confirmationGroup: oItem.confirmationGroup,
                txnId: oItem.transactionId,
                confirmationCounter: oItem.confirmationCounter
              };
            } else {
              oCancelQtyConfPayload = {
                transactionId: oItem.transactionId,
                shopOrder: oItem.shopOrder,
                cancellationReason: sCancelationText,
                sfc: oItem.sfc
              };
            }
          }
          return {
            activityCancellation: oCancelActConfPayload,
            quantityCancellation: oCancelQtyConfPayload
          };
        },

        onSubmitDialogPress: function() {
          let that = this;

          const oTextArea = new TextArea({
            width: '100%',
            liveChange: function(oEvent) {
              that.getView().getModel('cancelReason').setProperty('/value', oEvent.mParameters.value);
            },
            rows: 4,
            maxLength: 40,
            placeholder: this.getI18nText('cancel.confirmation.placeholder')
          });

          if (!this.oSubmitDialog) {
            this.oSubmitDialog = new Dialog({
              type: DialogType.Message,
              icon: 'sap-icon://SAP-icons-TNT/exceptions',
              state: 'Warning',
              title: this.getI18nText('cancel.confirmation.title'),
              content: [
                new Label({
                  text: this.getI18nText('cancel.confirmation.content')
                }),
                oTextArea
              ],
              beginButton: new Button({
                type: ButtonType.Emphasized,
                text: this.getI18nText('ok'),
                press: function() {
                  //TODO: Handle cancel of other confirmations
                  // const oCancelObject = this.object.getBindingContext(this.type).getObject();
                  // const sCancelationText = that.getModel('cancelReason').getProperty('/value');

                  // if (this.type === 'activityConfirmationItems') {
                  //   this.cancelActivityConfirmationItem(t, sCancelationText);
                  // } else if (this.type === 'quantityConfirmationItems') {
                  //   this.cancelQuantityConfirmationItem(t, sCancelationText);
                  // } else {
                  //   this.cancelGIGR(t, sCancelationText);
                  // }
                  const sCancelationText = this.getView().getModel('cancelReason').getProperty('/value');
                  var oPayloads = this.createActQtyCancellationPayloads(sCancelationText),
                    aPromises = [];

                  if (Object.keys(oPayloads.activityCancellation).length > 0) {
                    aPromises.push(this.cancelActivityConfirmationItem(oPayloads.activityCancellation));
                  }

                  if (Object.keys(oPayloads.quantityCancellation).length > 0) {
                    aPromises.push(this.cancelQuantityConfirmationItem(oPayloads.quantityCancellation));
                  }

                  Promise.allSettled(aPromises).then(function() {
                    console.log('All cancellations posted', ...arguments);
                    //TODO: Handle confirmation statuses
                    that.getActQtyConfirmationData();
                  });

                  this.oSubmitDialog.close();
                  oTextArea.setValue('');
                }.bind(this)
              }),
              endButton: new Button({
                text: this.getI18nText('cancel'),
                press: function() {
                  this.getView().getModel('cancelReason').setProperty('/value', '');
                  oTextArea.setValue('');
                  this.oSubmitDialog.close();
                }.bind(this)
              })
            });
          }

          this.oSubmitDialog.open();
        },

        getActQtyConfirmationData: function() {
          var aPromises = [];
          aPromises.push(this.getActivityConfirmations());
          aPromises.push(this.getQuantityConfirmationItems());

          Promise.all(aPromises).then(
            function() {
              var oView = this.getView(),
                oQtyConfModel = oView.getModel('quantityConfirmationItems'),
                aQtyConfData = oQtyConfModel.getData(),
                oActConfModel = oView.getModel('activityConfirmationItems'),
                aActConfData = oActConfModel.getData();

              var aConfData = [];
              aConfData = aConfData.concat(aQtyConfData);

              for (var i = 0; i < aActConfData.length; i++) {
                aConfData.push({
                  operationActivity: aActConfData[i].operationActivity,
                  operationActivityDescription: aActConfData[i].description,
                  confirmationGroup: aActConfData[i].confirmationGroup,
                  confirmationCounter: aActConfData[i].confirmationCounter,
                  parameters: aActConfData[i].parameters,
                  postedBy: aActConfData[i].postedBy,
                  createdOn: aActConfData[i].createdOn,
                  cancellationReason: aActConfData[i].cancelReason,
                  status: aActConfData[i].status,
                  shopOrder: this.oQuery.shopOrder,
                  transactionId: aActConfData[i].transactionId,
                  isActivityConfirmation: true
                });
              }

              console.log(aConfData);
              var oConfModel = this.getView().getModel('confirmationItems');
              oConfModel.setData(aConfData);
            }.bind(this)
          );
        },

        getActivityConfirmations: function() {
          var that = this;
          return that
            .getActivityConfirmationItems()
            .then(function(oResponse) {
              let aData = [];
              var oActConfItemsModel = that.getView().getModel('activityConfirmationItems');
              if (that.activityConfirmationPageNo === 0) {
                aData = oResponse.content;
              } else {
                aData = oActConfItemsModel.getData().concat(oResponse.content);
              }
              that.cancel = false;
              that.activityConfirmationPageNo++;
              return that.getActivityConfirmationOperations(aData, oActConfItemsModel, oResponse.totalElements);
            })
            .then(function(aData) {
              var oActConfItemsModel = that.getView().getModel('activityConfirmationItems');
              oActConfItemsModel.setData(aData);
            });
        },

        getOrderDetail: function(sShopOrder) {
          const sPlant = PlantSettings.getCurrentPlant();
          const sUrl = this.getDemandRestDataSourceUri() + 'v1/orders?order=' + sShopOrder + '&plant=' + sPlant;

          this.ajaxGetRequest(
            sUrl,
            null,
            function(oResponse) {
              this.getView().getModel('viewModel').setProperty('/order', oResponse);
              this.getActQtyConfirmationData();
            }.bind(this),
            this._requestFailure.bind(this)
          );
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

          return new Promise(
            function(resolve, reject) {
              this.ajaxGetRequest(
                sUrl,
                null,
                function(oResponse) {
                  resolve(oResponse);
                }.bind(this),
                function() {
                  this._requestFailure(...arguments);
                  reject();
                }.bind(this)
              );
            }.bind(this)
          );
        },

        getActivityConfirmationOperations: function(aData, oModel) {
          var that = this;
          return new Promise(function(resolve, reject) {
            if (aData.length < 1) {
              resolve(aData);
            }

            //Create activities string
            var aActivityList = [];
            for (var i = 0; i < aData.length; i++) {
              aActivityList.push(aData[i].operationActivity);
            }
            const sActivities = aActivityList.join(',');

            //Create URL for service call
            var sUrl =
              that.getDemandRestDataSourceUri() +
              'shopOrderConfirmations/operationDescriptions?operations=' +
              sActivities;

            that.ajaxGetRequest(
              sUrl,
              null,
              function(oResponse) {
                aData.forEach(function(t) {
                  const e = oResponse.findIndex(function(e) {
                    return e.operation == t.operationActivity;
                  });
                  t.description = oResponse[e] && oResponse[e].description;
                });
                // oModel.setData(aData);
                resolve(aData);
              },
              function() {
                that._requestFailure(...arguments);
                reject();
              }
            );
          });
        },

        getQuantityConfirmationItems: function() {
          if (this.quantityConfirmationPageNo === 0) {
            this.byId('idConfirmationsTable').setBusyIndicatorDelay(0);
            this.byId('idConfirmationsTable').setBusy(true);
          }

          let sUrl =
            this.getSfcExecutionDataSourceUri() +
            'quantityConfirmation/detailsForCancellation?sfc=' +
            this.oQuery.sfc +
            '&page=' +
            this.quantityConfirmationPageNo +
            '&size=20';

          if (this.sQuery) {
            sUrl = sUrl + '&fuzzySearch=' + encodeURIComponent(this.sQuery);
          }

          return new Promise(
            function(resolve, reject) {
              this.ajaxGetRequest(
                sUrl,
                null,
                function() {
                  this._readQuantityConfirmationItemsSuccess(...arguments);
                  resolve();
                }.bind(this),
                function() {
                  this._requestFailure(...arguments);
                  reject();
                }.bind(this)
              );
            }.bind(this)
          );
        },

        _readQuantityConfirmationItemsSuccess: function(oResponse) {
          if (oResponse) {
            this.getView()
              .getModel('data')
              .setProperty('/quantityConfirmationTitle', this.getI18nText('postingTitle', [oResponse.totalElements]));

            const oQtyConfModel = this.getView().getModel('quantityConfirmationItems');

            if (this.quantityConfirmationPageNo === 0) {
              oQtyConfModel.setData(oResponse.content);
            } else {
              oQtyConfModel.setData(oQtyConfModel.getData().concat(oResponse.content));
            }

            this.cancel = false;
            this.quantityConfirmationPageNo++;

            // this.setTableGrowingTrigger(
            //   this.byId('quantityConfirmationTable'),
            //   'quantityConfirmationItems',
            //   oResponse.totalElements
            // );
          }

          this.byId('idConfirmationsTable').setBusy(false);
          this.byId('headerRefresh').setEnabled(true);
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

        /**
         * Cancels an activity confirmation item by sending a cancellation request to the server.
         *
         * @param {Object} oPayload                     - The payload containing details required for cancellation.
         * @param {string} oPayload.confirmationGroup   - The group identifier of the activity confirmation.
         * @param {string} oPayload.confirmationCounter - The counter for the confirmation.
         * @param {string} oPayload.txnId               - The transaction ID of the activity confirmation.
         * @param {string} oPayload.shopOrder           - The shop order associated with the activity confirmation.
         * @param {string} oPayload.confirmationText    - The cancel reason of the confirmation to be canceled.
         *
         * @returns {Promise} A promise that resolves on successful cancellation or rejects on failure.
         * @resolves {*} Response data from the server on success.
         * @rejects {*} Error data from the server on failure.
         */
        cancelActivityConfirmationItem: function(oPayload) {
          this.cancel = true;

          let sUrl = this.getActivityConfirmationRestDataSourceUri() + 'activityconfirmation/cancel';
          return new Promise(
            function(resolve, reject) {
              this.ajaxPostRequest(
                sUrl,
                oPayload,
                function() {
                  MessageToast.show(this.getI18nText('orderConformationSucess'));
                  resolve(...arguments);
                }.bind(this),
                function() {
                  this._requestFailure(...arguments);
                  reject(...arguments);
                }.bind(this)
              );
            }.bind(this)
          );
        },

        /**
         * Cancels a quantity confirmation item by sending a cancellation request to the server.
         *
         * @param {Object} oPayload                     - The payload containing details required for cancellation.
         * @param {string} oPayload.transactionId       - The transaction ID of the quantity confirmation.
         * @param {string} oPayload.shopOrder           - The shop order associated with the quantity confirmation.
         * @param {string} oPayload.sfc                 - The shop floor control identifier related to the confirmation.
         * @param {string} oPayload.cancellationReason  - The reason for the cancellation.
         *
         * @returns {Promise} A promise that resolves on successful cancellation or rejects on failure.
         * @resolves {*} Response data from the server on success.
         * @rejects {*} Error data from the server on failure.
         */
        cancelQuantityConfirmationItem: function(oPayload) {
          this.cancel = true;

          const sUrl = this.getSfcExecutionDataSourceUri() + 'quantityConfirmation/cancel';
          return new Promise(
            function(resolve, reject) {
              this.ajaxPostRequest(
                sUrl,
                oPayload,
                function() {
                  MessageToast.show(this.getI18nText('orderConformationSucess'));
                  resolve(...arguments);
                }.bind(this),
                function() {
                  this._requestFailure(...arguments);
                  reject(...arguments);
                }.bind(this)
              );
            }.bind(this)
          );
        },

        resetTableModels: function(sModelName) {
          if (sModelName) {
            this.getView().setModel(new JSONModel([]), sModelName);
          } else {
            this.getView().setModel(new JSONModel([]), 'goodsIssueItems');
            this.getView().setModel(new JSONModel([]), 'FINISH_GOOD');
            this.getView().setModel(new JSONModel([]), 'CO_PRODUCT');
            this.getView().setModel(new JSONModel([]), 'BY_PRODUCT');
          }
        },

        goOrders: function(t, e) {
          this.getOwnerComponent().displayTarget('MasterList');
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
