import { spawn } from 'node:child_process';
import { createApp } from './server.js';

/** Ouvre l'URL dans le navigateur par défaut (Windows / macOS / Linux). */
function openBrowser(url) {
  try {
    const platform = process.platform;
    if (platform === 'win32') {
      spawn('cmd', ['/c', 'start', '""', url], { detached: true, stdio: 'ignore' }).unref();
    } else if (platform === 'darwin') {
      spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
    } else {
      spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref();
    }
  } catch {
    /* on affichera l'URL en console de toute façon */
  }
}

/**
 * Connexion one-shot à Spotify :
 *   npm run auth
 * Ouvre le navigateur sur la page d'autorisation Spotify, attend le callback
 * local, sauvegarde le token dans .token.json, puis quitte.
 */
const { app, cfg, client } = createApp();

if (client.isAuthed()) {
  console.log('✅ Déjà connecté à Spotify (.token.json trouvé). Rien à faire, lance "npm start".');
  process.exit(0);
}

if (!cfg.clientId || !cfg.clientSecret) {
  console.error('❌ SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET manquants : configure ton .env (voir .env.example et docs/spotify-dashboard-setup.md).');
  process.exit(1);
}

const server = app.listen(cfg.port, cfg.host, () => {
  const url = client.authUrl();
  console.log('\n🔐 Connecte le bot à ton compte Spotify Premium :');
  console.log(`   ${url}\n`);
  console.log('   (le navigateur va s\'ouvrir tout seul ; sinon copie l\'URL ci-dessus)');
  console.log('   ⚠️  Connecte-toi avec le compte propriétaire de la playlist cible.\n');
  openBrowser(url);
});

// Quitte proprement dès que le token est reçu
const poll = setInterval(() => {
  if (client.isAuthed()) {
    clearInterval(poll);
    console.log('✅ Autorisation reçue ! Token sauvegardé dans .token.json.');
    console.log('   Tu peux maintenant lancer le bot avec : npm start');
    server.close(() => process.exit(0));
  }
}, 1000);

// Sécurité : on abandonne après 5 minutes
setTimeout(() => {
  console.error('⏰ Timeout (5 min) : relance "npm run auth".');
  process.exit(1);
}, 5 * 60 * 1000).unref();
