import fs from 'node:fs'
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { execFileSync, spawn } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const projectDir = path.resolve(scriptDir, '..')
const dotaRoot = process.env.DOTA_ROOT ?? path.resolve(projectDir, '../dota')
const defaultOutputRoot = path.join(dotaRoot, 'site-assets', 'w3dotashop-public', 'inventory-videos')

const DEFAULT_OPTIONS = {
  baseUrl: 'http://127.0.0.1:5175',
  duration: 5,
  fps: 30,
  width: 768,
  height: 768,
  outputRoot: defaultOutputRoot,
  timeoutMs: 90_000,
  warmupMs: 650,
  browserChannel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome',
  skipExisting: false,
  webm: false,
}

function printHelp() {
  console.log(`Generate clean shop preview videos from the /capture/:productId route.

Usage:
  npm run assets:videos
  npm run assets:videos -- pudge-plague-titan anti-mage-rift-hunter
  npm run assets:videos -- --size=960x720 --duration=6 --fps=30 --webm

Options:
  --base-url=http://127.0.0.1:5175
  --size=768x768
  --duration=5
  --fps=30
  --out=/Users/quan/Downloads/dota/site-assets/w3dotashop-public/inventory-videos
  --timeout=90000
  --warmup=650
  --channel=chrome
  --skip-existing
  --webm
`)
}

function parseSize(value) {
  const match = value.match(/^(\d+)x(\d+)$/i)

  if (!match) {
    throw new Error(`Invalid --size value "${value}". Use WIDTHxHEIGHT, for example 768x768.`)
  }

  return {
    width: Number(match[1]),
    height: Number(match[2]),
  }
}

function parseArgs(argv) {
  const options = { ...DEFAULT_OPTIONS }
  const productIds = []

  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      printHelp()
      process.exit(0)
    }

    if (arg === '--skip-existing') {
      options.skipExisting = true
      continue
    }

    if (arg === '--webm') {
      options.webm = true
      continue
    }

    if (arg.startsWith('--base-url=')) {
      options.baseUrl = arg.slice('--base-url='.length).replace(/\/+$/, '')
      continue
    }

    if (arg.startsWith('--duration=')) {
      options.duration = Number(arg.slice('--duration='.length))
      continue
    }

    if (arg.startsWith('--fps=')) {
      options.fps = Number(arg.slice('--fps='.length))
      continue
    }

    if (arg.startsWith('--size=')) {
      Object.assign(options, parseSize(arg.slice('--size='.length)))
      continue
    }

    if (arg.startsWith('--out=')) {
      options.outputRoot = path.resolve(arg.slice('--out='.length))
      continue
    }

    if (arg.startsWith('--timeout=')) {
      options.timeoutMs = Number(arg.slice('--timeout='.length))
      continue
    }

    if (arg.startsWith('--warmup=')) {
      options.warmupMs = Number(arg.slice('--warmup='.length))
      continue
    }

    if (arg.startsWith('--channel=')) {
      options.browserChannel = arg.slice('--channel='.length)
      continue
    }

    if (arg.startsWith('--')) {
      throw new Error(`Unknown option "${arg}".`)
    }

    productIds.push(arg)
  }

  if (!Number.isFinite(options.duration) || options.duration <= 0) {
    throw new Error('--duration must be a positive number.')
  }

  if (!Number.isFinite(options.fps) || options.fps <= 0) {
    throw new Error('--fps must be a positive number.')
  }

  return { options, productIds }
}

function readAllProductIds() {
  const source = fs.readFileSync(path.join(projectDir, 'src', 'shopData.ts'), 'utf8')
  const productsBlock = source.match(/const SEEDED_PRODUCTS:[\s\S]*?\n]\n\nexport const SHOP_PRODUCTS/)

  if (!productsBlock) {
    throw new Error('Could not find SEEDED_PRODUCTS in src/shopData.ts.')
  }

  return [...productsBlock[0].matchAll(/\bid:\s*'([^']+)'/g)].map((match) => match[1])
}

async function importPlaywright() {
  try {
    return await import('playwright')
  } catch {}

  const fallbackPackages = [
    process.env.PLAYWRIGHT_PACKAGE,
    path.join(os.homedir(), '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'node', 'node_modules', 'playwright'),
    path.join(os.homedir(), '.hermes', 'hermes-agent', 'node_modules', 'playwright'),
  ].filter(Boolean)

  for (const packageDir of fallbackPackages) {
    const packageJsonPath = path.join(packageDir, 'package.json')
    const moduleEntryPath = path.join(packageDir, 'index.mjs')

    if (!fs.existsSync(packageJsonPath) || !fs.existsSync(moduleEntryPath)) {
      continue
    }

    try {
      console.log(`Using Playwright from ${packageDir}`)
      return await import(pathToFileURL(moduleEntryPath).href)
    } catch {}
  }

  throw new Error(
    'Playwright is not available to this project or the known local runtime paths. Set PLAYWRIGHT_PACKAGE=/path/to/node_modules/playwright or install it with npm install --save-dev playwright.',
  )
}

function assertFfmpeg() {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' })
  } catch {
    throw new Error('ffmpeg is required to encode preview MP4s, but it was not found on PATH.')
  }
}

async function canReach(url) {
  try {
    const response = await fetch(url, { method: 'HEAD' })
    return response.ok
  } catch {
    return false
  }
}

async function waitForServer(url, timeoutMs) {
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    if (await canReach(url)) {
      return true
    }

    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  return false
}

async function ensureServer(baseUrl) {
  if (await canReach(baseUrl)) {
    return null
  }

  const url = new URL(baseUrl)
  const child = spawn(
    'npm',
    ['run', 'dev', '--', '--host', url.hostname, '--port', url.port || '5175'],
    {
      cwd: projectDir,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )

  child.stdout.on('data', (chunk) => process.stdout.write(chunk))
  child.stderr.on('data', (chunk) => process.stderr.write(chunk))

  if (!(await waitForServer(baseUrl, 30_000))) {
    child.kill()
    throw new Error(`Timed out waiting for Vite at ${baseUrl}.`)
  }

  return child
}

function encodeMp4(rawVideoPath, outputPath, startSeconds, options) {
  const scaleFilter = [
    `fps=${options.fps}`,
    `scale=${options.width}:${options.height}:force_original_aspect_ratio=decrease`,
    `pad=${options.width}:${options.height}:(ow-iw)/2:(oh-ih)/2:black`,
    'format=yuv420p',
  ].join(',')

  execFileSync(
    'ffmpeg',
    [
      '-y',
      '-i',
      rawVideoPath,
      '-ss',
      startSeconds.toFixed(3),
      '-t',
      options.duration.toFixed(3),
      '-an',
      '-vf',
      scaleFilter,
      '-c:v',
      'libx264',
      '-preset',
      'medium',
      '-crf',
      '20',
      '-movflags',
      '+faststart',
      outputPath,
    ],
    { stdio: 'ignore' },
  )
}

function encodeWebm(rawVideoPath, outputPath, startSeconds, options) {
  const scaleFilter = [
    `fps=${options.fps}`,
    `scale=${options.width}:${options.height}:force_original_aspect_ratio=decrease`,
    `pad=${options.width}:${options.height}:(ow-iw)/2:(oh-ih)/2:black`,
  ].join(',')

  execFileSync(
    'ffmpeg',
    [
      '-y',
      '-i',
      rawVideoPath,
      '-ss',
      startSeconds.toFixed(3),
      '-t',
      options.duration.toFixed(3),
      '-an',
      '-vf',
      scaleFilter,
      '-c:v',
      'libvpx-vp9',
      '-b:v',
      '0',
      '-crf',
      '34',
      outputPath,
    ],
    { stdio: 'ignore' },
  )
}

async function captureProduct(browser, productId, options) {
  const outputPath = path.join(options.outputRoot, `${productId}.mp4`)
  const posterPath = path.join(options.outputRoot, `${productId}.png`)

  if (options.skipExisting && fs.existsSync(outputPath) && fs.existsSync(posterPath)) {
    console.log(`skip ${productId}`)
    return
  }

  const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), `w3dotashop-preview-${productId}-`))
  const context = await browser.newContext({
    deviceScaleFactor: 1,
    viewport: { width: options.width, height: options.height },
    recordVideo: {
      dir: tempDir,
      size: { width: options.width, height: options.height },
    },
  })
  const page = await context.newPage()
  const startedAt = Date.now()
  const captureUrl = `${options.baseUrl}/capture/${encodeURIComponent(productId)}`

  try {
    await page.goto(captureUrl, { waitUntil: 'domcontentloaded', timeout: options.timeoutMs })
    await page.waitForSelector('[data-capture-state="ready"]', { timeout: options.timeoutMs })
    await page.waitForTimeout(options.warmupMs)

    const cleanStartSeconds = Math.max(0, (Date.now() - startedAt) / 1000 - 0.1)
    await page.screenshot({ path: posterPath, type: 'png' })
    await page.waitForTimeout(options.duration * 1000)

    const rawVideo = page.video()
    await context.close()
    const rawVideoPath = rawVideo ? await rawVideo.path() : ''

    if (!rawVideoPath || !fs.existsSync(rawVideoPath)) {
      throw new Error(`Playwright did not write a raw video for ${productId}.`)
    }

    encodeMp4(rawVideoPath, outputPath, cleanStartSeconds, options)

    if (options.webm) {
      encodeWebm(rawVideoPath, path.join(options.outputRoot, `${productId}.webm`), cleanStartSeconds, options)
    }

    console.log(`${productId} -> ${outputPath}`)
  } finally {
    if (!page.isClosed()) {
      await page.close().catch(() => {})
    }

    await context.close().catch(() => {})
    await fsp.rm(tempDir, { recursive: true, force: true }).catch(() => {})
  }
}

async function main() {
  const { options, productIds } = parseArgs(process.argv.slice(2))
  const ids = productIds.length > 0 ? productIds : readAllProductIds()
  const { chromium } = await importPlaywright()

  assertFfmpeg()
  await fsp.mkdir(options.outputRoot, { recursive: true })

  const ownedServer = await ensureServer(options.baseUrl)
  const launchOptions =
    options.browserChannel && options.browserChannel !== 'bundled'
      ? { headless: true, channel: options.browserChannel }
      : { headless: true }
  const browser = await chromium.launch(launchOptions)

  try {
    for (const productId of ids) {
      await captureProduct(browser, productId, options)
    }
  } finally {
    await browser.close().catch(() => {})
    ownedServer?.kill()
  }

  console.log(`preview videos: ${ids.length} file(s)`)
  console.log(options.outputRoot)
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(message)
  process.exit(1)
})
