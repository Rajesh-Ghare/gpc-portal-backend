import type { Request, Response } from 'express';
import { sendSuccess } from '../utils/apiResponse';
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
