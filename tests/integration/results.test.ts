import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import {
  Attempt,
  AuditLog,
  CompetitiveExam,
  Entitlement,
  ExamCategory,
  Product,
  ProductItem,
  Question,
  Result,
  Subject,
  Test as TestModel,
  sequelize,
} from '../../src/models';
import { mockOtpProvider } from '../../src/strategies/otp/MockOtpProvider';

const app = createApp();

const SUPER_ADMIN_MOBILE = '9000000001';
const STUDENT_MOBILES = ['9700000020', '9700000021', '9700000022'];

async function loginAs(mobileNumber: string): Promise<{ token: string; userId: string }> {
  await request(app).post('/api/v1/auth/request-otp').send({ mobileNumber }).expect(200);
  const otp = mockOtpProvider.getLastSentOtp(mobileNumber);
  if (!otp) throw new Error('OTP was not captured by MockOtpProvider');
  const verifyRes = await request(app).post('/api/v1/auth/verify-otp').send({ mobileNumber, otp }).expect(200);
  const token = verifyRes.body.data.token as string;
  const meRes = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`).expect(200);
  return { token, userId: meRes.body.data.id as string };
}

describe('Results (rank/percentile + release workflow)', () => {
  let adminToken: string;
  let students: { token: string; userId: string }[];
  let examId: string;
  let subjectId: string;
  let testId: string;
  let correctOptionId: string;
  let wrongOptionId: string;
  const attemptIds: string[] = [];

  beforeAll(async () => {
    await sequelize.authenticate();
    const admin = await loginAs(SUPER_ADMIN_MOBILE);
    adminToken = admin.token;
    students = await Promise.all(STUDENT_MOBILES.map(loginAs));

    const category = await ExamCategory.create({ name: 'Results Test Category', slug: 'results-test-category' });
    const exam = await CompetitiveExam.create({ categoryId: category.id, name: 'Results Test Exam', slug: 'results-test-exam' });
    examId = exam.id;

    const subjRes = await request(app)
      .post('/api/v1/admin/subjects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Results Test Subject' })
      .expect(201);
    subjectId = subjRes.body.data.id;

    const qRes = await request(app)
      .post('/api/v1/admin/questions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        subjectId,
        marks: 10,
        negativeMarks: 0,
        translations: [{ languageCode: 'en', questionText: 'Ranking fixture question' }],
        options: [
          { optionKey: 'A', isCorrect: true, translations: [{ languageCode: 'en', optionText: 'Right' }] },
          { optionKey: 'B', isCorrect: false, translations: [{ languageCode: 'en', optionText: 'Wrong' }] },
        ],
      })
      .expect(201);
    const questionId = qRes.body.data.question.id as string;
    correctOptionId = qRes.body.data.latestVersion.options[0].id;
    wrongOptionId = qRes.body.data.latestVersion.options[1].id;
    await request(app).post(`/api/v1/admin/questions/${questionId}/approve`).set('Authorization', `Bearer ${adminToken}`).expect(200);

    const testRes = await request(app)
      .post('/api/v1/admin/tests')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ competitiveExamId: examId, title: 'Ranking Integration Test', durationSeconds: 1800, resultVisibility: 'MANUAL' })
      .expect(201);
    testId = testRes.body.data.id;
    await request(app)
      .post(`/api/v1/admin/tests/${testId}/questions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ questionId })
      .expect(201);
    await request(app).post(`/api/v1/admin/tests/${testId}/publish`).set('Authorization', `Bearer ${adminToken}`).expect(200);

    for (const student of students) {
      await request(app)
        .post('/api/v1/admin/entitlements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userId: student.userId, testId })
        .expect((res) => expect([200, 201]).toContain(res.status));
    }

    // Student 0: correct (10 marks). Student 1: wrong (0). Student 2: unanswered (0).
    const outcomes: (string | null)[] = [correctOptionId, wrongOptionId, null];
    for (let i = 0; i < students.length; i += 1) {
      const student = students[i]!;
      const attemptRes = await request(app)
        .post(`/api/v1/tests/${testId}/attempts`)
        .set('Authorization', `Bearer ${student.token}`)
        .expect(201);
      const attemptId = attemptRes.body.data.id as string;
      attemptIds.push(attemptId);
      const attemptQuestionId = attemptRes.body.data.questions[0].id as string;
      const selectedOptionId = outcomes[i];
      if (selectedOptionId) {
        await request(app)
          .put(`/api/v1/attempts/${attemptId}/questions/${attemptQuestionId}/answer`)
          .set('Authorization', `Bearer ${student.token}`)
          .send({ selectedOptionId })
          .expect(200);
      }
      await request(app).post(`/api/v1/attempts/${attemptId}/submit`).set('Authorization', `Bearer ${student.token}`).expect(200);
    }
  });

  afterAll(async () => {
    await AuditLog.destroy({ where: { entityId: testId } });
    await AuditLog.destroy({ where: { entityType: 'entitlement' } });
    await Result.destroy({ where: { testId } });
    await Attempt.destroy({ where: { testId }, force: true });
    const productItems = await ProductItem.findAll({ where: { testId } });
    await Entitlement.destroy({ where: { productItemId: productItems.map((pi) => pi.id) } });
    await ProductItem.destroy({ where: { testId } });
    await Product.destroy({ where: { id: productItems.map((pi) => pi.productId) } });
    await TestModel.destroy({ where: { id: testId }, force: true });
    await Question.destroy({ where: { subjectId }, force: true });
    await Subject.destroy({ where: { id: subjectId }, force: true });
    await CompetitiveExam.destroy({ where: { id: examId }, force: true });
    await ExamCategory.destroy({ where: { slug: 'results-test-category' }, force: true });
    await sequelize.close();
  });

  it('blocks result access before release for a non-IMMEDIATE-visibility test', async () => {
    const res = await request(app)
      .get(`/api/v1/attempts/${attemptIds[0]}/result`)
      .set('Authorization', `Bearer ${students[0]!.token}`);
    expect(res.status).toBe(403);
    expect(res.body.errorCode).toBe('RESULT_NOT_RELEASED');
  });

  it('rejects a student trying to release results', async () => {
    const res = await request(app)
      .post(`/api/v1/admin/tests/${testId}/results/release`)
      .set('Authorization', `Bearer ${students[0]!.token}`);
    expect(res.status).toBe(403);
    expect(res.body.errorCode).toBe('FORBIDDEN');
  });

  it('releases results, computes correct rank/percentile with ties, and is idempotent on releasedAt', async () => {
    const releaseRes = await request(app)
      .post(`/api/v1/admin/tests/${testId}/results/release`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(releaseRes.body.data).toEqual({ totalResults: 3, releasedCount: 3, alreadyReleasedCount: 0 });

    const listRes = await request(app)
      .get(`/api/v1/admin/tests/${testId}/results`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const byUser = new Map(listRes.body.data.map((r: { userId: string }) => [r.userId, r]));

    const top = byUser.get(students[0]!.userId) as { rank: number; percentile: string };
    const midTie1 = byUser.get(students[1]!.userId) as { rank: number; percentile: string };
    const midTie2 = byUser.get(students[2]!.userId) as { rank: number; percentile: string };

    expect(top.rank).toBe(1);
    expect(Number(top.percentile)).toBeCloseTo(66.67, 1);
    expect(midTie1.rank).toBe(2);
    expect(midTie2.rank).toBe(2);
    expect(Number(midTie1.percentile)).toBe(0);
    expect(Number(midTie2.percentile)).toBe(0);

    // Re-releasing must not change releasedAt for already-released results.
    const secondRelease = await request(app)
      .post(`/api/v1/admin/tests/${testId}/results/release`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(secondRelease.body.data).toEqual({ totalResults: 3, releasedCount: 0, alreadyReleasedCount: 3 });

    const auditLog = await AuditLog.findOne({ where: { action: 'result.release', entityId: testId } });
    expect(auditLog).not.toBeNull();
  });

  it('now allows the student to view their released result', async () => {
    const res = await request(app)
      .get(`/api/v1/attempts/${attemptIds[0]}/result`)
      .set('Authorization', `Bearer ${students[0]!.token}`)
      .expect(200);
    expect(res.body.data.scoredMarks).toBe('10.00');
  });

  it("admin attempt view exposes correctness data (unlike the student's own view)", async () => {
    const res = await request(app)
      .get(`/api/v1/admin/attempts/${attemptIds[0]}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const raw = JSON.stringify(res.body.data);
    expect(raw).toContain('isCorrect');
  });

  it('rejects a student from the admin attempt/result endpoints', async () => {
    const res = await request(app)
      .get(`/api/v1/admin/attempts/${attemptIds[0]}`)
      .set('Authorization', `Bearer ${students[0]!.token}`);
    expect(res.status).toBe(403);
    expect(res.body.errorCode).toBe('FORBIDDEN');
  });
});
