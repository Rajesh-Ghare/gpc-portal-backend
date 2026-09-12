import { Router } from 'express';
import * as catalogController from '../../../controllers/catalogController';
import { authenticate, requirePermission } from '../../../middleware/auth';
import { validateBody } from '../../../middleware/validate';
import {
  createCategorySchema,
  createExamSchema,
  createSeriesSchema,
  updateCategorySchema,
  updateExamSchema,
  updateSeriesSchema,
} from '../../../validations/catalog.validation';

export const catalogRouter = Router();

catalogRouter.use(authenticate);

// Categories
catalogRouter.get('/categories', requirePermission('catalog.view'), catalogController.listCategories);
catalogRouter.get('/categories/:id', requirePermission('catalog.view'), catalogController.getCategory);
catalogRouter.post(
  '/categories',
  requirePermission('catalog.create'),
  validateBody(createCategorySchema),
  catalogController.createCategory,
);
catalogRouter.put(
  '/categories/:id',
  requirePermission('catalog.update'),
  validateBody(updateCategorySchema),
  catalogController.updateCategory,
);
catalogRouter.delete('/categories/:id', requirePermission('catalog.delete'), catalogController.deleteCategory);

// Competitive exams
catalogRouter.get('/exams', requirePermission('catalog.view'), catalogController.listExams);
catalogRouter.get('/exams/:id', requirePermission('catalog.view'), catalogController.getExam);
catalogRouter.post(
  '/exams',
  requirePermission('catalog.create'),
  validateBody(createExamSchema),
  catalogController.createExam,
);
catalogRouter.put(
  '/exams/:id',
  requirePermission('catalog.update'),
  validateBody(updateExamSchema),
  catalogController.updateExam,
);
catalogRouter.delete('/exams/:id', requirePermission('catalog.delete'), catalogController.deleteExam);

// Test series
catalogRouter.get('/series', requirePermission('catalog.view'), catalogController.listSeries);
catalogRouter.get('/series/:id', requirePermission('catalog.view'), catalogController.getSeries);
catalogRouter.post(
  '/series',
  requirePermission('catalog.create'),
  validateBody(createSeriesSchema),
  catalogController.createSeries,
);
catalogRouter.put(
  '/series/:id',
  requirePermission('catalog.update'),
  validateBody(updateSeriesSchema),
  catalogController.updateSeries,
);
catalogRouter.delete('/series/:id', requirePermission('catalog.delete'), catalogController.deleteSeries);
