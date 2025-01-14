sap.ui.define([
    "sap/dm/dme/podfoundation/controller/ListPluginViewController",
    "sap/ui/model/json/JSONModel",
    "sap/dm/dme/model/AjaxUtil",
    "./../utils/formatter",
    "sap/ui/core/Fragment",
    "sap/m/MessageToast",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageBox",
    "sap/ui/comp/filterbar/FilterBar",
], function (ListPluginViewController, JSONModel, AjaxUtil, Formatter, Fragment, MessageToast, 
    Filter, FilterOperator, MessageBox, FilterBar) {
    "use strict";
    // var oLogger = Logging.getLogger("stellium.ext.podpluginsCopyRahman.batchCorrection.controller.PluginView");
    return ListPluginViewController.extend("stellium.ext.podpluginsCopyRahman.batchCorrection.controller.PluginView", {
        oFormatter: Formatter,
        oCoBiProduct: {},
        onInit: function () {

            if (ListPluginViewController.prototype.onInit) {
                ListPluginViewController.prototype.onInit.apply(this, arguments);
            }
            // Set up models
          this.getView().setModel(new JSONModel([]), 'masterListBatch');
          // model for step input scale factor
          const oViewModel = new sap.ui.model.json.JSONModel({
            stepInput: {
                min: 0,
                value: 0
            }
        });
        this.getView().setModel(oViewModel, "viewModel");
        },
        onAfterRendering: function () {
        },
        applyStatusCellStyles: function () {
            const oTable = this.byId("idBatchTable");
            const aItems = oTable.getItems();
            aItems.forEach((oItem) => {
                const oContext = oItem.getBindingContext("masterListBatch");
                if (oContext) {
                    const consumedQuantity = oContext.getProperty("consumedQuantity/value");
                    const targetQuantity = oContext.getProperty("targetQuantity/value");
                    const aCells = oItem.getCells();
                    const oStatusCell = aCells[5];
                    oStatusCell.removeStyleClass("background-red");
                    oStatusCell.removeStyleClass("background-yellow");
                    if ( consumedQuantity !== null && consumedQuantity !== undefined && 
                        targetQuantity !== null && targetQuantity !== undefined ) {
                        const measure = parseFloat(consumedQuantity);
                        const bomTarget = parseFloat(targetQuantity);
                        if (measure > bomTarget) {
                            oStatusCell.addStyleClass("background-red");
                        } else if (measure < bomTarget) {
                            oStatusCell.addStyleClass("background-yellow");
                        }
                    }
                }
            });
        },
        onOrdersSearch: async function () {
            this.originalData = [];
            let sOrderValue = this.byId("idOrderFilterInput").getValue();
            if (sOrderValue === "") {
                this.getView().getModel("masterListBatch").setData([]);
                // set sfc filter as blank
                this.populateSfcSelect([]);
                this.clearHeaderFragmentData();
                sap.m.MessageToast.show("Please enter an order value to search.");
                return;
            }
                const oBusyDialog = new sap.m.BusyDialog({
                    text: "Loading , please wait..."
                });

                // Open the busy dialog
                oBusyDialog.open();

            try {
                this.populateSfcSelect([]);
                this.clearHeaderFragmentData();
                const sfcs = await this.fetchOrderDetails(sOrderValue);
                const goodsIssueData = [];
                const { operationActivity, stepId } = await this.fetchRoutingDetails(sOrderValue);
                for (let sfc of sfcs) {
                    const summary = await this.fetchGoodsIssueSummary(sOrderValue, sfc, operationActivity, stepId);
                    // Add Charge ID (SFC) to each record
                    summary.lineItems.forEach((item) => {
                        item.chargeId = sfc;
                    });
        
                    goodsIssueData.push(...summary.lineItems);
                }
                // Filter goodsIssueData to include only items with componentType 'N'
                const filteredData = goodsIssueData.filter(item => item.componentType === 'N');
                this.originalData = filteredData;
                this.getView().getModel("masterListBatch").setData(filteredData);
                this.applyStatusCellStyles();
                // Extract unique charge IDs from filtered data
                const uniqueChargeIds = [...new Set(filteredData.map(item => item.chargeId))];
                this.populateSfcSelect(uniqueChargeIds);
                 // Calculate batch correction initially
                this._calculateBatchCorrection();
                // sap.m.MessageToast.show("Goods issue summary fetched successfully.");
            } catch (error) {
                this.getView().getModel("masterListBatch").setData([]);
                // set blank to sfc filter
                this.populateSfcSelect([]);
                this.clearHeaderFragmentData();
                sap.m.MessageBox.error(error.message || "An error occurred. Please try again.");
                console.error("Error:", error);
            } finally {
                // Close the busy dialog
                oBusyDialog.close();
            }
        },
        fetchGoodsIssueSummary: async function (sOrderValue, batchId, operationActivity, stepId) {
            const baseUri = this.getAssemblyDataSourceUri();
            const summaryUrl = `${baseUri}order/goodsIssue/summary?shopOrder=${encodeURIComponent(sOrderValue)}&batchId=${encodeURIComponent(batchId)}&operationActivity=${encodeURIComponent(operationActivity)}&stepId=${encodeURIComponent(stepId)}`;
        
            return new Promise((resolve, reject) => {
                this.ajaxGetRequest(
                    summaryUrl,
                    {},
                    function (response) {
                        if (!response) {
                            return reject(new Error("No Goods Issue Summary found for the given SFC."));
                        }
                        resolve(response);
                    },
                    function (error) {
                        reject(new Error("Error fetching Goods Issue Summary."));
                    }
                );
            });
        },
        fetchRoutingDetails: async function (sOrderValue) {
            let dataSourceUri = this.getPublicApiRestDataSourceUri();
            let sPlant = this.getPodController().getUserPlant();
            let routingUrl = `${dataSourceUri}routing/v1/routings?plant=${sPlant}&routing=${encodeURIComponent(sOrderValue)}&type=SHOPORDER_SPECIFIC_RECIPE`;
            let sOrderValueC = sOrderValue;
            return new Promise((resolve, reject) => {
                this.ajaxGetRequest(
                    routingUrl,
                    {},
                    function (response) {
                        if (!response) {
                            return reject(new Error("No routing details found for the given order."));
                        }
                        // Extract operationActivity and stepId
                        const routingStep = response[0]?.routingOperationGroups[0]?.routingOperationGroupSteps[0]?.routingStep;
                        if (!routingStep) {
                            return reject(new Error("Routing step information is incomplete."));
                        }
                        
                        const erpSequence = routingStep.erpSequence || "0";
                        const stepId = routingStep.stepId;
                        const operationActivity = `${sOrderValueC}-${erpSequence}-${stepId}`;
                        resolve({ operationActivity, stepId });
                    },
                    function (error) {
                        reject(new Error("Error fetching routing details."));
                    }
                );
            });
        },
        fetchOrderDetails: async function (sOrderValue) {
            this._storedWorkCenters = "";
            var that = this;
            let dataSourceUri = this.getPublicApiRestDataSourceUri();
            let sPlant = this.getPodController().getUserPlant();
            let orderUrl = `${dataSourceUri}order/v1/orders?order=${encodeURIComponent(sOrderValue)}&plant=${sPlant}`;
            return new Promise((resolve, reject) => {
                this.ajaxGetRequest(
                    orderUrl,
                    {},
                    function (response) {
                        if (!response || !response.sfcs || response.sfcs.length === 0) {
                            return reject(new Error("No SFCs found for the given order."));
                        }
                        that._storedWorkCenters = response.workCenters.map(wc => wc.workCenter);
                        resolve(response.sfcs);
                    },
                    function (error) {
                        reject(new Error("Error fetching order details."));
                    }
                );
            });
        },
        // populate sfc filter with unique sfcs
        populateSfcSelect: function (chargeIds) {
            const oSelect = this.byId("idSfcSelect");
            oSelect.removeAllItems();
            oSelect.setValue(null);
            chargeIds.forEach((id) => {
                oSelect.addItem(new sap.ui.core.Item({
                    key: id,
                    text: id
                }));
            });
        },
        // on select change : charge Id
        onSfcFilterChange: function () {
            const oSelect = this.byId("idSfcSelect");
            const sSelectedSfc = oSelect.getSelectedKey();
            const sOrderValue = this.byId("idOrderFilterInput").getValue();
            const oMasterListBatch = this.getView().getModel("masterListBatch");
            if (sSelectedSfc) {
                this._loadHeaderFragment(sOrderValue, sSelectedSfc);
            } else {
                const oPanel = this.getView().byId("idHeaderContainer");
                oPanel.destroyContent();
            }
            if (sSelectedSfc) {
                const aFilteredData = this.originalData.filter(item => item.chargeId === sSelectedSfc);
                oMasterListBatch.setData(aFilteredData);
            } else {
                oMasterListBatch.setData(this.originalData);
            }
            this.byId("idBatchtitleText").setText(`Batch Summary (${oMasterListBatch.getData().length})`);
        },        
        // calculate step input scale
        _calculateBatchCorrection: function (iFactor) {
            const oViewModel = this.getView().getModel("viewModel");
            const oMasterListBatch = this.getView().getModel("masterListBatch");
            const aLineItems = oMasterListBatch.getProperty("/");
        
            const aScaleFactors = aLineItems.map((oItem) => {
                const targetQty = oItem.targetQuantity?.value || 0;
                const consumedQty = oItem.consumedQuantity?.value || 0;
                return targetQty > 0 ? consumedQty / targetQty : 0; // Avoid division by 0
            });
            let iScaleFactor = Math.max(...aScaleFactors);
            if (iFactor && !isNaN(iFactor) && iFactor >= oViewModel.getProperty("/stepInput/min")) {
                iScaleFactor = iFactor;
            }
            oViewModel.setProperty("/stepInput/min", Math.min(iScaleFactor, oViewModel.getProperty("/stepInput/min")));
            oViewModel.setProperty("/stepInput/value", iScaleFactor);
            const updatedLineItems = aLineItems.map((oItem) => {
                const targetQty = oItem.targetQuantity?.value || 0;
                const consumedQty = oItem.consumedQuantity?.value || 0;
        
                if (targetQty > 0) {
                    oItem.batchCorrectionWeight = {
                        value: parseFloat((targetQty * iScaleFactor).toFixed(3)),
                        unitOfMeasure: oItem.targetQuantity.unitOfMeasure || ""
                    };
                    if (consumedQty > 0) {
                        oItem.issueWeight = {
                            value: parseFloat((targetQty * iScaleFactor - consumedQty).toFixed(3)),
                            unitOfMeasure: oItem.targetQuantity.unitOfMeasure || ""
                        };
                    }
                    else {
                        oItem.issueWeight = null;
                    }
                    
                } else {
                    oItem.batchCorrectionWeight = null;
                    oItem.issueWeight = null;
                }
                return oItem;
            });
            oMasterListBatch.setProperty("/", updatedLineItems);
        },        
        onStepInputChange: function (oEvent) {
            const iNewValue = oEvent.getParameter("value");
            this._calculateBatchCorrection(iNewValue);
        },
        // Load header fragment based on order and sfc
        _loadHeaderFragment: async function (order, sfc) {
            //  // mock data for header fragment
            //  const mockHeaderData = {
            //     batch: "0000018447",
            //     phase: "140000000002-0-0020 - 140000000002-0-0020",
            //     material: "00001000000009153",
            //     materialDescription: "Copy Labneh With Honey 175g",
            //     plannedDate: "Jan 5, 2025 – Jan 6, 2025",
            //     workInstructions: "",
            //     goodsReceiptQuantity: {
            //         value: 5,
            //         total: 10,
            //         unit: "PC"
            //     },
            //     goodsReceiptPercent: 50
            // };
            const headerData = await this._fetchHeaderData(order, sfc);
            const oView = this.getView();
            const oPanel = oView.byId("idHeaderContainer");
            oPanel.destroyContent();
            Fragment.load({
                id: oView.getId(),
                name: "stellium.ext.podpluginsCopyRahman.batchCorrection.view.fragments.BatchHeader",
                controller: this
            }).then(function (oFragment) {
                const oModel = new sap.ui.model.json.JSONModel();
                oModel.setData(headerData);
                oFragment.setModel(oModel, "headerModel");
                oPanel.addContent(oFragment);
            }.bind(this));
        },
        
        _fetchHeaderData: function (inputOrder, inputSfc) {
            return new Promise((resolve, reject) => {
                const dataSourceUri = this.getPodController().getWorklistODataDataSourceUri();
                const fromDate = "2025-01-04 00:00:00";
                const toDate = "2025-01-10 23:59:59";
                const workCenters = this._storedWorkCenters;
                const encodedWorkCenters = workCenters.map(wc => encodeURIComponent(wc)).join("%2c");
                const summaryUrl = `${dataSourceUri}GetOrdersList(WorkCenter='${encodedWorkCenters}',FromDate='${fromDate}',ToDate='${toDate}',OrderSelectionType='PROCESS',SearchSFC=null,Resource=null,Material=null,Version=null,OrderExecutionStatus=null,SFCStatus=null,ShopOrder=null)?$orderby=order&$skip=0&$top=20`;
                this.ajaxGetRequest(
                    summaryUrl,
                    {},
                    function (response) {
                        if (!response || !response.value || response.value.length === 0) {
                            console.error("Invalid response received:", response);
                                return resolve({});
                        }
                const filteredData = response.value.find(
                    item => item.order === inputOrder && item.sfc === inputSfc
                );
                if (!filteredData) {
                    console.error(`No matching data found for Order: ${inputOrder}, SFC: ${inputSfc}`);
                    return resolve({});
                }
                        const headerData = {
                            batch: filteredData.orderBatchId,
                            phase: filteredData.routingId,
                            material: filteredData.materialName,
                            materialDescription: filteredData.materialDescription || "No description available",
                            plannedDate: `${new Date(filteredData.plannedStartDate).toLocaleDateString()} – ${new Date(filteredData.plannedCompletionDate).toLocaleDateString()}`,
                            workInstructions: "",
                            goodsReceiptQuantity: {
                                value: parseFloat(filteredData.completedQty).toFixed(2),
                                total: parseFloat(filteredData.plannedQty).toFixed(2),
                                unit: filteredData.baseCommercialUom,
                            },
                            goodsReceiptPercent: (parseFloat(filteredData.completedQty) / parseFloat(filteredData.plannedQty)) * 100,
                        };
                        resolve(headerData);
                    },
                    function (error) {
                        console.error("Error fetching header data:", error);
                        resolve({});
                    }
                );
            });
        },
        // Clear header fragment data        
        clearHeaderFragmentData: function () {
            const oPanel = this.getView().byId("idHeaderContainer");
            oPanel.destroyContent();
        },
        
    });
});