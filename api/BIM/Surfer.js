"use strict"
BIM.Surfer = BIM.Class(
{
	CLASS: 'Bim.Surfer',
	div: null,
	mode: null,
	canvas: null,
	server: null,
	events: null,
	controls: null,
	scene: null,
	sceneLoaded: false,
	loadedTypes: null,
//	selectedObj: 'emtpy Selection',
//	mouseRotate: 0,
//	oldZoom: 15,
//	autoLoadPath: "",


	__construct: function(div, server)
	{
		if(typeof div == 'string')
			div = jQuery('div#' + div)[0];


		if(!jQuery(div).is('div'))
		{
			console.error('BIMSURFER: Can not find div element');
			return;
		}
		if(server.CLASS != 'BIM.Server')
		{
			console.error('BIMSURFER: No server given');
			return;
		}

		this.div = div;
		this.server = server;
		this.events = new BIM.Events(this);
		this.controls = new Array();
		this.loadedTypes = new Array();
	},

	setProgress: function(perc)
	{
		if(typeof this.controls['BIM.Control.ProgressBar'] == 'undefined') return;
		for(var i = 0; i < this.controls['BIM.Control.ProgressBar'].length; i++)
		{
			this.controls['BIM.Control.ProgressBar'][i].animateProgress(perc);
		}
	},
	setProgressMessage: function(message)
	{
		if(typeof this.controls['BIM.Control.ProgressBar'] == 'undefined') return;
		for(var i = 0; i < this.controls['BIM.Control.ProgressBar'].length; i++)
		{
			this.controls['BIM.Control.ProgressBar'][i].changeMessage(message);
		}
	},
	hideProgress: function()
	{
		if(typeof this.controls['BIM.Control.ProgressBar'] == 'undefined') return;
		for(var i = 0; i < this.controls['BIM.Control.ProgressBar'].length; i++)
		{
			this.controls['BIM.Control.ProgressBar'][i].hide('fast');
		}
	},
	showProgress: function()
	{
		if(typeof this.controls['BIM.Control.ProgressBar'] == 'undefined') return;
		for(var i = 0; i < this.controls['BIM.Control.ProgressBar'].length; i++)
		{
			this.controls['BIM.Control.ProgressBar'][i].show('fast');
		}
	},

	addControl: function(control)
	{
		if(typeof this.controls[control.CLASS] == 'undefined') this.controls[control.CLASS] = new Array();

		if(this.controls[control.CLASS].indexOf(control) == -1)
			this.controls[control.CLASS].push(control);

		control.setSurfer(this);
	},
	addLight: function(light)
	{
	   	if(light.CLASS.substr(0, 10) != 'BIM.Light.') return;

		var lights = this.scene.findNode('my-lights');

		if(Object.prototype.toString.call(light.lightObject) == '[object Array]')
		{
			for(var i = 0; i < light.lightObject.length; i++)
			{
				if(lights._core.lights.indexOf(light.lightObject[i]) == -1)
					lights._core.lights.push(light.lightObject[i]);
			}
			lights.setLights(lights._core.lights);
		}
		else
		{
			if(lights._core.lights.indexOf(light.lightObject) == -1)
			{
				lights._core.lights.push(light.lightObject);
				lights.setLights(lights._core.lights);
			}
		}

		light.setSurfer(this);
	},
	drawCanvas: function()
	{
		var width = $(this.div).width();
		var height = $(this.div).height();
		if(!(width > 0 && height > 0)) return;

		if($(this.canvas).length == 1) $(this.canvas).remove();

		this.canvas = $('<canvas />')
							.attr('id', $(this.div).attr('id') + "-canvas")
							.attr('width', width)
							.attr('height', height)
							.html('<p>This application requires a browser that supports the <a href="http://www.w3.org/html/wg/html5/">HTML5</a> &lt;canvas&gt; feature.</p>')
							.addClass(this.CLASS.replace(/\./g,"-"))
							.appendTo(this.div);
		return this.canvas;
	},

	initEvents: function()
	{
		var _this = this;
		var canvas = this.scene.getCanvas();
		canvas.addEventListener('mousedown', function(e) { _this.events.trigger('mouseDown', [e]); }, true);
		canvas.addEventListener('mousemove', function(e) { _this.events.trigger('mouseMove', [e]); }, true);
		canvas.addEventListener('mouseup', function(e) { _this.events.trigger('mouseUp', [e]); }, true);
		canvas.addEventListener('touchstart', function(e) { _this.events.trigger('touchStart', [e]); }, true);
		canvas.addEventListener('touchmove', function(e) { _this.events.trigger('touchMove', [e]); }, true);
		canvas.addEventListener('touchend', function(e) { _this.events.trigger('touchEnd', [e]); }, true);
		canvas.addEventListener('mousewheel', function(e) { _this.events.trigger('mouseWheel', [e]); }, true);
		canvas.addEventListener('DOMMouseScroll', function(e) { _this.events.trigger('mouseWheel', [e]); }, true);
		this.scene.on('pick', function(hit) { _this.events.trigger('pick', [hit]); });
		this.scene.on('tick', function() { _this.events.trigger('tick', []); });

		var lastDown = { x: null, y: null, scene: this.scene };
		this.events.register('mouseDown', function(e)
		{
			this.x = e.offsetX;
			this.y = e.offsetY;
		}, lastDown);
		this.events.register('mouseUp', function(e)
		{
			if(((e.offsetX > this.x) ? (e.offsetX - this.x < 5) : (this.x - e.offsetX < 5)) &&	((e.offsetY > this.y) ? (e.offsetY - this.y < 5) : (this.y - e.offsetY < 5)))
				this.scene.pick(this.x, this.y, {rayPick: true});
		}, lastDown);

	},

	loadScene: function(scene)
	{
		if(this.scene != null)
		{
			this.scene.destroy();
			this.events.trigger('sceneUnloaded', [this.scene]);
			this.sceneLoaded = false;
			this.scene = null;
		}

		try
		{
			this.drawCanvas();
			scene.canvasId = $(this.canvas).attr('id');
			this.scene = SceneJS.createScene(scene);
			if(this.scene != null)
			{
				this.sceneInit();
				this.events.trigger('sceneLoaded', [this.scene]);
				this.sceneLoaded = true;
				return this.scene;
			}
		}
		catch (error)
		{
			console.error('loadScene: ', error.stack, this, arguments);
			console.debug('loadScene ERROR', error.stack, this, arguments);
		}
		return null;
	},

	sceneInit: function()
	{
		var optics = this.scene.findNode('main-camera').get('optics');
		optics['aspect'] = $(this.canvas).width() / $(this.canvas).height();
		this.scene.findNode('main-camera').set('optics', optics);

		var sceneDiameter = SceneJS_math_lenVec3(this.scene.data.bounds);

		var tags = new Array();
		var ifcTypes = this.scene.data.ifcTypes
		for(var i = 0; i < ifcTypes.length; i++)
		{
			tags.push(ifcTypes[i].toLowerCase());
		}

		this.scene.set('tagMask', '^(' + (tags.join('|')) + ')$');

		this.initEvents();
	},

	loadGeometry: function(project, typesToLoad)
	{
		this.showProgress();
		var roid = project.lastRevisionId
		var _this = this;
		if(typeof typesToLoad == 'undefined')
			typesToLoad = BIM.Constants.defaultTypes;

   		if (typesToLoad.length == 0)
		{
			this.mode = "done";
		   	this.setProgress(100);
			this.setProgressMessage('Downloading complete');
			this.hideProgress();
		  	return;
		}

	  	_this.setProgress(0);
		_this.setProgressMessage("Loading " + typesToLoad[0]);

		var params =
		{
				roid: roid,
				serializerOid: this.server.getSerializer('org.bimserver.geometry.json.JsonGeometrySerializerPlugin').oid,
				downloadQueue: typesToLoad,
				project: project
		}


		this.server.server.call("Bimsie1ServiceInterface", "downloadByTypes",
			{
				roids : [ roid ],
				classNames : [ typesToLoad[0] ],
				serializerOid : this.server.getSerializer('org.bimserver.serializers.binarygeometry.BinaryGeometrySerializerPlugin').oid,
				includeAllSubtypes : false,
				useObjectIDM : false,
				sync : false,
				deep: true
			},
	   		function(laid)
			{
				params.laid = laid;
				var step = function(params, state, progressLoader) { _this.setProgress(state.progress); }
				var done = function(params, state, progressLoader)
				{
				 	if(_this.mode != 'loading') return;
					_this.mode = "processing";
					_this.setProgress(90);
					progressLoader.unregister();

					var url = _this.server.server.generateRevisionDownloadUrl({
						serializerOid : params.serializerOid,
						laid : params.laid
					});

					var onSuccess = function(data) {
						_this.setProgress(100);
						_this.loadedTypes.push(params.downloadQueue[0]);
					  	_this.loadGeometry(params.project, params.downloadQueue.slice(1));

						var typeNode =
						{
							type: 'tag',
							tag: params.downloadQueue[0].toLowerCase(),
							id: params.downloadQueue[0].toLowerCase(),
							nodes: []
						};

						var dataInputStream = new DataInputStream(data);
						var start = dataInputStream.readUTF8();
						var library = _this.scene.findNode("library");
						var bounds = _this.scene.data.bounds2;
						
						if (start == "BGS") {
							var version = dataInputStream.readByte();
							if (version == 3) {
								var boundsX = {
									min: {x: dataInputStream.readFloat(), y: dataInputStream.readFloat(), z: dataInputStream.readFloat()},
									max: {x: dataInputStream.readFloat(), y: dataInputStream.readFloat(), z: dataInputStream.readFloat()}
								};
								var nrObjects = dataInputStream.readInt();
								for (var o=0; o<nrObjects; o++) {
									var geometry = {
										type: "geometry",
										primitive: "triangles"
									};
									
									var materialName = dataInputStream.readUTF8();
									var type = dataInputStream.readUTF8();

									geometry.coreId = dataInputStream.readLong();

									dataInputStream.align4();

									var objectBounds = {
										min: {x: dataInputStream.readFloat(), y: dataInputStream.readFloat(), z: dataInputStream.readFloat()},
										max: {x: dataInputStream.readFloat(), y: dataInputStream.readFloat(), z: dataInputStream.readFloat()}
									};
									geometry.nrindices = dataInputStream.readInt();
									var nrVertices = dataInputStream.readInt();
									geometry.positions = dataInputStream.readFloatArray(nrVertices);
									var nrNormals = dataInputStream.readInt();
									geometry.normals = dataInputStream.readFloatArray(nrNormals);
									
									var material = {
										type : "material",
										coreId : materialName + "Material",
										nodes : [ {
											id : geometry.coreId,
											type : "name",
											nodes : [  ]
										} ]
									};
									
									for (var i = 0; i < geometry.positions.length; i += 3) {
										geometry.positions[i] = geometry.positions[i] - bounds[0];
										geometry.positions[i + 1] = geometry.positions[i + 1] - bounds[1];
										geometry.positions[i + 2] = geometry.positions[i + 2] - bounds[2];
									}
									geometry.indices = [];
									for (var i = 0; i < geometry.nrindices; i++) {
										geometry.indices.push(i);
									}
									library.add("node", geometry);
									material.nodes[0].nodes.push({
										type: "geometry",
										coreId: geometry.coreId
									});
									
									var flags = {
										type : "flags",
										flags : {
											transparent : true
										},
										nodes : [ material ]
									};
									typeNode.nodes.push(flags);
								}
							}
						}
						_this.scene.findNode("my-lights").add("node", typeNode);
					}

					var oReq = new XMLHttpRequest();
					oReq.open("GET", url, true);
					oReq.responseType = "arraybuffer";

					oReq.onload = function (oEvent) {
					  var arrayBuffer = oReq.response;
					  if (arrayBuffer) {
						  onSuccess(arrayBuffer);
					  }
					};

					oReq.send(null);
				}
				_this.mode = 'loading';
				var progressLoader = new BIM.ProgressLoader(_this.server.server, laid, step, done, params, false);
			});
	}

});