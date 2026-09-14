/**
 * Entry point. Deploy this project as a web app (execute as me, accessible
 * to anyone within the domain) — see README.md for the full setup.
 */
function doGet(e) {
  var email = Session.getActiveUser().getEmail();

  if (!email) {
    return HtmlService.createHtmlOutput(
      '<p style="font-family:sans-serif;padding:40px;">Please sign in with your Misk Schools Google account and reload this page.</p>'
    );
  }

  var domain = email.split('@')[1];
  if (domain !== CONFIG.ALLOWED_DOMAIN) {
    return HtmlService.createHtmlOutput(
      '<p style="font-family:sans-serif;padding:40px;">This app is only available to Misk Schools staff (' +
      CONFIG.ALLOWED_DOMAIN + ' accounts). You are signed in as ' + email + '.</p>'
    );
  }

  var template = HtmlService.createTemplateFromFile('Index');
  template.userEmail = email;
  template.isAdmin = isAdmin_(email);

  return template.evaluate()
    .setTitle('Misk Schools | Policy Acknowledgment')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/** Settings the client needs for the reading gate and quiz, without exposing all of CONFIG. */
function getAppConfig() {
  return {
    secondsPerPage: CONFIG.SECONDS_PER_PAGE,
    minDwellSeconds: CONFIG.MIN_DWELL_SECONDS,
    maxDwellSeconds: CONFIG.MAX_DWELL_SECONDS,
    quizQuestionsPerAttempt: CONFIG.QUIZ_QUESTIONS_PER_ATTEMPT,
    quizPassMark: CONFIG.QUIZ_PASS_MARK
  };
}
