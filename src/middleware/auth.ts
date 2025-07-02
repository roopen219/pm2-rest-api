import { timingSafeEqual } from 'crypto'
import { Context, Next } from 'hono'
import { databaseService } from '../database/database'

declare const process: {
  env: {
    API_TOKEN?: string
  }
}

declare const Buffer: {
  from(input: string, encoding?: string): Uint8Array
}

declare module 'hono' {
  interface ContextVariableMap {
    namespace?: string
    isRootToken: boolean
  }
}

export interface AuthContext {
  namespace?: string
  isRootToken: boolean
}

// Helper function to safely compare tokens
function safeTokenCompare(token1: string, token2: string): boolean {
  try {
    // Convert strings to buffers for timing-safe comparison
    const buf1 = Buffer.from(token1, 'utf8')
    const buf2 = Buffer.from(token2, 'utf8')

    // Ensure both buffers are the same length to prevent timing attacks
    if (buf1.length !== buf2.length) {
      return false
    }

    return timingSafeEqual(buf1, buf2)
  } catch {
    return false
  }
}

export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Authorization header required' }, 401)
  }

  const token = authHeader.substring(7) // Remove 'Bearer ' prefix
  const rootToken = process.env.API_TOKEN

  if (!rootToken) {
    return c.json({ error: 'Root API token not configured' }, 500)
  }

  // Check if it's the root token using timing-safe comparison
  if (safeTokenCompare(token, rootToken)) {
    c.set('isRootToken', true)
    c.set('namespace', undefined)
    return next()
  }

  // Check if it's a namespace token using Bun's password verification
  const namespaceToken = await databaseService.getNamespaceTokenByHash(token)

  if (!namespaceToken) {
    return c.json({ error: 'Invalid API token' }, 401)
  }

  c.set('isRootToken', false)
  c.set('namespace', namespaceToken.namespace)

  return next()
}

export async function requireRootToken(c: Context, next: Next) {
  const isRootToken = c.get('isRootToken')

  if (!isRootToken) {
    return c.json({ error: 'Root API token required for this operation' }, 403)
  }

  return next()
}
