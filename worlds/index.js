// worlds/index.js
// Rejestr wszystkich plansz. Dodajesz nowy tor:
//   1. Tworzysz worlds/mojtor.js (import { makeWorld } from './_schema.js')
//   2. Importujesz go tutaj i dodajesz do rejestru.
// Nic więcej — main.js sam go podchwyci.

import beginner     from './beginner.js';
import intermediate from './intermediate.js';
import expert       from './expert.js';
import expert_race  from './expert_race.js';
import minecraft    from './minecraft.js';   // 🌳 UKRYTY bonus

export const WORLDS = {
  beginner,
  intermediate,
  expert,
  expert_race,
  minecraft,          // 🌳 zarejestrowany, ale NIE MA KARTY w menu
};

export const WORLD_KEYS = Object.keys(WORLDS);

// ─── Światy które pokazują się w menu (bez minecraft!) ───
export const VISIBLE_WORLD_KEYS = [
  'beginner',
  'intermediate',
  'expert',
  'expert_race',
];

// ─── Światy ukryte (dostępne tylko przez klawisz) ───
export const HIDDEN_WORLD_KEYS = ['minecraft'];

export function isHiddenWorld(key) {
  return HIDDEN_WORLD_KEYS.includes(key);
}