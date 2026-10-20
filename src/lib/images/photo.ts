/**
 * Progress-photo helpers shared by the browser (upload) and the server (registration).
 * Photos live in the PRIVATE `progress-photos` bucket at `<user_id>/<uuid>.<ext>`;
 * only that path + metadata is stored in Postgres, never the image.
 */
export const PHOTO_BUCKET = "progress-photos";
export const PHOTO_MAX_BYTES = 8 * 1024 * 1024;
export const PHOTO_MIME = ["image/jpeg", "image/png", "image/webp"] as const;
export const PHOTO_MAX_EDGE = 1600;

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";

export const extensionFor = (mime: string) => EXT[mime] ?? null;

export function buildPhotoPath(userId: string, id: string, mime: string): string {
  const ext = extensionFor(mime);
  if (!ext) throw new Error("Unsupported image type");
  return `${userId}/${id}.${ext}`;
}

/** The server accepts only paths inside the caller's own folder with a generated file name. */
export function isOwnPhotoPath(userId: string, path: string): boolean {
  return new RegExp(`^${userId.toLowerCase()}/${UUID}\\.(jpg|png|webp)$`).test(path.toLowerCase()) && !path.includes("..");
}

/** Scale (w,h) so the longer edge is at most `max`, never upscaling. */
export function fitWithin(width: number, height: number, max = PHOTO_MAX_EDGE): { width: number; height: number } {
  if (width <= 0 || height <= 0) return { width: 0, height: 0 };
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}
