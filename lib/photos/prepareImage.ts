const MAX_EDGE = 1920;
const JPEG_QUALITY = 0.8;

/**
 * Converts a File to a compressed JPEG File ready for upload.
 *
 * - HEIC/HEIF (common on iPhone): converted via heic2any before canvas step.
 * - All images: downscaled so the longest edge ≤ 1920px and re-encoded as
 *   JPEG at quality 0.8, keeping the payload well under Vercel's 4.5 MB limit.
 *
 * Must be called in a browser context (uses canvas + createImageBitmap).
 * Throws a plain Error with a user-facing message on any failure.
 */
export async function prepareImage(file: File): Promise<File> {
  const name = file.name.toLowerCase();
  const isHeic =
    file.type === "image/heic" ||
    file.type === "image/heif" ||
    name.endsWith(".heic") ||
    name.endsWith(".heif");

  let blob: Blob = file;

  if (isHeic) {
    // Dynamic import keeps heic2any (~1 MB) out of the initial bundle.
    const heic2any = (await import("heic2any")).default;
    const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: JPEG_QUALITY });
    blob = Array.isArray(converted) ? converted[0] : converted;
  }

  // Downscale and re-encode via canvas — applies to all images, not just HEIC.
  const bitmap = await createImageBitmap(blob);
  const { width, height } = bitmap;

  const longest = Math.max(width, height);
  const scale = longest > MAX_EDGE ? MAX_EDGE / longest : 1;
  const targetW = Math.round(width * scale);
  const targetH = Math.round(height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("Could not prepare image for upload.");
  }
  ctx.drawImage(bitmap, 0, 0, targetW, targetH);
  bitmap.close();

  return new Promise<File>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (!result) {
          reject(new Error("Could not prepare image for upload."));
          return;
        }
        const baseName = file.name.replace(/\.[^.]+$/, "") || "photo";
        resolve(new File([result], `${baseName}.jpg`, { type: "image/jpeg" }));
      },
      "image/jpeg",
      JPEG_QUALITY
    );
  });
}
