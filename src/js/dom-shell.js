var DOMShell	=	(function(){
	"use strict";


	var creationCallbacks	=	[],

		/**
		 * IE6-7 don't appear to read native DOM methods as ordinary JavaScript functions. Meaning that any
		 * Function.prototype methods aren't accessible to something like, say, document.createElement.
		 * So we have to do things in a roundabout way (as usual).
		 */
		apply	=	Function.prototype.apply,



		/** About the worst possible hack you can think of... */
		onElementCreated	=	function(fn){

			var applyCallbacks	=	function(el){
				for(var l = creationCallbacks.length, i = 0; i < l; ++i)
					creationCallbacks[i].call(el, i);
				return el;
			};


			/**
			 * If this is the first time triggering this function, start by overriding native DOM functions (always a REALLY bad idea).
			 * Doing this allows our registered callbacks to fire every time an element is generated/inserted into the document tree.
			 * This approach is only needed for browsers that don't support Mutant Observers (a far more efficient way of reacting to
			 * a newly-created element.
			 */
			if(!onElementCreated.alreadyRun){

				var target	=	[document, Node.prototype, Element.prototype];
				for(var l = target.length, i = 0; i < l; ++i) (function(target){

					/** Document methods that return a single element. */
					var methods	=	"adoptNode cloneNode createElement createElementNS elementFromPoint getElementById importNode querySelector".split(" ");
					for(var l = methods.length, i = 0; i < l; ++i)
						(function(methodName){
							if(!(methodName in target)) return;
							var oldMethod		=	target[methodName];
							target[methodName]	=	function(){
								var el	=	apply.call(oldMethod, this, arguments);
								return el ? applyCallbacks(el) : el;
							};
						}(methods[i]));


					/** Document methods that return lists of elements (e.g., NodeList, HTMLCollection, etc). */
					methods	=	"getElementsByClassName getElementsByName getElementsByTagName getElementsByTagNameNS querySelectorAll".split(" ");
					for(l = methods.length, i = 0; i < l; ++i)
						(function(methodName){
							if(!(methodName in target)) return;
							var oldMethod		=	target[methodName];

							target[methodName]	=	function(){
								var el	=	apply.call(oldMethod, this, arguments);
								if(el && el.length) for(var l = el.length, i = 0; i < l; ++i)
									applyCallbacks(el[i]);
								return el;
							};
						}(methods[i]));



					/** Stuff that doesn't return anything but has the potential to introduce new elements. */
					methods	=	"write writeln".split(" ");
					for(l = methods.length, i = 0; i < l; ++i)
						(function(methodName){
							if(!(methodName in target)) return;
							var oldMethod		=	target[methodName];

							target[methodName]	=	function(){
								var prevNum	=	document.all.length;
								apply.call(oldMethod, this, arguments);

								for(var l = document.all.length, i = prevNum; i < l; ++i)
									applyCallbacks(document.all[i]);
							};
						}(methods[i]));

				}(target[i]));

				onElementCreated.alreadyRun	=	true;
			}

			creationCallbacks.push(fn);
		};
	


	/**
	 * SHELL LAYER 1: Prototypal Inheritance Synthesis
	 *
	 * Internet Explorer 7 and earlier don't support DOM interfaces for HTML elements (wtF?),
	 * so we'll try the JavaScript equivalent of catching lightning in a bottle.
	 */
	if(!document.createElement("div").constructor){
		var forcedPrototypes	=	true;

		/** Welcome to hell! */
		(function(){

			var	Node			=	function(){},
				Element			=	function(){},
				HTMLElement		=	function(){},

			/** Define constants for our Node "class". */
			constants	=	"ELEMENT ATTRIBUTE TEXT CDATA_SECTION ENTITY_REFERENCE ENTITY PROCESSING_INSTRUCTION COMMENT DOCUMENT DOCUMENT_TYPE DOCUMENT_FRAGMENT NOTATION".split(" "), i = 0;
			for(; i < 12; ++i)			Node[constants[i]+"_NODE"] = (i+1) >>> 0;
			constants	=	"DISCONNECTED PRECEDING FOLLOWING CONTAINS CONTAINED_BY IMPLEMENTATION_SPECIFIC".split(" ");
			for(i = 0; i < 6; ++i)		Node["DOCUMENT_POSITION_" + constants[i]] = 1 << i;


			Element.prototype					=	new Node();
			Element.prototype.constructor		=	Element;
			Element.prototype.getAttribute		=	function(name)			{return this[name];		};
			Element.prototype.setAttribute		=	function(name, value)	{this[name] = value;	};

			HTMLElement.prototype				=	new Element();
			HTMLElement.prototype.constructor	=	HTMLElement;
			window.Node				=	Node;
			window.Element			=	Element;
			window.HTMLElement		=	HTMLElement;


			var patch	=	function(){
				if(Node.ELEMENT_NODE !== this.nodeType) return;


				var	kPatched		=	"DOMShellPatched",
					kPropValues		=	"DOMShellPropertyValues";


				/** Make sure we don't operate on an already patched element. */
				if(this[kPatched]) return;
				this[kPatched]	=	true;


				/** Assign a dummy constructor. */
				this.constructor	=	HTMLElement;
				this.prototype		=	new HTMLElement();


				/**
				 * As onPropertyChange doesn't provide any means of accessing the previous value when an element's
				 * attribute's been modified, we'll have to monitor each attribute's value manually... good grief.
				 */
				var values	=	{},
					attr	=	this.attributes,
					l		=	attr.length,
					i		=	0;
				for(; i < l; ++i) values[attr[i].name] = attr[i].value;
				this[kPropValues]	=	values;


				/** Start overriding a few Node/Element-specific instanced methods. */
				var methods	=	"cloneNode querySelector".split(" ");
				for(l = methods.length, i = 0; i < l; ++i)
					(function(target, methodName){
						if(!(methodName in target)) return;
						var oldMethod		=	target[methodName];
						target[methodName]	=	function(){
							var el = apply.call(oldMethod, this, arguments);
							return el ? patch(el) : el;
						};
					}(this, methods[i]));


				methods	=	"querySelectorAll getElementsByTagName getElementsByTagNameNS".split(" ");
				for(l = methods.length, i = 0; i < l; ++i){
					(function(target, methodName){
						if(!(methodName in target)) return;
						var oldMethod		=	target[methodName];
						target[methodName]	=	function(){
							var el	=	apply.call(oldMethod, this, arguments);
							if(el && el.length) for(var l = el.length, i = 0; i < l; ++i)
								patch(el[i]);
							return el;
						};
					}(this, methods[i]));
				}


				/** Manually handle everybody's favourite string-to-HTML transformation gizmo. */
				var _insertAdjacentHTML	=	this.insertAdjacentHTML;
				if(_insertAdjacentHTML)
					this.insertAdjacentHTML	=	function(position, text){
						_insertAdjacentHTML.call(this, position, text);

						/** Run through EVERYTHING all over again and ensure every element is monkey-patched. */
						for(var l = document.all.length, i = 0; i < l; ++i) patch(document.all[i]);
					};


				this.attachEvent("onpropertychange", function(e){
					var element		=	e.srcElement,
						name		=	e.propertyName,
						cb			=	callbacks[name];

					/** Normalise className / class (the former set by dot notation, the latter by setAttribute). */
					if("class" === name)
						name	=	"className";

					if(cb) for(var l = cb.length, i = 0; i < l; ++i)
						cb[i].call(element, element[kPropValues][name]);

					element[kPropValues][name]	=	element[name];
				});
			};



			for(var l = document.all.length, i = 0; i < l; ++i)
				patch.call(document.all[i]);

			onElementCreated(patch);
		}());
	}



	/**
	 * SHELL LAYER 2: Attribute overriding.
	 *
	 * This is where we intercept the DOM's calls to alter attribute properties that we're listening for changes to. We'll
	 * override the native setAttribute methods to check for registered callbacks after the "supermethod" has been called.
	 */
	var	callbacks			=	{},
		_setAttribute		=	Element.prototype.setAttribute,
		_setAttributeNS		=	Element.prototype.setAttributeNS,


		setAttribute		=	function(name, value){

			/** We have one or more callbacks registered for this attribute name. */
			if(callbacks[name])
				_setWithCallbacks(this, name, value);
	
			/** Nothing registered, just set the value as plainly as possible. */
			else _setAttribute.call(this, name, value);
		},

		setAttributeNS		=	function(ns, name, value){
			if(callbacks[name])	_setWithCallbacks(this, name, value);
			else				_setAttributeNS.call(this, ns, name, value);
		},



		_setWithCallbacks	=	function(element, name, value, ns){

			/** Store the existing attribute value to pass to our callbacks. */
			var prev	=	element.getAttribute(name);


			/** Trigger the supermethod. If we were given a namespace argument, trigger the setAttributeNS method, if it was available. */
			(ns !== undefined && _setAttributeNS) ?
				_setAttributeNS.call(element, ns, name, value) :
				_setAttribute.call(element, name, value);


			/** Trigger each callback in the order they were registered. */
			for(var l = callbacks[name].length, i = 0; i < l; ++i)
				callbacks[name][i].call(element, prev);
		};




	/**
	 * SHELL LAYER 2.5: Addressing inability to redefine native DOM properties (WebKit #36423 / Chromium #13170).
	 *
	 * Thanks to a retarded WebKit/Chromium bug, we have to test if the agent properly supports redefining
	 * native DOM properties. We'll do so by running a tiny test case against an attribute developers are
	 * least likely to need or access in JS (<dl compact>).
	 */
	if(!forcedPrototypes && !(function(){
		var result;

		try{
			var prototype	=	HTMLDListElement.prototype,
				prop		=	"compact",
				dl			=	document.createElement("dl");

			Object.defineProperty(prototype, prop, {
				set:	function(input){

					/* Browser's got no issues redefining native DOM properties. Thank FUCK for that. */
					result	=	true;

					Object.defineProperty(prototype, prop, {
						set: function(input){ this.setAttribte(prop, input); }
					});
				}
			});

			dl.compact	=	true;
		} catch(e){}

		return result;
	}())){


		/**
		 * Helper function for killing off native properties from element instances.
		 *
		 * This is necessary to force WebKit/Blink to look up the prototype chain and use
		 * the setter functions assigned by Object.defineProperty(Element.prototype).
		 */
		var	killProps	=	function(el){
			var kDeletions	=	"DOMShellDeletedProperties";
			el[kDeletions]	=	el[kDeletions] || {};

			for(var i in callbacks)
				if(!el[kDeletions][i]){
					delete el[i];
					el[kDeletions] = true;
				}
		};



		/** Use a MutationObserver to automatically perform a hacky workaround to issue #13170 outlined above. */
		if("undefined" !== typeof MutationObserver){

			var mutant	=	new MutationObserver(function(records){
				var i, n, l, node;

				/** Loop through each of our MutationRecords. */
				for(i = 0; i < records.length; ++i){

					/** Now loop through the nodes that've just been added. */
					for(l = records[i].addedNodes.length, n = 0; n < l; ++n){
						node	=	records[i].addedNodes[n];

						/** Only bother with Element nodes. */
						if(Node.ELEMENT_NODE === node.nodeType)
							killProps(node);
					}
				}
			});

			mutant.observe(document.documentElement, {
				childList: true,
				subtree: true
			});
		}


		/** Oh, lovely. No MutationObserver support, then? We'll have to take a much uglier route. */
		else if("undefined" !== typeof MutationEvent){
			document.documentElement.addEventListener("DOMNodeInserted", function(e){
				killProps(e.target);
			});
		}


		/** ... and it just got even uglier. Incredible. */
		else onElementCreated(function(){ killProps(this); });
	}



	var methods	=	{
		setAttribute:	setAttribute,
		setAttributeNS:	setAttributeNS
	};

	for(var i in methods)
		(function(target, methodName, method){
			if(!method) return;
			if(Object.defineProperty)
				Object.defineProperty(target, methodName, {value: method});

			else target[methodName]	=	method;

		}(Element.prototype, i, methods[i]));








	/** SHELL LAYER 3: Sunny top-side / exposed interface. */
	return {

		/** Hooks a callback function to fire whenever an attribute of the given name has been changed on an HTMLElement somewhere. */
		listen:	function(name, fn){


			/** Make sure an array's available for this attribute's name. */
			if(!callbacks[name]){
				callbacks[name]	=	[fn];


				/** If killProps is defined, it means the browser suffers from an inability to properly override native DOM properties. */
				if(killProps) for(var l = document.all.length, i = 0; i < l; ++i)
					killProps(document.all[i]);


				var def, set = function(input){
					_setWithCallbacks(this, name, input);
				};

				if(def = Object.defineProperty)
					def(Element.prototype, name, {set: set});

				else if(def = Object.prototype.__defineSetter__)
					def(name, set);
			}

			/** Push the callback onto the stack. */
			else callbacks[name].push(fn);

			/** Because method chaining rules. */
			return this;
		}
	};
}());


var p	=	document.getElementsByTagName("p")[0];




DOMShell.listen("title", function(old){
	console.log(old);
})
.listen("class", function(oldClasses){
	console.log(oldClasses);
});

var img;

setTimeout(function(){
	img = document.createElement("img");
	document.body.appendChild(img);

	setTimeout(function(){ img.title = "Time for sleep?"; }, 1000);
}, 300);
function makeAwesome(){
	p.title		=	"HAHLP";
}


/** LAZY DEBUGGIN' JUNK: */
try{ console; }
catch(e){
	console	=	{
		log:	function(){
			var s	=	"";
			for(var i = 0; i < arguments.length; ++i)
				s	+=	arguments[i] + "\n";
			alert(s);
		}
	};
}