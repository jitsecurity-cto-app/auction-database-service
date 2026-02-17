import { Router } from 'express';
import {
  getPreferences,
  updatePreferences,
  getNotifications,
  markNotificationRead,
  getUnreadCount,
} from '../controllers/notificationController';
import { verifyToken } from '../middleware/auth';

const router = Router();

// GET /api/notifications/preferences - Get notification preferences
router.get('/preferences', verifyToken, getPreferences);

// PUT /api/notifications/preferences - Update notification preferences
router.put('/preferences', verifyToken, updatePreferences);

// GET /api/notifications - Get notifications for current user
router.get('/', verifyToken, getNotifications);

// GET /api/notifications/unread-count - Get unread notification count
router.get('/unread-count', verifyToken, getUnreadCount);

// PUT /api/notifications/:id/read - Mark notification as read
router.put('/:id/read', verifyToken, markNotificationRead);

export default router;
