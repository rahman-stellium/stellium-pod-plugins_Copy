sap.ui.define(
  [
    'sap/ui/model/json/JSONModel',
    'sap/dm/dme/podfoundation/controller/PluginViewController',
    'sap/base/Log',
    'sap/ui/core/Fragment',
    './../utils/formatter',
    './../utils/ErrorHandler'
  ],
  function(JSONModel, PluginViewController, Log, Fragment, Formatter, ErrorHandler) {
    'use strict';

    var oLogger = Log.getLogger('confirmationPlugin', Log.Level.INFO);

    var oPluginViewController = PluginViewController.extend(
      'stellium.ext.podplugins.confirmationPlugin.controller.PluginView',
      {
        metadata: {
          properties: {}
        },

        oFormatter: Formatter,

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

          var oQuantityPostModel = new JSONModel(this.postData);
          this.getView().setModel(oQuantityPostModel, 'postModel');
          this.getView().setModel(new JSONModel({ value: [] }), 'quantitiesModel');

          this.prepareBusyDialog();
        },

        /**
         * @see PluginViewController.onBeforeRenderingPlugin()
         */
        onBeforeRenderingPlugin: function() {
          this.subscribe('phaseSelectionEvent', this.getQuantityConfirmationData, this);
          this.publish('requestForPhaseData', this);
          // this.podType = this.getPodSelectionModel().getPodType();
          // //Work Center POD event for Prodcuction Order
          // if (this.getPodSelectionModel().getPodType() === 'WORK_CENTER') {
          //     this.subscribe('OperationListSelectEvent', this.onOperationSelected, this);
          //     // this.publish("phaseSelectionEventWIList", this);
          // }
          // //Order POD event for Process Order
          // if (this.getPodSelectionModel().getPodType() === 'ORDER') {
          //     this.subscribe('phaseSelectionEvent', this.onPhaseSelected, this);
          //     this.publish('requestForPhaseData', this);
          // }
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
          // this.onOpenViewQuantityReportDialog(true);
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
