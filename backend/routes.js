const express = require('express');
const path = require('path');
const fs = require('fs');
const config = require('../config');
const excel = require('../excelWriter');
const { getSectorCatalog, labelForType } = require('./placeTypesTableA');
const runManager = require('./runManager');

// "Voyage Agency-M'diq-Tétouan_2026-08-03.xlsx" — strip accents/anything
// filesystem-unfriendly, keep it short and readable.
function slugForFilename(str) {
  return str
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildRunExportFilename(run) {
  const date = new Date().toISOString().slice(0, 10);
  const cities = (run.cities || []).map((c) => slugForFilename(c.split(',')[0]));
  const sectors = run.sectorLabels || [];
  const sectorPart = sectors.length === 1 ? slugForFilename(sectors[0]) : `${sectors.length}secteurs`;
  return `leads_${sectorPart}_${cities.join('-') || 'villes'}_${date}.xlsx`;
}

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

  // textQuery must be a categorical phrase, not a bare location — Google's
  // Text Search docs are explicit that includedType filtering "does not
  // apply to geopolitical queries" (a bare city name is exactly that), so
  // `textQuery: city, includedType: type` silently ignores the type filter
  // and searches for nothing meaningful. includedType still narrows/biases
  // results on top of the categorical phrase, same as the CLI's plain-text
  // approach with an added precision filter.
  const sectorJobs = sectors.map((type) => {
    const label = labelForType(type);
    return {
      label,
      buildRequest: (city) => ({ textQuery: `${label} à ${city}`, includedType: type }),
    };
  });

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

// Master cumulative file (every lead ever collected, CLI + dashboard combined).
router.get('/api/download', (req, res) => {
  const filePath = path.resolve(config.OUTPUT_XLSX);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "Aucun fichier de sortie pour l'instant — lancez une collecte d'abord." });
  }
  res.download(filePath, 'AYAK_Prospects_Tetouan_VIDE.xlsx');
});

// Standalone export of ONLY this run's new leads — separate from, and never
// reads or modifies, the master cumulative file above.
router.get('/api/run/:id/download', async (req, res) => {
  const run = runManager.getRun(req.params.id);
  if (!run || run.status !== 'done') {
    return res.status(404).json({ error: 'Export indisponible pour ce run (introuvable ou pas encore terminé).' });
  }
  const leads = (run.summary && run.summary.leads) || [];
  if (leads.length === 0) {
    return res.status(404).json({ error: 'Aucun nouveau lead dans ce run — rien à exporter.' });
  }

  try {
    const workbook = await excel.buildStandaloneWorkbook(leads);
    const filename = buildRunExportFilename(run);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
