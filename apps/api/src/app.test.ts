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
    expect(
      catalogue.body.courses.every((course: { courseCode: string }) =>
        course.courseCode.startsWith('CS'),
      ),
    ).toBe(true);
    const csCourse = catalogue.body.courses.find((course: { courseCode: string }) =>
      course.courseCode.startsWith('CS'),
    );
    expect(csCourse).toMatchObject({
      courseCode: expect.stringMatching(/^CS/),
      credits: 3,
    });
    expect(csCourse.sections[0].meetings.length).toBeGreaterThan(0);

    const titleSearch = await request(app)
      .get('/api/catalogue')
      .query({ term: 'Fall 2026', q: 'Operating Systems' })
      .set('Cookie', sessionCookie);

    expect(titleSearch.status).toBe(200);
    expect(titleSearch.body.courses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: expect.stringMatching(/Operating Systems/i) }),
      ]),
    );

    const departmentSearch = await request(app)
      .get('/api/catalogue')
      .query({ term: 'Fall 2026', q: 'Computer Science' })
      .set('Cookie', sessionCookie);

    expect(departmentSearch.status).toBe(200);
    expect(departmentSearch.body.courses.length).toBeGreaterThan(0);
    expect(
      departmentSearch.body.courses.every((course: { courseCode: string }) =>
        course.courseCode.startsWith('CS'),
      ),
    ).toBe(true);

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

describe('Phase 2 planning foundation', () => {
  const ownerEmail = `planning-owner-${Date.now()}@example.test`;
  const intruderEmail = `planning-intruder-${Date.now()}@example.test`;
  const password = 'semora-test-password';

  afterAll(async () => {
    await prisma?.user
      .deleteMany({ where: { email: { in: [ownerEmail, intruderEmail] } } })
      .catch(() => undefined);
  });

  it('creates a workspace and manages independently owned candidate options', async () => {
    const ownerSignUp = await request(app).post('/api/auth/sign-up/email').send({
      name: 'Planning Owner',
      email: ownerEmail,
      password,
    });
    const ownerCookie = ownerSignUp.headers['set-cookie'];

    const terms = await request(app).get('/api/terms').set('Cookie', ownerCookie);
    expect(terms.status).toBe(200);
    const fall2026 = terms.body.universities
      .flatMap((university: { terms: Array<{ id: string; name: string }> }) => university.terms)
      .find((term: { name: string }) => term.name === 'Fall 2026');
    expect(fall2026).toBeDefined();

    const firstWorkspaceRequest = await request(app)
      .post('/api/workspaces')
      .set('Cookie', ownerCookie)
      .send({ academicTermId: fall2026.id });
    expect(firstWorkspaceRequest.status).toBe(200);
    expect(firstWorkspaceRequest.body.workspace).toMatchObject({
      state: 'PLANNING',
      term: { name: 'Fall 2026', university: { shortName: 'LUMS' } },
      candidates: [],
      preferences: { workloadPriority: 0.5, schedulePriority: 0.5 },
    });
    const workspaceId = firstWorkspaceRequest.body.workspace.id as string;

    const invalidPreferences = await request(app)
      .patch(`/api/workspaces/${workspaceId}/preferences`)
      .set('Cookie', ownerCookie)
      .send({ workloadPriority: 1.2 });
    expect(invalidPreferences.status).toBe(400);

    const savedPreferences = await request(app)
      .patch(`/api/workspaces/${workspaceId}/preferences`)
      .set('Cookie', ownerCookie)
      .send({
        workloadPriority: 0.9,
        schedulePriority: 0.75,
        careerPriority: 0.8,
        interestPriority: 0.6,
        projectPreference: 0.25,
        examPreference: 0.75,
        freeDayPriority: 1,
        earlyClassAversion: 0.5,
        lateClassAversion: 0.25,
      });
    expect(savedPreferences.status).toBe(200);
    expect(savedPreferences.body.preferences).toMatchObject({
      workloadPriority: 0.9,
      schedulePriority: 0.75,
      projectPreference: 0.25,
      examPreference: 0.75,
      freeDayPriority: 1,
    });

    const repeatedWorkspaceRequest = await request(app)
      .post('/api/workspaces')
      .set('Cookie', ownerCookie)
      .send({ academicTermId: fall2026.id });
    expect(repeatedWorkspaceRequest.status).toBe(200);
    expect(repeatedWorkspaceRequest.body.workspace.id).toBe(workspaceId);
    expect(repeatedWorkspaceRequest.body.workspace.preferences).toMatchObject({
      workloadPriority: 0.9,
      schedulePriority: 0.75,
    });
    expect(await prisma?.semesterPreferences.count({ where: { workspaceId } })).toBe(1);

    // Phase 0 workspaces may predate the required one-to-one preference row.
    // Updating preferences must repair that legacy state instead of failing.
    await prisma?.semesterPreferences.delete({ where: { workspaceId } });
    const repairedPreferences = await request(app)
      .patch(`/api/workspaces/${workspaceId}/preferences`)
      .set('Cookie', ownerCookie)
      .send({ workloadPriority: 0.4 });
    expect(repairedPreferences.status).toBe(200);
    expect(repairedPreferences.body.preferences).toMatchObject({
      workloadPriority: 0.4,
      schedulePriority: 0.5,
    });

    const invalidCandidate = await request(app)
      .post(`/api/workspaces/${workspaceId}/candidates`)
      .set('Cookie', ownerCookie)
      .send({ name: '   ' });
    expect(invalidCandidate.status).toBe(400);
    expect(invalidCandidate.body.error).toBe('VALIDATION_ERROR');

    const optionA = await request(app)
      .post(`/api/workspaces/${workspaceId}/candidates`)
      .set('Cookie', ownerCookie)
      .send({ name: 'Option A' });
    const optionB = await request(app)
      .post(`/api/workspaces/${workspaceId}/candidates`)
      .set('Cookie', ownerCookie)
      .send({ name: 'Option B' });
    expect(optionA.status).toBe(201);
    expect(optionB.status).toBe(201);

    const renamed = await request(app)
      .patch(`/api/candidates/${optionB.body.candidate.id}`)
      .set('Cookie', ownerCookie)
      .send({ name: 'Balanced' });
    expect(renamed.status).toBe(200);
    expect(renamed.body.candidate.name).toBe('Balanced');

    const catalogue = await request(app)
      .get('/api/catalogue')
      .query({ termId: fall2026.id, q: 'CS' })
      .set('Cookie', ownerCookie);
    expect(catalogue.status).toBe(200);
    expect(catalogue.body.term.id).toBe(fall2026.id);
    const courseWithMultipleSections = catalogue.body.courses.find(
      (course: { credits: number; sections: unknown[] }) =>
        course.credits === 3 && course.sections.length >= 2,
    );
    expect(courseWithMultipleSections).toBeDefined();
    const firstSectionId = courseWithMultipleSections.sections[0].id as string;
    const secondSectionId = courseWithMultipleSections.sections[1].id as string;

    const concurrentCandidate = await request(app)
      .post(`/api/workspaces/${workspaceId}/candidates`)
      .set('Cookie', ownerCookie)
      .send({ name: 'Concurrent writes' });
    const concurrentSelections = await Promise.all([
      request(app)
        .post(`/api/candidates/${concurrentCandidate.body.candidate.id}/selections`)
        .set('Cookie', ownerCookie)
        .send({ sectionId: firstSectionId }),
      request(app)
        .post(`/api/candidates/${concurrentCandidate.body.candidate.id}/selections`)
        .set('Cookie', ownerCookie)
        .send({ sectionId: secondSectionId }),
    ]);
    expect(concurrentSelections.map((response) => response.status).sort()).toEqual([201, 409]);
    await request(app)
      .patch(`/api/candidates/${concurrentCandidate.body.candidate.id}`)
      .set('Cookie', ownerCookie)
      .send({ isArchived: true });

    const selection = await request(app)
      .post(`/api/candidates/${optionA.body.candidate.id}/selections`)
      .set('Cookie', ownerCookie)
      .send({ sectionId: firstSectionId });
    expect(selection.status).toBe(201);
    expect(selection.body.candidate).toMatchObject({ selectionCount: 1, credits: 3 });
    expect(selection.body.selection.sectionId).toBe(firstSectionId);

    const duplicateCourse = await request(app)
      .post(`/api/candidates/${optionA.body.candidate.id}/selections`)
      .set('Cookie', ownerCookie)
      .send({ sectionId: secondSectionId });
    expect(duplicateCourse.status).toBe(409);
    expect(duplicateCourse.body.error).toBe('COURSE_ALREADY_SELECTED');

    const switched = await request(app)
      .patch(`/api/selections/${selection.body.selection.id}`)
      .set('Cookie', ownerCookie)
      .send({ sectionId: secondSectionId });
    expect(switched.status).toBe(200);
    expect(switched.body.selection.sectionId).toBe(secondSectionId);

    const clearValidation = await request(app)
      .get(`/api/candidates/${optionA.body.candidate.id}/validation`)
      .set('Cookie', ownerCookie);
    expect(clearValidation.status).toBe(200);
    expect(clearValidation.body).toMatchObject({
      candidateId: optionA.body.candidate.id,
      valid: true,
    });
    expect(clearValidation.body.clashes).toEqual([]);

    const scheduleAnalysis = await request(app)
      .get(`/api/candidates/${optionA.body.candidate.id}/analysis`)
      .set('Cookie', ownerCookie);
    expect(scheduleAnalysis.status).toBe(200);
    expect(scheduleAnalysis.body).toMatchObject({
      candidateId: optionA.body.candidate.id,
      engineVersion: '0.1',
      validity: { valid: true, clashes: [] },
      schedule: {
        scheduledDays: expect.arrayContaining(['MONDAY']),
        freeDays: expect.arrayContaining(['TUESDAY', 'FRIDAY']),
      },
      coursePreferenceFit: {
        interestFit: null,
        careerFit: null,
        interestKnownCount: 0,
        careerKnownCount: 0,
        courseCount: 1,
      },
      interactionPenalties: {
        projectConcentration: { knownCourseCount: 0, heavyCourseCount: 0, penalty: 0 },
        continuousAssessmentConcentration: {
          knownCourseCount: 0,
          heavyCourseCount: 0,
          penalty: 0,
        },
        examConcentration: { knownCourseCount: 0, heavyCourseCount: 0, penalty: 0 },
        totalPenalty: 0,
      },
      metrics: {
        academicIntensity: expect.any(Number),
        scheduleQuality: expect.any(Number),
        commitmentCompatibility: 10,
        interestFit: null,
        careerFit: null,
        analysisConfidence: expect.any(Number),
        dataCompleteness: expect.any(Number),
      },
      findings: expect.any(Array),
    });

    const courseOfferingId = selection.body.selection.courseOfferingId as string;
    const invalidCoursePreference = await request(app)
      .patch(`/api/workspaces/${workspaceId}/course-preferences/${courseOfferingId}`)
      .set('Cookie', ownerCookie)
      .send({ interestScore: 1.1 });
    expect(invalidCoursePreference.status).toBe(400);

    const savedCoursePreference = await request(app)
      .patch(`/api/workspaces/${workspaceId}/course-preferences/${courseOfferingId}`)
      .set('Cookie', ownerCookie)
      .send({ interestScore: 0.5, careerRelevanceScore: 1 });
    expect(savedCoursePreference.status).toBe(200);
    expect(savedCoursePreference.body.coursePreference).toMatchObject({
      courseOfferingId,
      interestScore: 0.5,
      careerRelevanceScore: 1,
    });

    const ratedAnalysis = await request(app)
      .get(`/api/candidates/${optionA.body.candidate.id}/analysis`)
      .set('Cookie', ownerCookie);
    expect(ratedAnalysis.status).toBe(200);
    expect(ratedAnalysis.body.coursePreferenceFit).toEqual({
      interestFit: 0.5,
      careerFit: 1,
      interestKnownCount: 1,
      careerKnownCount: 1,
      courseCount: 1,
      interestCompleteness: 1,
      careerCompleteness: 1,
    });

    const optionBSelection = await request(app)
      .post(`/api/candidates/${optionB.body.candidate.id}/selections`)
      .set('Cookie', ownerCookie)
      .send({ sectionId: secondSectionId });
    expect(optionBSelection.status).toBe(201);
    const optionBAnalysis = await request(app)
      .get(`/api/candidates/${optionB.body.candidate.id}/analysis`)
      .set('Cookie', ownerCookie);
    expect(optionBAnalysis.body.coursePreferenceFit).toMatchObject({
      interestFit: 0.5,
      careerFit: 1,
      interestCompleteness: 1,
      careerCompleteness: 1,
    });

    const comparison = await request(app)
      .get(`/api/workspaces/${workspaceId}/comparison`)
      .set('Cookie', ownerCookie);
    expect(comparison.status).toBe(200);
    expect(comparison.body.candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ candidateId: optionA.body.candidate.id, name: 'Option A' }),
        expect.objectContaining({ candidateId: optionB.body.candidate.id, name: 'Balanced' }),
      ]),
    );
    expect(comparison.body.metricDifferences).toEqual(expect.any(Array));

    const scenarioWithoutCourse = await request(app)
      .post(`/api/candidates/${optionA.body.candidate.id}/scenario`)
      .set('Cookie', ownerCookie)
      .send({ removeSelectionId: selection.body.selection.id });
    expect(scenarioWithoutCourse.status).toBe(200);
    expect(scenarioWithoutCourse.body.changes).toEqual(['course_removed']);
    expect(scenarioWithoutCourse.body.analysis).toMatchObject({
      candidateId: optionA.body.candidate.id,
      totalCredits: 0,
      validity: { valid: true, clashes: [] },
      schedule: { totalClassMinutes: 0, scheduledDays: [], freeDays: expect.any(Array) },
    });

    const analysisAfterScenario = await request(app)
      .get(`/api/candidates/${optionA.body.candidate.id}/analysis`)
      .set('Cookie', ownerCookie);
    expect(analysisAfterScenario.status).toBe(200);
    expect(analysisAfterScenario.body.totalCredits).toBe(3);

    const preferenceScenario = await request(app)
      .post(`/api/candidates/${optionA.body.candidate.id}/scenario`)
      .set('Cookie', ownerCookie)
      .send({ preferences: { workloadPriority: 1 } });
    expect(preferenceScenario.status).toBe(200);
    expect(preferenceScenario.body.changes).toEqual(['preferences_changed']);

    const workspaceWithCoursePreference = await request(app)
      .get(`/api/workspaces/${workspaceId}`)
      .set('Cookie', ownerCookie);
    expect(workspaceWithCoursePreference.body.workspace.coursePreferences).toEqual([
      expect.objectContaining({ courseOfferingId, interestScore: 0.5, careerRelevanceScore: 1 }),
    ]);

    const resetCoursePreference = await request(app)
      .delete(`/api/workspaces/${workspaceId}/course-preferences/${courseOfferingId}`)
      .set('Cookie', ownerCookie);
    expect(resetCoursePreference.status).toBe(200);
    const clearedAnalysis = await request(app)
      .get(`/api/candidates/${optionA.body.candidate.id}/analysis`)
      .set('Cookie', ownerCookie);
    expect(clearedAnalysis.body.coursePreferenceFit).toMatchObject({
      interestFit: null,
      careerFit: null,
      interestCompleteness: 0,
      careerCompleteness: 0,
    });

    const workloadProfile = await request(app)
      .patch(`/api/workspaces/${workspaceId}/workload-profiles/${courseOfferingId}`)
      .set('Cookie', ownerCookie)
      .send({ projectIntensity: 8, estimatedWeeklyHours: 6.63 });
    expect(workloadProfile.status).toBe(200);
    expect(workloadProfile.body.workloadProfile).toMatchObject({
      courseOfferingId,
      projectIntensity: 8,
      estimatedWeeklyHours: 6.63,
      confidence: 0.8,
      source: 'USER_ESTIMATE',
    });

    const overriddenAnalysis = await request(app)
      .get(`/api/candidates/${optionA.body.candidate.id}/analysis`)
      .set('Cookie', ownerCookie);
    expect(overriddenAnalysis.status).toBe(200);
    expect(overriddenAnalysis.body.workloadProfiles).toEqual([
      expect.objectContaining({
        courseOfferingId,
        profile: expect.objectContaining({
          projectIntensity: 8,
          estimatedWeeklyHours: 6.63,
          source: 'USER_ESTIMATE',
        }),
      }),
    ]);
    expect(overriddenAnalysis.body.interactionPenalties.projectConcentration).toMatchObject({
      knownCourseCount: 1,
      heavyCourseCount: 1,
      penalty: 0,
    });

    const resetWorkloadProfile = await request(app)
      .delete(`/api/workspaces/${workspaceId}/workload-profiles/${courseOfferingId}`)
      .set('Cookie', ownerCookie);
    expect(resetWorkloadProfile.status).toBe(200);

    const selectedMeeting = switched.body.selection.meetings[0] as {
      day: string;
      startTime: string;
      endTime: string;
    };
    const invalidCommitment = await request(app)
      .post(`/api/workspaces/${workspaceId}/commitments`)
      .set('Cookie', ownerCookie)
      .send({
        name: 'Invalid block',
        category: 'PERSONAL',
        weeklyEffortHours: 1,
        flexibility: 'FLEXIBLE',
        meetings: [{ dayOfWeek: selectedMeeting.day, startTime: '15:00', endTime: '14:00' }],
      });
    expect(invalidCommitment.status).toBe(400);

    const hardCommitment = await request(app)
      .post(`/api/workspaces/${workspaceId}/commitments`)
      .set('Cookie', ownerCookie)
      .send({
        name: 'TAship',
        category: 'TASHIP',
        weeklyEffortHours: 2,
        flexibility: 'HARD',
        meetings: [
          {
            dayOfWeek: selectedMeeting.day,
            startTime: selectedMeeting.startTime,
            endTime: selectedMeeting.endTime,
          },
        ],
      });
    expect(hardCommitment.status).toBe(201);
    expect(hardCommitment.body.commitment).toMatchObject({
      name: 'TAship',
      flexibility: 'HARD',
      weeklyEffortHours: 2,
    });
    const commitmentEvent = await request(app)
      .post(`/api/commitments/${hardCommitment.body.commitment.id}/events`)
      .set('Cookie', ownerCookie)
      .send({
        title: 'TA grading block',
        startAt: '2026-10-13T09:00:00.000Z',
        endAt: '2026-10-13T13:00:00.000Z',
        estimatedEffortHours: 4,
        flexibilityOverride: 'HARD',
      });
    expect(commitmentEvent.status).toBe(201);
    expect(commitmentEvent.body.event).toMatchObject({
      title: 'TA grading block',
      estimatedEffortHours: 4,
      flexibilityOverride: 'HARD',
    });
    const editedCommitmentEvent = await request(app)
      .patch(`/api/commitment-events/${commitmentEvent.body.event.id}`)
      .set('Cookie', ownerCookie)
      .send({
        title: 'TA grading deadline',
        startAt: '2026-10-13T10:00:00.000Z',
        endAt: '2026-10-13T14:00:00.000Z',
        estimatedEffortHours: 5,
        flexibilityOverride: null,
      });
    expect(editedCommitmentEvent.status).toBe(200);
    expect(editedCommitmentEvent.body.event).toMatchObject({
      title: 'TA grading deadline',
      estimatedEffortHours: 5,
      flexibilityOverride: null,
    });
    const workspaceWithEvent = await request(app)
      .get(`/api/workspaces/${workspaceId}`)
      .set('Cookie', ownerCookie);
    expect(workspaceWithEvent.body.workspace.commitments[0].events).toEqual([
      expect.objectContaining({ id: commitmentEvent.body.event.id, title: 'TA grading deadline' }),
    ]);
    const invalidCommitmentEvent = await request(app)
      .post(`/api/commitments/${hardCommitment.body.commitment.id}/events`)
      .set('Cookie', ownerCookie)
      .send({
        title: 'Invalid event',
        startAt: '2026-10-13T14:00:00.000Z',
        endAt: '2026-10-13T13:00:00.000Z',
      });
    expect(invalidCommitmentEvent.status).toBe(400);
    const conflictedValidation = await request(app)
      .get(`/api/candidates/${optionA.body.candidate.id}/validation`)
      .set('Cookie', ownerCookie);
    expect(conflictedValidation.status).toBe(200);
    expect(conflictedValidation.body.valid).toBe(false);
    expect(conflictedValidation.body.clashes).toHaveLength(1);
    expect(conflictedValidation.body.clashes[0]).toMatchObject({
      type: 'COURSE_HARD_COMMITMENT',
      second: { kind: 'COMMITMENT', label: 'TAship' },
    });
    const blockedLock = await request(app)
      .post(`/api/candidates/${optionA.body.candidate.id}/lock`)
      .set('Cookie', ownerCookie);
    expect(blockedLock.status).toBe(409);
    expect(blockedLock.body.error).toBe('CANDIDATE_HAS_CRITICAL_CONFLICTS');
    expect(
      await prisma?.semesterWorkspace.findUnique({ where: { id: workspaceId } }),
    ).toMatchObject({
      state: 'PLANNING',
      lockedCandidateSemesterId: null,
    });
    const workspaceWithCommitment = await request(app)
      .get(`/api/workspaces/${workspaceId}`)
      .set('Cookie', ownerCookie);
    expect(workspaceWithCommitment.status).toBe(200);
    expect(workspaceWithCommitment.body.workspace.commitments).toHaveLength(1);
    expect(workspaceWithCommitment.body.workspace.commitments[0]).toMatchObject({
      name: 'TAship',
      flexibility: 'HARD',
    });
    const softenedCommitment = await request(app)
      .patch(`/api/commitments/${hardCommitment.body.commitment.id}`)
      .set('Cookie', ownerCookie)
      .send({
        name: 'TAship',
        category: 'TASHIP',
        weeklyEffortHours: 2,
        flexibility: 'FLEXIBLE',
        meetings: [
          {
            dayOfWeek: selectedMeeting.day,
            startTime: selectedMeeting.startTime,
            endTime: selectedMeeting.endTime,
          },
        ],
      });
    expect(softenedCommitment.status).toBe(200);

    const clearAfterSoftening = await request(app)
      .get(`/api/candidates/${optionA.body.candidate.id}/validation`)
      .set('Cookie', ownerCookie);
    expect(clearAfterSoftening.body.valid).toBe(true);

    const deletedCommitment = await request(app)
      .delete(`/api/commitments/${hardCommitment.body.commitment.id}`)
      .set('Cookie', ownerCookie);
    expect(deletedCommitment.status).toBe(200);

    const locked = await request(app)
      .post(`/api/candidates/${optionA.body.candidate.id}/lock`)
      .set('Cookie', ownerCookie);
    expect(locked.status).toBe(200);
    expect(locked.body).toMatchObject({
      alreadyLocked: false,
      workspace: {
        state: 'ACTIVE',
        lockedCandidateSemesterId: optionA.body.candidate.id,
        activeCourseSelections: [
          {
            courseCode: expect.any(String),
            status: 'ACTIVE',
            state: { dataCompleteness: 0, dataConfidence: 0 },
          },
        ],
      },
    });
    expect(await prisma?.activeCourseSelection.count({ where: { workspaceId } })).toBe(1);
    expect(
      await prisma?.activeCourseState.count({ where: { activeCourseSelection: { workspaceId } } }),
    ).toBe(1);

    const repeatedLock = await request(app)
      .post(`/api/candidates/${optionA.body.candidate.id}/lock`)
      .set('Cookie', ownerCookie);
    expect(repeatedLock.status).toBe(200);
    expect(repeatedLock.body.alreadyLocked).toBe(true);
    expect(await prisma?.activeCourseSelection.count({ where: { workspaceId } })).toBe(1);

    const toMinutes = (value: string) => {
      const [hours, minutes] = value.split(':').map(Number);
      return hours * 60 + minutes;
    };
    const activeMeetings = switched.body.selection.meetings as Array<{
      day: string;
      startTime: string;
      endTime: string;
    }>;
    const firstSectionMeetings = courseWithMultipleSections.sections[0]
      .meetings as typeof activeMeetings;
    const additionalCourse = catalogue.body.courses.find(
      (course: { id: string; sections: Array<{ meetings: typeof activeMeetings }> }) =>
        course.id !== courseWithMultipleSections.id &&
        course.sections.some((section) =>
          section.meetings.every((meeting) =>
            [...activeMeetings, ...firstSectionMeetings].every(
              (activeMeeting) =>
                meeting.day !== activeMeeting.day ||
                toMinutes(meeting.endTime) <= toMinutes(activeMeeting.startTime) ||
                toMinutes(activeMeeting.endTime) <= toMinutes(meeting.startTime),
            ),
          ),
        ),
    );
    expect(additionalCourse).toBeDefined();
    const additionalSection = additionalCourse.sections.find((section) =>
      section.meetings.every((meeting) =>
        [...activeMeetings, ...firstSectionMeetings].every(
          (activeMeeting) =>
            meeting.day !== activeMeeting.day ||
            toMinutes(meeting.endTime) <= toMinutes(activeMeeting.startTime) ||
            toMinutes(activeMeeting.endTime) <= toMinutes(meeting.startTime),
        ),
      ),
    );
    expect(additionalSection).toBeDefined();
    const addedActiveCourse = await request(app)
      .post(`/api/workspaces/${workspaceId}/active-selections`)
      .set('Cookie', ownerCookie)
      .send({ sectionId: additionalSection.id });
    expect(addedActiveCourse.status).toBe(201);
    expect(addedActiveCourse.body.activeCourseSelection).toMatchObject({
      courseOfferingId: additionalCourse.id,
      status: 'ACTIVE',
    });

    const duplicateActiveCourse = await request(app)
      .post(`/api/workspaces/${workspaceId}/active-selections`)
      .set('Cookie', ownerCookie)
      .send({ sectionId: additionalSection.id });
    expect(duplicateActiveCourse.status).toBe(409);
    expect(duplicateActiveCourse.body.error).toBe('COURSE_ALREADY_ACTIVE');

    const activeSwitched = await request(app)
      .patch(`/api/active-selections/${locked.body.workspace.activeCourseSelections[0].id}`)
      .set('Cookie', ownerCookie)
      .send({ sectionId: firstSectionId });
    expect(activeSwitched.status).toBe(200);
    expect(activeSwitched.body.activeCourseSelection.sectionId).toBe(firstSectionId);

    const droppedActiveCourse = await request(app)
      .post(`/api/active-selections/${addedActiveCourse.body.activeCourseSelection.id}/drop`)
      .set('Cookie', ownerCookie);
    expect(droppedActiveCourse.status).toBe(200);
    expect(droppedActiveCourse.body.workspace.activeCourseSelections).toHaveLength(1);
    expect(
      await prisma?.activeCourseSelection.findUnique({
        where: { id: addedActiveCourse.body.activeCourseSelection.id },
        select: { status: true, droppedAt: true },
      }),
    ).toMatchObject({ status: 'DROPPED', droppedAt: expect.any(Date) });

    const duplicated = await request(app)
      .post(`/api/candidates/${optionA.body.candidate.id}/duplicate`)
      .set('Cookie', ownerCookie);
    expect(duplicated.status).toBe(201);
    expect(duplicated.body.candidate).toMatchObject({ name: 'Option A copy', selectionCount: 1 });

    const removed = await request(app)
      .delete(`/api/selections/${selection.body.selection.id}`)
      .set('Cookie', ownerCookie);
    expect(removed.status).toBe(200);
    expect(removed.body.candidate).toMatchObject({ selectionCount: 0, credits: 0 });

    const archived = await request(app)
      .patch(`/api/candidates/${optionB.body.candidate.id}`)
      .set('Cookie', ownerCookie)
      .send({ isArchived: true });
    expect(archived.status).toBe(200);
    expect(archived.body.candidate.isArchived).toBe(true);

    const workspace = await request(app)
      .get(`/api/workspaces/${workspaceId}`)
      .set('Cookie', ownerCookie);
    expect(workspace.status).toBe(200);
    expect(
      workspace.body.workspace.candidates.map((candidate: { name: string }) => candidate.name),
    ).toEqual(['Option A', 'Option A copy']);

    const intruderSignUp = await request(app).post('/api/auth/sign-up/email').send({
      name: 'Planning Intruder',
      email: intruderEmail,
      password,
    });
    const intruderCookie = intruderSignUp.headers['set-cookie'];

    const foreignCommitmentEvent = await request(app)
      .patch(`/api/commitment-events/${commitmentEvent.body.event.id}`)
      .set('Cookie', intruderCookie)
      .send({
        title: 'Stolen event',
        startAt: '2026-10-13T10:00:00.000Z',
        endAt: '2026-10-13T11:00:00.000Z',
      });
    expect(foreignCommitmentEvent.status).toBe(404);

    const foreignWorkspace = await request(app)
      .get(`/api/workspaces/${workspaceId}`)
      .set('Cookie', intruderCookie);
    expect(foreignWorkspace.status).toBe(404);

    const foreignCandidateUpdate = await request(app)
      .patch(`/api/candidates/${optionA.body.candidate.id}`)
      .set('Cookie', intruderCookie)
      .send({ name: 'Stolen option' });
    expect(foreignCandidateUpdate.status).toBe(404);

    const foreignSelectionCreate = await request(app)
      .post(`/api/candidates/${optionA.body.candidate.id}/selections`)
      .set('Cookie', intruderCookie)
      .send({ sectionId: firstSectionId });
    expect(foreignSelectionCreate.status).toBe(404);

    const foreignCommitmentCreate = await request(app)
      .post(`/api/workspaces/${workspaceId}/commitments`)
      .set('Cookie', intruderCookie)
      .send({
        name: 'Stolen commitment',
        category: 'PERSONAL',
        weeklyEffortHours: 1,
        flexibility: 'FLEXIBLE',
        meetings: [],
      });
    expect(foreignCommitmentCreate.status).toBe(404);

    const foreignValidation = await request(app)
      .get(`/api/candidates/${optionA.body.candidate.id}/validation`)
      .set('Cookie', intruderCookie);
    expect(foreignValidation.status).toBe(404);

    const foreignLock = await request(app)
      .post(`/api/candidates/${optionA.body.candidate.id}/lock`)
      .set('Cookie', intruderCookie);
    expect(foreignLock.status).toBe(404);

    const foreignActiveAdd = await request(app)
      .post(`/api/workspaces/${workspaceId}/active-selections`)
      .set('Cookie', intruderCookie)
      .send({ sectionId: additionalSection.id });
    expect(foreignActiveAdd.status).toBe(404);

    const foreignAnalysis = await request(app)
      .get(`/api/candidates/${optionA.body.candidate.id}/analysis`)
      .set('Cookie', intruderCookie);
    expect(foreignAnalysis.status).toBe(404);

    const foreignComparison = await request(app)
      .get(`/api/workspaces/${workspaceId}/comparison`)
      .set('Cookie', intruderCookie);
    expect(foreignComparison.status).toBe(404);

    const foreignScenario = await request(app)
      .post(`/api/candidates/${optionA.body.candidate.id}/scenario`)
      .set('Cookie', intruderCookie)
      .send({ preferences: { workloadPriority: 1 } });
    expect(foreignScenario.status).toBe(404);

    const foreignProfileUpdate = await request(app)
      .patch(`/api/workspaces/${workspaceId}/workload-profiles/${courseOfferingId}`)
      .set('Cookie', intruderCookie)
      .send({ projectIntensity: 1 });
    expect(foreignProfileUpdate.status).toBe(404);

    const foreignPreferences = await request(app)
      .patch(`/api/workspaces/${workspaceId}/preferences`)
      .set('Cookie', intruderCookie)
      .send({ workloadPriority: 0.1 });
    expect(foreignPreferences.status).toBe(404);
  });
});
