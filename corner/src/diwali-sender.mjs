/**
 * Pure, storage-free Diwali greeting personalization.
 * Public names are URL parameters, not database records or user accounts.
 */
const ORIGINAL_SENDER = "Siva Palavalasa";
const ORIGINAL_URL = "https://vamsimarripudi.me/corner/diwali/siva";
const CUSTOM_URL = "https://vamsimarripudi.me/corner/diwali";
const ORIGINAL_PREVIEW = ORIGINAL_URL + "/preview.png";
const GENERIC_PREVIEW = CUSTOM_URL + "/preview.png";

export function normalizeDiwaliSender(raw) {
  if (typeof raw !== "string") return null;
  if (/[\u0000-\u001F\u007F]/u.test(raw)) return null;
  const name = raw.normalize("NFC").trim().replace(/\s+/gu, " ");
  const size = [...name].length;
  if (size < 2 || size > 48) return null;
  // Unicode letters and combining marks support Indian and other writing systems.
  // No HTML/JS control punctuation, markup, quotes, backticks, or line breaks.
  if (!/^[\p{L}\p{M}\p{N} .'-]+$/u.test(name) || !/\p{L}/u.test(name)) return null;
  return name;
}

export function diwaliShareUrl(sender) {
  const name = normalizeDiwaliSender(sender);
  if (!name) return null;
  return CUSTOM_URL + "?from=" + encodeURIComponent(name);
}

export function personalizeDiwaliHtml(template, sender) {
  const name = normalizeDiwaliSender(sender);
  if (!name) return null;
  if (typeof template !== "string" || !template.includes(ORIGINAL_SENDER)) {
    throw new Error("Diwali greeting template is missing the sender marker");
  }
  const shareUrl = diwaliShareUrl(name);
  // Name validation above means substitution is safe in double-quoted markup
  // attributes and existing double-quoted JS string constants.
  return template
    .replaceAll(ORIGINAL_PREVIEW, GENERIC_PREVIEW)
    .replaceAll(ORIGINAL_URL, shareUrl)
    .replaceAll(ORIGINAL_SENDER, name)
    .replace("</head>", '<meta name="robots" content="noindex, noarchive"></head>');
}
