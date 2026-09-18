/**
 * Tier 1 check-in quiz. Draws QUIZ_QUESTIONS_PER_ATTEMPT questions at
 * random from the policy's bank, shuffles both question and answer order,
 * and grades server-side (the client never receives the correct answer
 * until after it submits a guess).
 */

function getQuizAttempt(policyId) {
  var bank = getQuizBank_(policyId);
  if (bank.length < CONFIG.QUIZ_QUESTIONS_PER_ATTEMPT) {
    throw new Error('Quiz bank for "' + policyId + '" needs at least ' + CONFIG.QUIZ_QUESTIONS_PER_ATTEMPT + ' questions.');
  }

  var picked = shuffle_(bank).slice(0, CONFIG.QUIZ_QUESTIONS_PER_ATTEMPT);
  return picked.map(function(q) {
    var options = shuffle_([
      { key: 'A', text: q.OptionA },
      { key: 'B', text: q.OptionB },
      { key: 'C', text: q.OptionC },
      { key: 'D', text: q.OptionD }
    ]);
    return { questionId: String(q.QuestionID), text: q.QuestionText, options: options };
  });
}

/** answers: [{ questionId, selectedKey }] */
function gradeQuiz(policyId, answers) {
  var byId = {};
  getQuizBank_(policyId).forEach(function(q) { byId[String(q.QuestionID)] = q; });

  var correctCount = 0;
  var results = answers.map(function(a) {
    var q = byId[String(a.questionId)];
    var isCorrect = !!q && String(q.CorrectOption).toUpperCase() === String(a.selectedKey).toUpperCase();
    if (isCorrect) correctCount++;
    return { questionId: a.questionId, correct: isCorrect };
  });

  return {
    score: correctCount,
    total: answers.length,
    passed: correctCount >= CONFIG.QUIZ_PASS_MARK,
    results: results
  };
}

function shuffle_(arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a;
}
