import {
  useCallback,
  createElement,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react'
import './App.css'
import {
  createCheckout,
  getAdminOrders,
  getAdminSession,
  loginAdmin,
  logoutAdmin,
  type CartLine,
  type CheckoutPayload,
} from './api'
import {
  DEMO_ADMIN,
  REGIONS,
  SHOP_OWNERS,
  SHOP_PRODUCTS,
  type AdminOrder,
  type ProductType,
  type ShopProduct,
  type ShopOwnerId,
} from './shopData'
import { assetUrl } from './assetUrl'
import { StandaloneMdxViewer } from './StandaloneMdxViewer'
import { MdxPreview } from './MdxPreview'
import { CapturePreview } from './CapturePreview'

interface CheckoutFormState {
  battleTag: string
  email: string
  region: string
  discord: string
  note: string
}

interface AdminFormState {
  username: string
  password: string
}

type PortalState = 'locked' | 'linking' | 'open'
type StonePoint = { x: number; y: number }
type StoneInteractionMode = 'drag' | 'rotate'
type PortalTumblerDirection = 'cw' | 'ccw' | 'hold'
type GodzillaViewKey = 'load' | 'shop'
type SpendTier = 'low' | 'mid' | 'high'
type ShopAudioCue =
  | 'portalOpen'
  | 'portalOpenLich'
  | 'portalOpenInfernal'
  | 'portalOpenStorm'
  | 'portalOpenMilitia'
  | 'godzillaInspect'
  | 'godzillaBuyLow'
  | 'godzillaBuyMid'
  | 'godzillaBuyHigh'
  | 'godzillaDeny'
  | 'godzillaGreeting'
  | 'godzillaInteract'
  | 'pavementInspect'
  | 'pavementBuyLow'
  | 'pavementBuyMid'
  | 'pavementBuyHigh'
  | 'pavementDeny'
  | 'pavementGreeting'
  | 'pavementInteract'
  | 'stashAdd'
  | 'stashRemove'
  | 'stashCheckoutLow'
  | 'stashCheckoutMid'
  | 'stashCheckoutHigh'
  | 'stashDeny'
  | 'inventoryInspect'
  | 'inventoryDeny'
type FinalAudioCue = 'uiSelect' | 'uiPanel' | 'uiDeny' | 'addToStash' | 'rareInspect' | 'checkoutSuccess'
type FinalMusicLoop = 'godzillaShop' | 'pavementShop' | 'inventory' | 'stash' | 'gate'
type PortalAudioCue = 'stoneGrab' | 'stoneSocketSnap' | 'runeActivate' | 'gateOpenRumble' | 'portalSuccessChime'
type ShopSurface = 'shop' | 'inventory' | 'stash' | null
type OwnerBrowsingState = {
  tab: ProductType
  selectedProductId: string
}
type ProductLine = CartLine & { product: ShopProduct }

interface GodzillaViewPreset {
  orbitYaw: number
  orbitPitch: number
  orbitDistance: number
  targetX: number
  targetY: number
  targetZ: number
  fov: number
}

type GodzillaViewState = Record<GodzillaViewKey, GodzillaViewPreset>
type ShopkeeperViewCollection = Record<ShopOwnerId, GodzillaViewState>
type OwnerBrowsingCollection = Record<ShopOwnerId, OwnerBrowsingState>

interface PortalRune {
  id: string
  angle: number
  glyphX: number
  glyphY: number
  tilt: number
}

interface PortalTumblerStep {
  id: string
  visualAngle: number
  stoneRuneIndex: number
  direction: PortalTumblerDirection
}

interface PortalTunePreset {
  gateX: number
  gateY: number
  gateScale: number
  socketX: number
  socketY: number
  stoneSeatX: number
  stoneSeatY: number
  gateRuneRadius: number
  gateRuneAngleOffset: number
  stoneSize: number
  stoneDockX: number
  stoneDockY: number
  stoneStartRotation: number
  stoneOrientationX: number
  stoneOrientationY: number
  stoneRuneRadius: number
  stoneRuneAngleOffset: number
  gateOrbitYaw: number
  gateOrbitPitch: number
  gateOrbitDistance: number
  gateFov: number
  stoneOrbitYaw: number
  stoneOrbitPitch: number
  stoneOrbitDistance: number
  stoneFov: number
}

type ModelViewerElement = HTMLElement & {
  cameraOrbit?: string
  cameraTarget?: string
  fieldOfView?: string
}

const CART_STORAGE_KEY = 'wc3dotashop-cart-v1'
const AUDIO_ENABLED_STORAGE_KEY = 'wc3dotashop-audio-enabled-v1'
const OWNED_INVENTORY_STORAGE_KEY = 'wc3dotashop-owned-inventory-v1'
const LEGACY_GODZILLA_VIEW_STORAGE_KEY = 'wc3dotashop-godzilla-view-v3'
const SHOPKEEPER_VIEW_STORAGE_KEY = 'wc3dotashop-shopkeeper-view-v1'
const PENDING_CHECKOUT_STORAGE_KEY = 'wc3dotashop-pending-checkout-v1'
const STARTER_INVENTORY_STORAGE_KEY = 'wc3dotashop-starter-inventory-v1'
const PORTAL_GATE_PASS_STORAGE_KEY = 'wc3dotashop-portal-gate-pass-v1'
const PENDING_CHECKOUT_MAX_AGE_MS = 1000 * 60 * 60 * 6
const PORTAL_GATE_PASS_MAX_AGE_MS = 1000 * 60 * 60 * 8
const STARTER_INVENTORY_LINES: CartLine[] = [
  { productId: 'axe-grommash-overlord', quantity: 1 },
  { productId: 'windranger-bloodelf', quantity: 1 },
  { productId: 'legion-commander-terenas', quantity: 1 },
  { productId: 'zeus-storm-king-ascendant', quantity: 1 },
]

interface PendingCheckout {
  createdAt: number
  lines: CartLine[]
}

const DEFAULT_CHECKOUT_FORM: CheckoutFormState = {
  battleTag: '',
  email: '',
  region: REGIONS[0],
  discord: '',
  note: '',
}

const DEFAULT_ADMIN_FORM: AdminFormState = {
  username: '',
  password: '',
}

const DEFAULT_GODZILLA_VIEW: GodzillaViewState = {
  load: {
    orbitYaw: 43,
    orbitPitch: 92,
    orbitDistance: 4.15,
    targetX: -0.18,
    targetY: 1.02,
    targetZ: 0,
    fov: 31,
  },
  shop: {
    orbitYaw: 45,
    orbitPitch: 110,
    orbitDistance: 4.1,
    targetX: -0.59,
    targetY: 1.49,
    targetZ: -0.08,
    fov: 11.5,
  },
}

const DEFAULT_PAVEMENT_VIEW: GodzillaViewState = {
  load: {
    orbitYaw: 0,
    orbitPitch: 86,
    orbitDistance: 4.05,
    targetX: 0,
    targetY: 0.92,
    targetZ: 0,
    fov: 28,
  },
  shop: {
    orbitYaw: 0,
    orbitPitch: 96,
    orbitDistance: 3.05,
    targetX: 0,
    targetY: 1.16,
    targetZ: 0.04,
    fov: 18,
  },
}

const DEFAULT_SHOPKEEPER_VIEW: ShopkeeperViewCollection = {
  godzilla8488: DEFAULT_GODZILLA_VIEW,
  pavement: DEFAULT_PAVEMENT_VIEW,
}

const DEFAULT_PORTAL_TUNE: PortalTunePreset = {
  gateX: 0.501,
  gateY: 0.44,
  gateScale: 0.98,
  socketX: 0.501,
  socketY: 0.546,
  stoneSeatX: 0.501,
  stoneSeatY: 0.518,
  gateRuneRadius: 55,
  gateRuneAngleOffset: 144,
  stoneSize: 0.096,
  stoneDockX: 0.9,
  stoneDockY: 0.735,
  stoneStartRotation: -6,
  stoneOrientationX: 90,
  stoneOrientationY: -21,
  stoneRuneRadius: 52,
  stoneRuneAngleOffset: -54,
  gateOrbitYaw: 0,
  gateOrbitPitch: 94,
  gateOrbitDistance: 7.25,
  gateFov: 19,
  stoneOrbitYaw: -95,
  stoneOrbitPitch: 88,
  stoneOrbitDistance: 8,
  stoneFov: 22.5,
}

const musicAsset = (path: string) => assetUrl(`/music/${path}`)
const numberedMusicClips = (folder: string, count: number) =>
  Array.from({ length: count }, (_, index) => musicAsset(`${folder}/${String(index + 1).padStart(2, '0')}.mp3`))

const CAPTAIN_CLIPS = numberedMusicClips('captain_clips', 6)
const KELTHUZAD_CLIPS = numberedMusicClips('kelthuzad_clips', 18)
const PEASANT_CLIPS = numberedMusicClips('peasant_clips', 7)
const PITLORD_CLIPS = numberedMusicClips('pitlord_clips', 12)
const PITLORD_BONUS_CLIPS = [
  assetUrl('/audio/music-pack/amuse.mp3'),
  assetUrl('/audio/music-pack/foolish.mp3'),
  assetUrl('/audio/music-pack/request.mp3'),
  assetUrl('/audio/music-pack/this-will-please-me.mp3'),
  assetUrl('/audio/music-pack/time.mp3'),
  assetUrl('/audio/music-pack/tremble.mp3'),
  assetUrl('/audio/music-pack/trick.mp3'),
]
const STORM_SPIRIT_CLIPS = [
  musicAsset('pavement_storm_spirit/01_storm_spirit_i_am_storm_spirit.mp3'),
  musicAsset('pavement_storm_spirit/02_storm_spirit_feel_the_wind.mp3'),
  musicAsset('pavement_storm_spirit/03_storm_spirit_stormy_weather.mp3'),
  musicAsset('pavement_storm_spirit/04_storm_spirit_calm_before_the_storm.mp3'),
  musicAsset('pavement_storm_spirit/05_storm_spirit_storm_clouds_are_gathering.mp3'),
  musicAsset('pavement_storm_spirit/06_storm_spirit_get_set_for_heavy_weather.mp3'),
  musicAsset('pavement_storm_spirit/07_storm_spirit_storm_warning.mp3'),
  musicAsset('pavement_storm_spirit/08_storm_spirit_let_the_fun_begin.mp3'),
  musicAsset('pavement_storm_spirit/09_storm_spirit_zip.mp3'),
]

const SHOP_AUDIO_PATHS: Record<ShopAudioCue, string[]> = {
  portalOpen: [
    assetUrl('/audio/voice-gate-open.mp3'),
    KELTHUZAD_CLIPS[13],
    KELTHUZAD_CLIPS[14],
    KELTHUZAD_CLIPS[17],
  ],
  portalOpenLich: [
    KELTHUZAD_CLIPS[3],
    KELTHUZAD_CLIPS[7],
    KELTHUZAD_CLIPS[10],
    KELTHUZAD_CLIPS[11],
    KELTHUZAD_CLIPS[12],
  ],
  portalOpenInfernal: [
    PITLORD_CLIPS[0],
    PITLORD_CLIPS[1],
    PITLORD_CLIPS[5],
    PITLORD_CLIPS[11],
    PITLORD_BONUS_CLIPS[3],
    PITLORD_BONUS_CLIPS[5],
  ],
  portalOpenStorm: [
    STORM_SPIRIT_CLIPS[2],
    STORM_SPIRIT_CLIPS[4],
    STORM_SPIRIT_CLIPS[5],
    STORM_SPIRIT_CLIPS[6],
    STORM_SPIRIT_CLIPS[7],
  ],
  portalOpenMilitia: [
    CAPTAIN_CLIPS[2],
    CAPTAIN_CLIPS[3],
    CAPTAIN_CLIPS[4],
    CAPTAIN_CLIPS[5],
    PEASANT_CLIPS[0],
    PEASANT_CLIPS[5],
  ],
  godzillaInspect: [PITLORD_CLIPS[0], PITLORD_CLIPS[2], PITLORD_CLIPS[5]],
  godzillaBuyLow: [PITLORD_CLIPS[9], PITLORD_CLIPS[10], PITLORD_CLIPS[11]],
  godzillaBuyMid: [PITLORD_CLIPS[1], PITLORD_CLIPS[5], PITLORD_CLIPS[11]],
  godzillaBuyHigh: [PITLORD_CLIPS[1], PITLORD_CLIPS[6], PITLORD_CLIPS[11]],
  godzillaDeny: [PITLORD_CLIPS[3], PITLORD_CLIPS[4], PITLORD_CLIPS[7], PITLORD_CLIPS[8]],
  godzillaGreeting: [PITLORD_CLIPS[0], PITLORD_CLIPS[2], PITLORD_CLIPS[5], PITLORD_CLIPS[11]],
  godzillaInteract: [
    PITLORD_CLIPS[0],
    PITLORD_CLIPS[1],
    PITLORD_CLIPS[2],
    PITLORD_CLIPS[4],
    PITLORD_CLIPS[5],
    PITLORD_CLIPS[11],
  ],
  pavementInspect: [
    STORM_SPIRIT_CLIPS[0],
    STORM_SPIRIT_CLIPS[1],
    STORM_SPIRIT_CLIPS[2],
    STORM_SPIRIT_CLIPS[3],
    STORM_SPIRIT_CLIPS[4],
  ],
  pavementBuyLow: [STORM_SPIRIT_CLIPS[1], STORM_SPIRIT_CLIPS[7], STORM_SPIRIT_CLIPS[8]],
  pavementBuyMid: [STORM_SPIRIT_CLIPS[4], STORM_SPIRIT_CLIPS[5], STORM_SPIRIT_CLIPS[7]],
  pavementBuyHigh: [STORM_SPIRIT_CLIPS[5], STORM_SPIRIT_CLIPS[6], STORM_SPIRIT_CLIPS[8]],
  pavementDeny: [STORM_SPIRIT_CLIPS[2], STORM_SPIRIT_CLIPS[6]],
  pavementGreeting: [STORM_SPIRIT_CLIPS[0], STORM_SPIRIT_CLIPS[1], STORM_SPIRIT_CLIPS[3], STORM_SPIRIT_CLIPS[7]],
  pavementInteract: [
    STORM_SPIRIT_CLIPS[0],
    STORM_SPIRIT_CLIPS[1],
    STORM_SPIRIT_CLIPS[2],
    STORM_SPIRIT_CLIPS[3],
    STORM_SPIRIT_CLIPS[4],
    STORM_SPIRIT_CLIPS[7],
    STORM_SPIRIT_CLIPS[8],
  ],
  stashAdd: [
    KELTHUZAD_CLIPS[8],
    KELTHUZAD_CLIPS[9],
    KELTHUZAD_CLIPS[10],
    KELTHUZAD_CLIPS[11],
    KELTHUZAD_CLIPS[12],
    KELTHUZAD_CLIPS[13],
    KELTHUZAD_CLIPS[14],
  ],
  stashRemove: [
    KELTHUZAD_CLIPS[0],
    KELTHUZAD_CLIPS[1],
    KELTHUZAD_CLIPS[2],
    KELTHUZAD_CLIPS[3],
    KELTHUZAD_CLIPS[4],
    KELTHUZAD_CLIPS[5],
    KELTHUZAD_CLIPS[6],
    KELTHUZAD_CLIPS[7],
  ],
  stashCheckoutLow: [KELTHUZAD_CLIPS[9], KELTHUZAD_CLIPS[10], KELTHUZAD_CLIPS[11], KELTHUZAD_CLIPS[12]],
  stashCheckoutMid: [KELTHUZAD_CLIPS[3], KELTHUZAD_CLIPS[12], KELTHUZAD_CLIPS[13], KELTHUZAD_CLIPS[14]],
  stashCheckoutHigh: [KELTHUZAD_CLIPS[5], KELTHUZAD_CLIPS[6], KELTHUZAD_CLIPS[7], KELTHUZAD_CLIPS[17]],
  stashDeny: [KELTHUZAD_CLIPS[15], KELTHUZAD_CLIPS[16], KELTHUZAD_CLIPS[17]],
  inventoryInspect: [...CAPTAIN_CLIPS, ...PEASANT_CLIPS],
  inventoryDeny: [PEASANT_CLIPS[1], PEASANT_CLIPS[2], PEASANT_CLIPS[3], PEASANT_CLIPS[4], PEASANT_CLIPS[6]],
}

const PORTAL_OPEN_VOICE_CUES: ShopAudioCue[] = [
  'portalOpen',
  'portalOpenLich',
  'portalOpenInfernal',
  'portalOpenStorm',
  'portalOpenMilitia',
]

function getStashLineVoiceCue(product: ShopProduct, action: 'add' | 'remove') {
  if (action === 'remove') {
    return product.priceGold >= 50 ? 'stashCheckoutHigh' : 'stashRemove'
  }

  if (product.priceGold >= 50) {
    return 'stashCheckoutHigh'
  }

  if (product.priceGold >= 20) {
    return 'stashCheckoutMid'
  }

  return 'stashAdd'
}

function getOwnerVisitIdleVoiceCues(ownerId: ShopOwnerId): ShopAudioCue[] {
  return ownerId === 'pavement'
    ? ['pavementInteract', 'pavementInspect', 'pavementGreeting']
    : ['godzillaInteract', 'godzillaInspect', 'godzillaGreeting']
}

function getVisitIdleVoiceCues(ownerId: ShopOwnerId, surface: ShopSurface): ShopAudioCue[] {
  if (surface === 'stash') {
    return ['stashAdd', 'stashRemove', 'stashCheckoutLow', 'stashCheckoutMid', 'stashCheckoutHigh']
  }

  if (surface === 'inventory') {
    return ['inventoryInspect', 'inventoryDeny']
  }

  return getOwnerVisitIdleVoiceCues(ownerId)
}

function getVisitIdleVoiceDelay(initial = false) {
  const min = initial ? VISIT_IDLE_VOICE_INITIAL_MIN_MS : VISIT_IDLE_VOICE_MIN_MS
  const max = initial ? VISIT_IDLE_VOICE_INITIAL_MAX_MS : VISIT_IDLE_VOICE_MAX_MS

  return min + Math.floor(Math.random() * (max - min))
}

const FINAL_AUDIO_PATHS: Record<FinalAudioCue, string> = {
  uiSelect: assetUrl('/audio/final/ui-select.mp3'),
  uiPanel: assetUrl('/audio/final/ui-panel.mp3'),
  uiDeny: assetUrl('/audio/final/ui-deny.mp3'),
  addToStash: assetUrl('/audio/final/add-to-stash.mp3'),
  rareInspect: assetUrl('/audio/final/rare-inspect.mp3'),
  checkoutSuccess: assetUrl('/audio/final/checkout-success.mp3'),
}

const FINAL_MUSIC_PATHS: Record<FinalMusicLoop, string[]> = {
  godzillaShop: [
    musicAsset('godzilla_pitlord/01_bloodlust_orc.mp3'),
    musicAsset('godzilla_pitlord/02_doomhammers_legacy_orc.mp3'),
  ],
  pavementShop: [
    musicAsset('pavement_storm_spirit/01_rise_of_the_ancients_night_elves.mp3'),
    musicAsset('pavement_storm_spirit/02_dota_free_to_play.mp3'),
  ],
  inventory: [
    musicAsset('human_village/01_the_calm.mp3'),
    musicAsset('human_village/02_blackrock_and_roll_alliance.mp3'),
  ],
  stash: [
    musicAsset('stash_master_kelthuzad/01_blight_undead.mp3'),
    musicAsset('stash_master_kelthuzad/02_carrion_waves_undead.mp3'),
  ],
  gate: [
    assetUrl('/audio/final/gate-ambience.mp3'),
    assetUrl('/audio/music-pack/3-music-roll-the-burning-legion.mp3'),
  ],
}

const PORTAL_AUDIO_PATHS: Record<PortalAudioCue, string> = {
  stoneGrab: assetUrl('/audio/portal/stone-grab.mp3'),
  stoneSocketSnap: assetUrl('/audio/portal/stone-socket-snap.mp3'),
  runeActivate: assetUrl('/audio/portal/rune-activate.mp3'),
  gateOpenRumble: assetUrl('/audio/portal/gate-open-rumble.mp3'),
  portalSuccessChime: assetUrl('/audio/portal/portal-success-chime.mp3'),
}

const PORTAL_HUM_PATH = assetUrl('/audio/portal/rune-hum-loop.mp3')
const SHOP_VOICE_VOLUME = 0.9
const FINAL_CUE_VOLUME = 0.44
const FINAL_MUSIC_VOLUME = 0.12
const PORTAL_CUE_VOLUME = 0.46
const PORTAL_HUM_VOLUME = 0.1
const AUDIO_FADE_STEP_MS = 40
const AUDIO_VOICE_FADE_MS = 180
const AUDIO_LOOP_FADE_MS = 2200
const AUDIO_HUM_FADE_MS = 480
const VISIT_IDLE_VOICE_INITIAL_MIN_MS = 7000
const VISIT_IDLE_VOICE_INITIAL_MAX_MS = 15000
const VISIT_IDLE_VOICE_MIN_MS = 14000
const VISIT_IDLE_VOICE_MAX_MS = 34000
const VISIT_IDLE_VOICE_RECENT_SUPPRESS_MS = 8500
const PORTAL_RUNE_SHEET = assetUrl('/generated/warcraft-film-orcish-runes-alpha.png')
const PORTAL_GATE_BACKGROUND = assetUrl('/generated/portal-gate-background.png')
const STASH_CHECKOUT_CHARACTER_VIDEO = assetUrl('/game-scene/stash-master-loop-alpha.webm?v=transparent-key-v2')
const STASH_CHECKOUT_CHARACTER_POSTER = assetUrl('/game-scene/stash-master-loop-alpha-poster.png?v=transparent-key-v2')
const STASH_MASTER_PLAYBACK_RATE = 1.35
const PORTAL_RUNE_GLYPHS = [
  [0, 0],
  [16.7, 0],
  [33.4, 0],
  [50, 0],
  [66.7, 0],
  [83.4, 0],
  [100, 0],
  [0, 28],
  [16.7, 28],
  [33.4, 28],
  [50, 28],
  [66.7, 28],
  [83.4, 28],
  [100, 28],
  [0, 58],
  [16.7, 58],
  [33.4, 58],
  [50, 58],
  [66.7, 58],
  [83.4, 58],
  [100, 58],
  [0, 92],
  [16.7, 92],
  [33.4, 92],
] as const
const PORTAL_RUNES: PortalRune[] = PORTAL_RUNE_GLYPHS.map(([glyphX, glyphY], index) => ({
  id: `orcish-${index}`,
  angle: index * 15,
  glyphX,
  glyphY,
  tilt: index % 2 === 0 ? -4 : 4,
}))
const PORTAL_TUMBLER_SEQUENCE_VARIANTS: PortalTumblerStep[][] = [
  [
    { id: 'top-cw', visualAngle: 0, stoneRuneIndex: 3, direction: 'cw' },
    { id: 'lower-right-ccw', visualAngle: 135, stoneRuneIndex: 15, direction: 'ccw' },
    { id: 'left-cw', visualAngle: 270, stoneRuneIndex: 20, direction: 'cw' },
    { id: 'upper-right-hold', visualAngle: 45, stoneRuneIndex: 2, direction: 'hold' },
  ],
  [
    { id: 'right-cw', visualAngle: 90, stoneRuneIndex: 10, direction: 'cw' },
    { id: 'upper-left-ccw', visualAngle: 315, stoneRuneIndex: 22, direction: 'ccw' },
    { id: 'lower-cw', visualAngle: 180, stoneRuneIndex: 7, direction: 'cw' },
    { id: 'lower-right-hold', visualAngle: 150, stoneRuneIndex: 18, direction: 'hold' },
  ],
  [
    { id: 'left-ccw', visualAngle: 270, stoneRuneIndex: 5, direction: 'ccw' },
    { id: 'top-right-cw', visualAngle: 30, stoneRuneIndex: 16, direction: 'cw' },
    { id: 'bottom-ccw', visualAngle: 180, stoneRuneIndex: 23, direction: 'ccw' },
    { id: 'top-left-hold', visualAngle: 330, stoneRuneIndex: 1, direction: 'hold' },
  ],
  [
    { id: 'lower-left-cw', visualAngle: 225, stoneRuneIndex: 12, direction: 'cw' },
    { id: 'top-ccw', visualAngle: 0, stoneRuneIndex: 6, direction: 'ccw' },
    { id: 'right-cw-final', visualAngle: 105, stoneRuneIndex: 19, direction: 'cw' },
    { id: 'bottom-hold', visualAngle: 195, stoneRuneIndex: 8, direction: 'hold' },
  ],
]
const PORTAL_LOCK_NOTCHES = Array.from({ length: 24 }, (_, index) => index)
const PORTAL_RUNE_MATCH_TOLERANCE = 7
const PORTAL_TUMBLER_WRONG_DIRECTION_THRESHOLD = 2.2
const PORTAL_TUMBLER_HOLD_MS = 600
const PLAYER_DEFAULT_MODEL_SRC = assetUrl('/game-scene/player-human-idle.glb')
const PLAYER_DEFAULT_ANIMATION = 'Armature|Idle_11|baselayer'
const PLAYER_INVENTORY_SLOT_COUNT = 12
const INVENTORY_TABS: Array<{ key: ProductType; label: string }> = [
  { key: 'skin', label: 'Skins' },
  { key: 'service', label: 'Services' },
]
const PORTAL_SPARKS = [
  { x: 43, y: 50, size: 0.72, delay: -0.2, duration: 5.6 },
  { x: 57, y: 49, size: 0.64, delay: -1.7, duration: 6.2 },
  { x: 47, y: 58, size: 0.58, delay: -2.8, duration: 5.1 },
  { x: 54, y: 59, size: 0.7, delay: -4.1, duration: 6.8 },
  { x: 36, y: 47, size: 0.5, delay: -3.3, duration: 7.4 },
  { x: 64, y: 48, size: 0.54, delay: -5.2, duration: 7.1 },
  { x: 41, y: 63, size: 0.46, delay: -2.1, duration: 6.6 },
  { x: 60, y: 62, size: 0.48, delay: -0.9, duration: 6 },
] as const
function findShopProduct(productId: string) {
  return SHOP_PRODUCTS.find((product) => product.id === productId)
}

function normalizeLineQuantity(productId: string, quantity: unknown) {
  const product = findShopProduct(productId)
  if (!product) {
    return 0
  }

  const numericQuantity = Number(quantity)
  if (!Number.isFinite(numericQuantity) || numericQuantity <= 0) {
    return 0
  }

  return Math.min(Math.floor(numericQuantity), product.stockTotal)
}

function normalizeStoredLines(rawLines: unknown): CartLine[] {
  if (!Array.isArray(rawLines)) {
    return []
  }

  const merged = new Map<string, number>()

  for (const rawLine of rawLines) {
    if (!rawLine || typeof rawLine !== 'object') {
      continue
    }

    const entry = rawLine as Partial<CartLine>
    if (typeof entry.productId !== 'string') {
      continue
    }

    const quantity = normalizeLineQuantity(entry.productId, entry.quantity)
    if (quantity <= 0) {
      continue
    }

    const product = findShopProduct(entry.productId)
    if (!product) {
      continue
    }

    merged.set(entry.productId, Math.min((merged.get(entry.productId) ?? 0) + quantity, product.stockTotal))
  }

  return Array.from(merged, ([productId, quantity]) => ({ productId, quantity }))
}

function loadStoredLines(storageKey: string): CartLine[] {
  if (typeof window === 'undefined') {
    return []
  }

  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) {
      return []
    }

    return normalizeStoredLines(JSON.parse(raw))
  } catch {
    return []
  }
}

function loadCart(): CartLine[] {
  return loadStoredLines(CART_STORAGE_KEY)
}

function loadOwnedInventory(): CartLine[] {
  const storedLines = loadStoredLines(OWNED_INVENTORY_STORAGE_KEY)

  if (typeof window === 'undefined') {
    return storedLines
  }

  try {
    if (window.localStorage.getItem(STARTER_INVENTORY_STORAGE_KEY) === 'true') {
      return storedLines
    }
  } catch {
    return storedLines.length > 0 ? storedLines : mergeStoredLines(storedLines, STARTER_INVENTORY_LINES)
  }

  const starterInventory = mergeStoredLines(storedLines, STARTER_INVENTORY_LINES)
  safeSetLocalStorageItem(STARTER_INVENTORY_STORAGE_KEY, 'true')
  return starterInventory
}

function loadAudioEnabled() {
  if (typeof window === 'undefined') {
    return false
  }

  try {
    return window.localStorage.getItem(AUDIO_ENABLED_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

function safeSetLocalStorageItem(key: string, value: string) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Keep the storefront usable in private browsing or blocked-storage contexts.
  }
}

function safeRemoveLocalStorageItem(key: string) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.removeItem(key)
  } catch {
    // Keep the storefront usable in private browsing or blocked-storage contexts.
  }
}

function loadPendingCheckout(): CartLine[] {
  if (typeof window === 'undefined') {
    return []
  }

  try {
    const raw = window.localStorage.getItem(PENDING_CHECKOUT_STORAGE_KEY)
    if (!raw) {
      return []
    }

    const parsed = JSON.parse(raw) as Partial<PendingCheckout>
    if (typeof parsed.createdAt !== 'number' || Date.now() - parsed.createdAt > PENDING_CHECKOUT_MAX_AGE_MS) {
      safeRemoveLocalStorageItem(PENDING_CHECKOUT_STORAGE_KEY)
      return []
    }

    return normalizeStoredLines(parsed.lines)
  } catch {
    return []
  }
}

function savePendingCheckout(lines: CartLine[]) {
  const normalizedLines = mergeStoredLines([], lines)
  if (normalizedLines.length === 0) {
    safeRemoveLocalStorageItem(PENDING_CHECKOUT_STORAGE_KEY)
    return
  }

  safeSetLocalStorageItem(
    PENDING_CHECKOUT_STORAGE_KEY,
    JSON.stringify({
      createdAt: Date.now(),
      lines: normalizedLines,
    } satisfies PendingCheckout),
  )
}

function clearPendingCheckout() {
  safeRemoveLocalStorageItem(PENDING_CHECKOUT_STORAGE_KEY)
}

function hasFreshPortalGatePass() {
  if (typeof window === 'undefined') {
    return false
  }

  try {
    const raw = window.localStorage.getItem(PORTAL_GATE_PASS_STORAGE_KEY)
    const solvedAt = raw ? Number(raw) : 0

    if (!Number.isFinite(solvedAt) || solvedAt <= 0) {
      return false
    }

    if (Date.now() - solvedAt > PORTAL_GATE_PASS_MAX_AGE_MS) {
      safeRemoveLocalStorageItem(PORTAL_GATE_PASS_STORAGE_KEY)
      return false
    }

    return true
  } catch {
    return false
  }
}

function savePortalGatePass() {
  safeSetLocalStorageItem(PORTAL_GATE_PASS_STORAGE_KEY, String(Date.now()))
}

function createPortalTumblerSequence() {
  const variantIndex = Math.floor(Math.random() * PORTAL_TUMBLER_SEQUENCE_VARIANTS.length)
  return PORTAL_TUMBLER_SEQUENCE_VARIANTS[variantIndex]
}

const audioFadeTimers = new WeakMap<HTMLAudioElement, number>()

function cancelAudioFade(audio: HTMLAudioElement) {
  const timer = audioFadeTimers.get(audio)
  if (timer !== undefined) {
    window.clearInterval(timer)
    audioFadeTimers.delete(audio)
  }
}

function stopAudioNow(audio: HTMLAudioElement) {
  cancelAudioFade(audio)
  audio.pause()
  audio.currentTime = 0
}

function fadeAudioTo(audio: HTMLAudioElement, targetVolume: number, durationMs: number, resetWhenSilent = false) {
  cancelAudioFade(audio)

  const nextVolume = clamp(targetVolume, 0, 1)
  if (durationMs <= 0) {
    audio.volume = nextVolume
    if (nextVolume <= 0 && resetWhenSilent) {
      stopAudioNow(audio)
    }
    return
  }

  const wasPaused = audio.paused
  const startingVolume = wasPaused && nextVolume > 0 ? 0 : audio.volume
  const startedAt = window.performance.now()

  if (nextVolume > 0 && wasPaused) {
    audio.volume = 0
    void audio.play().catch(() => {})
  }

  const timer = window.setInterval(() => {
    const elapsed = window.performance.now() - startedAt
    const progress = clamp(elapsed / durationMs, 0, 1)
    audio.volume = startingVolume + (nextVolume - startingVolume) * progress

    if (progress < 1) {
      return
    }

    window.clearInterval(timer)
    audioFadeTimers.delete(audio)
    audio.volume = nextVolume

    if (nextVolume <= 0 && resetWhenSilent) {
      audio.pause()
      audio.currentTime = 0
    }
  }, AUDIO_FADE_STEP_MS)

  audioFadeTimers.set(audio, timer)
}

function mergeStoredLines(current: CartLine[], incoming: CartLine[]) {
  const merged = new Map<string, number>()

  for (const line of [...current, ...incoming]) {
    if (!line.productId) {
      continue
    }

    const quantity = normalizeLineQuantity(line.productId, line.quantity)
    if (quantity <= 0) {
      continue
    }

    const product = findShopProduct(line.productId)
    if (!product) {
      continue
    }

    merged.set(line.productId, Math.min((merged.get(line.productId) ?? 0) + quantity, product.stockTotal))
  }

  return Array.from(merged, ([productId, quantity]) => ({ productId, quantity }))
}

function hydrateProductLines(lines: CartLine[]): ProductLine[] {
  return lines
    .map((entry) => {
      const product = SHOP_PRODUCTS.find((item) => item.id === entry.productId)
      if (!product) {
        return null
      }

      return {
        ...entry,
        product,
      }
    })
    .filter((entry): entry is ProductLine => Boolean(entry))
}

function formatGold(value: number) {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(value)
}

function formatStockLabel(value: number) {
  return value === 1 ? 'Unique 1/1' : `${value} left`
}

function GoldAmount({ value, className = '' }: { value: number; className?: string }) {
  return (
    <span className={`gold-amount ${className}`.trim()} aria-label={`${formatGold(value)} gold`}>
      <span className="gold-icon" aria-hidden="true" />
      <span className="gold-value">{formatGold(value)}</span>
    </span>
  )
}

function validateBattleTag(value: string) {
  return /^[A-Za-z0-9 _.-]{3,24}#\d{3,10}$/.test(value.trim())
}

function ModelViewer(props: Record<string, unknown>) {
  return createElement('model-viewer', props)
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function normalizeAngle(value: number) {
  return ((value % 360) + 360) % 360
}

function getAngleDelta(current: number, target: number) {
  const delta = normalizeAngle(current - target)
  return delta > 180 ? delta - 360 : delta
}

function getPortalTumblerTarget(step: PortalTumblerStep, stoneRuneAngleOffset: number) {
  const rune = PORTAL_RUNES[step.stoneRuneIndex % PORTAL_RUNES.length]
  const gateAngle = normalizeAngle(step.visualAngle)
  const targetRotation = normalizeAngle(gateAngle - rune.angle - stoneRuneAngleOffset)

  return {
    ...step,
    rune,
    gateAngle,
    targetRotation,
  }
}

function getPortalTumblerDelta(rotation: number, step: PortalTumblerStep, stoneRuneAngleOffset: number) {
  const target = getPortalTumblerTarget(step, stoneRuneAngleOffset)
  const stoneAngle = normalizeAngle(target.rune.angle + rotation + stoneRuneAngleOffset)
  return getAngleDelta(stoneAngle, target.gateAngle)
}

function getPortalTumblerScore(rotation: number, step: PortalTumblerStep, stoneRuneAngleOffset: number) {
  const delta = Math.abs(getPortalTumblerDelta(rotation, step, stoneRuneAngleOffset))
  return clamp(1 - delta / 90, 0, 1)
}

function getRunePolarStyle(angle: number, radiusPercent: number) {
  const radians = (angle - 90) * (Math.PI / 180)
  return {
    left: `${50 + Math.cos(radians) * radiusPercent}%`,
    top: `${50 + Math.sin(radians) * radiusPercent}%`,
    transform: `translate(-50%, -50%) rotate(${angle + 90}deg)`,
  }
}

function getPortalRuneStyle(rune: PortalRune, angle: number, radiusPercent: number) {
  return {
    ...getRunePolarStyle(angle, radiusPercent),
    '--rune-bg-x': `${rune.glyphX}%`,
    '--rune-bg-y': `${rune.glyphY}%`,
    '--rune-tilt': `${rune.tilt}deg`,
  } as CSSProperties
}

function loadShopkeeperViews(): ShopkeeperViewCollection {
  if (typeof window === 'undefined') {
    return DEFAULT_SHOPKEEPER_VIEW
  }

  try {
    const raw = window.localStorage.getItem(SHOPKEEPER_VIEW_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Record<ShopOwnerId, Partial<Record<GodzillaViewKey, Partial<GodzillaViewPreset>>>>>

      return {
        godzilla8488: {
          load: { ...DEFAULT_SHOPKEEPER_VIEW.godzilla8488.load, ...parsed.godzilla8488?.load },
          shop: { ...DEFAULT_SHOPKEEPER_VIEW.godzilla8488.shop, ...parsed.godzilla8488?.shop },
        },
        pavement: {
          load: { ...DEFAULT_SHOPKEEPER_VIEW.pavement.load, ...parsed.pavement?.load },
          shop: { ...DEFAULT_SHOPKEEPER_VIEW.pavement.shop, ...parsed.pavement?.shop },
        },
      }
    }

    const legacyRaw = window.localStorage.getItem(LEGACY_GODZILLA_VIEW_STORAGE_KEY)
    if (!legacyRaw) {
      return DEFAULT_SHOPKEEPER_VIEW
    }

    const parsed = JSON.parse(legacyRaw) as Partial<Record<GodzillaViewKey, Partial<GodzillaViewPreset>>>

    return {
      godzilla8488: {
        load: { ...DEFAULT_SHOPKEEPER_VIEW.godzilla8488.load, ...parsed.load },
        shop: { ...DEFAULT_SHOPKEEPER_VIEW.godzilla8488.shop, ...parsed.shop },
      },
      pavement: DEFAULT_SHOPKEEPER_VIEW.pavement,
    }
  } catch {
    return DEFAULT_SHOPKEEPER_VIEW
  }
}

function formatGodzillaOrbit(preset: GodzillaViewPreset) {
  return `${preset.orbitYaw}deg ${preset.orbitPitch}deg ${preset.orbitDistance}m`
}

function formatYAxisOrbitBound(yaw: number, preset: GodzillaViewPreset) {
  return `${yaw}deg ${preset.orbitPitch}deg ${preset.orbitDistance}m`
}

function formatGodzillaTarget(preset: GodzillaViewPreset) {
  return `${preset.targetX}m ${preset.targetY}m ${preset.targetZ}m`
}

function getStoneFrame(size: number) {
  return {
    width: size * 1.34,
    height: size * 1.56,
  }
}

function getResponsiveStoneSeatDrop(width: number, height: number) {
  if (width <= 560) {
    return clamp(height * 0.024, 12, 22)
  }

  if (width <= 720) {
    return clamp(height * 0.02, 10, 18)
  }

  if (width <= 900) {
    return clamp(height * 0.012, 6, 12)
  }

  return 0
}

function resolveOwnerBrowsingState(
  ownerId: ShopOwnerId,
  preferredTab: ProductType = 'skin',
  preferredProductId = '',
): OwnerBrowsingState {
  const ownerProducts = SHOP_PRODUCTS.filter((product) => product.ownerId === ownerId)
  const preferredProduct = ownerProducts.find((product) => product.id === preferredProductId)
  const tab = preferredProduct?.type ??
    (ownerProducts.some((product) => product.type === preferredTab) ? preferredTab : ownerProducts[0]?.type ?? preferredTab)
  const productsForTab = ownerProducts.filter((product) => product.type === tab)
  const selectedProductId = productsForTab.some((product) => product.id === preferredProductId)
    ? preferredProductId
    : productsForTab[0]?.id ?? ownerProducts[0]?.id ?? ''

  return {
    tab,
    selectedProductId,
  }
}

function createDefaultOwnerBrowsingCollection(): OwnerBrowsingCollection {
  return SHOP_OWNERS.reduce((collection, owner) => {
    collection[owner.id] = resolveOwnerBrowsingState(owner.id)
    return collection
  }, {} as OwnerBrowsingCollection)
}

const VIEWER_ROUTE_PREFIX = '/viewer/'
const THUMBNAIL_ROUTE_PREFIX = '/thumbnail/'
const CAPTURE_ROUTE_PREFIX = '/capture/'

function decodeViewerRouteSegment(value: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function readViewerProductIdFromPathname(pathname: string) {
  if (!pathname.startsWith(VIEWER_ROUTE_PREFIX)) {
    return ''
  }

  const routeRemainder = pathname.slice(VIEWER_ROUTE_PREFIX.length).split('/')[0] ?? ''
  return routeRemainder ? decodeViewerRouteSegment(routeRemainder) : ''
}

function readThumbnailProductIdFromPathname(pathname: string) {
  if (!pathname.startsWith(THUMBNAIL_ROUTE_PREFIX)) {
    return ''
  }

  const routeRemainder = pathname.slice(THUMBNAIL_ROUTE_PREFIX.length).split('/')[0] ?? ''
  return routeRemainder ? decodeViewerRouteSegment(routeRemainder) : ''
}

function readCaptureProductIdFromPathname(pathname: string) {
  if (!pathname.startsWith(CAPTURE_ROUTE_PREFIX)) {
    return ''
  }

  const routeRemainder = pathname.slice(CAPTURE_ROUTE_PREFIX.length).split('/')[0] ?? ''
  return routeRemainder ? decodeViewerRouteSegment(routeRemainder) : ''
}

function buildViewerPath(productId: string) {
  return `${VIEWER_ROUTE_PREFIX}${encodeURIComponent(productId)}`
}

function ProductPreviewMedia({ product }: { product: ShopProduct }) {
  const [failedVideoProductId, setFailedVideoProductId] = useState('')
  const shouldShowVideo = product.previewVideoSrc && failedVideoProductId !== product.id

  if (shouldShowVideo) {
    return (
      <video
        key={product.id}
        autoPlay
        className="preview-stage-video"
        loop
        muted
        onError={() => setFailedVideoProductId(product.id)}
        playsInline
        poster={product.thumbnailSrc}
        preload="metadata"
        src={product.previewVideoSrc}
      />
    )
  }

  if (product.previewAsset) {
    return (
      <MdxPreview
        asset={product.previewAsset}
        className="preview-stage-mdx"
        initialAnimationSpeed={1}
        showControls={false}
        showStatus={false}
      />
    )
  }

  return (
    <div className="preview-stage-fallback">
      <div className="selected-panel-art">
        <img
          alt=""
          className="selected-panel-art-image"
          loading="lazy"
          onError={(event) => {
            event.currentTarget.hidden = true
          }}
          src={product.thumbnailSrc}
        />
        <span>{product.artSeed}</span>
      </div>
      <span className="preview-stage-fallback-hero">{product.hero}</span>
    </div>
  )
}

function readViewerProductIdFromLocation() {
  if (typeof window === 'undefined') {
    return ''
  }

  const viewerProductIdFromPath = readViewerProductIdFromPathname(window.location.pathname)
  if (viewerProductIdFromPath) {
    return viewerProductIdFromPath
  }

  return new URLSearchParams(window.location.search).get('viewer') ?? ''
}

function clearCheckoutReturnParams() {
  if (typeof window === 'undefined') {
    return
  }

  const nextUrl = new URL(window.location.href)
  nextUrl.searchParams.delete('checkout')
  nextUrl.searchParams.delete('session_id')
  window.history.replaceState({}, '', `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`)
}

function clearSurfaceRouteParams(url: URL) {
  url.searchParams.delete('shop')
  url.searchParams.delete('inventory')
  url.searchParams.delete('stash')
}

function shouldEnterPortalOnLoad() {
  if (typeof window === 'undefined') {
    return false
  }

  if (hasFreshPortalGatePass()) {
    return true
  }

  const params = new URLSearchParams(window.location.search)
  return (
    params.get('skipPortal') === '1' ||
    params.get('shop') === '1' ||
    params.get('inventory') === '1' ||
    params.get('stash') === '1'
  )
}

function App() {
  const [activeOwnerId, setActiveOwnerId] = useState<ShopOwnerId>('godzilla8488')
  const [ownerBrowsing, setOwnerBrowsing] = useState<OwnerBrowsingCollection>(createDefaultOwnerBrowsingCollection)
  const [cart, setCart] = useState<CartLine[]>(loadCart)
  const [ownedInventory, setOwnedInventory] = useState<CartLine[]>(loadOwnedInventory)
  const [checkoutForm, setCheckoutForm] = useState<CheckoutFormState>(DEFAULT_CHECKOUT_FORM)
  const [adminForm, setAdminForm] = useState<AdminFormState>(DEFAULT_ADMIN_FORM)
  const [feedback, setFeedback] = useState('')
  const [checkoutPending, setCheckoutPending] = useState(false)
  const [adminPending, setAdminPending] = useState(false)
  const [adminMode, setAdminMode] = useState<'live' | 'demo'>('live')
  const [adminAuthenticated, setAdminAuthenticated] = useState(false)
  const [adminUsername, setAdminUsername] = useState('')
  const [adminOrders, setAdminOrders] = useState<AdminOrder[]>([])
  const [adminOrdersMode, setAdminOrdersMode] = useState<'live' | 'demo'>('live')
  const [adminOrdersLoading, setAdminOrdersLoading] = useState(false)
  const [adminOpen, setAdminOpen] = useState(false)
  const [activeSurface, setActiveSurface] = useState<ShopSurface>(null)
  const [audioEnabled, setAudioEnabled] = useState(loadAudioEnabled)
  const [musicTrackRevision, setMusicTrackRevision] = useState(0)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [viewerProductId, setViewerProductId] = useState(readViewerProductIdFromLocation)
  const [shopkeeperHovered, setShopkeeperHovered] = useState(false)
  const [portalState, setPortalState] = useState<PortalState>(() => (shouldEnterPortalOnLoad() ? 'open' : 'locked'))
  const [portalEntered, setPortalEntered] = useState(shouldEnterPortalOnLoad)
  const [portalOverlayRetired, setPortalOverlayRetired] = useState(shouldEnterPortalOnLoad)
  const [stonePosition, setStonePosition] = useState<StonePoint>({ x: 0, y: 0 })
  const [stoneRotation, setStoneRotation] = useState(DEFAULT_PORTAL_TUNE.stoneStartRotation)
  const [stoneSize, setStoneSize] = useState(156)
  const [stoneNearSocket, setStoneNearSocket] = useState(false)
  const [stoneSeated, setStoneSeated] = useState(false)
  const [isDraggingStone, setIsDraggingStone] = useState(false)
  const [isRotatingStone, setIsRotatingStone] = useState(false)
  const [stonePulse, setStonePulse] = useState(false)
  const [portalTumblerStep, setPortalTumblerStep] = useState(0)
  const [portalTumblerFailedStep, setPortalTumblerFailedStep] = useState<number | null>(null)
  const [portalTumblerSuccessStep, setPortalTumblerSuccessStep] = useState<number | null>(null)
  const [portalTumblerHoldActive, setPortalTumblerHoldActive] = useState(false)
  const [portalTumblerSequence] = useState(createPortalTumblerSequence)
  const [shopkeeperView] = useState<ShopkeeperViewCollection>(loadShopkeeperViews)
  const portalTune = DEFAULT_PORTAL_TUNE

  const overlayRef = useRef<HTMLDivElement | null>(null)
  const shopkeeperModelRef = useRef<ModelViewerElement | null>(null)
  const dragPointerIdRef = useRef<number | null>(null)
  const stoneInteractionModeRef = useRef<StoneInteractionMode | null>(null)
  const dragOffsetRef = useRef<StonePoint>({ x: 0, y: 0 })
  const rotateAnchorRef = useRef({ x: 0, rotation: DEFAULT_PORTAL_TUNE.stoneStartRotation })
  const stonePositionRef = useRef<StonePoint>({ x: 0, y: 0 })
  const stoneRotationRef = useRef(DEFAULT_PORTAL_TUNE.stoneStartRotation)
  const portalTumblerStepRef = useRef(0)
  const portalTumblerFailedTimerRef = useRef<number | null>(null)
  const portalTumblerSuccessTimerRef = useRef<number | null>(null)
  const portalTumblerHoldTimerRef = useRef<number | null>(null)
  const voiceAudioRefs = useRef<Partial<Record<ShopAudioCue, HTMLAudioElement[]>>>({})
  const voiceCueIndexesRef = useRef<Partial<Record<ShopAudioCue, number>>>({})
  const finalCueAudioRefs = useRef<Partial<Record<FinalAudioCue, HTMLAudioElement>>>({})
  const finalMusicAudioRefs = useRef<Partial<Record<FinalMusicLoop, HTMLAudioElement[]>>>({})
  const finalMusicIndexesRef = useRef<Partial<Record<FinalMusicLoop, number>>>({})
  const activeMusicLoopRef = useRef<FinalMusicLoop | null>(null)
  const portalCueAudioRefs = useRef<Partial<Record<PortalAudioCue, HTMLAudioElement>>>({})
  const portalHumAudioRef = useRef<HTMLAudioElement | null>(null)
  const activeVoiceRef = useRef<HTMLAudioElement | null>(null)
  const stashMasterVideoRef = useRef<HTMLVideoElement | null>(null)
  const checkoutReturnHandledRef = useRef(false)
  const stockSelectionVoiceClicksRef = useRef(0)
  const stockSelectionVoiceCursorRef = useRef(0)
  const stockSelectionVoiceLastCueRef = useRef<ShopAudioCue | null>(null)
  const stockSelectionVoiceLastPlayedAtRef = useRef(0)
  const portalOpenVoiceCursorRef = useRef(Math.floor(Math.random() * PORTAL_OPEN_VOICE_CUES.length))
  const portalOpenVoiceLastCueRef = useRef<ShopAudioCue | null>(null)
  const visitIdleVoiceTimerRef = useRef<number | null>(null)
  const visitIdleVoiceCursorRef = useRef(Math.floor(Math.random() * 7))
  const visitIdleVoiceLastCueRef = useRef<ShopAudioCue | null>(null)
  const voiceLastStartedAtRef = useRef(0)

  const activeOwner = SHOP_OWNERS.find((owner) => owner.id === activeOwnerId) ?? SHOP_OWNERS[0]
  const activeBrowsing = ownerBrowsing[activeOwnerId] ?? resolveOwnerBrowsingState(activeOwnerId)
  const selectedProductId = activeBrowsing.selectedProductId
  const effectiveStoneSeated = stoneSeated
  const ownerProducts = SHOP_PRODUCTS.filter((product) => product.ownerId === activeOwnerId)
  const visibleInventoryProducts = ownerProducts.filter((product) => product.type === activeBrowsing.tab)

  useEffect(() => {
    safeSetLocalStorageItem(AUDIO_ENABLED_STORAGE_KEY, String(audioEnabled))
  }, [audioEnabled])

  useEffect(() => {
    if (audioEnabled) {
      return
    }

    const unlockAudio = () => {
      setAudioEnabled(true)
    }

    window.addEventListener('pointerdown', unlockAudio, { once: true })
    window.addEventListener('keydown', unlockAudio, { once: true })

    return () => {
      window.removeEventListener('pointerdown', unlockAudio)
      window.removeEventListener('keydown', unlockAudio)
    }
  }, [audioEnabled])

  useEffect(() => {
    safeSetLocalStorageItem(CART_STORAGE_KEY, JSON.stringify(cart))
  }, [cart])

  useEffect(() => {
    safeSetLocalStorageItem(OWNED_INVENTORY_STORAGE_KEY, JSON.stringify(ownedInventory))
  }, [ownedInventory])

  useEffect(() => {
    if (!feedback) {
      return
    }

    const timer = window.setTimeout(() => {
      setFeedback('')
    }, 4200)

    return () => {
      window.clearTimeout(timer)
    }
  }, [feedback])

  useEffect(() => {
    safeSetLocalStorageItem(SHOPKEEPER_VIEW_STORAGE_KEY, JSON.stringify(shopkeeperView))
  }, [shopkeeperView])

  useEffect(() => {
    const syncViewerProductId = () => {
      setViewerProductId(readViewerProductIdFromLocation())
    }

    window.addEventListener('popstate', syncViewerProductId)

    return () => {
      window.removeEventListener('popstate', syncViewerProductId)
    }
  }, [])

  useEffect(() => {
    if (!viewerProductId) {
      return
    }

    const viewerProduct = SHOP_PRODUCTS.find(
      (product) => product.id === viewerProductId && product.previewAsset,
    )

    if (viewerProduct && viewerProduct.ownerId !== activeOwnerId) {
      setActiveOwnerId(viewerProduct.ownerId)
    }
  }, [activeOwnerId, viewerProductId])

  const playVoiceCue = useCallback((cue: ShopAudioCue, force = false) => {
    if (!force && !audioEnabled) {
      return
    }

    const voices = voiceAudioRefs.current[cue]
    if (!voices?.length) {
      return
    }

    const currentIndex = voiceCueIndexesRef.current[cue] ?? 0
    const voice = voices[currentIndex % voices.length]
    voiceCueIndexesRef.current[cue] = (currentIndex + 1) % voices.length

    if (activeVoiceRef.current && activeVoiceRef.current !== voice) {
      fadeAudioTo(activeVoiceRef.current, 0, AUDIO_VOICE_FADE_MS, true)
    }

    cancelAudioFade(voice)
    voice.volume = 0
    voice.currentTime = 0
    activeVoiceRef.current = voice
    voiceLastStartedAtRef.current = Date.now()
    void voice.play().catch(() => {})
    fadeAudioTo(voice, SHOP_VOICE_VOLUME, AUDIO_VOICE_FADE_MS)
  }, [audioEnabled])

  const playPortalOpenVoice = useCallback(() => {
    const cueCount = PORTAL_OPEN_VOICE_CUES.length
    if (cueCount === 0) {
      return
    }

    let cue = PORTAL_OPEN_VOICE_CUES[portalOpenVoiceCursorRef.current % cueCount]
    portalOpenVoiceCursorRef.current += 1

    if (cueCount > 1 && cue === portalOpenVoiceLastCueRef.current) {
      cue = PORTAL_OPEN_VOICE_CUES[portalOpenVoiceCursorRef.current % cueCount]
      portalOpenVoiceCursorRef.current += 1
    }

    portalOpenVoiceLastCueRef.current = cue
    playVoiceCue(cue)
  }, [playVoiceCue])

  const playFinalCue = useCallback((cue: FinalAudioCue, force = false) => {
    if (!force && !audioEnabled) {
      return
    }

    const audio = finalCueAudioRefs.current[cue]
    if (!audio) {
      return
    }

    cancelAudioFade(audio)
    audio.volume = FINAL_CUE_VOLUME
    audio.currentTime = 0
    void audio.play().catch(() => {})
  }, [audioEnabled])

  const playPortalCue = useCallback((cue: PortalAudioCue, force = false) => {
    if (!force && !audioEnabled) {
      return
    }

    const audio = portalCueAudioRefs.current[cue]
    if (!audio) {
      return
    }

    cancelAudioFade(audio)
    audio.volume = PORTAL_CUE_VOLUME
    audio.currentTime = 0
    void audio.play().catch(() => {})
  }, [audioEnabled])

  useEffect(() => {
    const createdVoices = Object.entries(SHOP_AUDIO_PATHS).flatMap(([cue, sources]) => {
      const audios = sources.map((src) => {
        const audio = new Audio(src)
        audio.preload = 'auto'
        audio.volume = SHOP_VOICE_VOLUME
        return audio
      })
      voiceAudioRefs.current[cue as ShopAudioCue] = audios
      voiceCueIndexesRef.current[cue as ShopAudioCue] = audios.length > 1 ? Math.floor(Math.random() * audios.length) : 0
      return audios
    })
    const finalCues = Object.entries(FINAL_AUDIO_PATHS).map(([cue, src]) => {
      const audio = new Audio(src)
      audio.preload = 'auto'
      audio.volume = FINAL_CUE_VOLUME
      finalCueAudioRefs.current[cue as FinalAudioCue] = audio
      return audio
    })
    const finalLoops = Object.entries(FINAL_MUSIC_PATHS).flatMap(([loop, sources]) => {
      const loopKey = loop as FinalMusicLoop
      const audios = sources.map((src, index) => {
        const audio = new Audio(src)
        audio.preload = 'metadata'
        audio.loop = sources.length === 1
        audio.volume = FINAL_MUSIC_VOLUME
        audio.addEventListener('ended', () => {
          if (activeMusicLoopRef.current !== loopKey) {
            return
          }

          finalMusicIndexesRef.current[loopKey] = (index + 1) % sources.length
          setMusicTrackRevision((revision) => revision + 1)
        })
        return audio
      })
      finalMusicAudioRefs.current[loopKey] = audios
      return audios
    })
    const portalCues = Object.entries(PORTAL_AUDIO_PATHS).map(([cue, src]) => {
      const audio = new Audio(src)
      audio.preload = 'auto'
      audio.volume = PORTAL_CUE_VOLUME
      portalCueAudioRefs.current[cue as PortalAudioCue] = audio
      return audio
    })
    const portalHum = new Audio(PORTAL_HUM_PATH)
    portalHum.preload = 'auto'
    portalHum.loop = true
    portalHum.volume = PORTAL_HUM_VOLUME
    portalHumAudioRef.current = portalHum

    return () => {
      createdVoices.concat(finalCues, finalLoops, portalCues, portalHum).forEach((audio) => {
        stopAudioNow(audio)
      })

      voiceAudioRefs.current = {}
      voiceCueIndexesRef.current = {}
      finalCueAudioRefs.current = {}
      finalMusicAudioRefs.current = {}
      finalMusicIndexesRef.current = {}
      activeMusicLoopRef.current = null
      portalCueAudioRefs.current = {}
      portalHumAudioRef.current = null
      activeVoiceRef.current = null
    }
  }, [])

  useEffect(() => {
    const video = stashMasterVideoRef.current

    if (activeSurface !== 'stash' || !video) {
      return
    }

    video.playbackRate = STASH_MASTER_PLAYBACK_RATE
    void video.play().catch(() => {})
  }, [activeSurface])

  useEffect(() => {
    const hum = portalHumAudioRef.current
    if (!hum) {
      return
    }

    const shouldHum = audioEnabled && portalState === 'locked' && effectiveStoneSeated
    if (shouldHum) {
      fadeAudioTo(hum, portalTumblerHoldActive ? PORTAL_HUM_VOLUME * 1.35 : PORTAL_HUM_VOLUME, AUDIO_HUM_FADE_MS)
      return
    }

    fadeAudioTo(hum, 0, AUDIO_HUM_FADE_MS, true)
  }, [audioEnabled, effectiveStoneSeated, portalState, portalTumblerHoldActive, portalTumblerStep])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const checkoutState = params.get('checkout')
    const skipPortal = params.get('skipPortal') === '1'
    const openShopOnLoad = params.get('shop') === '1'
    const openInventoryOnLoad = params.get('inventory') === '1'
    const openStashOnLoad = params.get('stash') === '1'

    if (skipPortal || openShopOnLoad || openInventoryOnLoad || openStashOnLoad) {
      setPortalState('open')
      setPortalEntered(true)
    }

    const nextSurface: ShopSurface = openStashOnLoad ? 'stash' : openInventoryOnLoad ? 'inventory' : openShopOnLoad ? 'shop' : null

    if (nextSurface) {
      setActiveSurface(nextSurface)
    }

    if (nextSurface === 'shop') {
      setPreviewOpen(true)
    }

    if (!checkoutState) {
      return
    }

    if (checkoutReturnHandledRef.current) {
      return
    }

    checkoutReturnHandledRef.current = true

    if (checkoutState === 'success') {
      const checkoutSessionId = params.get('session_id')
      const pendingCheckoutLines = loadPendingCheckout()

      if (!checkoutSessionId) {
        setFeedback('Checkout return was missing a Stripe session. Stash kept loaded.')
      } else if (pendingCheckoutLines.length === 0) {
        setFeedback('Checkout returned without a local checkout marker. Stash kept loaded.')
      } else {
        setOwnedInventory((current) => mergeStoredLines(current, pendingCheckoutLines))
        setFeedback('Transaction sealed. Items moved from stash into permanent inventory for entitlement sync.')
        setCart([])
        setCheckoutForm(DEFAULT_CHECKOUT_FORM)
        clearPendingCheckout()
      }
    } else if (checkoutState === 'cancelled') {
      setFeedback('Checkout cancelled. Your stash is still loaded.')
      clearPendingCheckout()
    }

    clearCheckoutReturnParams()
  }, [])

  useEffect(() => {
    let active = true

    void getAdminSession().then((session) => {
      if (!active) {
        return
      }

      setAdminMode(session.mode)
      setAdminAuthenticated(session.authenticated)
      setAdminUsername(session.username ?? '')
    })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!adminAuthenticated) {
      setAdminOrders([])
      return
    }

    let active = true
    setAdminOrdersLoading(true)

    void getAdminOrders()
      .then((result) => {
        if (!active) {
          return
        }

        setAdminOrders(result.orders)
        setAdminOrdersMode(result.mode)
      })
      .catch((error) => {
        if (!active) {
          return
        }

        const message = error instanceof Error ? error.message : 'Could not load host console data.'
        setFeedback(message)
      })
      .finally(() => {
        if (active) {
          setAdminOrdersLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [adminAuthenticated])

  useEffect(() => {
    if (portalState !== 'linking') {
      return
    }

    const timer = window.setTimeout(() => {
      playPortalCue('portalSuccessChime')
      playPortalOpenVoice()
      setPortalState('open')
    }, 2200)

    return () => {
      window.clearTimeout(timer)
    }
  }, [playPortalCue, playPortalOpenVoice, portalState])

  useEffect(() => {
    if (portalState !== 'open') {
      return
    }

    const timer = window.setTimeout(() => {
      setPortalEntered(true)
    }, 900)

    return () => {
      window.clearTimeout(timer)
    }
  }, [portalState])

  useEffect(() => {
    if (!portalEntered) {
      setPortalOverlayRetired(false)
      return
    }

    const timer = window.setTimeout(() => {
      setPortalOverlayRetired(true)
    }, 760)

    return () => {
      window.clearTimeout(timer)
    }
  }, [portalEntered])

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') {
        return
      }

      setActiveSurface(null)
      setPreviewOpen(false)
      setAdminOpen(false)
    }

    window.addEventListener('keydown', handleEscape)

    return () => {
      window.removeEventListener('keydown', handleEscape)
    }
  }, [])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = portalEntered ? previousOverflow : 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [portalEntered])

  function updateStonePosition(next: StonePoint) {
    stonePositionRef.current = next
    setStonePosition(next)
  }

  function updateStoneRotation(next: number) {
    const normalized = normalizeAngle(next)
    stoneRotationRef.current = normalized
    setStoneRotation(normalized)
  }

  function clearPortalTumblerHold() {
    if (portalTumblerHoldTimerRef.current !== null) {
      window.clearTimeout(portalTumblerHoldTimerRef.current)
      portalTumblerHoldTimerRef.current = null
    }

    setPortalTumblerHoldActive(false)
  }

  function updatePortalTumblerStep(next: number) {
    const normalized = clamp(next, 0, portalTumblerSequence.length)
    portalTumblerStepRef.current = normalized
    setPortalTumblerStep(normalized)
  }

  function flashPortalTumblerFailure(stepIndex: number) {
    if (portalTumblerFailedTimerRef.current !== null) {
      window.clearTimeout(portalTumblerFailedTimerRef.current)
    }

    setPortalTumblerFailedStep(stepIndex)
    portalTumblerFailedTimerRef.current = window.setTimeout(() => {
      setPortalTumblerFailedStep(null)
      portalTumblerFailedTimerRef.current = null
    }, 520)
  }

  function flashPortalTumblerSuccess(stepIndex: number) {
    if (portalTumblerSuccessTimerRef.current !== null) {
      window.clearTimeout(portalTumblerSuccessTimerRef.current)
    }

    setPortalTumblerSuccessStep(stepIndex)
    portalTumblerSuccessTimerRef.current = window.setTimeout(() => {
      setPortalTumblerSuccessStep(null)
      portalTumblerSuccessTimerRef.current = null
    }, 620)
  }

  function resetPortalTumblerProgress() {
    clearPortalTumblerHold()
    updatePortalTumblerStep(0)
    setPortalTumblerFailedStep(null)
    setPortalTumblerSuccessStep(null)
  }

  useEffect(() => {
    if (portalState !== 'locked' || isDraggingStone || isRotatingStone || effectiveStoneSeated) {
      return
    }

    updateStoneRotation(portalTune.stoneStartRotation)
  }, [effectiveStoneSeated, isDraggingStone, isRotatingStone, portalState, portalTune.stoneStartRotation])

  useEffect(() => {
    return () => {
      if (portalTumblerFailedTimerRef.current !== null) {
        window.clearTimeout(portalTumblerFailedTimerRef.current)
      }

      if (portalTumblerSuccessTimerRef.current !== null) {
        window.clearTimeout(portalTumblerSuccessTimerRef.current)
      }

      if (portalTumblerHoldTimerRef.current !== null) {
        window.clearTimeout(portalTumblerHoldTimerRef.current)
      }
    }
  }, [])

  function isStoneNearSeat() {
    if (portalState !== 'locked' || !overlayRef.current) {
      return false
    }

    if (!effectiveStoneSeated) {
      return false
    }

    const bounds = overlayRef.current.getBoundingClientRect()
    const seat = getStoneSeatPosition(bounds.width, bounds.height, stoneSize)
    const frame = getStoneFrame(stoneSize)
    const current = stonePositionRef.current
    const dx = current.x - seat.x
    const dy = current.y - seat.y
    const distance = Math.sqrt(dx * dx + dy * dy)
    const nearSocket = distance <= Math.min(frame.width, frame.height) * 0.72

    setStoneNearSocket(nearSocket)

    return nearSocket
  }

  function failPortalTumblerStep(stepIndex: number) {
    clearPortalTumblerHold()
    flashPortalTumblerFailure(stepIndex)
    playFinalCue('uiDeny')
  }

  function lockPortalTumblerStep(stepIndex: number) {
    clearPortalTumblerHold()
    flashPortalTumblerSuccess(stepIndex)
    playPortalCue('runeActivate')
    updatePortalTumblerStep(stepIndex + 1)
  }

  function startFinalTumblerHold(stepIndex: number) {
    if (portalTumblerHoldTimerRef.current !== null) {
      return
    }

    setPortalTumblerHoldActive(true)
    playPortalCue('runeActivate')
    portalTumblerHoldTimerRef.current = window.setTimeout(() => {
      portalTumblerHoldTimerRef.current = null
      setPortalTumblerHoldActive(false)
      flashPortalTumblerSuccess(stepIndex)
      updatePortalTumblerStep(portalTumblerSequence.length)
      savePortalGatePass()
      playPortalCue('gateOpenRumble')
      setPortalState('linking')
    }, PORTAL_TUMBLER_HOLD_MS)
  }

  function evaluatePortalTumblerRotation(nextRotation: number, previousRotation = stoneRotationRef.current) {
    if (portalState !== 'locked' || !effectiveStoneSeated || !isStoneNearSeat()) {
      clearPortalTumblerHold()
      return false
    }

    updateStonePosition(getStoneSeatPosition(overlayRef.current!.getBoundingClientRect().width, overlayRef.current!.getBoundingClientRect().height, stoneSize))

    const stepIndex = portalTumblerStepRef.current
    const step = portalTumblerSequence[stepIndex]

    if (!step) {
      return false
    }

    const movement = getAngleDelta(normalizeAngle(nextRotation), normalizeAngle(previousRotation))

    if (step.direction === 'cw' && movement < -PORTAL_TUMBLER_WRONG_DIRECTION_THRESHOLD) {
      failPortalTumblerStep(stepIndex)
      return false
    }

    if (step.direction === 'ccw' && movement > PORTAL_TUMBLER_WRONG_DIRECTION_THRESHOLD) {
      failPortalTumblerStep(stepIndex)
      return false
    }

    const previousDelta = getPortalTumblerDelta(previousRotation, step, portalTune.stoneRuneAngleOffset)
    const currentDelta = getPortalTumblerDelta(nextRotation, step, portalTune.stoneRuneAngleOffset)
    const currentAbsDelta = Math.abs(currentDelta)

    if (currentAbsDelta <= PORTAL_RUNE_MATCH_TOLERANCE) {
      if (step.direction === 'hold') {
        startFinalTumblerHold(stepIndex)
      } else {
        lockPortalTumblerStep(stepIndex)
      }

      return true
    }

    if (step.direction === 'hold') {
      clearPortalTumblerHold()
      return false
    }

    const overshotClockwise =
      step.direction === 'cw' &&
      previousDelta < -PORTAL_RUNE_MATCH_TOLERANCE &&
      currentDelta > PORTAL_RUNE_MATCH_TOLERANCE
    const overshotCounterClockwise =
      step.direction === 'ccw' &&
      previousDelta > PORTAL_RUNE_MATCH_TOLERANCE &&
      currentDelta < -PORTAL_RUNE_MATCH_TOLERANCE

    if (overshotClockwise || overshotCounterClockwise) {
      failPortalTumblerStep(stepIndex)
      return false
    }

    clearPortalTumblerHold()
    return false
  }

  function rotatePortalStone(nextRotation: number) {
    const previousRotation = stoneRotationRef.current
    updateStoneRotation(nextRotation)
    void evaluatePortalTumblerRotation(nextRotation, previousRotation)
  }

  const getStoneSize = useCallback((width: number) => {
    return clamp(width * portalTune.stoneSize, 96, 220)
  }, [portalTune.stoneSize])

  const getDockPosition = useCallback((width: number, height: number, size: number): StonePoint => {
    const frame = getStoneFrame(size)
    return {
      x: clamp(width * portalTune.stoneDockX, 14, width - frame.width - 14),
      y: clamp(height * portalTune.stoneDockY, 14, height - frame.height - 14),
    }
  }, [portalTune.stoneDockX, portalTune.stoneDockY])

  const getSocketPosition = useCallback((width: number, height: number, size: number): StonePoint => {
    const frame = getStoneFrame(size)
    return {
      x: width * portalTune.socketX - frame.width / 2,
      y: height * portalTune.socketY - frame.height / 2,
    }
  }, [portalTune.socketX, portalTune.socketY])

  const getStoneSeatPosition = useCallback((width: number, height: number, size: number): StonePoint => {
    const frame = getStoneFrame(size)
    const mobileSeatDrop = getResponsiveStoneSeatDrop(width, height)

    return {
      x: width * portalTune.stoneSeatX - frame.width / 2,
      y: height * portalTune.stoneSeatY - frame.height / 2 + mobileSeatDrop,
    }
  }, [portalTune.stoneSeatX, portalTune.stoneSeatY])

  useEffect(() => {
    function syncStoneLayout() {
      const bounds = overlayRef.current?.getBoundingClientRect()
      if (!bounds) {
        return
      }

      const size = getStoneSize(bounds.width)
      setStoneSize(size)

      if (portalState === 'locked' && !isDraggingStone && !isRotatingStone) {
        if (effectiveStoneSeated) {
          updateStonePosition(getStoneSeatPosition(bounds.width, bounds.height, size))
          setStoneNearSocket(true)
        } else {
          updateStonePosition(getDockPosition(bounds.width, bounds.height, size))
          setStoneNearSocket(false)
        }
      }

      if (portalState === 'linking' || portalState === 'open') {
        updateStonePosition(getStoneSeatPosition(bounds.width, bounds.height, size))
      }
    }

    syncStoneLayout()
    window.addEventListener('resize', syncStoneLayout)

    return () => {
      window.removeEventListener('resize', syncStoneLayout)
    }
  }, [effectiveStoneSeated, getDockPosition, getStoneSeatPosition, getStoneSize, isDraggingStone, isRotatingStone, portalState, portalEntered])

  useEffect(() => {
    if (ownerProducts.length === 0) {
      return
    }

    const normalizedTab = ownerProducts.some((product) => product.type === activeBrowsing.tab)
      ? activeBrowsing.tab
      : ownerProducts[0]?.type ?? activeBrowsing.tab
    const productsForTab = ownerProducts.filter((product) => product.type === normalizedTab)
    const normalizedSelectedProductId = productsForTab.some((product) => product.id === selectedProductId)
      ? selectedProductId
      : productsForTab[0]?.id ?? ''

    if (
      activeBrowsing.tab !== normalizedTab ||
      normalizedSelectedProductId !== activeBrowsing.selectedProductId
    ) {
      setOwnerBrowsing((current) => ({
        ...current,
        [activeOwnerId]: {
          tab: normalizedTab,
          selectedProductId: normalizedSelectedProductId,
        },
      }))
    }
  }, [activeBrowsing.selectedProductId, activeBrowsing.tab, activeOwnerId, ownerProducts, selectedProductId])

  const selectedProduct =
    visibleInventoryProducts.find((product) => product.id === selectedProductId) ??
    visibleInventoryProducts[0] ??
    null
  const activeStockLabel = INVENTORY_TABS.find((tab) => tab.key === activeBrowsing.tab)?.label ?? 'Stock'
  const thumbnailProductId =
    typeof window === 'undefined' ? '' : readThumbnailProductIdFromPathname(window.location.pathname)
  const captureProductId =
    typeof window === 'undefined' ? '' : readCaptureProductIdFromPathname(window.location.pathname)
  const thumbnailProduct = thumbnailProductId
    ? SHOP_PRODUCTS.find((product) => product.id === thumbnailProductId && product.previewAsset) ?? null
    : null
  const standaloneViewerProduct = viewerProductId
    ? SHOP_PRODUCTS.find((product) => product.id === viewerProductId && product.previewAsset) ?? null
    : null

  const cartRows = hydrateProductLines(cart)
  const ownedInventoryRows = hydrateProductLines(ownedInventory)

  const subtotal = cartRows.reduce((sum, row) => sum + row.product.priceGold * row.quantity, 0)
  const selectedStashRow = selectedProduct
    ? cartRows.find((row) => row.product.id === selectedProduct.id)
    : undefined
  const selectedInventoryRow = selectedProduct
    ? ownedInventoryRows.find((row) => row.product.id === selectedProduct.id)
    : undefined
  const stoneFrame = getStoneFrame(stoneSize)
  const shopOpen = activeSurface === 'shop'
  const inventoryOpen = activeSurface === 'inventory'
  const checkoutOpen = activeSurface === 'stash'
  const ownerContextActive = !inventoryOpen && !checkoutOpen
  const sceneContextLabel = checkoutOpen ? "Kel'Thuzad stash" : inventoryOpen ? 'Player inventory' : `${activeOwner.label} shop`
  const topbarTitle = checkoutOpen ? "Kel'Thuzad's Stash" : inventoryOpen ? 'Player Inventory' : activeOwner.vaultName
  const topbarAccent = checkoutOpen ? '#6ba7ff' : inventoryOpen ? '#d5ad63' : activeOwner.accent
  const centerActorMode = inventoryOpen ? 'player' : checkoutOpen ? null : 'shopkeeper'
  const activeGodzillaViewKey: GodzillaViewKey = shopOpen ? 'shop' : 'load'
  const activeGodzillaView = shopkeeperView[activeOwnerId][activeGodzillaViewKey]
  const godzillaCameraTarget = formatGodzillaTarget(activeGodzillaView)
  const godzillaCameraOrbit = formatGodzillaOrbit(activeGodzillaView)
  const godzillaFieldOfView = `${activeGodzillaView.fov}deg`
  const godzillaMinCameraOrbit = formatYAxisOrbitBound(activeGodzillaView.orbitYaw - 180, activeGodzillaView)
  const godzillaMaxCameraOrbit = formatYAxisOrbitBound(activeGodzillaView.orbitYaw + 180, activeGodzillaView)
  const portalTumblerTargets = portalTumblerSequence.map((step, index) => ({
    index,
    ...getPortalTumblerTarget(step, portalTune.stoneRuneAngleOffset),
  }))
  const portalCurrentTumblerStep = portalTumblerSequence[portalTumblerStep]
  const portalCurrentTumblerDelta = portalCurrentTumblerStep
    ? getPortalTumblerDelta(stoneRotation, portalCurrentTumblerStep, portalTune.stoneRuneAngleOffset)
    : 0
  const stoneAligned =
    effectiveStoneSeated &&
    stoneNearSocket &&
    portalCurrentTumblerStep !== undefined &&
    Math.abs(portalCurrentTumblerDelta) <= PORTAL_RUNE_MATCH_TOLERANCE
  const portalAlignmentScore =
    effectiveStoneSeated && stoneNearSocket && portalCurrentTumblerStep
      ? getPortalTumblerScore(stoneRotation, portalCurrentTumblerStep, portalTune.stoneRuneAngleOffset)
      : 0
  const portalProgressScore = clamp(
    (portalTumblerStep + (portalTumblerStep < portalTumblerSequence.length ? portalAlignmentScore : 1)) /
      portalTumblerSequence.length,
    0,
    1,
  )
  const portalActiveNotches = Math.round(portalProgressScore * PORTAL_LOCK_NOTCHES.length)
  const portalOverlayStyle = {
    '--portal-align': portalAlignmentScore.toFixed(3),
    '--portal-progress': portalProgressScore.toFixed(3),
    '--portal-hold': portalTumblerHoldActive ? '1' : '0',
    '--portal-rotation': `${stoneRotation}deg`,
    '--portal-bg-image': `url("${PORTAL_GATE_BACKGROUND}")`,
    '--portal-rune-sheet': `url("${PORTAL_RUNE_SHEET}")`,
  } as CSSProperties
  const portalGateStateScale = portalState === 'open' ? 1.12 : portalState === 'linking' ? 1.03 : 1
  const portalGateTransform = `translate(-50%, -50%) scale(${(portalTune.gateScale * portalGateStateScale).toFixed(3)})`
  const portalGateOrbit = `${portalTune.gateOrbitYaw}deg ${portalTune.gateOrbitPitch}deg ${portalTune.gateOrbitDistance}m`
  const portalStoneOrbit = `${portalTune.stoneOrbitYaw}deg ${portalTune.stoneOrbitPitch}deg ${portalTune.stoneOrbitDistance}m`
  const portalStoneOrientation = `${portalTune.stoneOrientationX}deg ${portalTune.stoneOrientationY}deg 0deg`
  const cartItemCount = cartRows.reduce((sum, row) => sum + row.quantity, 0)
  const inventoryItemCount = ownedInventoryRows.reduce((sum, row) => sum + row.quantity, 0)
  const playerInventorySlots = Array.from(
    { length: Math.max(PLAYER_INVENTORY_SLOT_COUNT, ownedInventoryRows.length) },
    (_, index) => ownedInventoryRows[index],
  )
  const stashSlots = Array.from({ length: Math.max(8, cartRows.length) }, (_, index) => cartRows[index])
  const activeMusicLoop: FinalMusicLoop | null = !audioEnabled
    ? null
    : checkoutOpen
      ? 'stash'
      : inventoryOpen
        ? 'inventory'
        : portalEntered
          ? activeOwnerId === 'pavement'
            ? 'pavementShop'
            : 'godzillaShop'
          : 'gate'

  useEffect(() => {
    activeMusicLoopRef.current = activeMusicLoop
  }, [activeMusicLoop])

  useEffect(() => {
    ;(Object.entries(finalMusicAudioRefs.current) as Array<[FinalMusicLoop, HTMLAudioElement[]]>).forEach(
      ([loop, audios]) => {
        const activeTrackIndex = (finalMusicIndexesRef.current[loop] ?? 0) % audios.length

        audios.forEach((audio, index) => {
          if (loop === activeMusicLoop && index === activeTrackIndex) {
            fadeAudioTo(audio, FINAL_MUSIC_VOLUME, AUDIO_LOOP_FADE_MS)
            return
          }

          fadeAudioTo(audio, 0, AUDIO_LOOP_FADE_MS, true)
        })
      },
    )
  }, [activeMusicLoop, musicTrackRevision])

  useEffect(() => {
    if (!audioEnabled || !portalEntered) {
      return
    }

    let cancelled = false
    let initial = true

    const scheduleNextIdleVoice = () => {
      visitIdleVoiceTimerRef.current = window.setTimeout(() => {
        if (cancelled) {
          return
        }

        const recentlySpoke = Date.now() - voiceLastStartedAtRef.current < VISIT_IDLE_VOICE_RECENT_SUPPRESS_MS
        if (!recentlySpoke && document.visibilityState === 'visible') {
          const cues = getVisitIdleVoiceCues(activeOwnerId, activeSurface)

          if (cues.length > 0) {
            const randomOffset = Math.floor(Math.random() * cues.length)
            let cursor = visitIdleVoiceCursorRef.current + randomOffset
            let cue = cues[cursor % cues.length]
            cursor += 1

            if (cues.length > 1 && cue === visitIdleVoiceLastCueRef.current) {
              cue = cues[cursor % cues.length]
              cursor += 1
            }

            visitIdleVoiceCursorRef.current = cursor
            visitIdleVoiceLastCueRef.current = cue
            playVoiceCue(cue)
          }
        }

        initial = false
        scheduleNextIdleVoice()
      }, getVisitIdleVoiceDelay(initial))
    }

    scheduleNextIdleVoice()

    return () => {
      cancelled = true

      if (visitIdleVoiceTimerRef.current !== null) {
        window.clearTimeout(visitIdleVoiceTimerRef.current)
        visitIdleVoiceTimerRef.current = null
      }
    }
  }, [activeOwnerId, activeSurface, audioEnabled, playVoiceCue, portalEntered])

  function addToCart(productId: string, message?: string) {
    const product = findShopProduct(productId)
    if (!product) {
      return false
    }

    const currentQuantity = cart.find((entry) => entry.productId === productId)?.quantity ?? 0
    if (currentQuantity >= product.stockTotal) {
      setFeedback(`${product.name} has reached its stock limit: ${formatStockLabel(product.stockTotal)}.`)
      playFinalCue('uiDeny')
      playOwnerDenyVoice(product.ownerId)
      return false
    }

    setCart((current) => mergeStoredLines(current, [{ productId, quantity: 1 }]))

    if (message) {
      setFeedback(message)
    }

    return true
  }

  function addLinesToOwnedInventory(lines: CartLine[]) {
    if (lines.length === 0) {
      return
    }

    setOwnedInventory((current) => mergeStoredLines(current, lines))
  }

  function getSpendTier(amount: number): SpendTier {
    if (amount >= 50) {
      return 'high'
    }

    if (amount >= 20) {
      return 'mid'
    }

    return 'low'
  }

  function getOwnerBuyCue(product: ShopProduct, quantity = 1): ShopAudioCue {
    const tier = getSpendTier(product.priceGold * quantity)

    if (product.ownerId === 'pavement') {
      if (tier === 'high') {
        return 'pavementBuyHigh'
      }

      if (tier === 'mid') {
        return 'pavementBuyMid'
      }

      return 'pavementBuyLow'
    }

    if (tier === 'high') {
      return 'godzillaBuyHigh'
    }

    if (tier === 'mid') {
      return 'godzillaBuyMid'
    }

    return 'godzillaBuyLow'
  }

  function playOwnerPurchaseVoice(product: ShopProduct, quantity = 1) {
    playVoiceCue(getOwnerBuyCue(product, quantity))
  }

  function playOwnerInspectVoice(product: ShopProduct) {
    playVoiceCue(product.ownerId === 'pavement' ? 'pavementInspect' : 'godzillaInspect')
  }

  function playOwnerDenyVoice(ownerId: ShopOwnerId) {
    playVoiceCue(ownerId === 'pavement' ? 'pavementDeny' : 'godzillaDeny')
  }

  function playOwnerGreetingVoice(ownerId: ShopOwnerId, force = false) {
    playVoiceCue(ownerId === 'pavement' ? 'pavementGreeting' : 'godzillaGreeting', force)
  }

  function playOwnerInteractVoice(ownerId: ShopOwnerId, force = false) {
    playVoiceCue(ownerId === 'pavement' ? 'pavementInteract' : 'godzillaInteract', force)
  }

  function getProductSelectionVoiceCues(product: ShopProduct): ShopAudioCue[] {
    return product.ownerId === 'pavement'
      ? ['pavementInspect', 'pavementInteract', 'pavementGreeting']
      : ['godzillaInspect', 'godzillaInteract', 'godzillaGreeting']
  }

  function maybePlayProductSelectionVoice(product: ShopProduct) {
    const now = Date.now()
    stockSelectionVoiceClicksRef.current += 1

    const enoughCooldown = now - stockSelectionVoiceLastPlayedAtRef.current > 1250
    const shouldSpeak = enoughCooldown && (stockSelectionVoiceClicksRef.current % 2 === 1 || Math.random() < 0.35)

    if (!shouldSpeak) {
      return
    }

    const cues = getProductSelectionVoiceCues(product)
    if (cues.length === 0) {
      return
    }

    const currentCursor = stockSelectionVoiceCursorRef.current
    let cue = cues[currentCursor % cues.length]
    stockSelectionVoiceCursorRef.current = currentCursor + 1

    if (cues.length > 1 && cue === stockSelectionVoiceLastCueRef.current) {
      cue = cues[stockSelectionVoiceCursorRef.current % cues.length]
      stockSelectionVoiceCursorRef.current += 1
    }

    stockSelectionVoiceLastCueRef.current = cue
    stockSelectionVoiceLastPlayedAtRef.current = now
    playVoiceCue(cue)
  }

  function playProductInventoryVoice() {
    playVoiceCue('inventoryInspect')
  }

  function playStashLineVoice(product: ShopProduct, action: 'add' | 'remove') {
    playVoiceCue(getStashLineVoiceCue(product, action))
  }

  function playStashCheckoutVoice(totalGold: number) {
    const tier = getSpendTier(totalGold)

    if (tier === 'high') {
      playVoiceCue('stashCheckoutHigh')
      return
    }

    if (tier === 'mid') {
      playVoiceCue('stashCheckoutMid')
      return
    }

    playVoiceCue('stashCheckoutLow')
  }

  function removeFromCart(productId: string) {
    const product = SHOP_PRODUCTS.find((entry) => entry.id === productId)

    setCart((current) => current.filter((entry) => entry.productId !== productId))

    if (product) {
      playFinalCue('uiSelect')
      playStashLineVoice(product, 'remove')
    }
  }

  function updateCartQuantity(productId: string, delta: number) {
    const product = findShopProduct(productId)
    const currentQuantity = cart.find((entry) => entry.productId === productId)?.quantity ?? 0

    if (!product || currentQuantity <= 0) {
      return
    }

    if (delta > 0 && currentQuantity >= product.stockTotal) {
      setFeedback(`${product.name} has reached its stock limit: ${formatStockLabel(product.stockTotal)}.`)
      playFinalCue('uiDeny')
      playVoiceCue('stashDeny')
      return
    }

    setCart((current) =>
      current
        .map((entry) =>
          entry.productId === productId
            ? { ...entry, quantity: Math.min(product.stockTotal, Math.max(0, Math.floor(entry.quantity) + delta)) }
            : entry,
        )
        .filter((entry) => entry.quantity > 0),
    )

    playFinalCue('uiSelect')
    playStashLineVoice(product, delta > 0 ? 'add' : 'remove')
  }

  function handleGridPurchase(productId: string) {
    const product = SHOP_PRODUCTS.find((entry) => entry.id === productId)
    if (!product) {
      return
    }

    setOwnerBrowsing((current) => ({
      ...current,
      [activeOwnerId]: resolveOwnerBrowsingState(activeOwnerId, product.type, productId),
    }))

    if (product.status === 'coming-soon') {
      setFeedback(`${product.name} is still sealed. Keep it pinned for a later patch.`)
      playFinalCue('uiDeny')
      playOwnerDenyVoice(product.ownerId)
      return
    }

    const addedToCart = addToCart(productId, `${product.name} added to stash for checkout.`)
    if (!addedToCart) {
      return
    }

    playFinalCue('addToStash')
    playOwnerPurchaseVoice(product)
  }

  function inspectOwnedInventoryItem(productId: string) {
    const product = SHOP_PRODUCTS.find((entry) => entry.id === productId)
    if (!product) {
      return
    }

    setActiveOwnerId(product.ownerId)
    setOwnerBrowsing((current) => ({
      ...current,
      [product.ownerId]: resolveOwnerBrowsingState(product.ownerId, product.type, product.id),
    }))
    setFeedback(`Inspecting ${product.name} from player inventory.`)
    playProductInventoryVoice()
  }

  function handleProductSelect(productId: string, options?: { speak?: boolean }) {
    const product = SHOP_PRODUCTS.find((entry) => entry.id === productId)
    if (!product) {
      return
    }

    setOwnerBrowsing((current) => ({
      ...current,
      [activeOwnerId]: resolveOwnerBrowsingState(activeOwnerId, product.type, productId),
    }))
    setPreviewOpen(true)
    setActiveSurface('shop')

    if (options?.speak) {
      maybePlayProductSelectionVoice(product)
    }
  }

  function updateViewerRoute(nextProductId: string) {
    if (typeof window === 'undefined') {
      setViewerProductId(nextProductId)
      return
    }

    const nextUrl = new URL(window.location.href)
    clearSurfaceRouteParams(nextUrl)

    if (nextProductId) {
      nextUrl.pathname = buildViewerPath(nextProductId)
      nextUrl.searchParams.delete('viewer')
    } else {
      nextUrl.pathname = '/'
      nextUrl.searchParams.delete('viewer')
      nextUrl.searchParams.set('skipPortal', '1')
      nextUrl.searchParams.set('shop', '1')
    }

    window.history.pushState({}, '', `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`)
    setViewerProductId(nextProductId)
  }

  function openStandaloneViewer(productId: string) {
    const product = SHOP_PRODUCTS.find((entry) => entry.id === productId)
    if (!product?.previewAsset) {
      return
    }

    const sourceSurface = activeSurface
    setOwnerBrowsing((current) => ({
      ...current,
      [product.ownerId]: resolveOwnerBrowsingState(product.ownerId, product.type, product.id),
    }))
    setActiveOwnerId(product.ownerId)
    setPreviewOpen(true)
    setActiveSurface('shop')
    setFeedback('')
    playFinalCue('rareInspect')
    if (sourceSurface === 'inventory') {
      playVoiceCue('inventoryInspect')
    } else if (sourceSurface === 'stash') {
      playVoiceCue('stashCheckoutLow')
    } else {
      playOwnerInspectVoice(product)
    }
    updateViewerRoute(product.id)
  }

  function closeStandaloneViewer() {
    updateViewerRoute('')
  }

  function replaceSurfaceRoute(nextSurface: ShopSurface) {
    if (typeof window === 'undefined' || readViewerProductIdFromPathname(window.location.pathname)) {
      return
    }

    const nextUrl = new URL(window.location.href)
    clearSurfaceRouteParams(nextUrl)

    if (portalEntered || nextSurface) {
      nextUrl.searchParams.set('skipPortal', '1')
    }

    if (nextSurface) {
      nextUrl.searchParams.set(nextSurface, '1')
    }

    window.history.replaceState({}, '', `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`)
  }

  function switchOwner(ownerId: ShopOwnerId) {
    playFinalCue('uiPanel', true)
    playOwnerGreetingVoice(ownerId, true)
    setActiveOwnerId(ownerId)
    setOwnerBrowsing((current) => ({
      ...current,
      [ownerId]: current[ownerId] ?? resolveOwnerBrowsingState(ownerId),
    }))
    setActiveSurface(null)
    setPreviewOpen(false)
    setShopkeeperHovered(false)
    setFeedback('')
    replaceSurfaceRoute(null)
  }

  function toggleShopPanel(options?: { skipOpenVoice?: boolean; skipPanelCue?: boolean }) {
    const nextOpen = activeSurface !== 'shop'
    const nextSurface: ShopSurface = nextOpen ? 'shop' : null

    if (nextOpen) {
      if (!options?.skipPanelCue) {
        playFinalCue('uiPanel')
      }

      if (!options?.skipOpenVoice) {
        playOwnerGreetingVoice(activeOwnerId)
      }
      setPreviewOpen(true)
    } else {
      setPreviewOpen(false)
    }

    setFeedback('')
    setActiveSurface(nextSurface)
    replaceSurfaceRoute(nextSurface)
  }

  function handleShopkeeperInteraction() {
    playFinalCue('uiPanel', true)
    playOwnerInteractVoice(activeOwnerId, true)
    toggleShopPanel({ skipOpenVoice: true, skipPanelCue: true })
  }

  function closeShopPanel() {
    setActiveSurface((current) => {
      const nextSurface = current === 'shop' ? null : current
      if (current === 'shop') {
        replaceSurfaceRoute(nextSurface)
      }
      return nextSurface
    })
    setPreviewOpen(false)
    setFeedback('')
  }

  function closePreviewPanel() {
    setPreviewOpen(false)
  }

  function toggleInventoryPanel() {
    const nextOpen = activeSurface !== 'inventory'
    const nextSurface: ShopSurface = nextOpen ? 'inventory' : null

    playFinalCue('uiPanel')
    setPreviewOpen(false)
    setFeedback('')
    setActiveSurface(nextSurface)
    replaceSurfaceRoute(nextSurface)
  }

  function closeInventoryPanel() {
    setActiveSurface((current) => {
      const nextSurface = current === 'inventory' ? null : current
      if (current === 'inventory') {
        replaceSurfaceRoute(nextSurface)
      }
      return nextSurface
    })
    setFeedback('')
  }

  function toggleCheckoutPanel() {
    const nextOpen = activeSurface !== 'stash'
    const nextSurface: ShopSurface = nextOpen ? 'stash' : null

    playFinalCue('uiPanel')
    setPreviewOpen(false)
    setFeedback('')
    setActiveSurface(nextSurface)
    replaceSurfaceRoute(nextSurface)
  }

  function closeCheckoutPanel() {
    setActiveSurface((current) => {
      const nextSurface = current === 'stash' ? null : current
      if (current === 'stash') {
        replaceSurfaceRoute(nextSurface)
      }
      return nextSurface
    })
    setFeedback('')
  }

  async function handleCheckout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFeedback('')

    if (cartRows.length === 0) {
      setFeedback('Click an item slot to load at least one relic into the stash.')
      playFinalCue('uiDeny')
      playVoiceCue('stashDeny')
      return
    }

    if (!validateBattleTag(checkoutForm.battleTag)) {
      setFeedback('Enter a valid BattleTag, for example Godzilla8488#1763.')
      playFinalCue('uiDeny')
      playVoiceCue('stashDeny')
      return
    }

    setCheckoutPending(true)
    const checkoutLines = cartRows.map((row) => ({
      productId: row.productId,
      quantity: row.quantity,
    }))

    const payload: CheckoutPayload = {
      ...checkoutForm,
      items: checkoutLines,
    }

    try {
      const result = await createCheckout(payload)

      if (result.mode === 'live') {
        savePendingCheckout(checkoutLines)
        window.location.href = result.url
        return
      }

      clearPendingCheckout()
      addLinesToOwnedInventory(checkoutLines)
      setFeedback(`${result.message} Items moved from stash into permanent inventory.`)
      playFinalCue('checkoutSuccess')
      playStashCheckoutVoice(subtotal)
      setCart([])
      setCheckoutForm(DEFAULT_CHECKOUT_FORM)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Checkout failed.'
      setFeedback(message)
      playFinalCue('uiDeny')
      playVoiceCue('stashDeny')
    } finally {
      setCheckoutPending(false)
    }
  }

  async function handleAdminLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFeedback('')
    setAdminPending(true)

    try {
      const session = await loginAdmin(adminForm.username, adminForm.password)
      setAdminAuthenticated(session.authenticated)
      setAdminUsername(session.username ?? '')
      setAdminMode(session.mode)
      setAdminForm(DEFAULT_ADMIN_FORM)
      setFeedback(
        session.mode === 'demo'
          ? 'Demo host console unlocked. Replace with real secrets before launch.'
          : 'Host console unlocked.',
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Admin login failed.'
      setFeedback(message)
    } finally {
      setAdminPending(false)
    }
  }

  async function handleAdminLogout() {
    await logoutAdmin()
    setAdminAuthenticated(false)
    setAdminUsername('')
    setAdminOrders([])
    setFeedback('Host console closed.')
  }

  function handleStonePointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    if (portalState !== 'locked') {
      return
    }

    dragPointerIdRef.current = event.pointerId
    stoneInteractionModeRef.current = effectiveStoneSeated ? 'rotate' : 'drag'

    if (stoneInteractionModeRef.current === 'rotate') {
      rotateAnchorRef.current = {
        x: event.clientX,
        rotation: stoneRotationRef.current,
      }
      setIsRotatingStone(true)
      setStoneNearSocket(true)
    } else {
      const stoneRect = event.currentTarget.getBoundingClientRect()
      dragOffsetRef.current = {
        x: event.clientX - stoneRect.left,
        y: event.clientY - stoneRect.top,
      }
      setIsDraggingStone(true)
      setStoneNearSocket(false)
    }

    playPortalCue('stoneGrab')
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handleStonePointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    if (
      portalState !== 'locked' ||
      dragPointerIdRef.current !== event.pointerId ||
      !overlayRef.current
    ) {
      return
    }

    event.preventDefault()

    const bounds = overlayRef.current.getBoundingClientRect()
    const mode = stoneInteractionModeRef.current
    if (mode === 'rotate') {
      const delta = event.clientX - rotateAnchorRef.current.x
      const nextRotation = rotateAnchorRef.current.rotation + delta * 0.9
      rotatePortalStone(nextRotation)
      return
    }

    if (!isDraggingStone) {
      return
    }

    const frame = getStoneFrame(stoneSize)
    const next = {
      x: clamp(event.clientX - bounds.left - dragOffsetRef.current.x, 14, bounds.width - frame.width - 14),
      y: clamp(event.clientY - bounds.top - dragOffsetRef.current.y, 14, bounds.height - frame.height - 14),
    }

    const socket = getSocketPosition(bounds.width, bounds.height, stoneSize)
    const dx = next.x - socket.x
    const dy = next.y - socket.y
    const distance = Math.sqrt(dx * dx + dy * dy)
    const nearSocket = distance <= Math.min(frame.width, frame.height) * 0.72

    setStoneNearSocket(nearSocket)

    updateStonePosition(next)
  }

  function handleStonePointerUp(event: ReactPointerEvent<HTMLButtonElement>) {
    if (dragPointerIdRef.current !== event.pointerId || !overlayRef.current) {
      return
    }

    dragPointerIdRef.current = null
    const mode = stoneInteractionModeRef.current
    stoneInteractionModeRef.current = null
    setIsDraggingStone(false)
    setIsRotatingStone(false)

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    if (portalState !== 'locked') {
      return
    }

    const bounds = overlayRef.current.getBoundingClientRect()
    const socket = getSocketPosition(bounds.width, bounds.height, stoneSize)
    const seat = getStoneSeatPosition(bounds.width, bounds.height, stoneSize)
    const current = stonePositionRef.current
    const frame = getStoneFrame(stoneSize)
    const dx = current.x - socket.x
    const dy = current.y - socket.y
    const distance = Math.sqrt(dx * dx + dy * dy)
    const nearSocket = distance <= Math.min(frame.width, frame.height) * 0.6
    setStoneNearSocket(nearSocket)

    if (mode === 'rotate') {
      if (effectiveStoneSeated) {
        void evaluatePortalTumblerRotation(stoneRotationRef.current, stoneRotationRef.current)
      }
      return
    }

    if (nearSocket) {
      updateStonePosition(seat)
      setStoneNearSocket(true)
      setStoneSeated(true)
      setStonePulse(false)
      playPortalCue('stoneSocketSnap')
      resetPortalTumblerProgress()
      window.requestAnimationFrame(() => {
        setStonePulse(true)
      })

      window.setTimeout(() => {
        setStonePulse(false)
      }, 900)

      return
    }

    setStoneNearSocket(false)
    setStoneSeated(false)
    resetPortalTumblerProgress()
    updateStoneRotation(portalTune.stoneStartRotation)
    updateStonePosition(getDockPosition(bounds.width, bounds.height, stoneSize))
  }

  function handleStoneClick() {
    if (portalState !== 'locked' || isDraggingStone) {
      return
    }

    setStonePulse(false)
    window.requestAnimationFrame(() => {
      setStonePulse(true)
    })

    window.setTimeout(() => {
      setStonePulse(false)
    }, 900)
  }

  function handleStoneWheel(event: ReactWheelEvent<HTMLButtonElement>) {
    if (portalState !== 'locked' || !effectiveStoneSeated) {
      return
    }

    event.preventDefault()
    const step = event.deltaY > 0 ? 18 : -18
    const nextRotation = stoneRotationRef.current + step
    rotatePortalStone(nextRotation)
  }

  function handleStoneContextMenu(event: ReactMouseEvent<HTMLButtonElement>) {
    event.preventDefault()
  }

  function handleStoneKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (portalState !== 'locked' || !effectiveStoneSeated) {
      return
    }

    if (event.key === 'ArrowLeft' || event.key === 'a' || event.key === 'A' || event.key === 'q' || event.key === 'Q') {
      event.preventDefault()
      const nextRotation = stoneRotationRef.current - 18
      rotatePortalStone(nextRotation)
    }

    if (event.key === 'ArrowRight' || event.key === 'd' || event.key === 'D' || event.key === 'e' || event.key === 'E') {
      event.preventDefault()
      const nextRotation = stoneRotationRef.current + 18
      rotatePortalStone(nextRotation)
    }
  }

  if (standaloneViewerProduct) {
    return (
      <StandaloneMdxViewer
        product={standaloneViewerProduct}
        onBack={closeStandaloneViewer}
      />
    )
  }

  if (captureProductId) {
    return <CapturePreview productId={captureProductId} />
  }

  if (thumbnailProduct?.previewAsset) {
    return (
      <main className="thumbnail-render-shell" style={{ ['--product-accent' as string]: thumbnailProduct.accent }}>
        <MdxPreview asset={thumbnailProduct.previewAsset} showControls={false} />
      </main>
    )
  }

  return (
    <>
      {!portalOverlayRetired ? (
        <div
          className={`portal-overlay portal-overlay-${portalState} ${isDraggingStone ? 'portal-overlay-dragging' : ''} ${portalTumblerFailedStep !== null ? 'portal-overlay-tumbler-failed' : ''} ${portalTumblerSuccessStep !== null ? 'portal-overlay-tumbler-success' : ''} ${portalTumblerHoldActive ? 'portal-overlay-tumbler-hold' : ''} ${portalEntered ? 'portal-overlay-hidden' : ''}`}
          ref={overlayRef}
          style={portalOverlayStyle}
        >
          <div className="portal-overlay-backdrop" />
          <div className="portal-overlay-scene">
            <div className="portal-overlay-ambient" aria-hidden="true">
              <span className="portal-overlay-gate-rays" />
              <span className="portal-overlay-energy-ring" />
              <span className="portal-overlay-lightning portal-overlay-lightning-a" />
              <span className="portal-overlay-lightning portal-overlay-lightning-b" />
              <span className="portal-overlay-candle portal-overlay-candle-left" />
              <span className="portal-overlay-candle portal-overlay-candle-right" />
              <span className="portal-overlay-rune-haze portal-overlay-rune-haze-left" />
              <span className="portal-overlay-rune-haze portal-overlay-rune-haze-right" />
              <span className="portal-overlay-floor-shadow" />
              <span className="portal-overlay-depth-fog portal-overlay-depth-fog-a" />
              <span className="portal-overlay-depth-fog portal-overlay-depth-fog-b" />
              <span className="portal-overlay-dust portal-overlay-dust-a" />
              <span className="portal-overlay-dust portal-overlay-dust-b" />
              {PORTAL_SPARKS.map((spark, index) => (
                <span
                  className="portal-overlay-spark"
                  key={`portal-spark-${index}`}
                  style={{
                    '--spark-x': `${spark.x}%`,
                    '--spark-y': `${spark.y}%`,
                    '--spark-size': `${spark.size}rem`,
                    '--spark-delay': `${spark.delay}s`,
                    '--spark-duration': `${spark.duration}s`,
                  } as CSSProperties}
                />
              ))}
            </div>

          <div
            className={`portal-overlay-gate portal-overlay-gate-${portalState}`}
            style={{
              left: `${portalTune.gateX * 100}%`,
              top: `${portalTune.gateY * 100}%`,
              transform: portalGateTransform,
            }}
          >
            {ModelViewer({
              src: assetUrl('/models-original/site-gate-original.glb'),
              className: 'portal-overlay-gate-model',
              alt: 'Runic gate portal',
              autoplay: true,
              ar: false,
              exposure: '1.06',
              'shadow-intensity': '1',
              'environment-image': 'neutral',
              'camera-controls': false,
              'disable-zoom': true,
              'interaction-prompt': 'none',
              'camera-orbit': portalGateOrbit,
              'field-of-view': `${portalTune.gateFov}deg`,
            })}
            <div
              className={`portal-overlay-lock-ring ${stoneNearSocket ? 'portal-overlay-lock-ring-near' : ''} ${stoneAligned ? 'portal-overlay-lock-ring-aligned' : ''} ${portalTumblerFailedStep !== null ? 'portal-overlay-lock-ring-failed' : ''} ${portalTumblerSuccessStep !== null ? 'portal-overlay-lock-ring-success' : ''}`}
              style={{
                left: `${portalTune.socketX * 100}%`,
                top: `${portalTune.socketY * 100}%`,
              }}
            >
              <span className="portal-overlay-lock-groove" />
              <span className="portal-overlay-lock-scrape" />
              <span className="portal-overlay-lock-crack" />
              <span className="portal-overlay-lock-burst" />
              {PORTAL_LOCK_NOTCHES.map((notch) => (
                <span
                  className={`portal-overlay-lock-notch ${notch < portalActiveNotches ? 'portal-overlay-lock-notch-active' : ''}`}
                  key={`lock-notch-${notch}`}
                  style={getRunePolarStyle(notch * 15, 48)}
                />
              ))}
            </div>
            <div
              className={`portal-overlay-rune-ring portal-overlay-rune-ring-gate ${stoneNearSocket ? 'portal-overlay-rune-ring-near' : ''} ${stoneAligned ? 'portal-overlay-rune-ring-aligned' : ''}`}
              style={{
                left: `${portalTune.socketX * 100}%`,
                top: `${portalTune.socketY * 100}%`,
              }}
            >
              {PORTAL_RUNES.map((rune) => (
                <span
                  className={`portal-overlay-rune portal-overlay-rune-gate portal-overlay-rune-gate-carved portal-overlay-rune-${rune.id}`}
                  key={`gate-${rune.id}`}
                  style={getPortalRuneStyle(rune, rune.angle + portalTune.gateRuneAngleOffset, portalTune.gateRuneRadius)}
                  aria-hidden="true"
                />
              ))}
            </div>
            <div
              className="portal-overlay-rune-ring portal-overlay-rune-ring-targets"
              style={{
                left: `${portalTune.socketX * 100}%`,
                top: `${portalTune.socketY * 100}%`,
              }}
            >
              {portalTumblerTargets.map((target) => {
                const targetState =
                  target.index < portalTumblerStep
                    ? 'locked'
                    : target.index === portalTumblerStep
                      ? 'current'
                      : 'queued'
                const failed = portalTumblerFailedStep === target.index
                const success = portalTumblerSuccessStep === target.index

                return (
                  <span
                    className={`portal-overlay-rune portal-overlay-rune-gate-target portal-overlay-rune-target-${targetState} portal-overlay-rune-direction-${target.direction} ${failed ? 'portal-overlay-rune-target-failed' : ''} ${success ? 'portal-overlay-rune-target-success' : ''} portal-overlay-rune-${target.rune.id}`}
                    key={`gate-target-${target.id}`}
                    style={getPortalRuneStyle(target.rune, target.gateAngle, portalTune.gateRuneRadius)}
                    aria-hidden="true"
                  />
                )
              })}
            </div>
            <div
              className={`portal-overlay-socket ${stoneNearSocket ? 'portal-overlay-socket-near' : ''} ${stoneAligned ? 'portal-overlay-socket-aligned' : ''}`}
              style={{
                left: `${portalTune.socketX * 100}%`,
                top: `${portalTune.socketY * 100}%`,
              }}
            >
              <span className="portal-overlay-socket-core" />
              <span className="portal-overlay-socket-groove portal-overlay-socket-groove-a" />
              <span className="portal-overlay-socket-groove portal-overlay-socket-groove-b" />
              <span className="portal-overlay-socket-groove portal-overlay-socket-groove-c" />
            </div>
            <div
              className={`portal-overlay-alignment-beam ${effectiveStoneSeated ? 'portal-overlay-alignment-beam-active' : ''}`}
              style={{
                left: `${portalTune.socketX * 100}%`,
                top: `${portalTune.socketY * 100}%`,
              }}
            />
            <div className="portal-overlay-bloom" />
          </div>

          <button
            className={`portal-overlay-stone portal-overlay-stone-${portalState} ${isDraggingStone ? 'portal-overlay-stone-dragging' : ''} ${isRotatingStone ? 'portal-overlay-stone-rotating' : ''} ${stonePulse ? 'portal-overlay-stone-pulse' : ''} ${stoneAligned ? 'portal-overlay-stone-aligned' : ''} ${effectiveStoneSeated ? 'portal-overlay-stone-seated' : ''}`}
            disabled={portalState === 'linking'}
            onClick={handleStoneClick}
            onContextMenu={handleStoneContextMenu}
            onDragStart={(pointerEvent) => pointerEvent.preventDefault()}
            onKeyDown={handleStoneKeyDown}
            onPointerCancel={handleStonePointerUp}
            onPointerDown={handleStonePointerDown}
            onPointerMove={handleStonePointerMove}
            onPointerUp={handleStonePointerUp}
            onWheel={handleStoneWheel}
            style={{
              left: `${stonePosition.x}px`,
              top: `${stonePosition.y}px`,
              width: `${stoneFrame.width}px`,
              height: `${stoneFrame.height}px`,
              '--portal-rotation': `${stoneRotation}deg`,
            } as CSSProperties}
            type="button"
            aria-label="Drag the WC3 runestone into the gate socket, then rotate it until the runes align"
          >
            <span className="portal-overlay-stone-rotor">
              {ModelViewer({
                src: assetUrl('/models-original/site-rune-stone-original.glb'),
                className: 'portal-overlay-stone-model',
                alt: 'Runestone key',
                autoplay: true,
                ar: false,
                exposure: '1.08',
                'shadow-intensity': '1',
                'environment-image': 'neutral',
                'camera-controls': false,
                'disable-zoom': true,
                'disable-pan': true,
                'interaction-prompt': 'none',
                orientation: portalStoneOrientation,
                'camera-target': '0m 0.02m 0m',
                'camera-orbit': portalStoneOrbit,
                'field-of-view': `${portalTune.stoneFov}deg`,
              })}
              <span
                className="portal-overlay-rune-ring portal-overlay-rune-ring-stone"
                style={{
                  transform: `translate(-50%, -50%) rotate(${portalTune.stoneRuneAngleOffset}deg)`,
                }}
              >
                {PORTAL_RUNES.map((rune) => (
                  (() => {
                    const target = portalTumblerTargets.find((item) => item.rune.id === rune.id)
                    const targetState = target
                      ? target.index < portalTumblerStep
                        ? 'locked'
                        : target.index === portalTumblerStep
                          ? 'current'
                          : 'queued'
                      : 'idle'

                    return (
                      <span
                        className={`portal-overlay-rune portal-overlay-rune-stone portal-overlay-rune-stone-${targetState} portal-overlay-rune-${rune.id}`}
                        key={`stone-${rune.id}`}
                        style={getPortalRuneStyle(rune, rune.angle, portalTune.stoneRuneRadius)}
                        aria-hidden="true"
                      />
                    )
                  })()
                ))}
              </span>
            </span>
          </button>

          </div>
        </div>
      ) : null}

      <div className={`game-shop-shell ${portalEntered ? 'game-shop-shell-entered' : 'game-shop-shell-sealed'}`}>
        <div className="page-atmosphere" />

        <div className="shop-canvas">
          <div
            className={`scene-stage ${activeSurface ? 'scene-stage-panel-open' : ''} ${shopOpen ? 'scene-stage-shop-open' : ''} ${centerActorMode ? `scene-stage-${centerActorMode}` : 'scene-stage-empty'}`}
            aria-label={`${sceneContextLabel} scene`}
            style={{ ['--owner-accent' as string]: topbarAccent }}
          >
            <div className="scene-stage-fx" aria-hidden="true">
              <span className="scene-stage-vignette" />
            </div>

            <header className="scene-topbar">
              <div className="shop-status-brand">
                <img className="shop-status-crest" src={assetUrl('/generated/optimized/crest.webp')} alt="" />
                <div>
                  <p className="eyebrow">wc3dotashop</p>
                  <h1>{topbarTitle}</h1>
                </div>
              </div>

              <div className="scene-topbar-rail">
                <div className="scene-owner-switch" role="tablist" aria-label="Shop owners">
                  {SHOP_OWNERS.map((owner) => (
                    <button
                      key={owner.id}
                      className={`scene-owner-tab ${ownerContextActive && activeOwnerId === owner.id ? 'scene-owner-tab-active' : ''}`}
                      onClick={() => switchOwner(owner.id)}
                      role="tab"
                      aria-selected={ownerContextActive && activeOwnerId === owner.id}
                      type="button"
                    >
                      <strong>{owner.label}</strong>
                      <span>{owner.title}</span>
                    </button>
                  ))}
                </div>

                <nav className="scene-topbar-actions" aria-label="Store navigation">
                  <button
                    className={`scene-nav-button ${inventoryOpen ? 'scene-nav-button-active' : ''}`}
                    onClick={toggleInventoryPanel}
                    type="button"
                  >
                    Inventory
                    {inventoryItemCount > 0 ? <span className="scene-nav-count">{inventoryItemCount}</span> : null}
                  </button>
                  <button
                    className={`scene-nav-button ${checkoutOpen ? 'scene-nav-button-active' : ''}`}
                    onClick={toggleCheckoutPanel}
                    type="button"
                  >
                    Stash
                    {subtotal > 0 ? <span className="scene-nav-count"><GoldAmount value={subtotal} /></span> : null}
                  </button>
                </nav>
              </div>
            </header>

            {centerActorMode ? (
              <div className={`scene-shopkeeper-shell ${shopOpen ? 'scene-shopkeeper-shell-zoomed' : ''} ${inventoryOpen ? 'scene-shopkeeper-shell-player' : ''}`}>
                {centerActorMode === 'shopkeeper' ? (
                  <>
                    <div
                      className={`scene-shopkeeper-hitbox ${shopOpen ? 'scene-shopkeeper-hitbox-zoomed' : ''} ${shopkeeperHovered || shopOpen ? 'scene-shopkeeper-hitbox-selected' : ''}`}
                      onClick={handleShopkeeperInteraction}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          handleShopkeeperInteraction()
                        }
                      }}
                      onMouseEnter={() => setShopkeeperHovered(true)}
                      onMouseLeave={() => setShopkeeperHovered(false)}
                      role="button"
                      tabIndex={0}
                      aria-label={`${activeOwner.label} shopkeeper`}
                    >
                      {ModelViewer({
                        key: `${activeOwnerId}-${activeGodzillaViewKey}`,
                        src: activeOwner.modelSrc,
                        ref: shopkeeperModelRef,
                        className: 'scene-model scene-shopkeeper-model',
                        alt: `${activeOwner.label} shopkeeper idle animation`,
                        autoplay: true,
                        ar: false,
                        exposure: '1.16',
                        'shadow-intensity': '0',
                        'environment-image': 'neutral',
                        'camera-controls': true,
                        'disable-pan': true,
                        'disable-zoom': true,
                        'interaction-prompt': 'none',
                        loading: 'eager',
                        ...(activeOwner.animationName ? { 'animation-name': activeOwner.animationName } : {}),
                        ...(activeOwner.modelOrientation ? { orientation: activeOwner.modelOrientation } : {}),
                        'camera-target': godzillaCameraTarget,
                        'camera-orbit': godzillaCameraOrbit,
                        'field-of-view': godzillaFieldOfView,
                        'min-camera-orbit': godzillaMinCameraOrbit,
                        'max-camera-orbit': godzillaMaxCameraOrbit,
                      })}
                    </div>
                    <div className={`scene-shopkeeper-tag ${shopkeeperHovered || shopOpen ? 'scene-shopkeeper-tag-active' : ''}`}>
                      <strong>{activeOwner.label}</strong>
                      <span>{activeOwner.title}</span>
                    </div>
                    <button className="scene-shop-toggle" onClick={handleShopkeeperInteraction} type="button">
                      <span>{shopOpen ? activeOwner.title : 'Vendor interface'}</span>
                      <strong>{shopOpen ? 'Close shop' : 'Open shop'}</strong>
                    </button>
                  </>
                ) : (
                  <>
                    <div className="scene-shopkeeper-hitbox scene-player-hitbox" aria-label="Player character">
                      {ModelViewer({
                        key: 'player-inventory-center',
                        src: PLAYER_DEFAULT_MODEL_SRC,
                        className: 'scene-model scene-shopkeeper-model scene-player-model',
                        alt: 'Warcraft style male human player model',
                        autoplay: true,
                        ar: false,
                        exposure: '1.16',
                        'shadow-intensity': '0',
                        'environment-image': 'neutral',
                        'camera-controls': true,
                        'disable-pan': true,
                        'disable-zoom': true,
                        'interaction-prompt': 'none',
                        loading: 'eager',
                        'animation-name': PLAYER_DEFAULT_ANIMATION,
                        'camera-orbit': '0deg 78deg 168%',
                        'min-camera-orbit': '-180deg 78deg 168%',
                        'max-camera-orbit': '180deg 78deg 168%',
                        'field-of-view': '28deg',
                      })}
                    </div>
                    <div className="scene-shopkeeper-tag scene-shopkeeper-tag-active">PLAYER</div>
                  </>
                )}
              </div>
            ) : null}

            {shopOpen ? (
              <>
                <section className="inventory-overlay window-frame">
                  <div className="inventory-overlay-header">
                    <div className="inventory-overlay-title">
                      <p className="eyebrow">Vendor Stock</p>
                      <strong>{activeStockLabel}</strong>
                    </div>
                    <button className="overlay-close-button" onClick={closeShopPanel} type="button" aria-label="Close shop">
                      ×
                    </button>
                  </div>

                  <div className="inventory-list">
                    {visibleInventoryProducts.length > 0 ? (
                      visibleInventoryProducts.map((product) => (
                        <button
                          key={product.id}
                          className={`inventory-row inventory-row-tier-${product.rarity} ${selectedProduct?.id === product.id ? 'inventory-row-selected' : ''} inventory-row-${product.status}`}
                          aria-describedby={`inventory-tooltip-${product.id}`}
                          onClick={() => handleProductSelect(product.id, { speak: true })}
                          style={{ ['--product-accent' as string]: product.accent }}
                          type="button"
                        >
                          <span className={`inventory-row-accent inventory-row-accent-${product.rarity}`} aria-hidden="true" />
                          <span className={`inventory-row-thumb inventory-row-thumb-${product.rarity}`} aria-hidden="true">
                            <img
                              alt=""
                              className="inventory-row-thumb-image"
                              loading="lazy"
                              onError={(event) => {
                                event.currentTarget.hidden = true
                              }}
                              src={product.thumbnailSrc}
                            />
                            <span className="inventory-row-thumb-seed">{product.artSeed}</span>
                          </span>
                          <span className="inventory-row-copy">
                            <span className="inventory-row-hero">{product.hero}</span>
                            <span className="inventory-row-name">{product.name}</span>
                          </span>
                          <span className="inventory-row-meta">
                            <span className={`inventory-row-rarity inventory-row-rarity-${product.rarity}`}>{product.rarity}</span>
                            <GoldAmount value={product.priceGold} className="inventory-row-price" />
                            <span className="inventory-row-stock">{formatStockLabel(product.stockTotal)}</span>
                          </span>
                          <span className="inventory-row-tooltip" id={`inventory-tooltip-${product.id}`} role="tooltip">
                            <strong>{product.name}</strong>
                            <span>{product.summary}</span>
                          </span>
                        </button>
                      ))
                    ) : (
                      <div className="inventory-empty-state">
                        <p>No vendor stock loaded.</p>
                      </div>
                    )}
                  </div>
                </section>

                {previewOpen ? (
                  <aside className="preview-overlay window-frame">
                    {selectedProduct ? (
                      <>
                        <button className="overlay-close-button overlay-close-button-preview" onClick={closePreviewPanel} type="button" aria-label="Close preview">
                          ×
                        </button>
                        <div className="preview-overlay-header">
                          <div>
                            <p className="eyebrow">{selectedProduct.hero}</p>
                            <h2>{selectedProduct.name}</h2>
                          </div>
                          <div className="preview-overlay-meta">
                            <span className={`preview-overlay-rarity preview-overlay-rarity-${selectedProduct.rarity}`}>
                              {selectedProduct.rarity}
                            </span>
                            <span className={`preview-overlay-status preview-overlay-status-${selectedProduct.status}`}>
                              {selectedProduct.status}
                            </span>
                            <GoldAmount value={selectedProduct.priceGold} className="selected-panel-price" />
                          </div>
                        </div>

                        <div
                          className={`preview-stage preview-stage-clean preview-stage-${selectedProduct.rarity}`}
                          style={{ ['--product-accent' as string]: selectedProduct.accent }}
                        >
                          <ProductPreviewMedia product={selectedProduct} />
                        </div>

                        <div className="preview-overlay-footer">
                          <div className="preview-overlay-description">
                            <p>{selectedProduct.summary}</p>
                            <span>{selectedProduct.compatibility}</span>
                          </div>
                          <p className="selected-panel-state">
                            {selectedStashRow
                              ? `Stash x${selectedStashRow.quantity}`
                              : selectedInventoryRow
                                ? `Owned x${selectedInventoryRow.quantity}`
                                : selectedProduct.type === 'service'
                                  ? 'Service ticket'
                                  : 'Hero skin unlock'}
                          </p>
                          <div className="preview-overlay-actions">
                            {selectedProduct.previewAsset ? (
                              <button
                                className="scene-secondary-button"
                                onClick={() => openStandaloneViewer(selectedProduct.id)}
                                type="button"
                              >
                                View MDX
                              </button>
                            ) : null}
                            <button
                              className="purchase-button"
                              disabled={selectedProduct.status === 'coming-soon'}
                              onClick={() => handleGridPurchase(selectedProduct.id)}
                              type="button"
                            >
                              {selectedProduct.status === 'coming-soon' ? 'Locked' : 'Add to stash'}
                            </button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="selected-panel-empty">
                        <p className="eyebrow">Empty</p>
                        <h3>No item selected.</h3>
                      </div>
                    )}
                  </aside>
                ) : null}
              </>
            ) : null}

            {inventoryOpen ? (
              <aside className="player-inventory-panel window-frame">
                <div className="player-inventory-header">
                  <div>
                    <p className="eyebrow">Player Inventory</p>
                    <h3>Permanent Storage</h3>
                  </div>
                  <div className="stash-total">
                    <span>Owned</span>
                    <strong>{inventoryItemCount}</strong>
                  </div>
                  <button className="overlay-close-button" onClick={closeInventoryPanel} type="button" aria-label="Close inventory">
                    ×
                  </button>
                </div>

                <div className="player-inventory-grid" aria-label="Permanent player inventory slots">
                  {playerInventorySlots.map((row, index) => (
                    row ? (
                      <article
                        className={`player-inventory-slot player-inventory-slot-filled player-inventory-slot-${row.product.rarity}`}
                        key={row.product.id}
                        style={{ ['--product-accent' as string]: row.product.accent }}
                        title={`${row.product.name}: ${row.product.summary}`}
                      >
                        <button
                          className="player-inventory-thumb"
                          onClick={() => inspectOwnedInventoryItem(row.product.id)}
                          type="button"
                          aria-label={`Inspect owned ${row.product.name}`}
                        >
                          <img
                            alt=""
                            loading="lazy"
                            onError={(event) => {
                              event.currentTarget.hidden = true
                            }}
                            src={row.product.thumbnailSrc}
                          />
                          <span>{row.product.artSeed}</span>
                          <em>{row.quantity}</em>
                        </button>
                        <div className="player-inventory-copy">
                          <strong>{row.product.name}</strong>
                          <span>{row.product.hero}</span>
                        </div>
                        <div className="player-inventory-description">
                          <strong>{row.product.name}</strong>
                          <span>{row.product.summary}</span>
                        </div>
                        <div className="player-inventory-actions">
                          {row.product.previewAsset ? (
                            <button onClick={() => openStandaloneViewer(row.product.id)} type="button">
                              MDX
                            </button>
                          ) : null}
                        </div>
                      </article>
                    ) : (
                      <div className="player-inventory-slot player-inventory-slot-empty" key={`empty-${index}`}>
                        <span>{index + 1}</span>
                      </div>
                    )
                  ))}
                </div>

                <div className="player-inventory-footer">
                  <div>
                    <span>Permanent items</span>
                    <strong>{inventoryItemCount}</strong>
                  </div>
                  <button className="checkout-button" onClick={() => setActiveSurface('stash')} type="button">
                    {cartItemCount > 0 ? 'Open stash' : 'Stash empty'}
                  </button>
                </div>
              </aside>
            ) : null}

            {checkoutOpen ? (
              <>
                <div className="stash-master-presence">
                  <div className="stash-master-aura" aria-hidden="true" />
                  <video
                    ref={stashMasterVideoRef}
                    className="stash-master-character"
                    src={STASH_CHECKOUT_CHARACTER_VIDEO}
                    poster={STASH_CHECKOUT_CHARACTER_POSTER}
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload="auto"
                    aria-hidden="true"
                  />
                  <div className="stash-master-nameplate">
                    <strong>Kel'Thuzad</strong>
                    <span>The Lich, Stash Master</span>
                  </div>
                </div>

                <aside className="stash-drawer window-frame">
                  <div className="checkout-panel-header">
                    <div>
                      <p className="eyebrow">Stash</p>
                      <h3>Checkout Grid</h3>
                    </div>
                    <div className="stash-total">
                      <span>Subtotal</span>
                      <strong><GoldAmount value={subtotal} /></strong>
                    </div>
                    <button className="overlay-close-button" onClick={closeCheckoutPanel} type="button" aria-label="Close stash">
                      ×
                    </button>
                  </div>

                  <div className="stash-mini">
                  {stashSlots.map((row, index) => (
                    row ? (
                      <div
                        className="stash-mini-slot stash-mini-slot-filled"
                        key={row.product.id}
                        style={{ ['--product-accent' as string]: row.product.accent }}
                      >
                        <span className="stash-mini-art" aria-hidden="true">
                          <img
                            alt=""
                            loading="lazy"
                            onError={(event) => {
                              event.currentTarget.hidden = true
                            }}
                            src={row.product.thumbnailSrc}
                          />
                          <span>{row.product.artSeed}</span>
                        </span>
                        <div className="stash-mini-copy">
                          <strong>{row.product.name}</strong>
                          <span>{row.quantity}x</span>
                        </div>
                        <div className="stash-mini-actions">
                          {row.product.previewAsset ? (
                            <button onClick={() => openStandaloneViewer(row.product.id)} type="button">
                              MDX
                            </button>
                          ) : null}
                          <button onClick={() => updateCartQuantity(row.product.id, -1)} type="button">
                            -
                          </button>
                          <button onClick={() => updateCartQuantity(row.product.id, 1)} type="button">
                            +
                          </button>
                          <button onClick={() => removeFromCart(row.product.id)} type="button">
                            x
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="stash-mini-slot stash-mini-slot-empty" key={`stash-empty-${index}`}>
                        <span className="stash-mini-empty-mark">{index + 1}</span>
                      </div>
                    )
                  ))}
                  </div>

                  <form className="stash-checkout-form" onSubmit={handleCheckout}>
                  <div className="checkout-grid">
                    <label className="console-field">
                      <span>BattleTag</span>
                      <input
                        value={checkoutForm.battleTag}
                        onChange={(event) =>
                          setCheckoutForm((current) => ({ ...current, battleTag: event.target.value }))
                        }
                        placeholder="Godzilla8488#1763"
                      />
                    </label>

                    <label className="console-field">
                      <span>Email</span>
                      <input
                        type="email"
                        value={checkoutForm.email}
                        onChange={(event) =>
                          setCheckoutForm((current) => ({ ...current, email: event.target.value }))
                        }
                        placeholder="you@example.com"
                      />
                    </label>

                    <label className="console-field">
                      <span>Region</span>
                      <select
                        value={checkoutForm.region}
                        onChange={(event) =>
                          setCheckoutForm((current) => ({ ...current, region: event.target.value }))
                        }
                      >
                        {REGIONS.map((region) => (
                          <option key={region} value={region}>
                            {region}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="checkout-actions">
                    <p>Entitlements bind to this BattleTag.</p>
                    <div className="checkout-action-buttons">
                      <button className="checkout-button" disabled={checkoutPending} type="submit">
                        {checkoutPending ? 'Preparing checkout...' : 'Open secure checkout'}
                      </button>
                    </div>
                  </div>
                  </form>
                </aside>
              </>
            ) : null}

            {feedback ? <div className="feedback-banner window-frame">{feedback}</div> : null}

            {adminOpen ? (
              <section className="host-console host-console-overlay window-frame">
              <div className="host-console-header">
                <div>
                  <p className="eyebrow">Host console</p>
                  <h2>Bot-side sync and receipt review</h2>
                </div>
                {adminAuthenticated ? (
                  <button className="small-control" onClick={handleAdminLogout} type="button">
                    Log out {adminUsername}
                  </button>
                ) : null}
              </div>

              {!adminAuthenticated ? (
                <form className="host-login" onSubmit={handleAdminLogin}>
                  <label className="console-field">
                    <span>Admin username</span>
                    <input
                      value={adminForm.username}
                      onChange={(event) =>
                        setAdminForm((current) => ({ ...current, username: event.target.value }))
                      }
                      placeholder="partner-admin"
                    />
                  </label>
                  <label className="console-field">
                    <span>Password</span>
                    <input
                      type="password"
                      value={adminForm.password}
                      onChange={(event) =>
                        setAdminForm((current) => ({ ...current, password: event.target.value }))
                      }
                      placeholder="••••••••"
                    />
                  </label>
                  <button className="purchase-button" disabled={adminPending} type="submit">
                    {adminPending ? 'Checking access...' : 'Unlock host console'}
                  </button>
                  <p className="host-note">
                    {adminMode === 'demo'
                      ? `Demo mode is active. Use ${DEMO_ADMIN.username} / ${DEMO_ADMIN.password} during local testing only.`
                      : 'Live mode expects ADMIN_USERNAME, ADMIN_PASSWORD, and ADMIN_SESSION_SECRET on the server.'}
                  </p>
                </form>
              ) : (
                <div className="host-dashboard">
                  <div className="host-kpis">
                    <article>
                      <span>Visible orders</span>
                      <strong>{adminOrders.length}</strong>
                    </article>
                    <article>
                      <span>Awaiting sync</span>
                      <strong>{adminOrders.filter((order) => order.status === 'paid-awaiting-sync').length}</strong>
                    </article>
                    <article>
                      <span>Source</span>
                      <strong>{adminOrdersMode}</strong>
                    </article>
                  </div>

                  <div className="host-orders">
                    {adminOrdersLoading ? (
                      <p className="host-empty">Loading orders...</p>
                    ) : adminOrders.length === 0 ? (
                      <p className="host-empty">No orders loaded yet.</p>
                    ) : (
                      adminOrders.map((order) => (
                        <article className="host-order-row" key={order.id}>
                          <div className="host-order-topline">
                            <strong>{order.id}</strong>
                            <span>{order.status}</span>
                          </div>
                          <p>{order.battleTag}</p>
                          <p>{order.items.join(', ')}</p>
                          <div className="host-order-meta">
                            <GoldAmount value={order.amountGold} />
                            <span>{order.region}</span>
                            <span>{order.source}</span>
                          </div>
                          <small>{order.note}</small>
                        </article>
                      ))
                    )}
                  </div>
                </div>
              )}
              </section>
            ) : null}
          </div>
        </div>
      </div>
    </>
  )
}

export default App
