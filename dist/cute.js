/*! DOM Template Engine - v0.0.1 - 2012-08-29
* https://github.com/ifaced/cutejs
* Copyright (c) 2012 Interfaced; Licensed MIT */

var cuteJS = {};


cuteJS.Engine = (function() {
	var helperPath = 'cuteJS.';
	/**
	 * @constructor
	 */
	var Engine = function() {
		this._input = new Holder();
		this._output = new Holder();

		this._analyzer = new Analyzer(this._input);

		this._initializeParsing();
	};
	/**
	 * @param {string} templateName
	 * @param {string} templateBody
	 * @param {Object} ns
	 */
	Engine.prototype.register = function(templateName, templateBody, ns) {
		this._clearHolders();
		var rawBody = this._buildRawBody(templateBody),
			exportFunction = this._buildExportFunction(),
			inTypedef = this._input.getTypedef();

		var fullBody = this._compileTemplateFunctionBody(rawBody, exportFunction);
		var templateFunction = new Function('options', fullBody);
		if (inTypedef) {
			ns[templateName] = function(data, options) {
				return templateFunction.call(data, options);
			};
		} else {
			ns[templateName] = templateFunction;
		}
	};
	/**
	 * @param {string} templateName
	 * @param {string} templateBody
	 * @param {string} namespace
	 * @return {string}
	 */
	Engine.prototype.compile = function(templateName, templateBody, namespace) {
		this._clearHolders();
		var rawBody = this._buildRawBody(templateBody),
			exportFunction = this._buildExportFunction(),
			inTypedef = this._input.getTypedef(),
			outTypedef = this._output.getTypedef(),
			names = this._getNNN(namespace + '.' + templateName);

		var functionBody = this._compileTemplateFunctionBody(rawBody, exportFunction, names.outName);

		var output = '';
		var inputType = this._analyzer.getInputType();
		if (inputType) {
			output+= '/** @typedef {' + inputType + '} */\n';
			output+= names.inName + ';\n';
		} else if (inTypedef) {
			output+= '/**\n * @typedef {' + inTypedef.split('\n').join('\n * ') + '}\n */\n';
			output+= names.inName + ';\n';
		}
		output+= '/**\n * @typedef {' + outTypedef.split('\n').join('\n * ') + '}\n */\n';
		output+= names.outName + ';\n';
		output+= '/**\n';
		if (inTypedef) {
			output+= ' * @param {' + names.inName + '} data\n';
		}
		output+= ' * @param {?' + helperPath + 'TemplateOptions} [options]\n';
		output+= ' * @return {' + names.outName + '}\n';
		output+= ' */\n';
		if (inTypedef) {
			output+= namespace + '.' + templateName + ' = function(data, options) {\n';
			output+= '\t' + '/**\n';
			output+= '\t' + ' * @this {' + names.inName + '}\n';
			output+= '\t' + ' * @return {' + names.outName + '}\n';
			output+= '\t' + ' */\n';
			output+= '\t' + 'var _template = function() {\n';
			functionBody = functionBody.split('\n').join('\n\t\t');
			output+= '\t\t' + functionBody + '\n';
			output+= '\t' +'};\n';
			output+= '\t' + 'return _template.call(data);\n';
			output+='};';
		} else {
			functionBody = functionBody.split('\n').join('\n\t');
			output+= namespace + '.' + templateName + ' = function(options) {\n';
			output+= '\t' + functionBody + '\n';
			output+= '};';
		}
		return output;
	};
	/**
	 * @param {string} rawBody
	 * @param {string} exportFunction
	 * @param {string} [exportType]
	 * @return {string}
	 * @private
	 */
	Engine.prototype._compileTemplateFunctionBody = function(rawBody, exportFunction, exportType) {
		var output = 'var templatesData = {};\n';
		if (exportType) {
			output+= '/**\n';
			output+= ' * @param {string} key\n';
			output+= ' * @param {' + exportType + '} exports\n';
			output+= ' * @param {*} value\n';
			output+= ' */\n';
		}
		output+= exportFunction + '\n';
		output+= rawBody + '\n';
		output+= 'return ' + helperPath + 'buildResult(__p, templatesData, exportFunction, options);';
		return output;
	};
	/**
	 * @private
	 */
	Engine.prototype._initializeParsing = function() {
		this._templateHandlers = {
			typedef: [
				/\{\{\*([\s\S]+?)\}\}\s*/g, this._replaceTypedef.bind(this)
			],
			escaper: [
				/\\|'|\r|\n|\t|\u2028|\u2029/g, this._replaceEscaper.bind(this)
			],
			interpolate:[
				/\{\{=([\s\S]+?)\}\}/g, this._replaceInterpolate.bind(this)
			],
			escape:[
				/\{\{-([\s\S]+?)\}\}/g, this._replaceEscape.bind(this)
			],
			partial:[
				/\{\{#([\s\S]+?)\}\}/g, this._replacePartial.bind(this)
			],
			component:[
				/\{\{%([\s\S]+?)\}\}/g, this._replaceComponent.bind(this)
			],
			exportNode:[
				/<([a-z]+)[^>]*\sdata-export-id\s*=\s*(["'])?\{\{@\s*([a-z][a-z0-9]*(\[\])?)\s*\}\}\2[^>]*>/gi, this._replaceExport.bind(this)
			],
			evaluate:[
				/\{\{([\s\S]+?)\}\}/g, this._replaceEvaluate.bind(this)
			]
		};
		this._escapes = {
			'\\':'\\',
			"'":"'",
			'r':'\r',
			'n':'\n',
			't':'\t',
			'u2028':'\u2028',
			'u2029':'\u2029'
		};
		for (var p in this._escapes) {
			if (this._escapes.hasOwnProperty(p)) {
				this._escapes[this._escapes[p]] = p;
			}
		}
	};
	/**
	 * @param {string} templateBody
	 * @return {string}
	 * @private
	 */
	Engine.prototype._buildRawBody = function(templateBody) {
		this._output.addVariable('root', 'DocumentFragment');

		var source = 'var __p=\'\';\n';
		source+= '__p+=\'';
		for (var p in this._templateHandlers) {
			if (this._templateHandlers.hasOwnProperty(p)) {
				var handler = this._templateHandlers[p];
				templateBody = templateBody.replace(handler[0], handler[1]);
			}
		}
		source+= templateBody + '\';\n';

		this._analyzer.commitPredefined();
		return source;
	};
	/**
	 * @return {string}
	 * @private
	 */
	Engine.prototype._buildExportFunction = function() {
		var source = '';

		if (this._output.hasVariables()) {
			source+= 'var exportFunction = function(value, key, exports) {\n';
			source+= '\t' + 'var errMessage = "Include name is already defined: " + key;\n';
			source+= '\t' + 'switch (key) {\n';

			var exports = this._output.getVariables();
			for(var exportName in exports) {
				if(exports.hasOwnProperty(exportName)) {
					var exportType = exports[exportName];
					var arrayModifier = /^Array\./;
					var isArray = arrayModifier.test(exportType);
					exportName = exportName.replace(arrayModifier, '');
					source+=        '\t\t' + 'case "' + exportName + '":\n';
					if(isArray) {
						source+=    '\t\t\t' + 'exports.' + exportName + ' = exports.' + exportName + ' || [];\n' +
									'\t\t\t' + 'exports.' + exportName + '.push(value);\n';
					} else {
						source+=    '\t\t\t' + 'if( !exports.' + exportName + ' ) {\n' +
									'\t\t\t\t' + 'exports.' + exportName + ' = value;\n' +
									'\t\t\t' + '} else {\n' +
									'\t\t\t\t' + 'throw new Error(errMessage);\n' +
									'\t\t\t' + '}\n';
					}
					source+=        '\t\t\t' + 'break;\n';
				}
			}
			source+=                '\t\t' + 'default:\n';
			source+=                '\t\t\t' + 'throw new Error(\'UNKNOWN KEY \' + key);\n';
			source+=                '\t\t\t' + 'break;\n';
			source+=                '\t}\n'; // switch end
			source+=                '};';
		}
		return source;
	};
	/**
	 * @type {Object}
	 * @private
	 */
	Engine.prototype._escapes = null;
	/**
	 * @type {Object}
	 * @private
	 */
	Engine.prototype._templateHandlers = null;
	/**
	 * @type {Holder}
	 * @private
	 */
	Engine.prototype._input = null;
	/**
	 * @type {Holder}
	 * @private
	 */
	Engine.prototype._output = null;
	/**
	 * @type {Analyzer}
	 * @private
	 */
	Engine.prototype._analyzer = null;
	/**
	 * @type {Object}
	 * @private
	 */
	Engine.prototype._knownTags = {
		'html':'Html',
		'head':'Head',
		'link':'Link',
		'title':'Title',
		'meta':'Meta',
		'base':'Base',
		'isindex':'IsIndex', // TODO
		'style':'Style',
		'body':'Body',
		'form':'Form',
		'select':'Select',
		'optgroup':'OptGroup',
		'option':'Option',
		'input':'Input',
		'textarea':'TextArea',
		'button':'Button',
		'label':'Label',
		'fieldset':'FieldSet',
		'legend':'Legend',
		'ul':'UList',
		'ol':'OList',
		'dl':'DList',
		'directory':'Directory',
		'menu':'Menu',
		'li':'LI',
		'div':'Div',
		'p':'Paragraph',
		'heading':'Heading',
		'q':'Quote',
		'pre':'Pre',
		'br':'BR',
		'basefont':'BaseFont',
		'font':'Font',
		'hr':'HR',
		'mod':'Mod',
		'anchor':'Anchor',
		'image':'Image',
		'object':'Object',
		'param':'Param',
		'applet':'Applet',
		'map':'Map',
		'area':'Area',
		'script':'Script',
		'table':'Table',
		'caption':'TableCaption',
		'col':'TableCol',
		'tr':'TableRow',
		'td':'TableCell',
		'frameset':'FrameSet',
		'frame':'Frame',
		'iframe':'IFrame'
	};
	/**
	 * @param {string} code
	 * @return {string}
	 * @private
	 */
	Engine.prototype._unescape = function(code) {
		return code.replace(/\\(\\|'|r|n|t|u2028|u2029)/g, function (match, escape) {
			return this._escapes[escape];
		}.bind(this));
	};
	/**
	 * @param {string} templatePath
	 * @return {{template: string, inName: string, outName: string}}
	 * @private
	 */
	Engine.prototype._getNNN = function(templatePath) {
		function ucfirst(str) {
			return str.charAt(0).toUpperCase() + str.slice(1);
		}

		var path = /^(.*)\.[^\.]+$/.exec(templatePath)[1];
		var name = ucfirst(/\.([^\.]+)$/.exec(templatePath)[1]);
		return {
			inName: path + '.' + name + 'In',
			outName: path + '.' + name + 'Out',
			template: path + '.' + name
		};
	};
	/**
	 * @param {string} match
	 * @return {string}
	 * @private
	 */
	Engine.prototype._replaceEscaper = function (match) {
		return '\\' + this._escapes[match];
	};
	/**
	 * @param {string} match
	 * @param {string} code
	 * @return {string}
	 * @private
	 */
	Engine.prototype._replaceTypedef = function(match, code) {
		this._analyzer.parse(code);
		return '';
	};
	/**
	 * @param {string} match
	 * @param {string} code
	 * @return {string}
	 * @private
	 */
	Engine.prototype._replaceInterpolate = function(match, code) {
		this._analyzer.extract(code);
		return "'+\n(" + this._unescape(code) + ")+\n'";
	};
	/**
	 * @param {string} match
	 * @param {string} code
	 * @return {string}
	 * @private
	 */
	Engine.prototype._replaceEscape = function(match, code) {
		this._analyzer.extract(code);
		return '\'+\n ' + helperPath + 'escape(' + this._unescape(code) + ')+\n\'';
	};
	/**
	 * @param {string} match
	 * @param {string} code
	 * @return {string}
	 * @private
	 */
	Engine.prototype._replacePartial = function(match, code) {
		this._analyzer.extract(code);
		return this.__replaceInclude(code, 'partial');
	};
	/**
	 * @param {string} match
	 * @param {string} code
	 * @return {string}
	 * @private
	 */
	Engine.prototype._replaceComponent = function(match, code) {
		this._analyzer.extract(code);
		return this.__replaceInclude(code, 'component');
	};
	/**
	 * @param {string} match
	 * @param {string} tagName
	 * @param {string} quote
	 * @param {string} exportName
	 * @return {string}
	 * @private
	 */
	Engine.prototype._replaceExport = function(match, tagName, quote, exportName) {
		var arrayModifier = /\[\]$/;
		tagName = tagName.toLowerCase();
		var isArray = arrayModifier.test(exportName);
		var type = 'HTML' + (tagName in this._knownTags ? this._knownTags[tagName] : '')+ 'Element';
		if(isArray) {
			exportName = exportName.replace(arrayModifier, '');
			type = 'Array.<' + type + '>';
		}
		this._output.addVariable(exportName, type);

		return match.replace(/\{\{@([\s\S]+?)\}\}/g, '$1');
	};
	/**
	 * @param {string} match
	 * @param {string} code
	 * @return {string}
	 * @private
	 */
	Engine.prototype._replaceEvaluate = function(match, code) {
		this._analyzer.extract(code, true);
		return "';\n" + this._unescape(code) + "\n;__p+='";
	};
	/**
	 * @param {string} code
	 * @param {string} classType
	 * @return {string}
	 * @private
	 */
	Engine.prototype.__replaceInclude = function(code, classType) {
		code = this._unescape(code);

		var className, params, exportName, isArray = false, type;

		var splittedCode = code.split(',');
		if (splittedCode.length > 2) {
			var exp = /^\s*([a-z][a-z0-9\.]*)\s*,([\s\S]*),\s*([a-z][a-z0-9\.]*)(\[\])?\s*$/i;
			var match;
			if ((match = exp.exec(code))) {
				className = match[1];
				params = match[2];
				exportName = match[3];
				if (match[4]) {
					isArray = true;
				}
			} else {
				exp = /^\s*([a-z][a-z0-9\.]*)\s*,([\s\S]*)$/i;
				match = exp.exec(code);
				className = match[1];
				params = match[2];
				exportName = '__null__';
			}
		} else {
			className = splittedCode[0].replace(/^\s+/, '').replace(/\s+$/, '');
			params = splittedCode[1] ? splittedCode[1]: 'false';
			exportName = '__null__';
		}

		// TODO params {}, false, '', null, 0 => false

		if (classType === 'partial') {
			type = this._getNNN(className).outName;
		} else {
			type = className;
		}
		if(isArray) {
			type = 'Array.<' + type + '>';
		}
		this._output.addVariable(exportName, type);

		code = '' + className + ', ' + params + ', "' + exportName + '"';
		return '\'+\n ' + helperPath + 'include(\'' + classType + '\', ' + code + ', templatesData)+\n\'';
	};
	/**
	 * Prepare holders to collect new variables
	 * @private
	 */
	Engine.prototype._clearHolders = function() {
		this._input.clear();
		this._output.clear();
		this._analyzer.clear();
	};

	/**
	 * @constructor
	 */
	var Holder = function() {
		this._variables = {};
	};
	/**
	 * @param {string} name
	 * @param {string} type
	 */
	Holder.prototype.addVariable = function(name, type) {
		this._variables[name] = type;
	};
	/**
	 * @return {Object}
	 */
	Holder.prototype.getVariables = function() {
		return this._variables;
	};
	/**
	 * @return {Boolean}
	 */
	Holder.prototype.hasVariables = function() {
		for (var p in this._variables) {
			if (this._variables.hasOwnProperty(p)) {
				return true;
			}
		}
		return false;
	};
	/**
	 * @param {string} name
	 * @return {string}
	 */
	Holder.prototype.getType = function(name) {
		return this._variables[name] || null;
	};
	/**
	 * @return {string}
	 */
	Holder.prototype.getTypedef = function() {
		var output = '';
		if (this.hasVariables()) {
			var pares = [];
			for (var name in this._variables) {
				if (this._variables.hasOwnProperty(name)) {
					var type = this._variables[name];
					pares.push(name + ': ' + type);
				}
			}
			output = '{\n    ' + pares.join(',\n    ') + '\n}';
		}
		return output;
	};
	/**
	 *
	 */
	Holder.prototype.clear = function() {
		this._variables = {};
	};
	/**
	 * @type {Object}
	 * @private
	 */
	Holder.prototype._variables = null;

	/**
	 * @param {Holder} holder
	 * @constructor
	 */
	var Analyzer = function(holder) {
		this._holder = holder;

		this._preTypes = {};
		this._preInputType = '';
	};
	/**
	 * @type {Holder}
	 * @private
	 */
	Analyzer.prototype._holder = null;
	/**
	 * @type {Object}
	 * @private
	 */
	Analyzer.prototype._preTypes = null;
	/**
	 * @type {string}
	 * @private
	 */
	Analyzer.prototype._preInputType = null;
	/**
	 * Auto-search of input templates variables types
	 * @param {string} text
	 * @param {boolean} isEvaluation
	 */
	Analyzer.prototype.extract = function(text, isEvaluation) {
		if (arguments.length < 2) {
			isEvaluation = false;
		}
		var exp = /this\.([a-z_][a-z0-9_]*)(\[[^\]]+\])?([a-z0-9_\.]*)/gi;
		var match;
		while ( (match = exp.exec(text)) ) {
			var type = Analyzer.VAR_TYPE.string,
				variable = match[1],
				isArray = match[2] !== undefined,
				property = match[3];
			if (isArray) {
				type = Analyzer.VAR_TYPE.array;
			} else {
				if (property.length > 0) {
					property = property.slice(1);
					if (property === 'length') {
						type = Analyzer.VAR_TYPE.array;
					} else {
						type = Analyzer.VAR_TYPE.object;
					}
				} else if (isEvaluation) {
					type = Analyzer.VAR_TYPE.unknown;
				}
			}
			this._registerVariable(variable, type);
		}
	};
	/**
	 * @param {string} text
	 */
	Analyzer.prototype.parse = function(text) {
		var exp = /^\s*this(\.[a-z_][a-z0-9\.])?\s+([\s\S]+)/i;
		var match;
		if ((match = exp.exec(text))) {
			if (match[2]) {
				if (match[1]) {
					var varName = match[1].slice(1);
					this._preTypes[varName] = match[2].replace(/\s+$/, '');
				} else {
					this._preInputType = match[2].replace(/\s+$/, '');
				}
			}
		}
	};
	/**
	 *
	 */
	Analyzer.prototype.clear = function() {
		this._preTypes = {};
		this._preInputType = '';
	};
	/**
	 *
	 */
	Analyzer.prototype.commitPredefined = function() {
		for (var varName in this._preTypes) {
			if (this._preTypes.hasOwnProperty(varName)) {
				var varType = this._preTypes[varName];
				this._holder.addVariable(varName, varType);
			}
		}
	};
	/**
	 * @return {String}
	 */
	Analyzer.prototype.getInputType = function() {
		return this._preInputType;
	};
	/**
	 * @param {string} name
	 * @param {string} type
	 * @private
	 */
	Analyzer.prototype._registerVariable = function(name, type) {
		var currentType = this._holder.getType(name);
		if (currentType !== null) {
			switch (type) {
				case Analyzer.VAR_TYPE.string:
					if (currentType === Analyzer.VAR_TYPE.unknown) {
						this._holder.addVariable(name, Analyzer.VAR_TYPE.string);
					} else if (currentType !== Analyzer.VAR_TYPE.string) {
						this._holder.addVariable(name, Analyzer.VAR_TYPE.unknown);
					}
					break;
				case Analyzer.VAR_TYPE.array:
					if (currentType !== Analyzer.VAR_TYPE.array && currentType !== Analyzer.VAR_TYPE.string) {
						this._holder.addVariable(name, Analyzer.VAR_TYPE.unknown);
					}
					break;
				case Analyzer.VAR_TYPE.object:
					if (currentType !== Analyzer.VAR_TYPE.object && currentType !== Analyzer.VAR_TYPE.string) {
						this._holder.addVariable(name, Analyzer.VAR_TYPE.unknown);
					}
					break;
				case Analyzer.VAR_TYPE.unknown:
					if (currentType !== Analyzer.VAR_TYPE.string) {
						this._holder.addVariable(name, Analyzer.VAR_TYPE.unknown);
					}
					break;
				default :
					break;
			}
		} else {
			this._holder.addVariable(name, type);
		}
	};
	/**
	 * @enum {string}
	 */
	Analyzer.VAR_TYPE = {
		string: 'string',
		array: 'Array',
		object: 'Object',
		unknown: '*'
	};

	return Engine;
}());
/**
 * @param {string} type 'component' or 'partial'
 * @param {Function} includeFunction component class or partial template function
 * @param {Object} data
 * @param {string} exportAs
 * @param {Array} templatesData
 * @return {string}
 */
cuteJS.include = function (type, includeFunction, data, exportAs, templatesData) {
	cuteJS._id++;
	exportAs = exportAs || '__null__';
	templatesData[cuteJS._id] = [includeFunction, data, exportAs];
	return '<!--' + type + cuteJS._id + '-->';
};
/**
 * Escape a string for HTML interpolation
 * @param {string} string
 * @return {string}
 */
cuteJS.escape = function(string) {
	return (''+string)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#x27;')
		.replace(/\//g,'&#x2F;');
};
/**
 * @param {string} html
 * @param {Object} templatesData
 * @param {Function} exportFunction
 * @param {cuteJS.TemplateOptions} options
 * @return {Object} template result
 */
cuteJS.buildResult = function buildResult(html, templatesData, exportFunction, options) {
	options = options || {};

	var div = document.createElement('div');
	div.innerHTML = html;

	/* create fragment */
	var fragment = document.createDocumentFragment();

	while(div.firstChild) {
		fragment.appendChild(div.firstChild);
	}
	/* end */

	/* building results */
	var exports = {};

	// parse includes
	var node = fragment,
		includeExp = /^(partial|component)(\d+)$/; // almost no difference with substr, even on 1M checks
	while(node) {
		var next = cuteJS._getNextNode(node);
		if(node.nodeType === Node.COMMENT_NODE && includeExp.test(node.nodeValue)) {
			var includeInfo = includeExp.exec(node.nodeValue);

			var includeType = includeInfo[1],
				includeDataId = includeInfo[2];
			var includeData = templatesData[includeDataId];

			var includeFunction = includeData[0],
				includeParams = includeData[1],
				includeExportName = includeData[2],
				result, includeFragment;
			if(includeType === 'partial') {
				if (includeParams) {
					result = includeFunction(includeParams, options);
				} else {
					result = includeFunction(options);
				}
				includeFragment = result.root;
				result.root = null;
			} else {
				var ComponentClass = includeFunction;
				result = new ComponentClass(includeParams);
				if (options.beforeAppendComponent) {
					options.beforeAppendComponent(result);
				}
				includeFragment = result.getContainer();
			}

			var lastFragmentChild = includeFragment.lastChild;
			node.parentNode.insertBefore(includeFragment, node);
			if (includeType === 'component' && options.afterAppendComponent) {
				 options.afterAppendComponent(result);
			}
			node.parentNode.removeChild(node);
			node = lastFragmentChild;

			// save result to exports
			if (includeExportName !== '__null__') {
				exportFunction(result, includeExportName, exports);
			}
			delete templatesData[includeDataId];
		}
		node = next;
	}

	// building exports (using "querySelectorAll" is faster then checking attributes in tree walk)
	var collection = fragment.querySelectorAll('[data-export-id]');
	var i = collection.length;
	var key, element;
	while(i--) {
		element = collection[i];
		key = element.getAttribute('data-export-id');
		element.removeAttribute('data-export-id');
		exportFunction(element, key, exports);
	}

	exportFunction(fragment, 'root', exports);
	return exports;
	/* end */
};
/**
 * @param {Element|DocumentFragment} current
 * @return {Element|DocumentFragment}
 * @private
 */
cuteJS._getNextNode = function(current) {
	var next = null;
	if (current.firstChild) {
		next = current.firstChild;
	} else if (current.nextSibling) {
		next = current.nextSibling;
	} else if(current.parentNode) {
		next = current;
		while( next && next.parentNode && !next.parentNode.nextSibling ) {
			next = next.parentNode;
		}
		if(next && next.parentNode && next.parentNode.nextSibling) {
			next = next.parentNode.nextSibling;
		} else {
			next = null;
		}
	}
	return next;
};
/**
 * @type {number}
 * @private
 */
cuteJS._id = 0;
/**
 * Interface must be implemented by classes (Components) created in the template
 * @interface
 */
cuteJS.ComponentInterface = function() {};
/**
 * @return {DocumentFragment}
 */
cuteJS.ComponentInterface.prototype.getContainer = function() {};
/**
 * @typedef {{beforeAppendComponent: Function, afterAppendComponent: Function}}
 */
cuteJS.TemplateOptions = null;
if (typeof exports !== 'undefined') {
	if (typeof module !== 'undefined' && module.exports) {
		exports = module.exports = cuteJS.Engine;
	}
	exports.TemplateEngine = cuteJS.Engine;
}

