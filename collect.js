#!/usr/bin/env node
// ---------------------------------------------------------------------------
// AYAK Lead Collector
// Pulls business leads from Google Places API for Tétouan / M'diq / Martil
// and appends new, deduplicated rows into the AYAK prospect Excel file.
//
// Usage: node collect.js
// ---------------------------------------------------------------------------
require('dotenv').config();

const config = require('./config');
const places = require('./placesApi');
const excel = require('./excelWriter');
const dedupe = require('./dedupe');

async function main() {
  if (!config.API_KEY) {
    console.error(
      'Erreur: GOOGLE_PLACES_API_KEY manquant.\n' +
        'Copiez .env.example vers .env et renseignez votre clé API Google Places.'
    );
    process.exit(1);
  }

  console.log('--- Confirmation des champs demandés (contrôle des coûts) ---');
  console.log('Tier utilisé : Pro uniquement (aucun appel Place Details, aucun champ Enterprise).');
  console.log(`Text Search : ${places.TEXT_SEARCH_FIELD_MASK}`);
  console.log('Aucun champ rating / avis / photos / websiteUri / téléphone demandé.');
  console.log("Téléphone: non collecté automatiquement (voir README « Cost Safety ») — à saisir manuellement lors des appels de prospection.");
  console.log(`Budget d'appels API pour ce run : ${config.MAX_CALLS_PER_RUN} appels maximum.\n`);

  excel.ensureOutputCopy();
  const { workbook, worksheet } = await excel.openWorksheet();
  const tracking = dedupe.load();
  let { nextRow, nextNumero } = excel.findStartingPoint(worksheet);

  const summary = { newLeads: 0, duplicatesSkipped: 0 };

  cityLoop:
  for (const city of config.CITIES) {
    for (const sector of config.SECTORS) {
      if (places.isBudgetExceeded()) break cityLoop;

      const query = `${sector.query} à ${city}`;
      console.log(`\n[${city}] ${sector.label} — recherche: "${query}"`);

      const results = await places.textSearch(query);
      console.log(`  ${results.length} résultat(s) trouvé(s)`);
      await places.sleep(config.REQUEST_DELAY_MS);

      for (const place of results) {
        if (!place.name) continue; // skip malformed results

        if (dedupe.isDuplicate(tracking, place)) {
          summary.duplicatesSkipped++;
          continue;
        }

        const secteur =
          config.TYPE_LABELS[place.primaryType] ||
          (place.types || []).map((t) => config.TYPE_LABELS[t]).find(Boolean) ||
          sector.label;

        excel.appendRow(worksheet, nextRow, {
          numero: nextNumero,
          entreprise: place.name,
          secteur,
          adresse: place.formattedAddress || '',
          telephone: null, // not collected — Pro tier only, see README "Cost Safety"
        });

        dedupe.markSeen(tracking, place);

        nextRow++;
        nextNumero++;
        summary.newLeads++;
        console.log(`  + [${summary.newLeads}] ${place.name}`);

        if (places.isBudgetExceeded()) break;
      }

      if (places.isBudgetExceeded()) break cityLoop;
    }
  }

  await excel.save(workbook);
  dedupe.save(tracking);

  console.log('\n--- Résumé ---');
  if (places.isBudgetExceeded()) {
    console.log(
      `(!) Run arrêté avant la fin: budget d'appels API atteint (${config.MAX_CALLS_PER_RUN}). ` +
        'Toutes les villes/secteurs n\'ont pas été parcourus.'
    );
  }
  console.log(`Nouveaux leads ajoutés   : ${summary.newLeads}`);
  console.log(`Total leads dans le fichier : ${nextNumero - 1}`);
  console.log(`Doublons ignorés         : ${summary.duplicatesSkipped}`);
  console.log(
    `Appels API               : ${places.stats.textSearchCalls} Text Search, ${places.stats.apiErrors} erreur(s)`
  );
  console.log(`Fichier: ${config.OUTPUT_XLSX}`);
}

main().catch((err) => {
  console.error('\nErreur fatale:', err);
  process.exit(1);
});
