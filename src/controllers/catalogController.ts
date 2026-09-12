import type { Request, Response } from 'express';
import { sendSuccess } from '../utils/apiResponse';
import { requireParam } from '../utils/params';
import * as categoryService from '../services/examCategoryService';
import * as examService from '../services/competitiveExamService';
import * as seriesService from '../services/testSeriesService';

// Categories

export async function listCategories(_req: Request, res: Response) {
  const categories = await categoryService.listCategories();
  sendSuccess(res, categories);
}

export async function getCategory(req: Request, res: Response) {
  const category = await categoryService.getCategoryOrThrow(requireParam(req, 'id'));
  sendSuccess(res, category);
}

export async function createCategory(req: Request, res: Response) {
  const category = await categoryService.createCategory(req.body);
  sendSuccess(res, category, 'Category created', {}, 201);
}

export async function updateCategory(req: Request, res: Response) {
  const category = await categoryService.updateCategory(requireParam(req, 'id'), req.body);
  sendSuccess(res, category, 'Category updated');
}

export async function deleteCategory(req: Request, res: Response) {
  await categoryService.deleteCategory(requireParam(req, 'id'));
  sendSuccess(res, {}, 'Category deleted');
}

// Competitive exams

export async function listExams(req: Request, res: Response) {
  const categoryId = typeof req.query.categoryId === 'string' ? req.query.categoryId : undefined;
  const exams = await examService.listExams({ categoryId });
  sendSuccess(res, exams);
}

export async function getExam(req: Request, res: Response) {
  const exam = await examService.getExamOrThrow(requireParam(req, 'id'));
  sendSuccess(res, exam);
}

export async function createExam(req: Request, res: Response) {
  const exam = await examService.createExam(req.body);
  sendSuccess(res, exam, 'Competitive exam created', {}, 201);
}

export async function updateExam(req: Request, res: Response) {
  const exam = await examService.updateExam(requireParam(req, 'id'), req.body);
  sendSuccess(res, exam, 'Competitive exam updated');
}

export async function deleteExam(req: Request, res: Response) {
  await examService.deleteExam(requireParam(req, 'id'));
  sendSuccess(res, {}, 'Competitive exam deleted');
}

// Test series

export async function listSeries(req: Request, res: Response) {
  const competitiveExamId = typeof req.query.competitiveExamId === 'string' ? req.query.competitiveExamId : undefined;
  const series = await seriesService.listSeries({ competitiveExamId });
  sendSuccess(res, series);
}

export async function getSeries(req: Request, res: Response) {
  const series = await seriesService.getSeriesOrThrow(requireParam(req, 'id'));
  sendSuccess(res, series);
}

export async function createSeries(req: Request, res: Response) {
  const series = await seriesService.createSeries(req.body);
  sendSuccess(res, series, 'Test series created', {}, 201);
}

export async function updateSeries(req: Request, res: Response) {
  const series = await seriesService.updateSeries(requireParam(req, 'id'), req.body);
  sendSuccess(res, series, 'Test series updated');
}

export async function deleteSeries(req: Request, res: Response) {
  await seriesService.deleteSeries(requireParam(req, 'id'));
  sendSuccess(res, {}, 'Test series deleted');
}
