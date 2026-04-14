export const CATEGORY_LIST = ['Video', 'Image', 'Utility'] as const

export type Category = (typeof CATEGORY_LIST)[number]

export type ProviderId = 'openai' | 'anthropic' | 'replicate' | 'elevenlabs'
export type AppVisibility = 'public' | 'private'
export type AppSourceType = 'desktop' | 'html' | 'repo' | 'link' | 'package' | 'config'

export interface ProviderField {
  id: ProviderId
  label: string
  placeholder: string
  helper: string
}

export interface AppRequirement {
  kind: 'provider' | 'env'
  key: string
  label: string
  helper: string
}

export interface AppPreview {
  eyebrow: string
  title: string
  note: string
}

export interface ShareApp {
  id: string
  name: string
  monogram: string
  shortDescription: string
  description: string
  category: Category
  visibility: AppVisibility
  creator: string
  popularity: number
  publishedAt: string
  accent: string
  tint: string
  requirements: AppRequirement[]
  previews: AppPreview[]
  sourceType: AppSourceType
  sourceValue: string
  owner: boolean
  status: string
  metaLabel: string
}

export interface CustomEnvVariable {
  name: string
  value: string
  note: string
}

export type CredentialMap = Record<ProviderId, string>

export interface PrototypeState {
  apps: ShareApp[]
  favorites: string[]
  credentials: CredentialMap
  customEnv: CustomEnvVariable[]
}

export const PROVIDER_FIELDS: ProviderField[] = [
  {
    id: 'openai',
    label: 'OpenAI API key',
    placeholder: 'sk-...',
    helper: 'Saved once if any uploaded app needs OpenAI later.',
  },
  {
    id: 'anthropic',
    label: 'Anthropic API key',
    placeholder: 'sk-ant-...',
    helper: 'Saved once if any uploaded app needs Anthropic later.',
  },
  {
    id: 'replicate',
    label: 'Replicate key',
    placeholder: 'r8_...',
    helper: 'Saved once if any uploaded app needs Replicate later.',
  },
  {
    id: 'elevenlabs',
    label: 'ElevenLabs key',
    placeholder: 'elv_...',
    helper: 'Saved once if any uploaded app needs ElevenLabs later.',
  },
]

export const DEFAULT_CREDENTIALS: CredentialMap = {
  openai: '',
  anthropic: '',
  replicate: '',
  elevenlabs: '',
}

export const DEFAULT_CUSTOM_ENV: CustomEnvVariable[] = []

export const SAMPLE_APPS: ShareApp[] = [
  {
    id: 'frame-grab',
    name: 'Frame Grab',
    monogram: 'FG',
    shortDescription: 'Lightweight popup to scrub a video and capture frames fast.',
    description:
      'Frame Grab is a real local macOS tool from your Desktop tools folder. Its Python source describes it as a lightweight popup for opening a video from Finder, scrubbing quickly, and saving still frames without extra overhead.',
    category: 'Video',
    visibility: 'public',
    creator: 'Quan',
    popularity: 3,
    publishedAt: '2026-04-13',
    accent: '#7bf7c7',
    tint: 'rgba(123, 247, 199, 0.12)',
    requirements: [],
    previews: [
      {
        eyebrow: 'Use',
        title: 'Scrub a video and capture frames',
        note: 'Designed for fast frame review with keyboard shortcuts and quick save actions.',
      },
      {
        eyebrow: 'Source',
        title: 'Python + Tkinter + OpenCV + Pillow',
        note: 'The source shows a desktop popup with frame seeking, right-click save, and output folder memory.',
      },
      {
        eyebrow: 'Workflow',
        title: 'Finder-open, capture, close',
        note: 'This tool is optimized for a very short local workflow rather than a large editing workspace.',
      },
    ],
    sourceType: 'desktop',
    sourceValue: '/Users/quan/Desktop/tools/Frame Grab.app',
    owner: true,
    status: 'Local tool',
    metaLabel: 'macOS app',
  },
  {
    id: 'frame-extractor',
    name: 'Frame Extractor',
    monogram: 'FE',
    shortDescription: 'Video player, frame extractor, and clip trimmer in one local GUI tool.',
    description:
      'Frame Extractor is a real local desktop app bundle backed by a larger Python source file in your tools folder. It combines frame export, clip trimming, video preview, and ffmpeg-driven utilities in a single interface.',
    category: 'Video',
    visibility: 'public',
    creator: 'Quan',
    popularity: 2,
    publishedAt: '2026-04-13',
    accent: '#7bf7c7',
    tint: 'rgba(123, 247, 199, 0.12)',
    requirements: [],
    previews: [
      {
        eyebrow: 'Use',
        title: 'Extract frames or trim clips',
        note: 'The tool combines single-frame capture, interval extraction, and clip export flows.',
      },
      {
        eyebrow: 'Source',
        title: 'Python + Tkinter + ffmpeg + OpenCV',
        note: 'The source includes ffprobe helpers, playback controls, and trimming commands.',
      },
      {
        eyebrow: 'Workflow',
        title: 'Open video, inspect, export',
        note: 'This is the heavier local video utility in the set, with playback and more advanced export behavior.',
      },
    ],
    sourceType: 'desktop',
    sourceValue: '/Users/quan/Desktop/tools/Frame Extractor.app',
    owner: true,
    status: 'Local tool',
    metaLabel: 'macOS app',
  },
  {
    id: 'spriteforge-split-clean',
    name: 'SpriteForge',
    monogram: 'SF',
    shortDescription: 'Split and clean sprite sheets into individual elements.',
    description:
      'SpriteForge comes from the real `sprite-splitter (1).html` file in your Desktop tools folder. The HTML title names it `SpriteForge — Split + Clean`, and the interface is built around dropping a sprite sheet, detecting the background, splitting elements, cleaning them, and downloading the selected outputs.',
    category: 'Image',
    visibility: 'public',
    creator: 'Quan',
    popularity: 1,
    publishedAt: '2026-04-05',
    accent: '#7bf7c7',
    tint: 'rgba(123, 247, 199, 0.12)',
    requirements: [],
    previews: [
      {
        eyebrow: 'Use',
        title: 'Drop a sprite sheet and split elements',
        note: 'The page supports drag-and-drop import, element detection, selection, and batch download.',
      },
      {
        eyebrow: 'Source',
        title: 'Single HTML tool with canvas processing',
        note: 'The file includes controls for color sensitivity, min size, padding, and background cleanup.',
      },
      {
        eyebrow: 'Workflow',
        title: 'Detect, clean, export',
        note: 'This is a focused local image utility rather than a backend-powered app.',
      },
    ],
    sourceType: 'html',
    sourceValue: '/Users/quan/Desktop/tools/sprite-splitter (1).html',
    owner: true,
    status: 'Local tool',
    metaLabel: 'HTML tool',
  },
]
