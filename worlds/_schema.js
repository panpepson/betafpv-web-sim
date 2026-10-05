// worlds/_schema.js
// Generator świata — waliduje dane i uzupełnia domyślne wartości.
// Dzięki temu każdy tor jest opisany zwięźle, a błędy łapane są od razu.

const DEFAULT_SKY = { top: 0x4a90e2, bottom: 0xc9e4ff };

/**
 * Tworzy znormalizowany obiekt świata.
 * Rzuca błędem z konkretną ścieżką, jeśli dane są niepoprawne.
 */
export function makeWorld(raw) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('[makeWorld] świat musi być obiektem');
  }
  if (!raw.id) throw new Error('[makeWorld] brak pola "id"');
  if (!raw.name) throw new Error(`[makeWorld:${raw.id}] brak pola "name"`);

  const phys = raw.physics || {};
  if (phys.mode !== 'arcade' && phys.mode !== 'realistic') {
    throw new Error(`[makeWorld:${raw.id}] physics.mode musi być "arcade" albo "realistic"`);
  }

  return {
    id: raw.id,
    name: raw.name,
    description: raw.description || '',

    physics: {
      mode: phys.mode,
      // arcade
      gravity: phys.gravity ?? -9.81,
      thrustFactor: phys.thrustFactor ?? 22,
      pitchRollGain: phys.pitchRollGain ?? 1.0,
      yawRate: phys.yawRate ?? 2.8,
      visualTilt: phys.visualTilt ?? 0.35,
      drag: phys.drag ?? 0.99,
      throttleHover: phys.throttleHover ?? 0.5,
      // realistic
      hoverThrottle: phys.hoverThrottle ?? 0.5,
      pitchRollRate: phys.pitchRollRate ?? 2.8,
      angularInertia: phys.angularInertia ?? 0.94,
      angularDamping: phys.angularDamping ?? 8.0,
      airDrag: phys.airDrag ?? 0.10,
      airDragQuadratic: phys.airDragQuadratic ?? 0.010,
      maxTiltAngle: phys.maxTiltAngle ?? Math.PI / 3,
      // wspólne
      maxSpeed: phys.maxSpeed ?? 25,
      maxAltitude: phys.maxAltitude ?? 200,
      groundLevel: phys.groundLevel ?? 0.5,
    },

    camera: {
      angle: raw.camera?.angle ?? 0,
      angles: raw.camera?.angles ?? [0, 20, 35],
    },

    sky: {
      top: raw.sky?.top ?? DEFAULT_SKY.top,
      bottom: raw.sky?.bottom ?? DEFAULT_SKY.bottom,
    },

    fog: {
      near: raw.fog?.near ?? 100,
      far: raw.fog?.far ?? 700,
    },

    spawn: {
      x: raw.spawn?.x ?? 0,
      y: raw.spawn?.y ?? 5,
      z: raw.spawn?.z ?? 0,
    },

    // Każdy element: { x, y, z, ... }
    trees:  (raw.trees  || []).map(validateTree),
    gates:  (raw.gates  || []).map(validateGate),
    boxes:  (raw.boxes  || []).map(validateBox),
    hills:  (raw.hills  || []).map(validateHill),
    water:  raw.water ? validateWater(raw.water) : null,
  };
}

// ─── Walidatory pojedynczych obiektów ───

function req(obj, key, ctx) {
  if (obj[key] === undefined || obj[key] === null) {
    throw new Error(`[${ctx}] brak pola "${key}"`);
  }
  return obj[key];
}

function validateTree(t) {
  req(t, 'x', 'tree'); req(t, 'z', 'tree');
  return { x: t.x, y: t.y ?? 0, z: t.z, scale: t.scale ?? 1.0 };
}

function validateGate(g) {
  req(g, 'x', 'gate'); req(g, 'z', 'gate');
  return {
    x: g.x,
    y: g.y ?? 3,
    z: g.z,
    yaw: g.yaw ?? 0,
  };
}

function validateBox(b) {
  req(b, 'x', 'box'); req(b, 'z', 'box');
  return {
    x: b.x,
    z: b.z,
    w: b.w ?? 4,
    h: b.h ?? 3,
    d: b.d ?? 4,
    color: b.color ?? 0xff4444,
  };
}

function validateHill(h) {
  req(h, 'x', 'hill'); req(h, 'z', 'hill');
  return {
    x: h.x, y: h.y ?? 0, z: h.z,
    radius: h.radius ?? 30,
    heightScale: h.heightScale ?? 0.5,
  };
}

function validateWater(w) {
  return {
    x: w.x ?? 0, z: w.z ?? 0,
    w: w.w ?? 100, d: w.d ?? 100,
  };
}