import { Database } from 'bun:sqlite'
import { randomBytes, randomUUID } from 'crypto'
import {
  CreateNamespaceTokenRequest,
  NamespaceToken,
  NamespaceTokenResponse,
  SCHEMA,
} from './schema'

declare const Bun: {
  password: {
    hash(password: string): Promise<string>
    verify(password: string, hash: string): Promise<boolean>
  }
}

class DatabaseService {
  private static instance: DatabaseService
  private db: Database

  private constructor() {
    this.db = new Database('namespace_tokens.db')
    this.init()
  }

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService()
    }
    return DatabaseService.instance
  }

  private init(): void {
    this.db.exec(SCHEMA)
  }

  public async createNamespaceToken(
    request: CreateNamespaceTokenRequest,
  ): Promise<{
    token: string
    response: NamespaceTokenResponse
  }> {
    // Generate a unique UUID for this token
    const uuid = randomUUID()

    // Generate a random secret key
    const secretKey = randomBytes(32).toString('hex')

    // Create the full token with UUID prefix
    const token = `sk_${request.namespace}_${uuid}_${secretKey}`

    // Hash the token using Bun's password hashing
    const tokenHash = await Bun.password.hash(token)

    const stmt = this.db.prepare(`
      INSERT INTO namespace_tokens (id, token_hash, namespace, description)
      VALUES (?, ?, ?, ?)
    `)

    const result = stmt.run(
      uuid,
      tokenHash,
      request.namespace,
      request.description || null,
    )

    if (!result.changes) {
      throw new Error('Failed to create namespace token')
    }

    // Return both the token and the response info
    return {
      token,
      response: {
        id: uuid,
        namespace: request.namespace,
        description: request.description,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    }
  }

  public async getNamespaceTokenByHash(
    token: string,
  ): Promise<NamespaceToken | null> {
    // Extract UUID from the token
    const parts = token.split('_')
    if (parts.length !== 4) {
      return null // Invalid token format
    }

    const uuid = parts[2] // sk_<namespace>_<uuid>_<secret>

    // Get the token by UUID
    const stmt = this.db.prepare(`
      SELECT * FROM namespace_tokens WHERE id = ?
    `)

    const storedToken = stmt.get(uuid) as NamespaceToken | null

    if (!storedToken) {
      return null
    }

    // Verify the token using Bun's password verification
    const isValid = await Bun.password.verify(token, storedToken.token_hash)

    return isValid ? storedToken : null
  }

  public listNamespaceTokens(): NamespaceTokenResponse[] {
    const stmt = this.db.prepare(`
      SELECT id, namespace, description, created_at, updated_at 
      FROM namespace_tokens 
      ORDER BY created_at DESC
    `)

    return stmt.all() as NamespaceTokenResponse[]
  }

  public deleteNamespaceToken(id: string): boolean {
    const stmt = this.db.prepare(`
      DELETE FROM namespace_tokens WHERE id = ?
    `)

    const result = stmt.run(id)
    return result.changes > 0
  }

  public getNamespaceTokenById(id: string): NamespaceTokenResponse | null {
    const stmt = this.db.prepare(`
      SELECT id, namespace, description, created_at, updated_at 
      FROM namespace_tokens WHERE id = ?
    `)

    return stmt.get(id) as NamespaceTokenResponse | null
  }

  public close(): void {
    this.db.close()
  }
}

export const databaseService = DatabaseService.getInstance()
