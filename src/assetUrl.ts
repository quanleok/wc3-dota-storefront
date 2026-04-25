const env = (import.meta as unknown as { env?: { VITE_ASSET_BASE_URL?: string } }).env
const rawAssetBaseUrl = env?.VITE_ASSET_BASE_URL?.trim() ?? ''
const assetBaseUrl = rawAssetBaseUrl.replace(/\/+$/, '')

export function assetUrl(path: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`

  if (!assetBaseUrl) {
    return normalizedPath
  }

  return `${assetBaseUrl}${normalizedPath}`
}
