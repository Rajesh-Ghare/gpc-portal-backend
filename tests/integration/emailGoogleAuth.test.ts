import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app';
import { AppError } from '../../src/errors/AppError';
import { ErrorCode } from '../../src/errors/errorCodes';
import { AuditLog, OtpRequest, User, sequelize } from '../../src/models';
import { mockEmailProvider } from '../../src/strategies/email/MockEmailProvider';
import { getGoogleTokenVerifier, type GoogleIdentity } from '../../src/strategies/google/GoogleTokenVerifier';
import { grantRoleByEmail } from '../../src/services/roleAssignmentService';

const app = createApp();
const googleVerifier = getGoogleTokenVerifier();

// Reserved test-only domain (RFC 2606) — never a real inbox.
const EMAIL_STUDENT = 'email-student@gpc-test.example';
const EMAIL_MIXED_CASE = 'Mixed.Case@GPC-Test.Example';
const EMAIL_LINK = 'link-me@gpc-test.example';
const EMAIL_GOOGLE_NEW = 'google-new@gpc-test.example';
const EMAIL_UNVERIFIED = 'google-unverified@gpc-test.example';
const EMAIL_ADMIN = 'new-admin@gpc-test.example';
const EMAIL_PROFILE = 'profile@gpc-test.example';
const ALL_EMAILS = [
  EMAIL_STUDENT,
  EMAIL_MIXED_CASE.toLowerCase(),
  EMAIL_LINK,
  EMAIL_GOOGLE_NEW,
  EMAIL_UNVERIFIED,
  EMAIL_ADMIN,
  EMAIL_PROFILE,
];

async function emailLogin(email: string) {
  await request(app).post('/api/v1/auth/email/request-otp').send({ email }).expect(200);
  const otp = mockEmailProvider.getLastSentOtp(email.toLowerCase());
  if (!otp) throw new Error(`No OTP email captured for ${email}`);
  const res = await request(app).post('/api/v1/auth/email/verify-otp').send({ email, otp }).expect(200);
  return res.body.data as { token: string; user: { id: string; email: string; mobileNumber: string | null } };
}

function stubGoogle(identity: Partial<GoogleIdentity>) {
  vi.spyOn(googleVerifier, 'verify').mockResolvedValue({
    sub: 'google-sub-default',
    email: EMAIL_GOOGLE_NEW,
    emailVerified: true,
    name: 'Google User',
    ...identity,
  });
}

const googleSignIn = () => request(app).post('/api/v1/auth/google').send({ credential: 'stub-id-token' });

async function cleanup() {
  const users = await User.findAll({ where: { email: ALL_EMAILS }, paranoid: false });
  await AuditLog.destroy({ where: { entityId: users.map((u) => u.id) } });
  await OtpRequest.destroy({ where: { email: ALL_EMAILS } });
  await User.destroy({ where: { email: ALL_EMAILS }, force: true });
}

describe('Email OTP + Google sign-in (ADR-040)', () => {
  beforeAll(async () => {
    await sequelize.authenticate();
    await cleanup();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await cleanup();
    await sequelize.close();
  });

  it('GET /auth/methods lists the enabled methods and the public Google client id', async () => {
    const res = await request(app).get('/api/v1/auth/methods').expect(200);
    expect(res.body.data).toEqual({
      methods: ['mobile_otp', 'email_otp', 'google'],
      googleClientId: 'test-client-id.apps.googleusercontent.com',
    });
  });

  it('signs up a new student by email OTP — no mobile number needed', async () => {
    const { token, user } = await emailLogin(EMAIL_STUDENT);
    expect(user.email).toBe(EMAIL_STUDENT);
    expect(user.mobileNumber).toBeNull();

    const me = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`).expect(200);
    expect(me.body.data.roles).toEqual(['STUDENT']);
    expect((await User.findByPk(user.id))!.isEmailVerified).toBe(true);

    // The email actually contains the code and says what it's for.
    const message = mockEmailProvider.getLastMessage(EMAIL_STUDENT)!;
    expect(message.subject).toMatch(/sign-in code/);
  });

  it('treats email addresses case-insensitively (one account per address)', async () => {
    const first = await emailLogin(EMAIL_MIXED_CASE);
    const second = await emailLogin(EMAIL_MIXED_CASE.toLowerCase());
    expect(first.user.email).toBe(EMAIL_MIXED_CASE.toLowerCase());
    expect(second.user.id).toBe(first.user.id);
  });

  it('rejects a wrong email code', async () => {
    await request(app).post('/api/v1/auth/email/request-otp').send({ email: EMAIL_STUDENT }).expect(200);
    const otp = mockEmailProvider.getLastSentOtp(EMAIL_STUDENT)!;
    const res = await request(app)
      .post('/api/v1/auth/email/verify-otp')
      .send({ email: EMAIL_STUDENT, otp: otp === '111111' ? '222222' : '111111' });
    expect(res.status).toBe(400);
    expect(res.body.errorCode).toBe('AUTH_OTP_INVALID');
  });

  it('rejects a malformed email before sending anything', async () => {
    const res = await request(app).post('/api/v1/auth/email/request-otp').send({ email: 'not-an-email' });
    expect(res.status).toBe(422);
    expect(res.body.errorCode).toBe('VALIDATION_ERROR');
  });

  it('Google: creates a new student account with the Google name', async () => {
    stubGoogle({ sub: 'google-sub-new', email: EMAIL_GOOGLE_NEW, name: 'Asha Patil' });
    const res = await googleSignIn().expect(200);
    expect(res.body.data.user).toMatchObject({ email: EMAIL_GOOGLE_NEW, fullName: 'Asha Patil', mobileNumber: null });

    const user = await User.findByPk(res.body.data.user.id);
    expect(user!.googleSub).toBe('google-sub-new');
    expect(user!.isEmailVerified).toBe(true);
  });

  it('Google: links to an existing email-OTP account instead of creating a duplicate', async () => {
    const { user: emailUser } = await emailLogin(EMAIL_LINK);
    stubGoogle({ sub: 'google-sub-link', email: EMAIL_LINK });

    const res = await googleSignIn().expect(200);
    expect(res.body.data.user.id).toBe(emailUser.id);
    expect((await User.findByPk(emailUser.id))!.googleSub).toBe('google-sub-link');

    // Later sign-ins resolve by Google account id, even if the Google email changed.
    stubGoogle({ sub: 'google-sub-link', email: 'renamed@gpc-test.example' });
    expect((await googleSignIn().expect(200)).body.data.user.id).toBe(emailUser.id);
  });

  it('Google: refuses an account whose email Google has not verified (prevents account takeover)', async () => {
    stubGoogle({ sub: 'google-sub-unverified', email: EMAIL_UNVERIFIED, emailVerified: false });
    const res = await googleSignIn();
    expect(res.status).toBe(401);
    expect(res.body.errorCode).toBe('AUTH_GOOGLE_INVALID');
    expect(await User.count({ where: { email: EMAIL_UNVERIFIED } })).toBe(0);
  });

  it('Google: an invalid token is rejected', async () => {
    vi.spyOn(googleVerifier, 'verify').mockRejectedValue(
      new AppError(ErrorCode.AUTH_GOOGLE_INVALID, 'Google sign-in could not be verified. Please try again.', 401),
    );
    const res = await googleSignIn();
    expect(res.status).toBe(401);
    expect(res.body.errorCode).toBe('AUTH_GOOGLE_INVALID');
  });

  it('grantRoleByEmail: the address gets full admin permissions once its owner signs in', async () => {
    const result = await grantRoleByEmail(EMAIL_ADMIN.toUpperCase(), 'SUPER_ADMIN');
    expect(result).toMatchObject({ email: EMAIL_ADMIN, userCreated: true, roleAdded: true });
    expect((await grantRoleByEmail(EMAIL_ADMIN, 'SUPER_ADMIN')).roleAdded).toBe(false); // idempotent

    const { token, user } = await emailLogin(EMAIL_ADMIN);
    expect(user.id).toBe(result.userId);
    const me = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`).expect(200);
    expect(me.body.data.roles).toContain('SUPER_ADMIN');
    expect(me.body.data.permissions).toEqual(expect.arrayContaining(['question.approve', 'test.publish', 'payment.view']));

    await expect(grantRoleByEmail(EMAIL_ADMIN, 'NO_SUCH_ROLE')).rejects.toThrow(/Unknown role/);
  });

  it('PATCH /auth/me: name and an optional, unverified contact number', async () => {
    const { token, user } = await emailLogin(EMAIL_PROFILE);

    const res = await request(app)
      .patch('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ fullName: 'Ravi Kumar', contactMobileNumber: '9876543210' })
      .expect(200);
    expect(res.body.data).toMatchObject({ fullName: 'Ravi Kumar', contactMobileNumber: '9876543210', mobileNumber: null });

    // Stored as a contact number only — never as the verified login identity.
    expect((await User.findByPk(user.id))!.mobileNumber).toBeNull();

    const invalid = await request(app)
      .patch('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ contactMobileNumber: '12345' });
    expect(invalid.status).toBe(422);

    const cleared = await request(app)
      .patch('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ contactMobileNumber: '' })
      .expect(200);
    expect(cleared.body.data.contactMobileNumber).toBeNull();
  });
});
