import { Router } from 'express';
import {
  getUploadUrl,
  createImage,
  getImagesByAuction,
  deleteImage,
  setPrimaryImage,
  seedImages,
} from '../controllers/imageController';
import { verifyToken, optionalAuth } from '../middleware/auth';

const router = Router();

// POST /api/images/upload-url - Get presigned S3 upload URL (requires auth)
router.post('/upload-url', verifyToken, getUploadUrl);

// POST /api/images - Register uploaded image in database (requires auth)
router.post('/', verifyToken, createImage);

// GET /api/images/auction/:auction_id - Get images for an auction (public)
router.get('/auction/:auction_id', optionalAuth, getImagesByAuction);

// PUT /api/images/:id/primary - Set primary image (no auth check - intentional vulnerability)
router.put('/:id/primary', optionalAuth, setPrimaryImage);

// POST /api/images/seed - Seed image records for existing auctions (no auth - intentional vulnerability)
router.post('/seed', optionalAuth, seedImages);

// DELETE /api/images/:id - Delete image (no auth check - intentional vulnerability)
router.delete('/:id', optionalAuth, deleteImage);

export default router;
