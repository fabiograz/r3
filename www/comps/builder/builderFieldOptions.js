import {
	getDependentModules,
	getItemTitle,
	getValueFromJson,
	setValueInJson
} from '../shared/builder.js';
import {
	getDetailsFromIndexAttributeId,
	getIndexAttributeId,
	isAttributeFiles,
	isAttributeInteger,
	isAttributeRelationship,
	isAttributeString
} from '../shared/attribute.js';

export {MyBuilderFieldOptions as default};

let MyBuilderFieldOptionsChartSerie = {
	name:'my-builder-field-options-chart-serie',
	template:`<tr>
		<td colspan="999">
			<div class="line">
				<select v-model="type">
					<option value="bar"    >{{ capApp.serieTypeBar }}</option>
					<option value="line"   >{{ capApp.serieTypeLine }}</option>
					<option value="pie"    >{{ capApp.serieTypePie }}</option>
					<option value="scatter">{{ capApp.serieTypeScatter }}</option>
				</select>
				<select v-model="columnX">
					<option disabled :value="-1">{{ capApp.serieColumnX }}</option>
					<option v-for="(c,i) in columns" :value="i" >
						{{ getItemTitle(relationIdMap[attributeIdMap[c.attributeId].relationId],attributeIdMap[c.attributeId],c.index,false,false) }}
					</option>
				</select>
				<select v-model="columnY">
					<option disabled :value="-1">{{ capApp.serieColumnY }}</option>
					<option v-for="(c,i) in columns" :value="i" >
						{{ getItemTitle(relationIdMap[attributeIdMap[c.attributeId].relationId],attributeIdMap[c.attributeId],c.index,false,false) }}
					</option>
				</select>
				<select v-model="tooltip">
					<option disabled :value="-1">{{ capApp.serieColumnTooltip }}</option>
					<option v-for="(c,i) in columns" :value="i" >
						{{ getItemTitle(relationIdMap[attributeIdMap[c.attributeId].relationId],attributeIdMap[c.attributeId],c.index,false,false) }}
					</option>
				</select>
				<my-button image="cancel.png"
					@trigger="$emit('remove')"
					:cancel="true"
					:naked="true"
				/>
			</div>
		</td>
	</tr>`,
	props:{
		columns:   { type:Array,  required:true },
		modelValue:{ type:Object, required:true }
	},
	emits:['remove','update:modelValue'],
	computed:{
		columnX:{
			get:function()  { return this.get(['encode',this.type === 'pie' ? 'itemName' : 'x'],0); },
			set:function(v) { this.set(['encode',this.type === 'pie' ? 'itemName' : 'x'],v); }
		},
		columnY:{
			get:function()  { return this.get(['encode',this.type === 'pie' ? 'value' : 'y'],0); },
			set:function(v) { this.set(['encode',this.type === 'pie' ? 'value' : 'y'],v); }
		},
		serie:{
			get:function()  { return this.modelValue; },
			set:function(v) { this.$emit('update:modelValue',v); }
		},
		tooltip:{
			get:function()  { return this.get(['encode','tooltip'],0); },
			set:function(v) { this.set(['encode','tooltip'],v); }
		},
		type:{
			get:function()  { return this.get(['type'],'bar'); },
			set:function(v) { this.set(['type'],v); }
		},
		
		// stores
		relationIdMap: function() { return this.$store.getters['schema/relationIdMap']; },
		attributeIdMap:function() { return this.$store.getters['schema/attributeIdMap']; },
		capApp:        function() { return this.$store.getters.captions.builder.form.chart; }
	},
	methods:{
		// externals
		getItemTitle,
		getValueFromJson,
		setValueInJson,
		
		get:function(nameChain,valueFallback) {
			return this.getValueFromJson(
				JSON.stringify(this.serie),nameChain,valueFallback
			);
		},
		set:function(nameChain,value) {
			let s = JSON.parse(JSON.stringify(this.serie));
			
			// apply encoding fix (differences between serie types)
			if(nameChain.length === 1 && nameChain[0] === 'type') {
				
				if(value === 'pie')
					s.encode = { itemName:-1, tooltip:-1, value:-1 };
				else
					s.encode = { tooltip:-1, x:-1, y:-1 };
			}
			
			this.$emit('update:modelValue',JSON.parse(
				this.setValueInJson(JSON.stringify(s),nameChain,value)
			));
		}
	}
};

let MyBuilderFieldOptionsChart = {
	name:'my-builder-field-options-chart',
	components:{MyBuilderFieldOptionsChartSerie},
	template:`
		<tr>
			<td>{{ capApp.axisType }} X</td>
			<td>
				<select v-model="axisTypeX">
					<option value="category">{{ capApp.axisTypeCategory }}</option>
					<option value="log">{{ capApp.axisTypeLog }}</option>
					<option value="time">{{ capApp.axisTypeTime }}</option>
					<option value="value">{{ capApp.axisTypeValue }}</option>
				</select>
			</td>
		</tr>
		<tr>
			<td>{{ capApp.axisType }} Y</td>
			<td>
				<select v-model="axisTypeY">
					<option value="category">{{ capApp.axisTypeCategory }}</option>
					<option value="log">{{ capApp.axisTypeLog }}</option>
					<option value="time">{{ capApp.axisTypeTime }}</option>
					<option value="value">{{ capApp.axisTypeValue }}</option>
				</select>
			</td>
		</tr>
		
		<!-- chart series -->
		<tr>
			<td>{{ capApp.series }}</td>
			<td class="minimum">
				<my-button image="add.png"
					@trigger="serieAdd"
					:caption="capGen.button.add"
				/>
			</td>
		</tr>
		<my-builder-field-options-chart-serie class="chart-option-serie"
			v-for="(s,i) in series"
			:columns="columns"
			:modelValue="s"
			@remove="serieSet(i,null)"
			@update:modelValue="serieSet(i,$event)"
		/>
		
		<!-- option input -->
		<tr>
			<td colspan="999">
				<p v-html="capApp.help"></p>
				<textarea class="chart-option" spellcheck="false"
					v-model="jsonInput"
					@input="optionInput($event.target.value)"
					:class="{error:jsonBad}"
				/>
			</td>
		</tr>
	`,
	props:{
		columns:   { type:Array,  required:true },
		modelValue:{ type:String, required:true }
	},
	emits:['update:modelValue'],
	data:function() {
		return {
			jsonBad:false,      // JSON validity check failed
			jsonFirstLoad:true, // prettify JSON input on first load
			jsonInput:''        // separated to execute JSON validity checking
		};
	},
	computed:{
		axisTypeX:{
			get:function()  { return this.getValueFromJson(this.option,['xAxis','type'],'category'); },
			set:function(v) { this.option = this.setValueInJson(this.option,['xAxis','type'],v); }
		},
		axisTypeY:{
			get:function()  { return this.getValueFromJson(this.option,['yAxis','type'],'value'); },
			set:function(v) { this.option = this.setValueInJson(this.option,['yAxis','type'],v); }
		},
		series:{
			get:function()  { return this.getValueFromJson(this.option,['series'],[]); },
			set:function(v) {}
		},
		option:{
			get:function()  { return this.modelValue; },
			set:function(v) { this.$emit('update:modelValue',v); }
		},
		
		// stores
		capApp:function() { return this.$store.getters.captions.builder.form.chart; },
		capGen:function() { return this.$store.getters.captions.generic; }
	},
	watch:{
		option:{
			handler:function(v) {
				if(this.jsonFirstLoad) {
					this.jsonInput     = JSON.stringify(JSON.parse(v),null,2);
					this.jsonFirstLoad = false;
					return;
				}
				this.jsonInput = v;
			},
			immediate:true
		}
	},
	methods:{
		// externals
		getValueFromJson,
		setValueInJson,
		
		// actions
		optionInput:function(v) {
			try{
				let o = JSON.parse(v);
				
				this.option  = v;
				this.jsonBad = false;
			}
			catch(e) {
				this.jsonBad = true;
			}
		},
		serieAdd:function() {
			let series = this.getValueFromJson(this.option,['series'],[]);
			series.push({
				type:'bar',
				encode:{
					tooltip:-1,
					x:-1,
					y:-1
				}
			});
			this.option = this.setValueInJson(this.option,['series'],series);
		},
		serieSet:function(i,value) {
			let series = this.getValueFromJson(this.option,['series'],[]);
			
			if(value === null) series.splice(i,1);
			else               series[i] = value;
			
			this.option = this.setValueInJson(this.option,['series'],series);
		}
	}
};

let MyBuilderFieldOptions = {
	name:'my-builder-field-options',
	components:{MyBuilderFieldOptionsChart},
	template:`<div class="options">
		<table class="fullWidth default-inputs"><tbody>
			<tr>
				<td>{{ capApp.onMobile }}</td>
				<td>
					<my-bool
						@update:modelValue="set('onMobile',$event)"
						:modelValue="field.onMobile"
					/>
				</td>
			</tr>
			<tr>
				<td>{{ capApp.state }}</td>
				<td>
					<select
						@input="set('state',$event.target.value)"
						:value="field.state"
					>
						<option value="hidden">{{ capApp.stateHidden }}</option>
						<option value="default">{{ capApp.stateDefault }}</option>
						<option v-if="isData" value="optional">{{ capApp.stateOptional }}</option>
						<option v-if="isData" value="readonly">{{ capApp.stateReadonly }}</option>
						<option v-if="isData" value="required">{{ capApp.stateRequired }}</option>
					</select>
				</td>
			</tr>
			
			<tr v-if="isHeader">
				<td>{{ capApp.headerSize }}</td>
				<td>
					<select
						@input="setInt('size',$event.target.value,false)"
						:value="field.size"
					>
						<option value="1">h1</option>
						<option value="2">h2</option>
						<option value="3">h3</option>
					</select>
				</td>
			</tr>
			
			<template v-if="isData">
				<tr v-if="!isFiles && !isRelationship">
					<td>{{ capApp.fieldDefault }}</td>
					<td>
						<input
							@input="set('def',$event.target.value)"
							:placeholder="capApp.fieldDefaultHint"
							:value="field.def"
						/>
					</td>
				</tr>
				<tr v-if="!isRelationship">
					<td>{{ capApp.fieldMin }}</td>
					<td>
						<input
							@input="setInt('min',$event.target.value,true)"
							:value="field.min"
						/>
					</td>
				</tr>
				<tr v-if="!isRelationship">
					<td>{{ capApp.fieldMax }}</td>
					<td>
						<input
							@input="setInt('max',$event.target.value,true)"
							:value="field.max"
						/>
					</td>
				</tr>
				<tr v-if="!isRelationship">
					<td>{{ capApp.display }}</td>
					<td>
						<select
							@input="set('display',$event.target.value)"
							:value="field.display"
						>
							<option value="default">{{ capApp.option.displayDefault }}</option>
							<option v-if="isInteger" value="datetime">{{ capApp.option.displayDatetime }}</option>
							<option v-if="isInteger" value="date"    >{{ capApp.option.displayDate }}</option>
							<option v-if="isInteger" value="time"    >{{ capApp.option.displayTime }}</option>
							<option v-if="isInteger" value="slider"  >{{ capApp.option.displaySlider }}</option>
							<option v-if="isInteger" value="login"   >{{ capApp.option.displayLogin }}</option>
							<option v-if="isString"  value="textarea">{{ capApp.option.displayTextarea }}</option>
							<option v-if="isString"  value="richtext">{{ capApp.option.displayRichtext }}</option>
							<option v-if="isString"  value="color"   >{{ capApp.option.displayColor }}</option>
							<option v-if="isString"  value="email"   >{{ capApp.option.displayEmail }}</option>
							<option v-if="isString"  value="phone"   >{{ capApp.option.displayPhone }}</option>
							<option v-if="isString"  value="url"     >{{ capApp.option.displayUrl }}</option>
							<option v-if="isFiles"   value="gallery" >{{ capApp.option.displayGallery }}</option>
						</select>
					</td>
				</tr>
				<tr v-if="!isRelationship">
					<td>{{ capApp.fieldRegexCheck }}</td>
					<td>
						<input
							@input="setNull('regexCheck',$event.target.value)"
							:value="field.regexCheck"
						/>
					</td>
				</tr>
				<tr v-if="isString && field.display === 'richtext'">
					<td>{{ capApp.fieldAttributeIdAltRichtextFiles }}</td>
					<td>
						<select
							@input="set('attributeIdAlt',$event.target.value)"
							:value="field.attributeIdAlt"
						>
							<option :value="null">-</option>
							<option
								v-for="a in relationIdMap[joinsIndexMap[field.index].relationId].attributes.filter(v => isAttributeFiles(v.content))"
								:value="a.id"
							>
								{{ a.name }}
							</option>
						</select>
					</td>
				</tr>
				<tr v-if="isDate || isDatetime">
					<td>{{ capApp.fieldAttributeIdAltDateTo }}</td>
					<td>
						<select
							@input="set('attributeIdAlt',$event.target.value)"
							:value="field.attributeIdAlt"
						>
							<option :value="null">-</option>
							<option
								v-for="a in relationIdMap[joinsIndexMap[field.index].relationId].attributes.filter(v => v.id !== field.attributeId && isAttributeInteger(v.content))"
								:value="a.id"
							>
								{{ a.name }}
							</option>
						</select>
					</td>
				</tr>
				<template v-if="isRelationship">
					<tr>
						<td>{{ capApp.category }}</td>
						<td>
							<my-bool
								@update:modelValue="set('category',$event)"
								:modelValue="field.category"
							/>
						</td>
					</tr>
					<tr>
						<td>{{ capApp.filterQuick }}</td>
						<td>
							<my-bool
								@update:modelValue="set('filterQuick',$event)"
								:modelValue="field.filterQuick"
							/>
						</td>
					</tr>
					<tr>
						<td>{{ capApp.autoSelect }}</td>
						<td>
						<input
							@input="setInt('autoSelect',$event.target.value,false)"
							:placeholder="capApp.autoSelectHint"
							:value="field.autoSelect"
						/>
						</td>
					</tr>
					<tr>
						<td>{{ capApp.fieldDefaultPresetIds }}</td>
						<td>
							<select @change="presetIdAdd($event.target.value)">
								<option value="">-</option>
								<template v-for="p in presetIdMap">
									<option
										v-if="!field.defPresetIds.includes(p.id)"
										:key="p.id"
										:value="p.id"
									>{{ p.name }}</option>
								</template>
							</select>
							
							<my-button image="cancel.png"
								v-for="presetId in field.defPresetIds"
								@trigger="presetIdRemove(presetId)"
								:caption="presetIdMap[presetId].name"
								:key="presetId"
							/>
						</td>
					</tr>
				</template>
			</template>
			
			<template v-if="isCalendar">
				<tr>
					<td>{{ capApp.date0 }}</td>
					<td>
						<select
							@input="setIndexAttribute('date0',$event.target.value)"
							:value="getIndexAttributeId(field.indexDate0,field.attributeIdDate0,false,null)"
						>
							<option :value="null">-</option>
							<optgroup
								v-for="j in field.query.joins"
								:label="j.index+') '+relationIdMap[j.relationId].name"
							>
								<option
									v-for="a in relationIdMap[j.relationId].attributes.filter(v => isAttributeInteger(v.content))"
									:value="getIndexAttributeId(j.index,a.id,false,null)"
								>
									{{ a.name }}
								</option>
							</optgroup>
						</select>
					</td>
				</tr>
				<tr>
					<td>{{ capApp.date1 }}</td>
					<td>
						<select
							@input="setIndexAttribute('date1',$event.target.value)"
							:value="getIndexAttributeId(field.indexDate1,field.attributeIdDate1,false,null)"
						>
							<option :value="null">-</option>
							<optgroup
								v-for="j in field.query.joins"
								:label="j.index+') '+relationIdMap[j.relationId].name"
							>
								<option
									v-for="a in relationIdMap[j.relationId].attributes.filter(v => isAttributeInteger(v.content))"
									:value="getIndexAttributeId(j.index,a.id,false,null)"
								>
									{{ a.name }}
								</option>
							</optgroup>
						</select>
					</td>
				</tr>
				<tr>
					<td>{{ capApp.dateColor }}</td>
					<td>
						<select
							@input="setIndexAttribute('color',$event.target.value)"
							:value="getIndexAttributeId(field.indexColor,field.attributeIdColor,false,null)"
						>
							<option :value="null">-</option>
							<optgroup
								v-for="j in field.query.joins"
								:label="j.index+') '+relationIdMap[j.relationId].name"
							>
								<option
									v-for="a in relationIdMap[j.relationId].attributes.filter(v => isAttributeString(v.content))"
									:value="getIndexAttributeId(j.index,a.id,false,null)"
								>
									{{ a.name }}
								</option>
							</optgroup>
						</select>
					</td>
				</tr>
				<tr>
					<td>{{ capApp.gantt }}</td>
					<td>
						<my-bool
							@update:modelValue="set('gantt',$event)"
							:modelValue="field.gantt"
							:readonly="field.ics"
						/>
					</td>
				</tr>
				<template v-if="field.gantt">
					<tr>
						<td></td>
						<td><i>{{ capApp.ganttNotes }}</i></td>
					</tr>
					<tr>
						<td>{{ capApp.ganttSteps }}</td>
						<td>
							<select
								@input="setNull('ganttSteps',$event.target.value)"
								:value="field.ganttSteps"
							>
								<option value="days" >{{ capApp.option.ganttStepsDays }}</option>
								<option value="hours">{{ capApp.option.ganttStepsHours }}</option>
							</select>
						</td>
					</tr>
					<tr>
						<td>{{ capApp.ganttStepsToggle }}</td>
						<td>
							<my-bool
								@update:modelValue="set('ganttStepsToggle',$event)"
								:modelValue="field.ganttStepsToggle"
							/>
						</td>
					</tr>
				</template>
				<tr>
					<td>{{ capApp.ics }}</td>
					<td>
						<my-bool
							@update:modelValue="set('ics',$event)"
							:modelValue="field.ics"
							:readonly="field.gantt"
						/>
					</td>
				</tr>
				<template v-if="field.ics">
					<tr>
						<td>{{ capApp.dateRange0 }}</td>
						<td>
							<input
								@input="setInt('dateRange0',$event.target.value * 86400,false)"
								:placeholder="capApp.dateRangeHint"
								:value="field.dateRange0 / 86400"
							/>
						</td>
					</tr>
					<tr>
						<td>{{ capApp.dateRange1 }}</td>
						<td>
							<input
								@input="setInt('dateRange1',$event.target.value * 86400,false)"
								:placeholder="capApp.dateRangeHint"
								:value="field.dateRange1 / 86400"
							/>
						</td>
					</tr>
				</template>
			</template>
			
			<template v-if="isContainer">
				<tr>
					<td>{{ capApp.fieldSize }}</td>
					<td>
						<input
							v-if="field.basis !== 0"
							@input="setInt('basis',$event.target.value,false)"
							:value="field.basis"
						/>
						<my-button
							v-else
							@trigger="setInt('basis',300,false)"
							:caption="capApp.fieldSize0"
							:naked="true"
						/>
					</td>
				</tr>
				<tr>
					<td>{{ capApp.flexSizeGrow }}</td>
					<td>
						<input
							@input="setInt('grow',$event.target.value,false)"
							:value="field.grow"
						/>
					</td>
				</tr>
				<tr v-if="field.basis !== 0">
					<td>{{ capApp.flexSizeMax }}</td>
					<td>
						<input
							@input="setInt('perMax',$event.target.value,false)"
							:value="field.perMax"
						/>
					</td>
				</tr>
				<tr>
					<td>{{ capApp.flexSizeShrink }}</td>
					<td>
						<input
							@input="setInt('shrink',$event.target.value,false)"
							:value="field.shrink"
						/>
					</td>
				</tr>
				<tr v-if="field.basis !== 0">
					<td>{{ capApp.flexSizeMin }}</td>
					<td>
						<input
							@input="setInt('perMin',$event.target.value,false)"
							:value="field.perMin"
						/>
					</td>
				</tr>
				<tr>
					<td colspan="999"><b>{{ capApp.containerContentLayout }}</b></td>
				</tr>
				<tr>
					<td>{{ capApp.fieldDirection }}</td>
					<td>
						<select
							@input="set('direction',$event.target.value)"
							:value="field.direction"
						>
							<option value="row">row</option>
							<option value="column">column</option>
						</select>
					</td>
				</tr>
				<tr>
					<td>{{ capApp.flexWrap }}</td>
					<td>
						<my-bool
							@update:modelValue="set('wrap',$event)"
							:modelValue="field.wrap"
						/>
					</td>
				</tr>
				<tr>
					<td>{{ capApp.flexJustifyContent }}</td>
					<td>
						<select
							@input="set('justifyContent',$event.target.value)"
							:value="field.justifyContent"
						>
							<option value="flex-start">flex-start</option>
							<option value="flex-end">flex-end</option>
							<option value="center">center</option>
							<option value="space-between">space-between</option>
							<option value="space-around">space-around</option>
							<option value="space-evenly">space-evenly</option>
						</select>
					</td>
				</tr>
				<tr>
					<td>{{ capApp.flexAlignItems }}</td>
					<td>
						<select
							@input="set('alignItems',$event.target.value)"
							:value="field.alignItems"
						>
							<option value="flex-start">flex-start</option>
							<option value="flex-end">flex-end</option>
							<option value="center">center</option>
							<option value="baseline">baseline</option>
							<option value="stretch">stretch</option>
						</select>
					</td>
				</tr>
				<tr>
					<td>{{ capApp.flexAlignContent }}</td>
					<td>
						<select
							@input="set('alignContent',$event.target.value)"
							:value="field.alignContent"
						>
							<option value="flex-start">flex-start</option>
							<option value="flex-end">flex-end</option>
							<option value="center">center</option>
							<option value="space-between">space-between</option>
							<option value="space-around">space-around</option>
							<option value="stretch">stretch</option>
						</select>
					</td>
				</tr>
			</template>
			
			<template v-if="isList">
				<tr>
					<td>{{ capApp.display }}</td>
					<td>
						<select
							@input="set('layout',$event.target.value)"
							:value="field.layout"
						>
							<option value="table">table</option>
							<option value="cards">cards</option>
						</select>
					</td>
				</tr>
				<tr>
					<td>{{ capApp.limit }}</td>
					<td>
						<input
							@input="setInt('resultLimit',$event.target.value,false)"
							:value="field.resultLimit"
						/>
					</td>
				</tr>
				<tr>
					<td>{{ capApp.autoRenew }}</td>
					<td>
						<input
							v-if="field.autoRenew !== null"
							@input="setInt('autoRenew',$event.target.value,true)"
							:placeholder="capApp.autoRenewHint"
							:value="field.autoRenew"
						/>
						<my-button
							v-else
							@trigger="setInt('autoRenew',300,false)"
							:caption="capApp.autoRenew0"
							:naked="true"
						/>
					</td>
				</tr>
				<tr>
					<td>{{ capApp.csvImport }}</td>
					<td>
						<my-bool
							@update:modelValue="set('csvImport',$event)"
							:modelValue="field.csvImport"
						/>
					</td>
				</tr>
				<tr>
					<td>{{ capApp.csvExport }}</td>
					<td>
						<my-bool
							@update:modelValue="set('csvExport',$event)"
							:modelValue="field.csvExport"
						/>
					</td>
				</tr>
				<tr>
					<td>{{ capApp.filterQuick }}</td>
					<td>
						<my-bool
							@update:modelValue="set('filterQuick',$event)"
							:modelValue="field.filterQuick"
						/>
					</td>
				</tr>
			</template>
			
			<!-- chart options -->
			<my-builder-field-options-chart
				v-if="isChart"
				@update:modelValue="set('chartOption',$event)"
				:columns="field.columns"
				:modelValue="field.chartOption"
			/>
			
			<!-- open form with no record -->
			<template v-if="isButton">
				<tr>
					<td>{{ capApp.formOpenEmpty }}</td>
					<td>
						<select
							@input="setNull('formIdOpen',$event.target.value)"
							:value="field.formIdOpen"
						>
							<option value="">-</option>
							<optgroup
								v-for="mod in getDependentModules(module,modules)"
								:label="mod.name"
							>
								<option v-for="f in mod.forms" :value="f.id">
									{{ f.name }}
								</option>
							</optgroup>
						</select>
					</td>
				</tr>
			</template>
			
			<!-- open form with record -->
			<tr v-if="(isList || isCalendar || isRelationship) && field.query.relationId !== null">
				<td>{{ capApp.formOpen }}</td>
				<td>
					<select
						@input="setNull('formIdOpen',$event.target.value)"
						:value="field.formIdOpen"
					>
						<option value="">-</option>
						<optgroup
							v-for="mod in getDependentModules(module,modules)"
							:label="mod.name"
						>
							<option
								v-for="f in mod.forms.filter(v => v.query.relationId === field.query.relationId)"
								:value="f.id"
							>
								{{ f.name }}
							</option>
						</optgroup>
					</select>
				</td>
			</tr>
			
			<!-- apply record value as attribute value for opened form -->
			<tr v-if="isFormOpenWithAttribute">
				<td>{{ capApp.attributeRecord }}</td>
				<td>
					<select
						@input="setNull('attributeIdRecord',$event.target.value)"
						:value="field.attributeIdRecord"
					>
						<option value=""></option>
						<optgroup
							v-for="mod in getDependentModules(module,modules)"
							:label="mod.name"
						>
							<template v-for="r in mod.relations">
								<option
									v-for="a in r.attributes.filter(v => attributeIdsReferToFormRelation.includes(v.id))"
									:value="a.id"
								>
									{{ r.name + '.' + a.name }}
								</option>
							</template>
						</optgroup>
					</select>
				</td>
			</tr>
		</tbody></table>
	</div>`,
	props:{
		builderLanguage:{ type:String,  required:true },
		dataFields:     { type:Array,   required:true },
		field:          { type:Object,  required:true },
		joinsIndexMap:  { type:Object,  required:true },
		moduleId:       { type:String,  required:true }
	},
	emits:['set'],
	computed:{
		attribute:function() {
			if(!this.isData || typeof this.attributeIdMap[this.field.attributeId] === 'undefined')
				return false;
			
			return this.attributeIdMap[this.field.attributeId];
		},
		attributeIdsReferToFormRelation:function() {
			if(typeof this.joinsIndexMap['0'] === 'undefined') return [];
			
			let atrIds = [];
			let relId  = this.joinsIndexMap['0'].relationId;
			
			for(let k in this.attributeIdMap) {
				let a = this.attributeIdMap[k];
				
				if(!this.isAttributeRelationship(a.content))
					continue;
				
				if(a.relationshipId === relId)
					atrIds.push(a.id);
			}
			return atrIds;
		},
		presetIdMap:function() {
			if(!this.isRelationship)
				return {};
			
			let nm = this.field.attributeIdNm !== null;
			let trgAtrId = nm ? this.field.attributeIdNm : this.field.attributeId;
			
			let presets = !this.field.outsideIn || nm
				? this.relationIdMap[this.attributeIdMap[trgAtrId].relationshipId].presets
				: this.relationIdMap[this.attributeIdMap[trgAtrId].relationId].presets
			;
			
			let map = {};
			for(let i = 0, j = presets.length; i < j; i++) {
				map[presets[i].id] = presets[i];
			}
			return map;
		},
		
		// simple states
		hasCaption:   function() { return this.isData || this.isHeader; },
		isButton:     function() { return this.field.content === 'button'; },
		isCalendar:   function() { return this.field.content === 'calendar'; },
		isChart:      function() { return this.field.content === 'chart'; },
		isContainer:  function() { return this.field.content === 'container'; },
		isData:       function() { return this.field.content === 'data'; },
		isDate:       function() { return this.isData && this.field.display === 'date'; },
		isDatetime:   function() { return this.isData && this.field.display === 'datetime'; },
		isHeader:     function() { return this.field.content === 'header'; },
		isList:       function() { return this.field.content === 'list'; },
		isQuery:      function() { return this.isCalendar || this.isChart || this.isList || this.isRelationship },
		isFiles:function() {
			return this.isData && this.isAttributeFiles(this.attribute.content);
		},
		isInteger:function() {
			return this.isData && this.isAttributeInteger(this.attribute.content);
		},
		isRelationship:function() {
			return this.isData && this.isAttributeRelationship(this.attribute.content);
		},
		isString:function() {
			return this.isData && this.isAttributeString(this.attribute.content);
		},
		isFormOpenWithAttribute:function() {
			return typeof this.field.attributeIdRecord !== 'undefined' &&
				typeof this.field.formIdOpen !== 'undefined' && this.field.formIdOpen !== null;
		},
		
		// stores
		module:        function() { return this.moduleIdMap[this.moduleId]; },
		modules:       function() { return this.$store.getters['schema/modules']; },
		moduleIdMap:   function() { return this.$store.getters['schema/moduleIdMap']; },
		relationIdMap: function() { return this.$store.getters['schema/relationIdMap']; },
		attributeIdMap:function() { return this.$store.getters['schema/attributeIdMap']; },
		formIdMap:     function() { return this.$store.getters['schema/formIdMap']; },
		capApp:        function() { return this.$store.getters.captions.builder.form; }
	},
	methods:{
		// externals
		getDependentModules,
		getDetailsFromIndexAttributeId,
		getIndexAttributeId,
		isAttributeFiles,
		isAttributeInteger,
		isAttributeRelationship,
		isAttributeString,
		
		// actions
		presetIdAdd:function(value) {
			let ids = JSON.parse(JSON.stringify(this.field.defPresetIds));
			
			if(ids.includes(value))
				return;
			
			ids.push(value);
			this.set('defPresetIds',ids);
		},
		presetIdRemove:function(value) {
			let ids = JSON.parse(JSON.stringify(this.field.defPresetIds));
			
			let pos = ids.indexOf(value);
			if(pos === -1)
				return;
			
			ids.splice(pos,1);
			this.set('defPresetIds',ids);
		},
		setInt:function(name,val,allowNull) {
			if(val !== '')
				return this.set(name,parseInt(val));
			
			if(allowNull) return this.set(name,null);
			else          return this.set(name,0);
		},
		setNull:function(name,val) {
			this.set(name,val === '' ? null : val);
		},
		setIndexAttribute:function(name,indexAttributeId) {
			let values = this.getDetailsFromIndexAttributeId(indexAttributeId);
			
			switch(name) {
				case 'dateTo':
					this.set('attributeIdAlt',values.attributeId);
				break;
				case 'date0':
					this.set('attributeIdDate0',values.attributeId);
					this.set('indexDate0',values.index);
				break;
				case 'date1':
					this.set('attributeIdDate1',values.attributeId);
					this.set('indexDate1',values.index);
				break;
				case 'color':
					this.set('attributeIdColor',values.attributeId);
					this.set('indexColor',values.index);
				break;
			}
		},
		set:function(name,val) {
			if(name === 'csvImport' && !val) {
				// no CSV import, clear query lookups
				let q = JSON.parse(JSON.stringify(this.field.query));
				q.lookups = [];
				this.$emit('set','query',q);
			}
			if(name === 'gantt') {
				// gantt, set or remove gantt step option
				if(!val) this.$emit('set','ganttSteps',null);
				else     this.$emit('set','ganttSteps','days');
			}
			this.$emit('set',name,val);
		}
	}
};