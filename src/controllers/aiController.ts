import type { Request, Response } from 'express';
import { sendSuccess } from '../utils/apiResponse';
import { requireParam } from '../utils/params';
import * as aiService from '../services/aiService';

function auditContext(req: Request) {
  return { ipAddress: req.ip, userAgent: req.headers['user-agent'] };
}

export async function listJobs(req: Request, res: Response) {
  const { status, subjectId } = req.query;
  const filter: Record<string, string> = {};
  if (typeof status === 'string') filter.status = status;
  if (typeof subjectId === 'string') filter.subjectId = subjectId;
  sendSuccess(res, await aiService.listJobs(filter));
}

export async function getJob(req: Request, res: Response) {
  sendSuccess(res, await aiService.getJobDetailOrThrow(requireParam(req, 'jobId')));
}

export async function createJob(req: Request, res: Response) {
  const job = await aiService.createGenerationJob(req.body, req.currentUser!.id);
  sendSuccess(res, job, 'AI generation job completed', {}, 201);
}

export async function approveItem(req: Request, res: Response) {
  const item = await aiService.approveItem(
    requireParam(req, 'jobId'),
    requireParam(req, 'itemId'),
    req.currentUser!.id,
    auditContext(req),
  );
  sendSuccess(res, item, 'Generated question approved and published');
}

export async function rejectItem(req: Request, res: Response) {
  const item = await aiService.rejectItem(
    requireParam(req, 'jobId'),
    requireParam(req, 'itemId'),
    req.currentUser!.id,
    req.body?.reason,
  );
  sendSuccess(res, item, 'Generated question rejected');
}
