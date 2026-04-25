import * as fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import type { Connect, Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const projectDir = path.dirname(fileURLToPath(import.meta.url))
const defaultExternalAssetRoot = path.resolve(projectDir, '../dota/site-assets/w3dotashop-public')
const externalAssetPrefixes = [
  '/audio',
  '/game-scene',
  '/generated',
  '/inventory-thumbnails',
  '/inventory-videos',
  '/mdx-test',
  '/models',
  '/models-optimized',
  '/models-original',
  '/models-premium',
  '/wc3-textures',
]
const projectAssetPrefixes = ['/music']
const contentTypes: Record<string, string> = {
  '.blp': 'application/octet-stream',
  '.glb': 'model/gltf-binary',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.mdx': 'application/octet-stream',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.wav': 'audio/wav',
  '.webp': 'image/webp',
  '.webm': 'video/webm',
}

function servesPrefix(pathname: string, prefixes: string[]) {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

function installStaticAssetMiddleware(middlewares: Connect.Server, assetRoot: string, prefixes: string[]) {
  middlewares.use((req, res, next) => {
    if (!req.url) {
      next()
      return
    }

    let pathname = ''

    try {
      pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
    } catch {
      next()
      return
    }

    if (!servesPrefix(pathname, prefixes)) {
      next()
      return
    }

    const filePath = path.resolve(assetRoot, `.${pathname}`)

    if (!filePath.startsWith(`${assetRoot}${path.sep}`)) {
      next()
      return
    }

    let fileStat: fs.Stats | null = null

    try {
      fileStat = fs.statSync(filePath)
    } catch {
      res.statusCode = 404
      res.end('Not found')
      return
    }

    if (!fileStat.isFile()) {
      res.statusCode = 404
      res.end('Not found')
      return
    }

    const contentType = contentTypes[path.extname(filePath).toLowerCase()]

    if (contentType) {
      res.setHeader('Content-Type', contentType)
    }

    res.setHeader('Content-Length', fileStat.size)
    res.setHeader('Cache-Control', 'public, max-age=3600')

    if (req.method === 'HEAD') {
      res.end()
      return
    }

    fs.createReadStream(filePath).on('error', next).pipe(res)
  })
}

function externalPublicAssets(externalAssetRoot: string): Plugin {
  return {
    name: 'external-public-assets',
    configureServer(server) {
      installStaticAssetMiddleware(server.middlewares, externalAssetRoot, externalAssetPrefixes)
      installStaticAssetMiddleware(server.middlewares, projectDir, projectAssetPrefixes)
    },
    configurePreviewServer(server) {
      installStaticAssetMiddleware(server.middlewares, externalAssetRoot, externalAssetPrefixes)
      installStaticAssetMiddleware(server.middlewares, projectDir, projectAssetPrefixes)
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, projectDir, '')
  const externalAssetRoot = path.resolve(env.VITE_LOCAL_ASSET_ROOT ?? defaultExternalAssetRoot)

  return {
    plugins: [react(), externalPublicAssets(externalAssetRoot)],
  }
})
