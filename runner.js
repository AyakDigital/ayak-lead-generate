// ---------------------------------------------------------------------------
// Core collection engine — shared by the CLI (collect.js) and the dashboard
// backend (backend/runManager.js). Neither of those files re-implements this
// loop; they only differ in how "sector jobs" are built (CLI: curated French
// phrases; dashboard: raw Google Table A types via includedType) and how
// progress is reported (CLI: console.log; dashboard: SSE events via onEvent).
// ---------------------------------------------------------------------------
const config = require('./config');
const placesApi = require('./placesApi');
const excel = require('./excelWriter');
const dedupe = require('./dedupe');

/**
 * @param {object} params
 * @param {string[]} params.cities
 * @param {{label: string, buildRequest: (city: string) => {textQuery: string, includedType?: string}}[]} params.sectorJobs
 * @param {number} [params.maxCalls] - overrides config.MAX_CALLS_PER_RUN
 * @param {(event: object) => void} [params.onEvent] - progress callback; event.type is one
 *   of: start, searching, searchResult, lead, duplicate, warning, done
 * @returns {Promise<object>} final summary
 */
async function runCollection({ cities, sectorJobs, maxCalls, onEvent }) {
  const emit = onEvent || (() => {});

  const places = placesApi.createClient({
    maxCalls,
    onBudgetWarning: (message) => emit({ type: 'warning', message }),
  });

  excel.ensureOutputCopy();
  const { workbook, worksheet } = await excel.openWorksheet();
  const tracking = dedupe.load();
  let { nextRow, nextNumero } = excel.findStartingPoint(worksheet);

  const summary = { newLeads: 0, duplicatesSkipped: 0 };
  // Raw records for just this run's new leads (independent of the master
  // file's row numbers) — lets callers (the dashboard) offer a standalone
  // per-run export without touching or re-reading the cumulative master file.
  const leadsThisRun = [];

  emit({
    type: 'start',
    fieldMask: placesApi.TEXT_SEARCH_FIELD_MASK,
    apiKeyPresent: Boolean(config.API_KEY),
    maxCalls: places.maxCalls,
    cities,
    sectorCount: sectorJobs.length,
  });

  cityLoop:
  for (const city of cities) {
    for (const job of sectorJobs) {
      if (places.isBudgetExceeded()) break cityLoop;

      const request = job.buildRequest(city);
      emit({ type: 'searching', city, sector: job.label, request });

      const results = await places.textSearch(request);
      emit({ type: 'searchResult', city, sector: job.label, count: results.length });
      await places.sleep(config.REQUEST_DELAY_MS);

      for (const place of results) {
        if (!place.name) continue; // skip malformed results

        if (dedupe.isDuplicate(tracking, place)) {
          summary.duplicatesSkipped++;
          emit({ type: 'duplicate', name: place.name, count: summary.duplicatesSkipped });
          continue;
        }

        const secteur =
          config.TYPE_LABELS[place.primaryType] ||
          (place.types || []).map((t) => config.TYPE_LABELS[t]).find(Boolean) ||
          job.label;

        const leadRecord = {
          entreprise: place.name,
          secteur,
          adresse: place.formattedAddress || '',
          telephone: null, // not collected — Pro tier only, see README "Cost Safety"
        };

        excel.appendRow(worksheet, nextRow, { ...leadRecord, numero: nextNumero });
        leadsThisRun.push(leadRecord);

        dedupe.markSeen(tracking, place);

        nextRow++;
        nextNumero++;
        summary.newLeads++;
        emit({ type: 'lead', name: place.name, secteur, count: summary.newLeads });

        if (places.isBudgetExceeded()) break;
      }

      if (places.isBudgetExceeded()) break cityLoop;
    }
  }

  await excel.save(workbook);
  dedupe.save(tracking);

  summary.budgetExceeded = places.isBudgetExceeded();
  summary.totalLeadsInFile = nextNumero - 1;
  summary.textSearchCalls = places.stats.textSearchCalls;
  summary.apiErrors = places.stats.apiErrors;
  summary.outputFile = config.OUTPUT_XLSX;
  summary.leads = leadsThisRun;

  // The browser doesn't need the raw lead records over SSE (it fetches the
  // per-run export as a file instead) — keep the event payload small.
  const { leads, ...publicSummary } = summary;
  emit({ type: 'done', summary: publicSummary });

  return summary;
}

module.exports = { runCollection };
