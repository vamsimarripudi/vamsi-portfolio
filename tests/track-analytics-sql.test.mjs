import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { loadEnquiryAnalytics } from '../api/lib/track-analytics.js';
import { NOW } from './fixtures/track-analytics.mjs';

test('real PostgreSQL engine verifies inclusive IST boundaries, comparisons, privacy exclusion and read-only aggregation', async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE TABLE track_enquiries (created_at timestamptz, status text, intent text, replied_at timestamptz, completed_at timestamptz);
      INSERT INTO track_enquiries VALUES
       ('2026-10-09T18:29:59Z','NEW','Collaboration',NULL,NULL),
       ('2026-10-09T18:30:00Z','REPLIED','Collaboration','2026-10-11T01:00:00Z',NULL),
       ('2026-10-10T18:29:59Z','COMPLETED','Mentorship','2026-10-11T01:00:00Z','2026-10-11T02:00:00Z'),
       ('2026-10-10T18:30:00Z','NEW','Collaboration',NULL,NULL),
       ('2026-10-10T01:00:00Z','ERASED','Private',NULL,NULL),
       ('2026-10-10T02:00:00Z','ERASURE_PENDING','Private',NULL,NULL);`);
    let queries = 0;
    const sql = async (strings, ...values) => {
      queries++; const text = strings.reduce((result, part, index) => result + part + (index < values.length ? `$${index + 1}` : ''), '');
      assert.ok(!/\b(INSERT|DELETE|UPDATE|ALTER|DROP|TRUNCATE)\b/i.test(text));
      return (await db.query(text, values)).rows;
    };
    const report = await loadEnquiryAnalytics({ range: 'custom', start: '2026-10-10', end: '2026-10-10' }, sql, NOW);
    assert.equal(queries, 1); assert.equal(report.metrics[0].value, 2); assert.equal(report.metrics[0].previous, 1);
    assert.equal(report.metrics[1].value, 2); assert.equal(report.metrics[2].value, 1);
    assert.equal(report.trend.points[0].value, 2); assert.equal(report.trend.points[0].previous, 1);
    assert.ok(!JSON.stringify(report).includes('Private')); assert.ok(!JSON.stringify(report).includes('ERASED'));
    assert.equal((await db.query('SELECT count(*)::int AS count FROM track_enquiries')).rows[0].count, 6);
    const noComparison = await loadEnquiryAnalytics({ range: 'custom', start: '2026-10-10', end: '2026-10-10', compare: 'none' }, sql, NOW);
    assert.equal(noComparison.metrics[0].previous, null); assert.equal(noComparison.trend.points[0].previous, null);
    const empty = await loadEnquiryAnalytics({ range: 'custom', start: '2020-01-01', end: '2020-01-01' }, sql, NOW);
    assert.equal(empty.metrics[0].value, 0); assert.equal(empty.breakdowns[0].rows.length, 0);
  } finally { await db.close(); }
});
