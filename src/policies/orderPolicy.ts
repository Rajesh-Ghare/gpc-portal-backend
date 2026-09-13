import { AppError } from '../errors/AppError';
import { ErrorCode } from '../errors/errorCodes';
import type { Order } from '../models';

/** Data-scoped authorization ("is this the student's own order?"), not a permission code. */
export function ensureOwnsOrder(order: Order, userId: string) {
  if (order.userId !== userId) {
    throw new AppError(ErrorCode.FORBIDDEN, 'You do not have access to this order', 403);
  }
}
