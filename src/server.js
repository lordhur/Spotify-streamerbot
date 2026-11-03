import express from 'express';
import { pathToFileURL } from 'node:url';
import { getConfig } from './config.js';
import { SpotifyClient, SpotifyError } from './spotify.js';
import { StateStore } from './store.js';
import { parseCommand, formatDuration } from './commands.js';

/**
 * Construit l'app Express. `overrides` permet de surcharger la config (tests).
 * Retourne { app, client, store, cfg }.
 */
export function createApp(overrides = {}) {
  const cfg = getConfig(overrides);
  const client = new SpotifyClient(cfg);
  client.loadTokens();
  const store = new StateStore(cfg.stateFile);

  const app = express();
  app.use(express.json({ limit: '16kb' }));
  app.use(express.urlencoded({ extended: true }));

  const wantsText = (req) =>
    req.query.format === 'text' || String(req.headers.accept || '').includes('text/plain');

  /** Répond toujours en 200 (Streamer.bot Fetch URL n'aime pas les erreurs HTTP). */
  function reply(req, res, ok, message, data) {
    if (wantsText(req)) {
      return res.status(200).type('text/plain; charset=utf-8').send(message);
    }
    return res.status(200).json({ ok, message, ...(data ? { data } : {}) });
  }

  async function handleSongRequest(req, res) {
    const params = { ...req.query, ...(req.body || {}) };
    const user = String(params.user || params.username || 'viewer').slice(0, 64);
    const message = String(params.message ?? params.input ?? params.q ?? '').slice(0, 500);
    const logLine = `[sr] @${user}: "${message}"`;
    try {
      const parsed = parseCommand(message, cfg.commands);
      if (!parsed.matched) {
        console.log(`${logLine} -> pas une commande reconnue`);
        return reply(
          req, res, false,
          `❓ Utilise ${cfg.commands[0]} <titre ou artiste> (ex: ${cfg.commands[0]} Daft Punk One More Time)`
        );
      }
      if (!parsed.query) {
        return reply(req, res, false, `🎵 ${cfg.commands[0]} quoi chercher ? Ex: ${cfg.commands[0]} Daft Punk - One More Time`);
      }
      if (parsed.query.length > cfg.maxQueryLength) {
        return reply(req, res, false, '❌ Recherche trop longue.');
      }

      const cd = store.checkCooldown(user, cfg.cooldownSeconds, cfg.cooldownExempt);
      if (!cd.allowed) {
        console.log(`${logLine} -> cooldown (${cd.remaining}s restantes)`);
        return reply(req, res, false, `⏳ @${user}, encore ${formatDuration(cd.remaining)} avant ta prochaine demande !`);
      }

      if (!cfg.playlistId) {
        return reply(req, res, false, '⚙️ Playlist non configurée côté serveur (SPOTIFY_PLAYLIST_ID dans .env).');
      }
      if (!client.isAuthed()) {
        return reply(req, res, false, '🔐 Le bot n\'est pas connecté à Spotify : lance `npm run auth` sur le PC du stream.');
      }

      const search = await client.searchTracks(parsed.query, 1);
      const track = search?.tracks?.items?.[0];
      if (!track) {
        console.log(`${logLine} -> aucun résultat pour "${parsed.query}"`);
        return reply(req, res, false, `❌ Aucun résultat Spotify pour « ${parsed.query} »`);
      }

      if (cfg.blockDuplicates) {
        const existing = await client.playlistTrackUris(cfg.playlistId, 100);
        const uris = new Set((existing?.items || []).map((i) => i?.track?.uri).filter(Boolean));
        if (uris.has(track.uri)) {
          const artist = track.artists.map((a) => a.name).join(', ');
          console.log(`${logLine} -> doublon (${track.name})`);
          return reply(req, res, false, `🔁 « ${track.name} » — ${artist} est déjà dans la playlist.`);
        }
      }

      await client.addToPlaylist(cfg.playlistId, [track.uri]);
      store.recordRequest(user);
      const artists = track.artists.map((a) => a.name).join(', ');
      store.setLastAdded({
        id: track.id,
        uri: track.uri,
        name: track.name,
        artists: track.artists.map((a) => a.name),
        requestedBy: user,
      });
      console.log(`${logLine} -> ✅ ajouté "${track.name}" (${artists})`);
      return reply(
        req, res, true,
        `✅ @${user} a ajouté « ${track.name} » — ${artists} à la playlist !`,
        { track: { id: track.id, uri: track.uri, name: track.name, artists: track.artists.map((a) => a.name) } }
      );
    } catch (err) {
      console.error(`${logLine} -> erreur:`, err.message);
      if (err instanceof SpotifyError) {
        if (err.status === 401) return reply(req, res, false, '🔐 Connexion Spotify expirée → relance `npm run auth` sur le PC du stream.');
        if (err.status === 403) return reply(req, res, false, '🚫 Spotify refuse l\'ajout : vérifie les scopes (playlist-modify-public/private) et que le compte connecté est propriétaire de la playlist.');
        if (err.status === 404) return reply(req, res, false, '🚫 Playlist introuvable : vérifie SPOTIFY_PLAYLIST_ID dans .env.');
        if (err.status === 429) return reply(req, res, false, '⏳ Spotify nous ralentit, réessaie dans quelques secondes.');
        return reply(req, res, false, `⚠️ Erreur Spotify (${err.status}).`);
      }
      return reply(req, res, false, '⚠️ Erreur interne du bot (voir la console).');
    }
  }

  app.get('/', (req, res) => {
    const last = store.getLastAdded();
    res.type('html').send(`<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>Spotify-streamerbot</title>
<style>body{font-family:system-ui;max-width:640px;margin:40px auto;padding:0 16px;background:#121212;color:#eee}
h1{color:#1DB954}code{background:#282828;padding:2px 6px;border-radius:4px}td{padding:4px 8px}</style></head><body>
<h1>🎧 Spotify-streamerbot</h1>
<p>Connecté à Spotify : <b>${client.isAuthed() ? '✅ oui' : '❌ non (lance <code>npm run auth</code>)'}</b></p>
<p>Playlist : <code>${cfg.playlistId || '(non configurée)'}</code></p>
<p>Commandes chat : <code>${cfg.commands.map((c) => c + ' <recherche>').join(' · ')}</code></p>
<p>Cooldown : <b>${cfg.cooldownSeconds}s</b> par viewer</p>
<h2>Dernier titre ajouté</h2>
<p>${last ? `« ${last.name} » — ${last.artists.join(', ')} (par @${last.requestedBy})` : 'aucun pour le moment'}</p>
<h2>Endpoints</h2>
<table>
<tr><td><code>GET /songrequest?format=text&user=&message=</code></td><td>song request (utilisé par Streamer.bot)</td></tr>
<tr><td><code>POST /songrequest</code> (JSON {user, message})</td><td>idem, en POST</td></tr>
<tr><td><code>GET /now?format=text</code></td><td>morceau en cours de lecture</td></tr>
<tr><td><code>GET /last</code></td><td>dernier titre ajouté (JSON, pour overlay)</td></tr>
<tr><td><code>GET /health</code></td><td>état du bot (JSON)</td></tr>
<tr><td><code>GET /auth</code></td><td>démarre la connexion OAuth Spotify</td></tr>
</table>
</body></html>`);
  });

  app.get('/health', (req, res) => {
    res.json({
      ok: true,
      authed: client.isAuthed(),
      playlistId: cfg.playlistId || null,
      commands: cfg.commands,
      cooldownSeconds: cfg.cooldownSeconds,
      uptime: process.uptime(),
    });
  });

  app.get('/auth', (req, res) => {
    res.redirect(client.authUrl());
  });

  app.get('/callback', async (req, res) => {
    try {
      if (req.query.error) {
        return res.status(400).type('html').send(`<h1>❌ Autorisation refusée</h1><p>${req.query.error}</p>`);
      }
      await client.exchangeCode(String(req.query.code || ''));
      res.type('html').send('<h1>✅ Connecté à Spotify !</h1><p>Le token est sauvegardé dans <code>.token.json</code>.<br>Tu peux fermer cet onglet et lancer <code>npm start</code>.</p>');
    } catch (e) {
      res.status(500).type('html').send(`<h1>❌ Erreur d'authentification</h1><pre>${e.message}</pre>`);
    }
  });

  app.get('/songrequest', handleSongRequest);
  app.post('/songrequest', handleSongRequest);

  app.get('/now', async (req, res) => {
    try {
      if (!client.isAuthed()) return reply(req, res, false, '🔐 Bot non connecté à Spotify.');
      const playing = await client.currentlyPlaying();
      const item = playing?.item;
      if (!item) return reply(req, res, false, 'Spotify ne joue rien pour le moment.');
      const artists = item.artists.map((a) => a.name).join(', ');
      return reply(req, res, true, `🎶 En cours : « ${item.name} » — ${artists}`, { track: item });
    } catch (err) {
      console.error('[now] erreur:', err.message);
      return reply(req, res, false, '⚠️ Impossible de lire le morceau en cours (Spotify ouvert sur le PC ? scope user-read-currently-playing ?).');
    }
  });

  app.get('/last', (req, res) => {
    const last = store.getLastAdded();
    if (!last) return res.json({ ok: false, message: 'Aucun titre ajouté pour le moment.' });
    res.json({ ok: true, ...last });
  });

  return { app, client, store, cfg };
}

// --- Lancement direct : node src/server.js ---
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const { app, cfg, client } = createApp();
  app.listen(cfg.port, cfg.host, () => {
    console.log(`🎧 Spotify-streamerbot démarré sur http://${cfg.host}:${cfg.port}`);
    console.log(`   commandes chat : ${cfg.commands.join(', ')}`);
    console.log(`   playlist       : ${cfg.playlistId || '(NON CONFIGURÉE)'}`);
    if (!client.isAuthed()) {
      console.log(`\n🔐 Pas encore connecté à Spotify : ouvre http://localhost:${cfg.port}/auth dans ton navigateur, ou lance "npm run auth".`);
    } else {
      console.log('✅ Connecté à Spotify.');
    }
  });
}
