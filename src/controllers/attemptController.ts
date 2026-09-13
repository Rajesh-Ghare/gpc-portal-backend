import type { Request, Response } from 'express';
import { sendSuccess } from '../utils/apiResponse';
import { requireParam } from '../utils/params';
import * as attemptService from '../services/attemptService';

export async function createAttempt(req: Request, res: Response) {
  const attempt = await attemptService.createAttempt(requireParam(req, 'testId'), req.currentUser!.id, {
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });
  sendSuccess(res, attempt, 'Attempt created', {}, 201);
}

export async function getAttempt(req: Request, res: Response) {
  sendSuccess(res, await attemptService.getAttemptDetail(requireParam(req, 'attemptId'), req.currentUser!.id));
}

export async function saveAnswer(req: Request, res: Response) {
  const saved = await attemptService.saveAnswer(
    requireParam(req, 'attemptId'),
    requireParam(req, 'attemptQuestionId'),
    req.currentUser!.id,
    req.body,
  );
  sendSuccess(res, saved, 'Answer saved');
}

export async function submitAttempt(req: Request, res: Response) {
  const result = await attemptService.submitAttempt(requireParam(req, 'attemptId'), req.currentUser!.id);
  sendSuccess(res, result, 'Attempt submitted');
}

export async function getResult(req: Request, res: Response) {
  sendSuccess(res, await attemptService.getResult(requireParam(req, 'attemptId'), req.currentUser!.id));
}
