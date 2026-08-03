// ---------------------------------------------------------------------------
// Opens/creates the output workbook and appends prospect rows while
// preserving the existing header style, column widths and the Priorité /
// Statut d'appel dropdown validations.
// ---------------------------------------------------------------------------
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const config = require('./config');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientFsError(err) {
  return err && (err.code === 'EBUSY' || err.code === 'EACCES' || err.code === 'EPERM');
}

// Wraps a file-writing operation with a few retries — Windows locking
// (antivirus scan, OneDrive sync, the file open in Excel) is often
// transient and clears within a second or two. If it's still failing after
// retries, replace the raw fs error with one that actually helps diagnose
// it, since "EACCES: permission denied, open '...'" alone gives no next step.
async function withRetry(fn, { attempts = 3, delayMs = 500 } = {}) {
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === attempts || !isTransientFsError(err)) {
        if (isTransientFsError(err)) throw enhanceFsError(err);
        throw err;
      }
      await sleep(delayMs);
    }
  }
}

function enhanceFsError(err) {
  const absPath = path.resolve(config.OUTPUT_XLSX);
  const enhanced = new Error(
    `${err.code}: impossible d'écrire ${absPath}.\n` +
      'Causes possibles :\n' +
      "  - le fichier est ouvert dans Excel ou un autre programme (fermez-le et réessayez)\n" +
      '  - antivirus / OneDrive verrouille temporairement le fichier pendant une synchronisation\n' +
      "  - permissions Windows insuffisantes pour le compte qui exécute ce process — sur cette machine, " +
      "vérifiez avec `icacls \"" +
      path.dirname(absPath) +
      '"` si votre compte/groupe a bien un accès en écriture (M ou F), pas seulement RX'
  );
  enhanced.code = err.code;
  enhanced.cause = err;
  return enhanced;
}

function ensureOutputCopy() {
  fs.mkdirSync(config.OUTPUT_DIR, { recursive: true });
  if (!fs.existsSync(config.OUTPUT_XLSX)) {
    fs.copyFileSync(config.SOURCE_XLSX, config.OUTPUT_XLSX);
    console.log(`Fichier de sortie créé: ${config.OUTPUT_XLSX}`);
  }
}

async function openWorksheet() {
  const workbook = new ExcelJS.Workbook();
  await withRetry(() => workbook.xlsx.readFile(config.OUTPUT_XLSX));
  const worksheet = workbook.getWorksheet(config.SHEET_NAME);
  if (!worksheet) {
    throw new Error(`Feuille "${config.SHEET_NAME}" introuvable dans ${config.OUTPUT_XLSX}`);
  }
  return { workbook, worksheet };
}

// Last used Excel row (scans column A) and the next N° to use (max existing
// N° + 1). Tracked separately since a user may have deleted/reordered rows.
function findStartingPoint(worksheet) {
  let lastRow = 1; // header
  let maxNumero = 0;
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const value = row.getCell(1).value;
    if (value !== null && value !== undefined && value !== '') {
      lastRow = Math.max(lastRow, rowNumber);
      const n = Number(value);
      if (!Number.isNaN(n)) maxNumero = Math.max(maxNumero, n);
    }
  });
  return { nextRow: lastRow + 1, nextNumero: maxNumero + 1 };
}

// Copies the Priorité/Statut dropdown validation onto rows beyond the
// template's pre-built range (config.DATA_VALIDATION_LAST_ROW).
function ensureDropdownValidation(worksheet, rowNumber) {
  if (rowNumber <= config.DATA_VALIDATION_LAST_ROW) return; // already pre-built in template

  const template = worksheet.dataValidations.model[`I${config.DATA_VALIDATION_LAST_ROW}`];
  const templateJ = worksheet.dataValidations.model[`J${config.DATA_VALIDATION_LAST_ROW}`];
  if (template) worksheet.dataValidations.model[`I${rowNumber}`] = { ...template };
  if (templateJ) worksheet.dataValidations.model[`J${rowNumber}`] = { ...templateJ };
}

function appendRow(worksheet, rowNumber, lead) {
  const row = worksheet.getRow(rowNumber);
  row.getCell(1).value = lead.numero; // N°
  row.getCell(2).value = lead.entreprise; // Entreprise
  row.getCell(3).value = lead.secteur; // Secteur
  row.getCell(4).value = null; // Forme juridique
  row.getCell(5).value = null; // Capital (MAD)
  row.getCell(6).value = lead.adresse; // Adresse / Quartier
  row.getCell(7).value = lead.telephone || null; // Téléphone
  row.getCell(8).value = null; // Email
  row.getCell(9).value = config.PRIORITE_DEFAULT; // Priorité
  row.getCell(10).value = config.STATUT_DEFAULT; // Statut d'appel
  row.getCell(11).value = null; // Date d'appel
  row.getCell(12).value = null; // Résultat / Notes
  row.getCell(13).value = null; // Relance prévue

  ensureDropdownValidation(worksheet, rowNumber);
  row.commit();
}

async function save(workbook) {
  await withRetry(() => workbook.xlsx.writeFile(config.OUTPUT_XLSX));
}

// Builds a fresh, standalone workbook (same header style/columns/dropdowns
// as the master file, via the blank template) containing ONLY the given
// leads, freshly numbered from 1. Used for the dashboard's "download just
// this run's new leads" export — the master cumulative file (config.OUTPUT_XLSX)
// is never read or modified by this function.
async function buildStandaloneWorkbook(leads) {
  const workbook = new ExcelJS.Workbook();
  await withRetry(() => workbook.xlsx.readFile(config.SOURCE_XLSX));
  const worksheet = workbook.getWorksheet(config.SHEET_NAME);
  if (!worksheet) {
    throw new Error(`Feuille "${config.SHEET_NAME}" introuvable dans ${config.SOURCE_XLSX}`);
  }
  leads.forEach((lead, i) => {
    appendRow(worksheet, i + 2, { ...lead, numero: i + 1 });
  });
  return workbook;
}

module.exports = {
  ensureOutputCopy,
  openWorksheet,
  findStartingPoint,
  appendRow,
  save,
  buildStandaloneWorkbook,
};
