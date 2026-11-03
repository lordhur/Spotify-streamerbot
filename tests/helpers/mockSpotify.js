import http from 'node:http';

/**
 * Mock de l'API Spotify (accounts + web api) pour les tests d'intégration.
 * Un seul "track" est retourné par la recherche, et la playlist du mock
 * se souvient des URIs ajoutés (pour tester la détection de doublons).
 */
export function startMockSpotify() {
  const state = {
    playlistUris: new Set(),
    track: {
      id: 'track1',
      uri: 'spotify:track:track1',
      name: 'One More Time',
      artists: [{ name: 'Daft Punk' }],
    },
    calls: [],
  };

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://mock');
    state.calls.push(`${req.method} ${url.pathname}${url.search}`);
    const json = (code, obj) => {
      res.writeHead(code, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(obj));
    };

    if (req.method === 'POST' && url.pathname === '/api/token') {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () =>
        json(200, { access_token: 'mock-access', refresh_token: 'mock-refresh', expires_in: 3600, token_type: 'Bearer' })
      );
      return;
    }
    if (url.pathname === '/search') {
      return json(200, { tracks: { items: [state.track] } });
    }
    const plMatch = url.pathname.match(/^\/playlists\/([^/]+)\/tracks$/);
    if (plMatch && req.method === 'GET') {
      return json(200, {
        items: [...state.playlistUris].map((uri) => ({ track: { uri, id: uri.split(':').pop(), name: 'x', artists: [{ name: 'y' }] } })),
      });
    }
    if (plMatch && req.method === 'POST') {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        const { uris } = JSON.parse(body || '{}');
        (uris || []).forEach((u) => state.playlistUris.add(u));
        json(200, { snapshot_id: 'snap1' });
      });
      return;
    }
    if (url.pathname === '/me/player/currently-playing') {
      return json(200, { item: { id: 'now1', name: 'Get Lucky', artists: [{ name: 'Daft Punk' }] } });
    }
    json(404, { error: { status: 404, message: 'not found in mock' } });
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port, state }));
  });
}
