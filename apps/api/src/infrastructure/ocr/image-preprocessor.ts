import sharp from 'sharp';

const MAX_DIMENSION = 2000;
const MIN_WIDTH = 1000;

/**
 * Prepares an image for Tesseract: auto-rotate, flatten alpha, grayscale, upscale small
 * images (Instagram thumbnails are often 640px), contrast-normalize, sharpen.
 */
export async function preprocessForOcr(input: Buffer): Promise<Buffer> {
  const image = sharp(input, { failOn: 'none' }).rotate();
  const { width = 0, height = 0 } = await image.metadata();
  const longest = Math.max(width, height);

  let pipeline = image.flatten({ background: '#ffffff' }).grayscale();
  if (width > 0 && width < MIN_WIDTH) {
    pipeline = pipeline.resize({ width: Math.min(width * 2, MAX_DIMENSION), kernel: 'lanczos3' });
  } else if (longest > MAX_DIMENSION) {
    pipeline = pipeline.resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: 'inside' });
  }
  return pipeline.normalize().sharpen().png().toBuffer();
}
