// ---------------------------------------------------------------------------
// Dedup tracking file (./output/seen_places.json).
// Primary key: Google Place ID. Secondary key: normalized "name|address"
// (used when a place ID is missing or a place resurfaces under a new ID).
// ---------------------------------------------------------------------------
const fs = require('fs');
const config = require('./config');

function normalize(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip accents (combining diacritical marks)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function nameAddressKey(name, address) {
  return `${normalize(name)}|${normalize(address)}`;
}

function load() {
  if (!fs.existsSync(config.SEEN_PLACES_FILE)) {
    return { places: {}, nameAddressIndex: {} };
  }
  try {
    const raw = fs.readFileSync(config.SEEN_PLACES_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      places: parsed.places || {},
      nameAddressIndex: parsed.nameAddressIndex || {},
    };
  } catch (err) {
    console.error(`[avertissement] Impossible de lire ${config.SEEN_PLACES_FILE}, on repart d'un suivi vide: ${err.message}`);
    return { places: {}, nameAddressIndex: {} };
  }
}

function save(tracking) {
  fs.mkdirSync(config.OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(config.SEEN_PLACES_FILE, JSON.stringify(tracking, null, 2), 'utf8');
}

function isDuplicate(tracking, place) {
  if (place.id && tracking.places[place.id]) return true;
  const key = nameAddressKey(place.name, place.formattedAddress);
  if (tracking.nameAddressIndex[key]) return true;
  return false;
}

function markSeen(tracking, place) {
  const key = nameAddressKey(place.name, place.formattedAddress);
  if (place.id) {
    tracking.places[place.id] = { name: place.name, address: place.formattedAddress };
  }
  tracking.nameAddressIndex[key] = place.id || true;
}

module.exports = { load, save, isDuplicate, markSeen };
