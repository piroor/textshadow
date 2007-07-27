var TextShadowService = { 
	ID       : 'textshadow@piro.sakura.ne.jp',
	PREFROOT : 'extensions.textshadow@piro.sakura.ne.jp',

	__textshadow__drawCues : [],

	shadowEnabled : false,

	UPDATE_INIT     : 0,
	UPDATE_PAGELOAD : 1,
	UPDATE_RESIZE   : 2,
	 
/* Utilities */ 
	 
	get browser() 
	{
		return gBrowser;
	},
 
	ObserverService : Components.classes['@mozilla.org/observer-service;1'].getService(Components.interfaces.nsIObserverService), 
 
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
		return Number(aNode.ownerDocument.defaultView.getComputedStyle(aNode, null).getPropertyValue(aProperty).match(/^[-0-9\.]+/));
	},
  
/* draw shadow */ 
	 
	XMLNS : 'http://www.w3.org/1999/xhtml', 
 
	drawShadow : function(aElement, aX, aY, aRadius, aColor) 
	{
//dump('drawShadow '+aElement+'\n  '+[aX, aY, aRadius, aColor]+'\n');
		if (aX === void(0)) aX = 0;
		if (aY === void(0)) aY = 0;
		if (aRadius === void(0)) aRadius = 0;

		var nodes;
		var d = aElement.ownerDocument;
		var expression = 'descendant::text()[not(ancestor::*[local-name() = "text-shadow-box"])]';
		try {
			nodes = d.evaluate(expression, aElement, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
		}
		catch(e) {
			nodes = document.evaluate(expression, aElement, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
		}
		if (!nodes.snapshotLength) return;

		var bases = [];
		var wrapper = d.createElementNS(this.XMLNS, 'text-shadow-box');
		wrapper.setAttribute('style', 'position: relative;');
		var innerWrapper = d.createElementNS(this.XMLNS, 'text-shadow-base');
		for (var i = 0, maxi = nodes.snapshotLength; i < maxi; i++)
		{
			var node = nodes.snapshotItem(i);
			if (/^\s+$/.test(node.nodeValue)) continue;
			var newWrapper = wrapper.cloneNode(true);
			var newInnerWrapper = innerWrapper.cloneNode(true);
			node.parentNode.insertBefore(newWrapper, node);
			node.parentNode.removeChild(node);
			newWrapper.appendChild(newInnerWrapper);
			newInnerWrapper.appendChild(node);
			bases.push(newWrapper);
		}

		var shadow = d.createElementNS(this.XMLNS, 'text-shadow');
		var display;
		for (var i in bases)
		{
			var parentBox = bases[i];
			while ((display = d.defaultView.getComputedStyle(parentBox, null).getPropertyValue('display')) != 'block' && display != '-moz-box' && parentBox.parentNode)
			{
				parentBox = parentBox.parentNode;
			}
			if (parentBox == d) parentBox = d.documentElement;

			var boxWidth = d.getBoxObjectFor(parentBox).width
					- this.getComputedPixels(parentBox, 'padding-left')
					- this.getComputedPixels(parentBox, 'padding-right')
					- this.getComputedPixels(bases[i], 'padding-left')
					- this.getComputedPixels(bases[i], 'padding-right')
					- this.getComputedPixels(bases[i], 'margin-left')
					- this.getComputedPixels(bases[i], 'margin-right');
			var width = Math.min(
					d.getBoxObjectFor(bases[i]).width
						- this.getComputedPixels(bases[i], 'padding-left')
						- this.getComputedPixels(bases[i], 'padding-right'),
					boxWidth
				);
			var height = d.getBoxObjectFor(parentBox).height
				- this.getComputedPixels(parentBox, 'padding-top')
				- this.getComputedPixels(parentBox, 'padding-bottom');

			var color = d.defaultView.getComputedStyle(parentBox, null).getPropertyValue('color');
			if (!aColor && color == 'transparent') continue;

			var x = this.convertToPixels(aX, bases[i], boxWidth);
			var y = this.convertToPixels(aY, bases[i], height);
			var radius = this.convertToPixels(aRadius, bases[i], width);

			var quality = 0;
			var gap;
			do {
				gap = quality;
				quality++;
				radius = Math.max(Math.max(radius, 1) / quality, 1);
			}
			while (radius != 1 && (radius * radius) > 30)

			var opacity = 1 / (radius+1);
			var xOffset = x - radius;
			var yOffset = y - radius;

			switch (d.defaultView.getComputedStyle(bases[i].parentNode, null).getPropertyValue('display'))
			{
				case 'none':
					return;
				case 'inline':
					yOffset -= Math.round((this.getComputedPixels(bases[i].parentNode, 'line-height') - this.getComputedPixels(bases[i].parentNode, 'font-size')) / 2);
					break;
				default:
					yOffset += this.getComputedPixels(bases[i].parentNode, 'padding-top');
					break;
			}

			if (
				d.defaultView.getComputedStyle(parentBox, null).getPropertyValue('float') != 'none' &&
				this.getComputedPixels(parentBox, 'border-top-width') == 0
				)
				yOffset += this.getComputedPixels(parentBox, 'margin-top');

			for (var j = 0, maxj = radius; j < maxj; j++)
			{
				for (var k = 0, maxk = radius; k < maxk; k++)
				{
					var newShadow = shadow.cloneNode(true);
					newShadow.appendChild(bases[i].firstChild.firstChild.cloneNode(true));
					newShadow.setAttribute('style',
						'display: block !important; margin: 0 !important; padding: 0 !important; text-indent: 0 !important;'
						+ 'width: ' + width + 'px !important;'
						+ 'position: absolute !important;'
						+ 'z-index: 1 !important;'
						+ 'color: ' + (aColor || color) + ' !important;'
						+ 'opacity: ' + opacity + ' !important;'
						+ 'top: ' + (j+gap+yOffset) + 'px !important;'
						+ 'left: ' + (k+gap+xOffset) + 'px !important;'
					);
					bases[i].appendChild(newShadow);
				}
			}
			bases[i].firstChild.setAttribute('style', 'position: relative; z-index: 2;');
			d.defaultView.setTimeout(function(aNode) {
				aNode.setAttribute('style', 'display: block;');
//				d.defaultView.setTimeout(function(aNode) {
					aNode.setAttribute('style', 'position: relative; z-index: 2;');
//				}, 0, aNode);
			}, 0, bases[i].firstChild);
		}
	},
 
	startDrawShadow : function(aFrame) 
	{
		if (
			!aFrame.wrappedJSObject.__textshadow__drawCues ||
			!aFrame.wrappedJSObject.__textshadow__drawCues.length
			)
			return;

		if (aFrame.drawTextShadowTimer) {
			aFrame.clearTimeout(aFrame.drawTextShadowTimer);
			aFrame.drawTextShadowTimer = null;
		}
		aFrame.drawTextShadowTimer = aFrame.setTimeout(this.drawOneShadow, 0, this, aFrame);
	},
	 
	drawOneShadow : function(aSelf, aFrame) 
	{
		var cues = aFrame.wrappedJSObject.__textshadow__drawCues;
		if (!cues.length) return;

		var cue = cues[0];
		cues = cues.splice(0, 1);

// dump(cue.selector+' => '+cue.node+'\n');

		aSelf.drawShadow(cue.node, cue.info.x, cue.info.y, cue.info.radius, cue.info.color);

// dump(aFrame.location.href+' / '+cues.length+'\n');

		aSelf.startDrawShadow(aFrame);
	},
  
	collectTextShadowTargets : function(aFrame, aCSSRule) 
	{
		var selectors = aCSSRule.selectorText.split(',');

		var x      = 0,
			y      = 0,
			radius = 0,
			color  = null;

		var props = aCSSRule.style;
		for (var i = 0, maxi = props.length; i < maxi; i++)
		{
			if (props[i].toLowerCase() != 'text-shadow') continue;

			var value = props.getPropertyValue('text-shadow');
			/(\#[0-9a-f]{6}|\#[0-9a-f]{3}|(rgb|hsb)a?\([^\)]*\)|\b[a-z]+\b)/i.test(value);
			var currentColor = RegExp.$1;
			if (currentColor) {
				color = currentColor.replace(/^\s+/, '');
				value = value.replace(color, '');
			}
			value = value.replace(/^\s+|\s+$/g, '').split(/\s+/);
			switch (value.length)
			{
				case 1:
					x = y = value[0];
					break;
				case 2:
					x = value[0];
					y = value[1];
					break;
				case 3:
					x = value[0];
					y = value[1];
					radius = value[2];
					break;
			}
		}
		if ((!x && !y && !radius) || color == 'transparent') return;

		if (!aFrame.wrappedJSObject.__textshadow__drawCues)
			aFrame.wrappedJSObject.__textshadow__drawCues = [];

		for (var i = 0, maxi = selectors.length; i < maxi; i++)
		{
			var nodes = this.getElementsBySelector(selectors[i].replace(/^\s+|\s+$/g, ''), aFrame.document);
			for (var j = 0, maxj = nodes.length; j < maxj; j++)
			{
				if (
					!nodes[j].textContent ||
					/^\s*$/.test(nodes[j].textContent)
					)
					continue;

				nodes[j].wrappedJSObject.__textshadow__info = {
					x      : x,
					y      : y,
					radius : radius,
					color  : color
				};
				aFrame.wrappedJSObject.__textshadow__drawCues.push({
					selector : selectors[i],
					node     : nodes[j],
					info     : nodes[j].wrappedJSObject.__textshadow__info
				});
			}
		}
	},
 
	updateShadowForFrame : function(aFrame, aReason) 
	{
		var frames = aFrame.frames;
		for (var i = 0, maxi = frames.length; i < maxi; i++)
		{
			this.updateShadowForFrame(frames[i], aReason);
		}
		if (aReason == this.UPDATE_PAGELOAD) {
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
					if (
						rules[j].type != rules[j].STYLE_RULE ||
						!/\btext-shadow\s*:/.test(rules[j].cssText)
						)
						continue;
					this.collectTextShadowTargets(aFrame, rules[j]);
				}
				aFrame.wrappedJSObject.__textshadow__drawCues.sort(function(aA, aB) {
					return aFrame.document.getBoxObjectFor(aA.node).screenY - aFrame.document.getBoxObjectFor(aB.node).screenY;
				});
				this.startDrawShadow(aFrame);
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

		this.removePrefListener(this);
	},
	
	destroyTabBrowser : function(aTabBrowser) 
	{
		this.removePrefListener(aTabBrowser.__textshadow__prefListener);
		delete aTabBrowser.__textshadow__prefListener.mTabBrowser;
		delete aTabBrowser.__textshadow__prefListener;

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

			case 'unload':
				this.destroy();
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
 
