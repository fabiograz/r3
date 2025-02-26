import MyBuilderCaption      from './builderCaption.js';
import MyBuilderIconInput    from './builderIconInput.js';
import {getDependentModules} from '../shared/builder.js';
import {
	isAttributeBoolean,
	isAttributeFiles,
	isAttributeFloat,
	isAttributeInteger,
	isAttributeNumeric,
	isAttributeRelationship,
	isAttributeString
} from '../shared/attribute.js';
export {MyBuilderAttribute as default};

let MyBuilderAttribute = {
	name:'my-builder-attribute',
	components:{
		MyBuilderCaption,
		MyBuilderIconInput
	},
	template:`<tr>
		<td>
			<my-builder-icon-input
				@input="iconId = $event"
				:icon-id-selected="iconId"
				:module="module"
				:readonly="foreign"
			/>
		</td>
		<td>
			<input
				v-model="name"
				:placeholder="isNew ? capApp.new : ''"
				:disabled="foreign || isId"
			/>
		</td>
		<td class="minimum">
			<my-button image="visible1.png"
				@trigger="showInfo"
				:active="!isNew"
			/>
		</td>
		<td>
			<my-builder-caption
				v-model="captions.attributeTitle"
				:language="builderLanguage"
				:readonly="foreign"
			/>
		</td>
		<td>
			<select v-model="content" :disabled="foreign">
				<option v-if="isNew || isAttributeInteger(content)" value="integer">integer</option>
				<option v-if="isNew || isAttributeInteger(content)" value="bigint">bigint</option>
				<option v-if="isNew || isAttributeNumeric(content)" value="numeric">numeric</option>
				<option v-if="isNew || isAttributeFloat(content)"   value="real">real</option>
				<option v-if="isNew || isAttributeFloat(content)"   value="double precision">double precision</option>
				<option v-if="isNew || isAttributeString(content)"  value="varchar">varchar</option>
				<option v-if="isNew || isAttributeString(content)"  value="text">text</option>
				<option v-if="isNew || isAttributeBoolean(content)" value="boolean">boolean</option>
				<option v-if="isNew || isAttributeFiles(content)"   value="files">files</option>
				<option v-if="isNew || isAttributeRelationship(content)" value="1:1">1:1</option>
				<option v-if="isNew || isAttributeRelationship(content)" value="n:1">
					{{ !foreign ? 'n:1' : '1:n' }}
				</option>
			</select>
		</td>
		<td>
			<select
				v-model="relationshipId"
				:disabled="!isNew || foreign || !isRelationship || isId"
			>
				<option :value="null">-</option>
				<option v-for="rel in module.relations" :value="rel.id">
					{{ !foreign ? rel.name : module.name + ': ' + rel.name }}
				</option>
				
				<!-- relations from other modules -->
				<optgroup
					v-for="mod in getDependentModules(module,modules).filter(v => v.id !== module.id && v.relations.length !== 0)"
					:label="mod.name"
				>
					<option v-for="rel in mod.relations" :value="rel.id">
						{{ mod.name + ': ' + rel.name }}
					</option>
				</optgroup>
			</select>
		</td>
		<td>
			<input class="short"
				v-model.number="length"
				:disabled="foreign || isId || !hasLength"
			/>
		</td>
		<td>
			<my-bool
				v-model="nullable"
				:readonly="foreign || isId"
			/>
		</td>
		<td>
			<input placeholder="NO DEFAULT"
				v-if="!isId"
				v-model="def"
				:disabled="foreign || isId"
			/>
			<input v-if="isId" placeholder="SYSTEM" disabled="disabled" />
		</td>
		<td>
			<select v-model="onUpdate" :disabled="foreign || !isRelationship || isId">
				<option v-if="!isRelationship" value="">-</option>
				<template v-if="isRelationship">
					<option value="NO ACTION">NO ACTION</option>
					<option value="RESTRICT">RESTRICT</option>
					<option value="CASCADE">CASCADE</option>
					<option value="SET NULL">SET NULL</option>
					<option value="SET DEFAULT">SET DEFAULT</option>
				</template>
			</select>
		</td>
		<td>
			<select v-model="onDelete" :disabled="foreign || !isRelationship || isId">
				<option v-if="!isRelationship" value="">-</option>
				<template v-if="isRelationship">
					<option value="NO ACTION">NO ACTION</option>
					<option value="RESTRICT">RESTRICT</option>
					<option value="CASCADE">CASCADE</option>
					<option value="SET NULL">SET NULL</option>
					<option value="SET DEFAULT">SET DEFAULT</option>
				</template>
			</select>
		</td>
		<td>
			<div class="row">
				<my-button image="save.png"
					@trigger="set"
					:active="hasChanges && !foreign"
				/>
				<my-button image="delete.png"
					v-if="!isNew"
					@trigger="delAsk"
					:active="!isId"
					:cancel="true"
				/>
			</div>
		</td>
	</tr>`,
	props:{
		attribute:{
			type:Object,
			required:false,
			default:function() { return{
				id:null,
				relationshipId:null,
				iconId:null,
				content:'integer',
				length:0,
				name:'',
				nullable:true,
				def:'',
				onUpdate:'NO ACTION',
				onDelete:'NO ACTION',
				captions:{
					attributeTitle:{}
				}
			}}
		},
		builderLanguage:{ type:String,  required:true },
		relation:       { type:Object,  required:true },
		foreign:        { type:Boolean, required:true }
	},
	data:function() {
		return {
			relationshipId:!this.foreign ? this.attribute.relationshipId : this.attribute.relationId,
			iconId:this.attribute.iconId,
			content:this.attribute.content,
			length:this.attribute.length,
			name:this.attribute.name,
			nullable:this.attribute.nullable,
			def:this.attribute.def,
			onUpdate:this.attribute.onUpdate,
			onDelete:this.attribute.onDelete,
			captions:JSON.parse(JSON.stringify(this.attribute.captions))
		};
	},
	computed:{
		hasChanges:function() {
			return this.iconId !== this.attribute.iconId
				|| this.relationshipId !== this.attribute.relationshipId
				|| this.content !== this.attribute.content
				|| this.length !== this.attribute.length
				|| this.name !== this.attribute.name
				|| this.nullable !== this.attribute.nullable
				|| this.def !== this.attribute.def
				|| this.onUpdate !== this.attribute.onUpdate
				|| this.onDelete !== this.attribute.onDelete
				|| JSON.stringify(this.captions) !== JSON.stringify(this.attribute.captions)
			;
		},
		
		// simple states
		hasLength:     function() { return ['varchar','text','files'].includes(this.content); },
		isId:          function() { return !this.isNew && this.attribute.name === 'id'; },
		isNew:         function() { return this.attribute.id === null; },
		isRelationship:function() { return this.isAttributeRelationship(this.content); },
		
		// stores
		module:       function() { return this.moduleIdMap[this.relation.moduleId]; },
		modules:      function() { return this.$store.getters['schema/modules']; },
		moduleIdMap:  function() { return this.$store.getters['schema/moduleIdMap']; },
		relationIdMap:function() { return this.$store.getters['schema/relationIdMap']; },
		capApp:       function() { return this.$store.getters.captions.builder.attribute; },
		capGen:       function() { return this.$store.getters.captions.generic; }
	},
	methods:{
		// externals
		isAttributeBoolean,
		isAttributeFiles,
		isAttributeFloat,
		isAttributeInteger,
		isAttributeNumeric,
		isAttributeRelationship,
		isAttributeString,
		getDependentModules,
		
		// actions
		showInfo:function() {
			this.$store.commit('dialog',{
				captionBody:this.attribute.id,
				captionTop:this.attribute.name,
				buttons:[{
					caption:this.capGen.button.cancel,
					image:'cancel.png'
				}]
			});
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
			trans.add('attribute','del',{
				id:this.attribute.id
			},this.delOk);
			trans.send(this.$root.genericError);
		},
		delOk:function(res) {
			this.$root.schemaReload(this.module.id);
		},
		set:function(atr) {
			let trans = new wsHub.transactionBlocking();
			trans.add('attribute','set',{
				id:this.attribute.id,
				moduleId:this.relation.moduleId,
				relationId:this.relation.id,
				relationshipId:this.relationshipId,
				iconId:this.iconId,
				name:this.name,
				content:this.content,
				length:this.length,
				nullable:this.nullable,
				def:this.def,
				onUpdate:this.onUpdate,
				onDelete:this.onDelete,
				captions:this.captions
			},this.setOk);
			trans.add('schema','check',{moduleId:this.relation.moduleId});
			trans.send(this.$root.genericError);
		},
		setOk:function(res) {
			if(this.isNew) {
				this.name   = '';
				this.iconId = null;
				this.def    = '';
				this.length = 0;
				this.relationshipId = null;
				this.captions = {
					attributeTitle:{}
				};
			}
			this.$root.schemaReload(this.module.id);
		}
	}
};