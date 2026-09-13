import type { Request, Response } from 'express';
import { sendSuccess } from '../utils/apiResponse';
import { requireParam } from '../utils/params';
import * as testBrowseService from '../services/testBrowseService';

export async function listPublishedTests(_req: Request, res: Response) {
  sendSuccess(res, await testBrowseService.listPublishedTests());
}

export async function getPublishedTest(req: Request, res: Response) {
  sendSuccess(res, await testBrowseService.getPublishedTestOrThrow(requireParam(req, 'testId')));
}
