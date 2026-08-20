import { describe, expect, it } from 'vitest';
import { prisma } from '../db.js';
import { importCatalogue, validateCatalogueImport, type CatalogueImport } from './importer.js';

function catalogue(shortName: string, sections: CatalogueImport['courses'][number]['sections']) {
  return {
    university: {
      name: `Audit University ${shortName}`,
      shortName,
      country: 'Pakistan',
      timezone: 'Asia/Karachi',
    },
    term: {
      name: 'Audit Fall 2026',
      termType: 'FALL',
      academicYear: '2026-2027',
      startDate: '2026-08-31',
      endDate: '2026-12-18',
    },
    courses: [
      {
        courseCode: 'AUD 101',
        title: 'Catalogue Stability',
        creditHoursDefault: 3,
        sections,
      },
    ],
  } satisfies CatalogueImport;
}

function section(sectionCode: string, startTime: string, endTime: string) {
  return {
    sectionCode,
    instructorDisplay: `Instructor ${sectionCode}`,
    meetings: [
      {
        dayOfWeek: 'MONDAY',
        startTime,
        endTime,
        meetingType: 'LECTURE',
      },
    ],
  } satisfies CatalogueImport['courses'][number]['sections'][number];
}

describe('catalogue import validation', () => {
  it('rejects malformed intervals and duplicate canonical identities', () => {
    expect(() =>
      validateCatalogueImport(catalogue('AUD-INVALID-TIME', [section('01', '11:00', '10:00')])),
    ).toThrow('must end after it starts');

    expect(() =>
      validateCatalogueImport(
        catalogue('AUD-DUPLICATE-SECTION', [
          section('01', '10:00', '11:00'),
          section('01', '12:00', '13:00'),
        ]),
      ),
    ).toThrow('sectionCode duplicates 01');
  });
});

describe('catalogue import persistence', () => {
  it.skipIf(!prisma)('preserves selected section identities across repeat imports', async () => {
    if (!prisma) return;
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const shortName = `AUD-${suffix}`;
    const email = `catalogue-audit-${suffix}@example.test`;
    let universityId: string | undefined;
    let academicTermId: string | undefined;

    try {
      const firstImport = await importCatalogue(
        prisma,
        catalogue(shortName, [section('01', '10:00', '11:00'), section('02', '12:00', '13:00')]),
      );
      universityId = firstImport.universityId;
      academicTermId = firstImport.academicTermId;

      const originalSection = await prisma.section.findFirstOrThrow({
        where: { courseOffering: { academicTermId }, sectionCode: '01' },
      });
      const user = await prisma.user.create({ data: { name: 'Catalogue Audit', email } });
      const workspace = await prisma.semesterWorkspace.create({
        data: { userId: user.id, academicTermId },
      });
      const candidate = await prisma.candidateSemester.create({
        data: { workspaceId: workspace.id, name: 'Stable option' },
      });
      const selection = await prisma.candidateCourseSelection.create({
        data: { candidateSemesterId: candidate.id, sectionId: originalSection.id },
      });

      await importCatalogue(prisma, catalogue(shortName, [section('01', '10:30', '11:30')]));

      const refreshedSelection = await prisma.candidateCourseSelection.findUniqueOrThrow({
        where: { id: selection.id },
        include: { section: { include: { meetings: true } } },
      });
      expect(refreshedSelection.section.id).toBe(originalSection.id);
      expect(refreshedSelection.section.meetings[0]?.startTime.toISOString().slice(11, 16)).toBe(
        '10:30',
      );
      expect(
        await prisma.section.count({
          where: { courseOffering: { academicTermId }, sectionCode: '02' },
        }),
      ).toBe(0);

      const emptyImport = catalogue(shortName, []);
      emptyImport.courses = [];
      await importCatalogue(prisma, emptyImport);
      expect(await prisma.candidateCourseSelection.count({ where: { id: selection.id } })).toBe(1);
      expect(
        await prisma.courseOffering.count({
          where: { academicTermId, sections: { some: { candidateSelections: { some: {} } } } },
        }),
      ).toBe(1);
    } finally {
      await prisma.user.deleteMany({ where: { email } });
      if (academicTermId) {
        await prisma.courseOffering.deleteMany({ where: { academicTermId } });
      }
      if (universityId) {
        await prisma.course.deleteMany({ where: { universityId } });
        await prisma.academicTerm.deleteMany({ where: { universityId } });
        await prisma.university.deleteMany({ where: { id: universityId } });
      }
    }
  });
});
