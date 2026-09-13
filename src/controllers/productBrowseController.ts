import type { Request, Response } from 'express';
import { sendSuccess } from '../utils/apiResponse';
import { requireParam } from '../utils/params';
import * as productBrowseService from '../services/productBrowseService';

export async function listProducts(_req: Request, res: Response) {
  sendSuccess(res, await productBrowseService.listActiveProducts());
}

export async function getProduct(req: Request, res: Response) {
  sendSuccess(res, await productBrowseService.getActiveProductOrThrow(requireParam(req, 'productId')));
}
