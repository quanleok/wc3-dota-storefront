import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dotaRoot = process.env.DOTA_ROOT ?? '/Users/quan/Downloads/dota'
const sharedRoot =
  process.env.WC3_TEXTURE_ROOT ?? path.join(dotaRoot, 'site-assets', 'w3dotashop-public', 'wc3-textures')
const siteAssetRoot = path.dirname(sharedRoot)
const publicOutputPath = path.join(projectRoot, 'public', 'wc3-asset-manifest.json')
const assetOutputPath = path.join(path.dirname(sharedRoot), 'wc3-asset-manifest.json')
const publicSiteOutputPath = path.join(projectRoot, 'public', 'wc3-site-asset-manifest.json')
const assetSiteOutputPath = path.join(siteAssetRoot, 'wc3-site-asset-manifest.json')
const siteManifestRoots = ['models-premium', 'models', 'mdx-test']

function normalizeRelativePath(filePath) {
  return filePath.replaceAll(path.sep, '/').replace(/^\/+/, '')
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

export function buildWc3AssetManifest() {
  if (!fs.existsSync(sharedRoot)) {
    throw new Error(`Shared WC3 texture root was not found at ${sharedRoot}`)
  }

  const manifest = {}
  const files = collectFiles(sharedRoot)
    .map((filePath) => normalizeRelativePath(path.relative(sharedRoot, filePath)))
    .sort((a, b) => a.localeCompare(b))

  for (const filePath of files) {
    manifest[filePath.toLowerCase()] = filePath
  }

  const source = `${JSON.stringify(manifest, null, 2)}\n`

  fs.writeFileSync(publicOutputPath, source)
  fs.writeFileSync(assetOutputPath, source)
  console.log(`wc3 asset manifest: ${files.length} files`)
  console.log(publicOutputPath)
  console.log(assetOutputPath)

  const siteFiles = siteManifestRoots
    .flatMap((rootName) => {
      const rootPath = path.join(siteAssetRoot, rootName)

      return fs.existsSync(rootPath)
        ? collectFiles(rootPath).map((filePath) => normalizeRelativePath(path.relative(siteAssetRoot, filePath)))
        : []
    })
    .sort((a, b) => a.localeCompare(b))
  const siteManifest = {}

  for (const filePath of siteFiles) {
    siteManifest[filePath.toLowerCase()] = filePath
  }

  const siteSource = `${JSON.stringify(siteManifest, null, 2)}\n`
  fs.writeFileSync(publicSiteOutputPath, siteSource)
  fs.writeFileSync(assetSiteOutputPath, siteSource)
  console.log(`wc3 site asset manifest: ${siteFiles.length} files`)
  console.log(publicSiteOutputPath)
  console.log(assetSiteOutputPath)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  buildWc3AssetManifest()
}
