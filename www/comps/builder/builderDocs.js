export {MyBuilderDocs as default};

let MyBuilderDocs = {
	name:'my-builder-docs',
	template:`<div class="contentBox grow">
		
		<div class="top">
			<div class="area">
				<img class="icon" src="images/question.png" />
				<h1>{{ capApp.pageTitleDocs }}</h1>
			</div>
			
			<div class="area">
				<my-button image="cancel.png"
					@trigger="$emit('close')"
					:cancel="true"
					:darkBg="true"
				/>
			</div>
		</div>
		
		<div class="content html-docs" v-html="docsFinal"></div>
	</div>`,
	emits:['close'],
	data:function() {
		return {
			docs:'',
			idPlaceholder:'builder-docs_'
		};
	},
	computed:{
		docsFinal:function() {
			return this.docs
				.replace(/href="#(.*?)"/g,'href="'+window.location+'#'+this.idPlaceholder+`$1`+'"')
				.replace(/id="(.*?)"/g,'id="'+this.idPlaceholder+`$1`+'"')
				.replace(/src="(.*?)"/g,'src="docs/'+`$1`+'"')
			;
		},
		
		// stores
		capApp:function() { return this.$store.getters.captions.builder; }
	},
	mounted:function() {
		 this.get();
	},
	methods:{
		get:function() {
			let that = this;
			let req  = new XMLHttpRequest();
			let lang = 'en_us';
			
			let url = `/docs/${lang}_builder.html`;
			req.open('GET',url,true);
			req.send(null);
			req.onreadystatechange = function() {
				if(req.readyState === 4 && req.status === 200)
					that.docs = req.responseText;
			};
		}
	}
};