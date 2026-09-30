// ================================================================
// KOLIZJE — odbicie od przeszkód
// ================================================================

import * as THREE from 'three';

export class CollisionSystem {
  constructor() {
    this.objects = [];  // lista wszystkich colliderów
  }

  // ─── Dodawanie colliderów ───
  addSphere(center, radius, meta = {}) {
    this.objects.push({
      type: 'sphere',
      center: center.clone(),
      radius,
      meta
    });
  }

  addBox(min, max, meta = {}) {
    this.objects.push({
      type: 'box',
      min: min.clone(),
      max: max.clone(),
      meta
    });
  }

  // ─── Sprawdzanie kolizji ───
  // Zwraca { hit, normal, depth } lub null
  check(dronePos, droneRadius = 0.5) {
    for (const obj of this.objects) {
      if (obj.type === 'sphere') {
        const result = this._checkSphere(dronePos, droneRadius, obj);
        if (result) return result;
      } else if (obj.type === 'box') {
        const result = this._checkBox(dronePos, droneRadius, obj);
        if (result) return result;
      }
    }
    return null;
  }

  _checkSphere(pos, radius, sphere) {
    const diff = new THREE.Vector3().subVectors(pos, sphere.center);
    const dist = diff.length();
    const minDist = radius + sphere.radius;

    if (dist < minDist) {
      const normal = diff.normalize();
      const depth = minDist - dist;
      return { hit: true, normal, depth, obj: sphere };
    }
    return null;
  }

  _checkBox(pos, radius, box) {
    // Najbliższy punkt na AABB
    const closest = new THREE.Vector3(
      Math.max(box.min.x, Math.min(pos.x, box.max.x)),
      Math.max(box.min.y, Math.min(pos.y, box.max.y)),
      Math.max(box.min.z, Math.min(pos.z, box.max.z))
    );

    const diff = new THREE.Vector3().subVectors(pos, closest);
    const dist = diff.length();

    if (dist < radius) {
      // Normalna — kierunek od najbliższego punktu do drona
      let normal;
      if (dist > 0.0001) {
        normal = diff.normalize();
      } else {
        // Dron jest wewnątrz boxa — wybierz najbliższą ścianę
        const distToMin = pos.clone().sub(box.min);
        const distToMax = box.max.clone().sub(pos);
        const minDist = Math.min(
          distToMin.x, distToMax.x,
          distToMin.y, distToMax.y,
          distToMin.z, distToMax.z
        );
        normal = new THREE.Vector3();
        if (minDist === distToMin.x) normal.set(-1, 0, 0);
        else if (minDist === distToMax.x) normal.set(1, 0, 0);
        else if (minDist === distToMin.y) normal.set(0, -1, 0);
        else if (minDist === distToMax.y) normal.set(0, 1, 0);
        else if (minDist === distToMin.z) normal.set(0, 0, -1);
        else normal.set(0, 0, 1);
      }

      const depth = radius - dist;
      return { hit: true, normal, depth, obj: box };
    }
    return null;
  }

  // ─── Odbicie z tłumieniem (wariant B) ───
  reflect(velocity, normal, restitution = 0.4) {
    // v' = v - (1 + e) * (v · n) * n
    const dot = velocity.dot(normal);
    if (dot > 0) return velocity.clone();  // już się oddala — nie odbijaj
    const reflected = velocity.clone().sub(normal.clone().multiplyScalar((1 + restitution) * dot));
    return reflected.multiplyScalar(restitution);
  }

  clear() {
    this.objects = [];
  }

  get count() {
    return this.objects.length;
  }
}
