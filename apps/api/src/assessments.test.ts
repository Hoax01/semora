import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { app } from './app.js';
import { prisma } from './db.js';

describe('Phase 6 and 7 assessment management', () => {
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

    const pointsScore = await request(app)
      .put('/api/assessments/' + assessmentId + '/score')
      .set('Cookie', ownerCookie)
      .send({ pointsEarned: 18 });
    expect(pointsScore.status).toBe(400);

    const pointsPossible = await request(app)
      .patch('/api/assessments/' + assessmentId)
      .set('Cookie', ownerCookie)
      .send({ pointsPossible: 20 });
    expect(pointsPossible.status).toBe(200);

    const savedPointsScore = await request(app)
      .put('/api/assessments/' + assessmentId + '/score')
      .set('Cookie', ownerCookie)
      .send({ pointsEarned: 18 });
    expect(savedPointsScore.status).toBe(200);
    expect(savedPointsScore.body.assessment).toMatchObject({
      status: 'GRADED',
      score: {
        pointsEarned: 18,
        percentage: null,
        sourceType: 'USER_ENTERED',
      },
    });

    const savedPercentageScore = await request(app)
      .put('/api/assessments/' + assessmentId + '/score')
      .set('Cookie', ownerCookie)
      .send({ percentage: 82 });
    expect(savedPercentageScore.status).toBe(200);
    expect(savedPercentageScore.body.assessment.score).toMatchObject({
      pointsEarned: null,
      percentage: 82,
    });

    const savedClassStatistics = await request(app)
      .put('/api/assessments/' + assessmentId + '/class-statistics')
      .set('Cookie', ownerCookie)
      .send({ mean: 69, median: 71, standardDeviation: 11 });
    expect(savedClassStatistics.status).toBe(200);
    expect(savedClassStatistics.body.assessment.classStatistics).toMatchObject({
      mean: 69,
      median: 71,
      standardDeviation: 11,
      minimum: null,
      maximum: null,
      sourceType: 'USER_ENTERED',
    });

    const invalidClassStatistics = await request(app)
      .put('/api/assessments/' + assessmentId + '/class-statistics')
      .set('Cookie', ownerCookie)
      .send({ mean: 69, minimum: 90, maximum: 80 });
    expect(invalidClassStatistics.status).toBe(400);
    const thresholdDocument = await prisma.document.create({
      data: {
        userId: ownerId,
        workspaceId: workspace.id,
        courseOfferingId: section.courseOfferingId,
        originalFilename: 'threshold-fixture.txt',
        storageKey: 'threshold-fixture-' + Date.now(),
        mimeType: 'text/plain',
        fileSize: 1,
        fileHash: 'threshold-fixture-' + Date.now(),
      },
    });
    await prisma.gradingScheme.create({
      data: {
        activeCourseStateId: activeState.id,
        gradingMode: 'ABSOLUTE',
        totalExpectedWeight: 100,
        sourceType: 'USER_ENTERED',
        sourceDocumentId: thresholdDocument.id,
        categories: {
          create: [
            {
              name: 'Best quizzes',
              weightPercentage: 20,
              aggregationRule: 'BEST_N',
              ruleParameterN: 8,
              displayOrder: 0,
            },
          ],
        },
        thresholds: {
          create: [
            {
              letterGrade: 'A',
              minimumPercentage: 90,
              inclusive: true,
              sourceType: 'USER_ENTERED',
              sourceDocumentId: thresholdDocument.id,
            },
            {
              letterGrade: 'A-',
              minimumPercentage: 85,
              inclusive: true,
              sourceType: 'USER_ENTERED',
              sourceDocumentId: thresholdDocument.id,
            },
            {
              letterGrade: 'B+',
              minimumPercentage: 80,
              inclusive: true,
              sourceType: 'USER_ENTERED',
              sourceDocumentId: thresholdDocument.id,
            },
          ],
        },
      },
    });
    const listedWithScore = await request(app)
      .get('/api/workspaces/' + workspace.id + '/assessments')
      .set('Cookie', ownerCookie);
    expect(listedWithScore.body.assessments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: assessmentId,
          score: expect.objectContaining({ percentage: 82 }),
        }),
      ]),
    );

    expect(listedWithScore.body.gradeSummaries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          relativeStatistics: [
            expect.objectContaining({
              assessmentId,
              score: 82,
              mean: 69,
              differenceFromMean: 13,
              zScore: 1.18,
            }),
          ],
        }),
      ]),
    );
    expect(listedWithScore.body.gradeSummaries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          gradingMode: 'ABSOLUTE',
          currentGrade: 'B+',
          targetAnalyses: expect.arrayContaining([
            expect.objectContaining({
              target: 'A-',
              threshold: 85,
              requiredRemainingAverage: 85.26,
              reachable: true,
              secured: false,
            }),
          ]),
        }),
      ]),
    );
    expect(listedWithScore.body.gradeSummaries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          totalExpectedWeight: 100,
          weightedPointsEarned: 6.56,
          gradedWeight: 8,
          remainingWeight: 92,
          currentPerformance: 82,
          assessmentCount: 1,
          gradedAssessmentCount: 1,
          currentGrade: 'B+',
          categories: [
            expect.objectContaining({
              name: 'Best quizzes',
              aggregationRule: 'BEST_N',
              ruleParameterN: 8,
              droppedAssessmentCount: 0,
            }),
          ],
        }),
      ]),
    );
    const scenario = await request(app)
      .post(`/api/workspaces/${workspace.id}/grade-scenarios`)
      .set('Cookie', ownerCookie)
      .send({
        courseOfferingId: section.courseOfferingId,
        overrides: [{ assessmentId, percentage: 100 }],
      });
    expect(scenario.status).toBe(200);
    expect(scenario.body).toMatchObject({ persisted: false });
    expect(scenario.body.gradeSummary).toMatchObject({
      currentPerformance: 100,
      currentGrade: 'A',
      gradedWeight: 8,
    });

    const unchangedAfterScenario = await request(app)
      .get('/api/workspaces/' + workspace.id + '/assessments')
      .set('Cookie', ownerCookie);
    expect(unchangedAfterScenario.body.assessments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: assessmentId,
          score: expect.objectContaining({ percentage: 82 }),
        }),
      ]),
    );
    expect(unchangedAfterScenario.body.gradeSummaries).toEqual(
      expect.arrayContaining([expect.objectContaining({ currentPerformance: 82 })]),
    );
    const clearedClassStatistics = await request(app)
      .delete('/api/assessments/' + assessmentId + '/class-statistics')
      .set('Cookie', ownerCookie);
    expect(clearedClassStatistics.status).toBe(200);
    expect(clearedClassStatistics.body.assessment.classStatistics).toBeNull();
    const clearedScore = await request(app)
      .delete('/api/assessments/' + assessmentId + '/score')
      .set('Cookie', ownerCookie);
    expect(clearedScore.status).toBe(200);
    expect(clearedScore.body.assessment).toMatchObject({
      status: 'UPCOMING',
      score: null,
    });
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

    const beforeCompletionWorkload = await request(app)
      .get(`/api/workspaces/${workspace.id}/workload?asOf=2026-09-01T09:00:00.000Z`)
      .set('Cookie', ownerCookie);
    expect(beforeCompletionWorkload.status).toBe(200);
    expect(beforeCompletionWorkload.body.workload.assessments).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: assessmentId })]),
    );

    const done = await request(app)
      .patch(`/api/assessments/${assessmentId}`)
      .set('Cookie', ownerCookie)
      .send({ workStatus: 'DONE' });
    expect(done.status).toBe(200);
    expect(done.body.assessment).toMatchObject({
      workStatus: 'DONE',
      progressPercentage: 100,
    });
    const afterCompletionWorkload = await request(app)
      .get(`/api/workspaces/${workspace.id}/workload?asOf=2026-09-01T09:00:00.000Z`)
      .set('Cookie', ownerCookie);
    expect(afterCompletionWorkload.status).toBe(200);
    expect(afterCompletionWorkload.body.workload.assessments).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: assessmentId })]),
    );
    expect(afterCompletionWorkload.body.workload.weeklyPressure).not.toEqual(
      beforeCompletionWorkload.body.workload.weeklyPressure,
    );

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
    const intruderScenario = await request(app)
      .post(`/api/workspaces/${workspace.id}/grade-scenarios`)
      .set('Cookie', intruderSignUp.headers['set-cookie'])
      .send({
        courseOfferingId: section.courseOfferingId,
        overrides: [{ assessmentId, percentage: 90 }],
      });
    expect(intruderScenario.status).toBe(404);
    const intruderClassStatistics = await request(app)
      .put('/api/assessments/' + assessmentId + '/class-statistics')
      .set('Cookie', intruderSignUp.headers['set-cookie'])
      .send({ mean: 69 });
    expect(intruderClassStatistics.status).toBe(404);
    const intruderScore = await request(app)
      .put('/api/assessments/' + assessmentId + '/score')
      .set('Cookie', intruderSignUp.headers['set-cookie'])
      .send({ percentage: 90 });
    expect(intruderScore.status).toBe(404);
  });
});
