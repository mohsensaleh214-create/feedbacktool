/**
 * Dashboard status + completion recording. A staff member's status per
 * policy is derived, not stored directly:
 *   - "Completed"   latest Acknowledgment Log row for them matches the
 *                    policy's CurrentVersionHash
 *   - "In Progress" they've opened the current version but not completed it
 *                    (see Progress Tracker, upserted by recordPolicyOpened)
 *   - "Not Started" neither of the above — including a policy they
 *                    completed under an old version hash, so a replaced
 *                    PDF naturally reopens it for everyone without
 *                    deleting their acknowledgment history.
 */

function getDashboardData() {
  var email = Session.getActiveUser().getEmail();
  var policies = getPolicyConfig_();
  var ackLog = getAckLog_().filter(function(r) { return r.StaffEmail === email; });
  var progress = getProgress_().filter(function(r) { return r.StaffEmail === email; });

  var grouped = { 1: [], 2: [] };
  policies.forEach(function(p) {
    var tier = Number(p.Tier);
    var completions = ackLog.filter(function(a) { return a.PolicyID === p.PolicyID; })
      .sort(function(a, b) { return new Date(b.Timestamp) - new Date(a.Timestamp); });
    var latest = completions[0];

    var status = 'Not Started';
    if (latest && String(latest.VersionHash) === String(p.CurrentVersionHash)) {
      status = 'Completed';
    } else {
      var opened = progress.some(function(pr) {
        return pr.PolicyID === p.PolicyID && String(pr.VersionHash) === String(p.CurrentVersionHash);
      });
      if (opened) status = 'In Progress';
    }

    grouped[tier] = grouped[tier] || [];
    grouped[tier].push({
      policyId: p.PolicyID,
      name: p.PolicyName,
      tier: tier,
      status: status,
      lastAcknowledgedVersion: latest ? latest.VersionHash : null,
      hasFile: !!p.DriveFileID
    });
  });

  return { email: email, tier1: grouped[1] || [], tier2: grouped[2] || [] };
}

function getPolicyDetail(policyId) {
  var policy = getPolicyConfig_().filter(function(p) { return p.PolicyID === policyId; })[0];
  if (!policy) throw new Error('Unknown policy: ' + policyId);

  var tier = Number(policy.Tier);
  var detail = {
    policyId: policy.PolicyID,
    name: policy.PolicyName,
    tier: tier,
    driveFileId: policy.DriveFileID,
    versionHash: policy.CurrentVersionHash,
    hasFile: !!policy.DriveFileID
  };

  if (tier === 1) {
    detail.quizReady = getQuizBank_(policyId).length >= CONFIG.QUIZ_QUESTIONS_PER_ATTEMPT;
  }

  return detail;
}

/** Called when a staff member opens a policy, so the dashboard can show "In Progress". */
function recordPolicyOpened(policyId) {
  var email = Session.getActiveUser().getEmail();
  var policy = getPolicyConfig_().filter(function(p) { return p.PolicyID === policyId; })[0];
  if (!policy) return;
  upsertProgress_(email, policyId, policy.CurrentVersionHash);
}

function upsertProgress_(email, policyId, versionHash) {
  var sheet = getSheet_(CONFIG.SHEET_NAMES.PROGRESS_TRACKER);
  var values = sheet.getDataRange().getValues();
  var headers = values[0];
  var emailCol = headers.indexOf('StaffEmail');
  var policyCol = headers.indexOf('PolicyID');

  for (var i = 1; i < values.length; i++) {
    if (values[i][emailCol] === email && values[i][policyCol] === policyId) {
      sheet.getRange(i + 1, headers.indexOf('VersionHash') + 1).setValue(versionHash);
      sheet.getRange(i + 1, headers.indexOf('LastOpenedAt') + 1).setValue(new Date());
      return;
    }
  }
  appendRow_(CONFIG.SHEET_NAMES.PROGRESS_TRACKER, {
    StaffEmail: email, PolicyID: policyId, VersionHash: versionHash, LastOpenedAt: new Date()
  }, ['StaffEmail', 'PolicyID', 'VersionHash', 'LastOpenedAt']);
}

/** payload: { policyId, tier, quizScore (Tier 1 only) } */
function submitCompletion(payload) {
  var email = Session.getActiveUser().getEmail();
  var name = email.split('@')[0];
  var policy = getPolicyConfig_().filter(function(p) { return p.PolicyID === payload.policyId; })[0];
  if (!policy) throw new Error('Unknown policy: ' + payload.policyId);

  appendRow_(CONFIG.SHEET_NAMES.ACK_LOG, {
    Timestamp: new Date(),
    StaffEmail: email,
    StaffName: name,
    PolicyID: policy.PolicyID,
    PolicyName: policy.PolicyName,
    Tier: policy.Tier,
    VersionHash: policy.CurrentVersionHash,
    QuizScore: payload.quizScore !== undefined ? payload.quizScore : '',
    Completed: true
  }, ['Timestamp', 'StaffEmail', 'StaffName', 'PolicyID', 'PolicyName', 'Tier', 'VersionHash', 'QuizScore', 'Completed']);

  return getDashboardData();
}
