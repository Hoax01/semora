import type { PrismaClient } from '../generated/prisma/client.js';

const meetingDays = new Set([
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
]);
const meetingTypes = new Set(['LECTURE', 'LAB', 'TUTORIAL', 'SEMINAR', 'OTHER']);
const termTypes = new Set(['FALL', 'SPRING', 'SUMMER', 'OTHER']);

export type CatalogueImport = {
  university: {
    name: string;
    shortName: string;
    country: string;
    timezone: string;
  };
  term: {
    name: string;
    termType: string;
    academicYear: string;
    startDate: string;
    endDate: string;
    addDropEndDate?: string | undefined;
    examStartDate?: string | undefined;
    examEndDate?: string | undefined;
  };
  courses: Array<{
    courseCode: string;
    title: string;
    description?: string | undefined;
    department?: string | undefined;
    creditHoursDefault: number;
    creditHours?: number | undefined;
    sections: Array<{
      sectionCode: string;
      capacity?: number | undefined;
      instructorDisplay?: string | undefined;
      meetings: Array<{
        dayOfWeek: string;
        startTime: string;
        endTime: string;
        meetingType?: string | undefined;
        location?: string | undefined;
      }>;
    }>;
  }>;
};

function requiredString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${path} must be a non-empty string.`);
  }
  return value.trim();
}

function optionalString(value: unknown, path: string): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return requiredString(value, path);
}

function numberValue(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`${path} must be a non-negative number.`);
  }
  return value;
}

function optionalNumber(value: unknown, path: string): number | undefined {
  if (value === undefined || value === null) return undefined;
  return numberValue(value, path);
}

function isoDate(value: unknown, path: string): Date {
  const stringValue = requiredString(value, path);
  const date = new Date(stringValue);
  if (Number.isNaN(date.getTime())) throw new Error(`${path} must be an ISO date.`);
  return date;
}

function timeValue(value: unknown, path: string): Date {
  const time = requiredString(value, path);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    throw new Error(`${path} must use HH:mm format.`);
  }
  return new Date(`1970-01-01T${time}:00.000Z`);
}

function enumValue(value: unknown, allowed: Set<string>, path: string): string {
  const enumValue = requiredString(value, path).toUpperCase();
  if (!allowed.has(enumValue)) throw new Error(`${path} has unsupported value ${enumValue}.`);
  return enumValue;
}

export function validateCatalogueImport(input: unknown): CatalogueImport {
  if (!input || typeof input !== 'object') throw new Error('Catalogue import must be an object.');
  const value = input as Record<string, unknown>;
  const universityValue = value.university as Record<string, unknown> | undefined;
  const termValue = value.term as Record<string, unknown> | undefined;
  if (!universityValue || !termValue || !Array.isArray(value.courses)) {
    throw new Error('Catalogue import requires university, term, and courses.');
  }

  const courses = value.courses.map((courseValue, courseIndex) => {
    if (!courseValue || typeof courseValue !== 'object') {
      throw new Error(`courses[${courseIndex}] must be an object.`);
    }
    const course = courseValue as Record<string, unknown>;
    if (!Array.isArray(course.sections))
      throw new Error(`courses[${courseIndex}].sections is required.`);
    const sections = course.sections.map((sectionValue, sectionIndex) => {
      if (!sectionValue || typeof sectionValue !== 'object') {
        throw new Error(`courses[${courseIndex}].sections[${sectionIndex}] must be an object.`);
      }
      const section = sectionValue as Record<string, unknown>;
      if (!Array.isArray(section.meetings)) {
        throw new Error(`courses[${courseIndex}].sections[${sectionIndex}].meetings is required.`);
      }
      return {
        sectionCode: requiredString(section.sectionCode, `courses[${courseIndex}].sectionCode`),
        capacity: optionalNumber(section.capacity, `courses[${courseIndex}].capacity`),
        instructorDisplay: optionalString(
          section.instructorDisplay,
          `courses[${courseIndex}].instructorDisplay`,
        ),
        meetings: section.meetings.map((meetingValue, meetingIndex) => {
          if (!meetingValue || typeof meetingValue !== 'object') {
            throw new Error(
              `meeting ${courseIndex}/${sectionIndex}/${meetingIndex} must be an object.`,
            );
          }
          const meeting = meetingValue as Record<string, unknown>;
          return {
            dayOfWeek: enumValue(
              meeting.dayOfWeek,
              meetingDays,
              `courses[${courseIndex}].meetings[${meetingIndex}].dayOfWeek`,
            ),
            startTime: requiredString(
              meeting.startTime,
              `courses[${courseIndex}].meetings[${meetingIndex}].startTime`,
            ),
            endTime: requiredString(
              meeting.endTime,
              `courses[${courseIndex}].meetings[${meetingIndex}].endTime`,
            ),
            meetingType: enumValue(
              meeting.meetingType ?? 'LECTURE',
              meetingTypes,
              `courses[${courseIndex}].meetings[${meetingIndex}].meetingType`,
            ),
            location: optionalString(
              meeting.location,
              `courses[${courseIndex}].meetings[${meetingIndex}].location`,
            ),
          };
        }),
      };
    });

    return {
      courseCode: requiredString(course.courseCode, `courses[${courseIndex}].courseCode`),
      title: requiredString(course.title, `courses[${courseIndex}].title`),
      description: optionalString(course.description, `courses[${courseIndex}].description`),
      department: optionalString(course.department, `courses[${courseIndex}].department`),
      creditHoursDefault: numberValue(
        course.creditHoursDefault,
        `courses[${courseIndex}].creditHoursDefault`,
      ),
      creditHours: optionalNumber(course.creditHours, `courses[${courseIndex}].creditHours`),
      sections,
    };
  });

  return {
    university: {
      name: requiredString(universityValue.name, 'university.name'),
      shortName: requiredString(universityValue.shortName, 'university.shortName'),
      country: requiredString(universityValue.country, 'university.country'),
      timezone: requiredString(universityValue.timezone, 'university.timezone'),
    },
    term: {
      name: requiredString(termValue.name, 'term.name'),
      termType: enumValue(termValue.termType, termTypes, 'term.termType'),
      academicYear: requiredString(termValue.academicYear, 'term.academicYear'),
      startDate: requiredString(termValue.startDate, 'term.startDate'),
      endDate: requiredString(termValue.endDate, 'term.endDate'),
      addDropEndDate: optionalString(termValue.addDropEndDate, 'term.addDropEndDate'),
      examStartDate: optionalString(termValue.examStartDate, 'term.examStartDate'),
      examEndDate: optionalString(termValue.examEndDate, 'term.examEndDate'),
    },
    courses,
  };
}

export async function importCatalogue(prisma: PrismaClient, input: unknown) {
  const catalogue = validateCatalogueImport(input);

  return prisma.$transaction(async (transaction) => {
    const university = await transaction.university.upsert({
      where: { shortName: catalogue.university.shortName },
      update: catalogue.university,
      create: catalogue.university,
    });
    const term = await transaction.academicTerm.upsert({
      where: { universityId_name: { universityId: university.id, name: catalogue.term.name } },
      update: {
        termType: catalogue.term.termType as never,
        academicYear: catalogue.term.academicYear,
        startDate: isoDate(catalogue.term.startDate, 'term.startDate'),
        endDate: isoDate(catalogue.term.endDate, 'term.endDate'),
        addDropEndDate: catalogue.term.addDropEndDate
          ? isoDate(catalogue.term.addDropEndDate, 'term.addDropEndDate')
          : null,
        examStartDate: catalogue.term.examStartDate
          ? isoDate(catalogue.term.examStartDate, 'term.examStartDate')
          : null,
        examEndDate: catalogue.term.examEndDate
          ? isoDate(catalogue.term.examEndDate, 'term.examEndDate')
          : null,
      },
      create: {
        universityId: university.id,
        name: catalogue.term.name,
        termType: catalogue.term.termType as never,
        academicYear: catalogue.term.academicYear,
        startDate: isoDate(catalogue.term.startDate, 'term.startDate'),
        endDate: isoDate(catalogue.term.endDate, 'term.endDate'),
        addDropEndDate: catalogue.term.addDropEndDate
          ? isoDate(catalogue.term.addDropEndDate, 'term.addDropEndDate')
          : null,
        examStartDate: catalogue.term.examStartDate
          ? isoDate(catalogue.term.examStartDate, 'term.examStartDate')
          : null,
        examEndDate: catalogue.term.examEndDate
          ? isoDate(catalogue.term.examEndDate, 'term.examEndDate')
          : null,
      },
    });

    for (const course of catalogue.courses) {
      const persistedCourse = await transaction.course.upsert({
        where: {
          universityId_courseCode: { universityId: university.id, courseCode: course.courseCode },
        },
        update: {
          title: course.title,
          description: course.description ?? null,
          department: course.department ?? null,
          creditHoursDefault: course.creditHoursDefault,
        },
        create: {
          universityId: university.id,
          courseCode: course.courseCode,
          title: course.title,
          description: course.description ?? null,
          department: course.department ?? null,
          creditHoursDefault: course.creditHoursDefault,
        },
      });
      await transaction.courseOffering.upsert({
        where: {
          courseId_academicTermId: { courseId: persistedCourse.id, academicTermId: term.id },
        },
        update: {
          creditHours: course.creditHours ?? course.creditHoursDefault,
          sections: {
            deleteMany: {},
            create: course.sections.map((section) => ({
              sectionCode: section.sectionCode,
              capacity: section.capacity ?? null,
              instructorDisplay: section.instructorDisplay ?? null,
              meetings: {
                create: section.meetings.map((meeting) => ({
                  dayOfWeek: meeting.dayOfWeek as never,
                  startTime: timeValue(meeting.startTime, 'meeting.startTime'),
                  endTime: timeValue(meeting.endTime, 'meeting.endTime'),
                  meetingType: meeting.meetingType as never,
                  location: meeting.location ?? null,
                })),
              },
            })),
          },
        },
        create: {
          courseId: persistedCourse.id,
          academicTermId: term.id,
          creditHours: course.creditHours ?? course.creditHoursDefault,
          sections: {
            create: course.sections.map((section) => ({
              sectionCode: section.sectionCode,
              capacity: section.capacity ?? null,
              instructorDisplay: section.instructorDisplay ?? null,
              meetings: {
                create: section.meetings.map((meeting) => ({
                  dayOfWeek: meeting.dayOfWeek as never,
                  startTime: timeValue(meeting.startTime, 'meeting.startTime'),
                  endTime: timeValue(meeting.endTime, 'meeting.endTime'),
                  meetingType: meeting.meetingType as never,
                  location: meeting.location ?? null,
                })),
              },
            })),
          },
        },
      });
    }

    return {
      universityId: university.id,
      academicTermId: term.id,
      courseCount: catalogue.courses.length,
    };
  });
}
