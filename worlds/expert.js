// worlds/expert.js
// Ekspert — realistyczna fizyka racera. 9.81 grawitacji, bezwładność kątowa.

import { makeWorld } from './_schema.js';

export default makeWorld({
  id: 'expert',
  name: 'EKSPERT — wyścigowy FPV (realistyczna fizyka)',
  description: 'Realistyczna fizyka racera: przechył → siła pozioma, bezwładność kątowa, grawitacja 9.81.',

  physics: {
    mode: 'realistic',
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
  },

  camera: { angle: 20, angles: [0, 20, 35] },
  sky:   { top: 0x2a5a92, bottom: 0x7a9ab8 },
  fog:   { near: 50, far: 400 },
  spawn: { x: 0, y: 4, z: 30 },

  trees: [
    { x:   8, z:  -8, scale: 1.4 }, { x: -12, z:  12, scale: 1.2 },
    { x:  22, z:  22, scale: 1.7 }, { x:  -6, z: -22, scale: 1.3 },
    { x:  30, z: -30, scale: 1.5 }, { x: -30, z:  30, scale: 1.1 },
    { x:   4, z:  40, scale: 1.4 }, { x: -40, z: -12, scale: 1.5 },
    { x:  45, z:   8, scale: 1.2 }, { x: -55, z:  22, scale: 1.3 },
    { x:  18, z: -50, scale: 1.4 }, { x: -22, z: -55, scale: 1.2 },
    { x:  50, z: -22, scale: 1.6 }, { x:  -8, z:  55, scale: 1.3 },
    { x:  65, z:  35, scale: 1.4 }, { x:  12, z:  70, scale: 1.5 },
    { x: -70, z:  45, scale: 1.1 }, { x:  75, z: -45, scale: 1.3 },
    { x: -45, z: -70, scale: 1.4 }, { x:  85, z:  15, scale: 1.2 },
  ],

  gates: [
    { x:   0, y: 3, z:  -15, yaw: 0 },
    { x:  20, y: 4, z:  -35, yaw: Math.PI / 4 },
    { x: -25, y: 5, z:  -50, yaw: -Math.PI / 3 },
    { x:  40, y: 6, z:  -65, yaw: Math.PI / 6 },
    { x: -10, y: 7, z:  -90, yaw: -Math.PI / 4 },
    { x:  30, y: 4, z: -110, yaw: 0 },
    { x: -40, y: 5, z: -130, yaw: Math.PI / 3 },
    { x:  50, y: 3, z: -150, yaw: -Math.PI / 6 },
    { x: -20, y: 4, z: -170, yaw: 0 },
    { x:  15, y: 5, z: -190, yaw: Math.PI / 4 },
  ],

  boxes: [
    { x:   0, z: -25, w: 4, h: 2.0, d: 4, color: 0xff4444 },
    { x: -15, z:   5, w: 6, h: 1.0, d: 6, color: 0xffcc00 },
    { x:  25, z:  -8, w: 3, h: 3.0, d: 3, color: 0xcc44ff },
    { x: -25, z: -18, w: 8, h: 0.5, d: 8, color: 0x44ffff },
    { x:  45, z: -22, w: 5, h: 2.5, d: 5, color: 0xff8800 },
    { x: -50, z:  15, w: 4, h: 4.0, d: 4, color: 0x00ccff },
    { x:  60, z:   5, w: 3, h: 5.0, d: 3, color: 0xff00ff },
    { x: -35, z: -40, w: 7, h: 1.0, d: 7, color: 0x00ff88 },
  ],

  hills: [
    { x: -80, z: -100, radius: 40, heightScale: 0.5 },
    { x: 100, z: -120, radius: 35, heightScale: 0.6 },
    { x: -50, z: -200, radius: 45, heightScale: 0.7 },
  ],

  water: { x: 90, z: 80, w: 180, d: 130 },
});