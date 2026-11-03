# 🤖 Configurer Streamer.bot (song requests `!sr`)

Prérequis : le serveur tourne sur ton PC (`npm start`) et
`http://localhost:8888/health` renvoie `{"ok": true, "authed": true, ...}`.

## Étape 1 — Créer la commande

1. Dans Streamer.bot, onglet **Commands** → **Add** (ou clic droit → Add)
2. Renseigne :
   - **Name** : `!sr` (song request)
   - **Commands** (une par ligne) :
     ```
     !sr
     !song
     ```
   - **Location** : `Start` (la commande doit être en début de message)
   - ✅ coche **Ignore Bot Account** (évite les boucles si un autre bot répète)
3. **OK**

## Étape 2 — Créer l'action et son trigger

1. Onglet **Actions** → **Add** → nomme-la `Song Request (!sr)`
2. Clic droit dans **Triggers** → **Add** → **Core → Commands → Command Triggered**
3. Dans la liste déroulante, choisis la commande `!sr` créée à l'étape 1 → **OK**

## Étape 3 — Sub-action 1 : appeler le bot local (Fetch URL)

1. Clic droit dans **Sub-Actions** → **Add** → **Core → Network → Fetch URL**
2. Renseigne :
   - **URL** :
     ```
     http://localhost:8888/songrequest?format=text&user=%user%&message=%rawInputUrlEncoded%
     ```
     - `%user%` = le viewer qui a tapé la commande
     - `%rawInputUrlEncoded%` = le texte après `!sr`, encodé pour l'URL (ex: `Daft Punk` → `Daft%20Punk`)
     - `format=text` = le serveur répond en texte brut, directement affichable dans le chat
   - **Variable Name** : `srResponse`
   - **Parse result as JSON** : ❌ désactivé (on veut le texte brut)
3. **OK**

## Étape 4 — Sub-action 2 : répondre dans le chat

1. Clic droit dans **Sub-Actions** → **Add** → **Twitch → Chat → Send Message to Channel**
2. **Message** :
   ```
   %srResponse%
   ```
3. Choisis le compte qui envoie (ton compte broadcaster ou le bot) → **OK**

## Étape 5 — (optionnel) la commande `!now`

Répète les étapes 1–4 avec :

- Commande `!now`
- Fetch URL : `http://localhost:8888/now?format=text` → variable `nowResponse`
- Send Message : `%nowResponse%`

## ✅ Test

Dans ton chat Twitch (ou dans la fenêtre de chat interne de Streamer.bot) :

```
!sr Daft Punk One More Time
```

Le chat doit répondre :

```
✅ @ton_viewer a ajouté « One More Time » — Daft Punk à la playlist !
```

et le titre apparaît à la fin de ta playlist Spotify.

## 🧯 Dépannage

| Symptôme | Cause probable |
|---|---|
| Aucune réponse dans le chat | `npm start` pas lancé, ou mauvais port dans l'URL du Fetch URL → vérifie `http://localhost:8888/health` |
| `🔐 Le bot n'est pas connecté à Spotify` | lance `npm run auth` sur le PC |
| `🚫 Spotify refuse l'ajout` | scopes manquants ou compte non propriétaire de la playlist → refaire `npm run auth` en vérifiant la connexion |
| `⏳ encore X min` | cooldown normal ; ajoute le pseudo dans `COOLDOWN_EXEMPT` pour être exempté |
| `🔁 déjà dans la playlist` | `BLOCK_DUPLICATES=true` fonctionne comme prévu |
| La recherche avec `&` ou `?` ne passe pas | vérifie que tu utilises bien `%rawInputUrlEncoded%` et pas `%rawInput%` |

## 🔁 Lancer le bot automatiquement avec le stream

Crée un fichier `start-bot.bat` à la racine du projet :

```bat
@echo off
cd /d "%~dp0"
npm start
```

Puis place un raccourci de ce `.bat` dans le dossier **Démarrage** de Windows
(`Win + R` → `shell:startup` → colle le raccourci). Ainsi `!sr` est dispo dès le boot.
