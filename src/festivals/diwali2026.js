// Absolute instants for 8 Nov 2026 00:00 IST to 9 Nov 2026 00:00 IST.
// All users see the same worldwide window, regardless of device timezone.
export const DIWALI_2026_START = Date.parse('2026-11-07T18:30:00.000Z');
export const DIWALI_2026_END = Date.parse('2026-11-08T18:30:00.000Z');

export function isDiwali2026Active(now = Date.now()) {
  return Number.isFinite(now) && now >= DIWALI_2026_START && now < DIWALI_2026_END;
}

// Null after expiry. Used to arm boundary timers for tabs left open overnight.
export function nextDiwali2026Boundary(now = Date.now()) {
  if (!Number.isFinite(now) || now >= DIWALI_2026_END) return null;
  return now < DIWALI_2026_START ? DIWALI_2026_START : DIWALI_2026_END;
}
