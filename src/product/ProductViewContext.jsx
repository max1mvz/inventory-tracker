import { createContext, useCallback, useContext, useState } from 'react'
import ProductDetail from '../stock/ProductDetail.jsx'
import CreateProduct from '../scan/CreateProduct.jsx'
import { createProduct } from '../data/inventory'
import { useIsDesktop } from '../layout/useMediaQuery'
import Icon from '../ui/Icon.jsx'
import './ProductDrawer.css'

const ProductViewContext = createContext({
  openProduct: () => {},
  openCreate: () => {},
})

/**
 * Opens a product (or the create-product form) in a right-side drawer on desktop
 * / full-screen on mobile. Used by Stock, the dashboard lists, and the desktop
 * "+ Add product" button. The scan flow has its own inline card.
 */
export function ProductViewProvider({ children }) {
  const isDesktop = useIsDesktop()
  const [entry, setEntry] = useState(null) // null | {type:'product',barcode} | {type:'create'}
  const [busy, setBusy] = useState(false)
  const [createErr, setCreateErr] = useState(null)
  // Locked while a form inside the drawer has focus/edits, so a stray click on
  // the backdrop can't close it and throw away unsaved changes.
  const [locked, setLocked] = useState(false)

  const openProduct = useCallback((code) => {
    setLocked(false)
    setEntry({ type: 'product', barcode: code })
  }, [])
  const openCreate = useCallback(() => {
    setCreateErr(null)
    setLocked(false)
    setEntry({ type: 'create' })
  }, [])
  const close = useCallback(() => {
    setLocked(false)
    setEntry(null)
  }, [])

  const handleCreate = useCallback(async (fields) => {
    setBusy(true)
    setCreateErr(null)
    try {
      await createProduct(fields)
      // Switch the drawer to the new product so its stock can be set right away.
      setEntry({ type: 'product', barcode: fields.barcode })
    } catch (e) {
      setCreateErr(e.message || 'Could not create the product.')
    } finally {
      setBusy(false)
    }
  }, [])

  return (
    <ProductViewContext.Provider value={{ openProduct, openCreate }}>
      {children}
      {entry && (
        <div
          className={`drawer-overlay ${isDesktop ? 'desktop' : 'mobile'}`}
          onClick={() => {
            // Don't let a backdrop click discard an in-progress form. The create
            // form always counts; the product view only while it's being edited.
            if (!locked && entry.type !== 'create') close()
          }}
        >
          <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-head">
              <button className="btn ghost small" onClick={close}>
                <Icon name={isDesktop ? 'close' : 'back'} size={16} />
                {isDesktop ? 'Close' : 'Back'}
              </button>
            </div>
            <div className="drawer-body">
              {entry.type === 'product' ? (
                <ProductDetail barcode={entry.barcode} onBack={close} onLockChange={setLocked} />
              ) : (
                <CreateProduct
                  manual
                  onCreate={handleCreate}
                  onScanNext={close}
                  busy={busy}
                  error={createErr}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </ProductViewContext.Provider>
  )
}

export function useProductView() {
  return useContext(ProductViewContext)
}
