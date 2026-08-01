import { useEffect, useRef, useState } from 'react'
import { PRODUCT_CATEGORIES, lookupProduct } from '../data/inventory'
import { randomEan13 } from '../barcode/ean13'
import ImageField from './ImageField.jsx'
import './CreateProduct.css'

/**
 * Generate a valid EAN-13 under the 200 (in-store / restricted-circulation)
 * prefix that isn't already used by an existing product. Random codes have a
 * huge address space so a collision is unlikely, but we still check a few times;
 * if the lookup can't run (e.g. offline) we accept the code — createProduct is
 * the final backstop on a duplicate.
 */
async function generateUniqueBarcode(tries = 6) {
  for (let i = 0; i < tries; i++) {
    const code = randomEan13('200')
    try {
      if (!(await lookupProduct(code))) return code
    } catch {
      return code
    }
  }
  return randomEan13('200')
}

/**
 * Create-product form. Two modes:
 *  - scan flow: `barcode` is prefilled and read-only, name field autofocused.
 *  - manual (desktop "+ Add product"): `manual` makes the barcode an editable,
 *    autofocused field, prefilled with an auto-generated internal code so a
 *    product can be added without scanning (replaceable with a real barcode).
 */
export default function CreateProduct({
  barcode: fixedBarcode = '',
  manual,
  onCreate,
  onScanNext,
  busy,
  error,
}) {
  const [barcode, setBarcode] = useState(() => (manual ? randomEan13('200') : fixedBarcode))
  const [genBusy, setGenBusy] = useState(false)
  // Whether the user has hand-edited the barcode — guards the on-mount unique
  // generation from clobbering something they've started typing.
  const editedRef = useRef(false)
  const [name, setName] = useState('')
  const [sku, setSku] = useState('')
  const [category, setCategory] = useState('')
  const [unit, setUnit] = useState('pcs')
  const [reorderPoint, setReorderPoint] = useState('0')
  const [cost, setCost] = useState('')
  const [price, setPrice] = useState('')
  const [imageUrl, setImageUrl] = useState(null)

  const valid = name.trim().length > 0 && barcode.trim().length > 0

  // On mount in manual mode, upgrade the instant prefill to a uniqueness-checked
  // code — unless the user has already started editing the field.
  useEffect(() => {
    if (!manual) return
    let alive = true
    setGenBusy(true)
    generateUniqueBarcode()
      .then((code) => {
        if (alive && !editedRef.current) setBarcode(code)
      })
      .finally(() => {
        if (alive) setGenBusy(false)
      })
    return () => {
      alive = false
    }
  }, [manual])

  async function regenerate() {
    setGenBusy(true)
    const code = await generateUniqueBarcode()
    editedRef.current = false
    setBarcode(code)
    setGenBusy(false)
  }

  function submit(e) {
    e.preventDefault()
    if (!valid) return
    onCreate({
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
        <span className="create-tag">{manual ? 'Add product' : 'New product'}</span>
        <h2>{manual ? 'New product' : 'Not in the catalog yet'}</h2>
        {!manual && <code className="create-barcode">{barcode}</code>}
      </div>

      {manual && (
        <label className="field">
          <span>Barcode *</span>
          <div className="barcode-row">
            <input
              type="text"
              inputMode="numeric"
              value={barcode}
              onChange={(e) => {
                editedRef.current = true
                setBarcode(e.target.value)
              }}
              placeholder="Scan or type the barcode number"
              autoFocus
              required
            />
            <button
              className="btn ghost small"
              type="button"
              onClick={regenerate}
              disabled={busy || genBusy}
              title="Generate a new internal barcode"
            >
              {genBusy ? '…' : 'Generate'}
            </button>
          </div>
          <small className="field-hint">
            Auto-filled with an internal code (200 prefix). Replace it with the
            product's real barcode if it already has one.
          </small>
        </label>
      )}

      <label className="field">
        <span>Name *</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Product name"
          autoFocus={!manual}
          required
        />
      </label>

      <ImageField
        barcode={barcode}
        value={imageUrl}
        onChange={setImageUrl}
        disabled={busy}
      />

      <label className="field">
        <span>Category (optional)</span>
        <input
          type="text"
          list="product-categories"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="e.g. Tools"
        />
        <datalist id="product-categories">
          {PRODUCT_CATEGORIES.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </label>

      <div className="create-row">
        <label className="field">
          <span>SKU (optional)</span>
          <input
            type="text"
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            placeholder="—"
          />
        </label>
        <label className="field unit">
          <span>Unit</span>
          <input
            type="text"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="pcs"
          />
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
        <button className="btn ghost" type="button" onClick={onScanNext} disabled={busy}>
          Cancel
        </button>
        <button className="btn primary grow" type="submit" disabled={busy || !valid}>
          {busy ? 'Creating…' : 'Create product'}
        </button>
      </div>
    </form>
  )
}
