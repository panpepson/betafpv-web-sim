// worlds/minecraft.js
// 🌳 UKRYTY ŚWIAT — Minecraft bonus.
// Mały świat: niskie drzewa, owce, ludki (villager-like), bramki.
// Odblokowywany klawiszem "O" w symulatorze.

import { makeWorld } from './_schema.js';

export default makeWorld({
  id: 'minecraft',
  name: 'MINECRAFT — ukryty bonus 🌳',
  description: 'Ukryty świat bonusowy. Owce, ludki, niskie drzewa. Czysta zabawa.',

  physics: {
    mode: 'arcade',
    gravity: -7.0,
    thrustFactor: 16,
    pitchRollGain: 0.75,
    yawRate: 2.2,
    visualTilt: 0.25,
    drag: 0.992,
    maxSpeed: 18,
    maxAltitude: 150,
    throttleHover: 0.5,
  },

  camera: { angle: 0, angles: [0, 20, 35] },
  sky:   { top: 0x6fb8ff, bottom: 0xc8e8ff },   // jasne, blockowe niebo
  fog:   { near: 80, far: 500 },
  spawn: { x: 0, y: 6, z: 20 },

  // ─── Niskie, "blokowe" drzewa ───
  trees: [
    { x:  10, z: -12, scale: 0.8 },
    { x: -14, z:  10, scale: 0.9 },
    { x:  22, z:  18, scale: 0.7 },
    { x:  -6, z: -28, scale: 0.8 },
    { x:  28, z: -35, scale: 0.9 },
    { x: -28, z:  30, scale: 0.7 },
    { x:   4, z:  38, scale: 0.8 },
    { x: -36, z: -12, scale: 0.9 },
    { x:  40, z:   6, scale: 0.7 },
    { x: -45, z:  20, scale: 0.8 },
    { x:  16, z: -50, scale: 0.9 },
    { x: -20, z: -55, scale: 0.7 },
    { x:  50, z: -28, scale: 0.8 },
    { x:  -8, z:  55, scale: 0.7 },
    { x:  60, z:  40, scale: 0.8 },
  ],

  // ─── Bramki — kolorowe, przyjazne ───
  gates: [
    { x:   0, y: 3, z:  -15, yaw: 0 },
    { x:  18, y: 4, z:  -32, yaw: Math.PI / 5 },
    { x: -22, y: 5, z:  -48, yaw: -Math.PI / 4 },
    { x:  35, y: 4, z:  -62, yaw: Math.PI / 6 },
    { x: -12, y: 6, z:  -85, yaw: -Math.PI / 3 },
    { x:  28, y: 4, z: -105, yaw: Math.PI / 4 },
    { x: -30, y: 5, z: -125, yaw: 0 },
    { x:  10, y: 3, z: -145, yaw: -Math.PI / 6 },
  ],

  // ─── "Blokowe" boxy w stylu Minecrafta ───
  boxes: [
    // trawa-bloki
    { x:   6, z: -22, w: 2, h: 2, d: 2, color: 0x6ab04c },
    { x:  -8, z: -18, w: 2, h: 2, d: 2, color: 0x6ab04c },
    { x:  22, z:  -8, w: 2, h: 2, d: 2, color: 0x6ab04c },
    { x: -18, z: -35, w: 2, h: 2, d: 2, color: 0x6ab04c },
    { x:  42, z: -18, w: 2, h: 2, d: 2, color: 0x6ab04c },
    { x: -38, z:  25, w: 2, h: 2, d: 2, color: 0x6ab04c },

    // "stone" i "dirt" — większe bloki
    { x:   0, z: -45, w: 3, h: 3, d: 3, color: 0x8a8a8a },  // stone
    { x: -28, z: -18, w: 3, h: 2, d: 3, color: 0x8b5a2b },  // dirt
    { x:  38, z: -50, w: 3, h: 3, d: 3, color: 0x8a8a8a },  // stone
    { x:  -6, z: -70, w: 3, h: 2, d: 3, color: 0x8b5a2b },  // dirt

    // "diamond block" — błyszczące (cyan)
    { x:  15, z: -75, w: 2, h: 2, d: 2, color: 0x44ffff },
    { x: -20, z: -95, w: 2, h: 2, d: 2, color: 0x44ffff },

    // "gold block" — złote (żółte)
    { x:  30, z: -90, w: 2, h: 2, d: 2, color: 0xffcc00 },
    { x: -10, z: -110, w: 2, h: 2, d: 2, color: 0xffcc00 },

    // "redstone" — czerwone
    { x:  20, z: -125, w: 2, h: 2, d: 2, color: 0xff4444 },
    { x: -25, z: -140, w: 2, h: 2, d: 2, color: 0xff4444 },
  ],

  // ─── Niskie "wzgórza" (jak kopce w Minecrafcie) ───
  hills: [
    { x: -60, z: -70, radius: 20, heightScale: 0.4 },
    { x:  75, z: -90, radius: 22, heightScale: 0.5 },
    { x: -80, z:  60, radius: 18, heightScale: 0.45 },
  ],

  // ─── Woda ───
  water: { x: 70, z: 60, w: 120, d: 90 },

  // ─── 🐑 Owce ───
  sheep: [
    { x:   8, z:  -5, scale: 1.0 },
    { x:  -5, z:  15, scale: 0.9 },
    { x:  18, z:  28, scale: 1.1 },
    { x: -22, z:  -8, scale: 1.0 },
    { x:  35, z: -20, scale: 0.9 },
    { x: -40, z:  35, scale: 1.0 },
    { x:  12, z:  50, scale: 1.1 },
    { x: -30, z: -45, scale: 0.9 },
  ],

  // ─── 🧑‍🌾 Ludki (villager-like) ───
  villagers: [
    { x:   0, z:  -8, scale: 1.0 },
    { x: -10, z: -20, scale: 1.0 },
    { x:  25, z: -40, scale: 1.0 },
    { x: -18, z: -60, scale: 1.0 },
    { x:  40, z: -80, scale: 1.0 },
    { x: -35, z: -100, scale: 1.0 },
  ],
});