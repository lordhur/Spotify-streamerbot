# 🎛️ Créer l'app développeur Spotify (5 minutes, gratuit)

Le bot a besoin d'une "app" Spotify pour appeler l'API Web API avec **ton** compte.

## Étapes

1. Va sur **https://developer.spotify.com/dashboard** et connecte-toi avec ton compte **Spotify Premium** (le compte propriétaire de la playlist du stream).
2. Clique sur **Create app** :
   - **App name** : `streamerbot-songrequests` (ou ce que tu veux)
   - **App description** : `Song requests Twitch -> playlist de mon stream`
   - **Website** : `http://localhost`
   - **Redirect URI** : clique sur *Add*, entre exactement :
     ```
     http://localhost:8888/callback
     ```
     > ⚠️ Copie-colle exactement cette URL. Si tu changes le `PORT` dans `.env`, il faut mettre à jour cette URI ici **et** dans `.env`.
   - Coche la case d'acceptation des conditions, puis **Save**.
3. Ouvre l'app créée, onglet **Settings** :
   - Copie le **Client ID** → mets-le dans `.env` → `SPOTIFY_CLIENT_ID`
   - Clique sur **View client secret** → copie le **Client Secret** → `.env` → `SPOTIFY_CLIENT_SECRET`
4. C'est tout ! Les **scopes** (permissions) sont demandés automatiquement au moment de
   l'autorisation (`npm run auth`) :
   - `playlist-modify-public` / `playlist-modify-private` → ajouter des titres à ta playlist
   - `user-read-currently-playing` → commande `!now` (morceau en cours)

## Récupérer l'ID de ta playlist

Ouvre ta playlist dans Spotify (app ou web) → `⋯` → **Partager** → **Copier le lien de la playlist** :

```
https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=xxxxxxxx
                                  └──────────────┘
                                       c'est l'ID
```

Mets l'ID (ou l'URL complète, le bot extrait l'ID tout seul) dans `.env` → `SPOTIFY_PLAYLIST_ID`.

## Point d'attention important

L'ajout de titres via l'API ne fonctionne que si le compte Spotify utilisé par le bot
(celui avec lequel tu fais `npm run auth`) est **propriétaire de la playlist**, ou si la
playlist est passée en **collaboratif** et que ce compte y est invité.
Le plus simple : utiliser **ton propre compte Premium** pour `npm run auth`.

Ensuite : `npm run auth` depuis le dossier du projet.
