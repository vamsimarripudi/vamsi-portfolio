// Festival times are absolute instants. 8 Nov 00:00 to 9 Nov 00:00 Asia/Kolkata.
export const DIWALI_2026_START=Date.parse('2026-11-07T18:30:00.000Z');
export const DIWALI_2026_END=Date.parse('2026-11-08T18:30:00.000Z');
// Load the tiny, inactive enhancement one day before the event so an open tab
// can activate at midnight without a reload. No assets are linked after expiry.
export const DIWALI_2026_PRELOAD=DIWALI_2026_START-86_400_000;

export function inDiwali2026Window(now=Date.now()){
 return Number.isFinite(now)&&now>=DIWALI_2026_START&&now<DIWALI_2026_END;
}
export function shouldPreloadDiwali2026(now=Date.now()){
 return Number.isFinite(now)&&now>=DIWALI_2026_PRELOAD&&now<DIWALI_2026_END;
}
