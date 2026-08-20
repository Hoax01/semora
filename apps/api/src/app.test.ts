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
      (course: { sections: unknown[] }) => course.sections.length >= 2,
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

    const foreignPreferences = await request(app)
      .patch(`/api/workspaces/${workspaceId}/preferences`)
      .set('Cookie', intruderCookie)
      .send({ workloadPriority: 0.1 });
    expect(foreignPreferences.status).toBe(404);
  });
});
