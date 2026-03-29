// api/_lib/sms.js
// Twilio SMS utility — raw fetch, no SDK dependency.
// Env vars: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER

const ACCOUNT_SID  = () => process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN   = () => process.env.TWILIO_AUTH_TOKEN;
const FROM_NUMBER  = () => process.env.TWILIO_PHONE_NUMBER;

export async function sendSMS({ to, body }) {
  const sid   = ACCOUNT_SID();
  const token = AUTH_TOKEN();
  const from  = FROM_NUMBER();

  if (!sid || !token || !from) {
    console.log(`[sms] No Twilio credentials: to=${to} body=${body.slice(0, 50)}...`);
    return;
  }

  // Twilio expects E.164 format — ensure UK numbers have +44
  const formatted = formatUKPhone(to);
  if (!formatted) {
    console.error(`[sms] Invalid phone number: ${to}`);
    return;
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const auth = Buffer.from(`${sid}:${token}`).toString('base64');

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: formatted, From: from, Body: body }).toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('[sms] Twilio error:', err);
  }
}

// Convert UK phone numbers to E.164
function formatUKPhone(phone) {
  if (!phone) return null;
  let cleaned = phone.replace(/[\s\-\(\)]/g, '');

  // Already E.164
  if (/^\+\d{10,15}$/.test(cleaned)) return cleaned;

  // UK mobile starting with 07
  if (/^07\d{9}$/.test(cleaned)) return `+44${cleaned.slice(1)}`;

  // UK with country code but no +
  if (/^447\d{9}$/.test(cleaned)) return `+${cleaned}`;

  return null;
}
