import type { Request, Response } from 'express';
import { sendSuccess } from '../utils/apiResponse';
import { requireParam } from '../utils/params';
import * as orderService from '../services/orderService';
import { ensureOwnsOrder } from '../policies/orderPolicy';

export async function createOrder(req: Request, res: Response) {
  const { order, alreadyExisted } = await orderService.createOrder(req.body, req.currentUser!.id);
  sendSuccess(res, order, alreadyExisted ? 'Order already exists' : 'Order created', {}, alreadyExisted ? 200 : 201);
}

export async function getMyOrder(req: Request, res: Response) {
  const order = await orderService.getOrderOrThrow(requireParam(req, 'orderId'));
  ensureOwnsOrder(order, req.currentUser!.id);
  sendSuccess(res, order);
}

export async function listMyOrders(req: Request, res: Response) {
  sendSuccess(res, await orderService.listMyOrders(req.currentUser!.id));
}

// Admin

export async function listOrdersAdmin(req: Request, res: Response) {
  const { userId, status } = req.query;
  const filter: Record<string, string> = {};
  if (typeof userId === 'string') filter.userId = userId;
  if (typeof status === 'string') filter.status = status;
  sendSuccess(res, await orderService.listOrdersForAdmin(filter));
}

export async function getOrderAdmin(req: Request, res: Response) {
  sendSuccess(res, await orderService.getOrderOrThrow(requireParam(req, 'orderId')));
}
