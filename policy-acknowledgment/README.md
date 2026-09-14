# Misk Schools Policy Acknowledgment System

A Google Apps Script web app that replaces manual QR/Adobe sign-off for
staff acknowledgment of "Must Read" policies. Staff sign in with their
Misk Schools Google account, read each policy's PDF rendered in-app
(PDF.js), pass a reading gate, and either take a short check-in quiz
(Tier 1) or make a one-click declaration (Tier 2). Google Sheets is the
data store; there's no separate hosting or license cost.

This folder is a plain source checkout — it isn't wired to a live Apps
Script project yet. Deploy it with [`clasp`](https://github.com/google/clasp)
or by copy-pasting each file into the Apps Script editor.

## 1. Architecture at a glance

- **Auth**: `Session.getActiveUser().getEmail()`, domain-restricted in
  `Code.gs` (`CONFIG.ALLOWED_DOMAIN`). No separate login system.
- **Rendering**: single-page app. `doGet` always serves `Index.html`;
  everything after that (dashboard, PDF viewer, quiz, admin) is
  client-side routing via `Utils.showScreen()` — no URL params, no page
  reloads, so the reading-gate/quiz state machine stays simple to reason
  about.
- **PDF viewer**: the client never fetches the Drive file directly (Drive
  doesn't reliably serve permissive CORS headers, and the file needs an
  authenticated request anyway). Instead: `Client_Viewer.html` calls
  `google.script.run.getPolicyPdfBase64(driveFileId)`, `DriveService.gs`
  reads the file server-side with `DriveApp` and returns it base64-encoded,
  and the client decodes it into a `Uint8Array` for
  `pdfjsLib.getDocument({ data })`. This is the reliable pattern for Apps
  Script + Drive + PDF.js — a direct client-side `fetch()` against a Drive
  URL will intermittently fail on auth/CORS.
- **Data backend**: Google Sheets, one tab per concern (see schema below).
  Nothing policy-specific is hardcoded — tiers, content, and quiz
  questions all come from the Sheet, so tuning them later is a spreadsheet
  edit, not a code change.
- **Versioning**: each policy's Drive file is MD5-hashed
  (`syncPolicyVersions()` in `DriveService.gs`). A staff member's
  completion only counts while their acknowledged `VersionHash` matches
  the policy's current one — replace the PDF, re-run
  `syncPolicyVersions()`, and everyone's status quietly reverts to
  outstanding. The Acknowledgment Log is append-only, so history is never
  lost.

## 2. Sheet schema

Bind this script to a new Google Sheet, then run `createPolicySystem()`
once (see Setup below) to create these tabs automatically:

| Tab | Columns | Purpose |
|---|---|---|
| **Policy Config** | PolicyID, PolicyName, Tier, DriveFileID, CurrentVersionHash, Active, LastUpdated | One row per policy. `DriveFileID` and `CurrentVersionHash` start blank — you fill in the Drive file ID once PDFs are uploaded, then run `syncPolicyVersions()`. |
| **Key Points** | PolicyID, KeyPointsText | Tier 1 only. One row per policy; `KeyPointsText` is newline-separated bullets. |
| **Quiz Bank** | PolicyID, QuestionID, QuestionText, OptionA, OptionB, OptionC, OptionD, CorrectOption | Tier 1 only. One row per question; a policy can have more than 4 so the app can draw a random 4 each attempt. Edit/add rows directly in the Sheet — no code changes needed. |
| **Acknowledgment Log** | Timestamp, StaffEmail, StaffName, PolicyID, PolicyName, Tier, VersionHash, QuizScore, Completed | Append-only. One row per completion event. Never edit or delete existing rows — this is the audit trail. |
| **Staff Directory** | StaffEmail, StaffName, Department, Campus, LineManagerEmail | Populate manually (or sync from your directory later). Drives the admin dashboard's per-staff view and reminder emails. `LineManagerEmail` is a placeholder column for the escalation hook — unused until you define that logic. |
| **Progress Tracker** | StaffEmail, PolicyID, VersionHash, LastOpenedAt | Internal. Upserted when a staff member opens a policy, so the dashboard can show "In Progress" vs "Not Started" without touching the append-only log. |
| **Reminder Log** | Timestamp, StaffEmail, PolicyIDs, Type, DaysOutstanding | Internal. Records each reminder email sent and each time the (placeholder) escalation hook fires. |

## 3. Deployment

1. Create a new Google Sheet — this becomes the data backend.
2. In the Sheet, **Extensions → Apps Script**, and either:
   - use `clasp`: `clasp create --type sheets --rootDir ./policy-acknowledgment` pointed at this folder, then `clasp push`, or
   - manually create each file in the Apps Script editor and paste in the matching content from this folder (match filenames exactly, including the `.gs`/`.html` split).
3. In the Apps Script editor, run `createPolicySystem` (from `Setup.gs`) once. Authorize the requested scopes when prompted.
4. Open the **Policy Config** tab and paste each policy's Drive file ID into `DriveFileID` (the ID segment of its Drive share link).
5. Run `syncPolicyVersions` once to compute each file's initial hash.
6. Open **Staff Directory** and add each staff member's email (Department/Campus/LineManagerEmail can stay blank for now — they're there for you to fill in as that data becomes available).
7. Run `installWeeklyReminderTrigger` (from `Setup.gs`) to turn on the weekly outstanding-policy reminder email.
8. **Deploy → New deployment → Web app**. Execute as **Me**, access **Anyone within [your domain]** — this matches `appsscript.json`'s `webapp` block.
9. Update `CONFIG.ALLOWED_DOMAIN` in `Config.gs` if it isn't already `miskschools.edu.sa`, and confirm `CONFIG.ADMIN_EMAILS` lists everyone who should see the admin dashboard.
10. The Misk logo is already baked into `Assets.html` — nothing to configure. Optional: upload a campus photo to Drive and paste its file ID into `CONFIG.HERO_IMAGE_FILE_ID` in `Config.gs` for the dashboard banner.

## 4. Content status

- **Tier 1 key points + quiz banks**: seeded from the source document for
  7 of 8 policies. **Behaviour Policy (Junior School)** has no content
  yet — its entry in `Setup.gs`'s `TIER1_CONTENT_` is intentionally empty,
  and the app shows "content coming soon" for it in the meantime. Add its
  key points and questions to that array (or directly into the Key
  Points / Quiz Bank tabs) once you have them.
- **Every quiz question was drawn directly from the source policy text.**
  Review before going live — especially anything citing a specific
  number, threshold, or named role, since those are the details most
  likely to drift on the next policy revision.
- **Tier 2 policies**: config rows exist (`Setup.gs`'s `POLICIES_`), but
  they only need a Drive file — no key points or quiz.
- **PDFs**: no files are bundled in this repo. Upload each policy's PDF to
  Drive and fill in its `DriveFileID` per the deployment steps above.
- **Brand colours**: `Styles.html` uses Misk Schools green (`--accent`,
  `--accent-ink`, `--accent-soft` CSS custom properties near the top of
  the file), estimated from the logo. Fine-tune those three hex values
  against Misk's brand guideline if you have exact codes — nothing else
  needs to change.
- **Logo**: baked directly into `Assets.html` as `BRAND_LOGO_DATA_URI`
  (the actual Misk Schools logo, not a placeholder) — no Drive fetch or
  config needed. To swap it later, replace that file's base64 string
  with a new one (`base64 -i new-logo.png` and paste the output in).
- **Hero photo**: still Drive-based since none was supplied — set
  `CONFIG.HERO_IMAGE_FILE_ID` in `Config.gs` to a Drive file ID (same
  "upload to Drive, copy the ID from the share link" pattern as the
  policy PDFs) to show a campus photo banner atop the staff dashboard.
  Left blank, the banner just doesn't render — no error.

## 5. Reading gate

No timer. Staff scroll continuously through the PDF (PDF.js renders every
page into one scrollable panel); once the last page has scrolled into
view — detected via an `IntersectionObserver`, a real visibility signal
rather than a scroll-position guess — the "I have read this policy"
button unlocks. Clicking it moves Tier 1 policies to key points + the
check-in quiz, and Tier 2 policies to the one-click declaration.

## 6. What's intentionally not built yet

Per the brief, the escalation-to-line-manager logic is a placeholder:
`escalateToManager_()` in `ReminderService.gs` fires past
`CONFIG.ESCALATION_THRESHOLD_DAYS` outstanding but only logs to the
Reminder Log — it doesn't CC anyone yet. `Staff Directory`'s
`LineManagerEmail` column is reserved for when that's defined.
