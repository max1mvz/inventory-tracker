import { useCallback, useEffect, useState } from 'react'
import ProductCard from '../scan/ProductCard.jsx'
import EditProduct from '../scan/EditProduct.jsx'
import {
  lookupProduct,
  recordMovement,
  updateProduct,
  deleteProduct,
  forceDeleteProduct,
} from '../data/inventory'
import { useRealtimeMovements } from '../data/useRealtimeMovements'

/**
 * Opens a single product from the stock list and wires the same quick-action
 * flow used after a scan: record a movement, then re-read current_stock so the
 * displayed quantity is always the computed truth.
 */
export default function ProductDetail({ barcode, onBack, onLockChange }) {
  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [flash, setFlash] = useState(null)
  const [editing, setEditing] = useState(false)
  const [canForceDelete, setCanForceDelete] = useState(false)

  // Lock the drawer against accidental backdrop-click close while editing.
  useEffect(() => {
    onLockChange?.(editing)
    return () => onLockChange?.(false)
  }, [editing, onLockChange])

  useEffect(() => {
    let active = true
    lookupProduct(barcode)
      .then((row) => active && setProduct(row))
      .catch((e) => active && setError(e.message || 'Could not load product.'))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [barcode])

  // If a teammate records a movement for this same product, refresh its stock.
  useRealtimeMovements((payload) => {
    if (payload?.new?.barcode === barcode) {
      lookupProduct(barcode)
        .then((row) => setProduct(row))
        .catch(() => {})
    }
  })

  const onMovement = useCallback(
    async (delta, reason, note) => {
      setBusy(true)
      setError(null)
      try {
        const res = await recordMovement({ barcode, delta, reason, note, product })
        if (res.queued) {
          setProduct((p) =>
            p
              ? {
                  ...p,
                  qty: (p.qty || 0) + delta,
                  needs_reorder: (p.qty || 0) + delta <= p.reorder_point,
                }
              : p,
          )
          setFlash(`Saved offline (${delta > 0 ? '+' : ''}${delta}) — will sync`)
        } else {
          setProduct(await lookupProduct(barcode))
          setFlash(`Recorded ${delta > 0 ? '+' : ''}${delta} · ${reason.replace('_', ' ')}`)
        }
        if (navigator.vibrate) navigator.vibrate(30)
      } catch (e) {
        setError(e.message || 'Could not save that movement.')
      } finally {
        setBusy(false)
      }
    },
    [barcode, product],
  )

  const onSaveEdit = useCallback(
    async (fields) => {
      setBusy(true)
      setError(null)
      try {
        const { barcode: effective } = await updateProduct(barcode, fields)
        if (effective !== barcode) {
          // Barcode (the primary key) changed — this detail view is keyed to the
          // old one, so close back to the list, which refreshes to show the new.
          onBack()
          return
        }
        setProduct(await lookupProduct(barcode))
        setEditing(false)
        setFlash('Product details updated')
      } catch (e) {
        setError(e.message || 'Could not save the changes.')
      } finally {
        setBusy(false)
      }
    },
    [barcode, onBack],
  )

  const onDeleteProduct = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      await deleteProduct(barcode)
      onBack() // list refreshes via the products-changed signal
    } catch (e) {
      if (e.code === 'HAS_HISTORY') {
        setCanForceDelete(true) // offer the admin-only force delete
        setError(e.message)
      } else {
        setError(e.message || 'Could not delete the product.')
      }
    } finally {
      setBusy(false)
    }
  }, [barcode, onBack])

  const onForceDeleteProduct = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      await forceDeleteProduct(barcode)
      onBack()
    } catch (e) {
      setError(e.message || 'Could not delete the product.')
    } finally {
      setBusy(false)
    }
  }, [barcode, onBack])

  if (loading) {
    return (
      <div className="looking">
        <span className="spinner" /> Loading…
      </div>
    )
  }

  if (!product) {
    return (
      <div className="scan-error-card">
        <p className="create-error">{error || 'Product not found.'}</p>
        <button className="btn" onClick={onBack}>
          Back to list
        </button>
      </div>
    )
  }

  if (editing) {
    return (
      <EditProduct
        product={product}
        onSave={onSaveEdit}
        onDelete={onDeleteProduct}
        onForceDelete={onForceDeleteProduct}
        canForceDelete={canForceDelete}
        onCancel={() => {
          setError(null)
          setEditing(false)
        }}
        busy={busy}
        error={error}
      />
    )
  }

  return (
    <>
      {error && <p className="create-error">{error}</p>}
      <ProductCard
        product={product}
        onMovement={onMovement}
        onScanNext={onBack}
        onEdit={() => setEditing(true)}
        busy={busy}
        flash={flash}
        doneLabel="Back to list"
      />
    </>
  )
}
