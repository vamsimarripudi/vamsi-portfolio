import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { createGa4Reader, normalizeEnquiries } from '../server/track-analytics.js';
import { resolveRange } from '../shared/track-analytics.mjs';
import { NOW, GA_ENV, fakeGa4Report } from '../tests/fixtures/track-analytics.mjs';

const base = process.env.TRACK_TEST_BASE_URL || 'http://127.0.0.1:4173';
const widths = [320, 375, 390, 412, 430, 600, 768, 834, 1024, 1280, 1440, 1920];
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
try {
  for (const width of widths) {
    const context = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 1000 }, reducedMotion: 'reduce', acceptDownloads: true });
    const page = await context.newPage(), errors = [], requests = [];
    let mode = 'ready';
    const ga4 = createGa4Reader({ clock: () => NOW, makeClient: () => ({ request: async ({ data }) => ({ data: fakeGa4Report(data) }) }) });
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/track/**', async route => {
      const url = new URL(route.request().url());
      let payload = { ok: true }, status = 200;
      if (url.pathname.endsWith('/auth/session')) payload = { ok: true, owner: 'owner@example.test' };
      else if (url.pathname.endsWith('/analytics')) {
        requests.push(url.searchParams);
        if (mode === 'error') { status = 503; payload = { ok: false, message: 'Provider temporarily unavailable.' }; }
        else if (mode === 'expired') { status = 401; payload = { ok: false, message: 'Session expired.' }; }
        else if (mode === 'missing') payload.report = { source: 'ga4', status: 'not_configured', message: 'Connect an existing GA4 property to view real traffic.' };
        else {
          const input = Object.fromEntries(url.searchParams), range = resolveRange(input, NOW);
          payload.report = input.source === 'enquiries' || mode === 'empty'
            ? normalizeEnquiries(range, mode === 'empty' ? [] : [{ kind: 'summary', period: 'current', value: 3, replied: 1, completed: 0, spam: 0 }], NOW.toISOString())
            : await ga4(input, GA_ENV);
        }
      } else if (url.pathname.endsWith('/enquiries')) payload = { ok: true, items: [], total: 0, page: 1, limit: 25 };
      else if (url.pathname.endsWith('/metrics')) payload = { ok: true, metrics: { total: 0 } };
      await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(payload) }).catch(() => {});
    });
    await page.goto(`${base}/track/analytics?source=ga4&range=7d&compare=previous`, { waitUntil: 'domcontentloaded' });
    await page.locator('.ta-metric').first().waitFor();
    assert.equal(await page.locator('.ta-metric').count(), 6);
    assert.equal(await page.locator('.ta-breakdowns .ta-panel').count(), 5);
    assert.equal(await page.locator('.track-workspace-nav a[aria-current="page"]').textContent(), 'Analytics');
    const layout = await page.evaluate(() => ({
      width: innerWidth, scroll: document.documentElement.scrollWidth,
      heading: parseFloat(getComputedStyle(document.querySelector('.ta-heading h1')).fontSize),
      targets: [...document.querySelectorAll('.ta-page button,.ta-page input,.ta-page select')].map(node => ({ height: node.getBoundingClientRect().height, right: node.getBoundingClientRect().right })),
    }));
    assert.ok(layout.scroll <= width + 1, `No horizontal overflow at ${width}: ${JSON.stringify(layout)}`);
    assert.ok(layout.heading <= 38, `Compact heading at ${width}`);
    assert.ok(layout.targets.every(target => target.height >= 43.9 && target.right <= width + 1), `Controls fit with touch targets at ${width}`);
    await page.getByText('View daily data table', { exact: true }).click();
    assert.equal(await page.locator('.ta-daily tbody tr').count(), 7);
    await page.getByLabel('Date range', { exact: true }).selectOption('custom');
    await page.getByLabel('Start date', { exact: true }).fill('2026-10-01');
    await page.getByLabel('End date', { exact: true }).fill('2026-10-10');
    await page.getByLabel('Compare with', { exact: true }).selectOption('none');
    await page.getByRole('button', { name: 'Apply range', exact: true }).click();
    await page.locator('.ta-status').getByText(/2026-10-01 — 2026-10-10/).waitFor();
    assert.equal(new URL(page.url()).searchParams.get('start'), '2026-10-01');
    assert.ok(requests.some(params => params.get('start') === '2026-10-01' && params.get('compare') === 'none'));
    assert.equal(await page.locator('.ta-change').count(), 0);
    const pendingDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export CSV', exact: true }).click();
    const download = await pendingDownload;
    assert.equal(download.suggestedFilename(), 'analytics-ga4-2026-10-01-2026-10-10.csv');
    const csv = await readFile(await download.path(), 'utf8');
    assert.ok(csv.includes('2026-10-01') && csv.includes('Active users'));
    await page.getByLabel('Start date', { exact: true }).fill('2026-10-11');
    await page.getByRole('button', { name: 'Apply range', exact: true }).click();
    await page.getByRole('alert').getByText('The start date must be on or before the end date.').waitFor();
    assert.equal(new URL(page.url()).searchParams.get('start'), '2026-10-01');
    mode = 'error'; await page.getByRole('button', { name: 'Refresh analytics' }).click();
    await page.getByRole('alert').getByText('Provider temporarily unavailable.').waitFor();
    assert.equal(await page.locator('.ta-metric').count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Export CSV', exact: true }).isDisabled(), true);
    mode = 'missing'; await page.getByRole('button', { name: 'Retry analytics' }).click();
    await page.getByRole('heading', { name: 'Connect Google Analytics' }).waitFor();
    assert.equal(await page.locator('.ta-metric').count(), 0);
    mode = 'ready'; await page.getByRole('button', { name: 'View enquiry analytics instead' }).click();
    await page.locator('.ta-metric').first().waitFor();
    assert.equal(await page.locator('.ta-metric').count(), 4);
    assert.ok((await page.locator('.ta-status').textContent()).includes('Enquiry database'));
    mode = 'empty'; await page.getByRole('button', { name: 'Refresh analytics' }).click();
    await page.getByText(/No recorded activity was returned/).waitFor();
    mode = 'ready'; await page.getByRole('button', { name: 'Refresh analytics' }).click();
    await page.locator('.ta-metric').first().waitFor();
    if ([390, 834, 1440].includes(width)) await page.screenshot({ path: `/tmp/track-analytics-${width}.png`, fullPage: true });
    await page.getByRole('link', { name: 'Enquiries', exact: true }).click();
    await page.locator('.track-kpi').first().waitFor();
    await page.getByRole('link', { name: 'Analytics', exact: true }).click();
    await page.locator('.ta-metric').first().waitFor();
    mode = 'expired'; await page.getByRole('button', { name: 'Refresh analytics' }).click();
    await page.locator('.track-auth').waitFor();
    assert.equal(await page.locator('.ta-metric').count(), 0);
    assert.deepEqual(errors, [], `No browser exceptions at ${width}`);
    console.log(`PASS analytics ${width}px: ranges, comparisons, export, errors, empty, setup, queue navigation, session expiry`);
    await context.close();
  }
} finally { await browser.close(); }
