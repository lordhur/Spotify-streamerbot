import { loadEnv } from './env.js';

loadEnv();

const DEFAULTS = {
  port: 8888,
  host: '127.0.0.1',
  commands: '!sr,!song',
  cooldownSeconds: 300,
  blockDuplicates: true,
  market: 'FR',
  maxQueryLength: 200,
  tokenFile: '.token.json',
  stateFile: 'data/state.json',
  apiBase: 'https://api.spotify.com/v1',
  accountsBase: 'https://accounts.spotify.com',
  scopes: 'playlist-modify-public playlist-modify-private user-read-currently-playing',
};

function envBool(v, def) {
  if (v === undefined || v === '') return def;
  return ['1', 'true', 'yes', 'on'].includes(String(v).trim().toLowerCase());
}

function envInt(v, def) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : def;
}

/** Accepte un ID brut ou une URL du type https://open.spotify.com/playlist/<ID>?si=... */
export function normalizePlaylistId(raw) {
  const v = String(raw || '').trim();
  if (!v) return '';
  const m = v.match(/open\.spotify\.com\/playlist\/([A-Za-z0-9]+)/);
  return m ? m[1] : v;
}

/**
 * Construit la configuration depuis process.env, avec possibilité
 * de surcharges (utilisé par les tests).
 */
export function getConfig(overrides = {}) {
  const port = envInt(process.env.PORT, DEFAULTS.port);
  const cfg = {
    port,
    host: process.env.HOST || DEFAULTS.host,
    clientId: process.env.SPOTIFY_CLIENT_ID || '',
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET || '',
    redirectUri: process.env.SPOTIFY_REDIRECT_URI || `http://localhost:${port}/callback`,
    playlistId: normalizePlaylistId(process.env.SPOTIFY_PLAYLIST_ID || ''),
    commands: (process.env.COMMANDS || DEFAULTS.commands)
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
    cooldownSeconds: envInt(process.env.COOLDOWN_SECONDS, DEFAULTS.cooldownSeconds),
    cooldownExempt: (process.env.COOLDOWN_EXEMPT || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
    blockDuplicates: envBool(process.env.BLOCK_DUPLICATES, DEFAULTS.blockDuplicates),
    market: process.env.SPOTIFY_MARKET || DEFAULTS.market,
    maxQueryLength: envInt(process.env.MAX_QUERY_LENGTH, DEFAULTS.maxQueryLength),
    tokenFile: process.env.TOKEN_FILE || DEFAULTS.tokenFile,
    stateFile: process.env.STATE_FILE || DEFAULTS.stateFile,
    apiBase: (process.env.SPOTIFY_API_BASE || DEFAULTS.apiBase).replace(/\/+$/, ''),
    accountsBase: (process.env.SPOTIFY_ACCOUNTS_BASE || DEFAULTS.accountsBase).replace(/\/+$/, ''),
    scopes: (process.env.SPOTIFY_SCOPES || DEFAULTS.scopes).trim(),
  };
  return { ...cfg, ...overrides };
}
