import type { Request, Response } from 'express';
import { sendSuccess } from '../utils/apiResponse';
import { requireParam } from '../utils/params';
import * as subjectService from '../services/subjectService';
import * as topicService from '../services/topicService';
import * as questionService from '../services/questionService';

// Subjects

export async function listSubjects(_req: Request, res: Response) {
  sendSuccess(res, await subjectService.listSubjects());
}

export async function getSubject(req: Request, res: Response) {
  sendSuccess(res, await subjectService.getSubjectOrThrow(requireParam(req, 'id')));
}

export async function createSubject(req: Request, res: Response) {
  const subject = await subjectService.createSubject(req.body);
  sendSuccess(res, subject, 'Subject created', {}, 201);
}

export async function updateSubject(req: Request, res: Response) {
  const subject = await subjectService.updateSubject(requireParam(req, 'id'), req.body);
  sendSuccess(res, subject, 'Subject updated');
}

export async function deleteSubject(req: Request, res: Response) {
  await subjectService.deleteSubject(requireParam(req, 'id'));
  sendSuccess(res, {}, 'Subject deleted');
}

// Topics

export async function listTopics(req: Request, res: Response) {
  const subjectId = typeof req.query.subjectId === 'string' ? req.query.subjectId : undefined;
  sendSuccess(res, await topicService.listTopics({ subjectId }));
}

export async function getTopic(req: Request, res: Response) {
  sendSuccess(res, await topicService.getTopicOrThrow(requireParam(req, 'id')));
}

export async function createTopic(req: Request, res: Response) {
  const topic = await topicService.createTopic(req.body);
  sendSuccess(res, topic, 'Topic created', {}, 201);
}

export async function updateTopic(req: Request, res: Response) {
  const topic = await topicService.updateTopic(requireParam(req, 'id'), req.body);
  sendSuccess(res, topic, 'Topic updated');
}

export async function deleteTopic(req: Request, res: Response) {
  await topicService.deleteTopic(requireParam(req, 'id'));
  sendSuccess(res, {}, 'Topic deleted');
}

// Questions

export async function listQuestions(req: Request, res: Response) {
  const { subjectId, topicId, status, reviewStatus } = req.query as Record<string, string | undefined>;
  sendSuccess(res, await questionService.listQuestions({ subjectId, topicId, status, reviewStatus }));
}

export async function getQuestion(req: Request, res: Response) {
  sendSuccess(res, await questionService.getQuestionDetailOrThrow(requireParam(req, 'id')));
}

export async function createQuestion(req: Request, res: Response) {
  const detail = await questionService.createQuestion(req.body, req.currentUser!.id);
  sendSuccess(res, detail, 'Question created', {}, 201);
}

export async function updateQuestionMetadata(req: Request, res: Response) {
  const detail = await questionService.updateQuestionMetadata(requireParam(req, 'id'), req.body, req.currentUser!.id);
  sendSuccess(res, detail, 'Question updated');
}

export async function createQuestionVersion(req: Request, res: Response) {
  const detail = await questionService.createQuestionVersion(requireParam(req, 'id'), req.body, req.currentUser!.id, {
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });
  sendSuccess(res, detail, 'New question version created', {}, 201);
}

export async function approveQuestion(req: Request, res: Response) {
  const question = await questionService.approveQuestion(requireParam(req, 'id'), req.currentUser!.id, {
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });
  sendSuccess(res, question, 'Question approved');
}

export async function rejectQuestion(req: Request, res: Response) {
  const question = await questionService.rejectQuestion(
    requireParam(req, 'id'),
    req.currentUser!.id,
    req.body.reason,
    { ipAddress: req.ip, userAgent: req.headers['user-agent'] },
  );
  sendSuccess(res, question, 'Question rejected');
}

export async function deleteQuestion(req: Request, res: Response) {
  await questionService.deleteQuestion(requireParam(req, 'id'));
  sendSuccess(res, {}, 'Question deleted');
}
