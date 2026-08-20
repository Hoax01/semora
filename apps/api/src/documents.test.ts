import { readFile } from 'node:fs/promises';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { app } from './app.js';
import { prisma } from './db.js';
import { removePrivateDocument, privateDocumentPath } from './document-storage.js';

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
      include: { sections: { orderBy: { sectionCode: 'asc' }, take: 1 } },
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
  });
});
