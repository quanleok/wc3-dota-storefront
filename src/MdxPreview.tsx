import { useEffect, useRef, useState } from 'react'
import type { MdxPreviewAsset } from './shopData'
import { assetUrl } from './assetUrl'
import viewerBundleUrl from 'mdx-m3-viewer/dist/umd/viewer.min.js?url'

interface MdxBounds {
  x: number
  y: number
  z: number
  r: number
}

interface MdxScene {
  alpha: boolean
  viewport: { [index: number]: number }
  camera: {
    perspective: (fov: number, aspect: number, near: number, far: number) => void
    moveToAndFace: (from: Float32Array, to: Float32Array, worldUp: Float32Array) => void
  }
  detach?: () => boolean
}

interface MdxModelInstance {
  model?: { bounds?: MdxBounds }
  frame?: number
  timeScale?: number
  clearEmittedObjects?: () => void
  setScene: (scene: MdxScene) => void
  setSequence?: (id: number) => void
  setSequenceLoopMode?: (mode: number) => void
}

interface MdxSequence {
  name?: string
  interval?: ArrayLike<number>
}

interface MdxModel {
  bounds?: MdxBounds
  sequences?: MdxSequence[]
  addInstance: () => MdxModelInstance
}

interface MdxViewerInstance {
  addHandler: (handler: unknown) => void
  addScene: () => MdxScene
  load: (entry: string, pathSolver: (src: string) => string) => Promise<MdxModel | undefined>
  on?: (eventName: 'error', listener: (event: unknown) => void) => void
  updateAndRender: (dt?: number) => void
}

interface MdxViewerLibrary {
  viewer?: {
    ModelViewer: new (canvas: HTMLCanvasElement) => MdxViewerInstance
    handlers: {
      mdx: unknown
      blp: unknown
    }
  }
}

declare global {
  interface Window {
    ModelViewer?: MdxViewerLibrary
  }
}

let viewerBundlePromise: Promise<MdxViewerLibrary> | null = null
let wc3AssetManifestPromise: Promise<Record<string, string>> | null = null
let wc3SiteAssetManifestPromise: Promise<Record<string, string>> | null = null
let wc3ModelBoundsManifestPromise: Promise<Record<string, MdxBounds>> | null = null

function loadViewerBundle() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('The MDX viewer can only run in a browser environment.'))
  }

  if (window.ModelViewer?.viewer?.ModelViewer) {
    return Promise.resolve(window.ModelViewer)
  }

  if (!viewerBundlePromise) {
    viewerBundlePromise = new Promise((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>('script[data-mdx-viewer-bundle="1"]')

      if (existing) {
        existing.addEventListener('load', () => resolve(window.ModelViewer ?? {}), { once: true })
        existing.addEventListener('error', () => reject(new Error('Failed to load the MDX viewer bundle.')), {
          once: true,
        })
        return
      }

      const script = document.createElement('script')
      script.src = viewerBundleUrl
      script.async = true
      script.dataset.mdxViewerBundle = '1'
      script.onload = () => resolve(window.ModelViewer ?? {})
      script.onerror = () => reject(new Error('Failed to load the MDX viewer bundle.'))
      document.head.appendChild(script)
    })
  }

  return viewerBundlePromise
}

function loadWc3AssetManifest() {
  if (!wc3AssetManifestPromise) {
    wc3AssetManifestPromise = fetch(assetUrl('/wc3-asset-manifest.json'))
      .then((response) => {
        if (!response.ok) {
          throw new Error(`WC3 asset manifest returned ${response.status}.`)
        }

        return response.json() as Promise<Record<string, string>>
      })
      .catch(() => ({}))
  }

  return wc3AssetManifestPromise
}

function loadWc3SiteAssetManifest() {
  if (!wc3SiteAssetManifestPromise) {
    wc3SiteAssetManifestPromise = fetch(assetUrl('/wc3-site-asset-manifest.json'))
      .then((response) => {
        if (!response.ok) {
          throw new Error(`WC3 site asset manifest returned ${response.status}.`)
        }

        return response.json() as Promise<Record<string, string>>
      })
      .catch(() => ({}))
  }

  return wc3SiteAssetManifestPromise
}

function loadWc3ModelBoundsManifest() {
  if (!wc3ModelBoundsManifestPromise) {
    wc3ModelBoundsManifestPromise = fetch(assetUrl('/wc3-model-bounds.json'))
      .then((response) => {
        if (!response.ok) {
          throw new Error(`WC3 model bounds manifest returned ${response.status}.`)
        }

        return response.json() as Promise<Record<string, MdxBounds>>
      })
      .catch(() => ({}))
  }

  return wc3ModelBoundsManifestPromise
}

interface MdxPreviewProps {
  asset: MdxPreviewAsset
  showControls?: boolean
  showStatus?: boolean
  initialAnimationSpeed?: number
  className?: string
  onReady?: () => void
}

type PreviewState = 'loading' | 'ready' | 'error'

interface OrbitState {
  yaw: number
  pitch: number
  distance: number
}

interface BoundsState {
  centerX: number
  centerY: number
  centerZ: number
  radius: number
}

interface SequenceOption {
  id: number
  label: string
}

const SHARED_TEXTURE_PREFIXES = [
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
  'objects/',
  'sound/',
  'terrainart/',
  'environment/',
  'selection/',
]

const CAMERA_FOV = Math.PI / 5.2

const DEFAULT_CAMERA = {
  yaw: -0.76,
  pitch: 0.16,
  targetZFactor: 0.04,
}

const DEFAULT_ANIMATION_SPEED = 1
const DEFAULT_FRAME_TIME_MS = 1000 / 60
const MAX_FRAME_TIME_MS = 50

function buildPath(
  basePath: string,
  src: string,
  wc3AssetManifest: Record<string, string>,
  wc3SiteAssetManifest: Record<string, string>,
) {
  if (/^(https?:)?\/\//i.test(src)) {
    return src
  }

  const normalized = src
    .replaceAll('\\', '/')
    .replace(/^\.?\//, '')
    .replace(/^\/+/, '')
  const normalizedLower = normalized.toLowerCase()
  const sharedManifestPath = resolveSharedManifestPath(normalizedLower, wc3AssetManifest)

  if (SHARED_TEXTURE_PREFIXES.some((prefix) => normalizedLower.startsWith(prefix))) {
    return assetUrl(`/wc3-textures/${sharedManifestPath ?? normalized}`)
  }

  const siteManifestPath = resolveSiteManifestPath(basePath, normalizedLower, wc3SiteAssetManifest)
  if (siteManifestPath) {
    return assetUrl(`/${siteManifestPath}`)
  }

  return `${basePath.replace(/\/$/, '')}/${normalized}`
}

function resolveSharedManifestPath(normalizedLower: string, wc3AssetManifest: Record<string, string>) {
  const exact = wc3AssetManifest[normalizedLower]
  if (exact) {
    return exact
  }

  const keys = Object.keys(wc3AssetManifest)
  const suffix = `/${normalizedLower}`
  const suffixMatches = keys.filter((key) => key.endsWith(suffix))

  if (suffixMatches.length === 1) {
    return wc3AssetManifest[suffixMatches[0]]
  }

  const fileName = normalizedLower.split('/').pop()
  if (!fileName || fileName === normalizedLower) {
    return undefined
  }

  const fileNameMatches = keys.filter((key) => key.endsWith(`/${fileName}`) || key === fileName)

  return fileNameMatches.length === 1 ? wc3AssetManifest[fileNameMatches[0]] : undefined
}

function normalizeSiteManifestBase(basePath: string) {
  return basePath
    .replace(/^https?:\/\/[^/]+/i, '')
    .replaceAll('\\', '/')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
    .replace(/[?#].*$/, '')
    .toLowerCase()
}

function resolveSiteManifestPath(
  basePath: string,
  normalizedLower: string,
  wc3SiteAssetManifest: Record<string, string>,
) {
  const normalizedBase = normalizeSiteManifestBase(basePath)
  const exactKey = `${normalizedBase}/${normalizedLower}`
  const exact = wc3SiteAssetManifest[exactKey]
  if (exact) {
    return exact
  }

  const keys = Object.keys(wc3SiteAssetManifest)
  const fileName = normalizedLower.split('/').pop()
  if (!fileName) {
    return undefined
  }

  const basePrefix = `${normalizedBase}/`
  const baseFileNameMatches = keys.filter((key) => key.startsWith(basePrefix) && key.endsWith(`/${fileName}`))

  if (baseFileNameMatches.length === 1) {
    return wc3SiteAssetManifest[baseFileNameMatches[0]]
  }

  return undefined
}

function normalizeModelBoundsKey(basePath: string, entry: string) {
  const normalizedBase = basePath
    .replace(/^https?:\/\/[^/]+/i, '')
    .replaceAll('\\', '/')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
  const normalizedEntry = entry.replaceAll('\\', '/').replace(/^\/+/, '').replace(/[?#].*$/, '')

  return `${normalizedBase}/${normalizedEntry}`.toLowerCase()
}

function getAutoCameraDistance(radius: number, width: number, height: number) {
  const aspect = Math.max(width / Math.max(height, 1), 0.1)
  const horizontalFov = 2 * Math.atan(Math.tan(CAMERA_FOV / 2) * aspect)
  const fitFov = Math.max(Math.min(CAMERA_FOV, horizontalFov), 0.1)

  return (radius / Math.sin(fitFov / 2)) * 1.18
}

function formatSequenceLabel(sequence: MdxSequence, index: number) {
  const name = sequence.name?.trim()

  return name ? `${index + 1}. ${name}` : `Sequence ${index + 1}`
}

function getDefaultSequenceIndex(sequences: MdxSequence[]) {
  const exactStandIndex = sequences.findIndex((sequence) => sequence.name?.trim().toLowerCase() === 'stand')

  if (exactStandIndex >= 0) {
    return exactStandIndex
  }

  const standIndex = sequences.findIndex((sequence) => sequence.name?.toLowerCase().startsWith('stand'))

  return standIndex >= 0 ? standIndex : 0
}

export function MdxPreview({
  asset,
  showControls = true,
  showStatus = true,
  initialAnimationSpeed = DEFAULT_ANIMATION_SPEED,
  className = '',
  onReady,
}: MdxPreviewProps) {
  const frameRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const instanceRef = useRef<MdxModelInstance | null>(null)
  const onReadyRef = useRef(onReady)
  const playbackRef = useRef({
    isPlaying: true,
    speed: initialAnimationSpeed,
  })
  const autoFitDistanceRef = useRef(true)
  const hasUserZoomedRef = useRef(false)
  const orbitRef = useRef<OrbitState>({
    yaw: -0.86,
    pitch: 0.26,
    distance: 320,
  })
  const boundsRef = useRef<BoundsState>({
    centerX: 0,
    centerY: 0,
    centerZ: 0,
    radius: 110,
  })
  const [state, setState] = useState<PreviewState>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [isAnimationPlaying, setIsAnimationPlaying] = useState(true)
  const [animationSpeed, setAnimationSpeed] = useState(initialAnimationSpeed)
  const [sequenceOptions, setSequenceOptions] = useState<SequenceOption[]>([])
  const [selectedSequenceIndex, setSelectedSequenceIndex] = useState(0)

  useEffect(() => {
    onReadyRef.current = onReady
  }, [onReady])

  useEffect(() => {
    playbackRef.current = {
      isPlaying: isAnimationPlaying,
      speed: animationSpeed,
    }

    if (typeof instanceRef.current?.timeScale === 'number') {
      instanceRef.current.timeScale = animationSpeed
    }
  }, [animationSpeed, isAnimationPlaying])

  useEffect(() => {
    const instance = instanceRef.current

    if (!instance?.setSequence || sequenceOptions.length === 0) {
      return
    }

    instance.setSequence(selectedSequenceIndex)
    instance.setSequenceLoopMode?.(2)
    instance.clearEmittedObjects?.()
  }, [selectedSequenceIndex, sequenceOptions.length])

  useEffect(() => {
    let cancelled = false
    let animationFrame = 0
    let lastFrameTime = 0
    let resizeObserver: ResizeObserver | null = null
    let viewer: MdxViewerInstance | undefined
    let scene: MdxScene | undefined
    let activePointerId: number | null = null
    let lastPointerX = 0
    let lastPointerY = 0
    let readyFrameCount = 0
    let reportedReady = false

    const applyCamera = () => {
      if (!scene) {
        return
      }

      const orbit = orbitRef.current
      const bounds = boundsRef.current
      const cosPitch = Math.cos(orbit.pitch)
      const fromX = bounds.centerX + Math.cos(orbit.yaw) * cosPitch * orbit.distance
      const fromY = bounds.centerY + Math.sin(orbit.yaw) * cosPitch * orbit.distance
      const fromZ = bounds.centerZ + Math.sin(orbit.pitch) * orbit.distance

      scene.camera.moveToAndFace(
        new Float32Array([fromX, fromY, fromZ]),
        new Float32Array([bounds.centerX, bounds.centerY, bounds.centerZ]),
        new Float32Array([0, 0, 1]),
      )
    }

    async function boot() {
      const frame = frameRef.current
      const canvas = canvasRef.current

      if (!frame || !canvas) {
        return
      }

      setState('loading')
      setErrorMessage('')
      instanceRef.current = null
      playbackRef.current = {
        isPlaying: true,
        speed: initialAnimationSpeed,
      }
      autoFitDistanceRef.current = true
      hasUserZoomedRef.current = false
      setIsAnimationPlaying(true)
      setAnimationSpeed(initialAnimationSpeed)
      setSequenceOptions([])
      setSelectedSequenceIndex(0)

      const [ModelViewerLib, wc3AssetManifest, wc3SiteAssetManifest, wc3ModelBoundsManifest] = await Promise.all([
        loadViewerBundle(),
        loadWc3AssetManifest(),
        loadWc3SiteAssetManifest(),
        loadWc3ModelBoundsManifest(),
      ])
      const ViewerCtor = ModelViewerLib?.viewer?.ModelViewer
      const handlers = ModelViewerLib?.viewer?.handlers

      if (!ViewerCtor || !handlers?.mdx || !handlers?.blp) {
        throw new Error('MDX viewer package did not expose the expected handlers.')
      }

      const resizeCanvas = () => {
        if (!frame || !canvas) {
          return
        }

        const rect = frame.getBoundingClientRect()
        const width = Math.max(1, Math.round(rect.width * window.devicePixelRatio))
        const height = Math.max(1, Math.round(rect.height * window.devicePixelRatio))

        canvas.width = width
        canvas.height = height
        canvas.style.width = `${rect.width}px`
        canvas.style.height = `${rect.height}px`

        if (scene) {
          scene.viewport[0] = 0
          scene.viewport[1] = 0
          scene.viewport[2] = width
          scene.viewport[3] = height
          scene.camera.perspective(CAMERA_FOV, width / height, 8, 10000)

          if (autoFitDistanceRef.current && !hasUserZoomedRef.current) {
            orbitRef.current = {
              ...orbitRef.current,
              distance: getAutoCameraDistance(boundsRef.current.radius, width, height),
            }
          }

          applyCamera()
        }
      }

      resizeCanvas()

      viewer = new ViewerCtor(canvas)
      viewer.on?.('error', () => {})
      viewer.addHandler(handlers.mdx)
      viewer.addHandler(handlers.blp)

      scene = viewer.addScene()
      scene.alpha = true

      resizeCanvas()

      const model = await viewer.load(asset.entry, (src: string) =>
        buildPath(asset.basePath, src, wc3AssetManifest, wc3SiteAssetManifest),
      )

      if (!model) {
        throw new Error(`Could not load ${asset.entry}.`)
      }

      const instance = model.addInstance()
      instanceRef.current = instance
      instance.setScene(scene)

      const sequences = model.sequences ?? []
      const nextSequenceOptions = sequences.map((sequence, index) => ({
        id: index,
        label: formatSequenceLabel(sequence, index),
      }))
      const defaultSequenceIndex = sequences.length > 0 ? getDefaultSequenceIndex(sequences) : -1

      if (typeof instance.setSequence === 'function') {
        instance.setSequence(defaultSequenceIndex)
      }

      if (typeof instance.setSequenceLoopMode === 'function') {
        instance.setSequenceLoopMode(2)
      }

      if (typeof instance.timeScale === 'number') {
        instance.timeScale = playbackRef.current.speed
      }

      if (nextSequenceOptions.length > 0) {
        setSequenceOptions(nextSequenceOptions)
        setSelectedSequenceIndex(defaultSequenceIndex)
      }

      const manifestBounds = wc3ModelBoundsManifest[normalizeModelBoundsKey(asset.basePath, asset.entry)]
      const bounds = manifestBounds ?? instance.model?.bounds ?? model.bounds
      const radius = Math.max(bounds?.r ?? 0, 110)
      const camera = asset.camera
      autoFitDistanceRef.current = camera?.distanceMultiplier == null
      boundsRef.current = {
        centerX: (bounds?.x ?? 0) + (camera?.targetOffsetX ?? 0),
        centerY: (bounds?.y ?? 0) + (camera?.targetOffsetY ?? 0),
        centerZ:
          (bounds?.z ?? 0) +
          radius * (camera?.targetZFactor ?? DEFAULT_CAMERA.targetZFactor) +
          (camera?.targetOffsetZ ?? 0),
        radius,
      }
      orbitRef.current = {
        yaw: camera?.yaw ?? DEFAULT_CAMERA.yaw,
        pitch: camera?.pitch ?? DEFAULT_CAMERA.pitch,
        distance:
          camera?.distanceMultiplier == null
            ? getAutoCameraDistance(radius, canvas.width, canvas.height)
            : radius * camera.distanceMultiplier,
      }
      applyCamera()

      const minDistance = radius * 1.25
      const maxDistance = radius * 7.2
      const minPitch = -0.3
      const maxPitch = 1.18

      const handlePointerDown = (event: PointerEvent) => {
        activePointerId = event.pointerId
        lastPointerX = event.clientX
        lastPointerY = event.clientY
        canvas.setPointerCapture(event.pointerId)
        setIsDragging(true)
      }

      const handlePointerMove = (event: PointerEvent) => {
        if (activePointerId !== event.pointerId) {
          return
        }

        const deltaX = event.clientX - lastPointerX
        const deltaY = event.clientY - lastPointerY
        lastPointerX = event.clientX
        lastPointerY = event.clientY

        orbitRef.current = {
          ...orbitRef.current,
          yaw: orbitRef.current.yaw - deltaX * 0.012,
          pitch: Math.min(maxPitch, Math.max(minPitch, orbitRef.current.pitch - deltaY * 0.01)),
        }

        applyCamera()
      }

      const handlePointerUp = (event: PointerEvent) => {
        if (activePointerId !== event.pointerId) {
          return
        }

        activePointerId = null
        if (canvas.hasPointerCapture(event.pointerId)) {
          canvas.releasePointerCapture(event.pointerId)
        }
        setIsDragging(false)
      }

      const handleWheel = (event: WheelEvent) => {
        event.preventDefault()
        hasUserZoomedRef.current = true

        const nextDistance = orbitRef.current.distance * (1 + event.deltaY * 0.0012)
        orbitRef.current = {
          ...orbitRef.current,
          distance: Math.min(maxDistance, Math.max(minDistance, nextDistance)),
        }

        applyCamera()
      }

      canvas.addEventListener('pointerdown', handlePointerDown)
      canvas.addEventListener('pointermove', handlePointerMove)
      canvas.addEventListener('pointerup', handlePointerUp)
      canvas.addEventListener('pointercancel', handlePointerUp)
      canvas.addEventListener('wheel', handleWheel, { passive: false })

      resizeObserver = new ResizeObserver(resizeCanvas)
      resizeObserver.observe(frame)

      if (!cancelled) {
        setState('ready')
      }

      const step = (timestamp: number) => {
        if (cancelled || !viewer) {
          return
        }

        const elapsedMs = lastFrameTime
          ? Math.min(MAX_FRAME_TIME_MS, Math.max(0, timestamp - lastFrameTime))
          : DEFAULT_FRAME_TIME_MS
        lastFrameTime = timestamp

        const playback = playbackRef.current
        viewer.updateAndRender(playback.isPlaying ? elapsedMs : 0)

        if (!reportedReady) {
          readyFrameCount += 1

          if (readyFrameCount >= 8) {
            reportedReady = true
            onReadyRef.current?.()
          }
        }

        animationFrame = window.requestAnimationFrame(step)
      }

      animationFrame = window.requestAnimationFrame(step)

      return () => {
        canvas.removeEventListener('pointerdown', handlePointerDown)
        canvas.removeEventListener('pointermove', handlePointerMove)
        canvas.removeEventListener('pointerup', handlePointerUp)
        canvas.removeEventListener('pointercancel', handlePointerUp)
        canvas.removeEventListener('wheel', handleWheel)
      }
    }

    let disposeInteractions: (() => void) | undefined

    void boot()
      .then((cleanup) => {
        disposeInteractions = cleanup
      })
      .catch((error) => {
        if (cancelled) {
          return
        }

        const message = error instanceof Error ? error.message : 'The MDX preview failed to load.'
        setErrorMessage(message)
        setState('error')
      })

    return () => {
      cancelled = true
      disposeInteractions?.()
      window.cancelAnimationFrame(animationFrame)
      resizeObserver?.disconnect()
      scene?.detach?.()
      instanceRef.current = null
      viewer = undefined
      scene = undefined
      setIsDragging(false)
    }
  }, [asset.basePath, asset.camera, asset.entry, initialAnimationSpeed])

  const restartAnimation = () => {
    const instance = instanceRef.current

    if (!instance?.setSequence || sequenceOptions.length === 0) {
      return
    }

    instance.setSequence(selectedSequenceIndex)
    instance.setSequenceLoopMode?.(2)
    instance.clearEmittedObjects?.()
    setIsAnimationPlaying(true)
  }

  return (
    <div className={`mdx-preview-frame ${className}`.trim()} ref={frameRef}>
      <canvas
        className={`mdx-preview-canvas mdx-preview-canvas-${state} ${isDragging ? 'mdx-preview-canvas-dragging' : ''}`}
        ref={canvasRef}
      />

      {showStatus && state === 'loading' ? (
        <div className="mdx-preview-status">
          <span>Loading model...</span>
        </div>
      ) : null}

      {showStatus && state === 'error' ? (
        <div className="mdx-preview-status mdx-preview-status-error">
          <span>{errorMessage}</span>
        </div>
      ) : null}

      {state === 'ready' && showControls ? (
        <div className="mdx-preview-controls" onPointerDown={(event) => event.stopPropagation()}>
          <button
            aria-pressed={isAnimationPlaying}
            className="mdx-preview-control-button"
            onClick={() => setIsAnimationPlaying((current) => !current)}
            type="button"
          >
            {isAnimationPlaying ? 'Pause' : 'Play'}
          </button>

          <button className="mdx-preview-control-button" onClick={restartAnimation} type="button">
            Restart
          </button>

          {sequenceOptions.length > 1 ? (
            <label className="mdx-preview-control-field mdx-preview-control-field-sequence">
              <span>Anim</span>
              <select
                value={selectedSequenceIndex}
                onChange={(event) => setSelectedSequenceIndex(Number(event.target.value))}
              >
                {sequenceOptions.map((sequence) => (
                  <option key={sequence.id} value={sequence.id}>
                    {sequence.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label className="mdx-preview-control-field mdx-preview-control-field-speed">
            <span>Speed</span>
            <input
              max="1"
              min="0.05"
              onChange={(event) => setAnimationSpeed(Number(event.target.value))}
              step="0.05"
              type="range"
              value={animationSpeed}
            />
            <output>{animationSpeed.toFixed(2)}x</output>
          </label>
        </div>
      ) : null}
    </div>
  )
}
