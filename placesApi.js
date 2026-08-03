// ---------------------------------------------------------------------------
// Thin wrapper around Google Places API (New) — Text Search only.
// Every call is wrapped so a single failed request logs and returns an
// empty result instead of crashing the whole run.
//
// Exposes createClient() — a factory, not a singleton — because the
// dashboard's Express server is long-lived and may run multiple collections
// over its lifetime. Each run needs its own call counters / budget state so
// one run's usage can't bleed into the next. The CLI just creates one client
// per process invocation, which behaves exactly as a singleton would.
// ---------------------------------------------------------------------------
const axios = require('axios');
const config = require('./config');

const BASE_URL = 'https://places.googleapis.com/v1';

// ---------------------------------------------------------------------------
// FIELD MASK — Pro tier only. Do not add fields (rating, userRatingCount,
// reviews, photos, websiteUri, opening hours, phone numbers, etc.) without
// checking current SKU pricing first:
// https://developers.google.com/maps/documentation/places/web-service/usage-and-billing
//
// This is deliberately Text Search's Pro-tier field set — id, displayName,
// formattedAddress, primaryType, types — which is everything the sheet
// needs (N°, Entreprise, Secteur, Adresse / Quartier, dedup key). No Place
// Details call is made anywhere in this codebase (CLI or dashboard): phone
// numbers live in the Enterprise SKU (a much smaller free monthly
// allowance) and are intentionally NOT collected. See README.md
// "Cost Safety" — capture phone numbers manually during outreach calls.
// ---------------------------------------------------------------------------
const TEXT_SEARCH_FIELD_MASK =
  'nextPageToken,places.id,places.displayName,places.formattedAddress,places.primaryType,places.types';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function describeError(err) {
  if (err.response) {
    const { status, data } = err.response;
    const message = (data && data.error && data.error.message) || JSON.stringify(data);
    return `HTTP ${status} — ${message}`;
  }
  return err.message;
}

/**
 * Creates an isolated Places API client with its own call-budget state.
 * @param {object} [opts]
 * @param {number} [opts.maxCalls] - overrides config.MAX_CALLS_PER_RUN for this client.
 * @param {(message: string) => void} [opts.onBudgetWarning] - called (once)
 *   when the budget is hit, instead of the default console.warn. The
 *   dashboard uses this to emit an SSE event instead of only logging server-side.
 */
function createClient(opts = {}) {
  const maxCalls = opts.maxCalls || config.MAX_CALLS_PER_RUN;
  const client = axios.create({ baseURL: BASE_URL, timeout: 15000 });

  const stats = { textSearchCalls: 0, apiErrors: 0 };
  let budgetWarningLogged = false;

  function isBudgetExceeded() {
    return stats.textSearchCalls >= maxCalls;
  }

  function warnBudgetOnce() {
    if (budgetWarningLogged) return;
    budgetWarningLogged = true;
    const message =
      `Budget d'appels API atteint (${maxCalls} appels max par exécution). ` +
      "Aucun autre appel ne sera fait pour ce run ; les leads déjà trouvés seront tout de même sauvegardés.";
    if (opts.onBudgetWarning) opts.onBudgetWarning(message);
    else console.warn(`\n[ARRÊT] ${message}`);
  }

  /**
   * Text Search (New): searches for `textQuery`, optionally filtered to a
   * single Google place type via `includedType` (a Table A type string,
   * e.g. "hair_salon" — used by the dashboard's sector picker instead of
   * baking the type into free-text French phrasing like the CLI does).
   * Returns an array of { id, name, formattedAddress, primaryType, types },
   * paginating up to config.MAX_PAGES_PER_SEARCH pages (20 results/page).
   */
  async function textSearch({ textQuery, includedType } = {}) {
    const results = [];
    let pageToken;

    for (let page = 0; page < config.MAX_PAGES_PER_SEARCH; page++) {
      if (isBudgetExceeded()) {
        warnBudgetOnce();
        break;
      }

      const body = { textQuery, languageCode: 'fr', regionCode: 'MA' };
      if (includedType) body.includedType = includedType;
      if (pageToken) body.pageToken = pageToken;

      let data;
      try {
        stats.textSearchCalls++;
        const res = await client.post('/places:searchText', body, {
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': config.API_KEY,
            'X-Goog-FieldMask': TEXT_SEARCH_FIELD_MASK,
          },
        });
        data = res.data;
      } catch (err) {
        stats.apiErrors++;
        console.error(`  [erreur] Text Search "${textQuery}"${includedType ? ` (${includedType})` : ''}: ${describeError(err)}`);
        break;
      }

      for (const place of data.places || []) {
        results.push({
          id: place.id,
          name: place.displayName && place.displayName.text,
          formattedAddress: place.formattedAddress,
          primaryType: place.primaryType,
          types: place.types || [],
        });
      }

      pageToken = data.nextPageToken;
      if (!pageToken) break;

      // Next-page tokens need a short delay before they become valid.
      await sleep(config.NEXT_PAGE_DELAY_MS);
    }

    return results;
  }

  return { textSearch, sleep, stats, isBudgetExceeded, maxCalls };
}

module.exports = { createClient, sleep, TEXT_SEARCH_FIELD_MASK };
