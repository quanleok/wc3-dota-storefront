import fsp from 'node:fs/promises'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const projectDir = path.resolve(scriptDir, '..')
const dotaRoot = process.env.DOTA_ROOT ?? path.resolve(projectDir, '../dota')
const outputRoot = path.join(dotaRoot, 'site-assets', 'w3dotashop-public', 'audio', 'final')

function runFfmpeg(outputName, filter, duration) {
  const outputPath = path.join(outputRoot, outputName)

  execFileSync('ffmpeg', [
    '-y',
    '-f',
    'lavfi',
    '-i',
    filter,
    '-t',
    String(duration),
    '-af',
    'afade=t=in:st=0:d=0.02,afade=t=out:st=' + Math.max(duration - 0.2, 0.05) + ':d=0.2,loudnorm=I=-22:TP=-2:LRA=9',
    '-ar',
    '44100',
    '-ac',
    '2',
    '-codec:a',
    'libmp3lame',
    '-b:a',
    '160k',
    outputPath,
  ], { stdio: 'inherit' })

  return outputPath
}

async function main() {
  await fsp.mkdir(outputRoot, { recursive: true })

  const cues = [
    {
      name: 'ui-select.mp3',
      duration: 0.22,
      filter:
        'sine=frequency=720:sample_rate=44100:duration=0.22,volume=0.16,aecho=0.45:0.35:42:0.22',
    },
    {
      name: 'ui-panel.mp3',
      duration: 0.45,
      filter:
        'sine=frequency=164:sample_rate=44100:duration=0.45,volume=0.18,aecho=0.5:0.32:78:0.22,lowpass=f=900',
    },
    {
      name: 'ui-deny.mp3',
      duration: 0.34,
      filter:
        'sine=frequency=146:sample_rate=44100:duration=0.34,volume=0.18,aecho=0.45:0.28:54:0.2,lowpass=f=650',
    },
    {
      name: 'add-to-stash.mp3',
      duration: 0.82,
      filter:
        'aevalsrc=0.13*sin(2*PI*392*t)*between(t\\,0\\,0.28)+0.11*sin(2*PI*588*t)*between(t\\,0.08\\,0.45)+0.08*sin(2*PI*784*t)*between(t\\,0.16\\,0.72):sample_rate=44100:duration=0.82,aecho=0.55:0.36:96:0.28',
    },
    {
      name: 'rare-inspect.mp3',
      duration: 1.15,
      filter:
        'aevalsrc=0.10*sin(2*PI*330*t)*between(t\\,0\\,0.5)+0.10*sin(2*PI*495*t)*between(t\\,0.12\\,0.72)+0.08*sin(2*PI*742*t)*between(t\\,0.28\\,1.05):sample_rate=44100:duration=1.15,aecho=0.62:0.42:135:0.32,highpass=f=130',
    },
    {
      name: 'checkout-success.mp3',
      duration: 1.55,
      filter:
        'aevalsrc=0.10*sin(2*PI*196*t)*between(t\\,0\\,0.85)+0.10*sin(2*PI*392*t)*between(t\\,0.12\\,1.0)+0.085*sin(2*PI*587.33*t)*between(t\\,0.36\\,1.35)+0.07*sin(2*PI*783.99*t)*between(t\\,0.72\\,1.55):sample_rate=44100:duration=1.55,aecho=0.58:0.38:168:0.34',
    },
    {
      name: 'shop-ambience.mp3',
      duration: 30,
      filter:
        'aevalsrc=0.034*sin(2*PI*55*t)+0.022*sin(2*PI*82.4*t)+0.012*sin(2*PI*164.8*t)+0.006*sin(2*PI*329.6*t)*sin(2*PI*0.07*t):sample_rate=44100:duration=30,aecho=0.55:0.32:680:0.25,lowpass=f=1300',
    },
    {
      name: 'stash-ambience.mp3',
      duration: 30,
      filter:
        'aevalsrc=0.038*sin(2*PI*49*t)+0.024*sin(2*PI*98*t)+0.012*sin(2*PI*196*t)*sin(2*PI*0.05*t)+0.006*sin(2*PI*392*t)*sin(2*PI*0.09*t):sample_rate=44100:duration=30,aecho=0.56:0.34:720:0.26,lowpass=f=1100',
    },
    {
      name: 'gate-ambience.mp3',
      duration: 30,
      filter:
        'aevalsrc=0.036*sin(2*PI*43.65*t)+0.023*sin(2*PI*87.3*t)+0.014*sin(2*PI*174.6*t)*sin(2*PI*0.06*t)+0.006*sin(2*PI*523.25*t)*sin(2*PI*0.04*t):sample_rate=44100:duration=30,aecho=0.6:0.38:820:0.28,lowpass=f=1000',
    },
  ]

  for (const cue of cues) {
    const outputPath = runFfmpeg(cue.name, cue.filter, cue.duration)
    console.log(`Generated ${outputPath}`)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
