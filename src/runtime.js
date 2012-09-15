/*global cuteJS: true*/

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