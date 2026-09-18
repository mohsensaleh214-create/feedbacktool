/**
 * One-time setup. From the Apps Script editor, select createPolicySystem
 * in the function dropdown and Run. It creates every tab this app needs
 * and seeds Policy Config plus the Tier 1 quiz content supplied so far.
 * Re-running is safe: it only creates tabs that don't exist yet and only
 * seeds rows that aren't already there.
 *
 * After running:
 *   1. Open the "Policy Config" tab and fill in DriveFileID for each
 *      policy (the ID from its Drive share link).
 *   2. Run syncPolicyVersions() once to compute each file's initial hash.
 *   3. Populate the "Staff Directory" tab (StaffEmail is required;
 *      Department/Campus/LineManagerEmail can stay blank for now).
 *   4. Run installWeeklyReminderTrigger() to turn on reminder emails.
 */
function createPolicySystem() {
  createSheetTabs_();
  seedPolicyConfig_();
  seedTier1Content_();
  Logger.log('Setup complete. Fill in DriveFileID for each policy in "Policy Config", then run syncPolicyVersions().');
}

function createSheetTabs_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var tabs = [
    { name: CONFIG.SHEET_NAMES.POLICY_CONFIG, headers: ['PolicyID', 'PolicyName', 'Tier', 'DriveFileID', 'CurrentVersionHash', 'Active', 'LastUpdated'] },
    { name: CONFIG.SHEET_NAMES.QUIZ_BANK, headers: ['PolicyID', 'QuestionID', 'QuestionText', 'OptionA', 'OptionB', 'OptionC', 'OptionD', 'CorrectOption'] },
    { name: CONFIG.SHEET_NAMES.ACK_LOG, headers: ['Timestamp', 'StaffEmail', 'StaffName', 'PolicyID', 'PolicyName', 'Tier', 'VersionHash', 'QuizScore', 'Completed'] },
    { name: CONFIG.SHEET_NAMES.STAFF_DIRECTORY, headers: ['StaffEmail', 'StaffName', 'Department', 'Campus', 'LineManagerEmail'] },
    { name: CONFIG.SHEET_NAMES.PROGRESS_TRACKER, headers: ['StaffEmail', 'PolicyID', 'VersionHash', 'LastOpenedAt'] },
    { name: CONFIG.SHEET_NAMES.REMINDER_LOG, headers: ['Timestamp', 'StaffEmail', 'PolicyIDs', 'Type', 'DaysOutstanding'] }
  ];

  tabs.forEach(function(t) {
    var sheet = ss.getSheetByName(t.name);
    if (!sheet) {
      sheet = ss.insertSheet(t.name);
      sheet.appendRow(t.headers);
      sheet.setFrozenRows(1);
      sheet.getRange(1, 1, 1, t.headers.length).setFontWeight('bold');
    }
  });

  var placeholder = ss.getSheetByName('Sheet1');
  if (placeholder && ss.getSheets().length > 1) ss.deleteSheet(placeholder);
}

var POLICIES_ = [
  { id: 'safeguarding-child-protection', name: 'Safeguarding and Child Protection Policy', tier: 1 },
  { id: 'child-protection-case-management', name: 'Child Protection Case Management Procedure', tier: 1 },
  { id: 'behaviour-policy-girls-boys', name: 'Behaviour Policy (Girls and Boys Schools)', tier: 1 },
  { id: 'behaviour-policy-junior', name: 'Behaviour Policy (Junior School)', tier: 1 },
  { id: 'medical-policy-procedures', name: 'Medical Policy and Procedures', tier: 1 },
  { id: 'whistleblowing-procedure', name: 'Whistleblowing Procedure', tier: 1 },
  { id: 'health-safety-policies', name: 'Health and Safety Policies & Procedures', tier: 1 },
  { id: 'data-protection-policy', name: 'Data Protection Policy', tier: 1 },
  { id: 'anti-bullying-policy', name: 'Anti-Bullying Policy', tier: 2 },
  { id: 'assets-acceptable-use-policy', name: 'Assets Acceptable Use Policy (incl. Online Safety)', tier: 2 },
  { id: 'attendance-punctuality-policy', name: 'Attendance and Punctuality Policy', tier: 2 },
  { id: 'code-of-conduct-staff', name: 'Code of Conduct (for Staff)', tier: 2 },
  { id: 'complaint-resolution-parents', name: 'Complaint Resolution for Parents Policy', tier: 2 },
  { id: 'hr-policies', name: 'Human Resources Policies', tier: 2 }
];

function seedPolicyConfig_() {
  var sheet = getSheet_(CONFIG.SHEET_NAMES.POLICY_CONFIG);
  var existing = sheetToObjects_(sheet).map(function(r) { return r.PolicyID; });
  POLICIES_.forEach(function(p) {
    if (existing.indexOf(p.id) !== -1) return;
    sheet.appendRow([p.id, p.name, p.tier, '', '', true, new Date()]);
  });
}

/**
 * Tier 1 quiz banks, transcribed from the source document. There is no
 * "key points" summary step — Tier 1 goes straight from the PDF reading
 * gate to this quiz. Each entry below still carries a `keyPoints` array
 * from the original source material; it's kept only as reference/context
 * and is never read or shown anywhere — safe to ignore or delete. Review
 * the quiz questions before going live, especially anything with a
 * specific number, threshold, or named role — those are the details most
 * likely to change on the next policy revision. Editing a question
 * afterwards is a normal Sheet edit in "Quiz Bank" — no code changes
 * needed.
 *
 * "Behaviour Policy (Junior School)" has no content yet — its bank is
 * left empty and the check-in is unreachable for it (quizReady stays
 * false) until rows are added here (or directly in the Sheet) and this
 * function is re-run.
 *
 * question format: [questionId, text, optionA, optionB, optionC, optionD, correctLetter]
 */
var TIER1_CONTENT_ = [
  {
    id: 'safeguarding-child-protection',
    keyPoints: [
      "Safeguarding is everyone's responsibility. There is no threshold for reporting — if in doubt, report.",
      'Reporting is a legal duty in Saudi Arabia (Child Protection Law, Article 21).',
      "Report via iSAMS (Welfare > Safeguarding > Add New Concern) if you have access; via the QR-code online form if you don't; via a paper form at reception if there's no internet; and always to the DSL or Deputy DSL directly if urgent.",
      'It is not your job to decide whether abuse happened — only to raise the concern.',
      'The SDSL is contactable out of hours via the safeguarding duty mobile; concerns raised outside school hours are treated with the same urgency as during the day.',
      'Never promise a child, parent, or colleague confidentiality when a safeguarding concern is raised. Information is shared only on a need-to-know basis.',
      'Allegations against adults (staff, contractors, volunteers) are handled under the Managing Allegations and Whistleblowing policies, with immediate risk assessment.'
    ],
    questions: [
      ['q1', 'What is the threshold for reporting a safeguarding concern?', 'Only when you are certain abuse has occurred', 'There is no threshold — if in doubt, report', "Only after discussing it with the child's parents first", "Only if a senior colleague agrees it's serious", 'B'],
      ['q2', "If you don't have iSAMS access and the internet is down, how should you report a concern?", 'Wait until the internet is back', 'Complete a pre-loaded paper form and hand it directly to the DSL or Deputy DSL', 'Email the Director General directly', 'Post it on the staff WhatsApp group', 'B'],
      ['q3', 'Can you promise a student confidentiality when they disclose a safeguarding concern to you?', 'Yes, always, to build trust', 'Yes, but only for minor concerns', 'No — you must never promise confidentiality where a safeguarding concern is raised', 'Only if the DSL approves it afterwards', 'C'],
      ['q4', 'Whose responsibility is it to determine whether abuse has actually taken place?', 'The person who first noticed the concern', "Not the reporter's — their job is only to raise the concern", "The child's parents", 'The Director General, before any report is filed', 'B'],
      ['q5', 'Outside school hours, what should you do if you have an urgent safeguarding concern?', 'Leave it until the next school day', "Contact the SDSL via the safeguarding duty mobile — it's treated with the same urgency as during the day", 'Only report it if it happened on school property', 'Message the class Homeroom teacher and wait for their response', 'B'],
      ['q6', 'If the SDSL is unavailable in an urgent, out-of-hours situation, what should you do?', "Wait until they're reachable", 'Escalate to the DSL on the rota, or where necessary, with DG authority, contact local authorities or emergency services', 'Handle it yourself without informing anyone', 'Post a note for the SDSL to see in the morning', 'B']
    ]
  },
  {
    id: 'child-protection-case-management',
    keyPoints: [
      'All cases are managed through the iSAMS Wellbeing Manager and cross-referenced with iSAMS Rewards and Conduct.',
      'Risk is categorised as High, Medium, or Low. High Risk requires immediate SDSL and DG alerting — there may be a need to involve the Board or external agencies.',
      'All child protection cases are reviewed weekly; urgent cases are escalated immediately without delay.',
      'The MISK Case Management Model has four stages: Make a decision, Identify actions, Safeguarding and support, Keep track.',
      'Every step taken must be documented on iSAMS.',
      'A tracking sheet for at-risk pupils is maintained separately by the SDSL, reviewed weekly.'
    ],
    questions: [
      ['q1', 'What system is used to manage and cross-reference all child protection cases?', 'A shared email inbox', 'The iSAMS Wellbeing Manager, cross-referenced with iSAMS Rewards and Conduct', 'A printed logbook kept in the staff room', 'WhatsApp groups per year group', 'B'],
      ['q2', 'If a concern is categorised as High Risk, who must be alerted immediately?', 'Only the Homeroom teacher', 'The SDSL, and the DG must be immediately alerted', 'The whole staff body via email', "Only the child's parents", 'B'],
      ['q3', 'How often are open child protection cases reviewed?', 'Once a term', 'Weekly', 'Only when a parent asks for an update', 'Once a year at policy review', 'B'],
      ['q4', 'What does the "K" in the MISK Case Management Model stand for?', 'Know the child', 'Keep Track', 'Key contacts', 'Kingdom compliance', 'B'],
      ['q5', 'Who is responsible for maintaining the separate tracking sheet for at-risk pupils?', 'The Homeroom teacher of each student', 'The Senior Designated Safeguarding Lead (SDSL)', 'The IT Department', 'The Director General personally', 'B']
    ]
  },
  {
    id: 'behaviour-policy-girls-boys',
    keyPoints: [
      'Corrections follow a structured 3-step approach: 1st (calm verbal reminder), 2nd (explicit correction, may include detention), 3rd (removal from class, restorative conversation, incident logged).',
      'Ongoing concerns are tracked via Orange Reports (Form Tutor-initiated, wellbeing oversight) and Red Reports (SLT-initiated, serious/escalated concerns).',
      'Mobile phones, smart watches, and similar personal devices are not permitted on site unless explicitly authorised; devices brought in may be confiscated.',
      'Taking, recording, or sharing photos/video/audio of others without permission is a serious behaviour concern and may breach Saudi privacy law.',
      'Physical intervention (reasonable force) is used only as a last resort to prevent harm, and must be proportionate — never for punishment or to cause pain.',
      'Bullying is read alongside the Anti-Bullying Policy and treated as a serious breach regardless of where it occurs.',
      'Persistent serious behaviours (e.g. physical abuse, persistent racist remarks, disrespect toward Saudi culture or Islamic beliefs and practices) can lead to permanent exclusion, decided by the DG in consultation with the Board.'
    ],
    questions: [
      ['q1', 'At the 3rd correction stage, what typically happens?', 'The student is sent home immediately', 'The student is removed from class, a restorative conversation is held, and the incident is logged', 'Nothing — 3rd correction is just a verbal note', 'Parents are called to collect the student that day', 'B'],
      ['q2', 'Who initiates a Red Report?', 'Any student in the class', 'The Senior Leadership Team (SLT), for serious or escalated concerns', 'The Form Tutor / Homeroom, for early wellbeing concerns', 'Parents, when they disagree with a sanction', 'B'],
      ['q3', 'What should staff do if they find a student using a personal mobile phone during the school day without authorisation?', 'Ignore it if the student is not disruptive', 'Confiscate the device, notify parents, and apply consequences in line with the behaviour ladder', 'Confiscate it and keep it permanently', 'Only act if it happens a third time', 'B'],
      ['q4', 'When is physical intervention (reasonable force) permitted?', 'Whenever a student refuses an instruction', 'Only as a last resort to prevent a student harming themselves or others, and must be proportionate', 'As a standard sanction for repeated low-level disruption', "At any staff member's discretion for any behaviour concern", 'B'],
      ['q5', 'What is the correct response to a student taking a photo of a classmate without permission?', 'Treat it as a minor issue with no formal response', 'Treat it as a serious behaviour concern, which may include device confiscation and disciplinary action', 'Only address it if the classmate complains in writing', 'Delete the photo and take no further action', 'B']
    ]
  },
  {
    // No source content supplied yet — key points and quiz left empty on
    // purpose. The dashboard/viewer show "content coming soon" for this
    // policy until rows are added here (or in the Sheet directly).
    id: 'behaviour-policy-junior',
    keyPoints: [],
    questions: []
  },
  {
    id: 'medical-policy-procedures',
    keyPoints: [
      'Medication is administered by the Medical Services Team only. Teaching and non-medical staff must not administer medication, except in genuine emergencies.',
      'Emergency medication (e.g. AAIs, inhalers) may be stored in the clinic, in classrooms/designated locations, or with the student, per their Individual Healthcare Plan (IHP).',
      'Signs of anaphylaxis: difficulty breathing/swallowing, facial/throat swelling, wheezing, hives, vomiting, dizziness or collapse.',
      'In a suspected anaphylaxis: administer the prescribed AAI immediately if symptoms are present, record the time, and contact the Medical Services Team immediately.',
      'If symptoms persist or worsen after 5–10 minutes, a second AAI may be given if prescribed and available.',
      'Parents/guardians must be informed as soon as reasonably practicable, and a medical incident form completed afterward.',
      'Staff should review iSAMS regularly for updated medical flags — conditions and requirements can change.'
    ],
    questions: [
      ['q1', 'Who is authorised to administer medication to a student under normal circumstances?', "Any staff member with the parent's written consent", 'The Medical Services Team only', 'The Homeroom teacher', "The student's designated buddy", 'B'],
      ['q2', 'A student shows signs of anaphylaxis and has a prescribed AAI. What is the first action?', 'Wait for the Medical Services Team to arrive before doing anything', 'Administer the prescribed AAI immediately and record the time', 'Call the parents first, then decide on medication', 'Move the student to the clinic before giving any medication', 'B'],
      ['q3', 'If anaphylaxis symptoms persist or worsen 5–10 minutes after the first AAI, what should happen?', 'Nothing further — one dose is the maximum permitted', 'A second AAI may be given if prescribed and available', 'Wait for parents to arrive before any further action', 'Only a doctor off-site may authorise a second dose', 'B'],
      ['q4', 'Which of these is NOT listed as a sign of anaphylaxis in the policy?', 'Swelling of the face, lips, tongue, or throat', 'Wheezing or noisy breathing', 'A mild headache with no other symptoms', 'Dizziness, fainting, or collapse', 'C'],
      ['q5', 'Can teaching staff administer medication in a genuine life-threatening emergency, if trained?', 'No, never, under any circumstances', "Yes — trained staff may act as first responders in genuine emergencies, but this doesn't extend to routine medication", 'Yes, for any medication request from a parent', 'Only if the Medical Services Team is on annual leave', 'B']
    ]
  },
  {
    id: 'whistleblowing-procedure',
    keyPoints: [
      'Reports can be made via official email (whistleblowing@miskschools.edu.sa), letter to the Committee Chair, or anonymously.',
      "An anonymous report may be closed without investigation if it's too vague, unverifiable, malicious, or outside scope.",
      'Every report gets a unique reference number and is logged, with an initial assessment of seriousness, violation type, and risk.',
      'Cases are classified as Substantiated, Unsubstantiated, or Requires Further Action.',
      "The whistleblower's identity is protected as far as possible, though the investigation may at some stage require an attributable statement.",
      'If an allegation is made in good faith but not confirmed by investigation, no action is taken against the person who reported it. Untrue/malicious allegations can lead to disciplinary action.',
      'Immediate safeguarding issues should be raised through the Safeguarding Policy and procedures, not this one.'
    ],
    questions: [
      ['q1', 'Where should immediate safeguarding concerns be raised — through this Whistleblowing Procedure, or elsewhere?', 'Always through the Whistleblowing Procedure first', 'Through the Safeguarding Policy and procedures, not this one', "Either one — they're interchangeable", "Only via the Committee Chair's personal email", 'B'],
      ['q2', "If you report something in good faith but the investigation doesn't confirm it, what happens to you?", "You may face disciplinary action for wasting the Committee's time", 'No action is taken against you', 'Your identity is automatically made public', 'You must formally withdraw the report in writing', 'B'],
      ['q3', 'Can an anonymous report ever be closed without investigation?', 'No, anonymous reports must always be fully investigated', "Yes — if it's too vague, unverifiable, malicious, or outside scope", 'Yes, but only with Director General approval', 'No, anonymity guarantees an investigation', 'B'],
      ['q4', 'What happens if someone makes an untrue, malicious allegation?', 'Nothing — good faith is assumed regardless of accuracy', 'Disciplinary action may be taken against that individual', 'The Committee simply ignores it', 'It is automatically escalated to the police', 'B'],
      ['q5', 'How can a report be submitted under this procedure?', 'Only via a signed letter — no email or anonymous option exists', 'Official email, letter to the Committee Chair, or anonymously', 'Only through a verbal conversation with HR', 'Only during the annual staff survey window', 'B']
    ]
  },
  {
    id: 'health-safety-policies',
    keyPoints: [
      'Every employee must take reasonable care for their own health and safety and that of others affected by their actions, and must cooperate with the school on H&S matters.',
      'No one may intentionally or recklessly interfere with or misuse anything provided for health, safety, or welfare.',
      'The Health and Safety Supervisor/Officer ensures the H&S policy is followed by all staff, contractors, and visitors, and leads weekly workplace safety inspections.',
      'All accidents involving personal injury must be recorded in the accident book/log, with serious ones investigated and reported to the Head of FM.',
      'Risk assessments (including DSE assessments for new starters) must be completed and maintained.',
      'Emergencies follow the Emergency Evacuation Plan.'
    ],
    questions: [
      ["q1", "What is every employee's basic duty under this policy?", "Only to follow instructions given by their line manager", "To take reasonable care for their own health and safety and that of others affected by their actions", "Nothing — H&S is solely the Facilities team's responsibility", "To report concerns only if directly asked", "B"],
      ["q2", "Is it acceptable to intentionally misuse equipment provided for health and safety purposes (e.g. disabling a safety guard)?", "Yes, if it makes the task faster", "No — no one may intentionally or recklessly interfere with or misuse H&S provisions", "Yes, with verbal permission from a colleague", "Only during non-teaching hours", "B"],
      ["q3", "What must happen after any accident involving personal injury?", "Nothing, unless the injury requires hospital treatment", "It must be recorded in the accident book/log, with serious cases investigated and reported to the Head of FM", "It's handled verbally between the two people involved", "It's only recorded if a parent complains", "B"],
      ["q4", "Who is responsible for making sure weekly workplace safety inspections happen?", "The Health and Safety Supervisor/Officer", "Each individual teacher for their own classroom only", "The Marketing Department", "No one — inspections are only annual", "A"],
      ["q5", "What should staff refer to in the event of an emergency evacuation?", "Their own judgement, since no formal plan exists", "The Emergency Evacuation Plan", "The Whistleblowing Procedure", "The Complaint Resolution for Parents Policy", "B"]
    ]
  },
  {
    id: 'data-protection-policy',
    keyPoints: [
      'Personal data includes anything that can identify a person: names, ID numbers, addresses, contact numbers, bank/card details, photos or videos, and similar.',
      'Personal data must be processed lawfully, transparently, for specified purposes, and kept only as long as necessary.',
      'Data should only be shared with others when legally appropriate — never shared informally, and never sent by email since this isn’t secure.',
      'Personal data should never be transferred outside Saudi Arabia without a permit granted by the Saudi Authority for Data and Artificial Intelligence (SDAIA).',
      'If an individual asks what data Misk holds about them (a "subject access request"), this goes to the Data Protection Officer by email, who verifies identity before releasing anything.',
      'Screens must be locked when unattended; data should never be saved to personal computers or devices — always access the central copy.'
    ],
    questions: [
      ["q1", "Can personal data be sent by email if it needs to be shared urgently?", "Yes, email is always an acceptable method", "No — personal data should never be sent by email, as it isn't secure", 'Yes, as long as it\'s marked "Confidential" in the subject line', "Only if the recipient is another Misk employee", "B"],
      ["q2", "Can personal data be transferred outside Saudi Arabia?", "Yes, freely, to any international partner", "No, under no circumstances whatsoever", "Only with a permit granted by the Saudi Authority for Data and Artificial Intelligence (SDAIA)", "Yes, as long as the Marketing Director approves it", "C"],
      ["q3", "What should you do if a parent submits a request asking what data Misk holds about their child?", "Send them everything immediately without verification", "Refer it to the Data Protection Officer by email, who verifies identity before releasing anything", "Refuse the request outright", "Handle it yourself if you know the student", "B"],
      ["q4", "Where should personal data be saved for day-to-day work?", "On your personal laptop for convenience", "On the central, designated system — never copied to personal computers or devices", "On a personal USB drive, encrypted", "It doesn't matter as long as it's password protected", "B"],
      ["q5", 'What counts as "personal data" under this policy?', "Only a person's full legal name", "Names, ID numbers, contact details, bank/card numbers, photos and videos, and similar identifying information", "Only financial information", "Only information stored electronically, not on paper", "B"]
    ]
  }
];

function seedTier1Content_() {
  var qbSheet = getSheet_(CONFIG.SHEET_NAMES.QUIZ_BANK);
  var qbExisting = {};
  sheetToObjects_(qbSheet).forEach(function(r) { qbExisting[r.PolicyID + '::' + r.QuestionID] = true; });

  TIER1_CONTENT_.forEach(function(policy) {
    policy.questions.forEach(function(q) {
      var key = policy.id + '::' + q[0];
      if (qbExisting[key]) return;
      qbSheet.appendRow([policy.id, q[0], q[1], q[2], q[3], q[4], q[5], q[6]]);
    });
  });
}

function installWeeklyReminderTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'sendOutstandingReminders') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('sendOutstandingReminders')
    .timeBased()
    .everyDays(CONFIG.REMINDER_CADENCE_DAYS)
    .atHour(8)
    .create();
}
