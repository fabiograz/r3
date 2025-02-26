import {getChoiceFilters} from './shared/form.js';
import {getCaption}       from './shared/language.js';
import {
	getQueryExpressions,
	getRelationsJoined
} from './shared/query.js';
import {
	getUnixFormat,
	getUtcTimeStringFromUnix
} from './shared/time.js';

export {MyChart as default};

let MyChart = {
	name:'my-chart',
	components:{
		echarts:VueECharts
	},
	template:`<div class="chart shade">
		<div class="top lower" v-if="showTopBar">
			<div class="area" />
			<div class="area">
				<select class="selector"
					v-if="hasChoices"
					v-model="choiceId"
					@change="choiceIdSet($event.target.value)"
				>
					<option v-for="c in choices" :value="c.id">
						{{ getCaption(c.captions.queryChoiceTitle,c.name) }}
					</option>
				</select>
			</div>
		</div>
		<echarts ref="chart"
			v-if="ready"
			:option="option"
			:theme="settings.dark ? 'dark' : ''"
		/>
	</div>`,
	props:{
		choices:    { type:Array,  required:false, default:() => [] },
		columns:    { type:Array,  required:true },
		filters:    { type:Array,  required:true },
		formLoading:{ type:Boolean,required:true },
		isFullPage: { type:Boolean,required:true },
		limit:      { type:Number, required:true },
		optionJson: { type:String, required:true },
		query:      { type:Object, required:true }
	},
	data:function() {
		return {
			choiceId:null,
			option:{},
			ready:false
		};
	},
	computed:{
		dateTimeColumnIndexes:function() {
			let out = [];
			for(let i = 0, j = this.columns.length; i < j; i++) {
				if(['datetime','date','time'].includes(this.columns[i].display))
					out.push(i);
			}
			return out;
		},
		
		// simple
		choiceFilters:function() { return this.getChoiceFilters(this.choices,this.choiceId); },
		hasChoices:   function() { return this.choices.length > 1; },
		showTopBar:   function() { return this.hasChoices || this.isFullPage; },
		
		// stores
		settings:function() { return this.$store.getters.settings; }
	},
	created:function() {
		window.addEventListener('resize',this.resize);
	},
	mounted:function() {
		// setup watchers
		this.$watch('formLoading',(val) => {
			if(!val) this.get();
		});
		this.$watch(() => [this.columns,this.filters],(newVals,oldVals) => {
			for(let i = 0, j = newVals.length; i < j; i++) {
				if(JSON.stringify(newVals[i]) !== JSON.stringify(oldVals[i]))
					return this.get();
			}
		});
		
		// set default choice
		this.choiceId = this.choices.length > 0 ? this.choices[0].id : null;
	},
	unmounted:function() {
		window.removeEventListener('resize',this.resize);
	},
	methods:{
		// externals
		getCaption,
		getChoiceFilters,
		getQueryExpressions,
		getRelationsJoined,
		getUnixFormat,
		getUtcTimeStringFromUnix,
		
		// actions
		choiceIdSet:function() {
			this.get();
		},
		resize:function() {
			this.$refs.chart.resize();
		},
		
		// backend calls
		get:function() {
			let trans = new wsHub.transactionBlocking();
			trans.add('data','get',{
				relationId:this.query.relationId,
				joins:this.getRelationsJoined(this.query.joins),
				expressions:this.getQueryExpressions(this.columns),
				filters:this.filters.concat(this.choiceFilters),
				orders:this.query.orders,
				limit:this.limit
			},this.getOk);
			trans.send(this.handleError);
		},
		getOk:function(res) {
			// option overwrites
			this.option = JSON.parse(this.optionJson);
			
			// overwrite font styles
			if(typeof this.option.textStyle === 'undefined')
				this.option.textStyle = {};
			
			this.option.textStyle.fontFamily = 'Roboto,Arial,Helvetica,sans-serif';
			this.option.textStyle.fontSize = 14 * this.settings.fontSize / 100;
			
			// overwrite background if not set (dark mode is not transparent)
			if(typeof this.option.backgroundColor === 'undefined')
				this.option.backgroundColor = 'transparent';
			
			// set dataset defaults if empty
			// source header is false, otherwise first column will be used as dimension name
			if(typeof this.option.dataset === 'undefined') 
				this.option.dataset = {
					source:[],
					sourceHeader:false
				};
			
			// overwrite dataset source with query data (currently only 1 dataset is usable)
			this.option.dataset.source = [];
			for(let i = 0, j = res.payload.rows.length; i < j; i++) {
				
				// apply date|time column display options
				if(this.dateTimeColumnIndexes.length !== 0) {
					for(let x = 0, y = this.dateTimeColumnIndexes.length; x < y; x++) {
						let columnIndex = this.dateTimeColumnIndexes[x];
						let column      = this.columns[columnIndex];
						let value       = res.payload.rows[i].values[columnIndex];
						
						switch(column.display) {
							case 'date':     value = this.getUnixFormat(value,'Y-m-d');     break;
							case 'datetime': value = this.getUnixFormat(value,'Y-m-d H:i'); break;
							case 'time':     value = this.getUtcTimeStringFromUnix(value);  break;
						}
						res.payload.rows[i].values[columnIndex] = value;
					}
				}
				this.option.dataset.source.push(res.payload.rows[i].values);
			}
			this.ready = true;
		}
	}
};