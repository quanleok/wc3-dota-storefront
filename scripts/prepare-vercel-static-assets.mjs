import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const projectDir = path.resolve(scriptDir, '..')
const dotaRoot = process.env.DOTA_ROOT ?? path.resolve(projectDir, '../dota')
const assetRoot = process.env.WC3DOTA_ASSET_ROOT ?? path.join(dotaRoot, 'site-assets', 'w3dotashop-public')
const staticRoot = process.env.VERCEL_STATIC_ROOT ?? path.join(projectDir, '.vercel', 'output', 'static')
const modelsPremiumRoot = path.join(assetRoot, 'models-premium')
const wc3TextureRoot = path.join(assetRoot, 'wc3-textures')

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
}

function copyFile(relativePath) {
  const sourcePath = path.join(assetRoot, relativePath)
  const targetPath = path.join(staticRoot, relativePath)
  if (!fs.existsSync(sourcePath)) {
    console.warn(`Skipping missing asset: ${relativePath}`)
    return
  }

  ensureDir(targetPath)
  fs.copyFileSync(sourcePath, targetPath)
}

function copyDir(relativePath) {
  const sourcePath = path.join(assetRoot, relativePath)
  const targetPath = path.join(staticRoot, relativePath)
  if (!fs.existsSync(sourcePath)) {
    console.warn(`Skipping missing asset directory: ${relativePath}`)
    return
  }

  fs.mkdirSync(path.dirname(targetPath), { recursive: true })
  fs.cpSync(sourcePath, targetPath, { recursive: true, filter: shouldCopyStaticAsset })
}

function copyProjectDir(relativePath) {
  const sourcePath = path.join(projectDir, relativePath)
  const targetPath = path.join(staticRoot, relativePath)
  if (!fs.existsSync(sourcePath)) {
    console.warn(`Skipping missing project asset directory: ${relativePath}`)
    return
  }

  fs.mkdirSync(path.dirname(targetPath), { recursive: true })
  fs.cpSync(sourcePath, targetPath, { recursive: true, filter: shouldCopyStaticAsset })
}

function shouldCopyStaticAsset(sourcePath) {
  return path.basename(sourcePath) !== '.DS_Store'
}

function walkFiles(root, predicate = () => true) {
  if (!fs.existsSync(root)) {
    return []
  }

  const output = []
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const entryPath = path.join(root, entry.name)
    if (entry.isDirectory()) {
      output.push(...walkFiles(entryPath, predicate))
    } else if (predicate(entryPath)) {
      output.push(entryPath)
    }
  }
  return output
}

function loadJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(assetRoot, relativePath), 'utf8'))
}

function normalizeTextureRef(ref) {
  return ref
    .replaceAll('\\', '/')
    .replace(/^\.?\//, '')
    .replace(/^\/+/, '')
    .trim()
    .toLowerCase()
}

function resolveManifestPath(normalizedLower, manifest) {
  const exact = manifest[normalizedLower]
  if (exact) {
    return exact
  }

  const suffix = `/${normalizedLower}`
  const matches = Object.keys(manifest).filter((key) => key.endsWith(suffix))
  return matches.length === 1 ? manifest[matches[0]] : null
}

function collectPremiumTexturePaths() {
  const manifest = loadJson('wc3-asset-manifest.json')
  const texturePaths = new Set()
  const unresolved = new Set()
  const mdxFiles = walkFiles(modelsPremiumRoot, (filePath) => /\.mdx$/i.test(filePath))
  const textureRefPattern = /[A-Za-z0-9_ .\\/()'-]+\.blp/gi

  for (const filePath of mdxFiles) {
    const source = fs.readFileSync(filePath).toString('latin1')
    let match = textureRefPattern.exec(source)

    while (match) {
      const textureRef = match[0].replace(/^[^A-Za-z0-9_]+/, '').trim()
      const normalized = normalizeTextureRef(textureRef)
      const manifestPath = resolveManifestPath(normalized, manifest)

      if (manifestPath && fs.existsSync(path.join(wc3TextureRoot, manifestPath))) {
        texturePaths.add(manifestPath)
      } else if (textureRef) {
        unresolved.add(textureRef)
      }

      match = textureRefPattern.exec(source)
    }
  }

  return { texturePaths, unresolved }
}

function copyWc3Texture(texturePath) {
  const sourcePath = path.join(wc3TextureRoot, texturePath)
  const targetPath = path.join(staticRoot, 'wc3-textures', texturePath)
  if (!fs.existsSync(sourcePath)) {
    return false
  }

  ensureDir(targetPath)
  fs.copyFileSync(sourcePath, targetPath)
  return true
}

const copiedRoots = [
  'audio',
  'inventory-thumbnails',
  'inventory-videos',
  'models-premium',
]

const copiedFiles = [
  'game-scene/godzilla-shopkeeper-idle.glb',
  'game-scene/pavement-mage-spell-cast.glb',
  'game-scene/player-human-idle.glb',
  'game-scene/stash-master-loop-alpha.webm',
  'game-scene/stash-master-loop-alpha-poster.png',
  'models-original/site-gate-original.glb',
  'models-original/site-rune-stone-original.glb',
  'generated/optimized/crest.webp',
]

for (const root of copiedRoots) {
  copyDir(root)
}

copyProjectDir('music')

for (const file of copiedFiles) {
  copyFile(file)
}

const { texturePaths, unresolved } = collectPremiumTexturePaths()
let copiedTextureCount = 0

for (const texturePath of texturePaths) {
  if (copyWc3Texture(texturePath)) {
    copiedTextureCount += 1
  }
}

copyDir('wc3-textures/ReplaceableTextures/TeamColor')
copyDir('wc3-textures/ReplaceableTextures/TeamGlow')

console.log(`Prepared Vercel static assets in ${staticRoot}`)
console.log(`Copied ${copiedTextureCount} shared premium MDX texture files.`)

if (unresolved.size > 0) {
  console.warn(`Unresolved MDX texture refs kept local to model folders or unavailable: ${unresolved.size}`)
}
