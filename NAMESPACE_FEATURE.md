# PM2 Namespace Feature

This document describes the new namespace feature that allows you to create isolated API tokens for different tenants or environments.

## Overview

The namespace feature allows you to:
- Create API tokens for specific namespaces
- Isolate PM2 processes by namespace
- Use the same PM2 REST API for multiple tenants
- Automatically prefix process names with namespace

## Authentication

### Root Token
The root API token (set via `API_TOKEN` environment variable) has access to:
- All PM2 processes across all namespaces
- Namespace token management (create, list, delete)

### Namespace Tokens
Namespace tokens have access to:
- Only processes within their assigned namespace
- All PM2 operations (start, stop, restart, etc.) within their namespace

## API Endpoints

### Namespace Token Management (Root Token Only)

#### Create Namespace Token
```bash
POST /api/namespace
Authorization: Bearer <root-token>
Content-Type: application/json

{
  "namespace": "tenant1",
  "description": "Token for tenant 1"
}
```

Response:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "namespace": "tenant1",
  "description": "Token for tenant 1",
  "created_at": "2024-01-01T00:00:00.000Z",
  "updated_at": "2024-01-01T00:00:00.000Z",
  "token": "sk_tenant1_550e8400-e29b-41d4-a716-446655440000_a1b2c3d4e5f6..."
}
```

#### List Namespace Tokens
```bash
GET /api/namespace
Authorization: Bearer <root-token>
```

#### Get Namespace Token
```bash
GET /api/namespace/:id
Authorization: Bearer <root-token>
```

#### Delete Namespace Token
```bash
DELETE /api/namespace/:id
Authorization: Bearer <root-token>
```

### PM2 Operations with Namespace Tokens

All existing PM2 endpoints work with namespace tokens, but they are automatically scoped to the token's namespace.

#### List Processes (Namespace Scoped)
```bash
GET /api/pm2
Authorization: Bearer <namespace-token>
```

#### Start Process (Automatically Namespaced)
```bash
POST /api/pm2
Authorization: Bearer <namespace-token>
Content-Type: application/json

{
  "name": "my-app",
  "script": "app.js"
}
```

The process will be automatically assigned to namespace `tenant1` if using a token for that namespace.

#### Other Operations
All other PM2 operations (stop, restart, reload, delete, logs) work the same way but are scoped to the namespace.

## Token Format

Namespace tokens follow a specific format for efficient database lookups:
- Format: `sk_<namespace>_<uuid>_<secret_key>`
- Example: `sk_tenant1_550e8400-e29b-41d4-a716-446655440000_a1b2c3d4e5f6...`
- The namespace name is embedded in the token for identification
- The UUID enables efficient database lookups
- The secret key provides the security

## Process Naming Convention

When using namespace tokens, PM2's built-in namespace feature is used:
- Process name: `my-app`
- Namespace: `tenant1`
- PM2 stores the namespace in `pm2_env.namespace`
- Process names remain unchanged, namespace is stored separately

## Security Features

1. **Token Hashing**: All tokens are hashed using Bun's built-in Argon2id password hashing
2. **Timing Attack Protection**: Uses `crypto.timingSafeEqual()` for secure token comparison
3. **Namespace Isolation**: Tokens can only access processes within their namespace
4. **Root Token Protection**: Namespace token management requires root token
5. **Process Name Validation**: All operations verify namespace ownership

## Database

The feature uses SQLite to store namespace tokens. The database file `namespace_tokens.db` is created automatically in the application directory.

## Example Usage

### 1. Create Namespace Tokens (Root)
```bash
# Create token for tenant1
curl -X POST http://localhost:3000/api/namespace \
  -H "Authorization: Bearer <root-token>" \
  -H "Content-Type: application/json" \
  -d '{"namespace": "tenant1", "description": "Tenant 1 API token"}'

# Create token for tenant2
curl -X POST http://localhost:3000/api/namespace \
  -H "Authorization: Bearer <root-token>" \
  -H "Content-Type: application/json" \
  -d '{"namespace": "tenant2", "description": "Tenant 2 API token"}'
```

### 2. Use Namespace Tokens
```bash
# Start a process with tenant1 token
curl -X POST http://localhost:3000/api/pm2 \
  -H "Authorization: Bearer <tenant1-token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "web-app", "script": "server.js"}'

# List processes for tenant1
curl -X GET http://localhost:3000/api/pm2 \
  -H "Authorization: Bearer <tenant1-token>"

# Start a process with tenant2 token
curl -X POST http://localhost:3000/api/pm2 \
  -H "Authorization: Bearer <tenant2-token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "web-app", "script": "server.js"}'
```

In this example:
- Tenant1 will have process `web-app` in namespace `tenant1`
- Tenant2 will have process `web-app` in namespace `tenant2`
- Each tenant can only see and manage their own processes

## Migration from Existing Setup

If you have existing PM2 processes, they will continue to work with the root token. Namespace tokens will only see processes that start with their namespace prefix.

## Environment Variables

- `API_TOKEN`: Root API token (required)
- `PORT`: Server port (optional, defaults to 3000) 