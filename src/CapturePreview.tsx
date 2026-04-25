import { useEffect, useMemo, useState } from 'react'
import { MdxPreview } from './MdxPreview'
import { SHOP_PRODUCTS } from './shopData'

interface CapturePreviewProps {
  productId: string
}

export function CapturePreview({ productId }: CapturePreviewProps) {
  const product = useMemo(
    () => SHOP_PRODUCTS.find((entry) => entry.id === productId && entry.previewAsset) ?? null,
    [productId],
  )
  const [readyProductId, setReadyProductId] = useState('')
  const captureState = product ? (readyProductId === product.id ? 'ready' : 'loading') : 'error'

  useEffect(() => {
    document.documentElement.dataset.captureState = captureState

    return () => {
      delete document.documentElement.dataset.captureState
    }
  }, [captureState])

  if (!product?.previewAsset) {
    return <main className="capture-preview-shell" data-capture-state="error" />
  }

  return (
    <main
      className="capture-preview-shell"
      data-capture-product={product.id}
      data-capture-state={captureState}
      style={{ ['--product-accent' as string]: product.accent }}
    >
      <MdxPreview
        asset={product.previewAsset}
        className="capture-preview-mdx"
        initialAnimationSpeed={1}
        onReady={() => setReadyProductId(product.id)}
        showControls={false}
        showStatus={false}
      />
    </main>
  )
}
