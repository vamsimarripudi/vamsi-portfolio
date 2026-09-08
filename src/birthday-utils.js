export const BIRTHDAY_MESSAGE_TEMPLATES = Object.freeze([
  `I hope today feels as warm, bright, and unforgettable as the happiness you bring to the people around you.

May this new year open doors to the moments you have been quietly hoping for, the people who feel like home, and the adventures that make you feel fully alive.

Keep smiling, keep growing, and keep being exactly the wonderful person you are.`,
  `Some people make ordinary days feel lighter just by being themselves. Today is for celebrating that rare kind of brightness in you.

May the year ahead bring calm wins, beautiful surprises, and more reasons to be proud of the life you are creating.

Here is to memories worth keeping and dreams worth chasing — one lovely year at a time.`,
  `A birthday is a small pause to remember how far you have come and how much possibility still waits ahead.

I hope the next chapter gives you honest joy, meaningful people, brave new beginnings, and the kind of peace that stays.

May every good thing find its way to you at exactly the right time.`,
]);

export const DEFAULT_BIRTHDAY_MESSAGE = BIRTHDAY_MESSAGE_TEMPLATES[0];
export const BIRTHDAY_LIMITS = Object.freeze({ recipientName: 60, senderName: 60, message: 520, payload: 3900 });

const stripControls = (value) => Array.from(value, (character) => {
  const code = character.charCodeAt(0);
  return code === 10 || code === 13 ? character : (code === 127 || code < 32 ? ' ' : character);
}).join('');

const clean = (value, limit) => typeof value === 'string'
  ? stripControls(value).replace(/\s+/g, ' ').trim().slice(0, limit)
  : '';

export const normalizeBirthdayData = (value = {}) => {
  const recipientName = clean(value.recipientName, BIRTHDAY_LIMITS.recipientName);
  const senderName = clean(value.senderName, BIRTHDAY_LIMITS.senderName) || 'Vamsi';
  const message = typeof value.message === 'string'
    ? stripControls(value.message).trim().slice(0, BIRTHDAY_LIMITS.message)
    : DEFAULT_BIRTHDAY_MESSAGE;

  return { recipientName, senderName, message: message || DEFAULT_BIRTHDAY_MESSAGE };
};

export const randomBirthdayMessage = () => BIRTHDAY_MESSAGE_TEMPLATES[Math.floor(Math.random() * BIRTHDAY_MESSAGE_TEMPLATES.length)];

const toBase64Url = (text) => {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

const fromBase64Url = (value) => {
  if (!/^[A-Za-z0-9_-]{1,4100}$/.test(value)) return null;
  try {
    const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch { return null; }
};

export const encodeBirthdayPayload = (value) => toBase64Url(JSON.stringify(normalizeBirthdayData(value)));

export const decodeBirthdayPayload = (value) => {
  if (typeof value !== 'string' || value.length > BIRTHDAY_LIMITS.payload) return null;
  const decoded = fromBase64Url(value);
  if (!decoded || decoded.length > BIRTHDAY_LIMITS.payload) return null;
  try {
    const data = normalizeBirthdayData(JSON.parse(decoded));
    return data.recipientName ? data : null;
  } catch { return null; }
};

export const birthdayShareUrl = (value) => `${window.location.origin}/birthday?b=${encodeURIComponent(encodeBirthdayPayload(value))}`;
export const birthdayShortShareUrl = (id) => `${window.location.origin}/birthday/${encodeURIComponent(id)}`;
export const birthdayShareIdIsValid = (value) => /^[A-Za-z0-9_-]{8,16}$/.test(String(value || ''));
