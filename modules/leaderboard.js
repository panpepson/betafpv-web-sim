// modules/leaderboard.js
// 🏆 Lokalny ranking — top 3 czasy per świat (localStorage).

const STORAGE_PREFIX = 'betafpv_leaderboard_';
const MAX_ENTRIES = 3;

export class Leaderboard {
  constructor(worldId) {
    this.worldId = worldId;
    this.entries = [];        // [{ timeMs, date, ghost? }]
    this.onChange = null;     // callback po zmianie
  }

  _key() { return STORAGE_PREFIX + this.worldId; }

  load() {
    try {
      const raw = localStorage.getItem(this._key());
      if (!raw) { this.entries = []; return; }
      const data = JSON.parse(raw);
      this.entries = Array.isArray(data.entries) ? data.entries : [];
    } catch (e) {
      console.warn('[leaderboard] load failed:', e.message);
      this.entries = [];
    }
  }

  save() {
    try {
      localStorage.setItem(this._key(), JSON.stringify({
        v: 1,
        worldId: this.worldId,
        entries: this.entries,
      }));
    } catch (e) {
      console.warn('[leaderboard] save failed:', e.message);
    }
  }

  /**
   * Dodaje czas. Zwraca { rank, isNew, entries } — rank: 1..3 lub null gdy poza top 3.
   */
  submit(timeMs) {
    const entry = { timeMs, date: Date.now() };
    this.entries.push(entry);
    this.entries.sort((a, b) => a.timeMs - b.timeMs);
    this.entries = this.entries.slice(0, MAX_ENTRIES);

    const rank = this.entries.findIndex(e => e === entry);
    const rankPos = rank >= 0 ? rank + 1 : null;

    this.save();
    if (this.onChange) this.onChange(this.entries);

    return {
      rank: rankPos,        // 1, 2, 3 lub null
      isNew: rankPos !== null && rankPos <= MAX_ENTRIES,
      entries: this.entries,
    };
  }

  best() {
    return this.entries[0] || null;
  }

  clear() {
    this.entries = [];
    try { localStorage.removeItem(this._key()); } catch (_) {}
    if (this.onChange) this.onChange(this.entries);
  }

  /** Ile wpisów brakuje do pełnego top 3. */
  missingCount() {
    return Math.max(0, MAX_ENTRIES - this.entries.length);
  }
}