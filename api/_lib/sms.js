// api/_lib/sms.js
// SMS via textbee.dev — uses your Android phone as an SMS gateway.
// Free, uses your unlimited texts plan. Phone must be on and connected.
// Env vars: TEXTBEE_API_KEY, TEXTBEE_DEVICE_ID

export async function sendSMS({ to, body }) {
  const apiKey   = process.env.TEXTBEE_API_KEY;
  const deviceId = process.env.TEXTBEE_DEVICE_ID;

  if (!apiKey || !deviceId) {
    console.log(`[sms] No textbee credentials: to=${to} body=${body.slice(0, 50)}...`);
    return;
  }

  const formatted = formatUKPhone(to);
  if (!formatted) {
    console.error(`[sms] Invalid phone number: ${to}`);
    return;
  }

  const url = `https://api.textbee.dev/api/v1/gateway/devices/${deviceId}/send-sms`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ recipients: [formatted], message: body }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('[sms] textbee error:', err);
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
