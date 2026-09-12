import { AppError } from '../errors/AppError';
import { ErrorCode } from '../errors/errorCodes';
import * as seriesRepo from '../repositories/testSeriesRepository';
import { getExamOrThrow } from './competitiveExamService';
import { slugify } from '../utils/slugify';

export async function listSeries(filter: { competitiveExamId?: string } = {}) {
  return seriesRepo.listSeries(filter);
}

export async function getSeriesOrThrow(id: string) {
  const series = await seriesRepo.findSeriesById(id);
  if (!series) {
    throw new AppError(ErrorCode.SERIES_NOT_FOUND, 'Test series not found', 404);
  }
  return series;
}

async function ensureSlugAvailable(slug: string, excludeId?: string) {
  const existing = await seriesRepo.findSeriesBySlug(slug);
  if (existing && existing.id !== excludeId) {
    throw new AppError(ErrorCode.DUPLICATE_SLUG, `A test series with slug "${slug}" already exists`, 409);
  }
}

export interface SeriesInput {
  competitiveExamId?: string | null;
  name: string;
  slug?: string;
  description?: string;
  thumbnailUrl?: string;
  displayOrder?: number;
  isActive?: boolean;
}

export async function createSeries(input: SeriesInput) {
  if (input.competitiveExamId) {
    await getExamOrThrow(input.competitiveExamId);
  }
  const slug = input.slug ?? slugify(input.name);
  await ensureSlugAvailable(slug);

  return seriesRepo.createSeries({
    competitiveExamId: input.competitiveExamId ?? null,
    name: input.name,
    slug,
    description: input.description ?? null,
    thumbnailUrl: input.thumbnailUrl ?? null,
    displayOrder: input.displayOrder ?? 0,
    isActive: input.isActive ?? true,
  });
}

export async function updateSeries(id: string, input: Partial<SeriesInput>) {
  const series = await getSeriesOrThrow(id);

  if (input.competitiveExamId && input.competitiveExamId !== series.competitiveExamId) {
    await getExamOrThrow(input.competitiveExamId);
  }

  const nextSlug = input.slug ?? (input.name ? slugify(input.name) : undefined);
  if (nextSlug && nextSlug !== series.slug) {
    await ensureSlugAvailable(nextSlug, id);
  }

  return seriesRepo.updateSeries(series, {
    ...input,
    slug: nextSlug ?? series.slug,
  });
}

export async function deleteSeries(id: string) {
  const series = await getSeriesOrThrow(id);
  await seriesRepo.softDeleteSeries(series);
}
