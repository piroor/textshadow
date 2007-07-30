var TextShadowService = { 
	ID       : 'textshadow@piro.sakura.ne.jp',
	PREFROOT : 'extensions.textshadow@piro.sakura.ne.jp',

	shadowEnabled     : false,
	positionQuality   : 1,
	renderingUnitSize : 1,
	silhouettePseudElementsAndClasses : true,

	UPDATE_INIT     : 0,
	UPDATE_PAGELOAD : 1,
	UPDATE_RESIZE   : 2,
	UPDATE_REBUILD  : 3,

	ID_PREFIX       : '_moz-textshadow-target-',

	TAG_BOX         : '_moz-textshadow-box',
	TAG_ORIGINAL    : '_moz-textshadow-original',
	TAG_BASE        : '_moz-textshadow-base',
	TAG_SHADOW      : '_moz-textshadow-shadow',
	TAG_SHADOW_PART : '_moz-textshadow-shadow-part',
	TAG_DUMMY       : '_moz-textshadow-dummy-box',

	ATTR_DRAW_CUE   : '_moz-textshadow-cue',
	ATTR_DRAW_TIMER : '_moz-textshadow-draw-timer',
	ATTR_STYLE      : '_moz-textshadow-style',
	ATTR_SCANNED    : '_moz-textshadow-scanned',
	ATTR_CACHE      : '_moz-textshadow',
	 
/* Utilities */ 
	 
	get browser() 
	{
		return 'SplitBrowser' in window ? SplitBrowser.activeBrowser : gBrowser ;
	},
 
	ObserverService : Components.classes['@mozilla.org/observer-service;1'].getService(Components.interfaces.nsIObserverService), 
 
	makeURIFromSpec : function(aURI) 
	{
		const IOService = Components.classes['@mozilla.org/network/io-service;1'].getService(Components.interfaces.nsIIOService);
		try {
			var newURI;
			aURI = aURI || '';
			if (aURI && String(aURI).indexOf('file:') == 0) {
				var fileHandler = IOService.getProtocolHandler('file').QueryInterface(Components.interfaces.nsIFileProtocolHandler);
				var tempLocalFile = fileHandler.getFileFromURLSpec(aURI);
				newURI = IOService.newFileURI(tempLocalFile); // we can use this instance with the nsIFileURL interface.
			}
			else {
				newURI = IOService.newURI(aURI, null, null);
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
 
	getSizeBox : function(aNode) 
	{
		var d = aNode.ownerDocument;
		var w = d.defaultView;
		var box = aNode;
		while ((display = w.getComputedStyle(box, null).getPropertyValue('display')) != 'block' && display != '-moz-box' && box.parentNode)
		{
			box = box.parentNode;
		}
		if (box == d) box = d.documentElement;
		return {
			sizeBox   : box,
			indent    : this.getComputedPixels(box, 'text-indent'),
			width     : d.getBoxObjectFor(aNode).width,
			height    : d.getBoxObjectFor(aNode).height,
			boxWidth  : d.getBoxObjectFor(box).width
					- this.getComputedPixels(box, 'padding-left')
					- this.getComputedPixels(box, 'padding-right'),
			boxHeight : d.getBoxObjectFor(box).height
				- this.getComputedPixels(box, 'padding-top')
				- this.getComputedPixels(box, 'padding-bottom')
		};
	},
 
	getElementsBySelector : function(aSelector, aTargetDocument) 
	{
//var startTime = (new Date()).getTime();
		var nodes = [];
		var count = 0;

		if (!aSelector) return nodes;

		var expression = this.convertSelectorToXPath(aSelector, aTargetDocument);
		if (!expression) return nodes;

		result = this.getNodesByXPath(expression, aTargetDocument);
		for (var i = 0, maxi = result.snapshotLength; i < maxi; i++)
		{
			nodes[count++] = result.snapshotItem(i);
		}
//var endTime = (new Date()).getTime();
//dump('getElementsBySelector '+(endTime-startTime)+'\n');
		return nodes;
	},
	
	convertSelectorToXPath : function(aSelector, aTargetDocument, aInNotPseudClass) 
	{
		var self = this;
		var foundElements = [aTargetDocument];

		var tokens = aSelector
					.replace(/\s+/g, ' ')
					.replace(/\s*([>+])\s*/g, '$1');
//dump(tokens+'\n');

		tokens = tokens.split('');

		var buf = {
			'element'     : '',
			'attributes'  : [],
			'attribute'   : '',
			'id'          : '',
			'class'       : '',
			'pseud'       : '',
			'combinators' : ' ',
			'clear'       : function () {
				this.element     = '';
				this.attributes  = [];
				this.attribute   = '';
				this.id          = '';
				this.class       = '';
				this.pseud       = '';
				this.combinators = '';
			}
		};

		var mode = 'element';

		var steps = [];
		var stepsCount = 0;

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
			var first = aTargetDocument.createElement('_moz-first-letter');
			for (var i = 0, len = targetElements.length; i < len; i++)
			{
				var firsts = self.getNodesByXPath('descendant::*[local-name() = "_moz-first-letter" or local-name() = "_MOZ-FIRST-LETTER"]', targetElements[i]);
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
			var first = d.createElement('_moz-first-line');
			var dummy = d.createElement('_moz-dummy-box');
			var dummy1 = dummy.cloneNode(true);
			var dummy2 = dummy.cloneNode(true);
			var range = d.createRange();
			for (var i = 0, len = targetElements.length; i < len; i++)
			{
				var firsts = self.getNodesByXPath('descendant::*[local-name() = "_moz-first-line" or local-name() = "_MOZ-FIRST-LINE"]', targetElements[i]);
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

		function search()
		{
			var step = [];
			var stepCount = 0;

			step[stepCount++] =
				buf.combinators == '>' ? '*' :
				buf.combinators == '+' ? 'following-sibling::*[1]' :
				buf.combinators == '~' ? 'following-sibling::*' :
				'descendant::*';

			var tagName = ((buf.element || '').replace(/^(\w+|\*)\|/, '') || '*');
			var nameCondition = '';
			if (tagName != '*') {
				nameCondition = '[local-name() = "'+tagName+'" or local-name() = "'+tagName.toUpperCase()+'"]';
				step[stepCount++] = nameCondition;
			}

			if (buf.id.length) step[stepCount++] = '[@id = "'+buf.id+'"]';
			if (buf.class.length) {
				var classes = buf.class.split('.').map(function(aItem) {
						return 'contains(concat(" ",@class," "), " '+aItem+' ")'
					});
				step[stepCount++] = '['+classes.join(' and ')+']';
			}
			if (buf.attributes.length) {
				var attributes = buf.attributes;
				for ( var i = 0, attr_len = attributes.length; i < attr_len; i++ )
				{
					var attribute = attributes[i];
					/^(\w+)\s*(?:([~\|\^\$\*]?=)\s*["]?(.+?)["]?)?$/.test(attribute);
					var attrName  = RegExp.$1;
					var operator  = RegExp.$2;
					var attrValue = RegExp.$3;
					step[stepCount++] = '['+(
						operator == '=' ? '@'+attrName+' = "'+attrValue+'"' :
						operator == '~=' ? 'contains(concat(" ",@'+attrName+'," "), " '+attrValue+' " )' :
						operator == '|=' ? 'starts-with(@'+attrName+', "'+attrValue+'") or starts-with(@'+attrName+', "'+attrValue+'-")' :
						operator == '^=' ? 'starts-with(@'+attrName+', "'+attrValue+'" )' :
						operator == '$=' ? 'substring(@'+attrName+', string-length(@'+attrName+') - string-length("'+attrValue+'") + 1) = "'+attrValue+'"' :
						operator == '*=' ? 'contains(@'+attrName+', "'+attrValue+'" )' :
							'@'+attrName
					)+']';
				}
			}

			var pseudEvaluated = true;
			if (buf.pseud.length) {
				switch (buf.pseud)
				{
					case 'first-child':
						step[stepCount++] = '[not(preceding-sibling::*)]';
						break;
					case 'last-child':
						step[stepCount++] = '[not(following-sibling::*)]';
						break;
					case 'first-of-type':
						step[stepCount++] = '[1]';
					case 'last-of-type':
						step[stepCount++] = '[last()]';
						break;
					case 'only-child':
						step[stepCount++] = '[not(preceding-sibling::*) and not(following-sibling::*)]';
						break;
					case 'only-of-type':
						step[stepCount++] = '[not(preceding-sibling::*'+nameCondition+') and not(following-sibling::*'+nameCondition+')]';
						break;
					case 'empty':
						step[stepCount++] = '[not(node())]';
						break;
					case 'link':
						step[stepCount++] = '[contains(" link LINK a A area AREA ", concat(" ", local-name(), " ")]';
						break;
					case 'enabled':
						step[stepCount++] = '[(@enabled and (@enabled = "true" or @enabled = "enabled" or @enabled != "false")) or (@disabled and (@disabled == "false" or @disabled != "disabled"))]';
						break;
					case 'disabled':
						step[stepCount++] = '[(@enabled and (@enabled = "false" or @enabled != "enabled")) or (@disabled and (@disabled == "true" or @disabled = "disabled" or @disabled != "false"))]';
						break;
					case 'checked':
						step[stepCount++] = '[(@checked and (@checked = "true" or @checked = "checked" or @checked != "false")) or (@selected and (@selected = "true" or @selected = "selected" or @selected != "false"))]';
						break;
					case 'indeterminate':
						step[stepCount++] = '[(@checked and (@checked = "false" or @checked != "checked")) or (@selected and (@selected = "false" or @selected != "selected"))]';
						break;
					case 'root':
						step[stepCount++] = '[not(ancestor::*)]';
						break;
					default:
						var condition = /^nth-(last-)?of-type/.test(buf.pseud) ? nameCondition : '' ;

						if (/not\(\s*(.+)\s*\)$/.test(buf.pseud)) {
							step[stepCount++] = '[not('+self.convertSelectorToXPath(RegExp.$1, aTargetDocument, true)+')]';
						}

						else if (/nth-(child|of-type)\(\s*([0-9]+)\s*\)/.test(buf.pseud)) {
							step[stepCount++] = '[count(preceding-sibling::*'+condition+') = '+(parseInt(RegExp.$2)-1)+']';
						}
						else if (/nth-(child|of-type)\(\s*([0-9]+)n\s*(\+([0-9]+)\s*)?\)/.test(buf.pseud)) {
							step[stepCount++] = '[(count(preceding-sibling::*'+condition+')'+(RegExp.$4 ? ' + '+RegExp.$4 : '' )+') mod '+RegExp.$2+' = 1]';
						}
						else if (/nth-(child|of-type)\(\s*odd\s*\)/.test(buf.pseud)) {
							step[stepCount++] = '[count(preceding-sibling::*'+condition+') mod 2 = 0]';
						}
						else if (/nth-(child|of-type)\(\s*even\s*\)/.test(buf.pseud)) {
							step[stepCount++] = '[count(preceding-sibling::*'+condition+') mod 2 = 1]';
						}

						else if (/nth-last-(child|of-type)\(\s*([0-9]+)\s*\)/.test(buf.pseud)) {
							step[stepCount++] = '[count(following-sibling::*'+condition+') = '+(parseInt(RegExp.$2)-1)+']';
						}
						else if (/nth-last-(child|of-type)\(\s*([0-9]+)n\s*(\+([0-9]+)\s*)?\)/.test(buf.pseud)) {
							step[stepCount++] = '[(count(following-sibling::*'+condition+')'+(RegExp.$4 ? ' + '+RegExp.$4 : '' )+') mod '+RegExp.$2+' = 1]';
						}
						else if (/nth-last-(child|of-type)\(\s*odd\s*\)/.test(buf.pseud)) {
							step[stepCount++] = '[count(following-sibling::*'+condition+') mod 2 = 0]';
						}
						else if (/nth-last-(child|of-type)\(\s*even\s*\)/.test(buf.pseud)) {
							step[stepCount++] = '[count(following-sibling::*'+condition+') mod 2 = 1]';
						}

						else if (/contains\(\s*["'](.+)["']\s*\)/.test(buf.pseud)) {
							step[stepCount++] = '[contains(descendant::text(), "'+RegExp.$1+'")]';
						}

						else {
							pseudEvaluated = false;
						}
						break;
				}
			}

			// Pseud-class
			if (!pseudEvaluated && buf.pseud.length) {
				var found = evaluate(steps.join('/')+'/'+step.join(''), foundElements);
				switch (buf.pseud)
				{
					case 'visited':
						if (self.silhouettePseudElementsAndClasses) {
							var history = Components.classes['@mozilla.org/browser/global-history;2'].getService(Components.interfaces.nsIGlobalHistory2);
							found = getElementsByCondition(function(aElement) {
								var uri = aElement.href || aElement.getAttribute('href');
								var isLink = /^(link|a|area)$/i.test(aElement.localName) && uri;
								var isVisited = false;
								if (isLink) {
									try {
										isVisited = history.isVisited(self.makeURIFromSpec(uri));
									}
									catch(e) {
										dump(uri+' / '+self.makeURIFromSpec(uri));
										dump(e+'\n');
									}
									if (isVisited) aElement.setAttribute('_moz-pseud-class-visited', true);
								}
								return isLink && isVisited ? 1 : -1 ;
							}, found);
							step[stepCount++] = '[@_moz-pseud-class-visited = "true"]';
							break;
						}

					case 'target':
						if (self.silhouettePseudElementsAndClasses) {
							found = getElementsByCondition(function(aElement) {
								(/#(.+)$/).test(aTargetDocument.defaultView.location.href);
								var isTarget = RegExp.$1 && aElement.getAttribute('id') == decodeURIComponent(RegExp.$1);
								if (isTarget) aElement.setAttribute('_moz-pseud-class-target', true);
								return isTarget ? 1 : -1 ;
							}, found);
							step[stepCount++] = '[@_moz-pseud-class-target = "true"]';
							break;
						}

					case 'first-letter':
						if (self.silhouettePseudElementsAndClasses) {
							found = getFirstLetters(found);
							step[stepCount++] = '/*[local-name() = "_moz-first-letter" or local-name() = "_MOZ-FIRST-LETTER"]';
							break;
						}

					case 'first-line':
						if (self.silhouettePseudElementsAndClasses) {
							found = getFirstLines(found);
							step[stepCount++] = '/*[local-name() = "_moz-first-line" or local-name() = "_MOZ-FIRST-LINE"]';
							break;
						}

					default:
						steps      = [];
						stepsCount = 0;
						step       = [];
						stepCount  = 0;
						found      = [];
						break;
				}
				foundElements = found;
			}

			if (stepCount) steps[stepsCount++] = step.join('');
			buf.clear();
		};


		var escaped = false;
		var parenLevel = 0;
		for ( var i = 0, len = tokens.length; i < len; i++  )
		{
			var token = tokens[i];
			if (escaped) {
				buf[mode] += token;
				escaped = false;
				continue;
			}
			else if (parenLevel && token != ')') {
				if (token == '(')  parenLevel++;
				buf[mode] += token;
				continue;
			}
			switch (token)
			{
				case '\\':
					escaped = true;
					break;

				// selector
				case '[':
					mode = 'attribute';
					break;
				case ']':
					buf.attributes.push(buf.attribute);
					buf.attribute = '';
					mode = 'element';
					break;
				case '.':
					if (mode == 'class') {
						buf[mode] += token;
					}
					mode = 'class';
					break;
				case '#':
					mode = 'id';
					break;

				case ':':
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
					if (parenLevel) {
						parenLevel--;
						if (!parenLevel) mode = 'element';
					}
					break;

				// combinators
				case ' ':
					search();
					buf.combinators = ' ';
					mode = 'element';
					break;
				case '>':
					search();
					buf.combinators = '>';
					mode = 'element';
					break;
				case '+':
					search();
					buf.combinators = '+';
					mode = 'element';
					break;
				case '~':
					if (mode == 'attribute' || parenLevel) {
						buf[mode] += token;
					}
					else {
						search();
						buf.combinators = '~';
						mode = 'element';
					}
					break;

				// elements
				case '*':
					if (mode == 'attribute' || parenLevel) {
						buf[mode] += token;
					}
					else {
						buf.element = '*';
					}
					break;

				// default
				default :
					buf[mode] += token;
					break;

			}
			if (!foundElements.length) {
				return '';
			}
		}
		search();
		if (stepsCount) {
			if (aInNotPseudClass) {
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
		}

		return steps.length  ? (aInNotPseudClass ? '' : '/' ) + steps.join('/') : '' ;
	},
  
	convertToPixels : function(aCSSLength, aTargetNode, aParentWidth) 
	{
		if (!aCSSLength || typeof aCSSLength == 'number')
			return aCSSLength;

		var w = aTargetNode.ownerDocument.defaultView;
		var fontSize = this.getComputedPixels(aTargetNode, 'font-size');
		var unit = aCSSLength.match(/em|ex|px|\%|mm|cm|in|pt|pc/i);
		if (unit) {
			aCSSLength = Number(aCSSLength.match(/^[-0-9\.]+/));
			switch (String(unit).toLowerCase())
			{
				case 'px':
					return aCSSLength;

				case '%':
					return aCSSLength / 100 * aParentWidth;

				case 'em':
					return aCSSLength * fontSize * 0.7;

				case 'ex':
					return aCSSLength * fontSize * 0.5;

				case 'mm':
				case 'cm':
				case 'in':
				case 'pt':
				case 'pc':
					break;
			}
		}

		return 0;
	},
 	
	getComputedPixels : function(aNode, aProperty) 
	{
		var value = aNode.ownerDocument.defaultView.getComputedStyle(aNode, null).getPropertyValue(aProperty);

		// line-height
		if (value.toLowerCase() == 'normal') return this.getComputedPixels(aNode, 'font-size') * 1.2;

		return Number(value.match(/^[-0-9\.]+/));
	},
 
	getJSValueFromAttribute : function(aElement, aAttribute) 
	{
		try {
			var sandbox = Components.utils.Sandbox(aElement.ownerDocument.defaultView.location.href);
			var value = Components.utils.evalInSandbox(aElement.getAttribute(aAttribute), sandbox);
		}
		catch(e) {
		}
		return value;
	},
  
/* draw shadow */ 
	 
	drawShadow : function(aElement, aX, aY, aRadius, aColor) 
	{
//dump('drawShadow '+aElement+'\n  '+[aX, aY, aRadius, aColor]+'\n');
		if (aX === void(0)) aX = 0;
		if (aY === void(0)) aY = 0;
		if (aRadius === void(0)) aRadius = 0;

		if ((!aX && !aY && !aRadius) || (aColor || '').toLowerCase() == 'transparent') {
			this.clearShadow(aElement);
			return;
		}

		var d = aElement.ownerDocument;
		var boxes = [];

		var shadowBoxes = this.getNodesByXPath('descendant::*['+this.TAG_BOX_CONDITION+']', aElement);
		if (shadowBoxes.snapshotLength) {
			for (var i = 0, maxi = shadowBoxes.snapshotLength; i < maxi; i++)
			{
				boxes.push(shadowBoxes.snapshotItem(i));
			}
		}
		else {
			var textNodes = this.getNodesByXPath('descendant::text()[not(ancestor::*['+this.TAG_BOX_CONDITION+' or contains(" script noscript style head object iframe frame frames noframes ", concat(" ",local-name()," ")) or contains(" SCRIPT NOSCRIPT STYLE HEAD OBJECT IFRAME FRAME FRAMES NOFRAMES ", concat(" ",local-name()," "))])]', aElement);
			var wrapper = d.createElement(this.TAG_BOX);
			wrapper.setAttribute('style', 'position: relative;');
			var original = d.createElement(this.TAG_ORIGINAL);
			original.setAttribute('style',
				'visibility: hidden !important;'
				+ '-moz-user-select: -moz-none !important;'
				+ '-moz-user-focus: ignore !important;');
			for (var i = 0, maxi = textNodes.snapshotLength; i < maxi; i++)
			{
				var node = textNodes.snapshotItem(i);
				if (/^\s+$/.test(node.nodeValue)) continue;

				var preWhiteSpaces = node.nodeValue.match(/^\s+/);
				if (preWhiteSpaces) {
					node.nodeValue = node.nodeValue.replace(/^\s*/, '');
					node.parentNode.insertBefore(d.createTextNode(preWhiteSpaces), node);
				}

				var newWrapper = wrapper.cloneNode(true);
				var newOriginal = original.cloneNode(true);
				newWrapper.appendChild(newOriginal);
				newOriginal.appendChild(node.cloneNode(true));
				node.parentNode.insertBefore(newWrapper, node);
				node.parentNode.removeChild(node);
				boxes.push(newWrapper);
			}
		}

		var dummy1 = d.createElement(this.TAG_DUMMY);
		dummy1.appendChild(d.createTextNode('!'));
		var dummy2 = dummy1.cloneNode(true);
		dummy1.setAttribute('style', 'visibility: hidden; position: absolute; top: 0; left: 0;');
		dummy2.setAttribute('style', 'visibility: hidden;');


		var shadow = d.createElement(this.TAG_SHADOW);
		shadow.setAttribute(this.ATTR_CACHE, ({ x : aX, y : aY, radius : aRadius, color : aColor }).toSource());
		shadow.setAttribute('style', 'display: none;');

		var part = d.createElement(this.TAG_SHADOW_PART);
		for (var i in boxes)
		{
			var info = this.getSizeBox(boxes[i]);
			var parentBox = info.sizeBox;

			var color = d.defaultView.getComputedStyle(parentBox, null).getPropertyValue('color');
			if (!aColor && color == 'transparent') continue;

			var x = this.convertToPixels(aX, boxes[i], info.boxWidth);
			var y = this.convertToPixels(aY, boxes[i], info.boxHeight);
			var radius = this.convertToPixels(aRadius, boxes[i], info.boxWidth);

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
			var xOffset = 0;
			var yOffset = 0;

			if (radius != 1) opacity *= 0.35; // to show like Safari

			var context = d.defaultView.getComputedStyle(boxes[i].parentNode, null).getPropertyValue('display');
			var originalBoxObject = d.getBoxObjectFor(context == 'inline' ? boxes[i].parentNode : boxes[i]);
			if (
				context != 'inline' &&
				this.getNodesByXPath('preceding-sibling::* | preceding-sibling::text()', boxes[i]).snapshotLength
				)
				context = 'inline';

			switch (context)
			{
				case 'none':
					return;
				case 'inline':
					var lineHeight = this.getComputedPixels(boxes[i].parentNode, 'line-height');
					yOffset -= Math.round((lineHeight - this.getComputedPixels(boxes[i].parentNode, 'font-size')) / 2);
					var parentBoxObject = d.getBoxObjectFor(parentBox);
					if (originalBoxObject.height > lineHeight * 1.5) { // inlineÇ≈ê‹ÇËï‘Ç≥ÇÍÇƒÇ¢ÇÈèÍçá
						var delta = originalBoxObject.screenX - parentBoxObject.screenX - this.getComputedPixels(parentBox, 'padding-left');
						xOffset -= delta;
						info.indent += delta;
						info.width = info.boxWidth;
					}
					break;
				default:
					if (this.positionQuality < 1) break;
					var f = d.createDocumentFragment();
					f.appendChild(dummy1);
					f.appendChild(dummy2);
					boxes[i].appendChild(f);
					yOffset += (d.getBoxObjectFor(dummy2).height - d.getBoxObjectFor(dummy1).height) / 2;
					boxes[i].removeChild(dummy1);
					boxes[i].removeChild(dummy2);
					break;
			}

			if (
				parentBox == boxes[i].parentNode &&
				!this.getNodesByXPath('preceding-sibling::* | preceding-sibling::text()', boxes[i]).snapshotLength
				)
				xOffset -= info.indent;

			var newShadows = shadow.cloneNode(true);
			for (var j = 0, maxj = radius; j < maxj; j++)
			{
				for (var k = 0, maxk = radius; k < maxk; k++)
				{
					var newShadow = part.cloneNode(true);
					newShadow.appendChild(boxes[i].firstChild.firstChild.cloneNode(true));
					newShadow.setAttribute('style',
						'position: absolute !important; display: block !important;'
						+ 'margin: 0 !important; padding: 0 !important; text-indent: inherit !important;'
						+ 'opacity: ' + opacity + ' !important;'
						+ 'top: ' + (j+gap) + 'px !important;'
						+ 'bottom: ' + (-j-gap) + 'px !important;'
						+ 'left: ' + (k+gap) + 'px !important;'
						+ 'right: ' + (-k-gap) + 'px !important;'
					);
					newShadows.appendChild(newShadow);
				}
			}

			var style = 'position: absolute !important; display: block !important;'
				+ 'margin: 0 !important; padding: 0 !important;'
				+ 'text-indent: '+info.indent+'px !important;'
				+ 'width: ' + Math.min(info.width, info.boxWidth) + 'px !important;';

			var newContent = null;
			if (boxes[i].childNodes.length < 2) {
				newContent = d.createElement(this.TAG_BASE);
				newContent.appendChild(boxes[i].firstChild.firstChild.cloneNode(true));
				newContent.setAttribute('style', style
					+ 'z-index: 2 !important;'
					+ 'top: ' + yOffset + 'px !important;'
					+ 'bottom: ' + (-yOffset) + 'px !important;'
					+ 'left: ' + xOffset + 'px !important;'
					+ 'right: ' + (-xOffset) + 'px !important;');
			}

			newShadows.setAttribute('style', style
				+ 'z-index: 1 !important;'
				+ 'top: ' + (yOffset+y-(radius / 2)) + 'px !important;'
				+ 'bottom: ' + (-(yOffset+y-(radius / 2))) + 'px !important;'
				+ 'left: ' + (xOffset+x-(radius / 2)) + 'px !important;'
				+ 'right: ' + (-(xOffset+x-(radius / 2))) + 'px !important;'
				+ '-moz-user-select: -moz-none !important;'
				+ '-moz-user-focus: ignore !important;'
				+ 'text-decoration: none !important;'
				+ 'color: ' + (aColor || color) + ' !important;'
			);

			var f = d.createDocumentFragment();
			if (newContent) f.appendChild(newContent);
			f.appendChild(newShadows);
			boxes[i].appendChild(f);
		}
	},
	
	clearShadow : function(aElement) 
	{
		var d = aElement.ownerDocument;

/*
		var sel = d.defaultView.getSelection();
		var startContainer;
		var startOffset = -1;
		var endContainer;
		var endOffset = -1;
		var rebuildSelection = false;
		if (sel.rangeCount) {
			rebuildSelection = true;
			var range = sel.getRangeAt(0);
			startContainer = range.startContainer;
			startOffset    = range.startOffset;
			endContainer   = range.endContainer;
			endOffset      = range.endOffset;
			var compareRange = d.createRange();
			compareRange.selectNode(aElement);
			if (range.compareBoundaryPoints(Range.START_TO_START, compareRange) > -1) {
				startContainer = null;
			}
			if (range.compareBoundaryPoints(Range.END_TO_END, compareRange) < 1) {
				endContainer = null;
			}
			compareRange.detach();
		}
*/

		var originals = this.getNodesByXPath('descendant::*['+this.TAG_ORIGINAL_CONDITION+']', aElement);
		var parent;
		for (var i = 0, maxi = originals.snapshotLength; i < maxi; i++)
		{
			var node = originals.snapshotItem(i);
			if (!node.parentNode || !node.parentNode.parentNode) continue;
			parent = node.parentNode.parentNode;
			parent.insertBefore(node.removeChild(node.firstChild), node.parentNode);
			parent.removeChild(node.parentNode);
		}

/*
		if (!rebuildSelection || !parent) return;

		var text = parent.firstChild;
		var newSel = d.createRange();
		newSel.setStart(startContainer || text, startOffset);
		newSel.setEnd(endContainer || text, endOffset);
		sel.addRange(newSel);
*/
	},
  
	startDrawShadow : function(aFrame) 
	{
		var node = aFrame.document.documentElement;
		var cues = this.getJSValueFromAttribute(node, this.ATTR_DRAW_CUE);
		if (!cues || !cues.length)
			return;

		var timerId = node.getAttribute(this.ATTR_DRAW_TIMER);
		if (timerId) {
			aFrame.clearTimeout(timerId);
		}
		timerId = aFrame.setTimeout(this.delayedDrawShadow, 0, this, aFrame);
		node.setAttribute(this.ATTR_DRAW_TIMER, timerId);
	},
	
	delayedDrawShadow : function(aSelf, aFrame) 
	{
		var node = aFrame.document.documentElement;
		var cues = aSelf.getJSValueFromAttribute(node, aSelf.ATTR_DRAW_CUE);
		if (!cues || !cues.length) {
			node.removeAttribute(aSelf.ATTR_DRAW_TIMER);
			return;
		}

		for (var i = 0, maxi = aSelf.renderingUnitSize; i < maxi && cues.length; i++)
		{
			var cue = aFrame.document.getElementById(cues.splice(0, 1));
			if (!cue) {
				i--;
				continue;
			}

			aSelf.clearShadow(cue);

			try {
				var info = aSelf.getJSValueFromAttribute(cue, aSelf.ATTR_STYLE);
				if (info) {
					for (var j = 0, maxj = info.length; j < maxj; j++)
					{
						aSelf.drawShadow(cue, info[j].x, info[j].y, info[j].radius, info[j].color);
					}
				}
			}
			catch(e) {
			}

			if (cue.getAttribute('id').indexOf(aSelf.ID_PREFIX) == 0)
				cue.removeAttribute('id');
		}

		node.setAttribute(aSelf.ATTR_DRAW_CUE, cues.toSource());

		aSelf.startDrawShadow(aFrame);
	},
  
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
		var cues = this.getJSValueFromAttribute(rootNode, this.ATTR_DRAW_CUE);
		if (!cues) cues = [];
		switch (aReason)
		{
			case this.UPDATE_PAGELOAD:
				var nodes = this.collectTargets(aFrame);
				nodes.sort(function(aA, aB) {
					if (typeof aA == 'string') aA = d.getElementById(aA);
					if (typeof aB == 'string') aB = d.getElementById(aB);
					return (!aA || !aB) ? 0 :
							d.getBoxObjectFor(aA).screenY - d.getBoxObjectFor(aB).screenY;
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
				rootNode.setAttribute(this.ATTR_DRAW_CUE, cues.toSource());
				this.startDrawShadow(aFrame);
				break;

			case this.UPDATE_RESIZE:
			case this.UPDATE_REBUILD:
				var nodes = this.getNodesByXPath('//descendant::*[@'+this.ATTR_STYLE+']', d);
				if (!nodes.snapshotLength) return;
				var nodesArray = [];
				for (var i = 0, maxi = nodes.snapshotLength; i < maxi; i++)
				{
					nodesArray.push(nodes.snapshotItem(i));
				}
				cues.sort(function(aA, aB) {
					if (typeof aA == 'string') aA = d.getElementById(aA);
					if (typeof aB == 'string') aB = d.getElementById(aB);
					return (!aA || !aB) ? 0 :
							d.getBoxObjectFor(aA).screenY - d.getBoxObjectFor(aB).screenY;
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
				rootNode.setAttribute(this.ATTR_DRAW_CUE, cues.toSource());
				this.startDrawShadow(aFrame);
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

		var nodes = this.getNodesByXPath('//descendant::*[contains(@style, "text-shadow")]', aFrame.document);
		for (var i = 0, maxi = nodes.snapshotLength; i < maxi; i++)
		{
			var node = nodes.snapshotItem(i);
			var decs = node.getAttribute('style').match(/\btext-shadow\s*:[^;]*/gi);
			if (
				node.hasAttribute(this.ATTR_SCANNED) ||
				!decs ||
				!decs.length
				)
				continue;

			var x, y, radius, color;
			for (var j = 0, maxj = decs.length; j < maxj; j++)
			{
				var value = this.parseTextShadowValue(String(decs[j]).replace(/text-shadow\s*:\s*/i, ''));
				if (!value.length) continue;
				node.setAttribute(this.ATTR_STYLE, value.toSource());
			}
			if (!node.hasAttribute(this.ATTR_STYLE)) continue;

			node.setAttribute(this.ATTR_SCANNED, true);
			foundNodes.push(node);
		}
		return foundNodes;
	},
	 
	collectTargetsFromCSSRules : function(aFrame, aCSSRules) 
	{
		var foundNodes = [];
		var rules = aCSSRules;
		for (var i = 0, maxi = rules.length; i < maxi; i++)
		{
			switch (rules[i].type)
			{
				case rules[i].MEDIA_RULE:
					if (/(^\s*$|all|screen|projection)/i.test(rules[i].media.mediaText))
						foundNodes = foundNodes.concat(this.collectTargetsFromCSSRules(aFrame, rules[i].cssRules));
					break;
				case rules[i].STYLE_RULE:
					if (/\btext-shadow\s*:/.test(rules[i].cssText))
						foundNodes = foundNodes.concat(this.collectTargetsFromCSSRule(aFrame, rules[i]));
					break;
				default:
					continue;
			}
		}
		return foundNodes;
	},
 
	collectTargetsFromCSSRule : function(aFrame, aCSSRule) 
	{
		var foundNodes = [];
		var selectors = aCSSRule.selectorText.split(',');
		var props = aCSSRule.style;
		var value;
		for (var i = 0, maxi = props.length; i < maxi; i++)
		{
			if (props[i].toLowerCase() != 'text-shadow') continue;

			value = this.parseTextShadowValue(props.getPropertyValue('text-shadow'));
		}
		if (!value.length) return foundNodes;

		for (var i = 0, maxi = selectors.length; i < maxi; i++)
		{
			var nodes = this.getElementsBySelector(selectors[i].replace(/^\s+|\s+$/g, ''), aFrame.document);
			for (var j = 0, maxj = nodes.length; j < maxj; j++)
			{
				if (
					!nodes[j].textContent ||
					/^\s*$/.test(nodes[j].textContent) ||
					nodes[j].hasAttribute(this.ATTR_SCANNED)
					)
					continue;

				nodes[j].setAttribute(this.ATTR_SCANNED, true);
				nodes[j].setAttribute(this.ATTR_STYLE, value.toSource());
				foundNodes.push(nodes[j]);
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
  
/* override "cmd_copy" command */ 
	 
	goDoCommand : function(aCommand) 
	{
		var shouldRebuild = (aCommand == 'cmd_copy');
		var cleared = false;
		if (shouldRebuild) {
			var frame = document.commandDispatcher.focusedWindow;
			if (frame == window) frame = this.browser.contentWindow;
			var sel = frame.getSelection();
			if (sel && sel.rangeCount) {
				var range = sel.getRangeAt(0);
				var temp = frame.document.createElement('div');
				temp.appendChild(range.cloneContents());
				var expression = [
						'descendant::*['+TextShadowService.TAG_ORIGINAL_CONDITION+' or ',
							TextShadowService.TAG_BASE_CONDITION+' or ',
							TextShadowService.TAG_SHADOW_CONDITION+' or ',
							TextShadowService.TAG_SHADOW_PART_CONDITION+']'
					].join('')
				var boxes = TextShadowService.getNodesByXPath(expression, temp);
				if (boxes.snapshotLength) {
					expression = [
						'following::*['+TextShadowService.TAG_ORIGINAL_CONDITION+' or ',
							TextShadowService.TAG_BASE_CONDITION+' or ',
							TextShadowService.TAG_SHADOW_CONDITION+' or ',
							TextShadowService.TAG_SHADOW_PART_CONDITION+']'
					].join('')
					boxes = TextShadowService.getNodesByXPath(expression, range.startContainer);
					for (var i = 0, maxi = boxes.snapshotLength; i < maxi; i++)
					{
						var box = null;
						try {
							box = boxes.snapshotItem(i);
						}
						catch(e) {
						}
						if (!box) continue;
						if (!sel.containsNode(box, false)) {
							break;
						}
						cleared = true;
						TextShadowService.clearShadow(TextShadowService.getNodesByXPath('ancestor-or-self::*['+TextShadowService.TAG_BOX_CONDITION+']', box).snapshotItem(0));
						sel = frame.getSelection();
					}
				}
			}
		}
		var retVal = window.__textshadow__goDoCommand.apply(window, arguments);
		if (shouldRebuild && cleared) {
			TextShadowService.updateShadowForFrame(frame, TextShadowService.UPDATE_REBUILD);
		}
		return retVal;
	},
  
/* Initializing */ 
	 
	init : function() 
	{
		if (!('gBrowser' in window)) return;

		this.TAG_BOX_CONDITION         = 'local-name() = "'+this.TAG_BOX+'" or local-name() = "'+this.TAG_BOX.toUpperCase()+'"';
		this.TAG_ORIGINAL_CONDITION    = 'local-name() = "'+this.TAG_ORIGINAL+'" or local-name() = "'+this.TAG_ORIGINAL.toUpperCase()+'"';
		this.TAG_BASE_CONDITION        = 'local-name() = "'+this.TAG_BASE+'" or local-name() = "'+this.TAG_BASE.toUpperCase()+'"';
		this.TAG_SHADOW_CONDITION      = 'local-name() = "'+this.TAG_SHADOW+'" or local-name() = "'+this.TAG_SHADOW.toUpperCase()+'"';
		this.TAG_SHADOW_PART_CONDITION = 'local-name() = "'+this.TAG_SHADOW_PART+'" or local-name() = "'+this.TAG_SHADOW_PART.toUpperCase()+'"';

//		window.__textshadow__goDoCommand = window.goDoCommand;
//		window.goDoCommand = this.goDoCommand;

		window.removeEventListener('load', this, false);

		var appcontent = document.getElementById('appcontent');
		appcontent.addEventListener('SubBrowserAdded', this, false);
		appcontent.addEventListener('SubBrowserRemoveRequest', this, false);

		this.addPrefListener(this);
		this.observe(null, 'nsPref:changed', 'extensions.textshadow.enabled');

		this.initTabBrowser(gBrowser);

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

		var listener = new TextShadowPrefListener(aTabBrowser);
		aTabBrowser.__textshadow__prefListener = listener;
		this.addPrefListener(listener);
		listener.observe(null, 'nsPref:changed', 'extensions.textshadow.enabled');
		listener.observe(null, 'nsPref:changed', 'extensions.textshadow.renderingUnitSize');
		listener.observe(null, 'nsPref:changed', 'extensions.textshadow.position.quality');
		listener.observe(null, 'nsPref:changed', 'extensions.textshadow.silhouettePseudElementsAndClasses');

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
		this.removePrefListener(aTabBrowser.__textshadow__prefListener);
		delete aTabBrowser.__textshadow__prefListener.mTabBrowser;
		delete aTabBrowser.__textshadow__prefListener;

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
				this.silhouettePseudElementsAndClasses = value;
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
 
