import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { AuditLog, CompetitiveExam, ExamCategory, Question, Subject, Test as TestModel, sequelize } from '../../src/models';
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

describe('Test builder admin', () => {
  let adminToken: string;
  let studentToken: string;
  let examId: string;
  let subjectId: string;
  let approvedQuestionId: string;

  beforeAll(async () => {
    await sequelize.authenticate();
    adminToken = await loginAs(SUPER_ADMIN_MOBILE);
    studentToken = await loginAs(STUDENT_MOBILE);

    const category = await ExamCategory.create({ name: 'TB Test Category', slug: 'tb-test-category' });
    const exam = await CompetitiveExam.create({
      categoryId: category.id,
      name: 'TB Test Exam',
      slug: 'tb-test-exam',
    });
    examId = exam.id;

    const subjRes = await request(app)
      .post('/api/v1/admin/subjects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'TB Test Subject' })
      .expect(201);
    subjectId = subjRes.body.data.id;

    const qRes = await request(app)
      .post('/api/v1/admin/questions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        subjectId,
        translations: [{ languageCode: 'en', questionText: 'TB fixture question' }],
        options: [
          { optionKey: 'A', isCorrect: true, translations: [{ languageCode: 'en', optionText: 'X' }] },
          { optionKey: 'B', isCorrect: false, translations: [{ languageCode: 'en', optionText: 'Y' }] },
        ],
      })
      .expect(201);
    approvedQuestionId = qRes.body.data.question.id;
    await request(app)
      .post(`/api/v1/admin/questions/${approvedQuestionId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  });

  afterAll(async () => {
    await AuditLog.destroy({ where: { entityType: 'test' } });
    await TestModel.destroy({ where: { competitiveExamId: examId }, force: true });
    await Question.destroy({ where: { id: approvedQuestionId }, force: true });
    await Subject.destroy({ where: { slug: 'tb-test-subject' }, force: true });
    await CompetitiveExam.destroy({ where: { slug: 'tb-test-exam' }, force: true });
    await ExamCategory.destroy({ where: { slug: 'tb-test-category' }, force: true });
    await sequelize.close();
  });

  it('rejects a STUDENT from every test-builder route', async () => {
    const res = await request(app).get('/api/v1/admin/tests').set('Authorization', `Bearer ${studentToken}`);
    expect(res.status).toBe(403);
  });

  it('fails validation and publish on a test with no questions (MANUAL mode)', async () => {
    const createRes = await request(app)
      .post('/api/v1/admin/tests')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ competitiveExamId: examId, title: 'Empty Manual Test', durationSeconds: 1800 })
      .expect(201);
    const testId = createRes.body.data.id;

    const validateRes = await request(app)
      .get(`/api/v1/admin/tests/${testId}/validate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(validateRes.body.data.valid).toBe(false);

    const publishRes = await request(app)
      .post(`/api/v1/admin/tests/${testId}/publish`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(publishRes.status).toBe(422);
    expect(publishRes.body.errorCode).toBe('TEST_VALIDATION_FAILED');
  });

  it('rejects adding an unapproved question to a test', async () => {
    const testRes = await request(app)
      .post('/api/v1/admin/tests')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ competitiveExamId: examId, title: 'Reject Unapproved Test', durationSeconds: 1800 })
      .expect(201);
    const testId = testRes.body.data.id;

    const unapprovedRes = await request(app)
      .post('/api/v1/admin/questions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        subjectId,
        translations: [{ languageCode: 'en', questionText: 'Unapproved fixture' }],
        options: [
          { optionKey: 'A', isCorrect: true, translations: [{ languageCode: 'en', optionText: 'X' }] },
          { optionKey: 'B', isCorrect: false, translations: [{ languageCode: 'en', optionText: 'Y' }] },
        ],
      })
      .expect(201);
    const unapprovedQuestionId = unapprovedRes.body.data.question.id;

    const addRes = await request(app)
      .post(`/api/v1/admin/tests/${testId}/questions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ questionId: unapprovedQuestionId });
    expect(addRes.status).toBe(422);
    expect(addRes.body.errorCode).toBe('QUESTION_NOT_APPROVED');

    await Question.destroy({ where: { id: unapprovedQuestionId }, force: true });
    await TestModel.destroy({ where: { id: testId }, force: true });
  });

  it('publishes a valid MANUAL test end to end, then blocks further edits, then closes and archives', async () => {
    const testRes = await request(app)
      .post('/api/v1/admin/tests')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ competitiveExamId: examId, title: 'Full Flow Test', durationSeconds: 1800 })
      .expect(201);
    const testId = testRes.body.data.id;

    const sectionRes = await request(app)
      .post(`/api/v1/admin/tests/${testId}/sections`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Section A' })
      .expect(201);
    const sectionId = sectionRes.body.data.id;

    await request(app)
      .post(`/api/v1/admin/tests/${testId}/questions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ questionId: approvedQuestionId, sectionId })
      .expect(201);

    const validateRes = await request(app)
      .get(`/api/v1/admin/tests/${testId}/validate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(validateRes.body.data.valid).toBe(true);
    expect(validateRes.body.data.computedTotals.totalQuestions).toBe(1);

    const publishRes = await request(app)
      .post(`/api/v1/admin/tests/${testId}/publish`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(publishRes.body.data.status).toBe('PUBLISHED');
    expect(publishRes.body.data.totalQuestions).toBe(1);

    const blockedRes = await request(app)
      .post(`/api/v1/admin/tests/${testId}/sections`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Should be blocked' });
    expect(blockedRes.status).toBe(409);
    expect(blockedRes.body.errorCode).toBe('TEST_NOT_EDITABLE');

    const closeRes = await request(app)
      .post(`/api/v1/admin/tests/${testId}/close`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(closeRes.body.data.status).toBe('CLOSED');

    const archiveRes = await request(app)
      .post(`/api/v1/admin/tests/${testId}/archive`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(archiveRes.body.data.status).toBe('ARCHIVED');

    const publishLog = await AuditLog.findOne({ where: { action: 'test.publish', entityId: testId } });
    const closeLog = await AuditLog.findOne({ where: { action: 'test.close', entityId: testId } });
    expect(publishLog).not.toBeNull();
    expect(closeLog).not.toBeNull();
  });

  it('validates a RULE_BASED test against the approved-question pool size', async () => {
    const testRes = await request(app)
      .post('/api/v1/admin/tests')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ competitiveExamId: examId, title: 'Rule Based Test', durationSeconds: 1800, selectionMode: 'RULE_BASED' })
      .expect(201);
    const testId = testRes.body.data.id;

    const ruleRes = await request(app)
      .post(`/api/v1/admin/tests/${testId}/rules`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ subjectId, questionCount: 5 })
      .expect(201);
    const ruleId = ruleRes.body.data.id;

    const failRes = await request(app)
      .get(`/api/v1/admin/tests/${testId}/validate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(failRes.body.data.valid).toBe(false);
    expect(failRes.body.data.errors[0]).toMatch(/requires 5 approved questions but only 1/);

    await request(app)
      .put(`/api/v1/admin/tests/${testId}/rules/${ruleId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ questionCount: 1 })
      .expect(200);

    const passRes = await request(app)
      .get(`/api/v1/admin/tests/${testId}/validate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(passRes.body.data.valid).toBe(true);
  });
});
