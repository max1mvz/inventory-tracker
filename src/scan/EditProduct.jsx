import { useState } from 'react'
import { PRODUCT_CATEGORIES } from '../data/inventory'
import ImageField from './ImageField.jsx'
import './CreateProduct.css'

/**
 * Edit an existing product's catalog metadata, incl. the barcode (only editable
 * while the product has no stock history — the movements FK guards it). Also
 * offers a guarded Delete. Never touches quantity.
 */
export default function EditProduct({
  product,
  onSave,
  onDelete,
  onForceDelete,
  canForceDelete,
  onCancel,
  busy,
  error,
}) {
  const [barcode, setBarcode] = useState(product.barcode || '')
  const [name, setName] = useState(product.name || '')
  const [sku, setSku] = useState(product.sku || '')
  const [category, setCategory] = useState(product.category || '')
  const [unit, setUnit] = useState(product.unit || 'pcs')
  const [reorderPoint, setReorderPoint] = useState(String(product.reorder_point ?? 0))
  const [cost, setCost] = useState(product.cost != null ? String(product.cost) : '')
  const [price, setPrice] = useState(product.price != null ? String(product.price) : '')
  const [imageUrl, setImageUrl] = useState(product.image_url || null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const valid = name.trim().length > 0 && barcode.trim().length > 0

  function submit(e) {
    e.preventDefault()
    if (!valid) return
    onSave({
      barcode: barcode.trim(),
      name,
      sku,
      category,
      unit,
      reorderPoint: parseInt(reorderPoint, 10) || 0,
      cost: parseFloat(cost) || 0,
      price: parseFloat(price) || 0,
      imageUrl,
    })
  }

  return (
    <form className="create" onSubmit={submit}>
      <div className="create-head">
        <span className="create-tag">Edit product</span>
        <h2>{product.name}</h2>
      </div>

      <ImageField
        barcode={product.barcode}
        value={imageUrl}
        onChange={setImageUrl}
        disabled={busy}
      />

      <label className="field">
        <span>Barcode *</span>
        <input
          type="text"
          inputMode="numeric"
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
          required
        />
        <small className="field-hint">
          Stock history follows the product if you change this.
        </small>
      </label>

      <label className="field">
        <span>Name *</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Product name"
          required
        />
      </label>

      <label className="field">
        <span>Category</span>
        <input
          type="text"
          list="product-categories-edit"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="e.g. Tools"
        />
        <datalist id="product-categories-edit">
          {PRODUCT_CATEGORIES.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </label>

      <div className="create-row">
        <label className="field">
          <span>SKU</span>
          <input type="text" value={sku} onChange={(e) => setSku(e.target.value)} placeholder="—" />
        </label>
        <label className="field">
          <span>Unit</span>
          <input type="text" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="pcs" />
        </label>
      </div>

      <div className="create-row">
        <label className="field">
          <span>Unit cost (₱)</span>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            placeholder="0"
          />
        </label>
        <label className="field">
          <span>Retail price (₱)</span>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="0"
          />
        </label>
      </div>

      <label className="field">
        <span>Reorder point</span>
        <input
          type="number"
          inputMode="numeric"
          min="0"
          value={reorderPoint}
          onChange={(e) => setReorderPoint(e.target.value)}
        />
        <small className="field-hint">Flag as low stock at or below this quantity.</small>
      </label>

      {error && <p className="create-error">{error}</p>}

      <div className="create-actions">
        <button className="btn ghost" type="button" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button className="btn primary grow" type="submit" disabled={busy || !valid}>
          {busy ? 'Saving…' : 'Save changes'}
        </button>
      </div>

      {onDelete && (
        <div className="delete-zone">
          {!confirmDelete ? (
            <button
              type="button"
              className="btn danger"
              onClick={() => setConfirmDelete(true)}
              disabled={busy}
            >
              Delete product
            </button>
          ) : canForceDelete ? (
            <div className="delete-confirm">
              <span>
                Deleting also erases this product’s entire stock history. This
                can’t be undone.
              </span>
              <div className="delete-confirm-actions">
                <button
                  type="button"
                  className="btn ghost small"
                  onClick={() => setConfirmDelete(false)}
                  disabled={busy}
                >
                  Keep
                </button>
                <button
                  type="button"
                  className="btn danger small"
                  onClick={() => onForceDelete()}
                  disabled={busy}
                >
                  {busy ? 'Deleting…' : 'Delete it & its history'}
                </button>
              </div>
            </div>
          ) : (
            <div className="delete-confirm">
              <span>Delete this product? This can’t be undone.</span>
              <div className="delete-confirm-actions">
                <button
                  type="button"
                  className="btn ghost small"
                  onClick={() => setConfirmDelete(false)}
                  disabled={busy}
                >
                  Keep
                </button>
                <button
                  type="button"
                  className="btn danger small"
                  onClick={() => onDelete()}
                  disabled={busy}
                >
                  {busy ? 'Deleting…' : 'Yes, delete'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </form>
  )
}
