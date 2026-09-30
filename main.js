import * as THREE from 'three';
import { t } from './i18n/index.js';
import { CollisionSystem } from './modules/collisions.js';
import { GateTracker }    from './modules/gates.js';
import { MotorAudio }     from './modules/audio.js';

// ================================================================
// KONFIGURACJA PLANSZ
// ================================================================
const WORLDS = {
  beginner: {
    name: 'ŁATWA — cinewhoop (nauka)',
    physicsMode: 'arcade',
    cameraAngle: 0,
    skyTop: 0x4a90e2,
    skyBottom: 0xc9e4ff,
    fogNear: 100,
    fogFar: 700,
    gravity: -7.5,
    thrustFactor: 14,
    pitchRollGain: 0.55,
    yawRate: 1.8,
    visualTilt: 0.20,
    drag: 0.993,
    maxSpeed: 14,
    maxAltitude: 120,
    throttleHover: 0.5,
    droneStart: { x: 0, y: 8, z: 0 },
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
    physicsMode: 'arcade',
    cameraAngle: 0,
    skyTop: 0x3a7ac2,
    skyBottom: 0xa8d0e8,
    fogNear: 80,
    fogFar: 500,
    gravity: -9.0,
    thrustFactor: 22,
    pitchRollGain: 1.10,
    yawRate: 2.8,
    visualTilt: 0.35,
    drag: 0.988,
    maxSpeed: 25,
    maxAltitude: 180,
    throttleHover: 0.5,
    droneStart: { x: 0, y: 6, z: 20 },
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
    name: 'EKSPERT — wyścigowy FPV (realistyczna fizyka)',
    physicsMode: 'realistic',
    cameraAngle: 20,
    skyTop: 0x2a5a92,
    skyBottom: 0x7a9ab8,
    fogNear: 50,
    fogFar: 400,
    gravity: -9.81,
    hoverThrottle: 0.5,
    thrustFactor: 45,
    pitchRollRate: 2.8,
    yawRate: 3.0,
    angularInertia: 0.94,
    angularDamping: 8.0,
    airDrag: 0.10,
    airDragQuadratic: 0.010,
    maxTiltAngle: Math.PI / 3,
    maxSpeed: 50,
    maxAltitude: 300,
    droneStart: { x: 0, y: 4, z: 30 },
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
  },

  expert_race: {
    name: 'RACE — wyścigowy (45° kamera, zero inercji)',
    physicsMode: 'realistic',
    cameraAngle: 45,
    cameraAngles: [20, 35, 45],
    skyTop: 0x1a2a52,
    skyBottom: 0x6a8aa8,
    fogNear: 40,
    fogFar: 350,
    gravity: -9.81,
    hoverThrottle: 0.5,
    thrustFactor: 50,
    pitchRollRate: 5.0,
    yawRate: 5.0,
    angularInertia: 1.0,
    angularDamping: 20.0,
    airDrag: 0.08,
    airDragQuadratic: 0.008,
    maxTiltAngle: Math.PI / 3,
    maxSpeed: 60,
    maxAltitude: 300,
    droneStart: { x: 0, y: 3, z: 20 },
    trees: [
      [15, -5, 1.2], [-18, 10, 1.3], [25, 20, 1.4], [-10, -20, 1.1],
      [35, -30, 1.3], [-30, 25, 1.2], [8, 35, 1.3], [-40, -10, 1.4],
      [45, 5, 1.2], [-50, 20, 1.3], [20, -45, 1.3], [-25, -50, 1.2]
    ],
    gates: [
      [0, 2, -10, 0],
      [8, 3, -22, Math.PI / 6],
      [-6, 4, -35, -Math.PI / 4],
      [15, 5, -48, Math.PI / 3],
      [-12, 3, -62, -Math.PI / 6],
      [20, 6, -75, Math.PI / 4],
      [-8, 4, -90, 0],
      [25, 3, -105, -Math.PI / 3],
      [-15, 5, -120, Math.PI / 6],
      [18, 4, -135, 0],
      [-10, 3, -150, Math.PI / 4],
      [5, 2, -165, 0]
    ],
    boxes: [
      [0, -18, 3, 2, 3, 0xff4444],
      [-12, 8, 5, 1, 5, 0xffcc00],
      [18, -5, 3, 3, 3, 0xcc44ff],
      [-20, -15, 6, 0.5, 6, 0x44ffff],
      [30, -20, 4, 2, 4, 0xff8800],
      [-35, 12, 3, 4, 3, 0x00ccff]
    ],
    hills: [
      [-70, 0, -80, 30, 0.5],
      [90, 0, -100, 30, 0.5]
    ],
    water: { x: 70, z: 50, w: 100, d: 80 }
  }
};

let simState = null;

// ================================================================
// AUDIO — singleton (F4)
// ================================================================
const motorAudio = new MotorAudio({
  baseFreq: 60,
  maxFreq: 280,
  baseGain: 0.02,
  maxGain: 0.14,
  baseCutoff: 400,
  maxCutoff: 2800
});

// Init audio przy pierwszej interakcji użytkownika (autoplay policy)
let __audioInitOnce = false;
async function ensureAudioInit() {
  if (__audioInitOnce) return;
  __audioInitOnce = true;
  try { await motorAudio.init(); } catch (e) { console.warn('[audio] init failed', e); }
}
document.addEventListener('pointerdown', ensureAudioInit, { once: true });
document.addEventListener('keydown',     ensureAudioInit, { once: true });

// Przycisk mute
(function setupMuteButton() {
  const btn = document.getElementById('mute-btn');
  if (!btn) return;
  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    await ensureAudioInit();
    const muted = !motorAudio.muted;
    motorAudio.setMuted(muted);
    btn.textContent = muted ? '🔇' : '🔊';
  });
})();

// ================================================================
// SYMULATOR
// ================================================================
window.startSimulator = function(worldKey) {
  const cfg = WORLDS[worldKey] || WORLDS.beginner;
  console.log('🚁 Start symulatora —', cfg.name, '| fizyka:', cfg.physicsMode, '| kamera:', cfg.cameraAngle + '°');

  if (simState) {
    window.stopSimulator();
  }

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(cfg.skyBottom, cfg.fogNear, cfg.fogFar);

  const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 2000);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);

  const disposables = { geometries: [], materials: [], textures: [] };
  const track = (obj) => {
    if (obj.geometry) disposables.geometries.push(obj.geometry);
    if (obj.material) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach(m => {
        disposables.materials.push(m);
        for (const k in m) {
          if (m[k] && m[k].isTexture) disposables.textures.push(m[k]);
        }
      });
    }
  };

  const collisions = new CollisionSystem();

  // ─── Światło ───
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

  // ─── Niebo ───
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
  const skyMesh = new THREE.Mesh(skyGeo, skyMat);
  scene.add(skyMesh);
  track(skyMesh);

  // ─── Ziemia ───
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(2000, 2000),
    new THREE.MeshLambertMaterial({ color: 0x3a7d2c })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  track(ground);

  const grid = new THREE.GridHelper(2000, 200, 0x2d5a1e, 0x2d5a1e);
  grid.position.y = 0.01;
  grid.material.opacity = 0.3;
  grid.material.transparent = true;
  scene.add(grid);
  track(grid);

  // ─── Górki ───
  cfg.hills.forEach(h => {
    const hillGeo = new THREE.SphereGeometry(h[3], 24, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const hill = new THREE.Mesh(hillGeo, new THREE.MeshLambertMaterial({ color: 0x2d5a1e }));
    hill.position.set(h[0], h[1], h[2]);
    hill.scale.set(1, h[4], 1);
    hill.castShadow = true;
    hill.receiveShadow = true;
    scene.add(hill);
    track(hill);

    const hillRadius = h[3];
    const hillHeight = h[3] * h[4];
    collisions.addBox(
      new THREE.Vector3(h[0] - hillRadius, h[1], h[2] - hillRadius),
      new THREE.Vector3(h[0] + hillRadius, h[1] + hillHeight, h[2] + hillRadius),
      { kind: 'hill' }
    );
  });

  // ─── Woda ───
  if (cfg.water) {
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(cfg.water.w, cfg.water.d, 20, 20),
      new THREE.MeshPhongMaterial({ color: 0x1e5b8a, transparent: true, opacity: 0.85, shininess: 100, specular: 0x88ccff })
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(cfg.water.x, 0.15, cfg.water.z);
    water.receiveShadow = true;
    scene.add(water);
    track(water);
  }

  // ─── Drzewa ───
  function makeTree(x, z, scale) {
    const group = new THREE.Group();
    const trunkGeo = new THREE.CylinderGeometry(0.5 * scale, 0.7 * scale, 4 * scale, 8);
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x5c3a1e });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 2 * scale; trunk.castShadow = true; group.add(trunk);
    disposables.geometries.push(trunkGeo);
    disposables.materials.push(trunkMat);

    const c1Geo = new THREE.SphereGeometry(2.5 * scale, 10, 8);
    const c1Mat = new THREE.MeshLambertMaterial({ color: 0x2a5a1a });
    const c1 = new THREE.Mesh(c1Geo, c1Mat);
    c1.position.y = 5 * scale; c1.castShadow = true; group.add(c1);
    disposables.geometries.push(c1Geo);
    disposables.materials.push(c1Mat);

    const c2Geo = new THREE.SphereGeometry(1.8 * scale, 8, 6);
    const c2Mat = new THREE.MeshLambertMaterial({ color: 0x356b22 });
    const c2 = new THREE.Mesh(c2Geo, c2Mat);
    c2.position.y = 6.5 * scale; c2.castShadow = true; group.add(c2);
    disposables.geometries.push(c2Geo);
    disposables.materials.push(c2Mat);

    group.position.set(x, 0, z);

    collisions.addSphere(
      new THREE.Vector3(x, 5 * scale, z),
      2.5 * scale,
      { kind: 'tree' }
    );

    return group;
  }
  cfg.trees.forEach(t => scene.add(makeTree(t[0], t[1], t[2])));

  // ─── Przeszkody ───
  function makeBox(x, z, w, h, d, color) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mat = new THREE.MeshLambertMaterial({ color });
    const box = new THREE.Mesh(geo, mat);
    box.position.set(x, h / 2, z);
    box.castShadow = true; box.receiveShadow = true;
    scene.add(box);
    disposables.geometries.push(geo);
    disposables.materials.push(mat);

    collisions.addBox(
      new THREE.Vector3(x - w/2, 0, z - d/2),
      new THREE.Vector3(x + w/2, h, z + d/2),
      { kind: 'box', color }
    );
  }
  cfg.boxes.forEach(b => makeBox(b[0], b[1], b[2], b[3], b[4], b[5]));

  // ─── Bramki (F1 — zbieramy meshe do gateMeshes) ───
  const gateMeshes = [];
  function makeGate(x, y, z, rotY) {
    const g = new THREE.Group();
    const geo = new THREE.TorusGeometry(3, 0.3, 8, 24);
    const mat = new THREE.MeshLambertMaterial({ color: 0xff0066 });
    const ring = new THREE.Mesh(geo, mat);
    ring.castShadow = true;
    g.add(ring);
    g.position.set(x, y, z); g.rotation.y = rotY;
    scene.add(g);
    disposables.geometries.push(geo);
    disposables.materials.push(mat);

    // Metadane dla GateTracker — promień 3, grubość 0.3 (TorusGeometry)
    g.userData.isGate = true;
    gateMeshes.push(g);
  }
  cfg.gates.forEach(g => makeGate(g[0], g[1], g[2], g[3]));

  // ─── F1: GateTracker ───
  let gateTracker = new GateTracker(gateMeshes, {
    droneRadius: 0.6,        // promień drona dla detekcji przejścia
    ringRadius: 3.0,         // TorusGeometry(3, 0.3) → R=3
    ringThickness: 0.3,      // grubość obręczy
    restitution: 0.45,
    passCooldownMs: 600
  });

  const gateCounterEl = document.getElementById('gate-counter');
  const gateTimerEl   = document.getElementById('gate-timer');

  function formatTime(ms) {
    const total = Math.max(0, ms | 0);
    const m = Math.floor(total / 60000);
    const s = Math.floor((total % 60000) / 1000);
    const mm = total % 1000;
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(mm).padStart(3,'0')}`;
  }

  gateTracker.onProgress = ({ passed, total, timeMs, finished }) => {
    if (!gateCounterEl || !gateTimerEl) return;
    const gateLabel = (t && typeof t === 'function' && t('hud.gates')) || 'Gates';
    gateCounterEl.textContent = `${gateLabel}: ${passed}/${total}`;
    gateTimerEl.textContent = formatTime(timeMs);
    gateCounterEl.classList.toggle('finished', !!finished);
    gateTimerEl.classList.toggle('finished', !!finished);
  };

  gateTracker.onGatePassed = () => {
    motorAudio.beep(880, 0.12, 0.09);
  };

  gateTracker.onGateHit = () => {
    motorAudio.thud();
  };

  // Pierwszy render HUD
  gateTracker._emitProgress();

  // ─── DRON ───
  const drone = {
    pos: new THREE.Vector3(cfg.droneStart.x, cfg.droneStart.y, cfg.droneStart.z),
    vel: new THREE.Vector3(0, 0, 0),
    yaw: 0, pitch: 0, roll: 0,
    targetPitch: 0, targetRoll: 0,
    yawRate: 0, pitchRate: 0, rollRate: 0
  };

  const PHYS = {
    mode: cfg.physicsMode,
    gravity: cfg.gravity,
    thrustFactor: cfg.thrustFactor,
    pitchRollGain: cfg.pitchRollGain,
    yawRateArcade: cfg.yawRate,
    visualTilt: cfg.visualTilt,
    drag: cfg.drag,
    throttleHover: cfg.throttleHover,
    hoverThrottle: cfg.hoverThrottle,
    pitchRollRate: cfg.pitchRollRate,
    yawRateReal: cfg.yawRate,
    angularInertia: cfg.angularInertia,
    angularDamping: cfg.angularDamping,
    airDrag: cfg.airDrag,
    airDragQuadratic: cfg.airDragQuadratic,
    maxTiltAngle: cfg.maxTiltAngle,
    maxAltitude: cfg.maxAltitude,
    maxSpeed: cfg.maxSpeed,
    groundLevel: 0.5
  };

  let prevTime = performance.now();
  let rafId = null;
  let pausedByKey = false;
  let pausedByDisconnect = false;
  let crosshairVisible = false;

  let cameraAngleDeg = cfg.cameraAngle || 0;
  let cameraAngleRad = cameraAngleDeg * Math.PI / 180;

  const cameraAnglesList = cfg.cameraAngles || [0, 20, 35];
  let cameraAngleIndex = cameraAnglesList.indexOf(cameraAngleDeg);
  if (cameraAngleIndex < 0) cameraAngleIndex = 0;

  const camEl = document.getElementById('camAngle');
  if (camEl) camEl.textContent = cameraAngleDeg + '°';

  window.onCameraAngleChange = (angleDeg) => {
    cameraAngleDeg = angleDeg;
    cameraAngleRad = angleDeg * Math.PI / 180;
  };

  window.setCameraAngle = (angleDeg) => {
    cameraAngleDeg = angleDeg;
    cameraAngleRad = angleDeg * Math.PI / 180;
  };

  window.cycleCameraAngle = function() {
    cameraAngleIndex = (cameraAngleIndex + 1) % cameraAnglesList.length;
    const angle = cameraAnglesList[cameraAngleIndex];
    cameraAngleDeg = angle;
    cameraAngleRad = angle * Math.PI / 180;

    const camElLocal = document.getElementById('camAngle');
    if (camElLocal) camElLocal.textContent = angle + '°';

    console.log(`📷 Kąt kamery (${worldKey}): ${angle}°`);
  };

  window.padData.onDisconnect = () => {
    pausedByDisconnect = true;
  };
  window.padData.onReconnect = () => {
    pausedByDisconnect = false;
    prevTime = performance.now();
  };

  function triggerCollisionFlash() {
    const hud = document.getElementById('hud');
    if (hud) {
      hud.classList.add('collision');
      setTimeout(() => hud.classList.remove('collision'), 300);
    }
  }

  const onKeyDown = (e) => {
    if (e.code === 'KeyP' || e.key === 'p' || e.key === 'P') {
      e.preventDefault();
      pausedByKey = !pausedByKey;
      const pauseEl = document.getElementById('pauseIndicator');
      if (pauseEl) pauseEl.classList.toggle('hidden', !pausedByKey);
      if (!pausedByKey) prevTime = performance.now();
      return;
    }
    if (e.code === 'Space') {
      e.preventDefault();
      crosshairVisible = !crosshairVisible;
      const ch = document.getElementById('crosshair');
      if (ch) ch.classList.toggle('hidden', !crosshairVisible);
      return;
    }
    if (e.code === 'KeyK' || e.key === 'k' || e.key === 'K') {
      e.preventDefault();
      if (window.cycleCameraAngle) window.cycleCameraAngle();
      return;
    }
    // F4 — mute toggle
    if (e.code === 'KeyM' || e.key === 'm' || e.key === 'M') {
      e.preventDefault();
      const muted = !motorAudio.muted;
      motorAudio.setMuted(muted);
      const btn = document.getElementById('mute-btn');
      if (btn) btn.textContent = muted ? '🔇' : '🔊';
      return;
    }
  };

  addEventListener('keydown', onKeyDown);

  // ================================================================
  // FIZYKA — ARCADE
  // ================================================================
  function stepPhysicsArcade(dt, inp) {
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
    drone.yaw += inp.yaw * PHYS.yawRateArcade * dt;
    drone.pitch = -inp.pitch * PHYS.visualTilt;
    drone.roll  =  inp.roll  * PHYS.visualTilt;
  }

  // ================================================================
  // FIZYKA — REALISTIC (expert + RACE)
  // ================================================================
  function stepPhysicsRealistic(dt, inp) {
    drone.targetPitch = -inp.pitch * PHYS.maxTiltAngle;
    drone.targetRoll  =  inp.roll  * PHYS.maxTiltAngle;

    const targetYawRate = inp.yaw * PHYS.yawRateReal;
    drone.yawRate += (targetYawRate - drone.yawRate) * PHYS.angularDamping * dt;
    drone.yaw += drone.yawRate * dt;

    if (PHYS.angularInertia >= 0.999) {
      drone.pitch = drone.targetPitch;
      drone.roll  = drone.targetRoll;
    } else {
      const pitchError = drone.targetPitch - drone.pitch;
      const rollError  = drone.targetRoll  - drone.roll;

      drone.pitchRate += pitchError * PHYS.pitchRollRate * 8 * dt;
      drone.rollRate  += rollError  * PHYS.pitchRollRate * 8 * dt;

      const damping = PHYS.angularDamping * dt;
      drone.pitchRate *= Math.max(0, 1 - damping);
      drone.rollRate  *= Math.max(0, 1 - damping);

      drone.pitch += drone.pitchRate * dt;
      drone.roll  += drone.rollRate  * dt;
    }

    const throttle01 = (inp.throttle + 1) / 2;
    const hoverRatio = throttle01 / PHYS.hoverThrottle;
    const clampedHoverRatio = Math.max(0, Math.min(2.0, hoverRatio));
    const thrust = clampedHoverRatio * (-PHYS.gravity);

    const cy = Math.cos(drone.yaw),  sy = Math.sin(drone.yaw);
    const cp = Math.cos(drone.pitch), sp = Math.sin(drone.pitch);
    const cr = Math.cos(drone.roll),  sr = Math.sin(drone.roll);

    const upX = sy * sp * cr + cy * sr;
    const upY = cp * cr;
    const upZ = cy * sp * cr - sy * sr;

    drone.vel.x += upX * thrust * dt;
    drone.vel.y += upY * thrust * dt;
    drone.vel.z += upZ * thrust * dt;

    drone.vel.y += PHYS.gravity * dt;

    const speed = drone.vel.length();
    if (speed > 0.001) {
      const dragLinear = PHYS.airDrag * speed;
      const dragQuadratic = PHYS.airDragQuadratic * speed * speed;
      const totalDrag = dragLinear + dragQuadratic;

      drone.vel.x -= (drone.vel.x / speed) * totalDrag * dt;
      drone.vel.y -= (drone.vel.y / speed) * totalDrag * dt;
      drone.vel.z -= (drone.vel.z / speed) * totalDrag * dt;
    }
  }

  // ================================================================
  // GŁÓWNA PĘTLA
  // ================================================================
  function animate() {
    rafId = requestAnimationFrame(animate);

    const now = performance.now();
    const dt = Math.min((now - prevTime) / 1000, 0.05);
    prevTime = now;

    const isPaused = pausedByKey || pausedByDisconnect;
    if (isPaused) {
      // F4 — cisza przy pauzie
      motorAudio.update(0, false, true);
      renderer.render(scene, camera);
      return;
    }

    const inp = window.padData.input;

    if (PHYS.mode === 'realistic') {
      stepPhysicsRealistic(dt, inp);
    } else {
      stepPhysicsArcade(dt, inp);
    }

    drone.pos.addScaledVector(drone.vel, dt);

    // ─── KOLIZJE (drzewa / boxy / górki) ───
    const collisionsEnabled = (worldKey === 'expert' || worldKey === 'expert_race')
      ? true
      : (window.__collisionsEnabled !== false);

    if (collisionsEnabled) {
      const collision = collisions.check(drone.pos, 0.5);

      if (collision) {
        drone.vel.copy(collisions.reflect(drone.vel, collision.normal, 0.4));
        drone.pos.addScaledVector(collision.normal, collision.depth + 0.01);
        triggerCollisionFlash();

        if (collision.obj.meta && collision.obj.meta.kind) {
          console.log('💥 Kolizja:', collision.obj.meta.kind);
        }
      }
    }

    // ─── F1: BRAMKI (przejście + kolizja z obręczą) ───
    if (gateTracker) {
      const gateHits = gateTracker.update(drone.pos, dt, now);
      if (collisionsEnabled && gateHits.length) {
        for (const hit of gateHits) {
          // Odbicie B — jak w systemie kolizji
          drone.vel.copy(collisions.reflect(drone.vel, hit.normal, hit.restitution));
          drone.pos.addScaledVector(hit.normal, hit.penetration + 0.01);
        }
        triggerCollisionFlash();
      }
    }

    const horizontalSpeed = Math.sqrt(drone.vel.x * drone.vel.x + drone.vel.z * drone.vel.z);
    if (horizontalSpeed > PHYS.maxSpeed) {
      const scale = PHYS.maxSpeed / horizontalSpeed;
      drone.vel.x *= scale;
      drone.vel.z *= scale;
    }

    if (drone.pos.y < PHYS.groundLevel) {
      drone.pos.y = PHYS.groundLevel;
      if (drone.vel.y < 0) drone.vel.y = 0;
      drone.vel.x *= 0.85; drone.vel.z *= 0.85;
    }

    if (drone.pos.y > PHYS.maxAltitude) {
      drone.pos.y = PHYS.maxAltitude;
      if (drone.vel.y > 0) drone.vel.y = 0;
    }

    // ─── Kamera ───
    camera.position.copy(drone.pos);
    camera.rotation.order = 'YXZ';
    camera.rotation.y = drone.yaw;
    camera.rotation.x = drone.pitch + cameraAngleRad;
    camera.rotation.z = drone.roll;

    // ─── HUD ───
    const hudThr = document.getElementById('thr');
    if (hudThr) hudThr.textContent = inp.throttle.toFixed(2);
    const hudYaw = document.getElementById('yaw');
    if (hudYaw) hudYaw.textContent = inp.yaw.toFixed(2);
    const hudRol = document.getElementById('rol');
    if (hudRol) hudRol.textContent = inp.roll.toFixed(2);
    const hudPit = document.getElementById('pit');
    if (hudPit) hudPit.textContent = inp.pitch.toFixed(2);
    const hudAlt = document.getElementById('alt');
    if (hudAlt) hudAlt.textContent = drone.pos.y.toFixed(1);
    const hudSpd = document.getElementById('spd');
    if (hudSpd) hudSpd.textContent = drone.vel.length().toFixed(1);

    // ─── F4: DŹWIĘK SILNIKÓW ───
    motorAudio.update(inp.throttle, true, false);

    renderer.render(scene, camera);
  }

  const onResize = () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  };
  addEventListener('resize', onResize);

  simState = {
    renderer,
    scene,
    camera,
    disposables,
    onResize,
    onKeyDown,
    collisions,
    gateTracker,
    getRafId: () => rafId
  };

  animate();
};

// ================================================================
// ZATRZYMANIE SYMULATORA
// ================================================================
window.stopSimulator = function() {
  if (!simState) return;

  console.log('🛑 Zatrzymuję symulator...');

  const rafId = simState.getRafId();
  if (rafId !== null) cancelAnimationFrame(rafId);

  removeEventListener('resize', simState.onResize);
  if (simState.onKeyDown) removeEventListener('keydown', simState.onKeyDown);

  const ch = document.getElementById('crosshair');
  if (ch) ch.classList.add('hidden');
  const pi = document.getElementById('pauseIndicator');
  if (pi) pi.classList.add('hidden');

  // F4 — cisza przy stopie
  motorAudio.setMuted(true);

  // F1 — zwolnij tracker
  if (simState.gateTracker) {
    simState.gateTracker.dispose();
    simState.gateTracker = null;
  }

  if (simState.renderer && simState.renderer.domElement) {
    simState.renderer.domElement.remove();
  }

  simState.disposables.geometries.forEach(g => g.dispose());
  simState.disposables.materials.forEach(m => m.dispose());
  simState.disposables.textures.forEach(t => t.dispose());

  if (simState.collisions) simState.collisions.clear();

  simState.scene.clear();
  if (simState.renderer) simState.renderer.dispose();

  simState = null;

  window.onCameraAngleChange = null;
  window.setCameraAngle = null;
  window.cycleCameraAngle = null;

  window.padData.onDisconnect = () => {
    const banner = document.getElementById('reconnectBanner');
    if (banner) banner.classList.add('show');
    const statusEl = document.getElementById('status');
    if (statusEl) statusEl.textContent = t('hud.disconnected');
  };
  window.padData.onReconnect = () => {
    const banner = document.getElementById('reconnectBanner');
    if (banner) banner.classList.remove('show');
    const statusEl = document.getElementById('status');
    if (statusEl) statusEl.textContent = t('hud.ok');
  };

  console.log('✅ Symulator zatrzymany');
};