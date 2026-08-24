import test from 'node:test';
import assert from 'node:assert/strict';
import { TRACK_OWNER_EMAIL, availableTransitions, canTransition, cleanHeader, emailIsValid } from '../api/lib/track.js';

test('the private tracker has one fixed authorized owner', () => {
  assert.equal(TRACK_OWNER_EMAIL, 'enquiry.portfolio@vamsimarripudi.tech');
});

test('workflow transitions prevent invalid state jumps', () => {
  assert.equal(canTransition('NEW', 'ACKNOWLEDGED'), true);
  assert.equal(canTransition('NEW', 'COMPLETED'), false);
  assert.equal(canTransition('ERASED', 'REVIEWING'), false);
  assert.deepEqual(availableTransitions('ERASED'), []);
});

test('email and header normalization reject unsafe input', () => {
  assert.equal(emailIsValid('person@example.com'), true);
  assert.equal(emailIsValid('person@example.com\nBcc: attacker@example.com'), false);
  assert.equal(cleanHeader('Hello\r\nWorld'), 'Hello World');
});
