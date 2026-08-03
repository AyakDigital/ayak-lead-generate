// ---------------------------------------------------------------------------
// AYAK Lead Collector — configuration
// Edit SECTORS / CITIES below to change what gets searched.
// ---------------------------------------------------------------------------

// Cities to search. Each is used as free-text "in <city>" in the Places
// Text Search query, so no geocoding / lat-lng lookup is needed.
const CITIES = ["Tétouan, Maroc", "M'diq, Maroc", "Martil, Maroc"];

// ---------------------------------------------------------------------------
// Sectors searched per city. `query` is the French search phrase sent to
// Google Places Text Search (e.g. "restaurants à Tétouan, Maroc").
// `label` is the fallback French "Secteur" value used if Google doesn't
// return a recognized `primaryType` for a result (see TYPE_LABELS below).
//
// Add/remove entries here to change sector coverage — no other file needs
// to change.
// ---------------------------------------------------------------------------
const SECTORS = [
  { query: 'restaurants', label: 'Restauration' },
  { query: 'cafés', label: 'Café' },
  { query: 'boulangeries pâtisseries', label: 'Boulangerie / Pâtisserie' },
  { query: 'bars', label: 'Bar' },
  { query: 'supermarchés', label: 'Supermarché' },
  { query: 'épiceries', label: 'Épicerie' },
  { query: 'magasins de vêtements', label: 'Magasin de vêtements' },
  { query: 'magasins de chaussures', label: 'Magasin de chaussures' },
  { query: 'bijouteries', label: 'Bijouterie' },
  { query: 'magasins de meubles', label: 'Magasin de meubles' },
  { query: 'quincailleries', label: 'Quincaillerie' },
  { query: 'magasins électronique', label: "Magasin d'électronique" },
  { query: 'librairies', label: 'Librairie' },
  { query: 'fleuristes', label: 'Fleuriste' },
  { query: 'animaleries', label: 'Animalerie' },
  { query: 'supérettes', label: 'Supérette' },
  { query: 'grands magasins', label: 'Grand magasin' },
  { query: 'magasins articles maison', label: "Magasin d'articles pour la maison" },
  { query: 'centres commerciaux', label: 'Centre commercial' },
  { query: 'magasins généraux / commerce de détail', label: 'Commerce de détail' },
  { query: 'agences immobilières', label: 'Agence immobilière' },
  { query: 'concessionnaires automobiles', label: 'Concessionnaire automobile' },
  { query: 'locations de voitures', label: 'Location de voitures' },
  { query: 'garages réparation auto', label: 'Garage / Réparation auto' },
  { query: 'lavages auto', label: 'Lavage auto' },
  { query: 'stations-service', label: 'Station-service' },
  { query: 'salons de beauté', label: 'Salon de beauté' },
  { query: 'salons de coiffure', label: 'Salon de coiffure' },
  { query: 'spas instituts', label: 'Spa / Institut' },
  { query: 'salles de sport', label: 'Salle de sport' },
  { query: 'écoles', label: 'École' },
  { query: 'écoles primaires', label: 'École primaire' },
  { query: 'collèges lycées', label: 'Collège / Lycée' },
  { query: 'universités instituts', label: 'Université / Institut' },
  { query: 'auto-écoles', label: "Auto-école" },
  { query: 'cliniques cabinets médicaux', label: 'Clinique / Cabinet médical' },
  { query: 'dentistes', label: 'Dentiste' },
  { query: 'hôpitaux', label: 'Hôpital' },
  { query: 'kinésithérapeutes', label: 'Kinésithérapeute' },
  { query: 'cliniques vétérinaires', label: 'Clinique vétérinaire' },
  { query: 'pharmacies', label: 'Pharmacie' },
  { query: "cabinets d'avocats", label: "Cabinet d'avocats" },
  { query: 'cabinets comptables experts-comptables', label: 'Cabinet comptable' },
  { query: 'notaires', label: 'Notaire' },
  { query: "agences d'assurance", label: "Agence d'assurance" },
  { query: 'banques', label: 'Banque' },
  { query: 'entreprises de construction BTP', label: 'Construction / BTP' },
  { query: 'électriciens', label: 'Électricien' },
  { query: 'plombiers', label: 'Plombier' },
  { query: 'peintres en bâtiment', label: 'Peintre en bâtiment' },
  { query: 'couvreurs', label: 'Couvreur' },
  { query: 'serruriers', label: 'Serrurier' },
  { query: 'entreprises de déménagement', label: 'Déménagement' },
  { query: 'agences de voyage', label: 'Agence de voyage' },
  { query: 'hôtels hébergements', label: 'Hôtel / Hébergement' },
  { query: 'pressings blanchisseries', label: 'Pressing / Blanchisserie' },
  { query: "agences de communication publicité marketing", label: 'Communication / Marketing' },
  { query: 'imprimeries', label: 'Imprimerie' },
  { query: 'sociétés informatiques', label: 'Informatique / IT' },
];

// ---------------------------------------------------------------------------
// Google Places "type" -> French "Secteur" label.
// Google returns a `primaryType` (e.g. "hair_salon") that doesn't always
// match the sector we searched for. This dictionary is used first; if a
// returned type isn't listed here, we fall back to the `label` of the
// SECTORS entry that produced the search.
// ---------------------------------------------------------------------------
const TYPE_LABELS = {
  restaurant: 'Restauration',
  meal_takeaway: 'Restauration (à emporter)',
  meal_delivery: 'Restauration (livraison)',
  cafe: 'Café',
  bakery: 'Boulangerie / Pâtisserie',
  bar: 'Bar',
  night_club: 'Bar / Discothèque',
  supermarket: 'Supermarché',
  grocery_store: 'Épicerie',
  clothing_store: 'Magasin de vêtements',
  shoe_store: 'Magasin de chaussures',
  jewelry_store: 'Bijouterie',
  furniture_store: 'Magasin de meubles',
  hardware_store: 'Quincaillerie',
  electronics_store: "Magasin d'électronique",
  book_store: 'Librairie',
  florist: 'Fleuriste',
  pet_store: 'Animalerie',
  convenience_store: 'Supérette',
  department_store: 'Grand magasin',
  home_goods_store: "Magasin d'articles pour la maison",
  shopping_mall: 'Centre commercial',
  store: 'Commerce de détail',
  real_estate_agency: 'Agence immobilière',
  car_dealer: 'Concessionnaire automobile',
  car_rental: 'Location de voitures',
  car_repair: 'Garage / Réparation auto',
  car_wash: 'Lavage auto',
  gas_station: 'Station-service',
  beauty_salon: 'Salon de beauté',
  hair_salon: 'Salon de coiffure',
  hair_care: 'Salon de coiffure',
  spa: 'Spa / Institut',
  gym: 'Salle de sport',
  school: 'École',
  primary_school: 'École primaire',
  secondary_school: 'Collège / Lycée',
  university: 'Université / Institut',
  driving_school: "Auto-école",
  doctor: 'Clinique / Cabinet médical',
  dentist: 'Dentiste',
  hospital: 'Hôpital',
  physiotherapist: 'Kinésithérapeute',
  veterinary_care: 'Clinique vétérinaire',
  pharmacy: 'Pharmacie',
  lawyer: "Cabinet d'avocats",
  accounting: 'Cabinet comptable',
  notary_public: 'Notaire',
  insurance_agency: "Agence d'assurance",
  bank: 'Banque',
  atm: 'Banque',
  general_contractor: 'Construction / BTP',
  electrician: 'Électricien',
  plumber: 'Plombier',
  painter: 'Peintre en bâtiment',
  roofing_contractor: 'Couvreur',
  locksmith: 'Serrurier',
  moving_company: 'Déménagement',
  travel_agency: 'Agence de voyage',
  lodging: 'Hôtel / Hébergement',
  laundry: 'Pressing / Blanchisserie',
  storage: 'Stockage / Garde-meuble',
  advertising_agency: 'Communication / Marketing',
  printing_shop: 'Imprimerie',
  point_of_interest: 'Autre',
  establishment: 'Autre',
};

module.exports = {
  API_KEY: process.env.GOOGLE_PLACES_API_KEY,
  CITIES,
  SECTORS,
  TYPE_LABELS,

  SHEET_NAME: 'Prospects Tétouan',
  SOURCE_XLSX: './AYAK_Prospects_Tetouan_VIDE.xlsx',
  OUTPUT_DIR: './output',
  OUTPUT_XLSX: './output/AYAK_Prospects_Tetouan_VIDE.xlsx',
  SEEN_PLACES_FILE: './output/seen_places.json',

  PRIORITE_DEFAULT: 'À qualifier',
  STATUT_DEFAULT: 'À contacter',

  // Delay between successive Google API calls (ms) — avoids hitting rate limits.
  REQUEST_DELAY_MS: 250,
  // Delay before requesting a Text Search next-page token (Google requires
  // a short wait before a token becomes valid).
  NEXT_PAGE_DELAY_MS: 2000,
  // Max pages of Text Search results to fetch per city/sector (20 results/page).
  MAX_PAGES_PER_SEARCH: 3,
  // Hard cap on total billable API calls (Text Search, Pro tier — no Place
  // Details calls are made) in a single run. If a bug or an unexpectedly
  // dense sector list would exceed this, the run stops early with a warning
  // instead of continuing to spend.
  MAX_CALLS_PER_RUN: 500,

  HEADER_FILL_ARGB: '000B1F3A',
  DATA_VALIDATION_LAST_ROW: 1001, // rows already pre-formatted with dropdowns in the template
};
