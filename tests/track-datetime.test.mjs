import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeFollowUpAt } from '../src/TrackDatetime.mjs';

test('follow-ups use the browser local timezone rather than Vercel UTC', () => {
  const previous = process.env.TZ;
  try {
    process.env.TZ = 'Asia/Kolkata';
    assert.equal(normalizeFollowUpAt('2026-10-12T10:00'), '2026-10-12T04:30:00.000Z');
    process.env.TZ = 'America/New_York';
    assert.equal(normalizeFollowUpAt('2026-10-12T10:00'), '2026-10-12T14:00:00.000Z');
    assert.equal(normalizeFollowUpAt(''), null);
    assert.equal(normalizeFollowUpAt('not-a-date'), null);
  } finally {
    if(previous === undefined)delete process.env.TZ;
    else process.env.TZ=previous;
  }
});
