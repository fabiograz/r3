import MyBuilderCaption      from './builderCaption.js';
import MyBuilderIconInput    from './builderIconInput.js';
import {getDependentModules} from '../shared/builder.js';
import {getNilUuid}          from '../shared/generic.js';
export {MyBuilderMenu as default};

let MyBuilderMenuItems = {
	name:'my-builder-menu-items',
	components:{
		MyBuilderCaption,
		MyBuilderIconInput
	},
	template:`<draggable handle=".dragAnchor" group="menu" itemKey="id" animation="100"
		:fallbackOnBody="true"
		:list="menus"
	>
		<template #item="{element,index}">
	    		<div class="builder-menu">
				<img class="action dragAnchor" src="images/drag.png" />
				
				<div class="inputs">
					<my-button
						@trigger="element.showChildren = !element.showChildren"
						:captionTitle="capApp.showChildrenHint"
						:image="element.showChildren ? 'visible1.png' : 'visible0.png'"
						:naked="true"
					/>
					
					<!-- icon input -->
					<my-builder-icon-input
						@input="element.iconId = $event"
						:icon-id-selected="element.iconId"
						:module="module"
					/>
					
					<!-- caption inputs -->
					<my-builder-caption
						v-model="element.captions.menuTitle"
						:contentName="capGen.title"
						:language="builderLanguage"
					/>
					
					<!-- form open input -->
					<select v-model="element.formId">
						<option :value="null">{{ capApp.formId }}</option>
						<optgroup
							v-for="mod in getDependentModules(module,modules)"
							:label="mod.name"
						>
							<option v-for="f in mod.forms" :value="f.id">
								{{ f.name }}
							</option>
						</optgroup>
					</select>
				</div>
				
				<!-- nested menus -->
				<my-builder-menu-items class="nested"
					@remove="$emit('remove',$event)"
					:builderLanguage="builderLanguage"
					:menus="element.menus"
					:module="module"
				/>
				
				<my-button image="cancel.png"
					@trigger="remove(element.id,index)"
					:naked="true"
				/>
			</div>
		</template>
	</draggable>`,
	props:{
		builderLanguage:{ type:String, required:true },
		module:         { type:Object, required:true },
		menus:          { type:Array,  required:true }
	},
	emits:['remove'],
	computed:{
		// stores
		modules:       function() { return this.$store.getters['schema/modules']; },
		relationIdMap: function() { return this.$store.getters['schema/relationIdMap']; },
		attributeIdMap:function() { return this.$store.getters['schema/attributeIdMap']; },
		capApp:        function() { return this.$store.getters.captions.builder.menu; },
		capGen:        function() { return this.$store.getters.captions.generic; },
		settings:      function() { return this.$store.getters.settings; }
	},
	methods:{
		// externals
		getDependentModules,
		
		// actions
		remove:function(id,i) {
			this.menus.splice(i,1);
			
			// ID must be handled separately as it must be deleted in backend
			this.$emit('remove',id);
		}
	}
};

let MyBuilderMenu = {
	name:'my-builder-menu',
	components:{MyBuilderMenuItems},
	template:`<div v-if="module" class="builder-menus contentBox grow">
		
		<div class="top">
			<div class="area nowrap">
				<h1 class="title">{{ capApp.title }}</h1>
			</div>
		</div>
		<div class="top lower">
			<div class="area nowrap">
				<my-button image="save.png"
					@trigger="set"
					:active="hasChanges"
					:caption="capGen.button.save"
					:darkBg="true"
				/>
				<my-button image="refresh.png"
					@trigger="reset"
					:active="hasChanges"
					:caption="capGen.button.refresh"
					:darkBg="true"
				/>
				<my-button image="add.png"
					@trigger="add"
					:caption="capApp.button.add"
					:darkBg="true"
				/>
			</div>
		</div>
		
		<div class="content default-inputs">
			<my-builder-menu-items
				@remove="removeById"
				:builder-language="builderLanguage"
				:menus="menus"
				:module="module"
			/>
			
			<div class="builder-menus-actions">
				<span>{{ capApp.copy }}</span>
				<select v-model="menuIdCopy">
					<option :value="null">-</option>
					<option
						v-for="mod in getDependentModules(module,modules).filter(v => v.id !== module.id)"
						:value="mod.id"
					>
						{{ mod.name }}
					</option>
				</select>
				<my-button image="ok.png"
					@trigger="copy"
					:active="menuIdCopy !== null"
					:caption="capGen.button.apply"
				/>
			</div>
		</div>
	</div>`,
	props:{
		builderLanguage:{ type:String, required:true },
		id:             { type:String, required:true }
	},
	data:function() {
		return {
			newCnt:0, // temporary menu IDs, replaced with NULL UUIDs on SET
			menus:[],
			menuIdCopy:null,
			menuIdsRemove:[]
		};
	},
	watch:{
		module:{
			handler:function() { this.reset(); },
			immediate:true
		}
	},
	computed:{
		hasChanges:function() {
			return this.menuIdsRemove.length !== 0
				|| JSON.stringify(this.menus) !== JSON.stringify(this.module.menus)
			;
		},
		module:function() {
			if(typeof this.moduleIdMap[this.id] === 'undefined')
				return false;
			
			return this.moduleIdMap[this.id];
		},
		
		// stores
		modules:    function() { return this.$store.getters['schema/modules']; },
		moduleIdMap:function() { return this.$store.getters['schema/moduleIdMap']; },
		capApp:     function() { return this.$store.getters.captions.builder.menu; },
		capGen:     function() { return this.$store.getters.captions.generic; },
		settings:   function() { return this.$store.getters.settings; }
	},
	methods:{
		// externals
		getDependentModules,
		getNilUuid,
		
		// actions
		add:function() {
			this.menus.unshift({
				id:this.newCnt++,
				moduleId:this.id,
				formId:null,
				iconId:null,
				menus:[],
				showChildren:false,
				captions:{
					menuTitle:{}
				}
			});
		},
		removeById:function(menuId) {
			if(!Number.isInteger(menuId))
				this.menuIdsRemove.push(menuId);
		},
		reset:function() {
			if(!this.module) return;
			
			this.menus = JSON.parse(JSON.stringify(this.module.menus));
		},
		
		// backend functions
		copy:function() {
			let trans = new wsHub.transactionBlocking();
			trans.add('menu','copy',{
				moduleId:this.menuIdCopy,
				moduleIdNew:this.module.id
			},this.copyOk);
			trans.send(this.$root.genericError);
		},
		copyOk:function(res) {
			this.menuIdCopy = null;
			this.$root.schemaReload(this.module.id);
		},
		set:function() {
			let that  = this;
			let trans = new wsHub.transactionBlocking();
			
			for(let i = 0, j = this.menuIdsRemove.length; i < j; i++) {
				trans.add('menu','del',{ id:this.menuIdsRemove[i] });
			}
			this.menuIdsRemove = [];
			
			// replace temporary counter IDs with NULL UUIDs for SET
			let replaceIds;
			replaceIds = function(menus) {
				for(let i = 0, j = menus.length; i < j; i++) {
					
					if(Number.isInteger(menus[i].id))
						menus[i].id = that.getNilUuid();
					
					menus[i].menus = replaceIds(menus[i].menus);
				}
				return menus;
			}
			
			trans.add('menu','set',replaceIds(
				JSON.parse(JSON.stringify(this.menus))
			),this.setOk);
			trans.add('schema','check',{moduleId:this.module.id});
			trans.send(this.$root.genericError);
		},
		setOk:function(res) {
			this.$root.schemaReload(this.module.id);
		}
	}
};