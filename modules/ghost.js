// modules/ghost.js
// 👻 Ghost Replay — zapis i odtwarzanie najlepszego przejazdu.
//
// v5:
//   - Delta czasu liczona przez porównanie POZYCJI 3D gracza z klatkami ducha
//   - Sanity check |delta| > 120 → null
//   - Duch dolatuje PŁYNNIE do ostatniej klatki (nie zatrzymuje się w bramce)
//   - Auto-ukrycie ducha 1.5 s po zakończeniu playbacku
//   - TARANOWANIE: gdy gracz jest PRZED duchem (delta > 0) i w niego wleci,
//     duch znika (z respawnem po 2 s). Wymaga włączonej opcji (patrz main.js).
//   - onGhostIntro callback — pokazanie intro
//   - baseColor — kolor ducha per plansza

import * as THREE from 'three';

const STORAGE_PREFIX = 'betafpv_ghost_';
const SAMPLE_INTERVAL_MS = 33;    // ~30 Hz
const INTRO_DURATION_MS = 6000;   // 6 s
const TACKLE_RADIUS = 2.0;        // promień do wykrycia taranowania
const TACKLE_RESPAWN_MS = 2000;   // respawn ducha po zniszczeniu

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
    this.finishedPlayback = false;   // gdy playback dobiegł końca

    // Taranowanie
    this.destroyed = false;          // duch zniszczony przez gracza
    this.respawnAt = 0;              // kiedy może się odrodzić
    this.onGhostDestroyed = null;    // (info) => void
    this.onGhostRespawn = null;      // () => void

    // Intro
    this.onGhostIntro = null;

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

    this.onDeltaUpdate = null;

    this._tmpVec = new THREE.Vector3();
    this._currentPos = new THREE.Vector3();
    this._lastDelta = 0;   // ostatnia policzona delta (dla taranowania)
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

  onLapComplete(timeMs) {
    if (!this.recording) {
      console.log('👻 [ghost] onLapComplete: brak nagrania (recording === false)');
      return false;
    }
    if (this.recordedFrames.length === 0) {
      console.log('👻 [ghost] onLapComplete: 0 klatek');
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

  startPlayback(now = performance.now()) {
    if (!this.enabled) return;
    if (!this.playback) {
      this.playback = this._unpack(this.loadSaved());
    }
    if (!this.playback || !this.playback.frames.length) return;

    this.playing = true;
    this.playbackStart = now;
    this.playbackIndex = 0;
    this.finishedPlayback = false;
    this.destroyed = false;
    this.respawnAt = 0;
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
    this.finishedPlayback = false;
    this.destroyed = false;
    this.ghostGroup.visible = false;
    this.trail.line.visible = false;
    if (this.onDeltaUpdate) this.onDeltaUpdate(null, false);
  }

  restartPlayback(now = performance.now()) {
    if (!this.enabled) return;
    if (!this.playback) {
      this.playback = this._unpack(this.loadSaved());
    }
    if (!this.playback || !this.playback.frames.length) {
      console.log('👻 [ghost] brak rekordu do odtworzenia');
      return;
    }
    this.playing = false;
    this.startPlayback(now);
  }

  setEnabled(enabled, now = performance.now()) {
    this.enabled = !!enabled;
    if (!this.enabled) {
      this.stopPlayback();
    } else if (this.playback) {
      this.startPlayback(now);
    }
  }

  /**
   * Zniszczenie ducha przez taranowanie (wołane z main.js).
   * @param {number} now  performance.now()
   */
  destroy(now = performance.now()) {
    if (this.destroyed) return;
    this.destroyed = true;
    this.respawnAt = now + TACKLE_RESPAWN_MS;
    this.ghostGroup.visible = false;
    this.trail.line.visible = false;
    if (this.onGhostDestroyed) this.onGhostDestroyed({ respawnMs: TACKLE_RESPAWN_MS });
    console.log('💥 [ghost] zniszczony! Respawn za', (TACKLE_RESPAWN_MS / 1000).toFixed(1), 's');
  }

  update(now, currentTimeMs, playerPos) {
    // ─── Respawn po zniszczeniu ───
    if (this.destroyed) {
      if (now >= this.respawnAt && this.enabled) {
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
    // UWAGA: zamiast zatrzymywać ducha w miejscu, pozwalamy mu kontynuować
    // po ostatniej klatce (interpolacja liniowa w ostatnim kierunku) przez
    // krótki czas, potem auto-hide.
    if (this.playbackIndex >= frames.length - 1) {
      const last = frames[frames.length - 1];
      const beforeLast = frames[Math.max(0, frames.length - 2)];

      // Kierunek ostatniego odcinka (do płynnego „dolotu")
      const dx = last.x - beforeLast.x;
      const dy = last.y - beforeLast.y;
      const dz = last.z - beforeLast.z;
      const dLen = Math.hypot(dx, dy, dz) || 1;
      const dirX = dx / dLen, dirY = dy / dLen, dirZ = dz / dLen;

      // „Overshoot" — duch leci jeszcze ~0.4 s po ostatniej klatce w tym samym kierunku
      const overshootMs = 400;
      const overshootSec = 0.4;
      const timeAfterEnd = t - last.t; // ms
      const overshoot = Math.min(overshootMs / 1000, Math.max(0, timeAfterEnd / 1000));

      const speedEstimate = dLen / Math.max(0.001, (last.t - beforeLast.t) / 1000); // m/s
      const travelDist = speedEstimate * Math.min(overshootSec, overshoot);

      const x = last.x + dirX * travelDist;
      const y = last.y + dirY * travelDist;
      const z = last.z + dirZ * travelDist;

      this._applyPose(x, y, z, last.yaw, last.pitch, last.roll);
      // nie dodajemy do śladu po końcu (żeby nie wydłużać)

      // Auto-ukrycie dopiero po 1.5 s od końca
      if (timeAfterEnd > 1500) {
        this.playing = false;
        this.finishedPlayback = true;
        this.ghostGroup.visible = false;
        this.trail.line.visible = false;
        if (this.onDeltaUpdate) this.onDeltaUpdate(null, false);
        return;
      }

      // Delta w końcówce
      if (this.onDeltaUpdate && currentTimeMs != null && playerPos) {
        const delta = this._computeDelta(playerPos, currentTimeMs);
        if (delta != null) this.onDeltaUpdate(delta, delta > 0);
      }
      return;
    }

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

    // ─── Delta ───
    let delta = 0;
    if (this.onDeltaUpdate && currentTimeMs != null && playerPos) {
      const d = this._computeDelta(playerPos, currentTimeMs);
      if (d != null) {
        delta = d;
        this._lastDelta = d;
        const isAhead = d > 0;
        this.onDeltaUpdate(d, isAhead);
      }
    }

    // ─── Taranowanie: gdy gracz jest PRZED duchem (delta > 0) i blisko ───
    // „delta > 0" znaczy: duch jest wcześniej w torze, czyli gracz jest przed nim → zielony.
    if (playerPos && !this.destroyed && delta > 0) {
      const dx = playerPos.x - this._currentPos.x;
      const dy = playerPos.y - this._currentPos.y;
      const dz = playerPos.z - this._currentPos.z;
      const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
      if (dist < TACKLE_RADIUS) {
        this.destroy(now);
      }
    }
  }

  _computeDelta(playerPos, currentTimeMs) {
    if (!this.playback) return null;
    const frames = this.playback.frames;

    const start = Math.max(0, this.playbackIndex - 60);
    const end = Math.min(frames.length - 1, this.playbackIndex + 60);

    let best = null;
    let bestDist = Infinity;

    for (let i = start; i <= end; i++) {
      const f = frames[i];
      const dx = f.x - playerPos.x;
      const dy = f.y - playerPos.y;
      const dz = f.z - playerPos.z;
      const d2 = dx*dx + dy*dy + dz*dz;
      if (d2 < bestDist) { bestDist = d2; best = f; }
    }

    if (!best) return null;

    const deltaMs = best.t - currentTimeMs;
    const deltaSec = deltaMs / 1000;

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
    for (const m of this.ghostMaterials) {
      m.color.setHex(hex);
    }
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