/** Compression d'images côté client pour stockage léger dans Firestore (< 1 Mo/doc) */

const MAX_DIMENSION = 1200;
const DEFAULT_QUALITY = 0.76;
export const MAX_PHOTOS_PER_ENTRY = 4;
export const MAX_TOTAL_PHOTOS_BYTES = 700_000; // marge de sécurité sous 1 Mo Firestore

export async function compressImage(file: File): Promise<string> {
  const bitmap = await loadImage(file);
  const { width, height } = fitDimensions(bitmap.width, bitmap.height, MAX_DIMENSION);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D indisponible');
  ctx.drawImage(bitmap, 0, 0, width, height);

  const webp = canvas.toDataURL('image/webp', DEFAULT_QUALITY);
  if (webp.startsWith('data:image/webp')) return webp;
  return canvas.toDataURL('image/jpeg', DEFAULT_QUALITY);
}

export function estimatePhotosBytes(photos: string[]): number {
  return photos.reduce((sum, p) => sum + p.length, 0);
}

function fitDimensions(w: number, h: number, max: number): { width: number; height: number } {
  if (w <= max && h <= max) return { width: w, height: h };
  const ratio = Math.min(max / w, max / h);
  return { width: Math.round(w * ratio), height: Math.round(h * ratio) };
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Impossible de lire cette image'));
    };
    img.src = url;
  });
}
