/**
 * QR-decoder for MRW shipping receipts.
 *
 * MRW Venezuela's shipping label includes a QR code that encodes the tracking
 * number (e.g. `080002004000778`). Decoding it from the operator's photo is
 * far more reliable than OCR'ing the printed text — QR error correction
 * tolerates partial occlusion, glare, and moderate blur.
 *
 * Implementation: jimp loads the JPEG/PNG into an RGBA pixel buffer (pure JS,
 * no native deps), jsqr scans the buffer. If the first pass fails, we try a
 * couple of fallbacks (resize down, rotate 90°) since photos taken at angles
 * sometimes need a finder-pattern alignment retry.
 */

import jsQR from "jsqr"
import Jimp from "jimp"

export type DecodeResult = {
  text: string
  trackingNumber: string | null
}

const TRACKING_RE = /(\d{12,16})/

/**
 * Pull a tracking number out of whatever the QR encoded. MRW's QR sometimes
 * carries just the bare digits, sometimes a URL like
 * `https://mrw.com.ve/track/080002004000778`. Either way, the number is the
 * longest run of digits ≥ 12.
 */
function extractTrackingNumber(qrText: string): string | null {
  const m = qrText.match(TRACKING_RE)
  return m ? m[1] : null
}

async function attempt(buf: Buffer, transform?: (img: Jimp) => Promise<Jimp> | Jimp): Promise<DecodeResult | null> {
  try {
    let img = await Jimp.read(buf)
    if (transform) img = await transform(img)
    const { data, width, height } = img.bitmap
    const code = jsQR(new Uint8ClampedArray(data), width, height)
    if (!code || !code.data) return null
    const text = code.data
    return { text, trackingNumber: extractTrackingNumber(text) }
  } catch (err) {
    console.warn("[qr-decoder] attempt failed:", (err as Error).message)
    return null
  }
}

/**
 * Try to decode a QR from an image buffer. Returns the raw QR payload AND
 * the extracted tracking number (best-effort). If no QR is found at all,
 * returns null.
 *
 * Tries up to 4 strategies: original, downscaled (cheaper for big phone
 * shots), rotated 90°, rotated 180°. We stop at the first hit.
 */
export async function decodeQrFromImage(buf: Buffer): Promise<DecodeResult | null> {
  if (!buf || buf.length < 100) return null

  // 1. Original size
  let r = await attempt(buf)
  if (r) return r

  // 2. Downscaled to max 1500px width — phone photos are often 4000px which
  //    is overkill and slows jsqr's finder pass.
  r = await attempt(buf, async (img) => {
    if (img.bitmap.width > 1500) img.resize(1500, Jimp.AUTO)
    return img
  })
  if (r) return r

  // 3. Rotated 90° (sometimes phones save EXIF that we lose)
  r = await attempt(buf, async (img) => {
    if (img.bitmap.width > 1500) img.resize(1500, Jimp.AUTO)
    img.rotate(90)
    return img
  })
  if (r) return r

  // 4. Rotated 180°
  r = await attempt(buf, async (img) => {
    if (img.bitmap.width > 1500) img.resize(1500, Jimp.AUTO)
    img.rotate(180)
    return img
  })
  if (r) return r

  return null
}
