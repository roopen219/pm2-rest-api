import { Hono } from 'hono'
import { databaseService } from '../database/database'
import { CreateNamespaceTokenRequest } from '../database/schema'
import { requireRootToken } from '../middleware/auth'

const namespaceRouter = new Hono()

// Apply root token requirement to all routes
namespaceRouter.use('*', requireRootToken)

// Create a new namespace token
namespaceRouter.post('/', async (c) => {
  try {
    const request = await c.req.json<CreateNamespaceTokenRequest>()

    if (!request.namespace || request.namespace.trim() === '') {
      return c.json({ error: 'Namespace is required' }, 400)
    }

    // Validate namespace format (alphanumeric and hyphens only)
    if (!/^[a-zA-Z0-9-]+$/.test(request.namespace)) {
      return c.json(
        {
          error:
            'Namespace must contain only alphanumeric characters and hyphens',
        },
        400,
      )
    }

    const result = await databaseService.createNamespaceToken(request)
    return c.json(
      {
        ...result.response,
        token: result.token,
      },
      201,
    )
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      500,
    )
  }
})

// List all namespace tokens
namespaceRouter.get('/', async (c) => {
  try {
    const tokens = databaseService.listNamespaceTokens()
    return c.json(tokens)
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      500,
    )
  }
})

// Get a specific namespace token
namespaceRouter.get('/:id', async (c) => {
  try {
    const id = c.req.param('id')

    if (!id || id.trim() === '') {
      return c.json({ error: 'Token ID is required' }, 400)
    }

    const token = databaseService.getNamespaceTokenById(id)

    if (!token) {
      return c.json({ error: 'Token not found' }, 404)
    }

    return c.json(token)
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      500,
    )
  }
})

// Delete a namespace token
namespaceRouter.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id')

    if (!id || id.trim() === '') {
      return c.json({ error: 'Token ID is required' }, 400)
    }

    const deleted = databaseService.deleteNamespaceToken(id)

    if (!deleted) {
      return c.json({ error: 'Token not found' }, 404)
    }

    return c.json({ message: 'Token deleted successfully' })
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      500,
    )
  }
})

export default namespaceRouter
