import fs from 'node:fs';
import path from 'node:path';

/**
 * Persistance légère (JSON) : cooldowns par viewer + historique des ajouts.
 * Le fichier est écrit de façon atomique (tmp + rename).
 */
export class StateStore {
  constructor(file, now = () => Date.now()) {
    this.file = file;
    this.now = now;
    this.data = { lastRequest: {}, lastAdded: null, history: [] };
    try {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
      this.data = { ...this.data, ...parsed };
    } catch {
      /* premier lancement : état vierge */
    }
  }

  save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
    fs.renameSync(tmp, this.file);
  }

  /**
   * @returns {{allowed: boolean, remaining: number}} remaining en secondes
   */
  checkCooldown(user, cooldownSeconds, exempt = []) {
    const key = String(user).toLowerCase();
    if (exempt.map((e) => e.toLowerCase()).includes(key)) {
      return { allowed: true, remaining: 0 };
    }
    const last = this.data.lastRequest[key];
    if (last === undefined) return { allowed: true, remaining: 0 }; // jamais demandé
    const elapsed = (this.now() - last) / 1000;
    if (cooldownSeconds > 0 && elapsed < cooldownSeconds) {
      return { allowed: false, remaining: Math.ceil(cooldownSeconds - elapsed) };
    }
    return { allowed: true, remaining: 0 };
  }

  recordRequest(user) {
    this.data.lastRequest[String(user).toLowerCase()] = this.now();
    this.save();
  }

  resetCooldown(user) {
    delete this.data.lastRequest[String(user).toLowerCase()];
    this.save();
  }

  setLastAdded(track) {
    const entry = { ...track, at: this.now() };
    this.data.lastAdded = entry;
    this.data.history.unshift(entry);
    this.data.history = this.data.history.slice(0, 50);
    this.save();
  }

  getLastAdded() {
    return this.data.lastAdded;
  }
}
