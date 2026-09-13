import type { Request, Response } from 'express';
import { sendSuccess } from '../utils/apiResponse';
import { requireParam } from '../utils/params';
import * as productService from '../services/productService';

function auditContext(req: Request) {
  return { ipAddress: req.ip, userAgent: req.headers['user-agent'] };
}

// Products

export async function listProducts(req: Request, res: Response) {
  const { productType, status } = req.query;
  const filter: Record<string, string> = {};
  if (typeof productType === 'string') filter.productType = productType;
  if (typeof status === 'string') filter.status = status;
  sendSuccess(res, await productService.listProducts(filter));
}

export async function getProduct(req: Request, res: Response) {
  sendSuccess(res, await productService.getProductDetailOrThrow(requireParam(req, 'id')));
}

export async function createProduct(req: Request, res: Response) {
  const product = await productService.createProduct(req.body, req.currentUser!.id);
  sendSuccess(res, product, 'Product created', {}, 201);
}

export async function updateProduct(req: Request, res: Response) {
  const product = await productService.updateProduct(requireParam(req, 'id'), req.body, req.currentUser!.id);
  sendSuccess(res, product, 'Product updated');
}

export async function deleteProduct(req: Request, res: Response) {
  await productService.deleteProduct(requireParam(req, 'id'));
  sendSuccess(res, {}, 'Product deleted');
}

// Prices

export async function listPrices(req: Request, res: Response) {
  sendSuccess(res, await productService.listPrices(requireParam(req, 'id')));
}

export async function createPrice(req: Request, res: Response) {
  const price = await productService.createPrice(
    requireParam(req, 'id'),
    req.body,
    req.currentUser!.id,
    auditContext(req),
  );
  sendSuccess(res, price, 'Price created', {}, 201);
}

export async function updatePrice(req: Request, res: Response) {
  const price = await productService.updatePrice(
    requireParam(req, 'id'),
    requireParam(req, 'priceId'),
    req.body,
    req.currentUser!.id,
    auditContext(req),
  );
  sendSuccess(res, price, 'Price updated');
}

export async function deletePrice(req: Request, res: Response) {
  await productService.deletePrice(requireParam(req, 'id'), requireParam(req, 'priceId'), req.currentUser!.id, auditContext(req));
  sendSuccess(res, {}, 'Price deleted');
}

// Items

export async function listItems(req: Request, res: Response) {
  sendSuccess(res, await productService.listItems(requireParam(req, 'id')));
}

export async function createItem(req: Request, res: Response) {
  const item = await productService.createItem(requireParam(req, 'id'), req.body);
  sendSuccess(res, item, 'Product item created', {}, 201);
}

export async function deleteItem(req: Request, res: Response) {
  await productService.deleteItem(requireParam(req, 'id'), requireParam(req, 'itemId'));
  sendSuccess(res, {}, 'Product item deleted');
}
