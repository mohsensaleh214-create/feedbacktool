/**
 * Central configuration for the Misk Schools Policy Acknowledgment System.
 * Everything policy-specific (names, tiers, key points, quiz questions)
 * lives in the bound Sheet, not here — this file only holds settings that
 * are genuinely code-level: domain, admin list, and gate timing.
 */

var CONFIG = {
  // Restrict sign-in to this Workspace domain. Update to Misk's real domain.
  ALLOWED_DOMAIN: 'miskschools.edu.sa',

  // Emails allowed to view the admin dashboard.
  ADMIN_EMAILS: ['mohsensaleh214@gmail.com'],

  // Reading-gate dwell timer: seconds required per PDF page, clamped
  // between a floor and ceiling so very short or very long policies
  // still get a sane requirement.
  SECONDS_PER_PAGE: 22,
  MIN_DWELL_SECONDS: 30,
  MAX_DWELL_SECONDS: 600,

  // Tier 1 check-in quiz
  QUIZ_QUESTIONS_PER_ATTEMPT: 4,
  QUIZ_PASS_MARK: 3,

  // Reminders
  REMINDER_CADENCE_DAYS: 7,
  // Placeholder only — escalateToManager_() in ReminderService.gs doesn't
  // do anything with this yet beyond logging. Define the real escalation
  // behavior later.
  ESCALATION_THRESHOLD_DAYS: 21,

  SHEET_NAMES: {
    POLICY_CONFIG: 'Policy Config',
    KEY_POINTS: 'Key Points',
    QUIZ_BANK: 'Quiz Bank',
    ACK_LOG: 'Acknowledgment Log',
    STAFF_DIRECTORY: 'Staff Directory',
    PROGRESS_TRACKER: 'Progress Tracker',
    REMINDER_LOG: 'Reminder Log'
  }
};

function isAdmin_(email) {
  return CONFIG.ADMIN_EMAILS.indexOf(email) !== -1;
}
