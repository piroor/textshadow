var TextShadowService = { 
	ID       : 'textshadow@piro.sakura.ne.jp',
	PREFROOT : 'extensions.textshadow@piro.sakura.ne.jp',

	shadowEnabled         : false,
	positionQuality       : 1,
	renderingUnitSize     : 1,
	silhouettePseud       : true,
	autoColorUser         : false,

	checkUserStyleSheet   : false,
	userStyleSheetDoc     : null,
	userStyleSheet        : null,

	UPDATE_INIT           : 0,
	UPDATE_PAGELOAD       : 1,
	UPDATE_RESIZE         : 2,
	UPDATE_REBUILD        : 3,
	 
/* coustructions */ 
	
	ID_PREFIX             : '_moz-textshadow-temp-', 
 
	SHADOW                : 'span', 
	SHADOW_CLASS          : '_moz-textshadow-box',
	SHADOW_CONDITION      : '@class = "_moz-textshadow-box"',

	SHADOW_CONTAINER      : '_moz-textshadow-shadow',
	SHADOW_PART           : '_moz-textshadow-shadow-part',

	DUMMY                 : '_moz-textshadow-dummy-box',
 
	FIRSTLETTER           : 'span', 
	FIRSTLETTER_CLASS     : '_moz-first-letter-pseud',
	FIRSTLETTER_CONDITION : '@class = "_moz-first-letter-pseud"',

	FIRSTLINE             : 'span',
	FIRSTLINE_CLASS       : '_moz-first-line-pseud',
	FIRSTLINE_CONDITION   : '@class = "_moz-first-line-pseud"',

	VISITED               : '_moz-pseud-class-visited',
	VISITED_CONDITION     : '@_moz-pseud-class-visited = "true"',

	TARGET                : '_moz-pseud-class-target',
	TARGET_CONDITION      : '@_moz-pseud-class-target = "true"',

	DYNAMIC_PREFIX          : '_moz-pseud-dynamic-',
	DYNAMIC_HOVER           : '_moz-pseud-dynamic-hover',
	DYNAMIC_HOVER_ANCESTOR  : 'ancestor::*[@_moz-pseud-dynamic-hover]',
	DYNAMIC_FOCUS           : '_moz-pseud-dynamic-focus',
	DYNAMIC_FOCUS_ANCESTOR  : 'ancestor::*[@_moz-pseud-dynamic-focus]',
	DYNAMIC_ACTIVE          : '_moz-pseud-dynamic-active',
	DYNAMIC_ACTIVE_ANCESTOR : 'ancestor::*[@_moz-pseud-dynamic-active]',
 
	ATTR_INIT_CUE         : '_moz-textshadow-init-cue', 
	ATTR_INIT_TIMER       : '_moz-textshadow-init-timer',
	ATTR_DRAW_CUE         : '_moz-textshadow-draw-cue',
	ATTR_DRAW_TIMER       : '_moz-textshadow-draw-timer',
	ATTR_STYLE            : '_moz-textshadow-style',
	ATTR_STYLE_FOR_EACH   : '_moz-textshadow-part-style',
	ATTR_CACHE            : '_moz-textshadow',
	ATTR_DONE             : '_moz-textshadow-done',
	ATTR_LAST_WIDTH      : '_moz-textshadow-last-width',
  
/* Utilities */ 
	
	get browser() 
	{
		return 'SplitBrowser' in window ? SplitBrowser.activeBrowser : gBrowser ;
	},
 
	IOService : Components.classes['@mozilla.org/network/io-service;1'].getService(Components.interfaces.nsIIOService), 
 
	ObserverService : Components.classes['@mozilla.org/observer-service;1'].getService(Components.interfaces.nsIObserverService), 
 
	makeURIFromSpec : function(aURI) 
	{
		try {
			var newURI;
			aURI = aURI || '';
			if (aURI && String(aURI).indexOf('file:') == 0) {
				var fileHandler = this.IOService.getProtocolHandler('file').QueryInterface(Components.interfaces.nsIFileProtocolHandler);
				var tempLocalFile = fileHandler.getFileFromURLSpec(aURI);
				newURI = this.IOService.newFileURI(tempLocalFile); // we can use this instance with the nsIFileURL interface.
			}
			else {
				newURI = this.IOService.newURI(aURI, null, null);
			}
			return newURI;
		}
		catch(e){
		}
		return null;
	},
 
	getNodesByXPath : function(aExpression, aContext, aLive) 
	{
		var d = aContext.ownerDocument || aContext;
		var type = aLive ? XPathResult.ORDERED_NODE_ITERATOR_TYPE : XPathResult.ORDERED_NODE_SNAPSHOT_TYPE ;
		var nodes;
		try {
			nodes = d.evaluate(aExpression, aContext, null, type, null);
		}
		catch(e) {
			nodes = document.evaluate(aExpression, aContext, null, type, null);
		}
		return nodes;
	},
 
	getJSValueFromAttribute : function(aNode, aAttribute) 
	{
		var value;
		try {
			var sandbox = Components.utils.Sandbox(aNode.ownerDocument.defaultView.location.href);
			value = Components.utils.evalInSandbox(aNode.getAttribute(aAttribute), sandbox);
		}
		catch(e) {
		}
		return value;
	},
 
	get userStyleSheetURL() 
	{
		if (!('_userStyleSheetURL' in this)) {
			this._userStyleSheetURL = null;
			var file = this.userStyleSheetFile;
			if (file) {
				this._userStyleSheetURL = this.IOService.newFileURI(file).spec;
			}
		}
		return this._userStyleSheetURL;
	},
 
	get userStyleSheetFile() 
	{
		if (!('_userStyleSheetFile' in this)) {
			const DIR = Components.classes['@mozilla.org/file/directory_service;1'].getService(Components.interfaces.nsIProperties);
			var file = DIR.get('UChrm', Components.interfaces.nsILocalFile);
			file.append('userContent.css');
			this._userStyleSheetFile = null;
			if (file.exists()) {
				this._userStyleSheetFile = file;
			}
		}
		return this._userStyleSheetFile;
	},
 
	addStyleSheet : function(aDocument, aURI) 
	{
		var newPI = document.createProcessingInstruction('xml-stylesheet',
				'href="'+aURI+'" type="text/css" media="all"');
		try {
			newPI = aDocument.importNode(newPI, true);
		}
		catch(e) {
		}
		try {
			aDocument.insertBefore(newPI, aDocument.firstChild || aDocument.documentElement);
		}
		catch(e) {
			dump(e+'\n');
		}
	},
  
/* CSS3 selector support */ 
	 
	getElementsBySelector : function(aTargetDocument, aSelector, aSpecificity) 
	{
		var nodes = [];
		var count = 0;

		if (!aSelector) return nodes;

		var expression = this.convertSelectorToXPath(aSelector, aTargetDocument, aSpecificity);
		if (!expression.length) return nodes;

		if (aSpecificity) {
			for (var i = 0, maxi = expression.length; i < maxi; i++)
			{
				var result = this.getNodesByXPath(expression[i], aTargetDocument);
				aSpecificity.specificities[i].targets = [];
				var targetCount = 0;
				for (var j = 0, maxj = result.snapshotLength; j < maxj; j++)
				{
					aSpecificity.specificities[i].targets[targetCount++] = nodes[count++] = result.snapshotItem(j);
				}
			}
		}
		else {
			var result = this.getNodesByXPath(expression, aTargetDocument);
			for (var i = 0, maxi = result.length; i < maxi; i++)
			{
				nodes[count++] = result.snapshotItem(i);
			}
		}
		return nodes;
	},
 
	convertSelectorToXPath : function(aSelector, aTargetDocument, aSpecificity, aInNotPseudClass) 
	{
		var makeOneExpression = false;
		if (!aSpecificity) {
			makeOneExpression = true;
			aSpecificity = {};
		}

		var self = this;
		var foundElements = [aTargetDocument];

		var tokens = aSelector
					.replace(/\s+/g, ' ')
					.replace(/\s*([>+])\s*/g, '$1');

		tokens = tokens.split('');

		var buf = {
			'element'     : '',
			'attributes'  : [],
			'attribute'   : '',
			'id'          : '',
			'class'       : '',
			'pseud'       : '',
			'pseuds'      : [],
			'combinators' : ' ',
			'clear'       : function () {
				this.element     = '';
				this.attributes  = [];
				this.attribute   = '';
				this.id          = '';
				this.class       = '';
				this.pseud       = '';
				this.pseuds      = [];
				this.combinators = '';
			},
			isEmpty : function() {
				return !(this.element || this.attributes.length || this.id || this.class || this.pseuds.length);
			}
		};

		var mode = 'element';

		var steps              = [];
		var stepsCount         = 0;
		var expressions        = [];
		var expressionsCount   = 0;

		var selector               = '';
		aSpecificity.id            = 0;
		aSpecificity.element       = 0;
		aSpecificity.condition     = 0;
		aSpecificity.specificities = [];
		var specificityCount       = 0;

		function evaluate(aExpression, aTargetElements)
		{
			if (!aExpression) return aTargetElements;
			var found = [];
			var foundCount = 0;
			for (var i = 0, maxi = aTargetElements.length; i < maxi; i++)
			{
				var nodes = self.getNodesByXPath(aExpression, aTargetElements[i]);
				for (var j = 0, maxj = nodes.snapshotLength; j < maxj; j++)
				{
					found[foundCount++] = nodes.snapshotItem(j);
				}
			}
			return found;
		}

		function makeLocationStep(aStep, aConditions)
		{
			var step = aStep;
			if (aConditions.length) {
				step += '['+aConditions.join('][')+']';
			}
			return step;
		}

		function getElementsByCondition( callback, targetElements )
		{
			var elements = [];
			var elmCount = 0;
			for ( var i = 0, len = targetElements.length; i < len; i++ ) {
				var element = targetElements[i];
				if ( callback(element) > 0 ) {
					elements[elmCount++] = element;
				}
			}
			return elements;
		}

		function getFirstLetters(targetElements)
		{
			var elements = [];
			var count = 0;
			var first = aTargetDocument.createElement(self.FIRSTLETTER);
			first.setAttribute('class', self.FIRSTLETTER_CLASS);
			for (var i = 0, len = targetElements.length; i < len; i++)
			{
				var firsts = self.getNodesByXPath('descendant::*['+self.FIRSTLETTER_CONDITION+']', targetElements[i]);
				if (firsts.snapshotLength) {
					elements[count++] = firsts.snapshotItem(0);
				}
				else {
					var text = self.getNodesByXPath('descendant::text()', targetElements[i]);
					var node = text.snapshotItem(0);
					node.nodeValue = node.nodeValue.replace(/^(\s*[\"\'\`\<\>\{\}\[\]\(\)\u300c\u300d\uff62\uff63\u300e\u300f\u3010\u3011\u2018\u2019\u201c\u201d\uff3b\uff3d\uff5b\uff5d\u3008\u3009\u300a\u300b\uff08\uff09\u3014\u3015]*.)/, '');
					var newFirst = first.cloneNode(true)
					node.parentNode.insertBefore(newFirst, node)
						.appendChild(aTargetDocument.createTextNode(RegExp.$1));
					elements[count++] = newFirst;
				}
			}
			return elements;
		}

		function getFirstLines(targetElements)
		{
			var elements = [];
			var count = 0;
			var d = aTargetDocument;
			var first = d.createElement(self.FIRSTLINE);
			first.setAttribute('class', self.FIRSTLINE_CLASS);

			var dummy = d.createElement(self.DUMMY);
			var dummy1 = dummy.cloneNode(true);
			var dummy2 = dummy.cloneNode(true);
			var range = d.createRange();
			for (var i = 0, len = targetElements.length; i < len; i++)
			{
				var firsts = self.getNodesByXPath('descendant::*['+self.FIRSTLINE_CONDITION+']', targetElements[i]);
				if (firsts.snapshotLength) {
					elements[count++] = firsts.snapshotItem(0);
				}
				else {
					var text = self.getNodesByXPath('descendant::text()', targetElements[i]);
					var lineEnd = false;
					for (var j = 0, maxj = text.snapshotLength; j < maxj; j++)
					{
						var node = text.snapshotItem(j);
						var parent = node.parentNode;
						var firstPart = first.cloneNode(true);
						firstPart.appendChild(d.createTextNode(''));
						parent.insertBefore(dummy1, node);
						var y = d.getBoxObjectFor(dummy1).screenY;
						for (var k = 0, maxk = node.nodeValue.length; k < maxk; k++)
						{
							range.selectNodeContents(parent);
							range.setStart(dummy1.nextSibling, k);
							range.collapse(true);
							range.insertNode(dummy2);
							range.setStartBefore(parent.firstChild);
							if (d.getBoxObjectFor(dummy2).screenY != y) {
								firstPart.firstChild.nodeValue = firstPart.firstChild.nodeValue.substring(0, firstPart.firstChild.nodeValue.length-1);
								parent.removeChild(dummy2);
								parent.normalize();
								lineEnd = true;
								break;
							}
							firstPart.firstChild.nodeValue += parent.textContent.charAt(k);
							parent.removeChild(dummy2);
							parent.normalize();
						}
						parent.removeChild(dummy1);
						if (firstPart.firstChild.nodeValue.length &&
							!/^\s*$/.test(firstPart.firstChild.nodeValue)) {
							range.selectNodeContents(parent);
							range.insertNode(firstPart);
							range.selectNodeContents(parent);
							range.setStartAfter(firstPart);
							range.setEnd(firstPart.nextSibling, firstPart.firstChild.nodeValue.length);
							range.deleteContents();
							elements[count++] = firstPart;
						}
						if (lineEnd) break;
					}
				}
			}
			range.detach();
			return elements;
		}

		function search(aEndOfPath)
		{
			if (!buf.isEmpty()) {
				var step =
					buf.combinators == '>' ? '*' :
					buf.combinators == '+' ? 'following-sibling::*[1]' :
					buf.combinators == '~' ? 'following-sibling::*' :
					'descendant::*';

				aSpecificity.element++;

				var con       = [];
				var conCount  = 0;

				var tagName = ((buf.element || '').replace(/^(\w+|\*)\|/, '') || '*');
				var nameCondition = '';
				if (tagName != '*') {
					nameCondition = 'local-name() = "'+tagName+'" or local-name() = "'+tagName.toUpperCase()+'"';
					con[conCount++] = nameCondition;
				}

				if (buf.id.length) {
					con[conCount++] = '@id = "'+buf.id+'"';
					aSpecificity.id++;
				}

				if (buf.class.length) {
					var classes = buf.class.split('.').map(function(aItem) {
							return 'contains(concat(" ",@class," "), " '+aItem+' ")'
						});
					con[conCount++] = classes.join(' and ');
					aSpecificity.condition += classes.length;
				}

				var attributes = buf.attributes;
				if (attributes.length) {
					for (var i = 0, attr_len = attributes.length; i < attr_len; i++)
					{
						var attribute = attributes[i];
						/^(\w+)\s*(?:([~\|\^\$\*]?=)\s*["]?(.+?)["]?)?$/.test(attribute);
						var attrName  = RegExp.$1;
						var operator  = RegExp.$2;
						var attrValue = RegExp.$3;
						attributes[i] =
							operator == '=' ? '@'+attrName+' = "'+attrValue+'"' :
							operator == '~=' ? 'contains(concat(" ",@'+attrName+'," "), " '+attrValue+' " )' :
							operator == '|=' ? 'starts-with(@'+attrName+', "'+attrValue+'") or starts-with(@'+attrName+', "'+attrValue+'-")' :
							operator == '^=' ? 'starts-with(@'+attrName+', "'+attrValue+'" )' :
							operator == '$=' ? 'substring(@'+attrName+', string-length(@'+attrName+') - string-length("'+attrValue+'") + 1) = "'+attrValue+'"' :
							operator == '*=' ? 'contains(@'+attrName+', "'+attrValue+'" )' :
								'@'+attrName;
					}
					con[conCount++] = attributes.length > 1 ? '('+attributes.join(') and (')+')' : attributes[0] ;
					aSpecificity.condition += attributes.length;
				}

				var pseuds = buf.pseuds;
				pseudRoop:
				for (var i = 0, maxi = pseuds.length; i < maxi; i++)
				{
					var pseud = pseuds[i];
					if (!pseud) continue;
					var pseudEvaluated = true;
					aSpecificity.condition++;
					switch (pseud)
					{
						case 'first-child':
							con[conCount++] = 'not(preceding-sibling::*)';
							break;
						case 'last-child':
							con[conCount++] = 'not(following-sibling::*)';
							break;
						case 'first-of-type':
							con[conCount++] = 'not(preceding-sibling::*'+nameCondition+')';
						case 'last-of-type':
							con[conCount++] = 'not(following-sibling::*'+nameCondition+')';
							break;
						case 'only-child':
							con[conCount++] = 'count(parent::*/child::*) = 1';
							break;
						case 'only-of-type':
							con[conCount++] = 'count(parent::*/child::*'+nameCondition+') = 1';
							break;
						case 'empty':
							con[conCount++] = 'not(node())';
							break;
						case 'link':
							con[conCount++] = '@href and contains(" link LINK a A area AREA ", concat(" ",local-name()," "))';
							break;
						case 'enabled':
							con[conCount++] = '(@enabled and (@enabled = "true" or @enabled = "enabled" or @enabled != "false")) or (@disabled and (@disabled == "false" or @disabled != "disabled"))';
							break;
						case 'disabled':
							con[conCount++] = '(@enabled and (@enabled = "false" or @enabled != "enabled")) or (@disabled and (@disabled == "true" or @disabled = "disabled" or @disabled != "false"))';
							break;
						case 'checked':
							con[conCount++] = '(@checked and (@checked = "true" or @checked = "checked" or @checked != "false")) or (@selected and (@selected = "true" or @selected = "selected" or @selected != "false"))';
							break;
						case 'indeterminate':
							con[conCount++] = '(@checked and (@checked = "false" or @checked != "checked")) or (@selected and (@selected = "false" or @selected != "selected"))';
							break;
						case 'root':
							step = step.replace(/^descendant::/, 'descendant-or-self::');
							con[conCount++] = 'not(ancestor::*)';
							break;
						default:
							var axis = /^nth-last-/.test(pseud) ? 'following-sibling' : 'preceding-sibling' ;
							var condition = /^nth-(last-)?of-type/.test(pseud) ? nameCondition : '' ;

							if (/not\(\s*(.+)\s*\)$/.test(pseud)) {
								var spec = {};
								con[conCount++] = 'not('+self.convertSelectorToXPath(RegExp.$1, aTargetDocument, spec, true)+')';
								aSpecificity.id        += spec.id;
								aSpecificity.element   += spec.element;
								aSpecificity.condition += spec.condition;
								aSpecificity.condition--;
							}

							else if (/nth-(last-)?(child|of-type)\(\s*([0-9]+)\s*\)/.test(pseud)) {
								con[conCount++] = 'count('+axis+'::*'+condition+') = '+(parseInt(RegExp.$3)-1);
							}
							else if (/nth-(last-)?(child|of-type)\(\s*([0-9]+)n\s*(([\+\-])\s*([0-9]+)\s*)?\)/.test(pseud)) {
								con[conCount++] = '(count('+axis+'::*'+condition+')'+(RegExp.$6 ? ' '+RegExp.$5+' '+RegExp.$6 : '' )+') mod '+RegExp.$3+' = 1';
							}
							else if (/nth-(last-)?(child|of-type)\(\s*(odd|even)\s*\)/.test(pseud)) {
								con[conCount++] = 'count('+axis+'::*'+condition+') mod 2 = '+(RegExp.$3 == 'even' ? '1' : '0' );
							}

							else if (/contains\(\s*["'](.+)["']\s*\)/.test(pseud)) {
								con[conCount++] = 'contains(descendant::text(), "'+RegExp.$1+'")';
							}

							else {
								aSpecificity.condition--;
								pseudEvaluated = false;
							}
							break;
					}
					if (!pseudEvaluated) {
						foundElements = evaluate(steps.join('/')+'/'+makeLocationStep(step, con), foundElements);
						switch (pseud)
						{
							case 'visited':
								if (self.silhouettePseud) {
									var history = Components.classes['@mozilla.org/browser/global-history;2'].getService(Components.interfaces.nsIGlobalHistory2);
									foundElements = getElementsByCondition(function(aNode) {
										var uri = aNode.href || aNode.getAttribute('href');
										var isLink = /^(link|a|area)$/i.test(aNode.localName) && uri;
										var isVisited = false;
										if (isLink) {
											try {
												isVisited = history.isVisited(self.makeURIFromSpec(uri));
											}
											catch(e) {
												dump(uri+' / '+self.makeURIFromSpec(uri));
												dump(e+'\n');
											}
											if (isVisited) aNode.setAttribute(self.VISITED, true);
										}
										return isLink && isVisited ? 1 : -1 ;
									}, foundElements);
									con[conCount++] = self.VISITED_CONDITION;
									aSpecificity.condition++;
									break;
								}

							case 'target':
								if (self.silhouettePseud) {
									foundElements = getElementsByCondition(function(aNode) {
										(/#(.+)$/).test(aTargetDocument.defaultView.location.href);
										var isTarget = RegExp.$1 && aNode.getAttribute('id') == decodeURIComponent(RegExp.$1);
										if (isTarget) aNode.setAttribute(self.TARGET, true);
										return isTarget ? 1 : -1 ;
									}, foundElements);
									con[conCount++] = self.TARGET_CONDITION;
									aSpecificity.condition++;
									break;
								}

							case 'hover':
							case 'focus':
							case 'active':
								if (self.silhouettePseud) {
									foundElements = getElementsByCondition(function(aNode) {
										aNode.setAttribute(self.DYNAMIC_PREFIX+pseud, true);
										return 1;
									}, foundElements);
									aSpecificity.condition++;
									break;
								}

							case 'first-letter':
								if (self.silhouettePseud) {
									steps[stepsCount++] = makeLocationStep(step, con);
									foundElements = getFirstLetters(foundElements);
									steps[stepsCount++] = 'descendant::*['+self.FIRSTLETTER_CONDITION+']';
									step = null;
									break;
								}

							case 'first-line':
								if (self.silhouettePseud) {
									steps[stepsCount++] = makeLocationStep(step, con);
									foundElements = getFirstLines(foundElements);
									steps[stepsCount++] = 'descendant::*['+self.FIRSTLINE_CONDITION+']';
									step = null;
									break;
								}

							default:
								aSpecificity.id        = 0;
								aSpecificity.element   = 0;
								aSpecificity.condition = 0;
								step       = '';
								con        = [];
								conCount   = 0;
								steps      = [];
								stepsCount = 0;
								foundElements = [aTargetDocument];
								break pseudRoop;
						}
					}
				}

				if (step) steps[stepsCount++] = makeLocationStep(step, con);
			}
			buf.clear();

			if (aEndOfPath) {
				if (stepsCount && aInNotPseudClass) {
					steps.reverse();
					var isFirst = true;
					for (var i = 0, maxi = steps.length; i < maxi; i++)
					{
						if (isFirst) {
							steps[i] = steps[i]
										.replace(/^[^:\*]*(::)?/, 'self::');
							isFirst = false;
						}
						else {
							steps[i] = steps[i]
										.replace(/^([^:\*]*(::?)|child::)/, 'parent::')
										.replace(/^descendant/, 'ancestor');
						}
					}
				}
				if (stepsCount) {
					expressions[expressionsCount++] = (aInNotPseudClass ? '' : '/' ) + steps.join('/');
					aSpecificity.specificities[specificityCount++] = {
						selector : selector,
						value    : [
							'0',
							aSpecificity.id || '0',
							aSpecificity.condition || '0',
							aSpecificity.element || '0'
						].join('') || '0000'
					};
					aSpecificity.id        = 0;
					aSpecificity.element   = 0;
					aSpecificity.condition = 0;
				}

				steps      = [];
				stepsCount = 0;
				selector   = '';
			}
		};

		var escaped    = false;
		var parenLevel = 0;
		for ( var i = 0, len = tokens.length; i < len; i++  )
		{
			var token = tokens[i];
			selector += token;

			if (escaped) {
				buf[mode] += token;
				escaped = false;
				continue;
			}
			else if (token == '\\') {
				escaped = true;
				continue;
			}
			else if (parenLevel && token != ')') {
				if (token == '(')  parenLevel++;
				buf[mode] += token;
				continue;
			}
			else if (mode == 'attribute' && token != ']') {
				buf[mode] += token;
				continue;
			}
			switch (token)
			{
				// selector
				case '[':
					if (mode == 'pseud' && !parenLevel) {
						buf.pseuds.push(buf.pseud);
						buf.pseud = '';
					}
					mode = 'attribute';
					break;
				case ']':
					buf.attributes.push(buf.attribute);
					buf.attribute = '';
					mode = 'element';
					break;
				case '.':
					if (mode == 'pseud' && !parenLevel) {
						buf.pseuds.push(buf.pseud);
						buf.pseud = '';
					}
					else if (mode == 'class') {
						buf[mode] += token;
					}
					mode = 'class';
					break;
				case '#':
					if (mode == 'pseud' && !parenLevel) {
						buf.pseuds.push(buf.pseud);
						buf.pseud = '';
					}
					mode = 'id';
					break;

				case ':':
					if (mode == 'pseud' && !parenLevel) {
						buf.pseuds.push(buf.pseud);
						buf.pseud = '';
					}
					mode = 'pseud';
					break;
				case '(':
					if (mode == 'pseud') {
						parenLevel++;
					}
					buf[mode] += token;
					break;
				case ')':
					buf[mode] += token;
					if (mode == 'pseud') {
						buf.pseuds.push(buf.pseud);
						buf.pseud = '';
					}
					if (parenLevel) {
						parenLevel--;
						if (!parenLevel) mode = 'element';
					}
					break;

				// combinators
				case ' ':
				case '>':
				case '+':
				case '~':
					if (mode == 'pseud' && !parenLevel) {
						buf.pseuds.push(buf.pseud);
						buf.pseud = '';
					}
					search();
					buf.combinators = token;
					mode = 'element';
					break;

				// elements
				case '*':
					if (mode == 'pseud' && !parenLevel) {
						buf.pseuds.push(buf.pseud);
						buf.pseud = '';
					}
					else {
						buf.element = '*';
					}
					break;

				case ',':
					if (mode == 'pseud' && !parenLevel) {
						buf.pseuds.push(buf.pseud);
						buf.pseud = '';
					}
					selector = selector.replace(/,$/, '');
					search(true);
					buf.combinators = ' ';
					foundElements = [aTargetDocument]
					mode = 'element';
					break;

				// default
				default :
					buf[mode] += token;
					break;

			}
			if (!foundElements.length) {
				return makeOneExpression ? expressions.join(' | ') : expressions ;
			}
		}
		if (mode == 'pseud' && !parenLevel) {
			buf.pseuds.push(buf.pseud);
			buf.pseud = '';
		}
		search(true);

		return makeOneExpression ? expressions.join(' | ') : expressions ;
	},
  
/* draw shadow */ 
	 
	createShadowBox : function(aNode) 
	{
		var d = aNode.ownerDocument;
		var boxes = [];

		var shadowBoxes = this.getNodesByXPath('descendant::*['+this.SHADOW_CONDITION+']', aNode);
		if (shadowBoxes.snapshotLength) {
			var value = this.getJSValueFromAttribute(aNode, this.ATTR_STYLE);
			var types = ['hover', 'focus', 'active'];
			for (var i = 0, maxi = shadowBoxes.snapshotLength; i < maxi; i++)
			{
				var box = shadowBoxes.snapshotItem(i);
				var current = this.getJSValueFromAttribute(box, this.ATTR_STYLE_FOR_EACH) || {};

				if (
					value.normal &&
					(
						!current.normal ||
						(
							value.normal.nest > current.normal.nest ||
							current.normal.specificity < value.normal.specificity
						)
					)
					)
					current.normal = value.normal;

				for (var j in types)
				{
					if (!value[types[j]]) {
						if (current[types[j]]) delete current[types[j]];
					}
					else if (
						!current[types[j]] ||
						(
							value[types[j]].nest > current[types[j]].nest ||
							current[types[j]].specificity < value[types[j]].specificity
						)
						)
						current[types[j]] = value[types[j]];
				}

				box.setAttribute(this.ATTR_STYLE_FOR_EACH, current.toSource());
				boxes.push(box);
			}
		}
		else {
			var textNodes = this.getNodesByXPath('descendant::text()[not(ancestor::*['+this.SHADOW_CONDITION+' or contains(" script noscript style head object iframe frame frames noframes ", concat(" ",local-name()," ")) or contains(" SCRIPT NOSCRIPT STYLE HEAD OBJECT IFRAME FRAME FRAMES NOFRAMES ", concat(" ",local-name()," "))])]', aNode);
			var wrapper = d.createElement(this.SHADOW);
			wrapper.setAttribute('class', this.SHADOW_CLASS);
			wrapper.setAttribute(this.ATTR_STYLE_FOR_EACH, aNode.getAttribute(this.ATTR_STYLE));
			for (var i = 0, maxi = textNodes.snapshotLength; i < maxi; i++)
			{
				var node = textNodes.snapshotItem(i);
				if (/^\s+$/.test(node.nodeValue)) continue;

				var preWhiteSpaces = node.nodeValue.match(/^\s+/);
				if (preWhiteSpaces) {
					node.nodeValue = node.nodeValue.replace(/^\s*/, '');
					node.parentNode.insertBefore(d.createTextNode(preWhiteSpaces), node);
				}

				var postWhiteSpaces = node.nodeValue.match(/\s+$/);
				if (postWhiteSpaces) {
					node.nodeValue = node.nodeValue.replace(/\s+$/, '');
					if (node.nextSibling)
						node.parentNode.insertBefore(d.createTextNode(postWhiteSpaces), node.nextSibling);
					else
						node.parentNode.appendChild(d.createTextNode(postWhiteSpaces));
				}

				var newWrapper = wrapper.cloneNode(true);
				newWrapper.appendChild(node.cloneNode(true));
				node.parentNode.insertBefore(newWrapper, node);
				node.parentNode.removeChild(node);

				boxes.push(newWrapper);
			}
		}

		var self = this;
		var cues = this.getJSValueFromAttribute(d.documentElement, this.ATTR_DRAW_CUE) || [];
		cues = cues.concat(boxes.map(function(aItem) {
				var id = aItem.getAttribute('id');
				if (!id) {
					id = self.ID_PREFIX+parseInt(Math.random() * 1000000);
					aItem.setAttribute('id', id);
				}
				return id;
			}));
		d.documentElement.setAttribute(this.ATTR_DRAW_CUE, cues.toSource());
		this.startAllDraw(d.defaultView);
	},
 	
	startAllDraw : function(aFrame) 
	{
		var node = aFrame.document.documentElement;
		var cues = this.getJSValueFromAttribute(node, this.ATTR_DRAW_CUE);
		if (!cues || !cues.length)
			return;

		var timerId = node.getAttribute(this.ATTR_DRAW_TIMER);
		if (timerId) {
			aFrame.clearTimeout(timerId);
		}
		timerId = aFrame.setTimeout(this.delayedDraw, 0, this, aFrame);
		node.setAttribute(this.ATTR_DRAW_TIMER, timerId);
	},
 
	delayedDraw : function(aSelf, aFrame) 
	{
		var node = aFrame.document.documentElement;
		node.removeAttribute(aSelf.ATTR_DRAW_TIMER);

		var cues = aSelf.getJSValueFromAttribute(node, aSelf.ATTR_DRAW_CUE);
		if (!cues || !cues.length) {
			node.removeAttribute(aSelf.ATTR_DRAW_CUE);
			return;
		}

		var lastParent;
		var info;
		var types = ['hover', 'focus', 'active'];
		var expressions  = [aSelf.DYNAMIC_HOVER_ANCESTOR, aSelf.DYNAMIC_FOCUS_ANCESTOR, aSelf.DYNAMIC_ACTIVE_ANCESTOR];
		for (var i = 0, maxi = aSelf.renderingUnitSize; i < maxi && cues.length; i++)
		{
			var cue = aFrame.document.getElementById(cues.splice(0, 1));
			if (!cue) {
				i--;
				continue;
			}

			try {
				var info = aSelf.getJSValueFromAttribute(cue, aSelf.ATTR_STYLE_FOR_EACH);
				if (info) {
					if (info.normal) {
						aSelf.drawShadows(cue, info.normal);
					}
					for (var j in types)
					{
						if (
							!info[types[j]] ||
							(
								info.normal &&
								info.normal.specificity > info[types[j]].specificity
							)
							)
							continue;
						new TextShadowDynamicEventListener(
							cue,
							aSelf.getNodesByXPath(expressions[j], cue).snapshotItem(0),
							info[types[j]]
						);
					}
				}
			}
			catch(e) {
				dump(e+'\n');
			}

			cue.removeAttribute('id');
		}

		node.setAttribute(aSelf.ATTR_DRAW_CUE, cues.toSource());

		var timerId = aFrame.setTimeout(aSelf.delayedDraw, 0, aSelf, aFrame);
		node.setAttribute(aSelf.ATTR_DRAW_TIMER, timerId);
	},
 
	drawShadows : function(aNode, aInfo) 
	{
		for (var i = 0, maxi = aInfo.shadows.length; i < maxi; i++)
		{
			this.drawOneShadow(
				aNode,
				aInfo.shadows[i].x,
				aInfo.shadows[i].y,
				aInfo.shadows[i].radius,
				aInfo.shadows[i].color,
				aInfo.type,
				aInfo.isUserStyle
			);
		}
	},
	 
	drawOneShadow : function(aNode, aX, aY, aRadius, aColor, aType, aIsUserStyle) 
	{
		if ((!aX && !aY && !aRadius) || (aColor || '').toLowerCase() == 'transparent') {
			this.clearOneShadow(aNode);
			return;
		}

		var d = aNode.ownerDocument;
		var w = d.defaultView;

		var innerBox = d.getAnonymousNodes(aNode)[0];
		if (!innerBox.hasAttribute('initialized')) this.initShadowBox(aNode);

		var boxWidth  = parseInt(innerBox.getAttribute('box-width'));
		var boxHeight = parseInt(innerBox.getAttribute('box-height'));

		var x      = this.convertToPixels((aX || 0), boxWidth, aNode);
		var y      = this.convertToPixels((aY || 0), boxHeight, aNode);
		var radius = this.convertToPixels((aRadius || 0), boxWidth, aNode);

		var quality = 0;
		var gap;
		do {
			gap = quality;
			quality++;
			radius = Math.max(Math.max(radius, 1) / quality, 1);
		}
		while (radius != 1 && (radius * radius) > 30)

		if (radius != 1) radius *= 1.2; // to show like Safari

		var opacity = 1 / radius;

		if (radius != 1) { // to show like Safari
			opacity *= 0.3;
			x *= 0.8;
			y *= 0.8;
		}

		if (!aColor && aIsUserStyle && this.autoColorUser) {
			w.getComputedStyle(aNode, null).getPropertyValue('color').match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(,\s*(\d+)\s*)?\)/i);
			var fgRGB = [
					Number(RegExp.$1),
					Number(RegExp.$2),
					Number(RegExp.$3)
				];

			var bg = null;
			var bgNode = aNode.parentNode;
			while (bg == 'transparent' && bgNode.parentNode)
			{
				bgNode = bgNode.parentNode;
				bg = w.getComputedStyle(bgNode, null).getPropertyValue('background-color');
			}
			if (!bg) bg = 'rgb(255,255,255)';
			bg.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(,\s*(\d+)\s*)?\)/i);
			var bgRGB = [
					Number(RegExp.$1),
					Number(RegExp.$2),
					Number(RegExp.$3)
				];

			// 元の色の明るさを調査
			// なお、グレースケールへの変換式はこちらのサイトより引用。
			// http://www.geocities.co.jp/Milkyway/4171/graphics/002-6.html
			// check the brightness of the color
			var fgBright = Math.floor(((299*fgRGB[0])+(582*fgRGB[1])+(114*fgRGB[2]))/1000);
			var bgBright = Math.floor(((299*bgRGB[0])+(582*bgRGB[1])+(114*bgRGB[2]))/1000);

			aColor = (fgBright < 85 && bgBright < 85) ? 'white' :
					(fgBright < 85 && bgBright < 170) ? 'black' :
					(fgBright < 85) ? 'gray' :
					(fgBright < 170 && bgBright < 85) ? 'white' :
					(fgBright < 170 && bgBright < 170) ? 'black' :
					(fgBright < 170) ? 'gray' :
					(bgBright < 85) ? 'black' :
					(bgBright < 170) ? 'black' :
					'gray' ;
//			dump(w.getComputedStyle(aNode, null).getPropertyValue('color')+' / '+bg+'('+fgBright+','+bgBright+') => '+aColor+'\n');
		}

		var color = (aColor || w.getComputedStyle(aNode, null).getPropertyValue('color'));


		var xOffset = parseInt(innerBox.getAttribute('x-offset'));
		var yOffset = parseInt(innerBox.getAttribute('y-offset'));
		var shadows = d.createElement(this.SHADOW_CONTAINER);
		shadows.setAttribute('style',
			innerBox.getAttribute('rendering-style')
			+ 'text-indent: '+innerBox.getAttribute('indent')+'px !important;'
			+ 'width: '+innerBox.getAttribute('width')+'px !important;'
			+ 'z-index: 1 !important;'
			+ 'top: ' + (yOffset+y-(radius / 2)) + 'px !important;'
			+ 'bottom: ' + (-(yOffset+y-(radius / 2))) + 'px !important;'
			+ 'left: ' + (xOffset+x-(radius / 2)) + 'px !important;'
			+ 'right: ' + (-(xOffset+x-(radius / 2))) + 'px !important;'
			+ '-moz-user-select: -moz-none !important;'
			+ '-moz-user-focus: ignore !important;'
			+ 'text-decoration: none !important;'
			+ 'color: ' + color + ' !important;'
		);
		if (aType) {
			shadows.setAttribute('type', aType);
			innerBox.setAttribute('has-'+aType, true);
		}

		var nodes  = aNode.childNodes;
		var part   = d.createElement(this.SHADOW_PART);

		var anchor;
		var endOffset = innerBox.getAttribute('end-offset');
		if (endOffset != '0') {
			anchor = d.createElement(this.DUMMY);
			anchor.setAttribute('style', 'padding-right: '+endOffset+'px !important;');
		}

		var baseStyle =
			'position: absolute !important;'
			+ 'margin: 0 !important; padding: 0 !important; text-indent: inherit !important;'
			+ 'opacity: ' + opacity + ' !important;'
			+ 'color: ' + color + ' !important;';

		for (var i = 0, maxi = radius; i < maxi; i++)
		{
			for (var j = 0, maxj = radius; j < maxj; j++)
			{
				var shadow = part.cloneNode(true);
				var f = d.createDocumentFragment();
				for (var k = 0, maxk = nodes.length; k < maxk; k++)
				{
					f.appendChild(nodes[k].cloneNode(true));
				}
				if (anchor) f.appendChild(anchor.cloneNode(true));
				shadow.appendChild(f);
				shadow.setAttribute('style',
					baseStyle
					+ 'top: ' + (i+gap) + 'px !important;'
					+ 'bottom: ' + (-i-gap) + 'px !important;'
					+ 'left: ' + (j+gap) + 'px !important;'
					+ 'right: ' + (-j-gap) + 'px !important;'
				);
				shadows.appendChild(shadow);
			}
		}

		innerBox.appendChild(shadows);
	},
	 
	initShadowBox : function(aNode) 
	{
		var d = aNode.ownerDocument;
		var w = d.defaultView;
		var p = aNode.parentNode;

		var innerBox = d.getAnonymousNodes(aNode)[0];
		if (innerBox.hasAttribute('initialized')) return;

		var originalContainer = innerBox.childNodes[0];
		var baseContainer     = innerBox.childNodes[1];

		innerBox.setAttribute('initialized', true);

		originalContainer.setAttribute('style',
			'visibility: hidden !important;'
			+ '-moz-user-select: -moz-none !important;'
			+ '-moz-user-focus: ignore !important;'
		);
		baseContainer.setAttribute('style',
			'position: absolute !important;'
			+ 'top: 0 !important;'
			+ 'left: 0 !important;'
		);

		var originalAnchor    = originalContainer.lastChild;
		var originalAnchorBox = d.getBoxObjectFor(originalAnchor);
		var baseAnchor        = baseContainer.lastChild;
		var baseAnchorBox     = d.getBoxObjectFor(baseAnchor);

		var nodes = aNode.childNodes;
		var f = d.createDocumentFragment();
		for (var i = 0, maxi = nodes.length; i < maxi; i++)
		{
			f.appendChild(nodes[i].cloneNode(true));
		}
		originalContainer.insertBefore(f, originalAnchor);


		var xOffset   = 0;
		var yOffset   = 0;

		var context = w.getComputedStyle(p, null).getPropertyValue('display');
		var originalBoxObject = d.getBoxObjectFor(context == 'inline' ? p : aNode );
		var hasFollowingExpression = 'following-sibling::* | following-sibling::* | following-sibling::text()[translate(text(), " \u3000\t\n\r", "")]';
		var hasSiblingNodes = this.getNodesByXPath('preceding-sibling::* | preceding-sibling::text()[translate(text(), " \u3000\t\n\r", "")] | '+hasFollowingExpression, aNode).snapshotLength;
		if (
			context != 'none' &&
			(context.indexOf('table-') == 0 || hasSiblingNodes)
			)
			context = 'inline';

		var info       = this.getSizeBox(context == 'inline' ? aNode : p );
		var parentBox  = info.sizeBox;
		var lineHeight = this.getComputedPixels(originalContainer, 'line-height');
		var fontSize   = this.getComputedPixels(aNode, 'font-size');
		var width      = info.width;
		var indent     = 0;

		switch (context)
		{
			case 'none':
				return;
			case 'inline':
				yOffset -= Math.round((lineHeight - fontSize) / 2);
				var parentBoxObject = d.getBoxObjectFor(parentBox);
				if (originalBoxObject.height > lineHeight * 1.5) { // inlineで折り返されている場合
					var delta = originalBoxObject.screenX - parentBoxObject.screenX - this.getComputedPixels(parentBox, 'padding-left');
					xOffset -= delta;
					indent += delta;
					width = info.boxWidth;
				}
				break;
			default:
				if (this.positionQuality < 1) break;

				var dummy1 = d.createElement(this.DUMMY);
				dummy1.appendChild(d.createTextNode('!'));
				var dummy2 = dummy1.cloneNode(true);
				dummy1.setAttribute('style', 'position: absolute; top: 0; left: 0;');

				var f = d.createDocumentFragment();
				f.appendChild(dummy1);
				f.appendChild(dummy2);
				innerBox.appendChild(f);
				yOffset += (d.getBoxObjectFor(dummy2).height - d.getBoxObjectFor(dummy1).height) / 2;
				innerBox.removeChild(dummy1);
				innerBox.removeChild(dummy2);
				break;
		}

		var renderingStyle = 'position: absolute !important;'
			+ 'margin: 0 !important;'
			+ 'padding: 0 !important;';

		var align = w.getComputedStyle(parentBox, null).getPropertyValue('text-align');

		// ブロック要素の唯一の子である場合、インデントを継承した上で全体をずらす
		if (parentBox == p && !hasSiblingNodes) {
			indent += info.indent;
			xOffset -= info.indent;
			if (align != 'left' && align != 'start' && align != 'justify' &&
				context == 'block') {
				xOffset -= d.getBoxObjectFor(aNode).screenX - info.boxX - info.indent;
			}
		}

		if (w.getComputedStyle(parentBox, null).getPropertyValue('float') != 'none')
			yOffset += this.getComputedPixels(parentBox, 'margin-top');

		width = Math.min(width, info.boxWidth);

		var style = baseContainer.style;
		style.cssText = renderingStyle
			+ 'width: '+width+'px;' // !importantを付けてしまうと、後でstyleプロパティを操作しても変更が反映されなくなってしまう。なので、ここでは!importantなしの指定。
			+ 'text-indent: '+indent+'px !important;'
			+ 'z-index: 2 !important;'
			+ 'top: ' + yOffset + 'px !important;'
			+ 'bottom: ' + (-yOffset) + 'px !important;'
			+ 'left: ' + xOffset + 'px !important;'
			+ 'right: ' + (-xOffset) + 'px !important;';


		/*
			font-weightがboldだと、BoxObjectの幅と実際の幅が
			一致しなくなることがある（Gecko 1.8のバグ？）。
			オリジナルのテキストノードと複製のテキストノードの直後に挿入した
			ダミーノードの位置を比較して、改行がなくなるまで幅を増やす。
		*/
		var lastLineY = originalAnchorBox.screenY;
		var origBox   = d.getBoxObjectFor(originalContainer);
		if (this.getComputedPixels(aNode, 'font-weight') > 400) {
			var dy = origBox.screenY - d.getBoxObjectFor(baseContainer).screenY;
			var c = 0;
			while (
				c++ < 100 &&
				d.getBoxObjectFor(baseAnchor).screenY - lastLineY >= lineHeight &&
				d.getBoxObjectFor(baseAnchor).screenY + dy - lastLineY >= lineHeight
				)
			{
				style.width = (++width)+'px !important';
			}
		}


		var endOffset = 0;
		if (
			align != 'left' && align != 'start' && align != 'justify' &&
			(
				this.getNodesByXPath(hasFollowingExpression , aNode).snapshotLength ||
				(
					parentBox != p &&
					this.getNodesByXPath(hasFollowingExpression , p).snapshotLength
				)
			)
			) {
			var x = originalAnchorBox.screenX;
			endOffset = info.boxX + info.boxWidth - x;
			baseAnchor.style.paddingRight = endOffset+'px !important';
			while (baseAnchorBox.screenX < originalAnchorBox.screenX && endOffset >= 0)
			{
				baseAnchor.style.paddingRight = (endOffset -= fontSize)+'px !important';
			}
			while (baseAnchorBox.screenX > originalAnchorBox.screenX)
			{
				baseAnchor.style.paddingRight = (++endOffset)+'px !important';
			}
		}

		innerBox.setAttribute('rendering-style', renderingStyle);
		innerBox.setAttribute('x-offset',        xOffset);
		innerBox.setAttribute('y-offset',        yOffset);
		innerBox.setAttribute('end-offset',      endOffset);
		innerBox.setAttribute('context',         context);
		innerBox.setAttribute('indent',          indent);
		innerBox.setAttribute('width',           width);
		innerBox.setAttribute('box-width',       info.boxWidth);
		innerBox.setAttribute('box-height',      info.boxHeight);
	},
 
	getSizeBox : function(aNode) 
	{
		var d = aNode.ownerDocument;
		var w = d.defaultView;
		var box = aNode;
		var display;
		while (!/^table-|block|-moz-box/.test(display = w.getComputedStyle(box, null).getPropertyValue('display')) && box.parentNode)
		{
			box = box.parentNode;
		}
		if (box == d) box = d.documentElement;

		var paddingTop  = this.getComputedPixels(box, 'padding-top');
		var paddingLeft = this.getComputedPixels(box, 'padding-left');

		var boxObj     = d.getBoxObjectFor(aNode);
		var sizeBoxObj = d.getBoxObjectFor(box);

		return {
			sizeBox   : box,
			display   : display,
			indent    : this.getComputedPixels(box, 'text-indent'),
			x         : boxObj.screenX,
			y         : boxObj.screenY,
			width     : boxObj.width,
			height    : boxObj.height,
			boxX      : sizeBoxObj.screenX + paddingLeft,
			boxY      : sizeBoxObj.screenY + paddingTop,
			boxWidth  : sizeBoxObj.width
				- paddingLeft
				- this.getComputedPixels(box, 'padding-right'),
			boxHeight : sizeBoxObj.height
				- paddingTop
				- this.getComputedPixels(box, 'padding-bottom')
		};
	},
 
	getComputedPixels : function(aNode, aProperty) 
	{
		var value = aNode.ownerDocument.defaultView.getComputedStyle(aNode, null).getPropertyValue(aProperty);

		// line-height
		switch (aProperty.toLowerCase())
		{
			case 'line-height':
				if (value.toLowerCase() == 'normal')
					return this.getComputedPixels(aNode, 'font-size') * 1.2;
				break;

			case 'font-weight':
				switch (value.toLowerCase())
				{
					case 'normal':  return 400;
					case 'bold':    return 700;
					case 'bolder':
						return !aNode.parentNode ? 500 : Math.max(
							900,
							this.getComputedPixels(aNode.parentNode, 'font-weight')+100
						);
					case 'lighter':
						return !aNode.parentNode ? 300 : Math.min(
							100,
							this.getComputedPixels(aNode.parentNode, 'font-weight')-100
						);
				}
				break;
		}

		return Number(value.match(/^[-0-9\.]+/));
	},
 
	convertToPixels : function(aCSSLength, aParentWidth, aSizeNode) 
	{
		if (!aCSSLength || typeof aCSSLength == 'number')
			return aCSSLength;

		var w = window;
		var fontSize = this.getComputedPixels(aSizeNode, 'font-size');
		var unit = aCSSLength.match(/em|ex|px|\%|mm|cm|in|pt|pc/i);
		var dpi = 72; // 画面解像度は72dpiとみなす
		if (unit) {
			aCSSLength = Number(aCSSLength.match(/^[-0-9\.]+/));
			switch (String(unit).toLowerCase())
			{
				case 'px':
					return aCSSLength;

				case '%':
					return aCSSLength / 100 * aParentWidth;

				case 'em':
					return aCSSLength * fontSize;

				case 'ex':
					return aCSSLength * fontSize * 0.5;

				case 'in':
					return aCSSLength * dpi;
					break;

				case 'pt':
					return aCSSLength;
					break;
				case 'pc':
					return aCSSLength * 12;
					break;

				case 'mm':
					return aCSSLength * dpi * 0.03937;
					break;
				case 'cm':
					return aCSSLength * dpi * 0.3937;
					break;
			}
		}

		return 0;
	},
   
	clearShadowBox : function(aNode) 
	{
		var boxes = this.getNodesByXPath('descendant::*['+this.SHADOW_CONDITION+']', aNode);
		for (var i = 0, maxi = boxes.snapshotLength; i < maxi; i++)
		{
			this.clearOneShadow(boxes.snapshotItem(i));
		}
	},
	
	clearOneShadow : function(aNode) 
	{
		var d = aNode.ownerDocument;
		var nodes = aNode.childNodes;
		var f = d.createDocumentFragment();
		for (var i = 0, maxi = nodes.length; i < maxi; i++)
		{
			f.appendChild(nodes[i].cloneNode(true));
		}
		aNode.parentNode.insertBefore(f, aNode);
		aNode.parentNode.removeChild(aNode);
	},
   
/* update shadow */ 
	 
	updateShadowForFrame : function(aFrame, aReason) 
	{
		if (!this.shadowEnabled) return;

		var frames = aFrame.frames;
		for (var i = 0, maxi = frames.length; i < maxi; i++)
		{
			this.updateShadowForFrame(frames[i], aReason);
		}

		var d = aFrame.document;
		var rootNode = d.documentElement;
		var cues = this.getJSValueFromAttribute(rootNode, this.ATTR_INIT_CUE);
		if (!cues) cues = [];
		switch (aReason)
		{
			case this.UPDATE_PAGELOAD:
				if (rootNode.hasAttribute(this.ATTR_DONE)) return;
				rootNode.setAttribute(this.ATTR_DONE, true);

				var nodes = this.collectTargets(aFrame);
				if (!nodes) return;

				this.addStyleSheet(d, 'chrome://textshadow/content/textshadow.css');
				nodes.sort(function(aA, aB) {
					if (!aA || !aB) return 0;
					if (typeof aA == 'string') aA = d.getElementById(aA);
					if (typeof aB == 'string') aB = d.getElementById(aB);
					if (!aA.boxObject) aA.boxObject = d.getBoxObjectFor(aA);
					if (!aB.boxObject) aB.boxObject = d.getBoxObjectFor(aB);
					return aA.boxObject.screenY - aB.boxObject.screenY;
				});
				var self = this;
				cues = cues.concat(nodes.map(function(aItem) {
						var id = aItem.getAttribute('id');
						if (!id) {
							id = self.ID_PREFIX+parseInt(Math.random() * 1000000);
							aItem.setAttribute('id', id);
						}
						return id;
					}));
				rootNode.setAttribute(this.ATTR_INIT_CUE, cues.toSource());
				rootNode.setAttribute(this.ATTR_LAST_WIDTH, d.getBoxObjectFor(rootNode).width);
				this.startInitialize(aFrame);
				break;

			case this.UPDATE_RESIZE:
				if (rootNode.getAttribute(this.ATTR_LAST_WIDTH) == d.getBoxObjectFor(rootNode).width) return;

			case this.UPDATE_REBUILD:
				var nodes = this.getNodesByXPath('/descendant-or-self::*[@'+this.ATTR_STYLE+']', d);
				if (!nodes.snapshotLength) return;
				var nodesArray = [];
				for (var i = 0, maxi = nodes.snapshotLength; i < maxi; i++)
				{
					nodesArray.push(nodes.snapshotItem(i));
				}
				cues.sort(function(aA, aB) {
					if (!aA || !aB) return 0;
					if (typeof aA == 'string') aA = d.getElementById(aA);
					if (typeof aB == 'string') aB = d.getElementById(aB);
					if (!aA.boxObject) aA.boxObject = d.getBoxObjectFor(aA);
					if (!aB.boxObject) aB.boxObject = d.getBoxObjectFor(aB);
					return aA.boxObject.screenY - aB.boxObject.screenY;
				});
				var self = this;
				cues = cues.concat(nodesArray.map(function(aItem) {
						var id = aItem.getAttribute('id');
						if (!id) {
							id = self.ID_PREFIX+parseInt(Math.random() * 1000000);
							aItem.setAttribute('id', id);
						}
						return id;
					}));
				rootNode.setAttribute(this.ATTR_INIT_CUE, cues.toSource());
				rootNode.setAttribute(this.ATTR_LAST_WIDTH, d.getBoxObjectFor(rootNode).width);
				this.startInitialize(aFrame);
				break;
		}
	},
	 
	parseTextShadowValue : function(aValue) 
	{
		var array = [];

		aValue = String(aValue)
				.replace(/^\s+|\s+$/gi, '')
				.replace(/\s*!\s*important/i, '')
				.replace(/\(\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^\)]+)\s*\)/g, '($1/$2/$3/%4)')
				.replace(/\(\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^\)]+)\s*\)/g, '($1/$2/$3)')
				.split(',');

		for (var i = 0; i < aValue.length; i++)
		{
			var value = aValue[i];
			var shadow = {
					x      : 0,
					y      : 0,
					radius : 0,
					color  : null
				};

			if (value.length > 1 || value[0].toLowerCase() != 'none') {
				value = value.replace(/\//g, ',');
				/(\#[0-9a-f]{6}|\#[0-9a-f]{3}|(rgb|hsb)a?\([^\)]*\)|\b[a-z]+\b)/i.test(value);
				var currentColor = RegExp.$1;
				if (currentColor) {
					shadow.color = currentColor.replace(/^\s+/, '');
					value = value.replace(shadow.color, '');
				}

				value = value
						.replace(/^\s+|\s+$/g, '')
						.split(/\s+/)
						.map(function(aItem) {
							return (aItem || '').replace(/^0[a-z]*$/, '') ? aItem : 0 ;
						});
				switch (value.length)
				{
					case 1:
						shadow.x = shadow.y = value[0];
						break;
					case 2:
						shadow.x = value[0];
						shadow.y = value[1];
						break;
					case 3:
						shadow.x = value[0];
						shadow.y = value[1];
						shadow.radius = value[2];
						break;
				}
				if ((!shadow.x && !shadow.y && !shadow.radius) || shadow.color == 'transparent') {
					shadow.x = shadow.y = shadow.radius = 0;
					shadow.color = null;
				}
			}

			array.push(shadow);
		}

		return array;
	},
 
	collectTargets : function(aFrame) 
	{
		var foundNodes = [];

		// user stylesheet
		if (this.checkUserStyleSheet) {
			try {
				foundNodes = foundNodes.concat(this.collectTargetsFromCSSRules(aFrame, this.userStyleSheet.cssRules, true));
			}
			catch(e) {
				dump(e+'\n');
			}
		}

		// author stylesheets
		var styles = aFrame.document.styleSheets;
		for (var i = 0, maxi = styles.length; i < maxi; i++)
		{
			if (
				styles[i].disabled ||
				styles[i].type != 'text/css' ||
				(
					styles[i].media.mediaText &&
					!/^\s*$/.test(styles[i].media.mediaText) &&
					!/(all|screen|projection)/i.test(styles[i].media.mediaText)
				)
				)
				continue;
			foundNodes = foundNodes.concat(this.collectTargetsFromCSSRules(aFrame, styles[i].cssRules));
		}

		var foundCount = foundNodes.length;

		// "style" attribute
		var nodes = this.getNodesByXPath('/descendant::*[contains(@style, "text-shadow")]', aFrame.document);
		for (var i = 0, maxi = nodes.snapshotLength; i < maxi; i++)
		{
			var node = nodes.snapshotItem(i);
			if (!node.style.textShadow)
				continue;

			var array = this.parseTextShadowValue(node.style.textShadow);
			if (!array.length) continue;

			var important   = node.style.getPropertyPriority('text-shadow') == 'important';
			var specificity = important ? 11000 : 1000 ;

			var value = this.getJSValueFromAttribute(node, this.ATTR_STYLE) || {};
			if (value && value.normal && value.normal.specificity > specificity) continue;

			value.normal = {
				shadows     : array,
				specificity : specificity,
				important   : important,
				type        : 'normal',
				isUserStyle : false,
				nest        : this.getNodesByXPath('ancestor::*', node).snapshotLength
			};

			node.setAttribute(this.ATTR_STYLE, value.toSource());
			foundNodes[foundCount++] = node;
		}
		return foundNodes;
	},
	 
	collectTargetsFromCSSRules : function(aFrame, aCSSRules, aIsUserStyle) 
	{
		var foundNodes = [];
		var rules = aCSSRules;
		var acceptMediaRegExp = /(^\s*$|all|screen|projection)/i;
		var uri = aFrame.location.href;
		for (var i = 0, maxi = rules.length; i < maxi; i++)
		{
			switch (rules[i].type)
			{
				case rules[i].IMPORT_RULE:
					if (acceptMediaRegExp.test(rules[i].media.mediaText) &&
						acceptMediaRegExp.test(rules[i].styleSheet.media.mediaText))
						foundNodes = foundNodes.concat(this.collectTargetsFromCSSRules(aFrame, rules[i].styleSheet.cssRules, aIsUserStyle));
					break;
				case rules[i].MEDIA_RULE:
					if (acceptMediaRegExp.test(rules[i].media.mediaText))
						foundNodes = foundNodes.concat(this.collectTargetsFromCSSRules(aFrame, rules[i].cssRules, aIsUserStyle));
					break;
				case rules[i].STYLE_RULE:
					if (rules[i].style.textShadow)
						foundNodes = foundNodes.concat(this.collectTargetsFromCSSRule(aFrame, rules[i], aIsUserStyle));
					break;
				default:
					if (rules[i] != '[object CSSMozDocumentRule]') continue;

					rules[i].cssText.replace(/[\n\r]/g, '').match(/@-moz-document\s+([^\{]+)/i);
					var list = RegExp.$1.split(/\s*,\s*/);
					var match = false;
					var regexp = new RegExp();
					for (var j in list)
					{
						if (regexp.compile(
							list[j].replace(/['"]\s*\)\s*$/, '')
								.replace(/\./g, '\\.')
								.replace(/url-prefix\(\s*['"]/i, '^')
								.replace(/url\(\s*['"](.+)$/i, '^$1$')
								.replace(/domain\(\s*['"]/i, '^\\w+\:\/\/')
							).test(uri)) {
							match = true;
							break;
						}
					}
					if (!match) continue;

					foundNodes = foundNodes.concat(this.collectTargetsFromCSSRules(aFrame, rules[i].cssRules, aIsUserStyle));
					break;
			}
		}
		return foundNodes;
	},
 
	collectTargetsFromCSSRule : function(aFrame, aCSSRule, aIsUserStyle) 
	{
		var foundNodes = [];
		var foundCount = 0;
		var array      = this.parseTextShadowValue(aCSSRule.style.textShadow);
		if (!array.length) return foundNodes;

		var important   = aCSSRule.style.getPropertyPriority('text-shadow') == 'important';
		var isUserStyle = aIsUserStyle || false;

		var spec = {};
		if (
			this.getElementsBySelector(aFrame.document, aCSSRule.selectorText.replace(/^\s+|\s+$/g, ''), spec).length &&
			spec.specificities &&
			spec.specificities.length
			) {
			for (var i = 0, maxi = spec.specificities.length; i < maxi; i++)
			{
				var nodes = spec.specificities[i].targets;
				if (!nodes.length) continue;

				var specificity = spec.specificities[i].value;
				specificity = Number((important ? '1' : '' )+specificity);

				var type = /:(hover|focus|active)/i.test(spec.specificities[i].selector) ? RegExp.$1.toLowerCase() : 'normal' ;

				for (var j = 0, maxj = nodes.length; j < maxj; j++)
				{
					if (
						!nodes[j].textContent ||
						/^\s*$/.test(nodes[j].textContent)
						)
						continue;

					var value = this.getJSValueFromAttribute(nodes[j], this.ATTR_STYLE) || {};
					if (value && value[type] && value[type].specificity > specificity) continue;

					value[type] = {
						type        : type,
						shadows     : array,
						specificity : specificity,
						important   : important,
						isUserStyle : isUserStyle,
						nest        : this.getNodesByXPath('ancestor::*', nodes[j]).snapshotLength
					};

					nodes[j].setAttribute(this.ATTR_STYLE, value.toSource());

					if (spec.specificities[i].selector.indexOf(':first-letter') > -1) {
					}

					foundNodes[foundCount++] = nodes[j];
				}
			}
		}

		return foundNodes;
	},
   
	updateShadow : function(aTab, aTabBrowser, aReason) 
	{
		var w = aTab.linkedBrowser.contentWindow;
		this.updateShadowForFrame(w, aReason);
	},
 
	updateAllShadows : function(aTabBrowser, aReason) 
	{
		var tabs = aTabBrowser.mTabContainer.childNodes;
		for (var i = 0, maxi = tabs.length; i < maxi; i++)
		{
			this.updateShadow(tabs[i], aTabBrowser, aReason);
		}
	},
 
	startInitialize : function(aFrame) 
	{
		var node = aFrame.document.documentElement;
		var cues = this.getJSValueFromAttribute(node, this.ATTR_INIT_CUE);
		if (!cues || !cues.length)
			return;

		var timerId = node.getAttribute(this.ATTR_INIT_TIMER);
		if (timerId) {
			aFrame.clearTimeout(timerId);
		}
		timerId = aFrame.setTimeout(this.delayedInitialize, 0, this, aFrame);
		node.setAttribute(this.ATTR_INIT_TIMER, timerId);
	},
 
	delayedInitialize : function(aSelf, aFrame) 
	{
		var node = aFrame.document.documentElement;
		node.removeAttribute(aSelf.ATTR_INIT_TIMER);

		var cues = aSelf.getJSValueFromAttribute(node, aSelf.ATTR_INIT_CUE);
		if (!cues || !cues.length) {
			node.removeAttribute(aSelf.ATTR_INIT_CUE);
			return;
		}

		for (var i = 0, maxi = aSelf.renderingUnitSize; i < maxi && cues.length; i++)
		{
			var cue = aFrame.document.getElementById(cues.splice(0, 1));
			if (!cue) {
				i--;
				continue;
			}

//			aSelf.clearShadowBox(cue);
			aSelf.createShadowBox(cue);

			if (cue.getAttribute('id').indexOf(aSelf.ID_PREFIX) == 0)
				cue.removeAttribute('id');
		}

		node.setAttribute(aSelf.ATTR_INIT_CUE, cues.toSource());

		var timerId = aFrame.setTimeout(aSelf.delayedInitialize, 0, aSelf, aFrame);
		node.setAttribute(aSelf.ATTR_INIT_TIMER, timerId);
	},
  
/* Initializing */ 
	 
	init : function() 
	{
		if (!('gBrowser' in window)) return;

		window.removeEventListener('load', this, false);

		var appcontent = document.getElementById('appcontent');
		appcontent.addEventListener('SubBrowserAdded', this, false);
		appcontent.addEventListener('SubBrowserRemoveRequest', this, false);

		this.addPrefListener(this);
		this.observe(null, 'nsPref:changed', 'extensions.textshadow.enabled');
		this.observe(null, 'nsPref:changed', 'extensions.textshadow.renderingUnitSize');
		this.observe(null, 'nsPref:changed', 'extensions.textshadow.position.quality');
		this.observe(null, 'nsPref:changed', 'extensions.textshadow.silhouettePseudElementsAndClasses');
		this.observe(null, 'nsPref:changed', 'extensions.textshadow.autoCalculateShadowColor.userStyleSheet');

		this.initTabBrowser(gBrowser);


		if (this.userStyleSheetFile && this.userStyleSheetURL) {
			var channel = this.IOService.newChannelFromURI(this.makeURIFromSpec(this.userStyleSheetURL));
			var stream = channel.open();
			var scriptableStream = Components.classes['@mozilla.org/scriptableinputstream;1']
					.createInstance(Components.interfaces.nsIScriptableInputStream);
			scriptableStream.init(stream);
			var style = scriptableStream.read(scriptableStream.available());
			scriptableStream.close();
			stream.close();
			if (style.indexOf('text-shadow') != -1) {
				this.checkUserStyleSheet = true;
				this.userStyleSheetDoc = document.implementation.createDocument('', '', null);
				this.userStyleSheetDoc.appendChild(this.userStyleSheetDoc.createElement('foobar'));
				this.addStyleSheet(this.userStyleSheetDoc, this.userStyleSheetURL);
				this.userStyleSheet = this.userStyleSheetDoc.styleSheets[0];
			}
		}


		this.initialized = true;
	},
	 
	initTabBrowser : function(aTabBrowser) 
	{
		aTabBrowser.thumbnailUpdateCount = 0;

		var addTabMethod = 'addTab';
		var removeTabMethod = 'removeTab';
		if (aTabBrowser.__tabextensions__addTab) {
			addTabMethod = '__tabextensions__addTab';
			removeTabMethod = '__tabextensions__removeTab';
		}

		aTabBrowser.__textshadow__originalAddTab = aTabBrowser[addTabMethod];
		aTabBrowser[addTabMethod] = function() {
			var tab = this.__textshadow__originalAddTab.apply(this, arguments);
			try {
				TextShadowService.initTab(tab, this);
			}
			catch(e) {
			}
			return tab;
		};

		aTabBrowser.__textshadow__originalRemoveTab = aTabBrowser[removeTabMethod];
		aTabBrowser[removeTabMethod] = function(aTab) {
			TextShadowService.destroyTab(aTab);
			var retVal = this.__textshadow__originalRemoveTab.apply(this, arguments);
			try {
				if (aTab.parentNode)
					TextShadowService.initTab(aTab, this);
			}
			catch(e) {
			}
			return retVal;
		};

		var tabs = aTabBrowser.mTabContainer.childNodes;
		for (var i = 0, maxi = tabs.length; i < maxi; i++)
		{
			this.initTab(tabs[i], aTabBrowser);
		}

/*
		var listener = new TextShadowPrefListener(aTabBrowser);
		aTabBrowser.__textshadow__prefListener = listener;
		this.addPrefListener(listener);
		listener.observe(null, 'nsPref:changed', 'extensions.textshadow.enabled');
*/

		aTabBrowser.__textshadow__eventListener = new TextShadowBrowserEventListener(aTabBrowser);
		window.addEventListener('resize', aTabBrowser.__textshadow__eventListener, false);

		delete addTabMethod;
		delete removeTabMethod;
		delete i;
		delete maxi;
		delete tabs;
	},
 
	initTab : function(aTab, aTabBrowser) 
	{
		if (aTab.__textshadow__progressListener) return;

		aTab.__textshadow__parentTabBrowser = aTabBrowser;

		var filter = Components.classes['@mozilla.org/appshell/component/browser-status-filter;1'].createInstance(Components.interfaces.nsIWebProgress);
		var listener = new TextShadowProgressListener(aTab, aTabBrowser);
		filter.addProgressListener(listener, Components.interfaces.nsIWebProgress.NOTIFY_ALL);
		aTab.linkedBrowser.webProgress.addProgressListener(filter, Components.interfaces.nsIWebProgress.NOTIFY_ALL);
		aTab.__textshadow__progressListener = listener;
		aTab.__textshadow__progressFilter   = filter;
	},
  
	destroy : function() 
	{
		this.destroyTabBrowser(gBrowser);

		window.removeEventListener('unload', this, false);

		var appcontent = document.getElementById('appcontent');
		appcontent.removeEventListener('SubBrowserAdded', this, false);
		appcontent.removeEventListener('SubBrowserRemoveRequest', this, false);

		this.removePrefListener(this);
	},
	
	destroyTabBrowser : function(aTabBrowser) 
	{
/*
		this.removePrefListener(aTabBrowser.__textshadow__prefListener);
		delete aTabBrowser.__textshadow__prefListener.mTabBrowser;
		delete aTabBrowser.__textshadow__prefListener;
*/

		window.removeEventListener('resize', aTabBrowser.__textshadow__eventListener, false);

		var tabs = aTabBrowser.mTabContainer.childNodes;
		for (var i = 0, maxi = tabs.length; i < maxi; i++)
		{
			this.destroyTab(tabs[i]);
		}
	},
 
	destroyTab : function(aTab) 
	{
		try {
			delete aTab.__textshadow__parentTabBrowser;

			aTab.linkedBrowser.webProgress.removeProgressListener(aTab.__textshadow__progressFilter);
			aTab.__textshadow__progressFilter.removeProgressListener(aTab.__textshadow__progressListener);

			delete aTab.__textshadow__progressListener.mLabel;
			delete aTab.__textshadow__progressListener.mTab;
			delete aTab.__textshadow__progressListener.mTabBrowser;

			delete aTab.__textshadow__progressFilter;
			delete aTab.__textshadow__progressListener;
		}
		catch(e) {
			dump(e+'\n');
		}
	},
   
/* Event Handling */ 
	
	handleEvent : function(aEvent) 
	{
		switch (aEvent.type)
		{
			case 'load':
				this.init();
				break;

			case 'SubBrowserAdded':
				this.initTabBrowser(aEvent.originalTarget.browser);
				break;

			case 'SubBrowserRemoveRequest':
				this.destroyTabBrowser(aEvent.originalTarget.browser);
				break;
		}
	},
 
	observe : function(aSubject, aTopic, aData) 
	{
		switch (aTopic)
		{
			case 'nsPref:changed':
				this.onChangePref(aSubject, aTopic, aData);
				break;
		}
	},
  
/* Pref Listener */ 
	
	domains : [ 
		'extensions.textshadow'
	],
 
	onChangePref : function(aSubject, aTopic, aPrefName) 
	{
		if (aTopic != 'nsPref:changed') return;

		var value = this.getPref(aPrefName);
		switch (aPrefName)
		{
			case 'extensions.textshadow.enabled':
				this.shadowEnabled = value;
				break;

			case 'extensions.textshadow.renderingUnitSize':
				this.renderingUnitSize = Math.max(value, 1);
				break;

			case 'extensions.textshadow.position.quality':
				this.positionQuality = value;
				break;

			case 'extensions.textshadow.silhouettePseudElementsAndClasses':
				this.silhouettePseud = value;
				break;

			case 'extensions.textshadow.autoCalculateShadowColor.userStyleSheet':
				this.autoColorUser = value;
				break;

			default:
				break;
		}
	},
	updatingTabCloseButtonPrefs : false,
	updatingTabWidthPrefs : false,
  
/* Save/Load Prefs */ 
	
	get Prefs() 
	{
		if (!this._Prefs) {
			this._Prefs = Components.classes['@mozilla.org/preferences;1'].getService(Components.interfaces.nsIPrefBranch);
		}
		return this._Prefs;
	},
	_Prefs : null,
 
	getPref : function(aPrefstring) 
	{
		try {
			switch (this.Prefs.getPrefType(aPrefstring))
			{
				case this.Prefs.PREF_STRING:
					return decodeURIComponent(escape(this.Prefs.getCharPref(aPrefstring)));
					break;
				case this.Prefs.PREF_INT:
					return this.Prefs.getIntPref(aPrefstring);
					break;
				default:
					return this.Prefs.getBoolPref(aPrefstring);
					break;
			}
		}
		catch(e) {
		}

		return null;
	},
 
	setPref : function(aPrefstring, aNewValue) 
	{
		var pref = this.Prefs ;
		var type;
		try {
			type = typeof aNewValue;
		}
		catch(e) {
			type = null;
		}

		switch (type)
		{
			case 'string':
				pref.setCharPref(aPrefstring, unescape(encodeURIComponent(aNewValue)));
				break;
			case 'number':
				pref.setIntPref(aPrefstring, parseInt(aNewValue));
				break;
			default:
				pref.setBoolPref(aPrefstring, aNewValue);
				break;
		}
		return true;
	},
 
	clearPref : function(aPrefstring) 
	{
		try {
			this.Prefs.clearUserPref(aPrefstring);
		}
		catch(e) {
		}

		return;
	},
 
	addPrefListener : function(aObserver) 
	{
		var domains = ('domains' in aObserver) ? aObserver.domains : [aObserver.domain] ;
		try {
			var pbi = this.Prefs.QueryInterface(Components.interfaces.nsIPrefBranchInternal);
			for (var i = 0; i < domains.length; i++)
				pbi.addObserver(domains[i], aObserver, false);
		}
		catch(e) {
		}
	},
 
	removePrefListener : function(aObserver) 
	{
		var domains = ('domains' in aObserver) ? aObserver.domains : [aObserver.domain] ;
		try {
			var pbi = this.Prefs.QueryInterface(Components.interfaces.nsIPrefBranchInternal);
			for (var i = 0; i < domains.length; i++)
				pbi.removeObserver(domains[i], aObserver, false);
		}
		catch(e) {
		}
	}
   
}; 

window.addEventListener('load', TextShadowService, false);
window.addEventListener('unload', TextShadowService, false);
 
function TextShadowProgressListener(aTab, aTabBrowser) 
{
	this.mTab = aTab;
	this.mTabBrowser = aTabBrowser;
}
TextShadowProgressListener.prototype = {
	mTab        : null,
	mTabBrowser : null,
	onProgressChange: function(aWebProgress, aRequest, aCurSelfProgress, aMaxSelfProgress, aCurTotalProgress, aMaxTotalProgress)
	{
	},
	onStateChange : function(aWebProgress, aRequest, aStateFlags, aStatus)
	{
		const nsIWebProgressListener = Components.interfaces.nsIWebProgressListener;
		if (
			aStateFlags & nsIWebProgressListener.STATE_STOP &&
			aStateFlags & nsIWebProgressListener.STATE_IS_NETWORK
			) {
			TextShadowService.updateShadow(this.mTab, this.mTabBrowser, TextShadowService.UPDATE_PAGELOAD);
		}
	},
	onLocationChange : function(aWebProgress, aRequest, aLocation)
	{
	},
	onStatusChange : function(aWebProgress, aRequest, aStatus, aMessage)
	{
	},
	onSecurityChange : function(aWebProgress, aRequest, aState)
	{
	},
	QueryInterface : function(aIID)
	{
		if (aIID.equals(Components.interfaces.nsIWebProgressListener) ||
			aIID.equals(Components.interfaces.nsISupportsWeakReference) ||
			aIID.equals(Components.interfaces.nsISupports))
			return this;
		throw Components.results.NS_NOINTERFACE;
	}
};
 
function TextShadowBrowserEventListener(aTabBrowser) 
{
	this.mTabBrowser = aTabBrowser;
}
TextShadowBrowserEventListener.prototype = {
	mTabBrowser : null,
	handleEvent: function(aEvent)
	{
		const TSS = TextShadowService;
		switch (aEvent.type)
		{
			case 'resize':
				TSS.updateAllShadows(this.mTabBrowser, TSS.UPDATE_RESIZE);
				break;
		}
	}
};
 
function TextShadowPrefListener(aTabBrowser) 
{
	this.mTabBrowser = aTabBrowser;
}
TextShadowPrefListener.prototype = {
	mTabBrowser : null,
	domain  : 'extensions.textshadow',
 	observe : function(aSubject, aTopic, aPrefName)
	{
		if (aTopic != 'nsPref:changed') return;
		const TSS = TextShadowService;

		var value = TSS.getPref(aPrefName);
		switch (aPrefName)
		{
			case 'extensions.textshadow.enabled':
				if (TSS.initialized)
					TSS.updateAllShadows(this.mTabBrowser, TSS.UPDATE_INIT);
				break;

			default:
				break;
		}
	}
};
 
function TextShadowDynamicEventListener(aShadowBox, aTarget, aInfo) 
{
	this.shadow = aShadowBox;
	this.target = aTarget;
	this.info   = aInfo;
	switch (this.info.type)
	{
		case 'hover':
			this.target.addEventListener('mouseover', this, false);
			break;
		case 'focus':
			this.target.addEventListener('focus', this, false);
			break;
		case 'active':
			this.target.addEventListener('mousedown', this, false);
			this.target.addEventListener('keydown', this, false);
			break;
	}
	this.target.ownerDocument.defaultView.addEventListener('unload', this, false);
}
TextShadowDynamicEventListener.prototype = {
	shadow      : null,
	target      : null,
	info        : null,
	handleEvent : function(aEvent)
	{
		this.target.ownerDocument.defaultView.removeEventListener('unload', this, false);
		switch (this.info.type)
		{
			case 'hover':
				this.target.removeEventListener('mouseover', this, false);
				break;
			case 'focus':
				this.target.removeEventListener('focus', this, false);
				break;
			case 'active':
				this.target.removeEventListener('mousedown', this, false);
				this.target.removeEventListener('keydown', this, false);
				break;
		}
		if (aEvent.type != 'unload') {
			TextShadowService.drawShadows(this.shadow, this.info);
		}
		delete this.info;
		delete this.shadow;
		delete this.target;
	}
};

 
