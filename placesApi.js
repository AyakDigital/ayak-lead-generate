// ---------------------------------------------------------------------------
// Thin wrapper around Google Places API (New) — Text Search only.
// Every call is wrapped so a single failed request logs and returns an
// empty result instead of crashing the whole run.
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
// Details call is made: phone numbers live in the Enterprise SKU (a much
// smaller free monthly allowance) and are intentionally NOT collected here.
// See README.md "Cost Safety" — capture phone numbers manually during
// outreach calls instead.
// ---------------------------------------------------------------------------
const TEXT_SEARCH_FIELD_MASK =
  'nextPageToken,places.id,places.displayName,places.formattedAddress,places.primaryType,places.types';

const client = axios.create({ baseURL: BASE_URL, timeout: 15000 });

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// counters the caller can inspect for the final summary
const stats = { textSearchCalls: 0, apiErrors: 0 };

// ---------------------------------------------------------------------------
// Hard call-budget guardrail. Protects against a bug (or an unexpectedly
// dense sector list) silently running up thousands of billable calls.
// Checked before every outgoing call; once the budget is used up, no further
// HTTP requests are made for the rest of the run.
// ---------------------------------------------------------------------------
let budgetWarningLogged = false;

function totalCalls() {
  return stats.textSearchCalls;
}

function isBudgetExceeded() {
  return totalCalls() >= config.MAX_CALLS_PER_RUN;
}

function warnBudgetOnce() {
  if (budgetWarningLogged) return;
  budgetWarningLogged = true;
  console.warn(
    `\n[ARRÊT] Budget d'appels API atteint (${config.MAX_CALLS_PER_RUN} appels max par exécution, ` +
      'voir MAX_CALLS_PER_RUN dans config.js). Aucun autre appel ne sera fait pour ce run ; ' +
      'les leads déjà trouvés seront tout de même sauvegardés.'
  );
}

/**
 * Text Search (New): searches for `query` and returns an array of
 * { id, name, formattedAddress, primaryType, types } — paginating up to
 * config.MAX_PAGES_PER_SEARCH pages (20 results/page).
 */
async function textSearch(query) {
  const results = [];
  let pageToken;

  for (let page = 0; page < config.MAX_PAGES_PER_SEARCH; page++) {
    if (isBudgetExceeded()) {
      warnBudgetOnce();
      break;
    }

    const body = { textQuery: query, languageCode: 'fr', regionCode: 'MA' };
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
      console.error(`  [erreur] Text Search "${query}": ${describeError(err)}`);
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

function describeError(err) {
  if (err.response) {
    const { status, data } = err.response;
    const message = (data && data.error && data.error.message) || JSON.stringify(data);
    return `HTTP ${status} — ${message}`;
  }
  return err.message;
}

module.exports = {
  textSearch,
  sleep,
  stats,
  isBudgetExceeded,
  TEXT_SEARCH_FIELD_MASK,
};
