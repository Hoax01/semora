import express from 'express';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './auth.js';
import { checkDatabaseConnection, prisma } from './db.js';
import { registerPlanningRoutes } from './planning.js';
import { requireUserId } from './session.js';

export const app = express();

app.disable('x-powered-by');

app.all('/api/auth/*splat', toNodeHandler(auth));
app.use(express.json());

app.get('/api/health', (_request, response) => {
  response.status(200).json({
    status: 'ok',
    service: 'api',
  });
});

app.get('/api/health/db', async (_request, response) => {
  try {
    await checkDatabaseConnection();
    response.status(200).json({
      status: 'ok',
      service: 'database',
    });
  } catch {
    response.status(503).json({
      status: 'error',
      service: 'database',
    });
  }
});

function formatTime(value: Date) {
  return `${String(value.getUTCHours()).padStart(2, '0')}:${String(value.getUTCMinutes()).padStart(2, '0')}`;
}

type CatalogueOffering = {
  id: string;
  creditHours: { toString(): string };
  descriptionOverride: string | null;
  course: {
    courseCode: string;
    title: string;
    description: string | null;
    department: string | null;
  };
  academicTerm: { name: string };
  sections: Array<{
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
  }>;
};

function serializeOffering(offering: CatalogueOffering) {
  return {
    id: offering.id,
    courseCode: offering.course.courseCode,
    title: offering.course.title,
    description: offering.descriptionOverride ?? offering.course.description,
    department: offering.course.department,
    credits: Number(offering.creditHours),
    term: offering.academicTerm.name,
    sections: offering.sections.map((section) => ({
      id: section.id,
      sectionCode: section.sectionCode,
      capacity: section.capacity,
      instructor: section.instructorDisplay,
      meetings: section.meetings.map((meeting) => ({
        day: meeting.dayOfWeek,
        startTime: formatTime(meeting.startTime),
        endTime: formatTime(meeting.endTime),
        type: meeting.meetingType,
        location: meeting.location,
      })),
    })),
  };
}

const catalogueInclude = {
  course: true,
  academicTerm: true,
  sections: { include: { meetings: true }, orderBy: { sectionCode: 'asc' as const } },
} as const;

app.get('/api/catalogue', async (request, response) => {
  if (!prisma) {
    response.status(503).json({ error: 'DATABASE_UNAVAILABLE' });
    return;
  }
  if (!(await requireUserId(request, response))) return;

  const query = String(request.query.q ?? '').trim();
  const termId = String(request.query.termId ?? '').trim();
  const termName = String(request.query.term ?? '').trim();
  const term = termId
    ? await prisma.academicTerm.findUnique({ where: { id: termId } })
    : await prisma.academicTerm.findFirst({
        where: termName ? { name: termName } : {},
        orderBy: { startDate: 'desc' },
      });
  if (!term) {
    response.status(404).json({ error: 'TERM_NOT_FOUND' });
    return;
  }

  const offerings = await prisma.courseOffering.findMany({
    where: {
      academicTermId: term.id,
      ...(query
        ? {
            OR: [
              { course: { courseCode: { contains: query, mode: 'insensitive' } } },
              { course: { title: { contains: query, mode: 'insensitive' } } },
              { course: { department: { contains: query, mode: 'insensitive' } } },
            ],
          }
        : {}),
    },
    include: catalogueInclude,
    orderBy: { course: { courseCode: 'asc' } },
  });

  response.status(200).json({
    term: { id: term.id, name: term.name, universityId: term.universityId },
    courses: offerings.map(serializeOffering),
  });
});

app.get('/api/catalogue/:offeringId', async (request, response) => {
  if (!prisma) {
    response.status(503).json({ error: 'DATABASE_UNAVAILABLE' });
    return;
  }
  if (!(await requireUserId(request, response))) return;
  const offering = await prisma.courseOffering.findUnique({
    where: { id: request.params.offeringId },
    include: catalogueInclude,
  });
  if (!offering) {
    response.status(404).json({ error: 'COURSE_NOT_FOUND' });
    return;
  }
  response.status(200).json({ course: serializeOffering(offering) });
});

app.get('/api/me', async (request, response) => {
  const userId = await requireUserId(request, response);
  if (!userId) return;
  const user = await prisma?.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, image: true },
  });
  response.status(200).json({ user });
});

registerPlanningRoutes(app);
