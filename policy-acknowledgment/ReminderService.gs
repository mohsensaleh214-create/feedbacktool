/**
 * Weekly reminder email to staff with outstanding policies. Attach a
 * time-based trigger to sendOutstandingReminders() — Setup.gs's
 * installWeeklyReminderTrigger() does this for you.
 *
 * Escalation is intentionally a placeholder: past
 * CONFIG.ESCALATION_THRESHOLD_DAYS outstanding, escalateToManager_() is
 * called but only logs to the Reminder Log for now. Wire in the real
 * CC'd-line-manager behavior later — Staff Directory already has a
 * LineManagerEmail column reserved for it.
 */
function sendOutstandingReminders() {
  var policies = getPolicyConfig_();
  var ackLog = getAckLog_();
  var staff = getStaffDirectory_();

  staff.forEach(function(person) {
    var outstanding = policies.filter(function(p) {
      return !ackLog.some(function(a) {
        return a.StaffEmail === person.StaffEmail && a.PolicyID === p.PolicyID && String(a.VersionHash) === String(p.CurrentVersionHash);
      });
    });

    if (outstanding.length === 0) return;

    outstanding.forEach(function(p) {
      var days = daysOutstandingFor_(person.StaffEmail, p.PolicyID, ackLog);
      if (days >= CONFIG.ESCALATION_THRESHOLD_DAYS) {
        escalateToManager_(person, p, days);
      }
    });

    sendReminderEmail_(person, outstanding);
    logReminder_(person.StaffEmail, outstanding.map(function(p) { return p.PolicyID; }).join(', '), 'reminder', '');
  });
}

function sendReminderEmail_(person, outstanding) {
  var appUrl = CONFIG.PUBLIC_URL || ScriptApp.getService().getUrl();
  var list = outstanding.map(function(p) { return '- ' + p.PolicyName; }).join('\n');
  var body = 'Hi ' + (person.StaffName || '') + ',\n\n' +
    'The following Misk Schools policies still need your acknowledgment:\n\n' + list +
    '\n\nPlease complete them here: ' + appUrl + '\n\nThank you.';
  MailApp.sendEmail({ to: person.StaffEmail, subject: 'Action required: outstanding policy acknowledgments', body: body });
}

/** Days since the staff member's most recent (now-outdated, or absent) acknowledgment for this policy. */
function daysOutstandingFor_(email, policyId, ackLog) {
  var rows = ackLog.filter(function(a) { return a.StaffEmail === email && a.PolicyID === policyId; });
  if (rows.length === 0) return 0;
  var latest = rows.sort(function(a, b) { return new Date(b.Timestamp) - new Date(a.Timestamp); })[0];
  var diffMs = new Date() - new Date(latest.Timestamp);
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/** Placeholder hook — no-op beyond logging until escalation rules are defined. */
function escalateToManager_(person, policy, daysOutstanding) {
  logReminder_(person.StaffEmail, policy.PolicyID, 'escalation-placeholder', daysOutstanding);
}

function logReminder_(email, policyIds, type, days) {
  appendRow_(CONFIG.SHEET_NAMES.REMINDER_LOG, {
    Timestamp: new Date(), StaffEmail: email, PolicyIDs: policyIds, Type: type, DaysOutstanding: days
  }, ['Timestamp', 'StaffEmail', 'PolicyIDs', 'Type', 'DaysOutstanding']);
}
