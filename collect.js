#!/usr/bin/env node
// ---------------------------------------------------------------------------
// AYAK Lead Collector — CLI
// Pulls business leads from Google Places API for Tétouan / M'diq / Martil
// and appends new, deduplicated rows into the AYAK prospect Excel file.
//
// This is a thin console wrapper around runner.js (the same engine the
// dashboard's Express backend uses) — see runner.js for the actual
// search/dedup/Excel-writing logic.
//
// Usage: node collect.js
// ---------------------------------------------------------------------------
require('dotenv').config();

const config = require('./config');
const runner = require('./runner');

// CLI sectors keep the original curated French free-text phrasing
// ("restaurants à Tétouan, Maroc") — unlike the dashboard, which searches by
// raw Google Table A type via includedType (see backend/placeTypesTableA.js).
function buildCliSectorJobs() {
  return config.SECTORS.map((sector) => ({
    label: sector.label,
    buildRequest: (city) => ({ textQuery: `${sector.query} à ${city}` }),
  }));
}

function onEvent(evt) {
  switch (evt.type) {
    case 'start':
      console.log('--- Confirmation des champs demandés (contrôle des coûts) ---');
      console.log('Tier utilisé : Pro uniquement (aucun appel Place Details, aucun champ Enterprise).');
      console.log(`Text Search : ${evt.fieldMask}`);
      console.log('Aucun champ rating / avis / photos / websiteUri / téléphone demandé.');
      console.log("Téléphone: non collecté automatiquement (voir README « Cost Safety ») — à saisir manuellement lors des appels de prospection.");
      console.log(`Budget d'appels API pour ce run : ${evt.maxCalls} appels maximum.\n`);
      break;
    case 'searching':
      console.log(`\n[${evt.city}] ${evt.sector} — recherche: "${evt.request.textQuery}"`);
      break;
    case 'searchResult':
      console.log(`  ${evt.count} résultat(s) trouvé(s)`);
      break;
    case 'lead':
      console.log(`  + [${evt.count}] ${evt.name}`);
      break;
    case 'warning':
      console.warn(`\n[ARRÊT] ${evt.message}`);
      break;
    default:
      break;
  }
}

async function main() {
  if (!config.API_KEY) {
    console.error(
      'Erreur: GOOGLE_PLACES_API_KEY manquant.\n' +
        'Copiez .env.example vers .env et renseignez votre clé API Google Places.'
    );
    process.exit(1);
  }

  const summary = await runner.runCollection({
    cities: config.CITIES,
    sectorJobs: buildCliSectorJobs(),
    onEvent,
  });

  console.log('\n--- Résumé ---');
  if (summary.budgetExceeded) {
    console.log(
      `(!) Run arrêté avant la fin: budget d'appels API atteint (${config.MAX_CALLS_PER_RUN}). ` +
        "Toutes les villes/secteurs n'ont pas été parcourus."
    );
  }
  console.log(`Nouveaux leads ajoutés   : ${summary.newLeads}`);
  console.log(`Total leads dans le fichier : ${summary.totalLeadsInFile}`);
  console.log(`Doublons ignorés         : ${summary.duplicatesSkipped}`);
  console.log(`Appels API               : ${summary.textSearchCalls} Text Search, ${summary.apiErrors} erreur(s)`);
  console.log(`Fichier: ${summary.outputFile}`);
}

main().catch((err) => {
  console.error('\nErreur fatale:', err);
  process.exit(1);
});
