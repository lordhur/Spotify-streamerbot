import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCommand, formatDuration } from '../src/commands.js';

const COMMANDS = ['!sr', '!song'];

test('commande avec recherche', () => {
  assert.deepEqual(parseCommand('!sr Daft Punk One More Time', COMMANDS), {
    matched: true,
    command: '!sr',
    query: 'Daft Punk One More Time',
  });
});

test('commande seule (pas de recherche)', () => {
  assert.deepEqual(parseCommand('!sr', COMMANDS), { matched: true, command: '!sr', query: '' });
});

test('insensible à la casse et aux espaces', () => {
  assert.deepEqual(parseCommand('  !SR   daft punk  ', COMMANDS), {
    matched: true,
    command: '!sr',
    query: 'daft punk',
  });
});

test('alias !song', () => {
  const r = parseCommand('!song get lucky', COMMANDS);
  assert.equal(r.matched, true);
  assert.equal(r.query, 'get lucky');
});

test('message qui ne commence pas par une commande', () => {
  assert.equal(parseCommand('salut tout le monde', COMMANDS).matched, false);
});

test('!srx ne doit pas matcher !sr', () => {
  assert.equal(parseCommand('!srx hello', COMMANDS).matched, false);
});

test('message vide', () => {
  assert.equal(parseCommand('', COMMANDS).matched, false);
  assert.equal(parseCommand('   ', COMMANDS).matched, false);
});

test('formatDuration', () => {
  assert.equal(formatDuration(45), '45 s');
  assert.equal(formatDuration(60), '1 min');
  assert.equal(formatDuration(75), '1 min 15 s');
  assert.equal(formatDuration(300), '5 min');
});
