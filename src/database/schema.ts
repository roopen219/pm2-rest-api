export const SCHEMA = `
  CREATE TABLE IF NOT EXISTS namespace_tokens (
    id TEXT PRIMARY KEY,
    token_hash TEXT NOT NULL,
    namespace TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_namespace_tokens_namespace ON namespace_tokens(namespace);
  CREATE INDEX IF NOT EXISTS idx_namespace_tokens_token_hash ON namespace_tokens(token_hash);
`

export interface NamespaceToken {
  id: string
  token_hash: string
  namespace: string
  description?: string
  created_at: string
  updated_at: string
}

export interface CreateNamespaceTokenRequest {
  namespace: string
  description?: string
}

export interface NamespaceTokenResponse {
  id: string
  namespace: string
  description?: string
  created_at: string
  updated_at: string
}
