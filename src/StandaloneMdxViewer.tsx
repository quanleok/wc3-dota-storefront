import { MdxPreview } from './MdxPreview'
import type { ShopProduct } from './shopData'

interface StandaloneMdxViewerProps {
  product: ShopProduct
  onBack: () => void
}

function formatGold(value: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value)
}

export function StandaloneMdxViewer({ product, onBack }: StandaloneMdxViewerProps) {
  if (!product.previewAsset) {
    return null
  }

  return (
    <div className="standalone-viewer-shell">
      <header className="standalone-viewer-header window-frame">
        <div className="standalone-viewer-copy">
          <p className="eyebrow">In-game model viewer</p>
          <h1>{product.name}</h1>
          <p className="standalone-viewer-hero">{product.hero}</p>
        </div>

        <div className="standalone-viewer-meta">
          <span className={`preview-overlay-rarity preview-overlay-rarity-${product.rarity}`}>
            {product.rarity}
          </span>
          <span className={`preview-overlay-status preview-overlay-status-${product.status}`}>
            {product.status}
          </span>
          <span className="gold-amount standalone-viewer-price" aria-label={`${formatGold(product.priceGold)} gold`}>
            <span className="gold-icon" aria-hidden="true" />
            <span className="gold-value">{formatGold(product.priceGold)}</span>
          </span>
          <button className="scene-secondary-button" onClick={onBack} type="button">
            Back to shop
          </button>
        </div>
      </header>

      <main className="standalone-viewer-stage window-frame">
        <MdxPreview asset={product.previewAsset} />
      </main>

      <footer className="standalone-viewer-footer window-frame">
        <p>{product.summary}</p>
        <p>Live MDX asset routed through the Warcraft III texture manifest.</p>
      </footer>
    </div>
  )
}
