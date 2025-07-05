import TailFile from '@logdna/tail-file'
import { createReadStream } from 'fs'
import fs from 'fs/promises'
import pm2 from 'pm2'
import { createInterface } from 'readline'

class PM2Service {
  private static instance: PM2Service
  private connected: boolean = false

  private constructor() {}

  public static getInstance(): PM2Service {
    if (!PM2Service.instance) {
      PM2Service.instance = new PM2Service()
    }
    return PM2Service.instance
  }

  private async connect(): Promise<void> {
    if (!this.connected) {
      return new Promise((resolve, reject) => {
        pm2.connect((err) => {
          if (err) {
            reject(err)
            return
          }
          this.connected = true
          resolve()
        })
      })
    }
  }

  public async list(namespace?: string): Promise<pm2.ProcessDescription[]> {
    await this.connect()
    return new Promise((resolve, reject) => {
      pm2.list((err, list) => {
        if (err) {
          reject(err)
          return
        }

        // Filter by namespace if provided
        if (namespace) {
          const filteredList = list.filter((process) => {
            return (process.pm2_env as any)?.namespace === namespace
          })
          resolve(filteredList)
        } else {
          resolve(list)
        }
      })
    })
  }

  public async start(
    process: pm2.StartOptions,
    namespace?: string,
  ): Promise<pm2.ProcessDescription> {
    await this.connect()
    const createdProcess = (await new Promise((resolve, reject) => {
      const startOptions: pm2.StartOptions = {
        ...process,
        min_uptime: process.min_uptime ? Number(process.min_uptime) : undefined,
      }

      // Add namespace to pm2_env if namespace is provided
      if (namespace) {
        if (startOptions.env) {
          startOptions.env.namespace = namespace
        } else {
          startOptions.env = {
            namespace,
          }
        }
      }

      pm2.start(startOptions, (err, proc) => {
        if (err) {
          reject(err)
          return
        }
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        resolve(proc[0])
      })
    })) as any
    return this.describe(createdProcess.pm2_env.pm_id as string)
  }

  public async stop(
    name: string,
    namespace?: string,
  ): Promise<pm2.ProcessDescription> {
    await this.connect()

    // First validate that the process exists in the correct namespace
    if (namespace) {
      await this.describe(name, namespace)
    }

    return new Promise((resolve, reject) => {
      pm2.stop(name, (err) => {
        if (err) {
          reject(err)
          return
        }
        resolve(true)
      })
    }).then(() => {
      return this.describe(name)
    })
  }

  public async restart(
    name: string,
    namespace?: string,
  ): Promise<pm2.ProcessDescription> {
    await this.connect()

    // First validate that the process exists in the correct namespace
    if (namespace) {
      await this.describe(name, namespace)
    }

    return new Promise((resolve, reject) => {
      pm2.restart(name, (err) => {
        if (err) {
          reject(err)
          return
        }
        resolve(true)
      })
    }).then(() => {
      return this.describe(name)
    })
  }

  public async delete(name: string, namespace?: string): Promise<void> {
    await this.connect()

    // First validate that the process exists in the correct namespace
    if (namespace) {
      await this.describe(name, namespace)
    }

    return new Promise((resolve, reject) => {
      pm2.delete(name, (err) => {
        if (err) {
          reject(err)
          return
        }
        resolve()
      })
    })
  }

  public async reload(
    name: string,
    namespace?: string,
  ): Promise<pm2.ProcessDescription> {
    await this.connect()

    // First validate that the process exists in the correct namespace
    if (namespace) {
      await this.describe(name, namespace)
    }

    return new Promise((resolve, reject) => {
      pm2.reload(name, (err) => {
        if (err) {
          reject(err)
          return
        }
        resolve(true)
      })
    }).then(() => {
      return this.describe(name)
    })
  }

  public async logs(
    name: string,
    lines: number = 100,
    namespace?: string,
  ): Promise<{ out: string[]; error: string[] }> {
    await this.connect()
    return new Promise((resolve, reject) => {
      pm2.describe(name, async (err, list) => {
        if (err) {
          reject(err)
          return
        }
        if (!list || list.length === 0) {
          reject(new Error(`Process ${name} not found`))
          return
        }
        const process = list[0]

        // Verify namespace access if namespace is provided
        if (namespace) {
          const processNamespace = (process.pm2_env as any)?.namespace
          if (processNamespace !== namespace) {
            reject(
              new Error(`Process ${name} not found in namespace ${namespace}`),
            )
            return
          }
        }

        try {
          const outLogs = process.pm2_env?.pm_out_log_path
            ? await this.readLastLines(process.pm2_env.pm_out_log_path, lines)
            : []
          const errorLogs = process.pm2_env?.pm_err_log_path
            ? await this.readLastLines(process.pm2_env.pm_err_log_path, lines)
            : []

          resolve({
            out: outLogs,
            error: errorLogs,
          })
        } catch (error) {
          reject(error)
        }
      })
    })
  }

  private async readLastLines(
    filePath: string,
    lines: number,
  ): Promise<string[]> {
    try {
      // Get file size
      const stats = await fs.stat(filePath)
      const fileSize = stats.size

      if (fileSize === 0) {
        return []
      }

      // Start reading from the end of the file
      const endPosition = fileSize - 1
      const startPosition = Math.max(0, endPosition - 1024 * 1024) // Read last 1MB or less

      const fileStream = createReadStream(filePath, {
        start: startPosition,
        end: endPosition,
      })

      const rl = createInterface({
        input: fileStream,
        crlfDelay: Infinity,
      })

      const allLines: string[] = []
      for await (const line of rl) {
        allLines.push(line)
        if (allLines.length > lines) {
          allLines.shift()
        }
      }

      // If we didn't get enough lines, read more from the file
      if (allLines.length < lines && startPosition > 0) {
        const remainingLines = lines - allLines.length
        const earlierStream = createReadStream(filePath, {
          start: 0,
          end: startPosition - 1,
        })

        const earlierRl = createInterface({
          input: earlierStream,
          crlfDelay: Infinity,
        })

        const earlierLines: string[] = []
        for await (const line of earlierRl) {
          earlierLines.push(line)
          if (earlierLines.length > remainingLines) {
            earlierLines.shift()
          }
        }

        return [...earlierLines, ...allLines]
      }

      return allLines
    } catch (error) {
      if (
        error instanceof Error &&
        'code' in error &&
        error.code === 'ENOENT'
      ) {
        return []
      }
      throw error
    }
  }

  public async describe(
    name: string,
    namespace?: string,
  ): Promise<pm2.ProcessDescription> {
    await this.connect()
    return new Promise((resolve, reject) => {
      pm2.describe(name, (err, list) => {
        if (err) {
          reject(err)
          return
        }
        if (!list || list.length === 0) {
          reject(new Error(`Process ${name} not found`))
          return
        }

        const process = list[0]

        // Verify namespace access if namespace is provided
        if (namespace) {
          const processNamespace = (process.pm2_env as any)?.namespace
          if (processNamespace !== namespace) {
            reject(
              new Error(`Process ${name} not found in namespace ${namespace}`),
            )
            return
          }
        }

        resolve(process)
      })
    })
  }

  public async streamLogs(
    name: string,
    callback: (data: { out: string; error: string }) => void,
    namespace?: string,
  ): Promise<() => void> {
    await this.connect()
    return new Promise((resolve, reject) => {
      pm2.describe(name, async (err, list) => {
        if (err) {
          reject(err)
          return
        }
        if (!list || list.length === 0) {
          reject(new Error(`Process ${name} not found`))
          return
        }
        const process = list[0]

        // Verify namespace access if namespace is provided
        if (namespace) {
          const processNamespace = (process.pm2_env as any)?.namespace
          if (processNamespace !== namespace) {
            reject(
              new Error(`Process ${name} not found in namespace ${namespace}`),
            )
            return
          }
        }

        const outLogPath = process.pm2_env?.pm_out_log_path
        const errorLogPath = process.pm2_env?.pm_err_log_path

        // Create empty log files if they don't exist
        if (outLogPath) {
          try {
            await fs.access(outLogPath)
          } catch {
            await fs.writeFile(outLogPath, '')
          }
        }

        if (errorLogPath) {
          try {
            await fs.access(errorLogPath)
          } catch {
            await fs.writeFile(errorLogPath, '')
          }
        }

        const tails: TailFile[] = []
        const cleanup = () => {
          tails.forEach((tail) => tail.quit())
        }

        if (outLogPath) {
          const outTail = new TailFile(outLogPath)
          outTail.on('data', (line: string) => {
            callback({ out: line, error: '' })
          })
          outTail.start()
          tails.push(outTail)
        }

        if (errorLogPath) {
          const errorTail = new TailFile(errorLogPath)
          errorTail.on('data', (line: string) => {
            callback({ out: '', error: line })
          })
          errorTail.start()
          tails.push(errorTail)
        }

        resolve(cleanup)
      })
    })
  }
}

export const pm2Service = PM2Service.getInstance()
