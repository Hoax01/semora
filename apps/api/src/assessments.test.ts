import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { app } from './app.js';
import { prisma } from './db.js';

describe('Phase 6 and 7 assessment management', () => {
  const ownerEmail = `assessment-owner-${Date.now()}@example.test`;
  const intruderEmail = `assessment-intruder-${Date.now()}@example.test`;
  const equalOwnerEmail = 'assessment-equal-' + Date.now() + '@example.test';
  const ruleOwnerEmail = 'assessment-rule-' + Date.now() + '@example.test';
  const ruleIntruderEmail = 'assessment-rule-intruder-' + Date.now() + '@example.test';
  const password = 'semora-test-password';

  afterAll(async () => {
    await prisma?.user
      .deleteMany({
        where: {
          email: {
            in: [ownerEmail, intruderEmail, equalOwnerEmail, ruleOwnerEmail, ruleIntruderEmail],
          },
        },
      })
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
    expect(empty.body.gradeSummaries).toEqual([
      expect.objectContaining({
        courseOfferingId: section.courseOfferingId,
        assessmentCount: 0,
        currentPerformance: null,
      }),
    ]);

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

    const afterManualCreate = await request(app)
      .get(`/api/workspaces/${workspace.id}/assessments`)
      .set('Cookie', ownerCookie);
    expect(afterManualCreate.status).toBe(200);
    expect(afterManualCreate.body.gradeSummaries).toEqual([
      expect.objectContaining({
        courseOfferingId: section.courseOfferingId,
        assessmentCount: 1,
      }),
    ]);

    const assessmentId = created.body.assessment.id as string;

    const invalidWeight = await request(app)
      .patch('/api/assessments/' + assessmentId)
      .set('Cookie', ownerCookie)
      .send({ weightPercentage: 101 });
    expect(invalidWeight.status).toBe(400);
    const afterInvalidWeight = await prisma.assessment.findUniqueOrThrow({
      where: { id: assessmentId },
    });
    expect(Number(afterInvalidWeight.weightPercentage)).toBe(8);

    const invalidDate = await request(app)
      .patch('/api/assessments/' + assessmentId)
      .set('Cookie', ownerCookie)
      .send({ dueDate: '2026-02-30' });
    expect(invalidDate.status).toBe(400);
    const afterInvalidDate = await prisma.assessment.findUniqueOrThrow({
      where: { id: assessmentId },
    });
    expect(afterInvalidDate.dueAt?.toISOString().slice(0, 10)).toBe('2026-09-18');
    expect(afterInvalidDate.datePrecision).toBe('EXACT');

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
    const upcoming = await request(app)
      .post('/api/active-selections/' + selection.id + '/assessments')
      .set('Cookie', ownerCookie)
      .send({
        title: 'Final project',
        assessmentType: 'FINAL',
        weightPercentage: 20,
        dueDate: '2026-12-15',
      });
    expect(upcoming.status).toBe(201);
    const upcomingAssessmentId = upcoming.body.assessment.id as string;
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
          remainingAssessments: [
            expect.objectContaining({
              assessmentId: upcomingAssessmentId,
              title: 'Final project',
              assessmentType: 'FINAL',
              dueDate: '2026-12-15',
              weightPercentage: 20,
              status: 'UPCOMING',
            }),
          ],
          weightedPointsEarned: 6.56,
          gradedWeight: 8,
          remainingWeight: 92,
          currentPerformance: 82,
          assessmentCount: 2,
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
      dueDate: null,
      datePrecision: 'UNKNOWN',
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
  it('derives equal assessment weights and converts intentional overrides to explicit weights', async () => {
    if (!prisma) return;

    const signUp = await request(app).post('/api/auth/sign-up/email').send({
      name: 'Equal Weight Owner',
      email: equalOwnerEmail,
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
    const sourceDocument = await prisma.document.create({
      data: {
        userId: ownerId,
        workspaceId: workspace.id,
        courseOfferingId: section.courseOfferingId,
        originalFilename: 'equal-weight-fixture.txt',
        storageKey: 'equal-weight-fixture-' + Date.now(),
        mimeType: 'text/plain',
        fileSize: 1,
        fileHash: 'equal-weight-fixture-' + Date.now(),
      },
    });
    const gradingScheme = await prisma.gradingScheme.create({
      data: {
        activeCourseStateId: activeState.id,
        gradingMode: 'UNKNOWN',
        totalExpectedWeight: 100,
        sourceType: 'USER_ENTERED',
        sourceDocumentId: sourceDocument.id,
      },
    });
    const category = await prisma.gradeCategory.create({
      data: {
        gradingSchemeId: gradingScheme.id,
        name: 'Assignments',
        weightPercentage: 40,
        aggregationRule: 'EQUAL_MEAN',
        displayOrder: 0,
      },
    });
    const assessments = await prisma.assessment.createMany({
      data: [
        {
          activeCourseStateId: activeState.id,
          gradeCategoryId: category.id,
          title: 'Assignment 1',
          assessmentType: 'ASSIGNMENT',
          datePrecision: 'UNKNOWN',
          status: 'UPCOMING',
          sourceType: 'USER_ENTERED',
        },
        {
          activeCourseStateId: activeState.id,
          gradeCategoryId: category.id,
          title: 'Assignment 2',
          assessmentType: 'ASSIGNMENT',
          datePrecision: 'UNKNOWN',
          status: 'UPCOMING',
          sourceType: 'USER_ENTERED',
        },
      ],
    });
    expect(assessments.count).toBe(2);

    const listed = await request(app)
      .get('/api/workspaces/' + workspace.id + '/assessments')
      .set('Cookie', ownerCookie);
    expect(listed.status).toBe(200);
    expect(listed.body.assessments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'Assignment 1',
          weightPercentage: null,
          effectiveWeightPercentage: 20,
          weightIsDerived: true,
        }),
      ]),
    );
    expect(listed.body.gradeSummaries[0].remainingAssessments).toEqual(
      expect.arrayContaining([expect.objectContaining({ weightPercentage: 20 })]),
    );

    const assignmentOne = listed.body.assessments.find(
      (assessment: { title: string }) => assessment.title === 'Assignment 1',
    );
    const edited = await request(app)
      .patch('/api/assessments/' + assignmentOne.id)
      .set('Cookie', ownerCookie)
      .send({ weightPercentage: 15 });
    expect(edited.status).toBe(200);
    expect(edited.body.assessment).toMatchObject({
      weightPercentage: 15,
      effectiveWeightPercentage: 15,
      weightIsDerived: false,
    });

    const updatedCategory = await prisma.gradeCategory.findUniqueOrThrow({
      where: { id: category.id },
    });
    expect(updatedCategory.aggregationRule).toBe('EXPLICIT_WEIGHTS');
    const updatedAssessments = await prisma.assessment.findMany({
      where: { activeCourseStateId: activeState.id, gradeCategoryId: category.id },
      orderBy: { title: 'asc' },
    });
    expect(updatedAssessments.map((assessment) => Number(assessment.weightPercentage))).toEqual([
      15, 20,
    ]);
  });
  it('changes a verified grading rule without replacing assessments or scores', async () => {
    if (!prisma) return;

    const signUp = await request(app).post('/api/auth/sign-up/email').send({
      name: 'Grading Rule Owner',
      email: ruleOwnerEmail,
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
    const sourceDocument = await prisma.document.create({
      data: {
        userId: ownerId,
        workspaceId: workspace.id,
        courseOfferingId: section.courseOfferingId,
        originalFilename: 'grading-rule-fixture.txt',
        storageKey: 'grading-rule-fixture-' + Date.now(),
        mimeType: 'text/plain',
        fileSize: 1,
        fileHash: 'grading-rule-fixture-' + Date.now(),
      },
    });
    const gradingScheme = await prisma.gradingScheme.create({
      data: {
        activeCourseStateId: activeState.id,
        gradingMode: 'UNKNOWN',
        totalExpectedWeight: 100,
        sourceType: 'USER_ENTERED',
        sourceDocumentId: sourceDocument.id,
      },
    });
    const category = await prisma.gradeCategory.create({
      data: {
        gradingSchemeId: gradingScheme.id,
        name: 'Quizzes',
        weightPercentage: 20,
        aggregationRule: 'EQUAL_MEAN',
        displayOrder: 0,
      },
    });
    const lowQuiz = await prisma.assessment.create({
      data: {
        activeCourseStateId: activeState.id,
        gradeCategoryId: category.id,
        title: 'Quiz 1',
        assessmentType: 'QUIZ',
        dueAt: new Date('2026-09-10T00:00:00.000Z'),
        datePrecision: 'EXACT',
        status: 'GRADED',
        sourceType: 'USER_ENTERED',
      },
    });
    const highQuiz = await prisma.assessment.create({
      data: {
        activeCourseStateId: activeState.id,
        gradeCategoryId: category.id,
        title: 'Quiz 2',
        assessmentType: 'QUIZ',
        dueAt: new Date('2026-09-17T00:00:00.000Z'),
        datePrecision: 'EXACT',
        status: 'GRADED',
        sourceType: 'USER_ENTERED',
      },
    });
    await prisma.assessmentScore.createMany({
      data: [
        {
          assessmentId: lowQuiz.id,
          userId: ownerId,
          percentageOverride: 80,
          sourceType: 'USER_ENTERED',
        },
        {
          assessmentId: highQuiz.id,
          userId: ownerId,
          percentageOverride: 90,
          sourceType: 'USER_ENTERED',
        },
      ],
    });

    const baseline = await request(app)
      .get(`/api/workspaces/${workspace.id}/assessments`)
      .set('Cookie', ownerCookie);
    expect(baseline.status).toBe(200);
    expect(baseline.body.gradeSummaries[0]).toMatchObject({
      currentPerformance: 85,
      gradedWeight: 20,
      categories: [
        expect.objectContaining({ aggregationRule: 'EQUAL_MEAN', ruleParameterN: null }),
      ],
    });

    const missingParameter = await request(app)
      .patch(`/api/grade-categories/${category.id}`)
      .set('Cookie', ownerCookie)
      .send({ aggregationRule: 'DROP_LOWEST_N' });
    expect(missingParameter.status).toBe(400);

    const intruderSignUp = await request(app).post('/api/auth/sign-up/email').send({
      name: 'Grading Rule Intruder',
      email: ruleIntruderEmail,
      password,
    });
    expect(intruderSignUp.status).toBe(200);
    const intruderChange = await request(app)
      .patch(`/api/grade-categories/${category.id}`)
      .set('Cookie', intruderSignUp.headers['set-cookie'])
      .send({ aggregationRule: 'DROP_LOWEST_N', ruleParameterN: 1 });
    expect(intruderChange.status).toBe(404);

    const changed = await request(app)
      .patch(`/api/grade-categories/${category.id}`)
      .set('Cookie', ownerCookie)
      .send({ aggregationRule: 'DROP_LOWEST_N', ruleParameterN: 1 });
    expect(changed.status).toBe(200);
    expect(changed.body.category).toMatchObject({
      id: category.id,
      aggregationRule: 'DROP_LOWEST_N',
      ruleParameterN: 1,
    });

    const preservedAssessments = await prisma.assessment.findMany({
      where: { activeCourseStateId: activeState.id, gradeCategoryId: category.id },
      include: { scores: true },
      orderBy: { title: 'asc' },
    });
    expect(preservedAssessments.map((assessment) => assessment.id)).toEqual([
      lowQuiz.id,
      highQuiz.id,
    ]);
    expect(
      preservedAssessments.map((assessment) => assessment.dueAt?.toISOString().slice(0, 10)),
    ).toEqual(['2026-09-10', '2026-09-17']);
    expect(preservedAssessments.map((assessment) => assessment.scores.length)).toEqual([1, 1]);

    const afterChange = await request(app)
      .get(`/api/workspaces/${workspace.id}/assessments`)
      .set('Cookie', ownerCookie);
    expect(afterChange.status).toBe(200);
    expect(afterChange.body.gradeSummaries[0]).toMatchObject({
      currentPerformance: 90,
      gradedWeight: 10,
      categories: [
        expect.objectContaining({
          aggregationRule: 'DROP_LOWEST_N',
          ruleParameterN: 1,
          droppedAssessmentCount: 1,
        }),
      ],
    });

    const restored = await request(app)
      .patch(`/api/grade-categories/${category.id}`)
      .set('Cookie', ownerCookie)
      .send({ aggregationRule: 'EQUAL_MEAN', ruleParameterN: null });
    expect(restored.status).toBe(200);
    expect(restored.body.category).toMatchObject({
      aggregationRule: 'EQUAL_MEAN',
      ruleParameterN: null,
    });
  });
});
