import type { z } from 'zod';
import { AppError } from '../errors/AppError';
import { ErrorCode } from '../errors/errorCodes';
import * as sectionRepo from '../repositories/testSectionRepository';
import { ensureTestEditable, getTestOrThrow } from './testService';
import type { createSectionSchema, updateSectionSchema } from '../validations/testBuilder.validation';

type CreateSectionInput = z.infer<typeof createSectionSchema>;
type UpdateSectionInput = z.infer<typeof updateSectionSchema>;

export async function listSections(testId: string) {
  await getTestOrThrow(testId);
  return sectionRepo.listSections(testId);
}

export async function getSectionOrThrow(id: string) {
  const section = await sectionRepo.findSectionById(id);
  if (!section) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Test section not found', 404);
  }
  return section;
}

export async function createSection(testId: string, input: CreateSectionInput) {
  const test = await getTestOrThrow(testId);
  ensureTestEditable(test);

  return sectionRepo.createSection({
    testId,
    title: input.title,
    description: input.description ?? null,
    displayOrder: input.displayOrder ?? 0,
    durationSeconds: input.durationSeconds ?? null,
    marksPerQuestion: input.marksPerQuestion !== undefined ? String(input.marksPerQuestion) : null,
    negativeMarks: input.negativeMarks !== undefined ? String(input.negativeMarks) : null,
  });
}

export async function updateSection(testId: string, id: string, input: UpdateSectionInput) {
  const test = await getTestOrThrow(testId);
  ensureTestEditable(test);
  const section = await getSectionOrThrow(id);

  return sectionRepo.updateSection(section, {
    ...input,
    marksPerQuestion:
      input.marksPerQuestion !== undefined ? String(input.marksPerQuestion) : section.marksPerQuestion,
    negativeMarks: input.negativeMarks !== undefined ? String(input.negativeMarks) : section.negativeMarks,
  });
}

export async function deleteSection(testId: string, id: string) {
  const test = await getTestOrThrow(testId);
  ensureTestEditable(test);
  const section = await getSectionOrThrow(id);
  await sectionRepo.deleteSection(section);
}
