// worlds/intermediate.js
// Średnia plansza — trening. Więcej drzew i bramek, większa zwrotność.

import { makeWorld } from './_schema.js';

export default makeWorld({
  id: 'intermediate',
  name: 'ŚREDNIA — dron filmowy',
  description: 'Trening. Więcej drzew i bramek, większa zwrotność i prędkość.',

  physics: {
    mode: 'arcade',
    gravity: -9.0,
    thrustFactor: 22,
    pitchRollGain: 1.10,
    yawRate: 2.8,
    visualTilt: 0.35,
    drag: 0.988,
    maxSpeed: 25,
    maxAltitude: 180,
    throttleHover: 0.5,
  },

  camera: { angle: 0, angles: [0, 20, 35] },
  sky:   { top: 0x3a7ac2, bottom: 0xa8d0e8 },
  fog:   { near: 80, far: 500 },
  spawn: { x: 0, y: 6, z: 20 },

  trees: [
    { x:  10, z: -10, scale: 1.3 }, { x: -15, z:  15, scale: 1.1 },
    { x:  25, z:  25, scale: 1.6 }, { x:  -8, z: -25, scale: 1.2 },
    { x:  35, z: -35, scale: 1.4 }, { x: -35, z:  35, scale: 1.0 },
    { x:   5, z:  45, scale: 1.3 }, { x: -45, z: -15, scale: 1.4 },
    { x:  50, z:  10, scale: 1.1 }, { x: -60, z:  25, scale: 1.2 },
    { x:  20, z: -55, scale: 1.3 }, { x: -25, z: -60, scale: 1.1 },
    { x:  55, z: -25, scale: 1.5 }, { x: -10, z:  60, scale: 1.2 },
    { x:  70, z:  40, scale: 1.3 },
  ],

  gates: [
    { x:   0, y: 4, z:  -20, yaw: 0 },
    { x:  25, y: 5, z:  -45, yaw: Math.PI / 3 },
    { x: -30, y: 6, z:  -60, yaw: -Math.PI / 4 },
    { x:  50, y: 7, z:  -75, yaw: Math.PI / 6 },
    { x: -15, y: 8, z: -100, yaw: -Math.PI / 3 },
    { x:  35, y: 5, z: -120, yaw: 0 },
  ],

  boxes: [
    { x:   0, z: -30, w: 5, h: 2.0, d: 5, color: 0xff4444 },
    { x: -20, z:   5, w: 7, h: 1.2, d: 7, color: 0xffcc00 },
    { x:  30, z: -10, w: 4, h: 3.0, d: 4, color: 0xcc44ff },
    { x: -35, z: -20, w: 9, h: 0.6, d: 9, color: 0x44ffff },
    { x:  55, z: -25, w: 6, h: 2.5, d: 6, color: 0xff8800 },
  ],

  hills: [
    { x: -70, z:  -90, radius: 35, heightScale: 0.5 },
    { x:  90, z: -110, radius: 30, heightScale: 0.6 },
  ],

  water: { x: 80, z: 70, w: 140, d: 100 },
});