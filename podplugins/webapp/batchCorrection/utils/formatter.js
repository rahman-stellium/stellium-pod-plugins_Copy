sap.ui.define([
  'sap/m/GroupHeaderListItem',
  'sap/ui/core/MessageType',
  'sap/ui/core/ValueState',
  'sap/ui/core/format/DateFormat',
  'sap/ui/core/format/NumberFormat',
  'sap/dm/dme/constants/DMCConstants',
  "sap/dm/dme/formatter/NumberFormatter",
  "sap/dm/dme/formatter/DateTimeUtils"
], function (GroupHeaderListItem, MessageType, ValueState, DateFormat, NumberFormat, DMCConstants, DMENumberFormatter, DateTimeUtils) {
  "use strict";

  var oResourceBundle;

  return {
      init: function (oBundle) {
          oResourceBundle = oBundle;
      },
      getStatusState: function (measure, bomTarget) {
        if ( measure === null || measure === undefined || bomTarget === null || bomTarget === undefined ) {
            return "None";
        }
        if (parseFloat(measure) > parseFloat(bomTarget)) {
            return "Indication01";
        } else if (parseFloat(measure) < parseFloat(bomTarget)) {
            return "Indication03";
        } else {
            return "None";
        }
    },
    
    getStatusText: function (measure, bomTarget) {
        if ( measure === null || measure === undefined || bomTarget === null || bomTarget === undefined ) {
            return "";
        }
        if (parseFloat(measure) > parseFloat(bomTarget)) {
            return "B";
        } else if (parseFloat(measure) < parseFloat(bomTarget)) {
            return "P";
        } else {
            return "";
        }
    },
    
    getStatusTooltip: function (measure, bomTarget) {
        if (measure === null || measure === undefined || bomTarget === null || bomTarget === undefined ) {
            return "No data available";
        }
        if (parseFloat(measure) > parseFloat(bomTarget)) {
            return "Measure exceeds BOM Target";
        } else if (parseFloat(measure) < parseFloat(bomTarget)) {
            return "Measure is below BOM Target";
        } else {
            return "Measure equals BOM Target";
        }
    },
    getStatusStyle: function (measure, bomTarget) {
      if ( measure === null || measure === undefined || bomTarget === null || bomTarget === undefined ) {
          return "";
      }
      if (parseFloat(measure) > parseFloat(bomTarget)) {
          return "background-red";
      } else if (parseFloat(measure) < parseFloat(bomTarget)) {
          return "background-yellow";
      } else {
          return "";
      }
  },
  getValueWithUnit: function (value, unit) {
    if (value === null || value === undefined || unit === null || unit === undefined) {
        return value || "";
    }
    return `${value} ${unit}`;
},
  
  };
});
