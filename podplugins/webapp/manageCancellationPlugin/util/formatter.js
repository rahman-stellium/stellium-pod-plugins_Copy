sap.ui.define(['sap/ui/core/format/DateFormat', 'sap/ui/core/date/UI5Date', 'sap/dm/dme/util/PlantSettings'], function(
  DateFormat,
  UI5Date,
  PlantSettings
) {
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

    formatSingleDate: function(sDate) {
      var oDate = UI5Date.getInstance(sDate);
      return DateFormat.getDateInstance({pattern: 'MMM dd, yyyy, hh:mm:ss a'}).format(oDate);
    },

    materialFormatter: function(sMaterial, sVersion) {
      return sMaterial + ' / ' + sVersion;
    },

    plannedStartEndDateFormatter: function(sStartDate, sEndDate) {
      var oDateFormatter = DateFormat.getDateInstance({ pattern: 'MMM dd, yyyy' }),
        oStartDate = UI5Date.getInstance(sStartDate),
        oEndDate = UI5Date.getInstance(sEndDate);
      return oDateFormatter.format(oStartDate) + ' - ' + oDateFormatter.format(oEndDate);
    },

    dateFormat: function(t, e) {
      /(y+)/.test(e) && (e = e.replace(RegExp.$1, (t.getFullYear() + '').substr(4 - RegExp.$1.length)));
      var a = {
        'M+': t.getMonth() + 1,
        'd+': t.getDate(),
        'h+': t.getHours(),
        'm+': t.getMinutes(),
        's+': t.getSeconds(),
        'q+': Math.floor((t.getMonth() + 3) / 3),
        S: t.getMilliseconds()
      };
      for (var r in a) {
        new RegExp('(' + r + ')').test(e) &&
          (e = e.replace(RegExp.$1, RegExp.$1.length === 1 ? a[r] : ('00' + a[r]).substr(('' + a[r]).length)));
      }
      return e;
    }
  };
});
