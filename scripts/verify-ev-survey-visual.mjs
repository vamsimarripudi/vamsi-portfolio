import assert from 'node:assert/strict';
import { chromium, devices } from 'playwright';
import { SURVEY_QUESTIONS } from '../shared/ev-survey.mjs';

const browser = await chromium.launch({ headless: true });
try {
  for (const profile of [
    { name: 'desktop', options: { viewport: { width: 1366, height: 850 } } },
    { name: 'mobile', options: devices['iPhone 13'] },
  ]) {
    const context = await browser.newContext(profile.options);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));
    await page.goto('http://127.0.0.1:4173/ev-survey', { waitUntil: 'networkidle' });
    await page.locator('.evs-intro h1').waitFor();
    await page.screenshot({ path: '/tmp/track-ev-survey-'+profile.name+'-intro.png', fullPage: true });

    await page.getByRole('button', { name: 'Start interview' }).click();
    await page.getByRole('alert').getByText('Please confirm').waitFor();
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Start interview' }).click();
    await page.getByRole('heading', { name: SURVEY_QUESTIONS[0].title }).waitFor();
    await page.screenshot({ path: '/tmp/track-ev-survey-'+profile.name+'-question.png', fullPage: true });

    for (const [index, question] of SURVEY_QUESTIONS.entries()) {
      await page.getByRole('heading', { name: question.title }).waitFor();
      if (question.type === 'single' || question.type === 'multi') {
        await page.getByRole('button', { name: question.options[0], exact: true }).click();
      } else {
        const input = page.locator('#evs-' + question.id);
        await input.fill(question.id === 'city' ? 'Hyderabad' : question.id === 'ev_model' ? 'Tata Nexon EV' : 'Sample interview answer for testing the form.');
      }
      await page.getByRole('button', { name: index === SURVEY_QUESTIONS.length - 1 ? 'Review answers' : 'Next question' }).click();
    }
    await page.getByRole('heading', { name: 'Review the conversation.' }).waitFor();
    await page.screenshot({ path: '/tmp/track-ev-survey-'+profile.name+'-review.png', fullPage: true });
    const submissions = [];
    await page.route('**/api/ev-survey', route => {
      submissions.push(route.request().postDataJSON());
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ ok: true, referenceId: 'EV-2026-123456789A' }) });
    });
    await page.getByRole('button', { name: 'Submit interview' }).click();
    await page.getByText('EV-2026-123456789A').waitFor();
    assert.equal(submissions.length, 1);
    assert.equal(submissions[0].consent, true);
    assert.equal(submissions[0].answers.ev_model, 'Tata Nexon EV');
    assert.equal(submissions[0].answers.primary_issue, SURVEY_QUESTIONS.find(q => q.id === 'primary_issue').options[0]);
    // Protected dashboard visual and record-detail acceptance with mocked owner session.
    await page.route('**/api/track/auth/session', route => route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ ok: true, owner: 'connect@vamsimarripudi.me', expiresAt: '2026-10-25T22:00:00Z' }) }));
    await page.route('**/api/track/ev-surveys?*', route => route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ ok: true, overview: { total: 1, unclear_estimates: 1, warranty_concerns: 0, charging_failures: 1, previously_paid: 0, willing_to_consider: 1 },
        distributions: { issues: [{ label: 'Reliable public charging', count: 1 }], prices: [{ label: '₹199', count: 1 }], interest: [{ label: 'Yes', count: 1 }] },
        weeks: [{ week: '2026-10-19', count: 1 }], matchCount: 1, page: 1,
        items: [{ reference_id: 'EV-2026-123456789A', created_at: '2026-10-25T06:00:00Z', answers: { ev_model: 'Tata Nexon EV', city: 'Hyderabad', primary_issue: 'Reliable public charging', pay_for_review: 'Yes', biggest_problem: 'A real charging failure on a trip' } }] }) }));
    await page.goto('http://127.0.0.1:4173/track/ev-surveys', { waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: /EV owner interviews/ }).waitFor();
    await page.getByText('Reliable public charging').first().waitFor();
    await page.screenshot({ path: '/tmp/track-ev-survey-'+profile.name+'-dashboard.png', fullPage: true });
    await page.locator('.evst-record-head').click();
    await page.locator('.evst-answer-grid').waitFor();
    assert.equal(await page.locator('.evst-answer-grid').isVisible(), true);
    assert.deepEqual(errors, [], profile.name + ' browser errors');
    await context.close();
  }
  console.log('EV survey desktop and mobile: consent, all questions, review, submit and screenshots passed.');
} finally { await browser.close(); }
