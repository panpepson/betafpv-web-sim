// modules/ghost.js
// 👻 Ghost Replay — zapis i odtwarzanie najlepszego przejazdu.
//
// v6 (finalna logika):
//   - Ghost startuje DOPIERO gdy gracz przeleci przez bramkę #1
//   - onGhostFinished callback — wołane gdy ghost dolatuje do końca playbacku
//   - Możliwość wznowienia playbacku po zniszczeniu (respawn)
//   - Intro 6 s
//   - Taranowanie: gdy gracz PRZED duchem (delta > 0) i blisko → zniszczenie

import * as THREE from 'three';

const STORAGE_PREFIX = 'betafpv_ghost_';
const SAMPLE_INTERVAL_MS = 33;
const INTRO_DURATION_MS = 6000;
const TACKLE_RADIUS = 2.0;
const TACKLE_RESPAWN_MS = 2000;

// ─── Prosty, tani mesh drona-ducha ───
function makeGhostDrone(baseColor = 0x66ccff) {
  const group = new THREE.Group();

  const bodyGeo = new THREE.BoxGeometry(0.6, 0.15, 0.6);
  const bodyMat = new THREE.MeshBasicMaterial({
    color: baseColor, transparent: true, opacity: 0.55, depthWrite: false
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  group.add(body);

  const armGeo = new THREE.BoxGeometry(1.2, 0.05, 0.08);
  const armMat = bodyMat.clone();
  for (let i = 0; i < 2; i++) {
    const arm = new THREE.Mesh(armGeo, armMat);
    arm.rotation.y = i * Math.PI / 2;
    group.add(arm);
  }

  const propGeo = new THREE.RingGeometry(0.22, 0.30, 12);
  const propMat = new THREE.MeshBasicMaterial({
    color: baseColor, transparent: true, opacity: 0.35,
    side: THREE.DoubleSide, depthWrite: false
  });
  const props = [];
  const offsets = [
    [ 0.5, 0.05,  0.5], [-0.5, 0.05,  0.5],
    [ 0.5, 0.05, -0.5], [-0.5, 0.05, -0.5],
  ];
  for (const [x, y, z] of offsets) {
    const p = new THREE.Mesh(propGeo, propMat);
    p.position.set(x, y, z);
    p.rotation.x = -Math.PI / 2;
    group.add(p);
    props.push(p);
  }

  return { group, props, materials: [bodyMat, armMat, propMat] };
}

// ─── Ślad (linia) za duchem ───
class Trail {
  constructor(scene, maxPoints = 600) {
    this.maxPoints = maxPoints;
    this.positions = new Float32Array(maxPoints * 3);
    this.count = 0;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.setDrawRange(0, 0);

    const mat = new THREE.LineBasicMaterial({
      color: 0x66ccff, transparent: true, opacity: 0.5
    });

    this.line = new THREE.Line(geo, mat);
    this.line.frustumCulled = false;
    scene.add(this.line);
    this.geometry = geo;
    this.material = mat;
  }

  push(x, y, z) {
    if (this.count >= this.maxPoints) {
      this.positions.copyWithin(0, 3);
      this.count = this.maxPoints - 1;
    }
    const i = this.count * 3;
    this.positions[i]     = x;
    this.positions[i + 1] = y;
    this.positions[i + 2] = z;
    this.count++;
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.setDrawRange(0, this.count);
  }

  clear() {
    this.count = 0;
    this.geometry.setDrawRange(0, 0);
  }

  setColor(hex) { this.material.color.setHex(hex); }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
    if (this.line.parent) this.line.parent.remove(this.line);
  }
}

// ─── Główna klasa ───
export class GhostReplay {
  constructor(worldId, scene, opts = {}) {
    this.worldId = worldId;
    this.scene = scene;
    this.enabled = opts.enabled !== false;
    this.baseColor = opts.baseColor ?? 0x66ccff;

    // Nagrywanie
    this.recording = false;
    this.recordedFrames = [];
    this.recordStartTime = 0;
    this.lastSampleTime = 0;

    // Odtwarzanie
    this.playback = null;
    this.playing = false;
    this.playbackStart = 0;
    this.playbackIndex = 0;
    this.finished = false;         // playback dotarł do końca

    // Taranowanie
    this.destroyed = false;
    this.respawnAt = 0;

    // Callbacks
    this.onGhostIntro = null;      // ({timeMs, durationMs, baseColor})
    this.onGhostFinished = null;   // () — playback dobiegł końca
    this.onGhostDestroyed = null;  // ({respawnMs})
    this.onGhostRespawn = null;    // ()
    this.onDeltaUpdate = null;     // (deltaSec|null, isAhead)

    // Wizualizacja
    const ghost = makeGhostDrone(this.baseColor);
    this.ghostGroup = ghost.group;
    this.ghostProps = ghost.props;
    this.ghostMaterials = ghost.materials;
    this.ghostGroup.visible = false;
    scene.add(this.ghostGroup);

    this.trail = new Trail(scene, 600);
    this.trail.line.visible = false;
    this.trail.setColor(this.baseColor);

    this._currentPos = new THREE.Vector3();
  }

  // ─── localStorage ───
  _storageKey() { return STORAGE_PREFIX + this.worldId; }

  hasRecord() {
    try { return !!localStorage.getItem(this._storageKey()); }
    catch (_) { return false; }
  }

  loadSaved() {
    try {
      const raw = localStorage.getItem(this._storageKey());
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || !Array.isArray(data.frames) || data.frames.length < 2) return null;
      return data;
    } catch (e) {
      console.warn('[ghost] load failed:', e.message);
      return null;
    }
  }

  saveRecord(frames, timeMs) {
    try {
      const packed = frames.map(f => ([
        f.t,
        +f.x.toFixed(2), +f.y.toFixed(2), +f.z.toFixed(2),
        +f.yaw.toFixed(3), +f.pitch.toFixed(3), +f.roll.toFixed(3)
      ]));
      const payload = {
        v: 1, worldId: this.worldId, timeMs,
        savedAt: Date.now(), frames: packed
      };
      localStorage.setItem(this._storageKey(), JSON.stringify(payload));
      console.log(`👻 [ghost] zapisano rekord ${this.worldId}: ${packed.length} klatek, ${(timeMs/1000).toFixed(3)} s`);
      return true;
    } catch (e) {
      console.warn('[ghost] save failed:', e.message);
      return false;
    }
  }

  clearSaved() {
    try { localStorage.removeItem(this._storageKey()); } catch (_) {}
    this.playback = null;
    this.stopPlayback();
  }

  // ─── Nagrywanie ───
  startRecording(now = performance.now()) {
    this.recording = true;
    this.recordedFrames = [];
    this.recordStartTime = now;
    this.lastSampleTime = now;
    console.log('👻 [ghost] start nagrywania');
  }

  stopRecording() { this.recording = false; }

  record(dronePos, rot, now) {
    if (!this.recording) return;
    if (now - this.lastSampleTime < SAMPLE_INTERVAL_MS) return;
    this.recordedFrames.push({
      t: now - this.recordStartTime,
      x: dronePos.x, y: dronePos.y, z: dronePos.z,
      yaw: rot.yaw, pitch: rot.pitch, roll: rot.roll
    });
    this.lastSampleTime = now;
  }

  /**
   * Wywoływane gdy gracz ukończy okrążenie.
   * Zapisuje TYLKO jeśli lepszy czas.
   * @returns {boolean} true jeśli zapisano nowy rekord
   */
  onLapComplete(timeMs) {
    if (!this.recording) {
      console.log('👻 [ghost] onLapComplete: brak nagrania');
      return false;
    }
    if (this.recordedFrames.length === 0) {
      this.stopRecording();
      return false;
    }

    const prev = this.loadSaved();
    const isBetter = !prev || timeMs < prev.timeMs;

    if (isBetter) {
      this.saveRecord(this.recordedFrames, timeMs);
      this.playback = this._unpack(this.loadSaved());
      console.log(`👻 [ghost] NOWY REKORD ${(timeMs/1000).toFixed(3)} s (poprzednio ${prev ? (prev.timeMs/1000).toFixed(3)+' s' : 'brak'})`);
    } else {
      console.log(`👻 [ghost] przejazd ${(timeMs/1000).toFixed(3)} s — nie poprawia rekordu ${(prev.timeMs/1000).toFixed(3)} s`);
    }

    this.stopRecording();
    return isBetter;
  }

  // ─── Odtwarzanie ───
  _unpack(saved) {
    if (!saved) return null;
    return {
      timeMs: saved.timeMs,
      frames: saved.frames.map(a => ({
        t: a[0], x: a[1], y: a[2], z: a[3],
        yaw: a[4], pitch: a[5], roll: a[6]
      }))
    };
  }

  /** Start playbacku od klatki 0. */
  startPlayback(now = performance.now()) {
    if (!this.enabled) return;
    if (!this.playback) {
      this.playback = this._unpack(this.loadSaved());
    }
    if (!this.playback || !this.playback.frames.length) return;

    this.playing = true;
    this.finished = false;
    this.destroyed = false;
    this.respawnAt = 0;
    this.playbackStart = now;
    this.playbackIndex = 0;
    this.ghostGroup.visible = true;
    this.trail.line.visible = true;
    this.trail.clear();

    if (this.onGhostIntro) {
      this.onGhostIntro({
        timeMs: this.playback.timeMs,
        durationMs: INTRO_DURATION_MS,
        baseColor: this.baseColor
      });
    }

    console.log(`👻 [ghost] odtwarzanie (${(this.playback.timeMs/1000).toFixed(3)} s, ${this.playback.frames.length} klatek)`);
  }

  stopPlayback() {
    this.playing = false;
    this.finished = false;
    this.destroyed = false;
    this.ghostGroup.visible = false;
    this.trail.line.visible = false;
    if (this.onDeltaUpdate) this.onDeltaUpdate(null, false);
  }

  /** Zniszczenie ghosta (taranowanie). */
  destroy(now = performance.now()) {
    if (this.destroyed) return;
    this.destroyed = true;
    this.respawnAt = now + TACKLE_RESPAWN_MS;
    this.ghostGroup.visible = false;
    this.trail.line.visible = false;
    if (this.onGhostDestroyed) this.onGhostDestroyed({ respawnMs: TACKLE_RESPAWN_MS });
    console.log('💥 [ghost] zniszczony! Respawn za', (TACKLE_RESPAWN_MS/1000).toFixed(1), 's');
  }

  /**
   * Wywoływane w pętli — aktualizuje pozycję ghosta.
   * @param {number} now          performance.now()
   * @param {number|null} currentLapTime  aktualny czas okrążenia (ms) lub null (pauza)
   * @param {THREE.Vector3} playerPos     pozycja gracza (do delty i taranowania)
   */
  update(now, currentLapTime, playerPos) {
    // Respawn po zniszczeniu
    if (this.destroyed) {
      if (now >= this.respawnAt && this.enabled && this.playing) {
        this.destroyed = false;
        this.ghostGroup.visible = true;
        this.trail.line.visible = true;
        if (this.onGhostRespawn) this.onGhostRespawn();
        console.log('👻 [ghost] respawn');
      } else {
        return;
      }
    }

    if (!this.playing || !this.playback) return;

    const t = now - this.playbackStart;
    const frames = this.playback.frames;

    while (this.playbackIndex < frames.length - 1 &&
           frames[this.playbackIndex + 1].t <= t) {
      this.playbackIndex++;
    }

    // ─── Koniec playbacku ───
    if (this.playbackIndex >= frames.length - 1 && t > frames[frames.length - 1].t) {
      if (!this.finished) {
        // Pierwszy raz wykryto koniec — powiadom
        this.finished = true;
        const last = frames[frames.length - 1];
        this._applyPose(last.x, last.y, last.z, last.yaw, last.pitch, last.roll);
        this._currentPos.set(last.x, last.y, last.z);
        if (this.onGhostFinished) this.onGhostFinished();
      }

      // Auto-ukrycie po 1.5 s od końca
      const timeSinceEnd = t - frames[frames.length - 1].t;
      if (timeSinceEnd > 1500) {
        this.playing = false;
        this.ghostGroup.visible = false;
        this.trail.line.visible = false;
        if (this.onDeltaUpdate) this.onDeltaUpdate(null, false);
      }
      return;
    }

    // ─── Interpolacja ───
    const a = frames[this.playbackIndex];
    const b = frames[Math.min(this.playbackIndex + 1, frames.length - 1)];
    const span = Math.max(1, b.t - a.t);
    const alpha = Math.min(1, Math.max(0, (t - a.t) / span));

    const x = a.x + (b.x - a.x) * alpha;
    const y = a.y + (b.y - a.y) * alpha;
    const z = a.z + (b.z - a.z) * alpha;
    const yaw = a.yaw + (b.yaw - a.yaw) * alpha;
    const pitch = a.pitch + (b.pitch - a.pitch) * alpha;
    const roll = a.roll + (b.roll - a.roll) * alpha;

    this._applyPose(x, y, z, yaw, pitch, roll);
    this.trail.push(x, y, z);
    this._currentPos.set(x, y, z);

    // ─── Delta + taranowanie ───
    if (playerPos && currentLapTime != null) {
      const delta = this._computeDelta(playerPos, currentLapTime);
      if (delta != null) {
        if (this.onDeltaUpdate) this.onDeltaUpdate(delta, delta > 0);
        // Taranowanie tylko gdy gracz PRZED duchem (delta > 0)
        if (delta > 0 && !this.destroyed) {
          const dx = playerPos.x - this._currentPos.x;
          const dy = playerPos.y - this._currentPos.y;
          const dz = playerPos.z - this._currentPos.z;
          const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
          if (dist < TACKLE_RADIUS) {
            this.destroy(now);
          }
        }
      }
    }
  }

  _computeDelta(playerPos, currentTimeMs) {
    if (!this.playback) return null;
    const frames = this.playback.frames;
    const start = Math.max(0, this.playbackIndex - 60);
    const end = Math.min(frames.length - 1, this.playbackIndex + 60);

    let best = null, bestDist = Infinity;
    for (let i = start; i <= end; i++) {
      const f = frames[i];
      const dx = f.x - playerPos.x, dy = f.y - playerPos.y, dz = f.z - playerPos.z;
      const d2 = dx*dx + dy*dy + dz*dz;
      if (d2 < bestDist) { bestDist = d2; best = f; }
    }
    if (!best) return null;

    const deltaSec = (best.t - currentTimeMs) / 1000;
    if (Math.abs(deltaSec) > 120) return null;
    return deltaSec;
  }

  _applyPose(x, y, z, yaw, pitch, roll) {
    this.ghostGroup.position.set(x, y, z);
    this.ghostGroup.rotation.order = 'YXZ';
    this.ghostGroup.rotation.y = yaw;
    this.ghostGroup.rotation.x = pitch;
    this.ghostGroup.rotation.z = roll;
    const spin = performance.now() * 0.03;
    for (let i = 0; i < this.ghostProps.length; i++) {
      this.ghostProps[i].rotation.z = spin + i * Math.PI / 2;
    }
  }

  setGhostColor(hex) {
    for (const m of this.ghostMaterials) m.color.setHex(hex);
    this.trail.setColor(hex);
  }

  dispose() {
    this.stopRecording();
    this.stopPlayback();
    this.ghostMaterials.forEach(m => m.dispose());
    this.ghostGroup.children.forEach(c => c.geometry && c.geometry.dispose());
    if (this.ghostGroup.parent) this.ghostGroup.parent.remove(this.ghostGroup);
    this.trail.dispose();
  }
}