/**
 * Thin generic helpers over the bound Spreadsheet, plus typed getters for
 * each tab. Every tab uses a header row; sheetToObjects_ turns rows into
 * {header: value} objects so the rest of the app never deals with column
 * indexes directly.
 */

function getSpreadsheet_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function getSheet_(name) {
  var sheet = getSpreadsheet_().getSheetByName(name);
  if (!sheet) throw new Error('Missing sheet tab: "' + name + '". Run createPolicySystem() from Setup.gs first.');
  return sheet;
}

function sheetToObjects_(sheet) {
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  var headers = values[0];
  return values.slice(1)
    .filter(function(row) { return row.join('') !== ''; })
    .map(function(row) {
      var obj = {};
      headers.forEach(function(h, i) { obj[h] = row[i]; });
      return obj;
    });
}

function appendRow_(sheetName, rowObject, headerOrder) {
  var sheet = getSheet_(sheetName);
  var row = headerOrder.map(function(h) { return rowObject[h] !== undefined ? rowObject[h] : ''; });
  sheet.appendRow(row);
}

function getPolicyConfig_() {
  return sheetToObjects_(getSheet_(CONFIG.SHEET_NAMES.POLICY_CONFIG))
    .filter(function(p) { return String(p.Active).toUpperCase() !== 'FALSE'; });
}

function getKeyPoints_(policyId) {
  var rows = sheetToObjects_(getSheet_(CONFIG.SHEET_NAMES.KEY_POINTS));
  var match = rows.filter(function(r) { return r.PolicyID === policyId; })[0];
  return match ? match.KeyPointsText : '';
}

function getQuizBank_(policyId) {
  return sheetToObjects_(getSheet_(CONFIG.SHEET_NAMES.QUIZ_BANK))
    .filter(function(r) { return r.PolicyID === policyId; });
}

function getAckLog_() {
  return sheetToObjects_(getSheet_(CONFIG.SHEET_NAMES.ACK_LOG));
}

function getStaffDirectory_() {
  return sheetToObjects_(getSheet_(CONFIG.SHEET_NAMES.STAFF_DIRECTORY));
}

function getProgress_() {
  return sheetToObjects_(getSheet_(CONFIG.SHEET_NAMES.PROGRESS_TRACKER));
}
