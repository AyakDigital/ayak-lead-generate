import { useMemo, useState } from 'react';

export default function SectorSelector({ catalog, allValues, selected, onChange }) {
  const [filter, setFilter] = useState('');
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const filteredCatalog = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return catalog;
    return catalog
      .map((group) => ({
        ...group,
        types: group.types.filter((t) => t.label.toLowerCase().includes(q) || t.value.includes(q)),
      }))
      .filter((group) => group.types.length > 0);
  }, [catalog, filter]);

  function toggle(value) {
    onChange(selectedSet.has(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  }

  return (
    <div className="sector-selector">
      <div className="sector-controls">
        <input
          type="text"
          placeholder="Rechercher un secteur…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="sector-search"
        />
        <button type="button" onClick={() => onChange(allValues)}>
          Tout sélectionner
        </button>
        <button type="button" onClick={() => onChange([])}>
          Tout désélectionner
        </button>
      </div>

      <p className="muted">
        {selected.length} secteur(s) sélectionné(s) sur {allValues.length}
      </p>

      <div className="sector-groups">
        {filteredCatalog.map((group) => (
          <div key={group.category} className="sector-group">
            <h3>{group.category}</h3>
            <div className="sector-group-grid">
              {group.types.map((t) => (
                <label key={t.value} className="checkbox-row" title={t.value}>
                  <input type="checkbox" checked={selectedSet.has(t.value)} onChange={() => toggle(t.value)} />
                  {t.label}
                </label>
              ))}
            </div>
          </div>
        ))}
        {catalog.length > 0 && filteredCatalog.length === 0 && (
          <p className="muted">Aucun secteur ne correspond à « {filter} ».</p>
        )}
        {catalog.length === 0 && <p className="muted">Chargement…</p>}
      </div>
    </div>
  );
}
