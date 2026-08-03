function formatEvent(evt) {
  switch (evt.type) {
    case 'start':
      return `Démarrage — tier Pro uniquement, budget ${evt.maxCalls} appels max.`;
    case 'searching':
      return `[${evt.city}] ${evt.sector} — recherche en cours…`;
    case 'searchResult':
      return `  ${evt.count} résultat(s) trouvé(s) pour ${evt.sector} (${evt.city})`;
    case 'lead':
      return `  + [${evt.count}] ${evt.name}`;
    case 'duplicate':
      return '  (doublon ignoré)';
    case 'warning':
      return `⚠ ${evt.message}`;
    case 'error':
      return `✕ Erreur : ${evt.message}`;
    case 'done':
      return 'Terminé.';
    default:
      return JSON.stringify(evt);
  }
}

export default function RunPanel({
  maxCalls,
  defaultMaxCalls,
  onMaxCallsChange,
  canRun,
  onRun,
  status,
  events,
  summary,
  downloadUrl,
  selectedCitiesCount,
  selectedSectorsCount,
}) {
  return (
    <div className="run-panel">
      <label className="max-calls-field">
        Budget d'appels API (MAX_CALLS_PER_RUN)
        <input
          type="number"
          min="1"
          value={maxCalls}
          onChange={(e) => onMaxCallsChange(Number(e.target.value) || defaultMaxCalls)}
        />
      </label>

      <p className="muted">
        {selectedCitiesCount} ville(s) × {selectedSectorsCount} secteur(s) sélectionné(s)
      </p>

      <button type="button" className="run-button" disabled={!canRun} onClick={onRun}>
        {status === 'running' ? 'Collecte en cours…' : 'Lancer la collecte'}
      </button>

      {events.length > 0 && (
        <div className="log-panel">
          {events.map((evt, i) => (
            <div key={i} className={`log-line log-${evt.type}`}>
              {formatEvent(evt)}
            </div>
          ))}
        </div>
      )}

      {summary && (
        <div className="summary-panel">
          <h3>Résumé</h3>
          {summary.budgetExceeded && (
            <p className="banner banner-warning">
              Run arrêté avant la fin : budget d'appels API atteint. Toutes les villes/secteurs n'ont pas été
              parcourus.
            </p>
          )}
          <ul>
            <li>
              Nouveaux leads ajoutés : <strong>{summary.newLeads}</strong>
            </li>
            <li>Doublons ignorés : {summary.duplicatesSkipped}</li>
            <li>Total leads dans le fichier : {summary.totalLeadsInFile}</li>
            <li>Appels API (Text Search) : {summary.textSearchCalls}</li>
            <li>Erreurs : {summary.apiErrors}</li>
          </ul>
          <a className="download-button" href={downloadUrl} download>
            Télécharger Excel
          </a>
        </div>
      )}
    </div>
  );
}
