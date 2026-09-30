// modules/gates.js
// F1 — Licznik bramek + detekcja przejścia/kolizji z obręczą
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

    // Geometria obręczy — domyślne wartości pasują do TorusGeometry w scenach
    this.ringRadius = opts.ringRadius ?? 1.5;
    this.ringThickness = opts.ringThickness ?? 0.15;

    this.passed = false;
    this.prevSide = null;
    this.cooldownUntil = 0; // ms — zapobiega wielokrotnemu zaliczeniu
  }
}

export class GateTracker {
  constructor(gates = [], opts = {}) {
    this.gates = gates.map(g =>
      g instanceof Gate ? g : new Gate(g, opts)
    );
    this.droneRadius = opts.droneRadius ?? 0.35;
    this.restitution = opts.restitution ?? 0.45;
    this.passCooldownMs = opts.passCooldownMs ?? 600;

    /** @type {(gate:Gate)=>void} */
    this.onGatePassed = null;
    /** @type {(gate:Gate, hit:object)=>void} */
    this.onGateHit = null;
    /** @type {(progress:{passed:number,total:number,timeMs:number})=>void} */
    this.onProgress = null;

    this.startTime = performance.now();
    this.finished = false;

    this._tmpA = new THREE.Vector3();
    this._tmpB = new THREE.Vector3();
  }

  reset() {
    for (const g of this.gates) {
      g.passed = false;
      g.prevSide = null;
      g.cooldownUntil = 0;
    }
    this.startTime = performance.now();
    this.finished = false;
    this._emitProgress();
  }

  get progress() {
    return {
      passed: this.gates.filter(g => g.passed).length,
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

    for (const gate of this.gates) {
      // Wektor od środka bramki do drona
      const toDrone = this._tmpA.copy(dronePos).sub(gate.position);
      const along = toDrone.dot(gate.normal);

      // Rzut na płaszczyznę obręczy (radialny wektor)
      const radial = this._tmpB
        .copy(gate.normal)
        .multiplyScalar(along);
      const radialVec = toDrone.clone().sub(radial);
      const radialDist = radialVec.length();

      // === 1) KOLIZJA Z OBRĘCZĄ ===
      const ringInner = gate.ringRadius - gate.ringThickness;
      const ringOuter = gate.ringRadius + gate.ringThickness;
      const inRingBand = radialDist >= ringInner && radialDist <= ringOuter;
      const nearPlane = Math.abs(along) < this.droneRadius + gate.ringThickness;

      if (inRingBand && nearPlane && radialDist > 0.001) {
        const normal = radialVec.clone().normalize();
        hits.push({
          gate,
          normal,
          restitution: this.restitution,
          penetration: (this.droneRadius + gate.ringThickness) - Math.abs(along)
        });
        if (this.onGateHit) this.onGateHit(gate, hits[hits.length - 1]);
      }

      // === 2) PRZEJŚCIE PRZEZ ŚRODEK ===
      const insideRing = radialDist < ringInner;
      const canPass = now >= gate.cooldownUntil && !gate.passed;

      if (gate.prevSide !== null && insideRing && canPass) {
        const crossedForward = gate.prevSide < 0 && along >= 0;
        const crossedBackward = gate.prevSide > 0 && along <= 0;

        // Liczymy tylko przelot w „dobrą" stronę (normal * -1 → normal)
        // jeśli chcesz dwustronnie — usuń warunek crossedForward
        if (crossedForward) {
          gate.passed = true;
          gate.cooldownUntil = now + this.passCooldownMs;
          if (this.onGatePassed) this.onGatePassed(gate);
          this._emitProgress();

          if (!this.finished && this.gates.every(g => g.passed)) {
            this.finished = true;
            if (this.onProgress) {
              this.onProgress({ ...this.progress, finished: true });
            }
          }
        } else if (crossedBackward) {
          // opcjonalnie: cofnij zaliczenie (turniejowo bywa różnie)
          // gate.passed = false; this._emitProgress();
        }
      }

      gate.prevSide = along;
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
    this.gates = [];
  }
}