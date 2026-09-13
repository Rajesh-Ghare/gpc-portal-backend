import { Router } from 'express';
import * as controller from '../../../controllers/entitlementController';
import { authenticate, requirePermission } from '../../../middleware/auth';
import { validateBody } from '../../../middleware/validate';
import { grantEntitlementSchema } from '../../../validations/entitlement.validation';

export const entitlementRouter = Router();

entitlementRouter.use(authenticate);

entitlementRouter.post(
  '/entitlements',
  requirePermission('entitlement.grant'),
  validateBody(grantEntitlementSchema),
  controller.grantEntitlement,
);
entitlementRouter.get('/entitlements', requirePermission('entitlement.view'), controller.listEntitlements);
entitlementRouter.delete('/entitlements/:id', requirePermission('entitlement.grant'), controller.revokeEntitlement);
