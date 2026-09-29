import * as THREE from 'three';

// ================================================================
// KONFIGURACJA PLANSZ
// ================================================================
const WORLDS = {
  beginner: {
    name: 'ŁATWA — cinewhoop (nauka)',
    skyTop: 0x4a90e2,
    skyBottom: 0xc9e4ff,
    fogNear: 100,
    fogFar: 700,
    gravity: -7.5,
    thrustFactor: 14,
    pitchRollGain: 0.55,       // ← zwiększone (dron szybciej się rozpędza)
    yawRate: 1.8,
    visualTilt: 0.20,
    drag: 0.993,               // ← dużo bliżej 1.0 — mały opór
    maxSpeed: 14,              // 50 km/h
    maxAltitude: 120,
    droneStart: { x: 0, y: 8, z: 0 },
    // reszta bez zmian
    trees: [
      [15,-10,1.2],[-20,20,1.0],[30,30,1.5],[-10,-30,1.1],
      [40,-40,1.3],[-40,40,0.9],[5,50,1.2]
    ],
    gates: [
      [0, 3, -15, 0],
      [20, 4, -35, Math.PI/4]
    ],
    boxes: [
      [0, -25, 6, 1.5, 6, 0xff4444],
      [-15, 0, 8, 1, 8, 0xffcc00]
    ],
    hills: [
      [-60, 0, -80, 30, 0.5]
    ],
    water: { x: 80, z: 60, w: 120, d: 90 }
  },

  intermediate: {
    name: 'ŚREDNIA — dron filmowy',
    skyTop: 0x3a7ac2,
    skyBottom: 0xa8d0e8,
    fogNear: 80,
    fogFar: 500,
    gravity: -9.0,
    thrustFactor: 22,
    pitchRollGain: 1.10,       // ← zwiększone z 0.65
    yawRate: 2.8,
    visualTilt: 0.35,
    drag: 0.988,               // ← zwiększone z 0.965
    maxSpeed: 25,              // 90 km/h
    maxAltitude: 180,
    droneStart: { x: 0, y: 6, z: 20 },
    // reszta bez zmian
    trees: [
      [10,-10,1.3],[-15,15,1.1],[25,25,1.6],[-8,-25,1.2],
      [35,-35,1.4],[-35,35,1.0],[5,45,1.3],[-45,-15,1.4],
      [50,10,1.1],[-60,25,1.2],[20,-55,1.3],[-25,-60,1.1],
      [55,-25,1.5],[-10,60,1.2],[70,40,1.3]
    ],
    gates: [
      [0, 4, -20, 0],
      [25, 5, -45, Math.PI/3],
      [-30, 6, -60, -Math.PI/4],
      [50, 7, -75, Math.PI/6],
      [-15, 8, -100, -Math.PI/3],
      [35, 5, -120, 0]
    ],
    boxes: [
      [0, -30, 5, 2, 5, 0xff4444],
      [-20, 5, 7, 1.2, 7, 0xffcc00],
      [30, -10, 4, 3, 4, 0xcc44ff],
      [-35, -20, 9, 0.6, 9, 0x44ffff],
      [55, -25, 6, 2.5, 6, 0xff8800]
    ],
    hills: [
      [-70, 0, -90, 35, 0.5],
      [90, 0, -110, 30, 0.6]
    ],
    water: { x: 80, z: 70, w: 140, d: 100 }
  },

  expert: {
    name: 'EKSPERT — wyścigowy FPV',
    skyTop: 0x2a5a92,
    skyBottom: 0x7a9ab8,
    fogNear: 50,
    fogFar: 400,
    gravity: -9.81,
    thrustFactor: 45,
    pitchRollGain: 2.20,       // ← DUŻO zwiększone z 1.30
    yawRate: 4.5,
    visualTilt: 0.55,
    drag: 0.994,               // ← DUŻO bliżej 1.0
    maxSpeed: 50,              // ← 180 km/h — realny racer w nurkowaniu
    maxAltitude: 300,
    droneStart: { x: 0, y: 4, z: 30 },
    // reszta bez zmian
    trees: [
      [8,-8,1.4],[-12,12,1.2],[22,22,1.7],[-6,-22,1.3],
      [30,-30,1.5],[-30,30,1.1],[4,40,1.4],[-40,-12,1.5],
      [45,8,1.2],[-55,22,1.3],[18,-50,1.4],[-22,-55,1.2],
      [50,-22,1.6],[-8,55,1.3],[65,35,1.4],[12,70,1.5],
      [-70,45,1.1],[75,-45,1.3],[-45,-70,1.4],[85,15,1.2]
    ],
    gates: [
      [0, 3, -15, 0],
      [20, 4, -35, Math.PI/4],
      [-25, 5, -50, -Math.PI/3],
      [40, 6, -65, Math.PI/6],
      [-10, 7, -90, -Math.PI/4],
      [30, 4, -110, 0],
      [-40, 5, -130, Math.PI/3],
      [50, 3, -150, -Math.PI/6],
      [-20, 4, -170, 0],
      [15, 5, -190, Math.PI/4]
    ],
    boxes: [
      [0, -25, 4, 2, 4, 0xff4444],
      [-15, 5, 6, 1, 6, 0xffcc00],
      [25, -8, 3, 3, 3, 0xcc44ff],
      [-25, -18, 8, 0.5, 8, 0x44ffff],
      [45, -22, 5, 2.5, 5, 0xff8800],
      [-50, 15, 4, 4, 4, 0x00ccff],
      [60, 5, 3, 5, 3, 0xff00ff],
      [-35, -40, 7, 1, 7, 0x00ff88]
    ],
    hills: [
      [-80, 0, -100, 40, 0.5],
      [100, 0, -120, 35, 0.6],
      [-50, 0, -200, 45, 0.7]
    ],
    water: { x: 90, z: 80, w: 180, d: 130 }
  }
};
// ================================================================
// SYMULATOR
// ================================================================
window.startSimulator = function(worldKey) {
  const cfg = WORLDS[worldKey] || WORLDS.beginner;
  console.log('🚁 Start symulatora —', cfg.name);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(cfg.skyBottom, cfg.fogNear, cfg.fogFar);

  const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 2000);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);

  // --- Światło ---
  const sun = new THREE.DirectionalLight(0xffffff, 1.2);
  sun.position.set(80, 150, 60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -200;
  sun.shadow.camera.right = 200;
  sun.shadow.camera.top = 200;
  sun.shadow.camera.bottom = -200;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 400;
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0x8899aa, 0.7));

  // --- Niebo ---
  const skyGeo = new THREE.SphereGeometry(800, 32, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      top:    { value: new THREE.Color(cfg.skyTop) },
      bottom: { value: new THREE.Color(cfg.skyBottom) }
    },
    vertexShader: `varying vec3 vPos; void main() { vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform vec3 top; uniform vec3 bottom; varying vec3 vPos;
      void main() { float h = normalize(vPos).y * 0.5 + 0.5; gl_FragColor = vec4(mix(bottom, top, h), 1.0); }`
  });
  scene.add(new THREE.Mesh(skyGeo, skyMat));

  // --- Ziemia ---
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(2000, 2000),
    new THREE.MeshLambertMaterial({ color: 0x3a7d2c })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const grid = new THREE.GridHelper(2000, 200, 0x2d5a1e, 0x2d5a1e);
  grid.position.y = 0.01;
  grid.material.opacity = 0.3;
  grid.material.transparent = true;
  scene.add(grid);

  // --- Górki ---
  cfg.hills.forEach(h => {
    const hillGeo = new THREE.SphereGeometry(h[3], 24, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const hill = new THREE.Mesh(hillGeo, new THREE.MeshLambertMaterial({ color: 0x2d5a1e }));
    hill.position.set(h[0], h[1], h[2]);
    hill.scale.set(1, h[4], 1);
    hill.castShadow = true;
    hill.receiveShadow = true;
    scene.add(hill);
  });

  // --- Woda ---
  if (cfg.water) {
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(cfg.water.w, cfg.water.d, 20, 20),
      new THREE.MeshPhongMaterial({ color: 0x1e5b8a, transparent: true, opacity: 0.85, shininess: 100, specular: 0x88ccff })
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(cfg.water.x, 0.15, cfg.water.z);
    water.receiveShadow = true;
    scene.add(water);
  }

  // --- Drzewa ---
  function makeTree(x, z, scale) {
    const group = new THREE.Group();
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5 * scale, 0.7 * scale, 4 * scale, 8),
      new THREE.MeshLambertMaterial({ color: 0x5c3a1e })
    );
    trunk.position.y = 2 * scale; trunk.castShadow = true; group.add(trunk);

    const c1 = new THREE.Mesh(new THREE.SphereGeometry(2.5 * scale, 10, 8), new THREE.MeshLambertMaterial({ color: 0x2a5a1a }));
    c1.position.y = 5 * scale; c1.castShadow = true; group.add(c1);

    const c2 = new THREE.Mesh(new THREE.SphereGeometry(1.8 * scale, 8, 6), new THREE.MeshLambertMaterial({ color: 0x356b22 }));
    c2.position.y = 6.5 * scale; c2.castShadow = true; group.add(c2);

    group.position.set(x, 0, z);
    return group;
  }
  cfg.trees.forEach(t => scene.add(makeTree(t[0], t[1], t[2])));

  // --- Przeszkody ---
  function makeBox(x, z, w, h, d, color) {
    const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color }));
    box.position.set(x, h / 2, z);
    box.castShadow = true; box.receiveShadow = true;
    scene.add(box);
  }
  cfg.boxes.forEach(b => makeBox(b[0], b[1], b[2], b[3], b[4], b[5]));

  // --- Bramki ---
  function makeGate(x, y, z, rotY) {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3, 0.3, 8, 24), new THREE.MeshLambertMaterial({ color: 0xff0066 }));
    ring.castShadow = true;
    g.add(ring);
    g.position.set(x, y, z); g.rotation.y = rotY;
    scene.add(g);
  }
  cfg.gates.forEach(g => makeGate(g[0], g[1], g[2], g[3]));

  // --- DRON ---
  const drone = {
    pos: new THREE.Vector3(cfg.droneStart.x, cfg.droneStart.y, cfg.droneStart.z),
    vel: new THREE.Vector3(0, 0, 0),
    yaw: 0, pitch: 0, roll: 0
  };

  const PHYS = {
    gravity: cfg.gravity,
    thrustFactor: cfg.thrustFactor,
    drag: cfg.drag,
    pitchRollGain: cfg.pitchRollGain,
    yawRate: cfg.yawRate,
    visualTilt: cfg.visualTilt,
    maxAltitude: cfg.maxAltitude,
    maxSpeed: cfg.maxSpeed,
    groundLevel: 0.5
  };

  let prevTime = performance.now();

  function animate() {
    requestAnimationFrame(animate);
    const now = performance.now();
    const dt = Math.min((now - prevTime) / 1000, 0.05);
    prevTime = now;

    const inp = window.padData.input;
    const throttle01 = (inp.throttle + 1) / 2;
    const thrust = throttle01 * PHYS.thrustFactor;

    drone.vel.y += PHYS.gravity * dt;
    drone.vel.y += thrust * Math.cos(drone.pitch) * Math.cos(drone.roll) * dt;

    const gain = PHYS.pitchRollGain * thrust;
    drone.vel.x += Math.sin(drone.yaw) * (-inp.pitch) * gain * dt;
    drone.vel.z += Math.cos(drone.yaw) * (-inp.pitch) * gain * dt;
    drone.vel.x += Math.cos(drone.yaw) * inp.roll * gain * dt;
    drone.vel.z += -Math.sin(drone.yaw) * inp.roll * gain * dt;

    drone.vel.multiplyScalar(PHYS.drag);
    drone.yaw += inp.yaw * PHYS.yawRate * dt;
    drone.pitch = -inp.pitch * PHYS.visualTilt;
    drone.roll  =  inp.roll  * PHYS.visualTilt;
    drone.pos.addScaledVector(drone.vel, dt);

    // Limit prędkości poziomej — zależny od planszy
    const horizontalSpeed = Math.sqrt(drone.vel.x * drone.vel.x + drone.vel.z * drone.vel.z);
    if (horizontalSpeed > PHYS.maxSpeed) {
      const scale = PHYS.maxSpeed / horizontalSpeed;
      drone.vel.x *= scale;
      drone.vel.z *= scale;
    }

    // Kolizja z ziemią
    if (drone.pos.y < PHYS.groundLevel) {
      drone.pos.y = PHYS.groundLevel;
      if (drone.vel.y < 0) drone.vel.y = 0;
      drone.vel.x *= 0.85; drone.vel.z *= 0.85;
    }
    // Sufit
    if (drone.pos.y > PHYS.maxAltitude) {
      drone.pos.y = PHYS.maxAltitude;
      if (drone.vel.y > 0) drone.vel.y = 0;
    }

    camera.position.copy(drone.pos);
    camera.rotation.order = 'YXZ';
    camera.rotation.y = drone.yaw;
    camera.rotation.x = drone.pitch;
    camera.rotation.z = drone.roll;

    document.getElementById('thr').textContent = inp.throttle.toFixed(2);
    document.getElementById('yaw').textContent = inp.yaw.toFixed(2);
    document.getElementById('rol').textContent = inp.roll.toFixed(2);
    document.getElementById('pit').textContent = inp.pitch.toFixed(2);
    document.getElementById('alt').textContent = drone.pos.y.toFixed(1);
    document.getElementById('spd').textContent = drone.vel.length().toFixed(1);

    renderer.render(scene, camera);
  }

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  animate();
};
