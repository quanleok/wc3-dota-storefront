import { createReadStream, existsSync, unlink } from 'node:fs'
import { stat } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { tmpdir } from 'node:os'
import { basename, extname, join } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { SAMPLE_APPS } from './src/appData'

const execFileAsync = promisify(execFile)

type ToolRequest = IncomingMessage & {
  method?: string
  url?: string
}

type ToolResponse = ServerResponse<IncomingMessage>
type NextHandler = () => void
type MiddlewareHost = {
  use: (handler: (req: ToolRequest, res: ToolResponse, next: NextHandler) => void) => void
}

function localToolActionsPlugin(): Plugin {
  const toolMap = new Map(
    SAMPLE_APPS.filter((app) => app.sourceValue.startsWith('/')).map((app) => [app.id, app]),
  )

  async function sendDownload(appId: string, res: ToolResponse) {
    const app = toolMap.get(appId)
    if (!app) {
      res.statusCode = 404
      res.end('Tool not found')
      return
    }

    if (!existsSync(app.sourceValue)) {
      res.statusCode = 404
      res.end('Local file missing')
      return
    }

    const sourceStat = await stat(app.sourceValue)

    if (sourceStat.isDirectory()) {
      const archiveName = `${basename(app.sourceValue, extname(app.sourceValue))}.zip`
      const archivePath = join(tmpdir(), `${app.id}-${Date.now()}.zip`)
      await execFileAsync('ditto', [
        '-c',
        '-k',
        '--sequesterRsrc',
        '--keepParent',
        app.sourceValue,
        archivePath,
      ])

      res.setHeader('Content-Type', 'application/zip')
      res.setHeader('Content-Disposition', `attachment; filename="${archiveName}"`)

      const stream = createReadStream(archivePath)
      stream.on('close', () => unlink(archivePath, () => undefined))
      stream.pipe(res)
      return
    }

    res.setHeader('Content-Type', getMimeType(app.sourceValue))
    res.setHeader('Content-Disposition', `attachment; filename="${basename(app.sourceValue)}"`)
    createReadStream(app.sourceValue).pipe(res)
  }

  async function runToolAction(appId: string, action: 'run' | 'reveal') {
    const app = toolMap.get(appId)
    if (!app) {
      throw new Error('Tool not found')
    }

    if (!existsSync(app.sourceValue)) {
      throw new Error('Local file missing')
    }

    if (action === 'run') {
      await execFileAsync('open', [app.sourceValue])
      return `${app.name} opened`
    }

    await execFileAsync('open', ['-R', app.sourceValue])
    return `${app.name} revealed in Finder`
  }

  function attachRoutes(middlewares: MiddlewareHost) {
    middlewares.use((req, res, next) => {
      void (async () => {
        const method = req.method ?? 'GET'
        const url = req.url ?? ''
        const match = url.match(/^\/api\/tools\/([^/]+)\/(run|reveal|download)$/)

        if (!match) {
          next()
          return
        }

        const [, appId, action] = match

        try {
          if (action === 'download' && method === 'GET') {
            await sendDownload(appId, res)
            return
          }

          if ((action === 'run' || action === 'reveal') && method === 'POST') {
            const message = await runToolAction(appId, action)
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: true, message }))
            return
          }

          res.statusCode = 405
          res.end('Method not allowed')
        } catch (error) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(
            JSON.stringify({
              ok: false,
              message: error instanceof Error ? error.message : 'Action failed',
            }),
          )
        }
      })()
    })
  }

  return {
    name: 'local-tool-actions',
    configureServer(server) {
      attachRoutes(server.middlewares)
    },
    configurePreviewServer(server) {
      attachRoutes(server.middlewares)
    },
  }
}

function getMimeType(filePath: string) {
  const extension = extname(filePath).toLowerCase()
  const mimeMap: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.py': 'text/x-python; charset=utf-8',
    '.zip': 'application/zip',
  }

  return mimeMap[extension] ?? 'application/octet-stream'
}

export default defineConfig({
  plugins: [react(), localToolActionsPlugin()],
})
