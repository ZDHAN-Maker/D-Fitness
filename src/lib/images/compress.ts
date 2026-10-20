import { PHOTO_MAX_EDGE, fitWithin } from "@/lib/images/photo";

/**
 * Browser-only: decode an image (honouring EXIF rotation), scale its longer edge to <= 1600 px and
 * re-encode as JPEG. Typical phone photos drop from several MB to a few hundred KB, which keeps uploads
 * fast on mobile data and well under the bucket limit. Re-encoding also strips EXIF/GPS metadata.
 */
export async function compressImage(file: File, quality = 0.85): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("This image format is not supported. Use a JPEG, PNG or WebP photo.");
  }
  const { width, height } = fitWithin(bitmap.width, bitmap.height, PHOTO_MAX_EDGE);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser could not process this image.");
  ctx.fillStyle = "#ffffff"; // flatten transparency (PNG) onto white for JPEG
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  if (!blob) throw new Error("Could not compress the image.");
  return blob;
}
