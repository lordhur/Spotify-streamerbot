/**
 * Parse un message de chat et détecte une commande du type "!sr <recherche>".
 * Fonction pure (facilement testable).
 */
export function parseCommand(message, commands) {
  const trimmed = String(message || '').trim();
  if (!trimmed) return { matched: false, command: null, query: '' };
  const lower = trimmed.toLowerCase();
  for (const cmd of commands) {
    if (lower === cmd) return { matched: true, command: cmd, query: '' };
    if (lower.startsWith(cmd) && /\s/.test(trimmed[cmd.length] || '')) {
      return { matched: true, command: cmd, query: trimmed.slice(cmd.length).trim() };
    }
  }
  return { matched: false, command: null, query: '' };
}

/** "75" -> "1 min 15 s", "45" -> "45 s" */
export function formatDuration(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m === 0) return `${r} s`;
  if (r === 0) return `${m} min`;
  return `${m} min ${r} s`;
}
