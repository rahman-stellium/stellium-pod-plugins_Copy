sap.ui.define(
  [
    'sap/ui/model/json/JSONModel',
    'sap/dm/dme/podfoundation/controller/PluginViewController',
    "sap/dm/dme/formatter/DateTimeUtils",
    'sap/base/Log',
    'sap/m/MessageToast',
    'sap/ui/core/Fragment',
    'sap/ui/core/format/DateFormat',
    'sap/ui/model/Sorter',
    './../utils/formatter',
    './../utils/ErrorHandler',
    "./../utils/ReasonCodeDialog",
  ],
  function(JSONModel, PluginViewController, DateTimeUtils, Log, MessageToast, Fragment, DateFormat, Sorter, Formatter, ErrorHandler, ReasonCodeDialogUtil) {
    'use strict';

    var oLogger = Log.getLogger('confirmationPlugin', Log.Level.INFO);

    var oPluginViewController = PluginViewController.extend(
      'stellium.ext.podplugins.confirmationPlugin.controller.PluginView',
      {
        metadata: {
          properties: {}
        },

        oFormatter: Formatter,
        DateTimeUtils: DateTimeUtils,
        ReasonCodeDialogUtil: ReasonCodeDialogUtil,

        reasonCodeData: {
          timeElementReasonCodeTree: []
        },

        onInit: function() {
          if (PluginViewController.prototype.onInit) {
            PluginViewController.prototype.onInit.apply(this, arguments);
          }

          this.postData = {
            shopOrder: '',
            batchId: '',
            phase: '',
            workCenter: '',
            yieldQuantity: {
              value: '',
              unitOfMeasure: {
                uom: '',
                shortText: '',
                longText: ''
              }
            },
            scrapQuantity: {
              value: '',
              unitOfMeasure: {
                uom: '',
                shortText: '',
                longText: ''
              }
            },
            userId: '',
            dateTime: '',
            batchNumber: '',
            storageLocation: '',
            finalConfirmation: false
          };

          this.page = 0;
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
          this._mViewSettingsDialogs = {};
          TablePersonalizeService.getPersData();
          TablePersonalizeService.setPersData({});

          var oQuantityPostModel = new JSONModel(this.postData);
          this.getView().setModel(oQuantityPostModel, 'postModel');
          this.getView().setModel(new JSONModel([]), 'viewQuantityReportModel');
          this.getView().setModel(
            new JSONModel({ value: this.getI18nText('reportQuantities', [0]) }),
            'reportQuantitiesTitle'
          );
          this.getView().setModel(new JSONModel({ customFieldVisible: false }), 'data');
          this.getView().setModel(new JSONModel({ value: [] }), 'quantitiesModel');

          this.prepareBusyDialog();
        },

        /**
         * @see PluginViewController.onBeforeRenderingPlugin()
         */
        onBeforeRenderingPlugin: function() {
          this.subscribe('phaseSelectionEvent', this.getQuantityConfirmationData, this);
          this.subscribe('plantChan')
          this.publish('requestForPhaseData', this);
          this.podType = this.getPodSelectionModel().getPodType();
          //Work Center POD event for Prodcuction Order
          if (this.getPodSelectionModel().getPodType() === 'WORK_CENTER') {
            this.subscribe('OperationListSelectEvent', this.onOperationSelected, this);
            this.publish('phaseSelectionEventWIList', this);
          }
          //Order POD event for Process Order
          if (this.getPodSelectionModel().getPodType() === 'ORDER') {
            this.subscribe('phaseSelectionEvent', this.onPhaseSelected, this);
            this.publish('requestForPhaseData', this);
          }
        },

        onExit: function() {},

        onBeforeRendering: function() {},

        onAfterRendering: function() {},

        prepareBusyDialog: function() {
          if (!this.busyDialog) {
            sap.ui.require(
              ['sap/m/BusyDialog'],
              function(BusyDialog) {
                this.busyDialog = new BusyDialog('busyDialogForReasonCode');
              }.bind(this)
            );
          }
        },

        onPhaseSelected: function(sChannelId, sEventId, oData) {
          this.page = 0;
          this.resource = oData.resource.resource;
        },

        handleSettingsButtonPressed: function() {
          this._oTableSettings.openDialog();
        },

        handleSortButtonPressed: function() {
          this.createViewSettingsDialog('stellium.ext.podplugins.confirmationPlugin.view.fragments.SortDialog').open();
        },

        onSortDialogConfirmButtonClicked: function(oEvent) {
          let oTable = this.byId('postingsTable'),
            mParams = oEvent.getParameters(),
            oBinding = oTable.getBinding('items'),
            sPath,
            bDescending,
            aSorters = [];

          sPath = mParams.sortItem.getKey();
          bDescending = mParams.sortDescending;
          aSorters.push(new Sorter(sPath, bDescending));

          // apply the selected sort and group settings
          oBinding.sort(aSorters);
        },

        createViewSettingsDialog: function(sDialogFragmentName) {
          let oDialog = this._mViewSettingsDialogs[sDialogFragmentName];

          if (!oDialog) {
            oDialog = sap.ui.xmlfragment(sDialogFragmentName, this);
            this._mViewSettingsDialogs[sDialogFragmentName] = oDialog;
          }
          this.getView().addDependent(oDialog);
          return oDialog;
        },

        onOperationSelected: function(sChannelId, sEventId, oData) {
          this.page = 0;
          this.resource = oData.resource.resource;
        },

        getQuantityConfirmationData: function(sChannelId, sEventId, oData) {
          var oPodSelectionModel = this.getPodSelectionModel();
          this.plant = this.getPodController().getUserPlant();
          this.resource = oPodSelectionModel.workCenter;

          if (!oPodSelectionModel || !oPodSelectionModel.timeZoneId) {
            // this.createMessage('missingInformation', MessageType.Error);
            return false;
          }

          this.plantTimeZoneId = oPodSelectionModel.timeZoneId;

          this.selectedOrderData = oData;
          this.getQuantityConfirmationSummary(this.selectedOrderData);
        },

        getQuantityConfirmationSummary: function(oData) {
          var productionUrl = this.getProductionDataSourceUri();
          var oParameters = {};
          oParameters.shopOrder = oData.selectedShopOrder;
          oParameters.batchId = oData.selectedSfc;
          if (oData.orderSelectionType === 'PROCESS') {
            oParameters.phase = oData.phaseId;
          } else if (oData.orderSelectionType === 'PRODUCTION') {
            oParameters.phase = oData.operation.operation;
          }
          this.oParameters = oParameters;
          this.onOpenViewQuantityReportDialog(true);
          var sUrl = productionUrl + 'quantityConfirmation/summary';
          this.postFetchQuantityConfirmationData(sUrl, oParameters);
        },

        postFetchQuantityConfirmationData: function(sUrl, oParameters) {
          var that = this;
          var userAuthFlag = this.selectedOrderData.userAuthorizedForWorkCenter;
          var status = this.selectedOrderData.status;

          var oTable = that.byId('quantityConfirmationTable');

          //Set table busy indicators
          // that.byId('quantityConfirmationTable') &&
          //     that.byId('quantityConfirmationTable').setBusyIndicatorDelay(0);
          // that.byId('quantityConfirmationTable') && that.byId('quantityConfirmationTable').setBusy(true);

          if (oTable) {
            oTable.setBusyIndicatorDelay(0);
            oTable.setBusy(true);
          }

          that.ajaxGetRequest(
            sUrl,
            oParameters,
            function(oResponseData) {
              // adding user work center authorization flag to response
              oResponseData.userAuthorizedForWorkCenter =
                userAuthFlag !== null && userAuthFlag !== undefined ? userAuthFlag : false;
              oResponseData.status = status;
              that.quantityConfirmationList = oResponseData;
              var temp = [];
              temp.push(that.quantityConfirmationList);
              var quantityConfirmationOverviewModel = new JSONModel();
              quantityConfirmationOverviewModel.setData(temp);
              that.getView().getModel('quantitiesModel').setProperty('/value', temp);

              // that.byId('quantityConfirmationTable') &&
              //     that.byId('quantityConfirmationTable').setModel(quantityConfirmationOverviewModel);
              // that.byId('quantityConfirmationTable') &&
              //     that.byId('quantityConfirmationTable').setBusy(false);

              if (oTable) {
                oTable.setModel(quantityConfirmationOverviewModel);
                oTable.setBusy(false);
              }
            },
            function(oError, oHttpErrorMessage) {
              var err = oError ? oError : oHttpErrorMessage;
              that.showErrorMessage(err, true, true);
              that.quantityConfirmationList = {};
              that.byId('quantityConfirmationTable').setBusy(false);
            }
          );
        },

        onOpenReportQuantityDialog: function(oEvent) {
          var oView = this.getView(),
            oPostModel = oView.getModel('postModel'),
            oData = oEvent.getSource().getBindingContext('quantitiesModel').getObject();

          this.callServiceForTimeElementDesc();

          oPostModel.setProperty('/reasonCodeKey', '');
          oPostModel.setProperty('/description', '');
          oPostModel.setProperty('/reasonCode', '');

          this.postData.yieldQuantity.value = '';
          this.postData.scrapQuantity.value = '';
          this.postData.customFieldData = '';

          var selectedOrder = oData.shopOrder;
          var selectedPhase =
            this.selectedOrderData.orderSelectionType === 'PROCESS'
              ? oData.phase
              : this.selectedOrderData.operation.operation;
          var selectedBatchID = oData.batchId;
          var selectedUom = oData.totalScrapQuantity.unitOfMeasure.uom;
          var isBatchManaged = oData.batchManaged === undefined || oData.batchManaged === 'NONE' ? false : true;
          var loggedInUser = this.getGlobalProperty('loggedInUserDetails')
            ? this.getGlobalProperty('loggedInUserDetails').userId
            : '';

          // erpAutoGR
          var erpAutoGr = false;
          var stepId = this.selectedOrderData.stepId;
          if (this.selectedOrderData.recipeArray && this.selectedOrderData.recipeArray.length) {
            this.selectedOrderData.recipeArray.some(function(recipe) {
              if (recipe.stepId == stepId) {
                if (recipe.recipeOperation) {
                  erpAutoGr = recipe.recipeOperation.erpAutoGr;
                } else {
                  erpAutoGr = recipe.routingOperation && recipe.routingOperation.erpAutoGr;
                }
              }
              return recipe.stepId == stepId;
            });
          }
          this.phaseErpAutoGr = erpAutoGr;

          // UOM Model
          this.selectedMaterial = oData.material;
          var selectedMaterialVersion = oData.version;
          var that = this;
          that.getView().setBusy(true);
          var surl = this.getProductRestDataSourceUri() + 'materials/uoms';
          var oParameters = {};
          oParameters.material = this.selectedMaterial;
          oParameters.version = selectedMaterialVersion;

          this.ajaxGetRequest(
            surl,
            oParameters,
            function(unitData) {
              sap.ui.getCore().getMessageManager().removeAllMessages();
              var unitList = unitData.map(function(unit) {
                return {
                  value: unit.uom,
                  internalUom: unit.internalUom,
                  text: unit.shortText
                };
              });
              that.unitList = unitList;
              that.getView().setModel(new JSONModel(unitList), 'unitModel');
              that.getView().setBusy(false);
            },
            function(oError, sHttpErrorMessage) {
              that.getView().setBusy(false);
            }
          );

          // Set the default values
          oPostModel.setProperty('/phase', selectedPhase);
          oPostModel.setProperty('/yieldQuantity/unitOfMeasure/uom', selectedUom);
          oPostModel.setProperty('/scrapQuantity/unitOfMeasure/uom', selectedUom);
          oPostModel.setProperty('/shopOrder', selectedOrder);
          oPostModel.setProperty('/batchId', selectedBatchID);
          oPostModel.setProperty('/userId', loggedInUser);
          oPostModel.setProperty('/workCenter', this.selectedOrderData.workCenter.workcenter);
          oPostModel.refresh();

          if (!this.byId('reportQuantityDialog')) {
            Fragment.load({
              id: oView.getId(),
              name: 'stellium.ext.podplugins.confirmationPlugin.view.fragments.ReportQuantity',
              controller: this
            }).then(
              function(oDialog) {
                oDialog.setEscapeHandler(
                  function(oPromise) {
                    this.onCloseReportQuantityDialog();
                    oPromise.resolve();
                  }.bind(this)
                );
                oView.addDependent(oDialog);
                oDialog.open();
                this.byId('postingDate').setValue(this.getCurrentDateInPlantTimeZone());
                if (this.phaseErpAutoGr) {
                  if (isBatchManaged) {
                    this.byId('batchNumberFilter').setVisible(true);
                  } else {
                    this.byId('batchNumberFilter').setVisible(false);
                  }
                  this.byId('storageLocationFilter').setVisible(true);
                } else {
                  this.byId('batchNumberFilter').setVisible(false);
                  this.byId('storageLocationFilter').setVisible(false);
                }

                if (this.oPluginConfiguration && this.oPluginConfiguration.customField1) {
                  this.byId('customField1').setVisible(true);
                  var customFieldLabel1 = this.oPluginConfiguration.customField1;
                  oView.setModel(new JSONModel({ labelValue: customFieldLabel1 }), 'customFieldLabelModel');
                } else {
                  this.byId('customField1').setVisible(false);
                }
              }.bind(this)
            );
          } else {
            this.byId('reportQuantityDialog').open();
            this.byId('postingDate').setValue(this.getCurrentDateInPlantTimeZone());
            this.byId('finalConfirmation').setSelected(false);
            if (this.phaseErpAutoGr) {
              if (isBatchManaged) {
                this.byId('batchNumberFilter').setVisible(true);
              } else {
                this.byId('batchNumberFilter').setVisible(false);
              }
              this.byId('storageLocationFilter').setVisible(true);
            } else {
              this.byId('batchNumberFilter').setVisible(false);
              this.byId('storageLocationFilter').setVisible(false);
            }
          }
          sap.ui.getCore().getMessageManager().removeAllMessages();
        },

        onOpenViewQuantityReportDialog: function(init) {
          var oParameters = {};
          oParameters.shopOrder = this.oParameters.shopOrder;
          oParameters.batchId = this.oParameters.batchId;
          oParameters.phase = this.oParameters.phase;
          oParameters.size = 20;
          oParameters.page = init ? 0 : this.page;
          if (this.oPluginConfiguration && this.oPluginConfiguration.customField1) {
            this.getView().getModel('data').setProperty('/customFieldVisible', true);
            this.getView().setModel(
              new JSONModel({ labelValue: this.oPluginConfiguration.customField1 }),
              'customFieldLabelModel'
            );
          } else {
            this.getView().setModel(
              new JSONModel({ labelValue: this.getI18nText('customField') }),
              'customFieldLabelModel'
            );
            this.getView().getModel('data').setProperty('/customFieldVisible', false);
          }

          var productionUrl = this.getProductionDataSourceUri();
          var sUrl = productionUrl + 'quantityConfirmation/v2/details';
          this.postFetchReportedQuantityConfirmationData(sUrl, oParameters, init);
        },

        postFetchReportedQuantityConfirmationData: function(sUrl, oParameters, init) {
          var that = this;
          var oView = this.getView();
          that.byId('postingsTable').setBusyIndicatorDelay(0);
          that.byId('postingsTable').setBusy(true);
          this.ajaxGetRequest(
            sUrl,
            oParameters,
            function(oResponseData) {
              let oList = oResponseData.details.content;
              for (var i = 0; i < oList.length; i++) {
                // date time is in UTC
                oList[i].dateTime = moment.tz(oList[i].dateTime, 'UTC');
                var reasonCodes = oList[i].reasonCodes;
                const aJson = JSON.parse(oList[i].customFieldData);
                oList[i].customField = aJson && aJson[0].value;
                oList[i].selectReasonCode =
                  reasonCodes && reasonCodes.length > 0 ? reasonCodes[reasonCodes.length - 1] : '';
              }
              let iTotalCount = oResponseData.details.totalElements;
              that
                .getView()
                .setModel(
                  new JSONModel({ value: that.getI18nText('reportQuantities', [iTotalCount]) }),
                  'reportQuantitiesTitle'
                );
              that.reportedQuantityConfirmationList = oList;
              const tableModel = that.getView().getModel('viewQuantityReportModel');
              let iCurrItemCount = tableModel.getData().length;
              if (iCurrItemCount === 0 || init) {
                tableModel.setData(that.reportedQuantityConfirmationList);
              } else {
                tableModel.setData(tableModel.getData().concat(that.reportedQuantityConfirmationList));
              }
              // var viewQuantityReportModel = new JSONModel(that.reportedQuantityConfirmationList);
              // that.getView().setModel(viewQuantityReportModel, "viewQuantityReportModel");
              that._oTable = that.byId('postingsTable');
              let iCurrCount = tableModel.getData().length;
              if (iCurrCount === +iTotalCount) {
                that._oTable.getBindingInfo('items').binding.isLengthFinal = function() {
                  return true;
                };
                that._oTable.setGrowingTriggerText('');
              } else {
                that._oTable.getBindingInfo('items').binding.isLengthFinal = function() {
                  return false;
                };
                let sGrowingTriggerText = that.getI18nText('eventTable.growingTriggerText', [iCurrCount, iTotalCount]);
                that._oTable.setGrowingTriggerText(sGrowingTriggerText);
              }
              that.byId('postingsTable').setBusy(false);
              that.getView().setBusy(false);
            },
            function(oError, oHttpErrorMessage) {
              var err = oError ? oError : oHttpErrorMessage;
              that.showErrorMessage(err, true, true);
              that.quantityConfirmationList = {};
              that.getView().setBusy(false);
              that.byId('postingsTable').setBusy(false);
            }
          );
        },

        onCloseQuantityReportDialog: function() {
          var oTable = this.getView().byId('ViewQuantityReportTable');
          var oDetialsColumnItem = this.getView().byId('QuantityDetailsCLItem');
          var oTableLength = oTable.getColumns().length;
          var oDetialsColumnItemLength = oDetialsColumnItem.getCells().length;
          for (var i = oTableLength; i > 8; i--) {
            oTable.removeColumn(oTable.getColumns()[i - 1]);
          }
          for (var j = oDetialsColumnItemLength; j > 8; j--) {
            oDetialsColumnItem.removeCell(oDetialsColumnItem.getCells()[j - 1]);
          }
          this.getView().byId('ViewQuantityReportDialog').close();
        },

        handleReasonCode: function() {
          var that = this;

          //Load the fragment
          if (this.selectReasonCodeDialog === undefined) {
            this.selectReasonCodeDialog = sap.ui.xmlfragment(
              'selectReasonCodeDialog',
              'stellium.ext.podplugins.confirmationPlugin.view.fragments.SelectReasonCodeDialog',
              this
            );
            this.getView().addDependent(this.selectReasonCodeDialog);
          }

          this.selectReasonCodeDialog.open();

          setTimeout(function() {
            that.prepareReasonCodeTable();
            var dialogForSelectCode = sap.ui
              .getCore()
              .byId(sap.ui.core.Fragment.createId('selectReasonCodeDialog', 'dialogForSelectCode'));
            dialogForSelectCode.setBusy(false);
          }, 3000);
        },
        handleSearchForReasonCodeDialog: function(oEvent) {
          var properties = ['ID', 'description', 'reasonForVariance'];
          var oValue = oEvent.getSource().getValue();
          var resourceList = sap.ui
            .getCore()
            .byId(sap.ui.core.Fragment.createId('selectReasonCodeDialog', 'reasonCodeTreeTable'))
            .getBinding('rows');

          this.handleSearch(oValue, properties, resourceList);
        },
        handleSearchForReasonCodeUpdateDialog: function(oEvent) {
          let oValue = oEvent.getSource().getValue();
          let reasonCodeTable = this.updateReasonCodeDialog.getContent()[0];
          if (!oValue) {
            reasonCodeTable.getModel('oReasonCodeModel').setData(this.allList);
          } else {
            let list = this.matchTreeData(this.allList.timeElementReasonCodeTree, oValue);
            reasonCodeTable.getModel('oReasonCodeModel').setData({
              timeElementReasonCodeTree: list
            });
            reasonCodeTable.expandToLevel(10);
          }
        },
        handleSearchForReasonCodeSearch: function(oEvent) {
          var clearButtonPressed = oEvent.getParameters('clearButtonPressed');
          if (clearButtonPressed) {
            var oView = this.getView();
            oView.getModel('postModel').setProperty('/reasonCodeKey', '');
            oView.getModel('postModel').setProperty('/description', '');
            oView.getModel('postModel').setProperty('/reasonCode', '');
            oEvent.getSource().setValue('');
            oView.getModel('postModel').refresh();
          }
        },
        prepareReasonCodeTable: function() {
          var oReasonCodeModel, reasonCodeTable;

          if (this.listOfTimeElementAndDesc) {
            this.getReasonCodesForTimeElement();
            this.prepareDataForBinding(this.listOfTimeElementAndDesc);
            if (oReasonCodeModel === undefined) {
              oReasonCodeModel = new JSONModel(this.reasonCodeData);
              reasonCodeTable = sap.ui
                .getCore()
                .byId(sap.ui.core.Fragment.createId('selectReasonCodeDialog', 'reasonCodeTreeTable'));
              reasonCodeTable.setModel(oReasonCodeModel, 'oReasonCodeModel');
              if (this.reasonTree.length > 0) {
                var arr = [];
                var that = this;
                for (var index = 0; index < this.reasonTree.length; index++) {
                  this.path = [];
                  this.assignedCodeSelectionLoop(this.reasonTree[index].resourceReasonCodeNodeCollection);
                  var aData = this.path;
                  for (var j = 0; j < aData.length; j++) {
                    this.child = [];
                    var elem = aData[j];
                    var code = this.appendReasonCode(elem);
                    this.getReasonCodesForChild(elem.timeElement.ref, code);
                    aData[j] = this.child[0];
                  }
                  aData.typeOfData = 'reasonCodeObject';
                  var reasonCodeNestedObject = this.transformData(aData);
                  // parent.timeElementReasonCodeTree = reasonCodeNestedObject;
                  arr = arr.concat(reasonCodeNestedObject);
                }
                reasonCodeTable = sap.ui
                  .getCore()
                  .byId(sap.ui.core.Fragment.createId('selectReasonCodeDialog', 'reasonCodeTreeTable'));
                oReasonCodeModel.setData({
                  timeElementReasonCodeTree: arr
                });
                reasonCodeTable.getModel('oReasonCodeModel').checkUpdate();
              } else {
                for (var index = 0; index < this.reasonCodeData.timeElementReasonCodeTree.length; index++) {
                  var element = this.reasonCodeData.timeElementReasonCodeTree[index];
                  this.getReasonCodesForTimeElementForNotSource(element);
                }
              }

              this.allList = reasonCodeTable.getModel('oReasonCodeModel').getData();
              reasonCodeTable.getModel('oReasonCodeModel').checkUpdate();
            }
          }
        },
        appendReasonCode: function(elem) {
          this.rCodeString = '';
          for (var i = 0; i < 8; i++) {
            var rCode = elem['reasonCode' + (i + 1)];
            if (rCode) {
              this.rCodeString += '&reasonCode' + (i + 1) + '=' + rCode;
            }
          }
          return this.rCodeString;
        },
        assignedCodeSelectionLoop: function(obj) {
          for (var k in obj) {
            if (obj[k].description != null) {
              this.path.push(obj[k]);
            } else {
              this.assignedCodeSelectionLoop(obj[k].resourceReasonCodeNodeCollection);
            }
          }
        },

        transformData: function(dataObject) {
          var transformedDataObject, oIndex;
          var transformedArray = [];
          this.leafs = [];
          if (dataObject) {
            for (oIndex = 0; oIndex < dataObject.length; oIndex++) {
              transformedDataObject = {};
              if (dataObject[oIndex].ref) {
                if (dataObject.typeOfData === 'timeElementObject') {
                  transformedDataObject.description = dataObject[oIndex].description;
                  transformedDataObject.typeOfElement = 'timeElement';
                  transformedDataObject.timeElementHandle = dataObject[oIndex].ref;
                  transformedDataObject.timeElementReasonCodeTree = [{}];
                } else if (dataObject.typeOfData === 'reasonCodeObject') {
                  transformedDataObject.ID = this.getReasonCodeID(dataObject[oIndex]);
                  transformedDataObject.level = dataObject[oIndex].level;
                  transformedDataObject.description = dataObject[oIndex].description;
                  transformedDataObject.typeOfElement = 'reasonCode';
                  transformedDataObject.reasonForVariance = dataObject[oIndex].reasonForVariance;
                  transformedDataObject.timeElementHandle = dataObject[oIndex].timeElementRef;
                  transformedDataObject.reasonCodeHandle = dataObject[oIndex].ref;
                  this.getReasonCodeObject(dataObject[oIndex], transformedDataObject);
                  // if (!transformedDataObject.timeElementReasonCodeTree) {
                  //   this.leafs.push(transformedDataObject);
                  // }
                }
              }
              if (!jQuery.isEmptyObject(transformedDataObject)) {
                transformedArray.push(transformedDataObject);
              }
            }
            return transformedArray;
          }
        },
        getReasonCodeObject: function(object, transformedDataObject) {
          var nestedReasonCodeObject;
          if (object.resourceReasonCodeNodeCollection.length > 0) {
            nestedReasonCodeObject = this.getNestedReasonCodeObject(object.resourceReasonCodeNodeCollection);
            transformedDataObject.timeElementReasonCodeTree = nestedReasonCodeObject;
          }
          return transformedDataObject;
        },

        getReasonCodeID: function(reasonCodeObject) {
          var stringBuilder, oIndex;
          if (reasonCodeObject) {
            for (oIndex = 10; oIndex > 0; oIndex--) {
              stringBuilder = 'reasonCode' + oIndex;
              if (reasonCodeObject[stringBuilder]) {
                reasonCodeObject.level = oIndex;
                return reasonCodeObject[stringBuilder];
              }
            }
          }
        },

        getNestedReasonCodeObject: function(reasonCodeNestedObject) {
          var transformedNestedArray = [];
          if (reasonCodeNestedObject) {
            reasonCodeNestedObject.typeOfData = 'reasonCodeObject';
            transformedNestedArray = this.transformData(reasonCodeNestedObject);
          }
          return transformedNestedArray;
        },

        getReasonCodesForTimeElement: function() {
          var reasonCodeNestedObject, oUrl, reasonCodeTable;
          oUrl =
            this.getPlantRestDataSourceUri() +
            'reasonCodeAssignment/assignedReasonCodes?resource.resource=' +
            this.resource +
            '&timeElementTypeId.ref=TimeElementTypeBO:' +
            this.plant +
            ',QUAL_LOSS';
          $.ajaxSettings.async = false;
          this.ajaxGetRequest(
            oUrl,
            null,
            function(oData) {
              this.reasonTree = oData.resourceReasonCodeNodeCollection;
            }.bind(this),
            function(errorObject) {
              this.errorHandler(errorObject);
            }.bind(this)
          );
          $.ajaxSettings.async = true;
        },
        getReasonCodesForChild: function(ref, code) {
          var reasonCodeNestedObject, oUrl, reasonCodeTable;
          oUrl = this.getPlantRestDataSourceUri() + 'resourceReasonCodes?timeElement.ref=' + ref + code;
          $.ajaxSettings.async = false;
          this.ajaxGetRequest(
            oUrl,
            null,
            function(oData) {
              this.child = oData;
            }.bind(this),
            function(errorObject) {
              this.errorHandler(errorObject);
            }.bind(this)
          );
          $.ajaxSettings.async = true;
        },
        getReasonCodesForTimeElementForNotSource: function(inputObject) {
          var reasonCodeNestedObject, oUrl, reasonCodeTable;
          oUrl =
            this.getPlantRestDataSourceUri() +
            'resourceReasonCodes?timeElement.ref=' +
            jQuery.sap.encodeURL(inputObject.timeElementHandle);
          $.ajaxSettings.async = false;
          this.ajaxGetRequest(
            oUrl,
            null,
            function(oData) {
              oData.typeOfData = 'reasonCodeObject';
              reasonCodeNestedObject = this.transformData(oData);
              inputObject.timeElementReasonCodeTree = reasonCodeNestedObject;
              reasonCodeTable = sap.ui
                .getCore()
                .byId(sap.ui.core.Fragment.createId('selectReasonCodeDialog', 'reasonCodeTreeTable'));
              reasonCodeTable.getModel('oReasonCodeModel').checkUpdate();
            }.bind(this),
            function(errorObject) {
              this.errorHandler(errorObject);
            }.bind(this)
          );
          $.ajaxSettings.async = true;
        },

        getReasonCodesForTimeElementForNotSourceForUpdate: function(inputObject, reasonCodeTable) {
          let reasonCodeNestedObject, oUrl;
          oUrl =
            this.getPlantRestDataSourceUri() +
            'resourceReasonCodes?timeElement.ref=' +
            jQuery.sap.encodeURL(inputObject.timeElementHandle);
          $.ajaxSettings.async = false;
          this.ajaxGetRequest(
            oUrl,
            null,
            function(oData) {
              oData.typeOfData = 'reasonCodeObject';
              reasonCodeNestedObject = this.transformData(oData);
              inputObject.timeElementReasonCodeTree = reasonCodeNestedObject;
              reasonCodeTable.getModel('oReasonCodeModel').checkUpdate();
            }.bind(this),
            function(errorObject) {
              this.errorHandler(errorObject);
            }.bind(this)
          );
          $.ajaxSettings.async = true;
        },

        callServiceForTimeElementDesc: function() {
          var oUrl =
            this.getPlantRestDataSourceUri() +
            'timeElements/findByType/TimeElementTypeBO:' +
            this.plant +
            ',QUAL_LOSS?status=ENABLED';
          this.busyDialog.open();
          this.ajaxGetRequest(
            oUrl,
            null,
            function(oData) {
              this.listOfTimeElementAndDesc = oData;
              this.busyDialog.close();
            }.bind(this),
            function(errorObject) {
              this.errorHandler(errorObject);
            }.bind(this)
          );
        },

        handleSearchForReasonCodeDialog: function(oEvent) {
          var properties = ['ID', 'description', 'reasonForVariance'];
          var oValue = oEvent.getSource().getValue();
          var resourceList = sap.ui
            .getCore()
            .byId(sap.ui.core.Fragment.createId('selectReasonCodeDialog', 'reasonCodeTreeTable'))
            .getBinding('rows');

          this.handleSearch(oValue, properties, resourceList);
        },

        handleSearch: function(oValue, propertiesArray, oBinding) {
          var reasonCodeTable = sap.ui
            .getCore()
            .byId(sap.ui.core.Fragment.createId('selectReasonCodeDialog', 'reasonCodeTreeTable'));

          if (!oValue) {
            reasonCodeTable.getModel('oReasonCodeModel').setData(this.allList);
          } else {
            var list = this.matchTreeData(this.allList.timeElementReasonCodeTree, oValue);
            reasonCodeTable.getModel('oReasonCodeModel').setData({
              timeElementReasonCodeTree: list
            });
            reasonCodeTable.expandToLevel(10);
          }
        },

        onSelectReasonCode: function() {
          var oTable, oPath, selectedObject, oSaveButton, oIndices;
          oTable = sap.ui
            .getCore()
            .byId(sap.ui.core.Fragment.createId('selectReasonCodeDialog', 'reasonCodeTreeTable'));
          oSaveButton = sap.ui.getCore().byId(sap.ui.core.Fragment.createId('selectReasonCodeDialog', 'saveButton'));
          oIndices = oTable.getSelectedIndices();
          if (oIndices.length >= 1) {
            jQuery.each(oIndices, function(oIndex, oObj) {
              oPath = oTable.getContextByIndex(oObj).sPath;
              selectedObject = oTable.getModel('oReasonCodeModel').getProperty(oPath);
              if (selectedObject.timeElementReasonCodeTree) {
                oSaveButton.setEnabled(false);
                return false;
              }
              oSaveButton.setEnabled(true);
            });
          } else if (oIndices.length === 0) {
            oSaveButton.setEnabled(false);
          }
        },

        matchTreeData: function(arr, searchCon) {
          var newArr = [];
          var searchNameList = ['description', 'ID', 'reasonForVariance'];
          arr.forEach(item => {
            for (var i = 0, len = searchNameList.length; i < len; i++) {
              var nameKey = searchNameList[i];
              if (item.hasOwnProperty(nameKey)) {
                if (item[nameKey] && item[nameKey].toLowerCase().indexOf(searchCon.toLowerCase()) !== -1) {
                  newArr.push(item);
                  break;
                } else {
                  if (item.timeElementReasonCodeTree && item.timeElementReasonCodeTree.length > 0) {
                    var resultArr = this.matchTreeData(item.timeElementReasonCodeTree, searchCon);
                    if (resultArr && resultArr.length > 0) {
                      item.timeElementReasonCodeTree = resultArr;
                      newArr.push(item);
                      break;
                    }
                  }
                }
              } else {
                continue;
              }
            }
          });
          return newArr;
        },

        onClickSave: function(oEvent) {
          var selectedObjects, oMinLevelSelected, oIndex;
          var reasonCodesToBeAssigned = [];
          selectedObjects = this.getSelectedObjects();
          if (selectedObjects.length > 0) {
            selectedObjects.sort(function(a, b) {
              return a.level - b.level;
            });
            oMinLevelSelected = selectedObjects[0].level;
            for (oIndex = selectedObjects.length - 1; oIndex >= 0; oIndex--) {
              if (selectedObjects[oIndex].level === oMinLevelSelected) {
                reasonCodesToBeAssigned.push(selectedObjects[oIndex]);
                selectedObjects.splice(oIndex, 1);
              }
            }

            // Remove Child Reason Codes If Parent Exists
            reasonCodesToBeAssigned = this.updateReasonCodeObject(selectedObjects, reasonCodesToBeAssigned);
            this.prepareAssignReasonCodeRequest(reasonCodesToBeAssigned, false);
          }
          if (this.selectReasonCodeDialog) {
            sap.ui
              .getCore()
              .byId(sap.ui.core.Fragment.createId('selectReasonCodeDialog', 'searchBarReasonCode'))
              .setValue('');
          }
          oEvent.getSource().getParent().close();
        },

        onClickCancel: function(oEvent) {
          // Clear Search Bar value on Reason Code Dialog - if any
          if (this.selectReasonCodeDialog) {
            sap.ui
              .getCore()
              .byId(sap.ui.core.Fragment.createId('selectReasonCodeDialog', 'searchBarReasonCode'))
              .setValue('');
          }

          if (this.uploadCSVDialog) {
            sap.ui.getCore().byId(sap.ui.core.Fragment.createId('uploadCSVDialog', 'fileUploader')).clear();
          }

          oEvent.getSource().getParent().close();
        },

        getSelectedObjects: function() {
          var oTable, oSelectedIndices, oIndex, oPath, selectedObject;
          var selectedObjects = [];
          oTable = sap.ui
            .getCore()
            .byId(sap.ui.core.Fragment.createId('selectReasonCodeDialog', 'reasonCodeTreeTable'));
          oSelectedIndices = oTable.getSelectedIndices();
          for (var i = 0; i < oSelectedIndices.length; i++) {
            oIndex = oSelectedIndices[i];
            if (oTable.isIndexSelected(oIndex)) {
              oPath = oTable.getContextByIndex(oIndex).sPath;
              selectedObject = oTable.getModel('oReasonCodeModel').getProperty(oPath);
              selectedObjects.push(selectedObject);
            }
          }
          return selectedObjects;
        },

        updateReasonCodeObject: function(objectsforComparison, finalReasonCodeObject) {
          var oIndex;
          if (objectsforComparison.length > 0) {
            for (oIndex = 0; oIndex < finalReasonCodeObject.length; oIndex++) {
              objectsforComparison = _removeChildReasonCodeIfExists(
                finalReasonCodeObject[oIndex],
                objectsforComparison
              );
            }
            finalReasonCodeObject = finalReasonCodeObject.concat(objectsforComparison);
          }
          return finalReasonCodeObject;

          function _removeChildReasonCodeIfExists(parentObject, objectsToBeParsed) {
            var counter;
            if (parentObject.timeElementReasonCodeTree) {
              for (counter = parentObject.timeElementReasonCodeTree.length - 1; counter >= 0; counter--) {
                objectsToBeParsed = _removeChildReasonCodeIfExists(
                  parentObject.timeElementReasonCodeTree[counter],
                  objectsToBeParsed
                );
                objectsToBeParsed = _removeChildReasonCodes(objectsToBeParsed, parentObject, counter);
              }
            }
            return objectsToBeParsed;
          }

          function _removeChildReasonCodes(objectsToBeParsed, parentObject, counter) {
            var oIndx;
            for (oIndx = objectsToBeParsed.length - 1; oIndx >= 0; oIndx--) {
              if (
                parentObject.timeElementReasonCodeTree[counter].reasonCodeHandle ===
                objectsToBeParsed[oIndx].reasonCodeHandle
              ) {
                objectsToBeParsed.splice(oIndx, 1);
              }
            }
            return objectsToBeParsed;
          }
        },

        prepareAssignReasonCodeRequest: function(reasonCodeToBeAssigned, machineCodeSave) {
          var reasonCodeKey = reasonCodeToBeAssigned[0].reasonCodeHandle.split(',');
          this.getView().getModel('postModel').setProperty('/reasonCodeKey', reasonCodeKey[1]);
          this.getView().getModel('postModel').setProperty('/description', reasonCodeToBeAssigned[0].description);
          this.getView().getModel('postModel').setProperty('/reasonCode', reasonCodeToBeAssigned[0].ID);
          var request = { resourceRCAssignments: [] };
          var dummyObject;
          var that = this;

          if (reasonCodeToBeAssigned.length > 0) {
            jQuery.each(reasonCodeToBeAssigned, function(oIndex, oObject) {
              dummyObject = {
                resource: {},
                resourceReasonCode: {}
              };
              dummyObject.resourceReasonCode.ref = oObject.reasonCodeHandle;
              dummyObject.resource.ref = that.selectedResourceRef;
              dummyObject.machineCode = oObject.machineCode;

              request.resourceRCAssignments.push(dummyObject);
            });
          }
        },

        prepareDataForBinding: function(data) {
          var transformedObject;
          if (data) {
            data.typeOfData = 'timeElementObject';
            transformedObject = this.transformData(data);
            this.reasonCodeData.timeElementReasonCodeTree = transformedObject;
          }
        },

        onCloseReportQuantityDialog: function() {
          this.getView().byId('reportQuantityDialog').close();

          //Reset the fields
          this._resetFields();
        },

        getCurrentDateInPlantTimeZone: function() {
          return moment().tz(this.plantTimeZoneId).format('YYYY-MM-DD');
        },

        /***
         * Reset the input fields
         */
        _resetFields: function() {
          this.byId('yieldQuantity').setValue('');
          this.byId('batchNumberFilter').setValue('');
          this.byId('storageLocationFilter').setValue('');
          this.byId('scrapQuantity').setValue('');
          this.byId('uomYield').setValue('');
          this.byId('uomScrap').setValue('');
          this.byId('postedBy').setValue('');
          this.byId('customField1').setValue('');
          this.byId('postingDate').setValue('');
          this.customFieldJson = [];

          this.byId('quantityConfirmBtn').setEnabled(false);

          ErrorHandler.clearErrorState(this.byId('yieldQuantity'));
          ErrorHandler.clearErrorState(this.byId('scrapQuantity'));
          ErrorHandler.clearErrorState(this.byId('postedBy'));
          ErrorHandler.clearErrorState(this.byId('postingDate'));
        },

        /***
         * Validation for Quantity on live change
         */
        onQuantityLiveChange: function(oEvent) {
          var oView = this.getView(),
            oPostModel = oView.getModel('postModel'),
            value = oEvent.getSource().getValue(),
            quantity;

          if (value) {
            this.getView().byId('quantityConfirmBtn').setEnabled(true);
          }
          ErrorHandler.clearErrorState(oEvent.getSource());
          if (this._endsWith(oEvent.getSource().getId(), 'yieldQuantity')) {
            quantity = oPostModel.getProperty('/yieldQuantity/value');
          } else {
            quantity = oPostModel.getProperty('/scrapQuantity/value');
          }

          if (oEvent.getSource().getId().indexOf('scrapQuantity') > -1) {
            if (oEvent.getParameters().newValue === '' || oEvent.getParameters().newValue == '0') {
              oPostModel.setProperty('/reasonCode', '');
              oPostModel.setProperty('/reasonCodeKey', '');
              oPostModel.setProperty('/description', '');
            }
          }

          if (
            Number.isNaN(quantity) ||
            (quantity && !this._validatePositiveNumber(quantity)) ||
            parseFloat(quantity) === 0
          ) {
            ErrorHandler.setErrorState(oEvent.getSource(), this.getI18nText('POSITIVE_INPUT'));
          } else {
            ErrorHandler.clearErrorState(oEvent.getSource());

            var yieldQuantityValue = oPostModel.getProperty('/yieldQuantity/value');
            var scrapQuantityValue = oPostModel.getProperty('/scrapQuantity/value');
            if (yieldQuantityValue > 0 || scrapQuantityValue > 0) {
              this._enableConfirmButton();
            }
          }
        },

        onYieldQuantityLiveChange: function(oEvent) {
          var oView = this.getView(),
            oPostModel = oView.getModel('postModel'),
            value = oEvent.getSource().getValue();

          if (Number.isNaN(value) || (value && !this._validatePositiveNumber(value)) || parseFloat(value) === 0) {
            ErrorHandler.setErrorState(oEvent.getSource(), this.getI18nText('POSITIVE_INPUT'));
          } else {
            ErrorHandler.clearErrorState(oEvent.getSource());

            //!Move below logic to _enableConfirmButton
            var yieldQuantityValue = oPostModel.getProperty('/yieldQuantity/value');
            var scrapQuantityValue = oPostModel.getProperty('/scrapQuantity/value');
            if (yieldQuantityValue > 0 || scrapQuantityValue > 0) {
              this._enableConfirmButton();
            }
          }
        },

        onChangePostingDate: function(oEvent) {
          var inputFieldId = oEvent.getSource().getId();
          var inputPostingDate = oEvent.getSource().getValue();
          ErrorHandler.clearErrorState(oEvent.getSource());
          this.getView().byId('quantityConfirmBtn').setEnabled(false);
          if (inputPostingDate > this.getCurrentDateInPlantTimeZone()) {
            ErrorHandler.setErrorState(
              sap.ui.getCore().byId(inputFieldId),
              this.getI18nText('FUTURE_DATE_NOT_ALLOWED')
            );
          } else {
            ErrorHandler.clearErrorState(oEvent.getSource());
            this._enableConfirmButton();
          }
        },

        selectUom: function(oEvent, type) {
          if (!this.byId('yieldQuantity').getValue() && !this.byId('scrapQuantity').getValue()) {
            this.byId('quantityConfirmBtn').setEnabled(false);
          } else {
            this.byId('quantityConfirmBtn').setEnabled(true);
          }
        },

        onScrapQuantityLiveChange: function(oEvent) {
          var oView = this.getView(),
            oPostModel = oView.getModel('postModel'),
            value = oEvent.getSource().getValue();

          if (Number.isNaN(value) || (value && !this._validatePositiveNumber(value)) || parseFloat(value) === 0) {
            ErrorHandler.setErrorState(oEvent.getSource(), this.getI18nText('POSITIVE_INPUT'));
          } else {
            ErrorHandler.clearErrorState(oEvent.getSource());

            //!Move below logic to _enableConfirmButton
            var yieldQuantityValue = oPostModel.getProperty('/yieldQuantity/value');
            var scrapQuantityValue = oPostModel.getProperty('/scrapQuantity/value');
            if (yieldQuantityValue > 0 || scrapQuantityValue > 0) {
              this._enableConfirmButton();
            }
          }
        },

        onConfirm: function() {
          if (ErrorHandler.hasErrors()) {
            return;
          }

          var oScrapQtyInput = this.byId('scrapQuantity'),
            oReasonCodeInput = this.byId('reasonCode');

          if (oScrapQtyInput.getValueState() == 'Error') {
            this.postData.scrapQuantity.value = '';
            return;
          }

          if (!oScrapQtyInput.getValue()) {
            this.postData.scrapQuantity.value = '';
          }

          //Check if reason code is provided in case of scrap quantity
          if (oScrapQtyInput.getValue() && !oReasonCodeInput.getValue()) {
            ErrorHandler.setErrorState(oReasonCodeInput, this.getI18nText('REASON_CODE_NOT_ASSIGNED'));
            return;
          }

          if (!this.byId('yieldQuantity').getValue()) {
            this.postData.yieldQuantity.value = '';
          }

          var that = this;
          this.postData.scrapQuantity.unitOfMeasure.uom = this.byId('uomScrap').getSelectedKey();
          this.postData.yieldQuantity.unitOfMeasure.uom = this.byId('uomYield').getSelectedKey();
          this.postData.scrapQuantity.unitOfMeasure.internalUom = this.unitList.filter(function(v) {
            return v.value === that.byId('uomScrap').getSelectedKey();
          })[0].internalUom;
          this.postData.yieldQuantity.unitOfMeasure.internalUom = this.unitList.filter(function(v) {
            return v.value === that.byId('uomYield').getSelectedKey();
          })[0].internalUom;
          if (!this.postData.yieldQuantity.value && !this.postData.scrapQuantity.value) {
            MessageBox.error(this.getI18nText('quantityRequired'));
            return false;
          }
          // Append Time
          var postedDateTime =
            this.getView().getModel('postModel').getProperty('/dateTime') + ' ' + '00' + ':' + '00' + ':' + '00';
          // convert time to UTC
          postedDateTime = new Date(moment.tz(postedDateTime, this.plantTimeZoneId).format());
          var oDateFormatFrom = DateFormat.getDateInstance({ pattern: 'yyyy-MM-dd HH:mm:ss', UTC: true });
          this.getView().getModel('postModel').setProperty('/dateTime', oDateFormatFrom.format(postedDateTime));
          var productionUrl = this.getProductionDataSourceUri();
          var sUrl = productionUrl + 'quantityConfirmation/confirm';

          if (this.postData.yieldQuantity.value == '') {
            this.postData.yieldQuantity.value = '0';
          }
          if (this.postData.scrapQuantity.value == '') {
            this.postData.scrapQuantity.value = '0';
          }
          if (this.customFieldJson && this.customFieldJson.length > 0) {
            this.postData.customFieldData = JSON.stringify(this.customFieldJson);
          }
          var quantityConfirmationModel = this.byId('quantityConfirmationTable').getModel();
          var totalYield = quantityConfirmationModel.getData()[0].totalYieldQuantity.value;
          this.postData.finalConfirmation = this.byId('finalConfirmation').getSelected();
          this.postGrData(sUrl, this.postData);
          this.onCloseReportQuantityDialog();
        },

        /***
       * Post GR data
       */
        postGrData: function(sUrl, oRequestData) {
          var that = this;
          that.byId('quantityConfirmationTable').setBusy(true);
          this.ajaxPostRequest(
            sUrl,
            oRequestData,
            function(oResponseData) {
              MessageToast.show(that.getI18nText('POSTING_SUCCESSFUL'));
              that.getQuantityConfirmationSummary(that.selectedOrderData);
              that.publish('refreshPhaseList', { stepId: that.selectedOrderData.stepId });
              that.publish('phaseStartEvent', that);
              if (that.selectedOrderData.erpAutoGRStatus) {
                that.publish('refreshOrderQtyForAutoGR', that);
              }
              if (oRequestData.finalConfirmation == true) {
                that.publish('phaseCompleteEvent', that);
              }
              that.byId('quantityConfirmationTable').setBusy(false);
            },
            function(oError, oHttpErrorMessage) {
              var err = oError ? oError : oHttpErrorMessage;
              that.showErrorMessage(err, true, true);
              that.byId('quantityConfirmationTable').setBusy(false);
            }
          );
        },

        onCloseReportQuantityDialog: function() {
          this.getView().byId('reportQuantityDialog').close();

          //Reset the fields
          this._resetFields();
        },

        onReasonCodePress: function(oEvent) {
          let source = oEvent.getSource();
          let oContext = source.getBindingContext('viewQuantityReportModel').getObject();

          let sReasonCodeRef = 'ResourceReasonCodeBO:' + this.plant + ',' + oContext.reasonCode;
          this._selectedScrapActivityLogId = oContext.scrapActivityLogId;

          let that = this;
          // Open popover to display path for assigned reason code
          return this.loadReasonCodePopover()
            .then(oPopover => {
              oPopover.openBy(source).setBusy(true);
              that
                .getReasonCodeDetail(sReasonCodeRef)
                .then(oData => {
                  oPopover.getModel().setData(oData);
                  oPopover.setBusy(false);
                })
                .catch(oError => {
                  MessageBox.error(oError.message);
                  oPopover.setBusy(false).close();
                });
            })
            .catch(oError => {
              MessageBox.error(oError.message);
            });
        },

        loadReasonCodePopover: function() {
          if (!this.oReasonCodePopoverPromise) {
            let sFragment = 'stellium.ext.podplugins.confirmationPlugin.view.fragments.ReasonCodePopover';
            this.oReasonCodePopoverPromise = this.loadFragment('reasonCodePopover', sFragment, this).then(oPopover => {
              this.getView().addDependent(oPopover);
              oPopover.setModel(new sap.ui.model.json.JSONModel());
              return oPopover;
            });
          }
          return this.oReasonCodePopoverPromise;
        },

        loadFragment: function (sId, sFragment, oContext) {
          return Fragment.load({
              id: sId,
              name: sFragment,
              controller: oContext
          });
        },

        handleReasonCodeUpdateFromPopover: function(event) {
          let that = this;
          if (!this.listOfTimeElementAndDesc) {
            this.callServiceForTimeElementDesc();
          }
          if (!this.updateReasonCodeDialog) {
            this.updateReasonCodeDialog = sap.ui.xmlfragment(
              'updateReasonCodeDialog',
              'stellium.ext.podplugins.confirmationPlugin.view.fragments.UpdateReasonCodeDialog',
              this
            );
            this.getView().addDependent(this.updateReasonCodeDialog);
          }
          this.updateReasonCodeDialog.open();
          setTimeout(function() {
            that.prepareReasonCodeTableForUpdate();
          }, 1000);
        },

        onSelectReasonCodeForUpdate: function() {
          let oUpdateReasonCodeTable, oPath, selectedObject, oSaveButton, oIndices;
          oUpdateReasonCodeTable = this.updateReasonCodeDialog.getContent()[0];
          oSaveButton = this.updateReasonCodeDialog.mAggregations.beginButton;
          oIndices = oUpdateReasonCodeTable.getSelectedIndices();
          if (oIndices.length >= 1) {
            for (let index of oIndices) {
              oPath = oUpdateReasonCodeTable.getContextByIndex(index).sPath;
              selectedObject = oUpdateReasonCodeTable.getModel('oReasonCodeModel').getProperty(oPath);
              if (selectedObject.timeElementReasonCodeTree) {
                oSaveButton.setEnabled(false);
                return false;
              }
              oSaveButton.setEnabled(true);
            }
          } else if (oIndices.length === 0) {
            oSaveButton.setEnabled(false);
          }
        },

        onClickUpdateReasonCode: function(oEvent) {
          let aSelectedReasonCodes, oMinLevelSelected, oIndex;
          let reasonCodesToBeAssigned = [];
          let that = this;
          this.busyDialog.open();
          aSelectedReasonCodes = this.getSelectedObjectsToUpdate();
          if (aSelectedReasonCodes.length > 0) {
            aSelectedReasonCodes.sort(function(a, b) {
              return a.level - b.level;
            });
            oMinLevelSelected = aSelectedReasonCodes[0].level;
            for (oIndex = aSelectedReasonCodes.length - 1; oIndex >= 0; oIndex--) {
              if (aSelectedReasonCodes[oIndex].level === oMinLevelSelected) {
                reasonCodesToBeAssigned.push(aSelectedReasonCodes[oIndex]);
                aSelectedReasonCodes.splice(oIndex, 1);
              }
            }

            // Remove Child Reason Codes If Parent Exists
            reasonCodesToBeAssigned = this.updateReasonCodeObject(aSelectedReasonCodes, reasonCodesToBeAssigned);
            let sUrl = that.getProductionDataSourceUri() + '/quantityConfirmation/reasonCode';
            let oRequestPayload = {};
            oRequestPayload.activityLogId = this._selectedScrapActivityLogId;
            oRequestPayload.reasonCodeKey = reasonCodesToBeAssigned[0].reasonCodeHandle.split(',')[1];
            oRequestPayload.reasonCode = reasonCodesToBeAssigned[0].ID;

            let viewQtyReportModel = that.getView().getModel('viewQuantityReportModel');
            let records = viewQtyReportModel.getData();

            for (let record of records) {
              if (record.scrapActivityLogId === that._selectedScrapActivityLogId) {
                record.selectReasonCode = reasonCodesToBeAssigned[0].ID;
                record.description = reasonCodesToBeAssigned[0].description;
                record.reasonCode = oRequestPayload.reasonCodeKey;
              }
            }

            this.ajaxPatchRequest(
              sUrl,
              oRequestPayload,
              // success handler
              function(oResponseData) {
                //Updating model
                that.getView().getModel('viewQuantityReportModel').setData(records);
                MessageToast.show(that.getI18nText('reasonCodeAssigned'));
                that.updateReasonCodeDialog.mAggregations.subHeader.mAggregations.contentMiddle[0].setValue('');
                that.busyDialog.close();
                that.updateReasonCodeDialog.close();
              },
              // error handler
              function(oError, sHttpErrorMessage, iStatusCode) {
                let err = oError ? oError : sHttpErrorMessage;
                that.showErrorMessage(err, true, true);
                that.busyDialog.close();
                that.updateReasonCodeDialog.close();
              }
            );
          } else {
            that.busyDialog.close();
          }
        },

        prepareReasonCodeTableForUpdate: function() {
          let oReasonCodeModel;
          let reasonCodeTable = this.updateReasonCodeDialog.getContent()[0];
          this.getReasonCodesForTimeElement();
          this.prepareDataForBinding(this.listOfTimeElementAndDesc);
          if (!oReasonCodeModel) {
            oReasonCodeModel = new sap.ui.model.json.JSONModel(this.reasonCodeData);
            reasonCodeTable.setModel(oReasonCodeModel, 'oReasonCodeModel');
            if (this.reasonTree.length > 0) {
              let arr = [];
              for (let reasonCode of this.reasonTree) {
                this.path = [];
                this.assignedCodeSelectionLoop(reasonCode.resourceReasonCodeNodeCollection);
                let aData = this.path;
                for (let j = 0; j < aData.length; j++) {
                  this.child = [];
                  let elem = aData[j];
                  let code = this.appendReasonCode(elem);
                  this.getReasonCodesForChild(elem.timeElement.ref, code);
                  aData[j] = this.child[0];
                }
                aData.typeOfData = 'reasonCodeObject';
                let reasonCodeNestedObject = this.transformData(aData);
                arr = arr.concat(reasonCodeNestedObject);
              }
              oReasonCodeModel.setData({
                timeElementReasonCodeTree: arr
              });
              reasonCodeTable.getModel('oReasonCodeModel').checkUpdate();
            } else {
              for (let timeElementReasonCode of this.reasonCodeData.timeElementReasonCodeTree) {
                this.getReasonCodesForTimeElementForNotSourceForUpdate(timeElementReasonCode, reasonCodeTable);
              }
            }
            this.allList = reasonCodeTable.getModel('oReasonCodeModel').getData();
            reasonCodeTable.getModel('oReasonCodeModel').checkUpdate();
            this.updateReasonCodeDialog.setBusy(false);
          }
        },

        getDateInPlantTimeZone: function(date) {
          var sDate = moment(new Date(date)).tz(this.plantTimeZoneId).format('YYYY-MM-DD');
          var oDateFormatFrom = DateFormat.getDateInstance({ format: 'yMMMd', UTC: true });
          return oDateFormatFrom.format(new Date(sDate));
        },

        getDateTimeInPlantTimeZone: function(dateTime) {
          var sdate = DateTimeUtils.dmcDateToUTCFormat(dateTime, 'Etc/GMT');
          return DateTimeUtils.dmcDateTimeFormatterFromUTC(sdate, this.plantTimeZoneId, null);
        },

        dmcDateToUTCFormat: function (date, timezone){
          let result = "";
          const timezoneInternal = timezone || _getPlantTimezone();
          const sFormattedDate = moment(date).locale("en").format("yyyy-MM-DD HH:mm:ss");
          const oDate = moment.tz(sFormattedDate, timezoneInternal);
          result = oDate.utc().format("YYYY-MM-DDTHH:mm:ss.SSS[Z]");
          return result;
        },

        getSelectedObjectsToUpdate: function() {
          let oTable, oSelectedIndices, oPath, selectedObject;
          let selectedObjects = [];
          oTable = this.updateReasonCodeDialog.getContent()[0];
          oSelectedIndices = oTable.getSelectedIndices();
          for (let index of oSelectedIndices) {
            oPath = oTable.getContextByIndex(index).sPath;
            selectedObject = oTable.getModel('oReasonCodeModel').getProperty(oPath);
            selectedObjects.push(selectedObject);
          }
          return selectedObjects;
        },

        getReasonCodeDetail: function (sReasonCodeRef) {
          let that = this;
          let oPromise = $.Deferred();
          let fnErrorCallback = (oError, sErrorMessage) => oPromise.reject(new Error(oError?.error?.message || sErrorMessage));

          this.ajaxGetRequest(that.getPlantRestDataSourceUri() + "resourceReasonCodes/" + encodeURIComponent(sReasonCodeRef), "",
              oReasonCode => {
                  // Reason code object only contains ids of parent reason codes
                  // Get all parent reason codes so descriptions can be displayed
                  let sQuery = "timeElement.ref=" + encodeURIComponent(oReasonCode.timeElement.ref) + "&reasonCode1=" + encodeURIComponent(oReasonCode.reasonCode1);
                  that.ajaxGetRequest(that.getPlantRestDataSourceUri() + "resourceReasonCodes?" + sQuery, "",
                      aReasonCodes => oPromise.resolve({
                          reasonCode: oReasonCode,
                          parentCodes: that.ReasonCodeDialogUtil.buildReasonCodeParents(aReasonCodes, oReasonCode)
                      }),
                      fnErrorCallback)
              },
              fnErrorCallback);

          return oPromise;
      },

        _validatePositiveNumber: function(sInputValue) {
          //Regex for Valid Numbers(10 digits before decimal and 3 digits after decimal)
          var regex = /^\s*(?=.*[1-9])\d{0,10}(?:\.\d{1,3})?\s*$/;
          var isValidInput = true;

          if (sInputValue) {
            if (!(sInputValue + '').match(regex)) {
              isValidInput = false;
            }
          }

          return isValidInput;
        },

        /***
         * Validation to enable Confirm Button on Post Pop-up
         */
        _enableConfirmButton: function() {
          var oView = this.getView();
          var isErrorStateExist = false;
          var oFormContent = this.byId('reportQuantityForm').getContent();
          for (var k = 0; k < oFormContent.length; k++) {
            if (oFormContent[k].getValueState && oFormContent[k].getValueState() === 'Error') {
              isErrorStateExist = true;
              break;
            }
          }

          if (
            (oView.getModel('postModel').getProperty('/yieldQuantity/value') ||
              oView.getModel('postModel').getProperty('/scrapQuantity/value')) &&
            oView.getModel('postModel').getProperty('/userId') &&
            !isErrorStateExist
          ) {
            this.getView().byId('quantityConfirmBtn').setEnabled(true);
          }
        },

        _endsWith: function(str, suffix) {
          return str.indexOf(suffix, str.length - suffix.length) !== -1;
        }
      }
    );

    return oPluginViewController;
  }
);
