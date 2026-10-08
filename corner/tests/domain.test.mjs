import test from 'node:test';
import assert from 'node:assert/strict';
import { nextYearly, zoneLocalToUtc, statuses, parseTags, slugify, decodeCursor, encodeCursor } from '../src/domain.mjs';
import { passwordHash, passwordVerify } from '../src/auth.mjs';

test('passwords are salted and verified with a resistant KDF',()=>{
 const a=passwordHash('SuperStrong%TestPassword2026'),b=passwordHash('SuperStrong%TestPassword2026');
 assert.notEqual(a,b);assert.equal(passwordVerify('SuperStrong%TestPassword2026',a),true);
 assert.equal(passwordVerify('IncorrectTestPassword',a),false);
 assert.throws(()=>passwordHash('too-short'));
});
test('IANA zones preserve intended local publication time',()=>{
 assert.equal(zoneLocalToUtc('2026-10-08T09:00','Asia/Kolkata'),'2026-10-08T03:30:00.000Z');
 assert.equal(zoneLocalToUtc('2026-03-08T02:30','America/New_York'),'2026-03-08T07:00:00.000Z');
 assert.equal(zoneLocalToUtc('2026-11-01T01:30','America/New_York'),'2026-11-01T05:30:00.000Z');
 assert.throws(()=>zoneLocalToUtc('2026-13-08T00:00','Asia/Kolkata'));
 assert.throws(()=>zoneLocalToUtc('2026-10-08T09:00','Moon/Galaxy'));
});
test('annual wish computes a future occurrence with leap-day handling',()=>{
 const future=nextYearly(2,29,'09:00','Asia/Kolkata','2027-01-01T00:00:00.000Z');
 assert.equal(future,'2028-02-29T03:30:00.000Z');
});
test('labels, tags, and cursors use constrained values',()=>{
 assert.deepEqual(parseTags(['build','build','release']),['build','release']);
 assert.equal(slugify('New ✨ Thought!'),'new-thought');
 let encoded=encodeCursor({published_at:'2026-01-01T00:00:00Z',id:'post-id'});
 assert.deepEqual(decodeCursor(encoded),['2026-01-01T00:00:00Z','post-id']);
 assert.equal(decodeCursor('garbage'),null);
 assert.deepEqual(statuses({featured:true,pinned:true}),['FEATURED']);
});
