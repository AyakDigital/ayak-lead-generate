# 🖥️ AYAK Lead Collector

Local Node.js CLI that pulls business leads from the Google Places API and appends them to `AYAK_Prospects_Tetouan_VIDE.xlsx`. No server, no database, runs manually on your laptop.

---

## 🔑 1 — Get a Google Places API key

1. Go to the [Google Cloud Console](https://console.cloud.google.com/) and create a project (or pick an existing one).
2. Enable **Places API (New)** for that project — *APIs & Services → Library → search "Places API (New)" → Enable.*
3. Enable billing on the project — *Billing → link a billing account.* This is required even to use the free monthly call allowance; Google needs a card on file, but you won't be charged as long as you stay under it (see [Cost Safety](#-cost-safety) below for what "free" actually means now).
4. Create an API key — *APIs & Services → Credentials → Create Credentials → API key.* Copy it.
5. *(Recommended)* Restrict the key to "Places API (New)" only — *Credentials → your key → API restrictions.*

This tool is deliberately frugal with calls and requests only the minimum fields needed (see [Cost Safety](#-cost-safety)), but you are responsible for watching your own Google Cloud billing dashboard and usage.

---

## ⚙️ 2 — Install & configure

```bash
npm install
cp .env.example .env
```

Edit `.env` and paste your key:

```
GOOGLE_PLACES_API_KEY=your_actual_key_here
```

---

## ▶️ 3 — Run

```bash
node collect.js
```

On the first run, it copies `AYAK_Prospects_Tetouan_VIDE.xlsx` into `./output/AYAK_Prospects_Tetouan_VIDE.xlsx` and appends new leads there. Every subsequent run appends further new leads to that same output file — your original template file in the project root is never modified.

The console logs each city/sector as it searches, each new lead found, and a final summary *(new leads added, total leads in file, duplicates skipped, API calls made)*.

> Run it again any time (e.g. weekly) to pick up new listings — already-seen businesses are skipped automatically.

---

## 🧭 How it works

- **Search** — for each of the 3 cities *(Tétouan, M'diq, Martil)* × ~55 sectors in `config.js`, it runs a Google Places Text Search (e.g. *"restaurants à Tétouan, Maroc"*).
- **Phone numbers** — intentionally **not** collected. Text Search alone returns everything the sheet needs (name, address, type, Place ID), so there's no Place Details call at all — see [Cost Safety](#-cost-safety). `Téléphone` is always left blank; capture it manually during outreach calls.
- **Sector labels** — mapped from Google's returned place type to a French label (`config.js` → `TYPE_LABELS`); falls back to the label of the sector that was searched if Google returns an unrecognized type.
- **Excel** — uses `exceljs` to open the real workbook and append rows in place, so the header style (Midnight Navy fill, bold white text), column widths, and the Priorité/Statut d'appel dropdown lists are preserved exactly as in the template.
- **Dedup** — `./output/seen_places.json` tracks every Google Place ID (and a normalized name+address fallback, in case a place ID is ever missing or changes) already added, so re-running never creates duplicate rows.

---

## 💰 Cost Safety

- **No more $200/month pooled credit.** Google retired the old blanket $200/month Maps Platform credit in March 2025. The current free tier for Places API (New) is a **per-SKU monthly call limit** (e.g. a number of free calls per month for each pricing tier), not a dollar amount you can spend down across any endpoint. Budgeting now means watching call counts per SKU, not a single dollar balance.
- **This script stays on the Pro tier only — nothing else.** The field mask is defined once, as a named constant at the top of `placesApi.js` (`TEXT_SEARCH_FIELD_MASK`), and only requests name, address, place type, and Place ID via Text Search — never rating, review counts, reviews, photos, or website URLs, each of which would upgrade the *entire* call to a pricier SKU.

  **Phone numbers are deliberately excluded**: there is no Place Details call anywhere in this codebase, because phone number fields (`nationalPhoneNumber` / `internationalPhoneNumber`) only exist on the Enterprise SKU, which has a much smaller free monthly call allowance than Pro. At this tool's scale (3 cities × the sectors in `config.js`), staying on Pro-only keeps usage comfortably inside Google's free Pro-tier monthly allowance.

  **Capture phone numbers manually** — call the businesses in the sheet and fill in `Téléphone` yourself as part of outreach; don't add a Place Details / phone lookup back into this script without re-reading this section. The console prints the exact field mask in use at the start of every run so this is visible before any calls are made.
- **A hard call budget is enforced.** `MAX_CALLS_PER_RUN` in `config.js` (default `500`) caps total Text Search calls in a single run. If a bug or an unexpectedly dense sector list would exceed it, the run stops early, prints a clear warning, and still saves whatever leads were already found — it never silently keeps going.
- **Set a budget alert as a manual safety net.** In Google Cloud Console: *Billing → Budgets & Alerts → create a budget with an email alert.* This is independent of anything this script does and is the right backstop for mistakes outside the script's control (e.g. a leaked API key).
- **Check actual usage after your first run.** Google Cloud Console → *APIs & Services → Places API (New) → Metrics/Quotas* shows real call counts broken down by SKU — confirm you're only seeing Text Search / Pro-tier usage, no Enterprise calls. Compare against what the console summary printed (`Appels API: N Text Search`) before running repeatedly or widening `SECTORS`/`CITIES`. Free-tier allowance numbers change over time, so check the current published limits on the [pricing page](https://developers.google.com/maps/documentation/places/web-service/usage-and-billing) rather than trusting any specific figure quoted here.

---

## 🔧 Configuration

Edit `config.js` to change:

| Key | Controls |
|---|---|
| `CITIES` | The list of cities searched |
| `SECTORS` | The list of `{ query, label }` sectors searched per city. Add or remove entries here to change coverage; each `query` is appended with "à `<city>`" to form the Google search text |
| `TYPE_LABELS` | The Google place-type → French sector label dictionary |
| `REQUEST_DELAY_MS` / `MAX_PAGES_PER_SEARCH` | Rate limiting / pagination |
| `MAX_CALLS_PER_RUN` | Hard cap on total API calls per run *(see [Cost Safety](#-cost-safety))* |

---

## 📁 Files

```
collect.js         Entry point / orchestration
config.js           Cities, sectors, sector-label mapping, file paths, defaults
placesApi.js        Google Places API (New) calls (Text Search only, Pro tier),
                     with per-call error handling so one failed request never
                     crashes the run
excelWriter.js       Opens the output workbook, appends rows, preserves
                     formatting/dropdowns
dedupe.js            Reads/writes ./output/seen_places.json and the
                     duplicate-checking logic
.env.example         Template for your API key
```

---

## 📝 Assumptions made *(not specified in the brief)*

- The sector list covers ~55 common Moroccan SME categories built from the examples given; edit `SECTORS` in `config.js` to add/remove any.
- Text Search results are paginated up to 3 pages (60 results) per city/sector before moving on, to bound worst-case API usage for very dense categories.
- Search queries are phrased in French (e.g. *"salons de coiffure à M'diq, Maroc"*) since that matches the target market and the sheet's French labels; `regionCode: 'MA'` and `languageCode: 'fr'` are passed to bias results towards Morocco.
- `Téléphone` is always left blank — phone numbers are intentionally not collected from the API at all (Pro-tier-only cost decision, see [Cost Safety](#-cost-safety)), not just blank when Google happens not to return one.
- `./output/` (the generated workbook + `seen_places.json`) is **not** gitignored by default, since it's your actual lead data, not a build artifact — decide for yourself whether to commit or exclude it if you put this project under version control.
