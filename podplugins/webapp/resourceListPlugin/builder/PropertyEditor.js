sap.ui.define([
    "sap/dm/dme/podfoundation/control/PropertyEditor"
], function (PropertyEditor) {
    "use strict";

    var oPropertyEditor = PropertyEditor.extend("stellium.ext.podplugins.resourceListPlugin.builder.PropertyEditor", {
        constructor: function (sId, mSettings) {
            PropertyEditor.apply(this, arguments);
            this.setI18nKeyPrefix("resourceListPlugin.");
            this.setResourceBundleName("stellium.ext.podplugins.resourceListPlugin.i18n.builder");
            this.setPluginResourceBundleName("stellium.ext.podplugins.resourceListPlugin.i18n.i18n");
        },

        addPropertyEditorContent: function (oPropertyFormContainer) {
            var oData = this.getPropertyData();
            this.addSwitch(oPropertyFormContainer, "closeButtonVisible", oData);
        },

        getDefaultPropertyData: function () {
            var oData = {
                "closeButtonVisible": false
            };

            return oData;
        }
    });

    return oPropertyEditor;
});