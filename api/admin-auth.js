// /api/admin-auth — Admin authentication (password + WebAuthn biometric)
//
// GET  (no action)                    → verify token, return admin profile
// GET  ?action=webauthn-auth-options  → get WebAuthn authentication challenge
// POST (no action)                    → password login
// POST ?action=webauthn-register      → register biometric credential (requires auth)
// POST ?action=webauthn-auth          → authenticate with biometric

import bcrypt from 'bcryptjs';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import { signAdminToken, verifyAdmin, getSupabaseAdmin } from './_lib/auth.js';

// RP config — works for any Vercel deploy URL
function getRpConfig(req) {
  const host = req.headers.host || 'localhost';
  const rpID = host.split(':')[0]; // strip port
  const origin = `${req.headers['x-forwarded-proto'] || 'http'}://${host}`;
  return { rpID, rpName: 'UberVan Admin', origin };
}

export default async function handler(req, res) {
  const sb     = getSupabaseAdmin();
  const action = req.query.action;

  // ── GET routes ──────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    // WebAuthn: get authentication challenge (no auth needed — this is the login flow)
    if (action === 'webauthn-auth-options') {
      // Find admin with registered credentials
      const { data: admin } = await sb
        .from('admins')
        .select('id, webauthn_credentials')
        .not('webauthn_credentials', 'is', null)
        .single();

      if (!admin || !admin.webauthn_credentials?.length) {
        return res.status(404).json({ error: 'No biometric credentials registered' });
      }

      const { rpID } = getRpConfig(req);
      const options = await generateAuthenticationOptions({
        rpID,
        allowCredentials: admin.webauthn_credentials.map(c => ({
          id: c.credentialID,
          type: 'public-key',
        })),
        userVerification: 'preferred',
      });

      // Store challenge temporarily
      await sb.from('admins').update({ webauthn_challenge: options.challenge }).eq('id', admin.id);

      return res.json(options);
    }

    // Default GET: verify token
    const admin = await verifyAdmin(req);
    if (!admin) return res.status(401).json({ error: 'Unauthorized' });

    const { data, error } = await sb
      .from('admins')
      .select('id, email, name, webauthn_credentials')
      .eq('id', admin.id)
      .single();

    if (error || !data) return res.status(401).json({ error: 'Admin not found' });
    return res.json({
      admin: { id: data.id, email: data.email, name: data.name },
      hasWebAuthn: !!(data.webauthn_credentials?.length),
    });
  }

  // ── POST routes ─────────────────────────────────────────────────────────────
  if (req.method === 'POST') {

    // WebAuthn: register a new credential (requires existing auth)
    if (action === 'webauthn-register') {
      const phase = req.query.phase;

      // Phase 1: get registration options
      if (phase === 'options') {
        const admin = await verifyAdmin(req);
        if (!admin) return res.status(401).json({ error: 'Unauthorized' });

        const { data: adminData } = await sb.from('admins').select('id, email, name, webauthn_credentials').eq('id', admin.id).single();
        if (!adminData) return res.status(404).json({ error: 'Admin not found' });

        const { rpID, rpName } = getRpConfig(req);
        const existingCreds = adminData.webauthn_credentials || [];

        const options = await generateRegistrationOptions({
          rpName,
          rpID,
          userID: new TextEncoder().encode(adminData.id),
          userName: adminData.email,
          userDisplayName: adminData.name,
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

        await sb.from('admins').update({ webauthn_challenge: options.challenge }).eq('id', admin.id);
        return res.json(options);
      }

      // Phase 2: verify registration response
      if (phase === 'verify') {
        const admin = await verifyAdmin(req);
        if (!admin) return res.status(401).json({ error: 'Unauthorized' });

        const { data: adminData } = await sb.from('admins').select('id, webauthn_credentials, webauthn_challenge').eq('id', admin.id).single();
        if (!adminData || !adminData.webauthn_challenge) return res.status(400).json({ error: 'No pending challenge' });

        const { rpID, origin } = getRpConfig(req);

        try {
          const verification = await verifyRegistrationResponse({
            response: req.body,
            expectedChallenge: adminData.webauthn_challenge,
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

          const existing = adminData.webauthn_credentials || [];
          existing.push(newCred);

          await sb.from('admins').update({
            webauthn_credentials: existing,
            webauthn_challenge: null,
          }).eq('id', admin.id);

          return res.json({ success: true });
        } catch (err) {
          return res.status(400).json({ error: err.message });
        }
      }

      return res.status(400).json({ error: 'Missing phase parameter (options or verify)' });
    }

    // WebAuthn: authenticate with biometric
    if (action === 'webauthn-auth') {
      const { data: admin } = await sb
        .from('admins')
        .select('id, email, name, webauthn_credentials, webauthn_challenge')
        .not('webauthn_credentials', 'is', null)
        .single();

      if (!admin || !admin.webauthn_challenge) {
        return res.status(400).json({ error: 'No pending challenge' });
      }

      const { rpID, origin } = getRpConfig(req);
      const matchedCred = admin.webauthn_credentials.find(c => c.credentialID === req.body.id);
      if (!matchedCred) return res.status(400).json({ error: 'Unknown credential' });

      try {
        const verification = await verifyAuthenticationResponse({
          response: req.body,
          expectedChallenge: admin.webauthn_challenge,
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
        await sb.from('admins').update({
          webauthn_credentials: admin.webauthn_credentials,
          webauthn_challenge: null,
        }).eq('id', admin.id);

        const token = signAdminToken(admin.id);
        return res.json({ token, admin: { id: admin.id, email: admin.email, name: admin.name } });
      } catch (err) {
        return res.status(400).json({ error: err.message });
      }
    }

    // Default POST: password login
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const { data: admin, error } = await sb
      .from('admins')
      .select('id, email, name, password_hash')
      .eq('email', email.toLowerCase().trim())
      .single();

    if (error || !admin) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, admin.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = signAdminToken(admin.id);
    return res.json({ token, admin: { id: admin.id, email: admin.email, name: admin.name } });
  }

  res.status(405).json({ error: 'Method not allowed' });
}
