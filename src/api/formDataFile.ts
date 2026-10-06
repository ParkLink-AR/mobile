import { Platform } from 'react-native';
import { File } from 'expo-file-system';

/** A local file picked on the device (image picker, document picker...). */
export interface LocalFileAsset {
  uri: string;
  name: string;
  type: string;
}

/**
 * Appends a local file to a multipart FormData, on every platform:
 *
 * - Web: the browser's FormData needs a real Blob -- an object would be stringified into
 *   the literal text "[object Object]".
 * - Native: since SDK 57, Expo replaces the global `fetch` with its own (expo/fetch),
 *   which does NOT understand React Native's `{ uri, name, type }` file shape -- it throws
 *   "Unsupported FormDataPart implementation" before any request is sent. It does accept
 *   any part exposing `bytes()`, taking the filename and content type from its `name` and
 *   `type`, so the file is read through expo-file-system's File. `uri` stays on the part
 *   too, which React Native's own fetch (EXPO_PUBLIC_USE_RN_FETCH) would use instead.
 */
export async function appendLocalFile(formData: FormData, field: string, asset: LocalFileAsset): Promise<void> {
  if (Platform.OS === 'web') {
    const blob = await (await fetch(asset.uri)).blob();
    formData.append(field, blob, asset.name);
    return;
  }
  formData.append(field, {
    uri: asset.uri,
    name: asset.name,
    type: asset.type,
    bytes: () => new File(asset.uri).bytes(),
  } as unknown as Blob);
}
