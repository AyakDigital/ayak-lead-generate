#!/usr/bin/env node
// ---------------------------------------------------------------------------
// AYAK Lead Collector — dashboard backend (Express).
// Wraps runner.js (the same collection engine the CLI uses) in HTTP/SSE
// endpoints. In dev (non-Docker) this runs on its own port behind the Vite
// dev server's /api proxy; in Docker (and any `npm run build && npm start`
// production-ish use) it also serves the built frontend/dist directly, so
// the whole app is reachable on a single port.
//
// Must be started with the project root as the working directory (npm run
// scripts do this automatically) — config.js resolves file paths (the
// output folder, the source .xlsx, seen_places.json) relative to cwd, same
// as the CLI.
// ---------------------------------------------------------------------------
require('dotenv').config();

const express = require('express');
const path = require('path');
const routes = require('./routes');

const app = express();
app.use(express.json());
app.use(routes);

// Serve the built React app if present (Docker image / `npm run build`).
// In plain `npm run dev`, the Vite dev server serves the frontend instead
// (see frontend/vite.config.js), so frontend/dist won't exist and this is
// simply skipped.
const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');
app.use(express.static(frontendDist));
// Plain app.use (no path pattern) instead of app.get('*', ...) — Express 5's
// path-to-regexp no longer accepts a bare '*' wildcard, and this form works
// identically across Express 4/5 anyway.
app.use((req, res, next) => {
  if (req.method !== 'GET' || req.path.startsWith('/api') || req.path === '/health') return next();
  res.sendFile(path.join(frontendDist, 'index.html'), (err) => {
    if (err) next();
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`AYAK Lead Collector dashboard backend listening on http://localhost:${PORT}`);
});
