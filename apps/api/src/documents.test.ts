import { readFile } from 'node:fs/promises';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { app } from './app.js';
import { prisma } from './db.js';
import { removePrivateDocument, privateDocumentPath } from './document-storage.js';
import { DEFAULT_MAX_DOCUMENT_BYTES } from '@semora/extraction';

describe('Phase 5 document storage', () => {
  const ownerEmail = `document-owner-${Date.now()}@example.test`;
  const intruderEmail = `document-intruder-${Date.now()}@example.test`;
  const password = 'semora-test-password';
  let storedKey: string | undefined;

  afterAll(async () => {
    if (storedKey) await removePrivateDocument(storedKey).catch(() => undefined);
    await prisma?.user
      .deleteMany({ where: { email: { in: [ownerEmail, intruderEmail] } } })
      .catch(() => undefined);
  });

  it('stores an owned outline privately and attaches it to the active course state', async () => {
    const ownerSignUp = await request(app).post('/api/auth/sign-up/email').send({
      name: 'Document Owner',
      email: ownerEmail,
      password,
    });
    expect(ownerSignUp.status).toBe(200);
    const ownerCookie = ownerSignUp.headers['set-cookie'];

    const terms = await request(app).get('/api/terms').set('Cookie', ownerCookie);
    const fall2026 = terms.body.universities
      .flatMap((university: { terms: Array<{ id: string; name: string }> }) => university.terms)
      .find((term: { name: string }) => term.name === 'Fall 2026');
    expect(fall2026).toBeDefined();

    const workspaceResponse = await request(app)
      .post('/api/workspaces')
      .set('Cookie', ownerCookie)
      .send({ academicTermId: fall2026.id });
    expect(workspaceResponse.status).toBe(200);
    const workspaceId = workspaceResponse.body.workspace.id as string;
    const offering = await prisma?.courseOffering.findFirstOrThrow({
      where: { academicTermId: fall2026.id },
      include: { course: true, sections: { orderBy: { sectionCode: 'asc' }, take: 1 } },
    });
    const section = offering.sections[0];
    expect(section).toBeDefined();

    await prisma?.semesterWorkspace.update({
      where: { id: workspaceId },
      data: { state: 'ACTIVE' },
    });
    const activeSelection = await prisma?.activeCourseSelection.create({
      data: {
        workspaceId,
        sectionId: section.id,
        state: { create: {} },
      },
    });

    const bytes = Buffer.from('%PDF-1.4\nSemora outline test');
    const upload = await request(app)
      .post(`/api/active-selections/${activeSelection.id}/outline`)
      .set('Cookie', ownerCookie)
      .set('Content-Type', 'application/pdf')
      .set('X-File-Name', 'Operating Systems Outline.pdf')
      .send(bytes);

    expect(upload.status).toBe(201);
    expect(upload.body.document).toMatchObject({
      documentType: 'COURSE_OUTLINE',
      originalFilename: 'Operating Systems Outline.pdf',
      mimeType: 'application/pdf',
      fileSize: bytes.byteLength,
      fileHash: expect.any(String),
    });
    expect(upload.body.extractionJob).toMatchObject({
      status: 'PENDING',
      extractorVersion: '0.1',
      schemaVersion: '0.1',
    });
    storedKey = (
      await prisma?.document.findUniqueOrThrow({ where: { id: upload.body.document.id } })
    ).storageKey;

    const storedBytes = await readFile(privateDocumentPath(storedKey));
    expect(storedBytes.equals(bytes)).toBe(true);
    expect(
      await prisma?.activeCourseState.findUnique({
        where: { activeCourseSelectionId: activeSelection.id },
        select: { outlineDocumentId: true },
      }),
    ).toEqual({ outlineDocumentId: upload.body.document.id });

    const jobStatus = await request(app)
      .get(`/api/extraction-jobs/${upload.body.extractionJob.id}`)
      .set('Cookie', ownerCookie);
    expect(jobStatus.status).toBe(200);
    expect(jobStatus.body.extractionJob.status).toBe('PENDING');

    const processed = await request(app)
      .post(`/api/extraction-jobs/${upload.body.extractionJob.id}/process`)
      .set('Cookie', ownerCookie);
    expect(processed.status).toBe(200);
    expect(processed.body.extractionJob.status).toBe('FAILED');
    expect(processed.body.extractionJob.failureReason).toMatch(/^PARSING_FAILED:/);
    await removePrivateDocument(storedKey);
    storedKey = undefined;

    const textBytes = Buffer.from(
      [
        `${offering.course.courseCode} ${offering.course.title}`,
        'Instructor: Ada Lovelace',
        'Assignments: 30%',
        'Midterm: 30%',
        'Final Exam: 40%',
        'Absolute grading with letter grade thresholds',
      ].join('\n\n'),
    );
    const textUpload = await request(app)
      .post(`/api/active-selections/${activeSelection.id}/outline`)
      .set('Cookie', ownerCookie)
      .set('Content-Type', 'text/plain')
      .set('X-File-Name', 'Operating Systems Outline.txt')
      .send(textBytes);
    expect(textUpload.status).toBe(201);
    storedKey = (
      await prisma?.document.findUniqueOrThrow({ where: { id: textUpload.body.document.id } })
    ).storageKey;

    const locallyProcessed = await request(app)
      .post(`/api/extraction-jobs/${textUpload.body.extractionJob.id}/process`)
      .set('Cookie', ownerCookie);
    expect(locallyProcessed.status).toBe(200);
    expect(locallyProcessed.body.extractionJob).toMatchObject({
      status: 'REVIEW_REQUIRED',
      modelIdentifier: 'local-deterministic-v0',
      draft: {
        payload: {
          courseIdentity: { courseCode: offering.course.courseCode },
          gradingScheme: { categories: expect.any(Array) },
        },
      },
    });

    const reviewPayload = locallyProcessed.body.extractionJob.draft.payload;
    reviewPayload.gradingScheme.categories[0].name = 'Coursework';
    reviewPayload.gradingScheme.categories[0].aggregationRule = 'DROP_LOWEST_N';
    reviewPayload.gradingScheme.categories[0].ruleParameterN = 1;
    reviewPayload.assessments[0].category = 'Coursework';
    reviewPayload.courseIdentity.instructors = ['Dr. Grace Hopper', 'Dr. Alan Turing'];
    const savedReview = await request(app)
      .put(`/api/extraction-jobs/${textUpload.body.extractionJob.id}/review`)
      .set('Cookie', ownerCookie)
      .send({ payload: reviewPayload });
    expect(savedReview.status).toBe(200);
    expect(savedReview.body.extractionJob.status).toBe('REVIEW_REQUIRED');
    expect(savedReview.body.extractionJob.draft.payload.gradingScheme.categories[0].name).toBe(
      'Coursework',
    );

    const verified = await request(app)
      .post(`/api/extraction-jobs/${textUpload.body.extractionJob.id}/verify`)
      .set('Cookie', ownerCookie)
      .send({ payload: reviewPayload });
    expect(verified.status).toBe(200);
    expect(verified.body.extractionJob).toMatchObject({
      status: 'VERIFIED',
      verification: { state: 'VERIFIED' },
    });

    const savedDraft = await prisma?.extractionDraft.findUnique({
      where: { extractionJobId: textUpload.body.extractionJob.id },
    });
    const initialPayload = savedDraft?.initialPayload as {
      gradingScheme?: { categories?: Array<{ name?: string }> };
    } | null;
    const finalPayload = savedDraft?.draftPayload as {
      gradingScheme?: { categories?: Array<{ name?: string }> };
    } | null;
    expect(initialPayload?.gradingScheme?.categories?.[0]?.name).toBe('Assignments');
    expect(finalPayload?.gradingScheme?.categories?.[0]?.name).toBe('Coursework');
    const corrections = await prisma?.extractionCorrection.findMany({
      where: { extractionJobId: textUpload.body.extractionJob.id },
      orderBy: { fieldPath: 'asc' },
    });
    expect(corrections?.map((correction) => correction.fieldPath)).toEqual(
      expect.arrayContaining([
        'courseIdentity.instructors[0]',
        'gradingScheme.categories[0].aggregationRule',
        'gradingScheme.categories[0].name',
      ]),
    );

    const canonical = await prisma?.activeCourseState.findUnique({
      where: { activeCourseSelectionId: activeSelection.id },
      include: {
        gradingScheme: { include: { categories: true, thresholds: true } },
        assessments: true,
        workloadSignals: true,
      },
    });
    expect(canonical?.gradingScheme).toMatchObject({
      gradingMode: 'ABSOLUTE',
      sourceType: 'VERIFIED_OUTLINE',
      sourceDocumentId: textUpload.body.document.id,
      verified: true,
    });
    expect(canonical?.gradingScheme?.categories.map((category) => category.name)).toContain(
      'Coursework',
    );
    expect(canonical?.gradingScheme?.categories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Coursework',
          aggregationRule: 'DROP_LOWEST_N',
          ruleParameterN: 1,
        }),
      ]),
    );

    const manuallyAddedAfterVerification = await request(app)
      .post(`/api/active-selections/${activeSelection.id}/assessments`)
      .set('Cookie', ownerCookie)
      .send({ title: 'Surprise quiz', assessmentType: 'QUIZ' });
    expect(manuallyAddedAfterVerification.status).toBe(201);
    const manualAssessmentId = manuallyAddedAfterVerification.body.assessment.id as string;
    const manualScore = await request(app)
      .put(`/api/assessments/${manualAssessmentId}/score`)
      .set('Cookie', ownerCookie)
      .send({ percentage: 88 });
    expect(manualScore.status).toBe(200);

    reviewPayload.gradingScheme.gradingMode = 'RELATIVE';
    const savedVerifiedEdit = await request(app)
      .put(`/api/extraction-jobs/${textUpload.body.extractionJob.id}/review`)
      .set('Cookie', ownerCookie)
      .send({ payload: reviewPayload });
    expect(savedVerifiedEdit.status).toBe(200);
    expect(savedVerifiedEdit.body.extractionJob.status).toBe('VERIFIED');

    const appliedVerifiedEdit = await request(app)
      .post(`/api/extraction-jobs/${textUpload.body.extractionJob.id}/verify`)
      .set('Cookie', ownerCookie)
      .send({ payload: reviewPayload });
    expect(appliedVerifiedEdit.status).toBe(200);
    const canonicalAfterVerifiedEdit = await prisma?.activeCourseState.findUnique({
      where: { activeCourseSelectionId: activeSelection.id },
      include: {
        gradingScheme: { include: { categories: true, thresholds: true } },
        assessments: { include: { scores: true } },
      },
    });
    expect(canonicalAfterVerifiedEdit?.gradingScheme?.gradingMode).toBe('RELATIVE');
    expect(canonicalAfterVerifiedEdit?.assessments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: manualAssessmentId,
          scores: [expect.objectContaining({ percentageOverride: expect.anything() })],
        }),
      ]),
    );
    expect(canonical?.assessments[0]?.gradeCategoryId).toBe(
      canonical?.gradingScheme?.categories.find((category) => category.name === 'Coursework')?.id,
    );
    expect(canonical?.instructorDisplay).toBe('Dr. Grace Hopper, Dr. Alan Turing');
    const workspaceAfterVerification = await request(app)
      .get(`/api/workspaces/${workspaceId}`)
      .set('Cookie', ownerCookie);
    expect(workspaceAfterVerification.status).toBe(200);
    expect(
      workspaceAfterVerification.body.workspace.activeCourseSelections.find(
        (selection: { id: string }) => selection.id === activeSelection.id,
      ).instructor,
    ).toBe('Dr. Grace Hopper, Dr. Alan Turing');
    expect(canonical?.assessments.length).toBeGreaterThan(0);
    expect(
      canonical?.assessments.every((assessment) => assessment.sourceType === 'VERIFIED_OUTLINE'),
    ).toBe(true);
    expect(
      canonical?.workloadSignals.some((signal) => signal.signalType === 'ASSESSMENT_COUNT'),
    ).toBe(true);
    expect(Number(canonical?.dataConfidence)).toBeGreaterThan(0);
    expect(Number(canonical?.dataCompleteness)).toBeGreaterThan(0);

    const previousStoredKey = storedKey;
    const staleUpload = await request(app)
      .post(`/api/active-selections/${activeSelection.id}/outline`)
      .set('Cookie', ownerCookie)
      .set('Content-Type', 'text/plain')
      .set('X-File-Name', 'stale-outline.txt')
      .send(
        Buffer.from(
          [
            `${offering.course.courseCode} ${offering.course.title}`,
            'Assignments: 20%',
            'Midterm: 30%',
            'Final Exam: 50%',
            'Absolute grading with letter grade thresholds',
          ].join('\n\n'),
        ),
      );
    expect(staleUpload.status).toBe(201);
    const staleStoredKey = (
      await prisma?.document.findUniqueOrThrow({ where: { id: staleUpload.body.document.id } })
    ).storageKey;
    const staleProcessed = await request(app)
      .post(`/api/extraction-jobs/${staleUpload.body.extractionJob.id}/process`)
      .set('Cookie', ownerCookie);
    expect(staleProcessed.status).toBe(200);
    expect(staleProcessed.body.extractionJob.status).toBe('REVIEW_REQUIRED');

    const currentUpload = await request(app)
      .post(`/api/active-selections/${activeSelection.id}/outline`)
      .set('Cookie', ownerCookie)
      .set('Content-Type', 'text/plain')
      .set('X-File-Name', 'current-outline.txt')
      .send(
        Buffer.from(
          [
            `${offering.course.courseCode} ${offering.course.title}`,
            'Assignments: 25%',
            'Midterm: 25%',
            'Final Exam: 50%',
            'Absolute grading with letter grade thresholds',
          ].join('\n\n'),
        ),
      );
    expect(currentUpload.status).toBe(201);
    storedKey = (
      await prisma?.document.findUniqueOrThrow({ where: { id: currentUpload.body.document.id } })
    ).storageKey;
    const currentProcessed = await request(app)
      .post(`/api/extraction-jobs/${currentUpload.body.extractionJob.id}/process`)
      .set('Cookie', ownerCookie);
    expect(currentProcessed.status).toBe(200);
    expect(currentProcessed.body.extractionJob.status).toBe('REVIEW_REQUIRED');

    const staleVerification = await request(app)
      .post(`/api/extraction-jobs/${staleUpload.body.extractionJob.id}/verify`)
      .set('Cookie', ownerCookie)
      .send({ payload: staleProcessed.body.extractionJob.draft.payload });
    expect(staleVerification.status).toBe(409);
    expect(staleVerification.body.error).toBe('EXTRACTION_DOCUMENT_NOT_CURRENT');

    const currentVerification = await request(app)
      .post(`/api/extraction-jobs/${currentUpload.body.extractionJob.id}/verify`)
      .set('Cookie', ownerCookie)
      .send({ payload: currentProcessed.body.extractionJob.draft.payload });
    expect(currentVerification.status).toBe(200);
    expect(currentVerification.body.extractionJob.status).toBe('VERIFIED');
    const replacedCanonical = await prisma?.activeCourseState.findUnique({
      where: { activeCourseSelectionId: activeSelection.id },
      select: { outlineDocumentId: true, gradingScheme: { select: { sourceDocumentId: true } } },
    });
    expect(replacedCanonical).toEqual({
      outlineDocumentId: currentUpload.body.document.id,
      gradingScheme: { sourceDocumentId: currentUpload.body.document.id },
    });
    if (previousStoredKey) await removePrivateDocument(previousStoredKey);
    await removePrivateDocument(staleStoredKey);

    const intruderSignUp = await request(app).post('/api/auth/sign-up/email').send({
      name: 'Document Intruder',
      email: intruderEmail,
      password,
    });
    const intruderUpload = await request(app)
      .post(`/api/active-selections/${activeSelection.id}/outline`)
      .set('Cookie', intruderSignUp.headers['set-cookie'])
      .set('Content-Type', 'application/pdf')
      .set('X-File-Name', 'intruder.pdf')
      .send(bytes);
    expect(intruderUpload.status).toBe(404);
    expect(intruderUpload.body.error).toBe('ACTIVE_SELECTION_NOT_FOUND');

    const mismatched = await request(app)
      .post(`/api/active-selections/${activeSelection.id}/outline`)
      .set('Cookie', ownerCookie)
      .set('Content-Type', 'application/pdf')
      .set('X-File-Name', 'outline.docx')
      .send(bytes);
    expect(mismatched.status).toBe(400);
    expect(mismatched.body.error).toBe('FILENAME_EXTENSION_MISMATCH');

    const empty = await request(app)
      .post(`/api/active-selections/${activeSelection.id}/outline`)
      .set('Cookie', ownerCookie)
      .set('Content-Type', 'application/pdf')
      .set('X-File-Name', 'empty.pdf')
      .send(Buffer.alloc(0));
    expect(empty.status).toBe(400);
    expect(empty.body.error).toBe('EMPTY_DOCUMENT');

    const oversized = await request(app)
      .post('/api/active-selections/' + activeSelection.id + '/outline')
      .set('Cookie', ownerCookie)
      .set('Content-Type', 'application/pdf')
      .set('X-File-Name', 'oversized.pdf')
      .send(Buffer.alloc(DEFAULT_MAX_DOCUMENT_BYTES + 1));
    expect(oversized.status).toBe(413);
    expect(oversized.body.error).toBe('REQUEST_TOO_LARGE');
  });
});
