import MyStore from '../../stores/store.js';
import {
	getDateAtUtcZero,
	getDateShifted,
	getUnixFromDate
} from './time.js';

export function getColumnIndexesHidden(columns) {
	let out = [];
	for(let i = 0, j = columns.length; i < j; i++) {
		if(columns[i].display === 'hidden' || (MyStore.getters.isMobile && !columns[i].onMobile))
			out.push(i);
	}
	return out;
};

export function getChoiceFilters(choices,choiceIdActive) {
	if(choiceIdActive === null)
		return [];
	
	for(let i = 0, j = choices.length; i < j; i++) {
		if(choices[i].id === choiceIdActive)
			return choices[i].filters;
	}
	return [];
};

export function getDataFields(fields) {
	let out = [];
	
	for(let i = 0, j = fields.length; i < j; i++) {
		let f = fields[i];
		
		switch(f.content) {
			case 'container':
				out = out.concat(getDataFields(f.fields));
			break;
			case 'data':
				out.push(f);
			break;
		}
	}
	return out;
};

export function getDataFieldMap(fields) {
	let out = {};
	
	for(let i = 0, j = fields.length; i < j; i++) {
		let f = fields[i];
		
		switch(f.content) {
			case 'container':
				out = Object.assign(out,getDataFieldMap(f.fields));
			break;
			case 'data':
				out[f.id] = f;
			break;
		}
	}
	return out;
};

export function getFormRoute(formId,recordId,stayInModule,getArgs) {
	let moduleId = MyStore.getters['schema/formIdMap'][formId].moduleId;
	
	// optional: stay in context of currently open module
	// useful to navigate through forms but keeping the current module context open (menu, title, etc.)
	if(stayInModule &&
		typeof this.$route.params.moduleNameChild !== 'undefined' &&
		typeof MyStore.getters['schema/moduleNameMap'][this.$route.params.moduleNameChild] !== 'undefined'
	) {
		moduleId = MyStore.getters['schema/moduleNameMap'][this.$route.params.moduleNameChild].id;
	}
	
	let module = MyStore.getters['schema/moduleIdMap'][moduleId];
	let target = `/app/${module.name}`;
	
	// go to sub module, if form module is assigned to another
	if(module.parentId !== null) {
		let parent = MyStore.getters['schema/moduleIdMap'][module.parentId];
		target = `/app/${parent.name}/${module.name}`;
	}
	
	let route = `${target}/form/${formId}`;
	
	if(recordId !== 0)
		route += `/${recordId}`;
	
	if(typeof getArgs !== 'undefined' && getArgs.length !== 0)
		route += `?${getArgs.join('&')}`;
	
	return route;
};

export function getFlexBasis(input) {
	return input === 0 ? 'auto' : input+'px';
};

export function getFlexStyle(dir,justifyContent,alignItems,alignContent,
	wrap,grow,shrink,basis,perMax,perMin) {
	
	let out = [
		`flex:${grow} ${shrink} ${getFlexBasis(basis)}`,
		`flex-wrap:${wrap ? 'wrap' : 'nowrap'}`,
		`justify-content:${justifyContent}`,
		`align-items:${alignItems}`,
		`align-content:${alignContent}`
	];
	
	if(basis !== 0) {
		let dirMax = dir === 'row' ? 'max-width' : 'max-height';
		let dirMin = dir === 'row' ? 'min-width' : 'min-height';
		out.push(`${dirMax}:${basis*perMax/100}px`);
		out.push(`${dirMin}:${basis*perMin/100}px`);
	}
	return out.join(';');
};

export function getInputFieldName(fieldId) {
	return `input_${fieldId}`;
};

export function getResolvedPlaceholders(value) {
	switch(value) {
		case '{CURR_TIME}':
			let now = new Date();
			let d   = new Date(0);
			d.setHours(now.getHours(),now.getMinutes(),now.getSeconds());
			return getUnixFromDate(getDateShifted(d,false));
		break;
		case '{CURR_DATETIME}':  return getUnixFromDate(new Date()); break;
		case '{CURR_DATE}':      return getUnixFromDate(getDateAtUtcZero(new Date())); break;
		case '{CURR_DATE_YYYY}': return new Date().getFullYear(); break;
		case '{CURR_DATE_MM}':   return (new Date().getMonth())+1; break;
		case '{CURR_DATE_DD}':   return new Date().getDate(); break;
	}
	return value;
};

// set getter argument values in array of empty/pre-existing getters
export function setGetterArgs(argsArray,name,value) {
	
	if(argsArray.length === 0)
		return [`${name}=${value}`];
	
	for(let i = 0, j = argsArray.length; i < j; i++) {
		
		if(argsArray[i].indexOf(`${name}=`) === 0) {
			// argument already exists, add new value to it
			argsArray[i] = `${argsArray[i]},${value}`;
			break;
		}
	}
	return argsArray;
};