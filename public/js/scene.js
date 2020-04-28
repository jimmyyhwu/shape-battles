let particlesList = [];
// density of particles
let particleDensity = 100; 
let numParticles;
let wallGeometry;
// number of segments on wall
let numSegments = 50;


function initScene() {
 	scene = new THREE.Scene();
    aspect = window.innerWidth / window.innerHeight;
    camera = new THREE.OrthographicCamera(-aspect, aspect, -1, 1);
    renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
	renderer.autoClear = false;
    document.body.appendChild(renderer.domElement);

    return scene;
}

// create particles that are floating around in space
function createBackgroundParticles(c) {
	numParticles = roomWidth * roomHeight * particleDensity;
	let particleGeometry = new THREE.Geometry();
	for (let i = 0; i < numParticles; i++) {
		let pX = (Math.random() - 0.5) * roomWidth * 2;
		let pY = (Math.random() - 0.5) * roomHeight * 2;
		let pZ = -5; // some index in the background

		let particle = new THREE.Vector3(pX, pY, pZ);
		particle.velocity = new THREE.Vector3(0.002, 0.002, 0);
		particleGeometry.vertices.push(particle);
	}
	let particleMaterial = new THREE.PointsMaterial({color: c});

	let points = new THREE.Points(particleGeometry, particleMaterial);
	particlesList.push(particleGeometry);
	scene.add(points);
}

function addBackground() {
	// make different colors ranging from red (#e57169), orange (#e5af69), to yellow (#dde569)
	let color1 = new THREE.Color("#e57169");
	let color2 = new THREE.Color("#e5af69");
	let color3 = new THREE.Color("#dde569");

	createBackgroundParticles(color1);
	createBackgroundParticles(color2);
	createBackgroundParticles(color3);

}

function animateBackground() {
	// animate background particles
	for (let i = 0; i < particlesList.length; i++) {
		for (let j = 0; j < numParticles; j++) {
			let particle = particlesList[i].vertices[j];
			particle.x += particle.velocity.x;
			particle.y += particle.velocity.y;
			particle.z += particle.velocity.z;
			if (particle.x > roomWidth)
				particle.x = -roomWidth;
			if (particle.y > roomHeight)
				particle.y = - roomHeight;
		};
		particlesList[i].verticesNeedUpdate = true;
	};

	// animate the walls
	let distFactor = 0.05;
	for (let i = 0; i < wallGeometry.vertices.length; i++) {
		let segment = wallGeometry.vertices[i];
		
		if (segment.sameX === undefined)
			continue

		if (segment.sameX) {
			segment.x = (Math.random() - 0.5) * distFactor + segment.ref;
		}
		else {
			segment.y = (Math.random() - 0.5) * distFactor + segment.ref;
		}
	};
	wallGeometry.verticesNeedUpdate = true;	
}

// creates uniform segments along the wall from v1 to v2
function segmentWalls(v1, v2, wallGeometry) {
	let same;
	let sameX = v1.x == v2.x; // true if x is same, false if y is same
	if (sameX) 
		same = v1.x;
	else
		same = v1.y;
	let dist = sameX ? v2.y - v1.y : v2.x - v1.x;
	for (let i = 0; i < numSegments; i++) {
		let inc = i * (dist / numSegments);
		let coord = sameX ? new THREE.Vector3(v1.x, v1.y + inc, v1.z) : new THREE.Vector3(v1.x + inc, v1.y, v1.z);
		coord.sameX = sameX;
		coord.ref = sameX ? v1.x : v1.y; // reference from which to move vertex when animating
    	wallGeometry.vertices.push(coord);
	};
}


function addWalls() {
    wallGeometry = new THREE.Geometry();
    let corner1 = new THREE.Vector3(-roomWidth / 2, -roomHeight / 2, -1);
    let corner2 = new THREE.Vector3(-roomWidth / 2, roomHeight / 2, -1);
    let corner3 = new THREE.Vector3(roomWidth / 2, roomHeight / 2, -1);
    let corner4 = new THREE.Vector3(roomWidth / 2, -roomHeight / 2, -1);
    let corner5 = new THREE.Vector3(-roomWidth / 2, -roomHeight / 2, -1);

    segmentWalls(corner1, corner2, wallGeometry);
    segmentWalls(corner2, corner3, wallGeometry);
    segmentWalls(corner3, corner4, wallGeometry);
    segmentWalls(corner4, corner5, wallGeometry);

    wallGeometry.vertices.push(corner5);

    // messy cleanup since segmentWalls adds the first vertex
    delete wallGeometry.vertices[0].sameX;
    delete wallGeometry.vertices[0].ref;

    let wallMaterial = new THREE.LineBasicMaterial({ color: 0x62fc1b });
    let wall = new THREE.Line(wallGeometry, wallMaterial);
    scene.add(wall);
}