import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const projectDir = path.resolve(scriptDir, '..')
const dotaRoot = process.env.DOTA_ROOT ?? path.resolve(projectDir, '../dota')
const defaultOutputRoot = path.join(dotaRoot, 'site-assets', 'w3dotashop-public', 'audio', 'portal', 'suno-v5')
const defaultRawRoot = path.join(defaultOutputRoot, 'raw')

const DEFAULT_OPTIONS = {
  apiBaseUrl: 'https://api.evolink.ai/v1',
  model: 'suno-v5-beta',
  outputRoot: defaultOutputRoot,
  rawRoot: defaultRawRoot,
  pollMs: 5_000,
  timeoutMs: 240_000,
  variantIndex: 0,
  keepAll: false,
  run: false,
  install: false,
  trim: true,
}

const NEGATIVE_TAGS = [
  'vocals',
  'singing',
  'lyrics',
  'rap',
  'pop song',
  'cheerful',
  'comedy',
  'cartoon',
  'EDM drop',
  'dance beat',
  'modern radio',
  'sci-fi laser',
].join(', ')

const CUES = [
  {
    id: 'stone-grab',
    title: 'Rune Stone Grab',
    filename: 'stone-grab.mp3',
    duration: 3,
    fadeIn: 0.04,
    fadeOut: 0.46,
    style:
      'dark fantasy game sound design, short granite lift, stone friction, low tactile impact, no melody, no vocals',
    prompt:
      'A short one-shot sound effect for picking up a heavy rune stone: dry stone scrape, small gravel grit, one low weighty thump, dark Warcraft style dungeon tone.',
  },
  {
    id: 'stone-socket-snap',
    title: 'Rune Stone Socket Snap',
    filename: 'stone-socket-snap.mp3',
    duration: 3,
    fadeIn: 0.04,
    fadeOut: 0.52,
    style:
      'dark fantasy cinematic game SFX, heavy stone lock impact, granite mechanism, no vocals, no rhythm, no melody',
    prompt:
      'A heavy rune stone seats into an ancient circular gate lock: stone-on-stone slam, tight socket snap, brief dust burst, low resonant body.',
  },
  {
    id: 'rune-activate',
    title: 'Rune Activation Swell',
    filename: 'rune-activate.mp3',
    duration: 5,
    fadeIn: 0.08,
    fadeOut: 0.85,
    style:
      'dark fantasy magical activation, cyan rune energy, low stone resonance, cinematic SFX, no vocals, minimal music',
    prompt:
      'Ancient runes wake after alignment: low magical swell, subtle blue arcane shimmer, stone ring tension rising, no song structure.',
  },
  {
    id: 'rune-hum-loop',
    title: 'Rune Energy Hum Loop',
    filename: 'rune-hum-loop.mp3',
    duration: 45,
    loop: true,
    fadeIn: 0.9,
    fadeOut: 1.8,
    style:
      'seamless dark fantasy ambient loop, low rune hum, stone chamber resonance, subtle arcane electricity, no vocals',
    prompt:
      'A loopable low ambient rune-energy bed for an energized gate lock: steady dark hum, soft magical air, faint stone resonance, no melody.',
  },
  {
    id: 'gate-open-rumble',
    title: 'Ancient Gate Open Rumble',
    filename: 'gate-open-rumble.mp3',
    duration: 7,
    fadeIn: 0.08,
    fadeOut: 1.15,
    style:
      'dark fantasy cinematic sound design, massive stone door grinding, ancient mechanism, low rumble, no vocals',
    prompt:
      'A huge ancient stone gate opens: deep grinding stone, heavy mechanical rotation, dust and bass rumble, believable stone mass, no music beat.',
  },
  {
    id: 'portal-success-chime',
    title: 'Portal Success Chime',
    filename: 'portal-success-chime.mp3',
    duration: 4,
    fadeIn: 0.04,
    fadeOut: 0.82,
    style:
      'dark fantasy magical success sting, premium game UI reward, crystal rune chime, warm low tail, no vocals',
    prompt:
      'A short success confirmation after the gate opens: bright rune chime, magical bloom, restrained premium fantasy reward tail.',
  },
]

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return
  }

  const source = fs.readFileSync(filePath, 'utf8')

  for (const line of source.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) {
      continue
    }

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (!match) {
      continue
    }

    const key = match[1]
    let value = match[2].trim()

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    if (!process.env[key]) {
      process.env[key] = value
    }
  }
}

function printHelp() {
  console.log(`Generate portal sound-design candidates with Evolink Suno v5.

Dry-run is the default so credits are not spent accidentally.

Usage:
  npm run assets:audio:suno
  npm run assets:audio:suno -- --run stone-grab gate-open-rumble
  npm run assets:audio:suno -- --run --all --install

Environment:
  EVOLINK_API_KEY=...                    required with --run
  EVOLINK_API_BASE_URL=https://api.evolink.ai/v1
  EVOLINK_SUNO_MODEL=suno-v5-beta

Options:
  --run                                  submit real Evolink tasks
  --all                                  generate every cue
  --out=/path/to/output                  default: ${defaultOutputRoot}
  --raw=/path/to/raw                     default: <out>/raw
  --base-url=https://api.evolink.ai/v1
  --model=suno-v5-beta
  --variant=0                            result index to install
  --keep-all                             save all result variants
  --install                              copy processed files into audio/portal canonical names
  --no-trim                              keep downloaded files without ffmpeg trimming
  --timeout=240000
  --poll=5000
`)
}

function parseArgs(argv) {
  const options = { ...DEFAULT_OPTIONS }
  const cueIds = []

  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      printHelp()
      process.exit(0)
    }

    if (arg === '--run') {
      options.run = true
      continue
    }

    if (arg === '--all') {
      cueIds.splice(0, cueIds.length, ...CUES.map((cue) => cue.id))
      continue
    }

    if (arg === '--keep-all') {
      options.keepAll = true
      continue
    }

    if (arg === '--install') {
      options.install = true
      continue
    }

    if (arg === '--no-trim') {
      options.trim = false
      continue
    }

    if (arg.startsWith('--out=')) {
      options.outputRoot = path.resolve(arg.slice('--out='.length))
      continue
    }

    if (arg.startsWith('--raw=')) {
      options.rawRoot = path.resolve(arg.slice('--raw='.length))
      continue
    }

    if (arg.startsWith('--base-url=')) {
      options.apiBaseUrl = arg.slice('--base-url='.length).replace(/\/+$/, '')
      continue
    }

    if (arg.startsWith('--model=')) {
      options.model = arg.slice('--model='.length)
      continue
    }

    if (arg.startsWith('--variant=')) {
      options.variantIndex = Number(arg.slice('--variant='.length))
      continue
    }

    if (arg.startsWith('--timeout=')) {
      options.timeoutMs = Number(arg.slice('--timeout='.length))
      continue
    }

    if (arg.startsWith('--poll=')) {
      options.pollMs = Number(arg.slice('--poll='.length))
      continue
    }

    if (arg.startsWith('--')) {
      throw new Error(`Unknown option "${arg}".`)
    }

    cueIds.push(arg)
  }

  const envBaseUrl = process.env.EVOLINK_API_BASE_URL?.trim()
  const envModel = process.env.EVOLINK_SUNO_MODEL?.trim()

  if (envBaseUrl) {
    options.apiBaseUrl = envBaseUrl.replace(/\/+$/, '')
  }

  if (envModel) {
    options.model = envModel
  }

  if (!Number.isInteger(options.variantIndex) || options.variantIndex < 0) {
    throw new Error('--variant must be a non-negative integer.')
  }

  if (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0) {
    throw new Error('--timeout must be a positive number.')
  }

  if (!Number.isFinite(options.pollMs) || options.pollMs < 1000) {
    throw new Error('--poll must be at least 1000ms.')
  }

  const selectedCueIds = cueIds.length > 0 ? [...new Set(cueIds)] : ['stone-grab']
  const selectedCues = selectedCueIds.map((cueId) => {
    const cue = CUES.find((entry) => entry.id === cueId)
    if (!cue) {
      throw new Error(`Unknown cue "${cueId}". Known cues: ${CUES.map((entry) => entry.id).join(', ')}`)
    }

    return cue
  })

  return { options, selectedCues }
}

function requireApiKey() {
  const apiKey = process.env.EVOLINK_API_KEY?.trim()

  if (!apiKey) {
    throw new Error('EVOLINK_API_KEY is required with --run. Put it in .env.local or export it in your shell.')
  }

  return apiKey
}

function unwrapApiData(data) {
  return data?.data ?? data
}

function readTaskId(data) {
  const task = unwrapApiData(data)
  return task?.id ?? task?.task_id ?? task?.taskId
}

function normalizeResultUrls(results) {
  if (!Array.isArray(results)) {
    return []
  }

  return results
    .map((result) => {
      if (typeof result === 'string') {
        return result
      }

      return result?.url ?? result?.audio_url ?? result?.audioUrl ?? result?.source_url ?? result?.sourceUrl
    })
    .filter((url) => typeof url === 'string' && url.length > 0)
}

function normalizeTask(data) {
  const task = unwrapApiData(data)
  const nestedResults = task?.result?.results ?? task?.result?.urls ?? task?.result?.audio_urls

  return {
    ...task,
    id: readTaskId(task),
    status: task?.status,
    progress: task?.progress,
    results: normalizeResultUrls(task?.results ?? nestedResults ?? task?.audio_urls ?? task?.audioUrls),
  }
}

function buildRequestBody(cue, model) {
  return {
    model,
    custom_mode: true,
    instrumental: true,
    prompt: cue.prompt,
    style: cue.style,
    title: cue.title,
    negative_tags: NEGATIVE_TAGS,
    style_weight: 0.8,
    weirdness_constraint: 0.2,
    audio_weight: 0.6,
  }
}

async function apiFetch(url, apiKey, init = {}) {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  })

  const text = await response.text()
  let data = null

  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = { raw: text }
    }
  }

  if (!response.ok) {
    const message = data?.error?.message ?? data?.message ?? response.statusText
    throw new Error(`Evolink ${response.status}: ${message}`)
  }

  return data
}

async function submitCue(cue, options, apiKey) {
  const body = buildRequestBody(cue, options.model)
  const response = await apiFetch(`${options.apiBaseUrl}/audios/generations`, apiKey, {
    method: 'POST',
    body: JSON.stringify(body),
  })
  const task = normalizeTask(response)

  if (!task.id) {
    throw new Error(`Evolink did not return a task id for ${cue.id}.`)
  }

  return { task, body }
}

async function pollTask(taskId, options, apiKey) {
  const startedAt = Date.now()

  while (Date.now() - startedAt < options.timeoutMs) {
    const response = await apiFetch(`${options.apiBaseUrl}/tasks/${encodeURIComponent(taskId)}`, apiKey)
    const task = normalizeTask(response)

    console.log(`${taskId}: ${task.status}${Number.isFinite(task.progress) ? ` ${task.progress}%` : ''}`)

    if (task.status === 'completed') {
      if (!Array.isArray(task.results) || task.results.length === 0) {
        throw new Error(`${taskId} completed without result URLs.`)
      }

      return task
    }

    if (task.status === 'failed') {
      const message = task.error?.message ?? task.error?.code ?? 'task failed'
      throw new Error(`${taskId} failed: ${message}`)
    }

    await new Promise((resolve) => setTimeout(resolve, options.pollMs))
  }

  throw new Error(`${taskId} did not complete before timeout.`)
}

function assertFfmpeg() {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

async function downloadFile(url, outputPath) {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Failed to download result ${response.status}: ${response.statusText}`)
  }

  const bytes = Buffer.from(await response.arrayBuffer())
  await fsp.writeFile(outputPath, bytes)
}

function processAudio(inputPath, outputPath, cue) {
  const fadeIn = Math.min(cue.fadeIn ?? 0.04, Math.max(cue.duration / 3, 0.01))
  const fadeOut = Math.min(cue.fadeOut ?? (cue.loop ? 1.2 : 0.36), Math.max(cue.duration / 2, 0.01))
  const fadeOutStart = Math.max(cue.duration - fadeOut, fadeIn + 0.01)
  const filters = [
    `afade=t=in:st=0:d=${fadeIn}`,
    `afade=t=out:st=${fadeOutStart}:d=${fadeOut}`,
    'loudnorm=I=-18:TP=-1.5:LRA=10',
  ].join(',')

  execFileSync('ffmpeg', [
    '-y',
    '-i',
    inputPath,
    '-t',
    String(cue.duration),
    '-af',
    filters,
    '-ar',
    '44100',
    '-ac',
    '2',
    '-codec:a',
    'libmp3lame',
    '-b:a',
    '192k',
    outputPath,
  ], { stdio: 'inherit' })
}

async function writeMetadata(cue, task, requestBody, options, resultUrls) {
  const metadataPath = path.join(options.outputRoot, `${cue.id}.json`)
  const metadata = {
    cue: cue.id,
    title: cue.title,
    filename: cue.filename,
    model: options.model,
    evolinkTaskId: task.id,
    generatedAt: new Date().toISOString(),
    resultUrls,
    request: {
      ...requestBody,
      negative_tags: NEGATIVE_TAGS,
    },
  }

  await fsp.writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`)
}

async function generateCue(cue, options, apiKey, ffmpegAvailable) {
  console.log(`Submitting ${cue.id} (${cue.title})`)
  const { task, body } = await submitCue(cue, options, apiKey)
  console.log(`${cue.id}: task ${task.id}`)

  const completedTask = await pollTask(task.id, options, apiKey)
  const resultUrls = completedTask.results
  const selectedUrls = options.keepAll ? resultUrls : [resultUrls[options.variantIndex] ?? resultUrls[0]]

  await writeMetadata(cue, completedTask, body, options, resultUrls)

  for (let index = 0; index < selectedUrls.length; index += 1) {
    const url = selectedUrls[index]
    const suffix = options.keepAll ? `-v${index + 1}` : ''
    const rawPath = path.join(options.rawRoot, `${cue.id}${suffix}.mp3`)
    const outputPath = path.join(options.outputRoot, `${cue.id}${suffix}.mp3`)

    console.log(`${cue.id}: downloading variant ${index + 1}`)
    await downloadFile(url, rawPath)

    if (options.trim && ffmpegAvailable) {
      processAudio(rawPath, outputPath, cue)
    } else {
      await fsp.copyFile(rawPath, outputPath)
    }

    if (options.install && !suffix) {
      const canonicalPath = path.join(path.dirname(options.outputRoot), cue.filename)
      await fsp.copyFile(outputPath, canonicalPath)
      console.log(`${cue.id}: installed ${canonicalPath}`)
    }
  }
}

async function main() {
  loadEnvFile(path.join(projectDir, '.env.local'))
  loadEnvFile(path.join(projectDir, '.env'))

  const { options, selectedCues } = parseArgs(process.argv.slice(2))
  await fsp.mkdir(options.outputRoot, { recursive: true })
  await fsp.mkdir(options.rawRoot, { recursive: true })

  if (!options.run) {
    console.log('Dry run only. Add --run to submit Evolink Suno tasks.')
    console.log(`Model: ${options.model}`)
    console.log(`Output: ${options.outputRoot}`)
    console.log('Cues:')
    selectedCues.forEach((cue) => {
      console.log(`- ${cue.id}: ${cue.title} -> ${cue.filename}`)
      console.log(`  ${cue.prompt}`)
    })
    return
  }

  const apiKey = requireApiKey()
  const ffmpegAvailable = options.trim ? assertFfmpeg() : false

  if (options.trim && !ffmpegAvailable) {
    console.warn('ffmpeg not found. Raw downloads will be copied without trimming.')
  }

  for (const cue of selectedCues) {
    await generateCue(cue, options, apiKey, ffmpegAvailable)
  }

  console.log('Done.')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
