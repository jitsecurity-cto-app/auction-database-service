/**
 * Upload placeholder images to S3 for seed data
 *
 * Downloads random images from picsum.photos and uploads them to the
 * auction images S3 bucket using the same keys referenced in seed/index.ts.
 *
 * Usage: npx tsx src/seed/upload-images.ts
 *
 * Requires AWS credentials and IMAGES_S3_BUCKET env var.
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import https from 'https';

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const BUCKET = process.env.IMAGES_S3_BUCKET;

if (!BUCKET) {
  console.error('Error: IMAGES_S3_BUCKET environment variable is required');
  console.error('Set it to the S3 bucket name, e.g.: IMAGES_S3_BUCKET=auction-lab-images-dev');
  process.exit(1);
}

// All S3 keys that the seed data references
const IMAGE_KEYS = [
  'seed/watches/rolex-submariner-1.jpg',
  'seed/watches/rolex-submariner-2.jpg',
  'seed/watches/rolex-submariner-3.jpg',
  'seed/art/abstract-painting-1.jpg',
  'seed/art/abstract-painting-2.jpg',
  'seed/electronics/macbook-pro-1.jpg',
  'seed/electronics/macbook-pro-2.jpg',
  'seed/electronics/macbook-pro-3.jpg',
  'seed/furniture/mid-century-chair-1.jpg',
  'seed/furniture/mid-century-chair-2.jpg',
  'seed/jewelry/diamond-ring-1.jpg',
  'seed/jewelry/diamond-ring-2.jpg',
  'seed/jewelry/diamond-ring-3.jpg',
  'seed/collectibles/vintage-vinyl-1.jpg',
  'seed/cameras/leica-m6-1.jpg',
  'seed/cameras/leica-m6-2.jpg',
  'seed/wine/bordeaux-1982-1.jpg',
  'seed/guitars/fender-strat-1.jpg',
  'seed/guitars/fender-strat-2.jpg',
  'seed/sneakers/jordan-1-1.jpg',
  'seed/sneakers/jordan-1-2.jpg',
];

// Fetch a random image from picsum.photos with a specific seed for reproducibility
function fetchImage(seed: number, width = 800, height = 600): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const url = `https://picsum.photos/seed/${seed}/${width}/${height}.jpg`;
    https.get(url, (res) => {
      // Follow redirect (picsum returns 302)
      if (res.statusCode === 302 && res.headers.location) {
        https.get(res.headers.location, (imgRes) => {
          const chunks: Buffer[] = [];
          imgRes.on('data', (chunk) => chunks.push(chunk));
          imgRes.on('end', () => resolve(Buffer.concat(chunks)));
          imgRes.on('error', reject);
        }).on('error', reject);
      } else {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', reject);
      }
    }).on('error', reject);
  });
}

async function uploadImage(key: string, seed: number): Promise<void> {
  const body = await fetchImage(seed);
  await s3Client.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: body,
    ContentType: 'image/jpeg',
    CacheControl: 'public, max-age=31536000',
  }));
  console.log(`  Uploaded: ${key} (${(body.length / 1024).toFixed(1)} KB)`);
}

async function main(): Promise<void> {
  console.log(`Uploading ${IMAGE_KEYS.length} placeholder images to s3://${BUCKET}/\n`);

  for (let i = 0; i < IMAGE_KEYS.length; i++) {
    try {
      await uploadImage(IMAGE_KEYS[i], 100 + i); // deterministic seed per image
    } catch (error) {
      console.error(`  Failed to upload ${IMAGE_KEYS[i]}:`, error);
    }
  }

  console.log('\nDone! Images are ready for the seed data.');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Upload failed:', err);
    process.exit(1);
  });
