import { useRef, useState } from 'react'
import { uploadProductImage } from './productImage'

/**
 * Product photo picker. Compresses and uploads on selection, then reports the
 * public URL up via onChange(url). On mobile the file input offers the camera
 * directly, so a photo can be taken right at the shelf.
 */
export default function ImageField({ barcode, value, onChange, disabled }) {
  const inputRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)

  async function pick(e) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-picking the same file
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      onChange(await uploadProductImage(barcode || 'unassigned', file))
    } catch (err) {
      setError(err.message || 'Could not upload that photo.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="field">
      <span>Photo</span>
      <div className="image-field">
        <div className="image-preview" aria-hidden={!value}>
          {value ? (
            <img src={value} alt="" loading="lazy" />
          ) : (
            <span className="image-placeholder">No photo</span>
          )}
        </div>

        <div className="image-actions">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            onChange={pick}
            hidden
          />
          <button
            type="button"
            className="btn small"
            onClick={() => inputRef.current?.click()}
            disabled={disabled || uploading}
          >
            {uploading ? 'Uploading…' : value ? 'Replace photo' : 'Add photo'}
          </button>
          {value && !uploading && (
            <button
              type="button"
              className="btn ghost small"
              onClick={() => onChange(null)}
              disabled={disabled}
            >
              Remove
            </button>
          )}
        </div>
      </div>
      {error ? (
        <small className="create-error">{error}</small>
      ) : (
        <small className="field-hint">Resized on your device before upload to stay fast.</small>
      )}
    </div>
  )
}
