import type { Response } from 'express';

export function sendSuccess(res: Response, data: unknown = {}, message = 'Success', meta: unknown = {}, statusCode = 200) {
  return res.status(statusCode).json({ success: true, message, data, meta });
}

export function sendError(res: Response, errorCode: string, message: string, statusCode = 400, errors: unknown[] = []) {
  return res.status(statusCode).json({ success: false, message, errorCode, errors });
}
