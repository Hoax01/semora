import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { app } from './app.js';
import { prisma } from './db.js';

describe('Phase 6 assessment management', () => {
  const ownerEmail = `assessment-owner-${Date.now()}@example.test`;
  const intruderEmail = `assessment-intruder-${Date.now()}@example.test`;
  const password = 'semora-test-password';

  afterAll(async () => {
    await prisma?.user
      .deleteMany({ where: { email: { in: [ownerEmail, intruderEmail] } } })
      .catch(() => undefined);
  });

  it('supports owned manual assessment CRUD and separate work progress', async () => {
    if (!prisma) return;

    const signUp = await request(app).post('/api/auth/sign-up/email').send({
      name: 'Assessment Owner',
      email: ownerEmail,
      password,
    });
    expect(signUp.status).toBe(200);
    const ownerCookie = signUp.headers['set-cookie'];
    const ownerId = signUp.body.user.id as string;

    const term = await prisma.academicTerm.findFirst({ where: { name: 'Fall 2026' } });
    expect(term).toBeTruthy();
    if (!term) return;
    const section = await prisma.section.findFirst({
      where: { courseOffering: { academicTermId: term.id } },
    });
    expect(section).toBeTruthy();
    if (!section) return;

    const workspace = await prisma.semesterWorkspace.create({
      data: { userId: ownerId, academicTermId: term.id, state: 'ACTIVE' },
    });
    const selection = await prisma.activeCourseSelection.create({
      data: { workspaceId: workspace.id, sectionId: section.id, status: 'ACTIVE' },
    });
    const activeState = await prisma.activeCourseState.create({
      data: { activeCourseSelectionId: selection.id },
    });

    const empty = await request(app)
      .get(`/api/workspaces/${workspace.id}/assessments`)
      .set('Cookie', ownerCookie);
    expect(empty.status).toBe(200);
    expect(empty.body.assessments).toEqual([]);

    const created = await request(app)
      .post(`/api/active-selections/${selection.id}/assessments`)
      .set('Cookie', ownerCookie)
      .send({
        title: 'Database assignment',
        assessmentType: 'ASSIGNMENT',
        weightPercentage: 8,
        dueDate: '2026-09-18',
      });
    expect(created.status).toBe(201);
    expect(created.body.assessment).toMatchObject({
      title: 'Database assignment',
      assessmentType: 'ASSIGNMENT',
      dueDate: '2026-09-18',
      datePrecision: 'EXACT',
      status: 'UPCOMING',
      workStatus: 'NOT_STARTED',
      progressPercentage: null,
      estimatedEffortHours: 6,
      effortSource: 'GENERIC_DEFAULT',
      personalEffortHours: null,
      sourceType: 'USER_ENTERED',
    });

    const assessmentId = created.body.assessment.id as string;
    const initialWorkload = await request(app)
      .get(`/api/workspaces/${workspace.id}/workload?asOf=2026-09-01T09:00:00.000Z`)
      .set('Cookie', ownerCookie);
    expect(initialWorkload.status).toBe(200);
    expect(initialWorkload.body.workload.assessments).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: assessmentId, dueAt: '2026-09-18' })]),
    );
    const movedDeadline = await request(app)
      .patch(`/api/assessments/${assessmentId}`)
      .set('Cookie', ownerCookie)
      .send({ dueDate: '2026-09-25' });
    expect(movedDeadline.status).toBe(200);
    expect(movedDeadline.body.assessment).toMatchObject({
      dueDate: '2026-09-25',
      datePrecision: 'EXACT',
    });
    const updatedWorkload = await request(app)
      .get(`/api/workspaces/${workspace.id}/workload?asOf=2026-09-01T09:00:00.000Z`)
      .set('Cookie', ownerCookie);
    expect(updatedWorkload.status).toBe(200);
    expect(updatedWorkload.body.workload.assessments).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: assessmentId, dueAt: '2026-09-25' })]),
    );
    expect(updatedWorkload.body.workload.weeklyPressure).not.toEqual(
      initialWorkload.body.workload.weeklyPressure,
    );

    const personalEstimate = await request(app)
      .patch(`/api/assessments/${assessmentId}`)
      .set('Cookie', ownerCookie)
      .send({ personalEffortHours: 9 });
    expect(personalEstimate.status).toBe(200);
    expect(personalEstimate.body.assessment).toMatchObject({
      estimatedEffortHours: 9,
      personalEffortHours: 9,
      effortSource: 'PERSONAL_ESTIMATE',
      effortConfidence: 0.8,
    });

    const resetEstimate = await request(app)
      .patch(`/api/assessments/${assessmentId}`)
      .set('Cookie', ownerCookie)
      .send({ personalEffortHours: null });
    expect(resetEstimate.status).toBe(200);
    expect(resetEstimate.body.assessment).toMatchObject({
      estimatedEffortHours: 6,
      personalEffortHours: null,
      effortSource: 'GENERIC_DEFAULT',
    });

    const outlineAssessment = await prisma.assessment.create({
      data: {
        activeCourseStateId: activeState.id,
        title: 'Outline project milestone',
        assessmentType: 'OTHER',
        datePrecision: 'UNKNOWN',
        status: 'UPCOMING',
        estimatedEffortHours: 11,
        effortConfidence: 0.7,
        sourceType: 'VERIFIED_OUTLINE',
      },
    });
    const listed = await request(app)
      .get(`/api/workspaces/${workspace.id}/assessments`)
      .set('Cookie', ownerCookie);
    expect(listed.status).toBe(200);
    expect(listed.body.assessments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: outlineAssessment.id,
          estimatedEffortHours: 11,
          effortSource: 'OUTLINE_ESTIMATE',
          personalEffortHours: null,
        }),
      ]),
    );

    const unknown = await request(app)
      .post(`/api/active-selections/${selection.id}/assessments`)
      .set('Cookie', ownerCookie)
      .send({ title: 'Unscoped task', assessmentType: 'OTHER' });
    expect(unknown.status).toBe(201);
    expect(unknown.body.assessment).toMatchObject({
      estimatedEffortHours: null,
      effortSource: 'UNKNOWN',
      personalEffortHours: null,
    });

    const progress = await request(app)
      .patch(`/api/assessments/${assessmentId}`)
      .set('Cookie', ownerCookie)
      .send({ progressPercentage: 40 });
    expect(progress.status).toBe(200);
    expect(progress.body.assessment).toMatchObject({
      workStatus: 'IN_PROGRESS',
      progressPercentage: 40,
    });

    const done = await request(app)
      .patch(`/api/assessments/${assessmentId}`)
      .set('Cookie', ownerCookie)
      .send({ workStatus: 'DONE' });
    expect(done.status).toBe(200);
    expect(done.body.assessment).toMatchObject({
      workStatus: 'DONE',
      progressPercentage: 100,
    });

    const cancelled = await request(app)
      .delete(`/api/assessments/${assessmentId}`)
      .set('Cookie', ownerCookie);
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.assessment.status).toBe('CANCELLED');

    const intruderSignUp = await request(app).post('/api/auth/sign-up/email').send({
      name: 'Assessment Intruder',
      email: intruderEmail,
      password,
    });
    expect(intruderSignUp.status).toBe(200);
    const intruder = await request(app)
      .get(`/api/workspaces/${workspace.id}/assessments`)
      .set('Cookie', intruderSignUp.headers['set-cookie']);
    expect(intruder.status).toBe(404);
  });
});
