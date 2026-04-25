import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { buildWc3AssetManifest } from './generate-wc3-asset-manifest.mjs'

const dotaRoot = '/Users/quan/Downloads/dota'
const assetRoot = path.join(dotaRoot, 'site-assets', 'w3dotashop-public')
const sharedRoot = path.join(assetRoot, 'wc3-textures')
const mpqCliPath = path.join(dotaRoot, 'maps', 'toolchain', 'tools', 'mpqcli', 'build', 'bin', 'mpqcli')
const war3TftListfile = path.join('scripts', 'mpq-listfiles', 'war3tft.txt')
const baseMpqs = [
  { archivePath: path.join(dotaRoot, 'maps', 'toolchain', 'base_mpqs', 'war3.mpq') },
  {
    archivePath: path.join(dotaRoot, 'maps', 'toolchain', 'base_mpqs', 'War3x.mpq'),
    listfilePath: war3TftListfile,
  },
  { archivePath: path.join(dotaRoot, 'maps', 'toolchain', 'base_mpqs', 'War3xlocal.mpq') },
  { archivePath: path.join(dotaRoot, 'maps', 'toolchain', 'base_mpqs', 'War3Patch.mpq') },
]

const sharedPrefixes = [
  'abilities/',
  'buildings/',
  'doodads/',
  'objects/',
  'replaceabletextures/',
  'sharedmodels/',
  'terrainart/',
  'textures/',
  'ui/',
  'units/',
]

const importExtensions = new Set(['.blp', '.dds', '.jpg', '.jpeg', '.png', '.tga'])

function normalizeArchivePath(archivePath) {
  return archivePath.replaceAll('\\', '/').replace(/^\.?\//, '').replace(/^\/+/, '')
}

function shouldImport(archivePath) {
  const normalized = normalizeArchivePath(archivePath)
  const lower = normalized.toLowerCase()

  if (/^file\d+\./i.test(normalized)) {
    return false
  }

  if (!importExtensions.has(path.extname(lower))) {
    return false
  }

  return sharedPrefixes.some((prefix) => lower.startsWith(prefix))
}

function ensureParentDirectory(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
}

function writeIfChanged(filePath, bytes) {
  if (fs.existsSync(filePath)) {
    const current = fs.readFileSync(filePath)

    if (current.length === bytes.length && current.equals(bytes)) {
      return false
    }
  }

  ensureParentDirectory(filePath)
  fs.writeFileSync(filePath, bytes)
  return true
}

function extractArchive(archivePath, outputPath, listfilePath) {
  const args = ['extract', '--keep', '--output', outputPath]

  if (listfilePath && fs.existsSync(listfilePath)) {
    args.push('--listfile', listfilePath)
  }

  args.push(archivePath)

  execFileSync(mpqCliPath, args, {
    encoding: 'buffer',
    maxBuffer: 1024 * 1024,
    stdio: ['ignore', 'ignore', 'pipe'],
  })
}

function collectFiles(rootPath) {
  const files = []
  const stack = [rootPath]

  while (stack.length) {
    const current = stack.pop()
    const entries = fs.readdirSync(current, { withFileTypes: true })

    for (const entry of entries) {
      const absolutePath = path.join(current, entry.name)

      if (entry.isDirectory()) {
        stack.push(absolutePath)
      } else if (entry.isFile()) {
        files.push(absolutePath)
      }
    }
  }

  return files
}

function main() {
  if (!fs.existsSync(mpqCliPath)) {
    throw new Error(`mpqcli was not found at ${mpqCliPath}`)
  }

  fs.mkdirSync(sharedRoot, { recursive: true })

  let totalCandidates = 0
  let totalImported = 0
  let totalUnchanged = 0
  let totalFailed = 0

  for (const { archivePath, listfilePath } of baseMpqs) {
    if (!fs.existsSync(archivePath)) {
      console.warn(`Skipping missing archive: ${archivePath}`)
      continue
    }

    const archiveName = path.basename(archivePath)
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), `w3dotashop-${archiveName}-`))
    let imported = 0
    let unchanged = 0
    let failed = 0
    let candidates = []

    try {
      extractArchive(archivePath, tempRoot, listfilePath)
      candidates = collectFiles(tempRoot)
        .map((filePath) => normalizeArchivePath(path.relative(tempRoot, filePath)))
        .filter(shouldImport)

      for (const candidate of candidates) {
        const sourcePath = path.join(tempRoot, candidate)
        const targetPath = path.join(sharedRoot, candidate)

        try {
          const bytes = fs.readFileSync(sourcePath)
          if (writeIfChanged(targetPath, bytes)) {
            imported += 1
          } else {
            unchanged += 1
          }
        } catch (error) {
          failed += 1
          const message = error instanceof Error ? error.message : String(error)
          console.warn(`Failed ${archiveName}:${candidate}: ${message}`)
        }
      }
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true })
    }

    totalCandidates += candidates.length
    totalImported += imported
    totalUnchanged += unchanged
    totalFailed += failed

    console.log(
      `${archiveName}: candidates=${candidates.length} imported=${imported} unchanged=${unchanged} failed=${failed}`,
    )
  }

  console.log(
    `shared wc3 textures: candidates=${totalCandidates} imported=${totalImported} unchanged=${totalUnchanged} failed=${totalFailed}`,
  )
  buildWc3AssetManifest()
  console.log(sharedRoot)
}

main()
