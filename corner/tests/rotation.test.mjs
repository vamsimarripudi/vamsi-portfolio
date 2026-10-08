import test from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../src/store.mjs';
import { passwordHash, passwordVerify } from '../src/auth.mjs';

test('owner password rotation updates durable credentials and revokes sessions', () => {
  const store = new Store(':memory:');
  try {
    const first = passwordHash('initial-SyntheticLongPassword#1');
    const next = passwordHash('rotated-SyntheticLongPassword#2');
    assert.equal(store.bootstrap('connect@vamsimarripudi.me', first), true);
    const owner = store.findOwner('connect@vamsimarripudi.me');
    assert.ok(owner);
    store.createSession(owner, 'synthetic-session-token');
    assert.ok(store.session('synthetic-session-token'));

    assert.equal(store.bootstrap('connect@vamsimarripudi.me', next), false);
    const current = store.findOwner('connect@vamsimarripudi.me');
    assert.ok(passwordVerify('rotated-SyntheticLongPassword#2', current.password_hash));
    assert.equal(passwordVerify('initial-SyntheticLongPassword#1', current.password_hash), false);
    assert.equal(store.session('synthetic-session-token'), null, 'existing session revoked');
    assert.equal(store.one("SELECT count(*) AS count FROM audit_events WHERE action='owner.password_rotated'").count, 1);
    assert.equal(store.bootstrap('connect@vamsimarripudi.me', next), false);
    assert.equal(store.one("SELECT count(*) AS count FROM audit_events WHERE action='owner.password_rotated'").count, 1, 'idempotent');
    assert.throws(() => store.bootstrap('unrelated@example.com', next), /does not match/, 'no silent owner reassignment');
  } finally { store.close(); }
});
