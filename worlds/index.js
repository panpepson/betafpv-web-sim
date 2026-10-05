// worlds/index.js
// Rejestr wszystkich plansz. Dodajesz nowy tor:
//   1. Tworzysz worlds/mojtor.js (import { makeWorld } from './_schema.js')
//   2. Importujesz go tutaj i dodajesz do rejestru.
// Nic więcej — main.js sam go podchwyci.

import beginner     from './beginner.js';
import intermediate from './intermediate.js';
import expert       from './expert.js';
import expert_race  from './expert_race.js';

export const WORLDS = {
  beginner,
  intermediate,
  expert,
  expert_race,
};

export const WORLD_KEYS = Object.keys(WORLDS);