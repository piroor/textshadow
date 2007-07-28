var TextShadowService = { 
	ID       : 'textshadow@piro.sakura.ne.jp',
	PREFROOT : 'extensions.textshadow@piro.sakura.ne.jp',

	shadowEnabled : false,
	positionQuality : 1,

	UPDATE_INIT     : 0,
	UPDATE_PAGELOAD : 1,
	UPDATE_RESIZE   : 2,
	 
/* Utilities */ 
	 
	get browser() 
	{
		return 'SplitBrowser' in window ? SplitBrowser.activeBrowser : gBrowser ;
	},
 
	ObserverService : Components.classes['@mozilla.org/observer-service;1'].getService(Components.interfaces.nsIObserverService), 
 
	getNodesByXPath : function(aExpression, aContext) 
	{
		var d = aContext.ownerDocument || aContext;
		try {
			nodes = d.evaluate(aExpression, aContext, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
		}
		catch(e) {
			nodes = document.evaluate(aExpression, aContext, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
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
			sizeBox  : box,
			indent   : this.getComputedPixels(box, 'text-indent'),
			width : d.getBoxObjectFor(aNode).width
						- this.getComputedPixels(aNode, 'padding-left')
						- this.getComputedPixels(aNode, 'padding-right'),
			height : d.getBoxObjectFor(aNode).height
						- this.getComputedPixels(aNode, 'padding-top')
						- this.getComputedPixels(aNode, 'padding-bottom'),
			boxWidth : d.getBoxObjectFor(box).width
					- this.getComputedPixels(box, 'padding-left')
					- this.getComputedPixels(box, 'padding-right')
					- this.getComputedPixels(aNode, 'padding-left')
					- this.getComputedPixels(aNode, 'padding-right')
					- this.getComputedPixels(aNode, 'margin-left')
					- this.getComputedPixels(aNode, 'margin-right'),
			boxHeight : d.getBoxObjectFor(box).height
				- this.getComputedPixels(box, 'padding-top')
				- this.getComputedPixels(box, 'padding-bottom')
		};
	},
 
	getElementsBySelector : function(aSelector, aTargetDocument) 
	{
		var tokens = aSelector
					.replace(/(^|\b)\w+\||\*\|/g, '')
					.replace(/\s+/g, ' ')
					.replace(/\s*([>+])\s*/g, '$1');
		if (/:[^:]+$/.test(aSelector)) return [];
//dump(tokens+'\n');

		tokens = tokens.split('');
		var foundElements = [aTargetDocument];

		var buf = {
			'element'     : '',
			'attributes'  : [],
			'attribute'   : '',
			'id'          : '',
			'class'       : '',
			'psedo'       : '',
			'combinators' : ' ',
			'clear'       : function () {
				this.element     = '';
				this.attributes  = [];
				this.attribute   = '';
				this.id          = '';
				this.class       = '';
				this.psedo       = '';
				this.combinators = '';
			}
		};

		var mode = 'element';

		var getTargetElements = function (tagName, targetElements) {
			var elements = [];
			var elmCount = 0;
			for ( var i = 0, len = targetElements.length; i < len; i++ ) {
				var target = targetElements[i];
				switch ( buf.combinators ) {
					case ' ':
						var found = target.getElementsByTagName(tagName);
						for ( var j = 0, found_len = found.length; j < found_len; j++ ) {
							elements[elmCount++] = found[j];
						}
						break;
					case '>':
						var childNodes = target.childNodes;
						for ( var j = 0, node_len = childNodes.length; j < node_len; j++ ) {
							var childNode = childNodes[j];
							var nodeType = childNode.nodeType;
							if ( nodeType == 1 ) {
								if ( tagName != '*'
								  && childNode.tagName.toLowerCase() != tagName.toLowerCase() ) {
									continue;
								}
								elements[elmCount++] = childNode;
							}
						}
						break;
					case '+':
						var nextNode = target.nextSibling;
						while ( 1 ) {
							if ( nextNode != null ) {
								if ( nextNode.nodeType == 1 ) {
									if ( tagName != '*'
									  && tagName.toLowerCase() != nextNode.tagName.toLowerCase() ) {
										break;
									}
									elements[elmCount++] = nextNode;
									break;
								}
								else {
									nextNode = nextNode.nextSibling;
									continue;
								}
							}
							else {
								break;
							}
						}
						break;
				}
			}
		return elements;
		};

		var search = function () {
			var found = [];
			var tagName = buf.element.toLowerCase();
			if ( tagName.length == 0 ) {
				tagName = '*';
			}
			// Element
			found = getTargetElements( tagName, foundElements );
			// ID
			if ( buf.id.length != 0 ) {
				var targets = found;
				var id = buf.id;

				for ( var i = 0, len = targets.length; i < len; i++ ) {
					var target = targets[i];
					var targetId = target.getAttribute('id');
					if ( targetId && targetId == id ) {
						found = [target];
						break;
					}
				}
			}
			// Class
			if ( buf.class.length != 0 ) {
				var classes = buf.class.split('.');
				var targets = found;

				var getElementsByClassName = function ( classRegex, targetElements ) {
					var elements = [];
					var elmCount = 0
					for ( var i = 0, len = targetElements.length; i < len; i ++ ) {
						var element = targetElements[i];
						var className = element.className;
						if ( className && className.match( classRegex ) ) {
							elements[elmCount++] = element;
						}
					}
					return elements;
				}

				for ( var i = 0, class_len = classes.length; i < class_len; i++ ) {
					var classRegex = new RegExp('(^|\\s)' + classes[i] + '(\\s|$)');
					if ( i == 0 ) {
						found = getElementsByClassName( classRegex, targets );
					}
					else {
						found = getElementsByClassName( classRegex, found );
					}
				}
			}
			// Attribute
			if ( buf.attributes.length != 0 ) {
				var attributes = buf.attributes;
				var targets = found;

				var getElementsByAttribute = function ( callback, targetElements ) {
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

				for ( var i = 0, attr_len = attributes.length; i < attr_len; i++ ) {
					var attribute = attributes[i];

					attribute.match(/^(\w+)(?:([~|]?=)["](.+?)["])?$/);
					var attrName  = RegExp.$1;
					var operator  = RegExp.$2;
					var attrValue = RegExp.$3;

					var checkFunc;
					switch ( operator ) {
						case  '=': // E[attr="foo"]
							checkFunc = function (e) { return ( e.getAttribute(attrName) && e.getAttribute(attrName) == attrValue ) ? 1 : -1 };
							break;
						case '~=': // E[attr~="foo"]
							checkFunc = function (e) { return ( e.getAttribute(attrName) && e.getAttribute(attrName).match( new RegExp('\\b' + attrValue + '\\b') ) ) ? 1 : -1 };
							break;
						case '|=': // E[lang|="en"]
							checkFunc = function (e) { return ( e.getAttribute(attrName) && e.getAttribute(attrName).match( new RegExp('^' + attrValue + '-?') ) ) ? 1 : -1 };
							break;
						default  : // E[attr]
							checkFunc = function (e) { return ( e.getAttribute(attrName) ) ? 1 : -1 };
							break;
					}

					if ( i == 0 ) {
						found = getElementsByAttribute( checkFunc, targets );
					}
					else {
						found = getElementsByAttribute( checkFunc, found );
					}
				}

			}
	/*
			// Psedo-class
			if ( buf.psedo.length != 0 ) {

			}
			// Psedo-elements
	*/
			foundElements = found;
			buf.clear();
		};


		for ( var i = 0, len = tokens.length; i < len; i++  ) {
			var token = tokens[i];
			switch ( token ) {
				// selector
				case '[':
					mode = 'attribute';
					break;
				case ']':
					buf.attributes.push( buf.attribute );
					buf.attribute = '';
					mode = 'element';
					break;
				case '.':
					if ( mode == 'class' ) {
						buf[mode] += token;
					}
					mode = 'class';
					break;
				case '#':
					mode = 'id';
					break;
				/*
				case ':':
					mode = 'psedo';
					break;
				*/
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
				// elements
				case '*':
					buf.element = '*';
					break;
				// default
				default :
					buf[mode] += token;
					break;

			}
			if ( foundElements.length == 0 ) {
				return foundElements;
			}
		}
		search();

//dump(foundElements+'\n');
		return foundElements;
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
 	 
/* draw shadow */ 
	 
	drawShadow : function(aElement, aX, aY, aRadius, aColor) 
	{
//dump('drawShadow '+aElement+'\n  '+[aX, aY, aRadius, aColor]+'\n');
		if (aX === void(0)) aX = 0;
		if (aY === void(0)) aY = 0;
		if (aRadius === void(0)) aRadius = 0;

		var d = aElement.ownerDocument;
		var boxes = [];

		var shadowBoxes = this.getNodesByXPath('descendant::*[local-name() = "text-shadow-box" or local-name() = "TEXT-SHADOW-BOX"]', aElement);
		if (shadowBoxes.snapshotLength) {
			for (var i = 0, maxi = shadowBoxes.snapshotLength; i < maxi; i++)
			{
				boxes.push(shadowBoxes.snapshotItem(i));
			}
		}
		else {
			var textNodes = this.getNodesByXPath('descendant::text()[not(ancestor::*[local-name() = "text-shadow-box" or local-name() = "TEXT-SHADOW-BOX"])]', aElement);
			var wrapper = d.createElement('text-shadow-box');
			wrapper.setAttribute('style', 'position: relative;');
			var innerWrapper = d.createElement('text-shadow-original');
			innerWrapper.setAttribute('style',
				'visibility: hidden !important;'
				+ '-moz-user-select: none !important;'
				+ '-moz-user-focus: none !important;');
			for (var i = 0, maxi = textNodes.snapshotLength; i < maxi; i++)
			{
				var node = textNodes.snapshotItem(i);
				if (/^\s+$/.test(node.nodeValue)) continue;
				var newWrapper = wrapper.cloneNode(true);
				var newInnerWrapper = innerWrapper.cloneNode(true);
				newWrapper.appendChild(newInnerWrapper);
				newInnerWrapper.appendChild(node.cloneNode(true));
				node.parentNode.insertBefore(newWrapper, node);
				node.parentNode.removeChild(node);
				boxes.push(newWrapper);
			}
		}

		var dummy1 = d.createElement('text-shadow-dummy-box');
		dummy1.appendChild(d.createTextNode('!'));
		var dummy2 = dummy1.cloneNode(true);
		dummy1.setAttribute('style', 'visibility: hidden; position: absolute; top: 0; left: 0;');
		dummy2.setAttribute('style', 'visibility: hidden;');


		var shadow = d.createElement('text-shadow');
		shadow.setAttribute('_moz-text-shadow', ({ x : aX, y : aY, radius : aRadius, color : aColor }).toSource());
		shadow.setAttribute('style', 'display: none;');

		var part = d.createElement('text-shadow-part');
		var display;
		for (var i in boxes)
		{
			var info = this.getSizeBox(boxes[i]);
			var parentBox = info.sizeBox;

			var color = d.defaultView.getComputedStyle(parentBox, null).getPropertyValue('color');
			if (!aColor && color == 'transparent') continue;

			var boxObject = d.getBoxObjectFor(boxes[i].parentNode);
			var parentBoxObject = d.getBoxObjectFor(parentBox);

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

			if (radius != 1) radius *= 1.5; // to show like Safari

			var opacity = 1 / radius;
			var xOffset = 0;
			var yOffset = 0;

			if (radius != 1) opacity *= 0.4; // to show like Safari

			switch (d.defaultView.getComputedStyle(boxes[i].parentNode, null).getPropertyValue('display'))
			{
				case 'none':
					return;
				case 'inline':
					var lineHeight = this.getComputedPixels(boxes[i].parentNode, 'line-height');
					yOffset -= Math.round((lineHeight - this.getComputedPixels(boxes[i].parentNode, 'font-size')) / 2);
					if (boxObject.height > lineHeight * 1.5) { // inlineÇ≈ê‹ÇËï‘Ç≥ÇÍÇƒÇ¢ÇÈèÍçá
						var delta = boxObject.screenX - parentBoxObject.screenX + this.getComputedPixels(parentBox, 'padding-left');
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

			if (d.defaultView.getComputedStyle(parentBox, null).getPropertyValue('float') != 'none')
				yOffset += this.getComputedPixels(parentBox, 'margin-top');

			if (
				parentBox == boxes[i].parentNode ||
				!this.getNodesByXPath('preceding-sibling::* | preceding-sibling::text()', boxes[i].parentNode).snapshotLength
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
				newContent = d.createElement('text-shadow-base');
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
				+ '-moz-user-select: none !important;'
				+ '-moz-user-focus: none !important;'
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
		var originals = this.getNodesByXPath('descendant::*[local-name() = "text-shadow-original" or local-name() = "TEXT-SHADOW-ORIGINAL"]', aElement);
		for (var i = 0, maxi = originals.snapshotLength; i < maxi; i++)
		{
			var node = originals.snapshotItem(i);
		}
	},
  
	startDrawShadow : function(aFrame) 
	{
		if (
			!aFrame.wrappedJSObject.__textshadow__drawCues ||
			!aFrame.wrappedJSObject.__textshadow__drawCues.length
			)
			return;

		if (aFrame.wrappedJSObject.__textshadow__drawTimer) {
			aFrame.clearTimeout(aFrame.wrappedJSObject.__textshadow__drawTimer);
		}
		aFrame.wrappedJSObject.__textshadow__drawTimer = aFrame.setTimeout(this.drawOneShadow, 0, this, aFrame);
	},
	 
	drawOneShadow : function(aSelf, aFrame) 
	{
		var cues = aFrame.wrappedJSObject.__textshadow__drawCues;
		if (!cues.length) return;

		var cue = cues[0];
		cues = cues.splice(0, 1);

		if (aSelf.getNodesByXPath('descendant::*[local-name() = "text-shadow-box" or local-name() = "TEXT-SHADOW-BOX"]', cue).snapshotLength) {
			aSelf.clearShadow(cue);
		}

		try {
			var sandbox = Components.utils.Sandbox(aFrame.location.href);
			var info = Components.utils.evalInSandbox(cue.getAttribute('_moz-textshadow-style'), sandbox);
			for (var i = 0, maxi = info.length; i < maxi; i++)
			{
				aSelf.drawShadow(cue, info[i].x, info[i].y, info[i].radius, info[i].color);
			}
		}
		catch(e) {
		}

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
		switch (aReason)
		{
			case this.UPDATE_PAGELOAD:
				this.collectTargets(aFrame);
				aFrame.wrappedJSObject.__textshadow__drawCues.sort(function(aA, aB) {
					return aFrame.document.getBoxObjectFor(aA).screenY - aFrame.document.getBoxObjectFor(aB).screenY;
				});
				this.startDrawShadow(aFrame);
				break;

			case this.UPDATE_RESIZE:
				var nodes = this.getNodesByXPath('//descendant::*[@_moz-textshadow-style]', aFrame.document);
				if (!nodes.snapshotLength) return;
				for (var i = 0, maxi = nodes.snapshotLength; i < maxi; i++)
				{
					aFrame.wrappedJSObject.__textshadow__drawCues.push(nodes.snapshotItem(i));
				}
				aFrame.wrappedJSObject.__textshadow__drawCues.sort(function(aA, aB) {
					return aFrame.document.getBoxObjectFor(aA).screenY - aFrame.document.getBoxObjectFor(aB).screenY;
				});
				this.startDrawShadow(aFrame);
				break;
		}
	},
	 
	parseTextShadowValue : function(aValue) 
	{
		var array = [];

		aValue = String(aValue)
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

			if ((!shadow.x && !shadow.y && !shadow.radius) || shadow.color == 'transparent') continue;
			array.push(shadow);
		}

		return array;
	},
 
	collectTargets : function(aFrame) 
	{
		if (!aFrame.wrappedJSObject.__textshadow__drawCues)
			aFrame.wrappedJSObject.__textshadow__drawCues = [];

		var styles = aFrame.document.styleSheets;
		for (var i = 0, maxi = styles.length; i < maxi; i++)
		{
			if (
				styles[i].disabled ||
				styles[i].type != 'text/css' ||
				!/(screen|projection)/i.test(styles[i].media.mediaText)
				)
				continue;
			var rules = styles[i].cssRules;
			for (var j = 0, maxj = rules.length; j < maxj; j++)
			{
				switch (rules[j].type)
				{
					case rules[j].MEDIA_RULE:
						if (/(screen|projection)/i.test(rules[j].media.mediaText))
							this.collectTargetsFromCSSRules(aFrame, rules[j].cssRules);
						break;
					case rules[j].STYLE_RULE:
						if (/\btext-shadow\s*:/.test(rules[j].cssText))
							this.collectTargetsFromCSSRule(aFrame, rules[j]);
						break;
					default:
						continue;
				}
			}
		}

		var nodes = this.getNodesByXPath('//descendant::*[contains(@style, "text-shadow")]', aFrame.document);
		for (var i = 0, maxi = nodes.snapshotLength; i < maxi; i++)
		{
			var node = nodes.snapshotItem(i);
			var decs = node.getAttribute('style').match(/\btext-shadow\s*:[^;]*/gi);
			if (
				node.hasAttribute('_moz-textshadow-scanned') ||
				!decs ||
				!decs.length
				)
				continue;

			var x, y, radius, color;
			for (var j = 0, maxj = decs.length; j < maxj; j++)
			{
				var value = this.parseTextShadowValue(String(decs[j]).replace(/text-shadow\s*:\s*/i, ''));
				if (!value.length) continue;
				node.setAttribute('_moz-textshadow-style', value.toSource());
			}
			if (!node.hasAttribute('_moz-textshadow-style')) continue;

			node.setAttribute('_moz-textshadow-scanned', true);
			aFrame.wrappedJSObject.__textshadow__drawCues.push(node);
		}
	},
	 
	collectTargetsFromCSSRule : function(aFrame, aCSSRule) 
	{
		var selectors = aCSSRule.selectorText.split(',');

		var x      = 0,
			y      = 0,
			radius = 0,
			color  = null;

		var props = aCSSRule.style;
		var value;
		for (var i = 0, maxi = props.length; i < maxi; i++)
		{
			if (props[i].toLowerCase() != 'text-shadow') continue;

			value = this.parseTextShadowValue(props.getPropertyValue('text-shadow'));
		}
		if (!value.length) return;

		for (var i = 0, maxi = selectors.length; i < maxi; i++)
		{
			var nodes = this.getElementsBySelector(selectors[i].replace(/^\s+|\s+$/g, ''), aFrame.document);
			for (var j = 0, maxj = nodes.length; j < maxj; j++)
			{
				if (
					!nodes[j].textContent ||
					/^\s*$/.test(nodes[j].textContent) ||
					nodes[j].hasAttribute('_moz-textshadow-scanned')
					)
					continue;

				nodes[j].setAttribute('_moz-textshadow-scanned', true);
				nodes[j].setAttribute('_moz-textshadow-style', value.toSource());
				aFrame.wrappedJSObject.__textshadow__drawCues.push(nodes[j]);
			}
		}
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
		listener.observe(null, 'nsPref:changed', 'extensions.textshadow.position.quality');

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

			case 'extensions.textshadow.position.quality':
				this.positionQuality = value;
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
 
