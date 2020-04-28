
// preload random numbers
rand = [];
    let i;
    for (i = 1e5; i>0; i--) {
        rand.push( Math.random() - 0.5 );
}

//=============================================================

// Particle System Class
// types: trail, radial
function ParticleSystem(target, type) {
	this.systemType = type; // t

	THREE.Object3D.apply( this, arguments );

	this.frustumCulled = false;

	this.target = target;
	this.last_time = 0.0;

	let texture = (type == 0) ? "textures/spark1.png" : "textures/spark2.png";



	this.uniforms = {
	    texture: { 
	    	type: 't',
	    	value: new THREE.TextureLoader().load(texture) 
	    },
	    time: {
	    	type: 'f',
	    	value: 0.0
	    }
	};




	this.construct();
}

ParticleSystem.prototype.initTrailGeometry = function(){
	this.geometry = new THREE.BufferGeometry();

	this.color = new THREE.Color(90, 0, 0);

	this.particleCount = 100;
	this.lifeTime = 0.8;

	//vec3 attributes
	this.geometry.addAttribute( 'position', new THREE.Float32BufferAttribute( new Float32Array(this.particleCount*3) , 3 ).setDynamic(true));
	this.geometry.addAttribute( 'positionStart', new THREE.Float32BufferAttribute( new Float32Array(this.particleCount*3) , 3 ).setDynamic(true));
	this.geometry.addAttribute( 'velocity', new THREE.Float32BufferAttribute( new Float32Array(this.particleCount*3) , 3 ).setDynamic(true));
	this.geometry.addAttribute( 'color', new THREE.Float32BufferAttribute( new Float32Array(this.particleCount*3) , 3 ).setDynamic(true));

	//scalar attributes
	this.geometry.addAttribute( 'startTime', new THREE.Float32BufferAttribute( new Float32Array(this.particleCount) , 1 ).setDynamic(true));
	
}

ParticleSystem.prototype.initExplGeometry = function(){

	this.geometry = new THREE.BufferGeometry();

	this.color = new THREE.Color(90, 0, 0);

	this.particleCount = 200;
	this.lifeLeft = 1.0;

	let positionStart = [];
	let positionEnd = [];
	let startTimes = [];

	let startRadius = 0.05;
	let endRadius = 0.3;
	for (let i = 0; i < this.particleCount; i++) {
		let r = Math.random()*startRadius;
		let rEnd = Math.random()*endRadius;
		let theta = Math.random()*2*Math.PI;


		positionEnd.push(Math.sqrt(rEnd)*Math.cos(theta) + this.target.position.x);
		positionEnd.push(Math.sqrt(rEnd)*Math.sin(theta) + this.target.position.y);
		positionEnd.push(0);

		positionStart.push(Math.sqrt(r)*Math.cos(theta) + this.target.position.x);
		positionStart.push(Math.sqrt(r)*Math.sin(theta) + this.target.position.y);
		positionStart.push(0);

		startTimes.push(timestep/1000/60);
	}

	//vec3 attributes
	this.geometry.addAttribute( 'position', new THREE.Float32BufferAttribute( new Float32Array(this.particleCount*3) , 3 ).setDynamic(true));
	this.geometry.addAttribute( 'positionStart', new THREE.Float32BufferAttribute(positionStart , 3 ).setDynamic(true));
	this.geometry.addAttribute( 'positionEnd', new THREE.Float32BufferAttribute( positionEnd , 3 ).setDynamic(true));
	this.geometry.addAttribute( 'velocity', new THREE.Float32BufferAttribute( new Float32Array(this.particleCount*3) , 3 ).setDynamic(true));
	this.geometry.addAttribute( 'color', new THREE.Float32BufferAttribute( new Float32Array(this.particleCount*3) , 3 ).setDynamic(true));

	//scalar attributes
	this.geometry.addAttribute( 'startTime', new THREE.Float32BufferAttribute( startTimes, 1 ).setDynamic(true));
	
}


ParticleSystem.prototype.construct = function() {
	this.position = this.target.position;

	if (this.systemType == 0) {
		this.material = new THREE.ShaderMaterial( {
		    uniforms: this.uniforms,
		    vertexShader: trail_vertexshader,
		    fragmentShader: trail_fragmentshader,
		    blending: THREE.AdditiveBlending,
		    depthTest: true,
		    transparent: true,
		    vertexColors: true
		} );

		this.initTrailGeometry();
	} else {
		this.material = new THREE.ShaderMaterial( {
		    uniforms: this.uniforms,
		    vertexShader: expl_vertexshader,
		    fragmentShader: expl_fragmentshader,
		    blending: THREE.AdditiveBlending,
		    depthTest: true,
		    transparent: true,
		    vertexColors: true
		} );

		//debugger;
		this.initExplGeometry();
	}


	// for updating the geometry
	this.offset = 0;
	this.count = 0;
	this.time = 0;
	this.particleUpdate = false;
	this.particleCursor = 0;

	// in

	this.pSystem = new THREE.Points(this.geometry, this.material);

	this.pSystem.frustumCulled = false;
	scene.add(this.pSystem);
}


const UPDATEABLE_ATTRIBUTES = [
	'positionStart', 'startTime', 'velocity', 'color'
];

//https://github.com/joshmarinacci/webxr-experiments/blob/master/particles/GPUParticleSystem.js
ParticleSystem.prototype.geometryUpdate = function() {
    if (this.particleUpdate === true) {
        this.particleUpdate = false;
        UPDATEABLE_ATTRIBUTES.forEach(name => {
            const attr = this.geometry.getAttribute(name)
            if (this.offset + this.count < this.particleCount) {
                attr.updateRange.offset = this.offset * attr.itemSize
                attr.updateRange.count = this.count * attr.itemSize
            } else {
                attr.updateRange.offset = 0
                attr.updateRange.count = -1
            }
            attr.needsUpdate = true
        })
        this.offset = 0;
        this.count = 0;
	}
}

ParticleSystem.prototype.dispose = function() {
	scene.remove(this.pSystem);
    this.pSystem.geometry.dispose();
    this.pSystem.material.dispose();
    

}

ParticleSystem.prototype.reset = function() {
	this.dispose();

    this.construct();
}

//use one of the random numbers
let random = function() {
        return ++ this.i >= this.rand.length ? this.rand[ this.i = 1 ] : this.rand[ this.i ];
}

ParticleSystem.prototype.spawnParticle = function() {

    let position = new THREE.Vector3();
    let velocity = new THREE.Vector3();
    let color = new THREE.Color();

	const positionStartAttribute = this.geometry.getAttribute('positionStart');
	const velocityAttribute = this.geometry.getAttribute('velocity')
	const startTimeAttribute = this.geometry.getAttribute('startTime');
	const colorAttribute = this.geometry.getAttribute('color')

	// set up starting values
	position.copy(this.target.position);
        position.z = -1;
	color.copy(this.color);
	let dir = new THREE.Vector3(1,0,0);
	dir.applyQuaternion(this.target.quaternion);
	dir.multiplyScalar(-1);

  	let r_factor = 100;
  	let r = new THREE.Vector3((Math.random()-.5)*r_factor, (Math.random()-.5)*r_factor, 0)
  	let speed = 500;
	velocity.copy(dir).multiplyScalar(speed).add(r);

	position.add( new THREE.Vector3((Math.random()-.5)*0.05, (Math.random()-.5)*0.05, 0) );
	position.add(dir.multiplyScalar(0.1));

	const i = this.particleCursor;

	// update the geometry
	positionStartAttribute.array[i*3+0] = position.x;// + (Math.random()-.5)*0.1;
	positionStartAttribute.array[i*3+1] = position.y;// + (Math.random()-.5)*0.1;
	positionStartAttribute.array[i*3+2] = position.z;

	colorAttribute.array[i * 3 + 0] = color.r;
    colorAttribute.array[i * 3 + 1] = color.g;
	colorAttribute.array[i * 3 + 2] = color.b;

	velocityAttribute.array[i * 3 + 0] = velocity.x;
	velocityAttribute.array[i * 3 + 1] = velocity.y; 
	velocityAttribute.array[i * 3 + 2] = velocity.z;

	startTimeAttribute.array[i] = this.time;

	if (this.offset === 0) this.offset = this.particleCursor;
	this.count++;
	this.particleCursor++;
	if (this.particleCursor >= this.particleCount) this.particleCursor = 1;
	this.particleUpdate = true;
}

ParticleSystem.prototype.update = function(time) {

	this.time = time/1000/60; //60;// 60 pers second

	// counter to destroy explosion
	if (this.systemType == 1) {
		this.lifeLeft -= (this.time - this.last_time);
		if (this.lifeLeft <= 0) {
			scene.remove(this.pSystem);
		    this.pSystem.geometry.dispose();
		    this.pSystem.material.dispose();
		    return;
		}
	}
	this.last_time = this.time;

 	this.position = this.target.position;

 	this.uniforms.time.value = this.time;

	// manage death and birth of particles
	this.geometryUpdate();

}

var trail_vertexshader = [
            '// read only',
            'uniform float time;',
            '// read only',
            'attribute float startTime;',
            'attribute vec3 positionStart;',
            'attribute vec3 velocity;',
           '// attribute vec3 color;',
            'varying vec3 vColor;',
            'varying float lifeLeft;',

            'void main() {',
                'float lifeTime = 0.001;',
                'float timeElapsed = time - startTime;',
                'lifeLeft = 1.0 - (timeElapsed / lifeTime);',

                'if (lifeLeft < 0.0) {',
                    'lifeLeft = 0.0;',
                '}',
                'if (startTime == 0.0) {',
                    'lifeLeft = 0.0;',
                '}',
                'vec3 newPosition = positionStart + velocity * timeElapsed;',
                'vColor = vec3(0.5 + lifeLeft/2.0, 0.5 + lifeLeft/2.0, 0.5);',
                'gl_PointSize = 30.0 * lifeLeft;',

                 'vec4 mvPosition = modelViewMatrix * vec4( newPosition, 1.0 );',
                'gl_Position = projectionMatrix * mvPosition;',
            '} '].join('\n');

var trail_fragmentshader = 
            "uniform sampler2D texture;\
            uniform float lifeTime;\
            varying vec3 vColor;\
            varying float lifeLeft;\
				\
            void main() {\
                gl_FragColor = vec4(vColor, lifeLeft);\
                gl_FragColor = gl_FragColor * texture2D( texture, gl_PointCoord );\
            }\n ";



//=============================================================


// Global Particle Manager
