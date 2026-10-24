import test from 'node:test';
import assert from 'node:assert/strict';
import { SURVEY_QUESTIONS, SURVEY_VERSION, validateSurveyAnswers, responseRowsToCsv } from '../shared/ev-survey.mjs';

const complete = Object.fromEntries(SURVEY_QUESTIONS.filter(q => q.required).map(q => [
  q.id, q.type === 'multi' ? [q.options[0]] : q.type === 'single' ? q.options[0] : 'A real owner experience'
]));
complete.participant_phone = '9876543210';

test('research instrument has immutable unique keys, sections and optional notes', () => {
  assert.equal(SURVEY_VERSION, '2026-10-v2');
  assert.equal(SURVEY_QUESTIONS.length, 25);
  assert.ok(SURVEY_QUESTIONS.some(q => q.id === 'participant_name'));
  assert.ok(SURVEY_QUESTIONS.some(q => q.id === 'participant_phone'));
  assert.ok(SURVEY_QUESTIONS.some(q => q.id === 'follow_up_permission'));
  assert.equal(SURVEY_QUESTIONS.find(q => q.id === 'participant_phone').required, false);
  assert.equal(new Set(SURVEY_QUESTIONS.map(q => q.id)).size, SURVEY_QUESTIONS.length);
  assert.ok(SURVEY_QUESTIONS.some(q => q.id === 'pay_for_review'));
  assert.ok(SURVEY_QUESTIONS.some(q => q.id === 'primary_issue'));
  assert.equal(SURVEY_QUESTIONS.find(q => q.id === 'interview_notes').required, false);
});
test('complete interview is accepted and unknown fields discarded', () => {
  const result = validateSurveyAnswers({ ...complete, injected: 'ignore me', city: ' Hyderabad ' });
  assert.equal(result.ok, true);
  assert.equal(result.answers.city, 'Hyderabad');
  assert.equal(result.answers.injected, undefined);
});
test('missing critical answer and invalid choices are rejected', () => {
  const missing = validateSurveyAnswers({ ...complete, ev_model: '' });
  assert.equal(missing.ok, false);
  assert.ok(missing.errors.ev_model);
  const invalid = validateSurveyAnswers({ ...complete, primary_issue: 'Promote our app' });
  assert.equal(invalid.ok, false);
  assert.ok(invalid.errors.primary_issue);
});
test('contradictory multi-select and oversized free text are blocked', () => {
  const contradictory = validateSurveyAnswers({ ...complete, experienced_problems: ['None of these', 'Charging payment or app problem'] });
  assert.ok(contradictory.errors.experienced_problems);
  const oversized = validateSurveyAnswers({ ...complete, biggest_problem: 'a'.repeat(2000) });
  assert.ok(oversized.errors.biggest_problem);
});
test('CSV quotations are escaped and spreadsheet formulas neutralized', () => {
  const csv = responseRowsToCsv([{ reference_id: 'EV-2026-123456789A', created_at: '2026-10-25', answers: { ev_model: '=HYPERLINK("bad")', city: 'one,"two"' } }]);
  assert.ok(csv.includes("'=HYPERLINK"));
  assert.ok(csv.includes('one,""two""'));
  assert.ok(csv.includes('Reference'));
});

test('follow-up mobile is opt-in only, and must be a valid Indian number', () => {
  const yes = 'Yes, contact me once about this EV research';
  const no = 'No, do not contact me';
  assert.equal(validateSurveyAnswers({ ...complete, follow_up_permission: yes, participant_phone: '98765 43210' }).ok, true);
  assert.equal(validateSurveyAnswers({ ...complete, follow_up_permission: yes, participant_phone: '98765 43210' }).answers.participant_phone, '9876543210');
  assert.ok(validateSurveyAnswers({ ...complete, follow_up_permission: yes, participant_phone: '' }).errors.participant_phone);
  assert.ok(validateSurveyAnswers({ ...complete, follow_up_permission: no, participant_phone: '9876543210' }).errors.participant_phone);
  assert.ok(validateSurveyAnswers({ ...complete, follow_up_permission: yes, participant_phone: '1234567890' }).errors.participant_phone);
  const anonymous = { ...complete, follow_up_permission: no, participant_name: '', participant_phone: '' };
  assert.equal(validateSurveyAnswers(anonymous).ok, true);
  assert.equal(validateSurveyAnswers(anonymous).answers.participant_phone, undefined);
});
