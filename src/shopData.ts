import { assetUrl } from './assetUrl.js'

export type ProductType = 'skin' | 'service'
export type ProductStatus = 'live' | 'preview' | 'coming-soon'
export type ProductFaction = 'arcane' | 'void' | 'infernal' | 'storm' | 'relic'
export type ProductRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic'
export type ShopOwnerId = 'godzilla8488' | 'pavement'

export interface ProductRarityMeta {
  tier: number
  label: string
  feel: string
  priceBand: string
  minGold: number
  maxGold: number | null
  defaultStockTotal: number
}

export interface ShopOwner {
  id: ShopOwnerId
  label: string
  title: string
  vaultName: string
  summary: string
  searchPlaceholder: string
  modelSrc: string
  accent: string
  animationName?: string
  modelOrientation?: string
}

export interface MdxPreviewAsset {
  kind: 'mdx'
  entry: string
  basePath: string
  camera?: {
    yaw?: number
    pitch?: number
    distanceMultiplier?: number
    targetOffsetX?: number
    targetOffsetY?: number
    targetOffsetZ?: number
    targetZFactor?: number
  }
}

export interface ShopProduct {
  id: string
  ownerId: ShopOwnerId
  name: string
  hero: string
  type: ProductType
  rarity: ProductRarity
  status: ProductStatus
  faction: ProductFaction
  priceGold: number
  stockTotal: number
  accent: string
  artSeed: string
  summary: string
  details: string
  entitlementKey: string
  compatibility: string
  deliveryWindow: string
  thumbnailSrc: string
  previewVideoSrc?: string
  stripePriceEnvKey?: string
  previewAsset?: MdxPreviewAsset
  tags: string[]
}

export interface RoadmapItem {
  title: string
  phase: string
  note: string
}

export interface AdminOrder {
  id: string
  battleTag: string
  email: string
  region: string
  source: 'stripe' | 'demo' | 'partner'
  status: 'pending-payment' | 'paid-awaiting-sync' | 'synced' | 'manual-review'
  createdAt: string
  items: string[]
  amountGold: number
  note: string
}

type SeedProduct = {
  id: string
  ownerId: ShopOwnerId
  name: string
  hero: string
  rarity: ProductRarity
  status?: ProductStatus
  faction: ProductFaction
  priceGold: number
  stockTotal?: number
  accent: string
  artSeed: string
  summary: string
  entry: string
  basePath: string
  previewSafe?: boolean
  camera?: MdxPreviewAsset['camera']
  tags?: string[]
}

const SKIN_COMPATIBILITY = 'DotA Allstars on Warcraft III Reforged'
const SERVICE_COMPATIBILITY = 'WC3Dota account services'

export const PRODUCT_RARITY_META: Record<ProductRarity, ProductRarityMeta> = {
  common: {
    tier: 2,
    label: 'Common',
    feel: 'Normal',
    priceBand: '1-9 gold',
    minGold: 1,
    maxGold: 9,
    defaultStockTotal: 120,
  },
  uncommon: {
    tier: 3,
    label: 'Uncommon',
    feel: 'Slightly better',
    priceBand: '10-24 gold',
    minGold: 10,
    maxGold: 24,
    defaultStockTotal: 48,
  },
  rare: {
    tier: 4,
    label: 'Rare',
    feel: 'Good',
    priceBand: '25-99 gold',
    minGold: 25,
    maxGold: 99,
    defaultStockTotal: 12,
  },
  epic: {
    tier: 5,
    label: 'Epic',
    feel: 'Very desirable',
    priceBand: '100-499 gold',
    minGold: 100,
    maxGold: 499,
    defaultStockTotal: 5,
  },
  legendary: {
    tier: 6,
    label: 'Legendary',
    feel: 'Extremely rare',
    priceBand: '500-999 gold',
    minGold: 500,
    maxGold: 999,
    defaultStockTotal: 2,
  },
  mythic: {
    tier: 7,
    label: 'Mythic',
    feel: 'God-tier / ultra rare',
    priceBand: '1000+ gold',
    minGold: 1000,
    maxGold: null,
    defaultStockTotal: 1,
  },
}

const INVENTORY_THUMBNAIL_REVISION = 'hero-face-v2'
const INVENTORY_VIDEO_REVISION = 'capture-v4'

function createSkinProduct(seed: SeedProduct): ShopProduct {
  const entitlementKey = `skin.${seed.id.replace(/-/g, '.')}`
  const status = seed.status ?? 'live'
  const previewSafe = seed.previewSafe ?? true
  const deliveryWindow =
    status === 'preview'
      ? 'Preview tier. Seeded for live model inspection while the host-bot entitlement path is being tuned.'
      : 'Synced on match start through the host bot and unlocked with -skin.'

  return {
    id: seed.id,
    ownerId: seed.ownerId,
    name: seed.name,
    hero: seed.hero,
    type: 'skin',
    rarity: seed.rarity,
    status,
    faction: seed.faction,
    priceGold: seed.priceGold,
    stockTotal: seed.stockTotal ?? PRODUCT_RARITY_META[seed.rarity].defaultStockTotal,
    accent: seed.accent,
    artSeed: seed.artSeed,
    summary: seed.summary,
    details:
      'Imported from the premium MDX pool and staged inside the site repo so buyers can preview the model before entitlement sync.',
    entitlementKey,
    compatibility: SKIN_COMPATIBILITY,
    deliveryWindow,
    thumbnailSrc: assetUrl(`/inventory-thumbnails/${seed.id}.png?v=${INVENTORY_THUMBNAIL_REVISION}`),
    previewVideoSrc: assetUrl(`/inventory-videos/${seed.id}.mp4?v=${INVENTORY_VIDEO_REVISION}`),
    previewAsset: previewSafe
      ? {
          kind: 'mdx',
          entry: seed.entry,
          basePath: assetUrl(seed.basePath),
          camera: seed.camera,
        }
      : undefined,
    tags: seed.tags ?? ['Premium skin', seed.rarity],
  }
}

function createServiceProduct(product: Omit<ShopProduct, 'type' | 'thumbnailSrc' | 'previewVideoSrc' | 'previewAsset'>): ShopProduct {
  return {
    ...product,
    type: 'service',
    thumbnailSrc: assetUrl(`/inventory-thumbnails/${product.id}.svg?v=${INVENTORY_THUMBNAIL_REVISION}`),
  }
}

export const SHOP_OWNERS: ShopOwner[] = [
  {
    id: 'godzilla8488',
    label: 'Godzilla8488',
    title: 'Unknown',
    vaultName: "Godzilla8488's Vault",
    summary: 'Kaiju-grade skins, heavier silhouettes, and the louder premium cuts.',
    searchPlaceholder: 'Pudge, Faceless Void...',
    modelSrc: assetUrl('/game-scene/godzilla-shopkeeper-idle.glb'),
    accent: '#a875ff',
    animationName: 'Armature|Idle_11|baselayer',
  },
  {
    id: 'pavement',
    label: 'Pavement',
    title: 'WC3Dota',
    vaultName: "Pavement's Den",
    summary: 'WC3Dota services, account review passes, and ranked support packs.',
    searchPlaceholder: 'ELO, unban...',
    modelSrc: assetUrl('/game-scene/pavement-mage-spell-cast.glb'),
    accent: '#f08adf',
    animationName: 'Armature|mage_soell_cast_5|baselayer',
    modelOrientation: '0deg 14deg 0deg',
  },
]

const SEEDED_PRODUCTS: SeedProduct[] = [
  {
    id: 'pudge-plague-titan',
    ownerId: 'godzilla8488',
    name: 'Plague Butcher',
    hero: 'Pudge',
    rarity: 'common',
    faction: 'infernal',
    priceGold: 7,
    accent: '#ffc56b',
    artSeed: 'PD',
    summary: 'A butcher frame with brighter hook readability and a nastier lane silhouette.',
    entry: 'Pudge.preview.mdx',
    basePath: '/models-premium/pudge-arcane',
    previewSafe: true,
    camera: { yaw: -0.62, pitch: 0.14, distanceMultiplier: 5.15, targetZFactor: 0.04 },
    tags: ['Hook hero', 'Lane bully', 'Common'],
  },
  {
    id: 'faceless-void-chrono-king',
    ownerId: 'godzilla8488',
    name: 'Chrono King',
    hero: 'Faceless Void',
    rarity: 'uncommon',
    faction: 'void',
    priceGold: 24,
    accent: '#8e93ff',
    artSeed: 'VK',
    summary: 'A king-grade void shell with a denser crown read and heavier chrono presence.',
    entry: 'FacelessKing.mdx',
    basePath: '/models-premium/faceless-void-king',
    status: 'preview',
    tags: ['Carry', 'Void', 'Uncommon'],
  },
  {
    id: 'axe-grommash-overlord',
    ownerId: 'godzilla8488',
    name: 'Grommash Raider',
    hero: 'Axe',
    rarity: 'uncommon',
    faction: 'infernal',
    priceGold: 16,
    accent: '#ff8f72',
    artSeed: 'AX',
    summary: 'Garrosh-grade armor plates and a louder spin silhouette built for dive initiations.',
    entry: 'GrommashHellscreamChaos.preview.mdx',
    basePath: '/models-premium/axe-grommash',
    previewSafe: true,
    tags: ['Initiator', 'Uncommon'],
  },
  {
    id: 'earthshaker-magma-warden',
    ownerId: 'godzilla8488',
    name: 'Magma Shaman',
    hero: 'Earthshaker',
    rarity: 'rare',
    faction: 'infernal',
    priceGold: 42,
    accent: '#ff9d4d',
    artSeed: 'ES',
    summary: 'A lava-forged shaman body with heavier fissure presence and hotter impact reads.',
    entry: 'tauren.preview.mdx',
    basePath: '/models-premium/earthshaker-magma',
    tags: ['Frontliner', 'Rare'],
  },
  {
    id: 'slark-dreameater',
    ownerId: 'godzilla8488',
    name: 'Dream Prowler',
    hero: 'Slark',
    rarity: 'uncommon',
    faction: 'void',
    priceGold: 18,
    accent: '#7dc6ff',
    artSeed: 'SL',
    summary: 'A cleaner predator silhouette with brighter edge contrast for dark-water fights.',
    entry: 'DreamEater.clean.MDX',
    basePath: '/models-premium/slark-dreameater',
    camera: { yaw: -0.74, pitch: 0.14, targetZFactor: 0.05 },
    tags: ['Agility', 'Uncommon'],
  },
  {
    id: 'morphling-tidal-emperor',
    ownerId: 'godzilla8488',
    name: 'Tidal Form',
    hero: 'Morphling',
    rarity: 'common',
    faction: 'storm',
    priceGold: 6,
    accent: '#75d8ff',
    artSeed: 'MO',
    summary: 'A deeper ocean pass for cleaner waveform contrast and stronger body definition.',
    entry: 'Morph.mdx',
    basePath: '/models-premium/morphling-tidal',
    tags: ['Water', 'Common'],
  },
  {
    id: 'tusk-turtle-breaker',
    ownerId: 'godzilla8488',
    name: 'Shell Brawler',
    hero: 'Tusk',
    rarity: 'common',
    faction: 'relic',
    priceGold: 6,
    accent: '#8fdcbf',
    artSeed: 'TK',
    summary: 'A shell-backed brawler pass that makes every tag-team moment feel heavier.',
    entry: 'TurtleTusk.preview.mdx',
    basePath: '/models-premium/tusk-turtle',
    previewSafe: true,
    tags: ['Brawler', 'Common'],
  },
  {
    id: 'slardar-tidebaron',
    ownerId: 'godzilla8488',
    name: 'Tide Baron',
    hero: 'Slardar',
    rarity: 'uncommon',
    faction: 'storm',
    priceGold: 24,
    accent: '#58c3ff',
    artSeed: 'TB',
    summary: 'A premium tide-shell with a broader crest and cleaner crushing profile.',
    entry: 'Tidebaron.preview.mdx',
    basePath: '/models-premium/slardar-tidebaron',
    previewSafe: true,
    status: 'preview',
    tags: ['Tank', 'Uncommon'],
  },
  {
    id: 'ursa-cursed-blood',
    ownerId: 'godzilla8488',
    name: 'Bloodclaw',
    hero: 'Ursa',
    rarity: 'uncommon',
    faction: 'infernal',
    priceGold: 18,
    accent: '#ff7c7c',
    artSeed: 'UR',
    summary: 'A cursed predator frame with brighter claw readability and cleaner overpower posture.',
    entry: 'Ursa.cleaned.mdx',
    basePath: '/models-premium/ursa-cursed',
    tags: ['Carry', 'Uncommon'],
  },
  {
    id: 'monkey-king-arcane-regent',
    ownerId: 'godzilla8488',
    name: 'Arcane Regent',
    hero: 'Monkey King',
    rarity: 'rare',
    faction: 'arcane',
    priceGold: 58,
    accent: '#c8a2ff',
    artSeed: 'MK',
    summary: 'A brighter monarch-grade Monkey King shell with polished armor and a cleaner combat read.',
    entry: 'HeroMK.preview.mdx',
    basePath: '/models-premium/monkey-king-arcane',
    previewSafe: true,
    status: 'preview',
    tags: ['Carry', 'Arcane', 'Rare'],
  },
  {
    id: 'riki-red-blade',
    ownerId: 'godzilla8488',
    name: 'Red Blade',
    hero: 'Riki',
    rarity: 'common',
    faction: 'infernal',
    priceGold: 5,
    accent: '#ff6a6a',
    artSeed: 'RK',
    summary: 'A fast red assassin pass that keeps backstab moments easy to read from overhead.',
    entry: 'Reddish.preview.mdx',
    basePath: '/models-premium/riki-red',
    previewSafe: true,
    tags: ['Stealth', 'Common'],
  },
  {
    id: 'sniper-golden-huntsman',
    ownerId: 'godzilla8488',
    name: 'Brass Huntsman',
    hero: 'Sniper',
    rarity: 'common',
    faction: 'relic',
    priceGold: 6,
    accent: '#f8d27a',
    artSeed: 'SN',
    summary: 'A brighter rifle silhouette built for stronger top-down shot readability.',
    entry: 'Sniper.preview.mdx',
    basePath: '/models-premium/sniper-golden',
    tags: ['Ranged', 'Common'],
  },
  {
    id: 'invoker-dark-star-ritualist',
    ownerId: 'godzilla8488',
    name: 'Dark Ritualist',
    hero: 'Invoker',
    rarity: 'common',
    faction: 'arcane',
    priceGold: 6,
    accent: '#b9a8ff',
    artSeed: 'IN',
    summary: 'A darker Invoker treatment that preserves spell clarity while deepening the mage silhouette.',
    entry: 'HeroInvokerDark.preview.mdx',
    basePath: '/models-premium/invoker-dark',
    previewSafe: true,
    tags: ['Mage', 'Common'],
  },
  {
    id: 'zeus-storm-king-ascendant',
    ownerId: 'godzilla8488',
    name: 'Storm Priest',
    hero: 'Zeus',
    rarity: 'common',
    faction: 'storm',
    priceGold: 5,
    accent: '#7cffcf',
    artSeed: 'ZE',
    summary: 'A storm-forged Zeus pass tuned for brighter lightning reads and cleaner icon recognition.',
    entry: 'BattlePriest.preview.mdx',
    basePath: '/models-premium/zeus-battlepriest',
    tags: ['Mage', 'Common'],
  },
  {
    id: 'faceless-void-deepwater',
    ownerId: 'godzilla8488',
    name: 'Deepwater Shade',
    hero: 'Faceless Void',
    rarity: 'rare',
    faction: 'void',
    priceGold: 52,
    accent: '#6da6ff',
    artSeed: 'VD',
    summary: 'A colder void frame that keeps the body read sharp without drowning out chrono clarity.',
    entry: 'Void.mdx',
    basePath: '/models-premium/faceless-void-deepwater',
    tags: ['Carry', 'Rare'],
  },
  {
    id: 'juggernaut-wandering-swordsman',
    ownerId: 'godzilla8488',
    name: 'Wandering Swordsman',
    hero: 'Juggernaut',
    rarity: 'common',
    faction: 'relic',
    priceGold: 6,
    accent: '#ffd98d',
    artSeed: 'JG',
    summary: 'A cleaner swordsman silhouette with stronger blade separation for spin-heavy fights.',
    entry: 'WanderingSwordman_var4.preview.mdx',
    basePath: '/models-premium/juggernaut-wandering',
    tags: ['Carry', 'Common'],
  },
  {
    id: 'anti-mage-rift-hunter',
    ownerId: 'godzilla8488',
    name: 'Rift Hunter',
    hero: 'Anti-Mage',
    rarity: 'common',
    faction: 'void',
    priceGold: 7,
    accent: '#a48cff',
    artSeed: 'AM',
    summary: 'A cleaner dual-blade silhouette that reads harder in blink-heavy split fights.',
    entry: 'AMModel.preview.mdx',
    basePath: '/models-premium/anti-mage-shinyblades',
    previewSafe: true,
    camera: { yaw: -0.74, pitch: 0.14, distanceMultiplier: 2.15, targetZFactor: -0.18 },
    tags: ['Agility', 'Common'],
  },
  {
    id: 'legion-commander-terenas',
    ownerId: 'godzilla8488',
    name: 'Terenas Rider',
    hero: 'Legion Commander',
    rarity: 'uncommon',
    faction: 'relic',
    priceGold: 20,
    accent: '#f7c67f',
    artSeed: 'LC',
    summary: 'A mounted commander pass with a heavier duel silhouette and cleaner cavalry profile.',
    entry: 'TerenasOnHorse.preview.mdx',
    basePath: '/models-premium/legion-commander-terenas',
    tags: ['Initiator', 'Uncommon'],
  },
  {
    id: 'windranger-bloodelf',
    ownerId: 'godzilla8488',
    name: 'Bloodelf Marksman',
    hero: 'Windranger',
    rarity: 'uncommon',
    faction: 'arcane',
    priceGold: 14,
    accent: '#ff8eb3',
    artSeed: 'WR',
    summary: 'A bright high-elven archer frame tuned for cleaner powershot posture and bow readability.',
    entry: 'BloodelfWR.mdx',
    basePath: '/models-premium/windranger-bloodelf',
    tags: ['Archer', 'Uncommon'],
  },
  {
    id: 'luna-dark-eclipse',
    ownerId: 'godzilla8488',
    name: 'Moon Huntress',
    hero: 'Luna',
    rarity: 'uncommon',
    faction: 'void',
    priceGold: 14,
    accent: '#a4bbff',
    artSeed: 'LU',
    summary: 'A darker huntress shell with stronger moon-glaive contrast and cleaner mount read.',
    entry: 'Huntress4.preview.mdx',
    basePath: '/models-premium/luna-dark',
    tags: ['Carry', 'Uncommon'],
  },
  {
    id: 'lone-druid-iceborn',
    ownerId: 'godzilla8488',
    name: 'Iceborn Druid',
    hero: 'Lone Druid',
    rarity: 'uncommon',
    faction: 'storm',
    priceGold: 16,
    accent: '#97ddff',
    artSeed: 'LD',
    summary: 'An icebound druid pass that makes both druid and bear silhouettes read more cleanly.',
    entry: 'IceDruid.preview.mdx',
    basePath: '/models-premium/lone-druid-ice',
    previewSafe: true,
    tags: ['Summoner', 'Uncommon'],
  },
  {
    id: 'enigma-singularity-lord',
    ownerId: 'godzilla8488',
    name: 'Singularity Lord',
    hero: 'Enigma',
    rarity: 'rare',
    faction: 'void',
    priceGold: 75,
    accent: '#88a0ff',
    artSeed: 'EN',
    summary: 'A denser void silhouette built for cleaner black-hole identity and premium late-game presence.',
    entry: 'Enigma.preview.mdx',
    basePath: '/models-premium/enigma-d2',
    previewSafe: true,
    camera: { yaw: -0.76, pitch: 0.14, distanceMultiplier: 0.55, targetZFactor: 0.02 },
    status: 'preview',
    tags: ['Void', 'Rare'],
  },
]

const SERVICE_PRODUCTS: ShopProduct[] = [
  createServiceProduct({
    id: 'pavement-elo-boosting-pack',
    ownerId: 'pavement',
    name: 'ELO Boosting Pack',
    hero: 'Ranked Service',
    rarity: 'epic',
    status: 'live',
    faction: 'arcane',
    priceGold: 5,
    stockTotal: 5,
    accent: '#f08adf',
    artSeed: 'ELO',
    summary: 'A scheduled ranked support pack for players who want faster ladder progress and WC3Dota guidance.',
    details: 'Creates a service ticket with Pavement for ranked path review, session scheduling, and match support coordination.',
    entitlementKey: 'service.pavement.elo.boosting.pack',
    compatibility: SERVICE_COMPATIBILITY,
    deliveryWindow: 'Manual scheduling after checkout. Pavement confirms the queue window before the run starts.',
    stripePriceEnvKey: 'STRIPE_PRICE_ELO_BOOSTING_PACK',
    tags: ['Service', 'ELO', 'Epic'],
  }),
  createServiceProduct({
    id: 'pavement-unban-pass',
    ownerId: 'pavement',
    name: 'Unban Pass',
    hero: 'Account Review',
    rarity: 'rare',
    status: 'live',
    faction: 'relic',
    priceGold: 50,
    stockTotal: 12,
    accent: '#ffd98d',
    artSeed: 'UB',
    summary: 'A one-time manual review pass for WC3Dota host restrictions, ban notes, and reinstatement requests.',
    details: 'Creates a review ticket for the supplied BattleTag. Approval still depends on the moderation record.',
    entitlementKey: 'service.pavement.unban.pass',
    compatibility: SERVICE_COMPATIBILITY,
    deliveryWindow: 'Manual review after checkout. Most requests are checked before the next host maintenance window.',
    stripePriceEnvKey: 'STRIPE_PRICE_UNBAN_PASS',
    tags: ['Service', 'Unban', 'Rare'],
  }),
]

export const SHOP_PRODUCTS: ShopProduct[] = [
  ...SEEDED_PRODUCTS.map(createSkinProduct),
  ...SERVICE_PRODUCTS,
]

export const ROADMAP: RoadmapItem[] = [
  {
    title: 'Skin checkout + entitlement sync',
    phase: 'Phase 1',
    note: 'Collect BattleTag, take payment, then grant the right hero skin on map start.',
  },
  {
    title: 'Bundles and account-wide shop items',
    phase: 'Phase 2',
    note: 'Founder packs, supporter badges, announcer-style unlocks, and other non-hero inventory.',
  },
  {
    title: 'Bot-hosting partner tools',
    phase: 'Phase 3',
    note: 'Admin-side entitlement search, manual resend, and failed-sync review for hosts and partners.',
  },
]

export const SAMPLE_ADMIN_ORDERS: AdminOrder[] = [
  {
    id: 'WC3-1042',
    battleTag: 'Godzilla8488#1763',
    email: 'quan@example.com',
    region: 'Americas',
    source: 'partner',
    status: 'synced',
    createdAt: '2026-04-18T19:35:00Z',
    items: ['Plague Titan'],
    amountGold: 7,
    note: 'Test entitlement already confirmed in host flow.',
  },
  {
    id: 'WC3-1043',
    battleTag: 'LaneKing#2881',
    email: 'laneking@example.com',
    region: 'Europe',
    source: 'stripe',
    status: 'paid-awaiting-sync',
    createdAt: '2026-04-19T12:10:00Z',
    items: ['ELO Boosting Pack'],
    amountGold: 5,
    note: 'Paid, waiting for Pavement scheduling confirmation.',
  },
  {
    id: 'WC3-1044',
    battleTag: 'HookTheory#5234',
    email: 'hook@example.com',
    region: 'Americas',
    source: 'demo',
    status: 'manual-review',
    createdAt: '2026-04-19T14:04:00Z',
    items: ['Chrono King'],
    amountGold: 75,
    note: 'Preview order kept for testing before live Stripe setup.',
  },
]

export const DEMO_ADMIN = {
  username: 'demoadmin',
  password: 'demo-only',
}

export const REGIONS = ['Americas', 'Europe', 'Asia'] as const

export const SHOP_NOTES = [
  'BattleTag is required because entitlement is granted against the in-game account, not just the email receipt.',
  'Skin purchases unlock the mapped hero skin entry in the WC3 DotA map. Service purchases create a manual review ticket.',
  'The host bot is responsible for pushing skin entitlements into the match at game start.',
]
