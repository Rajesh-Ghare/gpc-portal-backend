import request from 'supertest';
import { Op } from 'sequelize';
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
  Subject,
  Test as TestModel,
  sequelize,
} from '../../src/models';
import { mockOtpProvider } from '../../src/strategies/otp/MockOtpProvider';

const app = createApp();

const SUPER_ADMIN_MOBILE = '9000000001';
const STUDENT_A_MOBILE = '9700000010';
const STUDENT_B_MOBILE = '9700000011';

async function loginAs(mobileNumber: string): Promise<string> {
  await request(app).post('/api/v1/auth/request-otp').send({ mobileNumber }).expect(200);
  const otp = mockOtpProvider.getLastSentOtp(mobileNumber);
  if (!otp) throw new Error('OTP was not captured by MockOtpProvider');
  const res = await request(app).post('/api/v1/auth/verify-otp').send({ mobileNumber, otp }).expect(200);
  return res.body.data.token as string;
}

async function createApprovedQuestion(adminToken: string, subjectId: string, correctOptionIndex: 0 | 1 = 1) {
  const res = await request(app)
    .post('/api/v1/admin/questions')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      subjectId,
      marks: 1,
      negativeMarks: 0.25,
      translations: [{ languageCode: 'en', questionText: 'Attempt fixture question' }],
      options: [
        { optionKey: 'A', isCorrect: correctOptionIndex === 0, translations: [{ languageCode: 'en', optionText: 'X' }] },
        { optionKey: 'B', isCorrect: correctOptionIndex === 1, translations: [{ languageCode: 'en', optionText: 'Y' }] },
      ],
    })
    .expect(201);
  const questionId = res.body.data.question.id as string;
  await request(app)
    .post(`/api/v1/admin/questions/${questionId}/approve`)
    .set('Authorization', `Bearer ${adminToken}`)
    .expect(200);
  return { questionId, correctOptionId: res.body.data.latestVersion.options[correctOptionIndex].id as string, wrongOptionId: res.body.data.latestVersion.options[1 - correctOptionIndex].id as string };
}

async function createPublishedManualTest(adminToken: string, examId: string, questionId: string, durationSeconds = 1800) {
  const testRes = await request(app)
    .post('/api/v1/admin/tests')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ competitiveExamId: examId, title: `Attempt Fixture Test ${Date.now()}-${Math.random()}`, durationSeconds })
    .expect(201);
  const testId = testRes.body.data.id as string;
  await request(app)
    .post(`/api/v1/admin/tests/${testId}/questions`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ questionId })
    .expect(201);
  await request(app).post(`/api/v1/admin/tests/${testId}/publish`).set('Authorization', `Bearer ${adminToken}`).expect(200);
  return testId;
}

async function grantEntitlement(adminToken: string, userId: string, testId: string) {
  const res = await request(app)
    .post('/api/v1/admin/entitlements')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ userId, testId });
  return res.body.data;
}

describe('Exam engine (attempts)', () => {
  let adminToken: string;
  let studentAToken: string;
  let studentBToken: string;
  let studentAId: string;
  let studentBId: string;
  let examId: string;
  let subjectId: string;
  // Extra exams created by individual tests (e.g. an EXAM_PACKAGE scope), cleaned up in afterAll.
  const extraExamIds: string[] = [];

  beforeAll(async () => {
    await sequelize.authenticate();
    adminToken = await loginAs(SUPER_ADMIN_MOBILE);
    studentAToken = await loginAs(STUDENT_A_MOBILE);
    studentBToken = await loginAs(STUDENT_B_MOBILE);

    const meRes = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${studentAToken}`).expect(200);
    studentAId = meRes.body.data.id;
    const meB = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${studentBToken}`).expect(200);
    studentBId = meB.body.data.id;

    const category = await ExamCategory.create({ name: 'Attempt Test Category', slug: 'attempt-test-category' });
    const exam = await CompetitiveExam.create({ categoryId: category.id, name: 'Attempt Test Exam', slug: 'attempt-test-exam' });
    examId = exam.id;

    const subjRes = await request(app)
      .post('/api/v1/admin/subjects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Attempt Test Subject' })
      .expect(201);
    subjectId = subjRes.body.data.id;
  });

  afterAll(async () => {
    const allExamIds = [examId, ...extraExamIds];
    const testIds = (await TestModel.findAll({ where: { competitiveExamId: allExamIds } })).map((t) => t.id);
    const productItems = await ProductItem.findAll({
      where: { [Op.or]: [{ testId: testIds }, { competitiveExamId: extraExamIds }] },
    });
    const productIds = productItems.map((pi) => pi.productId);

    await AuditLog.destroy({ where: { entityType: 'entitlement' } });
    await Attempt.destroy({ where: { testId: testIds }, force: true });
    await Entitlement.destroy({ where: { productItemId: productItems.map((pi) => pi.id) } });
    await ProductItem.destroy({ where: { id: productItems.map((pi) => pi.id) } });
    await Product.destroy({ where: { id: productIds } });
    await TestModel.destroy({ where: { competitiveExamId: allExamIds }, force: true });
    await Question.destroy({ where: { subjectId }, force: true });
    await Subject.destroy({ where: { id: subjectId }, force: true });
    await CompetitiveExam.destroy({ where: { id: allExamIds }, force: true });
    await ExamCategory.destroy({ where: { slug: 'attempt-test-category' }, force: true });
    await sequelize.close();
  });

  it('rejects attempt creation without an entitlement', async () => {
    const { questionId } = await createApprovedQuestion(adminToken, subjectId);
    const testId = await createPublishedManualTest(adminToken, examId, questionId);

    const res = await request(app).post(`/api/v1/tests/${testId}/attempts`).set('Authorization', `Bearer ${studentAToken}`);
    expect(res.status).toBe(403);
    expect(res.body.errorCode).toBe('ENTITLEMENT_NOT_FOUND');
  });

  it('grants an entitlement idempotently, then allows the full attempt -> answer -> submit -> result flow', async () => {
    const { questionId, correctOptionId } = await createApprovedQuestion(adminToken, subjectId);
    const testId = await createPublishedManualTest(adminToken, examId, questionId);

    const grant1 = await grantEntitlement(adminToken, studentAId, testId);
    const grant2 = await grantEntitlement(adminToken, studentAId, testId);
    expect(grant1.id).toBe(grant2.id);

    const createRes = await request(app)
      .post(`/api/v1/tests/${testId}/attempts`)
      .set('Authorization', `Bearer ${studentAToken}`)
      .expect(201);
    const attempt = createRes.body.data;
    expect(attempt.status).toBe('IN_PROGRESS');

    // Security: an in-progress attempt response must never leak correctness.
    const raw = JSON.stringify(attempt);
    expect(raw).not.toContain('isCorrect');
    expect(raw).not.toContain('correctOptionId');
    expect(attempt.questions[0].options[0].text).toBeTypeOf('string');
    expect(attempt.questions[0].questionType).toBe('MCQ_SINGLE');

    const attemptQuestionId = attempt.questions[0].id;

    const invalidRes = await request(app)
      .put(`/api/v1/attempts/${attempt.id}/questions/${attemptQuestionId}/answer`)
      .set('Authorization', `Bearer ${studentAToken}`)
      .send({ selectedOptionId: '00000000-0000-0000-0000-000000000000' });
    expect(invalidRes.status).toBe(422);
    expect(invalidRes.body.errorCode).toBe('INVALID_OPTION');

    await request(app)
      .put(`/api/v1/attempts/${attempt.id}/questions/${attemptQuestionId}/answer`)
      .set('Authorization', `Bearer ${studentAToken}`)
      .send({ selectedOptionId: correctOptionId })
      .expect(200);

    // Ownership: student B must not be able to touch student A's attempt.
    const forbiddenGet = await request(app).get(`/api/v1/attempts/${attempt.id}`).set('Authorization', `Bearer ${studentBToken}`);
    expect(forbiddenGet.status).toBe(403);
    const forbiddenSubmit = await request(app)
      .post(`/api/v1/attempts/${attempt.id}/submit`)
      .set('Authorization', `Bearer ${studentBToken}`);
    expect(forbiddenSubmit.status).toBe(403);

    const submitRes = await request(app)
      .post(`/api/v1/attempts/${attempt.id}/submit`)
      .set('Authorization', `Bearer ${studentAToken}`)
      .expect(200);
    expect(submitRes.body.data.correctAnswers).toBe(1);
    expect(submitRes.body.data.scoredMarks).toBe('1.00');

    // Idempotent resubmit.
    const resubmitRes = await request(app)
      .post(`/api/v1/attempts/${attempt.id}/submit`)
      .set('Authorization', `Bearer ${studentAToken}`)
      .expect(200);
    expect(resubmitRes.body.data.id).toBe(submitRes.body.data.id);

    const resultRes = await request(app)
      .get(`/api/v1/attempts/${attempt.id}/result`)
      .set('Authorization', `Bearer ${studentAToken}`)
      .expect(200);
    expect(resultRes.body.data.correctAnswers).toBe(1);
  });

  it('auto-submits an attempt once its timer expires, scoring unanswered questions as 0', async () => {
    const { questionId } = await createApprovedQuestion(adminToken, subjectId);
    const testId = await createPublishedManualTest(adminToken, examId, questionId, 1);
    await grantEntitlement(adminToken, studentAId, testId);

    const createRes = await request(app)
      .post(`/api/v1/tests/${testId}/attempts`)
      .set('Authorization', `Bearer ${studentAToken}`)
      .expect(201);

    await new Promise((resolve) => setTimeout(resolve, 1500));

    const getRes = await request(app)
      .get(`/api/v1/attempts/${createRes.body.data.id}`)
      .set('Authorization', `Bearer ${studentAToken}`)
      .expect(200);
    expect(getRes.body.data.status).toBe('SUBMITTED');

    const dbAttempt = await Attempt.findByPk(createRes.body.data.id);
    expect(dbAttempt?.autoSubmitted).toBe(true);
  });

  it("enforces the test's SINGLE attempt policy", async () => {
    const { questionId } = await createApprovedQuestion(adminToken, subjectId);
    const testRes = await request(app)
      .post('/api/v1/admin/tests')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ competitiveExamId: examId, title: `Single Policy Test ${Date.now()}`, durationSeconds: 1800, attemptPolicy: 'SINGLE' })
      .expect(201);
    const testId = testRes.body.data.id;
    await request(app)
      .post(`/api/v1/admin/tests/${testId}/questions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ questionId })
      .expect(201);
    await request(app).post(`/api/v1/admin/tests/${testId}/publish`).set('Authorization', `Bearer ${adminToken}`).expect(200);
    await grantEntitlement(adminToken, studentAId, testId);

    const first = await request(app).post(`/api/v1/tests/${testId}/attempts`).set('Authorization', `Bearer ${studentAToken}`).expect(201);
    await request(app).post(`/api/v1/attempts/${first.body.data.id}/submit`).set('Authorization', `Bearer ${studentAToken}`).expect(200);

    const second = await request(app).post(`/api/v1/tests/${testId}/attempts`).set('Authorization', `Bearer ${studentAToken}`);
    expect(second.status).toBe(403);
    expect(second.body.errorCode).toBe('ATTEMPT_LIMIT_EXCEEDED');
  });

  it('ignores a client-supplied attemptLimit in the request body — only the entitlement\'s own limit governs', async () => {
    const { questionId } = await createApprovedQuestion(adminToken, subjectId);
    const testId = await createPublishedManualTest(adminToken, examId, questionId);

    const grantRes = await request(app)
      .post('/api/v1/admin/entitlements')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: studentAId, testId, attemptLimit: 1 })
      .expect((res) => expect([200, 201]).toContain(res.status));
    expect(grantRes.body.data.attemptLimit).toBe(1);

    const first = await request(app)
      .post(`/api/v1/tests/${testId}/attempts`)
      .set('Authorization', `Bearer ${studentAToken}`)
      .send({ attemptLimit: 999 })
      .expect(201);
    await request(app).post(`/api/v1/attempts/${first.body.data.id}/submit`).set('Authorization', `Bearer ${studentAToken}`).expect(200);

    // A forged higher attemptLimit in the body must not raise the real, server-tracked limit.
    const second = await request(app)
      .post(`/api/v1/tests/${testId}/attempts`)
      .set('Authorization', `Bearer ${studentAToken}`)
      .send({ attemptLimit: 999 });
    expect(second.status).toBe(403);
    expect(second.body.errorCode).toBe('ATTEMPT_LIMIT_EXCEEDED');
  });

  it('enforces the partial unique index preventing two IN_PROGRESS attempts for the same user/test at the database level', async () => {
    const { questionId } = await createApprovedQuestion(adminToken, subjectId);
    const testId = await createPublishedManualTest(adminToken, examId, questionId);
    const test = await TestModel.findByPk(testId);

    await Attempt.create({
      userId: studentAId,
      testId,
      attemptNumber: 1,
      status: 'IN_PROGRESS',
      startedAt: new Date(),
      expiresAt: new Date(Date.now() + 1000 * test!.durationSeconds),
    });

    let caught: unknown;
    try {
      await Attempt.create({
        userId: studentAId,
        testId,
        attemptNumber: 2,
        status: 'IN_PROGRESS',
        startedAt: new Date(),
        expiresAt: new Date(Date.now() + 1000 * test!.durationSeconds),
      });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeDefined();
    expect((caught as Error).name).toBe('SequelizeUniqueConstraintError');
    // Postgres unique_violation code, confirming this is the real DB
    // constraint rejecting it — not just a Sequelize-side check.
    expect((caught as { parent?: { code?: string } }).parent?.code).toBe('23505');
  });

  function startAttempt(token: string, testId: string) {
    return request(app).post(`/api/v1/tests/${testId}/attempts`).set('Authorization', `Bearer ${token}`);
  }

  it('keeps a student\'s result viewable after the test is closed and archived', async () => {
    const { questionId, correctOptionId } = await createApprovedQuestion(adminToken, subjectId);
    const testId = await createPublishedManualTest(adminToken, examId, questionId);
    await grantEntitlement(adminToken, studentAId, testId);

    const attempt = (await startAttempt(studentAToken, testId).expect(201)).body.data;
    await request(app)
      .put(`/api/v1/attempts/${attempt.id}/questions/${attempt.questions[0].id}/answer`)
      .set('Authorization', `Bearer ${studentAToken}`)
      .send({ selectedOptionId: correctOptionId })
      .expect(200);
    await request(app).post(`/api/v1/attempts/${attempt.id}/submit`).set('Authorization', `Bearer ${studentAToken}`).expect(200);

    await request(app).post(`/api/v1/admin/tests/${testId}/close`).set('Authorization', `Bearer ${adminToken}`).expect(200);
    const closedRes = await request(app)
      .get(`/api/v1/attempts/${attempt.id}/result`)
      .set('Authorization', `Bearer ${studentAToken}`);
    expect(closedRes.status).toBe(200);
    expect(closedRes.body.data.correctAnswers).toBe(1);

    await request(app).post(`/api/v1/admin/tests/${testId}/archive`).set('Authorization', `Bearer ${adminToken}`).expect(200);
    await request(app).get(`/api/v1/attempts/${attempt.id}/result`).set('Authorization', `Bearer ${studentAToken}`).expect(200);

    // Starting a new attempt still requires a published test.
    expect((await startAttempt(studentAToken, testId)).body.errorCode).toBe('TEST_NOT_FOUND');
  });

  it('starts a fresh attempt when Start is pressed after the previous attempt\'s time ran out', async () => {
    const { questionId } = await createApprovedQuestion(adminToken, subjectId);
    const testRes = await request(app)
      .post('/api/v1/admin/tests')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ competitiveExamId: examId, title: `Multi Attempt Test ${Date.now()}`, durationSeconds: 1, attemptPolicy: 'MULTIPLE' })
      .expect(201);
    const testId = testRes.body.data.id as string;
    await request(app)
      .post(`/api/v1/admin/tests/${testId}/questions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ questionId })
      .expect(201);
    await request(app).post(`/api/v1/admin/tests/${testId}/publish`).set('Authorization', `Bearer ${adminToken}`).expect(200);
    await grantEntitlement(adminToken, studentAId, testId);

    const first = (await startAttempt(studentAToken, testId).expect(201)).body.data;
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const second = (await startAttempt(studentAToken, testId).expect(201)).body.data;
    expect(second.id).not.toBe(first.id);
    expect(second.status).toBe('IN_PROGRESS');
    expect(second.attemptNumber).toBe(2);

    const firstAfter = await Attempt.findByPk(first.id);
    expect(firstAfter!.status).toBe('SUBMITTED');
    expect(firstAfter!.autoSubmitted).toBe(true);
  });

  it('returns one attempt for concurrent starts of the same test (double-click) and consumes one attempt', async () => {
    const { questionId } = await createApprovedQuestion(adminToken, subjectId);
    const testId = await createPublishedManualTest(adminToken, examId, questionId);
    const grant = await request(app)
      .post('/api/v1/admin/entitlements')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: studentAId, testId, attemptLimit: 3 })
      .expect(201);

    const responses = await Promise.all([1, 2, 3].map(() => startAttempt(studentAToken, testId)));
    expect(responses.map((r) => r.status)).toEqual([201, 201, 201]);
    expect(new Set(responses.map((r) => r.body.data.id)).size).toBe(1);

    expect(await Attempt.count({ where: { userId: studentAId, testId } })).toBe(1);
    expect((await Entitlement.findByPk(grant.body.data.id))!.attemptsUsed).toBe(1);
  });

  describe('a package entitlement shared across tests', () => {
    let packageEntitlementId: string;
    const packageTestIds: string[] = [];

    beforeAll(async () => {
      const exam = await CompetitiveExam.create({
        categoryId: (await CompetitiveExam.findByPk(examId))!.categoryId,
        name: 'Attempt Package Exam',
        slug: `attempt-package-exam-${Date.now()}`,
      });
      extraExamIds.push(exam.id);

      const { questionId } = await createApprovedQuestion(adminToken, subjectId);
      for (let i = 0; i < 3; i += 1) {
        packageTestIds.push(await createPublishedManualTest(adminToken, exam.id, questionId));
      }

      const product = await Product.create({
        name: 'Attempt Package',
        slug: `attempt-package-${Date.now()}`,
        productType: 'EXAM_PACKAGE',
        status: 'ACTIVE',
        createdBy: studentAId,
      });
      const item = await ProductItem.create({
        productId: product.id,
        accessType: 'EXAM_PACKAGE',
        competitiveExamId: exam.id,
      });
      const grant = await request(app)
        .post('/api/v1/admin/entitlements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userId: studentBId, productItemId: item.id, attemptLimit: 2 })
        .expect(201);
      packageEntitlementId = grant.body.data.id;
    });

    it('never grants more attempts than the limit when tests are started concurrently', async () => {
      const responses = await Promise.all(packageTestIds.map((testId) => startAttempt(studentBToken, testId)));

      const statuses = responses.map((r) => r.status).sort();
      expect(statuses).toEqual([201, 201, 403]);
      expect(responses.find((r) => r.status === 403)!.body.errorCode).toBe('ATTEMPT_LIMIT_EXCEEDED');

      expect(await Attempt.count({ where: { userId: studentBId, testId: packageTestIds } })).toBe(2);
      expect((await Entitlement.findByPk(packageEntitlementId))!.attemptsUsed).toBe(2);
    });

    it('consumes another entitlement with attempts left instead of rejecting on the exhausted package', async () => {
      // The package is now 2/2. Grant a fresh single-test pass for a test it didn't cover yet.
      const statuses = await Promise.all(
        packageTestIds.map(async (testId) => ({ testId, count: await Attempt.count({ where: { userId: studentBId, testId } }) })),
      );
      const unstartedTestId = statuses.find((s) => s.count === 0)!.testId;
      const individual = await request(app)
        .post('/api/v1/admin/entitlements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userId: studentBId, testId: unstartedTestId, attemptLimit: 1 })
        .expect(201);

      await startAttempt(studentBToken, unstartedTestId).expect(201);

      expect((await Entitlement.findByPk(individual.body.data.id))!.attemptsUsed).toBe(1);
      expect((await Entitlement.findByPk(packageEntitlementId))!.attemptsUsed).toBe(2);
    });
  });
});
