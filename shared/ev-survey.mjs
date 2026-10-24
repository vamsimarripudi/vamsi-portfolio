// Shared, versioned research questionnaire. Never change existing answer keys in place.
export const SURVEY_VERSION = '2026-10-v1';
export const SURVEY_QUESTIONS = [
  { id: 'ev_model', section: 'Your EV', title: 'Which electric car do you currently drive?', help: 'Brand, model and variant if known. We are interviewing current EV car owners.', type: 'text', required: true, placeholder: 'For example: Tata Nexon EV, 45 kWh' },
  { id: 'ownership', section: 'Your EV', title: 'How long have you owned this electric car?', type: 'single', required: true, options: ['Less than 6 months', '6–12 months', '1–2 years', 'More than 2 years'] },
  { id: 'city', section: 'Your EV', title: 'Which city do you mainly drive in?', type: 'text', required: false, placeholder: 'City only, not your address' },
  { id: 'charging_main', section: 'Your EV', title: 'Where do you usually charge?', type: 'single', required: true, options: ['At home, private parking', 'At my apartment or shared parking', 'Mostly public chargers', 'A mix of home and public', 'Other'] },
  { id: 'biggest_problem', section: 'Real experiences', title: 'What has been the most frustrating part of owning your EV?', help: 'Please describe your experience rather than what you have heard from others.', type: 'long', required: true, placeholder: 'What happened and why was it frustrating?' },
  { id: 'last_incident', section: 'Real experiences', title: 'Think of the last time something went wrong. What exactly happened?', help: 'If nothing has gone wrong, say so. Ask when it happened, where, and what the owner did.', type: 'long', required: true, placeholder: 'Describe the most recent incident or write “No incident yet”.' },
  { id: 'experienced_problems', section: 'Real experiences', title: 'Which of these have you personally experienced?', type: 'multi', required: true, options: ['Faulty or unavailable public charger', 'Charging payment or app problem', 'Inaccurate range estimate', 'Trip delayed or cancelled', 'Unclear repair or service charges', 'Warranty confusion or dispute', 'Service centre or parts delay', 'Battery health or resale uncertainty', 'None of these', 'Other'] },
  { id: 'issue_frequency', section: 'Real experiences', title: 'How often did EV-related problems affect you in the past 3 months?', type: 'single', required: true, options: ['Not at all', 'Once', '2–3 times', '4 or more times', 'Cannot remember'] },
  { id: 'charging_failure', section: 'Real experiences', title: 'Has a public charger ever failed, been inaccessible, or disrupted your trip?', type: 'single', required: true, options: ['Yes, more than once', 'Yes, once', 'No', 'I have not used public charging'] },
  { id: 'quote_confusion', section: 'Service & expense', title: 'Have you received a repair or service estimate you could not clearly understand?', type: 'single', required: true, options: ['Yes', 'No', 'I have never received a repair estimate'] },
  { id: 'warranty_experience', section: 'Service & expense', title: 'Have you had difficulty understanding or claiming a vehicle warranty?', type: 'single', required: true, options: ['Claim rejected', 'Claim delayed or disputed', 'Coverage unclear, no claim made', 'No warranty issue', 'Not sure'] },
  { id: 'cost_range', section: 'Service & expense', title: 'Approximately how much did your most disruptive EV problem cost you out of pocket?', help: 'Include only money you actually paid, not a quoted estimate.', type: 'single', required: true, options: ['₹0', '₹1–₹999', '₹1,000–₹4,999', '₹5,000–₹14,999', '₹15,000 or more', 'Cannot estimate'] },
  { id: 'time_lost', section: 'Service & expense', title: 'How much time did you lose dealing with that problem?', type: 'single', required: true, options: ['None', 'Under 2 hours', '2–8 hours', '1–3 days', 'More than 3 days', 'Cannot estimate'] },
  { id: 'how_resolved', section: 'Current solutions', title: 'What did you do to solve the problem, and did it work?', help: 'Examples might include a service adviser, another app, owner group, or independent mechanic.', type: 'long', required: true, placeholder: 'Steps tried, outcome, and what remained unresolved' },
  { id: 'info_gap', section: 'Current solutions', title: 'Which information is most difficult for you to find or verify?', type: 'multi', required: true, options: ['Real charger availability', 'Actual driving range', 'Fair repair costs', 'Warranty coverage or exclusions', 'Qualified repair support', 'Battery health or resale evidence', 'Nothing is particularly difficult', 'Other'] },
  { id: 'paid_help', section: 'Current solutions', title: 'Have you paid for independent help with an EV problem?', type: 'single', required: true, options: ['Yes', 'No', 'I tried, but could not find anyone'] },
  { id: 'primary_issue', section: 'Current solutions', title: 'If you could solve just one EV ownership problem, which would it be?', type: 'single', required: true, options: ['Reliable public charging', 'Charging costs and payments', 'Accurate range and trip planning', 'Repair and service transparency', 'Warranty and claim support', 'Battery health and resale trust', 'Something else', 'No major problem'] },
  { id: 'review_value', section: 'Product validation', title: 'How useful would an independent written review of a repair estimate and warranty documents be to you?', help: 'Describe the concept neutrally. It would explain the documents, not guarantee an outcome.', type: 'single', required: true, options: ['Very useful', 'Somewhat useful', 'Not very useful', 'Not useful at all', 'Not sure'] },
  { id: 'pay_for_review', section: 'Product validation', title: 'If you had a real unclear repair estimate, would you consider paying for a one-time written review?', type: 'single', required: true, options: ['Yes', 'Maybe, depending on the case', 'No', 'I would not need this'] },
  { id: 'max_price', section: 'Product validation', title: 'What is the highest price you would seriously consider for that one-time review?', help: 'This is not a payment request. A hypothetical answer is not proof of purchase.', type: 'single', required: true, options: ['I would not pay', '₹99', '₹199', '₹399', '₹699 or more', 'Not sure'] },
  { id: 'trust_needs', section: 'Product validation', title: 'What would make such a service trustworthy or worth using?', type: 'long', required: false, placeholder: 'Optional: accuracy, sources, examples, turnaround, impartiality…' },
  { id: 'interview_notes', section: 'Product validation', title: 'Any other feedback or interview notes?', help: 'Optional. Do not enter a participant’s name, phone number, Aadhaar, registration number, or address.', type: 'long', required: false, placeholder: 'Additional observations you want to remember' },
];

export const questionById = Object.fromEntries(SURVEY_QUESTIONS.map((q) => [q.id, q]));
export const SURVEY_SECTIONS = [...new Set(SURVEY_QUESTIONS.map((q) => q.section))];

export function validateSurveyAnswers(input) {
  const answers = {};
  const errors = {};
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, answers, errors: { _form: 'Survey answers must be an object.' } };
  for (const q of SURVEY_QUESTIONS) {
    const value = input[q.id];
    if (q.type === 'multi') {
      if (value === undefined || value === null || (Array.isArray(value) && value.length === 0)) {
        if (q.required) errors[q.id] = 'Choose at least one option.';
        continue;
      }
      if (!Array.isArray(value) || value.length > q.options.length || !value.every((item) => typeof item === 'string' && q.options.includes(item)) || new Set(value).size !== value.length || (value.includes('None of these') && value.length > 1) || (value.includes('Nothing is particularly difficult') && value.length > 1)) {
        errors[q.id] = 'Choose valid, non-conflicting options.';
      } else answers[q.id] = value;
    } else {
      if (value === undefined || value === null || value === '') {
        if (q.required) errors[q.id] = 'This answer is required.';
        continue;
      }
      if (typeof value !== 'string') { errors[q.id] = 'Enter a valid answer.'; continue; }
      const clean = value.trim();
      if (!clean) { if (q.required) errors[q.id] = 'This answer is required.'; continue; }
      if (q.type === 'single' && !q.options.includes(clean)) { errors[q.id] = 'Choose one of the listed options.'; continue; }
      if (clean.length > (q.type === 'text' ? 120 : 1500)) { errors[q.id] = 'Answer is too long.'; continue; }
      answers[q.id] = clean;
    }
  }
  return { ok: Object.keys(errors).length === 0, answers, errors };
}

export function responseRowsToCsv(rows) {
  const headings = ['Reference', 'Submitted at', ...SURVEY_QUESTIONS.map((q) => q.title)];
  const safeCell = (value) => {
    let str = Array.isArray(value) ? value.join('; ') : String(value ?? '');
    // Prevent spreadsheet formula injection without changing the original DB record.
    if (/^[\s]*[=+@\t\r-]/.test(str)) str = "'" + str;
    return '"' + str.replaceAll('"', '""') + '"';
  };
  return [headings, ...rows.map((row) => [row.reference_id, row.created_at, ...SURVEY_QUESTIONS.map((q) => row.answers?.[q.id] ?? '')])].map((line) => line.map(safeCell).join(',')).join('\r\n');
}
