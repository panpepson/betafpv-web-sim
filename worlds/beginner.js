// worlds/beginner.js
// Łatwa plansza — nauka podstaw. Mało przeszkód, mała grawitacja, wolny lot.

import { makeWorld } from './_schema.js';

export default makeWorld({
  id: 'beginner',
  name: 'ŁATWA — cinewhoop (nauka)',
  description: 'Nauka podstaw. Mało przeszkód, mała grawitacja, wolny lot.',

  physics: {
    mode: 'arcade',
    gravity: -7.5,
    thrustFactor: 14,
    pitchRollGain: 0.55,
    yawRate: 1.8,
    visualTilt: 0.20,
    drag: 0.993,
    maxSpeed: 14,
    maxAltitude: 120,
    throttleHover: 0.5,
  },

  camera: { angle: 0, angles: [0, 20, 35] },
  sky:   { top: 0x4a90e2, bottom: 0xc9e4ff },
  fog:   { near: 100, far: 700 },
  spawn: { x: 0, y: 8, z: 0 },

  trees: [
    { x:  15, z: -10, scale: 1.2 },
    { x: -20, z:  20, scale: 1.0 },
    { x:  30, z:  30, scale: 1.5 },
    { x: -10, z: -30, scale: 1.1 },
    { x:  40, z: -40, scale: 1.3 },
    { x: -40, z:  40, scale: 0.9 },
    { x:   5, z:  50, scale: 1.2 },
  ],

  gates: [
    { x:  0, y: 3, z: -15, yaw: 0 },
    { x: 20, y: 4, z: -35, yaw: Math.PI / 4 },
  ],

  boxes: [
    { x:   0, z: -25, w: 6, h: 1.5, d: 6, color: 0xff4444 },
    { x: -15, z:   0, w: 8, h: 1.0, d: 8, color: 0xffcc00 },
  ],

  hills: [
    { x: -60, z: -80, radius: 30, heightScale: 0.5 },
  ],

  water: { x: 80, z: 60, w: 120, d: 90 },
});