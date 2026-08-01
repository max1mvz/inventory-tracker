import { supabase } from '../supabaseClient'

// Product photos are downscaled and re-encoded ON THE DEVICE before upload, so a
// 4MB phone snap becomes ~40-80KB. That keeps uploads fast on mobile data, keeps
// storage cheap, and makes list thumbnails instant. Uses the built-in Canvas API
// — no image library, so the JS bundle doesn't grow at all.

const BUCKET = 'product-images'
const MAX_DIM = 900 // longest edge, plenty for a detail view
const QUALITY = 0.82

const blobFrom = (canvas, type, quality) =>
  new Promise((resolve) => canvas.toBlob(resolve, type, quality))

/**
 * Downscale + compress an image File. Prefers WebP, falling back to JPEG on
 * browsers whose canvas can't encode it (older iOS Safari).
 * Returns { blob, ext, type }.
 */
export async function compressImage(file, { maxDim = MAX_DIM, quality = QUALITY } = {}) {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)

  const ctx = canvas.getContext('2d')
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close?.()

  let blob = await blobFrom(canvas, 'image/webp', quality)
  if (!blob || blob.type !== 'image/webp') {
    blob = await blobFrom(canvas, 'image/jpeg', quality)
    return { blob, ext: 'jpg', type: 'image/jpeg' }
  }
  return { blob, ext: 'webp', type: 'image/webp' }
}

/**
 * Compress and upload a product photo; returns its public URL. The filename is
 * timestamped so a replacement never collides with a cached copy of the old one.
 */
export async function uploadProductImage(barcode, file) {
  const { blob, ext, type } = await compressImage(file)
  const safe = String(barcode).replace(/[^a-zA-Z0-9._-]/g, '')
  const path = `${safe}/${Date.now()}.${ext}`

  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: type,
    cacheControl: '31536000', // immutable filename → cache for a year
    upsert: false,
  })
  if (error) {
    if (/bucket not found/i.test(error.message || '')) {
      throw new Error('Photo storage isn’t set up yet. Run migration 0007 in Supabase.')
    }
    throw error
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}
