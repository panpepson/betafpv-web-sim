// modules/gates.js
// F1 — Licznik bramek + detekcja przejścia/kolizji z obręczą

import * as THREE from 'three';

class Gate {
  constructor(mesh, opts = {}) {
    this.mesh = mesh;
    this.position = mesh.position.clone();
    this.normal = new THREE.Vector3(0, 0, 1)
      .applyQuaternion(mesh.quaternion)
      .normalize();

    this.ringRadius = opts.ringRadius ?? 3.0;
    this.ringThickness = opts.ringThickness ?? 0.3;

    this.passed = false;
    this.prevSide = null;
    this.prevRadialDist = null;
    this.cooldownUntil = 0;

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

  markPassed(color = 0x00ff66) {
    if (this.passed) return;
    this.passed = true;
    const c = new THREE.Color(color);
    this._materials.forEach((m) => {
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

  resetColor() {
    this._materials.forEach((m, i) => {
      if (m.color && this._defaultColors[i]) m.color.copy(this._defaultColors[i]);
      if ('emissive' in m && m.emissive) m.emissive.setHex(0x000000);
      if ('emissiveIntensity' in m) m.emissiveIntensity = 0;
      m.needsUpdate = true;
    });
    this._emissiveIntensity = 0;
  }

  resetOne() {
    this.passed = false;
    this.prevSide = null;
    this.prevRadialDist = null;
    this.cooldownUntil = 0;
    this.resetColor();
  }

  tick(dt) {
    if (!this.passed) return;
    this._emissiveIntensity = Math.max(0.2, 0.6 + Math.sin(performance.now() * 0.006) * 0.25);
    this._materials.forEach((m) => {
      if ('emissiveIntensity' in m) m.emissiveIntensity = this._emissiveIntensity;
    });
  }
}

export class GateTracker {
  constructor(gates = [], opts = {}) {
    this.gates = gates.map((g) => g instanceof Gate ? g : new Gate(g, opts));
    this.droneRadius = opts.droneRadius ?? 0.6;
    this.restitution = opts.restitution ?? 0.45;
    this.passCooldownMs = opts.passCooldownMs ?? 600;
    this.passedColor = opts.passedColor ?? 0x00ff66;

    this.onGatePassed = null;
    this.onGateHit = null;
    this.onProgress = null;
    this.onFinish = null;

    this.startTime = performance.now();
    this.finished = false;
    this.finishTime = null;

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
    this.finishTime = null;
    this._emitProgress();
  }

  restart() { this.reset(); }

  get progress() {
    return {
      passed: this.gates.filter((g) => g.passed).length,
      total: this.gates.length,
      timeMs: performance.now() - this.startTime
    };
  }

  update(dronePos, dt, now = performance.now()) {
    const hits = [];
    for (let idx = 0; idx < this.gates.length; idx++) {
      const gate = this.gates[idx];
      if (gate.tick) gate.tick(dt);

      const toDrone = this._tmpA.copy(dronePos).sub(gate.position);
      const along = toDrone.dot(gate.normal);
      const radialVec = this._tmpB.copy(gate.normal).multiplyScalar(along);
      const radialOnly = toDrone.clone().sub(radialVec);
      const radialDist = radialOnly.length();

      const ringInner = gate.ringRadius - gate.ringThickness;
      const ringOuter = gate.ringRadius + gate.ringThickness;
      const inRingBand = radialDist >= ringInner && radialDist <= ringOuter;
      const nearPlane = Math.abs(along) < this.droneRadius + gate.ringThickness;

      if (inRingBand && nearPlane && radialDist > 0.001) {
        const normal = radialOnly.clone().normalize();
        hits.push({
          gate, normal,
          restitution: this.restitution,
          penetration: this.droneRadius + gate.ringThickness - Math.abs(along)
        });
        if (this.onGateHit) this.onGateHit(gate, hits[hits.length - 1]);
      }

      const ringInnerTolerant = ringInner + this.droneRadius * 0.5;
      const insideRingNow  = radialDist < ringInnerTolerant;
      const insideRingPrev = gate.prevRadialDist !== null && gate.prevRadialDist < ringInnerTolerant;
      const insideRing = insideRingNow || insideRingPrev;

      if (gate.prevSide !== null && insideRing) {
        const crossed =
          (gate.prevSide < 0 && along >= 0) ||
          (gate.prevSide > 0 && along <= 0);

        if (crossed) {
          const canPass = now >= gate.cooldownUntil && !gate.passed;
          if (canPass) {
            gate.markPassed(this.passedColor);
            gate.cooldownUntil = now + this.passCooldownMs;
            if (this.onGatePassed) this.onGatePassed(gate, idx);
            this._emitProgress();

            if (!this.finished && this.gates.every((g) => g.passed)) {
              this.finished = true;
              this.finishTime = now;
              if (this.onFinish) this.onFinish();
              if (this.onProgress) this.onProgress({ ...this.progress, finished: true });
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