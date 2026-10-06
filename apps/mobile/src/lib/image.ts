import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { readAsStringAsync } from "expo-file-system/legacy";

/** Longest side sent for analysis: plenty for food/report recognition, well under Claude's 5 MB limit. */
const MAX_SIDE = 1600;

/** Downscales (if needed) and re-encodes an image as JPEG base64. */
export async function toUploadableJpeg(uri: string): Promise<{ base64: string; mimeType: "image/jpeg" }> {
  let image = await ImageManipulator.manipulate(uri).renderAsync();
  if (Math.max(image.width, image.height) > MAX_SIDE) {
    const size = image.width >= image.height ? { width: MAX_SIDE } : { height: MAX_SIDE };
    image = await ImageManipulator.manipulate(image).resize(size).renderAsync();
  }
  const result = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });
  return { base64: result.base64!, mimeType: "image/jpeg" };
}

/**
 * Reads a picked document (e.g. a PDF from the system picker) as base64.
 * Expo Go sandboxes its file-system module away from the picker's cache, so fall
 * back to reading through React Native's networking layer, which isn't scoped.
 */
export async function readAsBase64(uri: string): Promise<string> {
  try {
    return await readAsStringAsync(uri, { encoding: "base64" });
  } catch {
    const blob = await (await fetch(uri)).blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
    return dataUrl.slice(dataUrl.indexOf(",") + 1);
  }
}
