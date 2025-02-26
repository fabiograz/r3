import MyBuilderCaption from './builderCaption.js';
import {
	getDependentModules,
	getPgFunctionTemplate
} from '../shared/builder.js';
export {MyBuilderPgFunction as default};

let MyBuilderPgFunctionEntity = {
	name:'my-builder-pg-function-entity',
	template:`<div class="fnc">
		<span class="entity-title">
			<my-button
				@trigger="$emit('toggle')"
				:caption="name+'()'"
				:image="selected ? 'checkbox1.png' : 'checkbox0.png'"
				:naked="true"
			/>
			<my-button image="question.png"
				v-if="help !== ''"
				@trigger="$emit('show-help',help)"
				:naked="true"
			/>
		</span>
	</div>`,
	props:{
		builderLanguage:{ type:String,  required:true },
		helpFixed:      { type:String,  required:false, default:'' },
		name:           { type:String,  required:true },
		pgFunction:     { type:Object,  required:false, default:null },
		selected:       { type:Boolean, required:true }
	},
	emits:['show-help','toggle'],
	computed:{
		help:function() {
			if(this.helpFixed !== '')
				return this.helpFixed;
			
			if(this.pgFunction !== null) {
				// build PG function interface help text
				let help = `${this.name}(${this.pgFunction.codeArgs}) => ${this.pgFunction.codeReturns}`;
				
				// add translated title/description, if available
				if(typeof this.pgFunction.captions.pgFunctionTitle !== 'undefined'
					&& typeof this.pgFunction.captions.pgFunctionTitle[this.builderLanguage] !== 'undefined'
					&& this.pgFunction.captions.pgFunctionTitle[this.builderLanguage] !== '') {
					
					help += `<br /><br />${this.pgFunction.captions.pgFunctionTitle[this.builderLanguage]}`;
				}
				
				if(typeof this.pgFunction.captions.pgFunctionDesc !== 'undefined'
					&& typeof this.pgFunction.captions.pgFunctionDesc[this.builderLanguage] !== 'undefined'
					&& this.pgFunction.captions.pgFunctionDesc[this.builderLanguage] !== '') {
					
					help += `<br /><br />${this.pgFunction.captions.pgFunctionDesc[this.builderLanguage]}`;
				}
				return help;
			}
			return '';
		}
	}
};

let MyBuilderPgFunction = {
	name:'my-builder-pg-function',
	components:{
		MyBuilderCaption,
		MyBuilderPgFunctionEntity
	},
	template:`<div class="builder-pg-function">
		
		<div class="contentBox" v-if="pgFunction">
			<div class="top">
				<div class="area nowrap">
					<my-builder-caption
						v-model="captions.pgFunctionTitle"
						:contentName="capApp.titleOne"
						:language="builderLanguage"
					/>
				</div>
				<div class="area">
					<my-button
						@trigger="showSidebar = !showSidebar"
						:darkBg="true"
						:image="showSidebar ? 'toggleRight.png' : 'toggleLeft.png'"
					/>
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
					<my-button
						@trigger="showDetails = !showDetails"
						:caption="capApp.button.details"
						:darkBg="true"
						:image="showDetails ? 'visible1.png' : 'visible0.png'"
					/>
					<my-button
						@trigger="showPreview = !showPreview"
						:caption="capApp.preview"
						:darkBg="true"
						:image="showPreview ? 'visible1.png' : 'visible0.png'"
					/>
				</div>
			</div>
			
			<div class="content no-padding function-details default-inputs">
				<table v-if="showDetails">
					<tr>
						<td>{{ capApp.codeArgs }}</td>
						<td><input disabled :value="pgFunction.codeArgs !== '' ? pgFunction.codeArgs : '-'" /></td>
					</tr>
					<tr>
						<td>{{ capApp.codeReturns }}</td>
						<td><input disabled :value="pgFunction.codeReturns !== '' ? pgFunction.codeReturns : '-'" /></td>
					</tr>
					<tr>
						<td>{{ capGen.title }}</td>
						<td>
							<my-builder-caption
								v-model="captions.pgFunctionTitle"
								:language="builderLanguage"
							/>
						</td>
					</tr>
					<tr>
						<td>{{ capGen.description }}</td>
						<td>
							<my-builder-caption
								v-model="captions.pgFunctionDesc"
								:language="builderLanguage"
								:multiLine="true"
							/>
						</td>
					</tr>
				</table>
				
				<!-- function body input -->
				<textarea class="input"
					v-if="!showPreview"
					v-model="codeFunction"
					@click="insertEntitySelected"
					@keydown.tab.prevent="addTab"
					:placeholder="capApp.code"
				></textarea>
				
				<!-- function body preview -->
				<textarea class="input" disabled="disabled"
					v-if="showPreview"
					v-model="preview"
				></textarea>
			</div>
		</div>
		
		<div class="contentBox right" v-if="pgFunction && showSidebar">
			<div class="top">
				<div class="area nowrap">
					<img class="icon" src="images/database.png" />
					<h1 class="title">{{ capApp.placeholders }}</h1>
				</div>
			</div>
			<div class="top lower">
				<div class="area nowrap">
					<my-button
						v-if="isTrigger"
						@trigger="addNew = !addNew"
						:caption="capApp.button.addNew"
						:darkBg="true"
						:image="addNew ? 'checkbox1.png' : 'checkbox0.png'"
					/>
					<my-button
						v-if="isTrigger"
						@trigger="addOld = !addOld"
						:caption="capApp.button.addOld"
						:darkBg="true"
						:image="addOld ? 'checkbox1.png' : 'checkbox0.png'"
					/>
					<my-button image="refresh.png"
						@trigger="codeFunction = getPgFunctionTemplate()"
						:caption="capApp.button.template"
						:darkBg="true"
					/>
				</div>
			</div>
			<div class="content padding default-inputs">
				
				<div class="message" v-html="capApp.entityInput"></div>
				
				<h2>{{ capApp.placeholdersModules }}</h2>
				<div class="mod"
					v-for="mod in getDependentModules(module,modules).filter(v => v.relations.length !== 0 || v.pgFunctions.length !== 0)"
					:key="mod.id"
				>
					<my-button
						@trigger="toggleModule(mod.id)"
						:caption="mod.name"
						:image="moduleIdsOpen.includes(mod.id) ? 'triangleDown.png' : 'triangleRight.png'"
						:naked="true"
					/>
					
					<template v-if="moduleIdsOpen.includes(mod.id)">
						
						<!-- relations & attributes -->
						<div class="rel" v-for="rel in mod.relations" :key="rel.id">
							<span class="entity-title">
								<my-button
									@trigger="toggleEntity('relation',rel.id)"
									:caption="rel.name"
									:image="entitySelected === 'relation' && entitySelectedId === rel.id ? 'checkbox1.png' : 'checkbox0.png'"
									:naked="true"
								/>
							</span>
							
							<div class="atr" v-for="atr in rel.attributes" :key="atr.id">
								<my-button
									@trigger="toggleEntity('attribute',atr.id)"
									:caption="atr.name"
									:image="entitySelected === 'attribute' && entitySelectedId === atr.id ? 'checkbox1.png' : 'checkbox0.png'"
									:naked="true"
								/>
							</div>
						</div>
						
						<!-- pg functions -->
						<my-builder-pg-function-entity
							v-for="f in mod.pgFunctions.filter(v => v.codeReturns !== 'trigger' && v.codeReturns !== 'TRIGGER')"
							@show-help="showHelp(f.name+'()',$event)"
							@toggle="toggleEntity('pgFunction',f.id)"
							:builderLanguage="builderLanguage"
							:key="f.id"
							:name="f.name"
							:pgFunction="f"
							:selected="entitySelected === 'pgFunction' && entitySelectedId === f.id"
						/>
					</template>
				</div>
				
				<!-- instance functions -->
				<h2>{{ capApp.placeholdersInstance }}</h2>
				
				<my-builder-pg-function-entity
					v-for="f in instanceFunctionIds"
					@show-help="showHelp(f+'()',$event)"
					@toggle="toggleEntity('instanceFunction',f)"
					:builderLanguage="builderLanguage"
					:helpFixed="capApp.help[f]"
					:key="f"
					:name="f"
					:selected="entitySelected === 'instanceFunction' && entitySelectedId === f"
				/>
			</div>
		</div>
	</div>`,
	props:{
		builderLanguage:{ type:String, required:true },
		id:             { type:String, required:true }
	},
	watch:{
		pgFunction:{
			handler:function() { this.reset(); },
			immediate:true
		}
	},
	data:function() {
		return {
			name:'',
			captions:{},
			codeFunction:'',
			
			instanceFunctionIds:[
				'abort_show_message','get_name','get_login_id',
				'get_login_language_code','get_public_hostname','get_role_ids',
				'has_role','has_role_any','log_error','log_info','log_warning',
				'mail_delete','mail_delete_after_attach','mail_get_next',
				'mail_send'
			],
			
			// states
			addNew:false,
			addOld:false,
			entitySelected:'',
			entitySelectedId:null,
			moduleIdsOpen:[],
			showDetails:false,
			showPreview:false,
			showSidebar:true
		};
	},
	computed:{
		module:function() {
			if(this.pgFunction === false)
				return false;
			
			return this.moduleIdMap[this.pgFunction.moduleId];
		},
		pgFunction:function() {
			if(typeof this.pgFunctionIdMap[this.id] === 'undefined')
				return false;
			
			return this.pgFunctionIdMap[this.id];
		},
		hasChanges:function() {
			return this.codeFunction !== this.placeholdersSet(this.pgFunction.codeFunction)
				|| JSON.stringify(this.captions) !== JSON.stringify(this.pgFunction.captions);
		},
		preview:function() {
			if(!this.showPreview) return '';
			
			return this.placeholdersUnset(true);
		},
		
		// simple
		isTrigger:function() { return this.pgFunction.codeReturns === 'trigger'; },
		
		// stores
		modules:        function() { return this.$store.getters['schema/modules']; },
		moduleIdMap:    function() { return this.$store.getters['schema/moduleIdMap']; },
		moduleNameMap:  function() { return this.$store.getters['schema/moduleNameMap']; },
		relationIdMap:  function() { return this.$store.getters['schema/relationIdMap']; },
		attributeIdMap: function() { return this.$store.getters['schema/attributeIdMap']; },
		pgFunctionIdMap:function() { return this.$store.getters['schema/pgFunctionIdMap']; },
		capApp:         function() { return this.$store.getters.captions.builder.pgFunction; },
		capGen:         function() { return this.$store.getters.captions.generic; }
	},
	methods:{
		// externals
		getDependentModules,
		getPgFunctionTemplate,
		
		// actions
		addTab:function(evt) {
			let field    = evt.target;
			let startPos = field.selectionStart;
			let endPos   = field.selectionEnd;
			
			field.value = field.value.substring(0, startPos)
				+ "\t"+ field.value.substring(endPos);
			
			field.selectionStart = startPos + 1;
			field.selectionEnd   = startPos + 1;
		},
		reset:function() {
			this.name         = this.pgFunction.name;
			this.captions     = JSON.parse(JSON.stringify(this.pgFunction.captions));
			this.codeFunction = this.placeholdersSet(this.pgFunction.codeFunction);
		},
		insertEntitySelected:function(evt) {
			if(this.entitySelectedId === null)
				return;
			
			let field = evt.target;
			let text  = '';
			let mod, rel, atr, fnc;
			
			// build unique placeholder name
			// relation:    {module_name}.[relation_name]
			// pg function: {module_name}.[function_name]()
			// attribute:   (module_name.relation_name.attribute_name)
			switch(this.entitySelected) {
				case 'relation':
					rel  = this.relationIdMap[this.entitySelectedId];
					mod  = this.moduleIdMap[rel.moduleId];
					text = `{${mod.name}}.[${rel.name}]`;
				break;
				case 'pgFunction':
					fnc  = this.pgFunctionIdMap[this.entitySelectedId];
					mod  = this.moduleIdMap[fnc.moduleId];
					text = `{${mod.name}}.[${fnc.name}]()`;
				break;
				case 'attribute':
					atr  = this.attributeIdMap[this.entitySelectedId];
					rel  = this.relationIdMap[atr.relationId];
					mod  = this.moduleIdMap[rel.moduleId];
					text = `(${mod.name}.${rel.name}.${atr.name})`;
					
					if(this.addNew) text = 'NEW.'+text;
					if(this.addOld) text = 'OLD.'+text;
				break;
				case 'instanceFunction':
					text = `instance.${this.entitySelectedId}()`;
				break;
			}
			
			if(field.selectionStart || field.selectionStart === '0') {
				
				let startPos = field.selectionStart;
				let endPos   = field.selectionEnd;
				
				field.value = field.value.substring(0,startPos)
					+ text
					+ field.value.substring(endPos, field.value.length);
				
				field.selectionStart = startPos + text.length;
				field.selectionEnd   = startPos + text.length;
			}
			else {
				field.value += text;
			}
			this.codeFunction = field.value;
			this.entitySelectedId = null;
		},
		toggleEntity:function(entityName,id) {
			if(this.entitySelected === entityName && this.entitySelectedId === id) {
				this.entitySelected   = '';
				this.entitySelectedId = null;
				return;
			}
			this.entitySelected   = entityName;
			this.entitySelectedId = id;
		},
		toggleModule:function(id) {
			let pos = this.moduleIdsOpen.indexOf(id);
			
			if(pos === -1)
				return this.moduleIdsOpen.push(id);
			
			this.moduleIdsOpen.splice(pos,1);
		},
		showHelp:function(top,text) {
			this.$store.commit('dialog',{
				captionTop:top,
				captionBody:text,
				buttons:[{
					caption:this.capGen.button.close,
					cancel:true,
					image:'cancel.png'
				}]
			});
		},
		
		// placeholders are used for storing entities via ID instead of name (which can change)
		// attribute reference: (module.relation.attribute) <-> (ATR_ID)
		// relation  reference: {module}[relation]          <-> {MOD_ID}[REL_ID]
		// function  reference: {module}[function](...      <-> {MOD_ID}[FNC_IC](...
		placeholdersSet:function(body) {
			let that = this;
			
			// replace attributes with placeholders
			// stored in function text as: (ATR_ID)
			body = body.replace(/\(([a-z0-9\-]{36})\)/g,function(match,id) {
				let atr = that.attributeIdMap[id];
				let rel = that.relationIdMap[atr.relationId];
				let mod = that.moduleIdMap[rel.moduleId];
				return `(${mod.name}.${rel.name}.${atr.name})`;
			});
			
			// replace functions with placeholders
			// stored in function text as: [FNC_ID](...
			body = body.replace(/\[([a-z0-9\-]{36})\]\(/g,function(match,id) {
				return `[${that.pgFunctionIdMap[id].name}](`;
			});
			
			// replace relations with placeholders
			// stored in function text as: [REL_ID]
			body = body.replace(/\[([a-z0-9\-]{36})\]/g,function(match,id) {
				return `[${that.relationIdMap[id].name}]`;
			});
			
			// replace modules with placeholders
			// stored in function text as: {MOD_ID}
			body = body.replace(/\{([a-z0-9\-]{36})\}/g,function(match,id) {
				return `{${that.moduleIdMap[id].name}}`;
			});
			return body;
		},
		placeholdersUnset:function(previewMode) {
			let that = this;
			let body = this.codeFunction;
			
			// replace attribute placeholders
			// stored as: (module.relation.attribute)
			let pat = /\(([a-z][a-z0-9\_]+)\.([a-z][a-z0-9\_]+)\.([a-z][a-z0-9\_]+)\)/g;
			body = body.replace(pat,function(match,modName,relName,atrName) {
				
				// resolve module by name
				if(typeof that.moduleNameMap[modName] === 'undefined')
					return match;
				
				let mod = that.moduleNameMap[modName];
				
				// resolve relation by name
				let rel = false;
				
				for(let i = 0, j = mod.relations.length; i < j; i++) {
					if(mod.relations[i].name !== relName)
						continue;
					
					rel = mod.relations[i];
					break;
				}
				if(rel === false)
					return match;
				
				// resolve attribute by name
				let atr = false;
				
				for(let i = 0, j = rel.attributes.length; i < j; i++) {
					if(rel.attributes[i].name !== atrName)
						continue;
					
					atr = rel.attributes[i];
					break;
				}
				if(atr === false)
					return match;
				
				// replace placeholder
				if(previewMode)
					return atr.name;
				
				return `(${atr.id})`;
			});
			
			// replace function placeholders
			// stored as: {module}[function](...
			pat = /\{([a-z][a-z0-9\_]+)\}\.\[([a-z][a-z0-9\_]+)\]\(/g;
			body = body.replace(pat,function(match,modName,fncName) {
				
				// resolve module by name
				if(typeof that.moduleNameMap[modName] === 'undefined')
					return match;
				
				let mod = that.moduleNameMap[modName];
				
				// resolve function by name
				let fnc = false;
				
				for(let i = 0, j = mod.pgFunctions.length; i < j; i++) {
					if(mod.pgFunctions[i].name !== fncName)
						continue;
					
					fnc = mod.pgFunctions[i];
					break;
				}
				if(fnc === false)
					return match;
				
				// replace placeholder
				if(previewMode)
					return `${mod.name}.${fnc.name}(`;
				
				return `{${mod.id}}.[${fnc.id}](`;
			});
			
			// replace relation placeholders
			// stored as: {module}[relation]
			pat = /\{([a-z][a-z0-9\_]+)\}\.\[([a-z][a-z0-9\_]+)\]/g;
			body = body.replace(pat,function(match,modName,relName) {
				
				// resolve module by name
				if(typeof that.moduleNameMap[modName] === 'undefined')
					return match;
				
				let mod = that.moduleNameMap[modName];
				
				// resolve relation by name
				let rel = false;
				
				for(let i = 0, j = mod.relations.length; i < j; i++) {
					if(mod.relations[i].name !== relName)
						continue;
					
					rel = mod.relations[i];
					break;
				}
				if(rel === false)
					return match;
				
				// replace placeholder
				if(previewMode)
					return `${mod.name}.${rel.name}`;
				
				return `{${mod.id}}.[${rel.id}]`;
			});
			return body;
		},
		
		// backend calls
		set:function() {
			let trans = new wsHub.transactionBlocking();
			
			trans.add('pgFunction','set',{
				id:this.pgFunction.id,
				moduleId:this.pgFunction.moduleId,
				name:this.pgFunction.name,
				codeArgs:this.pgFunction.codeArgs,
				codeFunction:this.placeholdersUnset(false),
				codeReturns:this.pgFunction.codeReturns,
				schedules:this.pgFunction.schedules,
				captions:this.captions
			},this.setOk);
			trans.add('schema','check',{moduleId:this.module.id});
			trans.send(this.$root.genericError);
		},
		setOk:function(res) {
			this.$root.schemaReload(this.module.id);
		}
	}
};