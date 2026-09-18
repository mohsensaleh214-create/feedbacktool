/**
 * Everything that touches Drive: streaming a policy PDF to the client and
 * hashing its content to detect when a file has been replaced.
 */

function getPolicyPdfBase64(driveFileId) {
  return getFileBase64_(driveFileId);
}

function getFileBase64_(fileId) {
  var file = DriveApp.getFileById(fileId);
  var blob = file.getBlob();
  return {
    base64: Utilities.base64Encode(blob.getBytes()),
    mimeType: blob.getContentType(),
    fileName: file.getName()
  };
}

/**
 * Dashboard hero photo, read from CONFIG.HERO_IMAGE_FILE_ID. Left blank
 * until a campus photo is uploaded to Drive and its ID pasted in. (The
 * logo itself is baked into Assets.html as BRAND_LOGO_DATA_URI — no
 * Drive round-trip needed for something that only changes when the code
 * is redeployed anyway.)
 */
function getBrandAssets() {
  return {
    hero: CONFIG.HERO_IMAGE_FILE_ID ? getFileBase64_(CONFIG.HERO_IMAGE_FILE_ID) : null
  };
}

function computeFileHash_(driveFileId) {
  var bytes = DriveApp.getFileById(driveFileId).getBlob().getBytes();
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, bytes);
  return digest.map(function(b) {
    var v = (b < 0 ? b + 256 : b).toString(16);
    return v.length === 1 ? '0' + v : v;
  }).join('');
}

/**
 * Admin action: re-hash every policy's Drive file and update Policy Config.
 * Run manually from the editor after replacing a PDF in Drive (or wire a
 * trigger to it later). A changed hash means the policy's current
 * CurrentVersionHash no longer matches anyone's most recent Acknowledgment
 * Log row for it, so the dashboard shows it as outstanding again for
 * everyone — existing log rows are left exactly as they are.
 */
function syncPolicyVersions() {
  var email = Session.getActiveUser().getEmail();
  if (!isAdmin_(email)) throw new Error('Admin only.');

  var sheet = getSheet_(CONFIG.SHEET_NAMES.POLICY_CONFIG);
  var values = sheet.getDataRange().getValues();
  var headers = values[0];
  var nameCol = headers.indexOf('PolicyName');
  var fileIdCol = headers.indexOf('DriveFileID');
  var hashCol = headers.indexOf('CurrentVersionHash');
  var updatedCol = headers.indexOf('LastUpdated');

  var changed = [];
  for (var i = 1; i < values.length; i++) {
    var fileId = values[i][fileIdCol];
    if (!fileId) continue;
    var newHash = computeFileHash_(fileId);
    if (values[i][hashCol] !== newHash) {
      changed.push(values[i][nameCol]);
      sheet.getRange(i + 1, hashCol + 1).setValue(newHash);
      sheet.getRange(i + 1, updatedCol + 1).setValue(new Date());
    }
  }
  Logger.log(changed.length ? ('Version changed for: ' + changed.join(', ')) : 'No version changes.');
  return changed;
}
