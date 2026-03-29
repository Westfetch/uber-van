// api/driver-auth.js
// POST (no action)                         — Driver first login (setup code → JWT)
// GET  (no action)                         — Verify token, return driver + hasWebauthn
// GET  ?action=webauthn-auth-options&name=X — Get biometric auth challenge (no auth)
// POST ?action=webauthn-register&phase=options — Get registration options (requires auth)
// POST ?action=webauthn-register&phase=verify  — Verify + store credential (requires auth)
// POST ?action=webauthn-auth               — Authenticate with biometric (no auth)

import crypto from 'crypto';
import { getSupabaseAdmin, signDriverToken, verifyDriver } from './_lib/auth.js';
import cors from './_lib/cors.js';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';

const SAFE_COLS = 'id, name, phone, depot_postcode, van_size, online, push_subscription, approval_status';

function hashCode(code) {
  return crypto.createHash('sha256').update(code.trim().toUpperCase()).digest('hex');
}

function getRpConfig(req) {
  const host = req.headers.host || 'localhost';
  const rpID = host.split(':')[0];
  const origin = `${req.headers['x-forwarded-proto'] || 'http'}://${host}`;
  return { rpID, rpName: 'VanHQ Driver', origin };
}

export default async function handler(req, res) {
  if (cors(req, res)) return;

  const sb     = getSupabaseAdmin();
  const action = req.query.action;

  // ── GET routes ──────────────────────────────────────────────────────────────
  if (req.method === 'GET') {

    // WebAuthn: get authentication challenge (no auth — this is the login flow)
    if (action === 'webauthn-auth-options') {
      const name = req.query.name;
      if (!name) return res.status(400).json({ error: 'name is required' });

      const { data: driver } = await sb
        .from('drivers')
        .select('id, webauthn_credentials, approval_status')
        .ilike('name', name.trim())
        .maybeSingle();

      if (!driver || !driver.webauthn_credentials?.length) {
        return res.status(404).json({ error: 'No biometric credentials registered' });
      }
      if (driver.approval_status === 'suspended') {
        return res.status(403).json({ error: 'Your account has been suspended' });
      }

      const { rpID } = getRpConfig(req);
      const options = await generateAuthenticationOptions({
        rpID,
        allowCredentials: driver.webauthn_credentials.map(c => ({
          id: c.credentialID,
          type: 'public-key',
        })),
        userVerification: 'preferred',
      });

      await sb.from('drivers').update({ webauthn_challenge: options.challenge }).eq('id', driver.id);
      return res.json({ ...options, driverId: driver.id });
    }

    // Default GET: verify token
    const caller = await verifyDriver(req);
    if (!caller) return res.status(401).json({ error: 'Unauthorized' });

    const { data: driver, error } = await sb
      .from('drivers')
      .select(`${SAFE_COLS}, webauthn_credentials`)
      .eq('id', caller.id)
      .maybeSingle();

    if (error || !driver) return res.status(404).json({ error: 'Driver not found' });
    if (driver.approval_status === 'suspended')
      return res.status(403).json({ error: 'Your account has been suspended' });

    const hasWebauthn = !!(driver.webauthn_credentials?.length);
    const { webauthn_credentials, ...safeDriver } = driver;
    return res.json({ driver: safeDriver, hasWebauthn });
  }

  // ── POST routes ─────────────────────────────────────────────────────────────
  if (req.method === 'POST') {

    // WebAuthn: register a new credential (requires existing auth)
    if (action === 'webauthn-register') {
      const phase = req.query.phase;

      // Phase 1: get registration options
      if (phase === 'options') {
        const caller = await verifyDriver(req);
        if (!caller) return res.status(401).json({ error: 'Unauthorized' });

        const { data: driver } = await sb
          .from('drivers')
          .select('id, name, webauthn_credentials')
          .eq('id', caller.id)
          .single();
        if (!driver) return res.status(404).json({ error: 'Driver not found' });

        const { rpID, rpName } = getRpConfig(req);
        const existingCreds = driver.webauthn_credentials || [];

        const options = await generateRegistrationOptions({
          rpName,
          rpID,
          userID: new TextEncoder().encode(driver.id),
          userName: driver.name,
          userDisplayName: driver.name,
          attestationType: 'none',
          excludeCredentials: existingCreds.map(c => ({
            id: c.credentialID,
            type: 'public-key',
          })),
          authenticatorSelection: {
            residentKey: 'preferred',
            userVerification: 'preferred',
          },
        });

        await sb.from('drivers').update({ webauthn_challenge: options.challenge }).eq('id', driver.id);
        return res.json(options);
      }

      // Phase 2: verify registration response
      if (phase === 'verify') {
        const caller = await verifyDriver(req);
        if (!caller) return res.status(401).json({ error: 'Unauthorized' });

        const { data: driver } = await sb
          .from('drivers')
          .select('id, webauthn_credentials, webauthn_challenge')
          .eq('id', caller.id)
          .single();
        if (!driver || !driver.webauthn_challenge) return res.status(400).json({ error: 'No pending challenge' });

        const { rpID, origin } = getRpConfig(req);

        try {
          const verification = await verifyRegistrationResponse({
            response: req.body,
            expectedChallenge: driver.webauthn_challenge,
            expectedOrigin: origin,
            expectedRPID: rpID,
          });

          if (!verification.verified || !verification.registrationInfo) {
            return res.status(400).json({ error: 'Verification failed' });
          }

          const { credential } = verification.registrationInfo;
          const newCred = {
            credentialID: credential.id,
            publicKey: Buffer.from(credential.publicKey).toString('base64'),
            counter: credential.counter,
            createdAt: new Date().toISOString(),
          };

          const existing = driver.webauthn_credentials || [];
          existing.push(newCred);

          await sb.from('drivers').update({
            webauthn_credentials: existing,
            webauthn_challenge: null,
          }).eq('id', driver.id);

          return res.json({ success: true });
        } catch (err) {
          return res.status(400).json({ error: err.message });
        }
      }

      return res.status(400).json({ error: 'Missing phase parameter (options or verify)' });
    }

    // WebAuthn: authenticate with biometric
    if (action === 'webauthn-auth') {
      const driverId = req.body.driverId;
      if (!driverId) return res.status(400).json({ error: 'driverId required' });

      const { data: driver } = await sb
        .from('drivers')
        .select(`${SAFE_COLS}, webauthn_credentials, webauthn_challenge`)
        .eq('id', driverId)
        .maybeSingle();

      if (!driver || !driver.webauthn_challenge) {
        return res.status(400).json({ error: 'No pending challenge' });
      }
      if (driver.approval_status === 'suspended') {
        return res.status(403).json({ error: 'Your account has been suspended' });
      }
      if (driver.approval_status !== 'approved') {
        return res.status(403).json({ error: 'Your account is pending approval' });
      }

      const matchedCred = driver.webauthn_credentials.find(c => c.credentialID === req.body.id);
      if (!matchedCred) return res.status(400).json({ error: 'Unknown credential' });

      const { rpID, origin } = getRpConfig(req);

      try {
        const verification = await verifyAuthenticationResponse({
          response: req.body,
          expectedChallenge: driver.webauthn_challenge,
          expectedOrigin: origin,
          expectedRPID: rpID,
          credential: {
            id: matchedCred.credentialID,
            publicKey: new Uint8Array(Buffer.from(matchedCred.publicKey, 'base64')),
            counter: matchedCred.counter,
          },
        });

        if (!verification.verified) {
          return res.status(401).json({ error: 'Verification failed' });
        }

        // Update counter
        matchedCred.counter = verification.authenticationInfo.newCounter;
        await sb.from('drivers').update({
          webauthn_credentials: driver.webauthn_credentials,
          webauthn_challenge: null,
        }).eq('id', driver.id);

        const token = signDriverToken(driver.id);
        const { webauthn_credentials, webauthn_challenge, setup_code_hash, setup_code_expires_at, ...safeDriver } = driver;
        return res.json({ token, driver: safeDriver });
      } catch (err) {
        return res.status(400).json({ error: err.message });
      }
    }

    // Default POST: login with setup code
    const { name, setupCode } = req.body || {};
    if (!name || !setupCode)
      return res.status(400).json({ error: 'name and setupCode required' });

    const incomingHash = hashCode(setupCode);

    const { data: driver, error } = await sb
      .from('drivers')
      .select(`${SAFE_COLS}, setup_code_hash, setup_code_expires_at`)
      .ilike('name', name.trim())
      .maybeSingle();

    // Always run comparison to prevent timing-based enumeration
    const dummy = Buffer.from('0'.repeat(64), 'hex');
    if (error || !driver || !driver.setup_code_hash) {
      crypto.timingSafeEqual(Buffer.from(incomingHash, 'hex'), dummy);
      return res.status(401).json({ error: 'Invalid name or setup code' });
    }

    if (new Date(driver.setup_code_expires_at) < new Date()) {
      return res.status(401).json({ error: 'Setup code expired — ask the platform for a new one' });
    }

    const stored = Buffer.from(driver.setup_code_hash, 'hex');
    const given  = Buffer.from(incomingHash, 'hex');
    const match  = stored.length === given.length && crypto.timingSafeEqual(stored, given);

    if (!match) return res.status(401).json({ error: 'Invalid name or setup code' });

    // Block unapproved / suspended drivers
    if (driver.approval_status === 'suspended')
      return res.status(403).json({ error: 'Your account has been suspended — contact the platform' });
    if (driver.approval_status !== 'approved')
      return res.status(403).json({ error: 'Your account is pending approval — we\'ll be in touch soon' });

    // Clear setup code — single use
    await sb
      .from('drivers')
      .update({ setup_code_hash: null, setup_code_expires_at: null })
      .eq('id', driver.id);

    const token = signDriverToken(driver.id);
    const { setup_code_hash, setup_code_expires_at, ...safeDriver } = driver;

    res.json({ token, driver: safeDriver });
  }

  if (req.method !== 'POST') return res.status(405).end();
}
