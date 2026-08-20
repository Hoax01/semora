import type express from 'express';
import { detectTimetableClashes, type MeetingDay } from '@semora/semester-engine';
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

const selectionRequestSchema = z.object({
  sectionId: z.string().trim().min(1),
});

const commitmentCategories = [
  'TASHIP',
  'SOCIETY',
  'WORK',
  'RESEARCH',
  'GYM',
  'COMMUTE',
  'PERSONAL',
  'OTHER',
] as const;
const commitmentFlexibilities = ['HARD', 'SOFT', 'FLEXIBLE'] as const;
const meetingDays = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
] as const;
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
const commitmentMeetingSchema = z.object({
  dayOfWeek: z.enum(meetingDays),
  startTime: z.string().regex(timePattern),
  endTime: z.string().regex(timePattern),
});
const commitmentRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    category: z.enum(commitmentCategories),
    weeklyEffortHours: z.number().finite().min(0).max(168),
    flexibility: z.enum(commitmentFlexibilities),
    meetings: z.array(commitmentMeetingSchema).max(7),
  })
  .superRefine((value, context) => {
    const seen = new Set<string>();
    for (const [index, meeting] of value.meetings.entries()) {
      if (meeting.startTime >= meeting.endTime) {
        context.addIssue({
          code: 'custom',
          path: ['meetings', index, 'endTime'],
          message: 'Meeting must end after it starts.',
        });
      }
      const key = `${meeting.dayOfWeek}:${meeting.startTime}:${meeting.endTime}`;
      if (seen.has(key)) {
        context.addIssue({
          code: 'custom',
          path: ['meetings', index],
          message: 'Recurring meetings must be unique.',
        });
      }
      seen.add(key);
    }
  });

const selectionInclude = {
  section: {
    include: {
      courseOffering: { include: { course: true } },
      meetings: true,
    },
  },
} as const;

const commitmentInclude = { meetings: true } as const;

const workspaceInclude = {
  academicTerm: { include: { university: true } },
  commitments: {
    include: commitmentInclude,
    orderBy: { createdAt: 'asc' as const },
  },
  candidates: {
    where: { isArchived: false },
    include: {
      _count: { select: { selections: true } },
      selections: { include: selectionInclude },
    },
    orderBy: { createdAt: 'asc' as const },
  },
} as const;

type SelectionRecord = {
  id: string;
  section: {
    id: string;
    sectionCode: string;
    capacity: number | null;
    instructorDisplay: string | null;
    meetings: Array<{
      dayOfWeek: string;
      startTime: Date;
      endTime: Date;
      meetingType: string;
      location: string | null;
    }>;
    courseOffering: {
      id: string;
      creditHours: { toString(): string };
      course: { courseCode: string; title: string };
    };
  };
};

type CandidateRecord = {
  id: string;
  name: string;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
  _count: { selections: number };
  selections?: SelectionRecord[];
};

type CommitmentRecord = {
  id: string;
  name: string;
  category: string;
  weeklyEffortHours: { toString(): string };
  flexibility: string;
  meetings: Array<{
    dayOfWeek: string;
    startTime: Date;
    endTime: Date;
  }>;
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
  commitments: CommitmentRecord[];
  candidates: CandidateRecord[];
};

function serializeCandidate(candidate: CandidateRecord) {
  const selections = candidate.selections ?? [];
  const credits = selections.reduce(
    (total, selection) => total + Number(selection.section.courseOffering.creditHours),
    0,
  );

  return {
    id: candidate.id,
    name: candidate.name,
    isArchived: candidate.isArchived,
    selectionCount: candidate._count.selections,
    credits,
    selections: selections.map(serializeSelection),
    createdAt: candidate.createdAt.toISOString(),
    updatedAt: candidate.updatedAt.toISOString(),
  };
}

function formatTime(value: Date) {
  return `${String(value.getUTCHours()).padStart(2, '0')}:${String(value.getUTCMinutes()).padStart(2, '0')}`;
}

function serializeSelection(selection: SelectionRecord) {
  return {
    id: selection.id,
    sectionId: selection.section.id,
    sectionCode: selection.section.sectionCode,
    capacity: selection.section.capacity,
    instructor: selection.section.instructorDisplay,
    courseOfferingId: selection.section.courseOffering.id,
    courseCode: selection.section.courseOffering.course.courseCode,
    title: selection.section.courseOffering.course.title,
    credits: Number(selection.section.courseOffering.creditHours),
    meetings: selection.section.meetings.map((meeting) => ({
      day: meeting.dayOfWeek,
      startTime: formatTime(meeting.startTime),
      endTime: formatTime(meeting.endTime),
      type: meeting.meetingType,
      location: meeting.location,
    })),
  };
}

function serializeCommitment(commitment: CommitmentRecord) {
  return {
    id: commitment.id,
    name: commitment.name,
    category: commitment.category,
    weeklyEffortHours: Number(commitment.weeklyEffortHours),
    flexibility: commitment.flexibility,
    meetings: commitment.meetings.map((meeting) => ({
      day: meeting.dayOfWeek,
      startTime: formatTime(meeting.startTime),
      endTime: formatTime(meeting.endTime),
    })),
  };
}

function commitmentMeetingData(meeting: z.infer<typeof commitmentMeetingSchema>) {
  return {
    dayOfWeek: meeting.dayOfWeek,
    startTime: new Date(`1970-01-01T${meeting.startTime}:00.000Z`),
    endTime: new Date(`1970-01-01T${meeting.endTime}:00.000Z`),
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
    commitments: workspace.commitments.map(serializeCommitment),
    candidates: workspace.candidates.map(serializeCandidate),
  };
}

function validationError(response: express.Response, details: unknown) {
  response.status(400).json({ error: 'VALIDATION_ERROR', details });
}

function conflictError(response: express.Response, error: string) {
  response.status(409).json({ error });
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
      selections: { include: selectionInclude },
    },
  });
}

async function loadOwnedSelection(selectionId: string, userId: string) {
  return prisma?.candidateCourseSelection.findFirst({
    where: { id: selectionId, candidateSemester: { workspace: { userId } } },
    include: {
      candidateSemester: { select: { id: true, workspaceId: true } },
      ...selectionInclude,
    },
  });
}

async function loadSectionForWorkspace(sectionId: string, academicTermId: string) {
  return prisma?.section.findFirst({
    where: { id: sectionId, courseOffering: { academicTermId } },
    include: {
      courseOffering: { include: { course: true } },
      meetings: true,
    },
  });
}

async function loadOwnedCandidateForValidation(candidateId: string, userId: string) {
  return prisma?.candidateSemester.findFirst({
    where: { id: candidateId, workspace: { userId } },
    include: {
      selections: { include: selectionInclude },
      workspace: {
        select: {
          commitments: {
            include: { meetings: true },
            orderBy: { createdAt: 'asc' },
          },
        },
      },
    },
  });
}

function analyzeCandidateTimetable(
  candidate: NonNullable<Awaited<ReturnType<typeof loadOwnedCandidateForValidation>>>,
) {
  return detectTimetableClashes({
    courses: candidate.selections.map((selection) => ({
      id: selection.id,
      courseOfferingId: selection.section.courseOffering.id,
      courseCode: selection.section.courseOffering.course.courseCode,
      sectionCode: selection.section.sectionCode,
      meetings: selection.section.meetings.map((meeting) => ({
        dayOfWeek: meeting.dayOfWeek as MeetingDay,
        startTime: formatTime(meeting.startTime),
        endTime: formatTime(meeting.endTime),
      })),
    })),
    commitments: candidate.workspace.commitments.map((commitment) => ({
      id: commitment.id,
      name: commitment.name,
      flexibility: commitment.flexibility,
      meetings: commitment.meetings.map((meeting) => ({
        dayOfWeek: meeting.dayOfWeek as MeetingDay,
        startTime: formatTime(meeting.startTime),
        endTime: formatTime(meeting.endTime),
      })),
    })),
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

  app.post('/api/workspaces/:workspaceId/commitments', async (request, response) => {
    if (!prisma) {
      response.status(503).json({ error: 'DATABASE_UNAVAILABLE' });
      return;
    }
    const userId = await requireUserId(request, response);
    if (!userId) return;

    const parsed = commitmentRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      validationError(response, parsed.error.flatten());
      return;
    }
    if (!(await loadOwnedWorkspace(request.params.workspaceId, userId))) {
      response.status(404).json({ error: 'WORKSPACE_NOT_FOUND' });
      return;
    }

    const commitment = await prisma.commitment.create({
      data: {
        workspaceId: request.params.workspaceId,
        name: parsed.data.name,
        category: parsed.data.category,
        weeklyEffortHours: parsed.data.weeklyEffortHours,
        flexibility: parsed.data.flexibility,
        meetings: { create: parsed.data.meetings.map(commitmentMeetingData) },
      },
      include: commitmentInclude,
    });

    response.status(201).json({ commitment: serializeCommitment(commitment) });
  });

  app.patch('/api/commitments/:commitmentId', async (request, response) => {
    if (!prisma) {
      response.status(503).json({ error: 'DATABASE_UNAVAILABLE' });
      return;
    }
    const userId = await requireUserId(request, response);
    if (!userId) return;

    const parsed = commitmentRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      validationError(response, parsed.error.flatten());
      return;
    }
    const existing = await prisma.commitment.findFirst({
      where: { id: request.params.commitmentId, workspace: { userId } },
      select: { id: true },
    });
    if (!existing) {
      response.status(404).json({ error: 'COMMITMENT_NOT_FOUND' });
      return;
    }

    const commitment = await prisma.$transaction(async (transaction) => {
      await transaction.commitmentMeeting.deleteMany({ where: { commitmentId: existing.id } });
      return transaction.commitment.update({
        where: { id: existing.id },
        data: {
          name: parsed.data.name,
          category: parsed.data.category,
          weeklyEffortHours: parsed.data.weeklyEffortHours,
          flexibility: parsed.data.flexibility,
          meetings: { create: parsed.data.meetings.map(commitmentMeetingData) },
        },
        include: commitmentInclude,
      });
    });

    response.status(200).json({ commitment: serializeCommitment(commitment) });
  });

  app.delete('/api/commitments/:commitmentId', async (request, response) => {
    if (!prisma) {
      response.status(503).json({ error: 'DATABASE_UNAVAILABLE' });
      return;
    }
    const userId = await requireUserId(request, response);
    if (!userId) return;

    const existing = await prisma.commitment.findFirst({
      where: { id: request.params.commitmentId, workspace: { userId } },
      select: { id: true },
    });
    if (!existing) {
      response.status(404).json({ error: 'COMMITMENT_NOT_FOUND' });
      return;
    }

    await prisma.commitment.delete({ where: { id: existing.id } });
    response.status(200).json({ commitmentId: existing.id });
  });

  app.get('/api/candidates/:candidateId/validation', async (request, response) => {
    if (!prisma) {
      response.status(503).json({ error: 'DATABASE_UNAVAILABLE' });
      return;
    }
    const userId = await requireUserId(request, response);
    if (!userId) return;

    const candidate = await loadOwnedCandidateForValidation(request.params.candidateId, userId);
    if (!candidate) {
      response.status(404).json({ error: 'CANDIDATE_NOT_FOUND' });
      return;
    }

    response.status(200).json({
      candidateId: candidate.id,
      ...analyzeCandidateTimetable(candidate),
    });
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

  app.post('/api/candidates/:candidateId/selections', async (request, response) => {
    if (!prisma) {
      response.status(503).json({ error: 'DATABASE_UNAVAILABLE' });
      return;
    }
    const userId = await requireUserId(request, response);
    if (!userId) return;

    const parsed = selectionRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      validationError(response, parsed.error.flatten());
      return;
    }

    const candidate = await prisma.candidateSemester.findFirst({
      where: { id: request.params.candidateId, workspace: { userId } },
      include: {
        workspace: { select: { academicTermId: true } },
        selections: { include: { section: { select: { courseOfferingId: true } } } },
      },
    });
    if (!candidate) {
      response.status(404).json({ error: 'CANDIDATE_NOT_FOUND' });
      return;
    }

    const section = await loadSectionForWorkspace(
      parsed.data.sectionId,
      candidate.workspace.academicTermId,
    );
    if (!section) {
      response.status(404).json({ error: 'SECTION_NOT_FOUND' });
      return;
    }
    if (
      candidate.selections.some(
        (selection) => selection.section.courseOfferingId === section.courseOfferingId,
      )
    ) {
      conflictError(response, 'COURSE_ALREADY_SELECTED');
      return;
    }

    const selection = await prisma.candidateCourseSelection.create({
      data: { candidateSemesterId: candidate.id, sectionId: section.id },
      include: selectionInclude,
    });
    const workspace = await loadOwnedWorkspace(candidate.workspaceId, userId);
    const savedCandidate = workspace?.candidates.find((item) => item.id === candidate.id);

    response.status(201).json({
      selection: serializeSelection(selection),
      candidate: savedCandidate ? serializeCandidate(savedCandidate) : undefined,
    });
  });

  app.patch('/api/selections/:selectionId', async (request, response) => {
    if (!prisma) {
      response.status(503).json({ error: 'DATABASE_UNAVAILABLE' });
      return;
    }
    const userId = await requireUserId(request, response);
    if (!userId) return;

    const parsed = selectionRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      validationError(response, parsed.error.flatten());
      return;
    }

    const existing = await loadOwnedSelection(request.params.selectionId, userId);
    if (!existing) {
      response.status(404).json({ error: 'SELECTION_NOT_FOUND' });
      return;
    }
    const section = await loadSectionForWorkspace(
      parsed.data.sectionId,
      (
        await prisma.semesterWorkspace.findUniqueOrThrow({
          where: { id: existing.candidateSemester.workspaceId },
          select: { academicTermId: true },
        })
      ).academicTermId,
    );
    if (!section) {
      response.status(404).json({ error: 'SECTION_NOT_FOUND' });
      return;
    }
    if (section.courseOfferingId !== existing.section.courseOffering.id) {
      conflictError(response, 'SECTION_MUST_MATCH_COURSE');
      return;
    }

    const duplicate = await prisma.candidateCourseSelection.findFirst({
      where: {
        candidateSemesterId: existing.candidateSemester.id,
        id: { not: existing.id },
        section: { courseOfferingId: section.courseOfferingId },
      },
      select: { id: true },
    });
    if (duplicate) {
      conflictError(response, 'COURSE_ALREADY_SELECTED');
      return;
    }

    const selection = await prisma.candidateCourseSelection.update({
      where: { id: existing.id },
      data: { sectionId: section.id },
      include: selectionInclude,
    });
    const workspace = await loadOwnedWorkspace(existing.candidateSemester.workspaceId, userId);
    const savedCandidate = workspace?.candidates.find(
      (candidate) => candidate.id === existing.candidateSemester.id,
    );

    response.status(200).json({
      selection: serializeSelection(selection),
      candidate: savedCandidate ? serializeCandidate(savedCandidate) : undefined,
    });
  });

  app.delete('/api/selections/:selectionId', async (request, response) => {
    if (!prisma) {
      response.status(503).json({ error: 'DATABASE_UNAVAILABLE' });
      return;
    }
    const userId = await requireUserId(request, response);
    if (!userId) return;

    const existing = await loadOwnedSelection(request.params.selectionId, userId);
    if (!existing) {
      response.status(404).json({ error: 'SELECTION_NOT_FOUND' });
      return;
    }

    await prisma.candidateCourseSelection.delete({ where: { id: existing.id } });
    const workspace = await loadOwnedWorkspace(existing.candidateSemester.workspaceId, userId);
    const savedCandidate = workspace?.candidates.find(
      (candidate) => candidate.id === existing.candidateSemester.id,
    );

    response.status(200).json({
      selectionId: existing.id,
      candidate: savedCandidate ? serializeCandidate(savedCandidate) : undefined,
    });
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
    const savedCandidate = await loadOwnedCandidate(candidate.id, userId);

    response.status(200).json({
      candidate: serializeCandidate(savedCandidate ?? candidate),
    });
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
          create: source.selections.map((selection) => ({ sectionId: selection.section.id })),
        },
      },
      include: { _count: { select: { selections: true } } },
    });
    const savedCandidate = await loadOwnedCandidate(candidate.id, userId);

    response.status(201).json({
      candidate: serializeCandidate(savedCandidate ?? candidate),
    });
  });
}
