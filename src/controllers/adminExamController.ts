import type { Request, Response } from 'express';
import { sendSuccess } from '../utils/apiResponse';
import { requireParam } from '../utils/params';
import * as attemptAdminService from '../services/attemptAdminService';
import * as resultService from '../services/resultService';

// Attempts (admin view — includes correctness data; see attemptAdminService)

export async function listAttempts(req: Request, res: Response) {
  const { testId, userId, status } = req.query as Record<string, string | undefined>;
  sendSuccess(res, await attemptAdminService.listAttempts({ testId, userId, status }));
}

export async function getAttempt(req: Request, res: Response) {
  sendSuccess(res, await attemptAdminService.getAttemptDetailForAdmin(requireParam(req, 'attemptId')));
}

// Results

export async function listResultsForTest(req: Request, res: Response) {
  sendSuccess(res, await resultService.listResultsForTest(requireParam(req, 'testId')));
}

export async function getResult(req: Request, res: Response) {
  sendSuccess(res, await resultService.getResultDetailForAdmin(requireParam(req, 'id')));
}

export async function releaseResults(req: Request, res: Response) {
  const summary = await resultService.releaseResults(requireParam(req, 'testId'), req.currentUser!.id, {
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });
  sendSuccess(res, summary, 'Results released');
}
