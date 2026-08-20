import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../apps/api/src/generated/prisma/client.js';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL must be set before seeding.');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const atTime = (time: string) => new Date(`1970-01-01T${time}:00.000Z`);

const courses = [
  { code: 'CS 100', title: 'Computational Problem Solving', department: 'Computer Science' },
  { code: 'CS 200', title: 'Data Structures', department: 'Computer Science' },
  { code: 'CS 300', title: 'Database Systems', department: 'Computer Science' },
  { code: 'CS 340', title: 'Operating Systems', department: 'Computer Science' },
  { code: 'CS 350', title: 'Computer Networks', department: 'Computer Science' },
  { code: 'MATH 101', title: 'Calculus I', department: 'Mathematics' },
  { code: 'MATH 241', title: 'Linear Algebra', department: 'Mathematics' },
  { code: 'ECON 101', title: 'Principles of Microeconomics', department: 'Economics' },
  { code: 'MGMT 101', title: 'Introduction to Management', department: 'Management' },
  { code: 'HUM 101', title: 'Academic Writing', department: 'Humanities' },
];

async function main() {
  const lums = await prisma.university.upsert({
    where: { shortName: 'LUMS' },
    update: {},
    create: {
      name: 'Lahore University of Management Sciences',
      shortName: 'LUMS',
      country: 'Pakistan',
      timezone: 'Asia/Karachi',
    },
  });

  const fall2026 = await prisma.academicTerm.upsert({
    where: { universityId_name: { universityId: lums.id, name: 'Fall 2026' } },
    update: {},
    create: {
      universityId: lums.id,
      name: 'Fall 2026',
      termType: 'FALL',
      academicYear: '2026-2027',
      startDate: new Date('2026-08-31T00:00:00.000Z'),
      endDate: new Date('2026-12-18T00:00:00.000Z'),
      addDropEndDate: new Date('2026-09-11T00:00:00.000Z'),
      examStartDate: new Date('2026-12-07T00:00:00.000Z'),
      examEndDate: new Date('2026-12-18T00:00:00.000Z'),
    },
  });

  const existingOfferingCount = await prisma.courseOffering.count({
    where: { academicTermId: fall2026.id },
  });
  if (existingOfferingCount > 0) {
    console.log(
      `Skipped development catalogue seed because ${fall2026.name} already has ${existingOfferingCount} offerings.`,
    );
    return;
  }

  for (const [index, course] of courses.entries()) {
    const persistedCourse = await prisma.course.upsert({
      where: {
        universityId_courseCode: {
          universityId: lums.id,
          courseCode: course.code,
        },
      },
      // Seed data must never overwrite an imported catalogue. Existing
      // canonical course records are intentionally left unchanged.
      update: {},
      create: {
        universityId: lums.id,
        courseCode: course.code,
        title: course.title,
        department: course.department,
        creditHoursDefault: '3.0',
      },
    });

    const weekday = index % 2 === 0 ? 'MONDAY' : 'TUESDAY';
    const secondaryWeekday = index % 2 === 0 ? 'WEDNESDAY' : 'THURSDAY';
    const alternateWeekday = index % 2 === 0 ? 'TUESDAY' : 'MONDAY';
    const alternateSecondaryWeekday = index % 2 === 0 ? 'THURSDAY' : 'WEDNESDAY';
    const hour = 8 + (index % 5) * 2;
    const alternateHour = hour + 1;

    await prisma.courseOffering.upsert({
      where: {
        courseId_academicTermId: {
          courseId: persistedCourse.id,
          academicTermId: fall2026.id,
        },
      },
      // A repeat seed is a no-op for an offering that may have since been
      // populated by the official importer.
      update: {},
      create: {
        courseId: persistedCourse.id,
        academicTermId: fall2026.id,
        creditHours: '3.0',
        gradingMode: 'UNKNOWN',
        sourceConfidence: 'DEVELOPMENT_SEED',
        sections: {
          create: [
            {
              sectionCode: '01',
              capacity: 40,
              instructorDisplay: `Instructor ${index + 1}`,
              meetings: {
                create: [
                  {
                    dayOfWeek: weekday,
                    startTime: atTime(`${String(hour).padStart(2, '0')}:00`),
                    endTime: atTime(`${String(hour + 1).padStart(2, '0')}:20`),
                    meetingType: 'LECTURE',
                    location: 'Academic Block',
                  },
                  {
                    dayOfWeek: secondaryWeekday,
                    startTime: atTime(`${String(hour).padStart(2, '0')}:00`),
                    endTime: atTime(`${String(hour + 1).padStart(2, '0')}:20`),
                    meetingType: 'LECTURE',
                    location: 'Academic Block',
                  },
                ],
              },
            },
            {
              sectionCode: '02',
              capacity: 40,
              instructorDisplay: `Instructor ${index + 1}B`,
              meetings: {
                create: [
                  {
                    dayOfWeek: alternateWeekday,
                    startTime: atTime(`${String(alternateHour).padStart(2, '0')}:00`),
                    endTime: atTime(`${String(alternateHour + 1).padStart(2, '0')}:20`),
                    meetingType: 'LECTURE',
                    location: 'Academic Block',
                  },
                  {
                    dayOfWeek: alternateSecondaryWeekday,
                    startTime: atTime(`${String(alternateHour).padStart(2, '0')}:00`),
                    endTime: atTime(`${String(alternateHour + 1).padStart(2, '0')}:20`),
                    meetingType: 'LECTURE',
                    location: 'Academic Block',
                  },
                ],
              },
            },
          ],
        },
      },
    });
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    await prisma.$disconnect();
    throw error;
  });
