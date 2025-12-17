-- Password Reset Tokens table for OTP-based password recovery
-- OTP is hashed with SHA256 for performance (not stored plain)

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  codigo_hash TEXT NOT NULL,  -- SHA256(secret + OTP)
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for looking up by user (cleanup old tokens)
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_usuario_id 
  ON password_reset_tokens(usuario_id);

-- Index for cleanup of expired tokens
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at 
  ON password_reset_tokens(expires_at);

-- Comment
COMMENT ON TABLE password_reset_tokens IS 'OTP tokens for password recovery. codigo_hash is SHA256(secret + OTP). Expires after 15 min.';
