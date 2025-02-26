import {isAttributeRelationship} from '../shared/attribute.js';
import {getNilUuid}              from '../shared/generic.js';
export {MyBuilderPreset as default};

let MyBuilderPresetValue = {
	name:'my-builder-preset-value',
	template:`<tr>
		<td><span>{{ attribute.name }}</span></td>
		<td>
			<select v-if="isRelationship" v-model="presetIdReferInput">
				<option :value="null">[{{ attribute.content }}]</option>
				<option v-for="p in relationship.presets" :value="p.id">
					{{ relationship.name + '->' + p.name }}
				</option>
			</select>
			
			<textarea
				v-if="!isRelationship"
				v-model="valueInput"
				:placeholder="attribute.content"
			></textarea>
		</td>
		<td><my-bool v-model="protectedInput" /></td>
	</tr>`,
	props:{
		attribute:    { type:Object, required:true },
		presetIdRefer:{ required:true },
		protected:    { type:Boolean,required:true },
		value:        { type:String, required:true }
	},
	emits:['set'],
	computed:{
		isRelationship:function() {
			return this.isAttributeRelationship(this.attribute.content);
		},
		relationship:function() {
			if(!this.isRelationship)
				return false;
			
			return this.relationIdMap[this.attribute.relationshipId];
		},
		
		// inputs
		presetIdReferInput:{
			get:function()  { return this.presetIdRefer; },
			set:function(v) { return this.$emit('set',v,this.protected,this.value); }
		},
		protectedInput:{
			get:function()  { return this.protected; },
			set:function(v) { return this.$emit('set',this.presetIdRefer,v,this.value); }
		},
		valueInput:{
			get:function()  { return this.value; },
			set:function(v) { return this.$emit('set',this.presetIdRefer,this.protected,v); }
		},
		
		// stores
		relationIdMap:function() { return this.$store.getters['schema/relationIdMap']; }
	},
	methods:{
		isAttributeRelationship
	}
};

let MyBuilderPreset = {
	name:'my-builder-preset',
	components:{MyBuilderPresetValue},
	template:`<tbody class="builder-preset">
		<tr>
			<td>
				<input v-model="name" :placeholder="isNew ? capApp.new : ''" />
			</td>
			<td><my-bool v-model="protected" /></td>
			<td class="minimum">
				<my-button
					@trigger="showValues = !showValues"
					:caption="capApp.valueCount.replace('{CNT}',values.length)"
				/>
			</td>
			<td>
				<input disabled="readonly" :value="previewLine" />
			</td>
			<td>
				<div class="row">
					<my-button image="save.png"
						@trigger="set"
						:active="hasChanges"
					/>
					<my-button image="delete.png"
						v-if="!isNew"
						@trigger="delAsk"
						:cancel="true"
					/>
				</div>
			</td>
		</tr>
		<tr v-if="showValues">
			<td colspan="999">
				<div class="preset-values">
					<table>
						<thead>
							<tr>
								<th colspan="2" class="no-padding">{{ capApp.value }}</th>
								<th>{{ capApp.protected }}</th>
							</tr>
						</thead>
						<tbody>
							<my-builder-preset-value
								v-for="(a,i) in relation.attributes.filter(v => v.name !== 'id')"
								@set="(...args) => childSet(a.id,...args)"
								:attribute="a"
								:key="a.id"
								:preset-id-refer="childGet(a.id,'presetIdRefer')"
								:protected="childGet(a.id,'protected')"
								:value="childGet(a.id,'value')"
							/>
						</tbody>
					</table>
				</div>
			</td>
		</tr>
	</tbody>`,
	props:{
		relation:{ type:Object, required:true },
		preset:{
			type:Object,
			required:false,
			default:function() { return{
				id:null,
				name:'',
				presetIdRefer:null,
				protected:true,
				values:[]
			}}
		}
	},
	data:function() {
		return {
			showValues:false,
			name:this.preset.name,
			protected:this.preset.protected,
			values:JSON.parse(JSON.stringify(this.preset.values))
		};
	},
	computed:{
		hasChanges:function() {
			if(this.name === '')
				return false;
			
			return (this.isNew && this.values.length !== 0)
				|| this.name !== this.preset.name
				|| this.protected !== this.preset.protected
				|| JSON.stringify(this.values) !== JSON.stringify(this.preset.values);
		},
		previewLine:function() {
			let items = [];
			for(let i = 0, j = this.values.length; i < j; i++) {
				let v = this.values[i];
				
				if(v.value !== '')
					items.push(v.value);
			}
			return items.join(', ');
		},
		attributeIdMapValue:function() {
			let map = {};
			for(let i = 0, j = this.values.length; i < j; i++) {
				map[this.values[i].attributeId] = this.values[i];
			}
			return map;
		},
		
		// simple states
		isNew:function() { return this.preset.id === null; },
		
		// stores
		attributeIdMap:function() { return this.$store.getters['schema/attributeIdMap']; },
		capApp:        function() { return this.$store.getters.captions.builder.preset; },
		capGen:        function() { return this.$store.getters.captions.generic; }
	},
	methods:{
		// externals
		getNilUuid,
		isAttributeRelationship,
		
		childGet:function(atrId,mode) {
			let exists = typeof this.attributeIdMapValue[atrId] !== 'undefined';
			
			switch(mode) {
				case 'presetIdRefer':
					return exists ? this.attributeIdMapValue[atrId].presetIdRefer : null;
				break;
				case 'protected':
					return exists ? this.attributeIdMapValue[atrId].protected : true;
				break;
				case 'value':
					return exists ? this.attributeIdMapValue[atrId].value : '';
				break;
			}
			return false;
		},
		childSet:function(atrId,presetIdRefer,protec,value) {
			let atr = this.attributeIdMap[atrId];
			
			// no preset value yet for attribute, create one
			if(typeof this.attributeIdMapValue[atrId] === 'undefined') {
				this.values.push({
					id:this.getNilUuid(),
					attributeId:atrId,
					presetIdRefer:presetIdRefer,
					protected:protec,
					value:value
				});
				return;
			}
			
			// update existing preset value
			for(let i = 0, j = this.values.length; i < j; i++) {
				if(this.values[i].attributeId !== atrId)
					continue;
				
				// remove preset value if nothing is set
				if((this.isAttributeRelationship(atr.content) && presetIdRefer === null)
					|| (!this.isAttributeRelationship(atr.content) && value === '')) {
					
					this.values.splice(i,1);
					break;
				}
				
				this.values[i].presetIdRefer = presetIdRefer;
				this.values[i].protected     = protec;
				this.values[i].value         = value;
				break;
			}
		},
		
		// backend calls
		delAsk:function() {
			this.$store.commit('dialog',{
				captionBody:this.capApp.dialog.delete,
				buttons:[{
					cancel:true,
					caption:this.capGen.button.delete,
					exec:this.del,
					image:'delete.png'
				},{
					caption:this.capGen.button.cancel,
					image:'cancel.png'
				}]
			});
		},
		del:function(rel) {
			let trans = new wsHub.transactionBlocking();
			trans.add('preset','del',{
				id:this.preset.id
			},this.delOk);
			trans.send(this.$root.genericError);
		},
		delOk:function(res) {
			this.$root.schemaReload(this.relation.moduleId);
		},
		set:function() {
			let trans = new wsHub.transactionBlocking();
			trans.add('preset','set',{
				id:this.preset.id,
				relationId:this.relation.id,
				name:this.name,
				protected:this.protected,
				values:this.values
			},this.setOk);
			trans.send(this.$root.genericError);
		},
		setOk:function() {
			if(this.isNew) {
				this.name   = '';
				this.values = [];
			}
			this.$root.schemaReload(this.relation.moduleId);
		}
	}
};