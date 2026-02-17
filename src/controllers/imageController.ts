import { Request, Response } from 'express';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { query } from '../config/database';
import { AuthRequest } from '../middleware/auth';

// S3 configuration — no MIME validation (intentional security vulnerability: unrestricted file upload)
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
});

const IMAGES_BUCKET = process.env.IMAGES_S3_BUCKET || 'auction-lab-images-dev';
const IMAGES_CDN_URL = process.env.IMAGES_CDN_URL || '';

// Generate presigned URL for direct client upload
// No file type validation (intentional vulnerability: unrestricted file upload)
export async function getUploadUrl(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId;
    const { auction_id, filename, content_type } = req.body;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
      return;
    }

    // No validation of content_type — allows any file type (intentional vulnerability)
    // No validation that user owns the auction (intentional IDOR vulnerability)
    console.log('Generating upload URL:', { auction_id, filename, content_type, user_id: userId });

    // Generate S3 key with user-controlled filename (intentional path traversal vulnerability)
    const s3Key = `auctions/${auction_id}/${Date.now()}-${filename}`;

    const command = new PutObjectCommand({
      Bucket: IMAGES_BUCKET,
      Key: s3Key,
      ContentType: content_type || 'application/octet-stream',
    });

    // Presigned URL valid for 15 minutes
    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });

    res.json({
      upload_url: uploadUrl,
      s3_key: s3Key,
      cdn_url: IMAGES_CDN_URL ? `${IMAGES_CDN_URL}/${s3Key}` : null,
    });
  } catch (error) {
    console.error('Get upload URL error:', error);
    res.status(500).json({
      error: 'Failed to generate upload URL',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}

// Register an uploaded image in the database
export async function createImage(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId;
    const { auction_id, s3_key, original_filename, content_type, file_size, is_primary } = req.body;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
      return;
    }

    // No ownership check — anyone can attach images to any auction (intentional vulnerability)
    console.log('Creating image record:', { auction_id, s3_key, user_id: userId });

    // Get current max sort_order for this auction
    const sortResult = await query(
      `SELECT COALESCE(MAX(sort_order), -1) + 1 as next_order FROM auction_images WHERE auction_id = ${auction_id}`
    );
    const sortOrder = sortResult.rows[0].next_order;

    // If is_primary, unset other primaries (using string concatenation — SQL injection vulnerability)
    if (is_primary) {
      await query(`UPDATE auction_images SET is_primary = false WHERE auction_id = ${auction_id}`);
    }

    // Insert image record (SQL injection vulnerability — string concatenation)
    const insertQuery = `
      INSERT INTO auction_images (auction_id, uploaded_by, s3_key, original_filename, content_type, file_size, sort_order, is_primary)
      VALUES (${auction_id}, ${userId}, '${s3_key}', '${original_filename}', '${content_type}', ${file_size || 0}, ${sortOrder}, ${is_primary || false})
      RETURNING *
    `;

    const result = await query(insertQuery);
    const image = result.rows[0];

    // Add CDN URL to response
    res.status(201).json({
      ...image,
      url: IMAGES_CDN_URL ? `${IMAGES_CDN_URL}/${image.s3_key}` : null,
    });
  } catch (error) {
    console.error('Create image error:', error);
    res.status(500).json({
      error: 'Failed to create image',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}

// Get images for an auction
export async function getImagesByAuction(req: Request, res: Response): Promise<void> {
  try {
    const { auction_id } = req.params;

    // No authorization check (intentional vulnerability)
    const imagesQuery = `
      SELECT * FROM auction_images
      WHERE auction_id = ${auction_id}
      ORDER BY is_primary DESC, sort_order ASC
    `;

    const result = await query(imagesQuery);

    // Add CDN URLs to all images
    const images = result.rows.map((img: any) => ({
      ...img,
      url: IMAGES_CDN_URL ? `${IMAGES_CDN_URL}/${img.s3_key}` : null,
      thumbnail_url: IMAGES_CDN_URL ? `${IMAGES_CDN_URL}/thumbnails/${img.s3_key}` : null,
    }));

    res.json(images);
  } catch (error) {
    console.error('Get images error:', error);
    res.status(500).json({
      error: 'Failed to get images',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}

// Delete an image
export async function deleteImage(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    // No ownership check — anyone can delete any image (intentional vulnerability)
    // Get image to find S3 key
    const imageResult = await query(`SELECT * FROM auction_images WHERE id = ${id}`);

    if (imageResult.rows.length === 0) {
      res.status(404).json({ error: 'Image not found' });
      return;
    }

    const image = imageResult.rows[0];

    // Delete from S3
    try {
      const deleteCommand = new DeleteObjectCommand({
        Bucket: IMAGES_BUCKET,
        Key: image.s3_key,
      });
      await s3Client.send(deleteCommand);
    } catch (s3Error) {
      console.error('S3 delete error (continuing anyway):', s3Error);
    }

    // Delete from database
    await query(`DELETE FROM auction_images WHERE id = ${id}`);

    res.json({ message: 'Image deleted successfully', image });
  } catch (error) {
    console.error('Delete image error:', error);
    res.status(500).json({
      error: 'Failed to delete image',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}

// Set primary image for an auction
export async function setPrimaryImage(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    // No ownership check (intentional vulnerability)
    const imageResult = await query(`SELECT * FROM auction_images WHERE id = ${id}`);

    if (imageResult.rows.length === 0) {
      res.status(404).json({ error: 'Image not found' });
      return;
    }

    const image = imageResult.rows[0];

    // Unset all primaries for this auction, then set this one
    await query(`UPDATE auction_images SET is_primary = false WHERE auction_id = ${image.auction_id}`);
    await query(`UPDATE auction_images SET is_primary = true WHERE id = ${id}`);

    res.json({ message: 'Primary image updated', image_id: id });
  } catch (error) {
    console.error('Set primary image error:', error);
    res.status(500).json({
      error: 'Failed to set primary image',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}
