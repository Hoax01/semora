import type express from 'express';
import { z } from 'zod';
import { prisma } from './db.js';
import { requireUserId } from './session.js';

const workspaceRequestSchema = z.object({
  academicTermId: z.string().trim().min(1),
});

const candidateNameSchema = z.string().trim().min(1).max(80);

const createCandidateSchema = z.object({
  name: candidateNameSchema,
});

const updateCandidateSchema = z
  .object({
    name: candidateNameSchema.optional(),
    isArchived: z.boolean().optional(),
  })
  .refine((value) => value.name !== undefined || value.isArchived !== undefined);

const workspaceInclude = {
  academicTerm: { include: { university: true } },
  candidates: {
    where: { isArchived: false },
    include: { _count: { select: { selections: true } } },
    orderBy: { createdAt: 'asc' as const },
  },
} as const;

type CandidateRecord = {
  id: string;
  name: string;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
  _count: { selections: number };
};

type WorkspaceRecord = {
  id: string;
  state: string;
  createdAt: Date;
  updatedAt: Date;
  academicTerm: {
    id: string;
    name: string;
    startDate: Date;
    endDate: Date;
    university: { id: string; name: string; shortName: string };
  };
  candidates: CandidateRecord[];
};

function serializeCandidate(candidate: CandidateRecord) {
  return {
    id: candidate.id,
    name: candidate.name,
    isArchived: candidate.isArchived,
    selectionCount: candidate._count.selections,
    createdAt: candidate.createdAt.toISOString(),
    updatedAt: candidate.updatedAt.toISOString(),
  };
}

function serializeWorkspace(workspace: WorkspaceRecord) {
  return {
    id: workspace.id,
    state: workspace.state,
    createdAt: workspace.createdAt.toISOString(),
    updatedAt: workspace.updatedAt.toISOString(),
    term: {
      id: workspace.academicTerm.id,
      name: workspace.academicTerm.name,
      startDate: workspace.academicTerm.startDate.toISOString().slice(0, 10),
      endDate: workspace.academicTerm.endDate.toISOString().slice(0, 10),
      university: workspace.academicTerm.university,
    },
    candidates: workspace.candidates.map(serializeCandidate),
  };
}

function validationError(response: express.Response, details: unknown) {
  response.status(400).json({ error: 'VALIDATION_ERROR', details });
}

async function loadOwnedWorkspace(workspaceId: string, userId: string) {
  return prisma?.semesterWorkspace.findFirst({
    where: { id: workspaceId, userId },
    include: workspaceInclude,
  });
}

async function loadOwnedCandidate(candidateId: string, userId: string) {
  return prisma?.candidateSemester.findFirst({
    where: { id: candidateId, workspace: { userId } },
    include: {
      _count: { select: { selections: true } },
      selections: { select: { sectionId: true } },
    },
  });
}

export function registerPlanningRoutes(app: express.Express) {
  app.get('/api/terms', async (request, response) => {
    if (!prisma) {
      response.status(503).json({ error: 'DATABASE_UNAVAILABLE' });
      return;
    }
    if (!(await requireUserId(request, response))) return;

    const universities = await prisma.university.findMany({
      include: {
        terms: {
          where: { status: { not: 'ARCHIVED' } },
          orderBy: { startDate: 'desc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    response.status(200).json({
      universities: universities.map((university) => ({
        id: university.id,
        name: university.name,
        shortName: university.shortName,
        terms: university.terms.map((term) => ({
          id: term.id,
          name: term.name,
          startDate: term.startDate.toISOString().slice(0, 10),
          endDate: term.endDate.toISOString().slice(0, 10),
          status: term.status,
        })),
      })),
    });
  });

  app.get('/api/workspaces', async (request, response) => {
    if (!prisma) {
      response.status(503).json({ error: 'DATABASE_UNAVAILABLE' });
      return;
    }
    const userId = await requireUserId(request, response);
    if (!userId) return;

    const workspaces = await prisma.semesterWorkspace.findMany({
      where: { userId, state: { not: 'ARCHIVED' } },
      include: workspaceInclude,
      orderBy: { academicTerm: { startDate: 'desc' } },
    });

    response.status(200).json({ workspaces: workspaces.map(serializeWorkspace) });
  });

  app.post('/api/workspaces', async (request, response) => {
    if (!prisma) {
      response.status(503).json({ error: 'DATABASE_UNAVAILABLE' });
      return;
    }
    const userId = await requireUserId(request, response);
    if (!userId) return;

    const parsed = workspaceRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      validationError(response, parsed.error.flatten());
      return;
    }

    const term = await prisma.academicTerm.findUnique({
      where: { id: parsed.data.academicTermId },
      select: { id: true },
    });
    if (!term) {
      response.status(404).json({ error: 'TERM_NOT_FOUND' });
      return;
    }

    const workspace = await prisma.$transaction(async (transaction) => {
      const saved = await transaction.semesterWorkspace.upsert({
        where: {
          userId_academicTermId: { userId, academicTermId: parsed.data.academicTermId },
        },
        update: {},
        create: { userId, academicTermId: parsed.data.academicTermId },
      });

      await transaction.semesterPreferences.upsert({
        where: { workspaceId: saved.id },
        update: {},
        create: { workspaceId: saved.id },
      });

      return transaction.semesterWorkspace.findUniqueOrThrow({
        where: { id: saved.id },
        include: workspaceInclude,
      });
    });

    response.status(200).json({ workspace: serializeWorkspace(workspace) });
  });

  app.get('/api/workspaces/:workspaceId', async (request, response) => {
    if (!prisma) {
      response.status(503).json({ error: 'DATABASE_UNAVAILABLE' });
      return;
    }
    const userId = await requireUserId(request, response);
    if (!userId) return;

    const workspace = await loadOwnedWorkspace(request.params.workspaceId, userId);
    if (!workspace) {
      response.status(404).json({ error: 'WORKSPACE_NOT_FOUND' });
      return;
    }

    response.status(200).json({ workspace: serializeWorkspace(workspace) });
  });

  app.post('/api/workspaces/:workspaceId/candidates', async (request, response) => {
    if (!prisma) {
      response.status(503).json({ error: 'DATABASE_UNAVAILABLE' });
      return;
    }
    const userId = await requireUserId(request, response);
    if (!userId) return;

    const parsed = createCandidateSchema.safeParse(request.body);
    if (!parsed.success) {
      validationError(response, parsed.error.flatten());
      return;
    }
    if (!(await loadOwnedWorkspace(request.params.workspaceId, userId))) {
      response.status(404).json({ error: 'WORKSPACE_NOT_FOUND' });
      return;
    }

    const candidate = await prisma.candidateSemester.create({
      data: { workspaceId: request.params.workspaceId, name: parsed.data.name },
      include: { _count: { select: { selections: true } } },
    });

    response.status(201).json({ candidate: serializeCandidate(candidate) });
  });

  app.patch('/api/candidates/:candidateId', async (request, response) => {
    if (!prisma) {
      response.status(503).json({ error: 'DATABASE_UNAVAILABLE' });
      return;
    }
    const userId = await requireUserId(request, response);
    if (!userId) return;

    const parsed = updateCandidateSchema.safeParse(request.body);
    if (!parsed.success) {
      validationError(response, parsed.error.flatten());
      return;
    }
    const ownedCandidate = await loadOwnedCandidate(request.params.candidateId, userId);
    if (!ownedCandidate) {
      response.status(404).json({ error: 'CANDIDATE_NOT_FOUND' });
      return;
    }

    const update: { name?: string; isArchived?: boolean } = {};
    if (parsed.data.name !== undefined) update.name = parsed.data.name;
    if (parsed.data.isArchived !== undefined) update.isArchived = parsed.data.isArchived;

    const candidate = await prisma.candidateSemester.update({
      where: { id: ownedCandidate.id },
      data: update,
      include: { _count: { select: { selections: true } } },
    });

    response.status(200).json({ candidate: serializeCandidate(candidate) });
  });

  app.post('/api/candidates/:candidateId/duplicate', async (request, response) => {
    if (!prisma) {
      response.status(503).json({ error: 'DATABASE_UNAVAILABLE' });
      return;
    }
    const userId = await requireUserId(request, response);
    if (!userId) return;

    const source = await loadOwnedCandidate(request.params.candidateId, userId);
    if (!source) {
      response.status(404).json({ error: 'CANDIDATE_NOT_FOUND' });
      return;
    }

    const suffix = ' copy';
    const name = `${source.name.slice(0, 80 - suffix.length)}${suffix}`;
    const candidate = await prisma.candidateSemester.create({
      data: {
        workspaceId: source.workspaceId,
        name,
        selections: {
          create: source.selections.map((selection) => ({ sectionId: selection.sectionId })),
        },
      },
      include: { _count: { select: { selections: true } } },
    });

    response.status(201).json({ candidate: serializeCandidate(candidate) });
  });
}
