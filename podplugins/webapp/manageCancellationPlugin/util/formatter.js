sap.ui.define(['sap/ui/core/format/DateFormat', 'sap/ui/core/date/UI5Date'], function(DateFormat, UI5Date) {
  const STATUS = {
    CLOSED: 'shopOrderStatus.closed',
    DISCARDED: 'shopOrderStatus.discarded',
    DONE: 'shopOrderStatus.done',
    PARTIALLY_CREATED: 'shopOrderStatus.partiallyCreated',
    PARTIALLY_RELEASED: 'shopOrderStatus.partiallyReleased',
    RELEASED: 'shopOrderStatus.released',
    RELEASABLE: 'shopOrderStatus.releasable',
    RELEASE_ON_HOLD: 'shopOrderStatus.releaseOnHold',
    NOT_IN_EXECUTION: 'shopOrderStatus.notInExecution',
    ACTIVE: 'shopOrderStatus.active',
    HOLD: 'shopOrderStatus.hold',
    COMPLETED: 'shopOrderStatus.completed'
  };

  return {
    init: function(oBundle) {},

    getText: function(sTextId) {
      this.getOwnerComponent().getModel('i18n').getText(sTextId);
    },

    executionStatusTextFormatter: function(sStatus) {
      var sStatusTextId = STATUS[sStatus];

      if (!sStatusTextId) {
        return;
      }

      return this.getOwnerComponent().getModel('i18n').getResourceBundle().getText(sStatusTextId);
    },

    materialFormatter: function(sMaterial, sVersion) {
      return sMaterial + ' / ' + sVersion;
    },

    plannedStartEndDateFormatter: function(sStartDate, sEndDate) {
      var oDateFormatter = DateFormat.getDateInstance({ pattern: 'MMM dd, yyyy' }),
        oStartDate = UI5Date.getInstance(sStartDate),
        oEndDate = UI5Date.getInstance(sEndDate);
      return oDateFormatter.format(oStartDate) + ' - ' + oDateFormatter.format(oEndDate);
    }
  };
});
