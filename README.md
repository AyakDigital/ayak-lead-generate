# AYAK Lead Collector

Pulls business leads from the Google Places API and appends them to
`AYAK_Prospects_Tetouan_VIDE.xlsx`. Everything runs on your laptop — no
cloud, no remote deploy, no database.

There are two ways to use it, and **both stay fully working**:
- **CLI** (`node collect.js`) — the original script, curated French sector
  list, runs from the terminal.
- **Dashboard** (`npm run dev` or Docker) — a local web UI with city/sector
  checkboxes, live progress, and an Excel download button.

They share the exact same engine (`runner.js`, `placesApi.js`,
`excelWriter.js`, `dedupe.js`) and the exact same output file + dedup
tracker, so you can freely alternate between them run to run.

> **Branches**: `main` holds the original CLI-only version, untouched.
> `dashboard-app` (this branch) adds the dashboard and Docker support on top
> — the CLI still works identically here too. See "Branches" at the bottom.

## 1. Get a Google Places API key

1. Go to the [Google Cloud Console](https://console.cloud.google.com/) and
   create a project (or pick an existing one).
2. Enable **Places API (New)** for that project: APIs & Services → Library →
   search "Places API (New)" → Enable.
3. Enable billing on the project (Billing → link a billing account). This is
   required even to use the free monthly call allowance — Google needs a
   card on file, but you won't be charged as long as you stay under it (see
   "Cost Safety" below for what "free" actually means now).
4. Create an API key: APIs & Services → Credentials → Create Credentials →
   API key. Copy it.
5. (Recommended) Restrict the key to "Places API (New)" only, under
   Credentials → your key → API restrictions.

Both the CLI and the dashboard read the same `.env` — set it up once.

## 2. Install & configure

```bash
npm install
cp .env.example .env
```

Edit `.env` and paste your key:

```
GOOGLE_PLACES_API_KEY=your_actual_key_here
```

`npm install` at the repo root also installs the frontend's dependencies
(npm workspaces) — no separate `cd frontend && npm install` needed.

## 3a. Run the CLI

```bash
node collect.js
```

Searches all 3 cities × the curated sector list in `config.js` (French
free-text queries, e.g. *"restaurants à Tétouan, Maroc"*). Console logs each
city/sector as it searches, each new lead found, and a final summary.

## 3b. Run the Dashboard (without Docker)

```bash
npm run dev
```

One command starts both the Express backend (port 3001) and the Vite React
frontend (port 5173, with hot reload) via `concurrently`. Open:

**http://localhost:5173**

Select cities and sectors, click "Lancer la collecte", watch progress live,
then two download options appear:
- **"Télécharger les nouveaux leads de ce run"** — a small standalone
  `.xlsx` (same header/columns/formatting) containing *only* the leads that
  run just found, freshly numbered from 1. Doesn't touch the master file.
- **"Télécharger le fichier complet"** — the same cumulative master file the
  CLI uses (`./output/AYAK_Prospects_Tetouan_VIDE.xlsx`), unchanged
  behavior.

Only the most recent run's per-run export stays available (in-memory, no
database) — download it before starting another run if you want to keep it;
the master file has no such limit.

Both `node collect.js` and `npm run dev` must be started **from the project
root** — file paths for the output folder / tracker are resolved relative to
the working directory, same as before.

On the first run (either path), the CLI/backend copies
`AYAK_Prospects_Tetouan_VIDE.xlsx` into `./output/AYAK_Prospects_Tetouan_VIDE.xlsx`
and appends new leads there on every subsequent run. Your original template
file in the project root is never modified.

## How it works

- **Search**: the CLI runs a Google Places Text Search per curated sector
  phrase (`config.js` → `SECTORS`). The dashboard instead lets you pick any
  of Google's ~478 official "Table A" place types directly and searches
  using Text Search's `includedType` filter (`textQuery: city, includedType:
  type`) — a different but equally Pro-tier-only mechanism; see "Dashboard
  sector picker" below.
- **Phone numbers**: intentionally NOT collected, in either path. Text
  Search alone returns everything the sheet needs (name, address, type,
  Place ID), so there's no Place Details call at all — see "Cost Safety"
  below. `Téléphone` is always left blank; capture it manually during
  outreach calls.
- **Sector labels** (the Excel "Secteur" column): mapped from Google's
  returned place type via `config.js` → `TYPE_LABELS` (a curated French
  dictionary); falls back to the sector's own label if Google returns a type
  not in that dictionary.
- **Excel**: `excelWriter.js` uses `exceljs` to open the real workbook and
  append rows in place, so the header style (Midnight Navy fill, bold white
  text), column widths, and the Priorité/Statut d'appel dropdown lists are
  preserved exactly as in the template — identical logic for CLI and
  dashboard, nothing is rebuilt from scratch.
- **Dedup**: `./output/seen_places.json` tracks every Google Place ID (and a
  normalized name+address fallback) already added. Since the CLI and the
  dashboard read/write this same file and the same output workbook, running
  one after the other (in either order) never creates duplicates — there's
  no separate "dashboard dedup" logic.
- **Budget guardrail**: `MAX_CALLS_PER_RUN` (config.js, default 500) is
  enforced identically in both paths. The dashboard also lets you override
  it per run via a number field in the UI. Each run gets its own isolated
  call counter (`placesApi.createClient()`), so a long-lived dashboard
  server can run multiple collections back to back without one run's usage
  bleeding into the next.

## Dashboard sector picker

The dashboard's sector list (`backend/placeTypesTableA.js`) is the
**complete** set of Google Places "Table A" types (filterable/searchable
types — Table B types are response-only and excluded), fetched from
[Google's place-types
docs](https://developers.google.com/maps/documentation/places/web-service/place-types)
while building this: 478 types across 19 categories. This is intentionally
broader than the CLI's curated ~55-sector list — use the search box to find
what you need, or "Tout sélectionner" for everything. Some categories
(Geographical Areas, Natural Features, Transportation infrastructure, Places
of Worship) aren't typical prospecting sectors but are included because the
brief asked for every Table A type, not a curated subset.

## Cost Safety

- **No more $200/month pooled credit.** Google retired the old blanket
  $200/month Maps Platform credit in March 2025. The current free tier for
  Places API (New) is a **per-SKU monthly call limit**, not a dollar amount
  you can spend down across any endpoint. Budgeting now means watching call
  counts per SKU, not a single dollar balance.
- **Both the CLI and the dashboard stay on the Pro tier only — nothing
  else.** The field mask is defined once, as a named constant in
  `placesApi.js` (`TEXT_SEARCH_FIELD_MASK`), shared by both paths, and only
  requests name, address, place type, and Place ID via Text Search — never
  rating, review counts, reviews, photos, or website URLs, each of which
  would upgrade the *entire* call to a pricier SKU. **Phone numbers are
  deliberately excluded**: there is no Place Details call anywhere in this
  codebase, because phone number fields only exist on the Enterprise SKU,
  which has a much smaller free monthly allowance than Pro. **Capture phone
  numbers manually** during outreach — don't add a Place Details / phone
  lookup back into this project without re-reading this section. The CLI
  prints the field mask at the start of every run; the dashboard shows the
  same confirmation as the first `start` log line in its progress panel.
- **A hard call budget is enforced in both paths**, backed by the same
  `placesApi.createClient({ maxCalls })` code. If a bug or an unexpectedly
  large selection would exceed it, the run stops early, shows/prints a clear
  warning, and still saves whatever leads were already found.
- **Set a budget alert as a manual safety net.** In Google Cloud Console:
  Billing → Budgets & Alerts → create a budget with an email alert.
- **Check actual usage after your first run.** Google Cloud Console → APIs &
  Services → Places API (New) → Metrics/Quotas shows real call counts broken
  down by SKU — confirm you're only seeing Text Search / Pro-tier usage.
  Free-tier allowance numbers change over time, so check the current
  published limits on the [pricing
  page](https://developers.google.com/maps/documentation/places/web-service/usage-and-billing)
  rather than trusting any specific figure quoted here.

## Running with Docker

**Prerequisites**: Docker Desktop installed and running.

```bash
docker compose up
```

(add `--build` the first time, or any time you change `package.json` /
`Dockerfile`). Open:

**http://localhost:5173**

— same port as the non-Docker dev path, on purpose, so both feel
interchangeable. This runs the `dev` build target: hot reload works because
your source folder is bind-mounted into the container (`.:/app`), with
`/app/node_modules` and `/app/frontend/node_modules` as anonymous volumes so
the container's own Linux-built dependencies aren't shadowed by your host's.

**Where the Excel file lands on your actual laptop**: `./output/` in the
project root — bind-mounted (`./output:/app/output`), not baked into the
image or an anonymous volume, specifically so you can open
`AYAK_Prospects_Tetouan_VIDE.xlsx` directly from Explorer/Excel while the
container is running, no `docker exec` needed. `seen_places.json` lives
inside that same folder, so it's covered by the same bind mount.

**How this relates to running without Docker**: identical behavior either
way — same output file, same tracker, same dedup logic, same budget
guardrail. Pick whichever is more convenient per session; nothing about
Docker changes the data or the Excel format.

**Also available (not via compose)** — the `Dockerfile`'s default stage
(`docker build -t ayak-lead-collector . && docker run -p 3000:3000 --env-file
.env -v "$(pwd)/output:/app/output" ayak-lead-collector`) builds a lean,
hardened, single-container image: non-root user, production dependencies
only, the built React app served statically alongside the API on one port
(**http://localhost:3000**), no hot reload. This is the image that satisfies
every "non-negotiable" below literally; `docker compose up` intentionally
uses a different (dev) stage that keeps dev dependencies, because hot reload
structurally requires them.

**Non-negotiables in the final image** (`docker build .`'s default target):
- Non-root user (`app`, uid 1001)
- No secrets baked in via ENV/ARG — the API key only ever arrives via
  `env_file: .env` at runtime
- Pinned base image (`node:20-alpine`, never `:latest`)
- `HEALTHCHECK` against `/health` (the dev stage also has one, on its own
  port)

**No production compose file.** Since this never leaves your laptop, there's
no `docker-compose.prod.yml`, no image tagging scheme, no registry push —
one dev-oriented compose file that "just works" locally is the right scope
here. This is an intentional decision, not an oversight.

## Configuration

Edit `config.js` to change:
- `CITIES` — the list of cities searched (both CLI and dashboard).
- `SECTORS` — the CLI's curated `{ query, label }` list. Add/remove entries
  to change CLI coverage; each `query` is appended with "à `<city>`". Does
  **not** affect the dashboard, which sources its full list from
  `backend/placeTypesTableA.js` instead (see "Dashboard sector picker").
- `TYPE_LABELS` — the Google place-type → French sector label dictionary,
  shared by both paths for the Excel "Secteur" column.
- `REQUEST_DELAY_MS` / `MAX_PAGES_PER_SEARCH` — rate limiting / pagination.
- `MAX_CALLS_PER_RUN` — hard cap on total API calls per run; the dashboard
  lets you override this per run from the UI.

## Files

- `collect.js` — CLI entry point; thin console wrapper around `runner.js`.
- `runner.js` — the shared collection engine (search loop, dedup, budget
  guardrail, Excel writing) used by **both** the CLI and the dashboard
  backend — not duplicated between them.
- `config.js` — cities, CLI sector list, sector-label mapping, file paths,
  defaults.
- `placesApi.js` — Google Places API (New) calls (Text Search only, Pro
  tier). Exposes `createClient()`, not a singleton, so each run (CLI
  process or dashboard request) gets isolated call-budget state.
- `excelWriter.js` / `dedupe.js` — reused as-is by the dashboard.
  `excelWriter.js` additionally exposes `buildStandaloneWorkbook(leads)` (the
  per-run export) and retries file writes a few times on Windows
  EBUSY/EACCES/EPERM before failing with a diagnostic message.
- `backend/server.js` — Express app; serves the API and (when built) the
  frontend static files.
- `backend/routes.js` — `/health`, `/api/cities`, `/api/sectors`,
  `/api/settings`, `/api/run` (SSE progress), `/api/download` (master file),
  `/api/run/:id/download` (that run's new leads only).
- `backend/runManager.js` — in-memory single-run tracking + SSE event
  buffering for the dashboard.
- `backend/placeTypesTableA.js` — the full Google Table A place-type catalog
  used by the dashboard's sector picker.
- `frontend/` — Vite + React app (city/sector selection, run panel, live
  log, summary, download button).
- `Dockerfile` — multi-stage (`deps` → `dev` / `build` → `prod-deps` →
  `runtime`); see "Running with Docker".
- `docker-compose.yml` — dev-only, hot reload, bind-mounted `./output`.
- `.env.example` — template for your API key (shared by CLI and dashboard).

## Assumptions made (not specified in the brief)

- The CLI's sector list still covers ~55 curated Moroccan SME categories;
  the dashboard instead exposes Google's full ~478-type Table A catalog, per
  the dashboard brief's explicit "every Table A type" requirement — these
  are deliberately different scopes for the two entry points.
- Dashboard sector labels not present in `config.js`'s curated French
  `TYPE_LABELS` dictionary (most of the ~478 aren't) are shown as an
  auto-generated, readable label (e.g. `hardware_store` → "Hardware Store")
  rather than hand-translated French — hand-translating ~478 identifiers
  accurately wasn't practical. Output written to the Excel "Secteur" column
  uses the same fallback.
- Dashboard progress is streamed via Server-Sent Events (one-way,
  server→browser), not WebSockets — sufficient for this use case (no
  client→server messages needed after the run starts) and simpler to reason
  about/test.
- The per-run export (`/api/run/:id/download`) is additive, not a
  replacement for the master file download — the master cumulative file
  remains the default, unchanged behavior, exactly as specified since the
  original CLI brief ("append... never overwrite"). Confirmed with the user
  directly before implementing, since a prior instruction file
  (`FIX_LEADS_SCRAPER.md`) asked to replace the master download entirely,
  which would have reversed that original spec.
- Only one dashboard collection run at a time is supported (a second
  `POST /api/run` while one is in progress gets HTTP 409) — matches the
  brief's implicit single-user local-tool scope, and avoids two runs
  concurrently writing the same Excel file / tracker.
- Run state is in-memory only (no database, per the brief) and only the most
  recent run is kept — restarting the backend process loses the ability to
  reconnect to a run's event stream, though the Excel file and tracker
  themselves are always saved to disk before the run ends regardless.
- The non-Docker dev port (5173, Vite) and the Docker dev port (also 5173,
  same `docker compose up` target) are the same on purpose, so the two paths
  feel interchangeable; the separately-available hardened
  `docker build`/`docker run` image uses 3000 instead (see "Running with
  Docker").
- No hot-reload/auto-restart for backend source changes in either dev path
  (only the frontend gets Vite HMR) — restart `npm run dev` /
  `docker compose restart app` after editing backend files. Adding a
  file-watcher/auto-restart tool for the backend wasn't requested and felt
  like scope creep beyond the brief.
- `./output/` (the generated workbook + `seen_places.json`) **is**
  gitignored (confirmed with you in an earlier session) — it's your actual
  lead data, kept local only, not shipped in the Docker image either (it's
  bind-mounted at runtime instead).
- `Téléphone` is always left blank — phone numbers are intentionally not
  collected from the API at all (Pro-tier-only cost decision, see "Cost
  Safety"), not just blank when Google happens not to return one.

## Branches

- **`main`** — the original CLI-only version. Fully intact, unmodified by
  this dashboard/Docker work.
- **`dashboard-app`** (this branch) — CLI (refactored internally to share
  `runner.js` with the dashboard, but behaves identically from the outside)
  + dashboard + Docker support, all additive.
