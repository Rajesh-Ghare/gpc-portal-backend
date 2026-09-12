import { AppError } from '../errors/AppError';
import { ErrorCode } from '../errors/errorCodes';
import * as examRepo from '../repositories/competitiveExamRepository';
import { getCategoryOrThrow } from './examCategoryService';
import { slugify } from '../utils/slugify';

export async function listExams(filter: { categoryId?: string } = {}) {
  return examRepo.listExams(filter);
}

export async function getExamOrThrow(id: string) {
  const exam = await examRepo.findExamById(id);
  if (!exam) {
    throw new AppError(ErrorCode.EXAM_NOT_FOUND, 'Competitive exam not found', 404);
  }
  return exam;
}

async function ensureSlugAvailable(slug: string, excludeId?: string) {
  const existing = await examRepo.findExamBySlug(slug);
  if (existing && existing.id !== excludeId) {
    throw new AppError(ErrorCode.DUPLICATE_SLUG, `An exam with slug "${slug}" already exists`, 409);
  }
}

export interface ExamInput {
  categoryId: string;
  name: string;
  slug?: string;
  code?: string;
  description?: string;
  conductingBody?: string;
  officialWebsite?: string;
  isActive?: boolean;
}

export async function createExam(input: ExamInput) {
  await getCategoryOrThrow(input.categoryId);
  const slug = input.slug ?? slugify(input.name);
  await ensureSlugAvailable(slug);

  return examRepo.createExam({
    categoryId: input.categoryId,
    name: input.name,
    slug,
    code: input.code ?? null,
    description: input.description ?? null,
    conductingBody: input.conductingBody ?? null,
    officialWebsite: input.officialWebsite ?? null,
    isActive: input.isActive ?? true,
  });
}

export async function updateExam(id: string, input: Partial<ExamInput>) {
  const exam = await getExamOrThrow(id);

  if (input.categoryId && input.categoryId !== exam.categoryId) {
    await getCategoryOrThrow(input.categoryId);
  }

  const nextSlug = input.slug ?? (input.name ? slugify(input.name) : undefined);
  if (nextSlug && nextSlug !== exam.slug) {
    await ensureSlugAvailable(nextSlug, id);
  }

  return examRepo.updateExam(exam, {
    ...input,
    slug: nextSlug ?? exam.slug,
  });
}

export async function deleteExam(id: string) {
  const exam = await getExamOrThrow(id);
  await examRepo.softDeleteExam(exam);
}
