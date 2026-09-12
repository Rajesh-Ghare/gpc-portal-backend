import type { Request, Response } from 'express';
import { sendSuccess } from '../utils/apiResponse';
import { requireParam } from '../utils/params';
import * as testService from '../services/testService';
import * as sectionService from '../services/testSectionService';
import * as testQuestionService from '../services/testQuestionService';
import * as ruleService from '../services/testRuleService';

function auditContext(req: Request) {
  return { ipAddress: req.ip, userAgent: req.headers['user-agent'] };
}

// Tests

export async function listTests(req: Request, res: Response) {
  const { competitiveExamId, testSeriesId, status } = req.query as Record<string, string | undefined>;
  sendSuccess(res, await testService.listTests({ competitiveExamId, testSeriesId, status }));
}

export async function getTest(req: Request, res: Response) {
  sendSuccess(res, await testService.getTestDetailOrThrow(requireParam(req, 'testId')));
}

export async function createTest(req: Request, res: Response) {
  const test = await testService.createTest(req.body, req.currentUser!.id);
  sendSuccess(res, test, 'Test created', {}, 201);
}

export async function updateTest(req: Request, res: Response) {
  const test = await testService.updateTest(requireParam(req, 'testId'), req.body, req.currentUser!.id);
  sendSuccess(res, test, 'Test updated');
}

export async function deleteTest(req: Request, res: Response) {
  await testService.deleteTest(requireParam(req, 'testId'));
  sendSuccess(res, {}, 'Test deleted');
}

export async function validateTest(req: Request, res: Response) {
  sendSuccess(res, await testService.validateTest(requireParam(req, 'testId')));
}

export async function publishTest(req: Request, res: Response) {
  const test = await testService.publishTest(requireParam(req, 'testId'), req.currentUser!.id, auditContext(req));
  sendSuccess(res, test, 'Test published');
}

export async function closeTest(req: Request, res: Response) {
  const test = await testService.closeTest(requireParam(req, 'testId'), req.currentUser!.id, auditContext(req));
  sendSuccess(res, test, 'Test closed');
}

export async function archiveTest(req: Request, res: Response) {
  const test = await testService.archiveTest(requireParam(req, 'testId'), req.currentUser!.id);
  sendSuccess(res, test, 'Test archived');
}

// Sections

export async function listSections(req: Request, res: Response) {
  sendSuccess(res, await sectionService.listSections(requireParam(req, 'testId')));
}

export async function createSection(req: Request, res: Response) {
  const section = await sectionService.createSection(requireParam(req, 'testId'), req.body);
  sendSuccess(res, section, 'Section created', {}, 201);
}

export async function updateSection(req: Request, res: Response) {
  const section = await sectionService.updateSection(requireParam(req, 'testId'), requireParam(req, 'id'), req.body);
  sendSuccess(res, section, 'Section updated');
}

export async function deleteSection(req: Request, res: Response) {
  await sectionService.deleteSection(requireParam(req, 'testId'), requireParam(req, 'id'));
  sendSuccess(res, {}, 'Section deleted');
}

// Test questions (manual selection)

export async function listTestQuestions(req: Request, res: Response) {
  sendSuccess(res, await testQuestionService.listTestQuestions(requireParam(req, 'testId')));
}

export async function addTestQuestion(req: Request, res: Response) {
  const testQuestion = await testQuestionService.addTestQuestion(requireParam(req, 'testId'), req.body);
  sendSuccess(res, testQuestion, 'Question added to test', {}, 201);
}

export async function removeTestQuestion(req: Request, res: Response) {
  await testQuestionService.removeTestQuestion(requireParam(req, 'testId'), requireParam(req, 'id'));
  sendSuccess(res, {}, 'Question removed from test');
}

// Test rules (rule-based selection)

export async function listRules(req: Request, res: Response) {
  sendSuccess(res, await ruleService.listRules(requireParam(req, 'testId')));
}

export async function createRule(req: Request, res: Response) {
  const rule = await ruleService.createRule(requireParam(req, 'testId'), req.body);
  sendSuccess(res, rule, 'Rule created', {}, 201);
}

export async function updateRule(req: Request, res: Response) {
  const rule = await ruleService.updateRule(requireParam(req, 'testId'), requireParam(req, 'id'), req.body);
  sendSuccess(res, rule, 'Rule updated');
}

export async function deleteRule(req: Request, res: Response) {
  await ruleService.deleteRule(requireParam(req, 'testId'), requireParam(req, 'id'));
  sendSuccess(res, {}, 'Rule deleted');
}
