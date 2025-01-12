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
            let sOrderValue = this.byId("idOrderFilterInput").getValue();
            if (sOrderValue === "") {
                this.getView().getModel("masterListBatch").setData([]);
                // set sfc filter as blank
                this.populateSfcSelect([]);
                sap.m.MessageToast.show("Please enter an order value to search.");
                return;
            }
                const oBusyDialog = new sap.m.BusyDialog({
                    text: "Loading , please wait..."
                });

                // Open the busy dialog
                oBusyDialog.open();

            try {
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
                this.getView().getModel("masterListBatch").setData(filteredData);
                this.applyStatusCellStyles();
                // Extract unique charge IDs from filtered data
                const uniqueChargeIds = [...new Set(filteredData.map(item => item.chargeId))];
                this.populateSfcSelect(uniqueChargeIds);
                // sap.m.MessageToast.show("Goods issue summary fetched successfully.");
            } catch (error) {
                this.getView().getModel("masterListBatch").setData([]);
                // set blank to sfc filter
                this.populateSfcSelect([]);
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
            const oTable = this.byId("idBatchTable");
            const oBinding = oTable.getBinding("items");
            const oFilter = sSelectedSfc
                ? new sap.ui.model.Filter("chargeId", sap.ui.model.FilterOperator.EQ, sSelectedSfc)
                : null;
            oBinding.filter(oFilter ? [oFilter] : []);
        },

    });
});