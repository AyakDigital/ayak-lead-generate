const express = require('express');
const path = require('path');
const fs = require('fs');
const config = require('../config');
const { getSectorCatalog } = require('./placeTypesTableA');
const runManager = require('./runManager');

const router = express.Router();

router.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

router.get('/api/cities', (req, res) => {
  res.json(config.CITIES.map((city) => ({ value: city, label: city })));
});

router.get('/api/sectors', (req, res) => {
  res.json(getSectorCatalog());
});

router.get('/api/settings', (req, res) => {
  res.json({ defaultMaxCalls: config.MAX_CALLS_PER_RUN });
});

router.post('/api/run', (req, res) => {
  if (!config.API_KEY) {
    return res.status(400).json({ error: 'GOOGLE_PLACES_API_KEY manquant côté serveur (.env).' });
  }

  const { cities, sectors, maxCalls } = req.body || {};

  if (!Array.isArray(cities) || cities.length === 0) {
    return res.status(400).json({ error: 'Sélectionnez au moins une ville.' });
  }
  if (!Array.isArray(sectors) || sectors.length === 0) {
    return res.status(400).json({ error: 'Sélectionnez au moins un secteur.' });
  }
  const invalidCities = cities.filter((c) => !config.CITIES.includes(c));
  if (invalidCities.length > 0) {
    return res.status(400).json({ error: `Ville(s) invalide(s): ${invalidCities.join(', ')}` });
  }

  const sectorJobs = sectors.map((type) => ({
    label: config.TYPE_LABELS[type] || type,
    buildRequest: (city) => ({ textQuery: city, includedType: type }),
  }));

  try {
    const run = runManager.startRun({
      cities,
      sectorJobs,
      maxCalls: maxCalls ? Number(maxCalls) : undefined,
    });
    res.status(202).json({ runId: run.id });
  } catch (err) {
    if (err.code === 'RUN_IN_PROGRESS') {
      return res.status(409).json({ error: err.message });
    }
    throw err;
  }
});

router.get('/api/run/:id/events', (req, res) => {
  const run = runManager.getRun(req.params.id);
  if (!run) {
    return res.status(404).json({ error: 'Run introuvable (peut-être terminé depuis longtemps).' });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.flushHeaders && res.flushHeaders();

  const send = (evt) => res.write(`data: ${JSON.stringify(evt)}\n\n`);

  for (const evt of run.events) send(evt);

  if (run.status !== 'running') {
    res.end();
    return;
  }

  const listener = (evt) => {
    send(evt);
    if (evt.type === 'done' || evt.type === 'error') res.end();
  };
  run.emitter.on('event', listener);

  req.on('close', () => run.emitter.off('event', listener));
});

router.get('/api/download', (req, res) => {
  const filePath = path.resolve(config.OUTPUT_XLSX);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "Aucun fichier de sortie pour l'instant — lancez une collecte d'abord." });
  }
  res.download(filePath, 'AYAK_Prospects_Tetouan_VIDE.xlsx');
});

module.exports = router;
