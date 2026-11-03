import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { StateStore } from '../src/store.js';

function tmpFile() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ssb-store-'));
  return path.join(dir, 'state.json');
}

test('cooldown : première demande autorisée, suivante bloquée puis débloquée', () => {
  let now = 1_000_000;
  const store = new StateStore(tmpFile(), () => now);

  assert.deepEqual(store.checkCooldown('alice', 300), { allowed: true, remaining: 0 });
  store.recordRequest('alice');
  const blocked = store.checkCooldown('alice', 300);
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.remaining > 0 && blocked.remaining <= 300);

  now += 301_000; // 301 s plus tard
  assert.deepEqual(store.checkCooldown('alice', 300), { allowed: true, remaining: 0 });
});

test('cooldown : insensible à la casse du pseudo', () => {
  let now = 0;
  const store = new StateStore(tmpFile(), () => now);
  store.recordRequest('Alice');
  assert.equal(store.checkCooldown('ALICE', 300).allowed, false);
});

test('exemption du cooldown (streamer / mods)', () => {
  const store = new StateStore(tmpFile(), () => 0);
  store.recordRequest('streamer');
  assert.deepEqual(store.checkCooldown('Streamer', 300, ['streamer', 'mod1']), { allowed: true, remaining: 0 });
});

test('cooldown désactivé (0)', () => {
  const store = new StateStore(tmpFile(), () => 0);
  store.recordRequest('bob');
  assert.deepEqual(store.checkCooldown('bob', 0), { allowed: true, remaining: 0 });
});

test('resetCooldown', () => {
  const store = new StateStore(tmpFile(), () => 0);
  store.recordRequest('bob');
  store.resetCooldown('bob');
  assert.deepEqual(store.checkCooldown('bob', 300), { allowed: true, remaining: 0 });
});

test('persistance sur disque + lastAdded', () => {
  const file = tmpFile();
  const s1 = new StateStore(file, () => 42);
  s1.recordRequest('alice');
  s1.setLastAdded({ id: 't1', name: 'Titre', artists: ['Artiste'], requestedBy: 'alice' });

  const s2 = new StateStore(file, () => 43);
  assert.equal(s2.checkCooldown('alice', 300).allowed, false);
  assert.equal(s2.getLastAdded().name, 'Titre');
  assert.equal(s2.data.history.length, 1);
});
