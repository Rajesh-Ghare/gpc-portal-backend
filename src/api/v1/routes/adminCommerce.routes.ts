import { Router } from 'express';
import * as productController from '../../../controllers/productController';
import * as orderController from '../../../controllers/orderController';
import { authenticate, requirePermission } from '../../../middleware/auth';
import { validateBody } from '../../../middleware/validate';
import {
  createPriceSchema,
  createProductItemSchema,
  createProductSchema,
  updatePriceSchema,
  updateProductSchema,
} from '../../../validations/product.validation';

export const adminCommerceRouter = Router();

adminCommerceRouter.use(authenticate);

// Products
adminCommerceRouter.get('/products', requirePermission('product.view'), productController.listProducts);
adminCommerceRouter.get('/products/:id', requirePermission('product.view'), productController.getProduct);
adminCommerceRouter.post(
  '/products',
  requirePermission('product.create'),
  validateBody(createProductSchema),
  productController.createProduct,
);
adminCommerceRouter.put(
  '/products/:id',
  requirePermission('product.update'),
  validateBody(updateProductSchema),
  productController.updateProduct,
);
adminCommerceRouter.delete('/products/:id', requirePermission('product.update'), productController.deleteProduct);

// Prices
adminCommerceRouter.get('/products/:id/prices', requirePermission('product.view'), productController.listPrices);
adminCommerceRouter.post(
  '/products/:id/prices',
  requirePermission('product.update'),
  validateBody(createPriceSchema),
  productController.createPrice,
);
adminCommerceRouter.put(
  '/products/:id/prices/:priceId',
  requirePermission('product.update'),
  validateBody(updatePriceSchema),
  productController.updatePrice,
);
adminCommerceRouter.delete(
  '/products/:id/prices/:priceId',
  requirePermission('product.update'),
  productController.deletePrice,
);

// Items
adminCommerceRouter.get('/products/:id/items', requirePermission('product.view'), productController.listItems);
adminCommerceRouter.post(
  '/products/:id/items',
  requirePermission('product.update'),
  validateBody(createProductItemSchema),
  productController.createItem,
);
adminCommerceRouter.delete(
  '/products/:id/items/:itemId',
  requirePermission('product.update'),
  productController.deleteItem,
);

// Orders (admin browsing)
adminCommerceRouter.get('/orders', requirePermission('order.view'), orderController.listOrdersAdmin);
adminCommerceRouter.get('/orders/:orderId', requirePermission('order.view'), orderController.getOrderAdmin);
