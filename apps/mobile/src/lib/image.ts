import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import type { ImagePickerAsset } from "expo-image-picker";

/** Longest side sent for analysis: plenty for food/report recognition, well under Claude's 5 MB limit. */
const MAX_SIDE = 1600;

/** Downscales and re-encodes a picked photo as JPEG base64. */
export async function toUploadableJpeg(asset: ImagePickerAsset): Promise<{ base64: string; mimeType: "image/jpeg" }> {
  const context = ImageManipulator.manipulate(asset.uri);
  if (Math.max(asset.width, asset.height) > MAX_SIDE) {
    context.resize(asset.width >= asset.height ? { width: MAX_SIDE } : { height: MAX_SIDE });
  }
  const image = await context.renderAsync();
  const result = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });
  return { base64: result.base64!, mimeType: "image/jpeg" };
}
