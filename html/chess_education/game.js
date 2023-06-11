const KEY_W = "KeyW";
const KEY_S = "KeyS";
const KEY_A = "KeyA";
const KEY_D = "KeyD";

const stage1BlackList = ["40","31","32","33","34","20","23","10","12"]
const stage1WhiteList = ["3-1","30","2-2","21","22","24","13","14","01","02"]

class Game{
	constructor(){
		if ( ! Detector.webgl ) Detector.addGetWebGLMessage();

		this.modes = Object.freeze({
			NONE:   Symbol("none"),
			PRELOAD: Symbol("preload"),
			INITIALISING:  Symbol("initialising"),
			CREATING_LEVEL: Symbol("creating_level"),
			ACTIVE: Symbol("active"),
			GAMEOVER: Symbol("gameover")
		});
		this.mode = this.modes.NONE;

		this.container;
		this.player;
		this.cameras;
		this.camera;
		this.scene;
		this.renderer;
		this.forward;
		this.turn;
		this.stage = -1;
		this.animations = {};
		this.assetsPath = 'assets/';
		this.blocked = false;

		this.remotePlayers = [];
		this.remoteColliders = [];
		this.initialisingPlayers = [];
		this.remoteData = [];

		this.messages = {
			text:[
			"Welcome to Blockland",
			"GOOD LUCK!"
			],
			index:0
		}

		this.container = document.createElement( 'div' );
		this.container.style.height = '100%';
		document.body.appendChild( this.container );

		const sfxExt = SFX.supportsAudioType('mp3') ? 'mp3' : 'ogg';

		const game = this;
		this.anims = ['Walking', 'Walking Backwards', 'Turn', 'Running', 'Pointing', 'Talking', 'Pointing Gesture'];

		const options = {
			assets:[
				`${this.assetsPath}images/nx.jpg`,
				`${this.assetsPath}images/px.jpg`,
				`${this.assetsPath}images/ny.jpg`,
				`${this.assetsPath}images/py.jpg`,
				`${this.assetsPath}images/nz.jpg`,
				`${this.assetsPath}images/pz.jpg`
			],
			oncomplete: function(){
				game.init();
			}
		}

		this.anims.forEach( function(anim){ options.assets.push(`${game.assetsPath}fbx/anims/${anim}.fbx`)});
		options.assets.push(`${game.assetsPath}fbx/town.fbx`);

		this.mode = this.modes.PRELOAD;

		this.clock = new THREE.Clock();

		const preloader = new Preloader(options);

		window.onError = function(error){
			console.error(JSON.stringify(error));
		}
	}


	initSfx(){
		this.sfx = {};
		this.sfx.context = new (window.AudioContext || window.webkitAudioContext)();
		this.sfx.gliss = new SFX({
			context: this.sfx.context,
			src:{mp3:`${this.assetsPath}sfx/gliss.mp3`, ogg:`${this.assetsPath}sfx/gliss.ogg`},
			loop: false,
			volume: 0.3
		});
	}

	calculateDistance(obj1, obj2) {
		var dx = obj1.position.x - obj2.position.x
		var dy = obj1.position.y - obj2.position.y
		var dz = obj1.position.z - obj2.position.z
		return Math.sqrt(dx * dx + dy * dy + dz * dz)
	}

	initControls(){
		this.controls=new THREE.OrbitControls( this.camera, this.renderer.domElement );
		this.controls.target = this.scene.getObjectByName("towerBoard").position
		this.controls.enableDamping = true;
		this.controls.dampingFactor = 0.25;
		this.controls.enableZoom = true;
		this.controls.enableKeys = false;
		this.controls.minDistance = 1000;
		this.controls.maxDistance = 2000;
	}

	set activeCamera(object){
		this.cameras.active = object;
	}

	init() {
		this.mode = this.modes.INITIALISING;

		this.camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 10, 200000 );

		this.scene = new THREE.Scene();
		this.scene.background = new THREE.Color( 0x00a0f0 );

		const ambient = new THREE.AmbientLight( 0xaaaaaa );
        this.scene.add( ambient );

        const light = new THREE.DirectionalLight( 0xaaaaaa );
        light.position.set( 30, 100, 40 );
        light.target.position.set( 0, 0, 0 );

        light.castShadow = true;

		const lightSize = 500;
        light.shadow.camera.near = 1;
        light.shadow.camera.far = 500;
		light.shadow.camera.left = light.shadow.camera.bottom = -lightSize;
		light.shadow.camera.right = light.shadow.camera.top = lightSize;

        light.shadow.bias = 0.0039;
        light.shadow.mapSize.width = 1024;
        light.shadow.mapSize.height = 1024;

		this.sun = light;
		this.scene.add(light);

		// model
		const loader = new THREE.FBXLoader();
		const game = this;

		this.loadEnvironment(loader);

		this.player = new PlayerLocal(this);



		this.speechBubble = new SpeechBubble(this, "", 150);
		this.speechBubble.mesh.position.set(0, 350, 0);

		this.forward = 0;
		this.turn = 0;
		window.addEventListener('keydown',ev => {
			switch (ev.code) {
				case KEY_W : if(!this.blocked) this.forward = 1;break;
				case KEY_A : if(!this.blocked) this.turn = -1;break;
				case KEY_S : if(!this.blocked) this.forward = -1;break;
				case KEY_D : if(!this.blocked) this.turn = 1;break;
			}
			this.playerControl(this.forward, this.turn);
		})
		window.addEventListener('keyup',ev => {
			switch (ev.code) {
				case KEY_W : this.forward = 0;break;
				case KEY_A : this.turn = 0;break;
				case KEY_S : this.forward = 0;break;
				case KEY_D : this.turn = 0;break;
			}
			this.playerControl(this.forward, this.turn);
		})

		window.addEventListener('keydown',ev => {
			switch (ev.code) {
				case "Enter" : alert("x" + this.player.object.position.x + "y" + this.player.object.position.y + "z" + this.player.object.position.z);break;
				case "Backspace" : {
					// this.player.object.position.set(542, -9500, -3488)
					this.activeCamera = this.cameras.tower;
					this.generateStage(stage1BlackList, stage1WhiteList);
					this.blocked = true;
					this.stage = 1;
					this.initControls();
					this.camera.position.set(636,-8784,-5531);
					break;
				}
				case "KeyQ" : {
					this.activeCamera  =this.cameras.back;
					this.blocked = false;
					this.stage = -1;
					delete this.controls
					break;
				}
			}
		})

		// this.joystick = new JoyStick({
		// 	onMove: this.playerControl,
		// 	game: this
		// });

		this.renderer = new THREE.WebGLRenderer( { antialias: true } );
		this.renderer.setPixelRatio( window.devicePixelRatio );
		this.renderer.setSize( window.innerWidth, window.innerHeight );
		this.renderer.shadowMap.enabled = true;
		this.container.appendChild( this.renderer.domElement );

		if ('ontouchstart' in window){
			window.addEventListener( 'touchdown', (event) => game.onMouseDown(event), false );
		}else{
			window.addEventListener( 'mousedown', (event) => game.onMouseDown(event), false );
		}

		window.addEventListener( 'resize', () => game.onWindowResize(), false );
	}

	createCanvas(w, h,text) {
		const canvas = document.createElement('canvas');
		canvas.classList.add('test');
		const context = canvas.getContext('2d');
		canvas.width = w;
		canvas.height = h;
		context.textAlign = 'center';
		context.fillStyle = '#ff0000';
		context.fillRect(0, 0, w, w);
		context.fillStyle = '#fff';
		context.font = `${0.05 * w}px sans-serif`;
		context.fillText(text, w * 0.5, h * 0.5);
		return canvas;
	}

	loadBoard () {
		var material=new THREE.LineBasicMaterial({color:'#000000',opacity:1, lineWidth:5});

		var group = new THREE.Object3D();
		for (var i=-5;i<=5;i++) {
			var geometry1=new THREE.Geometry();
			geometry1.vertices.push(new THREE.Vector3(75,75*i,-450));
			geometry1.vertices.push(new THREE.Vector3(75,75*i,375));
			var line1=new THREE.Line(geometry1,material);
			line1.position.set(1944,-8800, -5483)
			game.scene.add(line1);
			var geometry2=new THREE.Geometry();
			geometry2.vertices.push(new THREE.Vector3(75,-450,75*i));
			geometry2.vertices.push(new THREE.Vector3(75,375,75*i));
			var line2=new THREE.Line(geometry2,material);
			line2.position.set(1944,-8800, -5483)
			game.scene.add(line2);
		}

		var transparent = new THREE.MeshLambertMaterial({opacity: 0, transparent: true, side: THREE.DoubleSide });

		for (var i=-5;i<=5;i++) {
			for(var j = -5;j<=5;j++) {
				var sphere=new THREE.Mesh(new THREE.SphereGeometry(30,16,16),transparent);
				sphere.position.set(75,75*i,75*j);
				sphere.name = "sphere" + i + j
				sphere.traverse( function ( child ) {
					game.colliders.push(child);
				})
				group.add(sphere)
			}
		}



		group.position.set(1944,-8800, -5483)
		group.name = "sphereGroup"
		game.scene.add(group)

		var chessBoardMaterial = new THREE.MeshLambertMaterial({color:'#eca759', opacity: 0.8});
		var towerBoardBox = new THREE.BoxGeometry(925,925,20)
		var towerBoard = new THREE.Mesh(towerBoardBox, new THREE.MeshFaceMaterial(chessBoardMaterial))
		towerBoard.position.set(2033,-8800,-5517);
		towerBoard.rotation.set(0,Math.PI/2,0)
		towerBoard.name="towerBoard"
		game.scene.add(towerBoard);
	}


	generateStage (blackList, whiteList) {
		var transparent = new THREE.MeshLambertMaterial({opacity: 0, transparent: true, side: THREE.DoubleSide });
		for (var i=-5;i<=5;i++) {
			for(var j = -5;j<=5;j++) {
				game.scene.getObjectByName("sphereGroup").getObjectByName("sphere" + i + j).material = transparent
			}
		}

		for (var i = 0;i<blackList.length;i++) {
			(function() {
				var pos = blackList[i];
				setTimeout(function () {
				game.showSphere("sphere" + pos, "black")
			}, 500 + i*175)})()
		}
		for (var i = 0;i<whiteList.length;i++) {
			(function() {
				var pos = whiteList[i];
				setTimeout(function () {
					game.showSphere("sphere" + pos, "white")
					if("sphere" + pos === "sphere21") {
					}
				}, 400 + i*175)
			})()
		}
	}

	showSphere(name, color) {
		var blackChessMaterial = new THREE.MeshLambertMaterial({ color: "#000000"});
		var whiteChessMaterial = new THREE.MeshLambertMaterial({ color: "#FFFFFF"});

		if(color === "black") {
			game.scene.getObjectByName("sphereGroup").getObjectByName(name ).material = blackChessMaterial
		} else if(color === "white") {
			game.scene.getObjectByName("sphereGroup").getObjectByName(name).material = whiteChessMaterial
		}

	}

	hideSphere(name) {
		game.scene.getObjectByName("sphereGroup").getObjectByName(name ).material = new THREE.MeshLambertMaterial({
			opacity: 0,
			transparent: true,
			side: THREE.DoubleSide
		})
	}

	loadEnvironment(loader){
		const game = this;

		loader.load(`${this.assetsPath}fbx/town.fbx`, function(object){
			game.environment = object;
			game.colliders = [];
			game.scene.add(object);
			object.traverse( function ( child ) {
				if ( child.isMesh ) {
					if (child.name.startsWith("proxy")){
						game.colliders.push(child);
						child.material.visible = false;
					}else{
						child.castShadow = true;
						child.receiveShadow = true;
					}
				}
			} );
			const gltfLoader = new THREE.GLTFLoader();
			gltfLoader.load("./assets/gltf/scene.gltf",function(gltf){
				gltf.scene.position.set(3243,-100,-10151);
				gltf.scene.scale.set(100,100,100);
				gltf.scene.name="tower"
				game.scene.add(gltf.scene);
				gltf.scene.traverse( function ( child ) {
					game.colliders.push(child);
				})
			})
			gltfLoader.load("./assets/gltf/robert_the_kitchenware_robot.glb",function(gltf){
				gltf.scene.position.set(3496,0,-2076);
				// gltf.scene.rotation.set(0,Math.PI,0)
				gltf.scene.scale.set(200,200,200);
				gltf.scene.name="robot"
				game.scene.add(gltf.scene);
				gltf.scene.traverse( function ( child ) {
					game.colliders.push(child);
				})
			})

			const textureLoader = new THREE.TextureLoader();

			var box = new THREE.BoxGeometry(700,700,100);
			var middleBox = new THREE.BoxGeometry(5000,5000,5000);

			var text = textureLoader.load('./assets/images/course1.jpg')

			var towerMaterial = new THREE.MeshBasicMaterial({
				map: text,side: THREE.BackSide})

			var transparent = new THREE.MeshLambertMaterial({opacity: 0, transparent: true, side: THREE.DoubleSide });

			var towerMaterials = [
				towerMaterial, // 右侧面
				towerMaterial, // 左后侧面
				towerMaterial, // 上面
				towerMaterial, // 下面
				towerMaterial, // 右后侧面
				towerMaterial // 左侧面
			]

			var towerBox = new THREE.Mesh(middleBox, towerMaterials)
			towerBox.position.set(2562,-7000,-5989);
			towerBox.name="towerBox"
			game.scene.add(towerBox);
			towerBox.traverse( function ( child ) {
				game.colliders.push(child);
			})


			var course1 = textureLoader.load('./assets/images/course1.jpg')
			var course2 = textureLoader.load('./assets/images/course2.jpg')
			var course3 = textureLoader.load('./assets/images/course3.jpg')
			var course4 = textureLoader.load('./assets/images/course4.jpg')


			var brownMaterial = new THREE.MeshLambertMaterial({ color: '#71462a', opacity: 0.8, transparent: true });
			var blueMaterial = new THREE.MeshLambertMaterial({color:'#317cee', opacity: 0.8, transparent: true});
			var orangeMaterial = new THREE.MeshLambertMaterial({color:'#d9850b', opacity: 0.8, transparent: true});
			var greenMaterial = new THREE.MeshLambertMaterial({color:'#0f7a10', opacity: 0.8, transparent: true});

			var materials1 = [
				brownMaterial,
				brownMaterial,
				brownMaterial,
				brownMaterial,
				brownMaterial,
				new THREE.MeshPhongMaterial({map:course1})
			]


			var materials2 = [
				blueMaterial,
				blueMaterial,
				blueMaterial,
				blueMaterial,
				blueMaterial,
				new THREE.MeshPhongMaterial({map:course2})
			]

			var materials3 = [
				orangeMaterial,
				orangeMaterial,
				orangeMaterial,
				orangeMaterial,
				orangeMaterial,
				new THREE.MeshPhongMaterial({map:course3})
			]

			var materials4 = [
				greenMaterial,
				greenMaterial,
				greenMaterial,
				greenMaterial,
				greenMaterial,
				new THREE.MeshPhongMaterial({map:course4})
			]


			var board1 = new THREE.Mesh(box,new THREE.MeshFaceMaterial(materials1))
			board1.position.set(6220,300,-373);
			board1.name="board1"
			game.scene.add(board1);
			board1.traverse( function ( child ) {
				game.colliders.push(child);
			})

			var board2 = new THREE.Mesh(box ,new THREE.MeshFaceMaterial(materials2))
			board2.position.set(8127,300,-1570);
			board2.rotation.set(0,Math.PI/2,0)
			board2.name="board2"
			game.scene.add(board2);
			board2.traverse( function ( child ) {
				game.colliders.push(child);
			})

			var board3 = new THREE.Mesh(box,new THREE.MeshFaceMaterial( materials3))
			board3.position.set(8127,300,-4350);
			board3.rotation.set(0,Math.PI/2,0)
			board3.name="board3"
			game.scene.add(board3);
			board3.traverse( function ( child ) {
				game.colliders.push(child);
			})

			var board4 = new THREE.Mesh(box,new THREE.MeshFaceMaterial( materials4))
			board4.position.set(8127,300,-8061);
			board4.rotation.set(0,Math.PI/2,0)
			board4.name="board4"
			game.scene.add(board4);
			board4.traverse( function ( child ) {
				game.colliders.push(child);
			})

			var board5 = new THREE.Mesh(box,new THREE.MeshFaceMaterial( materials1))
			board5.position.set(1349,300,-482);
			board5.name="board5"
			game.scene.add(board5);
			board5.traverse( function ( child ) {
				game.colliders.push(child);
			})

			var board6 = new THREE.Mesh(box,new THREE.MeshFaceMaterial( materials1))
			board6.position.set(-1655,300,-2740);
			board6.name="board6"
			game.scene.add(board6);
			board6.traverse( function ( child ) {
				game.colliders.push(child);
			})

			var board7 = new THREE.Mesh(box,new THREE.MeshFaceMaterial( materials1))
			board7.position.set(-1607,300,-4756);
			board7.rotation.set(0,-Math.PI/2,0)
			board7.name="board7"
			game.scene.add(board7);
			board7.traverse( function ( child ) {
				game.colliders.push(child);
			})

			var board8 = new THREE.Mesh(box,new THREE.MeshFaceMaterial( materials1))
			board8.position.set(-1597,300,-7492);
			board8.rotation.set(0,-Math.PI/2,0)
			board8.name="board8"
			game.scene.add(board8);
			board8.traverse( function ( child ) {
				game.colliders.push(child);
			})

			const tloader = new THREE.CubeTextureLoader();
			tloader.setPath( `${game.assetsPath}/images/` );

			var textureCube = tloader.load( [
				'px.jpg', 'nx.jpg',
				'py.jpg', 'ny.jpg',
				'pz.jpg', 'nz.jpg'
			] );

			game.loadBoard();
			game.scene.background = textureCube;

			game.loadNextAnim(loader);
		})
	}

	loadNextAnim(loader){
		let anim = this.anims.pop();
		const game = this;
		loader.load( `${this.assetsPath}fbx/anims/${anim}.fbx`, function( object ){
			game.player.animations[anim] = object.animations[0];
			if (game.anims.length>0){
				game.loadNextAnim(loader);
			}else{
				delete game.anims;
				game.action = "Idle";
				game.mode = game.modes.ACTIVE;
				game.animate();
			}
		});
	}

	playerControl(forward, turn){
		turn = -turn;

		if (forward>0.3){
			if (this.player.action!=='Walking' && this.player.action!=='Running') this.player.action = 'Walking';
		}else if (forward<-0.3){
			if (this.player.action!=='Walking Backwards') this.player.action = 'Walking Backwards';
		}else{
			forward = 0;
			if (Math.abs(turn)>0.1){
				if (this.player.action !== 'Turn') this.player.action = 'Turn';
			}else if (this.player.action!=="Idle"){
				this.player.action = 'Idle';
			}
		}

		if (forward === 0 && turn === 0){
			delete this.player.motion;
		}else{
			this.player.motion = { forward, turn };
		}

		this.player.updateSocket();
	}

	createCameras(){
		const offset = new THREE.Vector3(0, 80, 0);
		const front = new THREE.Object3D();
		front.position.set(112, 100, 600);
		front.parent = this.player.object;
		const back = new THREE.Object3D();
		back.position.set(0, 300, -1050);
		back.parent = this.player.object;
		const chat = new THREE.Object3D();
		chat.position.set(0, 200, -450);
		chat.parent = this.player.object;
		const wide = new THREE.Object3D();
		wide.position.set(178, 139, 1665);
		wide.parent = this.player.object;
		const overhead = new THREE.Object3D();
		overhead.position.set(0, 400, 0);
		overhead.parent = this.player.object;
		const collect = new THREE.Object3D();
		collect.position.set(40, 82, 94);
		collect.parent = this.player.object;

		const tower = new THREE.Object3D();
		tower.position.set(0,300,-1500)
		tower.parent = this.scene.getObjectByName("towerBoard")


		this.cameras = { front, back, wide, overhead, collect, chat, tower};
		this.activeCamera = this.cameras.back;
	}

	showMessage(msg, fontSize=20, onOK=null){
		const txt = document.getElementById('message_text');
		txt.innerHTML = msg;
		txt.style.fontSize = fontSize + 'px';
		const btn = document.getElementById('message_ok');
		const panel = document.getElementById('message');
		const game = this;
		if (onOK!=null){
			btn.onclick = function(){
				panel.style.display = 'none';
				onOK.call(game);
			}
		}else{
			btn.onclick = function(){
				panel.style.display = 'none';
			}
		}
		panel.style.display = 'flex';
	}

	onWindowResize() {
		this.camera.aspect = window.innerWidth / window.innerHeight;
		this.camera.updateProjectionMatrix();

		this.renderer.setSize( window.innerWidth, window.innerHeight );

	}

	updateRemotePlayers(dt){
		if (this.remoteData === undefined || this.remoteData.length === 0 || this.player === undefined || this.player.id === undefined) return;

		const newPlayers = [];
		const game = this;
		//Get all remotePlayers from remoteData array
		const remotePlayers = [];
		const remoteColliders = [];

		this.remoteData.forEach( function(data){
			if (game.player.id !== data.id){
				//Is this player being initialised?
				let iplayer;
				game.initialisingPlayers.forEach( function(player){
					if (player.id === data.id) iplayer = player;
				});
				//If not being initialised check the remotePlayers array
				if (iplayer===undefined){
					let rplayer;
					game.remotePlayers.forEach( function(player){
						if (player.id === data.id) rplayer = player;
					});
					if (rplayer===undefined){
						//Initialise player
						game.initialisingPlayers.push( new Player( game, data ));
					}else{
						//Player exists
						remotePlayers.push(rplayer);
						remoteColliders.push(rplayer.collider);
					}
				}
			}
		});

		this.scene.children.forEach( function(object){
			if (object.userData.remotePlayer && game.getRemotePlayerById(object.userData.id)===undefined){
				game.scene.remove(object);
			}
		});

		this.remotePlayers = remotePlayers;
		this.remoteColliders = remoteColliders;
		this.remotePlayers.forEach(function(player){ player.update( dt ); });
	}

	onMouseDown( event ) {
		// if (this.remoteColliders===undefined || this.remoteColliders.length==0 || this.speechBubble===undefined || this.speechBubble.mesh===undefined) return;

		// calculate mouse position in normalized device coordinates
		// (-1 to +1) for both components
		const mouse = new THREE.Vector2();
		mouse.x = ( event.clientX / this.renderer.domElement.clientWidth ) * 2 - 1;
		mouse.y = - ( event.clientY / this.renderer.domElement.clientHeight ) * 2 + 1;

		const raycaster = new THREE.Raycaster();
		raycaster.setFromCamera( mouse, this.camera );

		const target=raycaster.intersectObjects(this.colliders)
		if(target.length>0){
			if (target[0].object.parent.name === "KH_TowerHigh003"){
				alert("start training!");
			}
			if(game.stage === 1 && target[0].object.name === "sphere11") {
				game.showSphere("sphere11", "black")
				game.hideSphere("sphere21")
				game.hideSphere("sphere22")
			}
		}

		const intersects = raycaster.intersectObjects( this.remoteColliders );
		const chat = document.getElementById('chat');

		if (intersects.length>0){
			const object = intersects[0].object;
			const players = this.remotePlayers.filter( function(player){
				if (player.collider!==undefined && player.collider === object){
					return true;
				}
			});
			if (players.length>0){
				const player = players[0];
				console.log(`onMouseDown: player ${player.id}`);
				this.speechBubble.player = player;
				this.speechBubble.update('');
				this.scene.add(this.speechBubble.mesh);
				this.chatSocketId = player.id;
				chat.style.bottom = '0px';
				this.activeCamera = this.cameras.chat;
			}
		}else{
			//Is the chat panel visible?
			if (chat.style.bottom === '0px' && (window.innerHeight - event.clientY)>40){
				console.log("onMouseDown: No player found");
				if (this.speechBubble.mesh.parent!==null) this.speechBubble.mesh.parent.remove(this.speechBubble.mesh);
				delete this.speechBubble.player;
				delete this.chatSocketId;
				chat.style.bottom = '-50px';
				this.activeCamera = this.cameras.back;
			}else{
				console.log("onMouseDown: typing");
			}
		}
	}

	getRemotePlayerById(id){
		if (this.remotePlayers===undefined || this.remotePlayers.length === 0) return;

		const players = this.remotePlayers.filter(function(player){
			if (player.id === id) return true;
		});

		if (players.length===0) return;

		return players[0];
	}

	animate() {
		const game = this;
		const dt = this.clock.getDelta();

		requestAnimationFrame( function(){ game.animate(); } );

		this.updateRemotePlayers(dt);

		if (this.player.mixer !== undefined && this.mode === this.modes.ACTIVE) this.player.mixer.update(dt);

		if (this.player.action === 'Walking'){
			const elapsedTime = Date.now() - this.player.actionTime;
			if (elapsedTime>1000 && this.player.motion.forward>0){
				this.player.action = 'Running';
			}
		}

		if (this.player.motion !== undefined) this.player.move(dt);

		if (this.cameras !== undefined && this.cameras.active !== undefined && this.player !== undefined && this.player.object !== undefined){
			if (this.cameras.active !== this.cameras.tower){
				this.camera.position.lerp(this.cameras.active.getWorldPosition(new THREE.Vector3()), 0.05);
			}
			const pos = this.player.object.position.clone();
			const pointPos = game.scene.getObjectByName("towerBoard").position;
			// pointPos.x += 700;
			// pointPos.y += 100;
			// pointPos.z -= 500;
			if (this.cameras.active === this.cameras.chat){
				pos.y += 200;
			}else{
				pos.y += 300;
			}
			if(this.cameras.active !== this.cameras.tower) this.camera.lookAt(pos);
			else {
				this.camera.lookAt(pointPos)
				this.controls.update(dt);
			}
		}

		if (this.sun !== undefined){
			this.sun.position.copy( this.camera.position );
			this.sun.position.y += 10;
		}

		if (this.speechBubble!==undefined) this.speechBubble.show(this.camera.position);

		this.renderer.render( this.scene, this.camera );
	}
}

class Player{
	constructor(game, options){
		this.local = true;
		let model, colour;

		const colours = ['Black', 'Brown', 'White'];
		colour = colours[Math.floor(Math.random()*colours.length)];

		if (options===undefined){
			const people = ['BeachBabe', 'BusinessMan', 'Doctor', 'FireFighter', 'Housewife', 'Policeman', 'Prostitute', 'Punk', 'RiotCop', 'Roadworker', 'Robber', 'Sheriff', 'Streetman', 'Waitress'];
			model = people[Math.floor(Math.random()*people.length)];
		}else if (typeof options =='object'){
			this.local = false;
			this.options = options;
			this.id = options.id;
			model = options.model;
			colour = options.colour;
		}else{
			model = options;
		}
		this.model = model;
		this.colour = colour;
		this.game = game;
		this.animations = this.game.animations;

		const loader = new THREE.FBXLoader();
		const player = this;

		loader.load( `${game.assetsPath}fbx/people/${model}.fbx`, function ( object ) {

			object.mixer = new THREE.AnimationMixer( object );
			player.root = object;
			player.mixer = object.mixer;

			object.name = "Person";

			object.traverse( function ( child ) {
				if ( child.isMesh ) {
					child.castShadow = true;
					child.receiveShadow = true;
				}
			} );


			const textureLoader = new THREE.TextureLoader();

			textureLoader.load(`${game.assetsPath}images/SimplePeople_${model}_${colour}.png`, function(texture){
				object.traverse( function ( child ) {
					if ( child.isMesh ){
						child.material.map = texture;
					}
				} );
			});

			player.object = new THREE.Object3D();
			player.object.position.set(3122, 0, -173);
			player.object.rotation.set(0, 2.6, 0);

			player.object.add(object);
			if (player.deleted===undefined) game.scene.add(player.object);

			if (player.local){
				game.createCameras();
				game.sun.target = game.player.object;
				game.animations.Idle = object.animations[0];
				if (player.initSocket!==undefined) player.initSocket();
			}else{
				const geometry = new THREE.BoxGeometry(100,300,100);
				const material = new THREE.MeshBasicMaterial({visible:false});
				const box = new THREE.Mesh(geometry, material);
				box.name = "Collider";
				box.position.set(0, 150, 0);
				player.object.add(box);
				player.collider = box;
				player.object.userData.id = player.id;
				player.object.userData.remotePlayer = true;
				const players = game.initialisingPlayers.splice(game.initialisingPlayers.indexOf(this), 1);
				game.remotePlayers.push(players[0]);
			}

			if (game.animations.Idle!==undefined) player.action = "Idle";
		} );
	}

	set action(name){
		//Make a copy of the clip if this is a remote player
		if (this.actionName === name) return;
		const clip = (this.local) ? this.animations[name] : THREE.AnimationClip.parse(THREE.AnimationClip.toJSON(this.animations[name]));
		const action = this.mixer.clipAction( clip );
        action.time = 0;
		this.mixer.stopAllAction();
		this.actionName = name;
		this.actionTime = Date.now();

		action.fadeIn(0.5);
		action.play();
	}

	get action(){
		return this.actionName;
	}

	update(dt){
		this.mixer.update(dt);

		if (this.game.remoteData.length>0){
			let found = false;
			for(let data of this.game.remoteData){
				if (data.id !== this.id) continue;
				//Found the player
				this.object.position.set( data.x, data.y, data.z );
				const euler = new THREE.Euler(data.pb, data.heading, data.pb);
				this.object.quaternion.setFromEuler( euler );
				this.action = data.action;
				found = true;
			}
			if (!found) this.game.removePlayer(this);
		}
	}
}

class PlayerLocal extends Player{
	constructor(game, model){
		super(game, model);

		const player = this;
		const socket = io.connect();
		socket.on('setId', function(data){
			player.id = data.id;
		});
		socket.on('remoteData', function(data){
			game.remoteData = data;
		});
		socket.on('deletePlayer', function(data){
			const players = game.remotePlayers.filter(function(player){
				if (player.id === data.id){
					return player;
				}
			});
			if (players.length>0){
				let index = game.remotePlayers.indexOf(players[0]);
				if (index !== -1){
					game.remotePlayers.splice( index, 1 );
					game.scene.remove(players[0].object);
				}
            }else{
                index = game.initialisingPlayers.indexOf(data.id);
                if (index !== -1){
                    const player = game.initialisingPlayers[index];
                    player.deleted = true;
                    game.initialisingPlayers.splice(index, 1);
                }
			}
		});

		socket.on('chat message', function(data){
			document.getElementById('chat').style.bottom = '0px';
			const player = game.getRemotePlayerById(data.id);
			game.speechBubble.player = player;
			game.chatSocketId = player.id;
			game.activeCamera = game.cameras.chat;
			game.speechBubble.update(data.message);
		});

		$('#msg-form').submit(function(e){
			socket.emit('chat message', { id:game.chatSocketId, message:$('#m').val() });
			$('#m').val('');
			return false;
		});

		this.socket = socket;
	}

	initSocket(){
		//console.log("PlayerLocal.initSocket");
		this.socket.emit('init', {
			model:this.model,
			colour: this.colour,
			x: this.object.position.x,
			y: this.object.position.y,
			z: this.object.position.z,
			h: this.object.rotation.y,
			pb: this.object.rotation.x
		});
	}

	updateSocket(){
		if (this.socket !== undefined){
			//console.log(`PlayerLocal.updateSocket - rotation(${this.object.rotation.x.toFixed(1)},${this.object.rotation.y.toFixed(1)},${this.object.rotation.z.toFixed(1)})`);
			this.socket.emit('update', {
				x: this.object.position.x,
				y: this.object.position.y,
				z: this.object.position.z,
				h: this.object.rotation.y,
				pb: this.object.rotation.x,
				action: this.action
			})
		}
	}

	calculateDistance(obj1, obj2) {
		var dx = obj1.position.x - obj2.position.x
		var dy = obj1.position.y - obj2.position.y
		var dz = obj1.position.z - obj2.position.z
		return Math.sqrt(dx * dx + dy * dy + dz * dz)
	}

	move(dt){
		const pos = this.object.position.clone();
		pos.y += 60;
		let dir = new THREE.Vector3();
		this.object.getWorldDirection(dir);
		if (this.motion.forward<0) dir.negate();
		let raycaster = new THREE.Raycaster(pos, dir);
		let blocked = false;
		const colliders = this.game.colliders;

		if (colliders!==undefined){
			const intersect = raycaster.intersectObjects([...colliders,...this.game.remoteColliders]);
			if (intersect.length>0){
				if (intersect[0].distance<50) blocked = true;
				// if (intersect[0].distance<500 && intersect[0].object.parent.name === "KH_TowerHigh003"){
				// 	alert("You found the tower!");
				// 	this.object.position.set(7788, -20, -4790);
				// 	this.object.rotation.set(3.14,-0.11,3.14);
				// 	game.turn = 0;
				// 	game.forward = 0;
				// 	game.playerControl(0,0);
				// }
				if(this.calculateDistance(game.player.object, game.scene.getObjectByName("board1")) < 1000) {
					// alert("board1")
					if(game.scene.getObjectByName("board1Append") == null) {

						const textureLoader = new THREE.TextureLoader();
						var course1Append = textureLoader.load('./assets/images/course1Append.jpg')


						var brownMaterial = new THREE.MeshLambertMaterial({ color: '#71462a', opacity: 0.8, transparent: true });

						var materials = [
							brownMaterial,
							brownMaterial,
							brownMaterial,
							brownMaterial,
							brownMaterial,
							new THREE.MeshPhongMaterial({map:course1Append}),
						]
						//
						var box = new THREE.BoxGeometry(300,300,1);
						var board1Append = new THREE.Mesh(box ,new THREE.MeshFaceMaterial( materials))
						board1Append.position.set(5621,300,-372);
						board1Append.name="board1Append"
						game.scene.add(board1Append);
					}
				}
				if(this.calculateDistance(game.player.object, game.scene.getObjectByName("board1")) > 1500) {
					if(game.scene.getObjectByName("board1Append") !== null) {
						game.scene.remove(game.scene.getObjectByName("board1Append"))
					}
				}

				if(this.calculateDistance(game.player.object, game.scene.getObjectByName("board2")) < 1000) {

					if(game.scene.getObjectByName("board2Append") == null) {

						const textureLoader = new THREE.TextureLoader();
						var course2Append = textureLoader.load('./assets/images/course2Append.jpg')


						var blueMaterial = new THREE.MeshLambertMaterial({ color: '#317cee', opacity: 0.8, transparent: true });

						var materials2 = [
							blueMaterial,
							blueMaterial,
							blueMaterial,
							blueMaterial,
							blueMaterial,
							new THREE.MeshPhongMaterial({map:course2Append}),
						]
						//
						var box2 = new THREE.BoxGeometry(300,300,1);
						var board2Append = new THREE.Mesh(box2 ,new THREE.MeshFaceMaterial( materials2))
						board2Append.position.set(8062,300,-979);
						board2Append.rotation.set(0,Math.PI/2,0)
						board2Append.name="board2Append"
						game.scene.add(board2Append);
					}
				}
				if(this.calculateDistance(game.player.object, game.scene.getObjectByName("board2")) > 1500) {
					if(game.scene.getObjectByName("board2Append") !== null) {
						game.scene.remove(game.scene.getObjectByName("board2Append"))
					}
				}

				if(this.calculateDistance(game.player.object, game.scene.getObjectByName("board3")) < 1000) {

					if(game.scene.getObjectByName("board3Append") == null) {

						const textureLoader = new THREE.TextureLoader();
						var course3Append = textureLoader.load('./assets/images/course3Append.jpg')

						var orangeMaterial = new THREE.MeshLambertMaterial({color:'#d9850b', opacity: 0.8, transparent: true});

						var materials3 = [
							orangeMaterial,
							orangeMaterial,
							orangeMaterial,
							orangeMaterial,
							orangeMaterial,
							new THREE.MeshPhongMaterial({map:course3Append})
						]
						//
						var box3 = new THREE.BoxGeometry(300,300,1);
						var board3Append = new THREE.Mesh(box3 ,new THREE.MeshFaceMaterial( materials3))
						board3Append.position.set(8167,300,-3676);
						board3Append.rotation.set(0,Math.PI/2,0)
						board3Append.name="board3Append"
						game.scene.add(board3Append);
					}
				}
				if(this.calculateDistance(game.player.object, game.scene.getObjectByName("board3")) > 1500) {
					if(game.scene.getObjectByName("board3Append") !== null) {
						game.scene.remove(game.scene.getObjectByName("board3Append"))
					}
				}

				if(this.calculateDistance(game.player.object, game.scene.getObjectByName("board4")) < 1000) {

					if(game.scene.getObjectByName("board4Append") == null) {

						const textureLoader = new THREE.TextureLoader();
						var course4Append = textureLoader.load('./assets/images/course4Append.jpg')
						var greenMaterial = new THREE.MeshLambertMaterial({color:'#0f7a10', opacity: 0.8, transparent: true});

						var materials4 = [
							greenMaterial,
							greenMaterial,
							greenMaterial,
							greenMaterial,
							greenMaterial,
							new THREE.MeshPhongMaterial({map:course4Append})
						]
						//
						var box4 = new THREE.BoxGeometry(300,300,1);
						var board4Append = new THREE.Mesh(box4 ,new THREE.MeshFaceMaterial( materials4))
						board4Append.position.set(8067,300,-7351);
						board4Append.rotation.set(0,Math.PI/2,0)
						board4Append.name="board4Append"
						game.scene.add(board4Append);
					}
				}
				if(this.calculateDistance(game.player.object, game.scene.getObjectByName("board4")) > 1500) {
					if(game.scene.getObjectByName("board4Append") !== null) {
						game.scene.remove(game.scene.getObjectByName("board4Append"))
					}
				}
			}
		}

		if (!blocked){
			if (this.motion.forward>0){
				// const speed = (this.action === 'Running') ? 500 : 150;
				const speed = (this.action === 'Running') ? 1000 : 300;

				this.object.translateZ(dt * speed);
			}else{
				this.object.translateZ(-dt * 300);
			}
		}

		if (colliders!==undefined){
			//cast left
			dir.set(-1,0,0);
			dir.applyMatrix4(this.object.matrix);
			dir.normalize();
			raycaster = new THREE.Raycaster(pos, dir);

			let intersect = raycaster.intersectObjects(colliders);
			if (intersect.length>0){
				if (intersect[0].distance<50) this.object.translateX(100-intersect[0].distance);
			}

			//cast right
			dir.set(1,0,0);
			dir.applyMatrix4(this.object.matrix);
			dir.normalize();
			raycaster = new THREE.Raycaster(pos, dir);

			intersect = raycaster.intersectObjects(colliders);
			if (intersect.length>0){
				if (intersect[0].distance<50) this.object.translateX(intersect[0].distance-100);
			}

			//cast down
			dir.set(0,-1,0);
			pos.y += 200;
			raycaster = new THREE.Raycaster(pos, dir);
			const gravity = 30;

			intersect = raycaster.intersectObjects(colliders);
			if (intersect.length>0){
				const targetY = pos.y - intersect[0].distance;
				if (targetY > this.object.position.y){
					//Going up
					this.object.position.y = 0.8 * this.object.position.y + 0.2 * targetY;
					this.velocityY = 0;
				}else if (targetY < this.object.position.y){
					//Falling
					if (this.velocityY === undefined) this.velocityY = 0;
					this.velocityY += dt * gravity;
					this.object.position.y -= this.velocityY;
					if (this.object.position.y < targetY){
						this.velocityY = 0;
						this.object.position.y = targetY;
					}
				}
			}
		}

		this.object.rotateY(this.motion.turn*dt);

		this.updateSocket();
	}
}

class SpeechBubble{
	constructor(game, msg, size=1){
		this.config = { font:'Calibri', size:24, padding:10, colour:'#222', width:256, height:256 };

		const planeGeometry = new THREE.PlaneGeometry(size, size);
		const planeMaterial = new THREE.MeshBasicMaterial()
		this.mesh = new THREE.Mesh(planeGeometry, planeMaterial);
		game.scene.add(this.mesh);

		const self = this;
		const loader = new THREE.TextureLoader();
		loader.load(
			// resource URL
			`${game.assetsPath}images/speech.png`,

			// onLoad callback
			function ( texture ) {
				// in this example we create the material when the texture is loaded
				self.img = texture.image;
				self.mesh.material.map = texture;
				self.mesh.material.transparent = true;
				self.mesh.material.needsUpdate = true;
				if (msg!==undefined) self.update(msg);
			},

			// onProgress callback currently not supported
			undefined,

			// onError callback
			function ( err ) {
				console.error( 'An error happened.' );
			}
		);
	}

	update(msg){
		if (this.mesh===undefined) return;

		let context = this.context;

		if (this.mesh.userData.context===undefined){
			const canvas = this.createOffscreenCanvas(this.config.width, this.config.height);
			this.context = canvas.getContext('2d');
			context = this.context;
			context.font = `${this.config.size}pt ${this.config.font}`;
			context.fillStyle = this.config.colour;
			context.textAlign = 'center';
			this.mesh.material.map = new THREE.CanvasTexture(canvas);
		}

		const bg = this.img;
		context.clearRect(0, 0, this.config.width, this.config.height);
		context.drawImage(bg, 0, 0, bg.width, bg.height, 0, 0, this.config.width, this.config.height);
		this.wrapText(msg, context);

		this.mesh.material.map.needsUpdate = true;
	}

	createOffscreenCanvas(w, h) {
		const canvas = document.createElement('canvas');
		canvas.width = w;
		canvas.height = h;
		return canvas;
	}

	wrapText(text, context){
		const words = text.split(' ');
        let line = '';
		const lines = [];
		const maxWidth = this.config.width - 2*this.config.padding;
		const lineHeight = this.config.size + 8;

		words.forEach( function(word){
			const testLine = `${line}${word} `;
        	const metrics = context.measureText(testLine);
        	const testWidth = metrics.width;
			if (testWidth > maxWidth) {
				lines.push(line);
				line = `${word} `;
			}else {
				line = testLine;
			}
		});

		if (line !== '') lines.push(line);

		let y = (this.config.height - lines.length * lineHeight)/2;

		lines.forEach( function(line){
			context.fillText(line, 128, y);
			y += lineHeight;
		});
	}

	show(pos){
		if (this.mesh!==undefined && this.player!==undefined){
			this.mesh.position.set(this.player.object.position.x, this.player.object.position.y + 380, this.player.object.position.z);
			this.mesh.lookAt(pos);
		}
	}
}
