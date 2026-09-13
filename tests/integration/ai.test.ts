import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { AiGenerationItem, AiGenerationJob, AuditLog, Question, Subject, sequelize } from '../../src/models';
import { mockOtpProvider } from '../../src/strategies/otp/MockOtpProvider';
import { findDuplicateQuestion } from '../../src/services/aiService';
import * as questionService from '../../src/services/questionService';

const app = createApp();

const SUPER_ADMIN_MOBILE = '9000000001';
const STUDENT_MOBILE = '9000000003';

async function loginAs(mobileNumber: string): Promise<{ token: string; userId: string }> {
  await request(app).post('/api/v1/auth/request-otp').send({ mobileNumber }).expect(200);
  const otp = mockOtpProvider.getLastSentOtp(mobileNumber);
  if (!otp) throw new Error('OTP was not captured by MockOtpProvider');
  const res = await request(app).post('/api/v1/auth/verify-otp').send({ mobileNumber, otp }).expect(200);
  const token = res.body.data.token as string;
  const meRes = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`).expect(200);
  return { token, userId: meRes.body.data.id as string };
}

describe('AI question generation (mock provider, admin review workflow)', () => {
  let adminToken: string;
  let adminUserId: string;
  let studentToken: string;
  let subjectId: string;
  const createdQuestionIds: string[] = [];

  beforeAll(async () => {
    await sequelize.authenticate();
    const admin = await loginAs(SUPER_ADMIN_MOBILE);
    adminToken = admin.token;
    adminUserId = admin.userId;
    studentToken = (await loginAs(STUDENT_MOBILE)).token;

    const res = await request(app)
      .post('/api/v1/admin/subjects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'AI Test Subject' })
      .expect(201);
    subjectId = res.body.data.id;
  });

  afterAll(async () => {
    const jobs = await AiGenerationJob.findAll({ where: { subjectId } });
    const jobIds = jobs.map((j) => j.id);
    await AiGenerationItem.destroy({ where: { jobId: jobIds } });
    await AiGenerationJob.destroy({ where: { id: jobIds } });
    if (createdQuestionIds.length > 0) {
      await AuditLog.destroy({ where: { entityId: createdQuestionIds } });
      await Question.destroy({ where: { id: createdQuestionIds }, force: true });
    }
    await Subject.destroy({ where: { id: subjectId }, force: true });
    await sequelize.close();
  });

  it('rejects a student from every AI route', async () => {
    const res = await request(app).get('/api/v1/admin/ai/jobs').set('Authorization', `Bearer ${studentToken}`);
    expect(res.status).toBe(403);
    expect(res.body.errorCode).toBe('FORBIDDEN');
  });

  it('creates a generation job, synchronously generating the requested number of PENDING_REVIEW items', async () => {
    const res = await request(app)
      .post('/api/v1/admin/ai/jobs')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ subjectId, requestedCount: 3 })
      .expect(201);

    expect(res.body.data.status).toBe('COMPLETED');
    expect(res.body.data.generatedCount).toBe(3);
    expect(res.body.data.provider).toBe('mock');
    expect(res.body.data.items).toHaveLength(3);
    for (const item of res.body.data.items) {
      expect(item.status).toBe('PENDING_REVIEW');
      expect(item.rawOutput.translations[0].questionText).toContain('[MOCK AI]');
    }
  });

  it('approves an item: creates a real, published question stamped with AI provenance', async () => {
    const jobRes = await request(app)
      .post('/api/v1/admin/ai/jobs')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ subjectId, requestedCount: 1 })
      .expect(201);
    const jobId = jobRes.body.data.id as string;
    const itemId = jobRes.body.data.items[0].id as string;

    const approveRes = await request(app)
      .post(`/api/v1/admin/ai/jobs/${jobId}/items/${itemId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(approveRes.body.data.status).toBe('APPROVED');
    const questionId = approveRes.body.data.questionId as string;
    createdQuestionIds.push(questionId);

    const questionRes = await request(app)
      .get(`/api/v1/admin/questions/${questionId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(questionRes.body.data.question).toMatchObject({
      sourceType: 'AI_GENERATED',
      generatedByAi: true,
      aiProvider: 'mock',
      generationJobId: jobId,
      status: 'PUBLISHED',
      reviewStatus: 'APPROVED',
    });

    const jobAfter = await AiGenerationJob.findByPk(jobId);
    expect(jobAfter!.approvedCount).toBe(1);

    const auditLog = await AuditLog.findOne({ where: { action: 'question.approve', entityId: questionId } });
    expect(auditLog).not.toBeNull();
  });

  it('rejects an item with a reason, recorded on the item without creating a question', async () => {
    const jobRes = await request(app)
      .post('/api/v1/admin/ai/jobs')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ subjectId, requestedCount: 1 })
      .expect(201);
    const jobId = jobRes.body.data.id as string;
    const itemId = jobRes.body.data.items[0].id as string;

    const rejectRes = await request(app)
      .post(`/api/v1/admin/ai/jobs/${jobId}/items/${itemId}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'not good enough' })
      .expect(200);
    expect(rejectRes.body.data.status).toBe('REJECTED');
    expect(rejectRes.body.data.questionId).toBeNull();
    expect(rejectRes.body.data.validationErrors).toEqual(['not good enough']);

    const jobAfter = await AiGenerationJob.findByPk(jobId);
    expect(jobAfter!.failedCount).toBe(1);
  });

  it('rejects re-approving an already-decided item', async () => {
    const jobRes = await request(app)
      .post('/api/v1/admin/ai/jobs')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ subjectId, requestedCount: 1 })
      .expect(201);
    const jobId = jobRes.body.data.id as string;
    const itemId = jobRes.body.data.items[0].id as string;

    const approveRes = await request(app)
      .post(`/api/v1/admin/ai/jobs/${jobId}/items/${itemId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    createdQuestionIds.push(approveRes.body.data.questionId);

    const res = await request(app)
      .post(`/api/v1/admin/ai/jobs/${jobId}/items/${itemId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(409);
    expect(res.body.errorCode).toBe('VALIDATION_ERROR');
  });

  it('findDuplicateQuestion flags an exact-normalized-text match against an approved question in the same subject, and nothing otherwise', async () => {
    const probeText = 'Duplicate probe question text for AI generation tests';
    const { question } = await questionService.createQuestion(
      {
        subjectId,
        translations: [{ languageCode: 'en', questionText: probeText }],
        options: [
          { optionKey: 'A', isCorrect: true, translations: [{ languageCode: 'en', optionText: 'Right' }] },
          { optionKey: 'B', isCorrect: false, translations: [{ languageCode: 'en', optionText: 'Wrong' }] },
        ],
      },
      adminUserId,
    );
    createdQuestionIds.push(question.id);
    await questionService.approveQuestion(question.id, adminUserId);

    const duplicateMatch = await findDuplicateQuestion(subjectId, {
      questionType: 'MCQ_SINGLE',
      difficulty: 'MEDIUM',
      defaultLanguageCode: 'en',
      translations: [{ languageCode: 'en', questionText: `  ${probeText.toUpperCase()}  ` }],
      options: [],
    });
    expect(duplicateMatch).toBe(question.id);

    const noMatch = await findDuplicateQuestion(subjectId, {
      questionType: 'MCQ_SINGLE',
      difficulty: 'MEDIUM',
      defaultLanguageCode: 'en',
      translations: [{ languageCode: 'en', questionText: 'Completely unrelated question text' }],
      options: [],
    });
    expect(noMatch).toBeNull();
  });
});
