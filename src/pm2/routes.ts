import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import pm2 from 'pm2'
import { pm2Service } from './service'

const pm2Router = new Hono()

// List all processes
pm2Router.get('/', async (c) => {
  try {
    const namespace = c.get('namespace')
    const processes = await pm2Service.list(namespace)
    return c.json(processes)
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      500,
    )
  }
})

// Get process details
pm2Router.get('/:name', async (c) => {
  try {
    const name = c.req.param('name')
    const namespace = c.get('namespace')
    const process = await pm2Service.describe(name, namespace)
    return c.json(process)
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      500,
    )
  }
})

// Start a new process
pm2Router.post('/', async (c) => {
  try {
    const process = await c.req.json<pm2.StartOptions>()
    const namespace = c.get('namespace')
    const result = await pm2Service.start(process, namespace)
    return c.json(result)
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      500,
    )
  }
})

// Stop a process
pm2Router.post('/:name/stop', async (c) => {
  try {
    const name = c.req.param('name')
    const namespace = c.get('namespace')
    await pm2Service.stop(name, namespace)
    return c.json({ message: `Process ${name} stopped successfully` })
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      500,
    )
  }
})

// Restart a process
pm2Router.post('/:name/restart', async (c) => {
  try {
    const name = c.req.param('name')
    const namespace = c.get('namespace')
    await pm2Service.restart(name, namespace)
    return c.json({ message: `Process ${name} restarted successfully` })
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      500,
    )
  }
})

// Reload a process
pm2Router.post('/:name/reload', async (c) => {
  try {
    const name = c.req.param('name')
    const namespace = c.get('namespace')
    await pm2Service.reload(name, namespace)
    return c.json({ message: `Process ${name} reloaded successfully` })
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      500,
    )
  }
})

// Delete a process
pm2Router.delete('/:name', async (c) => {
  try {
    const name = c.req.param('name')
    const namespace = c.get('namespace')
    await pm2Service.delete(name, namespace)
    return c.json({ message: `Process ${name} deleted successfully` })
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      500,
    )
  }
})

// Get process logs
pm2Router.get('/:name/logs', async (c) => {
  try {
    const name = c.req.param('name')
    const lines = parseInt(c.req.query('lines') || '100')
    const namespace = c.get('namespace')
    const logs = await pm2Service.logs(name, lines, namespace)
    return c.json(logs)
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      500,
    )
  }
})

// Stream process logs
pm2Router.get('/:name/logs/stream', async (c) => {
  const name = c.req.param('name')
  const namespace = c.get('namespace')

  return streamSSE(c, async (stream) => {
    try {
      // Send initial message
      await stream.writeSSE({
        data: `Starting log stream for process: ${name}`,
        event: 'message',
      })

      // Send status message
      await stream.writeSSE({
        data: 'Waiting for log events...',
        event: 'status',
      })

      const cleanup = await pm2Service.streamLogs(
        name,
        (data) => {
          if (data.out) {
            stream.writeSSE({
              data: `${data.out}`,
              event: 'message',
            })
          }
          if (data.error) {
            stream.writeSSE({
              data: `${data.error}`,
              event: 'message',
            })
          }
        },
        namespace,
      )

      // Clean up watchers when the connection is closed
      stream.onAbort(() => {
        cleanup()
      })

      // Keep the connection alive with heartbeats
      while (true) {
        await stream.writeSSE({
          data: 'ping',
          event: 'ping',
        })
        await stream.sleep(5000) // Send heartbeat every 5 seconds
      }
    } catch (error) {
      await stream.writeSSE({
        data: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        event: 'error',
      })
      stream.close()
    }
  })
})

export default pm2Router
