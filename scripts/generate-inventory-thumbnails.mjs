import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { parsers } = require('mdx-m3-viewer/dist/cjs')

global.ImageData ??= class ImageData {
  constructor(widthOrData, width, height) {
    if (typeof widthOrData === 'number') {
      this.width = widthOrData
      this.height = width
      this.data = new Uint8ClampedArray(this.width * this.height * 4)
    } else {
      this.data = widthOrData
      this.width = width
      this.height = height
    }
  }
}

const dotaRoot = process.env.DOTA_ROOT ?? '/Users/quan/Downloads/dota'
const siteAssetRoot = path.join(dotaRoot, 'site-assets', 'w3dotashop-public')
const outputRoot = path.join(siteAssetRoot, 'inventory-thumbnails')
const searchRoots = [
  siteAssetRoot,
  path.join(siteAssetRoot, 'wc3-textures'),
  path.join(dotaRoot, 'maps', 'active', 'dota_v689q_extracted'),
  path.join(dotaRoot, 'assets', 'libraries', 'skins_library'),
]

const thumbnailSources = {
  'pudge-plague-titan': 'models-premium/pudge-arcane/pudge_portrait.blp',
  'faceless-void-chrono-king': 'ReplaceableTextures/CommandButtons/BTNVoidWalk.blp',
  'axe-grommash-overlord': 'ReplaceableTextures/CommandButtons/BTNHellScream.blp',
  'earthshaker-magma-warden': 'ReplaceableTextures/CommandButtons/BTNHeroTaurenChieftain.blp',
  'slark-dreameater': 'ReplaceableTextures/CommandButtons/BTNSlarkDance.blp',
  'morphling-tidal-emperor': 'ReplaceableTextures/CommandButtons/btnseaelemental.blp',
  'tusk-turtle-breaker': 'ReplaceableTextures/CommandButtons/BTNTuskPunch.blp',
  'slardar-tidebaron': 'ReplaceableTextures/CommandButtons/btnnagamyrmidon.blp',
  'ursa-cursed-blood': 'ReplaceableTextures/CommandButtons/btnfrostbear.blp',
  'monkey-king-arcane-regent': 'ReplaceableTextures/CommandButtons/BTNMKHero.blp',
  'riki-red-blade': 'ReplaceableTextures/CommandButtons/BTNRikiINV.blp',
  'sniper-golden-huntsman': 'ReplaceableTextures/CommandButtons/BTNRifleman.blp',
  'storm-spirit-golden-tempest': 'ReplaceableTextures/CommandButtons/BTNStorm.blp',
  'invoker-dark-star-ritualist': 'ReplaceableTextures/CommandButtons/btnherobloodelfprince.blp',
  'zeus-storm-king-ascendant': 'ReplaceableTextures/CommandButtons/BTNZeusHero.blp',
  'faceless-void-deepwater': 'ReplaceableTextures/CommandButtons/btnfacelessone.blp',
  'juggernaut-wandering-swordsman': 'ReplaceableTextures/CommandButtons/BTNHeroBlademaster.blp',
  'anti-mage-rift-hunter': 'ReplaceableTextures/CommandButtons/BTNHeroDemonHunter.blp',
  'legion-commander-terenas': 'ReplaceableTextures/CommandButtons/BTNHeroPaladin.blp',
  'windranger-bloodelf': 'ReplaceableTextures/CommandButtons/BTNSylvanusWindRunner.blp',
  'luna-dark-eclipse': 'ReplaceableTextures/CommandButtons/BTNHuntress.blp',
  'lone-druid-iceborn': 'ReplaceableTextures/CommandButtons/BTNKeeperOfTheGrove.blp',
  'invoker-pandaren-sage': 'ReplaceableTextures/CommandButtons/btnpandarenbrewmaster.blp',
  'enigma-singularity-lord': 'ReplaceableTextures/CommandButtons/BTNEnigma.blp',
}

function resolveSource(relativePath) {
  for (const root of searchRoots) {
    const sourcePath = path.join(root, relativePath)

    if (fs.existsSync(sourcePath)) {
      return sourcePath
    }
  }

  return null
}

function convertBlpToPng(sourcePath, outputPath) {
  const image = new parsers.blp.Image()
  image.load(Uint8Array.from(fs.readFileSync(sourcePath)))
  const mipmap = image.getMipmap(0)
  const rawPath = path.join('/tmp', `w3dotashop-${path.basename(outputPath, '.png')}.rgba`)

  fs.writeFileSync(rawPath, Buffer.from(mipmap.data.buffer))
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  execFileSync('magick', [
    '-size',
    `${mipmap.width}x${mipmap.height}`,
    '-depth',
    '8',
    `rgba:${rawPath}`,
    '-filter',
    'point',
    '-resize',
    '256x256!',
    '-strip',
    outputPath,
  ])
  fs.rmSync(rawPath, { force: true })
}

function main() {
  fs.mkdirSync(outputRoot, { recursive: true })

  for (const [productId, relativePath] of Object.entries(thumbnailSources)) {
    const sourcePath = resolveSource(relativePath)

    if (!sourcePath) {
      throw new Error(`Could not find thumbnail source for ${productId}: ${relativePath}`)
    }

    const outputPath = path.join(outputRoot, `${productId}.png`)
    convertBlpToPng(sourcePath, outputPath)
    console.log(`${productId} <- ${sourcePath}`)
  }

  console.log(`inventory thumbnails: ${Object.keys(thumbnailSources).length} files`)
  console.log(outputRoot)
}

main()
