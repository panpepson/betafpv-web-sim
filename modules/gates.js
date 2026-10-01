// modules/gates.js
// F1 — Licznik bramek + detekcja przejścia/kolizji z obręczą
// + zmiana koloru po zaliczeniu
// + hook na dźwięk sukcesu (realizowany przez MotorAudio w main.js)
//
// Współpracuje z modules/collisions.js (odbicie B) i main.js (HUD/i18n)

import * as THREE from 'three';

/**
 * Reprezentuje pojedynczą bramkę z detekcją przejścia przez płaszczyznę obręczy.
 */
class Gate {
  constructor(mesh, opts = {}) {
    this.mesh = mesh;
    this.position = mesh.position.clone();
    this.normal = new THREE.Vector3(0, 0, 1)
      .applyQuaternion(mesh.quaternion)
      .normalize();

    // Geometria obręczy — domyślne wartości pasują do TorusGeometry(3, 0.3)
    this.ringRadius = opts.ringRadius ?? 3.0;
    this.ringThickness = opts.ringThickness ?? 0.3;

    // Stan detekcji
    this.passed = false;
    this.prevSide = null;
    this.prevRadialDist = null;
    this.cooldownUntil = 0;

    // Kolor / materiał — zbierz WSZYSTKIE meshe z grupy (ring + ewentualne dodatki)
    this._materials = [];
    this._defaultColors = [];
    this._emissiveIntensity = 0;
    mesh.traverse((child) => {
      if (child.isMesh && child.material) {
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach((m) => {
          this._materials.push(m);
          this._defaultColors.push(m.color ? m.color.clone() : new THREE.Color(0xff0066));
        });
      }
    });
  }

  /**
   * Ustawia stan zaliczenia + zmienia kolor na zielony (emissive).
   * @param {THREE.Color|number} color
   */
  markPassed(color = 0x00ff66) {
    if (this.passed) return;
    this.passed = true;
    const c = new THREE.Color(color);
    this._materials.forEach((m, i) => {
      if (m.color) m.color.copy(c);
      if ('emissive' in m) {
        m.emissive = m.emissive || new THREE.Color();
        m.emissive.copy(c);
        m.emissiveIntensity = 0.6;
      }
      m.needsUpdate = true;
    });
    this._emissiveIntensity = 0.6;
  }

  /**
   * Przywraca domyślny kolor (przy reset).
   */
  resetColor() {
    this._materials.forEach((m, i) => {
      if (m.color && this._defaultColors[i]) m.color.copy(this._defaultColors[i]);
      if ('emissive' in m && m.emissive) m.emissive.setHex(0x000000);
      if ('emissiveIntensity' in m) m.emissiveIntensity = 0;
      m.needsUpdate = true;
    });
    this._emissiveIntensity = 0;
  }

  /** Pulsowanie — do wywołania w pętli z dt (opcjonalne) */
  tick(dt) {
    if (!this.passed) return;
    this._emissiveIntensity = Math.max(
      0.2,
      0.6 + Math.sin(performance.now() * 0.006) * 0.25
    );
    this._materials.forEach((m) => {
      if ('emissiveIntensity' in m) m.emissiveIntensity = this._emissiveIntensity;
    });
  }
}

export class GateTracker {
  constructor(gates = [], opts = {}) {
    this.gates = gates.map((g) =>
      g instanceof Gate ? g : new Gate(g, opts)
    );

    this.droneRadius = opts.droneRadius ?? 0.6;
    this.restitution = opts.restitution ?? 0.45;
    this.passCooldownMs = opts.passCooldownMs ?? 600;

    // Kolor zaliczonej bramki (można nadpisać)
    this.passedColor = opts.passedColor ?? 0x00ff66;

    /** @type {(gate:Gate)=>void} */
    this.onGatePassed = null;
    /** @type {(gate:Gate, hit:object)=>void} */
    this.onGateHit = null;
    /** @type {(progress:{passed:number,total:number,timeMs:number,finished?:boolean})=>void} */
    this.onProgress = null;
    /** @type {()=>void} — wywołane po zaliczeniu WSZYSTKICH bramek */
    this.onFinish = null;

    this.startTime = performance.now();
    this.finished = false;

    this._tmpA = new THREE.Vector3();
    this._tmpB = new THREE.Vector3();
  }

  reset() {
    for (const g of this.gates) {
      g.passed = false;
      g.prevSide = null;
      g.prevRadialDist = null;
      g.cooldownUntil = 0;
      g.resetColor();
    }
    this.startTime = performance.now();
    this.finished = false;
    this._emitProgress();
  }

  get progress() {
    return {
      passed: this.gates.filter((g) => g.passed).length,
      total: this.gates.length,
      timeMs: performance.now() - this.startTime
    };
  }

  /**
   * Wywoływane co klatkę z aktualną pozycją drona.
   * Zwraca listę trafień (do obsługi odbicia przez collisions.js).
   */
  update(dronePos, dt, now = performance.now()) {
    const hits = [];

    for (let idx = 0; idx < this.gates.length; idx++) {
      const gate = this.gates[idx];

      // Pulsowanie zaliczonej bramki
      if (gate.tick) gate.tick(dt);

      // Wektor od środka bramki do drona
      const toDrone = this._tmpA.copy(dronePos).sub(gate.position);
      const along = toDrone.dot(gate.normal);

      // Rzut na płaszczyznę obręczy (radialny wektor)
      const radialVec = this._tmpB
        .copy(gate.normal)
        .multiplyScalar(along);
      const radialOnly = toDrone.clone().sub(radialVec);
      const radialDist = radialOnly.length();

      // === 1) KOLIZJA Z OBRĘCZĄ ===
      const ringInner = gate.ringRadius - gate.ringThickness;
      const ringOuter = gate.ringRadius + gate.ringThickness;
      const inRingBand = radialDist >= ringInner && radialDist <= ringOuter;
      const nearPlane = Math.abs(along) < this.droneRadius + gate.ringThickness;

      if (inRingBand && nearPlane && radialDist > 0.001) {
        const normal = radialOnly.clone().normalize();
        hits.push({
          gate,
          normal,
          restitution: this.restitution,
          penetration:
            this.droneRadius + gate.ringThickness - Math.abs(along)
        });
        if (this.onGateHit) this.onGateHit(gate, hits[hits.length - 1]);
      }

      // === 2) PRZEJŚCIE PRZEZ ŚRODEK ===
      // Tolerancja: "inside" jeśli w tej LUB poprzedniej klatce byliśmy w obręczy
      // + rozszerzenie strefy o połowę promienia drona (Poprawka C)
      const ringInnerTolerant = ringInner + this.droneRadius * 0.5;
      const insideRingNow  = radialDist < ringInnerTolerant;
      const insideRingPrev =
        gate.prevRadialDist !== null && gate.prevRadialDist < ringInnerTolerant;
      const insideRing = insideRingNow || insideRingPrev;

      const canPass = now >= gate.cooldownUntil && !gate.passed;

      if (gate.prevSide !== null && insideRing && canPass) {
        // Poprawka A — zaliczaj w OBIE strony
        const crossed =
          (gate.prevSide < 0 && along >= 0) ||
          (gate.prevSide > 0 && along <= 0);

        if (crossed) {
          gate.markPassed(this.passedColor);
          gate.cooldownUntil = now + this.passCooldownMs;

          if (this.onGatePassed) this.onGatePassed(gate, idx);
          this._emitProgress();

          if (!this.finished && this.gates.every((g) => g.passed)) {
            this.finished = true;
            if (this.onFinish) this.onFinish();
            if (this.onProgress) {
              this.onProgress({ ...this.progress, finished: true });
            }
          }
        }
      }

      gate.prevSide = along;
      gate.prevRadialDist = radialDist;
    }

    return hits;
  }

  _emitProgress() {
    if (this.onProgress) this.onProgress(this.progress);
  }

  dispose() {
    this.onGatePassed = null;
    this.onGateHit = null;
    this.onProgress = null;
    this.onFinish = null;
    this.gates = [];
  }
}