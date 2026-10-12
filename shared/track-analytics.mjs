/** Calendar dates are inclusive. Never use the browser's UTC offset for a report. */
export const RANGE_PRESETS = [
  ['today', 'Today'], ['yesterday', 'Yesterday'], ['7d', 'Last 7 days'],
  ['28d', 'Last 28 days'], ['90d', 'Last 90 days'], ['month', 'This month'],
  ['lastMonth', 'Last month'], ['custom', 'Custom dates'],
];
export const REPORT_TIME_ZONE = 'Asia/Kolkata';
const DAY = 86400000;
export class RangeError extends Error {
  constructor(message) { super(message); this.status = 400; this.code = 'INVALID_RANGE'; }
}
export function calendarToday(now = new Date(), timeZone = REPORT_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const get = type => parts.find(part => part.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export function validDate(value) {
  if (typeof value !== 'string' || !/^20\d{2}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function shiftDate(value, days) {
  return new Date(new Date(`${value}T00:00:00Z`).getTime() + days * DAY).toISOString().slice(0, 10);
}
export function datesBetween(start, end) {
  const dates = [];
  for (let date = start; date <= end && dates.length < 366; date = shiftDate(date, 1)) dates.push(date);
  return dates;
}
function priorYear(value) {
  const [year, month, day] = value.split('-').map(Number);
  const max = new Date(Date.UTC(year - 1, month, 0)).getUTCDate();
  return `${year - 1}-${String(month).padStart(2, '0')}-${String(Math.min(day, max)).padStart(2, '0')}`;
}
export function resolveRange(input = {}, now = new Date(), timeZone = REPORT_TIME_ZONE) {
  const preset = input.range || '28d';
  const compare = input.compare || 'previous';
  if (!RANGE_PRESETS.some(([id]) => id === preset)) throw new RangeError('Choose a supported date range.');
  if (!['none', 'previous', 'year'].includes(compare)) throw new RangeError('Choose a supported comparison.');
  const today = calendarToday(now, timeZone), yesterday = shiftDate(today, -1);
  let start, end;
  if (preset === 'custom') { start = input.start; end = input.end; }
  else if (preset === 'today' || preset === 'yesterday') { start = end = preset === 'today' ? today : yesterday; }
  else if (preset === 'month') { start = `${today.slice(0, 7)}-01`; end = today; }
  else if (preset === 'lastMonth') { end = shiftDate(`${today.slice(0, 7)}-01`, -1); start = `${end.slice(0, 7)}-01`; }
  else { end = yesterday; start = shiftDate(end, 1 - Number.parseInt(preset, 10)); }
  if (!validDate(start) || !validDate(end)) throw new RangeError('Enter valid start and end dates (YYYY-MM-DD).');
  if (start > end) throw new RangeError('The start date must be on or before the end date.');
  if (end > today) throw new RangeError('The end date cannot be in the future.');
  const days = Math.round((Date.parse(end) - Date.parse(start)) / DAY) + 1;
  if (days > 366) throw new RangeError('Choose a date range of 366 days or fewer.');
  const previous = compare === 'none' ? null : compare === 'year'
    ? { start: priorYear(start), end: priorYear(end) }
    : { start: shiftDate(start, -days), end: shiftDate(start, -1) };
  return { preset, start, end, days, compare, previous, timeZone, partial: end === today };
}
export function changeFor(current, previous, format = 'number') {
  if (previous === null || previous === undefined) return null;
  if (format === 'percent') return { value: (current - previous) * 100, unit: 'pp' };
  if (previous === 0) return { value: current === 0 ? 0 : null, unit: current === 0 ? '%' : 'new' };
  return { value: (current - previous) / previous * 100, unit: '%' };
}
export function csvCell(value) {
  let text = String(value ?? '');
  // Quote separators and neutralize spreadsheet formulas, including leading controls.
  if (/^[\s\u0000-\u001f]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
export function analyticsCsv(report) {
  const rows = [
    ['Source', report.source], ['Time zone', report.range.timeZone],
    ['Start (inclusive)', report.range.start], ['End (inclusive)', report.range.end],
    ['Comparison start', report.range.previous?.start || 'None'], ['Comparison end', report.range.previous?.end || 'None'],
    ['Generated at', report.generatedAt], [], ['Metric', 'Current', 'Comparison', 'Unit'],
    ...report.metrics.map(metric => [metric.label, metric.value, metric.previous ?? '', metric.format]),
    [], ['Date', report.trend.label, 'Comparison date', 'Comparison value'],
    ...report.trend.points.map(point => [point.date, point.value, point.previousDate || '', point.previous ?? '']),
  ];
  for (const table of report.breakdowns) rows.push([], [table.title, table.metric], ...table.rows.map(row => [row.label, row.value]));
  return '\ufeff' + rows.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
