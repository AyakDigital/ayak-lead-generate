import { useEffect, useMemo, useState } from 'react';
import { fetchCities, fetchSectors, fetchSettings, startRun, subscribeToRun, downloadUrl } from './api';
import CitySelector from './components/CitySelector.jsx';
import SectorSelector from './components/SectorSelector.jsx';
import RunPanel from './components/RunPanel.jsx';

export default function App() {
  const [cities, setCities] = useState([]);
  const [sectorCatalog, setSectorCatalog] = useState([]);
  const [defaultMaxCalls, setDefaultMaxCalls] = useState(500);

  const [selectedCities, setSelectedCities] = useState([]);
  const [selectedSectors, setSelectedSectors] = useState([]);
  const [maxCalls, setMaxCalls] = useState(500);

  const [events, setEvents] = useState([]);
  const [status, setStatus] = useState('idle'); // idle | running | done | error
  const [summary, setSummary] = useState(null);
  const [runId, setRunId] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [startError, setStartError] = useState(null);

  useEffect(() => {
    fetchCities().then(setCities).catch((e) => setLoadError(e.message));
    fetchSectors().then(setSectorCatalog).catch((e) => setLoadError(e.message));
    fetchSettings()
      .then((s) => {
        setDefaultMaxCalls(s.defaultMaxCalls);
        setMaxCalls(s.defaultMaxCalls);
      })
      .catch(() => {});
  }, []);

  const allSectorValues = useMemo(
    () => sectorCatalog.flatMap((group) => group.types.map((t) => t.value)),
    [sectorCatalog]
  );

  async function handleRun() {
    setStartError(null);
    setEvents([]);
    setSummary(null);
    setRunId(null);
    setStatus('running');
    try {
      const { runId: newRunId } = await startRun({ cities: selectedCities, sectors: selectedSectors, maxCalls });
      setRunId(newRunId);
      const unsubscribe = subscribeToRun(newRunId, (evt) => {
        setEvents((prev) => [...prev, evt]);
        if (evt.type === 'done') {
          setStatus('done');
          setSummary(evt.summary);
          unsubscribe();
        } else if (evt.type === 'error') {
          setStatus('error');
          unsubscribe();
        }
      });
    } catch (err) {
      setStatus('error');
      setStartError(err.message);
    }
  }

  const canRun = status !== 'running' && selectedCities.length > 0 && selectedSectors.length > 0;

  return (
    <div className="app">
      <header className="app-header">
        <h1>AYAK Lead Collector</h1>
        <p className="subtitle">Collecte de leads Google Places — Tétouan, M'diq, Martil</p>
      </header>

      {loadError && <div className="banner banner-error">{loadError}</div>}
      {startError && <div className="banner banner-error">{startError}</div>}

      <div className="layout">
        <section className="panel">
          <h2>1. Villes</h2>
          <CitySelector cities={cities} selected={selectedCities} onChange={setSelectedCities} />
        </section>

        <section className="panel panel-sectors">
          <h2>2. Secteurs</h2>
          <SectorSelector
            catalog={sectorCatalog}
            allValues={allSectorValues}
            selected={selectedSectors}
            onChange={setSelectedSectors}
          />
        </section>

        <section className="panel">
          <h2>3. Lancer</h2>
          <RunPanel
            maxCalls={maxCalls}
            defaultMaxCalls={defaultMaxCalls}
            onMaxCallsChange={setMaxCalls}
            canRun={canRun}
            onRun={handleRun}
            status={status}
            events={events}
            summary={summary}
            downloadUrl={downloadUrl()}
            runDownloadUrl={runId ? `/api/run/${runId}/download` : null}
            selectedCitiesCount={selectedCities.length}
            selectedSectorsCount={selectedSectors.length}
          />
        </section>
      </div>
    </div>
  );
}
