// worlds/expert_race.js
// RACE — 45° kamera, zero bezwładności kątowej, ciasny tor. Czysty wyścig.

import { makeWorld } from './_schema.js';

export default makeWorld({
  id: 'expert_race',
  name: 'RACE — wyścigowy (45° kamera, zero inercji)',
  description: 'Kamera 45°, zero bezwładności, ciasny tor. Czysty wyścig.',

  physics: {
    mode: 'realistic',
    gravity: -9.81,
    hoverThrottle: 0.5,
    thrustFactor: 50,
    pitchRollRate: 5.0,
    yawRate: 5.0,
    angularInertia: 1.0,          // ← 1.0 = zero inercji (pitch/roll = target natychmiast)
    angularDamping: 20.0,
    airDrag: 0.08,
    airDragQuadratic: 0.008,
    maxTiltAngle: Math.PI / 3,
    maxSpeed: 60,
    maxAltitude: 300,
  },

  camera: { angle: 45, angles: [20, 35, 45] },
  sky:   { top: 0x1a2a52, bottom: 0x6a8aa8 },
  fog:   { near: 40, far: 350 },
  spawn: { x: 0, y: 3, z: 20 },

  trees: [
    { x:  15, z:  -5, scale: 1.2 }, { x: -18, z:  10, scale: 1.3 },
    { x:  25, z:  20, scale: 1.4 }, { x: -10, z: -20, scale: 1.1 },
    { x:  35, z: -30, scale: 1.3 }, { x: -30, z:  25, scale: 1.2 },
    { x:   8, z:  35, scale: 1.3 }, { x: -40, z: -10, scale: 1.4 },
    { x:  45, z:   5, scale: 1.2 }, { x: -50, z:  20, scale: 1.3 },
    { x:  20, z: -45, scale: 1.3 }, { x: -25, z: -50, scale: 1.2 },
  ],

  // Ciasny tor — 12 bramek, mały rozrzut X/Z
  gates: [
    { x:   0, y: 2, z:  -10, yaw: 0 },
    { x:   8, y: 3, z:  -22, yaw: Math.PI / 6 },
    { x:  -6, y: 4, z:  -35, yaw: -Math.PI / 4 },
    { x:  15, y: 5, z:  -48, yaw: Math.PI / 3 },
    { x: -12, y: 3, z:  -62, yaw: -Math.PI / 6 },
    { x:  20, y: 6, z:  -75, yaw: Math.PI / 4 },
    { x:  -8, y: 4, z:  -90, yaw: 0 },
    { x:  25, y: 3, z: -105, yaw: -Math.PI / 3 },
    { x: -15, y: 5, z: -120, yaw: Math.PI / 6 },
    { x:  18, y: 4, z: -135, yaw: 0 },
    { x: -10, y: 3, z: -150, yaw: Math.PI / 4 },
    { x:   5, y: 2, z: -165, yaw: 0 },
  ],

  boxes: [
    { x:   0, z: -18, w: 3, h: 2.0, d: 3, color: 0xff4444 },
    { x: -12, z:   8, w: 5, h: 1.0, d: 5, color: 0xffcc00 },
    { x:  18, z:  -5, w: 3, h: 3.0, d: 3, color: 0xcc44ff },
    { x: -20, z: -15, w: 6, h: 0.5, d: 6, color: 0x44ffff },
    { x:  30, z: -20, w: 4, h: 2.0, d: 4, color: 0xff8800 },
    { x: -35, z:  12, w: 3, h: 4.0, d: 3, color: 0x00ccff },
  ],

  hills: [
    { x: -70, z:  -80, radius: 30, heightScale: 0.5 },
    { x:  90, z: -100, radius: 30, heightScale: 0.5 },
  ],

  water: { x: 70, z: 50, w: 100, d: 80 },
});