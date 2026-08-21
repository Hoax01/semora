import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { app } from './app.js';
import { prisma } from './db.js';

describe('Phase 6 workload calculations', () => {
  const ownerEmail = `workload-owner-${Date.now()}@example.test`;
  const intruderEmail = `workload-intruder-${Date.now()}@example.test`;
  const password = 'semora-test-password';

  afterAll(async () => {
    await prisma?.user
      .deleteMany({ where: { email: { in: [ownerEmail, intruderEmail] } } })
      .catch(() => undefined);
  });

  it('calculates owned active-semester effort, overlap, and commitment pressure', async () => {
    if (!prisma) return;

    const signUp = await request(app).post('/api/auth/sign-up/email').send({
      name: 'Workload Owner',
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

    await prisma.assessment.createMany({
      data: [
        {
          activeCourseStateId: activeState.id,
          title: 'Assignment 1',
          assessmentType: 'ASSIGNMENT',
          weightPercentage: 12,
          dueAt: new Date('2026-09-07T00:00:00.000Z'),
          datePrecision: 'EXACT',
          status: 'UPCOMING',
          workStatus: 'IN_PROGRESS',
          progressPercentage: 25,
          estimatedEffortHours: 10,
          effortConfidence: 0.7,
          personalEffortHours: 8,
          personalEffortConfidence: 0.8,
          sourceType: 'USER_ENTERED',
        },
        {
          activeCourseStateId: activeState.id,
          title: 'Midterm',
          assessmentType: 'MIDTERM',
          weightPercentage: 30,
          dueAt: new Date('2026-09-08T00:00:00.000Z'),
          datePrecision: 'EXACT',
          status: 'UPCOMING',
          workStatus: 'NOT_STARTED',
          estimatedEffortHours: 10,
          effortConfidence: 0.6,
          sourceType: 'VERIFIED_OUTLINE',
        },
      ],
    });
    await prisma.commitment.create({
      data: {
        workspaceId: workspace.id,
        name: 'Society',
        category: 'SOCIETY',
        weeklyEffortHours: 2,
        flexibility: 'HARD',
        meetings: {
          create: [
            {
              dayOfWeek: 'MONDAY',
              startTime: new Date('1970-01-01T12:00:00.000Z'),
              endTime: new Date('1970-01-01T14:00:00.000Z'),
            },
          ],
        },
        events: {
          create: {
            title: 'Tournament',
            startAt: new Date('2026-09-04T09:00:00.000Z'),
            endAt: new Date('2026-09-04T13:00:00.000Z'),
            estimatedEffortHours: 4,
            flexibilityOverride: 'HARD',
          },
        },
      },
    });

    const result = await request(app)
      .get(`/api/workspaces/${workspace.id}/workload?asOf=2026-09-01T09:00:00.000Z`)
      .set('Cookie', ownerCookie);
    expect(result.status).toBe(200);
    expect(result.body.workload).toMatchObject({
      engineVersion: '0.1',
      asOf: '2026-09-01T09:00:00.000Z',
      summary: {
        assessmentCount: 2,
        datedAssessmentCount: 2,
        overlappingAssessmentCount: 2,
      },
    });
    expect(result.body.workload.summary.commitmentOccurrenceCount).toBeGreaterThan(1);
    expect(result.body.workload.summary.commitmentPressure).toBeGreaterThan(0);
    expect(result.body.workload.currentDayPressure).toMatchObject({
      date: '2026-09-01',
      pressure: expect.any(Number),
      band: expect.any(String),
      drivers: expect.arrayContaining([expect.any(String)]),
    });
    expect(result.body.workload.dailyPressure.length).toBeGreaterThan(7);
    expect(result.body.workload.dailyPressure).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          date: '2026-09-04',
          estimatedDemandHours: expect.any(Number),
          drivers: expect.arrayContaining([expect.any(String)]),
        }),
      ]),
    );
    expect(result.body.workload.currentWeekPressure).toMatchObject({
      weekStart: '2026-08-31',
      weekEnd: '2026-09-06',
      pressure: expect.any(Number),
      band: expect.any(String),
    });
    expect(result.body.workload.weeklyPressure.length).toBeGreaterThan(1);
    expect(result.body.workload.weeklyPressure).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          weekStart: '2026-09-07',
          weekEnd: '2026-09-13',
          majorAssessmentCount: expect.any(Number),
          uniqueCourseCount: expect.any(Number),
          drivers: expect.arrayContaining([expect.any(String)]),
          driverDetails: expect.arrayContaining([
            expect.objectContaining({ kind: 'ASSESSMENT', label: expect.any(String) }),
          ]),
        }),
      ]),
    );
    expect(result.body.workload.peakPeriods).toEqual(expect.any(Array));
    if (result.body.workload.peakPeriods.length) {
      expect(result.body.workload.peakPeriods).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            weekStart: expect.any(String),
            weekEnd: expect.any(String),
            pressure: expect.any(Number),
            band: expect.any(String),
            drivers: expect.any(Array),
            driverDetails: expect.any(Array),
          }),
        ]),
      );
    }
    expect(result.body.workload.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'ASSESSMENT_CLUSTER', severity: 'HIGH' }),
        expect.objectContaining({ type: 'MAJOR_DEADLINE_OVERLAP', severity: 'HIGH' }),
      ]),
    );
    expect(result.body.workload.assessments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'Assignment 1',
          estimatedEffortHours: 8,
          effortSource: 'PERSONAL_ESTIMATE',
          importance: expect.any(Number),
          urgency: expect.any(Number),
          deadlineCompression: expect.any(Number),
          overlapCount: 1,
          preparationDays: expect.any(Number),
        }),
        expect.objectContaining({
          title: 'Midterm',
          estimatedEffortHours: 10,
          effortSource: 'OUTLINE_ESTIMATE',
          overlapCount: 1,
        }),
      ]),
    );

    const intruderSignUp = await request(app).post('/api/auth/sign-up/email').send({
      name: 'Workload Intruder',
      email: intruderEmail,
      password,
    });
    expect(intruderSignUp.status).toBe(200);
    const intruder = await request(app)
      .get(`/api/workspaces/${workspace.id}/workload`)
      .set('Cookie', intruderSignUp.headers['set-cookie']);
    expect(intruder.status).toBe(404);
  });
});
