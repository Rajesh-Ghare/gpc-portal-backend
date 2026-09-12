import { AppError } from '../errors/AppError';
import { ErrorCode } from '../errors/errorCodes';
import * as categoryRepo from '../repositories/examCategoryRepository';
import { slugify } from '../utils/slugify';

export async function listCategories() {
  return categoryRepo.listCategories();
}

export async function getCategoryOrThrow(id: string) {
  const category = await categoryRepo.findCategoryById(id);
  if (!category) {
    throw new AppError(ErrorCode.CATEGORY_NOT_FOUND, 'Exam category not found', 404);
  }
  return category;
}

async function ensureSlugAvailable(slug: string, excludeId?: string) {
  const existing = await categoryRepo.findCategoryBySlug(slug);
  if (existing && existing.id !== excludeId) {
    throw new AppError(ErrorCode.DUPLICATE_SLUG, `A category with slug "${slug}" already exists`, 409);
  }
}

export interface CategoryInput {
  name: string;
  slug?: string;
  description?: string;
  displayOrder?: number;
  isActive?: boolean;
}

export async function createCategory(input: CategoryInput) {
  const slug = input.slug ?? slugify(input.name);
  await ensureSlugAvailable(slug);

  return categoryRepo.createCategory({
    name: input.name,
    slug,
    description: input.description ?? null,
    displayOrder: input.displayOrder ?? 0,
    isActive: input.isActive ?? true,
  });
}

export async function updateCategory(id: string, input: Partial<CategoryInput>) {
  const category = await getCategoryOrThrow(id);

  const nextSlug = input.slug ?? (input.name ? slugify(input.name) : undefined);
  if (nextSlug && nextSlug !== category.slug) {
    await ensureSlugAvailable(nextSlug, id);
  }

  return categoryRepo.updateCategory(category, {
    ...input,
    slug: nextSlug ?? category.slug,
  });
}

export async function deleteCategory(id: string) {
  const category = await getCategoryOrThrow(id);
  await categoryRepo.softDeleteCategory(category);
}
