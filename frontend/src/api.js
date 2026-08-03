export async function fetchCities() {
  const res = await fetch('/api/cities');
  if (!res.ok) throw new Error('Impossible de charger les villes');
  return res.json();
}

export async function fetchSectors() {
  const res = await fetch('/api/sectors');
  if (!res.ok) throw new Error('Impossible de charger les secteurs');
  return res.json();
}

export async function fetchSettings() {
  const res = await fetch('/api/settings');
  if (!res.ok) throw new Error('Impossible de charger les paramètres');
  return res.json();
}

export async function startRun({ cities, sectors, maxCalls }) {
  const res = await fetch('/api/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cities, sectors, maxCalls }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Impossible de démarrer la collecte');
  return data; // { runId }
}

// Returns an unsubscribe function.
export function subscribeToRun(runId, onEvent) {
  const source = new EventSource(`/api/run/${runId}/events`);
  source.onmessage = (msg) => {
    try {
      onEvent(JSON.parse(msg.data));
    } catch {
      // ignore malformed events
    }
  };
  return () => source.close();
}

export function downloadUrl() {
  return '/api/download';
}
