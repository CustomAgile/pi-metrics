Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),
    items: [
        {xtype:'container',itemId:'criteria_box', layout: {type: 'hbox'}, padding: 5},
        {xtype:'container',itemId:'display_box', layout: {type: 'table', columns: 5}},
        {xtype:'tsinfolink'}
    ],
    COLORS: ['#7cb5ec', '#434348', '#90ed7d', '#f7a35c', '#8085e9', 
            '#f15c80', '#e4d354', '#8085e8', '#8d4653', '#91e8e1',
            '#2f7ed8', '#0d233a', '#8bbc21', '#910000', '#1aadce', 
            '#492970', '#f28f43', '#77a1e5', '#c42525', '#a6c96a'],
    portfolioItemTypes: [],
    fields: [],
    launch: function() {
        
        var label_width= 150;
        
        var defaultPortfolioItemField = 'State';
        this.cbPortfolioItem = this.down('#criteria_box').add({
            xtype: 'rallyfieldcombobox',
            model: 'PortfolioItem',
            itemId: 'cb-portfolioItem',
            labelWidth: label_width,
            fieldLabel: 'PortfolioItem State Field',
            labelAlign: 'right',
            value: defaultPortfolioItemField,
            margin: 10
        });
        var pi_store = this.cbPortfolioItem.getStore();
        this._filterAllowedValuesFields(pi_store);
        
        var defaultUserStoryField = 'ScheduleState';
        this.cbUserStory = this.down('#criteria_box').add({
            xtype: 'rallyfieldcombobox',
            itemId: 'cb-userstory',
            model: 'UserStory',
            labelWidth: label_width *2,
            fieldLabel: 'User Story State Field',
            labelAlign: 'right',
            value: defaultUserStoryField,
            margin: 10
        });
        var store = this.cbUserStory.getStore();
        this._filterAllowedValuesFields(store);
        
        this.down('#criteria_box').add({
            xtype: 'rallybutton',
            text: 'Update',
            scope: this,
            handler: this._update,
            margin: 10
        });
        
        this._update(defaultPortfolioItemField, defaultUserStoryField); 
        
    },
    _filterAllowedValuesFields: function(store,cb, default_field) {
        store.filter([{
            filterFn:function(field){
                var attr_def = field.get('fieldDefinition').attributeDefinition;
                if (attr_def && (attr_def.SchemaType == 'State' || (attr_def.AllowedValues && attr_def.AllowedValues.length > 0))){
                    return true;
                }
                return false;
            } 
        }]);
    },
    _update: function(portfolioItemField, userStoryField){
        
        var pi_field = portfolioItemField;
        var hr_field = userStoryField; //'ScheduleState';

        if (this.cbPortfolioItem.getValue()){
            pi_field = this.cbPortfolioItem.getValue();
        } 
        if (this.cbUserStory.getValue()){
            hr_field = this.cbUserStory.getValue();
        }
        this.logger.log('_update', pi_field, hr_field);
        
        this._initializeConfig(pi_field, hr_field).then({
            scope: this,
            success: function() {
                this._fetchDataInChunks().then({
                    scope: this, 
                    success: function(data){
                       this._buildCharts(data);
                       this.setLoading(false);
                    },
                    failure: function(error){
                        alert('Failed to fetch data for the chart [' + error + ']');
                        this.setLoading(false);
                        
                    }
                });
            },
            failure: function(){
                alert('Failed to get configuration information');
                this.setLoading(false);
            }
        }); 
    },
    _initializeConfig: function(pi_field, hr_field){
        var deferred = Ext.create('Deft.Deferred');
        
        this._fetchPortfolioItemTypes().then({
            scope: this,
            success: function(portfolioItemTypes){
                this.portfolioItemTypes = portfolioItemTypes;
                this.fields = []; 
                Ext.each(this.portfolioItemTypes, function(pi){
                    var field = {type: pi, displayName: pi.replace('PortfolioItem/',''), stateField: pi_field};
                    this.fields.push(field);
                },this);
                
                this.fields.push({type: 'HierarchicalRequirement', displayName: 'Parent User Stories', stateField: hr_field, findField: 'Children', findValue: {$ne: null}});
                this.fields.push({type: 'HierarchicalRequirement', displayName: 'Child User Stories', stateField: hr_field, findField: 'Children', findValue: null});
                this.logger.log('_initializeConfig',this.displayNameMapping,this.stateFieldMapping);
                deferred.resolve();
            }
        });
        
        return deferred;  
    },
    _fetchPortfolioItemTypes: function(){
        var deferred = Ext.create('Deft.Deferred');
        
        Ext.create('Rally.data.wsapi.Store',{
            model: 'TypeDefinition',
            fetch: ['TypePath','Ordinal'],
            autoLoad: true, 
            filters: [{
                property: 'TypePath',
                operator: 'contains',
                value: 'PortfolioItem/'
            }],
            listeners: {
                scope: this,
                load: function(store, data, success){
                    var portfolioItemTypes = new Array(data.length);
                    Ext.each(data, function(d){
                        //Use ordinal to make sure the lowest level portfolio item type is the first in the array.  
                        var idx = Number(d.get('Ordinal'));
                        portfolioItemTypes[idx] = d.get('TypePath');
                        portfolioItemTypes.reverse();
                    }, this);
                    deferred.resolve(portfolioItemTypes); 
                }
            }
        });
        return deferred.promise; 
    },
    _getColor: function(colorIndex){
        //If we happen to have more allowed values than states, then we need to wrap the colors....
        if (colorIndex > this.COLORS.length - 1){
            colorIndex = colorIndex-this.COLORS.length;  
        }
        return this.COLORS[colorIndex];
    },
    _createPieChart: function(rec, colorIndexes){
        this.logger.log('_createPieChart', rec, colorIndexes);
        var series = [];
        var categories = []; 
        var chart_type = 'pie';
        var series_data = [];  

        var keys = Object.keys(rec.stats);
        keys.sort();
        Ext.each(keys, function(key){
            series_data.push({name: key, y: rec.stats[key], color: this._getColor(colorIndexes[key])});
        }, this);
        series.push({type:'pie', name: rec.displayName, data: series_data});
        
        return {
            xtype: 'rallychart',
            width: 200,
            loadMask: false,
            chartData: {
               series: series,
               categories: categories
            },
            chartConfig: {
                chart: {
                    plotBackgroundColor: null,
                    plotBorderWidth: null,
                    plotShadow: false,
                    type: chart_type,
                    marginTop: 5
                },
                title: {
                    text: rec.displayName,
                    style: {"fontSize": "14px", "fontWeight":"bold" }
                },
                subtitle: {
                    text: Ext.String.format("Total: {0}", rec.total),
                    style: {"fontSize": "12px" }                    
                },
                plotOptions: {
                      pie: {
                          allowPointSelect: true,
                          cursor: 'pointer',
                          dataLabels: {
                              enabled: false
                          },
                          showInLegend: true
                      }
                },
                legend: {
                    symbolHeight: 8,
                    symbolWidth: 8,
                    padding: 4,
                    borderColor: null,
                    itemStyle: {"fontSize": "9px"}
                }
            }
        }; //);
        
    },
    _buildCharts: function(data){
       this.down('#display_box').removeAll(); 
       var color_indexes = {};  
       var color_index = 0;
        Ext.each(data, function(d){
           var type = d.fieldInfo.type;  
           var state_field = d.fieldInfo.stateField;
           var counts = {};
           var total = 0;
           Ext.each(d.data, function(rec){
               var state = rec.get(state_field);
               if (state.length == 0){
                   state = "None";
               }
               if (counts[state] == undefined){
                   counts[state] = 0;
               }
               counts[state]++;  
               total++;
               if (color_indexes[state] == undefined){
                   color_indexes[state] = color_index++;
               }
           },this);
           var custom_rec = {type: type, total: total, stats: counts, displayName: d.fieldInfo.displayName};
           var chart = this._createPieChart(custom_rec, color_indexes);
           this.down('#display_box').add(chart);
       },this);  
    },
    _fetchDataInChunks: function(){
        this.setLoading('Retrieving Data...');
        var deferred = Ext.create('Deft.Deferred');
        
        this.logger.log('_fetchDataInChunks Start');
        var promises = [];
        Ext.each(this.fields, function(field){
            promises.push(this._fetchData(field));
        },this);
        
        Deft.Promise.all(promises).then({
            scope: this,
            success: function(data){
                this.logger.log('_fetchDataInChunks End',data);
                deferred.resolve(data);
                this.setLoading(false);
            },
            failure: function(){}
        });        
        return deferred; 
    },

    _fetchData: function(field){
        var project = this.getContext().getProject().ObjectID;  
        var deferred = Ext.create('Deft.Deferred');
        this.logger.log('_fetchData',field);
        var find = { 
                "_TypeHierarchy": field.type,
                "__At": "current",
                "_ProjectHierarchy": project
        };  
        
        if (field.findField){
            find[field.findField] = field.findValue; 
        }
        
        Ext.create('Rally.data.lookback.SnapshotStore', {
            listeners: {
                scope: this,
                load: function(store, data, success) {
                   // this.logger.log('_fetchData load',store,data,success);
                    if (success) {
                        this.logger.log('_fetchData', data.length, store, success);
                        deferred.resolve({fieldInfo: field, data: data});
                    } else {
                        deferred.reject('Error loading artifact data');
                    }
                }
            },
            fetch: [field.stateField],
            find: find,
            limit: 'Infinity',
            hydrate: [field.stateField],
            autoLoad: true
        });
        return deferred; 
    }
});