import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startMockSpotify } from './helpers/mockSpotify.js';

let mock;
let base;
let server;
let tmp;

before(async () => {
  mock = await startMockSpotify();
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ssb-server-'));
  const { createApp } = await import('../src/server.js');
  const built = createApp({
    port: 0,
    host: '127.0.0.1',
    clientId: 'cid',
    clientSecret: 'secret',
    accountsBase: `http://127.0.0.1:${mock.port}`,
    apiBase: `http://127.0.0.1:${mock.port}`,
    tokenFile: path.join(tmp, 'token.json'),
    stateFile: path.join(tmp, 'state.json'),
    playlistId: 'PLTEST',
    commands: ['!sr'],
    cooldownSeconds: 300,
    cooldownExempt: ['streamer'],
    blockDuplicates: true,
    market: 'FR',
  });
  server = built.app.listen(0, '127.0.0.1');
  await new Promise((r) => server.on('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server?.close();
  mock?.server.close();
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('le callback OAuth échange le code et sauvegarde le token', async () => {
  const res = await fetch(`${base}/callback?code=fake-code`);
  assert.equal(res.status, 200);
  const tokens = JSON.parse(fs.readFileSync(path.join(tmp, 'token.json'), 'utf8'));
  assert.equal(tokens.access_token, 'mock-access');
  assert.equal(tokens.refresh_token, 'mock-refresh');
});

test('/health reflète l\'état du bot', async () => {
  const j = await (await fetch(`${base}/health`)).json();
  assert.equal(j.ok, true);
  assert.equal(j.authed, true);
  assert.equal(j.playlistId, 'PLTEST');
  assert.deepEqual(j.commands, ['!sr']);
});

test('!sr ajoute un titre et répond en texte brut (format Streamer.bot)', async () => {
  const res = await fetch(`${base}/songrequest?format=text&user=alice&message=${encodeURIComponent('!sr Daft Punk')}`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/plain/);
  const text = await res.text();
  assert.match(text, /✅ @alice a ajouté « One More Time » — Daft Punk à la playlist !/);
  assert.ok(mock.state.playlistUris.has('spotify:track:track1'));
});

test('le cooldown bloque la 2e demande du même viewer', async () => {
  const res = await fetch(`${base}/songrequest?format=text&user=alice&message=${encodeURIComponent('!sr test')}`);
  const text = await res.text();
  assert.match(text, /⏳ @alice, encore \d+ min/);
});

test('un viewer exempté (streamer) n\'est pas bloqué', async () => {
  const res = await fetch(`${base}/songrequest?format=text&user=streamer&message=${encodeURIComponent('!sr test')}`);
  const text = await res.text();
  // le titre est déjà dans la playlist du mock -> doublon attendu
  assert.match(text, /🔁/);
});

test('un doublon est refusé pour un autre viewer', async () => {
  const res = await fetch(`${base}/songrequest?format=text&user=bob&message=${encodeURIComponent('!sr Daft Punk')}`);
  const text = await res.text();
  assert.match(text, /déjà dans la playlist/);
});

test('réponse JSON par défaut (sans format=text)', async () => {
  const res = await fetch(`${base}/songrequest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: 'carol', message: '!sr hello' }),
  });
  const j = await res.json();
  assert.equal(typeof j.ok, 'boolean');
  assert.ok(typeof j.message === 'string' && j.message.length > 0);
});

test('commande sans recherche -> message d\'aide', async () => {
  const res = await fetch(`${base}/songrequest?format=text&user=dave&message=${encodeURIComponent('!sr')}`);
  assert.match(await res.text(), /quoi chercher/);
});

test('message qui n\'est pas une commande -> message d\'aide', async () => {
  const res = await fetch(`${base}/songrequest?format=text&user=erin&message=${encodeURIComponent('bonjour')}`);
  assert.match(await res.text(), /Utilise !sr/);
});

test('/last renvoie le dernier titre ajouté', async () => {
  const j = await (await fetch(`${base}/last`)).json();
  assert.equal(j.ok, true);
  assert.equal(j.name, 'One More Time');
  assert.equal(j.requestedBy, 'alice');
});

test('/now renvoie le morceau en cours (mock)', async () => {
  const res = await fetch(`${base}/now?format=text`);
  assert.match(await res.text(), /🎶 En cours : « Get Lucky » — Daft Punk/);
});
