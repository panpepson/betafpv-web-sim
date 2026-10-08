import * as THREE from 'three';
import { t } from './i18n/index.js';
import { CollisionSystem } from './modules/collisions.js';
import { GateTracker }    from './modules/gates.js';
import { MotorAudio }     from './modules/audio.js';
import { GhostReplay }    from './modules/ghost.js';
import { WORLDS }         from './worlds/index.js';

let simState = null;

const INPUT_SMOOTHING  = 0.60;
const CAMERA_SMOOTHING = 0.75;
const INPUT_DEADZONE   = 0.02;

const smoothedInput = { throttle: 0, yaw: 0, roll: 0, pitch: 0 };
const cameraSmooth  = { pitch: 0, roll: 0, yaw: 0, initialized: false };

function deadzone(v, threshold = INPUT_DEADZONE) {
  if (Math.abs(v) < threshold) return 0;
  const sign = Math.sign(v);
  return sign * ((Math.abs(v) - threshold) / (1 - threshold));
}

const motorAudio = new MotorAudio({
  baseFreq: 60, maxFreq: 280, baseGain: 0.02, maxGain: 0.14,
  baseCutoff: 400, maxCutoff: 2800
});

class BgMusic {
  constructor() {
    this.el = document.getElementById('bgMusic');
    this.userPaused = false;
    if (!this.el) {
      this.el = document.createElement('audio');
      this.el.id = 'bgMusic';
      this.el.loop = true;
      this.el.preload = 'auto';
      this.el.muted = true;
      const src1 = document.createElement('source');
      src1.src = 'audio/bg-music.ogg'; src1.type = 'audio/ogg';
      const src2 = document.createElement('source');
      src2.src = 'audio/bg-music.mp3'; src2.type = 'audio/mpeg';
      this.el.appendChild(src1); this.el.appendChild(src2);
      document.body.appendChild(this.el);
    }
    this.el.muted = true;
    this.el.volume = 0.25;
    this.el.play().catch((e) => console.warn('[music] autoplay muted deferred:', e.message));
  }
  async play() { if (this.userPaused) return; try { await this.el.play(); } catch (e) { console.warn('[music] play deferred:', e.message); } }
  pause() { try { this.el.pause(); } catch (_) {} }
  unmute() { if (!this.el) return; this.el.muted = false; if (this.el.paused) this.play(); }
  setUserMuted(m) { this.userPaused = !!m; if (this.userPaused) this.pause(); else this.play(); }
}

const bgMusic = new BgMusic();

const audioState = { masterMute: false, engineMuted: false, musicMuted: false };

function applyAudioState() {
  const engineOff = audioState.masterMute || audioState.engineMuted;
  const musicOff  = audioState.masterMute || audioState.musicMuted;
  motorAudio.setMuted(engineOff);
  bgMusic.setUserMuted(musicOff);
  updateAudioHud();
}

function updateAudioHud() {
  const engineOff = audioState.masterMute || audioState.engineMuted;
  const musicOff  = audioState.masterMute || audioState.musicMuted;
  const aEngine = document.getElementById('a-engine');
  const aMusic  = document.getElementById('a-music');
  if (aEngine) aEngine.classList.toggle('muted', engineOff);
  if (aMusic)  aMusic.classList.toggle('muted', musicOff);
  const btn = document.getElementById('mute-btn');
  if (btn) btn.textContent = audioState.masterMute ? '🔇' : (audioState.engineMuted ? '🔕' : '🔊');
  const mbtn = document.getElementById('music-btn');
  if (mbtn) mbtn.textContent = audioState.musicMuted ? '🔕' : '🎵';
}

(function loadAudioPrefs() {
  const em = localStorage.getItem('betafpv_engine_mute');
  const mm = localStorage.getItem('betafpv_music_mute');
  if (em === 'true') audioState.engineMuted = true;
  if (mm === 'true') audioState.musicMuted = true;
  applyAudioState();
})();

let __audioReady = false;

async function ensureAudioInit() {
  if (__audioReady) return;
  try { await motorAudio.init(); } catch (e) { console.warn('[audio] init failed', e); }
  if (motorAudio.ctx && motorAudio.ctx.state === 'suspended') {
    try { await motorAudio.ctx.resume(); console.log('[audio] ctx.resume() →', motorAudio.ctx.state); }
    catch (e) { console.warn('[audio] ctx.resume() failed:', e.message); }
  }
  bgMusic.unmute();
  await bgMusic.play();
  applyAudioState();
  const ctxState = motorAudio.ctx ? motorAudio.ctx.state : 'none';
  if (ctxState === 'running' || ctxState === 'none') {
    __audioReady = true; removeAudioUnlockListeners();
    console.log('✅ [audio] Odblokowane — AudioContext:', ctxState);
  }
}

function onAudioUnlockGesture(ev) {
  if (ev.type === 'keydown' && ['Shift', 'Control', 'Alt', 'Meta'].includes(ev.key)) return;
  ensureAudioInit();
}

function attachAudioUnlockListeners() {
  document.addEventListener('pointerdown', onAudioUnlockGesture, true);
  document.addEventListener('click',       onAudioUnlockGesture, true);
  document.addEventListener('keydown',     onAudioUnlockGesture, true);
  document.addEventListener('touchstart',  onAudioUnlockGesture, true);
}

function removeAudioUnlockListeners() {
  document.removeEventListener('pointerdown', onAudioUnlockGesture, true);
  document.removeEventListener('click',       onAudioUnlockGesture, true);
  document.removeEventListener('keydown',     onAudioUnlockGesture, true);
  document.removeEventListener('touchstart',  onAudioUnlockGesture, true);
}

attachAudioUnlockListeners();

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && motorAudio.ctx && motorAudio.ctx.state === 'suspended') {
    motorAudio.ctx.resume().catch(() => {});
  }
});

(function setupAudioButtons() {
  const btn = document.getElementById('mute-btn');
  if (btn) btn.addEventListener('click', async (e) => {
    e.stopPropagation(); await ensureAudioInit();
    audioState.masterMute = !audioState.masterMute; applyAudioState();
  });
  const musicBtn = document.getElementById('music-btn');
  if (musicBtn) musicBtn.addEventListener('click', async (e) => {
    e.stopPropagation(); await ensureAudioInit();
    audioState.musicMuted = !audioState.musicMuted;
    localStorage.setItem('betafpv_music_mute', String(audioState.musicMuted));
    applyAudioState();
  });
})();

// ================================================================
// SYMULATOR
// ================================================================
window.startSimulator = function(worldKey) {
  const cfg = WORLDS[worldKey] || WORLDS.beginner;
  console.log('🚁 Start symulatora —', cfg.name, '| fizyka:', cfg.physics.mode, '| kamera:', cfg.camera.angle + '°');
  ensureAudioInit();
  if (simState) window.stopSimulator();

  smoothedInput.throttle = 0; smoothedInput.yaw = 0;
  smoothedInput.roll = 0; smoothedInput.pitch = 0;
  cameraSmooth.initialized = false;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(cfg.sky.bottom, cfg.fog.near, cfg.fog.far);

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
        for (const k in m) if (m[k] && m[k].isTexture) disposables.textures.push(m[k]);
      });
    }
  };

  const collisions = new CollisionSystem();

  const sun = new THREE.DirectionalLight(0xffffff, 1.2);
  sun.position.set(80, 150, 60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -200; sun.shadow.camera.right = 200;
  sun.shadow.camera.top = 200;   sun.shadow.camera.bottom = -200;
  sun.shadow.camera.near = 1;    sun.shadow.camera.far = 400;
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0x8899aa, 0.7));

  const skyGeo = new THREE.SphereGeometry(800, 32, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      top:    { value: new THREE.Color(cfg.sky.top) },
      bottom: { value: new THREE.Color(cfg.sky.bottom) }
    },
    vertexShader: `varying vec3 vPos; void main() { vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform vec3 top; uniform vec3 bottom; varying vec3 vPos;
      void main() { float h = normalize(vPos).y * 0.5 + 0.5; gl_FragColor = vec4(mix(bottom, top, h), 1.0); }`
  });
  const skyMesh = new THREE.Mesh(skyGeo, skyMat);
  scene.add(skyMesh); track(skyMesh);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(2000, 2000),
    new THREE.MeshLambertMaterial({ color: 0x3a7d2c })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground); track(ground);

  const grid = new THREE.GridHelper(2000, 200, 0x2d5a1e, 0x2d5a1e);
  grid.position.y = 0.01;
  grid.material.opacity = 0.3; grid.material.transparent = true;
  scene.add(grid); track(grid);

  cfg.hills.forEach(h => {
    const hillGeo = new THREE.SphereGeometry(h.radius, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const hill = new THREE.Mesh(hillGeo, new THREE.MeshLambertMaterial({ color: 0x2d5a1e }));
    hill.position.set(h.x, h.y, h.z);
    hill.scale.set(1, h.heightScale, 1);
    hill.castShadow = true; hill.receiveShadow = true;
    scene.add(hill); track(hill);
    collisions.addBox(
      new THREE.Vector3(h.x - h.radius, h.y, h.z - h.radius),
      new THREE.Vector3(h.x + h.radius, h.y + h.radius * h.heightScale, h.z + h.radius),
      { kind: 'hill' }
    );
  });

  if (cfg.water) {
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(cfg.water.w, cfg.water.d, 20, 20),
      new THREE.MeshPhongMaterial({ color: 0x1e5b8a, transparent: true, opacity: 0.85, shininess: 100, specular: 0x88ccff })
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(cfg.water.x, 0.15, cfg.water.z);
    water.receiveShadow = true;
    scene.add(water); track(water);
  }

  function makeTree(x, z, scale) {
    const group = new THREE.Group();
    const trunkGeo = new THREE.CylinderGeometry(0.5 * scale, 0.7 * scale, 4 * scale, 8);
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x5c3a1e });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 2 * scale; trunk.castShadow = true; group.add(trunk);
    disposables.geometries.push(trunkGeo); disposables.materials.push(trunkMat);
    const c1Geo = new THREE.SphereGeometry(2.5 * scale, 10, 8);
    const c1Mat = new THREE.MeshLambertMaterial({ color: 0x2a5a1a });
    const c1 = new THREE.Mesh(c1Geo, c1Mat);
    c1.position.y = 5 * scale; c1.castShadow = true; group.add(c1);
    disposables.geometries.push(c1Geo); disposables.materials.push(c1Mat);
    const c2Geo = new THREE.SphereGeometry(1.8 * scale, 8, 6);
    const c2Mat = new THREE.MeshLambertMaterial({ color: 0x356b22 });
    const c2 = new THREE.Mesh(c2Geo, c2Mat);
    c2.position.y = 6.5 * scale; c2.castShadow = true; group.add(c2);
    disposables.geometries.push(c2Geo); disposables.materials.push(c2Mat);
    group.position.set(x, 0, z);
    collisions.addSphere(new THREE.Vector3(x, 5 * scale, z), 2.5 * scale, { kind: 'tree' });
    return group;
  }
  cfg.trees.forEach(t => scene.add(makeTree(t.x, t.z, t.scale)));

  function makeBox(x, z, w, h, d, color) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mat = new THREE.MeshLambertMaterial({ color });
    const box = new THREE.Mesh(geo, mat);
    box.position.set(x, h / 2, z);
    box.castShadow = true; box.receiveShadow = true;
    scene.add(box);
    disposables.geometries.push(geo); disposables.materials.push(mat);
    collisions.addBox(
      new THREE.Vector3(x - w/2, 0, z - d/2),
      new THREE.Vector3(x + w/2, h, z + d/2),
      { kind: 'box', color }
    );
  }
  cfg.boxes.forEach(b => makeBox(b.x, b.z, b.w, b.h, b.d, b.color));

  const gateMeshes = [];
  function makeGate(x, y, z, rotY) {
    const g = new THREE.Group();
    const geo = new THREE.TorusGeometry(3, 0.3, 8, 24);
    const mat = new THREE.MeshLambertMaterial({ color: 0xff0066 });
    mat.emissive = new THREE.Color(0x000000);
    const ring = new THREE.Mesh(geo, mat);
    ring.castShadow = true;
    g.add(ring);
    g.position.set(x, y, z); g.rotation.y = rotY;
    scene.add(g);
    disposables.geometries.push(geo); disposables.materials.push(mat);
    g.userData.isGate = true;
    gateMeshes.push(g);
  }
  cfg.gates.forEach(g => makeGate(g.x, g.y, g.z, g.yaw));

  let gateTracker = new GateTracker(gateMeshes, {
    droneRadius: 0.6, ringRadius: 3.0, ringThickness: 0.3,
    restitution: 0.45, passCooldownMs: 600,
    passedColor: 0x00ff66, resetDelayMs: 800
  });

  const gateCounterEl = document.getElementById('gate-counter');
  const gateTimerEl   = document.getElementById('gate-timer');
  const ghostDeltaEl  = document.getElementById('ghost-delta');

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

  const ghostSupported = true;
  const ghostEnabled = ghostSupported && (window.__ghostEnabled !== false);

  const ghostColors = {
    beginner:     0x99ff99,
    intermediate: 0xffdd66,
    expert:       0x66ccff,
    expert_race:  0xff66cc,
  };

  const ghostWrap = document.getElementById('ghostToggleWrap');
  if (ghostWrap) ghostWrap.style.display = ghostSupported ? '' : 'none';

  const ghost = ghostSupported
    ? new GhostReplay(worldKey, scene, {
        enabled: ghostEnabled,
        baseColor: ghostColors[worldKey] ?? 0x66ccff,
      })
    : null;

  // ─── Stan wyścigu ───
  let raceGhostTimeMs = null;
  let ghostRecordingStarted = false;
  let hasCompletedFirstLap = false;

  if (ghost) {
    ghost.loadSaved();
    ghost.startRecording(performance.now());
    ghostRecordingStarted = true;

    ghost.onDeltaUpdate = (delta, isAhead) => {
      if (!ghostDeltaEl) return;
      if (delta == null) {
        ghostDeltaEl.classList.add('hidden');
        ghostDeltaEl.classList.remove('ahead', 'behind');
        return;
      }
      ghostDeltaEl.classList.remove('hidden');
      ghostDeltaEl.classList.toggle('ahead',  isAhead);
      ghostDeltaEl.classList.toggle('behind', !isAhead);
      const sign = delta >= 0 ? '+' : '';
      ghostDeltaEl.textContent = `Δ ${sign}${delta.toFixed(3)}s`;
      ghost.setGhostColor(delta > 0 ? 0x66ff99 : 0xff6666);
    };

    ghost.onGhostIntro = ({ timeMs }) => {
      const intro = document.getElementById('ghost-intro');
      if (!intro) return;
      const titleEl  = intro.querySelector('.ghost-intro-title');
      const recordEl = intro.querySelector('.ghost-intro-time-label [data-i18n="ghost.intro_record"]');
      const timeEl   = intro.querySelector('.ghost-intro-time');
      if (titleEl)  titleEl.textContent  = (t && t('ghost.intro_title'))  || 'Twój poprzedni wynik goni Cię!';
      if (recordEl) recordEl.textContent = (t && t('ghost.intro_record')) || 'Rekord:';
      if (timeEl)   timeEl.textContent   = (timeMs / 1000).toFixed(3) + 's';
      intro.classList.remove('hidden');
      intro.classList.remove('show');
      void intro.offsetWidth;
      intro.classList.add('show');
      clearTimeout(ghost._introHideTimer);
      ghost._introHideTimer = setTimeout(() => {
        intro.classList.remove('show');
        setTimeout(() => intro.classList.add('hidden'), 400);
      }, 6000);
    };

    ghost.onGhostDestroyed = () => {
      motorAudio.fanfare();
      const hud = document.getElementById('hud');
      if (hud) { hud.classList.add('collision'); setTimeout(() => hud.classList.remove('collision'), 300); }
      document.body.classList.add('screen-shake');
      setTimeout(() => document.body.classList.remove('screen-shake'), 500);
      const destroyedEl = document.getElementById('ghost-destroyed');
      if (destroyedEl) {
        const titleEl = destroyedEl.querySelector('.ghost-destroyed-title');
        const subEl   = destroyedEl.querySelector('.ghost-destroyed-subtitle');
        if (titleEl) titleEl.textContent = (t && t('ghost.destroyed_title')) || 'ZNISZCZYŁEŚ DUCHA!';
        if (subEl)   subEl.textContent   = (t && t('ghost.destroyed_subtitle')) || '+100 pkt';
        destroyedEl.classList.remove('hidden');
        destroyedEl.classList.remove('show');
        void destroyedEl.offsetWidth;
        destroyedEl.classList.add('show');
        clearTimeout(window.__ghostDestroyedTimer);
        window.__ghostDestroyedTimer = setTimeout(() => {
          destroyedEl.classList.remove('show');
          setTimeout(() => destroyedEl.classList.add('hidden'), 400);
        }, 1500);
      }
    };

    ghost.onGhostRespawn = () => motorAudio.beep(880, 0.08, 0.06);
  }

  function startGhostForFreshLap() {
    if (!ghost || !ghostSupported || !ghostEnabled) return;
    if (!hasCompletedFirstLap) {
      console.log('👻 [freshLap] pomijam — pierwsza runda');
      return;
    }
    if (raceGhostTimeMs !== null) {
      console.log('👻 [freshLap] pomijam — wyścig już trwa');
      return;
    }

    // 🔧 RESET: wszystkie bramki na czerwono, finished = false
    // Dzięki temu gracz zaczyna pełne okrążenie od nowa (wszystkie bramki do zapalenia)
    for (const g of gateTracker.gates) {
      g.passed = false;
      g.prevSide = null;
      g.prevRadialDist = null;
      g.cooldownUntil = 0;
      g.resetColor();
    }
    gateTracker.finished = false;
    gateTracker.finishTime = null;

    const ghostNow = performance.now();
    gateTracker.startTime = ghostNow;

    if (ghost.hasRecord()) {
      const record = ghost.loadSaved();
      raceGhostTimeMs = record ? record.timeMs : null;
      ghost.restartPlayback(ghostNow);
      console.log('👻 [freshLap] wyścig startuje — rekord ghosta:', Math.round(raceGhostTimeMs) + 'ms');
    } else {
      raceGhostTimeMs = null;
      console.log('👻 [freshLap] brak rekordu — nagrywam kolejny przejazd');
    }
  }
  gateTracker.onGatePassed = () => motorAudio.success();
  gateTracker.onGateHit = () => motorAudio.thud();
  gateTracker.onGateReset = () => motorAudio.beep(330, 0.08, 0.06);
  gateTracker.onFreshLapStart = (gate, idx) => { if (idx === 0) startGhostForFreshLap(); };

  gateTracker.onFinish = () => {
    motorAudio.fanfare();
    hasCompletedFirstLap = true;

    if (ghost) {
      const playerTime = performance.now() - gateTracker.startTime;

      console.log('🏁 [finish]', {
        playerTime: Math.round(playerTime) + 'ms',
        raceGhostTime: raceGhostTimeMs != null ? Math.round(raceGhostTimeMs) + 'ms' : 'brak (nie było wyścigu)',
      });

      ghost.onLapComplete(playerTime);

      const resultEl = document.getElementById('ghost-result');
      if (resultEl) {
        const iconEl  = document.getElementById('ghost-result-icon');
        const titleEl = document.getElementById('ghost-result-title');
        const subEl   = document.getElementById('ghost-result-subtitle');
        const pTimeEl = resultEl.querySelector('.ghost-result-player-time');
        const gTimeEl = resultEl.querySelector('.ghost-result-ghost-time');
        const vsEl    = resultEl.querySelector('.ghost-result-vs');
        const labelEl = resultEl.querySelector('.ghost-result-time-label');

        resultEl.classList.remove('win', 'lose', 'neutral');

        if (raceGhostTimeMs != null && raceGhostTimeMs > 0) {
          const won = playerTime < raceGhostTimeMs;
          if (iconEl)  iconEl.textContent  = won ? '🏆' : '🍌';
          if (titleEl) titleEl.textContent = won
            ? ((t && t('ghost.win_title'))  || 'WYGRAŁEŚ!')
            : ((t && t('ghost.lose_title')) || 'PRZEGRAŁEŚ');
          if (subEl)   subEl.textContent   = won
            ? ((t && t('ghost.win_subtitle'))  || 'Pobiłeś rekord ducha')
            : ((t && t('ghost.lose_subtitle')) || 'Duch był szybszy');
          if (pTimeEl) pTimeEl.textContent = (playerTime / 1000).toFixed(3) + 's';
          if (gTimeEl) { gTimeEl.textContent = (raceGhostTimeMs / 1000).toFixed(3) + 's'; gTimeEl.style.display = ''; }
          if (vsEl)    vsEl.style.display = '';
          if (labelEl) labelEl.textContent = (t && t('ghost.your_time')) || 'Twój czas:';
          resultEl.classList.add(won ? 'win' : 'lose');
          console.log(won ? '🏆 [result] WYGRAŁEŚ!' : '🍌 [result] PRZEGRAŁEŚ');
        } else {
          if (iconEl)  iconEl.textContent  = '🏁';
          if (titleEl) titleEl.textContent = (t && t('ghost.first_title')) || 'GRATULACJE!';
          if (subEl)   subEl.textContent   = (t && t('ghost.first_subtitle')) || 'Zaliczyłeś tor';
          if (pTimeEl) pTimeEl.textContent = (playerTime / 1000).toFixed(3) + 's';
          if (gTimeEl) gTimeEl.style.display = 'none';
          if (vsEl)    vsEl.style.display = 'none';
          if (labelEl) labelEl.textContent = (t && t('ghost.your_time')) || 'Twój czas:';
          resultEl.classList.add('neutral');
          console.log('🏁 [result] Gratulacje (brak wyścigu)');
        }

        resultEl.classList.remove('hidden');
        resultEl.classList.remove('show');
        void resultEl.offsetWidth;
        resultEl.classList.add('show');

        clearTimeout(window.__ghostResultTimer);
        window.__ghostResultTimer = setTimeout(() => {
          resultEl.classList.remove('show');
          setTimeout(() => resultEl.classList.add('hidden'), 400);
        }, 5000);
      }

      // Zrestartuj nagrywanie na nowe okrążenie
      ghostRecordingStarted = true;
      ghost.startRecording(performance.now());
    }

    // Reset stanu wyścigu (next round ustawi to przez freshLap)
    raceGhostTimeMs = null;
  };

  gateTracker._emitProgress();

  const drone = {
    pos: new THREE.Vector3(cfg.spawn.x, cfg.spawn.y, cfg.spawn.z),
    vel: new THREE.Vector3(0, 0, 0),
    yaw: 0, pitch: 0, roll: 0,
    targetPitch: 0, targetRoll: 0,
    yawRate: 0, pitchRate: 0, rollRate: 0
  };

  const PHYS = {
    mode: cfg.physics.mode, gravity: cfg.physics.gravity,
    thrustFactor: cfg.physics.thrustFactor, pitchRollGain: cfg.physics.pitchRollGain,
    yawRateArcade: cfg.physics.yawRate, visualTilt: cfg.physics.visualTilt,
    drag: cfg.physics.drag, throttleHover: cfg.physics.throttleHover,
    hoverThrottle: cfg.physics.hoverThrottle, pitchRollRate: cfg.physics.pitchRollRate,
    yawRateReal: cfg.physics.yawRate, angularInertia: cfg.physics.angularInertia,
    angularDamping: cfg.physics.angularDamping, airDrag: cfg.physics.airDrag,
    airDragQuadratic: cfg.physics.airDragQuadratic, maxTiltAngle: cfg.physics.maxTiltAngle,
    maxAltitude: cfg.physics.maxAltitude, maxSpeed: cfg.physics.maxSpeed,
    groundLevel: cfg.physics.groundLevel
  };

  let prevTime = performance.now();
  let rafId = null;
  let pausedByKey = false;
  let pausedByDisconnect = false;
  let crosshairVisible = true;

  const crosshairEl = document.getElementById('crosshair');
  if (crosshairEl) crosshairEl.classList.remove('hidden');

  let cameraAngleDeg = cfg.camera.angle || 0;
  let cameraAngleRad = cameraAngleDeg * Math.PI / 180;
  const cameraAnglesList = cfg.camera.angles || [0, 20, 35];
  let cameraAngleIndex = cameraAnglesList.indexOf(cameraAngleDeg);
  if (cameraAngleIndex < 0) cameraAngleIndex = 0;
  const camEl = document.getElementById('camAngle');
  if (camEl) camEl.textContent = cameraAngleDeg + '°';

  window.onCameraAngleChange = (a) => { cameraAngleDeg = a; cameraAngleRad = a * Math.PI / 180; };
  window.setCameraAngle = (a) => { cameraAngleDeg = a; cameraAngleRad = a * Math.PI / 180; };
  window.cycleCameraAngle = function() {
    cameraAngleIndex = (cameraAngleIndex + 1) % cameraAnglesList.length;
    const angle = cameraAnglesList[cameraAngleIndex];
    cameraAngleDeg = angle;
    cameraAngleRad = angle * Math.PI / 180;
    const camElLocal = document.getElementById('camAngle');
    if (camElLocal) camElLocal.textContent = angle + '°';
  };

  window.padData.onDisconnect = () => { pausedByDisconnect = true; };
  window.padData.onReconnect  = () => { pausedByDisconnect = false; prevTime = performance.now(); };

  function triggerCollisionFlash() {
    const hud = document.getElementById('hud');
    if (hud) { hud.classList.add('collision'); setTimeout(() => hud.classList.remove('collision'), 300); }
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
    if (e.code === 'KeyR' || e.key === 'r' || e.key === 'R') {
      e.preventDefault();
      if (gateTracker) {
        gateTracker.restart();
        motorAudio.beep(440, 0.15, 0.10);
        if (ghost) { ghost.stopPlayback(); ghost.startRecording(performance.now()); ghostRecordingStarted = true; }
        raceGhostTimeMs = null;
        const intro = document.getElementById('ghost-intro');
        if (intro) { intro.classList.remove('show'); intro.classList.add('hidden'); }
        const resultEl = document.getElementById('ghost-result');
        if (resultEl) { resultEl.classList.remove('show'); resultEl.classList.add('hidden'); }
        const destroyedEl = document.getElementById('ghost-destroyed');
        if (destroyedEl) { destroyedEl.classList.remove('show'); destroyedEl.classList.add('hidden'); }
        document.body.classList.remove('screen-shake');
        console.log('🔄 Restart okrążenia');
      }
      return;
    }
    if (e.code === 'KeyM' || e.key === 'm' || e.key === 'M') { e.preventDefault(); audioState.masterMute = !audioState.masterMute; applyAudioState(); return; }
    if (e.code === 'KeyN' || e.key === 'n' || e.key === 'N') { e.preventDefault(); audioState.engineMuted = !audioState.engineMuted; localStorage.setItem('betafpv_engine_mute', String(audioState.engineMuted)); applyAudioState(); return; }
    if (e.code === 'KeyB' || e.key === 'b' || e.key === 'B') { e.preventDefault(); audioState.musicMuted = !audioState.musicMuted; localStorage.setItem('betafpv_music_mute', String(audioState.musicMuted)); applyAudioState(); return; }
  };

  addEventListener('keydown', onKeyDown);

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
      const totalDrag = PHYS.airDrag * speed + PHYS.airDragQuadratic * speed * speed;
      drone.vel.x -= (drone.vel.x / speed) * totalDrag * dt;
      drone.vel.y -= (drone.vel.y / speed) * totalDrag * dt;
      drone.vel.z -= (drone.vel.z / speed) * totalDrag * dt;
    }
  }

  function animate() {
    rafId = requestAnimationFrame(animate);
    const now = performance.now();
    const dt = Math.min((now - prevTime) / 1000, 0.033);
    prevTime = now;

    const isPaused = pausedByKey || pausedByDisconnect;
    if (isPaused) {
      motorAudio.update(0, false, true);
      if (ghost) ghost.update(now, null, drone.pos);
      renderer.render(scene, camera);
      return;
    }

    const rawInp = window.padData.input;
    const dzInp = {
      throttle: rawInp.throttle,
      yaw:      rawInp.yaw,
      roll:     deadzone(rawInp.roll, INPUT_DEADZONE),
      pitch:    deadzone(rawInp.pitch, INPUT_DEADZONE)
    };

    const a = INPUT_SMOOTHING;
    smoothedInput.throttle = a * smoothedInput.throttle + (1 - a) * dzInp.throttle;
    smoothedInput.yaw      = a * smoothedInput.yaw      + (1 - a) * dzInp.yaw;
    smoothedInput.roll     = a * smoothedInput.roll     + (1 - a) * dzInp.roll;
    smoothedInput.pitch    = a * smoothedInput.pitch    + (1 - a) * dzInp.pitch;
    const inp = smoothedInput;

    if (PHYS.mode === 'realistic') stepPhysicsRealistic(dt, inp);
    else stepPhysicsArcade(dt, inp);

    drone.pos.addScaledVector(drone.vel, dt);

    const collisionsEnabled = (worldKey === 'expert' || worldKey === 'expert_race')
      ? true : (window.__collisionsEnabled !== false);

    if (collisionsEnabled) {
      const collision = collisions.check(drone.pos, 0.5);
      if (collision) {
        drone.vel.copy(collisions.reflect(drone.vel, collision.normal, 0.4));
        drone.pos.addScaledVector(collision.normal, collision.depth + 0.01);
        triggerCollisionFlash();
      }
    }

    if (gateTracker) {
      const gateHits = gateTracker.update(drone.pos, dt, now);
      if (collisionsEnabled && gateHits.length) {
        for (const hit of gateHits) {
          drone.vel.copy(collisions.reflect(drone.vel, hit.normal, hit.restitution));
          drone.pos.addScaledVector(hit.normal, hit.penetration + 0.01);
        }
        triggerCollisionFlash();
      }
    }

    const horizontalSpeed = Math.sqrt(drone.vel.x * drone.vel.x + drone.vel.z * drone.vel.z);
    if (horizontalSpeed > PHYS.maxSpeed) {
      const scale = PHYS.maxSpeed / horizontalSpeed;
      drone.vel.x *= scale; drone.vel.z *= scale;
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

    if (ghost) {
      const currentLapTime = gateTracker ? (now - gateTracker.startTime) : 0;
      if (ghostRecordingStarted) {
        ghost.record(drone.pos, { yaw: drone.yaw, pitch: drone.pitch, roll: drone.roll }, now);
      }
      ghost.update(now, currentLapTime, drone.pos);
    }

    if (!cameraSmooth.initialized) {
      cameraSmooth.pitch = drone.pitch;
      cameraSmooth.roll  = drone.roll;
      cameraSmooth.yaw   = drone.yaw;
      cameraSmooth.initialized = true;
    }
    const cs = CAMERA_SMOOTHING;
    cameraSmooth.pitch = cs * cameraSmooth.pitch + (1 - cs) * drone.pitch;
    cameraSmooth.roll  = cs * cameraSmooth.roll  + (1 - cs) * drone.roll;
    cameraSmooth.yaw = drone.yaw;

    camera.position.copy(drone.pos);
    camera.rotation.order = 'YXZ';
    camera.rotation.y = cameraSmooth.yaw;
    camera.rotation.x = cameraSmooth.pitch + cameraAngleRad;
    camera.rotation.z = cameraSmooth.roll;

    const hudThr = document.getElementById('thr'); if (hudThr) hudThr.textContent = inp.throttle.toFixed(2);
    const hudYaw = document.getElementById('yaw'); if (hudYaw) hudYaw.textContent = inp.yaw.toFixed(2);
    const hudRol = document.getElementById('rol'); if (hudRol) hudRol.textContent = inp.roll.toFixed(2);
    const hudPit = document.getElementById('pit'); if (hudPit) hudPit.textContent = inp.pitch.toFixed(2);
    const hudAlt = document.getElementById('alt'); if (hudAlt) hudAlt.textContent = drone.pos.y.toFixed(1);
    const hudSpd = document.getElementById('spd'); if (hudSpd) hudSpd.textContent = drone.vel.length().toFixed(1);

    motorAudio.update((inp.throttle + 1) / 2, true, false);
    renderer.render(scene, camera);
  }

  const onResize = () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  };
  addEventListener('resize', onResize);

  simState = {
    renderer, scene, camera, disposables, onResize, onKeyDown,
    collisions, gateTracker, ghost,
    getRafId: () => rafId
  };

  animate();
};

// ================================================================
// ZATRZYMANIE
// ================================================================
window.stopSimulator = function() {
  if (!simState) return;
  console.log('🛑 Zatrzymuję symulator...');
  const rafId = simState.getRafId();
  if (rafId !== null) cancelAnimationFrame(rafId);
  removeEventListener('resize', simState.onResize);
  if (simState.onKeyDown) removeEventListener('keydown', simState.onKeyDown);

  const ch = document.getElementById('crosshair'); if (ch) ch.classList.add('hidden');
  const pi = document.getElementById('pauseIndicator'); if (pi) pi.classList.add('hidden');
  const intro = document.getElementById('ghost-intro');
  if (intro) { intro.classList.remove('show'); intro.classList.add('hidden'); }
  const resultEl = document.getElementById('ghost-result');
  if (resultEl) { resultEl.classList.remove('show'); resultEl.classList.add('hidden'); }
  const destroyedEl = document.getElementById('ghost-destroyed');
  if (destroyedEl) { destroyedEl.classList.remove('show'); destroyedEl.classList.add('hidden'); }
  document.body.classList.remove('screen-shake');

  if (simState.ghost) { simState.ghost.dispose(); simState.ghost = null; }
  if (simState.gateTracker) {
    simState.gateTracker.gates.forEach(g => g.resetColor && g.resetColor());
    simState.gateTracker.dispose(); simState.gateTracker = null;
  }
  if (simState.renderer && simState.renderer.domElement) simState.renderer.domElement.remove();
  simState.disposables.geometries.forEach(g => g.dispose());
  simState.disposables.materials.forEach(m => m.dispose());
  simState.disposables.textures.forEach(t => t.dispose());
  if (simState.collisions) simState.collisions.clear();
  simState.scene.clear();
  if (simState.renderer) simState.renderer.dispose();
  simState = null;

  smoothedInput.throttle = 0; smoothedInput.yaw = 0;
  smoothedInput.roll = 0; smoothedInput.pitch = 0;
  cameraSmooth.initialized = false;

  window.onCameraAngleChange = null; window.setCameraAngle = null; window.cycleCameraAngle = null;
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
