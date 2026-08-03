// ---------------------------------------------------------------------------
// Opens/creates the output workbook and appends prospect rows while
// preserving the existing header style, column widths and the Priorité /
// Statut d'appel dropdown validations.
// ---------------------------------------------------------------------------
const fs = require('fs');
const ExcelJS = require('exceljs');
const config = require('./config');

function ensureOutputCopy() {
  fs.mkdirSync(config.OUTPUT_DIR, { recursive: true });
  if (!fs.existsSync(config.OUTPUT_XLSX)) {
    fs.copyFileSync(config.SOURCE_XLSX, config.OUTPUT_XLSX);
    console.log(`Fichier de sortie créé: ${config.OUTPUT_XLSX}`);
  }
}

async function openWorksheet() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(config.OUTPUT_XLSX);
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
  await workbook.xlsx.writeFile(config.OUTPUT_XLSX);
}

module.exports = { ensureOutputCopy, openWorksheet, findStartingPoint, appendRow, save };
