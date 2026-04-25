import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const projectDir = path.resolve(scriptDir, '..')
const dotaRoot = process.env.DOTA_ROOT ?? path.resolve(projectDir, '../dota')
const audioRoot = path.join(dotaRoot, 'site-assets', 'w3dotashop-public', 'audio')
const portalRoot = path.join(audioRoot, 'portal')
const portalRawRoot = path.join(portalRoot, 'suno-v5', 'raw')
const finalRoot = path.join(audioRoot, 'final')

const portalSpecs = [
  { name: 'stone-grab.mp3', duration: 3, fadeIn: 0.04, fadeOut: 0.46 },
  { name: 'stone-socket-snap.mp3', duration: 3, fadeIn: 0.04, fadeOut: 0.52 },
  { name: 'rune-activate.mp3', duration: 5, fadeIn: 0.08, fadeOut: 0.85 },
  { name: 'rune-hum-loop.mp3', duration: 45, fadeIn: 0.9, fadeOut: 1.8, integratedLoudness: -20 },
  { name: 'gate-open-rumble.mp3', duration: 7, fadeIn: 0.08, fadeOut: 1.15 },
  { name: 'portal-success-chime.mp3', duration: 4, fadeIn: 0.04, fadeOut: 0.82 },
]

const finalCueSpecs = [
  { name: 'ui-select.mp3', fadeIn: 0.01, fadeOut: 0.08, integratedLoudness: -22 },
  { name: 'ui-panel.mp3', fadeIn: 0.015, fadeOut: 0.13, integratedLoudness: -22 },
  { name: 'ui-deny.mp3', fadeIn: 0.015, fadeOut: 0.12, integratedLoudness: -22 },
  { name: 'add-to-stash.mp3', fadeIn: 0.02, fadeOut: 0.28, integratedLoudness: -21 },
  { name: 'rare-inspect.mp3', fadeIn: 0.03, fadeOut: 0.36, integratedLoudness: -21 },
  { name: 'checkout-success.mp3', fadeIn: 0.03, fadeOut: 0.48, integratedLoudness: -21 },
]

const voiceSpecs = [
  { name: 'voice-gate-open.mp3', fadeIn: 0.02, fadeOut: 0.32, integratedLoudness: -20 },
  { name: 'voice-shop-open.mp3', fadeIn: 0.02, fadeOut: 0.28, integratedLoudness: -20 },
  { name: 'voice-stash-open.mp3', fadeIn: 0.02, fadeOut: 0.32, integratedLoudness: -20 },
  { name: 'voice-view-open.mp3', fadeIn: 0.02, fadeOut: 0.3, integratedLoudness: -20 },
]

function probeDuration(inputPath) {
  const output = execFileSync('ffprobe', [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'default=nk=1:nw=1',
    inputPath,
  ], { encoding: 'utf8' }).trim()

  const duration = Number.parseFloat(output)
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error(`Could not probe duration for ${inputPath}`)
  }

  return duration
}

function polishAudio({ inputPath, outputPath, duration, fadeIn, fadeOut, integratedLoudness = -18 }) {
  if (!fs.existsSync(inputPath)) {
    console.warn(`Skipping missing input: ${inputPath}`)
    return
  }

  const outputDuration = duration ?? probeDuration(inputPath)
  const safeFadeIn = Math.min(fadeIn, Math.max(outputDuration / 3, 0.01))
  const safeFadeOut = Math.min(fadeOut, Math.max(outputDuration / 2, 0.01))
  const fadeOutStart = Math.max(outputDuration - safeFadeOut, safeFadeIn + 0.01)
  const tmpPath = `${outputPath}.tmp-${process.pid}.mp3`

  execFileSync('ffmpeg', [
    '-y',
    '-i',
    inputPath,
    '-t',
    String(outputDuration),
    '-af',
    [
      `afade=t=in:st=0:d=${safeFadeIn}`,
      `afade=t=out:st=${fadeOutStart}:d=${safeFadeOut}`,
      `loudnorm=I=${integratedLoudness}:TP=-1.8:LRA=10`,
    ].join(','),
    '-ar',
    '44100',
    '-ac',
    '2',
    '-codec:a',
    'libmp3lame',
    '-b:a',
    '192k',
    tmpPath,
  ], { stdio: 'ignore' })

  fs.renameSync(tmpPath, outputPath)
  console.log(`Polished ${path.relative(audioRoot, outputPath)} (${outputDuration.toFixed(2)}s)`)
}

for (const spec of portalSpecs) {
  const rawPath = path.join(portalRawRoot, spec.name)
  polishAudio({
    ...spec,
    inputPath: fs.existsSync(rawPath) ? rawPath : path.join(portalRoot, spec.name),
    outputPath: path.join(portalRoot, spec.name),
  })
}

for (const spec of finalCueSpecs) {
  const inputPath = path.join(finalRoot, spec.name)
  polishAudio({
    ...spec,
    inputPath,
    outputPath: inputPath,
  })
}

for (const spec of voiceSpecs) {
  const inputPath = path.join(audioRoot, spec.name)
  polishAudio({
    ...spec,
    inputPath,
    outputPath: inputPath,
  })
}
