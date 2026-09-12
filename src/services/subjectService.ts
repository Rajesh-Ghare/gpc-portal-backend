import { AppError } from '../errors/AppError';
import { ErrorCode } from '../errors/errorCodes';
import * as subjectRepo from '../repositories/subjectRepository';
import { slugify } from '../utils/slugify';

export async function listSubjects() {
  return subjectRepo.listSubjects();
}

export async function getSubjectOrThrow(id: string) {
  const subject = await subjectRepo.findSubjectById(id);
  if (!subject) {
    throw new AppError(ErrorCode.SUBJECT_NOT_FOUND, 'Subject not found', 404);
  }
  return subject;
}

async function ensureSlugAvailable(slug: string, excludeId?: string) {
  const existing = await subjectRepo.findSubjectBySlug(slug);
  if (existing && existing.id !== excludeId) {
    throw new AppError(ErrorCode.DUPLICATE_SLUG, `A subject with slug "${slug}" already exists`, 409);
  }
}

export interface SubjectInput {
  name: string;
  slug?: string;
  description?: string;
  isActive?: boolean;
}

export async function createSubject(input: SubjectInput) {
  const slug = input.slug ?? slugify(input.name);
  await ensureSlugAvailable(slug);

  return subjectRepo.createSubject({
    name: input.name,
    slug,
    description: input.description ?? null,
    isActive: input.isActive ?? true,
  });
}

export async function updateSubject(id: string, input: Partial<SubjectInput>) {
  const subject = await getSubjectOrThrow(id);

  const nextSlug = input.slug ?? (input.name ? slugify(input.name) : undefined);
  if (nextSlug && nextSlug !== subject.slug) {
    await ensureSlugAvailable(nextSlug, id);
  }

  return subjectRepo.updateSubject(subject, {
    ...input,
    slug: nextSlug ?? subject.slug,
  });
}

export async function deleteSubject(id: string) {
  const subject = await getSubjectOrThrow(id);
  await subjectRepo.softDeleteSubject(subject);
}
