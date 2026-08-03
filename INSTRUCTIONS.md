# AYAK Lead Collector — Build Instructions

Build a local Node.js CLI tool I run manually on my laptop with `node collect.js`. 
It pulls business leads from Google Places API and appends them into my existing 
Excel prospect file — no server, no database, no cloud, no n8n.

## Data source
- Google Places API (New) — Text Search / Nearby Search + Place Details
- I provide my own API key via a `.env` file: `GOOGLE_PLACES_API_KEY`
- Stay within Google's free monthly credit — standard Places Text Search + 
  Place Details calls only, no premium/paid add-ons

## Geographic scope
Search only these three areas:
- Tétouan, Morocco
- M'diq, Morocco
- Martil, Morocco

## Sector scope
ALL business sectors — loop through a reasonably comprehensive list of Google 
Place types relevant to Moroccan SMEs (restaurant, retail_store, 
real_estate_agency, car_rental, clothing_store, beauty_salon, gym, school, 
clinic, lawyer, accounting, construction, pharmacy, etc.). Put this list of 
place types in a clearly commented config section so I can edit it later.

## Output file (CRITICAL — use my existing file, don't build a new structure)
The file `AYAK_Prospects_Tetouan_VIDE.xlsx` is in this same folder. Use it as 
the base — copy it to `./output/AYAK_Prospects_Tetouan_VIDE.xlsx` on first run 
if that output copy doesn't exist yet, then APPEND new rows to it on every run 
(never overwrite existing rows).

Sheet name: "Prospects Tétouan"
Exact existing columns, in this order — do not rename, reorder, or add visible columns:

N° | Entreprise | Secteur | Forme juridique | Capital (MAD) | Adresse / Quartier | 
Téléphone | Email | Priorité | Statut d'appel | Date d'appel | Résultat / Notes | 
Relance prévue

Column mapping from Google Places results:
- N°: sequential, continuing from the last existing row number in the sheet
- Entreprise: business name
- Secteur: map the Google Place "type" to a readable French sector label
- Forme juridique: leave blank (not available from Google Places)
- Capital (MAD): leave blank (not available from Google Places)
- Adresse / Quartier: formatted address
- Téléphone: phone number if available, else leave blank
- Email: leave blank (Google Places rarely returns this)
- Priorité: default to exactly "À qualifier" (must match existing dropdown list)
- Statut d'appel: default to exactly "À contacter" (must match existing dropdown list)
- Date d'appel: leave blank
- Résultat / Notes: leave blank
- Relance prévue: leave blank

PRESERVE existing formatting when writing: header row style (Midnight Navy fill 
#0B1F3A, bold white text), column widths, and the existing data validation 
dropdown lists on columns I (Priorité) and J (Statut d'appel). Use openpyxl to 
open and append to the real workbook — do not rebuild it from scratch, so 
formatting/validation isn't lost.

## Deduplication (CRITICAL)
The script must never add a duplicate business across multiple runs.
- Store Google Place IDs in a separate small tracking file (e.g. 
  `./output/seen_places.json`) — NOT as a visible column in the Excel file
- On each run: load the tracking file, skip any Place ID already seen, only 
  process genuinely new businesses
- If a Place ID is missing/unreliable, fall back to matching on name + address 
  as a secondary dedup check
- Update the tracking file with newly added Place IDs after each successful run

## Rate limiting & safety
- Small delay between API calls to avoid rate limit errors
- Log to console: which city/sector is currently being searched, running count 
  of new leads found, and a final summary (new leads added, total leads now in 
  file, duplicates skipped, total API calls made)
- Handle API errors gracefully — skip and log, never crash the whole run

## Developer experience
- `.env` file for the API key, include a `.env.example`
- `npm install` then `node collect.js` should just work, no other setup
- Plain Node.js (no TypeScript), minimal dependencies: dotenv, axios (or 
  node-fetch), openpyxl-equivalent for Node — use `exceljs` since it can read 
  AND preserve formatting/data validation on an existing .xlsx, which `xlsx` 
  (SheetJS) cannot do reliably
- Include a README.md: how to get a Google Places API key, how to enable 
  billing for the free credit, how to run the script

Build the full working project now: package.json, collect.js (split into a 
few clear files if that's cleaner, e.g. a config.js for place types/cities/
column mapping), .env.example, and README.md. Don't wait on me for anything 
not specified above — make reasonable assumptions and note them in the README.