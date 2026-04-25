import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { buildWc3AssetManifest } from './generate-wc3-asset-manifest.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const require = createRequire(import.meta.url)
const projectRoot = path.resolve(__dirname, '..')
const dotaRoot = '/Users/quan/Downloads/dota'
const siteAssetRoot = path.join(dotaRoot, 'site-assets', 'w3dotashop-public')
const premiumRoot = path.join(siteAssetRoot, 'models-premium')
const sharedRoot = path.join(siteAssetRoot, 'wc3-textures')
const shopDataPath = path.join(projectRoot, 'src', 'shopData.ts')
const modelBoundsPublicOutputPath = path.join(projectRoot, 'public', 'wc3-model-bounds.json')
const modelBoundsAssetOutputPath = path.join(siteAssetRoot, 'wc3-model-bounds.json')

const externalRoots = [
  path.join(dotaRoot, 'maps', 'active', 'dota_v689q_extracted'),
  path.join(dotaRoot, 'archive', 'legacy_extracts', 'extracted'),
  path.join(dotaRoot, 'assets', 'libraries', 'assets_extracted'),
  path.join(dotaRoot, 'assets', 'libraries', 'skins_library'),
  path.join(dotaRoot, 'assets', 'pool', 'textures_flat'),
  path.join(dotaRoot, 'assets', 'pool', 'by_source'),
  path.join(dotaRoot, 'maps', 'toolchain', 'reference_data', 'BlankMapFiles_2.0.0.22389'),
]
const mpqCliPath = path.join(dotaRoot, 'maps', 'toolchain', 'tools', 'mpqcli', 'build', 'bin', 'mpqcli')
const baseMpqPaths = [
  path.join(dotaRoot, 'maps', 'toolchain', 'base_mpqs', 'war3.mpq'),
  path.join(dotaRoot, 'maps', 'toolchain', 'base_mpqs', 'War3Patch.mpq'),
  path.join(dotaRoot, 'maps', 'toolchain', 'base_mpqs', 'War3x.mpq'),
  path.join(dotaRoot, 'maps', 'toolchain', 'base_mpqs', 'War3xlocal.mpq'),
]

const REF_RE = /([A-Za-z0-9_./\\ -]+\.(?:blp|mdx|mdl))/gi
const WC3_SHARED_PREFIXES = [
  'h/',
  'textures/',
  'units/',
  'replaceabletextures/',
  'ui/',
  'abilities/',
  'buildings/',
  'doodads/',
  'sharedmodels/',
  'gn3d/',
  'ht/',
  'pr/',
  'r/',
  'ter/',
  'fcampaign3d/',
  'nfight/',
  'terrainart/',
  'environment/',
  'selection/',
]

function normalizeRef(ref) {
  return ref.replaceAll('\\', '/').replace(/^\.?\//, '').replace(/^\/+/, '')
}

function isRenderableAsset(file) {
  return /\.(?:blp|mdx|mdl)$/i.test(file)
}

function isSharedPath(ref) {
  const lower = normalizeRef(ref).toLowerCase()
  return WC3_SHARED_PREFIXES.some((prefix) => lower.startsWith(prefix))
}

function ensureDir(targetPath) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true })
}

function copyFileIfNeeded(fromPath, toPath) {
  ensureDir(toPath)
  if (fs.existsSync(toPath)) {
    const fromStat = fs.statSync(fromPath)
    const toStat = fs.statSync(toPath)
    if (fromStat.size === toStat.size) {
      return false
    }
  }
  fs.copyFileSync(fromPath, toPath)
  return true
}

const mpqReadCache = new Map()

function extractFromBaseMpqs(ref) {
  const normalized = normalizeRef(ref)
  const cacheKey = normalized.toLowerCase()
  if (mpqReadCache.has(cacheKey)) {
    return mpqReadCache.get(cacheKey)
  }

  if (!fs.existsSync(mpqCliPath)) {
    mpqReadCache.set(cacheKey, null)
    return null
  }

  const archivePath = normalized.replaceAll('/', '\\')
  const destPath = path.join(sharedRoot, normalized)

  for (const mpqPath of baseMpqPaths) {
    if (!fs.existsSync(mpqPath)) {
      continue
    }

    try {
      const bytes = execFileSync(mpqCliPath, ['read', archivePath, mpqPath], {
        encoding: 'buffer',
        stdio: ['ignore', 'pipe', 'ignore'],
        maxBuffer: 64 * 1024 * 1024,
      })
      if (!bytes?.length) {
        continue
      }

      ensureDir(destPath)
      fs.writeFileSync(destPath, bytes)
      mpqReadCache.set(cacheKey, destPath)
      return destPath
    } catch {
      // Try the next MPQ. Missing files are expected.
    }
  }

  mpqReadCache.set(cacheKey, null)
  return null
}

function extractRefs(filePath) {
  if (!fs.existsSync(filePath)) {
    return []
  }
  const data = fs.readFileSync(filePath)
  const refs = []
  const seen = new Set()
  for (const match of data.toString('latin1').matchAll(REF_RE)) {
    const raw = normalizeRef(match[1])
    if (raw.length < 5) {
      continue
    }
    const lower = raw.toLowerCase()
    if (!seen.has(lower)) {
      seen.add(lower)
      refs.push(raw)
    }
  }
  return refs
}

function buildSourceIndex(roots) {
  const byName = new Map()
  const byRelative = new Map()
  const byRelativeSuffix = []

  for (const root of roots) {
    if (!fs.existsSync(root)) {
      continue
    }

    const stack = [root]
    while (stack.length) {
      const current = stack.pop()
      const entries = fs.readdirSync(current, { withFileTypes: true })
      for (const entry of entries) {
        const absPath = path.join(current, entry.name)
        if (entry.isDirectory()) {
          stack.push(absPath)
          continue
        }
        if (!isRenderableAsset(entry.name)) {
          continue
        }
        const rel = normalizeRef(path.relative(root, absPath))
        const relLower = rel.toLowerCase()
        const nameLower = entry.name.toLowerCase()
        byRelative.set(relLower, absPath)
        byRelativeSuffix.push([relLower, absPath])
        if (!byName.has(nameLower)) {
          byName.set(nameLower, [])
        }
        byName.get(nameLower).push(absPath)
      }
    }
  }

  return { byName, byRelative, byRelativeSuffix }
}

function parseSeedEntries() {
  const text = fs.readFileSync(shopDataPath, 'utf8')
  const seededStart = text.indexOf('const SEEDED_PRODUCTS')
  const seededEnd = text.indexOf('export const SHOP_PRODUCTS', seededStart)

  if (seededStart < 0 || seededEnd < 0) {
    throw new Error('Could not locate SEEDED_PRODUCTS in shopData.ts')
  }

  const seededSource = text.slice(seededStart, seededEnd)
  const matches = [...seededSource.matchAll(/\{\s*[\r\n]+\s*id: '([^']+)'[\s\S]*?entry: '([^']+)'[\s\S]*?basePath: '([^']+)'[\s\S]*?\n\s*\}/g)]
  return matches.map(([, id, entry, basePath]) => ({
    id,
    entry,
    basePath,
    sourceFile: path.join(siteAssetRoot, basePath.replace(/^\/+/, ''), entry),
  }))
}

function resolveCandidate(ref, currentFilePath, sourceIndex) {
  const normalized = normalizeRef(ref)
  const refLower = normalized.toLowerCase()

  const localNeighbor = path.join(path.dirname(currentFilePath), path.basename(normalized))
  if (fs.existsSync(localNeighbor)) {
    return localNeighbor
  }

  const localExact = path.join(path.dirname(currentFilePath), normalized)
  if (fs.existsSync(localExact)) {
    return localExact
  }

  const directRelative = sourceIndex.byRelative.get(refLower)
  if (directRelative) {
    return directRelative
  }

  const suffixMatch = sourceIndex.byRelativeSuffix.find(([candidate]) => candidate.endsWith(refLower))
  if (suffixMatch) {
    return suffixMatch[1]
  }

  const sameName = sourceIndex.byName.get(path.basename(refLower))
  if (sameName?.length) {
    return sameName[0]
  }

  if (isSharedPath(ref)) {
    return extractFromBaseMpqs(ref)
  }

  return null
}

function getProductLocalPath(seed, ref) {
  const normalized = normalizeRef(ref)

  if (normalized.startsWith('../') || normalized.includes('/../')) {
    return null
  }

  return path.join(siteAssetRoot, seed.basePath.replace(/^\/+/, ''), normalized)
}

function syncProductDependencies(seed, sourceIndex) {
  const copied = []
  const unresolved = new Set()
  const visitedFiles = new Set()

  function syncFile(filePath, logicalName) {
    const visitKey = `${filePath}::${logicalName}`
    if (visitedFiles.has(visitKey) || !fs.existsSync(filePath)) {
      return
    }
    visitedFiles.add(visitKey)

    if (isSharedPath(logicalName)) {
      const destPath = path.join(sharedRoot, normalizeRef(logicalName))
      if (copyFileIfNeeded(filePath, destPath)) {
        copied.push(normalizeRef(logicalName))
      }
    }

    if (!/\.(?:mdx|mdl)$/i.test(filePath)) {
      return
    }

    for (const ref of extractRefs(filePath)) {
      const source = resolveCandidate(ref, filePath, sourceIndex)
      if (!source) {
        unresolved.add(normalizeRef(ref))
        continue
      }
      if (isSharedPath(ref)) {
        const destPath = path.join(sharedRoot, normalizeRef(ref))
        if (copyFileIfNeeded(source, destPath)) {
          copied.push(normalizeRef(ref))
        }
      } else {
        const localDestPath = getProductLocalPath(seed, ref)
        if (localDestPath && path.resolve(source) !== path.resolve(localDestPath)) {
          if (copyFileIfNeeded(source, localDestPath)) {
            copied.push(normalizeRef(path.join(seed.basePath.replace(/^\/+/, ''), ref)))
          }
        }
      }
      if (/\.(?:mdx|mdl)$/i.test(ref)) {
        syncFile(source, ref)
      }
    }
  }

  syncFile(seed.sourceFile, seed.entry)

  return {
    id: seed.id,
    copied: [...new Set(copied)].sort(),
    unresolved: [...unresolved].sort(),
  }
}

function calculateModelGeosetBounds(model) {
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]

  for (const geoset of model.geosets) {
    for (let index = 0; index < geoset.vertices.length; index += 3) {
      min[0] = Math.min(min[0], geoset.vertices[index])
      min[1] = Math.min(min[1], geoset.vertices[index + 1])
      min[2] = Math.min(min[2], geoset.vertices[index + 2])
      max[0] = Math.max(max[0], geoset.vertices[index])
      max[1] = Math.max(max[1], geoset.vertices[index + 1])
      max[2] = Math.max(max[2], geoset.vertices[index + 2])
    }
  }

  if (!Number.isFinite(min[0])) {
    return null
  }

  const center = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2]
  let radius = 0

  for (const geoset of model.geosets) {
    for (let index = 0; index < geoset.vertices.length; index += 3) {
      radius = Math.max(
        radius,
        Math.hypot(
          geoset.vertices[index] - center[0],
          geoset.vertices[index + 1] - center[1],
          geoset.vertices[index + 2] - center[2],
        ),
      )
    }
  }

  return {
    x: center[0],
    y: center[1],
    z: center[2],
    r: radius,
    min,
    max,
  }
}

function recalculateModelExtent(model) {
  const bounds = calculateModelGeosetBounds(model)

  if (!bounds) {
    return
  }

  for (let axis = 0; axis < 3; axis += 1) {
    model.extent.min[axis] = bounds.min[axis]
    model.extent.max[axis] = bounds.max[axis]
  }
  model.extent.boundsRadius = bounds.r
}

function getMaterialLayers(model, materialId) {
  return model.materials[materialId]?.layers ?? []
}

function getTextureForLayer(model, layer) {
  return model.textures[layer.textureId]
}

function getGeosetBounds(geoset) {
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]

  for (let index = 0; index < geoset.vertices.length; index += 3) {
    min[0] = Math.min(min[0], geoset.vertices[index])
    min[1] = Math.min(min[1], geoset.vertices[index + 1])
    min[2] = Math.min(min[2], geoset.vertices[index + 2])
    max[0] = Math.max(max[0], geoset.vertices[index])
    max[1] = Math.max(max[1], geoset.vertices[index + 1])
    max[2] = Math.max(max[2], geoset.vertices[index + 2])
  }

  return {
    min,
    max,
    span: [max[0] - min[0], max[1] - min[1], max[2] - min[2]],
  }
}

function isPreviewHelperPlane(model, geoset, modelBounds) {
  const geosetBounds = getGeosetBounds(geoset)
  const layers = getMaterialLayers(model, geoset.materialId)
  const textureLabel = layers
    .map((layer) => {
      const texture = getTextureForLayer(model, layer)
      return `${texture?.path ?? ''} ${texture?.replaceableId ?? 0}`
    })
    .join(' ')
    .toLowerCase()
  const hasHelperTexture =
    /genericglow|teamglow|teamcolor|selection|shadow|glow|flare|ring|circle|ribbon|tornado|trail|slash/.test(
      textureLabel,
    ) ||
    layers.some((layer) => {
      const texture = getTextureForLayer(model, layer)
      return texture?.replaceableId === 1 || texture?.replaceableId === 2
    })
  const hasTeamGlow = layers.some((layer) => getTextureForLayer(model, layer)?.replaceableId === 2)
  const vertexCount = geoset.vertices.length / 3
  const modelSpan = [
    modelBounds.max[0] - modelBounds.min[0],
    modelBounds.max[1] - modelBounds.min[1],
    modelBounds.max[2] - modelBounds.min[2],
  ]
  const geosetDiagonalXY = Math.hypot(geosetBounds.span[0], geosetBounds.span[1])
  const modelDiagonalXY = Math.hypot(modelSpan[0], modelSpan[1])
  const maxGeosetSpan = Math.max(...geosetBounds.span)
  const maxModelSpan = Math.max(...modelSpan)
  const minGeosetSpan = Math.min(...geosetBounds.span)
  const isFlat = geosetBounds.span[2] <= Math.max(28, modelSpan[2] * 0.18)
  const isBroad =
    geosetDiagonalXY >= modelDiagonalXY * 0.72 ||
    Math.max(geosetBounds.span[0], geosetBounds.span[1]) >= modelSpan[2] * 1.45
  const isBillboardPlane = minGeosetSpan <= Math.max(8, maxModelSpan * 0.05)
  const isLargeStandalonePlane = maxGeosetSpan >= 150 && isBillboardPlane
  const isOversized = isBroad || isLargeStandalonePlane || maxGeosetSpan >= maxModelSpan * 0.72
  const isSimplePlane = vertexCount <= 80
  const isLargeTeamGlowPlane = hasTeamGlow && isSimplePlane && maxGeosetSpan >= 70
  const isNearGround = geosetBounds.min[2] <= modelSpan[2] * 0.32

  if (hasTeamGlow && isSimplePlane && (isOversized || isLargeTeamGlowPlane)) {
    return true
  }

  return hasHelperTexture && isSimplePlane && isOversized && (isFlat || isBillboardPlane || isNearGround)
}

function getPreviewEntryName(entry) {
  const ext = path.extname(entry)
  const base = entry.slice(0, -ext.length)
  const previewBase = base.replace(/(?:\.preview)+$/i, '') || base
  return `${previewBase}.preview${ext.toLowerCase()}`
}

function updateShopDataEntry(seed, previewEntry) {
  const text = fs.readFileSync(shopDataPath, 'utf8')
  const idIndex = text.indexOf(`id: '${seed.id}'`)
  if (idIndex < 0) {
    return false
  }

  const blockEnd = text.indexOf('\n  },', idIndex)
  if (blockEnd < 0) {
    return false
  }

  const before = text.slice(0, idIndex)
  const block = text.slice(idIndex, blockEnd)
  const after = text.slice(blockEnd)
  const nextBlock = block.replace(/entry: '[^']+'/, `entry: '${previewEntry}'`)

  if (nextBlock === block) {
    return false
  }

  fs.writeFileSync(shopDataPath, `${before}${nextBlock}${after}`)
  return true
}

function sanitizePreviewModel(seed) {
  if (!fs.existsSync(seed.sourceFile)) {
    return null
  }

  const { parsers } = require('mdx-m3-viewer/dist/cjs')
  const model = new parsers.mdlx.Model()
  model.load(fs.readFileSync(seed.sourceFile))
  const bounds = calculateModelGeosetBounds(model)

  if (!bounds) {
    return null
  }

  const originalCount = model.geosets.length
  model.geosets = model.geosets.filter((geoset) => !isPreviewHelperPlane(model, geoset, bounds))
  const removed = originalCount - model.geosets.length

  if (removed === 0) {
    return null
  }

  recalculateModelExtent(model)
  const previewEntry = getPreviewEntryName(seed.entry)
  const previewPath = path.join(path.dirname(seed.sourceFile), previewEntry)
  fs.writeFileSync(previewPath, Buffer.from(model.saveMdx()))

  return {
    id: seed.id,
    removed,
    previewEntry,
    previewPath,
    shopDataUpdated: seed.entry === previewEntry ? false : updateShopDataEntry(seed, previewEntry),
  }
}

function buildModelBoundsManifest(seeds) {
  const { parsers } = require('mdx-m3-viewer/dist/cjs')
  const manifest = {}

  for (const seed of seeds) {
    if (!fs.existsSync(seed.sourceFile)) {
      continue
    }

    const model = new parsers.mdlx.Model()
    model.load(fs.readFileSync(seed.sourceFile))
    const bounds = calculateModelGeosetBounds(model)

    if (!bounds) {
      continue
    }

    const key = normalizeRef(path.join(seed.basePath.replace(/^\/+/, ''), seed.entry)).toLowerCase()
    manifest[key] = {
      x: Number(bounds.x.toFixed(4)),
      y: Number(bounds.y.toFixed(4)),
      z: Number(bounds.z.toFixed(4)),
      r: Number(bounds.r.toFixed(4)),
    }
  }

  const source = `${JSON.stringify(manifest, null, 2)}\n`
  fs.writeFileSync(modelBoundsPublicOutputPath, source)
  fs.writeFileSync(modelBoundsAssetOutputPath, source)
  console.log(`wc3 model bounds manifest: ${Object.keys(manifest).length} models`)
  console.log(modelBoundsPublicOutputPath)
  console.log(modelBoundsAssetOutputPath)
}

function cleanMonkeyKingPreviewModels() {
  const { parsers } = require('mdx-m3-viewer/dist/cjs')
  const originalHeroPath = path.join(premiumRoot, 'monkey-king-arcane', 'HeroMK.mdx')
  const cleanedHeroPath = path.join(premiumRoot, 'monkey-king-arcane', 'HeroMK.preview.mdx')
  const previousCleanedHeroPath = path.join(premiumRoot, 'monkey-king-arcane', 'HeroMK.cleaned.mdx')
  const previousNoStaffHeroPath = path.join(premiumRoot, 'monkey-king-arcane', 'HeroMK.nostaff.mdx')
  const cleanedStaffPath = path.join(sharedRoot, 'H', 'mk', 'MKB.clean.mdx')

  if (!fs.existsSync(originalHeroPath)) {
    return
  }

  fs.rmSync(previousCleanedHeroPath, { force: true })
  fs.rmSync(previousNoStaffHeroPath, { force: true })
  fs.rmSync(cleanedStaffPath, { force: true })

  const hero = new parsers.mdlx.Model()
  hero.load(fs.readFileSync(originalHeroPath))

  for (const attachment of hero.attachments) {
    if (normalizeRef(attachment.path).toLowerCase() === 'h/mk/mkb.mdx') {
      attachment.path = ''
    }
  }

  hero.geosets = hero.geosets.filter((geoset) => geoset.materialId !== 3)
  recalculateModelExtent(hero)
  fs.writeFileSync(cleanedHeroPath, Buffer.from(hero.saveMdx()))
  console.log(`cleaned monkey king preview model: ${cleanedHeroPath}`)
}

function cleanAntiMagePreviewModel() {
  const { parsers } = require('mdx-m3-viewer/dist/cjs')
  const originalModelPath = path.join(premiumRoot, 'anti-mage-shinyblades', 'AMModel.mdx')
  const cleanedModelPath = path.join(premiumRoot, 'anti-mage-shinyblades', 'AMModel.preview.mdx')

  if (!fs.existsSync(originalModelPath)) {
    return
  }

  const model = new parsers.mdlx.Model()
  model.load(fs.readFileSync(originalModelPath))
  model.geosets = model.geosets.filter((geoset) => geoset.materialId !== 2 && geoset.materialId !== 7)
  recalculateModelExtent(model)
  fs.writeFileSync(cleanedModelPath, Buffer.from(model.saveMdx()))
  console.log(`cleaned anti-mage preview model: ${cleanedModelPath}`)
}

function cleanSlarkPreviewModel() {
  const { parsers } = require('mdx-m3-viewer/dist/cjs')
  const originalModelPath = path.join(premiumRoot, 'slark-dreameater', 'DreamEater.MDX')
  const cleanedModelPath = path.join(premiumRoot, 'slark-dreameater', 'DreamEater.clean.MDX')

  if (!fs.existsSync(originalModelPath)) {
    return
  }

  fs.rmSync(path.join(premiumRoot, 'slark-dreameater', 'DreamEater.preview.MDX'), { force: true })

  const model = new parsers.mdlx.Model()
  model.load(fs.readFileSync(originalModelPath))
  model.geosets = model.geosets.filter((geoset) => geoset.materialId !== 3)
  recalculateModelExtent(model)
  fs.writeFileSync(cleanedModelPath, Buffer.from(model.saveMdx()))
  console.log(`cleaned slark preview model: ${cleanedModelPath}`)
}

function main() {
  fs.mkdirSync(sharedRoot, { recursive: true })
  cleanMonkeyKingPreviewModels()
  cleanAntiMagePreviewModel()
  cleanSlarkPreviewModel()

  let seeds = parseSeedEntries()
  const sanitized = seeds.map((seed) => sanitizePreviewModel(seed)).filter(Boolean)

  if (sanitized.length > 0) {
    console.log('=== sanitized preview helper planes ===')
    for (const result of sanitized) {
      console.log(
        `${result.id}\tremoved=${result.removed}\tentry=${result.previewEntry}\tshopData=${result.shopDataUpdated ? 'updated' : 'unchanged'}`,
      )
    }
    seeds = parseSeedEntries()
  }

  const sourceRoots = [premiumRoot, sharedRoot, ...externalRoots].filter((root) => fs.existsSync(root))
  const sourceIndex = buildSourceIndex(sourceRoots)
  const results = seeds.map((seed) => syncProductDependencies(seed, sourceIndex))
  buildModelBoundsManifest(seeds)

  const safe = results.filter((result) => result.unresolved.length === 0).map((result) => result.id)
  const partial = results
    .filter((result) => result.unresolved.length > 0)
    .map((result) => `${result.id}\t${result.unresolved.length}\t${result.unresolved.slice(0, 12).join(', ')}`)

  console.log('=== preview-safe ===')
  for (const id of safe) {
    console.log(id)
  }

  console.log('\n=== unresolved ===')
  for (const line of partial) {
    console.log(line)
  }

  buildWc3AssetManifest()
}

main()
