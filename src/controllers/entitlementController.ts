import type { Request, Response } from 'express';
import { sendSuccess } from '../utils/apiResponse';
import { requireParam } from '../utils/params';
import * as entitlementService from '../services/entitlementService';

export async function grantEntitlement(req: Request, res: Response) {
  const { entitlement, alreadyExisted } = await entitlementService.grantEntitlement(req.body, req.currentUser!.id, {
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });
  sendSuccess(
    res,
    entitlement,
    alreadyExisted ? 'An active entitlement already existed' : 'Entitlement granted',
    {},
    alreadyExisted ? 200 : 201,
  );
}

export async function listEntitlements(req: Request, res: Response) {
  const { userId, status, productId } = req.query;
  const filter: Record<string, string> = {};
  if (typeof userId === 'string') filter.userId = userId;
  if (typeof status === 'string') filter.status = status;
  if (typeof productId === 'string') filter.productId = productId;
  sendSuccess(res, await entitlementService.listEntitlements(filter));
}

export async function revokeEntitlement(req: Request, res: Response) {
  const entitlement = await entitlementService.revokeEntitlement(requireParam(req, 'id'), req.currentUser!.id, {
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });
  sendSuccess(res, entitlement, 'Entitlement revoked');
}
