// modules/ghost.js
// 👻 Ghost Replay — zapis i odtwarzanie najlepszego przejazdu.
//
// Zapisuje co ~33 ms (30 Hz): pozycję (x,y,z), rotację (yaw, pitch, roll).
// Przechowuje w localStorage jako zwięzły JSON (kilka KB na przejazd).
// Odtwarza jako półprzezroczysty dron + ślad.
//
// v3:
//   - Delta czasu liczona przez porównanie POZYCJI 3D gracza z klatkami ducha
//     (a nie przez porównanie timerów — to dawało zawsze 0)
//   - Sanity check |delta| > 120 → null
//   - Auto-ukrycie ducha 1.5 s po zakończeniu playbacku
//   - baseColor — kolor ducha per plansza

import * as THREE from 'three';

const STORAGE_PREFIX = 'betafpv_ghost_';
const SAMPLE_INTERVAL_MS = 33;   // ~30 Hz

// ─── Prosty, tani mesh drona-ducha ───
function makeGhostDrone(baseColor = 0x66ccff) {
  const group = new THREE.Group();

  // Kadłub — mały box
  const bodyGeo = new THREE.BoxGeometry(0.6, 0.15, 0.6);
  const bodyMat = new THREE.MeshBasicMaterial({
    color: baseColor, transparent: true, opacity: 0.55, depthWrite: false
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  group.add(body);

  // 4 ramiona (cienkie boxy)
  const armGeo = new THREE.BoxGeometry(1.2, 0.05, 0.08);
  const armMat = bodyMat.clone();
  for (let i = 0; i < 2; i++) {
    const arm = new THREE.Mesh(armGeo, armMat);
    arm.rotation.y = i * Math.PI / 2;
    group.add(arm);
  }

  // 4 śmigła (pierścienie)
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

  setColor(hex) {
    this.material.color.setHex(hex);
  }

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

    // ─── Kolor bazowy ducha (per plansza) ───
    this.baseColor = opts.baseColor ?? 0x66ccff;

    // Nagrywanie
    this.recording = false;
    this.recordedFrames = [];      // [{t, x, y, z, yaw, pitch, roll}, ...]
    this.recordStartTime = 0;
    this.lastSampleTime = 0;

    // Odtwarzanie
    this.playback = null;          // {frames, timeMs}
    this.playing = false;
    this.playbackStart = 0;
    this.playbackIndex = 0;

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

    // Delta czasu (HUD callback)
    this.onDeltaUpdate = null;     // (deltaSeconds|null, isAhead) => void

    this._tmpVec = new THREE.Vector3();
  }

  // ─── localStorage ───
  _storageKey() {
    return STORAGE_PREFIX + this.worldId;
  }

  /** Sprawdza czy istnieje zapisany rekord (bez ładowania). */
  hasRecord() {
    try {
      return !!localStorage.getItem(this._storageKey());
    } catch (_) {
      return false;
    }
  }

  /** Zwraca zapisany rekord lub null. */
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

  /** Zapisuje rekord do localStorage. */
  saveRecord(frames, timeMs) {
    try {
      const packed = frames.map(f => ([
        f.t,
        +f.x.toFixed(2), +f.y.toFixed(2), +f.z.toFixed(2),
        +f.yaw.toFixed(3), +f.pitch.toFixed(3), +f.roll.toFixed(3)
      ]));
      const payload = {
        v: 1,
        worldId: this.worldId,
        timeMs,
        savedAt: Date.now(),
        frames: packed
      };
      localStorage.setItem(this._storageKey(), JSON.stringify(payload));
      console.log(`👻 [ghost] zapisano rekord ${this.worldId}: ${packed.length} klatek, ${(timeMs/1000).toFixed(3)} s`);
      return true;
    } catch (e) {
      console.warn('[ghost] save failed:', e.message);
      return false;
    }
  }

  /** Usuwa rekord (debug / reset). */
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

  stopRecording() {
    this.recording = false;
  }

  /** Wywoływane w pętli z main.js. */
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
   * Wywoływane gdy user ukończy okrążenie.
   * Zapisuje TYLKO jeśli lepszy czas od poprzedniego rekordu.
   */
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
    this.ghostGroup.visible = true;
    this.trail.line.visible = true;
    this.trail.clear();
    console.log(`👻 [ghost] odtwarzanie (${(this.playback.timeMs/1000).toFixed(3)} s, ${this.playback.frames.length} klatek)`);
  }

  stopPlayback() {
    this.playing = false;
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
   * Wywoływane w głównej pętli — aktualizuje pozycję ducha.
   * @param {number} now             performance.now()
   * @param {number} currentTimeMs   aktualny czas przejazdu gracza (od startu okrążenia)
   * @param {THREE.Vector3} playerPos  aktualna pozycja gracza (do wyliczenia delty 3D)
   */
  update(now, currentTimeMs, playerPos) {
    if (!this.playing || !this.playback) return;

    const t = now - this.playbackStart;
    const frames = this.playback.frames;

    // Znajdź bieżący indeks klatek (interpolacja liniowa)
    while (this.playbackIndex < frames.length - 1 &&
           frames[this.playbackIndex + 1].t <= t) {
      this.playbackIndex++;
    }

    // ─── Koniec playbacku ───
    if (this.playbackIndex >= frames.length - 1 && t > frames[frames.length - 1].t) {
      const last = frames[frames.length - 1];
      this._applyPose(last.x, last.y, last.z, last.yaw, last.pitch, last.roll);

      const timeSinceEnd = t - last.t;
      if (timeSinceEnd > 1500) {
        this.playing = false;
        this.ghostGroup.visible = false;
        this.trail.line.visible = false;
        if (this.onDeltaUpdate) this.onDeltaUpdate(null, false);
        return;
      }

      if (this.onDeltaUpdate && currentTimeMs != null && playerPos) {
        const delta = this._computeDelta(playerPos, currentTimeMs);
        if (delta != null) this.onDeltaUpdate(delta, delta > 0);
      }
      return;
    }

    // ─── Interpolacja bieżącej klatki ducha ───
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

    // ─── Delta czasu — różnica pozycji 3D ───
    if (this.onDeltaUpdate && currentTimeMs != null && playerPos) {
      const delta = this._computeDelta(playerPos, currentTimeMs);
      if (delta != null) {
        const isAhead = delta > 0;
        this.onDeltaUpdate(delta, isAhead);
      }
    }
  }

  /**
   * Szuka w klatkach ducha moment, w którym był NAJBLIŻEJ aktualnej pozycji gracza.
   * Zwraca deltę (t_ghost_w_tym_miejscu - T_gracza) w sekundach.
   *   > 0  →  gracz jest przed duchem (duch doleci tam później)  →  zielony
   *   < 0  →  gracz jest za duchem  (duch już tam był)           →  czerwony
   *   null →  nie udało się policzyć / sanity check failed
   */
  _computeDelta(playerPos, currentTimeMs) {
    if (!this.playback) return null;
    const frames = this.playback.frames;

    // Szukamy tylko w okolicy aktualnego indeksu (perf) — ±60 klatek = ±2 s
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
      if (d2 < bestDist) {
        bestDist = d2;
        best = f;
      }
    }

    if (!best) return null;

    // best.t = czas, w którym duch był w tym miejscu (względem startu okrążenia)
    // currentTimeMs = czas gracza w tym momencie (względem startu okrążenia)
    const deltaMs = best.t - currentTimeMs;
    const deltaSec = deltaMs / 1000;

    // Sanity check — absurdalne wartości pomijamy
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

  /** Kolor ghosta wg delty (zielony = przed, czerwony = za). */
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