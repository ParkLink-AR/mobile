import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import type { ImagePickerAsset } from 'expo-image-picker';

/** What an upload sends for one picked image (multipart file). */
export interface UploadableImage {
  uri: string;
  name: string;
  type: string;
}

// The longest side a photo is shrunk to before it's uploaded, by what it's for.
export const SPOT_PHOTO_UPLOAD_MAX = 1600;
export const DOCUMENT_PHOTO_UPLOAD_MAX = 2000;
export const AVATAR_UPLOAD_MAX = 800;
const JPEG_QUALITY = 0.8;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Shrinks a picked photo on the phone before it's uploaded -- a camera shot is several MB
 * and thousands of pixels wide, slow to send over mobile data, while the server re-encodes
 * it smaller anyway (parking-service's compressImage, auth-service's avatar). Resized so its
 * longest side is at most `maxDimension` (never enlarged) and saved as JPEG -- which also
 * turns an iPhone's HEIC photo into something the server accepts. If the phone can't process
 * it, the original goes as-is when it's a format the server takes, or null when it isn't.
 */
export async function shrinkForUpload(
  asset: ImagePickerAsset,
  maxDimension: number,
  name: string,
): Promise<UploadableImage | null> {
  try {
    const context = ImageManipulator.manipulate(asset.uri);
    const longest = Math.max(asset.width ?? 0, asset.height ?? 0);
    if (longest > maxDimension) {
      context.resize(asset.width >= asset.height ? { width: maxDimension } : { height: maxDimension });
    }
    const rendered = await context.renderAsync();
    const saved = await rendered.saveAsync({ compress: JPEG_QUALITY, format: SaveFormat.JPEG });
    return { uri: saved.uri, name: `${name}.jpg`, type: 'image/jpeg' };
  } catch (err) {
    console.warn('[imageUpload] could not shrink the photo, sending the original:', err);
    const type = asset.mimeType ?? 'image/jpeg';
    if (!ALLOWED_TYPES.includes(type)) return null;
    return { uri: asset.uri, name: asset.fileName ?? `${name}.${type.split('/')[1]}`, type };
  }
}
