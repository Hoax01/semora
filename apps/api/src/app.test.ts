import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { app } from './app.js';
import { prisma } from './db.js';

describe('GET /api/health', () => {
  it('returns a healthy API response', async () => {
    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok', service: 'api' });
  });
});

describe('GET /api/health/db', () => {
  it.skipIf(!process.env.DATABASE_URL)('returns a healthy database response', async () => {
    const response = await request(app).get('/api/health/db');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok', service: 'database' });
  });
});

describe('email/password authentication', () => {
  const email = `phase0-${Date.now()}@example.test`;
  const password = 'semora-test-password';

  afterAll(async () => {
    await prisma?.user.delete({ where: { email } }).catch(() => undefined);
  });

  it('signs up, returns the current user, and signs out', async () => {
    const signUp = await request(app).post('/api/auth/sign-up/email').send({
      name: 'Phase Zero User',
      email,
      password,
    });

    expect(signUp.status).toBe(200);
    expect(signUp.headers['set-cookie']).toBeDefined();

    const sessionCookie = signUp.headers['set-cookie'];
    const currentUser = await request(app).get('/api/me').set('Cookie', sessionCookie);

    expect(currentUser.status).toBe(200);
    expect(currentUser.body.user).toMatchObject({ email, name: 'Phase Zero User' });

    const catalogue = await request(app)
      .get('/api/catalogue')
      .query({ term: 'Fall 2026', q: 'CS' })
      .set('Cookie', sessionCookie);

    expect(catalogue.status).toBe(200);
    expect(catalogue.body.courses.length).toBeGreaterThan(0);
    const csCourse = catalogue.body.courses.find((course: { courseCode: string }) =>
      course.courseCode.startsWith('CS'),
    );
    expect(csCourse).toMatchObject({
      courseCode: expect.stringMatching(/^CS/),
      credits: 3,
    });
    expect(csCourse.sections[0].meetings.length).toBeGreaterThan(0);

    const courseDetails = await request(app)
      .get(`/api/catalogue/${csCourse.id}`)
      .set('Cookie', sessionCookie);

    expect(courseDetails.status).toBe(200);
    expect(courseDetails.body.course.courseCode).toMatch(/^CS/);

    const signOut = await request(app).post('/api/auth/sign-out').set('Cookie', sessionCookie);

    expect(signOut.status).toBe(200);

    const signedOutUser = await request(app).get('/api/me').set('Cookie', sessionCookie);

    expect(signedOutUser.status).toBe(401);
  });
});
