// ---------------------------------------------------------------------------
// In-memory run tracking for the dashboard's SSE progress stream.
// This is an internal single-user local tool — no database, one run at a
// time (a 409 is returned if a run is already in progress), and only the
// most recent run is kept in memory. Events are buffered on the run object
// so a client that opens the SSE connection slightly after POST /api/run
// still gets the full history (start event etc.), not just what's left.
// ---------------------------------------------------------------------------
const EventEmitter = require('events');
const crypto = require('crypto');
const runner = require('../runner');

let currentRun = null;

function startRun({ cities, sectorJobs, maxCalls }) {
  if (currentRun && currentRun.status === 'running') {
    throw Object.assign(new Error('Une collecte est déjà en cours.'), { code: 'RUN_IN_PROGRESS' });
  }

  const id = crypto.randomUUID();
  const emitter = new EventEmitter();
  const run = { id, status: 'running', events: [], emitter, summary: null, error: null };
  currentRun = run;

  const onEvent = (evt) => {
    run.events.push(evt);
    emitter.emit('event', evt);
  };

  runner
    .runCollection({ cities, sectorJobs, maxCalls, onEvent })
    .then((summary) => {
      run.status = 'done';
      run.summary = summary;
    })
    .catch((err) => {
      run.status = 'error';
      run.error = (err && err.message) || String(err);
      onEvent({ type: 'error', message: run.error });
    });

  return run;
}

function getRun(id) {
  return currentRun && currentRun.id === id ? currentRun : null;
}

module.exports = { startRun, getRun };
