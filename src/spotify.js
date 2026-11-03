import fs from 'node:fs';
import path from 'node:path';

export class SpotifyError extends Error {
  constructor(status, message, body = '') {
    super(message);
    this.name = 'SpotifyError';
    this.status = status;
    this.body = body;
  }
}

/**
 * Client minimal pour l'API Web Spotify :
 * - flux OAuth "Authorization Code" (avec refresh token persistant)
 * - recherche de titres, ajout à une playlist, lecture de l'état courant
 */
export class SpotifyClient {
  constructor(cfg) {
    this.cfg = cfg;
    this.tokens = null;
  }

  loadTokens() {
    try {
      this.tokens = JSON.parse(fs.readFileSync(this.cfg.tokenFile, 'utf8'));
      return this.isAuthed();
    } catch {
      this.tokens = null;
      return false;
    }
  }

  saveTokens(tokens) {
    fs.mkdirSync(path.dirname(this.cfg.tokenFile), { recursive: true });
    this.tokens = tokens;
    fs.writeFileSync(this.cfg.tokenFile, JSON.stringify(tokens, null, 2));
  }

  isAuthed() {
    return !!(this.tokens && (this.tokens.access_token || this.tokens.refresh_token));
  }

  authUrl(state = 'streamerbot') {
    const params = new URLSearchParams({
      client_id: this.cfg.clientId,
      response_type: 'code',
      redirect_uri: this.cfg.redirectUri,
      scope: this.cfg.scopes,
      state,
      show_dialog: 'true',
    });
    return `${this.cfg.accountsBase}/authorize?${params.toString()}`;
  }

  basicAuth() {
    return 'Basic ' + Buffer.from(`${this.cfg.clientId}:${this.cfg.clientSecret}`).toString('base64');
  }

  async exchangeCode(code) {
    const res = await fetch(`${this.cfg.accountsBase}/api/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: this.basicAuth(),
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.cfg.redirectUri,
      }),
    });
    if (!res.ok) throw new SpotifyError(res.status, 'Échec de l\'échange du code OAuth', await res.text());
    const tokens = await res.json();
    tokens.expires_at = Date.now() + (tokens.expires_in || 3600) * 1000;
    this.saveTokens(tokens);
    return tokens;
  }

  async refresh() {
    if (!this.tokens?.refresh_token) throw new SpotifyError(401, 'Aucun refresh token disponible');
    const res = await fetch(`${this.cfg.accountsBase}/api/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: this.basicAuth(),
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: this.tokens.refresh_token,
      }),
    });
    if (!res.ok) {
      throw new SpotifyError(res.status, 'Échec du refresh token (re-autorisation nécessaire)', await res.text());
    }
    const tokens = await res.json();
    tokens.refresh_token = tokens.refresh_token || this.tokens.refresh_token;
    tokens.expires_at = Date.now() + (tokens.expires_in || 3600) * 1000;
    this.saveTokens(tokens);
    return tokens;
  }

  async accessToken() {
    if (!this.tokens) this.loadTokens();
    if (!this.tokens) throw new SpotifyError(401, 'Non authentifié (lance npm run auth)');
    if (!this.tokens.access_token || Date.now() >= (this.tokens.expires_at || 0) - 60_000) {
      await this.refresh();
    }
    return this.tokens.access_token;
  }

  /** Appel API authentifié, avec retry 401 (refresh) et gestion du 429 (Retry-After). */
  async api(pathname, options = {}, retried = false) {
    const token = await this.accessToken();
    const res = await fetch(`${this.cfg.apiBase}${pathname}`, {
      ...options,
      headers: { Authorization: `Bearer ${token}`, ...(options.headers || {}) },
    });
    if (res.status === 401 && !retried) {
      await this.refresh();
      return this.api(pathname, options, true);
    }
    if (res.status === 429) {
      const retryAfter = Math.min(parseInt(res.headers.get('retry-after') || '2', 10) || 2, 30);
      await new Promise((r) => setTimeout(r, retryAfter * 1000));
      return this.api(pathname, options, retried);
    }
    if (!res.ok) {
      throw new SpotifyError(res.status, `Erreur API Spotify (${res.status}) sur ${pathname}`, await res.text().catch(() => ''));
    }
    if (res.status === 204) return null;
    return res.json();
  }

  /** Recherche de titres. */
  searchTracks(query, limit = 1) {
    const params = new URLSearchParams({ q: query, type: 'track', limit: String(limit) });
    if (this.cfg.market) params.set('market', this.cfg.market);
    return this.api(`/search?${params.toString()}`);
  }

  /** Ajoute des titres (URIs) à la fin de la playlist. */
  addToPlaylist(playlistId, uris) {
    return this.api(`/playlists/${playlistId}/tracks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uris }),
    });
  }

  /** URIs des N derniers titres de la playlist (pour détecter les doublons). */
  playlistTrackUris(playlistId, limit = 100) {
    const params = new URLSearchParams({
      limit: String(limit),
      fields: 'items(track(uri,id,name,artists(name)))',
    });
    return this.api(`/playlists/${playlistId}/tracks?${params.toString()}`);
  }

  /** Morceau en cours de lecture sur le compte (nécessite Spotify ouvert). */
  currentlyPlaying() {
    return this.api('/me/player/currently-playing');
  }
}
