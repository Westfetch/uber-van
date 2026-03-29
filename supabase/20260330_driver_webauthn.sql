-- Add WebAuthn biometric columns to drivers table
ALTER TABLE drivers
  ADD COLUMN IF NOT EXISTS webauthn_credentials jsonb,
  ADD COLUMN IF NOT EXISTS webauthn_challenge text;
