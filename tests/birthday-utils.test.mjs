import assert from 'node:assert/strict';
import test from 'node:test';
import { BIRTHDAY_LIMITS, decodeBirthdayPayload, DEFAULT_BIRTHDAY_MESSAGE, encodeBirthdayPayload, normalizeBirthdayData } from '../src/birthday-utils.js';

test('birthday payloads preserve Unicode text and safely round-trip', () => {
  const source = { recipientName: 'సతీష్ 🎂', senderName: 'వంశీ', message: 'మీకు పుట్టినరోజు శుభాకాంక్షలు!\n\nHave a beautiful year.' };
  assert.deepEqual(decodeBirthdayPayload(encodeBirthdayPayload(source)), source);
});

test('birthday payload parsing rejects malformed or missing-recipient data', () => {
  assert.equal(decodeBirthdayPayload('not-a-valid-payload!'), null);
  assert.equal(decodeBirthdayPayload(encodeBirthdayPayload({ recipientName: '', message: 'Hello' })), null);
});

test('birthday data strips unsafe controls and respects public-link limits', () => {
  const data = normalizeBirthdayData({ recipientName: `A\u0000${'x'.repeat(90)}`, senderName: '', message: '' });
  assert.equal(data.recipientName.length, BIRTHDAY_LIMITS.recipientName);
  assert.equal(data.senderName, 'Vamsi');
  assert.equal(data.message, DEFAULT_BIRTHDAY_MESSAGE);
});

test('birthday links preserve the supported Unicode message size', () => {
  const message = '✨'.repeat(Math.floor(BIRTHDAY_LIMITS.message / 2));
  const decoded = decodeBirthdayPayload(encodeBirthdayPayload({ recipientName: 'Riya', senderName: 'Vamsi', message }));
  assert.equal(decoded?.message, message);
});
