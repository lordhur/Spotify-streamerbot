# 🎧 Spotify-streamerbot

 Tes viewers demandent un titre dans le chat Twitch (`!sr Daft Punk One More Time`),
 **Streamer.bot** transmet la demande à un petit serveur local, et le titre est
 **ajouté instantanément à ta playlist Spotify** via l'API Web API officielle.
 Le bot répond dans le chat : `✅ @viewer a ajouté « One More Time » — Daft Punk à la playlist !`

```
 chat Twitch ── commande !sr ... ──▶ Streamer.bot ── GET localhost:8888 ──▶ ce serveur ── API Spotify ──▶ ta playlist
                                        ▲                                                    │
                                        └──────── réponse texte affichée dans le chat ◀────┘
```

## ✨ Fonctionnalités

- `!sr <titre ou artiste>` (alias `!song`) → recherche Spotify + ajout à la playlist
- **Cooldown par viewer** (ex: 1 demande / 5 min), avec liste d'exemptés (toi, les mods)
- **Anti-doublon** : refuse un titre déjà présent dans la playlist
- `!now` → annonce le morceau en cours de lecture (nécessite Spotify ouvert sur ton PC)
- Réponses en **texte brut** (parfait pour Streamer.bot) ou en JSON (pour un overlay)
- Token OAuth avec **refresh automatique** : une seule autorisation, ça dure
- Serveur **local uniquement** (`127.0.0.1`) : aucune donnée ne sort de ton PC sauf vers Spotify
- Historique + dernier titre ajoutés exposés (`GET /last`) pour un overlay OBS/Streamer.bot

## 📋 Prérequis

1. **Node.js ≥ 18** installé sur le PC où tourne Streamer.bot → https://nodejs.org
2. **Streamer.bot** connecté à ton chat Twitch
3. **Spotify Premium** (compte propriétaire de la playlist cible)
4. Une **app développeur Spotify** (gratuit, 5 min) → voir `docs/spotify-dashboard-setup.md`

## 🚀 Installation

```bash
git clone <ce-repo> Spotify-streamerbot
cd Spotify-streamerbot
npm install
cp .env.example .env     # puis édite .env (voir ci-dessous)
```

### 1. Crée l'app Spotify

Suis **`docs/spotify-dashboard-setup.md`** : crée l'app, note le Client ID / Client Secret,
et déclare la Redirect URI `http://localhost:8888/callback`.

### 2. Configure `.env`

```env
SPOTIFY_CLIENT_ID=...
SPOTIFY_CLIENT_SECRET=...
SPOTIFY_REDIRECT_URI=http://localhost:8888/callback
SPOTIFY_PLAYLIST_ID=37i9dQZF1DXcBWIGoYBM5M        # ou l'URL complète de la playlist
COMMANDS=!sr,!song
COOLDOWN_SECONDS=300                              # 5 min entre 2 demandes par viewer
COOLDOWN_EXEMPT=ton_pseudo_twitch,tes_mods        # toi + mods, en minuscules
BLOCK_DUPLICATES=true
SPOTIFY_MARKET=FR
```

> ⚠️ Le compte Spotify avec lequel tu t'autorises doit être **propriétaire** de la playlist
> (ou la playlist doit être en mode collaboratif avec ce compte).

### 3. Autorise le bot une fois pour toutes

```bash
npm run auth
```

Une page Spotify s'ouvre → connecte-toi avec ton compte Premium → autorise.
Le token est sauvegardé dans `.token.json` (déjà dans `.gitignore`, ne le commit **jamais**).

### 4. Lance le bot

```bash
npm start
```

Vérifie `http://localhost:8888/health` → `{"authed": true, ...}`.

> 💡 Pour lancer le bot automatiquement à chaque démarrage de stream, crée un raccourci
> vers un fichier `start-bot.bat` contenant `npm start` dans ce dossier, et place-le dans
> le dossier Démarrage de Windows (`shell:startup`).

### 5. Branche Streamer.bot

Suis **`docs/streamerbot-setup.md`** (trigger commande `!sr` + sub-action Fetch URL + réponse chat).

## 🎮 Utilisation pendant le stream

| Commande chat | Effet |
|---|---|
| `!sr Daft Punk One More Time` | ajoute le 1er résultat Spotify à la playlist |
| `!sr` (seul) | rappelle la syntaxe |
| `!now` | annonce le morceau en cours (nécessite Spotify ouvert) |

Tu lances toi-même la lecture de la playlist dans Spotify (lecture manuelle, comme demandé 😉).

## 🔌 Endpoints HTTP (localhost uniquement)

| Endpoint | Description |
|---|---|
| `GET /songrequest?format=text&user=X&message=!sr ...` | song request (utilisé par Streamer.bot) |
| `POST /songrequest` body `{"user":"X","message":"!sr ..."}` | idem en POST/JSON |
| `GET /now?format=text` | morceau en cours |
| `GET /last` | dernier titre ajouté (JSON) |
| `GET /health` | état du bot (JSON) |
| `GET /auth` / `GET /callback` | flux OAuth |

## 🧪 Tests

```bash
npm test
```

Tests unitaires + test d'intégration complet contre un **mock de l'API Spotify**
(aucun credential requis) : auth, ajout de titre, cooldown, doublons, formats de réponse.

## 🔒 Sécurité

- Le serveur écoute sur `127.0.0.1` uniquement → seul ton PC (Streamer.bot) peut l'appeler.
- `.env` et `.token.json` sont dans `.gitignore` → jamais poussés sur GitHub.
- Ne partage jamais ton `SPOTIFY_CLIENT_SECRET` ni `.token.json`.

## 🗺️ Idées d'évolution

- Plusieurs playlists au choix (`!sr rock <titre>`)
- File d'attente avec validation modérateur avant ajout
- Le bot pilote la lecture (play/pause/skip) via `user-modify-playback-state`
- Overlay "dernier titre ajouté" via `GET /last`
- Blacklist de titres/artistes dans un fichier JSON

## 📁 Structure

```
src/
  server.js    app Express + routes (songrequest, now, last, health, auth...)
  spotify.js   client API Spotify (OAuth, recherche, ajout playlist)
  store.js     cooldowns + historique (JSON persistant)
  commands.js  parse des commandes chat (fonction pure)
  config.js    chargement .env + valeurs par défaut
  auth.js      connexion one-shot (npm run auth)
tests/         tests unitaires + intégration (mock Spotify)
docs/          guides pas à pas (dashboard Spotify, Streamer.bot)
```
