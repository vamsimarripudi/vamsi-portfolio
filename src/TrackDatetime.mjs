/** Convert a user's datetime-local wall clock to UTC before sending it to Vercel.
 * The server's timezone must never silently shift the requested follow-up. */
export function normalizeFollowUpAt(value) {
  if(typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}
