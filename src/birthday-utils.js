export const DEFAULT_BIRTHDAY_MESSAGE = `May this birthday bring you happiness that stays, memories that make you smile, and countless reasons to look forward to everything ahead. May the dreams you’ve been quietly wishing for find their way to you, and may this new year of your life be filled with beautiful moments, genuine people, exciting adventures, and unexpected blessings.

Keep smiling, keep dreaming, and keep being the wonderful person you are.

Happy Birthday! 🎂✨`;

export const BIRTHDAY_LIMITS = Object.freeze({ recipientName: 60, senderName: 60, message: 3000, payload: 16000 });

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

const toBase64Url = (text) => {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

const fromBase64Url = (value) => {
  if (!/^[A-Za-z0-9_-]{1,17000}$/.test(value)) return null;
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
