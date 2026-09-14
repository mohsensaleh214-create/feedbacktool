/**
 * Central configuration for the Misk Schools Policy Acknowledgment System.
 * Everything policy-specific (names, tiers, quiz questions) lives in the
 * bound Sheet, not here — this file only holds settings that
 * are genuinely code-level: domain, admin list, and gate timing.
 */

var CONFIG = {
  // Restrict sign-in to this Workspace domain. Update to Misk's real domain.
  ALLOWED_DOMAIN: 'miskschools.edu.sa',

  // Emails allowed to view the admin dashboard. Must be @ALLOWED_DOMAIN
  // addresses — sign-in is blocked for anything outside that domain, so a
  // personal email here would never actually be reachable.
  ADMIN_EMAILS: ['msaleh@miskschools.edu.sa'],

  // Drive file ID for the dashboard hero photo (upload to Drive, paste the
  // ID from the share link). Left blank shows no hero banner. The logo
  // itself is baked into Assets.html, not fetched from Drive.
  HERO_IMAGE_FILE_ID: '',

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
