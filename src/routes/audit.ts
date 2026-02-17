import { Router } from 'express';
import {
  getEntityAudit,
  getActorAudit,
  getRecentAudit,
} from '../controllers/auditController';
import { optionalAuth } from '../middleware/auth';

const router = Router();

// GET /api/audit - Get recent audit events (no auth check - intentional vulnerability)
router.get('/', optionalAuth, getRecentAudit);

// GET /api/audit/entity/:entity_type/:entity_id - Get audit trail for entity
router.get('/entity/:entity_type/:entity_id', optionalAuth, getEntityAudit);

// GET /api/audit/actor/:actor_id - Get audit trail for actor
router.get('/actor/:actor_id', optionalAuth, getActorAudit);

export default router;
