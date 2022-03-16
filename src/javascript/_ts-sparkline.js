Ext.define('Ext.grid.column.Sparkline', {
    extend: 'Ext.grid.column.Template',
    alias: ['widget.sparklinecolumn'],
    requires: ['Ext.XTemplate'],
    height: '40px',
    defaultRenderer: function(value, meta, record, rowIndex) {
       // var data = Ext.apply({}, record.data, record.getAssociatedData());
        var data = {row: rowIndex};
        return this.tpl.apply(data);
    }
});
