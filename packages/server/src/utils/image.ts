import sharp from 'sharp';

/**
 * Resize and compress an image buffer for LLM consumption.
 */
export async function processScreenshot(
  buffer: Buffer,
  options?: { width?: number; quality?: number; format?: 'jpeg' | 'png' }
): Promise<Buffer> {
  const width = options?.width ?? 1024;
  const quality = options?.quality ?? 70;
  const format = options?.format ?? 'jpeg';

  let pipeline = sharp(buffer).resize(width, undefined, {
    fit: 'inside',
    withoutEnlargement: true,
  });

  if (format === 'jpeg') {
    pipeline = pipeline.jpeg({ quality });
  } else {
    pipeline = pipeline.png();
  }

  return pipeline.toBuffer();
}

/**
 * Compute a fast hash of a buffer for frame deduplication.
 * Uses a sampling approach for speed — not cryptographic.
 */
export function fastHash(buffer: Buffer): string {
  // Sample every 1000th byte for speed
  const samples: number[] = [];
  for (let i = 0; i < buffer.length; i += 1000) {
    samples.push(buffer[i]!);
  }
  // Simple hash from samples + length
  let hash = buffer.length;
  for (const s of samples) {
    hash = ((hash << 5) - hash + s) | 0;
  }
  return hash.toString(36);
}
