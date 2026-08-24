const RECIPIENT = 'enquiry.portfolio@vamsimarripudi.tech';
const MAX_REQUESTS = 3;
const WINDOW_MS = 15 * 60 * 1000;
const attempts = new Map();

const escapeHtml = (value) => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const clean = (value, max) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const takeRateLimitSlot = (key) => {
  const now = Date.now();
  const recent = (attempts.get(key) || []).filter((time) => now - time < WINDOW_MS);
  if (recent.length >= MAX_REQUESTS) return false;
  recent.push(now);
  attempts.set(key, recent);
  return true;
};

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, message: 'Method not allowed.' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const name = clean(body.name, 100);
  const email = clean(body.email, 254);
  const reason = clean(body.reason, 100);
  const message = clean(body.message, 2000);
  const company = clean(body.company, 200);

  // Quietly accept bot submissions; no email is sent and no signal is revealed.
  if (company) return res.status(200).json({ ok: true });

  if (!name || !isEmail(email) || !reason || message.length < 12) {
    return res.status(400).json({ ok: false, message: 'Please check the highlighted fields and try again.' });
  }

  const forwarded = req.headers['x-forwarded-for'];
  const clientKey = Array.isArray(forwarded) ? forwarded[0] : (forwarded || req.socket?.remoteAddress || 'unknown');
  if (!takeRateLimitSlot(clientKey)) {
    return res.status(429).json({ ok: false, message: 'Please wait a few minutes before sending another message.' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.CONTACT_FROM_EMAIL;
  if (!apiKey || !from) {
    console.error('Contact email is not configured.');
    return res.status(503).json({ ok: false, message: 'Message delivery is temporarily unavailable. Please email enquiry.portfolio@vamsimarripudi.tech directly.' });
  }

  const subject = `[Portfolio] ${reason} — ${name}`;
  const text = `Name: ${name}\nEmail: ${email}\nReason: ${reason}\n\n${message}`;
  const html = `<h1>New portfolio enquiry</h1><p><strong>Name:</strong> ${escapeHtml(name)}</p><p><strong>Email:</strong> ${escapeHtml(email)}</p><p><strong>Reason:</strong> ${escapeHtml(reason)}</p><hr><p style="white-space:pre-wrap">${escapeHtml(message)}</p>`;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [RECIPIENT],
        reply_to: email,
        subject,
        text,
        html,
      }),
    });

    if (!response.ok) {
      console.error('Contact email provider rejected the request.', response.status);
      return res.status(502).json({ ok: false, message: 'Message delivery is temporarily unavailable. Please email enquiry.portfolio@vamsimarripudi.tech directly.' });
    }

    return res.status(200).json({ ok: true, message: 'Your message has been sent. Vamsi will reply to the email address you provided.' });
  } catch (error) {
    console.error('Contact email provider request failed.', error instanceof Error ? error.name : 'unknown');
    return res.status(502).json({ ok: false, message: 'Message delivery is temporarily unavailable. Please email enquiry.portfolio@vamsimarripudi.tech directly.' });
  }
}
