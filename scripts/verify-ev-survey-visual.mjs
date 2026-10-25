import assert from 'node:assert/strict';
import { chromium, devices } from 'playwright';
import { SURVEY_QUESTIONS } from '../shared/ev-survey.mjs';

const browser = await chromium.launch({ headless: true });
try {
  for (const profile of [
    { name: 'desktop', options: { viewport: { width: 1366, height: 850 } } },
    { name: 'tablet', options: { viewport: { width: 768, height: 1024 }, isMobile: true, hasTouch: true } },
    { name: 'mobile', options: devices['iPhone 13'] },
    { name: 'mobile-small', options: { viewport: { width: 320, height: 640 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } },
  ]) {
    const context = await browser.newContext(profile.options);
    const page = await context.newPage();
    const errors = [];
    const phone = profile.name.startsWith('mobile');
    page.on('pageerror', err => errors.push(err.message));
    await page.goto('http://127.0.0.1:4173/ev-survey', { waitUntil: 'networkidle' });
    await page.locator('.evs-intro h1').waitFor();
    const firstViewport = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
    assert.ok(firstViewport.scrollWidth <= firstViewport.width + 1, profile.name + ' intro must not overflow horizontally');
    await page.screenshot({ path: '/tmp/track-ev-survey-'+profile.name+'-intro.png', fullPage: true });

    await page.getByRole('button', { name: 'Start interview' }).click();
    await page.getByRole('alert').getByText('Please confirm').waitFor();
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Start interview' }).click();
    await page.getByRole('heading', { name: SURVEY_QUESTIONS[0].title }).waitFor();
    const layout = await page.evaluate(() => {
      const dock = document.querySelector('.evs-actions');
      const button = document.querySelector('.evs-actions .evs-primary');
      const choice = document.querySelector('.evs-choice');
      const field = document.querySelector('.evs-textfield');
      const control = choice || field;
      const stage = document.querySelector('.evs-mobile-stage');
      return {
        width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth,
        dock: getComputedStyle(dock).position, dockRect: dock.getBoundingClientRect().toJSON(),
        buttonHeight: button.getBoundingClientRect().height,
        controlHeight: control?.getBoundingClientRect().height ?? 0,
        controlFont: control ? parseFloat(getComputedStyle(control).fontSize) : 0,
        stageDisplay: getComputedStyle(stage).display,
      };
    });
    assert.ok(layout.scrollWidth <= layout.width + 1, profile.name + ' question must not overflow horizontally');
    assert.ok(layout.buttonHeight >= 44, profile.name + ' primary button has touch target');
    if (phone) {
      assert.equal(layout.dock, 'fixed', profile.name + ' next action should remain visible');
      assert.equal(layout.stageDisplay, 'flex', profile.name + ' compact stage indicator should show');
      assert.ok(layout.dockRect.left >= -1 && layout.dockRect.right <= layout.width + 1, profile.name + ' action dock fits viewport');
      assert.ok(layout.controlHeight >= 54 && layout.controlFont >= 16, profile.name + ' controls are readable and touch sized');
    } else assert.equal(layout.stageDisplay, 'none', 'desktop/tablet uses full stage navigation');
    await page.screenshot({ path: '/tmp/track-ev-survey-'+profile.name+'-question.png', fullPage: true });

    for (const [index, question] of SURVEY_QUESTIONS.entries()) {
      await page.getByRole('heading', { name: question.title }).waitFor();
      if (question.type === 'single' || question.type === 'multi') {
        if (phone) {
          const size = await page.locator('.evs-choice').first().evaluate(element => ({ height: element.getBoundingClientRect().height, fontSize: parseFloat(getComputedStyle(element).fontSize) }));
          assert.ok(size.height >= 60 && size.fontSize >= 16, profile.name + ' choice touch target and font size: ' + question.id);
        }
        await page.getByRole('button', { name: question.id === 'follow_up_permission' && phone ? question.options[1] : question.options[0], exact: true }).click();
      } else if (question.id === 'participant_phone' && phone) {
        await page.getByText('The owner declined follow-up, so no mobile number is requested.').waitFor();
        assert.equal(await page.locator('#evs-participant_phone').count(), 0);
      } else {
        const input = page.locator('#evs-' + question.id);
        await input.fill(question.id === 'city' ? 'Hyderabad' : question.id === 'ev_model' ? 'Tata Nexon EV' : question.id === 'participant_phone' ? '9876543210' : 'Sample interview answer for testing the form.');
      }
      if (question.id === 'ev_model' && profile.name === 'mobile-small') {
        await page.locator('#evs-ev_model').press('Enter');
      } else {
        await page.getByRole('button', { name: index === SURVEY_QUESTIONS.length - 1 ? 'Review answers' : 'Next question' }).click();
      }
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
    assert.equal(submissions[0].answers.follow_up_permission, phone ? 'No, do not contact me' : 'Yes, contact me once about this EV research');
    if (phone) assert.equal(submissions[0].answers.participant_phone, undefined);
    else assert.equal(submissions[0].answers.participant_phone, '9876543210');
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
