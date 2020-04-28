// global variables
var scene, aspect, camera, renderer, composer, outlinePass, stats, blendPass;
var hero, enemies, bombs, explosions;
var isAlive, isPaused;
var lastMouseEvent;
var enemySpawnProbability;
var timestep, score, multiplier;
var pauseTimestep, lastPauseTimestep, pauseMinLength = 60;
var streakTimestep, streakEnemyCounter;
var playerName, leaderboard;
var particleSystem;

// note that there are about 60 timesteps per second
var roomWidth = 6, roomHeight = 4, heroRadius = 0.05, enemyRadius = 0.05, bombRadius = 0.05;
var heroColor = 0xe22c2c, enemyColor = 0x4949ee, bombColor = 0xf4491a, blownBombColor = 0xf08b33;
var heroMovementSpeed = 0.05;


var initialNumEnemies = 10, maxNumEnemies = 1000, enemySpawnProbabilityMin = 0.01, enemySpawnTimesteps = 10 * 60 * 60, enemyMovementSpeedMin = 0.001, enemyMovementSpeedMax = 0.04;

var maxNumBombs = 20, bombSpawnProbability = 0.05, bombExplosionSize = 10, bombLifespan = 10 * 60, blownBombLifespan = 60;
var streakExpiration = 5 * 60, streakEnemyMultiplierStepSize = 20;
var multiplierColors = ["#ffffff", "#fc2020", "#fc7820", "#fcea20", "#20fc2f", "#2092fc", "#9220fc", "#cd7f32", "#ffd700", "#b9f2ff"];

// SAT collision detection
var V = SAT.Vector, P = SAT.Polygon, C = SAT.Circle;
var heroPolygon;


function init() {
    scene = initScene();

    // postprocessing to add outline
    composer = new THREE.EffectComposer(renderer);
    var renderPass = new THREE.RenderPass(scene, camera);
    composer.addPass(renderPass);
    outlinePass = new THREE.OutlinePass(new THREE.Vector2(window.innerWidth, window.innerHeight), scene, camera);
    outlinePass.edgeStrength = Number(2);
    composer.addPass(outlinePass);

    // Bloom pass
    var bloomParams = {
        exposure: 1,
        bloomStrength: 0.5,
        bloomRadius: 1,
        bloomThreshold: 0,
    };
    var bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2( window.innerWidth, window.innerHeight ), 
        bloomParams.bloomStrength, bloomParams.bloomRadius,  bloomParams.bloomThreshold);
    composer.addPass(bloomPass);
        
    // add background
    addBackground();

    // input for player name
    var PlayerName = function() {
        this['Your Name'] = 'anonymous player';
    };
    window.onload = function() {
        playerName = new PlayerName();
        var gui = new dat.GUI({autoPlace: false, closeOnTop: true});
        gui.add(playerName, 'Your Name');
        var customContainer = document.getElementById('player-name');
        customContainer.appendChild(gui.domElement);
    };

    // performance monitor
    stats = new Stats();
    stats.showPanel(0);
    document.body.appendChild(stats.dom);

    // walls
    addWalls();

    // hero
    var corners= [1, 0, 0, -Math.cos(Math.PI * 30 / 180), Math.sin(Math.PI * 30 / 180), 0, -Math.cos(Math.PI * 30 / 180), -Math.sin(Math.PI * 30 / 180, 0)];
    var heroGeometry = new THREE.PolyhedronGeometry(corners, [2, 1, 0], heroRadius);
    var heroVertices = [];
    for (var i = heroGeometry.vertices.length; i > 0; i--) {
        heroVertices.push(new V(heroGeometry.vertices[i - 1].x, heroGeometry.vertices[i - 1].y));
    }
    heroPolygon = new P(new V(), heroVertices);
    var heroMaterial = new THREE.MeshBasicMaterial({color: heroColor});
    hero = new THREE.Mesh(heroGeometry, heroMaterial);
    scene.add(hero);

    enemies = [];
    bombs = [];
    explosions = [];

    // move camera higher up
    camera.position.z = 1;

    // particle system test
    particleSystem = new ParticleSystem(hero, 0);


    resetScene();


    // add mouse listener to update mouse position
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('keydown', onKeyDown);
}

function resetScene() {
    isAlive = true;
    isPaused = true;
    timestep = 0;
    pauseTimestep = 0;
    lastPauseTimestep = 0;
    score = 0;
    multiplier = 1;
    updateUI();
    streakTimestep = -(streakExpiration + 1);
    streakEnemyCounter = 0;

    // clear scene
    for (var i = 0; i < enemies.length; i++) {
        scene.remove(enemies[i]);
    }
    enemies = [];
    for (var i = 0; i < bombs.length; i++) {
        scene.remove(bombs[i]);
    }
    bombs = [];

    // create some initial enemies
    for (var i = 0; i < initialNumEnemies; i++) {
        var enemy = createEnemy();
        scene.add(enemy);
        enemies.push(enemy);
    }

    // reset hero
    hero.position.x = 0;
    hero.position.y = 0;
    hero.rotation.z = 0;

    // reset camera
    camera.position.x = 0;
    camera.position.y = 0;

    // reset particle system
    particleSystem.reset();


    outlinePass.selectedObjects = [hero].concat(enemies).concat(bombs);
    composer.render(scene, camera);

    // get most recent leaderboard
    var xhr = new XMLHttpRequest();
    xhr.open('GET', '/leaderboard', true);
    xhr.onload = function() {
        leaderboard = JSON.parse(xhr.response);
        updateLeaderboard();
    };
    xhr.send();

    document.getElementById("info-text").innerHTML = "=== SHAPE BATTLES: THE FINAL FRONTIER ===";
    document.getElementById("more-info-text").innerHTML = "Use the mouse to move. Press spacebar to start/pause.<br>"
        + "Keep the mouse cursor close to the ship to slow down.<br>"
        + "Squares are bad, circles are good.<br>"
        + "Keep destroying enemies to increase the multiplier.<br>"
        + "Multiplier resets after 5 seconds if you stop destroying enemies.";
}

function onMouseMove(event) {
    lastMouseEvent = event;
}

function onKeyDown(event) {
    if (event.keyCode === 32) {
        if (isAlive) {
            // space to pause
            if (isPaused && timestep > 0) {
                // allow a single resume immediately after pausing, but not any more than that
                if (timestep - lastPauseTimestep > pauseMinLength || pauseTimestep > pauseMinLength) {
                    isPaused = !isPaused;
                    lastPauseTimestep = timestep;
                }
            } else {
                isPaused = !isPaused;
                document.getElementById("info-text").innerHTML = "=== PAUSED ===";
                pauseTimestep = 0;
            }
        } else {
            resetScene();
        }
    }
}

function updateLeaderboard() {
    if (leaderboard === undefined) {
        return;
    } else {
        var leaderboardHtml = '<table>';
        for (var i = 0; i < leaderboard.length; i++) {
            leaderboardHtml += ('<tr><th class="playerName" id="playerName' + i + '"></th><th class="playerScore" id="playerScore' + i + '"></th></tr>');
        }
        leaderboardHtml += '</table>';
        document.getElementById("leaderboard").innerHTML = leaderboardHtml;
        for (var i = 0; i < leaderboard.length; i++) {
            document.getElementById('playerName' + i).appendChild(document.createTextNode(leaderboard[i]['playerName']));
            document.getElementById('playerScore' + i).appendChild(document.createTextNode(leaderboard[i]['score']));
        }
    }
}

function updateUI() {
    document.getElementById('score').innerHTML = score;
    document.getElementById('multiplier').innerHTML = "multiplier " + multiplier + "x";
    if (multiplier <= 10) {
        document.getElementById('multiplier').classList.remove("rainbow");
        document.getElementById('multiplier').style.color = multiplierColors[multiplier - 1];
    } else {
        document.getElementById('multiplier').classList.add("rainbow");
    }
}

function distance(position1, position2) {
    return ((position1.x - position2.x)**2 + (position1.y - position2.y)**2)**0.5;
}

function randomPosition() {
    // use to randomly spawn enemies, but not too close to the hero
    var rangeX = roomWidth - 2 * enemyRadius;
    var rangeY = roomHeight - 2 * enemyRadius;
    var success = false;
    var proposedPosition = new THREE.Vector3();
    while (!success) {
        proposedPosition.x = rangeX * Math.random() - rangeX / 2;
        proposedPosition.y = rangeY * Math.random() - rangeY / 2;
        if (distance(hero.position, proposedPosition) > 10 * 2 * heroRadius) {
            success = true;
        }
    }
    return proposedPosition;
}

function createEnemy() {
    var boxWidth = 2 * enemyRadius / Math.sqrt(2);
    var enemyGeometry = new THREE.BoxGeometry(boxWidth, boxWidth);
    var enemyMaterial = new THREE.MeshBasicMaterial({color: enemyColor});
    var enemy = new THREE.Mesh(enemyGeometry, enemyMaterial);
    enemy.position.copy(randomPosition());
    enemy.rotation.z = 2 * Math.PI * Math.random();
    enemy.speed = enemyMovementSpeedMin + Math.exp(4 * Math.random()) / Math.exp(4) * (enemyMovementSpeedMax - enemyMovementSpeedMin);
    enemy.age = 0;
    return enemy;
}

function createBomb() {
   var bombGeometry = new THREE.CylinderGeometry(bombRadius, bombRadius, 1, 32);
   var bombMaterial = new THREE.MeshBasicMaterial({color: bombColor});
   var bomb = new THREE.Mesh(bombGeometry, bombMaterial);
    bomb.position.copy(randomPosition())
    bomb.position.z = 0.1;
    bomb.rotation.x = Math.PI / 2;
    bomb.blown = false;
    bomb.age = 0;

    return bomb;
}

function blowUpBomb(bomb) {
    var blownBombGeometry = new THREE.CylinderBufferGeometry(bombExplosionSize * bombRadius, bombExplosionSize * bombRadius, 1, 128);


    let uniforms = {
                    amplitude: {
                        type: 'f',
                        value: 0.0
                    }
                };


                //debugger;//
// GLSL textureless classic 3D noise "cnoise",
// with an RSL-style periodic variant "pnoise".
// Author:  Stefan Gustavson (stefan.gustavson@liu.se)
// Version: 2011-10-11
//
// Many thanks to Ian McEwan of Ashima Arts for the
// ideas for permutation and gradient selection.
//
// Copyright (c) 2011 Stefan Gustavson. All rights reserved.
// Distributed under the MIT license. See LICENSE file.
// https://github.com/stegu/webgl-noise
//
    var explosion_material = new THREE.ShaderMaterial( {
                uniforms: uniforms,
                vertexShader: [

'vec3 mod289(vec3 x)',
'{',
  'return x - floor(x * (1.0 / 289.0)) * 289.0;',
'}',
'',
'vec4 mod289(vec4 x)',
'{',
  'return x - floor(x * (1.0 / 289.0)) * 289.0;',
'}',
'',
'vec4 permute(vec4 x)',
'{',
  'return mod289(((x*34.0)+1.0)*x);',
'}',
'',
'vec4 taylorInvSqrt(vec4 r)',
'{',
  'return 1.79284291400159 - 0.85373472095314 * r;',
'}',
'',
'vec3 fade(vec3 t) {',
  'return t*t*t*(t*(t*6.0-15.0)+10.0);',
'}',
'',
'// Classic Perlin noise',
'float cnoise(vec3 P)',
'{',
  'vec3 Pi0 = floor(P); // Integer part for indexing',
  'vec3 Pi1 = Pi0 + vec3(1.0); // Integer part + 1',
  'Pi0 = mod289(Pi0);',
  'Pi1 = mod289(Pi1);',
  'vec3 Pf0 = fract(P); // Fractional part for interpolation',
  'vec3 Pf1 = Pf0 - vec3(1.0); // Fractional part - 1.0',
  'vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);',
  'vec4 iy = vec4(Pi0.yy, Pi1.yy);',
  'vec4 iz0 = Pi0.zzzz;',
  'vec4 iz1 = Pi1.zzzz;',
'',
  'vec4 ixy = permute(permute(ix) + iy);',
  'vec4 ixy0 = permute(ixy + iz0);',
  'vec4 ixy1 = permute(ixy + iz1);',
'',
  'vec4 gx0 = ixy0 * (1.0 / 7.0);',
  'vec4 gy0 = fract(floor(gx0) * (1.0 / 7.0)) - 0.5;',
  'gx0 = fract(gx0);',
  'vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);',
  'vec4 sz0 = step(gz0, vec4(0.0));',
  'gx0 -= sz0 * (step(0.0, gx0) - 0.5);',
  'gy0 -= sz0 * (step(0.0, gy0) - 0.5);',
'',
  'vec4 gx1 = ixy1 * (1.0 / 7.0);',
  'vec4 gy1 = fract(floor(gx1) * (1.0 / 7.0)) - 0.5;',
  'gx1 = fract(gx1);',
  'vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);',
  'vec4 sz1 = step(gz1, vec4(0.0));',
  'gx1 -= sz1 * (step(0.0, gx1) - 0.5);',
  'gy1 -= sz1 * (step(0.0, gy1) - 0.5);',
'',
  'vec3 g000 = vec3(gx0.x,gy0.x,gz0.x);',
  'vec3 g100 = vec3(gx0.y,gy0.y,gz0.y);',
  'vec3 g010 = vec3(gx0.z,gy0.z,gz0.z);',
  'vec3 g110 = vec3(gx0.w,gy0.w,gz0.w);',
  'vec3 g001 = vec3(gx1.x,gy1.x,gz1.x);',
  'vec3 g101 = vec3(gx1.y,gy1.y,gz1.y);',
  'vec3 g011 = vec3(gx1.z,gy1.z,gz1.z);',
  'vec3 g111 = vec3(gx1.w,gy1.w,gz1.w);',
'',
  'vec4 norm0 = taylorInvSqrt(vec4(dot(g000, g000), dot(g010, g010), dot(g100, g100), dot(g110, g110)));',
  'g000 *= norm0.x;',
  'g010 *= norm0.y;',
  'g100 *= norm0.z;',
  'g110 *= norm0.w;',
  'vec4 norm1 = taylorInvSqrt(vec4(dot(g001, g001), dot(g011, g011), dot(g101, g101), dot(g111, g111)));',
  'g001 *= norm1.x;',
  'g011 *= norm1.y;',
  'g101 *= norm1.z;',
  'g111 *= norm1.w;',
'',
  'float n000 = dot(g000, Pf0);',
  'float n100 = dot(g100, vec3(Pf1.x, Pf0.yz));',
  'float n010 = dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z));',
  'float n110 = dot(g110, vec3(Pf1.xy, Pf0.z));',
  'float n001 = dot(g001, vec3(Pf0.xy, Pf1.z));',
  'float n101 = dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z));',
  'float n011 = dot(g011, vec3(Pf0.x, Pf1.yz));',
  'float n111 = dot(g111, Pf1);',
'',
  'vec3 fade_xyz = fade(Pf0);',
  'vec4 n_z = mix(vec4(n000, n100, n010, n110), vec4(n001, n101, n011, n111), fade_xyz.z);',
  'vec2 n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y);',
  'float n_xyz = mix(n_yz.x, n_yz.y, fade_xyz.x); ',
  'return 2.2 * n_xyz;',
'}',
'',
'// Classic Perlin noise, periodic variant',
'float pnoise(vec3 P, vec3 rep)',
'{',
  'vec3 Pi0 = mod(floor(P), rep); // Integer part, modulo period',
  'vec3 Pi1 = mod(Pi0 + vec3(1.0), rep); // Integer part + 1, mod period',
  'Pi0 = mod289(Pi0);',
  'Pi1 = mod289(Pi1);',
  'vec3 Pf0 = fract(P); // Fractional part for interpolation',
  'vec3 Pf1 = Pf0 - vec3(1.0); // Fractional part - 1.0',
  'vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);',
  'vec4 iy = vec4(Pi0.yy, Pi1.yy);',
  'vec4 iz0 = Pi0.zzzz;',
  'vec4 iz1 = Pi1.zzzz;',
'',
  'vec4 ixy = permute(permute(ix) + iy);',
  'vec4 ixy0 = permute(ixy + iz0);',
  'vec4 ixy1 = permute(ixy + iz1);',
'',
  'vec4 gx0 = ixy0 * (1.0 / 7.0);',
  'vec4 gy0 = fract(floor(gx0) * (1.0 / 7.0)) - 0.5;',
  'gx0 = fract(gx0);',
  'vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);',
  'vec4 sz0 = step(gz0, vec4(0.0));',
  'gx0 -= sz0 * (step(0.0, gx0) - 0.5);',
  'gy0 -= sz0 * (step(0.0, gy0) - 0.5);',
'',
  'vec4 gx1 = ixy1 * (1.0 / 7.0);',
  'vec4 gy1 = fract(floor(gx1) * (1.0 / 7.0)) - 0.5;',
  'gx1 = fract(gx1);',
  'vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);',
  'vec4 sz1 = step(gz1, vec4(0.0));',
  'gx1 -= sz1 * (step(0.0, gx1) - 0.5);',
  'gy1 -= sz1 * (step(0.0, gy1) - 0.5);',
'',
  'vec3 g000 = vec3(gx0.x,gy0.x,gz0.x);',
  'vec3 g100 = vec3(gx0.y,gy0.y,gz0.y);',
  'vec3 g010 = vec3(gx0.z,gy0.z,gz0.z);',
  'vec3 g110 = vec3(gx0.w,gy0.w,gz0.w);',
  'vec3 g001 = vec3(gx1.x,gy1.x,gz1.x);',
  'vec3 g101 = vec3(gx1.y,gy1.y,gz1.y);',
  'vec3 g011 = vec3(gx1.z,gy1.z,gz1.z);',
  'vec3 g111 = vec3(gx1.w,gy1.w,gz1.w);',
'',
  'vec4 norm0 = taylorInvSqrt(vec4(dot(g000, g000), dot(g010, g010), dot(g100, g100), dot(g110, g110)));',
  'g000 *= norm0.x;',
  'g010 *= norm0.y;',
  'g100 *= norm0.z;',
  'g110 *= norm0.w;',
  'vec4 norm1 = taylorInvSqrt(vec4(dot(g001, g001), dot(g011, g011), dot(g101, g101), dot(g111, g111)));',
  'g001 *= norm1.x;',
  'g011 *= norm1.y;',
  'g101 *= norm1.z;',
  'g111 *= norm1.w;',
'',
  'float n000 = dot(g000, Pf0);',
  'float n100 = dot(g100, vec3(Pf1.x, Pf0.yz));',
  'float n010 = dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z));',
  'float n110 = dot(g110, vec3(Pf1.xy, Pf0.z));',
  'float n001 = dot(g001, vec3(Pf0.xy, Pf1.z));',
  'float n101 = dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z));',
  'float n011 = dot(g011, vec3(Pf0.x, Pf1.yz));',
  'float n111 = dot(g111, Pf1);',
'',
  'vec3 fade_xyz = fade(Pf0);',
  'vec4 n_z = mix(vec4(n000, n100, n010, n110), vec4(n001, n101, n011, n111), fade_xyz.z);',
  'vec2 n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y);',
  'float n_xyz = mix(n_yz.x, n_yz.y, fade_xyz.x); ',
  'return 2.2 * n_xyz;',
'}\n',
                'uniform float amplitude;',

                'float turbulence( vec3 p ) {',
                  'float w = 100.0;',
                  'float t = -0.5;',


                  'for (float f = 1.0 ; f <= 10.0 ; f++ ){',
                    'float power = pow( 2.0, f );',
                    't += abs( pnoise( vec3( power * p ), vec3( 10.0, 10.0, 10.0 ) ) / power );',
                  '}',

                  'return t;',
                '}\n', 

                'void main() {',

                    'float noise = 2.0 * -0.20 * turbulence((normal+position) + amplitude);',
                    
                    'float b = 4.0 * pnoise( 0.001 * position, vec3 (1.0) );',

                    'float disp = -1.0 * noise + b;',
                    'vec3 newPosition = position + (normal+position) * (disp+0.04);',
                        
                    'vec4 mvPosition = modelViewMatrix * vec4( newPosition, 1.0 );',
                    'gl_Position = projectionMatrix * mvPosition;',
                '} '].join('\n'),

                fragmentShader: "\
                void main() {\
                    gl_FragColor = vec4(0.95, 0.28, 0.1, 1.0);\
                }\n ",

                blending: THREE.NoBlending,
                depthTest: true,
                transparent: true,
                vertexColors: true
    });

    var expl = new THREE.Mesh(blownBombGeometry, explosion_material);

    expl.position.copy(bomb.position);
    expl.position.z = -1; // display below other objects
    expl.rotation.x = Math.PI / 2;
    expl.uniforms = uniforms;
    expl.age = 0;

    explosions.push(expl);

    bomb.blown = true;

    scene.remove(bomb);
    scene.add(expl);

}

function move() {
    // no hero movement until we detect mouse movement
    if (lastMouseEvent === undefined)
        return;

    // convert mouse position into movement vector
    var mouseX = aspect * (2 * (lastMouseEvent.clientX / window.innerWidth) - 1);
    var mouseY = 2 * (lastMouseEvent.clientY / window.innerHeight) - 1;
    var movementVector = new THREE.Vector3(heroMovementSpeed * mouseX, heroMovementSpeed * mouseY, 0);
    hero.position.add(movementVector);
    hero.rotation.z = Math.atan2(movementVector.y, movementVector.x);

    // prevent going out of the room
    hero.position.x = Math.max(hero.position.x, -roomWidth / 2 + heroRadius);
    hero.position.x = Math.min(hero.position.x, roomWidth / 2 - heroRadius);
    hero.position.y = Math.max(hero.position.y, -roomHeight / 2 + heroRadius);
    hero.position.y = Math.min(hero.position.y, roomHeight / 2 - heroRadius);

    // center camera on hero
    camera.position.x = hero.position.x;
    camera.position.y = hero.position.y;

    // move enemies
    for (var i = 0; i < enemies.length; i++) {
        var enemy = enemies[i];
        var movementVector = new THREE.Vector3(hero.position.x - enemy.position.x, hero.position.y - enemy.position.y, 0);
        movementVector.multiplyScalar(enemy.speed);
        enemy.position.add(movementVector);
        enemy.rotation.z += 0.05;
        enemy.age += 1;
    }

    // just update age of bombs since they don't move
    for (var i = 0; i < bombs.length; i++) {
        bombs[i].age += 1;
    }
    for (var i = 0; i < explosions.length; i++) {
        explosions[i].age += 1;
    }
}

function spawn() {
    // add more enemies
    enemySpawnProbability = enemySpawnProbabilityMin + (timestep / enemySpawnTimesteps) * (1 - enemySpawnProbabilityMin)
    if (enemies.length < maxNumEnemies && Math.random() < enemySpawnProbability) {
        var enemy = createEnemy();
        scene.add(enemy);
        enemies.push(enemy);
    }

    // add more bombs
    if (bombs.length < maxNumBombs && Math.random() < bombSpawnProbability) {
        var bomb = createBomb();
        scene.add(bomb);
        bombs.push(bomb);
    }
}

function updateExplosions() {
    var survivors = [];
    for (var i = 0; i < explosions.length; i++) {
        var expl = explosions[i];
            // remove blown bombs that have reached lifespan
            if (expl.age > blownBombLifespan) {
                scene.remove(expl);
            } else {
                survivors.push(expl);
            }
    }
    explosions = survivors;
}

function retireBombs() {
    updateExplosions();

    var survivors = [];

    for (var i = 0; i < bombs.length; i++) {
        var bomb = bombs[i];
            // remove bombs that have reached lifespan
            if (bomb.age > bombLifespan) {
                scene.remove(bomb);
            } else if (!bomb.blown) {
                survivors.push(bomb);
                if (bomb.age > 0.8 * bombLifespan) {
                    // blink bombs that are about to disappear
                    if (Math.floor(timestep/Math.max(bomb.age - bombLifespan, 10)) % 2 == 0) {
                        bomb.material.color.setHex(0);
                    } else {
                        bomb.material.color.setHex(bombColor);
                    }
                }
            }
    }
    bombs = survivors;
}

function handleCollisions() {
    // update the hero polygon first
    heroPolygon.pos = new V(hero.position.x, hero.position.y);
    heroPolygon.setAngle(hero.rotation.z);

    // hero collision with bombs
    for (var i = 0; i < bombs.length; i++) {
        var bomb = bombs[i];
        if (!bomb.blown) {
            if (distance(hero.position, bomb.position) < heroRadius + bombRadius) {
                var bombCircle = new C(new V(bomb.position.x, bomb.position.y), bombRadius);
                var response = new SAT.Response();
                var collided = SAT.testPolygonCircle(heroPolygon, bombCircle, response);
                if (collided) {
                    blowUpBomb(bomb);
                }
            }
        }
    }

    // blown bomb collision with enemies
    for (var i = 0; i < explosions.length; i++) {
        var bomb = explosions[i];
            var newEnemies = [];
            for (var j = 0; j < enemies.length; j++) {
                var enemy = enemies[j];
                if (distance(bomb.position, enemy.position) < bombExplosionSize * bombRadius + enemyRadius) {
                    var enemyVertices = [];
                    enemyVertices.push(new V(enemy.geometry.vertices[0].x, enemy.geometry.vertices[0].y));
                    enemyVertices.push(new V(enemy.geometry.vertices[5].x, enemy.geometry.vertices[5].y));
                    enemyVertices.push(new V(enemy.geometry.vertices[7].x, enemy.geometry.vertices[7].y));
                    enemyVertices.push(new V(enemy.geometry.vertices[2].x, enemy.geometry.vertices[2].y));
                    var enemyPolygon = new P(new V(enemy.position.x, enemy.position.y), enemyVertices);
                    enemyPolygon.setAngle(enemy.rotation.z);
                    var bombCircle = new C(new V(bomb.position.x, bomb.position.y), bombExplosionSize * bombRadius);
                    var response = new SAT.Response();
                    var collided = SAT.testPolygonCircle(enemyPolygon, bombCircle, response);
                    if (collided) {
                        // enemy dead
                        scene.remove(enemy);

                        // compute new multiplier and update score
                        streakTimestep = timestep;
                        streakEnemyCounter += 1;
                        multiplier = 1 + Math.floor(streakEnemyCounter / streakEnemyMultiplierStepSize);
                        score += multiplier;
                        updateUI();
                    } else {
                        newEnemies.push(enemy);
                    }
                } else {
                    newEnemies.push(enemy);
                }
            }
            enemies = newEnemies;
    }

    // hero collision with enemies
    for (var i = 0; i < enemies.length; i++) {
        if (distance(hero.position, enemies[i].position) < heroRadius + enemyRadius) {
            var enemy = enemies[i];
            var enemyVertices = [];
            enemyVertices.push(new V(enemy.geometry.vertices[0].x, enemy.geometry.vertices[0].y));
            enemyVertices.push(new V(enemy.geometry.vertices[5].x, enemy.geometry.vertices[5].y));
            enemyVertices.push(new V(enemy.geometry.vertices[7].x, enemy.geometry.vertices[7].y));
            enemyVertices.push(new V(enemy.geometry.vertices[2].x, enemy.geometry.vertices[2].y));
            var enemyPolygon = new P(new V(enemy.position.x, enemy.position.y), enemyVertices);
            enemyPolygon.setAngle(enemy.rotation.z);
            var response = new SAT.Response();
            var collided = SAT.testPolygonPolygon(heroPolygon, enemyPolygon, response);
            if ( collided) {
                // dead
                isAlive = false;
                isPaused = true;
                document.getElementById("info-text").innerHTML = "=== GAME OVER ===";
                document.getElementById("more-info-text").innerHTML = "Press spacebar to continue.";

                // send to server and get new leaderboard
                var xhr = new XMLHttpRequest();
                xhr.open("POST", '/leaderboard', true);
                xhr.setRequestHeader('Content-Type', 'application/json');
                xhr.send(JSON.stringify({
                    playerName: playerName['Your Name'],
                    timestep: timestep,
                    multiplier: multiplier,
                    score: score,
                    enemySpawnProbability: enemySpawnProbability,
                    streakTimestep: streakTimestep,
                    streakEnemyCounter, streakEnemyCounter
                }));
                xhr.onreadystatechange = function () {
                    if(xhr.readyState === 4 && xhr.status === 200) {
                        leaderboard = JSON.parse(xhr.response);
                        updateLeaderboard();
                    }
                }
            }
        }
    }
}

function animate() {
    requestAnimationFrame(animate);

    stats.begin();
    if (!isPaused) {
        document.getElementById("info").style.display = "none";

        timestep += 1;

        animateBackground();

        let spawnRate = 4;
        for (let i = 0.0; i < spawnRate; i++) {
            particleSystem.spawnParticle();
        }

        particleSystem.update(timestep);

        // just update age of bombs since they don't move
        for (var i = 0; i < explosions.length; i++) {
            explosions[i].rotation.y += 0.01;
            explosions[i].uniforms.amplitude.value = timestep/100;
        }

        move();
        handleCollisions();
        retireBombs();
        spawn();

        outlinePass.selectedObjects = [hero].concat(enemies).concat(bombs);
        composer.render();

        if (timestep - streakTimestep > streakExpiration) {
            // end streak
            streakEnemyCounter = 0;
            multiplier = 1;
            updateUI();
            document.getElementById('multiplier').style.display = '';
        } else if (timestep - streakTimestep > 0.6 * streakExpiration) {
            // blink the multiplier if it is about to reset
            if (Math.floor(timestep/(10 + 10 * Math.floor((streakExpiration - (timestep - streakTimestep))/60))) % 2 == 0) {
                document.getElementById('multiplier').style.display = 'none';
            } else {
                document.getElementById('multiplier').style.display = '';
            }
        } else {
            document.getElementById('multiplier').style.display = '';
        }
    } else {
        document.getElementById("info").style.display = '';
        pauseTimestep += 1;
    }
    stats.end();
};

init();
animate();



// class perlin noise
