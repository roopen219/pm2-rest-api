import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { secureHeaders } from 'hono/secure-headers'
import { authMiddleware } from './middleware/auth'
import namespaceRouter from './namespace/routes'
import pm2Router from './pm2/routes'

declare const process: {
  env: {
    PORT?: string
    API_TOKEN?: string
  }
}

declare const console: {
  log(...args: unknown[]): void
}

const app = new Hono({
  strict: false,
})

// Middleware
app.use('*', logger())
app.use('*', cors())
app.use('*', secureHeaders())
// Protected routes with custom auth middleware
app.use('/api/pm2/*', authMiddleware)
app.use('/api/namespace/*', authMiddleware)

// Routes
app.route('/api/pm2', pm2Router)
app.route('/api/namespace', namespaceRouter)

// Health check
app.get('/', (c) => c.json({ status: 'ok' }))

// Start the server
const port = parseInt(process.env.PORT || '3000')
console.log(`Server is running on port ${port}`)

export default {
  port,
  fetch: app.fetch,
}
