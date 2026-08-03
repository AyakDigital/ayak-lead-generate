# AYAK Lead Collector — Dashboard + Docker Build Guide

## Context
I already have a working CLI script (`ayak-lead-collector`) that pulls leads 
from Google Places API (Text Search, Pro tier only — no Place Details, no 
phone/rating/review/photo fields) and appends them into 
AYAK_Prospects_Tetouan_VIDE.xlsx, with a dedup tracker and a call-budget 
guardrail. It works and has been verified cost-safe.

---

## PART 1 — Preserve the existing script (do this FIRST, before anything else)
1. Initialize git in the project folder if not already a repo: `git init`
2. Commit the current working CLI version as-is
3. Create and switch to a new branch for the dashboard work, e.g. 
   `git checkout -b dashboard-app`
4. Keep the CLI version fully intact and runnable on `main`/the original 
   branch — do not delete or break `collect.js` or the CLI flow. The 
   dashboard is an ADDITION, not a replacement.

---

## PART 2 — What to build
A local full-stack web app, run entirely on my laptop, opened in the browser 
at localhost. This is IN ADDITION to the CLI — both should keep working.

**Stack:**
- Backend: Node.js + Express (reuse the existing placesApi.js, dedup logic, 
  budget guardrail, and Excel-writing logic as the core engine — wrap it in 
  API endpoints instead of a CLI script)
- Frontend: React (built with Vite), plain CSS or a minimal component 
  library — no need for anything heavy, this is an internal tool
- No database — state (dedup tracking, run history) stays in the same 
  local files the CLI already uses (seen_places.json, the Excel file itself)
- Runnable two ways: directly with `npm run dev` (no Docker), AND via 
  Docker (see Part 3) — both should work, Docker is an option not a 
  requirement

## Dashboard features

### City selection
- Multi-select checkboxes (not single-select) for: Tétouan, M'diq, Martil
- User can select 1, 2, or all 3 cities per run

### Sector selection  
- Multi-select list covering EVERY Table A place type from Google's official 
  Place Types (New) documentation: 
  https://developers.google.com/maps/documentation/places/web-service/place-types
  (fetch/check this table while building so the list is complete and 
  accurate — don't hand-type a partial list)
- Table A only (filterable/searchable types) — Table B types are 
  response-only and can't be used as search filters, so exclude those
- Display them grouped by logical category if the table provides one 
  (e.g., Food & Drink, Health, Shopping, Automotive) for easier browsing — 
  a flat list of 100+ types is hard to scan otherwise
- Include a "Select All" and a search/filter box to find a sector quickly

### Run button + progress
- A "Lancer la collecte" button that starts the run with selected 
  cities × sectors
- Live progress feedback in the UI (not just terminal logs) — e.g., a 
  simple log panel showing which city/sector is currently being searched, 
  running count of new leads found, similar to what the CLI already prints 
  to console, just rendered in the browser instead
- Respect the existing MAX_CALLS_PER_RUN budget guardrail — if hit, stop 
  gracefully, show a clear message in the UI, and still save partial 
  progress (same behavior as the CLI version)

### Results + download
- When the run finishes, show a summary in the UI: new leads added, 
  duplicates skipped, total API calls made, any errors
- A "Télécharger Excel" button that lets me download the resulting 
  AYAK_Prospects_Tetouan_VIDE.xlsx directly from the browser — same exact 
  format/columns/formatting/dropdowns as the CLI version produces (reuse 
  that exact Excel-writing logic, don't rebuild it)

## Constraints to carry over from the CLI version (non-negotiable)
- Text Search API only, Pro tier field mask only (displayName, 
  formattedAddress, primaryType/types, id) — NO Place Details calls, NO 
  phone/rating/review/photo fields, for the same free-tier cost-safety 
  reasons as before
- Téléphone column stays blank in output (manual capture during outreach)
- Dedup via Place ID (with name+address fallback) — never add a business 
  already in the tracker, across runs AND across the CLI/dashboard both 
  writing to the same output file and tracker
- MAX_CALLS_PER_RUN guardrail carries over, configurable
- Output file stays AYAK_Prospects_Tetouan_VIDE.xlsx with its exact 13 
  columns, header styling (Midnight Navy #0B1F3A fill, bold white text), 
  column widths, and the Priorité/Statut d'appel dropdown validations — 
  fully preserved, since the dashboard uses the same writing logic as the CLI

## Developer experience (non-Docker path)
- `.env` for GOOGLE_PLACES_API_KEY (same as before, reuse the existing one, 
  don't ask me to re-enter it)
- One command to start everything without Docker (document exact command 
  in README, e.g. `npm run dev`)

---

## PART 3 — Docker setup

Add full Docker support on top of Part 2, following AYAK's standing 
containerization conventions (multi-stage, non-root, dev-focused compose) 
even though this runs purely on my laptop with no remote deploy — the 
discipline still pays off for consistency.

### Dockerfile (multi-stage, project root)
- Build stage: `node:20-alpine`, installs deps for both backend and 
  frontend, builds the React frontend (Vite build) and any backend build 
  step if present
- Runtime stage: `node:20-alpine`, only production deps + built frontend 
  assets + backend code — no dev dependencies, no source maps of secrets
- Create and switch to a non-root user (`app`, uid 1001) before CMD
- Add a `HEALTHCHECK` hitting a simple `/health` endpoint on the Express 
  backend (add this endpoint if it doesn't exist yet — just return 200 OK)
- EXPOSE the port the Express server runs on (e.g. 3000)
- Order Dockerfile layers cache-friendly: copy package*.json + install 
  BEFORE copying the rest of the source, so dependency layers only rebuild 
  when lockfiles change

### .dockerignore
Standard exclusions: `.git`, `node_modules`, `dist`, `build`, `coverage`, 
`.cache`, `*.log`, `.env`, `.env.*` (but NOT `.env.example`), `.vscode`, 
`.idea`, `Dockerfile*`, `docker-compose*.yml`, `*.md`, `tests/`

### docker-compose.yml (dev — this is the only one needed, no prod/VPS deploy)
- Single service: the app (backend + frontend served together, or two 
  services if simpler to maintain — your call)
- Mount source as a volume for hot-reload during development: `.:/app` plus 
  `/app/node_modules` so the container's own node_modules wins over the 
  host's
- `env_file: .env` — reuses my existing GOOGLE_PLACES_API_KEY
- Ports mapped so I can open http://localhost:PORT from my laptop's browser
- CRITICAL — persistent data must survive container restarts, mount these 
  as bind-mount volumes (not baked into the image, not anonymous volumes):
  - The output folder containing AYAK_Prospects_Tetouan_VIDE.xlsx 
    (`./output:/app/output`)
  - seen_places.json (the dedup tracker)
  Bind mounts (not anonymous Docker volumes) so I can directly open/inspect 
  the Excel file from my laptop's file system without exec-ing into the 
  container

### No production compose file needed
Since this never leaves my laptop and there's no VPS/registry/remote deploy, 
skip docker-compose.prod.yml, image tagging schemes, and registry push steps 
entirely. One dev-oriented compose file that "just works" locally is the 
right scope. Note this explicitly in the README as an intentional scope 
decision.

### Non-negotiables (apply regardless of local-only scope)
- Non-root user in the final image stage
- No secrets baked into the Dockerfile via ENV/ARG — only via env_file at 
  runtime
- Pinned base image version (`node:20-alpine`, never `:latest`)
- Health check defined

### Developer experience (Docker path)
- One command to start everything in Docker: `docker compose up` (or 
  `docker compose up --build` on first run / after dependency changes)
- README.md gets a new "Running with Docker" section: prerequisites 
  (Docker Desktop installed), the exact command, where to find the 
  downloaded Excel file afterward (the bind-mounted ./output folder), and 
  how this relates to running it without Docker (both work — my choice 
  each time)

---

## Do not
- Do not remove or break the original CLI script
- Do not add phone/rating/review/photo fields back in
- Do not add any cloud deployment, remote hosting, or database — everything 
  stays local or laptop-run (Docker here means local containers only, not 
  a hosted deployment)
- Do not silently change the Excel output format from what the CLI already 
  produces

## When done, confirm:
1. Which branch holds the original CLI-only version and which holds the new 
   dashboard app
2. Exact port to open in the browser (both non-Docker and Docker paths)
3. Exact folder path where the Excel output lands on my actual laptop 
   filesystem (not just inside the container)

Build all of this now.
