import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { AuditLog, Question, Subject, Tag, sequelize } from '../../src/models';
import { mockOtpProvider } from '../../src/strategies/otp/MockOtpProvider';

const app = createApp();

const SUPER_ADMIN_MOBILE = '9000000001';
const STUDENT_MOBILE = '9000000003';

async function loginAs(mobileNumber: string): Promise<string> {
  await request(app).post('/api/v1/auth/request-otp').send({ mobileNumber }).expect(200);
  const otp = mockOtpProvider.getLastSentOtp(mobileNumber);
  if (!otp) throw new Error('OTP was not captured by MockOtpProvider');
  const res = await request(app).post('/api/v1/auth/verify-otp').send({ mobileNumber, otp }).expect(200);
  return res.body.data.token as string;
}

describe('Question bank admin CRUD', () => {
  let adminToken: string;
  let studentToken: string;
  let subjectId: string;
  let questionId: string;

  beforeAll(async () => {
    await sequelize.authenticate();
    adminToken = await loginAs(SUPER_ADMIN_MOBILE);
    studentToken = await loginAs(STUDENT_MOBILE);

    const res = await request(app)
      .post('/api/v1/admin/subjects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'QB Test Subject' })
      .expect(201);
    subjectId = res.body.data.id;
  });

  afterAll(async () => {
    if (questionId) {
      await AuditLog.destroy({ where: { entityId: questionId } });
      await Question.destroy({ where: { id: questionId }, force: true });
    }
    await Tag.destroy({ where: { slug: ['qb-test-tag'] }, force: true });
    await Subject.destroy({ where: { slug: 'qb-test-subject' }, force: true });
    await sequelize.close();
  });

  it('rejects a STUDENT from every question-bank route', async () => {
    const res = await request(app).get('/api/v1/admin/questions').set('Authorization', `Bearer ${studentToken}`);
    expect(res.status).toBe(403);
    expect(res.body.errorCode).toBe('FORBIDDEN');
  });

  it('rejects an MCQ_SINGLE question with zero correct options', async () => {
    const res = await request(app)
      .post('/api/v1/admin/questions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        subjectId,
        translations: [{ languageCode: 'en', questionText: 'Bad question' }],
        options: [
          { optionKey: 'A', isCorrect: false, translations: [{ languageCode: 'en', optionText: 'X' }] },
          { optionKey: 'B', isCorrect: false, translations: [{ languageCode: 'en', optionText: 'Y' }] },
        ],
      });
    expect(res.status).toBe(422);
    expect(res.body.errorCode).toBe('QUESTION_VERSION_INVALID');
  });

  it('creates a full MCQ_SINGLE question with version, translations, options, and tags in one transaction', async () => {
    const res = await request(app)
      .post('/api/v1/admin/questions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        subjectId,
        marks: 1,
        negativeMarks: 0.25,
        tags: ['qb-test-tag'],
        translations: [{ languageCode: 'en', questionText: 'What is 2 + 2?' }],
        options: [
          { optionKey: 'A', isCorrect: false, translations: [{ languageCode: 'en', optionText: '3' }] },
          { optionKey: 'B', isCorrect: true, translations: [{ languageCode: 'en', optionText: '4' }] },
        ],
      })
      .expect(201);

    questionId = res.body.data.question.id;
    expect(res.body.data.question.status).toBe('DRAFT');
    expect(res.body.data.question.reviewStatus).toBe('PENDING');
    expect(res.body.data.question.tags).toHaveLength(1);
    expect(res.body.data.latestVersion.versionNumber).toBe(1);
    expect(res.body.data.latestVersion.options).toHaveLength(2);
  });

  it('rejects creating an exam under a nonexistent subject', async () => {
    const res = await request(app)
      .post('/api/v1/admin/questions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        subjectId: '00000000-0000-0000-0000-000000000000',
        translations: [{ languageCode: 'en', questionText: 'Orphan question' }],
        options: [
          { optionKey: 'A', isCorrect: true, translations: [{ languageCode: 'en', optionText: 'X' }] },
          { optionKey: 'B', isCorrect: false, translations: [{ languageCode: 'en', optionText: 'Y' }] },
        ],
      });
    expect(res.status).toBe(404);
    expect(res.body.errorCode).toBe('SUBJECT_NOT_FOUND');
  });

  it('creates a new question version and bumps the version number', async () => {
    const res = await request(app)
      .post(`/api/v1/admin/questions/${questionId}/versions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        marks: 2,
        translations: [{ languageCode: 'en', questionText: 'What is 2 + 2? (revised)' }],
        options: [
          { optionKey: 'A', isCorrect: false, translations: [{ languageCode: 'en', optionText: '3' }] },
          { optionKey: 'B', isCorrect: true, translations: [{ languageCode: 'en', optionText: '4' }] },
        ],
      })
      .expect(201);

    expect(res.body.data.latestVersion.versionNumber).toBe(2);
    expect(res.body.data.question.version).toBe(2);
  });

  it('approves a question, moving it to PUBLISHED/APPROVED, and writes an audit log', async () => {
    const res = await request(app)
      .post(`/api/v1/admin/questions/${questionId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.data.status).toBe('PUBLISHED');
    expect(res.body.data.reviewStatus).toBe('APPROVED');

    const log = await AuditLog.findOne({ where: { action: 'question.approve', entityId: questionId } });
    expect(log).not.toBeNull();
  });

  it('rejects a STUDENT trying to approve a question', async () => {
    const res = await request(app)
      .post(`/api/v1/admin/questions/${questionId}/approve`)
      .set('Authorization', `Bearer ${studentToken}`);
    expect(res.status).toBe(403);
  });
});
